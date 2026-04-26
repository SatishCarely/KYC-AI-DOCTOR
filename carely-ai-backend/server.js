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
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_KYC_PDF_PATH = path.resolve(__dirname, '../kyc-templates/default-kyc.pdf');
const BEY_API_BASE = 'https://api.bey.dev';
if (!process.env.BEY_API_KEY && process.env.BEYOND_PRESENCE_API_KEY) {
  process.env.BEY_API_KEY = process.env.BEYOND_PRESENCE_API_KEY;
}
const BEY_API_KEY = process.env.BEYOND_PRESENCE_API_KEY;
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

function getBeyondPresenceLanguageCode(code) {
  const normalized = String(code || 'en').trim();
  if (BEY_SUPPORTED_LANGUAGE_CODES.has(normalized)) {
    return normalized;
  }
  return BEY_LANGUAGE_FALLBACKS[normalized] || 'en';
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

function parseCanonicalYesNo(text) {
  const normalized = String(text || '').trim().toLowerCase();
  if (!normalized) return null;

  const yesValues = new Set(['yes', 'y', 'yeah', 'yep', 'true', 'haan', 'ha', 'han', 'ho', 'hoy', 'hoi', 'हाँ', 'हां', 'हो', 'होय']);
  const noValues = new Set(['no', 'n', 'nope', 'nah', 'false', 'nahi', 'naahi', 'नहीं', 'नही', 'नाही']);

  if (yesValues.has(normalized) || /^(yes|haan|ha|ho|hoy|hoi)\b/.test(normalized)) return 'Yes';
  if (noValues.has(normalized) || /^(no|nahi|naahi)\b/.test(normalized)) return 'No';
  return null;
}

function normalizeIndicSpeechText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/ऑक्टोबर|अक्टूबर|ऑक्टूबर/gi, ' october ')
    .replace(/सप्टेंबर|सितंबर|सितम्बर/gi, ' september ')
    .replace(/नवंबर|नोव्हेंबर/gi, ' november ')
    .replace(/डिसेंबर|दिसंबर/gi, ' december ')
    .replace(/शून्य|सुन्य|सु्न्य/gi, ' zero ')
    .replace(/एक/gi, ' one ')
    .replace(/दोन|दो/gi, ' two ')
    .replace(/तीन/gi, ' three ')
    .replace(/चार/gi, ' four ')
    .replace(/पाच/gi, ' five ')
    .replace(/सहा|छह/gi, ' six ')
    .replace(/सात/gi, ' seven ')
    .replace(/आठ/gi, ' eight ')
    .replace(/नऊ|नौ/gi, ' nine ')
    .replace(/दहा|दस/gi, ' ten ')
    .replace(/हजार/gi, ' thousand ')
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
    .replace(/एकशे|एक शे/gi, ' one hundred ')
    .replace(/दोनशे|दोशे|दोन शे|दो शे/gi, ' two hundred ')
    .replace(/तीनशे|तीन शे/gi, ' three hundred ')
    .replace(/चारशे|चार शे/gi, ' four hundred ')
    .replace(/पाचशे|पाच शे/gi, ' five hundred ')
    .replace(/सहाशे|सहा शे|छह सौ/gi, ' six hundred ')
    .replace(/सातशे|सात शे/gi, ' seven hundred ')
    .replace(/आठशे|आठ शे/gi, ' eight hundred ')
    .replace(/नऊशे|नौ सौ|नऊ शे/gi, ' nine hundred ')
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
    .replace(/एकोणऐंशी|एकोणऐशी/gi, ' seventy nine ')
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

async function localizeKycText(text, languageCode) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return '';
  if (!languageCode || languageCode === 'en') return trimmed;

  const languageName = getKycLanguageName(languageCode);
  const completion = await trackOpenAICall(`KYC localize ${languageCode}`, () =>
    openai.chat.completions.create({
      model: OPENAI_CHAT_MODEL,
      temperature: 0.1,
      messages: [
        {
          role: 'system',
          content: `You translate Carely KYC assistant text into ${languageName}.

Rules:
- Return only the translated patient-facing text.
- Keep the tone warm and direct.
- Preserve names, numbers, dates, and form labels accurately.
- Translate "Yes" and "No" naturally for ${languageName}.
- Do not add explanations or notes.`,
        },
        { role: 'user', content: trimmed },
      ],
    })
  );

  return completion.choices[0]?.message?.content?.trim() || trimmed;
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
  const trimmed = String(text || '').trim();
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

    // const normalizedLabel = fieldLabel.toLowerCase();
    const normalizedRaw = raw.toLowerCase();

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

      let cleaned = String(input || '')
        .replace(/^(my name is|name is|this is|i am|i'm|mera naam|mera naam hai|naam hai)\s+/i, '')
        .replace(/[^\w\s'.-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const spelledCompact = extractSpelledCompact(input);

      const indianNameFixes = {
        'sankop kira': 'Sankalp Khira',
        'sankalp kira': 'Sankalp Khira',
        'sankalp khira': 'Sankalp Khira',
        'sankalp kheera': 'Sankalp Khira',
        'sankalp kh eera': 'Sankalp Khira',
        'sankal khira': 'Sankalp Khira',
        'kira alpacaera': 'Sankalp Khira',
        'alpacaera kira': 'Sankalp Khira',
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
      const spelledNameFixes = {
        sankalpkhira: 'Sankalp Khira',
        sankalpakhira: 'Sankalp Khira',
        sankalpkheera: 'Sankalp Khira',
      };

      const lowerCleaned = cleaned.toLowerCase();
      for (const [wrong, right] of Object.entries(indianNameFixes)) {
        if (lowerCleaned.includes(wrong)) {
          cleaned = cleaned.replace(new RegExp(wrong, 'gi'), right);
        }
      }

      if (spelledCompact && spelledNameFixes[spelledCompact]) {
        cleaned = spelledNameFixes[spelledCompact];
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

      if (['male', 'm', 'man', 'boy', 'mail', 'meal', 'mela', 'mael', 'deal', 'deel', 'dill', 'dale'].includes(compact)) return 'Male';
      if (['female', 'f', 'woman', 'girl', 'lady', 'femail', 'femal', 'feemail'].includes(compact)) return 'Female';
      if (['other', 'nonbinary', 'nonbinaryperson', 'nonbinarygender'].includes(compact)) return 'Other';

      return titleCase(input);
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
      return normalizeDate(raw);
    }

    if (normalizedLabel.includes('gender')) {
      return normalizeGender(raw);
    }

    if (normalizedLabel.includes('contact')) {
      return normalizePhone(raw);
    }

    if (fieldType === 'number') {
      return normalizeNumber(raw);
    }

    if (
      normalizedLabel.includes('life to be assured') ||
      normalizedLabel.includes('full name') ||
      normalizedLabel === 'name' ||
      normalizedLabel.endsWith(' name')
    ) {
      return normalizeName(raw);
    }

    return raw;
  };

  const structuredEnglishText = normalizeFieldAwareValue(trimmed);
  const isStructuredField =
    fieldType === 'yes_no' ||
    fieldType === 'date' ||
    fieldType === 'number' ||
    normalizedLabel.includes('date of birth') ||
    normalizedLabel.includes('contact') ||
    normalizedLabel.includes('gender');

  if (isStructuredField) {
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
      temperature: 0,
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

async function trackOpenAICall(label, fn) {
  openaiCallCount++;
  const n = openaiCallCount;
  const start = Date.now();

  console.log(`\n[OPENAI #${n}] ${label} — START`);

  try {
    const result = await fn();
    console.log(`[OPENAI #${n}] ${label} — OK (${Date.now() - start}ms)`);
    return result;
  } catch (err) {
    console.log(`[OPENAI #${n}] ${label} — FAIL (${Date.now() - start}ms)`);
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
          temperature: 0.3,
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

    const isHindi = /[ऀ-ॿ]/.test(spokenText);

    const escalationTriggers = [
      'severe pain',
      'chest pain',
      'shortness of breath',
      'bleeding',
      'बहुत दर्द',
      'सांस नहीं',
      'खून',
    ];

    const needsNurse = escalationTriggers.some(t =>
      spokenText.toLowerCase().includes(t)
    );

    let aiResponseText;

    if (needsNurse) {
      aiResponseText = isHindi
        ? 'मैं अभी एक अलर्ट बना रहा हूँ ताकि आप सीधे नर्स से बात कर सकें।'
        : 'I am creating an alert now so you can speak with a nurse directly.';
    } else {
      const chat = await trackOpenAICall(
        "chat.completions /api/voice",
        () =>
          openai.chat.completions.create({
            model: OPENAI_CHAT_MODEL,
            temperature: 0.3,
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
    const { text, languageCode } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required' });
    }

    const localizedText = await localizeKycText(text, (languageCode || 'en').trim().toLowerCase());
    res.json({ text: localizedText });
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
        temperature: 0.7,
        max_tokens: 150,
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
        temperature: 0.1,
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

    const promptParts = [
      'This is KYC intake speech transcription.',
      'Transcribe exactly what the speaker says. Keep names and spelling accurate.',
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

    const transcription = await trackOpenAICall("KYC transcribe", () =>
      openai.audio.transcriptions.create(transcriptionConfig)
    );

    const transcriptText = transcription.text?.trim() || '';
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
        return `[${start} → ${end}] ${speaker}:\n${text}`;
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

    const fieldListBase = kycFields
      .map((f, i) => {
        const genderTag = f.genderRestriction && f.genderRestriction !== 'all'
          ? ` [${f.genderRestriction.toUpperCase()} ONLY]`
          : '';
        const promptText = f.prompt || f.label;
        return `${i + 1}. ${promptText}${genderTag}`;
      })
      .join('\n');

    const fieldListText =
      preferredLanguage && preferredLanguage !== 'en'
        ? await localizeKycText(fieldListBase, preferredLanguage)
        : fieldListBase;

    const firstFieldPrompt =
      String(openingPrompt || '').trim() ||
      kycFields[0]?.prompt ||
      `What is your ${String(kycFields[0]?.label || 'application number').toLowerCase()}?`;

    const baseGreetingText = `Hi, my name is Dr. Christiana. Let's get started with your medical examination report. ${firstFieldPrompt}`;
    const greetingText =
      preferredLanguage && preferredLanguage !== 'en'
        ? await localizeKycText(baseGreetingText, preferredLanguage)
        : baseGreetingText;

    const speechInstruction =
      providerLanguage !== requestedLanguage
        ? `Speak only in ${languageName} for all patient-facing responses. The provider session language is set to ${providerLanguage} only for compatibility, so do not switch to English or Hindi unless the patient asks.`
        : `Speak only in ${languageName} for all patient-facing responses.`;

    const kycSystemPrompt = `You are Dr. Christiana, a warm professional doctor helping a patient complete a KYC medical form during a video call.

${speechInstruction} Be empathetic, calm, natural, and brief. Keep each reply under 35 words.

Ask these fields one by one in order. The list below is the phrasing to follow for the patient:
${fieldListText}

Rules:
- Ask only one field at a time and wait for the answer before moving on.
- If gender is male, skip all [FEMALE ONLY] fields silently. If gender is female, skip all [MALE ONLY] fields silently.
- Never use ALL CAPS, shouting, or dramatic emphasis.
- Do not say phrases like "IS THAT RIGHT?" or repeatedly ask for confirmation after normal answers.
- Do not repeat the patient's previous answer back verbatim unless a clarification is genuinely needed.
- Use a short acknowledgment, then move directly to the next question.
- For names or dates, only ask for clarification if the answer was genuinely unclear or incomplete.
- For yes/no fields, ask naturally. If the patient says yes without details and details are needed, ask one short follow-up for the reason.
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
        name: 'Dr. Christiana Managed Agent',
        avatar_id: avatarId,
        system_prompt: kycSystemPrompt,
        language: providerLanguage,
        greeting: greetingText,
        max_session_length_minutes: 30,
        llm: { type: 'openai' },
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

    res.json({
      agentId,
      agentUrl: `https://bey.chat/${agentId}`,
      mode: 'iframe_embed',
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
// /api/beyondpresence/agent-call-messages
// =====================
app.get('/api/beyondpresence/agent-call-messages/:agentId', async (req, res) => {
  try {
    if (!BEY_API_KEY) {
      return res.status(500).json({ error: 'BEYOND_PRESENCE_API_KEY not configured' });
    }

    const { agentId } = req.params;
    const callsRes = await fetch(`${BEY_API_BASE}/v1/calls?limit=50`, {
      headers: { 'x-api-key': BEY_API_KEY },
    });
    const callsData = await callsRes.json();

    if (!callsRes.ok) {
      return res.status(callsRes.status || 500).json({
        error: extractProviderErrorMessage(callsData, 'Failed to list Beyond Presence calls'),
      });
    }

    const calls = Array.isArray(callsData?.data) ? callsData.data : [];
    const latestCall = calls
      .filter((call) => call.agent_id === agentId)
      .sort((a, b) => new Date(b.started_at || 0).getTime() - new Date(a.started_at || 0).getTime())[0];

    if (!latestCall?.id) {
      return res.json({ callId: null, messages: [], call: null });
    }

    const messagesRes = await fetch(`${BEY_API_BASE}/v1/calls/${latestCall.id}/messages`, {
      headers: { 'x-api-key': BEY_API_KEY },
    });
    const messagesData = await messagesRes.json();

    if (!messagesRes.ok) {
      return res.status(messagesRes.status || 500).json({
        error: extractProviderErrorMessage(messagesData, 'Failed to load Beyond Presence call messages'),
      });
    }

    res.json({
      callId: latestCall.id,
      call: latestCall,
      messages: Array.isArray(messagesData) ? messagesData : [],
    });
  } catch (err) {
    console.error('BEYOND PRESENCE AGENT MESSAGES ERROR:', err);
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
