import { useEffect, useRef, useState } from 'react';
import { Room, RoomEvent, Track, VideoPresets } from 'livekit-client';

export default function BeyondPresenceStream({
  livekitUrl,
  livekitToken,
  avatarParticipantIdentity = '',
  onUserTranscription,
  onAgentTranscription,
  onConnected,
  onDisconnected,
  onRoomRef,
  onSpeakingChange,
  onListeningChange,
  isMuted = false,
}) {
  const videoRef = useRef(null);
  const roomRef = useRef(null);
  const audioElementsRef = useRef([]);
  const receivedBeyMessageRef = useRef(false);
  const lastBeyMessageRoleRef = useRef(null);
  const callbacksRef = useRef({
    onUserTranscription,
    onAgentTranscription,
    onConnected,
    onDisconnected,
    onRoomRef,
    onSpeakingChange,
    onListeningChange,
  });
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);

  useEffect(() => {
    callbacksRef.current = {
      onUserTranscription,
      onAgentTranscription,
      onConnected,
      onDisconnected,
      onRoomRef,
      onSpeakingChange,
      onListeningChange,
    };
  });

  useEffect(() => {
    callbacksRef.current.onSpeakingChange?.(speaking);
  }, [speaking]);

  useEffect(() => {
    callbacksRef.current.onListeningChange?.(listening);
  }, [listening]);

  useEffect(() => {
    if (!livekitUrl || !livekitToken) return undefined;

    let cancelled = false;
    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
      publishDefaults: {
        simulcast: true,
        videoSimulcastLayers: [VideoPresets.h180, VideoPresets.h360],
        videoCodec: 'vp8',
      },
      videoCaptureDefaults: {
        resolution: VideoPresets.h360.resolution,
      },
    });
    roomRef.current = room;
    const normalizedTargetAvatarIdentity = String(avatarParticipantIdentity || '').trim();
    let selectedVideoParticipantIdentity = normalizedTargetAvatarIdentity || null;
    let attachedVideoTrackSid = null;
    let roomConnected = false;

    const isAvatarParticipant = (participant) => {
      const rawIdentity = String(participant?.identity || '');
      if (normalizedTargetAvatarIdentity) {
        return rawIdentity === normalizedTargetAvatarIdentity;
      }

      const identity = rawIdentity.toLowerCase();
      const publishOnBehalf = participant?.attributes?.['lk.publish_on_behalf'];
      return Boolean(
        publishOnBehalf ||
        identity.includes('carely-avatar') ||
        identity.includes('bey-avatar') ||
        participant?.isAgent
      );
    };

    const isCurrentVideoElementHealthy = () => {
      const videoEl = videoRef.current?.querySelector?.('video');
      if (!videoEl || !attachedVideoTrackSid) return false;
      if (!videoEl.srcObject) return false;
      if (videoEl.ended) return false;
      if (videoEl.readyState < 2) return false;
      return Boolean(videoEl.videoWidth || videoEl.videoHeight);
    };

    const attachVideoTrack = (track, participant, reason = 'track_event', force = false) => {
      if (!track || track.kind !== Track.Kind.Video || !videoRef.current) return false;

      const participantIdentity = participant?.identity || null;
      const currentVideoHealthy = isCurrentVideoElementHealthy();
      if (
        attachedVideoTrackSid === track.sid &&
        selectedVideoParticipantIdentity === participantIdentity &&
        videoRef.current.childElementCount > 0 &&
        currentVideoHealthy &&
        !force
      ) {
        return true;
      }

      const el = track.attach();
      el.style.width = '100%';
      el.style.height = '100%';
      el.style.objectFit = 'cover';
      el.style.borderRadius = '0';
      el.autoplay = true;
      el.playsInline = true;

      const requestVideoRecovery = (eventName) => {
        if (cancelled || !roomConnected) return;
        window.setTimeout(() => {
          if (cancelled || !roomConnected || isCurrentVideoElementHealthy()) return;
          console.warn('[BeyondPresence] Avatar video element needs recovery:', participantIdentity, eventName);
          attachedVideoTrackSid = null;
          refreshAvatarVideo(`video_${eventName}`);
        }, eventName === 'waiting' ? 1800 : 700);
      };

      el.addEventListener('stalled', () => requestVideoRecovery('stalled'));
      el.addEventListener('waiting', () => requestVideoRecovery('waiting'));
      el.addEventListener('emptied', () => requestVideoRecovery('emptied'));
      el.addEventListener('ended', () => requestVideoRecovery('ended'));
      el.addEventListener('error', () => requestVideoRecovery('error'));

      videoRef.current.innerHTML = '';
      videoRef.current.appendChild(el);
      el.play?.().catch((err) => {
        console.warn('[BeyondPresence] Avatar video play was blocked or delayed:', err);
      });
      attachedVideoTrackSid = track.sid || null;
      selectedVideoParticipantIdentity = participantIdentity;
      console.log('[BeyondPresence] Avatar video attached:', participantIdentity, reason);
      return true;
    };

    const getAvatarVideoCandidate = () => {
      const participants = normalizedTargetAvatarIdentity
        ? [room.remoteParticipants.get(normalizedTargetAvatarIdentity)].filter(Boolean)
        : Array.from(room.remoteParticipants.values()).filter(isAvatarParticipant);
      const candidates = [];

      for (const participant of participants) {
        const publications = Array.from(participant?.trackPublications?.values?.() || []);
        for (const publication of publications) {
          const publicationKind = publication?.kind ?? publication?.track?.kind;
          if (publicationKind !== Track.Kind.Video) continue;
          if (publication.track) {
            const label = [
              publication.trackName,
              publication.name,
              publication.source,
              publication.track?.sid,
            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase();
            const isWaitingTrack = label.includes('waiting');
            candidates.push({ track: publication.track, participant, isWaitingTrack });
          }
        }
      }

      return candidates.find((candidate) => !candidate.isWaitingTrack) || candidates[0] || null;
    };

    const refreshAvatarVideo = (reason = 'refresh') => {
      if (cancelled) return false;
      const candidate = getAvatarVideoCandidate();
      if (!candidate) return false;
      const forceAttach = reason === 'periodic_heal' || String(reason).startsWith('video_');
      return attachVideoTrack(candidate.track, candidate.participant, reason, forceAttach);
    };

    const getBeyMessageText = (msg) => {
      const directCandidates = [
        msg?.text,
        msg?.message,
        msg?.transcript,
        msg?.content,
        msg?.body,
        msg?.data?.text,
        msg?.data?.message,
        msg?.payload?.text,
        msg?.payload?.message,
      ];

      for (const candidate of directCandidates) {
        const text = typeof candidate === 'string' ? candidate.trim() : '';
        if (text) return text;
      }

      const seen = new Set();
      const visit = (value, key = '') => {
        if (value == null) return '';
        if (typeof value === 'string') {
          const text = value.trim();
          if (!text) return '';
          if (/^(undefined|null|user|assistant|agent|avatar|stt_metrics|livekit_avatar_video_generator)$/i.test(text)) return '';
          if (/^[a-z0-9_-]{14,}$/i.test(text)) return '';
          if (/^(id|request_id|participant_id|room_id|timestamp|type|event_type|label|source)$/i.test(key)) return '';
          return text;
        }
        if (typeof value !== 'object') return '';
        if (seen.has(value)) return '';
        seen.add(value);
        if (Array.isArray(value)) {
          for (const item of value) {
            const text = visit(item, key);
            if (text) return text;
          }
          return '';
        }
        for (const [childKey, childValue] of Object.entries(value)) {
          const text = visit(childValue, childKey);
          if (text) return text;
        }
        return '';
      };

      return visit(msg);
    };

    const isLikelyAgentMessage = (text) => {
      const normalized = String(text || '').toLowerCase().replace(/\s+/g, ' ').trim();
      if (!normalized) return false;
      return (
        normalized.includes('?') ||
        /^(hi|hello|thank|thanks|got it|great|okay|ok|please|could you|can you|what is|what's|now|next)\b/.test(normalized) ||
        /\b(please|tell me|could you|can you|what is|what's|date of birth|full name|application number|medical check-up|let'?s start)\b/.test(normalized)
      );
    };

    const inferBeyMessageRole = (text) => {
      const normalized = String(text || '').toLowerCase().replace(/\s+/g, ' ').trim();
      if (!normalized) return null;
      if (isLikelyAgentMessage(normalized)) return 'assistant';
      if (lastBeyMessageRoleRef.current === 'assistant') return 'user';
      if (/^(yes|no|male|female|other|none|nil|zero|one|two|three|four|five|six|seven|eight|nine|\d+|high|low)\b/.test(normalized)) {
        return 'user';
      }
      return 'user';
    };

    room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      if (cancelled) return;

      if (track.kind === Track.Kind.Video) {
        const shouldUseVideo = normalizedTargetAvatarIdentity
          ? participant?.identity === normalizedTargetAvatarIdentity
          : (
            isAvatarParticipant(participant) ||
            !selectedVideoParticipantIdentity ||
            selectedVideoParticipantIdentity === participant?.identity
          );
        if (!shouldUseVideo) {
          return;
        }
        attachVideoTrack(track, participant, 'track_subscribed');
      }

      if (track.kind === Track.Kind.Audio) {
        const audioEl = track.attach();
        audioEl.style.display = 'none';
        audioEl.autoplay = true;
        audioEl.playsInline = true;
        document.body.appendChild(audioEl);
        audioElementsRef.current.push(audioEl);
      }
    });

    room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
      track.detach().forEach((el) => el.remove());
      audioElementsRef.current = audioElementsRef.current.filter((el) => el.isConnected);
      if (track.kind === Track.Kind.Video && participant?.identity === selectedVideoParticipantIdentity) {
        console.warn('[BeyondPresence] Avatar video track unsubscribed:', participant?.identity);
        attachedVideoTrackSid = null;
        selectedVideoParticipantIdentity = normalizedTargetAvatarIdentity || null;
        window.setTimeout(() => refreshAvatarVideo('track_unsubscribed'), 250);
      }
    });

    room.on(RoomEvent.TrackPublished, (publication, participant) => {
      if (!isAvatarParticipant(participant)) return;
      if (publication?.kind === Track.Kind.Video) {
        window.setTimeout(() => refreshAvatarVideo('track_published'), 150);
      }
    });

    room.on(RoomEvent.TrackUnpublished, (publication, participant) => {
      if (!isAvatarParticipant(participant)) return;
      if (publication?.kind === Track.Kind.Video) {
        attachedVideoTrackSid = null;
        window.setTimeout(() => refreshAvatarVideo('track_unpublished'), 250);
      }
    });

    room.on(RoomEvent.TrackMuted, (publication, participant) => {
      if (!isAvatarParticipant(participant)) return;
      if (publication?.kind === Track.Kind.Video) {
        console.warn('[BeyondPresence] Avatar video muted:', participant?.identity);
      }
    });

    room.on(RoomEvent.TrackUnmuted, (publication, participant) => {
      if (!isAvatarParticipant(participant)) return;
      if (publication?.kind === Track.Kind.Video) {
        window.setTimeout(() => refreshAvatarVideo('track_unmuted'), 150);
      }
    });

    room.on(RoomEvent.ParticipantConnected, (participant) => {
      if (isAvatarParticipant(participant)) {
        window.setTimeout(() => refreshAvatarVideo('participant_connected'), 200);
      }
    });

    room.on(RoomEvent.ParticipantDisconnected, (participant) => {
      if (!isAvatarParticipant(participant)) return;
      console.warn('[BeyondPresence] Avatar participant disconnected:', participant?.identity);
      if (participant?.identity === selectedVideoParticipantIdentity) {
        attachedVideoTrackSid = null;
        selectedVideoParticipantIdentity = normalizedTargetAvatarIdentity || null;
      }
    });

    room.on(RoomEvent.DataReceived, (payload) => {
      if (cancelled) return;
      try {
        const decodedPayload = new TextDecoder().decode(payload);
        let msg;
        try {
          msg = JSON.parse(decodedPayload);
        } catch {
          msg = { message: decodedPayload };
        }
        const eventType = msg?.event_type || msg?.type;
        const messageText = getBeyMessageText(msg);
        console.log('[BeyondPresence] Event:', eventType, msg);

        if (eventType === 'user.transcription' || eventType === 'user_transcription') {
          if (messageText) {
            receivedBeyMessageRef.current = true;
            callbacksRef.current.onUserTranscription?.(messageText, {
              source: 'beyondpresence',
              eventKey: msg.id || `${eventType}_${messageText}_${msg.timestamp || Date.now()}`,
              allowDuringAgentSpeech: true,
            });
            setListening(false);
          }
        }

        if (
          eventType === 'agent.transcription' ||
          eventType === 'agent_transcription' ||
          eventType === 'avatar.transcription'
        ) {
          if (messageText) {
            receivedBeyMessageRef.current = true;
            callbacksRef.current.onAgentTranscription?.(messageText, {
              source: 'beyondpresence',
              eventKey: msg.id || `${eventType}_${messageText}_${msg.timestamp || Date.now()}`,
            });
          }
        }

        if (!eventType && messageText) {
          receivedBeyMessageRef.current = true;
          const eventKey = msg.id || `bey_message_${messageText}_${msg.timestamp || Date.now()}`;
          const inferredRole = inferBeyMessageRole(messageText);
          console.log('[BeyondPresence] Routed Bey message:', inferredRole, messageText);
          lastBeyMessageRoleRef.current = inferredRole;
          if (inferredRole === 'assistant') {
            callbacksRef.current.onAgentTranscription?.(messageText, {
              source: 'beyondpresence_message',
              eventKey,
            });
          } else {
            callbacksRef.current.onUserTranscription?.(messageText, {
              source: 'beyondpresence_message',
              eventKey,
              allowDuringAgentSpeech: true,
            });
            setListening(false);
          }
        }

        if (eventType === 'avatar.speak_started' || eventType === 'agent.speak_started') {
          setSpeaking(true);
          setListening(false);
        }

        if (eventType === 'avatar.speak_ended' || eventType === 'agent.speak_ended') {
          setSpeaking(false);
          setListening(true);
        }
      } catch {
        // ignore non-JSON payloads
      }
    });

    room.on(RoomEvent.TranscriptionReceived, (segments, participant) => {
      if (cancelled) return;

      const finalSegments = Array.isArray(segments)
        ? segments.filter((segment) => segment?.final && String(segment?.text || '').trim())
        : [];
      const usableSegments = finalSegments.length > 0
        ? finalSegments
        : (Array.isArray(segments) ? segments.filter((segment) => String(segment?.text || '').trim()) : []);

      if (!usableSegments.length) return;

      const text = usableSegments
        .map((segment) => String(segment?.text || '').trim())
        .filter(Boolean)
        .join(' ')
        .trim();

      if (!text) return;

      const eventKey = usableSegments
        .map((segment) => segment?.id)
        .filter(Boolean)
        .join('|') || `${participant?.identity || 'unknown'}_${text}`;

      const isLocalParticipant = participant?.identity === room.localParticipant.identity;
      if (isLocalParticipant) {
        if (receivedBeyMessageRef.current) {
          console.log('[BeyondPresence] Local LiveKit transcript used as fallback:', text);
        }
        callbacksRef.current.onUserTranscription?.(text, {
          source: receivedBeyMessageRef.current
            ? 'livekit_transcription_fallback'
            : 'livekit_transcription',
          eventKey,
          allowDuringAgentSpeech: true,
        });
        setListening(false);
        return;
      }

      callbacksRef.current.onAgentTranscription?.(text, {
        source: 'livekit_transcription',
        eventKey,
      });
    });

    room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
      if (cancelled) return;
      const localIdentity = room.localParticipant.identity;
      const agentSpeaking = speakers.some((speaker) => speaker.identity !== localIdentity);
      setSpeaking(agentSpeaking);
      if (!agentSpeaking) {
        setListening(true);
      }
    });

    room.on(RoomEvent.Reconnected, () => {
      console.log('[BeyondPresence] Room reconnected');
      window.setTimeout(() => refreshAvatarVideo('room_reconnected'), 200);
    });

    room.on(RoomEvent.ConnectionStateChanged, (state) => {
      console.log('[BeyondPresence] Connection state:', state);
      if (String(state).toLowerCase() === 'connected') {
        window.setTimeout(() => refreshAvatarVideo('connection_connected'), 200);
      }
    });

    room.on(RoomEvent.Disconnected, () => {
      if (cancelled) return;
      roomConnected = false;
      setConnected(false);
      setSpeaking(false);
      setListening(false);
      callbacksRef.current.onRoomRef?.(null);
      callbacksRef.current.onDisconnected?.();
    });

    room
      .connect(livekitUrl, livekitToken, { autoSubscribe: true })
      .then(async () => {
        if (cancelled) return;
        roomConnected = true;
        setConnected(true);
        setError(null);
        callbacksRef.current.onRoomRef?.(room);
        callbacksRef.current.onConnected?.();
        console.log('[BeyondPresence] Connected to LiveKit room');

        try {
          await room.localParticipant.setMicrophoneEnabled(!isMuted, {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          });
          setListening(!isMuted);
          console.log('[BeyondPresence] Microphone ready');
        } catch (err) {
          console.error('[BeyondPresence] Mic failed:', err);
        }

        window.setTimeout(() => refreshAvatarVideo('initial_connect'), 250);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[BeyondPresence] Connection failed:', err);
        setError(err.message);
        callbacksRef.current.onRoomRef?.(null);
      });

    const videoHealInterval = window.setInterval(() => {
      if (!roomConnected) return;
      if (!videoRef.current?.childElementCount || !isCurrentVideoElementHealthy()) {
        refreshAvatarVideo('periodic_heal');
      }
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(videoHealInterval);
      callbacksRef.current.onRoomRef?.(null);
      audioElementsRef.current.forEach((el) => el.remove());
      audioElementsRef.current = [];
      if (videoRef.current) {
        videoRef.current.innerHTML = '';
      }
      room.disconnect();
      roomRef.current = null;
    };
  }, [avatarParticipantIdentity, livekitToken, livekitUrl]);

  useEffect(() => {
    const room = roomRef.current;
    if (!room || !connected) return;

    room.localParticipant.setMicrophoneEnabled(!isMuted, {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    }).then(() => {
      if (!speaking) {
        setListening(!isMuted);
      }
    }).catch((err) => {
      console.error('[BeyondPresence] Mute toggle failed:', err);
    });
  }, [connected, isMuted, speaking]);

  const borderColor = speaking
    ? 'rgba(16,185,129,0.16)'
    : listening
      ? 'rgba(59,130,246,0.16)'
      : 'rgba(255,255,255,0.03)';

  const glowStyle = speaking
    ? 'inset 0 0 0 2px rgba(16,185,129,0.12)'
    : listening
      ? 'inset 0 0 0 2px rgba(59,130,246,0.12)'
      : 'none';

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          borderRadius: 0,
          overflow: 'hidden',
          boxShadow: glowStyle,
          border: `2px solid ${borderColor}`,
          transition: 'box-shadow 0.4s ease, border-color 0.4s ease',
          background: '#05070d',
        }}
      >
        <div
          ref={videoRef}
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        />

        {!connected && !error && (
          <div style={loaderWrap}>
            <div style={loaderDot} />
            <p style={loaderText}>Connecting to Dr. Christiana...</p>
          </div>
        )}

        {error && (
          <div style={loaderWrap}>
            <p style={{ color: '#f87171', fontSize: 13, textAlign: 'center', padding: '0 20px' }}>
              Connection failed: {error}
            </p>
          </div>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

const loaderWrap = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#0a0a14',
  gap: 12,
};

const loaderDot = {
  width: 36,
  height: 36,
  border: '3px solid rgba(139,92,246,0.3)',
  borderTopColor: '#a78bfa',
  borderRadius: '50%',
  animation: 'spin .8s linear infinite',
};

const loaderText = {
  color: '#a78bfa',
  fontSize: 13,
  fontWeight: 500,
};
