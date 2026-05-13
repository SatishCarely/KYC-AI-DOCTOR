import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import OpenAI from 'openai';
import XLSX from 'xlsx';
import QRCode from 'qrcode';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import os from 'os';
import { spawn } from 'child_process';
import { AccessToken, AgentDispatchClient, RoomServiceClient } from 'livekit-server-sdk';

const app = express();

app.use(cors());
app.use(express.json());

if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

const PORT = process.env.PORT || 3000;

/* =====================
   Multer
===================== */
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}.webm`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
});

/* =====================
   OpenAI Client + Tracker
===================== */
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'dummy', });

let openaiCallCount = 0;

const KYC_LANGUAGE_NAMES = {
  en: 'English',
  hi: 'Hindi',
  es: 'Spanish',
  fr: 'French',
  bn: 'Bengali',
  te: 'Telugu',
  ta: 'Tamil',
  mr: 'Marathi',
  gu: 'Gujarati',
  kn: 'Kannada',
  ml: 'Malayalam',
  pa: 'Punjabi',
  or: 'Odia',
  ur: 'Urdu',
};

const DOCTOR_TTS_INSTRUCTIONS = [
  'Speak in a calm, professional female Indian English accent, like a reassuring doctor speaking clearly to a patient.',
  'Sound like a middle-aged Indian female doctor or care assistant.',
  'Keep the tone warm, clear, confident, and reassuring.',
  'Use a slightly slower pace with natural phrasing.',
  'Avoid exaggerated emotion or dramatic emphasis.',
].join(' ');

const DOCTOR_TTS_SPEED = 0.94;
const OPENAI_CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || 'gpt-5.1-chat-latest';
const OPENAI_TRANSCRIBE_MODEL = process.env.OPENAI_TRANSCRIBE_MODEL || 'gpt-4o-transcribe';

function withSupportedTemperature(model, temperature) {
  const normalizedModel = String(model || '').trim().toLowerCase();
  if (!normalizedModel || typeof temperature !== 'number') return {};
  if (normalizedModel.startsWith('gpt-5')) {
    return { temperature: 1 };
  }
  return { temperature };
}

function withSupportedMaxTokens(model, tokenLimit) {
  const normalizedModel = String(model || '').trim().toLowerCase();
  if (!normalizedModel || typeof tokenLimit !== 'number') return {};
  if (normalizedModel.startsWith('gpt-5')) {
    return { max_completion_tokens: tokenLimit };
  }
  return { max_tokens: tokenLimit };
}
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_KYC_PDF_PATH = path.resolve(__dirname, '../kyc-templates/default-kyc.pdf');
const BEY_API_BASE = 'https://api.bey.dev';
if (!process.env.BEY_API_KEY && process.env.BEYOND_PRESENCE_API_KEY) {
  process.env.BEY_API_KEY = process.env.BEYOND_PRESENCE_API_KEY;
}
const BEY_API_KEY = process.env.BEY_API_KEY || process.env.BEYOND_PRESENCE_API_KEY;
const LIVEKIT_URL = String(process.env.LIVEKIT_URL || '').trim();
const LIVEKIT_API_KEY = String(process.env.LIVEKIT_API_KEY || '').trim();
const LIVEKIT_API_SECRET = String(process.env.LIVEKIT_API_SECRET || '').trim();
const LIVEKIT_AGENT_NAME = 'carely-avatar-kyc-v2';
const BEY_SUPPORTED_LANGUAGE_CODES = new Set([
  'ar', 'ar-SA', 'bn', 'bg', 'zh', 'cs', 'da', 'nl', 'en', 'en-AU', 'en-GB', 'en-US',
  'fi', 'fr', 'fr-CA', 'fr-FR', 'de', 'el', 'hi', 'hu', 'id', 'it', 'ja', 'kk', 'ko',
  'ms', 'no', 'pl', 'pt', 'pt-BR', 'pt-PT', 'ro', 'ru', 'sk', 'es', 'sv', 'tr', 'uk',
  'ur', 'vi',
]);
const BEY_LANGUAGE_FALLBACKS = {
  mr: 'en',
  gu: 'en',
  pa: 'en',
  or: 'en',
  te: 'en',
  ta: 'en',
  kn: 'en',
  ml: 'en',
};
const panSessions = new Map();
const PAN_SESSION_TTL_MS = 15 * 60 * 1000;
const panUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});
let autoAgentProcess = null;

function getKycLanguageName(code) {
  return KYC_LANGUAGE_NAMES[code] || 'English';
}

function isHindiHinglishLanguage(code) {
  const normalized = String(code || '').trim().toLowerCase();
  return normalized === 'hi' || normalized === 'hi-in' || normalized === 'hinglish';
}

function getKycSpeechStyleInstruction(code) {
  if (isHindiHinglishLanguage(code)) {
    return [
      'Speak in natural Indian Hinglish, like a doctor in India talking to a patient.',
      'Use simple Hindi sentence flow mixed with common English medical/form words.',
      'Use words like "aap", "kya", "hai", "please", "BP", "sugar", "thyroid", "cholesterol", "surgery", "medicine", "yes", and "no".',
      'Avoid pure formal Hindi and avoid Sanskritized words.',
      'Do not add "agar haan", "if yes", or detail instructions to the main yes/no question.',
      'Example style: "Kya aapko diabetes, thyroid ya sugar ki problem hai?"',
    ].join(' ');
  }

  return `Speak only in ${getKycLanguageName(code)} for all patient-facing responses. Do not use Hindi, Hinglish, Devanagari text, or translated yes/no hints when ${getKycLanguageName(code)} is English.`;
}

function getSarvamLanguageCode(code) {
  const normalized = String(code || '').trim().toLowerCase();
  if (normalized === 'hi' || normalized === 'hi-in' || normalized === 'hinglish') return 'hi-IN';
  if (normalized === 'en' || normalized === 'en-in') return 'en-IN';
  return normalized.includes('-') ? normalized : `${normalized || 'hi'}-IN`;
}

function getBeyondPresenceLanguageCode(code) {
  const normalized = String(code || 'en').trim();
  if (isHindiHinglishLanguage(normalized)) return 'en';
  if (BEY_SUPPORTED_LANGUAGE_CODES.has(normalized)) {
    return normalized;
  }
  return BEY_LANGUAGE_FALLBACKS[normalized] || 'en';
}

function containsDevanagariText(value) {
  return /[\u0900-\u097F]/.test(String(value || ''));
}

async function rewriteAsRomanHinglish(text, languageCode = 'hi') {
  const trimmed = normalizeTranscriptEncoding(text);
  if (!trimmed) return '';

  const romanized = await trackOpenAICall(`KYC romanize ${languageCode}`, () =>
    openai.chat.completions.create({
      model: OPENAI_CHAT_MODEL,
      ...withSupportedTemperature(OPENAI_CHAT_MODEL, 0.2),
      messages: [
        {
          role: 'system',
          content: `Rewrite the text into natural Indian Hinglish in Roman script only.

Rules:
- Return only the rewritten patient-facing line.
- Sound like a doctor in India speaking casually and clearly to a patient.
- Use simple Roman-script Hinglish, not textbook Hindi.
- Use only ASCII/Roman letters. Do not use Devanagari.
- Preserve names, numbers, dates, acronyms, and medical terms accurately.
- Do not add explanations or extra details.`,
        },
        { role: 'user', content: trimmed },
      ],
    })
  );

  return romanized.choices[0]?.message?.content?.trim() || trimmed;
}

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

function getLiveKitServiceUrl(url = LIVEKIT_URL) {
  const trimmed = String(url || '').trim();
  if (!trimmed) return '';

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'ws:') parsed.protocol = 'http:';
    if (parsed.protocol === 'wss:') parsed.protocol = 'https:';
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return trimmed;
  }
}

function isLiveKitConfigured() {
  return Boolean(LIVEKIT_URL && LIVEKIT_API_KEY && LIVEKIT_API_SECRET);
}

function ensureAgentWorkerRunning() {
  if (process.env.CARELY_DISABLE_AUTO_AGENT === '1') return;
  if (!isLiveKitConfigured()) return;
  if (autoAgentProcess) return;

  const agentPath = path.resolve(__dirname, 'agent.js');
  if (!fs.existsSync(agentPath)) return;

  console.log('[Server] Auto-starting LiveKit agent worker...');
  autoAgentProcess = spawn('node', ['agent.js', 'dev'], {
    cwd: __dirname,
    env: {
      ...process.env,
      CARELY_AGENT_AUTOSTARTED: '1',
    },
    stdio: 'inherit',
  });

  autoAgentProcess.on('exit', (code, signal) => {
    console.warn(`[Server] LiveKit agent worker exited with code=${code} signal=${signal}`);
    autoAgentProcess = null;
  });
}

setInterval(() => {
  const now = Date.now();
  for (const [id, session] of panSessions) {
    if (now - session.createdAt > PAN_SESSION_TTL_MS) {
      panSessions.delete(id);
    }
  }
}, 60_000);

function formatTimestamp(seconds) {
  const totalSeconds = Number(seconds) || 0;
  const mins = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const secs = (totalSeconds % 60).toFixed(2).padStart(5, '0');
  return `${mins}:${secs}`;
}

async function readJsonResponseSafe(response) {
  const rawText = await response.text();
  try {
    return {
      data: rawText ? JSON.parse(rawText) : {},
      rawText,
    };
  } catch {
    return {
      data: {},
      rawText,
    };
  }
}

function extractSarvamErrorMessage(payload, rawText = '') {
  return (
    payload?.message ||
    payload?.error ||
    payload?.detail ||
    payload?.error_message ||
    payload?.errors?.[0]?.message ||
    rawText ||
    'Sarvam transcription failed'
  );
}

function extractProviderErrorMessage(payload, fallback = 'Request failed') {
  if (!payload) return fallback;
  if (typeof payload === 'string') return payload;
  if (typeof payload?.error === 'string') return payload.error;
  if (typeof payload?.message === 'string') return payload.message;
  if (typeof payload?.detail === 'string') return payload.detail;
  if (typeof payload?.detail?.message === 'string') return payload.detail.message;
  if (Array.isArray(payload?.detail) && payload.detail.length > 0) {
    const firstDetail = payload.detail[0];
    if (typeof firstDetail === 'string') return firstDetail;
    if (typeof firstDetail?.message === 'string') return firstDetail.message;
    if (typeof firstDetail?.msg === 'string') return firstDetail.msg;
  }
  if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
    const firstError = payload.errors[0];
    if (typeof firstError === 'string') return firstError;
    if (typeof firstError?.message === 'string') return firstError.message;
  }

  try {
    return JSON.stringify(payload);
  } catch {
    return fallback;
  }
}

function extractJsonObject(text) {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1) {
      throw new Error('No JSON object found in model response');
    }
    return JSON.parse(text.slice(start, end + 1));
  }
}

function decodeEscapedUnicodeText(value) {
  return String(value || '').replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );
}

const WINDOWS_1252_MOJIBAKE_BYTES = {
  0x20ac: 0x80,
  0x201a: 0x82,
  0x0192: 0x83,
  0x201e: 0x84,
  0x2026: 0x85,
  0x2020: 0x86,
  0x2021: 0x87,
  0x02c6: 0x88,
  0x2030: 0x89,
  0x0160: 0x8a,
  0x2039: 0x8b,
  0x0152: 0x8c,
  0x017d: 0x8e,
  0x2018: 0x91,
  0x2019: 0x92,
  0x201c: 0x93,
  0x201d: 0x94,
  0x2022: 0x95,
  0x2013: 0x96,
  0x2014: 0x97,
  0x02dc: 0x98,
  0x2122: 0x99,
  0x0161: 0x9a,
  0x203a: 0x9b,
  0x0153: 0x9c,
  0x017e: 0x9e,
  0x0178: 0x9f,
};

function getMojibakeByte(char) {
  const code = char.charCodeAt(0);
  if (code <= 255) return code;
  return WINDOWS_1252_MOJIBAKE_BYTES[code] ?? null;
}

function hasMojibakeMarker(value) {
  return /[ÃƒÃ‚Ã¢Ã ]/.test(String(value || ''));
}

function repairMojibakeSegment(value) {
  const raw = String(value || '');
  if (!hasMojibakeMarker(raw)) return raw;
  const bytes = [...raw].map(getMojibakeByte);
  if (bytes.some((byte) => byte == null)) return raw;

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bytes));
  } catch {
    return raw;
  }
}

function repairMojibakeText(value) {
  const raw = String(value || '');
  if (!hasMojibakeMarker(raw)) return raw;

  const fullyRepaired = repairMojibakeSegment(raw);
  if (fullyRepaired !== raw) return fullyRepaired;

  return raw.replace(/[\u00A0-\u00FF\u20AC-\u2122]{2,}/g, (segment) =>
    repairMojibakeSegment(segment)
  );
}

function normalizeTranscriptEncoding(value) {
  return repairMojibakeText(decodeEscapedUnicodeText(value))
    .replace(/\s+/g, ' ')
    .trim();
}

function stripInlineYesDetailInstruction(text) {
  return String(text || '')
    .replace(/\s*(?:please\s+)?(?:answer\s+)?yes\s+or\s+no\.?\s*/gi, ' ')
    .replace(/\s*if\s+yes[, ]+[^.?!]*(?:[.?!]|$)/gi, ' ')
    .replace(/\s*agar\s+h(?:aa|a)n[, ]+[^.?!]*(?:[.?!]|$)/gi, ' ')
    .replace(/\s*agar\s+yes[, ]+[^.?!]*(?:[.?!]|$)/gi, ' ')
    .replace(/\s*(?:yes|no)\s+(?:boliye|bataiye|bataye)\.?\s*/gi, ' ')
    .replace(/\s*(?:à¤…à¤—à¤°|à¤¯à¤¦à¤¿)\s+(?:à¤¹à¤¾à¤|à¤¹à¤¾à¤‚|à¤¹à¤¾)[, ]*[^à¥¤.?!]*(?:[à¥¤.?!]|$)/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseCanonicalYesNo(text) {
  const normalized = normalizeTranscriptEncoding(text)
    .toLowerCase()
    .replace(/[,\sà¥¤.!?;:]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return null;

  if (['haan ji', 'ha ji', 'à¤¹à¤¾à¤‚', 'à¤¹à¤¾à¤', 'à¤¹à¤¾', 'à¤¹à¥‹', 'si', 'sÃ­', 'oui'].includes(normalized)) return 'Yes';
  if (['à¤¨à¤¹à¥€à¤‚', 'à¤¨à¤¹à¥€', 'à¤¨à¤¾à¤¹à¥€', 'non'].includes(normalized)) return 'No';

  const indicNormalized = normalizeIndicSpeechText(normalized)
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (['yes', 'haan ji', 'ha ji', 'haan', 'ha', 'han', 'ho'].includes(indicNormalized)) return 'Yes';
  if (['no', 'nahi', 'naahi'].includes(indicNormalized)) return 'No';

  const yesValues = new Set(['yes', 'y', 'yeah', 'yep', 'true', 'haan', 'ha', 'han', 'ho', 'hoy', 'hoi', 'à¤¹à¤¾à¤', 'à¤¹à¤¾à¤‚', 'à¤¹à¥‹', 'à¤¹à¥‹à¤¯']);
  const noValues = new Set(['no', 'n', 'nope', 'nah', 'false', 'nahi', 'naahi', 'à¤¨à¤¹à¥€à¤‚', 'à¤¨à¤¹à¥€', 'à¤¨à¤¾à¤¹à¥€']);

  if (yesValues.has(normalized) || /^(yes|haan|ha|ho|hoy|hoi)\b/.test(normalized)) return 'Yes';
  if (noValues.has(normalized) || /^(no|nahi|naahi)\b/.test(normalized)) return 'No';
  return null;
}

function normalizeIndicSpeechText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\u0939\u093e\u0902|\u0939\u093e\u0901|\u0939\u093e|\u0939\u094b/gi, ' yes ')
    .replace(/\u0928\u0939\u0940\u0902|\u0928\u0939\u0940|\u0928\u093e\u0939\u0940/gi, ' no ')
    .replace(/\u091c\u0928\u0935\u0930\u0940/gi, ' january ')
    .replace(/\u092b\u0930\u0935\u0930\u0940/gi, ' february ')
    .replace(/\u092e\u093e\u0930\u094d\u091a/gi, ' march ')
    .replace(/\u0905\u092a\u094d\u0930\u0948\u0932/gi, ' april ')
    .replace(/\u092e\u0908/gi, ' may ')
    .replace(/\u091c\u0942\u0928/gi, ' june ')
    .replace(/\u091c\u0941\u0932\u093e\u0908/gi, ' july ')
    .replace(/\u0905\u0917\u0938\u094d\u0924/gi, ' august ')
    .replace(/\u0938\u093f\u0924\u0902\u092c\u0930|\u0938\u093f\u0924\u092e\u094d\u092c\u0930/gi, ' september ')
    .replace(/\u0905\u0915\u094d\u091f\u0942\u092c\u0930|\u0911\u0915\u094d\u091f\u094b\u092c\u0930/gi, ' october ')
    .replace(/\u0928\u0935\u0902\u092c\u0930/gi, ' november ')
    .replace(/\u0926\u093f\u0938\u0902\u092c\u0930/gi, ' december ')
    .replace(/\u0936\u0942\u0928\u094d\u092f|\u0938\u0941\u0928\u094d\u092f/gi, ' zero ')
    .replace(/\u090f\u0915/gi, ' one ')
    .replace(/\u0926\u094b\u0928|\u0926\u094b/gi, ' two ')
    .replace(/\u0924\u0940\u0928/gi, ' three ')
    .replace(/\u091a\u093e\u0930/gi, ' four ')
    .replace(/\u092a\u093e\u0902\u091a|\u092a\u093e\u091a/gi, ' five ')
    .replace(/\u0938\u0939\u093e|\u091b\u0939/gi, ' six ')
    .replace(/\u0938\u093e\u0924/gi, ' seven ')
    .replace(/\u0906\u0920/gi, ' eight ')
    .replace(/\u0928\u094c|\u0928\u0909/gi, ' nine ')
    .replace(/\u0926\u0938|\u0926\u0939\u093e/gi, ' ten ')
    .replace(/\u0939\u091c\u093c\u093e\u0930|\u0939\u091c\u093e\u0930/gi, ' thousand ')
    .replace(/à¤‘à¤•à¥à¤Ÿà¥‹à¤¬à¤°|à¤…à¤•à¥à¤Ÿà¥‚à¤¬à¤°|à¤‘à¤•à¥à¤Ÿà¥‚à¤¬à¤°/gi, ' october ')
    .replace(/à¤¸à¤ªà¥à¤Ÿà¥‡à¤‚à¤¬à¤°|à¤¸à¤¿à¤¤à¤‚à¤¬à¤°|à¤¸à¤¿à¤¤à¤®à¥à¤¬à¤°/gi, ' september ')
    .replace(/à¤¨à¤µà¤‚à¤¬à¤°|à¤¨à¥‹à¤µà¥à¤¹à¥‡à¤‚à¤¬à¤°/gi, ' november ')
    .replace(/à¤¡à¤¿à¤¸à¥‡à¤‚à¤¬à¤°|à¤¦à¤¿à¤¸à¤‚à¤¬à¤°/gi, ' december ')
    .replace(/à¤¶à¥‚à¤¨à¥à¤¯|à¤¸à¥à¤¨à¥à¤¯|à¤¸à¥à¥à¤¨à¥à¤¯/gi, ' zero ')
    .replace(/à¤à¤•/gi, ' one ')
    .replace(/à¤¦à¥‹à¤¨|à¤¦à¥‹/gi, ' two ')
    .replace(/à¤¤à¥€à¤¨/gi, ' three ')
    .replace(/à¤šà¤¾à¤°/gi, ' four ')
    .replace(/à¤ªà¤¾à¤š/gi, ' five ')
    .replace(/à¤¸à¤¹à¤¾|à¤›à¤¹/gi, ' six ')
    .replace(/à¤¸à¤¾à¤¤/gi, ' seven ')
    .replace(/à¤†à¤ /gi, ' eight ')
    .replace(/à¤¨à¤Š|à¤¨à¥Œ/gi, ' nine ')
    .replace(/à¤¦à¤¹à¤¾|à¤¦à¤¸/gi, ' ten ')
    .replace(/à¤¹à¤œà¤¾à¤°/gi, ' thousand ')
    .replace(/\bdhohazardha\b/gi, ' two thousand ten ')
    .replace(/\bdhohazdha\b/gi, ' two thousand ten ')
    .replace(/\bdhoh?az(?:a|aa)r?a?\b/gi, ' two thousand ')
    .replace(/\bdohajaar\b/gi, ' two thousand ')
    .replace(/\bdohazar\b/gi, ' two thousand ')
    .replace(/\bdohajar\b/gi, ' two thousand ')
    .replace(/\bdo\s+haza+r\b/gi, ' two thousand ')
    .replace(/\bdon\s+haza+r\b/gi, ' two thousand ')
    .replace(/\bshunya\b/gi, ' zero ')
    .replace(/\bsunya\b/gi, ' zero ')
    .replace(/\bek\b/gi, ' one ')
    .replace(/\bdon\b/gi, ' two ')
    .replace(/\bdo\b/gi, ' two ')
    .replace(/\bteen\b/gi, ' three ')
    .replace(/\btheen\b/gi, ' three ')
    .replace(/\btin\b/gi, ' three ')
    .replace(/\bchar\b/gi, ' four ')
    .replace(/\bchaar\b/gi, ' four ')
    .replace(/\bpach\b/gi, ' five ')
    .replace(/\bpanch\b/gi, ' five ')
    .replace(/\bpaanch\b/gi, ' five ')
    .replace(/\bsaha\b/gi, ' six ')
    .replace(/\bchhe\b/gi, ' six ')
    .replace(/\bcheh\b/gi, ' six ')
    .replace(/\bsaat\b/gi, ' seven ')
    .replace(/\bsat\b/gi, ' seven ')
    .replace(/\baath\b/gi, ' eight ')
    .replace(/\bath\b/gi, ' eight ')
    .replace(/\bnau\b/gi, ' nine ')
    .replace(/\bnav\b/gi, ' nine ')
    .replace(/\bdaha\b/gi, ' ten ')
    .replace(/\bdas\b/gi, ' ten ')
    .replace(/à¤à¤•à¤¶à¥‡|à¤à¤• à¤¶à¥‡/gi, ' one hundred ')
    .replace(/à¤¦à¥‹à¤¨à¤¶à¥‡|à¤¦à¥‹à¤¶à¥‡|à¤¦à¥‹à¤¨ à¤¶à¥‡|à¤¦à¥‹ à¤¶à¥‡/gi, ' two hundred ')
    .replace(/à¤¤à¥€à¤¨à¤¶à¥‡|à¤¤à¥€à¤¨ à¤¶à¥‡/gi, ' three hundred ')
    .replace(/à¤šà¤¾à¤°à¤¶à¥‡|à¤šà¤¾à¤° à¤¶à¥‡/gi, ' four hundred ')
    .replace(/à¤ªà¤¾à¤šà¤¶à¥‡|à¤ªà¤¾à¤š à¤¶à¥‡/gi, ' five hundred ')
    .replace(/à¤¸à¤¹à¤¾à¤¶à¥‡|à¤¸à¤¹à¤¾ à¤¶à¥‡|à¤›à¤¹ à¤¸à¥Œ/gi, ' six hundred ')
    .replace(/à¤¸à¤¾à¤¤à¤¶à¥‡|à¤¸à¤¾à¤¤ à¤¶à¥‡/gi, ' seven hundred ')
    .replace(/à¤†à¤ à¤¶à¥‡|à¤†à¤  à¤¶à¥‡/gi, ' eight hundred ')
    .replace(/à¤¨à¤Šà¤¶à¥‡|à¤¨à¥Œ à¤¸à¥Œ|à¤¨à¤Š à¤¶à¥‡/gi, ' nine hundred ')
    .replace(/\bek\s+shay\b/gi, ' one hundred ')
    .replace(/\bek\s+she\b/gi, ' one hundred ')
    .replace(/\bdon\s+shay\b/gi, ' two hundred ')
    .replace(/\bdon\s+she\b/gi, ' two hundred ')
    .replace(/\bdo\s+shay\b/gi, ' two hundred ')
    .replace(/\bdo\s+she\b/gi, ' two hundred ')
    .replace(/\bteen\s+shay\b/gi, ' three hundred ')
    .replace(/\bteen\s+she\b/gi, ' three hundred ')
    .replace(/\bchar\s+shay\b/gi, ' four hundred ')
    .replace(/\bchar\s+she\b/gi, ' four hundred ')
    .replace(/\bpach\s+shay\b/gi, ' five hundred ')
    .replace(/\bpach\s+she\b/gi, ' five hundred ')
    .replace(/\bsaha\s+shay\b/gi, ' six hundred ')
    .replace(/\bsaha\s+she\b/gi, ' six hundred ')
    .replace(/\bsaat\s+shay\b/gi, ' seven hundred ')
    .replace(/\bsaat\s+she\b/gi, ' seven hundred ')
    .replace(/\baath\s+shay\b/gi, ' eight hundred ')
    .replace(/\baath\s+she\b/gi, ' eight hundred ')
    .replace(/\bnau\s+shay\b/gi, ' nine hundred ')
    .replace(/\bnau\s+she\b/gi, ' nine hundred ')
    .replace(/\bshe\b/gi, ' hundred ')
    .replace(/\bshay\b/gi, ' hundred ')
    .replace(/\bekunaishi\b/gi, ' seventy nine ')
    .replace(/\bekonashi\b/gi, ' seventy nine ')
    .replace(/\bekonaishi\b/gi, ' seventy nine ')
    .replace(/\bekonaenshi\b/gi, ' seventy nine ')
    .replace(/\bekonaainshi\b/gi, ' seventy nine ')
    .replace(/\bekon\saishi\b/gi, ' seventy nine ')
    .replace(/\bekon\saenshi\b/gi, ' seventy nine ')
    .replace(/à¤à¤•à¥‹à¤£à¤à¤‚à¤¶à¥€|à¤à¤•à¥‹à¤£à¤à¤¶à¥€/gi, ' seventy nine ')
    .replace(/\bhajar\b/gi, ' thousand ')
    .replace(/\bhazaar\b/gi, ' thousand ')
    .replace(/\bhazar\b/gi, ' thousand ')
    .replace(/\blakh\b/gi, ' lakh ')
    .replace(/\blac\b/gi, ' lakh ')
    .replace(/\s+/g, ' ')
    .trim();
}

const SPOKEN_NUMBER_WORDS = {
  zero: 0,
  one: 1,
  first: 1,
  two: 2,
  second: 2,
  three: 3,
  third: 3,
  four: 4,
  fourth: 4,
  five: 5,
  fifth: 5,
  six: 6,
  sixth: 6,
  seven: 7,
  seventh: 7,
  eight: 8,
  eighth: 8,
  nine: 9,
  ninth: 9,
  ten: 10,
  tenth: 10,
  eleven: 11,
  eleventh: 11,
  twelve: 12,
  twelfth: 12,
  thirteen: 13,
  thirteenth: 13,
  fourteen: 14,
  fourteenth: 14,
  fifteen: 15,
  fifteenth: 15,
  sixteen: 16,
  sixteenth: 16,
  seventeen: 17,
  seventeenth: 17,
  eighteen: 18,
  eighteenth: 18,
  nineteen: 19,
  nineteenth: 19,
  twenty: 20,
  twentieth: 20,
  thirty: 30,
  thirtieth: 30,
  forty: 40,
  fortieth: 40,
  fifty: 50,
  fiftieth: 50,
  sixty: 60,
  sixtieth: 60,
  seventy: 70,
  seventieth: 70,
  eighty: 80,
  eightieth: 80,
  ninety: 90,
  ninetieth: 90,
};

function parseSpokenNumberTokens(tokens) {
  let total = 0;
  let current = 0;
  let used = false;

  for (const token of tokens) {
    if (!token || token === 'and') continue;
    if (/^\d+$/.test(token)) {
      current += Number(token);
      used = true;
      continue;
    }
    if (SPOKEN_NUMBER_WORDS[token] != null) {
      current += SPOKEN_NUMBER_WORDS[token];
      used = true;
      continue;
    }
    if (token === 'hundred') {
      current = (current || 1) * 100;
      used = true;
      continue;
    }
    if (token === 'thousand') {
      total += (current || 1) * 1000;
      current = 0;
      used = true;
      continue;
    }
    if (token === 'lakh') {
      total += (current || 1) * 100000;
      current = 0;
      used = true;
      continue;
    }
    if (token === 'crore') {
      total += (current || 1) * 10000000;
      current = 0;
      used = true;
      continue;
    }
    return null;
  }

  return used ? total + current : null;
}

async function localizeKycText(text, languageCode, options = {}) {
  const trimmed = normalizeTranscriptEncoding(text);
  if (!trimmed) return '';
  if (!languageCode || languageCode === 'en') return trimmed;

  const languageName = getKycLanguageName(languageCode);
  const hinglishMode = isHindiHinglishLanguage(languageCode);
  const transcriptScriptMode = Boolean(options.transcriptScript);
  const completion = await trackOpenAICall(`KYC localize ${languageCode}`, () =>
    openai.chat.completions.create({
      model: OPENAI_CHAT_MODEL,
      ...withSupportedTemperature(OPENAI_CHAT_MODEL, hinglishMode ? 0.2 : 0.4),
      messages: [
        {
          role: 'system',
          content: hinglishMode && transcriptScriptMode
            ? `Convert Carely KYC transcript text into natural Hindi written in Devanagari script.

Rules:
- Return only the patient-facing transcript line.
- Use simple conversational Hindi. Keep common medical/form terms readable when needed.
- Use Devanagari Hindi script. Do not return Roman Hinglish.
- Preserve names, numbers, dates, acronyms, and form labels accurately.
- Prefer natural phrases like "आपका", "जन्म तारीख", "नॉमिनी", "हाँ या नहीं", "ठीक है".
- Keep common medical terms readable: BP, sugar, diabetes, thyroid, cholesterol, surgery, medicine, hospital, ECG, MRI, CT, HIV, AIDS.
- Do not add "agar haan", "if yes", or extra detail instructions unless they are present in the source text.
- Do not add explanations or notes.`
            : hinglishMode
              ? `Convert Carely KYC avatar speech into natural Indian Hinglish written only in Roman script.

Rules:
- Return only the patient-facing line.
- Sound like a doctor in India speaking naturally to a patient on a video call.
- Use simple conversational Hindi flow mixed with common English medical/form words.
- Prefer Hinglish like "Kya aapko diabetes, thyroid ya sugar ki problem hai?" instead of pure formal Hindi.
- Prefer spoken phrases like "aapka", "janam tareekh", "nominee", "please", "haan ya nahi", "theek hai".
- Use only ASCII/Roman letters. Do not use Devanagari or any Hindi script characters.
- Preserve names, numbers, dates, acronyms, and form labels accurately.
- Keep common terms readable: BP, sugar, diabetes, thyroid, cholesterol, surgery, medicine, hospital, ECG, MRI, CT, HIV, AIDS.
- Do not add "agar haan", "if yes", or extra detail instructions unless they are present in the source text.
- Do not add explanations or notes.`
            : `You translate Carely KYC assistant text into natural spoken ${languageName} for a doctor-patient video call.

Rules:
- Return only the translated patient-facing text.
- Keep the tone warm, direct, and conversational rather than literary or overly formal.
- Preserve names, numbers, dates, and form labels accurately.
- Translate "Yes" and "No" naturally for ${languageName}.
- Do not add explanations or notes.`,
        },
        { role: 'user', content: trimmed },
      ],
    })
  );

  let output = completion.choices[0]?.message?.content?.trim() || trimmed;
  if (hinglishMode && !transcriptScriptMode) {
    output = await rewriteAsRomanHinglish(output, languageCode);
  } else if (containsDevanagariText(output) && !transcriptScriptMode && !hinglishMode) {
    output = normalizeTranscriptEncoding(output);
  }

  return output;
}

async function normalizeKycAnswer({
  text,
  preferredLanguage,
  currentFieldLabel,
  currentFieldType,
  currentFieldSection,
}) {
  const fieldLabel = String(currentFieldLabel || '').trim();
  const fieldType = String(currentFieldType || '').trim() || 'text';
  const normalizedLabel = fieldLabel.toLowerCase(); 
  const trimmed = normalizeTranscriptEncoding(text);
  if (!trimmed) {
    return { englishText: '', canonicalYesNo: null };
  }

  const normalizedInput = normalizeIndicSpeechText(trimmed);
  const directYesNo = parseCanonicalYesNo(trimmed) || parseCanonicalYesNo(normalizedInput);
  if (fieldType === 'yes_no' && directYesNo) {
    return { englishText: directYesNo, canonicalYesNo: directYesNo };
  }

  const normalizeFieldAwareValue = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return raw;
    const medicalFixedRaw = raw
      .replace(/\bi\s*b\s*b\b/gi, 'High BP')
      .replace(/\bb\s*p\b/gi, 'BP');

    // const normalizedLabel = fieldLabel.toLowerCase();
    const normalizedRaw = medicalFixedRaw.toLowerCase();

    const titleCase = (input) =>
      String(input || '')
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(' ');

    const normalizeName = (input) => {
      const extractSpelledCompact = (value) => {
        const matches = String(value || '').match(/(?:\b[a-z]\b[\s-]*){4,}/gi);
        if (!matches?.length) return '';

        return matches
          .map((part) => part.replace(/[^a-z]/gi, '').toLowerCase())
          .sort((a, b) => b.length - a.length)[0] || '';
      };
      const extractSpelledWords = (value) => {
        const normalized = String(value || '')
          .replace(/\b(?:space|blank|gap)\b/gi, '|')
          .replace(/\b(?:surname|last name|family name)\b/gi, '|')
          .replace(/[,\n;:/]+/g, '|');
        return normalized
          .split('|')
          .map((group) => {
            const letters = group.match(/\b[a-z]\b/gi);
            return letters?.length >= 2 ? letters.join('').toLowerCase() : '';
          })
          .filter(Boolean);
      };

      let cleaned = String(input || '')
        .replace(/^(my name is|name is|this is|i am|i'm|mera naam|mera naam hai|naam hai)\s+/i, '')
        .replace(/[^\w\s'.-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const spelledCompact = extractSpelledCompact(input);
      const spelledWords = extractSpelledWords(input);

      const indianNameFixes = {
        'raj esh': 'Rajesh',
        'sur esh': 'Suresh',
        'deep ak': 'Deepak',
        'vik ram': 'Vikram',
        'san jay': 'Sanjay',
        'ar jun': 'Arjun',
        'an il': 'Anil',
        'sun il': 'Sunil',
        'man ish': 'Manish',
        'gan esh': 'Ganesh',
        'ram esh': 'Ramesh',
        'mah esh': 'Mahesh',
        'din esh': 'Dinesh',
        'nar esh': 'Naresh',
        'pra deep': 'Pradeep',
        'pra kash': 'Prakash',
        'ka vita': 'Kavita',
        'an ita': 'Anita',
        'sun ita': 'Sunita',
        'poo ja': 'Pooja',
        'pree ti': 'Preeti',
        'ne ha': 'Neha',
        swathi: 'Swathi',
        'pri ya': 'Priya',
        'lak shmi': 'Lakshmi',
        'sara swathi': 'Saraswathi',
      };

      const lowerCleaned = cleaned.toLowerCase();
      for (const [wrong, right] of Object.entries(indianNameFixes)) {
        if (lowerCleaned.includes(wrong)) {
          cleaned = cleaned.replace(new RegExp(wrong, 'gi'), right);
        }
      }

      if (spelledWords.length >= 2) {
        cleaned = spelledWords.join(' ');
      } else if (spelledCompact && /^[a-z](?:\s+[a-z]){3,}$/i.test(cleaned)) {
        cleaned = spelledCompact;
      }

      return cleaned
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(' ');
    };

    const normalizeGender = (input) => {
      const compact = String(input || '')
        .toLowerCase()
        .replace(/[^a-z]/g, '');

      if (['male', 'm', 'man', 'boy', 'mail', 'email', 'meal', 'mela', 'mael', 'deal', 'deel', 'dill', 'dale'].includes(compact)) return 'Male';
      if (['female', 'f', 'woman', 'girl', 'lady', 'femail', 'femal', 'feemail'].includes(compact)) return 'Female';
      if (['other', 'nonbinary', 'nonbinaryperson', 'nonbinarygender'].includes(compact)) return 'Other';

      return titleCase(input);
    };

    const normalizeEducation = (input) => {
      const normalized = String(input || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const fixes = new Map([
        ['tenth sale', 'Tenth fail'],
        ['10th sale', '10th fail'],
        ['ten sale', 'Tenth fail'],
        ['tenth fail', 'Tenth fail'],
        ['10th fail', '10th fail'],
        ['failed 10th grade', 'Failed 10th grade'],
      ]);
      return fixes.get(normalized) || input.trim();
    };

    const monthMap = {
      january: 1, jan: 1, janurary: 1,
      february: 2, feb: 2, febuary: 2,
      march: 3, mar: 3,
      april: 4, apr: 4,
      may: 5,
      june: 6, jun: 6,
      july: 7, jul: 7,
      august: 8, aug: 8, agust: 8,
      september: 9, sep: 9, sept: 9, septermber: 9, septembar: 9, septmember: 9, setember: 9,
      october: 10, oct: 10, octuber: 10,
      november: 11, nov: 11,
      december: 12, dec: 12, decemeber: 12,
    };
    const numberWords = {
      zero: 0, one: 1, first: 1,
      two: 2, second: 2,
      three: 3, third: 3,
      four: 4, fourth: 4,
      five: 5, fifth: 5,
      six: 6, sixth: 6,
      seven: 7, seventh: 7,
      eight: 8, eighth: 8,
      nine: 9, ninth: 9,
      ten: 10, tenth: 10,
      eleven: 11, eleventh: 11,
      twelve: 12, twelfth: 12,
      thirteen: 13, thirteenth: 13,
      fourteen: 14, fourteenth: 14,
      fifteen: 15, fifteenth: 15,
      sixteen: 16, sixteenth: 16,
      seventeen: 17, seventeenth: 17,
      eighteen: 18, eighteenth: 18,
      nineteen: 19, nineteenth: 19,
      twenty: 20, twentieth: 20,
      thirty: 30, thirtieth: 30,
      forty: 40, fortieth: 40,
      fifty: 50, fiftieth: 50,
      sixty: 60, sixtieth: 60,
      seventy: 70, seventieth: 70,
      eighty: 80, eightieth: 80,
      ninety: 90, ninetieth: 90,
    };

    const formatDate = (day, month, year) => {
      const safeDay = String(day).padStart(2, "0");
      const safeMonth = String(month).padStart(2, "0");
      const y = String(year);
      const fullYear =
        y.length <= 2
          ? parseInt(y) <= 30
            ? `20${y.padStart(2, "0")}`
            : `19${y.padStart(2, "0")}`
          : y;
      return `${safeDay}/${safeMonth}/${fullYear}`;
    };

    const parseWordNumber = (tokens) => {
      let total = 0;
      let current = 0;
      let used = false;

      for (const token of tokens) {
        if (token === 'and') continue;
        if (numberWords[token] != null) {
          current += numberWords[token];
          used = true;
          continue;
        }
        if (token === 'hundred') {
          current = (current || 1) * 100;
          used = true;
          continue;
        }
        if (token === 'thousand') {
          total += (current || 1) * 1000;
          current = 0;
          used = true;
          continue;
        }
        return null;
      }

      return used ? total + current : null;
    };

    const parseDayTokens = (tokens) => {
      if (!tokens.length || tokens.length > 3) return null;
      if (tokens.length === 1 && /^\d{1,2}$/.test(tokens[0])) return Number(tokens[0]);
      const parsed = parseWordNumber(tokens);
      return parsed != null && parsed >= 1 && parsed <= 31 ? parsed : null;
    };

    const parseYearTokens = (tokens) => {
      if (!tokens.length || tokens.length > 5) return null;
      if (tokens.length === 1 && /^\d{2,4}$/.test(tokens[0])) return Number(tokens[0]);

      const direct = parseWordNumber(tokens);
      if (direct != null && direct >= 1000) return direct;

      if (!tokens.includes('thousand') && !tokens.includes('hundred') && tokens.length >= 2) {
        for (let split = 1; split < tokens.length; split += 1) {
          const left = parseWordNumber(tokens.slice(0, split));
          const right = parseWordNumber(tokens.slice(split));
          if (left != null && right != null && left >= 10 && left <= 99 && right >= 0 && right <= 99) {
            return left * 100 + right;
          }
        }
      }

      return direct != null && direct >= 100 ? direct : null;
    };

    const normalizeDate = (input) => {
      const cleaned = normalizeIndicSpeechText(input)
        .replace(/(\d+)(st|nd|rd|th)\b/g, '$1')
        .replace(/,/g, ' ')
        .replace(/\b(date of birth|dob|born on|birth date|my birthday is)\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const numeric = cleaned.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2}|\d{4})$/);
      if (numeric) {
        const [, day, month, year] = numeric;
        return formatDate(day, month, year);
      }

      const monthFirst = cleaned.match(/^([a-z]+)\s+(\d{1,2})\s+(\d{2}|\d{4})$/);
      if (monthFirst && monthMap[monthFirst[1]]) {
        return formatDate(monthFirst[2], monthMap[monthFirst[1]], monthFirst[3]);
      }

      const dayFirst = cleaned.match(/^(\d{1,2})\s+([a-z]+)\s+(\d{2}|\d{4})$/);
      if (dayFirst && monthMap[dayFirst[2]]) {
        return formatDate(dayFirst[1], monthMap[dayFirst[2]], dayFirst[3]);
      }

      const ofPattern = cleaned.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+of\s+([a-z]+)\s+(\d{2}|\d{4})$/);
      if (ofPattern && monthMap[ofPattern[2]]) {
        return formatDate(ofPattern[1], monthMap[ofPattern[2]], ofPattern[3]);
      }

      const tokens = cleaned
        .split(/\s+/)
        .map((token) => token.replace(/[^a-z0-9]/g, ''))
        .filter(Boolean);
      const monthIndex = tokens.findIndex((token) => monthMap[token] != null);

      if (monthIndex !== -1) {
        const month = monthMap[tokens[monthIndex]];

        if (monthIndex === 0) {
          for (let dayTokenCount = 1; dayTokenCount <= 2; dayTokenCount += 1) {
            const day = parseDayTokens(tokens.slice(1, 1 + dayTokenCount));
            const year = parseYearTokens(tokens.slice(1 + dayTokenCount));
            if (day != null && year != null) {
              return formatDate(day, month, year);
            }
          }
        }

        if (monthIndex > 0) {
          const day = parseDayTokens(tokens.slice(0, monthIndex));
          const year = parseYearTokens(tokens.slice(monthIndex + 1));
          if (day != null && year != null) {
            return formatDate(day, month, year);
          }
        }
      }

      const parsed = new Date(cleaned);
      if (!Number.isNaN(parsed.getTime())) {
        return formatDate(parsed.getDate(), parsed.getMonth() + 1, parsed.getFullYear());
      }

      return input.trim();
    };

    const normalizePhone = (input) => {
      const rawInput = String(input || '').trim();
      if (!rawInput) return '';

      const digitWords = {
        zero: '0',
        oh: '0',
        o: '0',
        one: '1',
        won: '1',
        two: '2',
        to: '2',
        too: '2',
        three: '3',
        four: '4',
        for: '4',
        five: '5',
        six: '6',
        seven: '7',
        eight: '8',
        ate: '8',
        nine: '9',
      };
      const fillerTokens = new Set([
        'my',
        'phone',
        'contact',
        'mobile',
        'number',
        'no',
        'is',
        'its',
        'it',
        'this',
        'the',
        'a',
        'an',
        'please',
        'dash',
        'hyphen',
        'space',
      ]);
      const tokens =
        normalizeIndicSpeechText(rawInput)
          .replace(/[(),.-]/g, ' ')
          .match(/\+|[a-z0-9]+/g) || [];

      let digits = '';
      let repeatCount = 1;
      let hasExplicitPlus = rawInput.startsWith('+');

      for (const token of tokens) {
        if (token === 'plus') {
          if (!digits) hasExplicitPlus = true;
          repeatCount = 1;
          continue;
        }

        if (token === 'double') {
          repeatCount = 2;
          continue;
        }

        if (token === 'triple') {
          repeatCount = 3;
          continue;
        }

        if (fillerTokens.has(token)) {
          repeatCount = 1;
          continue;
        }

        let tokenDigits = '';
        if (/^\d+$/.test(token)) {
          tokenDigits = token;
        } else if (digitWords[token] != null) {
          tokenDigits = digitWords[token];
        } else {
          repeatCount = 1;
          continue;
        }

        digits += tokenDigits.repeat(repeatCount);
        repeatCount = 1;
      }

      const fallbackDigits = rawInput.replace(/\D/g, '');
      if (fallbackDigits.length > digits.length) {
        digits = fallbackDigits;
      }

      if (!digits) return rawInput;
      if (digits.length === 10) return `+1${digits}`;
      if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
      if (hasExplicitPlus) return `+${digits}`;
      if (digits.length > 11 && digits.startsWith('1')) return `+${digits}`;
      return digits;
    };

    const normalizeNumber = (input) => {
      const rawInput = String(input || '').trim();
      if (!rawInput) return '';

      const normalized = normalizeIndicSpeechText(rawInput)
        .replace(/,/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (/^(zero|0|none|nil|no cover|not applicable)$/i.test(normalized)) return '0';

      const directNumeric = normalized.replace(/\s+/g, '');
      if (/^\d+(\.\d+)?$/.test(directNumeric)) {
        return directNumeric;
      }

      const tokens = normalized
        .split(/\s+/)
        .map((token) => token.replace(/[^a-z0-9]/g, ''))
        .filter(Boolean);
      const parsed = parseSpokenNumberTokens(tokens);
      return parsed != null ? String(parsed) : rawInput;
    };

    const normalizeHeightCm = (input) => {
      const rawInput = String(input || '').trim();
      if (!rawInput) return '';

      const normalized = normalizeIndicSpeechText(rawInput)
        .replace(/,/g, ' ')
        .replace(/\b(centimeters?|centimetres?|cms?|cm|height|is|i am|i'm)\b/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const directNumeric = normalized.replace(/\s+/g, '');
      if (/^\d+(\.\d+)?$/.test(directNumeric)) {
        const numeric = Number(directNumeric);
        if (numeric >= 70 && numeric < 100) return String(numeric + 100);
        return directNumeric;
      }

      const tokens = normalized
        .split(/\s+/)
        .map((token) => token.replace(/[^a-z0-9]/g, ''))
        .filter(Boolean);
      const singleDigitTokens = new Set([
        'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
      ]);
      if (
        (tokens[0] === 'one' || tokens[0] === '1') &&
        tokens.slice(1).length >= 2 &&
        tokens.slice(1).every((token) => singleDigitTokens.has(token) || /^\d$/.test(token))
      ) {
        return tokens
          .map((token) => (SPOKEN_NUMBER_WORDS[token] != null ? SPOKEN_NUMBER_WORDS[token] : token))
          .join('');
      }

      const tailParsed =
        (tokens[0] === 'one' || tokens[0] === '1') && tokens.length > 1
          ? parseSpokenNumberTokens(tokens.slice(1))
          : null;
      if (tailParsed != null && tailParsed >= 20 && tailParsed < 100) {
        return String(100 + tailParsed);
      }

      const parsed = parseSpokenNumberTokens(tokens);
      if (parsed != null) {
        return parsed >= 70 && parsed < 100 ? String(parsed + 100) : String(parsed);
      }
      return rawInput;
    };

    if (
      fieldLabel.toLowerCase().includes("application") ||
      String(currentFieldLabel || "").toLowerCase().includes("application")
    ) {
      const digitWords = {
        zero: "0",
        one: "1",
        two: "2",
        three: "3",
        four: "4",
        five: "5",
        six: "6",
        seven: "7",
        eight: "8",
        nine: "9",
      };
      const tokens = String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .split(/\s+/)
        .filter(Boolean);
      const allDigits = tokens.every(
        (t) => digitWords[t] !== undefined || /^\d+$/.test(t),
      );
      if (allDigits && tokens.length >= 2) {
        return tokens.map((t) => digitWords[t] ?? t).join("");
      }
      return String(value || "").trim();
    }

    if (fieldType === 'date' || normalizedLabel.includes('date of birth')) {
      return normalizeDate(medicalFixedRaw);
    }

    if (normalizedLabel.includes('gender')) {
      return normalizeGender(medicalFixedRaw);
    }

    if (normalizedLabel.includes('education') || normalizedLabel.includes('qualification')) {
      return normalizeEducation(medicalFixedRaw);
    }

    if (normalizedLabel.includes('contact')) {
      return normalizePhone(medicalFixedRaw);
    }

    if (normalizedLabel.includes('height')) {
      return normalizeHeightCm(medicalFixedRaw);
    }

    if (fieldType === 'number') {
      return normalizeNumber(medicalFixedRaw);
    }

    if (
      normalizedLabel.includes('life to be assured') ||
      normalizedLabel.includes('full name') ||
      normalizedLabel === 'name' ||
      normalizedLabel.endsWith(' name')
    ) {
      return normalizeName(medicalFixedRaw);
    }

    return medicalFixedRaw;
  };

  const structuredEnglishText = normalizeFieldAwareValue(trimmed);
  const isStructuredField =
    fieldType === 'yes_no' ||
    fieldType === 'date' ||
    fieldType === 'number' ||
    normalizedLabel.includes('date of birth') ||
    normalizedLabel.includes('contact') ||
    normalizedLabel.includes('gender');

  const canUseLocalStructuredValue =
    !preferredLanguage ||
    preferredLanguage === 'en' ||
    Boolean(directYesNo) ||
    fieldType === 'date' ||
    fieldType === 'number' ||
    normalizedLabel.includes('gender') ||
    normalizedLabel.includes('contact');

  if (isStructuredField && canUseLocalStructuredValue) {
    return {
      englishText: directYesNo || structuredEnglishText,
      canonicalYesNo: fieldType === 'yes_no' ? directYesNo : null,
    };
  }

  if (!preferredLanguage || preferredLanguage === 'en') {
    return {
      englishText: structuredEnglishText,
      canonicalYesNo: fieldType === 'yes_no' ? directYesNo : null,
    };
  }

  const languageName = getKycLanguageName(preferredLanguage);
  const completion = await trackOpenAICall(`KYC normalize ${preferredLanguage}`, () =>
    openai.chat.completions.create({
      model: OPENAI_CHAT_MODEL,
      ...withSupportedTemperature(OPENAI_CHAT_MODEL, 0),
      messages: [
        {
          role: 'system',
          content: `You normalize patient answers for a KYC PDF workflow.

Return ONLY valid JSON in this format:
{
  "englishText": "English value for the PDF",
  "canonicalYesNo": "Yes" | "No" | null
}

Rules:
- Translate the patient's answer from ${languageName} into concise English for PDF entry.
- Preserve names, dates, addresses, phone numbers, and numeric values.
- If the answer is a person name written in a local script, transliterate it into Latin script.
- For yes/no questions, set "canonicalYesNo" to exactly "Yes" or "No" when implied.
- If it is not a yes/no answer, set "canonicalYesNo" to null.
- "englishText" must always contain the final English value to store in the PDF.`,
        },
        {
          role: 'user',
          content: JSON.stringify({
            fieldLabel: currentFieldLabel || '',
            fieldType: currentFieldType || 'text',
            fieldSection: currentFieldSection || '',
            selectedLanguage: languageName,
            answer: trimmed,
          }),
        },
      ],
    })
  );

  const parsed = extractJsonObject(completion.choices[0]?.message?.content || '{}');
  const canonicalYesNo =
    parsed.canonicalYesNo === 'Yes' || parsed.canonicalYesNo === 'No'
      ? parsed.canonicalYesNo
      : null;
  const englishText = String(parsed.englishText || '').trim() || trimmed;

  return {
    englishText: canonicalYesNo || normalizeFieldAwareValue(englishText),
    canonicalYesNo,
  };
}

async function validateKycAnswerRelevance({
  text,
  preferredLanguage,
  currentFieldLabel,
  currentFieldType,
  currentFieldSection,
  currentFieldPrompt,
  awaitingReason = false,
}) {
  const answer = normalizeTranscriptEncoding(text);
  if (!answer) {
    return { relevant: false, confidence: 1, reason: 'empty answer' };
  }

  const languageName = getKycLanguageName(preferredLanguage || 'en');
  const completion = await trackOpenAICall('KYC answer relevance', () =>
    openai.chat.completions.create({
      model: OPENAI_CHAT_MODEL,
      ...withSupportedTemperature(OPENAI_CHAT_MODEL, 0),
      ...withSupportedMaxTokens(OPENAI_CHAT_MODEL, 180),
      messages: [
        {
          role: 'system',
          content: `You validate whether a patient's short spoken answer belongs to the current MER/KYC form question.

Return ONLY valid JSON:
{
  "relevant": true | false,
  "confidence": 0 to 1,
  "reason": "short reason"
}

Rules:
- Mark true only if the answer directly answers the current question or its required "if yes, give details" follow-up.
- For yes/no fields, "yes", "no", and clear condition names related to the field are relevant.
- If awaitingReason is true, accept condition details, disease names, medicine/test/surgery names, and duration/time answers such as "2 years", "six months", or "since childhood" for that same field.
- If awaitingReason is true, reject only clear answers to a different row, small talk, or unrelated background speech.
- Mark false for recovery-status answers, confirmations, small talk, background speech, or answers that fit a different medical row.
- Be strict. If unsure, mark false with confidence 0.6.
- The patient's language is ${languageName}; understand transliterated Indian English/Hindi/Marathi-style short answers.`,
        },
        {
          role: 'user',
          content: JSON.stringify({
            fieldLabel: currentFieldLabel || '',
            fieldPrompt: currentFieldPrompt || '',
            fieldType: currentFieldType || 'text',
            fieldSection: currentFieldSection || '',
            awaitingReason: Boolean(awaitingReason),
            answer,
          }),
        },
      ],
    })
  );

  const parsed = extractJsonObject(completion.choices[0]?.message?.content || '{}');
  return {
    relevant: parsed.relevant === true,
    confidence:
      typeof parsed.confidence === 'number'
        ? Math.max(0, Math.min(1, parsed.confidence))
        : 0.5,
    reason: String(parsed.reason || '').trim(),
  };
}

async function trackOpenAICall(label, fn) {
  openaiCallCount++;
  const n = openaiCallCount;
  const start = Date.now();

  console.log(`\n[OPENAI #${n}] ${label} â€” START`);

  try {
    const result = await fn();
    console.log(`[OPENAI #${n}] ${label} â€” OK (${Date.now() - start}ms)`);
    return result;
  } catch (err) {
    console.log(`[OPENAI #${n}] ${label} â€” FAIL (${Date.now() - start}ms)`);
    throw err;
  }
}

/*Health Check Endpoint */
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: Date.now() });
});

/* =====================
   /api/analyze
===================== */
app.post('/api/analyze', async (req, res) => {
  try {
    const { messages } = req.body;

    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid messages payload' });
    }

    const completion = await trackOpenAICall(
      "chat.completions /api/analyze",
      () =>
        openai.chat.completions.create({
          model: OPENAI_CHAT_MODEL,
          ...withSupportedTemperature(OPENAI_CHAT_MODEL, 0.3),
          messages,
        })
    );

    res.json({
      content: completion.choices[0]?.message?.content || '',
    });

  } catch (err) {
    console.error('ANALYZE ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

/* =====================
   /api/voice
===================== */
app.post('/api/voice', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const filePath = req.file.path;
    const dischargeSummary = req.body.dischargeSummary || '';

    const stats = fs.statSync(filePath);
    if (stats.size < 1000) {
      fs.unlinkSync(filePath);
      return res.json({
        transcription: '',
        responseText: 'I didn\'t catch that. Please try speaking a bit longer.',
        audioBase64: null,
        alert: false,
      });
    }

    const transcription = await trackOpenAICall(
      "audio.transcriptions /api/voice",
      () =>
        openai.audio.transcriptions.create({
          file: fs.createReadStream(filePath),
          model: OPENAI_TRANSCRIBE_MODEL,
          prompt: 'Medical follow-up voice call. Preserve short patient answers, names, medication terms, and dates accurately.',
        })
    );

    const spokenText = transcription.text?.trim();
    if (!spokenText) {
      return res.json({
        transcription: '',
        responseText: 'I could not hear you clearly. Please try again.',
        audioBase64: null,
        alert: false,
      });
    }

    const isHindi = /[\u0900-\u097F]/.test(spokenText);

    const escalationTriggers = [
      'severe pain',
      'chest pain',
      'shortness of breath',
      'bleeding',
      'à¤¬à¤¹à¥à¤¤ à¤¦à¤°à¥à¤¦',
      'à¤¸à¤¾à¤‚à¤¸ à¤¨à¤¹à¥€à¤‚',
      'à¤–à¥‚à¤¨',
    ];

    const needsNurse = escalationTriggers.some(t =>
      spokenText.toLowerCase().includes(t)
    );

    let aiResponseText;

    if (needsNurse) {
      aiResponseText = isHindi
        ? 'à¤®à¥ˆà¤‚ à¤…à¤­à¥€ à¤à¤• à¤…à¤²à¤°à¥à¤Ÿ à¤¬à¤¨à¤¾ à¤°à¤¹à¤¾ à¤¹à¥‚à¤ à¤¤à¤¾à¤•à¤¿ à¤†à¤ª à¤¸à¥€à¤§à¥‡ à¤¨à¤°à¥à¤¸ à¤¸à¥‡ à¤¬à¤¾à¤¤ à¤•à¤° à¤¸à¤•à¥‡à¤‚à¥¤'
        : 'I am creating an alert now so you can speak with a nurse directly.';
    } else {
      const chat = await trackOpenAICall(
        "chat.completions /api/voice",
        () =>
          openai.chat.completions.create({
            model: OPENAI_CHAT_MODEL,
            ...withSupportedTemperature(OPENAI_CHAT_MODEL, 0.3),
            messages: [
              {
                role: 'system',
                content:
                  'You are a patient follow-up voice assistant. Ask one gentle follow-up question.',
              },
              {
                role: 'system',
                content: `Discharge Summary:\n${dischargeSummary || 'Not provided'}`,
              },
              { role: 'user', content: spokenText },
            ],
          })
      );

      aiResponseText = chat.choices[0]?.message?.content;
    }

    const speech = await trackOpenAICall(
      "audio.speech /api/voice",
      () =>
        openai.audio.speech.create({
          model: 'gpt-4o-mini-tts',
          voice: 'shimmer',
          input: aiResponseText,
          instructions: DOCTOR_TTS_INSTRUCTIONS,
          speed: DOCTOR_TTS_SPEED,
        })
    );

    const audioBuffer = Buffer.from(await speech.arrayBuffer());
    fs.unlinkSync(filePath);

    res.json({
      transcription: spokenText,
      responseText: aiResponseText,
      audioBase64: audioBuffer.toString('base64'),
      alert: needsNurse,
      language: isHindi ? 'hi' : 'en',
    });

  } catch (err) {
    console.error('VOICE API ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

/* =====================
   /api/tts
===================== */
app.post('/api/tts', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Text is required' });

    const speech = await trackOpenAICall(
      "audio.speech /api/tts",
      () =>
        openai.audio.speech.create({
          model: 'gpt-4o-mini-tts',
          voice: 'shimmer',
          input: text,
          instructions: DOCTOR_TTS_INSTRUCTIONS,
          speed: DOCTOR_TTS_SPEED,
        })
    );

    const audioBuffer = Buffer.from(await speech.arrayBuffer());

    res.json({
      audioBase64: audioBuffer.toString('base64'),
    });

  } catch (err) {
    console.error('TTS ERROR:', err);
    res.status(500).json({ error: 'TTS failed' });
  }
});

app.post('/api/kyc/localize-text', async (req, res) => {
  try {
    const { text, languageCode, transcriptScript = false } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required' });
    }

    const localizedText = await localizeKycText(text, (languageCode || 'en').trim().toLowerCase(), {
      transcriptScript,
    });
    res.json({ text: stripInlineYesDetailInstruction(localizedText) });
  } catch (err) {
    console.error('KYC LOCALIZE ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/kyc/normalize-answer', async (req, res) => {
  try {
    const { text, preferredLanguage, currentFieldLabel, currentFieldType, currentFieldSection } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required' });
    }

    const result = await normalizeKycAnswer({
      text,
      preferredLanguage: (preferredLanguage || 'en').trim().toLowerCase(),
      currentFieldLabel,
      currentFieldType,
      currentFieldSection,
    });

    res.json(result);
  } catch (err) {
    console.error('KYC NORMALIZE ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/kyc/validate-answer-relevance', async (req, res) => {
  try {
    const {
      text,
      preferredLanguage,
      currentFieldLabel,
      currentFieldType,
      currentFieldSection,
      currentFieldPrompt,
      awaitingReason,
    } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required' });
    }

    const result = await validateKycAnswerRelevance({
      text,
      preferredLanguage: (preferredLanguage || 'en').trim().toLowerCase(),
      currentFieldLabel,
      currentFieldType,
      currentFieldSection,
      currentFieldPrompt,
      awaitingReason,
    });
    res.json(result);
  } catch (err) {
    console.error('KYC RELEVANCE ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// =====================
// /api/kyc/conversational-response
// =====================
app.post('/api/kyc/conversational-response', async (req, res) => {
  try {
    const {
      userAnswer,
      currentField,
      nextField,
      fieldIndex,
      totalFields,
      previousResponses,
      isComplete,
      preferredLanguage,
    } = req.body;

    const languageName = getKycLanguageName(preferredLanguage || 'en');

    const systemPrompt = `You are a warm, professional female doctor helping a patient fill out their KYC (Know Your Customer) medical form during a video call.

PERSONALITY:
- You are empathetic, patient, and conversational - like a real doctor talking to a patient
- You acknowledge what they said naturally, sometimes commenting briefly on their answer
- You transition smoothly to the next question
- You occasionally use reassuring phrases like "That's great", "Thank you for sharing that", "No worries", "Perfect"
- You keep responses SHORT - 1-2 sentences of acknowledgment, then the next question
- You NEVER sound robotic or formulaic - vary your transitions

LANGUAGE: Respond in ${languageName}. If ${languageName} is not English, speak naturally in that language.

RULES:
- Do NOT repeat the field label mechanically
- Do NOT say "Got it" every time - vary your acknowledgments
- If the answer seems concerning (health-wise), show brief empathy before moving on
- If this is the last field, congratulate them warmly
- Keep total response under 40 words
- Ask the next question conversationally, not like reading a form

EXAMPLES OF GOOD RESPONSES:
- "Wonderful, thank you. Now, could you tell me your date of birth?"
- "Noted. And what about any allergies - do you have any?"
- "I see, that's helpful to know. How about your current medications?"
- "Great, we're making good progress! Next - have you had any surgeries before?"
- "Thank you for being so thorough. Just a few more to go - what's your blood group?"`;

    const userMessage = JSON.stringify({
      userAnswer,
      currentFieldLabel: currentField?.label,
      currentFieldType: currentField?.type,
      currentFieldSection: currentField?.section,
      nextFieldLabel: nextField?.label || null,
      nextFieldType: nextField?.type || null,
      nextFieldSection: nextField?.section || null,
      fieldIndex,
      totalFields,
      isComplete,
      recentContext: Object.entries(previousResponses || {})
        .slice(-3)
        .map(([k, v]) => `${k}: ${v}`),
    });

    const completion = await trackOpenAICall('KYC conversational response', () =>
      openai.chat.completions.create({
        model: OPENAI_CHAT_MODEL,
        ...withSupportedTemperature(OPENAI_CHAT_MODEL, 0.7),
        ...withSupportedMaxTokens(OPENAI_CHAT_MODEL, 150),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
      })
    );

    const responseText = completion.choices[0]?.message?.content?.trim() || '';
    res.json({ text: responseText });
  } catch (err) {
    console.error('KYC CONVERSATIONAL ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// =====================
// /api/kyc/preloaded-document
// =====================
app.get('/api/kyc/preloaded-document', async (req, res) => {
  try {
    const candidatePaths = [
      DEFAULT_KYC_PDF_PATH,
      path.resolve(process.cwd(), '../kyc-templates/default-kyc.pdf'),
      path.resolve(process.cwd(), './kyc-templates/default-kyc.pdf'),
      path.resolve(__dirname, './kyc-templates/default-kyc.pdf'),
    ];
    const resolvedPdfPath = candidatePaths.find((candidatePath) => fs.existsSync(candidatePath));

    if (!resolvedPdfPath) {
      return res.status(404).json({
        error: `No default KYC document configured. Tried: ${candidatePaths.join(' | ')}`,
      });
    }

    const pdfBuffer = fs.readFileSync(resolvedPdfPath);

    res.json({
      fileName: path.basename(resolvedPdfPath),
      pdfBase64: pdfBuffer.toString('base64'),
    });
  } catch (err) {
    console.error('PRELOADED DOC ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// =====================
// /api/kyc/extract-fields
// =====================
app.post('/api/kyc/extract-fields', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Missing text' });
    }

    const trimmed = text.slice(0, 30000);

    const messages = [
      {
        role: 'system',
        content: `You are a strict structured document extraction engine.

DOCUMENT CONTEXT:
This is a Medical Examination Report for Health Insurance (Bajaj Allianz).

TASK:
Extract ONLY the fields that must be completed by the applicant.

CRITICAL RULES:
1. STOP extraction immediately when you reach:
   "PART II : MEDICAL EXAMINER'S FINDING AND ASSESMENT"

2. DO NOT extract anything under:
   - Medical Examiner's Finding
   - Doctor's Sign
   - Height, Weight, Blood Pressure
   - ECG findings
   - Urine Analysis
   - Examiner observations

3. Extract fields only from:
   - PART I: PERSONAL HISTORY
   - PART II: SYSTEMIC INFORMATION (Applicant portion only)
   - Family History
   - Habits
   - Declaration (but not signatures)

4. Gender Logic:
   - Mark pregnancy, uterine, ovarian, menstrual questions as "female"
   - Mark hypospadias and penile dysfunction as "male"
   - All others as "all"

5. Each extracted field must contain:
   - id (camelCase, unique)
   - label (exact wording from the form)
   - type (text | yes_no | select | number | date | checkbox_group)
   - section
   - genderRestriction ("male" | "female" | "all")

For YES/NO fields, set type to "yes_no".
For checkbox groups, set type to "checkbox_group" and include "options".

6. Do NOT summarize or create new fields.
7. Respond ONLY in valid JSON.

OUTPUT FORMAT:
{ "fields": [ { "id": "...", "label": "...", "type": "...", "section": "...", "genderRestriction": "all" } ] }`
      },
      { role: 'user', content: trimmed }
    ];

    const completion = await trackOpenAICall("KYC extract fields", () =>
      openai.chat.completions.create({
        model: OPENAI_CHAT_MODEL,
        ...withSupportedTemperature(OPENAI_CHAT_MODEL, 0.1),
        messages,
      })
    );

    const content = completion.choices[0]?.message?.content || '';

    res.json({ content });
  } catch (err) {
    console.error('KYC EXTRACT ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// =====================
// /api/kyc/transcribe
// =====================
app.post('/api/kyc/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No audio file' });

    const filePath = req.file.path;
    const preferredLanguage = (req.body.preferredLanguage || '').trim().toLowerCase();
    const currentFieldLabel = (req.body.currentFieldLabel || '').trim();
    const currentFieldType = (req.body.currentFieldType || 'text').trim().toLowerCase();
    const currentFieldSection = (req.body.currentFieldSection || '').trim();
    const speechHints = (req.body.speechHints || '').trim();
    let transcriptText = '';

    if (isHindiHinglishLanguage(preferredLanguage) && process.env.SARVAM_API_KEY) {
      const FormData = (await import('form-data')).default;
      const form = new FormData();
      form.append('file', fs.createReadStream(filePath));
      form.append('model', 'saaras:v3');
      form.append('mode', 'transcribe');
      form.append('language_code', getSarvamLanguageCode(preferredLanguage));

      const sarvamRes = await fetch('https://api.sarvam.ai/speech-to-text', {
        method: 'POST',
        headers: {
          'API-Subscription-Key': process.env.SARVAM_API_KEY,
          ...form.getHeaders(),
        },
        body: form,
      });

      const { data: sarvamData, rawText } = await readJsonResponseSafe(sarvamRes);
      if (!sarvamRes.ok) {
        throw new Error(extractSarvamErrorMessage(sarvamData, rawText));
      }

      transcriptText = String(
        sarvamData.transcript ||
          sarvamData.text ||
          sarvamData?.diarized_transcript?.entries
            ?.map((entry) => entry.text || entry.transcript || '')
            .join(' ') ||
          '',
      ).trim();
    }

    const promptParts = [
      'This is KYC intake speech transcription.',
      'Transcribe exactly what the speaker says. Keep names and spelling accurate.',
      isHindiHinglishLanguage(preferredLanguage)
        ? 'The speaker may use Hinglish: Hindi sentence structure mixed with English medical words like BP, sugar, thyroid, cholesterol, surgery.'
        : null,
      currentFieldLabel ? `Current form field: ${currentFieldLabel}` : null,
      speechHints ? `Important names/terms: ${speechHints}` : null,
    ].filter(Boolean);

    const transcriptionConfig = {
      file: fs.createReadStream(filePath),
      model: OPENAI_TRANSCRIBE_MODEL,
      temperature: 0,
      prompt: promptParts.join('\n').slice(0, 800),
    };

    if (preferredLanguage) {
      transcriptionConfig.language = preferredLanguage;
    }

    if (!transcriptText) {
      const transcription = await trackOpenAICall("KYC transcribe", () =>
        openai.audio.transcriptions.create(transcriptionConfig)
      );
      transcriptText = transcription.text?.trim() || '';
    }

    const normalized = await normalizeKycAnswer({
      text: transcriptText,
      preferredLanguage: preferredLanguage || 'en',
      currentFieldLabel,
      currentFieldType,
      currentFieldSection,
    });

    fs.unlinkSync(filePath);

    res.json({
      text: transcriptText,
      englishText: normalized.englishText,
      canonicalYesNo: normalized.canonicalYesNo,
    });
  } catch (err) {
    console.error('KYC TRANSCRIBE ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// =====================
// /api/sarvam/transcribe
// =====================
app.post('/api/sarvam/transcribe', upload.single('audio'), async (req, res) => {
  const filePath = req.file?.path;

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const sarvamApiKey = process.env.SARVAM_API_KEY;
    if (!sarvamApiKey) {
      if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return res.status(500).json({ error: 'SARVAM_API_KEY not configured' });
    }

    const FormData = (await import('form-data')).default;
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));
    form.append('model', 'saaras:v3');
    form.append('mode', 'transcribe');
    form.append('with_timestamps', 'true');

    const language = String(req.body.language || 'en-IN').trim() || 'en-IN';
    form.append('language_code', language);

    const sarvamRes = await fetch('https://api.sarvam.ai/speech-to-text', {
      method: 'POST',
      headers: {
        'API-Subscription-Key': sarvamApiKey,
        ...form.getHeaders(),
      },
      body: form,
    });

    const { data: sarvamData, rawText } = await readJsonResponseSafe(sarvamRes);

    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);

    if (!sarvamRes.ok) {
      console.error('Sarvam API error:', sarvamData);
      return res.status(sarvamRes.status).json({
        error: extractSarvamErrorMessage(sarvamData, rawText),
      });
    }

    const diarizedEntries = sarvamData?.diarized_transcript?.entries || [];
    const timestampEntries =
      sarvamData?.timestamps?.timestamps?.words?.map((word, index) => ({
        transcript: word,
        start_time_seconds: sarvamData?.timestamps?.timestamps?.start_time_seconds?.[index] || 0,
        end_time_seconds: sarvamData?.timestamps?.timestamps?.end_time_seconds?.[index] || 0,
      })) ||
      [];
    const segments =
      diarizedEntries.length > 0
        ? diarizedEntries
        : sarvamData.segments || sarvamData.utterances || timestampEntries;
    const formatted = segments
      .map((seg) => {
        const start = formatTimestamp(seg.start || seg.start_time || seg.start_time_seconds || 0);
        const end = formatTimestamp(seg.end || seg.end_time || seg.end_time_seconds || 0);
        const speaker = seg.speaker || seg.speaker_id || 'Speaker';
        const text = (seg.text || seg.transcript || '').trim();
        if (!text) return null;
        return `[${start} â†’ ${end}] ${speaker}:\n${text}`;
      })
      .filter(Boolean)
      .join('\n\n');

    res.json({
      raw: sarvamData,
      formatted: formatted || sarvamData.transcript || 'No transcript available',
    });
  } catch (err) {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    console.error('SARVAM TRANSCRIBE ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// =====================
// BEYOND PRESENCE CONFIG
// =====================

// =====================
// /api/beyondpresence/start-session
// =====================
app.post('/api/beyondpresence/start-session', async (req, res) => {
  try {
    if (!BEY_API_KEY) {
      return res.status(500).json({
        error: 'BEYOND_PRESENCE_API_KEY not configured',
        code: 'beyondpresence_not_configured',
        retryable: false,
      });
    }

    const {
      kycFields = [],
      openingPrompt = '',
      language = 'en',
      preferredLanguage = 'en',
    } = req.body || {};

    const languageName = getKycLanguageName(preferredLanguage);
    const requestedLanguage = String(language || preferredLanguage || 'en').trim();
    const providerLanguage = getBeyondPresenceLanguageCode(requestedLanguage);

    if (providerLanguage !== requestedLanguage) {
      console.log(`[BeyondPresence] Falling back language ${requestedLanguage} -> ${providerLanguage}`);
    }

    const fieldListLines = await Promise.all(
      kycFields.map(async (f, i) => {
        const genderTag = f.genderRestriction && f.genderRestriction !== 'all'
          ? ` [${f.genderRestriction.toUpperCase()} ONLY]`
          : '';
        const promptText = stripInlineYesDetailInstruction(f.prompt || f.label);
        const displayPrompt =
          preferredLanguage && preferredLanguage !== 'en'
            ? stripInlineYesDetailInstruction(await localizeKycText(promptText, preferredLanguage))
            : promptText;
        return `${i + 1}. ${displayPrompt}${genderTag}`;
      }),
    );
    const fieldListText = fieldListLines.join('\n');
    const totalFieldCount = kycFields.length;
    const lastFieldPrompt = stripInlineYesDetailInstruction(
      kycFields[kycFields.length - 1]?.prompt ||
        kycFields[kycFields.length - 1]?.label ||
        '',
    );

    const firstFieldPrompt =
      String(openingPrompt || '').trim() ||
      kycFields[0]?.prompt ||
      `What is your ${String(kycFields[0]?.label || 'application number').toLowerCase()}?`;

    const baseGreetingText = `Hi, my name is Dr. Tara. Let's start your medical check-up. ${firstFieldPrompt}`;
    const greetingText =
      preferredLanguage && preferredLanguage !== 'en'
        ? await localizeKycText(baseGreetingText, preferredLanguage)
        : baseGreetingText;

    const speechInstruction =
      providerLanguage !== requestedLanguage
        ? `${getKycSpeechStyleInstruction(preferredLanguage)} The provider session language is set to ${providerLanguage} only for compatibility.`
        : getKycSpeechStyleInstruction(preferredLanguage);

    const kycSystemPrompt = `You are Dr. Tara, a warm professional doctor helping a patient complete a KYC medical form during a video call.

${speechInstruction} Be empathetic, calm, natural, and brief. Keep each reply under 35 words.

Ask these fields one by one in order. The list below is the phrasing to follow for the patient:
${fieldListText}

Rules:
- You are not a general chatbot. Never answer personal questions, medical advice questions, or requests outside this form. Continue asking the current KYC field instead.
- If the selected patient language is Hindi/Hinglish, keep questions conversational Hinglish and end yes/no questions with "haan ya nahi?".
- You must ask every applicable numbered field from 1 through ${totalFieldCount}. Gender-skipped fields are not applicable and must not be asked. Do not announce completion until the last applicable field has been answered.
- Existing insurance cover is not the last field. After it, continue to life cover, critical illness cover, and the final declaration if they appear in the numbered list.
- Ask only one field at a time and wait for the answer before moving on.
- If gender is male, skip all [FEMALE ONLY] fields silently. If gender is female, skip all [MALE ONLY] fields silently. Do not mention skipped fields.
- After the patient answers gender as male, never ask pregnancy, mammogram, ultrasound, pap smear, menstrual, ovarian, uterine, or any other female-only question. Continue directly to the next all-gender field without discussing the skipped question.
- After the patient answers gender as female, never ask male-only genital or penile questions. Continue directly to the next all-gender field without discussing the skipped question.
- Never use ALL CAPS, shouting, or dramatic emphasis.
- Do not say phrases like "IS THAT RIGHT?" or repeatedly ask for confirmation after normal answers.
- Do not repeat the patient's previous answer back verbatim unless a clarification is genuinely needed.
- Use a short acknowledgment, then move directly to the next question.
- For names or dates, only ask for clarification if the answer was genuinely unclear or incomplete.
- For yes/no fields, ask only the yes/no question first. Do not append "if yes, give details" to the same question.
  - For Hindi/Hinglish avatar speech, prefer roman Hinglish like "haan ya nahi?" over pure Devanagari Hindi.
  - A yes/no field question must stop after asking for Yes/No. For Hindi/Hinglish, end naturally in Roman Hinglish like "haan ya nahi?" and nothing about details. If the selected language is English, never add Hindi words or Devanagari text.
  - Never say "agar haan", "if yes", "toh detail", "thoda detail", or "please give details" inside the main yes/no question.
- Keep those two follow-up answers attached to the same numbered field. Never use them as answers for the next field.
- If a field needs a reason after "Yes", a bare "Yes", "No", "haan", or "nahi" is not a valid reason. Ask again for the actual condition or reason and stay on the same field.
- If the patient answers a condition directly, such as "chest pain", treat that as the detail for the current yes-detail field, then ask a contextual duration follow-up such as "For how long have you had chest pain?"
- Duration follow-ups must use the condition just given when possible. Do not ask a generic disconnected question if the condition is known.
- If the patient says Yes to travelling outside India, ask for the destination/country and wait for that answer. Do not continue to height, weight, habits, insurance, or declaration until the destination is answered.
- If you asked a duration follow-up and the answer does not contain duration information, ask again and stay on the same field.
- Do not ask recovery status, current status, treatment advice, or confirmation questions unless that exact field needs a missing answer.
- Never move to the next numbered field until both required yes-detail follow-ups have been answered or the patient says they do not know.
- If an answer is unclear, ask for clarification once, then continue.
- Do not diagnose, do not give medical advice, and do not mention progress milestones.
- When all fields are done, congratulate the patient warmly and say the form is complete.`;

    const avatarId = 'f30d7eef-6e71-433f-938d-cecdd8c0b653';

    console.log('[BeyondPresence] Creating managed agent...');
    const agentRes = await fetch(`${BEY_API_BASE}/v1/agents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': BEY_API_KEY,
      },
      body: JSON.stringify({
        name: 'Dr. Tara Managed Agent',
        avatar_id: avatarId,
        system_prompt: kycSystemPrompt,
        language: providerLanguage,
        greeting: greetingText,
        max_session_length_minutes: 30,
        llm: {
          type: 'openai',
          temperature: 1,
        },
      }),
    });

    const agentData = await agentRes.json();
    if (!agentRes.ok || !agentData?.id) {
      console.error('[BeyondPresence] Agent creation failed:', agentData);
      return res.status(agentRes.status || 500).json({
        error: extractProviderErrorMessage(agentData, 'Failed to create Beyond Presence agent'),
      });
    }

    const agentId = agentData.id;
    console.log(`[BeyondPresence] Agent created: ${agentId}`);

    console.log('[BeyondPresence] Creating LiveKit call...');
    const callRes = await fetch(`${BEY_API_BASE}/v1/calls`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': BEY_API_KEY,
      },
      body: JSON.stringify({
        agent_id: agentId,
        livekit_username: 'Patient',
        tags: {
          source: 'carely-kyc',
          preferred_language: providerLanguage,
          requested_language: preferredLanguage || requestedLanguage || 'en',
        },
      }),
    });

    const callData = await callRes.json();
    if (!callRes.ok || !callData?.livekit_url || !callData?.livekit_token) {
      console.error('[BeyondPresence] Call creation failed:', callData);

      await fetch(`${BEY_API_BASE}/v1/agents/${agentId}`, {
        method: 'DELETE',
        headers: { 'x-api-key': BEY_API_KEY },
      }).catch((err) =>
        console.warn('[BeyondPresence] Agent cleanup after call failure failed:', err)
      );

      return res.status(callRes.status || 500).json({
        error: extractProviderErrorMessage(callData, 'Failed to create Beyond Presence call'),
      });
    }

    console.log(`[BeyondPresence] LiveKit call created: ${callData.id}`);

    res.json({
      agentId,
      callId: callData.id,
      livekitUrl: callData.livekit_url,
      livekitToken: callData.livekit_token,
      mode: 'managed_livekit_call_api',
    });
  } catch (err) {
    console.error('BEYOND PRESENCE START ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// =====================
// /api/beyondpresence/stop-session
// =====================
app.post('/api/beyondpresence/stop-session', async (req, res) => {
  try {
    const { agentId } = req.body || {};

    if (agentId && BEY_API_KEY) {
      await fetch(`${BEY_API_BASE}/v1/agents/${agentId}`, {
        method: 'DELETE',
        headers: { 'x-api-key': BEY_API_KEY },
      }).catch((err) => console.warn('[BeyondPresence] Agent cleanup failed:', err));
    }

    res.json({ success: true });
  } catch (err) {
    console.error('BEYOND PRESENCE STOP ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// =====================
// /api/beyondpresence/call-messages
// =====================
app.get('/api/beyondpresence/call-messages/:callId', async (req, res) => {
  try {
    if (!BEY_API_KEY) {
      return res.status(500).json({ error: 'BEYOND_PRESENCE_API_KEY not configured' });
    }

    const { callId } = req.params;
    const messagesRes = await fetch(`${BEY_API_BASE}/v1/calls/${callId}/messages`, {
      headers: { 'x-api-key': BEY_API_KEY },
    });

    const messagesData = await messagesRes.json();
    res.json(messagesData);
  } catch (err) {
    console.error('BEYOND PRESENCE MESSAGES ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// =====================
// POST /api/pan/create-session
// =====================
app.post('/api/pan/create-session', async (req, res) => {
  try {
    const sessionId = uuidv4().slice(0, 12);
    const localIP = getLocalIP();
    const port = 3001;
    const mobileUrl = `http://${localIP}:${port}/pan-capture/${sessionId}`;

    const qrDataUrl = await QRCode.toDataURL(mobileUrl, {
      width: 280,
      margin: 2,
      color: { dark: '#1e293b', light: '#ffffff' },
    });

    panSessions.set(sessionId, {
      createdAt: Date.now(),
      status: 'waiting',
      frontBase64: null,
      backBase64: null,
      frontMime: null,
      backMime: null,
      ocrResult: null,
    });

    res.json({
      sessionId,
      qrCodeDataUrl: qrDataUrl,
      mobileUrl,
      localIP,
    });
  } catch (err) {
    console.error('PAN CREATE SESSION ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// =====================
// GET /api/pan/status/:sessionId
// =====================
app.get('/api/pan/status/:sessionId', (req, res) => {
  const session = panSessions.get(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found or expired' });
  }

  res.json({
    status: session.status,
    hasFront: !!session.frontBase64,
    hasBack: !!session.backBase64,
    ocrResult: session.ocrResult,
  });
});

async function handlePanUpload(sessionId, files) {
  const session = panSessions.get(sessionId);
  if (!session) {
    throw new Error('Session not found or expired');
  }

  const frontFile = files?.front?.[0];
  const backFile = files?.back?.[0];

  if (frontFile) {
    session.frontBase64 = frontFile.buffer.toString('base64');
    session.frontMime = frontFile.mimetype;
    session.status = backFile || session.backBase64 ? 'complete' : 'front_uploaded';
  }

  if (backFile) {
    session.backBase64 = backFile.buffer.toString('base64');
    session.backMime = backFile.mimetype;
    session.status = frontFile || session.frontBase64 ? 'complete' : 'back_uploaded';
  }

  if (session.frontBase64 && session.backBase64) {
    session.status = 'complete';
  }

  if (session.status === 'complete' && !session.ocrResult) {
    try {
      session.ocrResult = await extractPanCardDetails(
        session.frontBase64,
        session.frontMime || 'image/jpeg'
      );
    } catch (ocrErr) {
      console.warn('PAN OCR failed:', ocrErr.message);
      session.ocrResult = { error: ocrErr.message };
    }
  }

  return {
    status: session.status,
    ocrResult: session.ocrResult,
  };
}

// =====================
// POST /api/pan/upload/:sessionId
// =====================
app.post(
  '/api/pan/upload/:sessionId',
  panUpload.fields([
    { name: 'front', maxCount: 1 },
    { name: 'back', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const result = await handlePanUpload(req.params.sessionId, req.files);
      res.json(result);
    } catch (err) {
      const statusCode = err.message === 'Session not found or expired' ? 404 : 500;
      console.error('PAN UPLOAD ERROR:', err);
      res.status(statusCode).json({ error: err.message });
    }
  }
);

// =====================
// POST /api/pan/upload-desktop/:sessionId
// =====================
app.post(
  '/api/pan/upload-desktop/:sessionId',
  panUpload.fields([
    { name: 'front', maxCount: 1 },
    { name: 'back', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const result = await handlePanUpload(req.params.sessionId, req.files);
      res.json(result);
    } catch (err) {
      const statusCode = err.message === 'Session not found or expired' ? 404 : 500;
      console.error('PAN DESKTOP UPLOAD ERROR:', err);
      res.status(statusCode).json({ error: err.message });
    }
  }
);

async function extractPanCardDetails(frontBase64, mimeType = 'image/jpeg') {
  const completion = await trackOpenAICall('PAN OCR', () =>
    openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0,
      max_tokens: 500,
      messages: [
        {
          role: 'system',
          content: `You are a document OCR system. Extract the following fields from this Indian PAN card image.

Return ONLY valid JSON:
{
  "panNumber": "ABCDE1234F",
  "fullName": "Full name as printed",
  "fatherName": "Father's name as printed",
  "dateOfBirth": "DD/MM/YYYY",
  "cardType": "Individual / Company / etc."
}

If a field is not visible or unreadable, set it to null.
Do NOT guess - only extract what you can clearly read.`,
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${frontBase64}`,
              },
            },
            {
              type: 'text',
              text: 'Extract the PAN card details from this image.',
            },
          ],
        },
      ],
    })
  );

  const content = completion.choices[0]?.message?.content || '{}';
  return extractJsonObject(content);
}

app.get('/pan-capture/:sessionId', (req, res) => {
  const session = panSessions.get(req.params.sessionId);
  if (!session) {
    return res.status(404).send('<h1>Session expired or not found</h1>');
  }

  res.type('html').send(getMobileCaptureHTML(req.params.sessionId));
});

function getMobileCaptureHTML(sessionId) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<title>Carely - PAN Card Capture</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #0f172a;
    color: #e2e8f0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }
  .wrap {
    width: 100%;
    max-width: 520px;
    background: #111827;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 20px;
    padding: 24px;
  }
  h1 { font-size: 24px; margin-bottom: 8px; text-align: center; }
  p { color: #94a3b8; font-size: 14px; line-height: 1.5; text-align: center; }
  .grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 16px;
    margin-top: 24px;
  }
  .card {
    background: #0b1220;
    border: 2px dashed #334155;
    border-radius: 16px;
    padding: 18px;
  }
  .label {
    display: block;
    font-size: 12px;
    font-weight: 700;
    color: #cbd5e1;
    margin-bottom: 10px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  input[type="file"] {
    width: 100%;
    color: #e2e8f0;
  }
  button {
    width: 100%;
    margin-top: 20px;
    padding: 14px;
    border: none;
    border-radius: 14px;
    background: linear-gradient(135deg,#8b5cf6,#6d28d9);
    color: white;
    font-size: 15px;
    font-weight: 700;
  }
  button:disabled {
    opacity: 0.6;
  }
  .msg {
    margin-top: 14px;
    font-size: 13px;
    text-align: center;
    color: #cbd5e1;
  }
  .err { color: #fca5a5; }
</style>
</head>
<body>
  <div class="wrap">
    <h1>Upload PAN Card</h1>
    <p>Please upload the front and back images of the PAN card to continue verification.</p>
    <div class="grid">
      <div class="card">
        <label class="label" for="front">Front Side</label>
        <input id="front" type="file" accept="image/*" capture="environment" />
      </div>
      <div class="card">
        <label class="label" for="back">Back Side</label>
        <input id="back" type="file" accept="image/*" capture="environment" />
      </div>
    </div>
    <button id="submitBtn" disabled>Upload Images</button>
    <div id="msg" class="msg"></div>
  </div>

  <script>
    const frontInput = document.getElementById('front');
    const backInput = document.getElementById('back');
    const submitBtn = document.getElementById('submitBtn');
    const msg = document.getElementById('msg');

    const refreshButtonState = () => {
      submitBtn.disabled = !(frontInput.files.length && backInput.files.length);
    };

    frontInput.addEventListener('change', refreshButtonState);
    backInput.addEventListener('change', refreshButtonState);

    submitBtn.addEventListener('click', async () => {
      submitBtn.disabled = true;
      msg.textContent = 'Uploading images...';
      msg.className = 'msg';

      try {
        const form = new FormData();
        form.append('front', frontInput.files[0]);
        form.append('back', backInput.files[0]);

        const res = await fetch('/api/pan/upload/${sessionId}', {
          method: 'POST',
          body: form,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed');

        msg.textContent = 'PAN card uploaded successfully. You can return to the desktop.';
      } catch (err) {
        msg.textContent = err.message;
        msg.className = 'msg err';
        submitBtn.disabled = false;
      }
    });
  </script>
</body>
</html>`;
}

/* =====================
   SERVER START
===================== */
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on ${PORT}`);
  ensureAgentWorkerRunning();
});
