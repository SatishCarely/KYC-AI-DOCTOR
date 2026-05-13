import 'dotenv/config';
import fs from 'node:fs';
import ffmpegPath from 'ffmpeg-static';

const resolvedFfmpegPath = process.env.FFMPEG_PATH
  || (fs.existsSync('/usr/bin/ffmpeg') ? '/usr/bin/ffmpeg' : '')
  || (fs.existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : '')
  || ffmpegPath
  || '';

if (resolvedFfmpegPath) {
  process.env.FFMPEG_PATH = resolvedFfmpegPath;
}

import { fileURLToPath } from 'node:url';
import { WorkerOptions, cli, defineAgent, voice } from '@livekit/agents';
import * as bey from '@livekit/agents-plugin-bey';
import * as openai from '@livekit/agents-plugin-openai';
import * as silero from '@livekit/agents-plugin-silero';
import { RoomEvent, TrackKind } from '@livekit/rtc-node';

if (!process.env.BEY_API_KEY && process.env.BEYOND_PRESENCE_API_KEY) {
  process.env.BEY_API_KEY = process.env.BEYOND_PRESENCE_API_KEY;
}

// Use the legacy known-good avatar from the older managed-agent flow.
const BEY_AVATAR_ID = process.env.BEY_AVATAR_ID || 'f30d7eef-6e71-433f-938d-cecdd8c0b653';
const LIVEKIT_AGENT_NAME = 'carely-avatar-kyc-v2';
const LIVE_DOCTOR_LLM_MODEL = process.env.OPENAI_DOCTOR_MODEL || 'gpt-5.1-chat-latest';
const LIVE_DOCTOR_TTS_MODEL = process.env.OPENAI_DOCTOR_TTS_MODEL || 'gpt-4o-mini-tts';
const LIVE_DOCTOR_STT_MODEL = process.env.OPENAI_DOCTOR_STT_MODEL || 'gpt-4o-transcribe';
const LIVE_DOCTOR_STT_PROVIDER =
  String(process.env.LIVE_DOCTOR_STT_PROVIDER || (process.env.GROQ_API_KEY ? 'groq' : 'openai'))
    .trim()
    .toLowerCase();
const AVATAR_HEALTH_CHECK_MS = 3000;
const AVATAR_RECOVERY_GRACE_MS = 7000;
const AVATAR_RECOVERY_COOLDOWN_MS = 12000;
const LIVE_DOCTOR_TTS_INSTRUCTIONS = [
  'Speak with crisp articulation and distinct syllable separation so the avatar lip movement is visually clear.',
  'Keep the tone warm, professional, reassuring, and natural, like Dr. Christiana speaking to a patient.',
  'Use a slightly lively conversational rhythm instead of a slow monotone.',
  'Avoid overly soft trailing endings, swallowed consonants, or long pauses between phrases.',
].join(' ');
const LIVE_DOCTOR_STT_PROMPT = [
  'This is a medical KYC verification call between Dr. Christiana and a patient.',
  'Transcribe patient speech accurately and preserve short structured answers exactly.',
  'Common answers include: non-applicable, not applicable, N/A, male, female, yes, no, nominee, and dates of birth.',
  'Do not turn short answers like male, female, yes, or no into similar sounding words such as meal, deal, mail, or know.',
  'If the user spells a name letter by letter, preserve the letters clearly rather than guessing a phonetic word.',
  'Do not bias transcription toward any specific demo person name.',
  'If the user says both a spoken name and then spells it, keep the spelled letters as the authoritative version.',
].join(' ');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isVideoPublication = (publication) => {
  const kind =
    publication?.kind ??
    publication?.track?.kind ??
    publication?.info?.kind ??
    publication?.trackInfo?.kind;
  return kind === TrackKind.KIND_VIDEO || String(kind || '').includes('VIDEO');
};

const hasAvatarVideoTrack = (room, participantIdentity) => {
  const participant = room?.remoteParticipants?.get?.(participantIdentity);
  if (!participant?.trackPublications) return false;

  for (const publication of participant.trackPublications.values()) {
    if (isVideoPublication(publication)) {
      return true;
    }
  }

  return false;
};

const waitForAvatarVideoTrack = async (room, participantIdentity, timeoutMs = 15000) => {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (hasAvatarVideoTrack(room, participantIdentity)) {
      return true;
    }
    await sleep(250);
  }

  return hasAvatarVideoTrack(room, participantIdentity);
};

const createDoctorStt = (language) => {
  if (LIVE_DOCTOR_STT_PROVIDER === 'groq' && process.env.GROQ_API_KEY) {
    console.log('[Agent] Using Groq whisper-large-v3-turbo for STT');
    return openai.STT.withGroq({
      model: process.env.GROQ_DOCTOR_STT_MODEL || 'whisper-large-v3-turbo',
      language,
      prompt: LIVE_DOCTOR_STT_PROMPT,
    });
  }

  console.log('[Agent] Using OpenAI STT model:', LIVE_DOCTOR_STT_MODEL);
  return new openai.STT({
    model: LIVE_DOCTOR_STT_MODEL,
    language,
    prompt: LIVE_DOCTOR_STT_PROMPT,
  });
};

export default defineAgent({
  prewarm: async (proc) => {
    proc.userData.vad = await silero.VAD.load();
    console.log('[Agent] Silero VAD ready ✓');
  },
  entry: async (ctx) => {
    await ctx.connect();
    console.log('[Agent] Connected to room:', ctx.room.name);

    let systemPrompt =
      'You are Dr. Christiana, a warm professional doctor helping a patient complete a KYC medical form. Be empathetic, calm, natural, and brief. Keep each reply under 35 words. Ask one field at a time.';
    let greeting =
      "Hi, my name is Dr. Christiana. Let's get started with your medical examination report.";
    let language = 'en';
    let avatarParticipantIdentity = `carely-avatar-${ctx.room.name.slice(-12)}`;
    let avatarParticipantName = 'Dr. Christiana';

    try {
      const meta = ctx.room.metadata ? JSON.parse(ctx.room.metadata) : {};
      if (meta.systemPrompt) systemPrompt = meta.systemPrompt;
      if (meta.greeting) greeting = meta.greeting;
      if (meta.language) language = meta.language;
      if (meta.avatarParticipantIdentity) {
        avatarParticipantIdentity = meta.avatarParticipantIdentity;
      }
      if (meta.avatarParticipantName) {
        avatarParticipantName = meta.avatarParticipantName;
      }
    } catch {
      console.warn('[Agent] Could not parse room metadata — using defaults.');
    }

    const participant = await ctx.waitForParticipant();
    console.log('[Agent] Patient joined room:', participant.identity);
    const vad = ctx.proc.userData?.vad;

    const voiceAgentSession = new voice.AgentSession({
      vad,
      stt: createDoctorStt(language),
      llm: new openai.LLM({
        model: LIVE_DOCTOR_LLM_MODEL,
        maxCompletionTokens: 180,
      }),
      tts: new openai.TTS({
        model: LIVE_DOCTOR_TTS_MODEL,
        voice: 'shimmer',
        speed: 1.08,
        instructions: LIVE_DOCTOR_TTS_INSTRUCTIONS,
      }),
      input: { audio: { autoSubscribe: true } },
      aecWarmupDuration: 8000,
      userAwayTimeout: 180,
      turnHandling: {
        turnDetection: 'vad',
        interruption: {
          enabled: false,
          minDuration: 1800,
          minWords: 3,
          falseInterruptionTimeout: 2000,
          discardAudioIfUninterruptible: false,
          resumeFalseInterruption: true,
        },
        endpointing: {
          minDelay: 900,
          maxDelay: 4500,
        },
      },
    });

    voiceAgentSession.on(voice.AgentSessionEventTypes.UserInputTranscribed, (ev) => {
      if (!ev?.transcript) return;
      console.log(
        `[Agent] User transcript${ev.isFinal ? ' ✓' : ' …'} ${ev.transcript}`
      );
    });

    voiceAgentSession.on(voice.AgentSessionEventTypes.UserStateChanged, (ev) => {
      console.log(`[Agent] User state: ${ev.oldState} -> ${ev.newState}`);
    });

    voiceAgentSession.on(voice.AgentSessionEventTypes.AgentStateChanged, (ev) => {
      console.log(`[Agent] Agent state: ${ev.oldState} -> ${ev.newState}`);
    });

    const voiceAgent = new voice.Agent({ instructions: systemPrompt });
    let lastAvatarHealthyAt = Date.now();
    let lastAvatarRecoveryAt = 0;
    let avatarRecoveryInFlight = false;

    const markAvatarHealthy = (reason = 'track_present') => {
      lastAvatarHealthyAt = Date.now();
      if (reason) {
        console.log('[Agent] Avatar healthy ✓', avatarParticipantIdentity, reason);
      }
    };

    const startAvatarSession = async (reason = 'initial_start') => {
      const avatarSession = new bey.AvatarSession({
        avatarId: BEY_AVATAR_ID,
        apiKey: process.env.BEY_API_KEY,
        avatarParticipantIdentity,
        avatarParticipantName,
      });

      console.log('[Agent] Starting Beyond Presence avatar session...', reason);
      await avatarSession.start(voiceAgentSession, ctx.room);
      console.log(
        '[Agent] Beyond Presence avatar attached ✓',
        avatarParticipantIdentity,
        reason
      );
      return avatarSession;
    };

    const recoverAvatarSession = async (reason = 'watchdog') => {
      const now = Date.now();
      if (avatarRecoveryInFlight) return false;
      if (now - lastAvatarRecoveryAt < AVATAR_RECOVERY_COOLDOWN_MS) return false;

      avatarRecoveryInFlight = true;
      lastAvatarRecoveryAt = now;
      console.warn('[Agent] Avatar recovery requested...', avatarParticipantIdentity, reason);

      try {
        await startAvatarSession(`recovery:${reason}`);
        const recovered = await waitForAvatarVideoTrack(
          ctx.room,
          avatarParticipantIdentity,
          12000
        );

        if (recovered) {
          markAvatarHealthy(`recovery:${reason}`);
          console.log('[Agent] Avatar recovery attached ✓', avatarParticipantIdentity);
          return true;
        }

        console.warn(
          '[Agent] Avatar recovery completed but video track is still missing:',
          avatarParticipantIdentity
        );
        return false;
      } catch (error) {
        console.error('[Agent] Avatar recovery failed:', error);
        return false;
      } finally {
        avatarRecoveryInFlight = false;
      }
    };

    const ensureAvatarHealthy = async (reason = 'periodic_check') => {
      if (hasAvatarVideoTrack(ctx.room, avatarParticipantIdentity)) {
        lastAvatarHealthyAt = Date.now();
        return;
      }

      const unhealthyForMs = Date.now() - lastAvatarHealthyAt;
      if (unhealthyForMs < AVATAR_RECOVERY_GRACE_MS) return;
      await recoverAvatarSession(reason);
    };

    await startAvatarSession();

    await voiceAgentSession.start({
      agent: voiceAgent,
      room: ctx.room,
      inputOptions: {
        participantIdentity: participant.identity,
        closeOnDisconnect: false,
      },
    });
    console.log('[Agent] Voice pipeline started ✓');

    const avatarVideoReady = await waitForAvatarVideoTrack(
      ctx.room,
      avatarParticipantIdentity,
      12000
    );
    if (avatarVideoReady) {
      markAvatarHealthy('initial_video_ready');
      console.log('[Agent] Avatar video track ready ✓', avatarParticipantIdentity);
    } else {
      console.warn(
        '[Agent] Avatar video track not observed before greeting, continuing anyway:',
        avatarParticipantIdentity,
        'visible participants:',
        Array.from(ctx.room.remoteParticipants.keys())
      );
    }

    const onParticipantConnected = (remoteParticipant) => {
      if (remoteParticipant?.identity !== avatarParticipantIdentity) return;
      markAvatarHealthy('participant_connected');
    };

    const onParticipantDisconnected = (remoteParticipant) => {
      if (remoteParticipant?.identity !== avatarParticipantIdentity) return;
      console.warn('[Agent] Avatar participant disconnected:', avatarParticipantIdentity);
      void recoverAvatarSession('participant_disconnected');
    };

    const onTrackPublished = (publication, remoteParticipant) => {
      if (remoteParticipant?.identity !== avatarParticipantIdentity) return;
      if (!isVideoPublication(publication)) return;
      markAvatarHealthy('track_published');
    };

    const onTrackSubscribed = (track, publication, remoteParticipant) => {
      if (remoteParticipant?.identity !== avatarParticipantIdentity) return;
      if (track?.kind !== TrackKind.KIND_VIDEO) return;
      markAvatarHealthy('track_subscribed');
    };

    const onTrackUnpublished = (publication, remoteParticipant) => {
      if (remoteParticipant?.identity !== avatarParticipantIdentity) return;
      if (!isVideoPublication(publication)) return;
      console.warn('[Agent] Avatar video unpublished:', avatarParticipantIdentity);
      void recoverAvatarSession('track_unpublished');
    };

    const onTrackUnsubscribed = (track, publication, remoteParticipant) => {
      if (remoteParticipant?.identity !== avatarParticipantIdentity) return;
      if (track?.kind !== TrackKind.KIND_VIDEO) return;
      console.warn('[Agent] Avatar video unsubscribed:', avatarParticipantIdentity);
      void recoverAvatarSession('track_unsubscribed');
    };

    const onTrackMuted = (publication, remoteParticipant) => {
      if (remoteParticipant?.identity !== avatarParticipantIdentity) return;
      if (!isVideoPublication(publication)) return;
      console.warn('[Agent] Avatar video muted:', avatarParticipantIdentity);
    };

    const onTrackUnmuted = (publication, remoteParticipant) => {
      if (remoteParticipant?.identity !== avatarParticipantIdentity) return;
      if (!isVideoPublication(publication)) return;
      markAvatarHealthy('track_unmuted');
    };

    ctx.room.on(RoomEvent.ParticipantConnected, onParticipantConnected);
    ctx.room.on(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
    ctx.room.on(RoomEvent.TrackPublished, onTrackPublished);
    ctx.room.on(RoomEvent.TrackSubscribed, onTrackSubscribed);
    ctx.room.on(RoomEvent.TrackUnpublished, onTrackUnpublished);
    ctx.room.on(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
    ctx.room.on(RoomEvent.TrackMuted, onTrackMuted);
    ctx.room.on(RoomEvent.TrackUnmuted, onTrackUnmuted);

    const avatarHealthInterval = setInterval(() => {
      void ensureAvatarHealthy('periodic_watchdog');
    }, AVATAR_HEALTH_CHECK_MS);

    ctx.addShutdownCallback(async () => {
      clearInterval(avatarHealthInterval);
      ctx.room.off(RoomEvent.ParticipantConnected, onParticipantConnected);
      ctx.room.off(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
      ctx.room.off(RoomEvent.TrackPublished, onTrackPublished);
      ctx.room.off(RoomEvent.TrackSubscribed, onTrackSubscribed);
      ctx.room.off(RoomEvent.TrackUnpublished, onTrackUnpublished);
      ctx.room.off(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
      ctx.room.off(RoomEvent.TrackMuted, onTrackMuted);
      ctx.room.off(RoomEvent.TrackUnmuted, onTrackUnmuted);
    });

    await voiceAgentSession.say(greeting, { allowInterruptions: false });
    console.log('[Agent] Greeting sent ✓');

    // The agent LLM now drives the entire KYC conversation autonomously.
    // The frontend passively listens for TranscriptionReceived events
    // to track which fields have been answered.
  },
});

process.argv = [process.argv[0], process.argv[1], 'dev'];
cli.runApp(
  new WorkerOptions({
    agent: fileURLToPath(import.meta.url),
    agentName: LIVEKIT_AGENT_NAME,
    wsURL: process.env.LIVEKIT_URL,
    apiKey: process.env.LIVEKIT_API_KEY,
    apiSecret: process.env.LIVEKIT_API_SECRET,
  })
);
