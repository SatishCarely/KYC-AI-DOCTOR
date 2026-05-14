//new code

import React, { useState, useRef, useEffect } from "react";
import ConverxAILogoFull from "./assets/converxai-logo-full.png";
import ConverxAILogoIcon from "./assets/converxai-logo-icon.png";
import BeyondPresenceStream from "./BeyondPresenceStream";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min?url";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { Room, Track } from "livekit-client";
import {
  Camera,
  CameraOff,
  DoorOpen,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  MoreHorizontal,
  PhoneOff,
  Radio,
  ScreenShareOff,
  SwitchCamera,
  Users,
} from "lucide-react";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  (typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:3000"
    : "https://3jpvg3rp62.ap-south-1.awsapprunner.com");

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const normalize = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[:.\/]/g, "")
    .trim();

const decodeEscapedUnicodeText = (value) =>
  String(value || "").replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16)),
  );

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

const getMojibakeByte = (char) => {
  const code = char.charCodeAt(0);
  if (code <= 255) return code;
  return WINDOWS_1252_MOJIBAKE_BYTES[code] ?? null;
};

const hasMojibakeMarker = (value) => /[ÃƒÃ‚Ã¢Ã ]/.test(String(value || ""));

const repairMojibakeSegment = (value) => {
  const raw = String(value || "");
  if (!hasMojibakeMarker(raw)) return raw;
  const bytes = [...raw].map(getMojibakeByte);
  if (bytes.some((byte) => byte == null)) return raw;

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(
      Uint8Array.from(bytes),
    );
  } catch {
    return raw;
  }
};

const repairMojibakeText = (value) => {
  const raw = String(value || "");
  if (!hasMojibakeMarker(raw)) return raw;

  const fullyRepaired = repairMojibakeSegment(raw);
  if (fullyRepaired !== raw) return fullyRepaired;

  return raw.replace(/[\u00A0-\u00FF\u20AC-\u2122]{2,}/g, (segment) =>
    repairMojibakeSegment(segment),
  );
};

const normalizeTranscriptEncoding = (value) =>
  repairMojibakeText(decodeEscapedUnicodeText(value))
    .replace(/\s+/g, " ")
    .trim();

const isYesNoField = (field) => field?.type === "yes_no";

const isDeclarationField = (field) => {
  const section = normalize(field?.section || "");
  const label = normalize(field?.label || "");
  return (
    section.includes("declaration") ||
    label.includes("declaration") ||
    label.includes("i hereby")
  );
};

const YES_ANSWER_VALUES = new Set([
  "yes",
  "y",
  "yeah",
  "yep",
  "haan",
  "haan ji",
  "ha ji",
  "ha",
  "han",
  "ho",
  "hoy",
  "hoi",
  "à¤¹à¤¾à¤‚",
  "à¤¹à¤¾à¤",
  "à¤¹à¤¾",
  "à¤¹à¥‹",
  "si",
  "sÃ­",
  "oui",
  "true",
  "à¤¹à¥‹",
  "à¤¹à¥‹à¤¯",
  "à¤¹à¤¾à¤",
  "à¤¹à¤¾à¤‚",
]);
const NO_ANSWER_VALUES = new Set([
  "no",
  "n",
  "nope",
  "nah",
  "nahi",
  "nahi",
  "naahi",
  "à¤¨à¤¹à¥€à¤‚",
  "à¤¨à¤¹à¥€",
  "à¤¨à¤¾à¤¹à¤¿",
  "no",
  "non",
  "false",
  "à¤¨à¤¹à¥€à¤‚",
  "à¤¨à¤¹à¥€",
  "à¤¨à¤¾à¤¹à¥€",
]);

const parseYesNoAnswer = (text) => {
  const t = normalizeTranscriptEncoding(text || "")
    .toLowerCase()
    .replace(/[,\sã€‚à¥¤.!?;:]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return null;

  if (YES_ANSWER_VALUES.has(t)) return "Yes";
  if (NO_ANSWER_VALUES.has(t)) return "No";

  const indicNormalized = normalizeIndicSpeechText(t)
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (YES_ANSWER_VALUES.has(indicNormalized)) return "Yes";
  if (NO_ANSWER_VALUES.has(indicNormalized)) return "No";

  if (/^(yes|haan ji|ha ji|haan|ha|ho|hoy|hoi|si|sÃ­|oui)\b/.test(t)) return "Yes";
  if (/^(no|nahi|nahi|naahi|non)\b/.test(t)) return "No";
  if (/^(yes|haan|ha|ho)\b/.test(indicNormalized)) return "Yes";
  if (/^(no|nahi|naahi)\b/.test(indicNormalized)) return "No";
  if (/^(à¤¹à¤¾à¤‚|à¤¹à¤¾à¤|à¤¹à¤¾|à¤¹à¥‹)(?:\s|$)/.test(t)) return "Yes";
  if (/^(à¤¨à¤¹à¥€à¤‚|à¤¨à¤¹à¥€|à¤¨à¤¾à¤¹à¤¿|à¤¨à¤¾à¤¹à¥€)(?:\s|$)/.test(t)) return "No";
  return null;
};

function isLikelyRelevantImplicitYes(field, text) {
  if (!field?.requiresReasonOnYes) return false;

  const normalized = normalizeIndicSpeechText(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized || normalized.length < 3) return false;

  const label = normalize(`${field.label || ""} ${field.prompt || ""}`);
  const id = String(field.id || "");
  const hasAny = (terms) => terms.some((term) => normalized.includes(term));

  if (id === "hypertension") {
    return hasAny(["hypertension", "blood pressure", "bp", "cholesterol"]);
  }
  if (id === "diabetes_thyroid") {
    return hasAny(["diabetes", "diabetic", "sugar", "thyroid", "endocrine"]);
  }
  if (id === "chest_pain_history") {
    return hasAny(["chest", "heart", "attack", "palpitation", "breathless", "breathlessness"]);
  }
  if (id === "respiratory") {
    return hasAny(["asthma", "bronchitis", "wheezing", "tuberculosis", "breathing", "breath"]);
  }
  if (id === "blood_disorder") {
    return hasAny(["anemia", "anaemia", "leukemia", "leukaemia", "circulatory"]);
  }
  if (id === "liver_disorder") {
    return hasAny(["liver", "cirrhosis", "hepatitis", "jaundice", "stomach", "colitis", "indigestion"]);
  }
  if (id === "disability_congenital") {
    return hasAny(["disability", "disabled", "mental", "physical", "congenital"]);
  }
  if (id === "cancer_tumour") {
    return hasAny(["cancer", "tumor", "tumour", "cyst", "growth", "lymph"]);
  }
  if (id === "kidney_disease") {
    return hasAny(["kidney", "stone", "urine", "prostate", "gynecological", "gynaecological"]);
  }
  if (id === "epilepsy_nervous") {
    return hasAny(["epilepsy", "nervous", "tremor", "numbness", "paralysis", "psychiatric"]);
  }
  if (id === "ent_disorder") {
    return hasAny(["eye", "ear", "nose", "throat", "spectacles"]);
  }
  if (id === "musculoskeletal") {
    return hasAny(["back", "muscle", "joint", "joins", "bone", "neck", "arthritis", "gout", "ankle", "knee", "shoulder"]);
  }
  if (id === "diagnostic_tests") {
    return hasAny(["xray", "x ray", "ct", "mri", "ecg", "tmt", "blood test", "surgery", "scan", "test"]);
  }
  if (id === "hiv_std") {
    return hasAny(["hiv", "aids", "std", "sexually", "syphilis", "gonorrhea"]);
  }
  if (id === "treatment_medication") {
    return hasAny([
      "medicine",
      "medication",
      "tablet",
      "capsule",
      "insulin",
      "therapy",
      "treatment",
      "surgery",
      "operation",
      "hospital",
      "hospitalized",
      "admitted",
      "under treatment",
      "taking",
      "angioplasty",
      "angiogram",
      "stent",
      "bypass",
      "dialysis",
      "chemotherapy",
      "chemo",
      "radiation",
      "transplant",
      "implant",
      "replacement",
    ]);
  }
  if (id.startsWith("hospitalization_") || id === "other_hospitalization_details") {
    return hasAny(["hospital", "hospitalized", "admitted", "fever", "poisoning", "accident", "c section", "stone", "appendix", "appendicectomy", "piles", "hernia", "malaria", "typhoid", "dengue", "gastroenteritis", "dehydration", "surgery", "operation", "fracture", "ankle", "elbow", "hand", "leg"]);
  }
  if (id === "travel_outside_india") {
    return isLikelyTravelDestinationText(normalized);
  }
  if (id === "off_work_illness") {
    return hasAny(["off work", "leave", "illness", "sick"]);
  }
  if (id === "other_disease") {
    return hasAny(["disease", "ailment", "habit", "condition"]);
  }

  const labelTokens = label
    .split(" ")
    .filter((token) => token.length > 3 && !["have", "ever", "with", "from", "such", "other", "disorder", "disease"].includes(token));
  return labelTokens.some((token) => normalized.includes(token));
}

const inferImplicitYesNoAnswer = (field, text) => {
  if (!isYesNoField(field)) return null;

  const raw = String(text || "").trim();
  if (!raw) return null;

  const explicit = parseYesNoAnswer(raw);
  if (explicit) return explicit;

  const normalized = normalizeIndicSpeechText(raw).toLowerCase();
  if (
    /\b(no|none|nil|never|nothing|dont|don't|do not|not taking|not on any|no treatment|no medication|not hospitalized|not admitted|not operated|do not have|does not have|don't have|dont have)\b/.test(
      normalized,
    )
  ) {
    return "No";
  }

  if (isLikelyRelevantImplicitYes(field, raw)) {
    return "Yes";
  }

  return null;
};

const normalizeIndicSpeechText = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/\u0939\u093e\u0902|\u0939\u093e\u0901|\u0939\u093e|\u0939\u094b/gi, " yes ")
    .replace(/\u0928\u0939\u0940\u0902|\u0928\u0939\u0940|\u0928\u093e\u0939\u0940/gi, " no ")
    .replace(/\u091c\u0928\u0935\u0930\u0940/gi, " january ")
    .replace(/\u092b\u0930\u0935\u0930\u0940/gi, " february ")
    .replace(/\u092e\u093e\u0930\u094d\u091a/gi, " march ")
    .replace(/\u0905\u092a\u094d\u0930\u0948\u0932/gi, " april ")
    .replace(/\u092e\u0908/gi, " may ")
    .replace(/\u091c\u0942\u0928/gi, " june ")
    .replace(/\u091c\u0941\u0932\u093e\u0908/gi, " july ")
    .replace(/\u0905\u0917\u0938\u094d\u0924/gi, " august ")
    .replace(/\u0938\u093f\u0924\u0902\u092c\u0930|\u0938\u093f\u0924\u092e\u094d\u092c\u0930/gi, " september ")
    .replace(/\u0905\u0915\u094d\u091f\u0942\u092c\u0930|\u0911\u0915\u094d\u091f\u094b\u092c\u0930/gi, " october ")
    .replace(/\u0928\u0935\u0902\u092c\u0930/gi, " november ")
    .replace(/\u0926\u093f\u0938\u0902\u092c\u0930/gi, " december ")
    .replace(/\u0936\u0942\u0928\u094d\u092f|\u0938\u0941\u0928\u094d\u092f/gi, " zero ")
    .replace(/\u090f\u0915/gi, " one ")
    .replace(/\u0926\u094b\u0928|\u0926\u094b/gi, " two ")
    .replace(/\u0924\u0940\u0928/gi, " three ")
    .replace(/\u091a\u093e\u0930/gi, " four ")
    .replace(/\u092a\u093e\u0902\u091a|\u092a\u093e\u091a/gi, " five ")
    .replace(/\u0938\u0939\u093e|\u091b\u0939/gi, " six ")
    .replace(/\u0938\u093e\u0924/gi, " seven ")
    .replace(/\u0906\u0920/gi, " eight ")
    .replace(/\u0928\u094c|\u0928\u0909/gi, " nine ")
    .replace(/\u0926\u0938|\u0926\u0939\u093e/gi, " ten ")
    .replace(/\u0939\u091c\u093c\u093e\u0930|\u0939\u091c\u093e\u0930/gi, " thousand ")
    .replace(/à¤‘à¤•à¥à¤Ÿà¥‹à¤¬à¤°|à¤…à¤•à¥à¤Ÿà¥‚à¤¬à¤°|à¤‘à¤•à¥à¤Ÿà¥‚à¤¬à¤°/gi, " october ")
    .replace(/à¤¸à¤ªà¥à¤Ÿà¥‡à¤‚à¤¬à¤°|à¤¸à¤¿à¤¤à¤‚à¤¬à¤°|à¤¸à¤¿à¤¤à¤®à¥à¤¬à¤°/gi, " september ")
    .replace(/à¤¨à¤µà¤‚à¤¬à¤°|à¤¨à¥‹à¤µà¥à¤¹à¥‡à¤‚à¤¬à¤°/gi, " november ")
    .replace(/à¤¡à¤¿à¤¸à¥‡à¤‚à¤¬à¤°|à¤¦à¤¿à¤¸à¤‚à¤¬à¤°/gi, " december ")
    .replace(/à¤¶à¥‚à¤¨à¥à¤¯|à¤¸à¥à¤¨à¥à¤¯|à¤¸à¥à¥à¤¨à¥à¤¯/gi, " zero ")
    .replace(/à¤à¤•/gi, " one ")
    .replace(/à¤¦à¥‹à¤¨|à¤¦à¥‹/gi, " two ")
    .replace(/à¤¤à¥€à¤¨/gi, " three ")
    .replace(/à¤šà¤¾à¤°/gi, " four ")
    .replace(/à¤ªà¤¾à¤š/gi, " five ")
    .replace(/à¤ªà¤šà¥à¤šà¥€à¤¸/gi, " twenty five ")
    .replace(/à¤ªà¤šà¤¾à¤¸/gi, " fifty ")
    .replace(/à¤²à¤¾à¤–|à¤²à¤¾à¤–à¥‹à¤‚/gi, " lakh ")
    .replace(/à¤¸à¤¹à¤¾|à¤›à¤¹/gi, " six ")
    .replace(/à¤¸à¤¾à¤¤/gi, " seven ")
    .replace(/à¤†à¤ /gi, " eight ")
    .replace(/à¤¨à¤Š|à¤¨à¥Œ/gi, " nine ")
    .replace(/à¤¦à¤¹à¤¾|à¤¦à¤¸/gi, " ten ")
    .replace(/à¤¹à¤œà¤¾à¤°/gi, " thousand ")
    .replace(/\bdhohazardha\b/gi, " two thousand ten ")
    .replace(/\bdhohazdha\b/gi, " two thousand ten ")
    .replace(/\bdhoh?az(?:a|aa)r?a?\b/gi, " two thousand ")
    .replace(/\bdohajaar\b/gi, " two thousand ")
    .replace(/\bdohazar\b/gi, " two thousand ")
    .replace(/\bdohajar\b/gi, " two thousand ")
    .replace(/\bdo\s+haza+r\b/gi, " two thousand ")
    .replace(/\bdon\s+haza+r\b/gi, " two thousand ")
    .replace(/\bshunya\b/gi, " zero ")
    .replace(/\bsunya\b/gi, " zero ")
    .replace(/\bek\b/gi, " one ")
    .replace(/\bdon\b/gi, " two ")
    .replace(/\bdo\b/gi, " two ")
    .replace(/\bteen\b/gi, " three ")
    .replace(/\btheen\b/gi, " three ")
    .replace(/\btin\b/gi, " three ")
    .replace(/\bchar\b/gi, " four ")
    .replace(/\bchaar\b/gi, " four ")
    .replace(/\bpach\b/gi, " five ")
    .replace(/\bpanch\b/gi, " five ")
    .replace(/\bpaanch\b/gi, " five ")
    .replace(/\bsaha\b/gi, " six ")
    .replace(/\bchhe\b/gi, " six ")
    .replace(/\bcheh\b/gi, " six ")
    .replace(/\bsaat\b/gi, " seven ")
    .replace(/\bsat\b/gi, " seven ")
    .replace(/\baath\b/gi, " eight ")
    .replace(/\bath\b/gi, " eight ")
    .replace(/\bnau\b/gi, " nine ")
    .replace(/\bnav\b/gi, " nine ")
    .replace(/\bdaha\b/gi, " ten ")
    .replace(/\bdas\b/gi, " ten ")
    .replace(/à¤à¤•à¤¶à¥‡|à¤à¤• à¤¶à¥‡/gi, " one hundred ")
    .replace(/à¤¦à¥‹à¤¨à¤¶à¥‡|à¤¦à¥‹à¤¶à¥‡|à¤¦à¥‹à¤¨ à¤¶à¥‡|à¤¦à¥‹ à¤¶à¥‡/gi, " two hundred ")
    .replace(/à¤¤à¥€à¤¨à¤¶à¥‡|à¤¤à¥€à¤¨ à¤¶à¥‡/gi, " three hundred ")
    .replace(/à¤šà¤¾à¤°à¤¶à¥‡|à¤šà¤¾à¤° à¤¶à¥‡/gi, " four hundred ")
    .replace(/à¤ªà¤¾à¤šà¤¶à¥‡|à¤ªà¤¾à¤š à¤¶à¥‡/gi, " five hundred ")
    .replace(/à¤¸à¤¹à¤¾à¤¶à¥‡|à¤¸à¤¹à¤¾ à¤¶à¥‡|à¤›à¤¹ à¤¸à¥Œ/gi, " six hundred ")
    .replace(/à¤¸à¤¾à¤¤à¤¶à¥‡|à¤¸à¤¾à¤¤ à¤¶à¥‡/gi, " seven hundred ")
    .replace(/à¤†à¤ à¤¶à¥‡|à¤†à¤  à¤¶à¥‡/gi, " eight hundred ")
    .replace(/à¤¨à¤Šà¤¶à¥‡|à¤¨à¥Œ à¤¸à¥Œ|à¤¨à¤Š à¤¶à¥‡/gi, " nine hundred ")
    .replace(/\bek\s+shay\b/gi, " one hundred ")
    .replace(/\bek\s+she\b/gi, " one hundred ")
    .replace(/\bdon\s+shay\b/gi, " two hundred ")
    .replace(/\bdon\s+she\b/gi, " two hundred ")
    .replace(/\bdo\s+shay\b/gi, " two hundred ")
    .replace(/\bdo\s+she\b/gi, " two hundred ")
    .replace(/\bteen\s+shay\b/gi, " three hundred ")
    .replace(/\bteen\s+she\b/gi, " three hundred ")
    .replace(/\bchar\s+shay\b/gi, " four hundred ")
    .replace(/\bchar\s+she\b/gi, " four hundred ")
    .replace(/\bpach\s+shay\b/gi, " five hundred ")
    .replace(/\bpach\s+she\b/gi, " five hundred ")
    .replace(/\bsaha\s+shay\b/gi, " six hundred ")
    .replace(/\bsaha\s+she\b/gi, " six hundred ")
    .replace(/\bsaat\s+shay\b/gi, " seven hundred ")
    .replace(/\bsaat\s+she\b/gi, " seven hundred ")
    .replace(/\baath\s+shay\b/gi, " eight hundred ")
    .replace(/\baath\s+she\b/gi, " eight hundred ")
    .replace(/\bnau\s+shay\b/gi, " nine hundred ")
    .replace(/\bnau\s+she\b/gi, " nine hundred ")
    .replace(/\bshe\b/gi, " hundred ")
    .replace(/\bshay\b/gi, " hundred ")
    .replace(/\bekunaishi\b/gi, " seventy nine ")
    .replace(/\bekonashi\b/gi, " seventy nine ")
    .replace(/\bekonaishi\b/gi, " seventy nine ")
    .replace(/\bekonaenshi\b/gi, " seventy nine ")
    .replace(/\bekonaainshi\b/gi, " seventy nine ")
    .replace(/\bekon\saishi\b/gi, " seventy nine ")
    .replace(/\bekon\saenshi\b/gi, " seventy nine ")
    .replace(/à¤à¤•à¥‹à¤£à¤à¤‚à¤¶à¥€|à¤à¤•à¥‹à¤£à¤à¤¶à¥€/gi, " seventy nine ")
    .replace(/\bhajar\b/gi, " thousand ")
    .replace(/\bhazaar\b/gi, " thousand ")
    .replace(/\bhazar\b/gi, " thousand ")
    .replace(/\blakh\b/gi, " lakh ")
    .replace(/\blac\b/gi, " lakh ")
    .replace(/\s+/g, " ")
    .trim();

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

const parseSpokenNumberTokens = (tokens) => {
  let total = 0;
  let current = 0;
  let used = false;

  for (const token of tokens) {
    if (!token || token === "and") continue;
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
    if (token === "hundred") {
      current = (current || 1) * 100;
      used = true;
      continue;
    }
    if (token === "thousand") {
      total += (current || 1) * 1000;
      current = 0;
      used = true;
      continue;
    }
    if (token === "lakh" || token === "lakhs") {
      total += (current || 1) * 100000;
      current = 0;
      used = true;
      continue;
    }
    if (token === "crore" || token === "crores") {
      total += (current || 1) * 10000000;
      current = 0;
      used = true;
      continue;
    }
    return null;
  }

  return used ? total + current : null;
};

const formatNumericForPdf = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const normalized = normalizeIndicSpeechText(raw)
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (/^(zero|0|none|nil|no cover|not applicable)$/i.test(normalized))
    return "0";

  const directNumeric = normalized.replace(/\s+/g, "");
  if (/^\d+(\.\d+)?$/.test(directNumeric)) {
    return directNumeric;
  }

  const tokens = normalized
    .split(/\s+/)
    .map((token) => token.replace(/[^a-z0-9]/g, ""))
    .filter(Boolean);
  const parsed = parseSpokenNumberTokens(tokens);
  return parsed != null ? String(parsed) : raw;
};

const formatHeightCmForPdf = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const normalized = normalizeIndicSpeechText(raw)
    .replace(/,/g, " ")
    .replace(/\b(centimeters?|centimetres?|cms?|cm|height|is|i am|i'm)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const directNumeric = normalized.replace(/\s+/g, "");
  if (/^\d+(\.\d+)?$/.test(directNumeric)) {
    const numeric = Number(directNumeric);
    if (numeric >= 70 && numeric < 100) return String(numeric + 100);
    return directNumeric;
  }

  const tokens = normalized
    .split(/\s+/)
    .map((token) => token.replace(/[^a-z0-9]/g, ""))
    .filter(Boolean);
  if (!tokens.length) return raw;

  const singleDigitTokens = new Set([
    "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  ]);
  if (
    (tokens[0] === "one" || tokens[0] === "1") &&
    tokens.slice(1).length >= 2 &&
    tokens.slice(1).every((token) => singleDigitTokens.has(token) || /^\d$/.test(token))
  ) {
    return tokens
      .map((token) => (SPOKEN_NUMBER_WORDS[token] != null ? SPOKEN_NUMBER_WORDS[token] : token))
      .join("");
  }

  const tailParsed =
    (tokens[0] === "one" || tokens[0] === "1") && tokens.length > 1
      ? parseSpokenNumberTokens(tokens.slice(1))
      : null;
  if (tailParsed != null && tailParsed >= 20 && tailParsed < 100) {
    return String(100 + tailParsed);
  }

  const parsed = parseSpokenNumberTokens(tokens);
  if (parsed != null) {
    return parsed >= 70 && parsed < 100 ? String(parsed + 100) : String(parsed);
  }
  return raw;
};

const buildKycQuestionPrompt = (field, stepIndex = null, total = null) => {
  const stepText =
    stepIndex != null && total != null
      ? ` (Step ${stepIndex + 1} of ${total})`
      : "";

  if (field?.prompt) {
    return `${stripInlineYesDetailInstruction(field.prompt)}${stepText}`;
  }

  if (isDeclarationField(field)) {
    return `Declaration statement: ${field.label}. Please answer Yes or No.${stepText}`;
  }

  if (isYesNoField(field)) {
    return `Please answer Yes or No: ${field.label}.${stepText}`;
  }

  return `Please provide your ${field.label}.${stepText}`;
};

const KYC_LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "bn", label: "Bengali" },
  { value: "te", label: "Telugu" },
  { value: "ta", label: "Tamil" },
  { value: "mr", label: "Marathi" },
  { value: "gu", label: "Gujarati" },
  { value: "kn", label: "Kannada" },
  { value: "ml", label: "Malayalam" },
  { value: "pa", label: "Punjabi" },
  { value: "or", label: "Odia" },
  { value: "ur", label: "Urdu" },
];

const SARVAM_LANGUAGE_CODES = {
  en: "en-IN",
  hi: "hi-IN",
  es: "es-ES",
  fr: "fr-FR",
  bn: "bn-IN",
  te: "te-IN",
  ta: "ta-IN",
  mr: "mr-IN",
  gu: "gu-IN",
  kn: "kn-IN",
  ml: "ml-IN",
  pa: "pa-IN",
  or: "od-IN",
  ur: "ur-IN",
};

const getReadableErrorMessage = (value, fallback = "Something went wrong") => {
  if (!value) return fallback;
  if (typeof value === "string") return value;
  if (typeof value?.message === "string") return value.message;
  if (typeof value?.error === "string") return value.error;
  if (typeof value?.detail === "string") return value.detail;
  if (typeof value?.detail?.message === "string") return value.detail.message;
  if (Array.isArray(value?.detail) && value.detail.length > 0) {
    const firstDetail = value.detail[0];
    if (typeof firstDetail === "string") return firstDetail;
    if (typeof firstDetail?.message === "string") return firstDetail.message;
    if (typeof firstDetail?.msg === "string") return firstDetail.msg;
  }
  if (Array.isArray(value?.errors) && value.errors.length > 0) {
    const firstError = value.errors[0];
    if (typeof firstError === "string") return firstError;
    if (typeof firstError?.message === "string") return firstError.message;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
};

const DEMO_CHEST_PAIN_YES_ACRO_FIELD =
  "YESAny history of chest pain heart attack palpitations and breathlessness on exertion or irregular heart beat";
const DEMO_CHEST_PAIN_NO_ACRO_FIELD =
  "NOAny history of chest pain heart attack palpitations and breathlessness on exertion or irregular heart beat";
const DEMO_CHEST_PAIN_REASON_ACRO_FIELD =
  "IF YES please give detailsAny history of chest pain heart attack palpitations and breathlessness on exertion or irregular heart beat";
const PDF_CHECK_MARK = "\u2713";

const PRESET_DEMO_KYC_FIELDS = [
  {
    id: "application_no",
    label: "Application No.",
    type: "text",
    section: "Page 1 header",
    prompt: "What is your application number?",
    matchHints: [
      "application number",
      "application no",
      "app number",
      "policy application number",
    ],
    acroFieldName: "Application No",
    genderRestriction: "all",
  },
  {
    id: "life_to_be_assured_name",
    label: "Life to be Assured (LA) name",
    type: "text",
    section: "Page 1 header",
    prompt: "What is your full name? Please spell it out clearly.",
    matchHints: [
      "full name",
      "first and last name",
      "spell it out clearly",
      "life assured name",
    ],
    acroFieldName: "Life to be Assured LA",
    genderRestriction: "all",
  },
  {
    id: "date_of_birth",
    label: "Date of Birth",
    type: "date",
    section: "Page 1 header",
    prompt: "What is your date of birth? Please say the day, month, and year.",
    matchHints: ["date of birth", "birth date", "day month year", "dob"],
    placeholder: "DD/MM/YY",
    acroFieldName: "Date of Birth",
    genderRestriction: "all",
  },
  {
    id: "gender",
    label: "Gender",
    type: "text",
    section: "Page 1 header",
    prompt: "What is your gender?",
    matchHints: ["gender", "male or female", "sex"],
    acroFieldName: "Gender",
    genderRestriction: "all",
  },
  {
    id: "nominee_name",
    label: "Nominee Name",
    type: "text",
    section: "Page 1 header",
    prompt: "What is your nominee's full name?",
    matchHints: [
      "nominee name",
      "nominee full name",
      "nominee first and last name",
    ],
    acroFieldName: "Nominee Name",
    genderRestriction: "all",
  },
  {
    id: "nominee_dob",
    label: "Nominee Date of Birth",
    type: "date",
    section: "Page 1 header",
    prompt: "What is your nominee's date of birth?",
    matchHints: ["nominee date of birth", "nominee dob", "nominee birth date"],
    placeholder: "DD/MM/YY",
    acroFieldName: "Nominee DOB",
    genderRestriction: "all",
  },
  {
    id: "contact_no",
    label: "Contact No.",
    type: "text",
    section: "Page 1 header",
    prompt: "What is your contact number?",
    acroFieldName: "Contact No",
    genderRestriction: "all",
  },
  {
    id: "education_details",
    label: "Education details",
    type: "text",
    section: "Education",
    prompt:
      "Please provide your education details - your highest qualification.",
    acroYesFieldName: "YESPlease provide your education details",
    acroNoFieldName: "NOPlease provide your education details",
    acroFieldName:
      "IF YES please give detailsPlease provide your education details",
    genderRestriction: "all",
  },
  {
    id: "pregnant",
    label: "Are you pregnant?",
    type: "yes_no",
    section: "Women health",
    prompt: "Are you currently pregnant? Please answer yes or no.",
    genderRestriction: "female",
    acroYesFieldName: "YESFor Women Are you pregnant",
    acroNoFieldName: "NOFor Women Are you pregnant",
  },
  {
    id: "women_tests",
    label: "Have you undergone mammogram, ultrasound, pap smear etc.?",
    type: "yes_no",
    section: "Women health",
    prompt:
      "Have you undergone any tests like mammogram, ultrasound, or pap smear? Yes or no.",
    genderRestriction: "female",
    acroYesFieldName:
      "YESFor Women Have you undergone any of these tests like mammogram ultrasound pap smear etc",
    acroNoFieldName:
      "NOFor Women Have you undergone any of these tests like mammogram ultrasound pap smear etc",
  },
  {
    id: "women_tests_results_normal",
    label: "Were the results normal?",
    type: "yes_no",
    section: "Women health",
    prompt: "Were the test results normal?",
    genderRestriction: "female",
    acroYesFieldName: "YESWere the results normal",
    acroNoFieldName: "NOWere the results normal",
  },
  {
    id: "ultrasound_pregnancy",
    label: "Ultrasound done due to pregnancy",
    type: "yes_no",
    section: "Women health",
    prompt: "Was an ultrasound done due to pregnancy?",
    genderRestriction: "female",
    acroYesFieldName: "YESUltrasound done due to pregnancy",
    acroNoFieldName: "NOUltrasound done due to pregnancy",
  },
  {
    id: "ultrasound_other",
    label: "Ultrasound done for any other purpose apart from pregnancy",
    type: "yes_no",
    section: "Women health",
    prompt:
      "Was an ultrasound done for any other purpose apart from pregnancy?",
    genderRestriction: "female",
    acroYesFieldName:
      "YESUltrasound done for any other purpose apart from pregnancy",
    acroNoFieldName:
      "NOUltrasound done for any other purpose apart from pregnancy",
  },
  {
    id: "chest_pain_history",
    label: "Chest pain / heart attack / palpitations / breathlessness",
    type: "yes_no",
    section: "Medical history",
    prompt:
      "Have you had any history of chest pain, heart attack, palpitations, or breathlessness on exertion? Please answer yes or no. If yes, briefly tell me the reason.",
    followUpIfYes: "Could you briefly tell me the reason?",
    reasonPromptLabel: "If yes, please tell me the reason",
    reasonResponseId: "chest_pain_history_reason",
    requiresReasonOnYes: true,
    genderRestriction: "all",
    acroYesFieldName:
      "YESAny history of chest pain heart attack palpitations and breathlessness on exertion or irregular heart beat",
    acroNoFieldName:
      "NOAny history of chest pain heart attack palpitations and breathlessness on exertion or irregular heart beat",
    acroReasonFieldName:
      "IF YES please give detailsAny history of chest pain heart attack palpitations and breathlessness on exertion or irregular heart beat",
  },
  {
    id: "hypertension",
    label: "Hypertension or high blood pressure / high cholesterol",
    type: "yes_no",
    section: "Medical history",
    prompt:
      "Do you have or have you ever had hypertension, high blood pressure, or high cholesterol?",
    followUpIfYes: "Please give brief details.",
    reasonPromptLabel: "If yes, please give details",
    reasonResponseId: "hypertension_reason",
    requiresReasonOnYes: true,
    genderRestriction: "all",
    acroYesFieldName: "YESHypertension or high blood pressurehigh cholesterol",
    acroNoFieldName: "NOHypertension or high blood pressurehigh cholesterol",
    acroReasonFieldName:
      "IF YES please give detailsHypertension or high blood pressurehigh cholesterol",
  },
  {
    id: "diabetes_thyroid",
    label: "High blood sugar / Diabetes / thyroid or endocrine disorders",
    type: "yes_no",
    section: "Medical history",
    prompt:
      "Do you have high blood sugar, diabetes, thyroid disorder, or any other endocrine disorder?",
    followUpIfYes: "Please give brief details.",
    reasonPromptLabel: "If yes, please give details",
    reasonResponseId: "diabetes_thyroid_reason",
    requiresReasonOnYes: true,
    genderRestriction: "all",
    acroYesFieldName:
      "YESHigh blood sugar Diabetes thyroid disorder or any other endocrine disorders",
    acroNoFieldName:
      "NOHigh blood sugar Diabetes thyroid disorder or any other endocrine disorders",
    acroReasonFieldName:
      "IF YES please give detailsHigh blood sugar Diabetes thyroid disorder or any other endocrine disorders",
  },
  {
    id: "respiratory",
    label:
      "Asthma / bronchitis / wheezing / tuberculosis / breathing difficulties",
    type: "yes_no",
    section: "Medical history",
    prompt:
      "Do you have asthma, bronchitis, wheezing, tuberculosis, or any breathing difficulties?",
    followUpIfYes: "Please give brief details.",
    reasonPromptLabel: "If yes, please give details",
    reasonResponseId: "respiratory_reason",
    requiresReasonOnYes: true,
    genderRestriction: "all",
    acroYesFieldName:
      "YESAsthma bronchitis wheezing tuberculosis breathing difficulties or any other respiratory disorder",
    acroNoFieldName:
      "NOAsthma bronchitis wheezing tuberculosis breathing difficulties or any other respiratory disorder",
    acroReasonFieldName:
      "IF YES please give detailsAsthma bronchitis wheezing tuberculosis breathing difficulties or any other respiratory disorder",
  },
  {
    id: "blood_disorder",
    label: "Blood disorder like anemia, leukemia or circulatory disorder",
    type: "yes_no",
    section: "Medical history",
    prompt:
      "Do you have any blood disorder like anemia, leukemia, or any circulatory disorder?",
    followUpIfYes: "Please give brief details.",
    reasonPromptLabel: "If yes, please give details",
    reasonResponseId: "blood_disorder_reason",
    requiresReasonOnYes: true,
    genderRestriction: "all",
    acroYesFieldName:
      "YESBlood disorder like anemia leukemia or any circulatory disorder",
    acroNoFieldName:
      "NOBlood disorder like anemia leukemia or any circulatory disorder",
    acroReasonFieldName:
      "IF YES please give detailsBlood disorder like anemia leukemia or any circulatory disorder",
  },
  {
    id: "liver_disorder",
    label:
      "Liver disorders like cirrhosis, hepatitis, jaundice, stomach, colitis",
    type: "yes_no",
    section: "Medical history",
    prompt:
      "Do you have any liver disorders such as cirrhosis, hepatitis, jaundice, or stomach issues?",
    followUpIfYes: "Please give brief details.",
    reasonPromptLabel: "If yes, please give details",
    reasonResponseId: "liver_disorder_reason",
    requiresReasonOnYes: true,
    genderRestriction: "all",
    acroYesFieldName:
      "YESLiver disorders like cirrhosis hepatitis jaundice disorder of the stomach colitis or Indigestion",
    acroNoFieldName:
      "NOLiver disorders like cirrhosis hepatitis jaundice disorder of the stomach colitis or Indigestion",
    acroReasonFieldName:
      "IF YES please give detailsLiver disorders like cirrhosis hepatitis jaundice disorder of the stomach colitis or Indigestion",
  },
  {
    id: "disability_congenital",
    label: "Any physical or mental disability or congenital disease",
    type: "yes_no",
    section: "Medical history",
    prompt:
      "Do you have any physical or mental disability, or any congenital disease?",
    followUpIfYes: "Please give brief details.",
    reasonPromptLabel: "If yes, please give details",
    reasonResponseId: "disability_congenital_reason",
    requiresReasonOnYes: true,
    genderRestriction: "all",
    acroYesFieldName:
      "YESAny physical or mental disability or any congenital disease",
    acroNoFieldName:
      "NOAny physical or mental disability or any congenital disease",
    acroReasonFieldName:
      "IF YES please give detailsAny physical or mental disability or any congenital disease",
  },
  {
    id: "cancer_tumour",
    label: "Any cancer, tumour, cyst, growth, or enlarged lymph nodes",
    type: "yes_no",
    section: "Medical history",
    prompt:
      "Have you ever had any form of cancer, tumour, cyst, growth, or enlarged lymph nodes?",
    followUpIfYes: "Please give brief details.",
    reasonPromptLabel: "If yes, please give details",
    reasonResponseId: "cancer_tumour_reason",
    requiresReasonOnYes: true,
    genderRestriction: "all",
    acroYesFieldName:
      "YESAny form of cancer tumour cyst or growth of any kind or enlarged lymph nodes",
    acroNoFieldName:
      "NOAny form of cancer tumour cyst or growth of any kind or enlarged lymph nodes",
    acroReasonFieldName:
      "IF YES please give detailsAny form of cancer tumour cyst or growth of any kind or enlarged lymph nodes",
  },
  {
    id: "kidney_disease",
    label:
      "Kidney failure, stones, blood/pus in urine, prostate or gynecological disorder",
    type: "yes_no",
    section: "Medical history",
    prompt:
      "Do you have any kidney-related diseases such as kidney failure, stones, blood or pus in urine, or prostate disorder?",
    followUpIfYes: "Please give brief details.",
    reasonPromptLabel: "If yes, please give details",
    reasonResponseId: "kidney_disease_reason",
    requiresReasonOnYes: true,
    genderRestriction: "all",
    acroYesFieldName:
      "YESAny diseases related to kidney such as Kidney failure Kidney or Ureteric stones blood or pus in urine or prostrate or gynecological disorder",
    acroNoFieldName:
      "NOAny diseases related to kidney such as Kidney failure Kidney or Ureteric stones blood or pus in urine or prostrate or gynecological disorder",
    acroReasonFieldName:
      "IF YES please give detailsAny diseases related to kidney such as Kidney failure Kidney or Ureteric stones blood or pus in urine or prostrate or gynecological disorder",
  },
  {
    id: "epilepsy_nervous",
    label:
      "Epilepsy, nervous disorder, multiple sclerosis, tremors, numbness, paralysis, psychiatric disorder",
    type: "yes_no",
    section: "Medical history",
    prompt:
      "Do you have epilepsy, any nervous disorder, tremors, numbness, paralysis, or a psychiatric disorder?",
    followUpIfYes: "Please give brief details.",
    reasonPromptLabel: "If yes, please give details",
    reasonResponseId: "epilepsy_nervous_reason",
    requiresReasonOnYes: true,
    genderRestriction: "all",
    acroYesFieldName:
      "YESEpilepsy nervous disorder multiple sclerosis tremors numbness paralysis or psychiatric disorder",
    acroNoFieldName:
      "NOEpilepsy nervous disorder multiple sclerosis tremors numbness paralysis or psychiatric disorder",
    acroReasonFieldName:
      "IF YES please give detailsEpilepsy nervous disorder multiple sclerosis tremors numbness paralysis or psychiatric disorder",
  },
  {
    id: "ent_disorder",
    label: "Eye, ear, nose or throat disorder (except spectacles)",
    type: "yes_no",
    section: "Medical history",
    prompt:
      "Do you have any eye, ear, nose, or throat disorder, other than using spectacles?",
    followUpIfYes: "Please give brief details.",
    reasonPromptLabel: "If yes, please give details",
    reasonResponseId: "ent_disorder_reason",
    requiresReasonOnYes: true,
    genderRestriction: "all",
    acroYesFieldName:
      "YESEye ear nose or throat disorder Except use of spectacles",
    acroNoFieldName:
      "NOEye ear nose or throat disorder Except use of spectacles",
    acroReasonFieldName:
      "IF YES please give detailsEye ear nose or throat disorder Except use of spectacles",
  },
  {
    id: "musculoskeletal",
    label:
      "Disorder of back, muscle, joints, bone, neck, deformity, amputation, arthritis or gout",
    type: "yes_no",
    section: "Medical history",
    prompt:
      "Do you have any disorder of back, muscle, joints, bones, neck, or arthritis?",
    followUpIfYes: "Please give brief details.",
    reasonPromptLabel: "If yes, please give details",
    reasonResponseId: "musculoskeletal_reason",
    requiresReasonOnYes: true,
    genderRestriction: "all",
    acroYesFieldName:
      "YESDisorder of back muscle joints bone neck deformity amputation arthritis or gout",
    acroNoFieldName:
      "NODisorder of back muscle joints bone neck deformity amputation arthritis or gout",
    acroReasonFieldName:
      "IF YES please give detailsDisorder of back muscle joints bone neck deformity amputation arthritis or gout",
  },
  {
    id: "diagnostic_tests",
    label:
      "In last 5 years, had or advised X-ray / CT / MRI / ECG / TMT / blood test or surgery",
    type: "yes_no",
    section: "Medical history",
    prompt:
      "In the last 5 years, have you had or been advised to have any X-ray, CT scan, MRI, ECG, blood test, or surgery?",
    followUpIfYes: "Please give brief details.",
    reasonPromptLabel: "If yes, please give details",
    matchHints: [
      "which test or surgery",
      "what tests or surgery",
      "share what tests or surgery",
      "advised to have",
    ],
    reasonResponseId: "diagnostic_tests_reason",
    requiresReasonOnYes: true,
    genderRestriction: "all",
    acroYesFieldName: "p2_q1_yes",
    acroNoFieldName: "p2_q1_no",
    acroReasonFieldName: "p2_q1_details",
  },
  {
    id: "hiv_std",
    label: "Tested positive or under treatment for HIV / AIDS / STDs",
    type: "yes_no",
    section: "Medical history",
    prompt:
      "Have you or your spouse been tested positive or are under treatment for HIV, AIDS, or any sexually transmitted disease?",
    followUpIfYes: "Please give brief details.",
    reasonPromptLabel: "If yes, please give details",
    reasonResponseId: "hiv_std_reason",
    requiresReasonOnYes: true,
    genderRestriction: "all",
    acroYesFieldName: "p2_q2_yes",
    acroNoFieldName: "p2_q2_no",
    acroReasonFieldName: "p2_q2_details",
  },
  {
    id: "treatment_medication",
    label:
      "Receiving any treatment/medication or undergone surgery/hospitalization",
    type: "yes_no",
    section: "Medical history",
    prompt:
      "Are you currently receiving any treatment or medication, or have you been hospitalized or undergone surgery for any medical condition?",
    matchHints: [
      "receiving treatment",
      "receiving medication",
      "current medication",
      "under treatment",
      "taking medicine",
      "taking medication",
      "name of medicine",
    ],
    followUpIfYes:
      "Please tell me the reason for medication and name of medicine.",
    reasonPromptLabel: "Reason for medication and name of medicine",
    reasonResponseId: "treatment_medication_reason",
    requiresReasonOnYes: true,
    genderRestriction: "all",
    acroYesFieldName: "p2_q3_yes",
    acroNoFieldName: "p2_q3_no",
    acroReasonFieldName: "p2_q3_details",
  },
  {
    id: "hospitalization_fever_normal",
    label: "Hospitalization for fever and now normal",
    type: "yes_no",
    section: "Medical history",
    prompt: "Have you been hospitalized for any fever and are now normal?",
    followUpIfYes: "Please give brief details.",
    reasonPromptLabel: "If yes, please give details",
    reasonResponseId: "hospitalization_fever_normal_reason",
    requiresReasonOnYes: true,
    genderRestriction: "all",
    acroYesFieldName: "p2_q4_yes",
    acroNoFieldName: "p2_q4_no",
    acroReasonFieldName: "p2_q4_details",
  },
  {
    id: "hospitalization_food_poisoning_normal",
    label: "Hospitalization for food poisoning and now normal",
    type: "yes_no",
    section: "Medical history",
    prompt: "Have you been hospitalized for food poisoning and are now normal?",
    followUpIfYes: "Please give brief details.",
    reasonPromptLabel: "If yes, please give details",
    reasonResponseId: "hospitalization_food_poisoning_normal_reason",
    requiresReasonOnYes: true,
    genderRestriction: "all",
    acroYesFieldName: "p2_q5_yes",
    acroNoFieldName: "p2_q5_no",
    acroReasonFieldName: "p2_q5_details",
  },
  {
    id: "hospitalization_accident_alright",
    label: "Hospitalization after an accident and now alright",
    type: "yes_no",
    section: "Medical history",
    prompt: "Have you been hospitalized after an accident and are now alright?",
    followUpIfYes: "Please give brief details.",
    reasonPromptLabel: "If yes, please give details",
    reasonResponseId: "hospitalization_accident_alright_reason",
    requiresReasonOnYes: true,
    genderRestriction: "all",
    acroYesFieldName: "p2_q6_yes",
    acroNoFieldName: "p2_q6_no",
    acroReasonFieldName: "p2_q6_details",
  },
  {
    id: "hospitalization_common_surgeries",
    label:
      "Hospitalized for C-section, stone removal, appendicectomy, piles, or hernia",
    type: "yes_no",
    section: "Medical history",
    prompt:
      "Have you been hospitalized for C-section, stone removal, appendicectomy, piles, or hernia?",
    followUpIfYes: "Please give brief details.",
    reasonPromptLabel: "If yes, please give details",
    matchHints: [
      "which procedure among those",
      "stone removal",
      "appendicectomy",
      "hernia",
      "c section",
    ],
    reasonResponseId: "hospitalization_common_surgeries_reason",
    requiresReasonOnYes: true,
    genderRestriction: "all",
    acroYesFieldName: "p2_q7_yes",
    acroNoFieldName: "p2_q7_no",
    acroReasonFieldName: "p2_q7_details",
  },
  {
    id: "hospitalization_infection_recovery",
    label:
      "Hospitalized for malaria, typhoid, dengue, gastroenteritis, or dehydration and now normal",
    type: "yes_no",
    section: "Medical history",
    prompt:
      "Have you been hospitalized for malaria, typhoid, dengue, gastroenteritis, or dehydration and are now normal?",
    followUpIfYes: "Please give brief details.",
    reasonPromptLabel: "If yes, please give details",
    matchHints: [
      "malaria typhoid dengue gastroenteritis dehydration",
      "and are now normal",
    ],
    reasonResponseId: "hospitalization_infection_recovery_reason",
    requiresReasonOnYes: true,
    genderRestriction: "all",
    acroYesFieldName: "p2_q8_yes",
    acroNoFieldName: "p2_q8_no",
    acroReasonFieldName: "p2_q8_details",
  },
  {
    id: "other_hospitalization_details",
    label: "Any other hospitalization details",
    type: "yes_no",
    section: "Medical history",
    prompt: "Are there any other hospitalization details you want to furnish?",
    followUpIfYes: "Please give brief details.",
    reasonPromptLabel: "If yes, please give details",
    matchHints: ["other hospitalization details", "want to furnish"],
    reasonResponseId: "other_hospitalization_details_reason",
    requiresReasonOnYes: true,
    genderRestriction: "all",
    acroYesFieldName: "p2_q9_yes",
    acroNoFieldName: "p2_q9_no",
    acroReasonFieldName: "p2_q9_details",
  },
  {
    id: "off_work_illness",
    label:
      "Off work due to illness for more than 10 continuous days in last year",
    type: "yes_no",
    section: "Medical history",
    prompt:
      "Have you been off work due to illness for a continuous period of more than 10 days during the last year?",
    followUpIfYes: "Please give brief details.",
    reasonPromptLabel: "If yes, please give details",
    matchHints: ["off work due to illness", "continuous period of more than 10 days"],
    reasonResponseId: "off_work_illness_reason",
    requiresReasonOnYes: true,
    genderRestriction: "all",
    acroYesFieldName: "p2_q10_yes",
    acroNoFieldName: "p2_q10_no",
    acroReasonFieldName: "p2_q10_details",
  },
  {
    id: "other_disease",
    label: "Any other disease/ailment/habit not mentioned above",
    type: "yes_no",
    section: "Medical history",
    prompt:
      "Have you suffered or are you suffering from any other disease, ailment, or habit not mentioned above?",
    followUpIfYes: "Please give brief details.",
    reasonPromptLabel: "If yes, please give details",
    matchHints: ["other disease ailment habit not mentioned above"],
    reasonResponseId: "other_disease_reason",
    requiresReasonOnYes: true,
    genderRestriction: "all",
    acroYesFieldName: "p2_q11_yes",
    acroNoFieldName: "p2_q11_no",
    acroReasonFieldName: "p2_q11_details",
  },
  {
    id: "travel_outside_india",
    label: "Intend to travel outside India within next 3 months",
    type: "yes_no",
    section: "Travel",
    prompt: "Do you intend to travel outside India within the next 3 months?",
    followUpIfYes: "Where outside India will you travel?",
    reasonPromptLabel: "If yes, please tell me the destination",
    matchHints: [
      "travel outside india within the next 3 months",
      "which country you plan to travel to",
      "which country do you intend to travel to",
    ],
    reasonResponseId: "travel_outside_india_reason",
    requiresReasonOnYes: true,
    genderRestriction: "all",
    acroYesFieldName: "p2_q12_yes",
    acroNoFieldName: "p2_q12_no",
    acroReasonFieldName: "p2_q12_details",
  },
  {
    id: "height_cm",
    label: "Height (in cm)",
    type: "number",
    section: "Physical",
    prompt: "What is your height in centimeters?",
    matchHints: ["height in centimeters", "height in cm"],
    acroFieldName: "p2_field_13",
    genderRestriction: "all",
  },
  {
    id: "weight_kg",
    label: "Weight (in kgs)",
    type: "number",
    section: "Physical",
    prompt: "What is your weight in kilograms?",
    matchHints: ["weight in kilograms", "weight in kgs"],
    acroFieldName: "p2_field_14",
    genderRestriction: "all",
  },
  {
    id: "habits_addictions",
    label:
      "Habits & Addictions (Cig/beedi/cigar; Gutka/Snuff/Paan; Beer/Wine/Hard Liquor; Any Drugs)",
    type: "text",
    section: "Habits",
    prompt:
      "Do you have any habits or addictions such as smoking, chewing tobacco, drinking alcohol, or using any drugs? If none, say none.",
    acroFieldName: "p2_field_15",
    genderRestriction: "all",
  },
  {
    id: "existing_insurance_cover",
    label: "Existing Insurance Cover",
    type: "text",
    section: "Insurance",
    prompt:
      "Do you have any existing insurance cover? If yes, please provide the details. If none, say none.",
    matchHints: ["existing insurance cover", "if none say none"],
    acroFieldName: "p2_field_16",
    genderRestriction: "all",
  },
  {
    id: "all_life_cover",
    label: "ALL LIFE COVER TOGETHER (in numerical value)",
    type: "number",
    section: "Insurance",
    prompt:
      "What is the total value of all your life cover together? Please give the amount in numbers.",
    matchHints: [
      "total value of all your life cover together",
      "life cover together",
      "amount in numbers",
      "life cover in numbers only",
    ],
    acroFieldName: "p2_field_17",
    genderRestriction: "all",
  },
  {
    id: "all_ci_cover",
    label: "ALL CI (Critical Illness Cover)",
    type: "number",
    section: "Insurance",
    prompt:
      "What is the total value of your critical illness cover? If none, say zero.",
    matchHints: [
      "critical illness cover",
      "if none say zero",
      "total value of your critical illness cover",
    ],
    acroFieldName: "p2_field_18",
    genderRestriction: "all",
  },
  {
    id: "declaration",
    label:
      "You hereby declare that the particulars and answers above are complete and true",
    type: "yes_no",
    section: "Declaration",
    prompt:
      "Do you declare that all the particulars and answers you have provided are complete and true? Please answer yes or no.",
    matchHints: [
      "declare complete and true",
      "particulars and answers you have provided are complete and true",
    ],
    genderRestriction: "all",
  },
];

const PRESET_DEMO_KYC_FIELD_IDS = PRESET_DEMO_KYC_FIELDS.map(
  (field) => field.id,
);

const isPresetDemoKycFields = (fields = []) =>
  fields.length === PRESET_DEMO_KYC_FIELD_IDS.length &&
  PRESET_DEMO_KYC_FIELD_IDS.every((id, index) => fields[index]?.id === id);

const PRESET_DEMO_KYC_FIELD_MAPPINGS = [
  {
    fieldId: "application_no",
    type: "text",
    page: 1,
    inputX: 214,
    inputY: 184,
    width: 132,
    height: 12,
    fontSize: 8,
  },
  {
    fieldId: "life_to_be_assured_name",
    type: "text",
    page: 1,
    inputX: 214,
    inputY: 202,
    width: 132,
    height: 12,
    fontSize: 8,
  },
  {
    fieldId: "date_of_birth",
    type: "date",
    page: 1,
    inputX: 214,
    inputY: 220,
    width: 132,
    height: 12,
    fontSize: 8,
  },
  {
    fieldId: "gender",
    type: "text",
    page: 1,
    inputX: 428,
    inputY: 220,
    width: 116,
    height: 12,
    fontSize: 8,
  },
  {
    fieldId: "nominee_name",
    type: "text",
    page: 1,
    inputX: 214,
    inputY: 238,
    width: 132,
    height: 12,
    fontSize: 8,
  },
  {
    fieldId: "nominee_dob",
    type: "date",
    page: 1,
    inputX: 428,
    inputY: 238,
    width: 116,
    height: 12,
    fontSize: 8,
  },
  {
    fieldId: "contact_no",
    type: "text",
    page: 1,
    inputX: 214,
    inputY: 256,
    width: 132,
    height: 12,
    fontSize: 8,
  },
  {
    fieldId: "education_details",
    type: "text",
    page: 1,
    inputX: 428,
    inputY: 307,
    width: 116,
    height: 13,
    fontSize: 7,
  },
  {
    fieldId: "chest_pain_history",
    type: "yes_no",
    page: 1,
    yesX: 350,
    yesY: 392,
    noX: 399,
    noY: 392,
    reasonX: 428,
    reasonY: 383,
    reasonWidth: 116,
    reasonHeight: 24,
    reasonResponseId: "chest_pain_history_reason",
  },
  {
    fieldId: "hypertension",
    type: "yes_no",
    page: 1,
    yesX: 350,
    yesY: 414,
    noX: 399,
    noY: 414,
    reasonX: 428,
    reasonY: 408,
    reasonWidth: 116,
    reasonHeight: 15,
    reasonResponseId: "hypertension_reason",
  },
  {
    fieldId: "diabetes_thyroid",
    type: "yes_no",
    page: 1,
    yesX: 350,
    yesY: 430,
    noX: 399,
    noY: 430,
    reasonX: 428,
    reasonY: 424,
    reasonWidth: 116,
    reasonHeight: 15,
    reasonResponseId: "diabetes_thyroid_reason",
  },
  {
    fieldId: "respiratory",
    type: "yes_no",
    page: 1,
    yesX: 350,
    yesY: 452,
    noX: 399,
    noY: 452,
    reasonX: 428,
    reasonY: 443,
    reasonWidth: 116,
    reasonHeight: 15,
    reasonResponseId: "respiratory_reason",
  },
  {
    fieldId: "blood_disorder",
    type: "yes_no",
    page: 1,
    yesX: 350,
    yesY: 472,
    noX: 399,
    noY: 472,
    reasonX: 428,
    reasonY: 466,
    reasonWidth: 116,
    reasonHeight: 15,
    reasonResponseId: "blood_disorder_reason",
  },
  {
    fieldId: "liver_disorder",
    type: "yes_no",
    page: 1,
    yesX: 350,
    yesY: 493,
    noX: 399,
    noY: 493,
    reasonX: 428,
    reasonY: 484,
    reasonWidth: 116,
    reasonHeight: 15,
    reasonResponseId: "liver_disorder_reason",
  },
  {
    fieldId: "disability_congenital",
    type: "yes_no",
    page: 1,
    yesX: 350,
    yesY: 514,
    noX: 399,
    noY: 514,
    reasonX: 428,
    reasonY: 508,
    reasonWidth: 116,
    reasonHeight: 15,
    reasonResponseId: "disability_congenital_reason",
  },
  {
    fieldId: "cancer_tumour",
    type: "yes_no",
    page: 1,
    yesX: 350,
    yesY: 530,
    noX: 399,
    noY: 530,
    reasonX: 428,
    reasonY: 524,
    reasonWidth: 116,
    reasonHeight: 15,
    reasonResponseId: "cancer_tumour_reason",
  },
  {
    fieldId: "kidney_disease",
    type: "yes_no",
    page: 1,
    yesX: 350,
    yesY: 552,
    noX: 399,
    noY: 552,
    reasonX: 428,
    reasonY: 543,
    reasonWidth: 116,
    reasonHeight: 24,
    reasonResponseId: "kidney_disease_reason",
  },
  {
    fieldId: "epilepsy_nervous",
    type: "yes_no",
    page: 1,
    yesX: 350,
    yesY: 572,
    noX: 399,
    noY: 572,
    reasonX: 428,
    reasonY: 563,
    reasonWidth: 116,
    reasonHeight: 15,
    reasonResponseId: "epilepsy_nervous_reason",
  },
  {
    fieldId: "ent_disorder",
    type: "yes_no",
    page: 1,
    yesX: 350,
    yesY: 598,
    noX: 399,
    noY: 598,
    reasonX: 428,
    reasonY: 592,
    reasonWidth: 116,
    reasonHeight: 15,
    reasonResponseId: "ent_disorder_reason",
  },
  {
    fieldId: "musculoskeletal",
    type: "yes_no",
    page: 1,
    yesX: 350,
    yesY: 614,
    noX: 399,
    noY: 614,
    reasonX: 428,
    reasonY: 608,
    reasonWidth: 116,
    reasonHeight: 15,
    reasonResponseId: "musculoskeletal_reason",
  },
  {
    fieldId: "diagnostic_tests",
    type: "yes_no",
    page: 1,
    yesX: 350,
    yesY: 637,
    noX: 399,
    noY: 637,
    reasonX: 428,
    reasonY: 626,
    reasonWidth: 116,
    reasonHeight: 28,
    reasonResponseId: "diagnostic_tests_reason",
  },
  {
    fieldId: "hiv_std",
    type: "yes_no",
    page: 1,
    yesX: 350,
    yesY: 672,
    noX: 399,
    noY: 672,
    reasonX: 428,
    reasonY: 663,
    reasonWidth: 116,
    reasonHeight: 18,
    reasonResponseId: "hiv_std_reason",
  },
  {
    fieldId: "treatment_medication",
    type: "yes_no",
    page: 1,
    yesX: 350,
    yesY: 702,
    noX: 399,
    noY: 702,
    reasonX: 428,
    reasonY: 690,
    reasonWidth: 116,
    reasonHeight: 28,
    reasonResponseId: "treatment_medication_reason",
  },
  {
    fieldId: "hospitalization_fever_normal",
    skipPdf: true,
    type: "yes_no",
    page: 1,
    yesX: 350,
    yesY: 728,
    noX: 399,
    noY: 728,
    reasonX: 428,
    reasonY: 719,
    reasonWidth: 116,
    reasonHeight: 15,
    reasonResponseId: "hospitalization_fever_normal_reason",
  },
  {
    fieldId: "hospitalization_food_poisoning_normal",
    skipPdf: true,
    type: "yes_no",
    page: 1,
    yesX: 350,
    yesY: 745,
    noX: 399,
    noY: 745,
    reasonX: 428,
    reasonY: 739,
    reasonWidth: 116,
    reasonHeight: 15,
    reasonResponseId: "hospitalization_food_poisoning_normal_reason",
  },
  {
    fieldId: "hospitalization_accident_alright",
    skipPdf: true,
    type: "yes_no",
    page: 1,
    yesX: 350,
    yesY: 762,
    noX: 399,
    noY: 762,
    reasonX: 428,
    reasonY: 756,
    reasonWidth: 116,
    reasonHeight: 15,
    reasonResponseId: "hospitalization_accident_alright_reason",
  },
  {
    fieldId: "hospitalization_common_surgeries",
    skipPdf: true,
    type: "yes_no",
    page: 1,
    yesX: 350,
    yesY: 781,
    noX: 399,
    noY: 781,
    reasonX: 428,
    reasonY: 767,
    reasonWidth: 116,
    reasonHeight: 36,
    reasonResponseId: "hospitalization_common_surgeries_reason",
  },
  {
    fieldId: "hospitalization_infection_recovery",
    skipPdf: true,
    type: "yes_no",
    page: 1,
    yesX: 350,
    yesY: 806,
    noX: 399,
    noY: 806,
    reasonX: 428,
    reasonY: 800,
    reasonWidth: 116,
    reasonHeight: 15,
    reasonResponseId: "hospitalization_infection_recovery_reason",
  },
  {
    fieldId: "other_hospitalization_details",
    skipPdf: true,
    type: "yes_no",
    page: 1,
    yesX: 350,
    yesY: 806,
    noX: 399,
    noY: 806,
    reasonX: 428,
    reasonY: 800,
    reasonWidth: 116,
    reasonHeight: 15,
    reasonResponseId: "other_hospitalization_details_reason",
  },
  {
    fieldId: "off_work_illness",
    type: "yes_no",
    page: 1,
    yesX: 350,
    yesY: 733,
    noX: 399,
    noY: 733,
    reasonX: 428,
    reasonY: 722,
    reasonWidth: 116,
    reasonHeight: 24,
    reasonResponseId: "off_work_illness_reason",
  },
  {
    fieldId: "other_disease",
    type: "yes_no",
    page: 1,
    yesX: 350,
    yesY: 760,
    noX: 399,
    noY: 760,
    reasonX: 428,
    reasonY: 754,
    reasonWidth: 116,
    reasonHeight: 15,
    reasonResponseId: "other_disease_reason",
  },
  {
    fieldId: "travel_outside_india",
    type: "yes_no",
    page: 1,
    yesX: 350,
    yesY: 776,
    noX: 399,
    noY: 776,
    reasonX: 428,
    reasonY: 770,
    reasonWidth: 116,
    reasonHeight: 15,
    reasonResponseId: "travel_outside_india_reason",
  },
  {
    fieldId: "height_cm",
    type: "number",
    page: 2,
    inputX: 428,
    inputY: 62,
    width: 116,
    height: 13,
    fontSize: 8,
  },
  {
    fieldId: "weight_kg",
    type: "number",
    page: 2,
    inputX: 428,
    inputY: 78,
    width: 116,
    height: 13,
    fontSize: 8,
  },
  {
    fieldId: "habits_addictions",
    type: "text",
    page: 2,
    inputX: 428,
    inputY: 96,
    width: 116,
    height: 28,
    fontSize: 7,
  },
  {
    fieldId: "existing_insurance_cover",
    type: "text",
    page: 2,
    inputX: 428,
    inputY: 120,
    width: 116,
    height: 13,
    fontSize: 8,
  },
  {
    fieldId: "all_life_cover",
    type: "number",
    page: 2,
    inputX: 428,
    inputY: 140,
    width: 116,
    height: 20,
    fontSize: 8,
  },
  {
    fieldId: "all_ci_cover",
    type: "number",
    page: 2,
    inputX: 428,
    inputY: 163,
    width: 116,
    height: 13,
    fontSize: 8,
  },
];

const KYC_UNCAPTURED_VALUE = "__KYC_NOT_CAPTURED__";
const KYC_UNCAPTURED_LABEL = "Not captured";

const isUncapturedKycValue = (value) =>
  String(value ?? "").trim() === KYC_UNCAPTURED_VALUE;
const isUncapturedLikeKycValue = (value) =>
  isUncapturedKycValue(value) ||
  String(value ?? "").trim().toLowerCase() === KYC_UNCAPTURED_LABEL.toLowerCase();
const hasMeaningfulKycValue = (value) => String(value ?? "").trim().length > 0;
const hasRecordedKycValue = (value) =>
  hasMeaningfulKycValue(value) || isUncapturedKycValue(value);

const padKycDatePart = (value) => String(value).padStart(2, "0");

const getTodayKycDateForPdf = () => {
  const now = new Date();
  return `${padKycDatePart(now.getDate())}/${padKycDatePart(now.getMonth() + 1)}/${now.getFullYear()}`;
};

const drawPresetAutoDate = (pages, font) => {
  const page = pages?.[0];
  if (!page || !font) return;
  drawMappedPdfText(
    page,
    font,
    getTodayKycDateForPdf(),
    {
      type: "date",
      page: 1,
      inputX: 384,
      inputY: 184,
      width: 120,
      height: 12,
      fontSize: 8,
    },
    page.getHeight(),
  );
};

const formatDateOfBirthForPdf = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const cleaned = normalizeIndicSpeechText(raw)
    .replace(/,/g, " ")
    .replace(/(\d+)(st|nd|rd|th)\b/g, "$1")
    .replace(/\b(date of birth|dob|born on|birth date|my birthday is)\b/g, " ")
    .replace(/\bnineteen\s+six\s+(seventy|eighty|ninety)\b/gi, "nineteen $1")
    .replace(/\s+/g, " ")
    .trim();

  const monthMap = {
    january: 1,
    jan: 1,
    janurary: 1,
    february: 2,
    feb: 2,
    febuary: 2,
    march: 3,
    mar: 3,
    april: 4,
    apr: 4,
    may: 5,
    june: 6,
    jun: 6,
    july: 7,
    jul: 7,
    august: 8,
    aug: 8,
    agust: 8,
    september: 9,
    sep: 9,
    sept: 9,
    septermber: 9,
    septembar: 9,
    septmember: 9,
    setember: 9,
    october: 10,
    oct: 10,
    octuber: 10,
    november: 11,
    nov: 11,
    december: 12,
    dec: 12,
    decemeber: 12,
  };
  const numberWords = {
    zero: 0,
    one: 1,
    first: 1,
    two: 2,
    second: 2,
    three: 3,
    third: 3,
    four: 4,
    for: 4,
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

 const formatDate = (day, month, year) => {
   const y = String(year);
   const fullYear =
     y.length <= 2
       ? parseInt(y) <= 30
         ? `20${y.padStart(2, "0")}`
         : `19${y.padStart(2, "0")}`
       : y;
   return `${padKycDatePart(day)}/${padKycDatePart(month)}/${fullYear}`;
 };

  const parseWordNumber = (tokens) => {
    let total = 0;
    let current = 0;
    let used = false;

    for (const token of tokens) {
      if (token === "and") continue;
      if (numberWords[token] != null) {
        current += numberWords[token];
        used = true;
        continue;
      }
      if (token === "hundred") {
        current = (current || 1) * 100;
        used = true;
        continue;
      }
      if (token === "thousand") {
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
    if (tokens.length === 1 && /^\d{1,2}$/.test(tokens[0]))
      return Number(tokens[0]);
    const parsed = parseWordNumber(tokens);
    return parsed != null && parsed >= 1 && parsed <= 31 ? parsed : null;
  };

  const parseYearTokens = (tokens) => {
    if (!tokens.length || tokens.length > 5) return null;
    if (tokens.length === 1 && /^\d{2,4}$/.test(tokens[0]))
      return Number(tokens[0]);

    const direct = parseWordNumber(tokens);
    if (direct != null && direct >= 1000) return direct;

    if (
      !tokens.includes("thousand") &&
      !tokens.includes("hundred") &&
      tokens.length >= 2
    ) {
      for (let split = 1; split < tokens.length; split += 1) {
        const left = parseWordNumber(tokens.slice(0, split));
        const right = parseWordNumber(tokens.slice(split));
        if (
          left != null &&
          right != null &&
          left >= 10 &&
          left <= 99 &&
          right >= 0 &&
          right <= 99
        ) {
          return left * 100 + right;
        }
      }
    }

    return direct != null && direct >= 100 ? direct : null;
  };

  const directMatch = cleaned.match(
    /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2}|\d{4})$/,
  );
  if (directMatch) {
    const [, day, month, year] = directMatch;
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

  const ofPattern = cleaned.match(
    /^(\d{1,2})(?:st|nd|rd|th)?\s+of\s+([a-z]+)\s+(\d{2}|\d{4})$/,
  );
  if (ofPattern && monthMap[ofPattern[2]]) {
    return formatDate(ofPattern[1], monthMap[ofPattern[2]], ofPattern[3]);
  }

  const tokens = cleaned
    .split(/\s+/)
    .map((token) => token.replace(/[^a-z0-9]/g, ""))
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

  const parsed = /\d/.test(cleaned) ? new Date(cleaned) : null;
  if (parsed && !Number.isNaN(parsed.getTime())) {
    return formatDate(
      parsed.getDate(),
      parsed.getMonth() + 1,
      parsed.getFullYear(),
    );
  }

  return raw;
};

const isReasonableKycDateValue = (value) => {
  const match = String(value || "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return false;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const currentYear = new Date().getFullYear();
  if (day < 1 || day > 31 || month < 1 || month > 12) return false;
  if (year < 1900 || year > currentYear) return false;
  const parsed = new Date(year, month - 1, day);
  return (
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
  );
};

const formatGenderForPdf = (value) => {
  const raw = String(value || "").trim();
  const normalizedValue = normalizeIndicSpeechText(raw)
    .toLowerCase()
    .replace(/[^a-z]/g, "");

  if (
    /\b(male|mail|email|man|boy)\b/i.test(normalizeIndicSpeechText(raw)) ||
    [
      "m",
      "male",
      "mens",
      "men",
      "man",
      "boy",
      "mail",
      "may",
      "email",
      "meal",
      "mael",
      "mela",
      "deal",
      "deel",
      "dill",
      "mill",
      "dale",
    ].includes(normalizedValue)
  )
    return "Male";
  if (
    /\b(female|woman|girl|lady)\b/i.test(normalizeIndicSpeechText(raw)) ||
    [
      "f",
      "female",
      "woman",
      "girl",
      "lady",
      "femail",
      "femal",
      "feemail",
    ].includes(normalizedValue)
  )
    return "Female";
  if (["other", "nonbinary"].includes(normalizedValue)) return "Other";

  return raw
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
};

const formatPhoneForPdf = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const digitWords = {
    zero: "0",
    oh: "0",
    o: "0",
    one: "1",
    won: "1",
    two: "2",
    to: "2",
    too: "2",
    three: "3",
    four: "4",
    for: "4",
    five: "5",
    six: "6",
    seven: "7",
    eight: "8",
    ate: "8",
    nine: "9",
  };
  const fillerTokens = new Set([
    "my",
    "phone",
    "contact",
    "mobile",
    "number",
    "no",
    "is",
    "its",
    "it",
    "this",
    "the",
    "a",
    "an",
    "please",
    "dash",
    "hyphen",
    "space",
  ]);
  const tokens =
    normalizeIndicSpeechText(raw)
      .replace(/[(),.-]/g, " ")
      .match(/\+|[a-z0-9]+/g) || [];

  let digits = "";
  let repeatCount = 1;
  let hasExplicitPlus = raw.startsWith("+");

  for (const token of tokens) {
    if (token === "plus") {
      if (!digits) hasExplicitPlus = true;
      repeatCount = 1;
      continue;
    }

    if (token === "double") {
      repeatCount = 2;
      continue;
    }

    if (token === "triple") {
      repeatCount = 3;
      continue;
    }

    if (fillerTokens.has(token)) {
      repeatCount = 1;
      continue;
    }

    let tokenDigits = "";
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

  const fallbackDigits = raw.replace(/\D/g, "");
  if (fallbackDigits.length > digits.length) {
    digits = fallbackDigits;
  }

  if (!digits) return raw;
  if (digits.length === 10) return hasExplicitPlus ? `+${digits}` : digits;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (hasExplicitPlus) return `+${digits}`;
  if (digits.length > 11 && digits.startsWith("1")) return `+${digits}`;
  return digits;
};

const isPhoneKycField = (field) =>
  field?.id === "contact_no" ||
  String(field?.label || "").toLowerCase().includes("contact");

const getPhoneDigitsForKyc = (value) =>
  String(formatPhoneForPdf(value) || "").replace(/\D/g, "");

const combinePartialKycAnswerText = (field, previousValue, nextText) => {
  const next = String(nextText || "").trim();
  if (isFullNameField(field)) {
    const previousName = formatNameForPdf(previousValue);
    const nextName = formatNameForPdf(next);
    if (!previousName || !looksLikeCompleteFullName(previousName)) return next;
    if (!nextName) return previousName;

    const previousParts = previousName.split(/\s+/).filter(Boolean);
    const nextParts = nextName.split(/\s+/).filter(Boolean);
    const normalizedPreviousParts = new Set(previousParts.map((part) => normalize(part)));
    const nextIsSpelledFragment = /(?:\b[a-z]\b[\s.-]*){2,}/i.test(next);

    if (
      nextIsSpelledFragment ||
      nextParts.length <= 1 ||
      nextParts.every((part) => normalizedPreviousParts.has(normalize(part)))
    ) {
      return previousName;
    }

    return nextParts.length >= previousParts.length ? nextName : previousName;
  }

  if (!isPhoneKycField(field)) return next;

  const previousDigits = getPhoneDigitsForKyc(previousValue);
  if (!previousDigits || previousDigits.length >= 10) return next;

  const nextDigits = getPhoneDigitsForKyc(next);
  if (!nextDigits) return next;
  if (nextDigits.startsWith(previousDigits)) return next;
  return `${previousDigits} ${next}`;
};

const combinePhoneTranscriptAnswer = (previousValue, nextText) => {
  const previousDigits = getPhoneDigitsForKyc(previousValue);
  const nextDigits = getPhoneDigitsForKyc(nextText);
  if (!nextDigits) return previousDigits || "";
  if (!previousDigits) return nextText;
  if (nextDigits.startsWith(previousDigits)) return nextText;
  if (previousDigits.endsWith(nextDigits)) return previousDigits;
  if (previousDigits.length >= 10 && nextDigits.length >= 8) {
    return `${previousDigits.slice(0, 2)} ${nextText}`;
  }
  if (previousDigits.length < 10) return `${previousDigits} ${nextText}`;
  return previousDigits;
};

const getSpelledNameCompact = (input) => {
  const matches = String(input || "").match(/(?:\b[a-z]\b[\s-]*){3,}/gi);
  if (!matches?.length) return "";

  return (
    matches
      .map((part) => part.replace(/[^a-z]/gi, "").toLowerCase())
      .sort((a, b) => b.length - a.length)[0] || ""
  );
};

const getSpelledNameWords = (input) => {
  const raw = String(input || "");
  const normalized = raw
    .replace(/\b(?:space|blank|gap)\b/gi, "|")
    .replace(/\b(?:surname|last name|family name)\b/gi, "|")
    .replace(/[,\n;:/]+/g, "|");
  const groups = normalized
    .split("|")
    .map((group) => {
      const letters = group.match(/\b[a-z]\b/gi);
      return letters?.length >= 2 ? letters.join("").toLowerCase() : "";
    })
    .filter(Boolean);

  return groups.length >= 2 ? groups : [];
};

const splitCompactSpelledName = (compact, previousValue = "") => {
  const compactName = String(compact || "").replace(/[^a-z]/gi, "").toLowerCase();
  if (compactName.length < 8) return compactName;

  const previousParts = String(previousValue || "")
    .trim()
    .split(/\s+/)
    .filter((part) => /^[a-z'.-]+$/i.test(part));
  if (previousParts.length >= 2) {
    const firstLength = previousParts[0].replace(/[^a-z]/gi, "").length;
    if (firstLength >= 2 && compactName.length > firstLength + 2) {
      return `${compactName.slice(0, firstLength)} ${compactName.slice(firstLength)}`;
    }
  }

  const splitAt = Math.min(8, Math.max(3, Math.round(compactName.length * 0.42)));
  if (compactName.length - splitAt < 3) return compactName;
  return `${compactName.slice(0, splitAt)} ${compactName.slice(splitAt)}`;
};

const compactNameLetters = (value = "") =>
  String(value || "").replace(/[^a-z]/gi, "").toLowerCase();

const isSpelledNameSafeCorrection = (previousValue = "", compactCorrection = "") => {
  const previousCompact = compactNameLetters(previousValue);
  const nextCompact = compactNameLetters(compactCorrection);
  if (!previousCompact || !nextCompact) return true;
  if (nextCompact.length < previousCompact.length - 1) return false;
  let mismatches = 0;
  const limit = Math.min(previousCompact.length, nextCompact.length);
  for (let index = 0; index < limit; index += 1) {
    if (previousCompact[index] !== nextCompact[index]) mismatches += 1;
  }
  mismatches += Math.abs(previousCompact.length - nextCompact.length);
  return mismatches === 0;
};

const formatNameForPdf = (value) => {
  let cleaned = String(value ?? "")
    .replace(
      /^(my name is|name is|this is|i am|i'm|mera naam|mera naam hai|naam hai)\s+/i,
      "",
    )
    .replace(/[^\w\s'.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const spelledCompact = getSpelledNameCompact(value);
  const spelledWords = getSpelledNameWords(value);

  if (spelledWords.length >= 2) {
    cleaned = spelledWords.join(" ");
  } else if (spelledCompact && /^[a-z](?:\s+[a-z]){3,}$/i.test(cleaned)) {
    cleaned = splitCompactSpelledName(spelledCompact, cleaned);
  }

  return cleaned
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.replace(/^[.'-]+|[.'-]+$/g, ""))
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
};

const formatKycAnswerForPdf = (field, value) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (isUncapturedKycValue(raw)) return KYC_UNCAPTURED_LABEL;

  if (field?.id === 'application_no' || 
    String(field?.label || '').toLowerCase().includes('application')) {
  const digitWords = {
    zero:'0', one:'1', two:'2', three:'3', four:'4',
    five:'5', six:'6', seven:'7', eight:'8', nine:'9'
  };
  const normalizedRaw = normalizeIndicSpeechText(raw);
  const tokens = normalizedRaw.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean);
  const allDigits = tokens.every(
    t => digitWords[t] !== undefined || /^\d+$/.test(t)
  );
  if (allDigits && tokens.length >= 2) {
    return tokens.map(t => digitWords[t] ?? t).join('');
  }
  const numericValue = formatNumericForPdf(normalizedRaw);
  if (/^\d+$/.test(String(numericValue || "").trim())) return String(numericValue).trim();
  return raw;
}

  if (field?.id === "date_of_birth" || field?.type === "date") {
    return formatDateOfBirthForPdf(raw);
  }

  if (field?.id === "gender") {
    return formatGenderForPdf(raw);
  }

  if (field?.id === "education_details") {
    const normalized = raw
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const educationFixes = new Map([
      ["tenth sale", "Tenth fail"],
      ["10th sale", "10th fail"],
      ["ten sale", "Tenth fail"],
      ["tenth fail", "Tenth fail"],
      ["10th fail", "10th fail"],
      ["failed 10th grade", "Failed 10th grade"],
    ]);
    if (educationFixes.has(normalized)) return educationFixes.get(normalized);
  }

  if (
    isPhoneKycField(field)
  ) {
    return formatPhoneForPdf(raw);
  }

  if (field?.id === "height_cm" || String(field?.label || "").toLowerCase().includes("height")) {
    return formatHeightCmForPdf(raw);
  }

  if (field?.type === "number") {
    return formatNumericForPdf(raw);
  }

  if (
    field?.id === "life_to_be_assured_name" ||
    field?.id === "nominee_name" ||
    String(field?.label || "")
      .toLowerCase()
      .includes("name")
  ) {
    return formatNameForPdf(raw);
  }

  return raw;
};

const normalizeStructuredKycAnswerLocally = (field, text) => {
  const raw = String(text || "").trim();
  if (!raw) return { englishText: "", canonicalYesNo: null, handled: true };

  const canonicalYesNo = isYesNoField(field) ? parseYesNoAnswer(raw) : null;
  if (isYesNoField(field) && canonicalYesNo) {
    return { englishText: canonicalYesNo, canonicalYesNo, handled: true };
  }

  const lowerLabel = String(field?.label || "").toLowerCase();
  const isStructuredField =
    isYesNoField(field) ||
    field?.type === "date" ||
    field?.type === "number" ||
    field?.id === "gender" ||
    field?.id === "contact_no" ||
    lowerLabel.includes("date of birth") ||
    lowerLabel.includes("contact");

  if (!isStructuredField) {
    return { englishText: raw, canonicalYesNo: null, handled: false };
  }

  return {
    englishText: formatKycAnswerForPdf(field, raw),
    canonicalYesNo,
    handled: true,
  };
};

const normalizeCommonReasonForPdf = (value) => {
  const text = String(value || "")
    .replace(/\bi\s*b\s*b\b/gi, "High BP")
    .replace(/\bb\s*p\b/gi, "BP")
    .replace(/\bmera\s+/gi, "my ")
    .replace(/\bteen\s+mahine\s+se\b/gi, "for three months")
    .replace(/\bdo\s+saal\s+(?:pehle|pahle)\b/gi, "two years ago")
    .replace(/\bteen\s+saal\s+(?:pehle|pahle)\b/gi, "three years ago")
    .replace(/\bek\s+saal\s+(?:pehle|pahle)\b/gi, "one year ago")
    .replace(/\bhigh\s+chal\s+raha\s+hai\b/gi, "has been high")
    .replace(/\bhua\s+tha\b/gi, "happened")
    .replace(/\s+/g, " ")
    .trim();
  return text;
};

const extractReasonFromAffirmativeAnswer = (text) => {
  const raw = String(text || "").trim();
  if (!raw) return "";
  const cleanedRaw = normalizeTranscriptEncoding(raw)
    .replace(/\s+/g, " ")
    .replace(/^[\s,.:;-]+|[\s,.:;-]+$/g, "");
  const withoutAffirmative = cleanedRaw.replace(
    /^(?:yes|yeah|yep|ya|true|haan(?:\s+ji)?|han(?:\s+ji)?|ha(?:\s+ji)?|ho|hoy|hoi|si|sÃ­|oui|à¤¹à¤¾à¤|à¤¹à¤¾à¤‚|à¤¹à¤¾|à¤¹à¥‹)(?:$|\b|[\s,.:;-]+)[\s,.:;-]*/iu,
    "",
  ).trim();
  const detailText = withoutAffirmative === cleanedRaw ? cleanedRaw : withoutAffirmative;
  if (!detailText) return "";
  return normalizeCommonReasonForPdf(
    detailText.replace(/^(?:because|due to|reason is|i have|i had|i am having|having|with|suffering from)\b[\s,.:;-]*/i, ""),
  );

  const withoutYesPrefix = raw
    .replace(/^(yes|yeah|yep|haan|ha|ho|hoy|hoi|à¤¹à¥‹|à¤¹à¥‹à¤¯)\b[\s,:-]*/i, "")
    .trim();
  if (!withoutYesPrefix) return "";

  return withoutYesPrefix
    .replace(/^(because|due to|reason is)\b[\s,:-]*/i, "")
    .trim();
};

const isKycFieldAwaitingReason = (field, responses = {}) =>
  Boolean(
    field?.requiresReasonOnYes &&
    responses[field.id] === "Yes" &&
    (!hasRecordedKycValue(responses[field.reasonResponseId]) ||
      (doesKycReasonNeedDuration(field) &&
        !hasDurationPhrase(responses[field.reasonResponseId]))),
  );

const doesKycReasonNeedDuration = (field) =>
  field?.id !== "travel_outside_india";

const getKycReasonFollowUpPrompt = (field, phase = "detail", detail = "") => {
  const cleanDetail = extractReasonFromAffirmativeAnswer(detail);
  if (phase === "duration") {
    if (field?.id === "diagnostic_tests") {
      return cleanDetail
        ? `When did you have ${cleanDetail}?`
        : "When was this test or surgery done or advised?";
    }
    return cleanDetail
      ? `For how long have you had ${cleanDetail}?`
      : "For how long have you had this condition?";
  }
  const label = String(field?.label || field?.prompt || "this condition").trim();
  if (/travel outside india|destination/i.test(label)) {
    return "Where outside India will you travel?";
  }
  if (/cancer|tumou?r|cyst|growth|lymph/i.test(label)) return "Which one?";
  if (/medication|medicine|treatment/i.test(label)) {
    return "Please tell me the reason for medication and name of medicine.";
  }
  if (/hospital/i.test(label)) return "Please tell me the reason for hospitalization.";
  if (/x-ray|ct scan|mri|ecg|blood test|surgery|diagnostic/i.test(label)) {
    return "Please tell me which test or surgery.";
  }
  return "Please tell me the condition or reason.";
};

const dedupeKycReasonText = (value) => {
  const parts = String(value || "")
    .split(/\s*(?:[.;]|\n+)\s*/)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const seen = new Set();
  const exactUniqueParts = parts.filter((part) => {
    const key = normalize(part);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const uniqueParts = exactUniqueParts.filter((part, index) => {
    const key = normalize(part);
    return !exactUniqueParts.some((other, otherIndex) => {
      if (otherIndex === index) return false;
      const otherKey = normalize(other);
      return otherKey.length > key.length && otherKey.includes(key);
    });
  });
  return uniqueParts.join(". ");
};

const combineKycReasonParts = (detail = "", duration = "") => {
  const cleanDetail = extractReasonFromAffirmativeAnswer(detail);
  const cleanDuration = extractReasonFromAffirmativeAnswer(duration).trim();
  const seen = new Set();
  return dedupeKycReasonText([cleanDetail, cleanDuration]
    .filter(Boolean)
    .filter((part) => {
      const key = normalize(part);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(". "));
};

const hasDurationPhrase = (text) => {
  const normalized = normalizeIndicSpeechText(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return false;
  return (
    /\b(ago|pehle|pahle|mahine|months?|saal|years?|din|days?|weeks?|hafte|haftey|childhood)\b/.test(
      normalized,
    ) ||
    /\b(since|from|for)\s+(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|a|an|few|couple)\b/.test(
      normalized,
    )
  );
};

const hasCompleteInlineKycReason = (reason, sourceText = "") =>
  hasMeaningfulKycValue(reason) &&
  (hasDurationPhrase(reason) || hasDurationPhrase(sourceText));

const shouldHoldPendingReasonBeforeAgentJump = (field, pendingReason) => {
  if (!field?.requiresReasonOnYes) return false;
  if (field.id === "travel_outside_india") return true;
  if (field.id === "diagnostic_tests") {
    return false;
  }
  return true;
};

const getBlockingIncompleteReasonFieldBeforePrompt = (
  fields = [],
  responses = {},
  matchedFieldIndex = -1,
) => {
  if (matchedFieldIndex <= 0) return null;
  const startIndex = Math.min(matchedFieldIndex - 1, fields.length - 1);
  for (let index = startIndex; index >= 0; index -= 1) {
    const field = fields[index];
    if (
      field.id === "diagnostic_tests" ||
      !field?.requiresReasonOnYes ||
      shouldSkipFieldForGender(field, responses) ||
      responses[field.id] !== "Yes" ||
      isKycFieldComplete(field, responses)
    ) {
      continue;
    }

    const detail = field.reasonResponseId
      ? responses[field.reasonResponseId]
      : "";
    return {
      field,
      index,
      phase: hasMeaningfulKycValue(detail) ? "duration" : "detail",
      detail: hasMeaningfulKycValue(detail) ? detail : "",
    };
  }
  return null;
};

const shouldResyncAfterMissedRequiredFollowUp = (field, nextField) => {
  if (field?.id !== "travel_outside_india") return false;
  return ["height_cm", "weight_kg", "habits_addictions"].includes(nextField?.id);
};

const isLikelyCurrentYesNoFormPrompt = (text, field) => {
  if (!field || !isYesNoField(field)) return false;
  const normalized = normalizeIndicSpeechText(text)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return false;
  if (!/\b(yes\s+or\s+no|haan\s+ya\s+nahi|haa?n\s+ya\s+na|yes\/no)\b/i.test(normalized)) {
    return false;
  }
  return /[?]|\b(do you|have you|are you|is there|are there|kya|did you|will you)\b/i.test(
    normalized,
  );
};

const stripInlineYesDetailInstruction = (text) =>
  String(text || "")
    .replace(/\s*(?:please\s+)?(?:answer\s+)?yes\s+or\s+no\.?\s*/gi, " ")
    .replace(/\s*if\s+yes[, ]+[^.?!]*(?:[.?!]|$)/gi, " ")
    .replace(/\s*agar\s+h(?:aa|a)n[, ]+[^.?!]*(?:[.?!]|$)/gi, " ")
    .replace(/\s*agar\s+yes[, ]+[^.?!]*(?:[.?!]|$)/gi, " ")
    .replace(/\s*(?:yes|no)\s+(?:boliye|bataiye|bataye)\.?\s*/gi, " ")
    .replace(/\s*(?:à¤…à¤—à¤°|à¤¯à¤¦à¤¿)\s+(?:à¤¹à¤¾à¤|à¤¹à¤¾à¤‚|à¤¹à¤¾)[, ]*[^à¥¤.?!]*(?:[à¥¤.?!]|$)/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

const getHindiTranscriptFallback = (text) => {
  const clean = normalizeTranscriptEncoding(stripInlineYesDetailInstruction(text));
  if (!clean) return "";
  const normalized = normalizeIndicSpeechText(clean)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const yesNo = parseYesNoAnswer(clean);
  if (yesNo === "Yes") return "à¤¹à¤¾à¤";
  if (yesNo === "No") return "à¤¨à¤¹à¥€à¤‚";

  const contains = (...terms) => terms.some((term) => normalized.includes(term));

  if (contains("my name is agent tara", "my name is dr tara", "mera naam agent tara", "mera naam dr tara")) {
    return "à¤¹à¤¾à¤¯, à¤®à¥‡à¤°à¤¾ à¤¨à¤¾à¤® Agent Tara à¤¹à¥ˆà¥¤ à¤šà¤²à¤¿à¤ à¤†à¤ªà¤•à¤¾ à¤®à¥‡à¤¡à¤¿à¤•à¤² à¤šà¥‡à¤•-à¤…à¤ª à¤¶à¥à¤°à¥‚ à¤•à¤°à¤¤à¥‡ à¤¹à¥ˆà¤‚à¥¤ à¤†à¤ªà¤•à¤¾ application number à¤•à¥à¤¯à¤¾ à¤¹à¥ˆ?";
  }
  if (contains("application number")) return "à¤†à¤ªà¤•à¤¾ application number à¤•à¥à¤¯à¤¾ à¤¹à¥ˆ?";
  if (contains("nominee") && contains("date", "birth")) return "Nominee à¤•à¥€ date of birth à¤•à¥à¤¯à¤¾ à¤¹à¥ˆ?";
  if (contains("nominee")) return "Nominee à¤•à¤¾ à¤ªà¥‚à¤°à¤¾ à¤¨à¤¾à¤® à¤•à¥à¤¯à¤¾ à¤¹à¥ˆ?";
  if (contains("full name", "poora naam", "pura naam")) return "à¤†à¤ªà¤•à¤¾ à¤ªà¥‚à¤°à¤¾ à¤¨à¤¾à¤® à¤•à¥à¤¯à¤¾ à¤¹à¥ˆ? à¤•à¥ƒà¤ªà¤¯à¤¾ à¤¸à¤¾à¤«-à¤¸à¤¾à¤« à¤¬à¤¤à¤¾à¤‡à¤à¥¤";
  if (contains("date of birth", "dob")) return "à¤†à¤ªà¤•à¥€ date of birth à¤•à¥à¤¯à¤¾ à¤¹à¥ˆ? à¤¦à¤¿à¤¨, à¤®à¤¹à¥€à¤¨à¤¾ à¤”à¤° à¤¸à¤¾à¤² à¤¬à¤¤à¤¾à¤‡à¤à¥¤";
  if (contains("gender")) return "à¤†à¤ªà¤•à¤¾ gender à¤•à¥à¤¯à¤¾ à¤¹à¥ˆ?";
  if (contains("contact number", "mobile number")) return "à¤†à¤ªà¤•à¤¾ contact number à¤•à¥à¤¯à¤¾ à¤¹à¥ˆ?";
  if (contains("education", "qualification")) return "à¤†à¤ªà¤•à¥€ education details à¤¬à¤¤à¤¾à¤‡à¤à¥¤ à¤†à¤ªà¤•à¥€ highest qualification à¤•à¥à¤¯à¤¾ à¤¹à¥ˆ?";
  if (contains("female specific", "pregnancy")) return "à¤†à¤ª male à¤¹à¥ˆà¤‚, à¤‡à¤¸à¤²à¤¿à¤ female-specific questions skip à¤•à¤° à¤°à¤¹à¥‡ à¤¹à¥ˆà¤‚à¥¤";
  if (contains("chest pain", "heart attack", "palpitations", "breathlessness")) {
    return "à¤•à¥à¤¯à¤¾ à¤†à¤ªà¤•à¥‹ à¤•à¤­à¥€ chest pain, heart attack, palpitations à¤¯à¤¾ à¤šà¤²à¤¤à¥‡ à¤¸à¤®à¤¯ breathlessness à¤¹à¥à¤ˆ à¤¹à¥ˆ? à¤¹à¤¾à¤ à¤¯à¤¾ à¤¨à¤¹à¥€à¤‚?";
  }
  if (contains("hypertension", "high bp", "high cholesterol", "blood pressure")) {
    return "à¤•à¥à¤¯à¤¾ à¤†à¤ªà¤•à¥‹ hypertension, high BP à¤¯à¤¾ high cholesterol à¤•à¥€ problem à¤¹à¥ˆ? à¤¹à¤¾à¤ à¤¯à¤¾ à¤¨à¤¹à¥€à¤‚?";
  }
  if (contains("diabetes", "thyroid", "sugar", "endocrine")) {
    return "à¤•à¥à¤¯à¤¾ à¤†à¤ªà¤•à¥‹ high sugar, diabetes, thyroid à¤¯à¤¾ à¤•à¥‹à¤ˆ endocrine problem à¤¹à¥ˆ? à¤¹à¤¾à¤ à¤¯à¤¾ à¤¨à¤¹à¥€à¤‚?";
  }
  if (contains("asthma", "bronchitis", "wheezing", "breathing")) {
    return "à¤•à¥à¤¯à¤¾ à¤†à¤ªà¤•à¥‹ asthma, bronchitis, wheezing, TB à¤¯à¤¾ breathing problem à¤¹à¥ˆ? à¤¹à¤¾à¤ à¤¯à¤¾ à¤¨à¤¹à¥€à¤‚?";
  }
  if (contains("kab se", "since how long", "how long")) return "à¤•à¤¬ à¤¸à¥‡ à¤¹à¥ˆ?";
  if (contains("which one", "condition", "reason", "detail")) return "à¤•à¥Œà¤¨-à¤¸à¥€ problem à¤¹à¥ˆ? à¤•à¥ƒà¤ªà¤¯à¤¾ condition à¤¯à¤¾ reason à¤¬à¤¤à¤¾à¤‡à¤à¥¤";
  if (contains("carely note", "call has ended")) {
    return "Carely note: à¤•à¥‰à¤² à¤–à¤¤à¥à¤® à¤¹à¥‹ à¤—à¤ˆ à¤¹à¥ˆà¥¤ à¤œà¥‹ fields à¤¬à¤¾à¤•à¥€ à¤°à¤¹ à¤—à¤ˆ à¤¹à¥ˆà¤‚ à¤‰à¤¨à¥à¤¹à¥‡à¤‚ Not captured mark à¤•à¤¿à¤¯à¤¾ à¤—à¤¯à¤¾ à¤¹à¥ˆ à¤¤à¤¾à¤•à¤¿ report review à¤”à¤° download à¤¹à¥‹ à¤¸à¤•à¥‡à¥¤";
  }

  return clean;
};

const normalizeTranscriptDisplayAnswer = (text) => {
  const clean = normalizeTranscriptEncoding(text);
  const normalized = normalizeIndicSpeechText(clean)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (/^(mail|email|meal|mael)$/i.test(clean.trim())) return "Male";
  if (normalized === "graduate kiya hai") return "Graduate";
  return clean;
};

const getFastTranscriptDisplayText = (text, languageCode = "en") => {
  const clean = normalizeTranscriptDisplayAnswer(text);
  if (!clean || languageCode !== "hi") return clean;
  return clean;
};

const needsHindiTranscriptFallback = (value) => {
  const text = String(value || "").trim();
  if (!text) return false;
  if (/[\u0900-\u097F]/.test(text)) return false;
  return /[A-Za-z]/.test(text);
};

const isNoisyTranscriptLine = (role, text) => {
  const clean = normalizeTranscriptEncoding(text);
  const normalized = normalizeIndicSpeechText(clean)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return true;

  const isTranslationPrompt =
    /\b(rewrite|hinglish|text doge|main tayyar|bhej do|simple hinglish|which text|what do you want|convert|translation|translate|carely kyc text)\b/i.test(
      normalized,
    ) ||
    /(कृपया\s+बताएं|कृपया\s+बताइए).*(क्या\s+करना\s+चाहते|कौन.?सा\s+(टेक्स्ट|पाठ)|रूपांतरित|बदलवाना|अनुवाद|हिंदी\s+में)/i.test(
      clean,
    ) ||
    /आप\s+क्या\s+जानना\s+चाहते\s+हैं/i.test(clean);

  if (role === "user") {
    if (isTranslationPrompt) {
      return true;
    }
    if (/^(?:kya\b|\u0915\u094d\u092f\u093e)/i.test(clean) && /(\?|ï¼Ÿ|\u0939\u093e\u0902 \u092f\u093e \u0928\u0939\u0940\u0902|\u0939\u093e\u0901 \u092f\u093e \u0928\u0939\u0940\u0902)/i.test(clean)) {
      return true;
    }
  }

  if (role === "assistant" && isTranslationPrompt) {
    return true;
  }

  if (role === "assistant" && /^(\u0939\u093e\u0901|\u0939\u093e\u0902|\u0928\u0939\u0940\u0902|\u0928\u0939\u0940|yes|no)$/i.test(clean.trim())) {
    return true;
  }

  return false;
};

const collapseTranscriptLines = (lines = []) => {
  const collapsed = [];
  for (const line of lines) {
    if (!line) continue;
    if (collapsed[collapsed.length - 1] === line) continue;
    collapsed.push(line);
  }
  return collapsed;
};

const isYesNoTranscriptText = (text) => Boolean(parseYesNoAnswer(text));

const isYesNoQuestionTranscriptText = (text) => {
  const clean = normalizeTranscriptEncoding(text);
  return /(?:à¤¹à¤¾à¤|à¤¹à¤¾à¤‚)\s+à¤¯à¤¾\s+à¤¨à¤¹à¥€à¤‚|yes\s+or\s+no|haan\s+ya\s+no|haan\s+ya\s+nahi/i.test(clean);
};

const isQuestionTranscriptText = (text) => /[?ï¼Ÿ]|à¤•à¥à¤¯à¤¾|à¤•à¥Œà¤¨|à¤•à¤¬|à¤•à¤¾ à¤¨à¤¾à¤®|date of birth/i.test(
  normalizeTranscriptEncoding(text),
);

const formatTranscriptMessageText = (msg, languageCode = "en") => {
  const lineText = normalizeTranscriptDisplayAnswer(msg?.displayContent || msg?.content || "");
  if (languageCode === "en") {
    return lineText
      .replace(/\s*[\u0900-\u097F][\u0900-\u097F\sà¥¤?]*$/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }
  if (languageCode === "hi") return getFastTranscriptDisplayText(lineText, languageCode);
  return lineText;
};

const buildVisibleTranscriptEntries = (messages = [], languageCode = "en") => {
  const entries = [];

  for (const msg of messages) {
    if (msg?.isHidden || msg?.isSystem) continue;
    const text = formatTranscriptMessageText(msg, languageCode);
    if (!text || isNoisyTranscriptLine(msg.role, text)) continue;

    const previous = entries[entries.length - 1];
    if (previous?.role === msg.role && normalize(previous.text) === normalize(text)) continue;
    entries.push({ role: msg.role, text });
  }

  return entries;
};

const getRecoveredTranscriptValue = (fieldId, messages = []) => {
  const visible = messages.filter((msg) => !msg?.isHidden && !msg?.isSystem);
  const textFor = (msg) => normalizeTranscriptEncoding(msg?.content || msg?.displayContent || "");

  if (fieldId === "application_no") {
    let applicationPromptSeen = false;
    const applicationParts = [];
    for (const msg of visible) {
      const text = textFor(msg);
      if (msg.role === "assistant" && getTranscriptPromptFieldId(text) === "application_no") {
        applicationPromptSeen = true;
        applicationParts.length = 0;
        continue;
      }
      if (applicationPromptSeen && msg.role === "user") {
        applicationParts.push(text);
        const formatted = formatKycAnswerForPdf({ id: "application_no", type: "text" }, applicationParts.join(" "));
        if (/^\d{3,}$/.test(String(formatted || "").trim())) return formatted;
        continue;
      }
      if (applicationPromptSeen && msg.role === "assistant" && applicationParts.length) {
        applicationPromptSeen = false;
      }
    }
  }

  if (fieldId === "contact_no") {
    for (let idx = visible.length - 1; idx >= 0; idx -= 1) {
      const msg = visible[idx];
      if (msg.role !== "user") continue;
      const digits = getPhoneDigitsForKyc(textFor(msg));
      if (digits.length >= 10) return digits.slice(-10);
    }
  }

  if (fieldId === "nominee_dob") {
    let nomineeDobPromptSeen = false;
    const nomineeDobParts = [];
    const tryNomineeDobCandidate = (parts = []) => {
      const candidates = [];
      const joined = parts.filter(Boolean).join(" ").trim();
      if (joined) candidates.push(joined);
      if (parts.length >= 2) {
        candidates.push(`${parts[0] || ""} ${parts[parts.length - 1] || ""}`.trim());
      }
      if (parts.length >= 3) {
        candidates.push(parts.slice(-3).join(" ").trim());
        candidates.push(`${parts[0] || ""} ${parts.slice(-2).join(" ")}`.trim());
      }

      for (const candidate of candidates) {
        if (!candidate) continue;
        const normalizedCandidate = normalizeIndicSpeechText(candidate)
          .replace(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\1\b/gi, "$1")
          .replace(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+\1\s+\2\b/gi, "$1 $2")
          .replace(/\s+/g, " ")
          .trim();
        const formatted = formatDateOfBirthForPdf(normalizedCandidate);
        if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(formatted)) return formatted;
      }
      return "";
    };
    for (const msg of visible) {
      const text = textFor(msg);
      if (msg.role === "assistant" && /nominee/i.test(text) && /date|birth|dob/i.test(text)) {
        nomineeDobPromptSeen = true;
        nomineeDobParts.length = 0;
        continue;
      }
      if (nomineeDobPromptSeen && msg.role === "user") {
        nomineeDobParts.push(text);
        const formatted = tryNomineeDobCandidate(nomineeDobParts);
        if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(formatted)) return formatted;
        continue;
      }
      if (nomineeDobPromptSeen && msg.role === "assistant" && nomineeDobParts.length) {
        nomineeDobPromptSeen = false;
      }
    }
  }

  return "";
};

const getTranscriptPromptFieldId = (text) => {
  const raw = normalizeTranscriptEncoding(text).toLowerCase();
  const normalized = normalizeIndicSpeechText(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const compact = normalized.replace(/\s+/g, "");

  if (!normalized) return null;
  const hasRaw = (pattern) => pattern.test(raw);
  if (
    normalized.includes("critical illness") ||
    normalized.includes(" ci cover") ||
    (normalized.includes("ci") && normalized.includes("cover"))
  ) return "all_ci_cover";
  if (normalized.includes("habits") || normalized.includes("addictions") || normalized.includes("smoking") || normalized.includes("tobacco") || normalized.includes("alcohol") || normalized.includes("drugs")) {
    return "habits_addictions";
  }
  if (
    normalized.includes("existing insurance") ||
    normalized.includes("existing cover") ||
    normalized.includes("insurance cover") ||
    compact.includes("existinginsurancecover")
  ) return "existing_insurance_cover";
  if (normalized.includes("life cover")) return "all_life_cover";
  if (normalized.includes("weight") || normalized.includes("kilograms") || normalized.includes("kgs")) return "weight_kg";
  if (normalized.includes("contact number") || normalized.includes("mobile number") || hasRaw(/à¤¸à¤‚à¤ªà¤°à¥à¤•|à¤®à¥‹à¤¬à¤¾à¤‡à¤²|à¤«à¥‹à¤¨/)) return "contact_no";
  if (normalized.includes("application number") || hasRaw(/application number|à¤†à¤µà¥‡à¤¦à¤¨|à¤à¤ªà¥à¤²à¤¿à¤•à¥‡à¤¶à¤¨/)) return "application_no";
  if (normalized.includes("gender") || hasRaw(/à¤²à¤¿à¤‚à¤—/)) return "gender";
  if (
    (normalized.includes("nominee") && normalized.includes("date") && normalized.includes("birth")) ||
    hasRaw(/à¤¨à¤¾à¤®à¤¿à¤¤.*(à¤œà¤¨à¥à¤®|à¤¤à¤¿à¤¥à¤¿)|nominee.*(dob|date of birth)/i)
  ) {
    return "nominee_dob";
  }
  if ((normalized.includes("nominee") && (normalized.includes("name") || normalized.includes("naam"))) || hasRaw(/à¤¨à¤¾à¤®à¤¿à¤¤.*(à¤¨à¤¾à¤®|à¤µà¥à¤¯à¤•à¥à¤¤à¤¿)/)) {
    return "nominee_name";
  }
  if (/à¤ªà¥‚à¤°à¤¾\s+à¤¨à¤¾à¤®|à¤¨à¤¾à¤® à¤•à¥à¤¯à¤¾/.test(raw) || normalized.includes("full name") || normalized.includes("poora naam") || normalized.includes("pura naam")) {
    return "life_to_be_assured_name";
  }
  if (normalized.includes("date of birth") || normalized.includes("dob") || hasRaw(/à¤œà¤¨à¥à¤®.*(à¤¤à¤¿à¤¥à¤¿|à¤¦à¤¿à¤¨|à¤®à¤¹à¥€à¤¨à¤¾|à¤µà¤°à¥à¤·)|à¤œà¤¨à¥à¤®à¤¤à¤¿à¤¥à¤¿/)) return "date_of_birth";
  if (normalized.includes("education") || normalized.includes("qualification") || hasRaw(/à¤¶à¤¿à¤•à¥à¤·à¤¾|à¤¯à¥‹à¤—à¥à¤¯à¤¤à¤¾/)) return "education_details";
  if (normalized.includes("pregnant") || normalized.includes("pregnancy")) {
    return "pregnant";
  }
  if (
    normalized.includes("mammogram") ||
    normalized.includes("pap smear") ||
    (normalized.includes("ultrasound") && !normalized.includes("pregnancy"))
  ) {
    return "women_tests";
  }
  if (normalized.includes("test results normal") || normalized.includes("result normal")) {
    return "women_tests_results_normal";
  }
  if (normalized.includes("ultrasound") && normalized.includes("pregnancy")) {
    return "ultrasound_pregnancy";
  }
  if (normalized.includes("chest pain") || normalized.includes("heart attack") || normalized.includes("palpitations") || normalized.includes("breathlessness")) {
    return "chest_pain_history";
  }
  if (normalized.includes("hypertension") || normalized.includes("high bp") || normalized.includes("blood pressure") || normalized.includes("high cholesterol")) {
    return "hypertension";
  }
  if (normalized.includes("diabetes") || normalized.includes("thyroid") || normalized.includes("high sugar") || normalized.includes("high blood sugar") || normalized.includes("endocrine")) {
    return "diabetes_thyroid";
  }
  if (normalized.includes("asthma") || normalized.includes("bronchitis") || normalized.includes("wheezing") || normalized.includes("breathing problem") || normalized.includes("breathing difficulties") || normalized.includes("tuberculosis")) {
    return "respiratory";
  }
  if (normalized.includes("blood disorder") || normalized.includes("anemia") || normalized.includes("leukemia") || normalized.includes("circulation disorder") || normalized.includes("circulatory disorder")) {
    return "blood_disorder";
  }
  if (normalized.includes("liver") || normalized.includes("cirrhosis") || normalized.includes("hepatitis") || normalized.includes("jaundice") || normalized.includes("stomach")) {
    return "liver_disorder";
  }
  if (normalized.includes("physical") && normalized.includes("mental") || normalized.includes("congenital")) {
    return "disability_congenital";
  }
  if (normalized.includes("cancer") || normalized.includes("tumour") || normalized.includes("tumor") || normalized.includes("cyst") || normalized.includes("lymph")) {
    return "cancer_tumour";
  }
  if (normalized.includes("kidney") || normalized.includes("kidney related") || normalized.includes("stones") || normalized.includes("prostate") || normalized.includes("urine")) {
    return "kidney_disease";
  }
  if (normalized.includes("epilepsy") || normalized.includes("nervous") || normalized.includes("tremors") || normalized.includes("paralysis") || normalized.includes("psychiatric")) {
    return "epilepsy_nervous";
  }
  if (/\b(eye|ear|nose|throat)\b/.test(normalized)) {
    return "ent_disorder";
  }
  if (/\b(back|muscle|joint|joints|bone|neck|arthritis|gout)\b/.test(normalized)) {
    return "musculoskeletal";
  }
  if (normalized.includes("hiv") || normalized.includes("aids") || normalized.includes("sexually transmitted")) {
    return "hiv_std";
  }
  if (normalized.includes("fever") && normalized.includes("hospital")) return "hospitalization_fever_normal";
  if (normalized.includes("food poisoning")) return "hospitalization_food_poisoning_normal";
  if (normalized.includes("accident")) return "hospitalization_accident_alright";
  if (
    normalized.includes("c section") ||
    normalized.includes("stone removal") ||
    normalized.includes("appendicectomy") ||
    normalized.includes("hernia") ||
    normalized.includes("piles")
  ) {
    return "hospitalization_common_surgeries";
  }
  if (
    normalized.includes("malaria") ||
    normalized.includes("typhoid") ||
    normalized.includes("dengue") ||
    normalized.includes("gastroenteritis") ||
    normalized.includes("dehydration")
  ) {
    return "hospitalization_infection_recovery";
  }
  if (
    normalized.includes("other hospitalization") ||
    normalized.includes("hospitalization details") ||
    normalized.includes("want to furnish") ||
    compact.includes("otherhospitalization") ||
    compact.includes("hospitalizationdetails")
  ) return "other_hospitalization_details";
  if (
    normalized.includes("off work") ||
    normalized.includes("10 days") ||
    normalized.includes("continuous period") ||
    (normalized.includes("illness") && normalized.includes("last year"))
  ) return "off_work_illness";
  if (
    normalized.includes("other disease") ||
    normalized.includes("ailment") ||
    normalized.includes("habit not mentioned")
  ) return "other_disease";
  if (
    (normalized.includes("travel") && normalized.includes("india")) ||
    normalized.includes("country you plan to travel") ||
    normalized.includes("country name again")
  ) return "travel_outside_india";
  if (normalized.includes("height") || normalized.includes("centimeters")) return "height_cm";
  if (normalized.includes("treatment") || normalized.includes("medicine") || normalized.includes("medication") || normalized.includes("hospitalized") || normalized.includes("undergone surgery")) {
    return "treatment_medication";
  }
  if (normalized.includes("x ray") || normalized.includes("ct scan") || normalized.includes("mri") || normalized.includes("ecg") || normalized.includes("tmt") || normalized.includes("blood test") || normalized.includes("diagnostic test")) {
    return "diagnostic_tests";
  }
  if (
    normalized.includes("total value of all your life cover") ||
    normalized.includes("life cover together")
  ) return "all_life_cover";
  if (
    normalized.includes("declare") ||
    normalized.includes("complete and true") ||
    normalized.includes("particulars and answers")
  ) return "declaration";
  if (normalized.includes("declare") || normalized.includes("complete and true")) return "declaration";

  return null;
};

const cleanRecoveredTranscriptAnswer = (fieldId, text) => {
  const clean = normalizeTranscriptEncoding(text).trim();
  if (!clean) return "";

  if (fieldId === "application_no") {
    const formatted = formatKycAnswerForPdf({ id: "application_no", type: "text" }, clean);
    return /^\d{2,}$/.test(String(formatted || "").trim()) ? formatted : "";
  }
  if (fieldId === "date_of_birth") {
    const formattedDate = formatDateOfBirthForPdf(clean);
    return isReasonableKycDateValue(formattedDate) ? formattedDate : "";
  }
  if (fieldId === "nominee_dob") {
    const formattedDate = formatDateOfBirthForPdf(clean.replace(/^and\s+september\b/i, "ninth september"));
    return isReasonableKycDateValue(formattedDate) ? formattedDate : "";
  }
  if (fieldId === "gender") {
    return formatGenderForPdf(clean);
  }
  if (fieldId === "contact_no") {
    const digits = getPhoneDigitsForKyc(clean);
    return digits.length >= 10 ? digits.slice(-10) : "";
  }
  if (fieldId === "education_details") {
    if (isUnsafeKycPdfText(clean)) return "";
    return formatKycAnswerForPdf({ id: "education_details", type: "text" }, clean);
  }
  if (fieldId === "height_cm") {
    const height = formatKycAnswerForPdf({ id: "height_cm", type: "number" }, clean);
    const numericHeight = Number(height);
    return /^\d+(\.\d+)?$/.test(String(height)) && numericHeight >= 100 && numericHeight <= 250
      ? height
      : "";
  }
  if (fieldId === "weight_kg") {
    const weight = formatKycAnswerForPdf({ id: "weight_kg", type: "number" }, clean);
    const numericWeight = Number(weight);
    return /^\d+(\.\d+)?$/.test(String(weight)) && numericWeight > 0 && numericWeight < 300
      ? weight
      : "";
  }
  if (fieldId === "all_life_cover" || fieldId === "all_ci_cover") {
    const formatted = formatKycAnswerForPdf({ id: fieldId, type: "number" }, clean);
    return /^\d+(\.\d+)?$/.test(String(formatted || "").trim()) ? formatted : "";
  }
  if (fieldId === "habits_addictions" || fieldId === "existing_insurance_cover") {
    const normalized = normalizeIndicSpeechText(clean).toLowerCase().trim();
    if (isUnsafeKycPdfText(clean)) return "";
    if (/^(none|no|not|nil|nothing|nahi|nahin|no cover|not applicable)$/i.test(normalized)) {
      return "No";
    }
    if (
      fieldId === "habits_addictions" &&
      hasDurationPhrase(normalized) &&
      !hasHabitKeyword(normalized)
    ) {
      return clean;
    }
    if (fieldId === "habits_addictions" && !hasHabitKeyword(normalized) && !hasDurationPhrase(normalized)) {
      return "";
    }
    return clean;
  }
  if (fieldId === "life_to_be_assured_name" || fieldId === "nominee_name") {
    const formattedName = formatNameForPdf(clean);
    const normalizedName = normalize(formattedName);
    if (
      isUnsafeKycPdfText(clean) ||
      isLikelyNumberOnlySpeech(clean) ||
      !looksLikeValidKycName(formattedName) ||
      /^(top|bill|mail|male|female|other|yes|no|one|two|three|four|five|six|seven|eight|nine|zero|night|now|so|the|t|the t|the dish|dish)$/.test(
        normalizedName,
      ) ||
      /\b(the t|the dish)\b/.test(normalizedName)
    ) {
      return "";
    }
    return formattedName;
  }

  return clean;
};

const mergeRecoveredNamePart = (previous, next) => {
  const prev = formatNameForPdf(previous);
  const current = formatNameForPdf(next);
  if (isLikelyNumberOnlySpeech(next)) return prev;
  if (!prev) return current;
  if (!current) return prev;
  const prevParts = prev.split(/\s+/).filter(Boolean);
  const currentParts = current.split(/\s+/).filter(Boolean);
  const normalizedCurrent = normalize(current);
  const spelledCompact = getSpelledNameCompact(next);
  if (
    isUnsafeKycPdfText(current) ||
    /^(so|the|the t|the dish|dish|top|bill|mail|male|female|yes|no|night|now)$/.test(
      normalizedCurrent,
    ) ||
    /\b(the t|the dish)\b/.test(normalizedCurrent)
  ) {
    return prev;
  }
  if (spelledCompact) {
    const fixedSpelled = formatNameForPdf(spelledCompact);
    const fixedParts = fixedSpelled.split(/\s+/).filter(Boolean);
    const normalizedPrevParts = prevParts.map((part) => normalize(part));
    const normalizedFixedParts = fixedParts.map((part) => normalize(part));
    if (fixedParts.length >= 2) return fixedSpelled;
    if (
      fixedParts.length === 1 &&
      prevParts.length >= 2 &&
      !normalizedPrevParts.includes(normalizedFixedParts[0])
    ) {
      return [...prevParts.slice(0, -1), fixedParts[0]].join(" ");
    }
    return prev;
  }
  const normalizedPrevParts = prevParts.map((part) => normalize(part));
  const normalizedCurrentParts = currentParts.map((part) => normalize(part));
  if (
    prevParts.length === currentParts.length &&
    prevParts.length >= 2 &&
    normalizedPrevParts[0] === normalizedCurrentParts[0] &&
    normalizedPrevParts.some((part, index) => part !== normalizedCurrentParts[index])
  ) {
    return current;
  }
  if (prevParts.length >= 2 && currentParts.length <= prevParts.length) {
    return prev;
  }
  if (currentParts.length === 1 && prevParts.length >= 1) {
    return [...prevParts.slice(0, -1), currentParts[0]].join(" ");
  }
  return currentParts.length >= prevParts.length ? current : prev;
};

const getForwardUserTranscriptCandidates = (
  messages,
  assistantIndex,
  maxUserMessages = 4,
) => {
  const candidates = [];
  if (!Array.isArray(messages)) return candidates;
  for (let look = assistantIndex + 1; look < messages.length; look += 1) {
    const candidate = messages[look];
    if (!candidate || candidate?.isHidden || candidate?.isSystem) continue;
    if (candidate.role === "assistant") break;
    if (candidate.role !== "user") continue;
    const text = normalizeTranscriptEncoding(
      candidate.content || candidate.displayContent || "",
    ).trim();
    if (!text || isNoisyTranscriptLine("user", text)) continue;
    candidates.push(text);
    if (candidates.length >= maxUserMessages) break;
  }
  return candidates;
};

const KYC_REASON_FIELD_IDS = new Set(
  PRESET_DEMO_KYC_FIELDS.filter((field) => field.requiresReasonOnYes).map(
    (field) => field.id,
  ),
);

const isReasonKycFieldId = (fieldId) => KYC_REASON_FIELD_IDS.has(fieldId);

const getPresetKycFieldById = (fieldId) =>
  PRESET_DEMO_KYC_FIELDS.find((field) => field.id === fieldId) || null;

const isLikelyTravelDestinationText = (text) => {
  const normalized = normalizeIndicSpeechText(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized || parseYesNoAnswer(normalized)) return false;
  if (/^(what|where|sorry|pardon|hello|hi|ok|okay|fine|thank|thanks|please)$/.test(normalized)) {
    return false;
  }
  if (hasHabitKeyword(normalized) || hasDurationPhrase(normalized)) {
    return false;
  }
  if (
    /\b(height|weight|centimeters?|cms?|kgs?|kilograms?|graduate|education|contact|number|phone|lakh|lakhs?|lacs?|crore|crores?|million|policy|cover|insurance|habit|addiction|none|nil|zero|declare|true|complete)\b/.test(
      normalized,
    )
  ) {
    return false;
  }
  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (!tokens.length) return false;
  if (
    tokens.every((token) =>
      /^(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|\d+)$/.test(
        token,
      ),
    )
  ) {
    return false;
  }
  if (
    tokens.length === 1 &&
    tokens[0].length < 3 &&
    !["uk", "us", "uae"].includes(tokens[0])
  ) {
    return false;
  }
  return /[a-z]/.test(normalized);
};

const isDurationOnlyKycReason = (fieldId, text) => {
  const normalized = normalizeIndicSpeechText(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized || !hasDurationPhrase(normalized)) return false;
  return !isLikelyRelevantImplicitYes(
    { ...(getPresetKycFieldById(fieldId) || {}), id: fieldId, requiresReasonOnYes: true },
    normalized,
  );
};

const isLikelyNonReasonAnswerForField = (fieldId, text) => {
  if (isUnsafeKycPdfText(text)) return true;
  const normalized = normalizeIndicSpeechText(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return true;
  if (/^(let|for|past|since|from|yes|no|okay|ok|fine|thank|thanks|please|condition|reason|details?)$/.test(normalized)) {
    return true;
  }
  if (
    normalized.split(/\s+/).length <= 2 &&
    !hasDurationPhrase(normalized) &&
    !isLikelyRelevantImplicitYes({ id: fieldId, requiresReasonOnYes: true }, normalized)
  ) {
    return true;
  }
  if (
    /^(zero|one|two|three|four|five|six|seven|eight|nine|ten|\d+)(\s+\d+)?$/.test(normalized) &&
    !/\b(months?|years?|days?|weeks?|mahine|saal|hafte|din)\b/.test(normalized)
  ) {
    return true;
  }
  if (
    /\b(eighty|seventy|lakhs?|lacs?|crores?|thousand|million|height|weight|centimeters?|kgs?|kilograms?)\b/.test(
      normalized,
    )
  ) {
    return true;
  }
  if (
    ["height_cm", "weight_kg", "all_life_cover", "all_ci_cover", "declaration"].includes(
      fieldId,
    )
  ) {
    return true;
  }
  return false;
};

const sanitizeKycReasonForField = (fieldId, value) => {
  const raw = extractReasonFromAffirmativeAnswer(value);
  if (!raw || isUncapturedLikeKycValue(raw)) return "";
  if (fieldId === "travel_outside_india") {
    const cleanedTravel = normalizeCommonReasonForPdf(raw)
      .replace(/\s+/g, " ")
      .trim();
    if (
      !cleanedTravel ||
      parseYesNoAnswer(cleanedTravel) ||
      isLikelyNonReasonAnswerForField(fieldId, cleanedTravel) ||
      !isLikelyTravelDestinationText(cleanedTravel)
    ) {
      return "";
    }
    return cleanedTravel;
  }
  const parts = raw
    .split(/\s*,\s*/)
    .map((part) =>
      part
        .replace(/\b(for|since|from|past)$/i, "")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean)
    .filter((part) => !isLikelyNonReasonAnswerForField(fieldId, part));
  const hasConditionPart = parts.some((part) => !isDurationOnlyKycReason(fieldId, part));
  const seen = new Set();
  const uniqueParts = parts.filter((part) => {
    if (isDurationOnlyKycReason(fieldId, part) && !hasConditionPart) return false;
    if (
      fieldId === "habits_addictions" &&
      !hasHabitKeyword(part) &&
      !hasDurationPhrase(part)
    ) {
      return false;
    }
    if (
      !isDurationOnlyKycReason(fieldId, part) &&
      !isLikelyRelevantImplicitYes(
        { ...(getPresetKycFieldById(fieldId) || {}), id: fieldId, requiresReasonOnYes: true },
        part,
      )
    ) {
      return false;
    }
    const key = normalize(part);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return dedupeKycReasonText(uniqueParts.slice(0, 2).join(". "));
};

const sanitizeKycReasonDuration = (value) => {
  const cleaned = normalizeCommonReasonForPdf(
    extractReasonFromAffirmativeAnswer(value),
  )
    .replace(/\s+/g, " ")
    .trim();
  return hasDurationPhrase(cleaned) ? cleaned : "";
};

const isLikelyPartialDurationFragment = (value) => {
  const normalized = normalizeIndicSpeechText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return false;
  return (
    /^(?:for|from|since|past)$/.test(normalized) ||
    /^(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\d+)$/.test(normalized) ||
    /^(?:days?|weeks?|months?|years?|din|hafte|mahine|saal)$/.test(normalized) ||
    /^(?:(?:for|from|since)\s+)?(?:past\s+)?(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\d+)$/.test(normalized) ||
    /^(?:past\s+)?(?:days?|weeks?|months?|years?|din|hafte|mahine|saal)$/.test(normalized)
  );
};

const getTrailingDurationFragment = (value) => {
  const normalized = normalizeIndicSpeechText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const match = normalized.match(/\b((?:for|from|since)\s+past|(?:for|from|since|past))$/);
  return match?.[1] || "";
};

const extractDiagnosticDetailFromTimingPrompt = (value) => {
  const text = normalizeTranscriptEncoding(value);
  const match = text.match(/\bwhen\s+(?:was|were)\s+(?:the\s+)?(.+?)\s+(?:done|advised|done\s+or\s+advised)\b/i);
  if (!match?.[1]) return "";
  return normalizeCommonReasonForPdf(match[1])
    .replace(/\s+/g, " ")
    .trim();
};

const isAcknowledgedNextKycPrompt = (text) => {
  const normalized = normalizeIndicSpeechText(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return /^(understood|thanks|thank you|alright|okay|ok|noted|got it)\b/.test(
    normalized,
  );
};

const recoverKycResponsesFromTranscript = (messages = []) => {
  const recovered = {};
  let currentFieldId = null;
  let pendingYesNoFieldId = null;
  let pendingReasonFieldId = null;
  let pendingTranscriptConfirmation = null;
  const recentUserTexts = [];

  for (const msg of messages) {
    if (msg?.isHidden || msg?.isSystem) continue;
    const text = normalizeTranscriptEncoding(msg.content || msg.displayContent || "");
    if (!text || isNoisyTranscriptLine(msg.role, text)) continue;

    if (msg.role === "assistant") {
      const normalizedAssistant = normalizeIndicSpeechText(text)
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (normalizedAssistant.includes("height")) {
        const numericMatch = normalizedAssistant.match(/\b(\d{2,3})\b/);
        const value = numericMatch ? formatHeightCmForPdf(numericMatch[1]) : formatHeightCmForPdf(normalizedAssistant);
        if (value && Number(value) >= 100) recovered.height_cm = value;
      }
      if (normalizedAssistant.includes("weight")) {
        const numericMatch = normalizedAssistant.match(/\b(\d{2,3})\b/);
        const value = numericMatch ? formatNumericForPdf(numericMatch[1]) : formatNumericForPdf(normalizedAssistant);
        if (value && Number(value) > 0 && Number(value) < 300) recovered.weight_kg = value;
      }
      if (normalizedAssistant.includes("weight") && normalizedAssistant.includes("habit")) {
        currentFieldId = "habits_addictions";
      }
      const clarifiedGender = inferConfirmedClarificationAnswer(
        { id: "gender" },
        text,
      );
      if (currentFieldId === "gender" && hasMeaningfulKycValue(clarifiedGender)) {
        pendingTranscriptConfirmation = {
          fieldId: "gender",
          value: clarifiedGender,
        };
      }
      if (normalizedAssistant.includes("life cover")) {
        const lakhMatch = normalizedAssistant.match(/\b(\d+)\s+lakhs?\b/);
        const value = lakhMatch ? String(Number(lakhMatch[1]) * 100000) : formatNumericForPdf(normalizedAssistant);
        if (value && Number(value) > 0) recovered.all_life_cover = value;
      }
      if (normalizedAssistant.includes("critical illness") || normalizedAssistant.includes("ci cover")) {
        const lakhMatch = normalizedAssistant.match(/\b(\d+)\s+lakhs?\b/);
        const value = lakhMatch ? String(Number(lakhMatch[1]) * 100000) : formatNumericForPdf(normalizedAssistant);
        if (value && Number(value) >= 0) recovered.all_ci_cover = value;
      }
      const promptedFieldId = getTranscriptPromptFieldId(text);
      if (promptedFieldId) {
        if (
          currentFieldId &&
          promptedFieldId !== currentFieldId &&
          isReasonKycFieldId(currentFieldId) &&
          !hasRecordedKycValue(recovered[currentFieldId]) &&
          !pendingReasonFieldId &&
          isAcknowledgedNextKycPrompt(text)
        ) {
          recovered[currentFieldId] = "No";
        }
        if (promptedFieldId !== pendingReasonFieldId) {
          pendingReasonFieldId = null;
        }
        currentFieldId = promptedFieldId;
        if (isReasonKycFieldId(promptedFieldId)) {
          pendingYesNoFieldId = promptedFieldId;
          if (isReasonFollowUpText(text)) {
            pendingReasonFieldId = promptedFieldId;
          }
        } else {
          pendingYesNoFieldId = null;
        }
      } else if (isReasonFollowUpText(text)) {
        pendingReasonFieldId = pendingReasonFieldId || pendingYesNoFieldId;
      }
      continue;
    }

    if (msg.role !== "user") continue;
    recentUserTexts.push(text);
    if (recentUserTexts.length > 6) recentUserTexts.shift();

    if (pendingTranscriptConfirmation) {
      const confirmation = parseYesNoAnswer(text);
      if (confirmation === "Yes") {
        recovered[pendingTranscriptConfirmation.fieldId] =
          pendingTranscriptConfirmation.value;
        pendingTranscriptConfirmation = null;
        continue;
      }
      if (confirmation === "No") {
        pendingTranscriptConfirmation = null;
        continue;
      }
    }

    if (pendingReasonFieldId) {
      const reason = extractReasonFromAffirmativeAnswer(text);
      const existingReason = recovered[`${pendingReasonFieldId}_reason`];
      if (
        hasMeaningfulKycValue(reason) &&
        !isYesNoTranscriptText(reason) &&
        !isLikelyNonReasonAnswerForField(pendingReasonFieldId, reason) &&
        !(isDurationOnlyKycReason(pendingReasonFieldId, reason) && !hasMeaningfulKycValue(existingReason))
      ) {
        recovered[`${pendingReasonFieldId}_reason`] = combineKycReasonParts(
          existingReason,
          reason,
        );
        if (hasDurationPhrase(reason)) {
          currentFieldId = null;
          pendingReasonFieldId = null;
          pendingYesNoFieldId = null;
        }
      }
      continue;
    }

    if (currentFieldId && isReasonKycFieldId(currentFieldId)) {
      const yesNo = parseYesNoAnswer(text);
      if (yesNo) {
        if (
          recovered[currentFieldId] === "Yes" &&
          hasMeaningfulKycValue(recovered[`${currentFieldId}_reason`])
        ) {
          currentFieldId = null;
          pendingReasonFieldId = null;
          pendingYesNoFieldId = null;
          continue;
        }
        recovered[currentFieldId] = yesNo;
        if (yesNo === "Yes") {
          pendingReasonFieldId = currentFieldId;
        } else {
          pendingReasonFieldId = null;
        }
        continue;
      }
      const implicitReason = extractReasonFromAffirmativeAnswer(text);
      if (
        hasMeaningfulKycValue(implicitReason) &&
        !isLikelyNonReasonAnswerForField(currentFieldId, implicitReason) &&
        !(isDurationOnlyKycReason(currentFieldId, implicitReason) && !hasMeaningfulKycValue(recovered[`${currentFieldId}_reason`]))
      ) {
        recovered[currentFieldId] = "Yes";
        recovered[`${currentFieldId}_reason`] = combineKycReasonParts(
          recovered[`${currentFieldId}_reason`],
          implicitReason,
        );
        if (hasDurationPhrase(implicitReason)) {
          pendingReasonFieldId = null;
          currentFieldId = null;
        } else {
          pendingReasonFieldId = currentFieldId;
        }
      }
      continue;
    }

    if (currentFieldId) {
      if (currentFieldId === "habits_addictions") {
        const yesNo = parseYesNoAnswer(text);
        if (yesNo === "No") {
          recovered.habits_addictions = "No";
          continue;
        }
        if (yesNo === "Yes") {
          continue;
        }
        const cleanHabit = cleanRecoveredTranscriptAnswer(currentFieldId, text);
        const safeHabit = cleanHabitAnswerForPdf(cleanHabit);
        if (!hasMeaningfulKycValue(safeHabit)) continue;
        if (
          hasDurationPhrase(safeHabit) &&
          hasMeaningfulKycValue(recovered.habits_addictions) &&
          hasHabitKeyword(recovered.habits_addictions)
        ) {
          recovered.habits_addictions = combineKycReasonParts(
            recovered.habits_addictions,
            safeHabit,
          );
        } else if (!hasDurationPhrase(safeHabit) && hasHabitKeyword(safeHabit)) {
          recovered.habits_addictions = safeHabit;
        }
        continue;
      }

      const value = cleanRecoveredTranscriptAnswer(currentFieldId, text);
      if (!hasMeaningfulKycValue(value)) continue;

      if (currentFieldId === "life_to_be_assured_name" || currentFieldId === "nominee_name") {
        recovered[currentFieldId] = mergeRecoveredNamePart(recovered[currentFieldId], value);
      } else if (currentFieldId === "date_of_birth" || currentFieldId === "nominee_dob") {
        if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value)) recovered[currentFieldId] = value;
      } else {
        recovered[currentFieldId] = value;
      }
    }
  }

  for (let idx = 0; idx < messages.length; idx += 1) {
    const msg = messages[idx];
    if (msg?.isHidden || msg?.isSystem || msg.role !== "assistant") continue;
    const fieldId = getTranscriptPromptFieldId(msg.content || msg.displayContent || "");
    if (!fieldId) continue;
    const candidates = getForwardUserTranscriptCandidates(messages, idx, 4);
    if (!candidates.length) continue;

    if (fieldId === "application_no" && !hasMeaningfulKycValue(recovered.application_no)) {
      const formatted = formatKycAnswerForPdf(
        { id: "application_no", type: "text" },
        candidates.join(" "),
      );
      if (/^\d{3,}$/.test(String(formatted || "").trim())) recovered.application_no = formatted;
    }
    if (fieldId === "contact_no" && !hasMeaningfulKycValue(recovered.contact_no)) {
      const digits = candidates.map(getPhoneDigitsForKyc).find((digitsText) => digitsText.length >= 10);
      if (digits) recovered.contact_no = digits.slice(-10);
    }
    if ((fieldId === "date_of_birth" || fieldId === "nominee_dob") && !hasMeaningfulKycValue(recovered[fieldId])) {
      const dateCandidates =
        fieldId === "nominee_dob"
          ? candidates.filter((candidate) => {
              const normalized = normalizeIndicSpeechText(candidate).toLowerCase();
              return (
                /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b/.test(normalized) ||
                /\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|\d{1,4})\b/.test(normalized)
              );
            })
          : candidates;
      const joined = dateCandidates.join(" ");
      const formatted = formatDateOfBirthForPdf(joined);
      if (isReasonableKycDateValue(formatted)) recovered[fieldId] = formatted;
    }
    if (fieldId === "education_details" && !hasMeaningfulKycValue(recovered.education_details)) {
      const education = candidates.map((candidate) => cleanRecoveredTranscriptAnswer(fieldId, candidate)).find(Boolean);
      if (education) recovered.education_details = education;
    }
    if (
      (fieldId === "life_to_be_assured_name" || fieldId === "nominee_name") &&
      (!hasMeaningfulKycValue(recovered[fieldId]) ||
        !looksLikeValidKycName(recovered[fieldId]) ||
        String(recovered[fieldId] || "").trim().split(/\s+/).filter(Boolean).length < 2)
    ) {
      const bestName = candidates
        .map((candidate) => cleanRecoveredTranscriptAnswer(fieldId, candidate))
        .filter(Boolean)
        .filter((candidate) => looksLikeValidKycName(candidate))
        .sort((a, b) => {
          const aWords = String(a || "").trim().split(/\s+/).filter(Boolean).length;
          const bWords = String(b || "").trim().split(/\s+/).filter(Boolean).length;
          if (bWords !== aWords) return bWords - aWords;
          return String(b || "").length - String(a || "").length;
        })[0];
      if (bestName) recovered[fieldId] = bestName;
    }
    if (fieldId === "weight_kg" && !hasMeaningfulKycValue(recovered.weight_kg)) {
      const weight = candidates
        .map((candidate) => cleanRecoveredTranscriptAnswer(fieldId, candidate))
        .find(Boolean);
      if (weight) recovered.weight_kg = weight;
    }
    if (fieldId === "existing_insurance_cover" && !hasMeaningfulKycValue(recovered.existing_insurance_cover)) {
      const insurance = candidates
        .map((candidate) => cleanRecoveredTranscriptAnswer(fieldId, candidate))
        .find((candidate) => {
          if (!candidate) return false;
          const normalized = normalizeIndicSpeechText(candidate).toLowerCase().trim();
          if (/^(none|no|nil|nothing|no cover|not applicable)$/i.test(normalized)) return true;
          return !hasHabitKeyword(candidate) && !/\b(lakhs?|lacs?|crores?|million|thousand)\b/i.test(normalized);
        });
      if (insurance) recovered.existing_insurance_cover = insurance;
    }
    if (fieldId === "all_life_cover" || fieldId === "all_ci_cover") {
      const amount = candidates
        .map((candidate) => ({
          raw: candidate,
          value: cleanRecoveredTranscriptAnswer(fieldId, candidate),
        }))
        .filter((candidate) => candidate.value)
        .sort((a, b) => {
          const aHasUnit = /\b(lakhs?|lacs?|crores?)\b/i.test(a.raw);
          const bHasUnit = /\b(lakhs?|lacs?|crores?)\b/i.test(b.raw);
          if (aHasUnit !== bHasUnit) return bHasUnit ? 1 : -1;
          return Number(b.value) - Number(a.value);
        })[0]?.value;
      if (amount) recovered[fieldId] = amount;
    }
    if (
      fieldId === "travel_outside_india" &&
      (!hasMeaningfulKycValue(recovered.travel_outside_india_reason) ||
        String(recovered.travel_outside_india_reason || "").trim().length < 5)
    ) {
      const destination = candidates
        .map((candidate) => cleanRecoveredTranscriptAnswer(fieldId, candidate))
        .filter((candidate) => isLikelyTravelDestinationText(candidate))
        .sort((a, b) => String(b || "").length - String(a || "").length)[0];
      if (destination) {
        recovered.travel_outside_india = "Yes";
        recovered.travel_outside_india_reason = destination;
      }
    }
    if (
      fieldId === "habits_addictions" &&
      (!hasMeaningfulKycValue(recovered.habits_addictions) ||
        !hasHabitKeyword(recovered.habits_addictions))
    ) {
      const habit = candidates.find((candidate) => hasHabitKeyword(candidate));
      const duration = candidates.find(
        (candidate) => hasDurationPhrase(candidate) && !hasHabitKeyword(candidate),
      );
      if (habit) {
        recovered.habits_addictions = cleanHabitAnswerForPdf(
          combineKycReasonParts(habit, duration),
        );
      }
    }
    if (isReasonKycFieldId(fieldId)) {
      const field = getPresetKycFieldById(fieldId);
      const reasonParts = candidates
        .map((candidate) => extractReasonFromAffirmativeAnswer(candidate))
        .filter((candidate) => hasMeaningfulKycValue(candidate))
        .filter((candidate) => !isLikelyNonReasonAnswerForField(fieldId, candidate));
      if (reasonParts.length) {
        const combinedReason = reasonParts.reduce(
          (acc, candidate) => combineKycReasonParts(acc, candidate),
          recovered[field?.reasonResponseId] || "",
        );
        const sanitized = sanitizeKycReasonForField(fieldId, combinedReason);
        if (sanitized) {
          recovered[fieldId] = "Yes";
          recovered[field.reasonResponseId] = sanitized;
        }
      }
    }
  }

  for (const field of PRESET_DEMO_KYC_FIELDS) {
    if (!field.reasonResponseId || !recovered[field.reasonResponseId]) continue;
    const sanitized = sanitizeKycReasonForField(field.id, recovered[field.reasonResponseId]);
    if (sanitized) recovered[field.reasonResponseId] = sanitized;
    else delete recovered[field.reasonResponseId];
  }

  return recovered;
};

const isCompleteKycDateFieldValue = (field, value) => {
  if (field?.type !== "date") return true;
  if (isUncapturedKycValue(value)) return true;
  return isReasonableKycDateValue(value);
};

const isCompleteKycPhoneFieldValue = (field, value) => {
  if (!isPhoneKycField(field)) return true;
  if (isUncapturedKycValue(value)) return true;
  const digits = getPhoneDigitsForKyc(value);
  return digits.length >= 10;
};

const isCompleteKycNameFieldValue = (field, value) => {
  if (!isFullNameField(field)) return true;
  if (isUncapturedKycValue(value)) return true;
  return looksLikeValidKycName(value);
};

const isKycFieldComplete = (field, responses = {}) => {
  if (shouldSkipFieldForGender(field, responses)) return true;
  if (!hasRecordedKycValue(responses[field.id])) return false;

  if (!isCompleteKycDateFieldValue(field, responses[field.id])) return false;
  if (!isCompleteKycPhoneFieldValue(field, responses[field.id])) return false;
  if (!isCompleteKycNameFieldValue(field, responses[field.id])) return false;

  if (!field?.requiresReasonOnYes) return true;
  if (responses[field.id] !== 'Yes') return true;
  if (!hasRecordedKycValue(responses[field.reasonResponseId])) return false;
  if (isUncapturedKycValue(responses[field.reasonResponseId])) return true;
  if (
    field.id === "diagnostic_tests" &&
    /\btiming not captured\b/i.test(String(responses[field.reasonResponseId] || ""))
  ) {
    return true;
  }
  if (!doesKycReasonNeedDuration(field)) return true;
  return hasDurationPhrase(responses[field.reasonResponseId]);
};


const getCompletedKycFieldCount = (fields = [], responses = {}) =>
  fields.filter((field) => isKycFieldComplete(field, responses)).length;

const autoSkipGenderedFields = (
  fields,
  currentResponses,
  genderValue,
  fromIndex,
) => {
  const normalizedGender = String(genderValue || "")
    .toLowerCase()
    .trim();
  const isMale = ["male", "m", "man", "boy"].includes(normalizedGender);
  const isFemale = ["female", "f", "woman", "girl"].includes(normalizedGender);

  if (!isMale && !isFemale)
    return { responses: currentResponses, nextIndex: fromIndex };

  const updatedResponses = { ...currentResponses };

  for (let i = 0; i < fields.length; i += 1) {
    const field = fields[i];
    const shouldSkip =
      (isMale && field.genderRestriction === "female") ||
      (isFemale && field.genderRestriction === "male");

    if (shouldSkip) {
      delete updatedResponses[field.id];
      if (field.reasonResponseId) {
        delete updatedResponses[field.reasonResponseId];
      }
    }
  }

  let nextIndex = fromIndex;
  while (nextIndex < fields.length) {
    const field = fields[nextIndex];
    const isSkipped =
      (isMale && field.genderRestriction === "female") ||
      (isFemale && field.genderRestriction === "male");
    if (!isSkipped) break;
    nextIndex += 1;
  }

  return { responses: updatedResponses, nextIndex };
};

const shouldSkipFieldForGender = (field, responses) => {
  const genderValue = String(responses?.gender || "")
    .toLowerCase()
    .trim();
  const isMale = ["male", "m", "man", "boy"].includes(genderValue);
  const isFemale = ["female", "f", "woman", "girl"].includes(genderValue);

  if (isMale && field.genderRestriction === "female") return true;
  if (isFemale && field.genderRestriction === "male") return true;
  return false;
};

const findNextUnskippedFieldIndex = (fields, responses, fromIndex) => {
  let idx = fromIndex;
  while (
    idx < fields.length &&
    shouldSkipFieldForGender(fields[idx], responses)
  ) {
    idx += 1;
  }
  return idx;
};

const findNextPendingKycFieldIndex = (fields, responses, fromIndex = 0) => {
  let idx = Math.max(0, fromIndex);
  while (idx < fields.length) {
    const field = fields[idx];
    if (!field) {
      idx += 1;
      continue;
    }
    if (
      shouldSkipFieldForGender(field, responses) ||
      isKycFieldComplete(field, responses)
    ) {
      idx += 1;
      continue;
    }
    return idx;
  }
  return idx;
};
const FILLER_PATTERNS = new Set([
  'yes', 'yeah', 'yep', 'ok', 'okay', 'hmm', 'hm', 'uh', 'um',
  'what', 'sorry', 'pardon', 'excuse me', 'can you repeat',
  'i said', 'i told you', 'come again', 'say again', 'huh',
  'right', 'sure', 'alright', 'fine', 'go ahead',
  'haan', 'theek hai', 'achha', 'ji', 'ji haan',
  'kya', 'dobara', 'phir se',
  'no what', 'no what?', 'what?', 'hello', 'hello?',
  'can you hear me', 'are you there', 'hello hello',
  'thank you', 'thanks', 'okay thank you', 'got it',
  'please', 'wait', 'hold on', 'one second', 'just a moment',
  'background', 'noise', 'sorry about that',
]);

const isLikelyFiller = (text, field) => {
  const t = String(text || '').trim().toLowerCase();
  if (!t || t.length < 2) return true;
  if (field?.type === 'yes_no') return false;
  // if (field?.id === 'contact_no') return false;
  if (FILLER_PATTERNS.has(t)) return true;
  if (/^(i said|i told|i already said|maine kaha|maine bola)/i.test(t)) {
    return false;
  }
  return false;
};

const AMBIENT_TRANSCRIPT_PATTERNS = [
  /\bthe ai\b/i,
  /\bai driven\b/i,
  /\blegal\b/i,
  /\bwhat i look (at|like) that\b/i,
  /\blook at that\b/i,
  /\bcan you see (this|that|me)\b/i,
  /\bmove (this|that|it)\b/i,
  /\bkeep (it|this|that) there\b/i,
  /\bbackground noise\b/i,
  /\bsomeone (is )?(speaking|talking)\b/i,
];

const isLikelyAmbientTranscriptText = (text) => {
  const normalizedText = normalizeTranscriptEncoding(text)
    .replace(/[.,!?]+$/g, "")
    .trim();
  if (!normalizedText) return true;
  return AMBIENT_TRANSCRIPT_PATTERNS.some((pattern) =>
    pattern.test(normalizedText),
  );
};

const isUnsafeKycPdfText = (text) => {
  const normalized = normalizeTranscriptEncoding(text)
    .toLowerCase()
    .replace(/[.,!?]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return true;
  return /^(good\.?\s*you|good you|i'?m good|oh you'?re back|you'?re back|your back|ur back|are you back|hello|hello\?|help|done|past|i|the|total|what|can you hear me|one second|wait|hold on)$/i.test(
    normalized,
  );
};

const hasHabitKeyword = (text) =>
  /\b(alcohol|beer|wine|liquor|drink|drinking|smok|smoking|cig|cigarette|beedi|cigar|gutka|snuff|paan|tobacco|drug|drugs)\b/i.test(
    normalizeIndicSpeechText(text),
  );

const cleanHabitAnswerForPdf = (value) => {
  const raw = extractReasonFromAffirmativeAnswer(value)
    .replace(/(?:\b(?:for|since|from|past|and|or|with|plus)\s*)+$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!raw) return "";
  if (/^(none|no|nil|nothing|not applicable)$/i.test(raw)) return "No";
  if (!hasHabitKeyword(raw) && !hasDurationPhrase(raw)) return "";
  return dedupeKycReasonText(raw);
};

const isIncompleteHabitPhrase = (value) =>
  /\b(?:for|since|from|past|and|or|with|plus)\s*$/i.test(
    normalizeIndicSpeechText(value)
      .replace(/[.,!?]+$/g, "")
      .trim(),
  );

const stripClarificationPrefix = (text) =>
  String(text || "")
    .trim()
    .replace(/^[""](.+)[""]$/, '$1')
    .trim()
    .replace(/^(i said|i told you|i already said|my answer is|its|it's|it is)\s+/i, '')
    .replace(/^(maine kaha|maine bola|mera naam|mera jawab)\s+/i, "")
    .trim();

const isFullNameField = (field) => {
  const prompt = String(field?.prompt || "").toLowerCase();
  const label = String(field?.label || "").toLowerCase();
  return (
    field?.id === "life_to_be_assured_name" ||
    field?.id === "nominee_name" ||
    prompt.includes("full name") ||
    label.includes("full name")
  );
};

const looksLikeCompleteFullName = (value) => {
  const tokens = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length < 2) return false;

  return tokens.every((token) => token.replace(/[^a-z'.-]/gi, "").length >= 2);
};

const KYC_BAD_NAME_VALUES = new Set([
  "mail",
  "male",
  "female",
  "other",
  "yes",
  "no",
  "so",
  "so do",
  "do",
  "the",
  "the dish",
  "dish",
  "tatish",
  "what",
  "right",
  "okay",
  "ok",
]);

const looksLikeValidKycName = (value) => {
  const formatted = formatNameForPdf(value);
  const normalized = normalize(formatted);
  if (!formatted || KYC_BAD_NAME_VALUES.has(normalized)) return false;
  if (isUnsafeKycPdfText(formatted) || isLikelyNumberOnlySpeech(formatted)) return false;
  if (!looksLikeCompleteFullName(formatted)) return false;

  const letters = formatted.replace(/[^a-z]/gi, "");
  if (letters.length < 6) return false;
  return true;
};

const isLikelyNumberOnlySpeech = (value) => {
  const normalized = normalizeIndicSpeechText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return false;

  const allowed = new Set([
    "zero",
    "oh",
    "o",
    "one",
    "two",
    "three",
    "four",
    "for",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "hundred",
    "thousand",
    "lakh",
    "and",
  ]);
  const tokens = normalized.split(/\s+/).filter(Boolean);
  return tokens.length > 0 && tokens.every((token) => allowed.has(token) || /^\d+$/.test(token));
};

const isNumericKycField = (field) =>
  field?.type === "number" ||
  ["height_cm", "weight_kg", "all_life_cover", "all_ci_cover"].includes(
    String(field?.id || ""),
  );

const isPlausibleNumericKycValue = (field, value) => {
  const formatted = formatKycAnswerForPdf(field, value);
  if (!/^\d+(\.\d+)?$/.test(String(formatted || "").trim())) return false;
  const numeric = Number(formatted);
  if (!Number.isFinite(numeric)) return false;
  if (field?.id === "height_cm") return numeric >= 100 && numeric <= 250;
  if (field?.id === "weight_kg") return numeric >= 20 && numeric <= 250;
  if (field?.id === "all_life_cover" || field?.id === "all_ci_cover") {
    const normalized = normalizeIndicSpeechText(value).toLowerCase();
    if (numeric === 0) return true;
    return (
      numeric >= 1000 ||
      /\b(lakhs?|lacs?|crores?|million|thousand)\b/i.test(normalized)
    );
  }
  return true;
};

const isLocallyPlausibleKycAnswerForField = (field, rawText, formattedValue = null) => {
  const raw = normalizeTranscriptEncoding(rawText);
  if (!field || !raw) return false;
  if (isLikelyAmbientTranscriptText(raw)) return false;

  const formatted =
    formattedValue == null ? formatKycAnswerForPdf(field, raw) : String(formattedValue || "").trim();
  const normalizedRaw = normalize(raw);
  const normalizedFieldId = String(field.id || "");

  if (normalizedFieldId === "application_no" || String(field.label || "").toLowerCase().includes("application")) {
    const digits = String(formatted || "").replace(/\D/g, "");
    return digits.length >= 5 && !/[a-z]{3,}/i.test(String(formatted || "").replace(/\b(one|two|three|four|five|six|seven|eight|nine|zero|oh|o)\b/gi, ""));
  }

  if (isFullNameField(field)) {
    if (isLikelyNumberOnlySpeech(raw)) return false;
    return looksLikeValidKycName(formatted || raw);
  }

  if (field.type === "date") {
    return (
      isCompleteKycDateFieldValue(field, formatted) ||
      /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b/i.test(
        normalizeIndicSpeechText(raw),
      ) ||
      /\d/.test(raw)
    );
  }

  if (normalizedFieldId === "gender") {
    return ["male", "female", "other"].includes(String(formatted || "").toLowerCase());
  }

  if (isPhoneKycField(field)) {
    return getPhoneDigitsForKyc(formatted || raw).length > 0;
  }

  if (isNumericKycField(field)) {
    if (parseYesNoAnswer(raw)) return false;
    return isPlausibleNumericKycValue(field, formatted || raw);
  }

  if (isYesNoField(field)) {
    return Boolean(
      parseYesNoAnswer(raw) ||
        parseYesNoAnswer(formatted) ||
        inferImplicitYesNoAnswer(field, raw),
    );
  }

  if (normalizedFieldId === "education_details") {
    if (isUnsafeKycPdfText(raw)) return false;
    return /[a-z0-9]/i.test(normalizedRaw) && !isLikelyNumberOnlySpeech(raw);
  }

  if (normalizedFieldId === "habits_addictions") {
    const yesNo = parseYesNoAnswer(raw);
    if (yesNo === "No") return true;
    if (yesNo === "Yes") return false;
    const cleanedHabit = cleanHabitAnswerForPdf(raw);
    if (!cleanedHabit) return false;
    return hasHabitKeyword(cleanedHabit) || hasDurationPhrase(cleanedHabit);
  }

  return hasMeaningfulKycValue(formatted);
};

const getAgentClarificationMode = (text) => {
  const raw = String(text || "").trim();
  if (!raw) return null;

  const normalized = raw.toLowerCase();
  if (
    /\b(is that (correct|right)|did i (get|hear) that right|did i hear you correctly|is this correct|so that'?s .* correct)\b/i.test(
      normalized,
    ) ||
    /\b(?:correct|right)\?\s*$/i.test(normalized) ||
    /\bi heard .* is that correct\b/i.test(normalized) ||
    /\b(do you mean|did you mean|you mean|i think you meant)\b/i.test(
      normalized,
    )
  ) {
    return "confirm";
  }

  if (
    /\b(could you (?:please\s+)?(?:repeat|say that again|spell|spell that|spell it out|spell your|spell the)|can you (?:please\s+)?(?:repeat|say that again|spell)|please repeat|please spell|spell\b.*\bname|i (didn't|did not|couldn't|could not) catch|say that again|repeat that)\b/i.test(
      normalized,
    )
    ||
    /\b(complete the (date|year)|confirm the year|year once more|confirm.*year|full date including|including (the )?day,? month,? and year|including day,? month,? and year)\b/i.test(
      normalized,
    )
  ) {
    return "clarify";
  }

  return null;
};

const inferConfirmedClarificationAnswer = (field, clarificationText) => {
  if (!field) return "";
  const normalized = normalizeIndicSpeechText(clarificationText)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (field.id === "gender") {
    if (/\bfemale\b|\bwoman\b|\bgirl\b/.test(normalized)) return "Female";
    if (/\bmale\b|\bman\b|\bboy\b/.test(normalized)) return "Male";
    if (/\bother\b|\bnon binary\b/.test(normalized)) return "Other";
  }
  if (field.type === "date") {
    const date = formatDateOfBirthForPdf(clarificationText);
    if (isReasonableKycDateValue(date)) return date;
  }

  return "";
};

const isReasonFollowUpText = (text) => {
  const normalized = normalize(text);
  if (!normalized) return false;
  return /\b(reason|details|brief details|what happened|why|name of medicine|provide details|tell me the reason|which one|which condition|which procedure|which country|country name again|share what tests|which test|tell me more about|share which country|clarify the country|share what treatment|share what medication)\b/i.test(
    normalized,
  );
};

const isLikelyAgentQuestionText = (text, clarificationMode = null) => {
  const raw = String(text || "").trim();
  if (!raw) return false;
  if (clarificationMode) return true;
  if (isReasonFollowUpText(raw)) return true;

  const normalized = normalize(raw);
  if (!normalized) return false;

  if (/\?$/.test(raw)) return true;

  return /\b(what|when|where|which|who|how|do|does|did|have|has|had|are|were|is|can|could|would|please|kindly|tell me|provide|share|spell|repeat|answer|say|next|now)\b/.test(
    normalized,
  );
};

const FIELD_MATCH_STOP_WORDS = new Set([
  "what",
  "is",
  "your",
  "you",
  "are",
  "the",
  "a",
  "an",
  "please",
  "tell",
  "me",
  "do",
  "have",
  "had",
  "for",
  "and",
  "or",
  "any",
  "all",
  "this",
  "that",
  "with",
  "from",
  "been",
  "under",
  "into",
  "than",
  "more",
  "last",
  "next",
  "yes",
  "no",
  "currently",
  "provide",
  "give",
  "details",
  "brief",
  "reason",
  "answer",
  "say",
  "out",
  "full",
]);

const getFieldMatchTokens = (field) => {
  const source = [
    field?.label,
    field?.prompt,
    field?.reasonPromptLabel,
    field?.followUpIfYes,
    ...(Array.isArray(field?.matchHints) ? field.matchHints : []),
  ]
    .filter(Boolean)
    .join(" ");

  return [
    ...new Set(
      normalize(source)
        .split(" ")
        .map((token) => token.replace(/[^a-z0-9]/g, ""))
        .filter(
          (token) => token.length > 2 && !FIELD_MATCH_STOP_WORDS.has(token),
        ),
    ),
  ];
};

const scoreAgentFieldMatch = (text, field) => {
  const normalizedText = normalize(text);
  if (!normalizedText) return 0;

  let score = 0;
  const candidateTexts = [
    field?.label,
    field?.prompt,
    field?.reasonPromptLabel,
    field?.followUpIfYes,
    ...(Array.isArray(field?.matchHints) ? field.matchHints : []),
  ]
    .filter(Boolean)
    .map((candidate) => normalize(candidate));

  for (const candidate of candidateTexts) {
    if (!candidate) continue;
    if (candidate.length > 12 && normalizedText.includes(candidate)) {
      score = Math.max(score, 100);
      continue;
    }
    if (
      candidate.length > 14 &&
      candidate.includes(normalizedText) &&
      normalizedText.length > 12
    ) {
      score = Math.max(score, 70);
    }
  }

  const fieldTokens = getFieldMatchTokens(field);
  if (!fieldTokens.length) return score;
  const matchedTokens = fieldTokens.filter((token) =>
    normalizedText.includes(token),
  );
  if (!matchedTokens.length) return score;

  const overlapScore =
    matchedTokens.length * 10 +
    (matchedTokens.length / fieldTokens.length) * 35;
  return Math.max(score, overlapScore);
};

const findReferencedFieldIndexFromAgentText = (
  text,
  fields,
  fallbackIndex = 0,
) => {
  if (!Array.isArray(fields) || !fields.length) return -1;

  let bestIndex = -1;
  let bestScore = 0;
  let fallbackScore = 0;

  for (let index = 0; index < fields.length; index += 1) {
    let score = scoreAgentFieldMatch(text, fields[index]);
    if (!score) continue;

    if (index === fallbackIndex) score += 12;
    if (index === fallbackIndex - 1) score += 8;
    if (index === fallbackIndex + 1) score += 6;
    if (index === fallbackIndex) fallbackScore = score;

    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }

  if (
    Number.isInteger(fallbackIndex) &&
    fallbackScore >= 18 &&
    fallbackScore >= bestScore - 8
  ) {
    return fallbackIndex;
  }

  return bestScore >= 24 ? bestIndex : -1;
};

const resolveAgentAskedFieldIndex = (
  text,
  fields,
  responses,
  fallbackIndex,
  lastCommitted,
) => {
  if (!Array.isArray(fields) || !fields.length) return -1;
  const transcriptPromptFieldId = getTranscriptPromptFieldId(text);
  if (transcriptPromptFieldId) {
    const exactIndex = fields.findIndex((field) => field.id === transcriptPromptFieldId);
    if (exactIndex >= 0) return exactIndex;
  }

  if (!isLikelyAgentQuestionText(text, getAgentClarificationMode(text)))
    return -1;

  const fallbackField = fields[fallbackIndex];
  const normalizedQuestion = normalize(text);
  if (
    !transcriptPromptFieldId &&
    /^(could you\s+)?(?:please\s+)?(?:clarify|specify)\s+which\b/.test(normalizedQuestion) &&
    !/\b(kidney|liver|stomach|condition|disease|test|surgery|procedure|country|medicine|medication|treatment|positive|hiv|aids)\b/.test(
      normalizedQuestion,
    )
  ) {
    return fallbackField && isKycFieldAwaitingReason(fallbackField, responses)
      ? fallbackIndex
      : -1;
  }
  if (transcriptPromptFieldId) {
    const exactIndex = fields.findIndex((field) => field.id === transcriptPromptFieldId);
    if (exactIndex >= 0 && exactIndex !== fallbackIndex) return exactIndex;
  }

  if (
    fallbackField &&
    isKycFieldAwaitingReason(fallbackField, responses) &&
    isReasonFollowUpText(text)
  ) {
    return fallbackIndex;
  }

  if (
    lastCommitted?.index != null &&
    Date.now() - lastCommitted.timestamp < 20000
  ) {
    const committedField = fields[lastCommitted.index];
    if (
      committedField &&
      isReasonFollowUpText(text) &&
      committedField.requiresReasonOnYes
    ) {
      return lastCommitted.index;
    }
  }

  if (transcriptPromptFieldId) {
    const exactIndex = fields.findIndex((field) => field.id === transcriptPromptFieldId);
    if (exactIndex >= 0) return exactIndex;
  }

  return findReferencedFieldIndexFromAgentText(text, fields, fallbackIndex);
};

const getKycFieldDisplayValue = (field, responses = {}) => {
  if (shouldSkipFieldForGender(field, responses)) return "Skipped";
  const value = responses[field.id];
  if (isUncapturedKycValue(value)) return KYC_UNCAPTURED_LABEL;
  if (!hasMeaningfulKycValue(value)) return "";

  if (field?.requiresReasonOnYes && value === "Yes") {
      const reason = extractReasonFromAffirmativeAnswer(
        responses[field.reasonResponseId],
      );
    if (isUncapturedKycValue(reason)) return `Yes - ${KYC_UNCAPTURED_LABEL}`;
    return reason ? `Yes - ${reason}` : "Yes";
  }

  return formatKycAnswerForPdf(field, value);
};

const getKycPdfFillValue = (field, value) => {
  if (!hasMeaningfulKycValue(value)) return "";
  if (isUncapturedKycValue(value)) {
    return isYesNoField(field) ? "" : KYC_UNCAPTURED_LABEL;
  }
  return formatKycAnswerForPdf(field, value);
};

const toPdfSafeText = (value, fallback = "") => {
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;

  const asciiish = raw
    .normalize("NFKD")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u00A0/g, " ")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "")
    .trim();

  return asciiish || fallback;
};

const isKycCompletionAnnouncement = (text) => {
  const normalized = normalize(text);
  if (!normalized) return false;
  return /\b(form is complete|form has been completed|all fields (are )?done|all questions (are )?done|verification complete|medical examination report is complete|we are done|thats all i need|that is all i need)\b/.test(
    normalized,
  );
};

const finalizeIncompleteKycResponses = (fields = [], responses = {}) => {
  const updated = { ...responses };
  let changed = false;

  fields.forEach((field) => {
    if (!field || shouldSkipFieldForGender(field, updated)) return;

    if (
      !hasRecordedKycValue(updated[field.id]) ||
      !isCompleteKycDateFieldValue(field, updated[field.id]) ||
      !isCompleteKycPhoneFieldValue(field, updated[field.id]) ||
      !isCompleteKycNameFieldValue(field, updated[field.id])
    ) {
      updated[field.id] = KYC_UNCAPTURED_VALUE;
      changed = true;
    }

    if (
      field.requiresReasonOnYes &&
      updated[field.id] === "Yes" &&
      !hasRecordedKycValue(updated[field.reasonResponseId])
    ) {
      updated[field.reasonResponseId] = KYC_UNCAPTURED_VALUE;
      changed = true;
    }
  });

  return { responses: updated, changed };
};

const markSkippedFieldsAsUncaptured = (
  fields = [],
  responses = {},
  fromIndex = 0,
  toIndex = 0,
  recentUserAnswer = null,
) => {
  const updated = { ...responses };
  let changed = false;
  const firstSkippedIndex = Math.max(0, fromIndex);
  const recentAnswerText = String(recentUserAnswer?.text || "").trim();
  const recentAnswerAgeMs = recentUserAnswer?.timestamp
    ? Date.now() - recentUserAnswer.timestamp
    : Number.POSITIVE_INFINITY;
  const recentNoAnswer =
    recentAnswerText &&
    recentAnswerAgeMs >= 0 &&
    recentAnswerAgeMs < 15000 &&
    parseYesNoAnswer(recentAnswerText) === "No";

  for (let index = firstSkippedIndex; index < Math.min(toIndex, fields.length); index += 1) {
    const field = fields[index];
    if (!field || shouldSkipFieldForGender(field, updated)) continue;
    if (!isKycFieldComplete(field, updated)) {
      if (index === firstSkippedIndex && recentNoAnswer && isYesNoField(field)) {
        updated[field.id] = "No";
        if (field.reasonResponseId) updated[field.reasonResponseId] = "";
        changed = true;
        continue;
      }
      updated[field.id] = KYC_UNCAPTURED_VALUE;
      if (field.reasonResponseId) updated[field.reasonResponseId] = "";
      changed = true;
    }
  }

  return { responses: updated, changed };
};

const shouldHoldIncompleteFieldBeforeAgentJump = (field, responses = {}) => {
  if (!field || shouldSkipFieldForGender(field, responses)) return false;
  if (isKycFieldComplete(field, responses)) return false;

  return false;
};

const getActiveKycPromptLabel = (field, responses = {}) => {
  if (!field) return "";
  if (isKycFieldAwaitingReason(field, responses)) {
    return field.reasonPromptLabel || "If yes, please tell me the reason";
  }
  return field.prompt || field.label;
};

const getTranscriptMessageKey = (role, text, rawKey = null) => {
  if (rawKey) return `${role}:${rawKey}`;
  const normalizedText = normalize(text || "");
  return normalizedText ? `${role}:text:${normalizedText}` : null;
};

const getTranscriptFingerprint = (role, text, fieldIndex = null, mode = 'default') => {
  const normalizedText = normalize(text || '').slice(0, 180);
  if (!normalizedText) return null;
  const normalizedIndex = Number.isInteger(fieldIndex) ? fieldIndex : 'na';
  return `${role}:${mode}:${normalizedIndex}:${normalizedText}`;
};

const isLikelyBrokenTranscriptText = (text) => {
  const raw = String(text || "").trim();
  if (!raw) return true;
  if (isBlankLikeToken(raw)) return true;

  const compact = raw.replace(/\s+/g, "");
  if (/^[?*_#=~|\\/<>[\]{}^`.-]{4,}$/.test(compact)) return true;
  if (/(.)\1{8,}/.test(compact)) return true;

  const visibleCount = compact.length;
  const alphaNumericCount =
    (raw.match(/[\p{L}\p{N}]/gu) || []).length;
  if (visibleCount >= 4 && alphaNumericCount / visibleCount < 0.25) {
    return true;
  }

  const replacementCount = (raw.match(/\uFFFD/g) || []).length;
  return replacementCount >= 2;
};

const isBlankLikeToken = (text) => {
  const t = String(text || "").trim();
  return /^[_\-.]{4,}$/.test(t) || /^_{3,}\s*$/.test(t);
};

const findBestNearbyBlank = (items, labelItem) => {
  const sameLineTolerance = 14;
  const nearbyVerticalTolerance = 26;
  const blankTokens = items.filter(
    (it) => it.page === labelItem.page && isBlankLikeToken(it.text),
  );

  const sameLineCandidates = blankTokens.filter(
    (it) =>
      it.x > labelItem.x && Math.abs(it.y - labelItem.y) <= sameLineTolerance,
  );

  if (sameLineCandidates.length) {
    sameLineCandidates.sort((a, b) => a.x - b.x);
    return sameLineCandidates[0];
  }

  const belowCandidates = blankTokens.filter((it) => {
    const deltaY = it.y - labelItem.y;
    return (
      deltaY > 0 && deltaY <= nearbyVerticalTolerance && it.x >= labelItem.x - 8
    );
  });

  if (!belowCandidates.length) return null;

  belowCandidates.sort((a, b) => {
    const dy = a.y - labelItem.y - (b.y - labelItem.y);
    if (dy !== 0) return dy;
    return a.x - b.x;
  });

  return belowCandidates[0];
};

const groupTextItemsIntoLines = (items) => {
  const sorted = [...items].sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page;
    if (Math.abs(a.y - b.y) > 3.5) return a.y - b.y;
    return a.x - b.x;
  });

  const lines = [];
  for (const item of sorted) {
    const previous = lines[lines.length - 1];
    if (
      previous &&
      previous.page === item.page &&
      Math.abs(previous.y - item.y) <= 3.5
    ) {
      previous.items.push(item);
      previous.x = Math.min(previous.x, item.x);
      previous.y = Math.min(previous.y, item.y);
      previous.width = Math.max(
        previous.width,
        item.x + item.width - previous.x,
      );
      previous.height = Math.max(previous.height, item.height || 0);
      continue;
    }

    lines.push({
      page: item.page,
      x: item.x,
      y: item.y,
      width: item.width || 0,
      height: item.height || 0,
      items: [item],
    });
  }

  return lines.map((line) => ({
    ...line,
    text: line.items
      .slice()
      .sort((a, b) => a.x - b.x)
      .map((it) => it.text)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim(),
  }));
};

const isLikelySectionAnchorLine = (line) => {
  const text = String(line?.text || "").trim();
  if (!text) return false;
  if (line.x > 110) return false;

  return (
    /^part\b/i.test(text) ||
    /^[a-z]\.\s/i.test(text) ||
    /^family history:?$/i.test(text) ||
    /^habits:?$/i.test(text) ||
    /^declaration$/i.test(text)
  );
};

const normalizeSectionToken = (text) =>
  normalize(
    String(text || "")
      .replace(/^[a-z]\.\s*/i, "")
      .replace(/^part\s+[ivx0-9:.\s-]*/i, "")
      .trim(),
  );

const findSectionAnchors = (lines) =>
  lines
    .filter((line) => isLikelySectionAnchorLine(line))
    .map((line) => ({
      ...line,
      sectionKey: normalizeSectionToken(line.text),
    }))
    .sort((a, b) => (a.page !== b.page ? a.page - b.page : a.y - b.y));

const getScopedCandidatesForField = (field, lines, anchors) => {
  const sectionKey = normalizeSectionToken(field?.section || "");
  if (!sectionKey) return [];

  let bestAnchorIndex = -1;
  let bestScore = 0;
  anchors.forEach((anchor, index) => {
    const score = scoreFieldLabelMatch(
      sectionKey,
      anchor.sectionKey || anchor.text,
    );
    if (score > bestScore) {
      bestScore = score;
      bestAnchorIndex = index;
    }
  });

  if (bestAnchorIndex === -1 || bestScore < 20) return [];

  const currentAnchor = anchors[bestAnchorIndex];
  const nextAnchor = anchors[bestAnchorIndex + 1] || null;

  return lines.filter((line) => {
    if (line.page < currentAnchor.page) return false;
    if (line.page === currentAnchor.page && line.y + 2 < currentAnchor.y)
      return false;

    if (!nextAnchor) return true;
    if (line.page > nextAnchor.page) return false;
    if (line.page === nextAnchor.page && line.y >= nextAnchor.y - 2)
      return false;
    return true;
  });
};

const shouldSkipExtractedKycField = (field) => {
  const label = normalize(field?.label || "");
  const section = normalize(field?.section || "");

  if (!label) return true;
  if (/^part\b/.test(label)) return true;
  if (label === "family history" || label === "habits") return true;
  if (section && label === section && label.length <= 40) return true;

  return false;
};

const findNearbyYesNoAnchors = (items, labelItem) => {
  const yTolerance = 16;
  const sameLine = items.filter(
    (it) =>
      it.page === labelItem.page &&
      it.x > labelItem.x - 10 &&
      Math.abs(it.y - labelItem.y) <= yTolerance,
  );

  let yes = null;
  let no = null;
  for (const it of sameLine) {
    // Strip slashes, colons, periods, and whitespace for robust matching
    const token = String(it.text || "")
      .toLowerCase()
      .replace(/[\/\\:.\s]+/g, "")
      .trim();
    if (!yes && (token === "yes" || token === "y")) yes = it;
    if (!no && (token === "no" || token === "n")) no = it;
  }

  // Fallback: look for combined "Yes / No" or "Yes/No" tokens if separate ones weren't found
  if (!yes || !no) {
    for (const it of sameLine) {
      const raw = String(it.text || "")
        .toLowerCase()
        .trim();
      if (raw.includes("yes") && raw.includes("no")) {
        // Combined token like "Yes / No" or "Yes/No"
        if (!yes) yes = it;
        if (!no) {
          // Create a synthetic "No" anchor offset to the right
          no = { ...it, x: it.x + (it.width || 30) * 0.6 };
        }
        break;
      }
    }
  }

  return { yes, no };
};

const scoreFieldLabelMatch = (target, candidateText) => {
  const cand = normalize(candidateText);
  if (!cand) return 0;
  if (cand === target) return 100;
  if (cand.includes(target) || target.includes(cand)) return 80;

  const targetWords = [...new Set(target.split(" ").filter(Boolean))];
  const candWords = new Set(cand.split(" ").filter(Boolean));
  let overlap = 0;
  for (const word of targetWords) {
    if (word.length > 2 && candWords.has(word)) overlap += 1;
  }

  const ratio = overlap / Math.max(1, targetWords.length);
  return overlap * 10 + ratio * 40;
};

const itemKey = (item) =>
  `${item.page}:${Math.round(item.x)}:${Math.round(item.y)}:${normalize(item.text)}`;

const anchorKey = (page, yesAnchor, noAnchor) =>
  `${page}:${Math.round(yesAnchor.x)}:${Math.round(yesAnchor.y)}:${Math.round(noAnchor.x)}:${Math.round(noAnchor.y)}`;

const buildLocalMappings = (fields, textItems) => {
  const items = textItems;
  const lines = groupTextItemsIntoLines(items);
  const sectionAnchors = findSectionAnchors(lines);
  const mappings = [];
  const usedItems = new Set();
  const usedAnchors = new Set();

  for (const f of fields) {
    const target = normalize(f.label);
    const scopedLines = getScopedCandidatesForField(f, lines, sectionAnchors);
    const candidateLines = (scopedLines.length ? scopedLines : lines)
      .filter((line) => line.text)
      .filter((line) => {
        if (!isLikelySectionAnchorLine(line)) return true;
        return normalize(line.text) === target;
      });

    const rankedItems = candidateLines
      .map((line) => {
        let score = scoreFieldLabelMatch(target, line.text);
        if (
          isLikelySectionAnchorLine(line) &&
          normalize(line.text) !== target
        ) {
          score -= 30;
        }
        if (
          f.type === "yes_no" &&
          /\byes\b/i.test(line.text) &&
          /\bno\b/i.test(line.text)
        ) {
          score += 18;
        }
        return { item: line, score };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score);

    let best = null;
    let bestScore = 0;
    let selectedYes = null;
    let selectedNo = null;

    for (const candidate of rankedItems) {
      const key = itemKey(candidate.item);
      if (usedItems.has(key)) continue;

      if (f.type === "yes_no") {
        const anchors = findNearbyYesNoAnchors(items, candidate.item);
        if (!anchors.yes || !anchors.no) continue;
        const aKey = anchorKey(candidate.item.page, anchors.yes, anchors.no);
        if (usedAnchors.has(aKey)) continue;
        best = candidate.item;
        bestScore = candidate.score;
        selectedYes = anchors.yes;
        selectedNo = anchors.no;
        break;
      }

      best = candidate.item;
      bestScore = candidate.score;
      break;
    }

    const minScore = f.type === "yes_no" ? 28 : 12;
    if (!best || bestScore < minScore) continue;

    usedItems.add(itemKey(best));

    if (f.type === "yes_no") {
      const yesAnchor = selectedYes;
      const noAnchor = selectedNo;
      if (!yesAnchor || !noAnchor) continue;
      usedAnchors.add(anchorKey(best.page, yesAnchor, noAnchor));
      mappings.push({
        fieldId: f.id,
        type: "yes_no",
        page: best.page,
        yesX: yesAnchor.x - 12,
        yesY: yesAnchor.y + (yesAnchor.height || 8) / 2,
        noX: noAnchor.x - 12,
        noY: noAnchor.y + (noAnchor.height || 8) / 2,
      });
      continue;
    }

    const inlineBlank = findBestNearbyBlank(items, best);
    if (isDeclarationField(f) && !inlineBlank) continue;
    const inputX = inlineBlank ? inlineBlank.x : best.x + best.width + 8;
    const width = inlineBlank ? Math.max(90, inlineBlank.width) : 220;

    mappings.push({
      fieldId: f.id,
      type: f.type,
      page: best.page,
      inputX,
      inputY: best.y,
      width,
      height: 14,
      fontSize: Math.max(8, Math.min(11, best.fontSize || 9)),
    });
  }

  return mappings;
};

const getPageExtractionDims = (pageNumber, pageDimensions) =>
  (pageDimensions || []).find((d) => d.page === pageNumber) || null;

const scaleAxis = (value, srcAxis, dstAxis) => {
  if (value == null || !srcAxis || !dstAxis) return value;
  const ratio = dstAxis / srcAxis;
  return value * ratio;
};

const scaleMappingForPage = (mapping, page, pageDimensions) => {
  const src = getPageExtractionDims(mapping.page || 1, pageDimensions);
  if (!src) return mapping;

  const dstWidth = page.getWidth();
  const dstHeight = page.getHeight();

  return {
    ...mapping,
    inputX: scaleAxis(mapping.inputX, src.width, dstWidth),
    inputY: scaleAxis(mapping.inputY, src.height, dstHeight),
    yesX: scaleAxis(mapping.yesX, src.width, dstWidth),
    yesY: scaleAxis(mapping.yesY, src.height, dstHeight),
    noX: scaleAxis(mapping.noX, src.width, dstWidth),
    noY: scaleAxis(mapping.noY, src.height, dstHeight),
    reasonX: scaleAxis(mapping.reasonX, src.width, dstWidth),
    reasonY: scaleAxis(mapping.reasonY, src.height, dstHeight),
    reasonWidth: scaleAxis(mapping.reasonWidth, src.width, dstWidth),
    reasonHeight: scaleAxis(mapping.reasonHeight, src.height, dstHeight),
    width: scaleAxis(mapping.width, src.width, dstWidth),
    height: scaleAxis(mapping.height, src.height, dstHeight),
    fontSize: mapping.fontSize
      ? Math.max(
          8,
          Math.min(14, scaleAxis(mapping.fontSize, src.height, dstHeight)),
        )
      : mapping.fontSize,
  };
};

const CHECKBOX_SIZE = 8;
const CHECKBOX_X_NUDGE = 1.5;
const CHECKBOX_Y_NUDGE = -0.5;
let _fieldCounter = 0;
const uniqueFieldName = (prefix) =>
  `${prefix}_${Date.now()}_${++_fieldCounter}`;

const getImageMimeFromDataUrl = (dataUrl) => {
  const match = String(dataUrl || "").match(/^data:(image\/[a-zA-Z0-9.+-]+);/);
  return match?.[1] || "";
};

const dataUrlToUint8Array = (dataUrl) => {
  const base64 = String(dataUrl || "").split(",")[1] || "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const appendKycImageAttachmentsToPdf = async (
  pdfDoc,
  attachments = [],
  font,
  metadata = {},
) => {
  const validAttachments = attachments.filter((item) => item?.dataUrl);
  if (!validAttachments.length) return;

  const idAttachment = validAttachments.find((item) =>
    /pan|aadhaar|id/i.test(item.label || ""),
  );
  const liveAttachment = validAttachments.find((item) =>
    /head|toe|customer|live/i.test(item.label || ""),
  );

  if (idAttachment && liveAttachment) {
    try {
      const embed = async (attachment) => {
        const bytes = dataUrlToUint8Array(attachment.dataUrl);
        const mime = getImageMimeFromDataUrl(attachment.dataUrl);
        return mime === "image/png"
          ? await pdfDoc.embedPng(bytes)
          : await pdfDoc.embedJpg(bytes);
      };
      const idImage = await embed(idAttachment);
      const liveImage = await embed(liveAttachment);
      const page = pdfDoc.addPage([595.28, 841.89]);
      const pageWidth = page.getWidth();
      const pageHeight = page.getHeight();
      const margin = 42;
      const top = pageHeight - margin;
      const drawText = (text, x, y, size = 11) => {
        page.drawText(toPdfSafeText(text), {
          x,
          y,
          size,
          font,
          color: rgb(0.05, 0.08, 0.12),
        });
      };
      const fitImage = (image, boxX, boxY, boxW, boxH) => {
        const scale = Math.min(boxW / image.width, boxH / image.height);
        const width = image.width * scale;
        const height = image.height * scale;
        page.drawImage(image, {
          x: boxX + (boxW - width) / 2,
          y: boxY + (boxH - height) / 2,
          width,
          height,
        });
      };

      drawText("KYC Image Attachments", margin, top, 16);
      drawText("Customer Name", margin, top - 42, 11);
      drawText(metadata.customerName || "Not captured", margin + 150, top - 42, 11);
      drawText("Application No", margin, top - 68, 11);
      drawText(metadata.applicationNo || "Not captured", margin + 150, top - 68, 11);
      drawText("Captured Images", margin, top - 94, 11);
      drawText("ID document and head-to-toe photo", margin + 150, top - 94, 11);

      const boxY = 135;
      const boxW = (pageWidth - margin * 2 - 24) / 2;
      const boxH = 520;
      drawText("ID Document Photo:", margin, boxY + boxH + 18, 12);
      drawText("Head-to-toe Customer Photo:", margin + boxW + 24, boxY + boxH + 18, 12);
      page.drawRectangle({
        x: margin,
        y: boxY,
        width: boxW,
        height: boxH,
        borderColor: rgb(0.78, 0.82, 0.88),
        borderWidth: 1,
      });
      page.drawRectangle({
        x: margin + boxW + 24,
        y: boxY,
        width: boxW,
        height: boxH,
        borderColor: rgb(0.78, 0.82, 0.88),
        borderWidth: 1,
      });
      fitImage(idImage, margin + 8, boxY + 8, boxW - 16, boxH - 16);
      fitImage(liveImage, margin + boxW + 32, boxY + 8, boxW - 16, boxH - 16);
      return;
    } catch (err) {
      console.warn("Failed to append face match page:", err);
    }
  }

  for (const attachment of validAttachments) {
    try {
      const bytes = dataUrlToUint8Array(attachment.dataUrl);
      const mime = getImageMimeFromDataUrl(attachment.dataUrl);
      const image =
        mime === "image/png"
          ? await pdfDoc.embedPng(bytes)
          : await pdfDoc.embedJpg(bytes);

      const page = pdfDoc.addPage([595.28, 841.89]);
      const pageWidth = page.getWidth();
      const pageHeight = page.getHeight();
      const margin = 36;
      const titleHeight = 34;
      const maxWidth = pageWidth - margin * 2;
      const maxHeight = pageHeight - margin * 2 - titleHeight;
      const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
      const drawWidth = image.width * scale;
      const drawHeight = image.height * scale;
      const x = (pageWidth - drawWidth) / 2;
      const y = margin;

      page.drawText(toPdfSafeText(attachment.label, "KYC attachment"), {
        x: margin,
        y: pageHeight - margin - 14,
        size: 13,
        font,
        color: rgb(0.05, 0.08, 0.12),
      });
      page.drawImage(image, { x, y, width: drawWidth, height: drawHeight });
    } catch (err) {
      console.warn("Failed to append KYC image attachment:", err);
    }
  }
};

const toFieldId = (label, fallbackIndex) => {
  const base = String(label || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return base || `field_${fallbackIndex + 1}`;
};

const normalizeExtractedKycFields = (fields) => {
  const usedIds = new Set();

  return fields
    .filter((field) => !shouldSkipExtractedKycField(field))
    .map((field, index) => {
      const rawId = String(field?.id || "").trim();
      const label = String(field?.label || "").trim() || `Field ${index + 1}`;
      const type = String(field?.type || "").trim() || "text";
      const section = String(field?.section || "").trim() || "General";
      const genderRestriction =
        String(field?.genderRestriction || "all").trim() || "all";

      let safeId = rawId || toFieldId(label, index);
      let suffix = 2;
      while (usedIds.has(safeId)) {
        safeId = `${safeId}_${suffix++}`;
      }
      usedIds.add(safeId);

      return {
        ...field,
        id: safeId,
        label,
        type,
        section,
        genderRestriction,
      };
    });
};

const tokenOverlapScore = (a, b) => {
  const aTokens = new Set(normalize(a).split(" ").filter(Boolean));
  const bTokens = new Set(normalize(b).split(" ").filter(Boolean));
  let overlap = 0;
  aTokens.forEach((t) => {
    if (t.length > 2 && bTokens.has(t)) overlap += 1;
  });
  return overlap;
};

const isAffirmativeValue = (value) => {
  const v = String(value || "")
    .trim()
    .toLowerCase();
  return ["yes", "y", "true", "1", "checked"].includes(v);
};

const detectKycLanguage = (text) => {
  const t = String(text || "").trim();
  if (!t) return null;
  if (/[\u0900-\u097F]/.test(t)) return "hi";
  return "en";
};

const fillAcroFieldWithAnswer = (field, answer, fieldType = "text") => {
  const value = String(answer ?? "").trim();
  if (!value) return false;

  try {
    // For yes/no questions, avoid treating a single checkbox as a valid "No" target.
    // If "No", return false so coordinate fallback can place an explicit No mark.
    if (
      fieldType === "yes_no" &&
      typeof field.check === "function" &&
      typeof field.uncheck === "function"
    ) {
      if (isAffirmativeValue(value)) {
        field.check();
        return true;
      }
      return false;
    }

    if (typeof field.setText === "function") {
      const fittedValue = fitTextForAcroField(field, value);
      field.setText(fittedValue);
      if (typeof field.setFontSize === "function") {
        field.setFontSize(fittedValue.length > 18 ? 7 : 8);
      }
      return true;
    }

    if (
      typeof field.check === "function" &&
      typeof field.uncheck === "function"
    ) {
      if (isAffirmativeValue(value)) field.check();
      else field.uncheck();
      return true;
    }

    if (typeof field.select === "function") {
      field.select(value);
      return true;
    }
  } catch (err) {
    console.warn(
      `Acro field fill failed for ${field.getName?.() || "unknown"}:`,
      err,
    );
  }

  return false;
};

const getAcroFieldApproxWidth = (field) => {
  const rect = field?.acroField?.getWidgets?.()?.[0]?.getRectangle?.();
  return rect?.width || 0;
};

const fitTextForAcroField = (field, value = "") => {
  const safe = toPdfSafeText(value);
  const width = getAcroFieldApproxWidth(field);
  if (!width || safe.length <= 12) return safe;

  const maxChars = Math.max(8, Math.floor(width / 3.8));
  if (safe.length <= maxChars) return safe;
  return `${safe.slice(0, Math.max(5, maxChars - 3)).trim()}...`;
};

const fitTextForPdfBox = (value, width = 40, height = 14, font = null, fontSize = null) => {
  const safe = toPdfSafeText(value, KYC_UNCAPTURED_LABEL);
  const boxWidth = Number(width || 40);
  const boxHeight = Number(height || 14);
  const size = fontSize || getPdfBoxFontSize(safe, 6);
  const lineHeight = size + 0.45;
  const maxLines = Math.max(1, Math.floor(boxHeight / lineHeight));
  const textWidth = (text) => {
    try {
      return font ? font.widthOfTextAtSize(text, size) : String(text || "").length * size * 0.5;
    } catch {
      return String(text || "").length * size * 0.5;
    }
  };
  const trimWord = (word) => {
    let next = String(word || "").trim();
    while (next && textWidth(next) > boxWidth) {
      next = next.slice(0, -1).trimEnd();
    }
    return next;
  };
  const words = safe.split(/\s+/).filter(Boolean);
  const lines = [];
  let currentLine = "";

  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    if (textWidth(nextLine) <= boxWidth) {
      currentLine = nextLine;
      continue;
    }
    if (currentLine) lines.push(currentLine);
    currentLine = textWidth(word) <= boxWidth ? word : trimWord(word);
    if (lines.length >= maxLines) break;
  }

  if (currentLine && lines.length < maxLines) lines.push(currentLine);
  const fitted = lines.join("\n");
  if (lines.length < maxLines || words.join(" ") === fitted.replace(/\n/g, " ")) {
    return fitted;
  }

  const shortened = fitted.replace(/\s+$/g, "");
  return `${shortened.slice(0, Math.max(3, shortened.length - 3)).trim()}...`;
};

const getPdfBoxFontSize = (value, fallback = 8) => {
  const text = String(value || "");
  const length = text.replace(/\n/g, "").length;
  const lineCount = text.split("\n").length;
  if (lineCount > 2 || length > 32) return 3.7;
  if (lineCount > 1 || length > 22) return 4.2;
  if (length > 14) return 4.8;
  return fallback;
};

const getPdfTextWidth = (font, value, fontSize) => {
  try {
    return font ? font.widthOfTextAtSize(value, fontSize) : String(value || "").length * fontSize * 0.5;
  } catch {
    return String(value || "").length * fontSize * 0.5;
  }
};

const wrapPdfTextToBox = (value, font, fontSize, width, height, minFontSize = 3.2) => {
  const safe = toPdfSafeText(value, KYC_UNCAPTURED_LABEL)
    .replace(/\s+/g, " ")
    .trim();
  if (!safe) return { lines: [], fontSize };

  const boxWidth = Math.max(6, Number(width || 40));
  const boxHeight = Math.max(6, Number(height || 12));
  let size = Number(fontSize || 8);
  let bestLines = [];

  while (size >= minFontSize) {
    const lineHeight = size + 0.45;
    const maxLines = Math.max(1, Math.floor(boxHeight / lineHeight));
    const words = safe.split(/\s+/).filter(Boolean);
    const lines = [];
    let line = "";
    let consumed = 0;

    const trimToWidth = (word, suffix = "") => {
      let next = String(word || "").trim();
      while (next && getPdfTextWidth(font, `${next}${suffix}`, size) > boxWidth) {
        next = next.slice(0, -1).trimEnd();
      }
      return next ? `${next}${suffix}` : "";
    };

    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (getPdfTextWidth(font, next, size) <= boxWidth) {
        line = next;
        consumed += 1;
        continue;
      }
      if (line) {
        lines.push(line);
        line = "";
      }
      if (lines.length >= maxLines) break;
      line = getPdfTextWidth(font, word, size) <= boxWidth
        ? word
        : trimToWidth(word);
      consumed += 1;
    }

    if (line && lines.length < maxLines) lines.push(line);
    bestLines = lines;

    if (consumed >= words.length && lines.length <= maxLines) {
      return { lines, fontSize: size };
    }
    size -= 0.35;
  }

  if (bestLines.length) {
    const last = bestLines.length - 1;
    let shortened = bestLines[last];
    while (
      shortened &&
      getPdfTextWidth(font, `${shortened}...`, Math.max(minFontSize, size)) > boxWidth
    ) {
      shortened = shortened.slice(0, -1).trimEnd();
    }
    bestLines[last] = shortened ? `${shortened}...` : bestLines[last];
  }

  return { lines: bestLines, fontSize: minFontSize };
};

const drawTinyReasonText = (page, font, text, x, y, width, height) => {
  const textLength = String(text || "").replace(/\s+/g, " ").trim().length;
  const baseFontSize =
    textLength <= 12 ? 5.8 :
    textLength <= 22 ? 5.0 :
    textLength <= 36 ? 4.2 :
    3.4;
  const { lines, fontSize } = wrapPdfTextToBox(
    text,
    font,
    baseFontSize,
    width,
    height,
    2.8,
  );
  const lineHeight = fontSize + 0.25;
  const maxLines = Math.max(1, Math.floor(Number(height || 12) / lineHeight));

  lines.slice(0, maxLines).forEach((lineText, index) => {
    if (!lineText) return;
    page.drawText(lineText, {
      x,
      y: y + height - fontSize - 1 - index * lineHeight,
      size: fontSize,
      font,
      color: rgb(0.02, 0.03, 0.04),
    });
  });
};

const getReasonDrawBox = (scaled, pageHeight) => {
  const rawWidth = Number(scaled.reasonWidth || 40);
  const rawHeight = Number(scaled.reasonHeight || 14);
  const inset = 3.6;
  const x = Math.max(0, Number(scaled.reasonX || 0) + inset);
  const y =
    pageHeight -
    Number(scaled.reasonY || 0) -
    rawHeight +
    inset;
  const width = Math.max(8, rawWidth - inset * 2);
  const height = Math.max(8, rawHeight - inset * 2);

  return { x, y, width, height };
};

const drawMappedPdfText = (page, font, value, scaled, pageHeight) => {
  const fittedText = fitTextForPdfBox(
    value,
    scaled.width || 200,
    scaled.height || 14,
    font,
    scaled.fontSize || 9,
  );
  const { lines, fontSize } = wrapPdfTextToBox(
    fittedText,
    font,
    scaled.fontSize || 9,
    scaled.width || 200,
    scaled.height || 14,
    3.2,
  );
  if (!lines.length) return;
  const x = Number(scaled.inputX || 0);
  const lineHeight = fontSize + 0.45;
  const topY = pageHeight - Number(scaled.inputY || 0);
  lines.forEach((lineText, index) => {
    page.drawText(toPdfSafeText(lineText, KYC_UNCAPTURED_LABEL), {
      x,
      y: topY - fontSize - 1 - index * lineHeight,
      size: fontSize,
      font,
      color: rgb(0.02, 0.03, 0.04),
    });
  });
};

const drawPresetPageTwoLabelFixes = (pages, font) => {
  const page = pages?.[1];
  if (!page) return;
};

const setTextAcroFieldValue = (field, value = "") => {
  if (!field || typeof field.setText !== "function") return false;

  try {
    const fittedValue = fitTextForAcroField(field, value);
    field.setText(fittedValue);
    if (typeof field.setFontSize === "function") {
      field.setFontSize(fittedValue.length > 18 ? 7 : 8);
    }
    return true;
  } catch (err) {
    console.warn(
      `Acro text fill failed for ${field.getName?.() || "unknown"}:`,
      err,
    );
    return false;
  }
};

const getAcroWidgetPlacement = (field, pages = []) => {
  const widget = field?.acroField?.getWidgets?.()?.[0];
  const rect = widget?.getRectangle?.();
  const pageRef = widget?.P?.();
  if (!rect) return null;

  const page =
    pages.find((candidatePage) => candidatePage.ref === pageRef) ||
    pages[0] ||
    null;
  if (!page) return null;

  return { page, rect };
};

const drawCheckMarkInRect = (page, rect) => {
  if (!page || !rect) return false;

  const x = rect.x;
  const y = rect.y;
  const width = rect.width || 12;
  const height = rect.height || 12;

  page.drawLine({
    start: { x: x + width * 0.2, y: y + height * 0.45 },
    end: { x: x + width * 0.42, y: y + height * 0.2 },
    thickness: 1.8,
    color: rgb(0, 0, 0),
  });
  page.drawLine({
    start: { x: x + width * 0.42, y: y + height * 0.2 },
    end: { x: x + width * 0.8, y: y + height * 0.78 },
    thickness: 1.8,
    color: rgb(0, 0, 0),
  });

  return true;
};

const PDF_DIRECT_FILL_SKIP_FIELD_IDS = new Set([
  "height_cm",
  "weight_kg",
  "habits_addictions",
  "existing_insurance_cover",
  "all_life_cover",
  "all_ci_cover",
]);

const fillNamedKycAcroFields = (form, pages, fields, responses) => {
  const fieldsByName = new Map(
    form.getFields().map((field) => [field.getName?.() || "", field]),
  );
  const matchedFieldIds = new Set();
  let filledCount = 0;

  fields.forEach((field) => {
    if (PDF_DIRECT_FILL_SKIP_FIELD_IDS.has(field.id)) return;
    const answer = String(responses[field.id] ?? "").trim();
    if (!answer) return;

    if (field.acroFieldName) {
      const acroField = fieldsByName.get(field.acroFieldName);
      if (!acroField) return;

      if (setTextAcroFieldValue(acroField, getKycPdfFillValue(field, answer))) {
        matchedFieldIds.add(field.id);
        filledCount += 1;
      }
      if (field.acroYesFieldName || field.acroNoFieldName) {
        setTextAcroFieldValue(fieldsByName.get(field.acroNoFieldName), "");
        const yesField = fieldsByName.get(field.acroYesFieldName);
        const placement = getAcroWidgetPlacement(yesField, pages);
        if (placement) {
          drawCheckMarkInRect(placement.page, placement.rect);
        } else {
          setTextAcroFieldValue(yesField, PDF_CHECK_MARK);
        }
      }
      return;
    }

    if (
      field.acroYesFieldName ||
      field.acroNoFieldName ||
      field.acroReasonFieldName
    ) {
      const yesField = fieldsByName.get(field.acroYesFieldName);
      const noField = fieldsByName.get(field.acroNoFieldName);
      const reasonField = fieldsByName.get(field.acroReasonFieldName);
      if (!yesField && !noField && !reasonField) return;
      if (isUncapturedKycValue(answer)) {
        setTextAcroFieldValue(yesField, "");
        setTextAcroFieldValue(noField, "");
        setTextAcroFieldValue(reasonField, "");
        matchedFieldIds.add(field.id);
        filledCount += 1;
        return;
      }
      const isYes = answer === "Yes";
      const rawReasonValue =
        isYes && field.reasonResponseId ? responses[field.reasonResponseId] : "";
      const reasonValue =
        rawReasonValue && !isUncapturedLikeKycValue(rawReasonValue)
          ? extractReasonFromAffirmativeAnswer(
              getKycPdfFillValue({ type: "text" }, rawReasonValue),
            )
          : "";

      if (
        typeof yesField?.check === "function" &&
        typeof yesField?.uncheck === "function"
      ) {
        yesField.uncheck();
      } else {
        setTextAcroFieldValue(yesField, "");
      }
      if (
        typeof noField?.check === "function" &&
        typeof noField?.uncheck === "function"
      ) {
        noField.uncheck();
      } else {
        setTextAcroFieldValue(noField, "");
      }
      setTextAcroFieldValue(reasonField, "");

      const targetField = isYes ? yesField : noField;
      const placement = getAcroWidgetPlacement(targetField, pages);
      let targetFilled = false;
      if (
        typeof targetField?.check === "function" &&
        typeof targetField?.uncheck === "function"
      ) {
        targetField.check();
        targetFilled = true;
      } else if (placement) {
        targetFilled = drawCheckMarkInRect(placement.page, placement.rect);
      } else {
        targetFilled = setTextAcroFieldValue(targetField, PDF_CHECK_MARK);
      }

      if (targetFilled) {
        matchedFieldIds.add(field.id);
        filledCount += 1;
      }
    }
  });

  return { count: filledCount, matchedFieldIds };
};

const fillExistingAcroFormFields = (
  form,
  fields,
  responses,
  mappings = [],
  pageDimensions = [],
) => {
  const acroFields = form.getFields();
  if (!acroFields.length) return { count: 0, matchedFieldIds: new Set() };

  const pageHeightByPage = new Map(
    (pageDimensions || []).map((p) => [p.page, p.height]),
  );
  const mappingByFieldId = new Map((mappings || []).map((m) => [m.fieldId, m]));

  const candidates = acroFields.map((field, index) => ({
    index,
    field,
    name: field.getName?.() || "",
    widgetRect: field.acroField?.getWidgets?.()?.[0]?.getRectangle?.() || null,
    kind:
      typeof field.setText === "function"
        ? "text"
        : typeof field.check === "function" &&
            typeof field.uncheck === "function"
          ? "checkbox"
          : typeof field.select === "function"
            ? "choice"
            : "unknown",
  }));
  const unused = new Set(candidates.map((c) => c.index));

  const answered = fields
    .map((f, order) => ({ field: f, answer: responses[f.id], order }))
    .filter(
      (x) =>
        x.answer !== undefined &&
        x.answer !== null &&
        String(x.answer).trim() !== "",
    );

  const assignments = [];
  const matchedFieldIds = new Set();

  for (const item of answered) {
    const target = `${item.field.label || ""} ${item.field.id || ""}`;
    let bestScore = -1;
    let bestIndex = null;

    for (const candidate of candidates) {
      if (!unused.has(candidate.index)) continue;

      const name = candidate.name;
      let score = 0;
      const normTarget = normalize(target);
      const normName = normalize(name);

      if (normName && normTarget === normName) score = 100;
      else if (
        normName &&
        (normName.includes(normTarget) || normTarget.includes(normName))
      )
        score = 75;
      else score = tokenOverlapScore(normTarget, normName) * 10;

      if (score > bestScore) {
        bestScore = score;
        bestIndex = candidate.index;
      }
    }

    if (bestIndex !== null && bestScore >= 20) {
      assignments.push({ item, candidate: candidates[bestIndex] });
      unused.delete(bestIndex);
    }
  }

  // Pass 2: geometry fallback for unresolved fields (using local mapping coords)
  const unresolved = answered.filter(
    (item) => !assignments.some((a) => a.item.field.id === item.field.id),
  );
  for (const item of unresolved) {
    const mapping = mappingByFieldId.get(item.field.id);
    if (!mapping) continue;

    const pageHeight = pageHeightByPage.get(mapping.page || 1) || 842;
    const targetX =
      mapping.type === "yes_no"
        ? mapping.yesX != null
          ? mapping.yesX
          : mapping.inputX || 0
        : mapping.inputX || 0;
    const targetYTop =
      mapping.type === "yes_no"
        ? mapping.yesY != null
          ? mapping.yesY
          : mapping.inputY || 0
        : mapping.inputY || 0;
    const targetY = pageHeight - targetYTop;

    let bestIndex = null;
    let bestScore = -1;
    for (const candidate of candidates) {
      if (!unused.has(candidate.index)) continue;
      if (!candidate.widgetRect) continue;

      // Soft type compatibility boosts precision for checkbox/text fields
      let typeBonus = 0;
      if (mapping.type === "yes_no" && candidate.kind === "checkbox")
        typeBonus = 40;
      if (mapping.type !== "yes_no" && candidate.kind === "text")
        typeBonus = 25;
      if (candidate.kind === "unknown") typeBonus = -15;

      const cx = candidate.widgetRect.x + (candidate.widgetRect.width || 0) / 2;
      const cy =
        candidate.widgetRect.y + (candidate.widgetRect.height || 0) / 2;
      const dx = Math.abs(cx - targetX);
      const dy = Math.abs(cy - targetY);
      const distancePenalty = (dx + dy) / 6;
      const score = 120 - distancePenalty + typeBonus;

      if (score > bestScore) {
        bestScore = score;
        bestIndex = candidate.index;
      }
    }

    if (bestIndex !== null && bestScore >= 15) {
      assignments.push({ item, candidate: candidates[bestIndex] });
      unused.delete(bestIndex);
    }
  }

  let filledCount = 0;
  assignments.forEach(({ item, candidate }) => {
    if (
      fillAcroFieldWithAnswer(candidate.field, item.answer, item.field.type)
    ) {
      filledCount += 1;
      matchedFieldIds.add(item.field.id);
    }
  });

  return { count: filledCount, matchedFieldIds };
};

// Helper function to render text with **bold** markdown
const renderTextWithBold = (text) => {
  if (!text) return null;
  const parts = text.split(new RegExp("(\\*\\*.*?\\*\\*)", "g"));
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
};

async function callOpenAI(messages) {
  const response = await fetch(`${API_BASE}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });

  const text = await response.text();
  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Backend did not return JSON. Is the server running?");
  }

  if (!response.ok || data.error) {
    throw new Error(data.error || "AI request failed");
  }

  return data.content;
}

const DISCHARGE_QUESTION_COUNT = 24;
const CARE_PLAN_QUESTION_COUNT = 24;

const buildConditionList = (autoConditions = [], manualConditionsText = "") => {
  const manualConditions = String(manualConditionsText || "")
    .split(",")
    .map((condition) => condition.trim())
    .filter(Boolean);

  return [
    ...new Set(
      [...autoConditions, ...manualConditions]
        .map((condition) => String(condition || "").trim())
        .filter(Boolean),
    ),
  ];
};

const buildConditionContext = (conditions = []) =>
  conditions.length
    ? `Pre-existing conditions to cover: ${conditions.join(", ")}`
    : "No explicit pre-existing conditions were extracted. Infer the most important follow-up topics from the discharge summary.";

const buildDischargeQuestionSystemPrompt = (
  questionCount = DISCHARGE_QUESTION_COUNT,
) => `
You are a healthcare AI assistant creating nurse follow-up questions from a patient discharge summary.

Generate EXACTLY ${questionCount} distinct follow-up questions.

Formatting requirements:
- Organize the response into these four sections only:
  1. Medications
  2. Symptoms
  3. Lifestyle
  4. Warning Signs
- Write exactly ${questionCount / 4} numbered questions in each section.
- Respond in plain text only.

Content requirements:
- Base the questions on the discharge summary, diagnoses, medications, instructions, and any listed pre-existing conditions.
- If the summary is sparse, add safe general recovery questions so the total still reaches ${questionCount}.
- Keep every question concise, patient-friendly, and suitable for a nurse follow-up call.
- Avoid duplicates and avoid vague filler questions.
`;

const parseCarePlanResponse = (aiMessage) => {
  try {
    return JSON.parse(aiMessage);
  } catch {
    const start = aiMessage.indexOf("{");
    const end = aiMessage.lastIndexOf("}");

    if (start === -1 || end === -1) {
      console.error("Raw AI response:", aiMessage);
      throw new Error("No valid JSON found in care plan response");
    }

    return JSON.parse(aiMessage.slice(start, end + 1));
  }
};

// === CARELY QA SYSTEM PROMPT ===
const SYSTEM_PROMPT = `
You are a healthcare quality assurance AI for Carely Health.

Your responsibilities:
- Analyze nurseâ€“patient call transcripts
- Compare nurse statements with discharge instructions
- Identify:
  â€¢ Unsafe medical advice
  â€¢ Statements outside nursing scope
  â€¢ Contradictions to discharge instructions
  â€¢ Dismissive or misleading language
- Quote problematic nurse statements
- Explain why each is an issue
- Suggest safer, policy-compliant alternatives

Formatting rules (IMPORTANT):
- Do NOT use markdown headings
- Do NOT use ### or ##
- Use plain text labels like:
  "1. Call Summary:"
  "2. Patient Concerns:"
- Use bullet points with "-" only
- Use **bold** only when emphasis is needed

Content rules:
- Do not diagnose
- Do not invent facts
- Quote problematic nurse statements exactly
- Suggest safer alternatives

Rules:
- Do not diagnose
- Do not invent facts
- If something is not in the transcript, say so
- This is for internal quality review only
`;

const KycImageCapture = ({
  title,
  subtitle,
  captureLabel = "Capture photo",
  facingMode = "environment",
  captureType = "generic",
  autoCapture = true,
  onComplete,
  onSkip,
}) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const motionCanvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const streamRef = useRef(null);
  const autoCaptureTimerRef = useRef(null);
  const autoCompleteTimerRef = useRef(null);
  const autoStatusRef = useRef(0);
  const [preview, setPreview] = useState("");
  const [status, setStatus] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [isAutoCapturing, setIsAutoCapturing] = useState(false);
  const autoCaptureStartedAtRef = useRef(Date.now());

  const stopCamera = () => {
    streamRef.current?.getTracks?.().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  useEffect(
    () => () => {
      stopCamera();
      if (autoCaptureTimerRef.current) window.clearInterval(autoCaptureTimerRef.current);
      if (autoCompleteTimerRef.current) window.clearTimeout(autoCompleteTimerRef.current);
    },
    [],
  );

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("Camera is not available. Please upload a photo.");
      return;
    }

    setIsStarting(true);
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 960 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      autoCaptureStartedAtRef.current = Date.now();
      setStatus(autoCapture ? "Hold steady. Auto-capture will run when the image is clear." : "");
    } catch (err) {
      setStatus(err.message || "Could not start camera. Please upload a photo.");
    } finally {
      setIsStarting(false);
    }
  };

  useEffect(() => {
    startCamera();
  }, []);

  const analyzeCanvasQuality = (canvas) => {
    const width = canvas.width;
    const height = canvas.height;
    const ctx = canvas.getContext("2d");
    const sampleWidth = 120;
    const sampleHeight = Math.max(1, Math.round((height / width) * sampleWidth));
    const sampleCanvas = document.createElement("canvas");
    sampleCanvas.width = sampleWidth;
    sampleCanvas.height = sampleHeight;
    const sampleCtx = sampleCanvas.getContext("2d");
    sampleCtx.drawImage(canvas, 0, 0, sampleWidth, sampleHeight);
    const pixels = sampleCtx.getImageData(0, 0, sampleWidth, sampleHeight).data;
    let brightness = 0;
    let contrast = 0;
    let sharpness = 0;
    let glarePixels = 0;
    let count = 0;
    const lumas = [];

    for (let i = 0; i < pixels.length; i += 4) {
      const luma = pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114;
      brightness += luma;
      if (luma > 245) glarePixels += 1;
      lumas.push(luma);
      count += 1;
    }

    brightness /= count || 1;
    for (let y = 1; y < sampleHeight; y += 1) {
      for (let x = 1; x < sampleWidth; x += 1) {
        const index = y * sampleWidth + x;
        const horizontal = Math.abs(lumas[index] - lumas[index - 1]);
        const vertical = Math.abs(lumas[index] - lumas[index - sampleWidth]);
        sharpness += horizontal + vertical;
        contrast += Math.abs(lumas[index] - brightness);
      }
    }

    const comparablePixels = Math.max(1, (sampleWidth - 1) * (sampleHeight - 1));
    return {
      width,
      height,
      brightness,
      contrast: contrast / comparablePixels,
      sharpness: sharpness / comparablePixels,
      glareRatio: glarePixels / Math.max(1, count),
      pixels,
      sampleWidth,
      sampleHeight,
    };
  };

  const getForegroundBounds = ({ pixels, sampleWidth, sampleHeight }) => {
    const cornerPoints = [
      [3, 3],
      [sampleWidth - 4, 3],
      [3, sampleHeight - 4],
      [sampleWidth - 4, sampleHeight - 4],
    ];
    const cornerLumas = cornerPoints.map(([x, y]) => {
      const index = (y * sampleWidth + x) * 4;
      return pixels[index] * 0.299 + pixels[index + 1] * 0.587 + pixels[index + 2] * 0.114;
    });
    const background = cornerLumas.reduce((sum, value) => sum + value, 0) / cornerLumas.length;
    let minX = sampleWidth;
    let minY = sampleHeight;
    let maxX = 0;
    let maxY = 0;
    let count = 0;

    for (let y = 0; y < sampleHeight; y += 1) {
      for (let x = 0; x < sampleWidth; x += 1) {
        const index = (y * sampleWidth + x) * 4;
        const luma = pixels[index] * 0.299 + pixels[index + 1] * 0.587 + pixels[index + 2] * 0.114;
        if (Math.abs(luma - background) < 20) continue;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        count += 1;
      }
    }

    if (!count) return null;
    return {
      xRatio: minX / sampleWidth,
      yRatio: minY / sampleHeight,
      widthRatio: (maxX - minX + 1) / sampleWidth,
      heightRatio: (maxY - minY + 1) / sampleHeight,
      coverageRatio: count / (sampleWidth * sampleHeight),
    };
  };

  const getCenterBodyPresence = ({ pixels, sampleWidth, sampleHeight }) => {
    const leftX = Math.floor(sampleWidth * 0.08);
    const rightX = Math.floor(sampleWidth * 0.92);
    let background = 0;
    let backgroundCount = 0;
    for (let y = 0; y < sampleHeight; y += 2) {
      [leftX, rightX].forEach((x) => {
        const index = (y * sampleWidth + x) * 4;
        background += pixels[index] * 0.299 + pixels[index + 1] * 0.587 + pixels[index + 2] * 0.114;
        backgroundCount += 1;
      });
    }
    background /= Math.max(1, backgroundCount);

    const centerMinX = Math.floor(sampleWidth * 0.33);
    const centerMaxX = Math.ceil(sampleWidth * 0.67);
    const bands = [
      [0.18, 0.42],
      [0.42, 0.68],
      [0.68, 0.94],
      [0.82, 0.99],
    ];

    return bands.map(([from, to]) => {
      const startY = Math.floor(sampleHeight * from);
      const endY = Math.ceil(sampleHeight * to);
      let foreground = 0;
      let total = 0;
      for (let y = startY; y < endY; y += 1) {
        for (let x = centerMinX; x < centerMaxX; x += 1) {
          const index = (y * sampleWidth + x) * 4;
          const luma = pixels[index] * 0.299 + pixels[index + 1] * 0.587 + pixels[index + 2] * 0.114;
          if (Math.abs(luma - background) > 22) foreground += 1;
          total += 1;
        }
      }
      return foreground / Math.max(1, total);
    });
  };

  const checkImageQuality = (canvas) => {
    const metrics = analyzeCanvasQuality(canvas);
    if (metrics.width < 640 || metrics.height < 480) {
      return "The picture is too small. Please move closer and retake it.";
    }

    if (captureType === "id" && metrics.width < 960) {
      return "Move closer to the ID card so the text is readable.";
    }
    if (metrics.brightness < 45) return "The picture is too dark. Please use more light.";
    if (metrics.brightness > 235) return "The picture is overexposed. Please reduce glare and retake it.";
    if (metrics.glareRatio > 0.08) return "Too much glare is visible. Tilt slightly and retake it.";
    const minimumContrast = captureType === "fullBody" ? 7 : 16;
    const minimumSharpness = captureType === "fullBody" ? 3.5 : 9;
    if (metrics.contrast < minimumContrast || metrics.sharpness < minimumSharpness) {
      return "The picture is not clear enough. Please hold steady and retake it.";
    }

    if (captureType === "fullBody") {
      const bounds = getForegroundBounds(metrics);
      if (!bounds) {
        return "Stand fully inside the frame before capturing.";
      }
      if (bounds.coverageRatio < 0.02) {
        return "Stand fully inside the frame before capturing.";
      }
      if (bounds.heightRatio < 0.3 || bounds.yRatio > 0.45 || bounds.yRatio + bounds.heightRatio < 0.55) {
        return "Head-to-toe is not fully visible. Step back until the whole body is in frame.";
      }
      const [upper, middle, lower, feet] = getCenterBodyPresence(metrics);
      if (upper < 0.025 || middle < 0.035 || lower < 0.025 || feet < 0.015) {
        return "Head-to-toe is not fully visible. Stand centered and step back until feet are visible.";
      }
    }

    return "";
  };

  const getMotionScore = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return 99;
    const canvas = motionCanvasRef.current || document.createElement("canvas");
    motionCanvasRef.current = canvas;
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const current = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const previous = canvas.__previousFrame;
    canvas.__previousFrame = new Uint8ClampedArray(current);
    if (!previous) return 99;

    let delta = 0;
    for (let i = 0; i < current.length; i += 16) {
      delta +=
        Math.abs(current[i] - previous[i]) +
        Math.abs(current[i + 1] - previous[i + 1]) +
        Math.abs(current[i + 2] - previous[i + 2]);
    }
    return delta / (current.length / 16);
  };

  const captureFromVideo = ({ auto = false, ignoreMotion = false } = {}) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) {
      if (!auto) setStatus("Camera is still starting. Please try again.");
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const qualityMessage = checkImageQuality(canvas);
    if (qualityMessage) {
      if (!auto || Date.now() - autoStatusRef.current > 1500) {
        setStatus(qualityMessage);
        autoStatusRef.current = Date.now();
      }
      return;
    }

    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setPreview(dataUrl);
    if (auto) {
      setIsAutoCapturing(true);
      setStatus(
        ignoreMotion
          ? "Clear image captured automatically."
          : "Clear stable image captured automatically.",
      );
      autoCompleteTimerRef.current = window.setTimeout(() => {
        onComplete?.(dataUrl);
      }, 350);
    } else {
      setStatus("Photo looks clear.");
    }
  };

  useEffect(() => {
    if (!autoCapture || preview || isStarting) return undefined;

    let stableFrames = 0;
    let waitingFrames = 0;
    let clearFrames = 0;
    const minimumAutoCaptureMs = captureType === "id" ? 4200 : 1800;
    const requiredClearFrames = captureType === "id" ? 7 : captureType === "fullBody" ? 5 : 3;
    const requiredStableFrames = captureType === "id" ? 5 : 3;
    autoCaptureTimerRef.current = window.setInterval(() => {
      const motionScore = getMotionScore();
      const video = videoRef.current;
      const canvas = canvasRef.current;
      let hasClearFrame = false;
      if (video && canvas && video.videoWidth) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
        const qualityMessage = checkImageQuality(canvas);
        hasClearFrame = !qualityMessage;
        if (qualityMessage && Date.now() - autoStatusRef.current > 1500) {
          setStatus(qualityMessage);
          autoStatusRef.current = Date.now();
        }
      }

      clearFrames = hasClearFrame ? clearFrames + 1 : 0;
      if (motionScore < 8) {
        stableFrames += 1;
        if (stableFrames === 1) {
          setStatus("Hold still. Checking image clarity...");
        }
      } else {
        stableFrames = 0;
        waitingFrames += 1;
        if (!hasClearFrame && waitingFrames % 4 === 0) {
          setStatus("Auto-capture is waiting for the camera to be steady.");
        }
      }

      const waitedLongEnough = Date.now() - autoCaptureStartedAtRef.current >= minimumAutoCaptureMs;
      if (waitedLongEnough && stableFrames >= requiredStableFrames && clearFrames >= Math.min(3, requiredClearFrames)) {
        captureFromVideo({ auto: true });
        stableFrames = 0;
      } else if (waitedLongEnough && clearFrames >= requiredClearFrames) {
        captureFromVideo({ auto: true, ignoreMotion: true });
        clearFrames = 0;
        stableFrames = 0;
      }
    }, 700);

    return () => {
      if (autoCaptureTimerRef.current) {
        window.clearInterval(autoCaptureTimerRef.current);
        autoCaptureTimerRef.current = null;
      }
    };
  }, [autoCapture, isStarting, preview]);

  const handleFileSelected = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext("2d").drawImage(img, 0, 0);
        const qualityMessage = checkImageQuality(canvas);
        if (qualityMessage) {
          setPreview("");
          setStatus(qualityMessage);
          return;
        }
        const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
        setPreview(dataUrl);
        setStatus("Photo looks clear.");
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex h-full w-full items-center justify-center bg-slate-950 p-3 sm:p-6">
      <div className="relative h-full max-h-[760px] w-full max-w-5xl overflow-hidden rounded-[28px] border border-white/10 bg-slate-900 text-slate-100 shadow-2xl">
        <div className="absolute left-0 right-0 top-0 z-20 flex flex-col gap-2 bg-gradient-to-b from-black/70 to-transparent px-5 py-5 sm:px-7">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="m-0 text-lg font-bold leading-tight sm:text-2xl">{title}</h2>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-300 sm:text-sm">
                {subtitle}
              </p>
            </div>
            <div className="hidden rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-200 sm:block">
              Auto capture
            </div>
          </div>
        </div>

        <div className="relative h-full min-h-[520px] w-full bg-black">
          {preview ? (
            <img src={preview} alt={title} className="h-full w-full object-contain" />
          ) : (
            <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
          )}

          {!preview && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div
                className={
                  captureType === "id"
                    ? "h-[42%] w-[82%] rounded-2xl border-2 border-dashed border-white/70 shadow-[0_0_0_999px_rgba(2,6,23,0.28)] sm:w-[58%]"
                    : "h-[76%] w-[44%] rounded-[999px] border-2 border-dashed border-white/70 shadow-[0_0_0_999px_rgba(2,6,23,0.24)] sm:w-[28%]"
                }
              />
            </div>
          )}

          <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/80 to-transparent px-5 py-5 sm:px-7">
            <div className="mx-auto flex max-w-3xl items-center justify-center rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-center text-sm font-semibold text-amber-200 backdrop-blur">
              {isStarting
                ? "Starting camera..."
                : preview
                  ? "Clear image captured. Moving to the next step..."
                  : status || "Hold steady inside the guide. Capture runs automatically."}
            </div>
            {status.toLowerCase().includes("camera") && !preview && (
              <div className="mt-3 flex justify-center gap-3">
                <button
                  type="button"
                  className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-xs font-bold text-slate-100"
                  onClick={startCamera}
                >
                  Retry camera
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-xs font-bold text-slate-100"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Upload fallback
                </button>
              </div>
            )}
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture={facingMode}
          style={{ display: "none" }}
          onChange={handleFileSelected}
        />
        <canvas ref={canvasRef} style={{ display: "none" }} />
      </div>
    </div>
  );
};

const CarelyAIAssistant = () => {
  const [preferredLanguage, setPreferredLanguage] = useState("en");

  const [activeTab, setActiveTab] = useState("voice");

  // Call Analysis State
  const [callFile, setCallFile] = useState(null);
  const [callTranscript, setCallTranscript] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Discharge Summary State
  const [dischargeFile, setDischargeFile] = useState(null);
  const [dischargeSummary, setDischargeSummary] = useState("");
  const [preExistingConditions, setPreExistingConditions] = useState([]);
  const [hospitalLogo, setHospitalLogo] = useState(null);
  const [manualConditions, setManualConditions] = useState("");
  const [hospitalName, setHospitalName] = useState("");
  const [hospitalLogoUrl, setHospitalLogoUrl] = useState("");
  const [careQuestions, setCareQuestions] = useState(null);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [dischargeChatMessages, setDischargeChatMessages] = useState([]);
  const [dischargeChatInput, setDischargeChatInput] = useState("");
  const [isDischargeChatLoading, setIsDischargeChatLoading] = useState(false);

  // Voice Assistant State
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [voiceMessages, setVoiceMessages] = useState([]);
  const [voiceStatus, setVoiceStatus] = useState("idle");

  // KYC Assistant State
  const [kycFile, setKycFile] = useState(null);
  const [kycFields, setKycFields] = useState([]);
  const kycFieldsRef = useRef([]);
  const [kycResponses, setKycResponses] = useState({});
  const [kycCurrentFieldIndex, setKycCurrentFieldIndex] = useState(0);
  const [kycChatMessages, setKycChatMessages] = useState([]);
  const [kycChatInput, setKycChatInput] = useState("");
  const [isKycLoading, setIsKycLoading] = useState(false);
  const [kycComplete, setKycComplete] = useState(false);
  const [isExtractingFields, setIsExtractingFields] = useState(false);
  const [kycLoadError, setKycLoadError] = useState("");
  const [kycDocumentText, setKycDocumentText] = useState("");
  const [kycFieldMappings, setKycFieldMappings] = useState([]);
  const [kycPdfBytes, setKycPdfBytes] = useState(null);
  const [kycPageDimensions, setKycPageDimensions] = useState([]);
  const kycChatEndRef = useRef(null);
  const kycLiveTranscriptEndRef = useRef(null);
  const kycPdfBytesRef = useRef(null);

  // Care Plan Assessment State
  const [carePlan, setCarePlan] = useState(null);
  const [carePlanResponses, setCarePlanResponses] = useState({});
  const [carePlanAlerts, setCarePlanAlerts] = useState([]);
  const [isGeneratingCarePlan, setIsGeneratingCarePlan] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [assessmentComplete, setAssessmentComplete] = useState(false);
  const carePlanEndRef = useRef(null);

  const chatEndRef = useRef(null);
  const dischargeChatEndRef = useRef(null);
  const callFileInputRef = useRef(null);
  const dischargeFileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const [kycSpeaking, setKycSpeaking] = useState(false);
  const [kycListening, setKycListening] = useState(false);
  const [kycThinking, setKycThinking] = useState(false);
  const [kycTranscriptPreview, setKycTranscriptPreview] = useState("");
  const [beyondPresenceSession, setBeyondPresenceSession] = useState(null);
  const [isConnectingAvatar, setIsConnectingAvatar] = useState(false);
  const [isAvatarConnected, setIsAvatarConnected] = useState(false);
  const [avatarConnectionBlockedMessage, setAvatarConnectionBlockedMessage] =
    useState("");
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isPeopleOpen, setIsPeopleOpen] = useState(false);
  const [cameraDevices, setCameraDevices] = useState([]);
  const [selectedCameraDeviceId, setSelectedCameraDeviceId] = useState("");
  const [panCaptureComplete, setPanCaptureComplete] = useState(true);
  const [panOcrData, setPanOcrData] = useState(null);
  const [idCaptureComplete, setIdCaptureComplete] = useState(false);
  const [idDocumentPhoto, setIdDocumentPhoto] = useState("");
  const [fullBodyCaptureComplete, setFullBodyCaptureComplete] = useState(false);
  const [fullBodyPhoto, setFullBodyPhoto] = useState("");
  const [kycImageCaptureStage, setKycImageCaptureStage] = useState("idle");
  const [autoCaptureStatus, setAutoCaptureStatus] = useState("");
  const [isRecordingCall, setIsRecordingCall] = useState(false);
  const [callRecordingBlob, setCallRecordingBlob] = useState(null);
  const [callVideoRecordingBlob, setCallVideoRecordingBlob] = useState(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [callTranscription, setCallTranscription] = useState("");

  const currentAudioRef = useRef(null);
  const currentAudioUrlRef = useRef(null);
  const pendingRecordingDownloadRef = useRef(null);
  const kycTurnLockRef = useRef(false);
  const lastAnswerTimestampRef = useRef(0);
  const ANSWER_COOLDOWN_MS = 1800;  
  const kycCurrentFieldIndexRef = useRef(0);
  const kycResponsesRef = useRef({});
  const kycCompleteRef = useRef(false);
  const lastCommittedFieldRef = useRef(null);
  const lastCommittedTranscriptRef = useRef(null);
  const lastAgentAskedFieldRef = useRef(null);
  const agentTranscriptTurnRef = useRef(0);
  const pendingClarificationTargetRef = useRef(null);
  const pendingReasonFieldRef = useRef(null);
  const pendingNameSpellingRef = useRef(null);
  const pendingDurationFragmentRef = useRef(null);
  const lastUserTranscriptRef = useRef(null);
  const recentReasonCarryoverRef = useRef(null);
  const ignoredAgentFollowUpRef = useRef(null);
  const transcriptHandlerRefs = useRef({ onUser: null, onAgent: null });
  const processedTranscriptKeysRef = useRef(new Set());
  const transcriptMessageKeysRef = useRef(new Set());
  const recentTranscriptFingerprintsRef = useRef(new Map());
  const beyondPresenceRoomRef = useRef(null);
  const callSurfaceRef = useRef(null);
  const userVideoRef = useRef(null);
  const kycImageCaptureStageStartedAtRef = useRef(0);
  const autoCaptureFrameRef = useRef(null);
  const autoCaptureTimerRef = useRef(null);
  const callRecorderRef = useRef(null);
  const callVideoRecorderRef = useRef(null);
  const callAudioChunksRef = useRef([]);
  const callVideoChunksRef = useRef([]);
  const callRecordingAudioContextRef = useRef(null);
  const callRecordingDestinationRef = useRef(null);
  const callRecordingSourcesRef = useRef([]);
  const callRecordingTrackIdsRef = useRef(new Set());
  const callRecordingConnectTrackRef = useRef(null);
  const callRecordingCanvasRef = useRef(null);
  const callRecordingAnimationRef = useRef(null);

  const getLocalCameraPublication = () => {
    const room = beyondPresenceRoomRef.current;
    return room?.localParticipant?.getTrackPublication?.(Track.Source.Camera);
  };

  const refreshCameraDevices = async () => {
    try {
      const devices = await Room.getLocalDevices("videoinput");
      setCameraDevices(devices);
      if (!selectedCameraDeviceId && devices[0]?.deviceId) {
        setSelectedCameraDeviceId(devices[0].deviceId);
      }
      return devices;
    } catch (err) {
      console.warn("Camera device lookup failed:", err);
      return [];
    }
  };

  const attachLocalCameraPreview = async () => {
    const publication = getLocalCameraPublication();
    const videoTrack = publication?.videoTrack || publication?.track;
    const video = userVideoRef.current;
    if (!videoTrack || !video) return false;

    try {
      if (typeof videoTrack.attach === "function") {
        videoTrack.attach(video);
      } else if (videoTrack.mediaStreamTrack) {
        video.srcObject = new MediaStream([videoTrack.mediaStreamTrack]);
      }
      video.muted = true;
      video.playsInline = true;
      await video.play?.();
      return true;
    } catch (err) {
      console.warn("Local camera preview attach failed:", err);
      return false;
    }
  };

  const stopUserCamera = () => {
    const room = beyondPresenceRoomRef.current;
    room?.localParticipant?.setCameraEnabled?.(false).catch((err) => {
      console.warn("LiveKit camera disable failed:", err);
    });

    const publication = getLocalCameraPublication();
    const videoTrack = publication?.videoTrack || publication?.track;
    if (videoTrack && userVideoRef.current && typeof videoTrack.detach === "function") {
      videoTrack.detach(userVideoRef.current);
    }

    if (userVideoRef.current) {
      userVideoRef.current.srcObject = null;
    }
  };

  const captureDataUrlFromVideoElement = (video) => {
    if (!video || !video.videoWidth || !video.videoHeight) return "";
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.88);
  };

  const getCanvasFromVideoElement = (video) => {
    if (!video || !video.videoWidth || !video.videoHeight) return null;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas;
  };

  const analyzeCallCaptureCanvas = (canvas) => {
    const width = canvas.width;
    const height = canvas.height;
    const sampleWidth = 120;
    const sampleHeight = Math.max(1, Math.round((height / width) * sampleWidth));
    const sampleCanvas = document.createElement("canvas");
    sampleCanvas.width = sampleWidth;
    sampleCanvas.height = sampleHeight;
    const sampleCtx = sampleCanvas.getContext("2d", { willReadFrequently: true });
    sampleCtx.drawImage(canvas, 0, 0, sampleWidth, sampleHeight);
    const pixels = sampleCtx.getImageData(0, 0, sampleWidth, sampleHeight).data;
    const lumas = [];
    let brightness = 0;
    let contrast = 0;
    let sharpness = 0;
    let glarePixels = 0;
    let count = 0;

    for (let i = 0; i < pixels.length; i += 4) {
      const luma = pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114;
      lumas.push(luma);
      brightness += luma;
      if (luma > 245) glarePixels += 1;
      count += 1;
    }

    brightness /= count || 1;
    for (let y = 1; y < sampleHeight; y += 1) {
      for (let x = 1; x < sampleWidth; x += 1) {
        const index = y * sampleWidth + x;
        sharpness += Math.abs(lumas[index] - lumas[index - 1]);
        sharpness += Math.abs(lumas[index] - lumas[index - sampleWidth]);
        contrast += Math.abs(lumas[index] - brightness);
      }
    }

    const comparablePixels = Math.max(1, (sampleWidth - 1) * (sampleHeight - 1));
    return {
      width,
      height,
      brightness,
      contrast: contrast / comparablePixels,
      sharpness: sharpness / comparablePixels,
      glareRatio: glarePixels / Math.max(1, count),
      pixels,
      sampleWidth,
      sampleHeight,
    };
  };

  const getCallForegroundBounds = ({ pixels, sampleWidth, sampleHeight }) => {
    const cornerPoints = [
      [3, 3],
      [sampleWidth - 4, 3],
      [3, sampleHeight - 4],
      [sampleWidth - 4, sampleHeight - 4],
    ];
    const cornerLumas = cornerPoints.map(([x, y]) => {
      const index = (y * sampleWidth + x) * 4;
      return pixels[index] * 0.299 + pixels[index + 1] * 0.587 + pixels[index + 2] * 0.114;
    });
    const background = cornerLumas.reduce((sum, value) => sum + value, 0) / cornerLumas.length;
    let minX = sampleWidth;
    let minY = sampleHeight;
    let maxX = 0;
    let maxY = 0;
    let count = 0;

    for (let y = 0; y < sampleHeight; y += 1) {
      for (let x = 0; x < sampleWidth; x += 1) {
        const index = (y * sampleWidth + x) * 4;
        const luma = pixels[index] * 0.299 + pixels[index + 1] * 0.587 + pixels[index + 2] * 0.114;
        if (Math.abs(luma - background) < 20) continue;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        count += 1;
      }
    }

    if (!count) return null;
    return {
      xRatio: minX / sampleWidth,
      yRatio: minY / sampleHeight,
      widthRatio: (maxX - minX + 1) / sampleWidth,
      heightRatio: (maxY - minY + 1) / sampleHeight,
      coverageRatio: count / (sampleWidth * sampleHeight),
    };
  };

  const getCallCenterBodyPresence = ({ pixels, sampleWidth, sampleHeight }) => {
    const leftX = Math.floor(sampleWidth * 0.08);
    const rightX = Math.floor(sampleWidth * 0.92);
    let background = 0;
    let backgroundCount = 0;
    for (let y = 0; y < sampleHeight; y += 2) {
      [leftX, rightX].forEach((x) => {
        const index = (y * sampleWidth + x) * 4;
        background += pixels[index] * 0.299 + pixels[index + 1] * 0.587 + pixels[index + 2] * 0.114;
        backgroundCount += 1;
      });
    }
    background /= Math.max(1, backgroundCount);

    const centerMinX = Math.floor(sampleWidth * 0.3);
    const centerMaxX = Math.ceil(sampleWidth * 0.7);
    const bands = [
      [0.12, 0.34],
      [0.34, 0.62],
      [0.62, 0.86],
      [0.84, 0.99],
    ];

    return bands.map(([from, to]) => {
      const startY = Math.floor(sampleHeight * from);
      const endY = Math.ceil(sampleHeight * to);
      let foreground = 0;
      let total = 0;
      for (let y = startY; y < endY; y += 1) {
        for (let x = centerMinX; x < centerMaxX; x += 1) {
          const index = (y * sampleWidth + x) * 4;
          const luma = pixels[index] * 0.299 + pixels[index + 1] * 0.587 + pixels[index + 2] * 0.114;
          if (Math.abs(luma - background) > 22) foreground += 1;
          total += 1;
        }
      }
      return foreground / Math.max(1, total);
    });
  };

  const validateCallCaptureFrame = (stage, canvas) => {
    const metrics = analyzeCallCaptureCanvas(canvas);
    if (metrics.width < 640 || metrics.height < 360) {
      return "Camera quality is too low. Please move closer to the camera or switch camera.";
    }
    if (metrics.brightness < 42) return "Too dark. Please add light before capture.";
    if (metrics.brightness > 238) return "Too bright. Please reduce glare before capture.";
    if (metrics.glareRatio > 0.1) return "Glare detected. Tilt slightly and hold steady.";

    const minimumSharpness = stage === "id" ? 4.5 : 3.5;
    const minimumContrast = stage === "id" ? 7 : 6;
    if (metrics.sharpness < minimumSharpness || metrics.contrast < minimumContrast) {
      return "Image is not clear enough. Hold steady and keep the subject in focus.";
    }

    const bounds = getCallForegroundBounds(metrics);
    if (stage === "id") {
      if (!bounds || bounds.coverageRatio < 0.015 || bounds.widthRatio < 0.18 || bounds.heightRatio < 0.08) {
        return "Show the ID card clearly in front of the camera.";
      }
      const aspectRatio = bounds.widthRatio / Math.max(0.01, bounds.heightRatio);
      if (aspectRatio < 0.85 || aspectRatio > 3.2) {
        return "Keep the ID card straight and fully visible.";
      }
      if (bounds.yRatio > 0.62 || bounds.yRatio + bounds.heightRatio < 0.28) {
        return "Bring the ID card into the center of the frame.";
      }
      return "";
    }

    if (stage === "fullBody") {
      if (!bounds || bounds.coverageRatio < 0.018) {
        return "Stand fully inside the frame before capture.";
      }
      if (bounds.heightRatio < 0.45 || bounds.yRatio > 0.32 || bounds.yRatio + bounds.heightRatio < 0.82) {
        return "Head-to-toe is not fully visible. Step back until feet are visible.";
      }
      const [upper, middle, lower, feet] = getCallCenterBodyPresence(metrics);
      if (upper < 0.018 || middle < 0.025 || lower < 0.018 || feet < 0.01) {
        return "Stand centered with head and feet visible.";
      }
    }

    return "";
  };

  const calculateVideoMotionScore = (video) => {
    if (!video || !video.videoWidth || !video.videoHeight) return 0;
    const sampleSize = 64;
    const canvas =
      autoCaptureFrameRef.current || document.createElement("canvas");
    autoCaptureFrameRef.current = canvas;
    canvas.width = sampleSize;
    canvas.height = sampleSize;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, sampleSize, sampleSize);
    const data = ctx.getImageData(0, 0, sampleSize, sampleSize).data;
    const previous = canvas.__previousFrame;
    canvas.__previousFrame = new Uint8ClampedArray(data);
    if (!previous) return 0;

    let delta = 0;
    for (let i = 0; i < data.length; i += 16) {
      delta +=
        Math.abs(data[i] - previous[i]) +
        Math.abs(data[i + 1] - previous[i + 1]) +
        Math.abs(data[i + 2] - previous[i + 2]);
    }
    return delta / (data.length / 16);
  };

  const startKycImageCaptureStage = (stage) => {
    setKycImageCaptureStage(stage);
    kycImageCaptureStageStartedAtRef.current = Date.now();
    const instructionEnglish =
      stage === "id"
        ? "ID capture is starting. Please show your PAN or Aadhaar card to the camera. Keep the full card readable and hold it steady until it is captured."
        : "Head-to-toe capture is starting. Please step back from the camera so your full body is visible from head to toe. Stand still until it is captured.";
    setAutoCaptureStatus(
      stage === "id"
        ? "Get ready: show the PAN or Aadhaar card now. Auto-capture starts after a short hold."
        : "Get ready: step back now. Auto-capture starts after a short hold.",
    );
    localizeKycText(instructionEnglish, preferredLanguage)
      .then((instruction) => {
        if (!instruction) return;
        setKycChatMessages((prev) => {
          if (prev.some((msg) => msg.role === "assistant" && msg.content === instruction)) {
            return prev;
          }
          return [...prev, { role: "assistant", content: instruction }];
        });
      })
      .catch(() => {});
  };

  const markKycCompleteAndStartImageCapture = () => {
    kycCompleteRef.current = true;
    setKycComplete(true);
    if (kycResponsesRef.current?.declaration !== "Yes") {
      setKycImageCaptureStage("idle");
      setAutoCaptureStatus("");
      return;
    }
    if (!idDocumentPhoto) {
      startKycImageCaptureStage("id");
    } else if (!fullBodyPhoto) {
      startKycImageCaptureStage("fullBody");
    } else {
      setKycImageCaptureStage("done");
    }
  };

  const requiresPostKycImageCapture = () =>
    kycCompleteRef.current && kycResponsesRef.current?.declaration === "Yes";

  const ensurePostKycImageCaptureReady = () => {
    if (!requiresPostKycImageCapture()) return true;
    if (idDocumentPhoto && fullBodyPhoto) return true;

    if (!idDocumentPhoto) {
      startKycImageCaptureStage("id");
    } else if (!fullBodyPhoto) {
      startKycImageCaptureStage("fullBody");
    }

    alert(
      "Please complete the ID and head-to-toe photo capture before downloading the MER PDF.",
    );
    return false;
  };

  const tryAutoCaptureCallImages = (reason = "auto", { force = false } = {}) => {
    const video = userVideoRef.current;
    if (!video || !video.videoWidth || kycImageCaptureStage === "idle") return false;
    const elapsed = Date.now() - kycImageCaptureStageStartedAtRef.current;
    const prepareMs = kycImageCaptureStage === "id" ? 5500 : 6500;
    if (!force && elapsed < prepareMs) {
      const secondsLeft = Math.max(1, Math.ceil((prepareMs - elapsed) / 1000));
      setAutoCaptureStatus(
        kycImageCaptureStage === "id"
          ? `Prepare ID card. Checking frame in ${secondsLeft}s.`
          : `Prepare head-to-toe pose. Checking frame in ${secondsLeft}s.`,
      );
      return false;
    }

    const canvas = getCanvasFromVideoElement(video);
    if (!canvas) return false;
    const qualityMessage = validateCallCaptureFrame(kycImageCaptureStage, canvas);
    if (qualityMessage) {
      if (!force) {
        setAutoCaptureStatus(qualityMessage);
        return false;
      }
      const isVeryBadFrame =
        !canvas.width ||
        !canvas.height ||
        (kycImageCaptureStage === "id" &&
          /too dark|too bright|glare/i.test(qualityMessage));
      if (isVeryBadFrame) {
        setAutoCaptureStatus(qualityMessage);
        return false;
      }
      setAutoCaptureStatus(
        `Manual capture accepted. Quality warning: ${qualityMessage}`,
      );
    }

    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    if (!dataUrl) return false;

    if (kycImageCaptureStage === "id") {
      setIdDocumentPhoto(dataUrl);
      setIdCaptureComplete(true);
      setAutoCaptureStatus(`Clear ID snapshot captured (${reason}).`);
      window.setTimeout(() => startKycImageCaptureStage("fullBody"), 1400);
      return true;
    }

    if (kycImageCaptureStage === "fullBody") {
      setFullBodyPhoto(dataUrl);
      setFullBodyCaptureComplete(true);
      setKycImageCaptureStage("done");
      setAutoCaptureStatus(`Clear head-to-toe snapshot captured (${reason}).`);
      return true;
    }

    return false;
  };

  const startUserCamera = async ({ requireConnected = true } = {}) => {
    const room = beyondPresenceRoomRef.current;
    if (
      !cameraEnabled ||
      (requireConnected && !isAvatarConnected) ||
      !room?.localParticipant?.setCameraEnabled
    ) {
      return;
    }

    try {
      await room.localParticipant.setCameraEnabled(true);
      await refreshCameraDevices();
      await attachLocalCameraPreview();
    } catch (err) {
      console.error("User camera failed:", err);
      stopUserCamera();
      setCameraEnabled(false);
    }
  };

  const toggleCamera = async () => {
    const nextEnabled = !cameraEnabled;
    setCameraEnabled(nextEnabled);

    if (!nextEnabled) {
      stopUserCamera();
      return;
    }

    if (isAvatarConnected) {
      await startUserCamera();
    }
  };

  const switchToNextCamera = async () => {
    const room = beyondPresenceRoomRef.current;
    if (!room?.switchActiveDevice) return;

    const devices = cameraDevices.length
      ? cameraDevices
      : await refreshCameraDevices();
    if (devices.length < 2) return;

    const currentIndex = Math.max(
      0,
      devices.findIndex((device) => device.deviceId === selectedCameraDeviceId),
    );
    const nextDevice = devices[(currentIndex + 1) % devices.length];
    if (!nextDevice?.deviceId) return;

    try {
      await room.switchActiveDevice("videoinput", nextDevice.deviceId);
      setSelectedCameraDeviceId(nextDevice.deviceId);
      if (cameraEnabled) {
        await room.localParticipant.setCameraEnabled(true);
        window.setTimeout(() => attachLocalCameraPreview(), 250);
      }
    } catch (err) {
      console.error("Camera switch failed:", err);
    }
  };

  const toggleMute = () => {
    setIsMuted((prev) => !prev);
  };

  const toggleScreenShare = async () => {
    const room = beyondPresenceRoomRef.current;
    if (!room?.localParticipant?.setScreenShareEnabled) return;

    try {
      const nextEnabled = !isScreenSharing;
      await room.localParticipant.setScreenShareEnabled(nextEnabled);
      setIsScreenSharing(nextEnabled);
    } catch (err) {
      console.error("Screen share toggle failed:", err);
      setIsScreenSharing(false);
    }
  };

  useEffect(() => {
    const captureActive =
      kycComplete &&
      isAvatarConnected &&
      (kycImageCaptureStage === "id" || kycImageCaptureStage === "fullBody");
    if (!captureActive) {
      if (autoCaptureTimerRef.current) {
        window.clearInterval(autoCaptureTimerRef.current);
        autoCaptureTimerRef.current = null;
      }
      return undefined;
    }

    if (!getLocalCameraPublication() && cameraEnabled) {
      startUserCamera({ requireConnected: false });
    }

    let stableFrames = 0;
    autoCaptureTimerRef.current = window.setInterval(() => {
      const video = userVideoRef.current;
      if (!video || !video.videoWidth) return;
      const motionScore = calculateVideoMotionScore(video);
      if (motionScore > 1.2 && motionScore < 18) {
        stableFrames += 1;
      } else if (motionScore > 28) {
        stableFrames = 0;
      }

      if (stableFrames >= 3) {
        tryAutoCaptureCallImages("motion stable");
        stableFrames = 0;
      }
    }, 1200);

    return () => {
      if (autoCaptureTimerRef.current) {
        window.clearInterval(autoCaptureTimerRef.current);
        autoCaptureTimerRef.current = null;
      }
    };
  }, [cameraEnabled, isAvatarConnected, kycComplete, kycImageCaptureStage]);

  const releaseCallRecordingResources = () => {
    const recorder = callRecorderRef.current;
    if (recorder) {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      if (recorder.state !== "inactive") {
        recorder.stop();
      }
      callRecorderRef.current = null;
    }

    const videoRecorder = callVideoRecorderRef.current;
    if (videoRecorder) {
      videoRecorder.ondataavailable = null;
      videoRecorder.onstop = null;
      if (videoRecorder.state !== "inactive") {
        videoRecorder.stop();
      }
      callVideoRecorderRef.current = null;
    }

    if (callRecordingAnimationRef.current) {
      window.cancelAnimationFrame(callRecordingAnimationRef.current);
      callRecordingAnimationRef.current = null;
    }

    callRecordingSourcesRef.current.forEach((source) => {
      try {
        source.disconnect();
      } catch {
        // noop
      }
    });
    callRecordingSourcesRef.current = [];
    callRecordingTrackIdsRef.current = new Set();
    callRecordingDestinationRef.current = null;
    callRecordingConnectTrackRef.current = null;
    callAudioChunksRef.current = [];
    callVideoChunksRef.current = [];

    if (callRecordingAudioContextRef.current) {
      callRecordingAudioContextRef.current.close().catch(() => {});
      callRecordingAudioContextRef.current = null;
    }
  };

  const drawCallRecordingFrame = () => {
    const canvas = callRecordingCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    const avatarVideo = callSurfaceRef.current?.querySelector?.("[data-avatar-stage] video");
    const clientVideo = userVideoRef.current;

    ctx.fillStyle = "#6668ad";
    ctx.fillRect(0, 0, width, height);

    const drawCoverVideo = (video, x, y, boxWidth, boxHeight) => {
      if (!video?.videoWidth || !video?.videoHeight) return false;
      const sourceAspect = video.videoWidth / video.videoHeight;
      const targetAspect = boxWidth / boxHeight;
      let drawWidth = width;
      let drawHeight = height;
      let drawX = x;
      let drawY = y;

      if (sourceAspect > targetAspect) {
        drawHeight = boxHeight;
        drawWidth = boxHeight * sourceAspect;
        drawX = x + (boxWidth - drawWidth) / 2;
      } else {
        drawWidth = boxWidth;
        drawHeight = boxWidth / sourceAspect;
        drawY = y + (boxHeight - drawHeight) / 2;
      }
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, boxWidth, boxHeight);
      ctx.clip();
      ctx.drawImage(video, drawX, drawY, drawWidth, drawHeight);
      ctx.restore();
      return true;
    };

    if (clientVideo?.videoWidth && cameraEnabled) {
      drawCoverVideo(clientVideo, 0, 0, width, height);
    } else {
      ctx.fillStyle = "#111827";
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = "#bfdbfe";
      ctx.font = "600 34px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(cameraEnabled ? "Client camera" : "Camera off", width / 2, height / 2);
    }

    const avatarTileWidth = Math.round(width * 0.28);
    const avatarTileHeight = Math.round(height * 0.42);
    const avatarTileX = width - avatarTileWidth - 34;
    const avatarTileY = 96;

    ctx.fillStyle = "rgba(15,23,42,0.88)";
    ctx.fillRect(avatarTileX - 5, avatarTileY - 5, avatarTileWidth + 10, avatarTileHeight + 10);
    ctx.fillStyle = "#020617";
    ctx.fillRect(avatarTileX, avatarTileY, avatarTileWidth, avatarTileHeight);
    if (avatarVideo?.videoWidth) {
      drawCoverVideo(avatarVideo, avatarTileX, avatarTileY, avatarTileWidth, avatarTileHeight);
    } else {
      ctx.fillStyle = "#a7f3d0";
      ctx.font = "600 24px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Agent Tara", avatarTileX + avatarTileWidth / 2, avatarTileY + avatarTileHeight / 2);
    }

    ctx.fillStyle = "rgba(15,23,42,0.78)";
    ctx.fillRect(0, height - 42, width, 42);
    ctx.fillRect(avatarTileX, avatarTileY + avatarTileHeight - 34, avatarTileWidth, 34);
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 20px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Client", 24, height - 15);
    ctx.font = "700 16px sans-serif";
    ctx.fillText("Agent Tara", avatarTileX + 12, avatarTileY + avatarTileHeight - 12);

    if (isRecordingCall) {
      ctx.fillStyle = "#ef6547";
      ctx.fillRect(24, 24, 190, 54);
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(50, 51, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = "700 24px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("Recording", 70, 59);
    }

    callRecordingAnimationRef.current = window.requestAnimationFrame(drawCallRecordingFrame);
  };

  const startCallRecording = () => {
    try {
      if (
        callRecorderRef.current &&
        callRecorderRef.current.state !== "inactive"
      ) {
        return;
      }

      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextCtor) {
        throw new Error("Audio recording is not supported in this browser");
      }
      if (typeof MediaRecorder === "undefined") {
        throw new Error("MediaRecorder is not supported in this browser");
      }

      const audioCtx = new AudioContextCtor();
      const dest = audioCtx.createMediaStreamDestination();
      callRecordingAudioContextRef.current = audioCtx;
      callRecordingDestinationRef.current = dest;
      callRecordingSourcesRef.current = [];
      callRecordingTrackIdsRef.current = new Set();

      const connectAudioTracks = (tracks = []) => {
        tracks.forEach((track) => {
          if (!track || track.readyState === "ended") return;
          if (track.kind && track.kind !== "audio") return;
          const trackKey =
            track.id || `${track.kind || "audio"}_${track.label || "unknown"}`;
          if (trackKey && callRecordingTrackIdsRef.current.has(trackKey)) return;
          const stream = new MediaStream([track]);
          if (!stream.getAudioTracks().length) return;
          const source = audioCtx.createMediaStreamSource(
            stream,
          );
          source.connect(dest);
          callRecordingSourcesRef.current.push(source);
          if (trackKey) callRecordingTrackIdsRef.current.add(trackKey);
        });
      };
      callRecordingConnectTrackRef.current = (track) => connectAudioTracks([track]);

      document.querySelectorAll("audio, video").forEach((el) => {
        const tracks = el.srcObject?.getAudioTracks?.() || [];
        if (tracks.length) {
          connectAudioTracks(tracks);
        }
      });

      const room = beyondPresenceRoomRef.current;
      const localAudioTrackPublications =
        room?.localParticipant?.audioTrackPublications?.values?.();
      if (localAudioTrackPublications) {
        for (const pub of localAudioTrackPublications) {
          const mediaTrack =
            pub.audioTrack?.mediaStreamTrack ||
            pub.track?.mediaStreamTrack;
          if (mediaTrack) {
            connectAudioTracks([mediaTrack]);
          }
        }
      }

      const remoteParticipants = room?.remoteParticipants?.values?.();
      if (remoteParticipants) {
        for (const participant of remoteParticipants) {
          const publications =
            participant?.audioTrackPublications?.values?.() ||
            participant?.trackPublications?.values?.();
          if (!publications) continue;
          for (const pub of publications) {
            const mediaTrack =
              pub.audioTrack?.mediaStreamTrack ||
              pub.track?.mediaStreamTrack;
            if (mediaTrack) {
              connectAudioTracks([mediaTrack]);
            }
          }
        }
      }

      if (audioCtx.state === "suspended") {
        audioCtx.resume().catch(() => {});
      }

      callAudioChunksRef.current = [];
      callVideoChunksRef.current = [];
      setCallRecordingBlob(null);
      setCallVideoRecordingBlob(null);
      setCallTranscription("");

      const preferredMimeType = MediaRecorder.isTypeSupported?.(
        "audio/webm;codecs=opus",
      )
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(
        dest.stream,
        preferredMimeType ? { mimeType: preferredMimeType } : undefined,
      );
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          callAudioChunksRef.current.push(e.data);
        }
      };

      const canvas = document.createElement("canvas");
      canvas.width = 1280;
      canvas.height = 720;
      callRecordingCanvasRef.current = canvas;
      const canvasStream = canvas.captureStream?.(30);
      if (!canvasStream) {
        throw new Error("Video recording is not supported in this browser");
      }
      dest.stream.getAudioTracks().forEach((track) => canvasStream.addTrack(track));
      const preferredVideoMimeType = MediaRecorder.isTypeSupported?.(
        "video/webm;codecs=vp9,opus",
      )
        ? "video/webm;codecs=vp9,opus"
        : MediaRecorder.isTypeSupported?.("video/webm;codecs=vp8,opus")
          ? "video/webm;codecs=vp8,opus"
          : "video/webm";
      const videoRecorder = new MediaRecorder(
        canvasStream,
        preferredVideoMimeType ? { mimeType: preferredVideoMimeType } : undefined,
      );
      videoRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          callVideoChunksRef.current.push(e.data);
        }
      };

      recorder.start(1000);
      videoRecorder.start(1000);
      callRecorderRef.current = recorder;
      callVideoRecorderRef.current = videoRecorder;
      setIsRecordingCall(true);
      drawCallRecordingFrame();
      console.log("[Recording] Started");
    } catch (err) {
      releaseCallRecordingResources();
      setIsRecordingCall(false);
      console.error("Failed to start call recording:", err);
    }
  };

  const stopCallRecording = ({ discard = false } = {}) => {
    const recorder = callRecorderRef.current;
    if (!recorder) {
      callAudioChunksRef.current = [];
      setIsRecordingCall(false);
      if (discard) {
        setCallRecordingBlob(null);
        setCallVideoRecordingBlob(null);
      }
      releaseCallRecordingResources();
      return;
    }

    if (recorder.state === "inactive") {
      callRecorderRef.current = null;
      callAudioChunksRef.current = [];
      setIsRecordingCall(false);
      if (discard) {
        setCallRecordingBlob(null);
        setCallVideoRecordingBlob(null);
      }
      releaseCallRecordingResources();
      return;
    }

    const videoRecorder = callVideoRecorderRef.current;
    let pendingStops = videoRecorder && videoRecorder.state !== "inactive" ? 2 : 1;
    const finishStop = () => {
      pendingStops -= 1;
      if (pendingStops > 0) return;
      callAudioChunksRef.current = [];
      callVideoChunksRef.current = [];
      setIsRecordingCall(false);
      callRecorderRef.current = null;
      callVideoRecorderRef.current = null;
      releaseCallRecordingResources();
    };

    recorder.onstop = () => {
      const blob = new Blob(callAudioChunksRef.current, { type: "audio/webm" });
      if (!discard && blob.size > 0) {
        setCallRecordingBlob(blob);
      } else if (discard) {
        setCallRecordingBlob(null);
      }
      console.log("[Recording] Stopped, blob size:", blob.size);
      finishStop();
    };

    if (videoRecorder && videoRecorder.state !== "inactive") {
      videoRecorder.onstop = () => {
        const videoBlob = new Blob(callVideoChunksRef.current, { type: "video/webm" });
        if (!discard && videoBlob.size > 0) {
          setCallVideoRecordingBlob(videoBlob);
        } else if (discard) {
          setCallVideoRecordingBlob(null);
        }
        console.log("[Recording] Video stopped, blob size:", videoBlob.size);
        finishStop();
      };
      videoRecorder.stop();
    }

    recorder.stop();
  };

  const transcribeRecording = async () => {
    if (!callRecordingBlob) return;
    setIsTranscribing(true);

    try {
      const formData = new FormData();
      formData.append("audio", callRecordingBlob, "call-recording.webm");
      formData.append(
        "language",
        SARVAM_LANGUAGE_CODES[preferredLanguage] || "en-IN",
      );

      const res = await fetch(`${API_BASE}/api/sarvam/transcribe`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Transcription failed");
      }

      setCallTranscription(data.formatted || "");
    } catch (err) {
      console.error("Transcription failed:", err);
      alert("Transcription failed: " + err.message);
    } finally {
      setIsTranscribing(false);
    }
  };

  const downloadTranscription = () => {
    if (!callTranscription) return;

    const blob = new Blob([callTranscription], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `call_transcript_${new Date().toISOString().split("T")[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadBlob = (blob, filename) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadCallAudioRecording = () => {
    if (callRecordingBlob) {
      downloadBlob(
        callRecordingBlob,
        `call_audio_${new Date().toISOString().split("T")[0]}.webm`,
      );
      return;
    }
    if (isRecordingCall) {
      pendingRecordingDownloadRef.current = "audio";
      stopCallRecording({ discard: false });
    }
  };

  const downloadCallVideoRecording = () => {
    if (callVideoRecordingBlob) {
      downloadBlob(
        callVideoRecordingBlob,
        `call_video_${new Date().toISOString().split("T")[0]}.webm`,
      );
      return;
    }
    if (isRecordingCall) {
      pendingRecordingDownloadRef.current = "video";
      stopCallRecording({ discard: false });
    }
  };

  useEffect(() => {
    if (pendingRecordingDownloadRef.current !== "audio" || !callRecordingBlob) return;
    pendingRecordingDownloadRef.current = null;
    downloadBlob(
      callRecordingBlob,
      `call_audio_${new Date().toISOString().split("T")[0]}.webm`,
    );
  }, [callRecordingBlob]);

  useEffect(() => {
    if (pendingRecordingDownloadRef.current !== "video" || !callVideoRecordingBlob) return;
    pendingRecordingDownloadRef.current = null;
    downloadBlob(
      callVideoRecordingBlob,
      `call_video_${new Date().toISOString().split("T")[0]}.webm`,
    );
  }, [callVideoRecordingBlob]);

  const prefillFromPanOcr = (ocrData) => {
    if (!ocrData) return;
    const prefilled = { ...kycResponsesRef.current };

    if (ocrData.fullName) {
      prefilled.life_to_be_assured_name = formatNameForPdf(ocrData.fullName);
    }
    if (ocrData.dateOfBirth) {
      prefilled.date_of_birth = formatDateOfBirthForPdf(ocrData.dateOfBirth);
    }

    setPanOcrData(ocrData);
    setKycResponses(prefilled);
    kycResponsesRef.current = prefilled;
    const nextIndex = findNextPendingKycFieldIndex(kycFields, prefilled, 0);
    const safeIndex =
      nextIndex >= kycFields.length
        ? Math.max(kycFields.length - 1, 0)
        : nextIndex;
    setKycCurrentFieldIndex(safeIndex);
    kycCurrentFieldIndexRef.current = safeIndex;
  };

  const registerProcessedTranscript = ({
    rawKey = null,
    fingerprint = null,
    windowMs = 12000,
  } = {}) => {
    const now = Date.now();

    if (rawKey) {
      if (processedTranscriptKeysRef.current.has(rawKey)) return false;
      processedTranscriptKeysRef.current.add(rawKey);
    }

    const recentFingerprints = recentTranscriptFingerprintsRef.current;
    for (const [key, timestamp] of recentFingerprints.entries()) {
      if (now - timestamp > windowMs) {
        recentFingerprints.delete(key);
      }
    }

    if (fingerprint) {
      const previous = recentFingerprints.get(fingerprint);
      if (previous && now - previous < windowMs) {
        return false;
      }
      recentFingerprints.set(fingerprint, now);
    }

    return true;
  };

  const recordKycTranscriptMessage = async (role, text, options = {}) => {
    const cleanText = normalizeTranscriptEncoding(text);
    if (!cleanText) return false;
    const key = getTranscriptMessageKey(role, cleanText, options?.eventKey);
    if (transcriptMessageKeysRef.current.has(key)) return false;
    transcriptMessageKeysRef.current.add(key);

    const initialDisplayContent = normalizeTranscriptDisplayAnswer(cleanText);
    if (role === "user") {
      setKycTranscriptPreview(`"${initialDisplayContent}"`);
    }
    setKycChatMessages((prev) => [
      ...prev,
      {
        role,
        content: cleanText,
        displayContent: initialDisplayContent,
        isVoice: true,
        transcriptKey: key,
      },
    ]);

    localizeTranscriptDisplayText(cleanText)
      .then((displayContent) => {
        if (!displayContent || displayContent === initialDisplayContent) return;
        setKycChatMessages((prev) =>
          prev.map((msg) =>
            msg.transcriptKey === key ? { ...msg, displayContent } : msg,
          ),
        );
        if (role === "user") {
          setKycTranscriptPreview(`"${displayContent}"`);
        }
      })
      .catch((err) => {
        console.warn("Transcript display localization failed:", err);
      });
    return true;
  };

  const ensureKycTranscriptQuestionForField = async (
    field,
    fieldIndex,
    mode = "answer",
    phase = "detail",
  ) => {
    if (!field || fieldIndex == null || fieldIndex < 0) return false;

    const visibleMessages = kycChatMessages
      .filter((msg) => !msg?.isHidden && !msg?.isSystem)
      .slice(-8);
    const hasRecentPrompt = visibleMessages.some((msg) => {
      if (msg.role !== "assistant") return false;
      return getTranscriptPromptFieldId(msg.content || msg.displayContent || "") === field.id;
    });
    if (hasRecentPrompt) return false;

    const promptText =
      mode === "reason"
        ? getKycReasonFollowUpPrompt(
            field,
            phase,
            pendingReasonFieldRef.current?.fieldId === field.id
              ? pendingReasonFieldRef.current?.detail
              : "",
          )
        : getActiveKycPromptLabel(field, kycResponsesRef.current) ||
          field.prompt ||
          field.label;
    const cleanPrompt = stripInlineYesDetailInstruction(promptText);
    if (!cleanPrompt) return false;

    const displayPrompt = await localizeKycText(cleanPrompt, preferredLanguage, {
      transcriptScript: true,
    });
    return recordKycTranscriptMessage("assistant", displayPrompt || cleanPrompt, {
      eventKey: `synthetic_prompt_${field.id}_${mode}_${phase}`,
    });
  };

const hideKycTranscriptMessage = (role, text, options = {}) => {
    const cleanText = normalizeTranscriptEncoding(text);
    if (!cleanText) return;
    const key = getTranscriptMessageKey(role, cleanText, options?.eventKey);
    setKycChatMessages((prev) =>
      prev.map((msg) =>
        msg.transcriptKey === key
          ? { ...msg, isHidden: true, hiddenReason: "rejected_by_kyc_validator" }
          : msg,
      ),
    );
  };

  const initBeyondPresence = async () => {
    if (
      beyondPresenceSession ||
      isConnectingAvatar ||
      !kycFields.length ||
      avatarConnectionBlockedMessage
    )
      return;
    setIsConnectingAvatar(true);
    setAvatarConnectionBlockedMessage("");

    try {
      const currentResponses = kycResponsesRef.current;
      const nextPendingIndex = findNextPendingKycFieldIndex(
        kycFields,
        currentResponses,
        0,
      );
      const remainingFields = kycFields.filter(
        (field, index) =>
          index >= nextPendingIndex &&
          !shouldSkipFieldForGender(field, currentResponses) &&
          !isKycFieldComplete(field, currentResponses),
      );

      if (!remainingFields.length) {
        markKycCompleteAndStartImageCapture();
        return;
      }

      const openingField = remainingFields[0];
      const openingPrompt =
        getActiveKycPromptLabel(openingField, currentResponses) ||
        openingField.label;
      setKycCurrentFieldIndex(nextPendingIndex);
      kycCurrentFieldIndexRef.current = nextPendingIndex;

      const res = await fetch(`${API_BASE}/api/beyondpresence/start-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kycFields: remainingFields.map((field) => ({
            label: field.label,
            type: field.type,
            section: field.section,
            prompt: stripInlineYesDetailInstruction(field.prompt),
            requiresReasonOnYes: Boolean(field.requiresReasonOnYes),
            genderRestriction: field.genderRestriction || "all",
          })),
          openingPrompt,
          language: preferredLanguage || "en",
          preferredLanguage: preferredLanguage || "en",
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        const readableError = getReadableErrorMessage(
          data.error || data,
          "Failed to start Beyond Presence session",
        );
        if (
          data?.code === "beyondpresence_plan_upgrade_required" ||
          data?.code === "livekit_not_configured" ||
          data?.code === "beyondpresence_not_configured" ||
          data?.retryable === false ||
          /cannot create calls via api|upgrade your plan/i.test(readableError)
        ) {
          setAvatarConnectionBlockedMessage(readableError);
          return;
        }
        throw new Error(readableError);
      }

      setBeyondPresenceSession(data);
      console.log(
        "[BeyondPresence] Session ready:",
        data.agentId || data.mode || "unknown",
      );
    } catch (err) {
      console.error("Beyond Presence init failed:", err);
      alert(
        "Could not connect avatar: " +
          getReadableErrorMessage(err, "Failed to start session"),
      );
    } finally {
      setIsConnectingAvatar(false);
    }
  };

  const advanceKycToNextPendingField = (responses, fromIndex) => {
  pendingReasonFieldRef.current = null;
  const nextIndex = findNextPendingKycFieldIndex(kycFields, responses, fromIndex);
  if (nextIndex < kycFields.length) {
    kycCurrentFieldIndexRef.current = nextIndex;
    setKycCurrentFieldIndex(nextIndex);
    lastAnswerTimestampRef.current = 0; // â† ADD THIS
    return nextIndex;
  }
  markKycCompleteAndStartImageCapture();
  return -1;
};

  const handleUserTranscription = async (text, options = {}) => {
    const cleanText = stripClarificationPrefix(
      normalizeTranscriptEncoding(text),
    );
    if (!cleanText) return;
    if (isLikelyBrokenTranscriptText(cleanText)) {
      console.log("Broken user transcript ignored:", cleanText);
      return;
    }
    if (isLikelyAmbientTranscriptText(cleanText)) {
      console.log("Ambient user transcript ignored:", cleanText);
      return;
    }
    const transcriptSource = String(options?.source || "");
    const isReliableRealtimeTranscriptSource =
      transcriptSource.startsWith("beyondpresence") ||
      transcriptSource === "livekit_transcription_fallback";
    let transcriptWasRecorded = false;
    const now = Date.now();
    lastUserTranscriptRef.current = {
      text: cleanText,
      timestamp: now,
    };
    if (kycTurnLockRef.current || kycCompleteRef.current) return;
    const activeIndex = kycCurrentFieldIndexRef.current;
    if (activeIndex >= kycFields.length) return;

    const currentResponses = kycResponsesRef.current;
    const pendingClarification = pendingClarificationTargetRef.current;
    let pendingReason =
      pendingReasonFieldRef.current &&
      now - pendingReasonFieldRef.current.timestamp < 60000 &&
      kycFields[pendingReasonFieldRef.current.index] &&
      currentResponses[kycFields[pendingReasonFieldRef.current.index].id] === "Yes"
        ? pendingReasonFieldRef.current
        : null;
    if (!pendingReason) {
      const activeField = kycFields[activeIndex];
      const activeReason = activeField?.reasonResponseId
        ? currentResponses[activeField.reasonResponseId]
        : "";
      if (
        activeField?.requiresReasonOnYes &&
        currentResponses[activeField.id] === "Yes" &&
        hasMeaningfulKycValue(activeReason) &&
        activeField.id !== "travel_outside_india" &&
        !hasDurationPhrase(activeReason)
      ) {
        pendingReason = {
          index: activeIndex,
          fieldId: activeField.id,
          phase: "duration",
          detail: activeReason,
          timestamp: now,
        };
        pendingReasonFieldRef.current = pendingReason;
      }
    }
    const recentReasonCarryover =
      recentReasonCarryoverRef.current &&
      now - recentReasonCarryoverRef.current.timestamp < 15000 &&
      kycFields[recentReasonCarryoverRef.current.index] &&
      currentResponses[kycFields[recentReasonCarryoverRef.current.index].id] === "Yes"
        ? recentReasonCarryoverRef.current
        : null;
    if (
      !pendingReason &&
      recentReasonCarryover &&
      hasMeaningfulKycValue(cleanText) &&
      !isLikelyFiller(cleanText, kycFields[recentReasonCarryover.index]) &&
      !isLikelyNonReasonAnswerForField(recentReasonCarryover.fieldId, cleanText)
    ) {
      pendingReason = {
        ...recentReasonCarryover,
        phase:
          recentReasonCarryover.phase ||
          (hasDurationPhrase(cleanText) ? "duration" : "detail"),
        timestamp: now,
      };
      recentReasonCarryoverRef.current = null;
    }

    if (kycSpeaking && !pendingReason && !options?.allowDuringAgentSpeech) {
      console.log("User transcript ignored while avatar is speaking:", cleanText);
      return;
    }
    if (
      !pendingReason &&
      !(pendingClarification && now - pendingClarification.timestamp < 45000) &&
      !(pendingNameSpellingRef.current && now - pendingNameSpellingRef.current.timestamp < 45000) &&
      ignoredAgentFollowUpRef.current &&
      now - ignoredAgentFollowUpRef.current.timestamp < 20000
    ) {
      const activeFieldForIgnore = kycFields[activeIndex];
      const activeFieldCanUseThisAnswer =
        activeFieldForIgnore &&
        (activeFieldForIgnore.type === "number" ||
          isYesNoField(activeFieldForIgnore) ||
          hasMeaningfulKycValue(
            cleanRecoveredTranscriptAnswer(activeFieldForIgnore.id, cleanText),
          ));
      if (activeFieldCanUseThisAnswer) {
        ignoredAgentFollowUpRef.current = null;
      } else {
      console.log(
        "User transcript ignored for non-form agent follow-up:",
        cleanText,
      );
      return;
      }
    }
    const recentAskedField =
      lastAgentAskedFieldRef.current &&
      now - lastAgentAskedFieldRef.current.timestamp < 30000
        ? lastAgentAskedFieldRef.current
        : null;
    const safeRecentAskedField =
      recentAskedField &&
      Number.isInteger(recentAskedField.index) &&
      kycFields[recentAskedField.index] &&
      !isKycFieldComplete(kycFields[recentAskedField.index], currentResponses)
        ? recentAskedField
        : null;
    const hasFreshClarification =
      !pendingReason && pendingClarification && now - pendingClarification.timestamp < 45000;
    let targetFieldIndex = pendingReason
      ? pendingReason.index
      : hasFreshClarification
      ? pendingClarification.index
      : safeRecentAskedField?.index ?? activeIndex;
    if (
      !pendingReason &&
      !hasFreshClarification &&
      kycFields[targetFieldIndex] &&
      isKycFieldComplete(kycFields[targetFieldIndex], currentResponses)
    ) {
      const nextPendingIndex = findNextPendingKycFieldIndex(
        kycFields,
        currentResponses,
        targetFieldIndex + 1
      );
      if (nextPendingIndex < kycFields.length) {
        targetFieldIndex = nextPendingIndex;
      }
    }
    if (!pendingReason && !hasFreshClarification) {
      const recentCommitted = lastCommittedFieldRef.current;
      const committedField =
        recentCommitted?.index != null ? kycFields[recentCommitted.index] : null;
      if (
        committedField &&
        ["height_cm", "weight_kg"].includes(committedField.id) &&
        targetFieldIndex > recentCommitted.index &&
        now - recentCommitted.timestamp < 12000
      ) {
        const lateNumeric = cleanRecoveredTranscriptAnswer(
          committedField.id,
          cleanText,
        );
        const currentNumeric = cleanRecoveredTranscriptAnswer(
          committedField.id,
          currentResponses[committedField.id],
        );
        if (
          lateNumeric &&
          (!currentNumeric || Number(lateNumeric) !== Number(currentNumeric))
        ) {
          targetFieldIndex = recentCommitted.index;
        }
      }
      if (
        committedField &&
        isFullNameField(committedField) &&
        targetFieldIndex > recentCommitted.index &&
        now - recentCommitted.timestamp < 12000
      ) {
        const lateName = formatNameForPdf(cleanText);
        const currentName = formatNameForPdf(currentResponses[committedField.id]);
        if (
          looksLikeValidKycName(lateName) &&
          compactNameLetters(lateName).startsWith(
            compactNameLetters(currentName).slice(0, 5),
          ) &&
          compactNameLetters(lateName).length >= compactNameLetters(currentName).length
        ) {
          targetFieldIndex = recentCommitted.index;
        }
      }
      if (
        committedField &&
        isPhoneKycField(committedField) &&
        targetFieldIndex > recentCommitted.index &&
        now - recentCommitted.timestamp < 20000 &&
        getPhoneDigitsForKyc(cleanText).length >= 6
      ) {
        targetFieldIndex = recentCommitted.index;
      }
    }
    const answerMode =
      pendingReason
        ? 'reason'
        : (hasFreshClarification ? pendingClarification.mode : null) ||
          (safeRecentAskedField?.index != null && safeRecentAskedField.index !== activeIndex ? 'followup' : 'answer');

    const eventKey = options?.eventKey
      ? getTranscriptMessageKey('user', cleanText, options.eventKey)
      : getTranscriptMessageKey(
          'user',
          cleanText,
          `${targetFieldIndex}:${answerMode}:${normalize(cleanText).slice(0, 120)}`
        );
    const fingerprint = getTranscriptFingerprint(
      'user',
      cleanText,
      targetFieldIndex,
      answerMode
    );
    if (!registerProcessedTranscript({ rawKey: eventKey, fingerprint, windowMs: 12000 })) {
      if (isReliableRealtimeTranscriptSource && transcriptWasRecorded) {
        return;
      }
      return;
    }

    const normalizedCleanText = normalize(cleanText);
    const lastCommittedTranscript = lastCommittedTranscriptRef.current;
    if (
      lastCommittedTranscript?.normalizedText === normalizedCleanText &&
      lastCommittedTranscript?.agentTurn === agentTranscriptTurnRef.current &&
      now - lastCommittedTranscript.timestamp < 15000
    ) {
      console.log('Duplicate user transcript ignored:', cleanText);
      return;
    }

    console.log('User said:', cleanText);
    const targetTranscriptField = kycFields[targetFieldIndex];
    await ensureKycTranscriptQuestionForField(
      targetTranscriptField,
      targetFieldIndex,
      pendingReason ? "reason" : answerMode,
      pendingReason?.phase || "detail",
    );
    transcriptWasRecorded = await recordKycTranscriptMessage("user", cleanText, options);

    if (hasFreshClarification) {
      const targetField = kycFields[targetFieldIndex];

      if (targetField) {
        const confirmation = parseYesNoAnswer(cleanText);
        if (pendingClarification.mode === 'confirm' && confirmation === 'Yes') {
          const confirmedAnswer = inferConfirmedClarificationAnswer(
            targetField,
            pendingClarification.text,
          );
          if (hasMeaningfulKycValue(confirmedAnswer)) {
            let confirmedResponses = {
              ...currentResponses,
              [targetField.id]: confirmedAnswer,
            };
            if (targetField.id === "gender") {
              const { responses: genderUpdated } = autoSkipGenderedFields(
                kycFields,
                confirmedResponses,
                confirmedAnswer,
                targetFieldIndex + 1,
              );
              confirmedResponses = genderUpdated;
            }
            kycResponsesRef.current = confirmedResponses;
            setKycResponses(confirmedResponses);
            lastCommittedFieldRef.current = {
              index: targetFieldIndex,
              fieldId: targetField.id,
              timestamp: now,
            };
            lastCommittedTranscriptRef.current = {
              normalizedText: normalizedCleanText,
              agentTurn: agentTranscriptTurnRef.current,
              timestamp: now,
            };
            pendingClarificationTargetRef.current = null;
            lastAnswerTimestampRef.current = now;
            advanceKycToNextPendingField(confirmedResponses, targetFieldIndex + 1);
            return;
          }
          pendingClarificationTargetRef.current = null;
          lastAnswerTimestampRef.current = now;
          return;
        }

        if (pendingClarification.mode === 'confirm' && confirmation === 'No') {
          pendingClarificationTargetRef.current = {
            ...pendingClarification,
            mode: 'clarify',
            timestamp: now,
          };
          lastAnswerTimestampRef.current = now;
          return;
        }

        kycTurnLockRef.current = true;
        try {
          const spelledFragment = isFullNameField(targetField)
            ? getSpelledNameCompact(cleanText)
            : "";
          const activeSpelling =
            spelledFragment &&
            pendingNameSpellingRef.current?.index === targetFieldIndex &&
            now - pendingNameSpellingRef.current.timestamp < 30000
              ? pendingNameSpellingRef.current
              : null;
          let correctionText = activeSpelling
            ? spelledFragment.startsWith(activeSpelling.value || "")
              ? spelledFragment
              : `${activeSpelling.value || ""}${spelledFragment}`
            : combinePartialKycAnswerText(
                targetField,
                currentResponses[targetField.id],
                cleanText,
              );
          if (activeSpelling && isFullNameField(targetField)) {
            const compactCorrection = correctionText.replace(/[^a-z]/gi, "");
            correctionText = splitCompactSpelledName(
              compactCorrection,
              currentResponses[targetField.id],
            );
          }
          if (activeSpelling) {
            pendingNameSpellingRef.current = {
              ...activeSpelling,
              value: correctionText.replace(/[^a-z]/gi, "").toLowerCase(),
              timestamp: now,
            };
          }
          if (
            activeSpelling &&
            isFullNameField(targetField) &&
            !looksLikeCompleteFullName(correctionText)
          ) {
            pendingClarificationTargetRef.current = {
              ...pendingClarification,
              timestamp: now,
            };
            lastAnswerTimestampRef.current = now;
            return;
          }
          if (
            activeSpelling &&
            isFullNameField(targetField) &&
            hasMeaningfulKycValue(currentResponses[targetField.id]) &&
            !isSpelledNameSafeCorrection(
              currentResponses[targetField.id],
              correctionText,
            )
          ) {
            pendingClarificationTargetRef.current = null;
            pendingNameSpellingRef.current = null;
            lastAnswerTimestampRef.current = now;
            return;
          }
          if (!isLocallyPlausibleKycAnswerForField(targetField, correctionText)) {
            console.log("Implausible correction ignored:", correctionText, targetField.id);
            return;
          }
          const normalizedCorrection = await normalizeKycAnswerForPdf(correctionText, targetField, preferredLanguage);
          let correctedAnswer = normalizedCorrection.canonicalYesNo || normalizedCorrection.englishText || correctionText;

          if (isYesNoField(targetField)) {
            const parsed =
              normalizedCorrection.canonicalYesNo ||
              parseYesNoAnswer(correctedAnswer) ||
              inferImplicitYesNoAnswer(targetField, correctionText);
            if (!parsed) return;
            correctedAnswer = parsed;
          }

          const formattedCorrection = formatKycAnswerForPdf(targetField, correctedAnswer);
          if (
            !isLocallyPlausibleKycAnswerForField(
              targetField,
              correctionText,
              formattedCorrection,
            )
          ) {
            console.log("Implausible formatted correction ignored:", formattedCorrection, targetField.id);
            return;
          }
          const inlineCorrectionReason =
            targetField.requiresReasonOnYes && formattedCorrection === 'Yes'
              ? extractReasonFromAffirmativeAnswer(correctionText)
              : '';
          const correctedResponses = {
            ...currentResponses,
            [targetField.id]: formattedCorrection,
            ...(targetField.reasonResponseId
              ? {
                  [targetField.reasonResponseId]:
                    formattedCorrection === 'Yes' ? inlineCorrectionReason : '',
                }
              : {}),
          };

          if (targetField.id === 'gender') {
            const { responses: genderUpdated } = autoSkipGenderedFields(
              kycFields,
              correctedResponses,
              formattedCorrection,
              targetFieldIndex + 1
            );
            Object.assign(correctedResponses, genderUpdated);
          }

          kycResponsesRef.current = correctedResponses;
          setKycResponses(correctedResponses);
          lastCommittedFieldRef.current = {
            index: targetFieldIndex,
            fieldId: targetField.id,
            timestamp: now,
          };
          lastCommittedTranscriptRef.current = {
            normalizedText: normalizedCleanText,
            agentTurn: agentTranscriptTurnRef.current,
            timestamp: now,
          };
          lastAnswerTimestampRef.current = now;

          if (
            !isCompleteKycDateFieldValue(targetField, formattedCorrection) ||
            !isCompleteKycPhoneFieldValue(targetField, formattedCorrection)
          ) {
            pendingClarificationTargetRef.current = {
              index: targetFieldIndex,
              fieldId: targetField.id,
              mode: 'clarify',
              timestamp: now,
            };
            return;
          }

          if (isFullNameField(targetField) && !looksLikeCompleteFullName(formattedCorrection)) {
            pendingClarificationTargetRef.current = {
              index: targetFieldIndex,
              fieldId: targetField.id,
              mode: 'clarify',
              timestamp: now,
            };
            return;
          }

          pendingClarificationTargetRef.current = null;
          if (isFullNameField(targetField)) {
            pendingNameSpellingRef.current = null;
          }

          const correctionNeedsReason =
            targetField.requiresReasonOnYes &&
            correctedResponses[targetField.id] === 'Yes' &&
            (!hasMeaningfulKycValue(correctedResponses[targetField.reasonResponseId]) ||
              (doesKycReasonNeedDuration(targetField) &&
                !hasCompleteInlineKycReason(
                  correctedResponses[targetField.reasonResponseId],
                  correctionText,
                )));

          if (correctionNeedsReason) {
            const nextReasonPhase =
              hasMeaningfulKycValue(inlineCorrectionReason) &&
              doesKycReasonNeedDuration(targetField)
              ? 'duration'
              : 'detail';
            pendingReasonFieldRef.current = {
              index: targetFieldIndex,
              fieldId: targetField.id,
              phase: nextReasonPhase,
              detail: hasMeaningfulKycValue(inlineCorrectionReason)
                ? inlineCorrectionReason
                : '',
              timestamp: Date.now(),
            };
          }

          if (targetFieldIndex === activeIndex && !correctionNeedsReason) {
            advanceKycToNextPendingField(correctedResponses, targetFieldIndex + 1);
          }
          return;
        } catch (err) {
          console.error('Clarification correction error:', err);
          return;
        } finally {
          kycTurnLockRef.current = false;
        }
      }

      pendingClarificationTargetRef.current = null;
    }

    const cooldownField = kycFields[targetFieldIndex];
    const shouldBypassCooldownForPartial =
      cooldownField &&
      ((isPhoneKycField(cooldownField) &&
        !isCompleteKycPhoneFieldValue(cooldownField, currentResponses[cooldownField.id])) ||
        (isFullNameField(cooldownField) &&
          pendingNameSpellingRef.current?.index === targetFieldIndex));
    if (
      !pendingReason &&
      !shouldBypassCooldownForPartial &&
      now - lastAnswerTimestampRef.current < ANSWER_COOLDOWN_MS
    ) {
      console.log('Cooldown active, skipping:', cleanText);
      return;
    }

    const currentField = cooldownField;
    if (!currentField) return;

    if (isLikelyFiller(cleanText, currentField)) {
      console.log('Filler detected, ignoring:', cleanText);
      return;
    }

    kycTurnLockRef.current = true;
    try {
      const awaitingReason = isKycFieldAwaitingReason(currentField, currentResponses);

      if (awaitingReason) {
        const isDurationReasonPhase = (pendingReason?.phase || "detail") === "duration";
        const previousDurationFragment =
          pendingDurationFragmentRef.current &&
          pendingDurationFragmentRef.current.fieldId === currentField.id &&
          now - pendingDurationFragmentRef.current.timestamp < 20000
            ? pendingDurationFragmentRef.current.text
            : "";
        const durationCandidateText =
          isDurationReasonPhase && previousDurationFragment
            ? `${previousDurationFragment} ${cleanText}`.trim()
            : cleanText;
        const isPartialDuration =
          isDurationReasonPhase &&
          isLikelyPartialDurationFragment(cleanText) &&
          !hasDurationPhrase(durationCandidateText);
        const isRelevantReason =
          hasMeaningfulKycValue(cleanText) &&
          !isLikelyFiller(cleanText, currentField) &&
          (!isLikelyNonReasonAnswerForField(currentField.id, cleanText) ||
            isPartialDuration ||
            (isDurationReasonPhase && hasDurationPhrase(durationCandidateText)));
        if (!isRelevantReason) {
          console.log("Irrelevant reason answer ignored:", cleanText, currentField.id);
          hideKycTranscriptMessage("user", cleanText, options);
          await promptForPendingKycReason(
            currentField,
            pendingReason?.phase || "detail",
            pendingReason?.detail || "",
          );
          return;
        }

        const reasonNormalized = await normalizeKycAnswerForPdf(
          cleanText,
          { ...currentField, type: 'text', label: currentField.reasonPromptLabel || currentField.label },
          preferredLanguage
        );
        const normalizedReason = extractReasonFromAffirmativeAnswer(
          reasonNormalized.englishText || cleanText,
        );
        const sanitizedReason = sanitizeKycReasonForField(
          currentField.id,
          normalizedReason,
        );
        const durationReason = isDurationReasonPhase
          ? sanitizeKycReasonDuration(durationCandidateText)
          : "";
        const effectiveReason =
          isDurationReasonPhase && hasMeaningfulKycValue(durationReason)
            ? durationReason
            : sanitizedReason;
        if (
          isDurationReasonPhase &&
          !hasMeaningfulKycValue(effectiveReason) &&
          isLikelyPartialDurationFragment(cleanText)
        ) {
          pendingDurationFragmentRef.current = {
            fieldId: currentField.id,
            text: durationCandidateText,
            timestamp: now,
          };
          pendingReasonFieldRef.current = {
            ...(pendingReason || {}),
            index: targetFieldIndex,
            fieldId: currentField.id,
            phase: "duration",
            timestamp: now,
          };
          hideKycTranscriptMessage("user", cleanText, options);
          return;
        }
        if (!hasMeaningfulKycValue(effectiveReason)) {
          hideKycTranscriptMessage("user", cleanText, options);
          await promptForPendingKycReason(
            currentField,
            pendingReason?.phase || "detail",
            pendingReason?.detail || "",
          );
          return;
        }

        if ((pendingReason?.phase || "detail") === "detail") {
          if (!doesKycReasonNeedDuration(currentField)) {
            const nextResponses = {
              ...currentResponses,
              [currentField.reasonResponseId]: sanitizedReason,
            };
            kycResponsesRef.current = nextResponses;
            setKycResponses(nextResponses);
            pendingReasonFieldRef.current = null;
            lastCommittedFieldRef.current = {
              index: targetFieldIndex,
              fieldId: currentField.id,
              timestamp: Date.now(),
            };
            lastCommittedTranscriptRef.current = {
              normalizedText: normalizedCleanText,
              agentTurn: agentTranscriptTurnRef.current,
              timestamp: Date.now(),
            };
            lastAnswerTimestampRef.current = Date.now();
            advanceKycToNextPendingField(nextResponses, targetFieldIndex + 1);
            return;
          }
          if (hasDurationPhrase(sanitizedReason) || hasDurationPhrase(cleanText)) {
            const nextResponses = {
              ...currentResponses,
              [currentField.reasonResponseId]: sanitizedReason,
            };
            kycResponsesRef.current = nextResponses;
            setKycResponses(nextResponses);
            pendingReasonFieldRef.current = null;
            lastCommittedFieldRef.current = {
              index: targetFieldIndex,
              fieldId: currentField.id,
              timestamp: Date.now(),
            };
            lastCommittedTranscriptRef.current = {
              normalizedText: normalizedCleanText,
              agentTurn: agentTranscriptTurnRef.current,
              timestamp: Date.now(),
            };
            lastAnswerTimestampRef.current = Date.now();
            advanceKycToNextPendingField(nextResponses, targetFieldIndex + 1);
            return;
          }

          const nextResponses = {
            ...currentResponses,
            [currentField.reasonResponseId]: sanitizedReason,
          };
          kycResponsesRef.current = nextResponses;
          setKycResponses(nextResponses);
          pendingReasonFieldRef.current = {
            index: targetFieldIndex,
            fieldId: currentField.id,
            phase: "duration",
            detail: sanitizedReason,
            timestamp: Date.now(),
          };
          const durationPrompt = await localizeKycText(
            getKycReasonFollowUpPrompt(currentField, "duration", sanitizedReason),
            preferredLanguage,
          );
          setKycChatMessages((prev) => [
            ...prev,
            { role: "assistant", content: durationPrompt },
          ]);
          lastAnswerTimestampRef.current = Date.now();
          return;
        }

        if (
          isDurationReasonPhase &&
          !hasMeaningfulKycValue(durationReason) &&
          !hasDurationPhrase(cleanText)
        ) {
          const refinedDetail =
            combineKycReasonParts(pendingReason?.detail, sanitizedReason) ||
            sanitizedReason ||
            pendingReason?.detail ||
            "";
          const nextResponses = {
            ...currentResponses,
            [currentField.reasonResponseId]: refinedDetail,
          };
          kycResponsesRef.current = nextResponses;
          setKycResponses(nextResponses);
          const trailingDurationFragment = getTrailingDurationFragment(cleanText);
          if (trailingDurationFragment) {
            pendingDurationFragmentRef.current = {
              fieldId: currentField.id,
              text: trailingDurationFragment,
              timestamp: now,
            };
          }
          pendingReasonFieldRef.current = {
            index: targetFieldIndex,
            fieldId: currentField.id,
            phase: "duration",
            detail: refinedDetail,
            timestamp: now,
          };
          hideKycTranscriptMessage("user", cleanText, options);
          await promptForPendingKycReason(
            currentField,
            "duration",
            refinedDetail,
          );
          lastAnswerTimestampRef.current = Date.now();
          return;
        }

        const combinedReason = combineKycReasonParts(
          pendingReason?.detail,
          sanitizedReason,
        );

        const nextResponses = {
          ...currentResponses,
          [currentField.reasonResponseId]: isDurationReasonPhase
            ? combineKycReasonParts(
                pendingReason?.detail,
                durationReason || sanitizedReason,
              )
            : combinedReason || sanitizedReason,
        };
        kycResponsesRef.current = nextResponses;
        setKycResponses(nextResponses);
        pendingReasonFieldRef.current = null;
        pendingDurationFragmentRef.current = null;
        lastCommittedFieldRef.current = {
          index: targetFieldIndex,
          fieldId: currentField.id,
          timestamp: Date.now(),
        };
        lastCommittedTranscriptRef.current = {
          normalizedText: normalizedCleanText,
          agentTurn: agentTranscriptTurnRef.current,
          timestamp: Date.now(),
        };
        lastAnswerTimestampRef.current = Date.now();
        advanceKycToNextPendingField(nextResponses, targetFieldIndex + 1);
        return;
      }

      const answerText = combinePartialKycAnswerText(
        currentField,
        currentResponses[currentField.id],
        cleanText,
      );
      if (isPhoneKycField(currentField)) {
        const phoneText = combinePhoneTranscriptAnswer(
          currentResponses[currentField.id],
          cleanText,
        );
        if (!isLocallyPlausibleKycAnswerForField(currentField, phoneText)) {
          console.log("Implausible phone answer ignored:", phoneText, currentField.id);
          hideKycTranscriptMessage("user", cleanText, options);
          return;
        }
        const formattedPhone = formatKycAnswerForPdf(currentField, phoneText);
        const nextResponses = {
          ...currentResponses,
          [currentField.id]: formattedPhone,
        };
        kycResponsesRef.current = nextResponses;
        setKycResponses(nextResponses);
        lastCommittedFieldRef.current = {
          index: targetFieldIndex,
          fieldId: currentField.id,
          timestamp: Date.now(),
        };
        lastCommittedTranscriptRef.current = {
          normalizedText: normalizedCleanText,
          agentTurn: agentTranscriptTurnRef.current,
          timestamp: Date.now(),
        };
        lastAnswerTimestampRef.current = Date.now();
        if (isCompleteKycPhoneFieldValue(currentField, formattedPhone)) {
          advanceKycToNextPendingField(nextResponses, targetFieldIndex + 1);
        }
        return;
      }
      if (currentField.id === "habits_addictions") {
        const yesNo = parseYesNoAnswer(answerText);
        if (yesNo === "Yes") {
          hideKycTranscriptMessage("user", cleanText, options);
          return;
        }
        if (yesNo === "No") {
          const nextResponses = {
            ...currentResponses,
            habits_addictions: "No",
          };
          kycResponsesRef.current = nextResponses;
          setKycResponses(nextResponses);
          lastAnswerTimestampRef.current = Date.now();
          advanceKycToNextPendingField(nextResponses, targetFieldIndex + 1);
          return;
        }

        const cleanedHabit = cleanHabitAnswerForPdf(answerText);
        const existingHabit = cleanHabitAnswerForPdf(currentResponses.habits_addictions);
        if (!cleanedHabit) {
          console.log("Implausible habits answer ignored:", answerText);
          hideKycTranscriptMessage("user", cleanText, options);
          return;
        }

        const isDurationAppend =
          hasDurationPhrase(cleanedHabit) &&
          !hasHabitKeyword(cleanedHabit) &&
          hasHabitKeyword(existingHabit);
        const nextHabitValue = isDurationAppend
          ? combineKycReasonParts(existingHabit, cleanedHabit)
          : cleanedHabit;
        const nextResponses = {
          ...currentResponses,
          habits_addictions: nextHabitValue,
        };
        kycResponsesRef.current = nextResponses;
        setKycResponses(nextResponses);
        lastCommittedFieldRef.current = {
          index: targetFieldIndex,
          fieldId: currentField.id,
          timestamp: Date.now(),
        };
        lastCommittedTranscriptRef.current = {
          normalizedText: normalizedCleanText,
          agentTurn: agentTranscriptTurnRef.current,
          timestamp: Date.now(),
        };
        lastAnswerTimestampRef.current = Date.now();

        if (isIncompleteHabitPhrase(answerText)) {
          return;
        }

        advanceKycToNextPendingField(nextResponses, targetFieldIndex + 1);
        return;
      }
      if (!isLocallyPlausibleKycAnswerForField(currentField, answerText)) {
        console.log("Implausible answer ignored:", answerText, currentField.id);
        hideKycTranscriptMessage("user", cleanText, options);
        return;
      }
      const normalized = await normalizeKycAnswerForPdf(answerText, currentField, preferredLanguage);
      let normalizedAnswer = normalized.canonicalYesNo || normalized.englishText || answerText;

      if (isYesNoField(currentField)) {
        const explicitYesNo = parseYesNoAnswer(answerText);
        const parsed =
          normalized.canonicalYesNo ||
          parseYesNoAnswer(normalizedAnswer) ||
          inferImplicitYesNoAnswer(currentField, answerText);
        if (!parsed) {
          return;
        }
        if (parsed === "Yes" && !explicitYesNo) {
          const isRelevantAnswer = await validateKycAnswerForField(
            answerText,
            currentField,
          );
          if (!isRelevantAnswer) {
            console.log("Irrelevant yes/no answer ignored:", cleanText, currentField.id);
            return;
          }
        }
        normalizedAnswer = parsed;
      }

      const formattedAnswer = formatKycAnswerForPdf(currentField, normalizedAnswer);
      if (
        !isLocallyPlausibleKycAnswerForField(
          currentField,
          answerText,
          formattedAnswer,
        )
      ) {
        console.log("Implausible formatted answer ignored:", formattedAnswer, currentField.id);
        hideKycTranscriptMessage("user", cleanText, options);
        return;
      }
      const inlineReason =
        currentField.requiresReasonOnYes && formattedAnswer === 'Yes'
          ? extractReasonFromAffirmativeAnswer(answerText)
          : '';

      let nextResponses = {
        ...currentResponses,
        [currentField.id]: formattedAnswer,
        ...(currentField.reasonResponseId
          ? {
              [currentField.reasonResponseId]:
                formattedAnswer === 'Yes' ? inlineReason : '',
            }
          : {}),
      };

      if (currentField.id === 'gender') {
        const { responses: genderUpdated } = autoSkipGenderedFields(
          kycFields,
          nextResponses,
          formattedAnswer,
          targetFieldIndex + 1
        );
        nextResponses = genderUpdated;
      }

      kycResponsesRef.current = nextResponses;
      setKycResponses(nextResponses);
      lastCommittedFieldRef.current = {
        index: targetFieldIndex,
        fieldId: currentField.id,
        timestamp: Date.now(),
      };
      lastCommittedTranscriptRef.current = {
        normalizedText: normalizedCleanText,
        agentTurn: agentTranscriptTurnRef.current,
        timestamp: Date.now(),
      };
      lastAnswerTimestampRef.current = Date.now();

      if (
        !isCompleteKycDateFieldValue(currentField, formattedAnswer) ||
        !isCompleteKycPhoneFieldValue(currentField, formattedAnswer)
      ) {
        pendingClarificationTargetRef.current = {
          index: targetFieldIndex,
          fieldId: currentField.id,
          mode: 'clarify',
          timestamp: Date.now(),
        };
        return;
      }

      if (isFullNameField(currentField) && !looksLikeCompleteFullName(formattedAnswer)) {
        const wordCount = formattedAnswer.trim().split(/\s+/).length;
  if (wordCount < 2) {  // ADD THIS CHECK
    pendingClarificationTargetRef.current = {
      index: targetFieldIndex,
      fieldId: currentField.id,
      mode: 'clarify',
      timestamp: Date.now(),
    };
    return;
  }
      }

      if (currentField.requiresReasonOnYes && formattedAnswer === 'Yes') {
        if (hasCompleteInlineKycReason(inlineReason, answerText)) {
          pendingReasonFieldRef.current = null;
          advanceKycToNextPendingField(nextResponses, targetFieldIndex + 1);
          return;
        }

        const nextPhase = hasMeaningfulKycValue(inlineReason) ? "duration" : "detail";
        pendingReasonFieldRef.current = {
          index: targetFieldIndex,
          fieldId: currentField.id,
          phase: nextPhase,
          detail: hasMeaningfulKycValue(inlineReason) ? inlineReason : "",
          timestamp: Date.now(),
        };
        const followUpText = await localizeKycText(
          getKycReasonFollowUpPrompt(currentField, nextPhase, inlineReason),
          preferredLanguage,
        );
        setKycChatMessages((prev) => [
          ...prev,
          { role: "assistant", content: followUpText },
        ]);
        return;
      }

      pendingReasonFieldRef.current = null;
      advanceKycToNextPendingField(nextResponses, targetFieldIndex + 1);
    } catch (err) {
      console.error('Answer processing error:', err);
    } finally {
      kycTurnLockRef.current = false;
    }
  };

  const handleAgentTranscription = async (text, options = {}) => {
    const cleanText = normalizeTranscriptEncoding(text);
    if (!cleanText) return;
    if (isLikelyBrokenTranscriptText(cleanText)) {
      console.log("Broken agent transcript ignored:", cleanText);
      return;
    }
    const now = Date.now();
    const clarificationMode = getAgentClarificationMode(cleanText);
    const lastCommitted = lastCommittedFieldRef.current;
    const activeIndex = kycCurrentFieldIndexRef.current;
    const activeField = kycFieldsRef.current[activeIndex];
    const promptedFieldId = getTranscriptPromptFieldId(cleanText);
    const promptedField = promptedFieldId
      ? kycFieldsRef.current.find((field) => field.id === promptedFieldId)
      : null;
    if (promptedField && shouldSkipFieldForGender(promptedField, kycResponsesRef.current)) {
      console.log("[KYC] Ignored gender-skipped prompt:", promptedField.id);
      return;
    }
    const activeFieldAwaitingReason =
      activeField &&
      (isKycFieldAwaitingReason(activeField, kycResponsesRef.current) ||
        (pendingReasonFieldRef.current?.index === activeIndex &&
          kycResponsesRef.current[activeField.id] === "Yes"));
    if (
      activeFieldAwaitingReason &&
      !pendingReasonFieldRef.current &&
      activeField?.reasonResponseId &&
      doesKycReasonNeedDuration(activeField) &&
      hasMeaningfulKycValue(kycResponsesRef.current[activeField.reasonResponseId]) &&
      !hasDurationPhrase(kycResponsesRef.current[activeField.reasonResponseId])
    ) {
      pendingReasonFieldRef.current = {
        index: activeIndex,
        fieldId: activeField.id,
        phase: "duration",
        detail: kycResponsesRef.current[activeField.reasonResponseId],
        timestamp: now,
      };
    }
    if (
      !activeFieldAwaitingReason &&
      isReasonFollowUpText(cleanText) &&
      !promptedFieldId &&
      /\b(since how long|condition|reason|details?)\b/i.test(cleanText)
    ) {
      console.log("Stale reason follow-up ignored:", cleanText);
      return;
    }
    let matchedFieldIndex = -1;

    if (!kycCompleteRef.current && kycFields.length > 0) {
      matchedFieldIndex = resolveAgentAskedFieldIndex(
        cleanText,
        kycFields,
        kycResponsesRef.current,
        activeIndex,
        lastCommitted,
      );

      const promptedIndex = promptedField
        ? kycFields.findIndex((field) => field.id === promptedField.id)
        : -1;
      if (promptedIndex >= 0) {
        if (matchedFieldIndex < 0 || promptedField.id === "all_ci_cover") {
          matchedFieldIndex = promptedIndex;
        }
      }

      if (
        matchedFieldIndex < 0 &&
        activeField &&
        !isKycFieldComplete(activeField, kycResponsesRef.current) &&
        isLikelyCurrentYesNoFormPrompt(cleanText, activeField)
      ) {
        matchedFieldIndex = activeIndex;
      }

      if (
        activeFieldAwaitingReason &&
        isReasonFollowUpText(cleanText) &&
        (!promptedFieldId || promptedFieldId === activeField?.id)
      ) {
        matchedFieldIndex = activeIndex;
      }

      if (
        activeField?.id === "diagnostic_tests" &&
        matchedFieldIndex === activeIndex &&
        /when\s+(?:was|were)\b/i.test(cleanText)
      ) {
        const diagnosticDetail = extractDiagnosticDetailFromTimingPrompt(cleanText);
        if (hasMeaningfulKycValue(diagnosticDetail)) {
          const updatedResponses = {
            ...kycResponsesRef.current,
            diagnostic_tests: "Yes",
            diagnostic_tests_reason:
              kycResponsesRef.current.diagnostic_tests_reason ||
              diagnosticDetail,
          };
          kycResponsesRef.current = updatedResponses;
          setKycResponses(updatedResponses);
          pendingReasonFieldRef.current = {
            index: activeIndex,
            fieldId: activeField.id,
            phase: "duration",
            detail: updatedResponses.diagnostic_tests_reason,
            timestamp: now,
          };
        }
      }

      const isExplicitCriticalIllnessPrompt =
        promptedField?.id === "all_ci_cover" && matchedFieldIndex === promptedIndex;
      if (
        matchedFieldIndex >= 0 &&
        matchedFieldIndex < activeIndex &&
        !activeFieldAwaitingReason &&
        !isExplicitCriticalIllnessPrompt &&
        isKycFieldComplete(kycFields[matchedFieldIndex], kycResponsesRef.current)
      ) {
        ignoredAgentFollowUpRef.current = {
          index: matchedFieldIndex,
          fieldId: kycFields[matchedFieldIndex].id,
          timestamp: now,
        };
        matchedFieldIndex = -1;
      }
    }

    let blockingReasonField =
      matchedFieldIndex > 0
        ? getBlockingIncompleteReasonFieldBeforePrompt(
            kycFields,
            kycResponsesRef.current,
            matchedFieldIndex,
          )
        : null;
    if (
      blockingReasonField?.phase === "duration" &&
      commitRecentDurationForField(
        blockingReasonField.field,
        blockingReasonField.index,
        blockingReasonField.detail,
      )
    ) {
      blockingReasonField = null;
    }
    if (blockingReasonField) {
      const { field, index, phase, detail } = blockingReasonField;
      kycCurrentFieldIndexRef.current = index;
      setKycCurrentFieldIndex(index);
      pendingReasonFieldRef.current = {
        index,
        fieldId: field.id,
        phase,
        detail,
        timestamp: now,
      };
      console.log(
        "[KYC] Held incomplete reason before next prompt:",
        field.id,
        "->",
        kycFields[matchedFieldIndex]?.id,
      );
      await promptForPendingKycReason(field, phase, detail);
      return;
    }

    if (
      activeFieldAwaitingReason &&
      matchedFieldIndex > activeIndex &&
      shouldHoldPendingReasonBeforeAgentJump(
        activeField,
        pendingReasonFieldRef.current,
      )
    ) {
      if (
        (pendingReasonFieldRef.current?.phase === "duration" ||
          (activeField?.reasonResponseId &&
            hasMeaningfulKycValue(kycResponsesRef.current[activeField.reasonResponseId]))) &&
        commitRecentDurationForField(
          activeField,
          activeIndex,
          pendingReasonFieldRef.current?.detail ||
            kycResponsesRef.current[activeField.reasonResponseId] ||
            "",
        )
      ) {
        pendingReasonFieldRef.current = null;
      } else {
      const jumpedField = kycFields[matchedFieldIndex];
      if (shouldResyncAfterMissedRequiredFollowUp(activeField, jumpedField)) {
        const updatedResponses = { ...kycResponsesRef.current };
        if (
          activeField?.reasonResponseId &&
          !hasMeaningfulKycValue(updatedResponses[activeField.reasonResponseId])
        ) {
          updatedResponses[activeField.reasonResponseId] = "Destination not captured";
          kycResponsesRef.current = updatedResponses;
          setKycResponses(updatedResponses);
        }
        pendingReasonFieldRef.current = null;
        console.log(
          "[KYC] Resynced after missed required follow-up:",
          activeField?.id,
          "->",
          jumpedField?.id,
        );
      } else {
      console.log(
        "[KYC] Held required reason before next prompt:",
        activeField?.id,
        "->",
        kycFields[matchedFieldIndex]?.id,
      );
      await promptForPendingKycReason(
        activeField,
        pendingReasonFieldRef.current?.phase || "detail",
        pendingReasonFieldRef.current?.detail || "",
      );
      return;
      }
      }
    }

    if (activeFieldAwaitingReason && matchedFieldIndex > activeIndex) {
      const updatedResponses = { ...kycResponsesRef.current };
      recentReasonCarryoverRef.current = {
        index: activeIndex,
        fieldId: activeField?.id,
        phase: pendingReasonFieldRef.current?.phase || "detail",
        detail:
          pendingReasonFieldRef.current?.detail ||
          updatedResponses[activeField?.reasonResponseId] ||
          "",
        timestamp: now,
      };
      if (
        pendingReasonFieldRef.current?.index === activeIndex &&
        pendingReasonFieldRef.current?.phase === "duration" &&
        hasMeaningfulKycValue(pendingReasonFieldRef.current?.detail)
      ) {
        recentReasonCarryoverRef.current = {
          ...pendingReasonFieldRef.current,
          timestamp: now,
        };
      }
      if (
        activeField?.requiresReasonOnYes &&
        updatedResponses[activeField.id] === "Yes" &&
        !hasRecordedKycValue(updatedResponses[activeField.reasonResponseId])
      ) {
        updatedResponses[activeField.reasonResponseId] = KYC_UNCAPTURED_VALUE;
        kycResponsesRef.current = updatedResponses;
        setKycResponses(updatedResponses);
      } else if (
        activeField?.id === "diagnostic_tests" &&
        activeField.reasonResponseId &&
        hasMeaningfulKycValue(updatedResponses[activeField.reasonResponseId]) &&
        !hasDurationPhrase(updatedResponses[activeField.reasonResponseId])
      ) {
        updatedResponses[activeField.reasonResponseId] = combineKycReasonParts(
          updatedResponses[activeField.reasonResponseId],
          "Timing not captured",
        );
        kycResponsesRef.current = updatedResponses;
        setKycResponses(updatedResponses);
      }
      pendingReasonFieldRef.current = null;
      console.log(
        "[KYC] Closed missing reason and allowed next prompt:",
        activeField?.id,
        "->",
        kycFields[matchedFieldIndex]?.id,
      );
    }
    console.log('Agent matched field:', matchedFieldIndex, 'current:', kycCurrentFieldIndexRef.current, 'text:', cleanText.slice(0, 50));

    const fieldForFingerprint =
      matchedFieldIndex >= 0 ? matchedFieldIndex : activeIndex;
    const eventKey = getTranscriptMessageKey(
      "assistant",
      cleanText,
      options?.eventKey,
    );
    const fingerprint = getTranscriptFingerprint(
      "assistant",
      cleanText,
      fieldForFingerprint,
      clarificationMode || "prompt",
    );
    if (
      !registerProcessedTranscript({
        rawKey: eventKey,
        fingerprint,
        windowMs: 12000,
      })
    )
      return;

    agentTranscriptTurnRef.current += 1;

    let clarificationTargetIndex =
      matchedFieldIndex >= 0 ? matchedFieldIndex : lastCommitted?.index;
    let clarificationTargetField =
      clarificationTargetIndex != null ? kycFields[clarificationTargetIndex] : null;
    if (
      clarificationMode === "clarify" &&
      /\bspell\b/i.test(cleanText) &&
      /\bname\b/i.test(cleanText) &&
      !isFullNameField(clarificationTargetField)
    ) {
      const recentNameIndex = [...kycFields.keys()]
        .filter((idx) => idx <= activeIndex && isFullNameField(kycFields[idx]))
        .reverse()
        .find((idx) => hasMeaningfulKycValue(kycResponsesRef.current[kycFields[idx].id]));
      if (recentNameIndex != null) {
        clarificationTargetIndex = recentNameIndex;
        clarificationTargetField = kycFields[recentNameIndex];
      }
    }
    const clarificationTargetsCompletedPastField =
      clarificationTargetIndex != null &&
      clarificationTargetIndex < kycCurrentFieldIndexRef.current &&
      clarificationTargetField &&
      isKycFieldComplete(clarificationTargetField, kycResponsesRef.current);
    const clarificationShouldUpdateCompletedName =
      clarificationTargetsCompletedPastField &&
      clarificationMode === "clarify" &&
      clarificationTargetField &&
      isFullNameField(clarificationTargetField) &&
      /\bspell|full name|name\b/i.test(cleanText);

    if (
      clarificationMode &&
      clarificationTargetField &&
      (!clarificationTargetsCompletedPastField || clarificationShouldUpdateCompletedName) &&
      (
        matchedFieldIndex >= 0 ||
        (lastCommitted && Date.now() - lastCommitted.timestamp < 20000) ||
        (clarificationMode === "clarify" &&
          isFullNameField(clarificationTargetField) &&
          /\bspell\b/i.test(cleanText))
      )
    ) {
      pendingClarificationTargetRef.current = {
        index: clarificationTargetIndex,
        fieldId: clarificationTargetField.id,
        mode: clarificationMode,
        text: cleanText,
        timestamp: now,
      };
      if (clarificationMode === "clarify" && isFullNameField(clarificationTargetField)) {
        pendingNameSpellingRef.current = {
          index: clarificationTargetIndex,
          fieldId: clarificationTargetField.id,
          value: "",
          timestamp: now,
        };
      }
      lastAgentAskedFieldRef.current = {
        index: clarificationTargetIndex,
        timestamp: now,
        text: cleanText,
      };
    } else {
      pendingClarificationTargetRef.current = null;
    }

  if (!kycCompleteRef.current && kycFields.length > 0) {
      if (
        matchedFieldIndex >= 0 &&
        matchedFieldIndex !== kycCurrentFieldIndexRef.current
      ) {
    if (
      matchedFieldIndex > kycCurrentFieldIndexRef.current &&
      activeField &&
      shouldHoldIncompleteFieldBeforeAgentJump(
        activeField,
        kycResponsesRef.current,
      ) &&
      !(
        activeField.requiresReasonOnYes &&
        kycResponsesRef.current[activeField.id] === "Yes" &&
        isUncapturedKycValue(kycResponsesRef.current[activeField.reasonResponseId])
      )
    ) {
      console.log(
        "[KYC] Ignored premature jump while current field is incomplete:",
        activeField.id,
        "->",
        kycFields[matchedFieldIndex]?.id,
      );
      matchedFieldIndex = -1;
    } else {
    const wouldGoBackwards = matchedFieldIndex < kycCurrentFieldIndexRef.current;
    const targetAlreadyComplete = isKycFieldComplete(
      kycFields[matchedFieldIndex],
      kycResponsesRef.current
    );
    const allowExplicitCriticalIllnessReopen =
      promptedField?.id === "all_ci_cover" &&
      matchedFieldIndex === kycFields.findIndex((field) => field.id === "all_ci_cover");
    if (!wouldGoBackwards || !targetAlreadyComplete || allowExplicitCriticalIllnessReopen) {
      if (matchedFieldIndex > kycCurrentFieldIndexRef.current) {
        const skippedResult = markSkippedFieldsAsUncaptured(
          kycFields,
          kycResponsesRef.current,
          kycCurrentFieldIndexRef.current,
          matchedFieldIndex,
          lastUserTranscriptRef.current,
        );
        if (skippedResult.changed) {
          kycResponsesRef.current = skippedResult.responses;
          setKycResponses(skippedResult.responses);
        }
      }
      kycCurrentFieldIndexRef.current = matchedFieldIndex;
      setKycCurrentFieldIndex(matchedFieldIndex);
    }
    }
  }

  if (matchedFieldIndex >= 0) {
    ignoredAgentFollowUpRef.current = null;
    lastAgentAskedFieldRef.current = {
      index: matchedFieldIndex,
      timestamp: now,
      text: cleanText,
    };
  }
}

    const displayCleanText = await localizeTranscriptDisplayText(cleanText);
    console.log("Agent said:", cleanText);
    await recordKycTranscriptMessage("assistant", cleanText, options);

    if (isKycCompletionAnnouncement(cleanText)) {
      const nextPendingIndex = findNextPendingKycFieldIndex(
        kycFields,
        kycResponsesRef.current,
        0,
      );
      if (nextPendingIndex < kycFields.length) {
        kycCurrentFieldIndexRef.current = nextPendingIndex;
        setKycCurrentFieldIndex(nextPendingIndex);
        console.log(
          "[KYC] Ignored premature completion announcement; pending field:",
          kycFields[nextPendingIndex]?.id,
        );
        return;
      }
      window.setTimeout(() => {
        finalizeKycSession({
          reason: "completion_announcement",
          announce: false,
        });
      }, 1200);
    }
  };

  useEffect(() => {
    kycResponsesRef.current = kycResponses;
  }, [kycResponses]);

  useEffect(() => {
    kycCompleteRef.current = kycComplete;
  }, [kycComplete]);

  useEffect(() => {
    if (!isRecordingCall || !kycFields.length) return;
    if (
      getCompletedKycFieldCount(kycFields, kycResponses) >= kycFields.length
    ) {
      stopCallRecording();
    }
  }, [isRecordingCall, kycFields, kycResponses]);

  useEffect(() => {
    transcriptHandlerRefs.current = {
      onUser: handleUserTranscription,
      onAgent: handleAgentTranscription,
    };
  });

  useEffect(() => {
    if (isAvatarConnected && cameraEnabled) {
      startUserCamera();
      return undefined;
    }

    stopUserCamera();
    return undefined;
  }, [cameraEnabled, isAvatarConnected]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  useEffect(() => {
    dischargeChatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [dischargeChatMessages]);

  // Auto-scroll care plan to current question
  useEffect(() => {
    carePlanEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentQuestionIndex, carePlanResponses]);

  // Auto-scroll KYC chat
  useEffect(() => {
    kycChatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    kycLiveTranscriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [kycChatMessages, kycTranscriptPreview]);

  useEffect(() => {
    kycCurrentFieldIndexRef.current = kycCurrentFieldIndex;
  }, [kycCurrentFieldIndex]);

  useEffect(() => {
    return () => {
      releaseCallRecordingResources();
      stopUserCamera();
      if (beyondPresenceSession?.roomName || beyondPresenceSession?.agentId) {
        fetch(`${API_BASE}/api/beyondpresence/stop-session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomName: beyondPresenceSession.roomName,
            agentId: beyondPresenceSession.agentId,
          }),
        }).catch(() => {});
      }
    };
  }, [API_BASE, beyondPresenceSession]);

  const localizeKycText = async (text, languageCode = preferredLanguage, options = {}) => {
    const trimmed = String(text || "").trim();
    if (!trimmed) return "";
    if (!languageCode || languageCode === "en") return trimmed;

    try {
      const res = await fetch(`${API_BASE}/api/kyc/localize-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: trimmed,
          languageCode,
          transcriptScript: Boolean(options.transcriptScript),
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "KYC localization failed");
      }

      const localized = normalizeTranscriptEncoding(stripInlineYesDetailInstruction(data.text || trimmed));
      return localized;
    } catch (err) {
      console.error("KYC localization fallback:", err);
      if (languageCode === "hi") {
        return options.transcriptScript
          ? normalizeTranscriptEncoding(trimmed)
          : normalizeTranscriptEncoding(trimmed);
      }
      return normalizeTranscriptEncoding(trimmed);
    }
  };

  const localizeTranscriptDisplayText = async (text) => {
    const trimmed = normalizeTranscriptDisplayAnswer(text);
    if (!trimmed || !preferredLanguage || preferredLanguage === "en") return normalizeTranscriptEncoding(trimmed);
    if (preferredLanguage === "hi") {
      const localized = await localizeKycText(trimmed, preferredLanguage, { transcriptScript: true });
      const cleanLocalized = normalizeTranscriptEncoding(localized);
      if (cleanLocalized && normalize(cleanLocalized) !== normalize(trimmed)) return cleanLocalized;
      return normalizeTranscriptEncoding(trimmed);
    }
    const fastDisplay = getFastTranscriptDisplayText(text, preferredLanguage);
    const shouldConvertMixedHindi =
      preferredLanguage === "hi" && /[A-Za-z]/.test(trimmed);
    if (
      /[^\x00-\x7F]/.test(trimmed) &&
      !hasMojibakeMarker(trimmed) &&
      !shouldConvertMixedHindi
    ) {
      return normalizeTranscriptEncoding(trimmed);
    }
    const localized = await localizeKycText(trimmed, preferredLanguage, { transcriptScript: true });
    if (preferredLanguage === "hi" && needsHindiTranscriptFallback(localized)) {
      return getHindiTranscriptFallback(localized);
    }
    return localized;
  };

  const promptForPendingKycReason = async (field, phase = "detail", detail = "") => {
    const repromptEnglish =
      phase === "duration"
        ? getKycReasonFollowUpPrompt(field, "duration", detail)
        : field?.id === "diagnostic_tests"
        ? getKycReasonFollowUpPrompt(field, "detail", detail)
        : "Please tell me the actual condition or reason, not only yes or no.";
    try {
      const reprompt = await localizeKycText(repromptEnglish, preferredLanguage);
      setKycChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: reprompt },
      ]);
    } catch (err) {
      console.error("KYC reason reprompt localization error:", err);
      setKycChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: repromptEnglish },
      ]);
    }
  };

  const commitRecentDurationForField = (field, index, detail = "") => {
    if (!field?.reasonResponseId) return false;
    const recentUser = lastUserTranscriptRef.current;
    if (!recentUser || Date.now() - recentUser.timestamp > 25000) return false;
    const recentText = recentUser.text || "";
    const pendingFragment =
      pendingDurationFragmentRef.current?.fieldId === field.id &&
      Date.now() - pendingDurationFragmentRef.current.timestamp < 25000
        ? pendingDurationFragmentRef.current.text
        : "";
        const durationText = pendingFragment
      ? normalize(recentText).startsWith(normalize(pendingFragment))
        ? recentText
        : `${pendingFragment} ${recentText}`.trim()
      : recentText;
    const duration = sanitizeKycReasonDuration(durationText);
    if (!hasMeaningfulKycValue(duration)) return false;
    const existingDetail =
      detail ||
      kycResponsesRef.current[field.reasonResponseId] ||
      "";
    if (!hasMeaningfulKycValue(existingDetail)) return false;
    const updatedResponses = {
      ...kycResponsesRef.current,
      [field.id]: "Yes",
      [field.reasonResponseId]: combineKycReasonParts(existingDetail, duration),
    };
    kycResponsesRef.current = updatedResponses;
    setKycResponses(updatedResponses);
    pendingReasonFieldRef.current = null;
    pendingDurationFragmentRef.current = null;
    lastCommittedFieldRef.current = {
      index,
      fieldId: field.id,
      timestamp: Date.now(),
    };
    lastCommittedTranscriptRef.current = {
      normalizedText: normalize(recentText),
      agentTurn: agentTranscriptTurnRef.current,
      timestamp: Date.now(),
    };
    lastAnswerTimestampRef.current = Date.now();
    console.log("[KYC] Committed recent duration before next prompt:", field.id, duration);
    return true;
  };

  const normalizeKycAnswerForPdf = async (
    text,
    field,
    languageCode = preferredLanguage,
  ) => {
    const trimmed = normalizeTranscriptEncoding(text);
    if (!field) {
    console.error("normalizeKycAnswerForPdf: field is undefined, skipping");
    return { englishText: trimmed, canonicalYesNo: null };
  }

    if (!trimmed) {
      return { englishText: "", canonicalYesNo: null };
    }

    const localStructured = normalizeStructuredKycAnswerLocally(field, trimmed);
    const canUseLocalPdfValue =
      !languageCode ||
      languageCode === "en" ||
      Boolean(localStructured.canonicalYesNo) ||
      field?.id === "contact_no" ||
      field?.id === "application_no" ||
      field?.id === "gender" ||
      field?.type === "date" ||
      field?.type === "number";
    if (
      canUseLocalPdfValue &&
      localStructured.handled &&
      hasMeaningfulKycValue(localStructured.englishText)
    ) {
      return {
        englishText: localStructured.englishText,
        canonicalYesNo: localStructured.canonicalYesNo,
      };
    }

    try {
      const res = await fetch(`${API_BASE}/api/kyc/normalize-answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: trimmed,
          preferredLanguage: languageCode || "en",
          currentFieldLabel: field?.label || "",
          currentFieldType: field?.type || "text",
          currentFieldSection: field?.section || "",
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "KYC answer normalization failed");
      }

      return {
        englishText: data.englishText || trimmed,
        canonicalYesNo:
          data.canonicalYesNo === "Yes" || data.canonicalYesNo === "No"
            ? data.canonicalYesNo
            : null,
      };
    } catch (err) {
      console.error("KYC normalization fallback:", err);
      return {
        englishText: trimmed,
        canonicalYesNo: null,
      };
    }
  };

  const validateKycAnswerForField = async (
    text,
    field,
    { awaitingReason = false } = {},
  ) => {
    const trimmed = String(text || "").trim();
    if (!trimmed || !field) return false;

    if (!awaitingReason && !isLocallyPlausibleKycAnswerForField(field, trimmed)) {
      return false;
    }

    if (!awaitingReason && isYesNoField(field) && parseYesNoAnswer(trimmed)) {
      return true;
    }

    if (
      isYesNoField(field) &&
      (isLikelyRelevantImplicitYes(field, trimmed) ||
        inferImplicitYesNoAnswer(field, trimmed) === "No")
    ) {
      return true;
    }

    if (awaitingReason) {
      return hasMeaningfulKycValue(trimmed) && !isLikelyFiller(trimmed, field);
    }

    if (!isYesNoField(field) || field.type === "date" || field.type === "number") {
      return true;
    }

    try {
      const res = await fetch(`${API_BASE}/api/kyc/validate-answer-relevance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: trimmed,
          preferredLanguage: preferredLanguage || "en",
          currentFieldLabel: field.label || "",
          currentFieldPrompt: field.prompt || "",
          currentFieldType: field.type || "text",
          currentFieldSection: field.section || "",
          awaitingReason,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Validation failed");
      return data.relevant === true && Number(data.confidence ?? 0) >= 0.55;
    } catch (err) {
      console.error("KYC relevance validation fallback:", err);
      return awaitingReason
        ? hasMeaningfulKycValue(trimmed) && !isLikelyFiller(trimmed, field)
        : true;
    }
  };

  const buildEnglishKycResponsesForPdf = async (fields = [], responses = {}) => {
    const nextResponses = { ...responses };
    const transcriptRecoveredResponses = recoverKycResponsesFromTranscript(kycChatMessages);
    const transcriptReliableFieldIds = new Set([
      ...PRESET_DEMO_KYC_FIELDS.map((field) => field.reasonResponseId).filter(Boolean),
      "all_life_cover",
      "all_ci_cover",
    ]);
    for (const [fieldId, value] of Object.entries(transcriptRecoveredResponses)) {
      if (fieldId === "application_no" && !/^\d{3,}$/.test(String(value || "").trim())) {
        continue;
      }
      if (fieldId === "weight_kg") {
        const numericWeight = Number(formatNumericForPdf(value));
        if (
          !/^\d+(\.\d+)?$/.test(String(formatNumericForPdf(value))) ||
          numericWeight <= 0 ||
          numericWeight >= 300
        ) {
          continue;
        }
      }
      const currentField = fields.find((field) => field.id === fieldId);
      const currentValue = nextResponses[fieldId];
      const recoveredImprovesName =
        (fieldId === "life_to_be_assured_name" || fieldId === "nominee_name") &&
        String(value || "").trim().split(/\s+/).length >
          String(currentValue || "").trim().split(/\s+/).filter(Boolean).length;
      const currentLooksInvalid =
        (fieldId === "application_no" &&
          !/^\d{3,}$/.test(String(formatKycAnswerForPdf({ id: "application_no", type: "text" }, currentValue) || "").trim())) ||
        (currentField?.type === "date" &&
          !/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(String(currentValue || "").trim())) ||
        (fieldId === "gender" &&
          !["male", "female", "other"].includes(String(currentValue || "").toLowerCase().trim())) ||
        (fieldId === "height_cm" &&
          (
            !/^\d+(\.\d+)?$/.test(String(formatHeightCmForPdf(currentValue) || "").trim()) ||
            Number(formatHeightCmForPdf(currentValue)) < 100 ||
            Number(formatHeightCmForPdf(currentValue)) > 250
          )) ||
        (fieldId === "weight_kg" &&
          !/^\d+(\.\d+)?$/.test(String(formatNumericForPdf(currentValue) || "").trim()));
      if (
        transcriptReliableFieldIds.has(fieldId) ||
        recoveredImprovesName ||
        currentLooksInvalid ||
        !hasRecordedKycValue(nextResponses[fieldId]) ||
        isUncapturedLikeKycValue(nextResponses[fieldId])
      ) {
        nextResponses[fieldId] = value;
      }
    }
    const shouldNormalizeAll = preferredLanguage && preferredLanguage !== "en";
    const needsEnglishPass = (value) =>
      shouldNormalizeAll ||
      /[^\x00-\x7F]/.test(String(value || "")) ||
      /\\u[0-9a-fA-F]{4}|Ãƒ|Ã‚|Ã¢|Ã /.test(String(value || ""));

    for (const field of fields) {
      if (!hasRecordedKycValue(nextResponses[field.id]) || isUncapturedLikeKycValue(nextResponses[field.id])) {
        const recoveredValue = getRecoveredTranscriptValue(field.id, kycChatMessages);
        if (hasMeaningfulKycValue(recoveredValue)) {
          nextResponses[field.id] = recoveredValue;
        }
      }

      const value = nextResponses[field.id];
      if (hasRecordedKycValue(value) && !isUncapturedKycValue(value) && needsEnglishPass(value)) {
        const normalized = await normalizeKycAnswerForPdf(
          value,
          field,
          preferredLanguage || "en",
        );
        const pdfValue =
          normalized.canonicalYesNo ||
          normalized.englishText ||
          nextResponses[field.id];
        nextResponses[field.id] = formatKycAnswerForPdf(field, pdfValue);
      }

      if (field.reasonResponseId) {
        const reason = nextResponses[field.reasonResponseId];
        if (hasRecordedKycValue(reason) && !isUncapturedKycValue(reason) && needsEnglishPass(reason)) {
          const normalizedReason = await normalizeKycAnswerForPdf(
            reason,
            {
              ...field,
              type: "text",
              label: field.reasonPromptLabel || field.label,
            },
            preferredLanguage || "en",
          );
          nextResponses[field.reasonResponseId] = extractReasonFromAffirmativeAnswer(
            normalizedReason.englishText || reason,
          );
        }
        if (
          hasRecordedKycValue(nextResponses[field.reasonResponseId]) &&
          !isUncapturedLikeKycValue(nextResponses[field.reasonResponseId])
        ) {
          const sanitizedReason = sanitizeKycReasonForField(
            field.id,
            nextResponses[field.reasonResponseId],
          );
          nextResponses[field.reasonResponseId] = sanitizedReason || "";
        }
        if (
          field.requiresReasonOnYes &&
          nextResponses[field.id] === "Yes" &&
          !hasMeaningfulKycValue(nextResponses[field.reasonResponseId]) &&
          !Object.prototype.hasOwnProperty.call(transcriptRecoveredResponses, field.id)
        ) {
          nextResponses[field.id] = KYC_UNCAPTURED_VALUE;
        }
      }
    }

    if (
      /\b(lakhs?|lacs?|crores?)\b/i.test(String(nextResponses.existing_insurance_cover || "")) &&
      hasMeaningfulKycValue(nextResponses.all_life_cover)
    ) {
      nextResponses.existing_insurance_cover = "No";
    }
    if (
      hasMeaningfulKycValue(nextResponses.existing_insurance_cover) &&
      hasHabitKeyword(nextResponses.existing_insurance_cover)
    ) {
      const repairedHabit = cleanHabitAnswerForPdf(
        combineKycReasonParts(
          hasMeaningfulKycValue(nextResponses.habits_addictions)
            ? nextResponses.habits_addictions
            : "",
          nextResponses.existing_insurance_cover,
        ),
      );
      if (hasMeaningfulKycValue(repairedHabit)) {
        nextResponses.habits_addictions = repairedHabit;
      }
      nextResponses.existing_insurance_cover = KYC_UNCAPTURED_VALUE;
    }
    if (
      hasMeaningfulKycValue(nextResponses.existing_insurance_cover) &&
      isUnsafeKycPdfText(nextResponses.existing_insurance_cover)
    ) {
      nextResponses.existing_insurance_cover = KYC_UNCAPTURED_VALUE;
    }
    if (
      hasMeaningfulKycValue(nextResponses.habits_addictions) &&
      (isUnsafeKycPdfText(nextResponses.habits_addictions) ||
        (!/^(none|no|nil|nothing|not applicable)$/i.test(
          String(nextResponses.habits_addictions || "").trim(),
        ) &&
          !hasHabitKeyword(nextResponses.habits_addictions)))
    ) {
      nextResponses.habits_addictions = KYC_UNCAPTURED_VALUE;
    } else if (
      hasMeaningfulKycValue(nextResponses.habits_addictions) &&
      !isUncapturedLikeKycValue(nextResponses.habits_addictions)
    ) {
      const cleanedHabit = cleanHabitAnswerForPdf(nextResponses.habits_addictions);
      nextResponses.habits_addictions = cleanedHabit || KYC_UNCAPTURED_VALUE;
    }
    for (const numericFieldId of ["all_life_cover", "all_ci_cover"]) {
      const rawNumberText = String(nextResponses[numericFieldId] || "").trim();
      const normalizedNumberText = normalizeIndicSpeechText(rawNumberText).toLowerCase();
      const formattedNumber = formatNumericForPdf(nextResponses[numericFieldId]);
      if (
        hasMeaningfulKycValue(nextResponses[numericFieldId]) &&
        !isUncapturedLikeKycValue(nextResponses[numericFieldId]) &&
        (!/^\d+(\.\d+)?$/.test(String(formattedNumber || "").trim()) ||
          isYesNoTranscriptText(rawNumberText) ||
          hasHabitKeyword(rawNumberText) ||
          /\b(alcohol|smok|tobacco|habit|addiction|years?|months?)\b/i.test(normalizedNumberText))
      ) {
        nextResponses[numericFieldId] = KYC_UNCAPTURED_VALUE;
      }
    }
    if (
      hasMeaningfulKycValue(nextResponses.declaration) &&
      !isUncapturedLikeKycValue(nextResponses.declaration) &&
      !parseYesNoAnswer(nextResponses.declaration)
    ) {
      nextResponses.declaration = KYC_UNCAPTURED_VALUE;
    }
    if (!["male", "female", "other"].includes(String(nextResponses.gender || "").toLowerCase().trim())) {
      nextResponses.gender = KYC_UNCAPTURED_VALUE;
    }
    const formattedHeight = formatHeightCmForPdf(nextResponses.height_cm);
    if (
      hasMeaningfulKycValue(nextResponses.height_cm) &&
      !isUncapturedLikeKycValue(nextResponses.height_cm) &&
      (!/^\d+(\.\d+)?$/.test(String(formattedHeight || "").trim()) ||
        Number(formattedHeight) < 100 ||
        Number(formattedHeight) > 250)
    ) {
      nextResponses.height_cm = KYC_UNCAPTURED_VALUE;
    }
    const formattedWeight = formatNumericForPdf(nextResponses.weight_kg);
    if (
      hasMeaningfulKycValue(nextResponses.weight_kg) &&
      !isUncapturedLikeKycValue(nextResponses.weight_kg) &&
      (!/^\d+(\.\d+)?$/.test(String(formattedWeight || "").trim()) ||
        Number(formattedWeight) <= 0 ||
        Number(formattedWeight) >= 300)
    ) {
      nextResponses.weight_kg = KYC_UNCAPTURED_VALUE;
    }
    for (const dateFieldId of ["date_of_birth", "nominee_dob"]) {
      if (
        hasMeaningfulKycValue(nextResponses[dateFieldId]) &&
        !isUncapturedLikeKycValue(nextResponses[dateFieldId]) &&
        !isReasonableKycDateValue(nextResponses[dateFieldId])
      ) {
        nextResponses[dateFieldId] = KYC_UNCAPTURED_VALUE;
      }
    }

    const commonSurgeryReason = String(
      nextResponses.hospitalization_common_surgeries_reason || "",
    );
    if (/\b(typhoid|malaria|dengue|gastroenteritis|dehydration)\b/i.test(commonSurgeryReason)) {
      nextResponses.hospitalization_infection_recovery = "Yes";
      nextResponses.hospitalization_infection_recovery_reason = commonSurgeryReason;
      nextResponses.hospitalization_common_surgeries = "No";
      nextResponses.hospitalization_common_surgeries_reason = "";
    }

    const travelValue = String(nextResponses.travel_outside_india || "").trim();
      if (
        travelValue &&
        !isUncapturedLikeKycValue(travelValue) &&
        !parseYesNoAnswer(travelValue) &&
        isLikelyTravelDestinationText(travelValue)
    ) {
      nextResponses.travel_outside_india = "Yes";
      nextResponses.travel_outside_india_reason = travelValue;
    } else if (
      nextResponses.travel_outside_india === "Yes" &&
      (!hasMeaningfulKycValue(nextResponses.travel_outside_india_reason) ||
        !isLikelyTravelDestinationText(nextResponses.travel_outside_india_reason))
    ) {
      nextResponses.travel_outside_india_reason =
        nextResponses.travel_outside_india_reason === "Destination not captured"
          ? "Destination not captured"
          : "";
    }
    if (
      nextResponses.other_disease === "Yes" &&
      !hasMeaningfulKycValue(nextResponses.other_disease_reason) &&
      nextResponses.travel_outside_india === "Yes"
    ) {
      nextResponses.other_disease = "No";
    }
    if (
      nextResponses.blood_disorder === "Yes" &&
      !hasMeaningfulKycValue(nextResponses.blood_disorder_reason) &&
      /\bblood cancer\b/i.test(String(nextResponses.cancer_tumour_reason || ""))
    ) {
      nextResponses.blood_disorder = "No";
    }

    return nextResponses;
  };

  // Handle call log file upload
  const handleCallFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setCallFile(file);

    if (file.type === "text/plain" || file.name.endsWith(".txt")) {
      const text = await file.text();
      setCallTranscript(text);

      // Auto-start analysis
      setChatMessages([
        {
          role: "system",
          content: `ðŸ“ Uploaded: ${file.name}`,
          isSystem: true,
        },
      ]);

      // Trigger initial analysis
      analyzeCallTranscript(text, dischargeSummary);
    } else {
      alert("Please upload a .txt file for call logs");
    }
  };

  // Handle discharge PDF upload
  const handleDischargeFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setDischargeFile(file);

    if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
      try {
        // For PDF, we'll use a simple approach - in production you'd use pdf.js or similar
        // For this demo, we'll extract text using the FileReader and show a message
        setCareQuestions(null);

        // Read PDF as ArrayBuffer and extract text (basic approach)
        const arrayBuffer = await file.arrayBuffer();
        setKycPdfBytes(new Uint8Array(arrayBuffer.slice(0)));
        const text = await extractTextFromPDF(arrayBuffer, file.name);
        setDischargeSummary(text);
        const introRes = await fetch(`${API_BASE}/api/discharge/intro`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dischargeSummary: text }),
        });

        const introData = await introRes.json();

        setDischargeChatMessages([
          { role: "assistant", content: introData.introText },
        ]);
      } catch (error) {
        console.error("Error processing discharge file:", error);
        alert("Error processing file: " + error.message);
      }
    }
  };

  // Basic PDF text extraction (for demo - shows file was uploaded)
  const extractTextFromPDF = async (arrayBuffer) => {
    try {
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = "";

      // --- TEXT EXTRACTION ---
      // Read the full discharge packet so question generation sees every diagnosis,
      // instruction, medication, and warning sign referenced in the PDF.
      const maxPages = pdf.numPages;

      for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map((item) => item.str).join(" ");
        fullText += pageText + "\n";
      }

      // --- LOGO EXTRACTION (FIRST PAGE ONLY) ---
      try {
        const firstPage = await pdf.getPage(1);
        const ops = await firstPage.getOperatorList();

        const imageOpIndex = ops.fnArray.findIndex(
          (fn) => fn === pdfjsLib.OPS.paintImageXObject,
        );

        if (imageOpIndex !== -1) {
          const imageName = ops.argsArray[imageOpIndex][0];
          const image = await firstPage.objs.get(imageName);

          const canvas = document.createElement("canvas");
          canvas.width = image.width;
          canvas.height = image.height;

          const ctx = canvas.getContext("2d");
          ctx.putImageData(image, 0, 0);

          setHospitalLogo(canvas.toDataURL());
        }
      } catch (e) {
        console.warn("No logo found in PDF");
      }

      return fullText.trim();
    } catch (error) {
      console.error("Error extracting text from PDF:", error);
      return "";
    }
  };

  // Analyze call transcript
  const analyzeCallTranscript = async (transcript, dischargeSummary) => {
    setIsChatLoading(true);

    try {
      const messages = [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "system",
          content: `Discharge Summary:\n${dischargeSummary || "Not provided"}`,
        },
        {
          role: "system",
          content: `Call Transcript:\n${transcript}`,
        },
        {
          role: "user",
          content: `
Analyze this call and return:
1. Call summary
2. Patient concerns
3. Nurse statements that may be inappropriate or unsafe
4. Why each statement is problematic
5. Safer alternatives the nurse should have used
`,
        },
      ];

      const aiMessage = await callOpenAI(messages);

      if (!aiMessage) {
        throw new Error("Backend returned no AI content");
      }

      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: aiMessage },
      ]);
    } catch (error) {
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Error: ${error.message}`,
          isError: true,
        },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Send chat message
  const sendChatMessage = async () => {
    if (!chatInput.trim() || isChatLoading) return;

    const userMessage = chatInput.trim();
    setChatInput("");
    setChatMessages((prev) => [
      ...prev,
      { role: "user", content: userMessage },
    ]);
    setIsChatLoading(true);

    try {
      const conversationHistory = [...chatMessages]
        .filter((m) => !m.isSystem && !m.isHidden)
        .map((m) => ({ role: m.role, content: m.content }));

      const messages = [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "system",
          content: `Discharge Summary:\n${dischargeSummary || "Not provided"}`,
        },
        {
          role: "system",
          content: `Call Transcript:\n${callTranscript}`,
        },
        ...conversationHistory,
        { role: "user", content: userMessage },
      ];

      const aiMessage = await callOpenAI(messages);

      if (!aiMessage) {
        throw new Error("Backend returned no AI content");
      }

      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: aiMessage },
      ]);
    } catch (error) {
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Error: ${error.message}`,
          isError: true,
        },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Generate care questions from discharge summary

  const generateCareQuestions = async (summaryText) => {
    if (!summaryText) return;

    setIsGeneratingQuestions(true);

    try {
      const allConditions = buildConditionList(
        preExistingConditions,
        manualConditions,
      );

      const messages = [
        {
          role: "system",
          content: buildDischargeQuestionSystemPrompt(),
        },
        {
          role: "user",
          content: `Discharge Summary:\n${summaryText}\n\n${buildConditionContext(allConditions)}`,
        },
      ];

      const aiMessage = await callOpenAI(messages);

      if (!aiMessage) {
        throw new Error("Backend returned no AI content");
      }

      setDischargeChatMessages([{ role: "assistant", content: aiMessage }]);
    } catch (err) {
      alert(err.message);
    } finally {
      setIsGeneratingQuestions(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  };

  const handleDischargeKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendDischargeChatMessage();
    }
  };

  // Send discharge chat message
  const sendDischargeChatMessage = async () => {
    if (!dischargeChatInput.trim() || isDischargeChatLoading) return;

    const userMessage = dischargeChatInput.trim();
    setDischargeChatInput("");
    setDischargeChatMessages((prev) => [
      ...prev,
      { role: "user", content: userMessage },
    ]);
    setIsDischargeChatLoading(true);

    try {
      const conversationHistory = dischargeChatMessages
        .filter((m) => !m.isSystem && !m.isHidden)
        .map((m) => ({ role: m.role, content: m.content }));
      const allConditions = buildConditionList(
        preExistingConditions,
        manualConditions,
      );

      const messages = [
        {
          role: "system",
          content: `You are a healthcare assistant for discharge follow-up.

Base every answer on the discharge summary and listed conditions.
- If the user asks for a comprehensive question set, default to EXACTLY ${DISCHARGE_QUESTION_COUNT} questions using the Medications, Symptoms, Lifestyle, and Warning Signs sections with ${DISCHARGE_QUESTION_COUNT / 4} questions per section.
- If the user asks a narrower question, answer it directly and concisely.
- Do not diagnose or invent facts.`,
        },
        {
          role: "system",
          content: `Discharge Summary:\n${dischargeSummary || "Not provided"}\n\n${buildConditionContext(allConditions)}`,
        },
        ...conversationHistory,
        {
          role: "user",
          content: userMessage,
        },
      ];

      const aiMessage = await callOpenAI(messages);

      if (!aiMessage) {
        throw new Error("Backend returned no AI content");
      }

      setDischargeChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: aiMessage },
      ]);
    } catch (error) {
      setDischargeChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Error: ${error.message}`,
          isError: true,
        },
      ]);
    } finally {
      setIsDischargeChatLoading(false);
    }
  };

  // Voice Assistant Functions
  const startRecording = async () => {
    await unlockAudio();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      audioChunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();

      setIsRecording(true);
      setVoiceStatus("recording");
    } catch (error) {
      alert("Could not access microphone: " + error.message);
    }
  };

  const stopRecording = () => {
    if (!mediaRecorderRef.current) return;

    mediaRecorderRef.current.stop();
    setIsRecording(false);
    setVoiceStatus("processing");

    mediaRecorderRef.current.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, {
        type: "audio/webm",
      });

      audioChunksRef.current = [];

      setVoiceMessages((prev) => [
        ...prev,
        { role: "user", content: "ðŸŽ¤ Voice message sent...", isVoice: true },
      ]);

      await sendAudioToBackend(audioBlob);

      mediaRecorderRef.current.stream
        .getTracks()
        .forEach((track) => track.stop());
    };
  };

  const sendAudioToBackend = async (audioBlob) => {
    setIsProcessingVoice(true);

    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");
      formData.append("dischargeSummary", dischargeSummary || "");
      formData.append("preferredLanguage", preferredLanguage);

      const res = await fetch(`${API_BASE}/api/voice`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Voice API failed (${res.status})`);
      }
      const data = await res.json();

      if (data.alert) {
        setVoiceMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              "ðŸš¨ Nurse has been alerted. A human will contact the patient shortly.",
            isAlert: true,
          },
        ]);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setVoiceMessages((prev) => [
        ...prev.slice(0, -1),
        {
          role: "user",
          content: `ðŸŽ¤ "${data.transcription || "Voice message"}"`,
        },
      ]);

      setVoiceMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.responseText || "Response received",
          isVoice: true,
        },
      ]);

      if (data.audioBase64) {
        setVoiceStatus("playing");
        playAudioResponse(data.audioBase64);
      } else {
        setVoiceStatus("idle");
      }
    } catch (error) {
      setVoiceMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Error: ${error.message}`,
          isError: true,
        },
      ]);
      setVoiceStatus("idle");
    } finally {
      setIsProcessingVoice(false);
    }
  };

  const unlockAudio = async () => {
    try {
      // Create a short silent play to satisfy iOS / Chrome policies
      if (!audioRef.current) return;
      audioRef.current.src =
        "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=";
      await audioRef.current.play();
      audioRef.current.pause();
      audioUnlockedRef.current = true;
      console.log("Audio unlocked");
    } catch (e) {
      console.warn("Unlock failed:", e);
    }
  };

  const audioRef = useRef(null);

  const audioUnlockedRef = useRef(false);
  const audioContextRef = useRef(null);
  if (!audioContextRef.current) {
    audioContextRef.current = new (
      window.AudioContext || window.webkitAudioContext
    )();
  }

  const setLoggedKycSpeaking = (value) => {
    console.log(`setKycSpeaking ${value ? "true" : "false"}`);
    setKycSpeaking(value);
  };

  const detachAudioHandlers = (audio) => {
    if (!audio) return;
    audio.onplay = null;
    audio.onended = null;
    audio.onpause = null;
    audio.onerror = null;
  };

  const clearTrackedAudio = (audio, url) => {
    if (currentAudioRef.current === audio) {
      currentAudioRef.current = null;
    }

    if (currentAudioUrlRef.current === url) {
      currentAudioUrlRef.current = null;
    }

    if (url) {
      URL.revokeObjectURL(url);
    }
  };

  const stopTrackedAudio = ({ logPause = false } = {}) => {
    const activeAudio = currentAudioRef.current;
    const activeUrl = currentAudioUrlRef.current;

    if (!activeAudio && !activeUrl) {
      return;
    }

    if (logPause && activeAudio) {
      console.log("audio paused");
    }

    if (activeAudio) {
      detachAudioHandlers(activeAudio);
      activeAudio.pause();
    }

    clearTrackedAudio(activeAudio, activeUrl);
    setLoggedKycSpeaking(false);
  };

  const playAudioResponse = async (base64, options = {}) => {
    let audio = null;
    let url = null;
    let hasStarted = false;
    let hasFinished = false;

    try {
      if (!base64) return;

      // Strip data URL prefix if present
      base64 = base64.replace(/^data:audio\/\w+;base64,/, "");

      // Stop any currently playing audio
      if (currentAudioRef.current) {
        stopTrackedAudio({ logPause: true });
      }

      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "audio/mpeg" });
      url = URL.createObjectURL(blob);

      audio = new Audio(url);
      audio.playbackRate = 1.12;
      currentAudioRef.current = audio;
      currentAudioUrlRef.current = url;

      const markAudioStarted = () => {
        if (hasStarted) return;
        hasStarted = true;
        console.log("audio started");
        setLoggedKycSpeaking(true);
        setKycThinking(false);
      };

      const finalizePlayback = (reason) => {
        if (hasFinished) return;
        hasFinished = true;

        if (reason === "ended") {
          console.log("audio ended");
        }

        if (reason === "paused") {
          console.log("audio paused");
        }

        detachAudioHandlers(audio);
        clearTrackedAudio(audio, url);
        setLoggedKycSpeaking(false);
      };

      audio.onplay = markAudioStarted;
      audio.onended = () => finalizePlayback("ended");
      audio.onpause = () => {
        if (audio?.ended) return;
        finalizePlayback("paused");
      };

      audio.onerror = (err) => {
        console.error("Audio playback error:", err);
        finalizePlayback("error");
      };

      await audio.play();
      markAudioStarted();
    } catch (err) {
      console.error("Playback error:", err);
      detachAudioHandlers(audio);
      clearTrackedAudio(audio, url);
      setLoggedKycSpeaking(false);
    }
  };

  // Generate Care Plan from discharge summary
  const generateCarePlan = async () => {
    if (!dischargeSummary) {
      alert("Please upload a discharge summary first");
      return;
    }

    setIsGeneratingCarePlan(true);
    setCarePlan(null);
    setCarePlanResponses({});
    setCarePlanAlerts([]);
    setCurrentQuestionIndex(0);
    setAssessmentComplete(false);

    try {
      const allConditions = buildConditionList(
        preExistingConditions,
        manualConditions,
      );

      const conditionsText =
        allConditions.length > 0
          ? `\n\nPre-existing conditions to consider: ${allConditions.join(", ")}`
          : "";

      const messages = [
        {
          role: "system",
          content: `You are a healthcare AI that creates structured daily assessment care plans based on patient discharge summaries.

Generate a care plan in the EXACT JSON format below. Create questions specific to the patient's conditions from the discharge summary.

The format MUST match this Parkinson's-style daily assessment template:
- Questions grouped by category
- Each question has multiple choice options
- Some responses trigger alerts (typically "Yes" responses for symptom questions)
- Each alerting response has an associated symptom name

You MUST generate EXACTLY ${CARE_PLAN_QUESTION_COUNT} questions.
No more. No fewer.

Rules:
- If there are not enough condition-specific questions, add general follow-up questions.
- Cover every major diagnosis, medication risk, recovery instruction, and warning sign mentioned in the discharge summary before using general filler questions.
- All ${CARE_PLAN_QUESTION_COUNT} questions must follow the exact JSON format.
- The response is INVALID if the questions array length is not exactly ${CARE_PLAN_QUESTION_COUNT}.

Categories should include:
- General Condition (How are you feeling? Good/Fair/Poor)
- Symptom-specific questions based on their diagnosis (Yes/No with alerts on Yes)
- Medication Adherence (Yes/No)
- Lifestyle & Diet (Yes/No)
- Warning Signs specific to their condition (Yes/No with alerts)

IMPORTANT: Also extract the hospital name from the discharge summary and include it in the response.

Respond ONLY with valid JSON in this exact format:
{
  "hospitalName": "Name of the hospital from discharge summary",
  "patientCondition": "Brief description of patient's main conditions",
  "questions": [
    {
      "id": "1a",
      "category": "General Condition",
      "questionText": "General Condition",
      "questionDescription": "How are you feeling today?",
      "options": [
        {"text": "Good", "symptom": null, "triggersAlert": false},
        {"text": "Fair", "symptom": null, "triggersAlert": false},
        {"text": "Poor", "symptom": "General Malaise", "triggersAlert": true}
      ]
    },
    {
      "id": "2a",
      "category": "Symptoms",
      "questionText": "Symptom Check",
      "questionDescription": "Did you experience [specific symptom] today?",
      "options": [
        {"text": "Yes", "symptom": "Symptom Name", "triggersAlert": true},
        {"text": "No", "symptom": null, "triggersAlert": false}
      ]
    }
  ],
  "thankYouMessage": "Thank you for completing the assessment. Your data has been recorded. Take your medications as prescribed."
}`,
        },
        {
          role: "user",
          content: `Create a daily assessment care plan based on this discharge summary:\n\n${dischargeSummary}${conditionsText}`,
        },
      ];

      const aiMessage = await callOpenAI(messages);

      if (!aiMessage) {
        throw new Error("Backend returned no AI content");
      }

      let carePlanData = parseCarePlanResponse(aiMessage);

      if (
        !carePlanData ||
        !Array.isArray(carePlanData.questions) ||
        carePlanData.questions.length !== CARE_PLAN_QUESTION_COUNT
      ) {
        const repairedMessage = await callOpenAI([
          ...messages,
          { role: "assistant", content: aiMessage },
          {
            role: "user",
            content: `Revise the JSON so it contains exactly ${CARE_PLAN_QUESTION_COUNT} questions while preserving the same schema and staying specific to the discharge summary. Return only valid JSON.`,
          },
        ]);

        if (!repairedMessage) {
          throw new Error(
            "Backend returned no AI content while repairing the care plan",
          );
        }

        carePlanData = parseCarePlanResponse(repairedMessage);
      }

      if (!carePlanData || !Array.isArray(carePlanData.questions)) {
        console.error("Invalid care plan structure:", carePlanData);
        throw new Error("Generated care plan is invalid");
      }

      if (carePlanData.questions.length !== CARE_PLAN_QUESTION_COUNT) {
        throw new Error(
          `Care plan must contain exactly ${CARE_PLAN_QUESTION_COUNT} questions. Received ${carePlanData.questions.length}`,
        );
      }

      setCarePlan(carePlanData);

      if (carePlanData.hospitalName) {
        setHospitalName(carePlanData.hospitalName);

        const hospitalNameLower = carePlanData.hospitalName.toLowerCase();
        const domain = hospitalNameLower
          .replace(
            /\s+(hospital|medical center|health system|health|clinic|healthcare|centre)\b/gi,
            "",
          )
          .trim()
          .replace(/\s+/g, "")
          .replace(/[^a-z0-9]/g, "");

        const logoUrl = `https://logo.clearbit.com/${domain}.org`;
        setHospitalLogoUrl(logoUrl);
      }

      setCurrentQuestionIndex(0);
      setAssessmentComplete(false);
    } catch (error) {
      alert(error.message);
    } finally {
      setIsGeneratingCarePlan(false);
    }
  };

  // Handle care plan response selection
  const handleCarePlanResponse = (questionId, option) => {
    setCarePlanResponses((prev) => ({
      ...prev,
      [questionId]: option,
    }));

    // Check if this triggers an alert
    if (option.triggersAlert) {
      const question = carePlan.questions.find((q) => q.id === questionId);
      setCarePlanAlerts((prev) => [
        ...prev,
        {
          id: `alert-${questionId}-${Date.now()}`,
          questionId,
          category: question?.category,
          question: question?.questionDescription,
          response: option.text,
          symptom: option.symptom,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    }

    // Move to next question
    if (carePlan && currentQuestionIndex < carePlan.questions.length - 1) {
      setTimeout(() => {
        setCurrentQuestionIndex((prev) => prev + 1);
      }, 300);
    } else if (
      carePlan &&
      currentQuestionIndex === carePlan.questions.length - 1
    ) {
      setTimeout(() => {
        setAssessmentComplete(true);
      }, 300);
    }
  };

  // Reset care plan assessment
  const resetCarePlanAssessment = () => {
    setCarePlanResponses({});
    setCarePlanAlerts([]);
    setCurrentQuestionIndex(0);
    setAssessmentComplete(false);
  };

  // Download care plan questions as Excel
  const downloadCarePlanExcel = () => {
    if (!carePlan || !carePlan.questions) return;

    // Build CSV content (Excel-compatible)
    const headers = ["Question #", "Category", "Question", "Options"];
    const rows = carePlan.questions.map((q, idx) => {
      const options = q.options.map((opt) => opt.text).join(" | ");
      return [
        idx + 1,
        q.category || "",
        q.questionDescription || q.questionText || "",
        options,
      ];
    });

    // Escape fields for CSV
    const escapeField = (field) => {
      const str = String(field);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvContent = [
      headers.map(escapeField).join(","),
      ...rows.map((row) => row.map(escapeField).join(",")),
    ].join("\n");

    // Add BOM for Excel UTF-8 compatibility
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `care_plan_questions_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const extractTextWithPositions = async (arrayBuffer) => {
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const allItems = [];
    const pageDims = [];

    const maxPages = Math.min(pdf.numPages, 6);

    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const viewport = page.getViewport({ scale: 1 });

      pageDims.push({
        page: i,
        width: Math.round(viewport.width),
        height: Math.round(viewport.height),
      });

      content.items.forEach((item) => {
        if (item.str.trim()) {
          allItems.push({
            text: item.str,
            page: i,
            x: Math.round(item.transform[4] * 10) / 10,
            y: Math.round((viewport.height - item.transform[5]) * 10) / 10,
            width: Math.round(item.width * 10) / 10,
            height: Math.round(Math.abs(item.transform[3]) * 10) / 10,
            fontSize: Math.round(item.transform[0] * 10) / 10,
          });
        }
      });
    }

    // Also build the plain text for display
    let plainText = "";
    const maxPagesText = Math.min(pdf.numPages, 6);
    for (let i = 1; i <= maxPagesText; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map((item) => item.str).join(" ");
      plainText += pageText + "\n";
    }

    return {
      items: allItems,
      pageDimensions: pageDims,
      plainText: plainText.trim(),
    };
  };

  // ============================================================
  // 2. LOAD PRESET KYC DOCUMENT
  // ============================================================
  const loadPresetKycDocument = async () => {
    setKycLoadError("");
    setIsExtractingFields(true);

    try {
      const docRes = await fetch(`${API_BASE}/api/kyc/preloaded-document`);
      const docData = await docRes.json();
      if (!docRes.ok || docData.error) {
        throw new Error(docData.error || "Failed to load KYC document");
      }

      setKycFile({ name: docData.fileName });

      const pdfBytes = Uint8Array.from(atob(docData.pdfBase64), (c) =>
        c.charCodeAt(0),
      );
      const pdfBuffer = pdfBytes.buffer.slice(0);
      const pdfData = new Uint8Array(pdfBuffer.slice(0));
      setKycPdfBytes(pdfData);
      kycPdfBytesRef.current = pdfData;
      setKycDocumentText("Preset KYC demo loaded");
      setKycPageDimensions([]);
      setKycFieldMappings(
        PRESET_DEMO_KYC_FIELD_MAPPINGS.map((mapping) => ({ ...mapping })),
      );
      setKycFields(PRESET_DEMO_KYC_FIELDS.map((field) => ({ ...field })));
      kycFieldsRef.current = PRESET_DEMO_KYC_FIELDS.map((field) => ({ ...field }));
      console.log("kycFieldsRef set:", kycFieldsRef.current.length);
    } catch (error) {
      setKycLoadError(error.message || "Failed to load KYC document");
      setKycChatMessages([
        {
          role: "assistant",
          content: `Error loading document: ${error.message}`,
          isError: true,
        },
      ]);
    } finally {
      setIsExtractingFields(false);
    }
  };

  useEffect(() => {
    if (
      activeTab === "voice" &&
      !kycFile &&
      !isExtractingFields &&
      kycFields.length === 0 &&
      !beyondPresenceSession &&
      !kycComplete
    ) {
      loadPresetKycDocument();
    }
  }, [activeTab]);

  // ============================================================
  // 3. DOWNLOAD COMPLETED KYC â€” Creates AcroForm fields on PDF
  // ============================================================
  const downloadCompletedKyc = async () => {
    console.log(
      "Download clicked, fields:",
      kycFields.length,
      "responses:",
      Object.keys(kycResponses).length,
      "pdfBytes:",
      !!kycPdfBytes,
    );
    if (!ensurePostKycImageCaptureReady()) return;
    const activeFields = kycFieldsRef.current.length
      ? kycFieldsRef.current
      : kycFields;
    const baseActiveResponses = Object.keys(kycResponsesRef.current).length
      ? kycResponsesRef.current
      : kycResponses;
    const activeResponses = await buildEnglishKycResponsesForPdf(
      activeFields,
      baseActiveResponses,
    );
    const isPresetDocument = isPresetDemoKycFields(activeFields);
    const activeMappings = isPresetDocument
      ? PRESET_DEMO_KYC_FIELD_MAPPINGS
      : kycFieldMappings;
      console.log("activeFields:", activeFields.length, "activeResponses:", Object.keys(activeResponses).length, "ref fields:", kycFieldsRef.current.length);
    if (!activeFields.length) return;
    // If we don't have the original PDF bytes, fall back to text file
    const pdfData = kycPdfBytesRef.current || kycPdfBytes;
    if (!pdfData) {
      console.log("No PDF bytes available");
      downloadCompletedKycAsTxt();
      return;
    }

    try {
      // Load the original PDF with pdf-lib
      const pdfDoc = await PDFDocument.load(pdfData, {
        ignoreEncryption: true,
      });

      const form = pdfDoc.getForm();
      const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

      const pages = pdfDoc.getPages();
      if (isPresetDocument) drawPresetPageTwoLabelFixes(pages, helvetica);
      if (isPresetDocument) drawPresetAutoDate(pages, helvetica);
      const emptyAcroFillResult = { count: 0, matchedFieldIds: new Set() };
      const directFillResult = isPresetDocument
        ? emptyAcroFillResult
        : fillNamedKycAcroFields(form, pages, activeFields, activeResponses);
      let acroFillResult = directFillResult;
      try {
        const unresolvedFields = activeFields.filter(
          (field) => !directFillResult.matchedFieldIds.has(field.id),
        );
        if (!isPresetDocument && unresolvedFields.length > 0) {
          const genericFillResult = fillExistingAcroFormFields(
            form,
            unresolvedFields,
            activeResponses,
            activeMappings,
            kycPageDimensions,
          );
          acroFillResult = {
            count: directFillResult.count + genericFillResult.count,
            matchedFieldIds: new Set([
              ...directFillResult.matchedFieldIds,
              ...genericFillResult.matchedFieldIds,
            ]),
          };
        }
      } catch (acroErr) {
        console.warn("Existing AcroForm fill failed:", acroErr);
      }

      // Fallback-fill only those fields not matched to existing AcroForm inputs.
      for (const mapping of activeMappings) {
        if (mapping.skipPdf) continue;
         const answer = activeResponses[mapping.fieldId];
        if (!answer && answer !== false) continue;
        const shouldDrawReasonOverAcro =
          acroFillResult.matchedFieldIds.has(mapping.fieldId) &&
          mapping.type === "yes_no" &&
          mapping.reasonResponseId &&
          activeResponses[mapping.reasonResponseId] &&
          !isUncapturedLikeKycValue(activeResponses[mapping.reasonResponseId]);
        if (acroFillResult.matchedFieldIds.has(mapping.fieldId) && !shouldDrawReasonOverAcro) continue;
        const pdfAnswer = getKycPdfFillValue(
          { id: mapping.fieldId, type: mapping.type },
          answer,
        );

        const pageIndex = (mapping.page || 1) - 1;
        if (pageIndex < 0 || pageIndex >= pages.length) continue;
        const page = pages[pageIndex];
        const pageHeight = page.getHeight();
        const scaled = scaleMappingForPage(mapping, page, kycPageDimensions);

        try {
          if (
            scaled.type === "text" ||
            scaled.type === "date" ||
            scaled.type === "number"
          ) {
            // Draw final text directly so browser PDF viewers do not show AcroForm
            // appearance artifacts outside the intended cells.
            if (!pdfAnswer) continue;
            if (isUncapturedKycValue(answer) || isUncapturedLikeKycValue(answer)) continue;
            drawMappedPdfText(page, helvetica, pdfAnswer, scaled, pageHeight);
          } else if (scaled.type === "yes_no") {
            // ---- CREATE YES/NO CHECKBOXES ----
            if (!pdfAnswer) continue;
            if (isUncapturedKycValue(answer) || isUncapturedLikeKycValue(answer)) continue;
            const answerLower = String(pdfAnswer).toLowerCase().trim();
            const isYes =
              answerLower === "yes" ||
              answerLower === "y" ||
              answerLower === "true";

            // Skip uncertain placement if yes/no anchors are missing.
            if (
              scaled.yesX == null ||
              scaled.yesY == null ||
              scaled.noX == null ||
              scaled.noY == null
            ) {
              continue;
            }

            if (isYes) {
              // Check the Yes box
              const yesFieldName = uniqueFieldName(`cb_${scaled.fieldId}_yes`);
              const yesCheckbox = form.createCheckBox(yesFieldName);
              yesCheckbox.addToPage(page, {
                x: scaled.yesX - CHECKBOX_SIZE / 2 + CHECKBOX_X_NUDGE,
                y:
                  pageHeight -
                  scaled.yesY -
                  CHECKBOX_SIZE / 2 +
                  CHECKBOX_Y_NUDGE,
                width: CHECKBOX_SIZE,
                height: CHECKBOX_SIZE,
                borderWidth: 0,
                backgroundColor: rgb(1, 1, 1),
              });
              yesCheckbox.check();
            } else {
              // Check the No box
              const noFieldName = uniqueFieldName(`cb_${scaled.fieldId}_no`);
              const noCheckbox = form.createCheckBox(noFieldName);
              noCheckbox.addToPage(page, {
                x: scaled.noX - CHECKBOX_SIZE / 2 + CHECKBOX_X_NUDGE,
                y:
                  pageHeight -
                  scaled.noY -
                  CHECKBOX_SIZE / 2 +
                  CHECKBOX_Y_NUDGE,
                width: CHECKBOX_SIZE,
                height: CHECKBOX_SIZE,
                borderWidth: 0,
                backgroundColor: rgb(1, 1, 1),
              });
              noCheckbox.check();
            }

            const rawReasonValue =
              isYes && scaled.reasonResponseId
                ? activeResponses[scaled.reasonResponseId]
                : "";
            const reasonValue =
              rawReasonValue && !isUncapturedLikeKycValue(rawReasonValue)
                ? extractReasonFromAffirmativeAnswer(
                    getKycPdfFillValue(
                      { id: scaled.reasonResponseId, type: "text" },
                      rawReasonValue,
                    ),
                  )
                : "";
            if (
              reasonValue &&
              scaled.reasonX != null &&
              scaled.reasonY != null
            ) {
              const reasonBox = getReasonDrawBox(scaled, pageHeight);
              drawTinyReasonText(
                page,
                helvetica,
                reasonValue,
                reasonBox.x + 0.5,
                reasonBox.y + 0.5,
                reasonBox.width - 1,
                reasonBox.height - 1,
              );
            }
          } else if (scaled.type === "gender_checkbox") {
            // ---- GENDER CHECKBOXES ----
            const answerLower = String(answer).toLowerCase().trim();
            const isMale = answerLower === "male" || answerLower === "m";

            if (isMale && mapping.maleX != null) {
              const cbName = uniqueFieldName(`cb_${mapping.fieldId}_male`);
              const cb = form.createCheckBox(cbName);
              cb.addToPage(page, {
                x: mapping.maleX - 4,
                y: pageHeight - mapping.maleY - 4,
                width: 8,
                height: 8,
                borderWidth: 0,
              });
              cb.check();
            } else if (!isMale && mapping.femaleX != null) {
              const cbName = uniqueFieldName(`cb_${mapping.fieldId}_female`);
              const cb = form.createCheckBox(cbName);
              cb.addToPage(page, {
                x: mapping.femaleX - 4,
                y: pageHeight - mapping.femaleY - 4,
                width: 8,
                height: 8,
                borderWidth: 0,
              });
              cb.check();
            }
          } else if (scaled.type === "marital_checkbox") {
            // ---- MARITAL STATUS CHECKBOXES ----
            const answerLower = String(answer).toLowerCase().trim();
            const isMarried = answerLower === "married";

            if (isMarried && mapping.marriedX != null) {
              const cbName = uniqueFieldName(`cb_${mapping.fieldId}_married`);
              const cb = form.createCheckBox(cbName);
              cb.addToPage(page, {
                x: mapping.marriedX - 4,
                y: pageHeight - mapping.marriedY - 4,
                width: 8,
                height: 8,
                borderWidth: 0,
              });
              cb.check();
            } else if (!isMarried && mapping.singleX != null) {
              const cbName = uniqueFieldName(`cb_${mapping.fieldId}_single`);
              const cb = form.createCheckBox(cbName);
              cb.addToPage(page, {
                x: mapping.singleX - 4,
                y: pageHeight - mapping.singleY - 4,
                width: 8,
                height: 8,
                borderWidth: 0,
              });
              cb.check();
            }
          }
        } catch (fieldError) {
          console.warn(`Failed to add field ${mapping.fieldId}:`, fieldError);
          // Continue with other fields
        }
      }

      await appendKycImageAttachmentsToPdf(
        pdfDoc,
        [
          { label: "PAN / Aadhaar card photo", dataUrl: idDocumentPhoto },
          { label: "Head-to-toe customer photo", dataUrl: fullBodyPhoto },
        ],
        helvetica,
        {
          customerName: activeResponses.life_to_be_assured_name,
          applicationNo: activeResponses.application_no,
        },
      );

      // Flatten the form â€” bakes values into the PDF permanently
      try {
        form.flatten();
      } catch (flattenError) {
        console.warn(
          "Form flatten failed (fields still editable):",
          flattenError,
        );
      }

      // Save and download
      const filledPdfBytes = await pdfDoc.save();
      const blob = new Blob([filledPdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `completed_kyc_${new Date().toISOString().split("T")[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("PDF filling failed:", error);
      alert(
        `PDF filling failed: ${error.message}\nFalling back to text file download.`,
      );
      downloadCompletedKycAsTxt();
    }
  };

  // ============================================================
  // 4. FALLBACK: Download as .txt (keep existing logic as backup)
  // ============================================================
  const downloadCompletedKycAsTxt = () => {
    if (!kycFields.length) return;

    let content = "=== COMPLETED KYC DOCUMENT ===\n";
    content += `Generated: ${new Date().toLocaleString()}\n`;
    content += `Source File: ${kycFile?.name || "N/A"}\n`;
    content += "================================\n\n";

    let currentCategory = "";
    kycFields.forEach((field) => {
      if (field.section !== currentCategory) {
        currentCategory = field.section;
        content += `\n--- ${currentCategory.toUpperCase()} ---\n\n`;
      }
      content += `${field.label}: ${getKycFieldDisplayValue(field, kycResponses) || "Not provided"}\n`;
    });

    content += "\n================================\n";
    content += "END OF KYC DOCUMENT\n";

    const BOM = "\uFEFF";
    const blob = new Blob([BOM + content], {
      type: "text/plain;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `completed_kyc_${new Date().toISOString().split("T")[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadKycTranscript = async () => {
    const activeResponses = await buildEnglishKycResponsesForPdf(
      kycFields,
      kycResponsesRef.current || kycResponses,
    );
    const transcriptLines = [];

    for (const field of kycFields) {
      if (shouldSkipFieldForGender(field, activeResponses)) continue;
      const rawAnswer = getKycPdfFillValue(field, activeResponses[field.id]);
      const answer =
        rawAnswer && !isUncapturedLikeKycValue(rawAnswer)
          ? rawAnswer
          : KYC_UNCAPTURED_LABEL;

      const questionText = stripInlineYesDetailInstruction(
        field.prompt || field.label || "",
      );
      const displayQuestion = await localizeKycText(
        questionText,
        preferredLanguage,
        { transcriptScript: true },
      );
      const detail =
        field.reasonResponseId && String(answer).trim().toLowerCase() === "yes"
          ? getKycPdfFillValue(
              { id: field.reasonResponseId, type: "text" },
              activeResponses[field.reasonResponseId],
            )
          : "";
      const displayAnswer =
        detail && !isUncapturedLikeKycValue(detail)
          ? `${answer}. Details: ${extractReasonFromAffirmativeAnswer(detail)}`
          : answer;
      const localizedAnswer =
        preferredLanguage && preferredLanguage !== "en"
          ? await localizeKycText(displayAnswer, preferredLanguage, {
              transcriptScript: true,
            })
          : displayAnswer;

      transcriptLines.push(`Dr.: ${displayQuestion || questionText}`);
      transcriptLines.push(`client: ${localizedAnswer || displayAnswer}`);
    }

    if (!transcriptLines.length) return;

    const content = transcriptLines.join("\n\n");
    const blob = new Blob([`\uFEFF${content}`], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `kyc_transcript_${new Date().toISOString().split("T")[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const finalizeKycSession = ({
    reason = "session_end",
    announce = false,
  } = {}) => {
    if (!kycFields.length) return;
    setPanCaptureComplete(true); 

    const { responses: finalizedResponses, changed } =
      finalizeIncompleteKycResponses(kycFields, kycResponsesRef.current);

    if (changed) {
      kycResponsesRef.current = finalizedResponses;
      setKycResponses(finalizedResponses);
    }

    const nextIndex = findNextPendingKycFieldIndex(
      kycFields,
      finalizedResponses,
      0,
    );
    kycCurrentFieldIndexRef.current = Math.min(
      nextIndex,
      Math.max(kycFields.length - 1, 0),
    );
    setKycCurrentFieldIndex(
      Math.min(nextIndex, Math.max(kycFields.length - 1, 0)),
    );
    markKycCompleteAndStartImageCapture();

    if (announce) {
      setKycChatMessages((prev) => {
        const note =
          "Carely note: The call has ended, and any remaining unanswered fields were marked as Not captured so the report can still be reviewed and downloaded.";
        if (
          prev.some((msg) => msg.role === "assistant" && msg.content === note)
        )
          return prev;
        return [...prev, { role: "assistant", content: note }];
      });
    }

    console.log(
      "[KYC] Session finalized:",
      reason,
      changed ? "with fallback answers" : "no fallback needed",
    );
  };



  const resetKyc = () => {
    if (beyondPresenceSession?.roomName || beyondPresenceSession?.agentId) {
      fetch(`${API_BASE}/api/beyondpresence/stop-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomName: beyondPresenceSession.roomName,
          agentId: beyondPresenceSession.agentId,
        }),
      }).catch(() => {});
    }

    stopCallRecording({ discard: true });
    stopUserCamera();
    beyondPresenceRoomRef.current = null;
    setBeyondPresenceSession(null);
    setIsConnectingAvatar(false);
    setIsAvatarConnected(false);
    setAvatarConnectionBlockedMessage("");
    setCameraEnabled(true);
    setIsMuted(false);
    setIsScreenSharing(false);
    setIsChatOpen(false);
    setIsPeopleOpen(false);
    setPanCaptureComplete(true);
    setPanOcrData(null);
    setIdCaptureComplete(false);
    setIdDocumentPhoto("");
    setFullBodyCaptureComplete(false);
    setFullBodyPhoto("");
    setAutoCaptureStatus("");
    setIsRecordingCall(false);
    setCallRecordingBlob(null);
    setCallVideoRecordingBlob(null);
    setIsTranscribing(false);
    setCallTranscription("");
    // setKycFile(null);
    // setKycFields([]);
    // kycFieldsRef.current = [];
    // setKycResponses({});
    setKycCurrentFieldIndex(0);
    // kycResponsesRef.current = {};
    // lastAnswerTimestampRef.current = 0;
    lastCommittedFieldRef.current = null;
    lastCommittedTranscriptRef.current = null;
    lastAgentAskedFieldRef.current = null;
    agentTranscriptTurnRef.current = 0;
    pendingClarificationTargetRef.current = null;
    pendingReasonFieldRef.current = null;
    pendingNameSpellingRef.current = null;
    pendingDurationFragmentRef.current = null;
    lastUserTranscriptRef.current = null;
    ignoredAgentFollowUpRef.current = null;
    kycCurrentFieldIndexRef.current = 0;
    kycCompleteRef.current = false;
    kycTurnLockRef.current = false;
    processedTranscriptKeysRef.current.clear();
    transcriptMessageKeysRef.current.clear();
    recentTranscriptFingerprintsRef.current.clear();
    setKycChatMessages([]);
    setKycChatInput("");
    setKycComplete(false);
    setIsExtractingFields(false);
    setKycLoadError("");
    setKycDocumentText("");
    setKycFieldMappings([]);
    // setKycPdfBytes(null);
    // kycPdfBytesRef.current = null;
    setKycPageDimensions([]);
    setKycListening(false);
    setKycSpeaking(false);
    setKycThinking(false);
    setKycTranscriptPreview("");
  };

    const endCallOnly = () => {
    if (beyondPresenceSession?.agentId) {
      fetch(`${API_BASE}/api/beyondpresence/stop-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomName: beyondPresenceSession.roomName,
          agentId: beyondPresenceSession.agentId,
        }),
      }).catch(() => {});
    }
    stopCallRecording({ discard: false });
    stopUserCamera();
    setBeyondPresenceSession(null);
    setIsAvatarConnected(false);
    setIsScreenSharing(false);
    setIsChatOpen(false);
    setIsPeopleOpen(false);
    setPanCaptureComplete(true);
    setIdCaptureComplete(true);
    setFullBodyCaptureComplete(true);
    finalizeKycSession({ reason: "manual_end", announce: true });
  };

  const restartPresetKycDocument = () => {
    resetKyc();
    loadPresetKycDocument().catch((err) => {
      console.error("Failed to reload preset KYC document:", err);
    });
  };

  const sendKycChatMessage = async () => {
    if (!kycChatInput.trim() || isKycLoading) return;

    const userMessage = kycChatInput.trim();
    const cleanUserMessage = stripClarificationPrefix(userMessage);
    setKycChatInput("");
    setKycChatMessages((prev) => [
      ...prev,
      { role: "user", content: cleanUserMessage || userMessage },
    ]);
    setIsKycLoading(true);

    try {
      if (!kycFields.length || kycComplete) return;

      const currentIndex = kycCurrentFieldIndexRef.current;
      const currentField = kycFields[currentIndex];
      const currentResponses = kycResponsesRef.current;
      const pendingReason =
        pendingReasonFieldRef.current &&
        pendingReasonFieldRef.current.index === currentIndex &&
        currentResponses[currentField.id] === "Yes"
          ? pendingReasonFieldRef.current
          : null;
      const awaitingReason =
        Boolean(pendingReason) ||
        isKycFieldAwaitingReason(currentField, currentResponses);

      if (awaitingReason) {
        const isDurationReasonPhase = (pendingReason?.phase || "detail") === "duration";
        const previousDurationFragment =
          pendingDurationFragmentRef.current &&
          pendingDurationFragmentRef.current.fieldId === currentField.id &&
          Date.now() - pendingDurationFragmentRef.current.timestamp < 20000
            ? pendingDurationFragmentRef.current.text
            : "";
        const durationCandidateText =
          isDurationReasonPhase && previousDurationFragment
            ? `${previousDurationFragment} ${cleanUserMessage}`.trim()
            : cleanUserMessage;
        const isPartialDuration =
          isDurationReasonPhase &&
          isLikelyPartialDurationFragment(cleanUserMessage) &&
          !hasDurationPhrase(durationCandidateText);
        const isRelevantReason =
          hasMeaningfulKycValue(cleanUserMessage) &&
          !isLikelyFiller(cleanUserMessage, currentField) &&
          (!isLikelyNonReasonAnswerForField(currentField.id, cleanUserMessage) ||
            isPartialDuration ||
            (isDurationReasonPhase && hasDurationPhrase(durationCandidateText)));
        if (!isRelevantReason) {
          await promptForPendingKycReason(
            currentField,
            pendingReason?.phase || "detail",
            pendingReason?.detail || "",
          );
          setIsKycLoading(false);
          return;
        }

        const reasonNormalized = await normalizeKycAnswerForPdf(
          cleanUserMessage,
          {
            ...currentField,
            type: "text",
            label: currentField.reasonPromptLabel || currentField.label,
          },
          preferredLanguage,
        );
        const normalizedReason = extractReasonFromAffirmativeAnswer(
          reasonNormalized.englishText || cleanUserMessage,
        );
        const sanitizedReason = sanitizeKycReasonForField(
          currentField.id,
          normalizedReason,
        );
        const durationReason = isDurationReasonPhase
          ? sanitizeKycReasonDuration(durationCandidateText)
          : "";
        const effectiveReason =
          isDurationReasonPhase && hasMeaningfulKycValue(durationReason)
            ? durationReason
            : sanitizedReason;
        if (
          isDurationReasonPhase &&
          !hasMeaningfulKycValue(effectiveReason) &&
          isLikelyPartialDurationFragment(cleanUserMessage)
        ) {
          pendingDurationFragmentRef.current = {
            fieldId: currentField.id,
            text: durationCandidateText,
            timestamp: Date.now(),
          };
          pendingReasonFieldRef.current = {
            ...(pendingReason || {}),
            index: currentIndex,
            fieldId: currentField.id,
            phase: "duration",
            timestamp: Date.now(),
          };
          setIsKycLoading(false);
          return;
        }
        if (!hasMeaningfulKycValue(effectiveReason)) {
          await promptForPendingKycReason(
            currentField,
            pendingReason?.phase || "detail",
            pendingReason?.detail || "",
          );
          setIsKycLoading(false);
          return;
        }

        if ((pendingReason?.phase || "detail") === "detail") {
          if (!doesKycReasonNeedDuration(currentField)) {
            const nextResponses = {
              ...currentResponses,
              [currentField.reasonResponseId]: sanitizedReason,
            };
            kycResponsesRef.current = nextResponses;
            setKycResponses(nextResponses);
            pendingReasonFieldRef.current = null;
            recentTranscriptFingerprintsRef.current.set(
              `answer:${normalize(cleanUserMessage).slice(0, 120)}`,
              Date.now(),
            );
            const nextIndex = findNextUnskippedFieldIndex(
              kycFields,
              nextResponses,
              currentIndex + 1,
            );
            if (nextIndex < kycFields.length) {
              kycCurrentFieldIndexRef.current = nextIndex;
              setKycCurrentFieldIndex(nextIndex);
              const nextField = kycFields[nextIndex];
              const assistantTextEnglish = `Thank you. ${buildKycQuestionPrompt(nextField, nextIndex, kycFields.length)}`;
              try {
                const assistantText = await localizeKycText(
                  assistantTextEnglish,
                  preferredLanguage,
                );
                setKycChatMessages((prev) => [
                  ...prev,
                  { role: "assistant", content: assistantText },
                ]);
              } catch (err) {
                console.error("KYC typed prompt localization error:", err);
                setKycChatMessages((prev) => [
                  ...prev,
                  { role: "assistant", content: assistantTextEnglish },
                ]);
              }
            } else {
              markKycCompleteAndStartImageCapture();
            }
            setIsKycLoading(false);
            return;
          }
          if (hasDurationPhrase(sanitizedReason) || hasDurationPhrase(cleanUserMessage)) {
            const nextResponses = {
              ...currentResponses,
              [currentField.reasonResponseId]: sanitizedReason,
            };
            kycResponsesRef.current = nextResponses;
            setKycResponses(nextResponses);
            pendingReasonFieldRef.current = null;
            recentTranscriptFingerprintsRef.current.set(
              `answer:${normalize(cleanUserMessage).slice(0, 120)}`,
              Date.now(),
            );
            const nextIndex = findNextUnskippedFieldIndex(
              kycFields,
              nextResponses,
              currentIndex + 1,
            );
            if (nextIndex < kycFields.length) {
              kycCurrentFieldIndexRef.current = nextIndex;
              setKycCurrentFieldIndex(nextIndex);
              const nextField = kycFields[nextIndex];
              const assistantTextEnglish = `Thank you. ${buildKycQuestionPrompt(nextField, nextIndex, kycFields.length)}`;
              try {
                const assistantText = await localizeKycText(
                  assistantTextEnglish,
                  preferredLanguage,
                );
                setKycChatMessages((prev) => [
                  ...prev,
                  { role: "assistant", content: assistantText },
                ]);
              } catch (err) {
                console.error("KYC typed prompt localization error:", err);
                setKycChatMessages((prev) => [
                  ...prev,
                  { role: "assistant", content: assistantTextEnglish },
                ]);
              }
            } else {
              markKycCompleteAndStartImageCapture();
            }
            setIsKycLoading(false);
            return;
          }

          const nextResponses = {
            ...currentResponses,
            [currentField.reasonResponseId]: sanitizedReason,
          };
          kycResponsesRef.current = nextResponses;
          setKycResponses(nextResponses);
          pendingReasonFieldRef.current = {
            index: currentIndex,
            fieldId: currentField.id,
            phase: "duration",
            detail: sanitizedReason,
            timestamp: Date.now(),
          };
          const durationPrompt = await localizeKycText(
            getKycReasonFollowUpPrompt(currentField, "duration", sanitizedReason),
            preferredLanguage,
          );
          setKycChatMessages((prev) => [
            ...prev,
            { role: "assistant", content: durationPrompt },
          ]);
          setIsKycLoading(false);
          return;
        }

        if (!hasDurationPhrase(effectiveReason) && !hasDurationPhrase(cleanUserMessage)) {
          const refinedDetail = combineKycReasonParts(
            pendingReason?.detail,
            effectiveReason,
          ) || effectiveReason;
          const nextResponses = {
            ...currentResponses,
            [currentField.reasonResponseId]: refinedDetail,
          };
          kycResponsesRef.current = nextResponses;
          setKycResponses(nextResponses);
          pendingReasonFieldRef.current = {
            index: currentIndex,
            fieldId: currentField.id,
            phase: "duration",
            detail: refinedDetail,
            timestamp: Date.now(),
          };
          lastCommittedTranscriptRef.current = {
            normalizedText: normalize(cleanUserMessage),
            agentTurn: agentTranscriptTurnRef.current,
            timestamp: Date.now(),
          };
          lastAnswerTimestampRef.current = Date.now();
          return;
        }

        const combinedReason = combineKycReasonParts(
          pendingReason?.detail,
          isDurationReasonPhase ? durationReason || effectiveReason : effectiveReason,
        );

        const nextResponses = {
          ...currentResponses,
          [currentField.reasonResponseId]: combinedReason || effectiveReason,
        };
       kycResponsesRef.current = nextResponses;
setKycResponses(nextResponses);
pendingReasonFieldRef.current = null;
pendingDurationFragmentRef.current = null;
recentTranscriptFingerprintsRef.current.set(`answer:${normalize(cleanUserMessage).slice(0, 120)}`, Date.now());
        const nextIndex = findNextUnskippedFieldIndex(
          kycFields,
          nextResponses,
          currentIndex + 1,
        );
        if (nextIndex < kycFields.length) {
          kycCurrentFieldIndexRef.current = nextIndex;
          setKycCurrentFieldIndex(nextIndex);
          const nextField = kycFields[nextIndex];
          const assistantTextEnglish = `Thank you. ${buildKycQuestionPrompt(nextField, nextIndex, kycFields.length)}`;
          try {
            const assistantText = await localizeKycText(
              assistantTextEnglish,
              preferredLanguage,
            );
            setKycChatMessages((prev) => [
              ...prev,
              { role: "assistant", content: assistantText },
            ]);
          } catch (err) {
            console.error("KYC typed prompt localization error:", err);
            setKycChatMessages((prev) => [
              ...prev,
              { role: "assistant", content: assistantTextEnglish },
            ]);
          }
        } else {
          markKycCompleteAndStartImageCapture();
          const completionEnglish = `All ${kycFields.length} fields have been completed.\n\nPlease click "Download Filled PDF" in the top right to generate your document.`;
          try {
            const completionText = await localizeKycText(
              completionEnglish,
              preferredLanguage,
            );
            setKycChatMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                content: completionText,
              },
            ]);
          } catch (err) {
            console.error("KYC typed completion localization error:", err);
            setKycChatMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                content: completionEnglish,
              },
            ]);
          }
        }
        return;
      }

      const normalized = await normalizeKycAnswerForPdf(
        cleanUserMessage,
        currentField,
        preferredLanguage,
      );
      let normalizedInput =
        normalized.canonicalYesNo || normalized.englishText || cleanUserMessage;

      if (isYesNoField(currentField)) {
        const explicitYesNo = parseYesNoAnswer(cleanUserMessage);
        const parsed =
          normalized.canonicalYesNo ||
          parseYesNoAnswer(normalizedInput) ||
          inferImplicitYesNoAnswer(currentField, cleanUserMessage);
        if (!parsed) {
          const retryEnglish = isDeclarationField(currentField)
            ? `Please answer this declaration with only Yes or No: ${currentField.label}`
            : `Please answer Yes or No for: ${currentField.label}`;
          const retry = await localizeKycText(retryEnglish, preferredLanguage);
          setKycChatMessages((prev) => [
            ...prev,
            { role: "assistant", content: retry },
          ]);
          return;
        }
        if (parsed === "Yes" && !explicitYesNo) {
          const isRelevantAnswer = await validateKycAnswerForField(
            cleanUserMessage,
            currentField,
          );
          if (!isRelevantAnswer) {
            setIsKycLoading(false);
            return;
          }
        }
        normalizedInput = parsed;
      }

      const formattedAnswer = formatKycAnswerForPdf(
        currentField,
        normalizedInput,
      );
      const inlineReason =
        currentField.requiresReasonOnYes && formattedAnswer === "Yes"
          ? extractReasonFromAffirmativeAnswer(cleanUserMessage)
          : "";

      let nextResponses = {
        ...currentResponses,
        [currentField.id]: formattedAnswer,
        ...(currentField.reasonResponseId
          ? {
              [currentField.reasonResponseId]:
                formattedAnswer === "Yes" ? inlineReason : "",
            }
          : {}),
      };

      if (currentField.id === "gender") {
        const { responses: genderUpdated } = autoSkipGenderedFields(
          kycFields,
          nextResponses,
          formattedAnswer,
          currentIndex + 1,
        );
        nextResponses = genderUpdated;
      }

      kycResponsesRef.current = nextResponses;
setKycResponses(nextResponses);
recentTranscriptFingerprintsRef.current.set(`answer:${normalize(cleanUserMessage).slice(0, 120)}`, Date.now());

      if (
        currentField.requiresReasonOnYes &&
        formattedAnswer === "Yes"
      ) {
        if (hasCompleteInlineKycReason(inlineReason, cleanUserMessage)) {
          pendingReasonFieldRef.current = null;
          const nextIndex = findNextUnskippedFieldIndex(
            kycFields,
            nextResponses,
            currentIndex + 1,
          );

          if (nextIndex < kycFields.length) {
            kycCurrentFieldIndexRef.current = nextIndex;
            setKycCurrentFieldIndex(nextIndex);
            const nextField = kycFields[nextIndex];
            const assistantTextEnglish = `Got it. ${buildKycQuestionPrompt(nextField, nextIndex, kycFields.length)}`;
            try {
              const assistantText = await localizeKycText(
                assistantTextEnglish,
                preferredLanguage,
              );
              setKycChatMessages((prev) => [
                ...prev,
                { role: "assistant", content: assistantText },
              ]);
            } catch (err) {
              console.error("KYC typed prompt localization error:", err);
              setKycChatMessages((prev) => [
                ...prev,
                { role: "assistant", content: assistantTextEnglish },
              ]);
            }
          } else {
            markKycCompleteAndStartImageCapture();
            const completionEnglish = `All ${kycFields.length} fields have been completed.\n\nPlease click "Download Filled PDF" in the top right to generate your document.`;
            try {
              const completionText = await localizeKycText(
                completionEnglish,
                preferredLanguage,
              );
              setKycChatMessages((prev) => [
                ...prev,
                {
                  role: "assistant",
                  content: completionText,
                },
              ]);
            } catch (err) {
              console.error("KYC typed completion localization error:", err);
              setKycChatMessages((prev) => [
                ...prev,
                {
                  role: "assistant",
                  content: completionEnglish,
                },
              ]);
            }
          }
          return;
        }

        const nextPhase = hasMeaningfulKycValue(inlineReason) ? "duration" : "detail";
        pendingReasonFieldRef.current = {
          index: currentIndex,
          fieldId: currentField.id,
          phase: nextPhase,
          detail: hasMeaningfulKycValue(inlineReason) ? inlineReason : "",
          timestamp: Date.now(),
        };
        const followUpText = await localizeKycText(
          getKycReasonFollowUpPrompt(currentField, nextPhase, inlineReason),
          preferredLanguage,
        );
        setKycChatMessages((prev) => [
          ...prev,
          { role: "assistant", content: followUpText },
        ]);
        return;
      }

      pendingReasonFieldRef.current = null;
      const nextIndex = findNextUnskippedFieldIndex(
        kycFields,
        nextResponses,
        currentIndex + 1,
      );

      if (nextIndex < kycFields.length) {
        kycCurrentFieldIndexRef.current = nextIndex;
        setKycCurrentFieldIndex(nextIndex);
        const nextField = kycFields[nextIndex];
        const assistantTextEnglish = `Got it. ${buildKycQuestionPrompt(nextField, nextIndex, kycFields.length)}`;
        try {
          const assistantText = await localizeKycText(
            assistantTextEnglish,
            preferredLanguage,
          );
          setKycChatMessages((prev) => [
            ...prev,
            { role: "assistant", content: assistantText },
          ]);
        } catch (err) {
          console.error("KYC typed prompt localization error:", err);
          setKycChatMessages((prev) => [
            ...prev,
            { role: "assistant", content: assistantTextEnglish },
          ]);
        }
      } else {
        markKycCompleteAndStartImageCapture();
        const completionEnglish = `All ${kycFields.length} fields have been completed.\n\nPlease click "Download Filled PDF" in the top right to generate your document.`;
        try {
          const completionText = await localizeKycText(
            completionEnglish,
            preferredLanguage,
          );
          setKycChatMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: completionText,
            },
          ]);
        } catch (err) {
          console.error("KYC typed completion localization error:", err);
          setKycChatMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: completionEnglish,
            },
          ]);
        }
      }
    } catch (error) {
      setKycChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Error: ${error.message}`,
          isError: true,
        },
      ]);
    } finally {
      setIsKycLoading(false);
    }
  };

  const handleKycKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendKycChatMessage();
    }
  };

  // ============================================================
  // 7. OPTIONAL: Download as editable PDF (no flatten)
  // ============================================================
  const downloadEditableKyc = async () => {
    // Same as downloadCompletedKyc but WITHOUT form.flatten()
    // This gives the user an editable PDF they can modify in Acrobat/Preview
    if (!kycFields.length || !kycPdfBytes) return;
    const activeFields = kycFieldsRef.current.length ? kycFieldsRef.current : kycFields;
    const baseActiveResponses = Object.keys(kycResponsesRef.current).length ? kycResponsesRef.current : kycResponses;
    const activeResponses = await buildEnglishKycResponsesForPdf(
      activeFields,
      baseActiveResponses,
    );
    const isPresetDocument = isPresetDemoKycFields(activeFields);
    const activeMappings = isPresetDocument
      ? PRESET_DEMO_KYC_FIELD_MAPPINGS
      : kycFieldMappings;

    try {
      const pdfDoc = await PDFDocument.load(kycPdfBytes.slice(0), {
        ignoreEncryption: true,
      });
      const form = pdfDoc.getForm();
      const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const pages = pdfDoc.getPages();
      if (isPresetDocument) drawPresetPageTwoLabelFixes(pages, helvetica);
      if (isPresetDocument) drawPresetAutoDate(pages, helvetica);
      const directFillResult = fillNamedKycAcroFields(form, pages, activeFields, activeResponses);
      let acroFillResult = directFillResult;

      try {
        const unresolvedFields = activeFields.filter(
          (field) => !directFillResult.matchedFieldIds.has(field.id),
        );
        if (!isPresetDocument && unresolvedFields.length > 0) {
          const genericFillResult = fillExistingAcroFormFields(
            form,
            unresolvedFields,
            activeResponses,
            activeMappings,
            kycPageDimensions,
          );
          acroFillResult = {
            count: directFillResult.count + genericFillResult.count,
            matchedFieldIds: new Set([
              ...directFillResult.matchedFieldIds,
              ...genericFillResult.matchedFieldIds,
            ]),
          };
        }
      } catch (acroErr) {
        console.warn("Editable AcroForm fill failed:", acroErr);
      }

      for (const mapping of activeMappings) {
        if (mapping.skipPdf) continue;
        const answer = activeResponses[mapping.fieldId];
        if (!answer && answer !== false) continue;
        const shouldDrawReasonOverAcro =
          acroFillResult.matchedFieldIds.has(mapping.fieldId) &&
          mapping.type === "yes_no" &&
          mapping.reasonResponseId &&
          activeResponses[mapping.reasonResponseId] &&
          !isUncapturedLikeKycValue(activeResponses[mapping.reasonResponseId]);
        if (acroFillResult.matchedFieldIds.has(mapping.fieldId) && !shouldDrawReasonOverAcro) continue;
        const pdfAnswer = getKycPdfFillValue(
          { id: mapping.fieldId, type: mapping.type },
          answer,
        );

        const pageIndex = (mapping.page || 1) - 1;
        if (pageIndex < 0 || pageIndex >= pages.length) continue;
        const page = pages[pageIndex];
        const pageHeight = page.getHeight();
        const scaled = scaleMappingForPage(mapping, page, kycPageDimensions);

        try {
          if (
            scaled.type === "text" ||
            scaled.type === "date" ||
            scaled.type === "number"
          ) {
            if (!pdfAnswer) continue;
            if (isUncapturedKycValue(answer) || isUncapturedLikeKycValue(answer)) continue;
            if (Number(scaled.page || 0) >= 2) {
              drawMappedPdfText(page, helvetica, pdfAnswer, scaled, pageHeight);
              continue;
            }
            const textField = form.createTextField(scaled.fieldId);
            textField.addToPage(page, {
              x: scaled.inputX || 0,
              y: pageHeight - (scaled.inputY || 0) - (scaled.height || 14),
              width: scaled.width || 200,
              height: scaled.height || 14,
              font: helvetica,
              borderWidth: 0,
            });
            textField.setText(toPdfSafeText(pdfAnswer, KYC_UNCAPTURED_LABEL));
            textField.setFontSize(scaled.fontSize || 9);
            textField.defaultUpdateAppearances(helvetica);
          } else if (scaled.type === "yes_no") {
            if (!pdfAnswer) continue;
            if (isUncapturedKycValue(answer) || isUncapturedLikeKycValue(answer)) continue;
            const answerLower = String(pdfAnswer).toLowerCase().trim();
            const isYes =
              answerLower === "yes" ||
              answerLower === "y" ||
              answerLower === "true";

            if (
              scaled.yesX == null ||
              scaled.yesY == null ||
              scaled.noX == null ||
              scaled.noY == null
            ) {
              continue;
            }

            const yesBox = form.createCheckBox(`${scaled.fieldId}_yes`);
            yesBox.addToPage(page, {
              x: (scaled.yesX || 0) - CHECKBOX_SIZE / 2 + CHECKBOX_X_NUDGE,
              y:
                pageHeight -
                (scaled.yesY || 0) -
                CHECKBOX_SIZE / 2 +
                CHECKBOX_Y_NUDGE,
              width: CHECKBOX_SIZE,
              height: CHECKBOX_SIZE,
            });
            if (isYes) yesBox.check();

            const noBox = form.createCheckBox(`${scaled.fieldId}_no`);
            noBox.addToPage(page, {
              x: (scaled.noX || 0) - CHECKBOX_SIZE / 2 + CHECKBOX_X_NUDGE,
              y:
                pageHeight -
                (scaled.noY || 0) -
                CHECKBOX_SIZE / 2 +
                CHECKBOX_Y_NUDGE,
              width: CHECKBOX_SIZE,
              height: CHECKBOX_SIZE,
            });
            if (!isYes) noBox.check();

            const rawReasonValue =
              isYes && scaled.reasonResponseId
                ? activeResponses[scaled.reasonResponseId]
                : "";
            const reasonValue =
              rawReasonValue && !isUncapturedLikeKycValue(rawReasonValue)
                ? extractReasonFromAffirmativeAnswer(
                    getKycPdfFillValue(
                      { id: scaled.reasonResponseId, type: "text" },
                      rawReasonValue,
                    ),
                  )
                : "";
            if (
              reasonValue &&
              scaled.reasonX != null &&
              scaled.reasonY != null
            ) {
              const reasonBox = getReasonDrawBox(scaled, pageHeight);
              drawTinyReasonText(
                page,
                helvetica,
                reasonValue,
                reasonBox.x + 0.5,
                reasonBox.y + 0.5,
                reasonBox.width - 1,
                reasonBox.height - 1,
              );
            }
          }
          // ... same pattern for gender_checkbox, marital_checkbox
        } catch (e) {
          console.warn(`Editable field ${mapping.fieldId} failed:`, e);
        }
      }

      await appendKycImageAttachmentsToPdf(
        pdfDoc,
        [
          { label: "PAN / Aadhaar card photo", dataUrl: idDocumentPhoto },
          { label: "Head-to-toe customer photo", dataUrl: fullBodyPhoto },
        ],
        helvetica,
        {
          customerName: activeResponses.life_to_be_assured_name,
          applicationNo: activeResponses.application_no,
        },
      );

      // NO flatten â€” keep fields editable
      const filledPdfBytes = await pdfDoc.save();
      const blob = new Blob([filledPdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `editable_kyc_${new Date().toISOString().split("T")[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Editable PDF creation failed:", error);
      alert(`Editable PDF creation failed: ${error.message}`);
    }
  };

  return (
    <div style={styles.container} className="app-shell">
      {/* Sidebar */}
      <aside style={styles.sidebar} className="app-sidebar">
        <div style={styles.logoContainer}>
          <div style={styles.logoIcon}>
            <img
              src={ConverxAILogoIcon}
              alt="ConverxAI"
              style={{ width: "36px", height: "36px", objectFit: "contain" }}
            />
          </div>
        </div>
        <nav style={styles.nav}>
          <button
            style={{
              ...styles.navButton,
              ...(activeTab === "voice" ? styles.navButtonActive : {}),
            }}
            onClick={() => setActiveTab("voice")}
            title="KYC Assistant"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M23 7l-7 5 7 5V7z" />
              <rect x="1" y="5" width="15" height="14" rx="2" />
            </svg>
          </button>
        </nav>
      </aside>

      {/* Main */}
      <main style={styles.main} className="app-main">
        <header style={styles.header} className="app-header">
          <div style={styles.headerLeft} className="app-header-left">
            <img
              src={ConverxAILogoFull}
              alt="ConverxAI"
              style={{ height: "44px", objectFit: "contain" }}
            />
            <span style={styles.headerBadge}>AI Assistant</span>
          </div>
          <div style={styles.headerRight}>
            <span style={styles.welcomeText}>
              Healthcare Intelligence Platform
            </span>
          </div>
        </header>
        <div style={styles.content} className="app-content">
          {/* === CALL LOGS TAB === */}
          {activeTab === "call-logs" && (
            <div style={styles.splitViewWide}>
              <div style={styles.panelSmall}>
                <div style={styles.panelHeader}>
                  <h3 style={styles.panelTitle}>
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#0891b2"
                      strokeWidth="2"
                      style={{ marginRight: "8px" }}
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    Upload Files
                  </h3>
                </div>
                <div style={styles.uploadContainerCompact}>
                  <input
                    type="file"
                    ref={callFileInputRef}
                    onChange={handleCallFileUpload}
                    accept=".txt"
                    style={{ display: "none" }}
                  />
                  <p style={styles.uploadLabel}>Call Transcript</p>
                  {!callFile ? (
                    <div
                      style={styles.dropZoneCompact}
                      onClick={() => callFileInputRef.current?.click()}
                    >
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#0891b2"
                        strokeWidth="1.5"
                      >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                      <span style={styles.dropZoneTextCompact}>
                        Upload .txt
                      </span>
                    </div>
                  ) : (
                    <>
                      <div style={styles.fileUploadedCompact}>
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#10b981"
                          strokeWidth="2"
                        >
                          <polyline points="9 11 12 14 22 4" />
                          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                        </svg>
                        <span style={styles.fileNameCompact}>
                          {callFile.name}
                        </span>
                        <button
                          style={styles.removeFileButtonCompact}
                          onClick={() => {
                            setCallFile(null);
                            setCallTranscript("");
                            setChatMessages([]);
                          }}
                        >
                          âœ•
                        </button>
                      </div>
                      <p style={{ ...styles.uploadLabel, marginTop: "16px" }}>
                        Discharge Summary
                      </p>
                      {!dischargeFile ? (
                        <div
                          style={styles.dropZoneCompact}
                          onClick={() => dischargeFileInputRef.current?.click()}
                        >
                          <svg
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#f97316"
                            strokeWidth="1.5"
                          >
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                          </svg>
                          <span style={styles.dropZoneTextCompact}>
                            Upload .txt/.pdf
                          </span>
                        </div>
                      ) : (
                        <div style={styles.fileUploadedCompact}>
                          <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#10b981"
                            strokeWidth="2"
                          >
                            <polyline points="9 11 12 14 22 4" />
                            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                          </svg>
                          <span style={styles.fileNameCompact}>
                            {dischargeFile.name}
                          </span>
                          <button
                            style={styles.removeFileButtonCompact}
                            onClick={() => {
                              setDischargeFile(null);
                              setDischargeSummary("");
                            }}
                          >
                            âœ•
                          </button>
                        </div>
                      )}
                    </>
                  )}
                  <input
                    type="file"
                    ref={dischargeFileInputRef}
                    onChange={handleDischargeFileUpload}
                    accept=".pdf,.txt"
                    style={{ display: "none" }}
                  />
                  {callTranscript && (
                    <div style={styles.transcriptPreviewCompact}>
                      <h4 style={styles.previewTitleCompact}>Preview</h4>
                      <div style={styles.previewContentCompact}>
                        {callTranscript.substring(0, 300)}
                        {callTranscript.length > 300 && "..."}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div style={styles.panelLarge}>
                <div style={styles.panelHeader}>
                  <h3 style={styles.panelTitle}>
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#f97316"
                      strokeWidth="2"
                      style={{ marginRight: "8px" }}
                    >
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    AI Call Analysis Chat
                  </h3>
                </div>
                <div style={styles.chatContainer}>
                  <div style={styles.chatMessages}>
                    {chatMessages.length === 0 ? (
                      <div style={styles.chatEmpty}>
                        <svg
                          width="64"
                          height="64"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#cbd5e1"
                          strokeWidth="1.5"
                        >
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                        <p>Upload a call log to start</p>
                      </div>
                    ) : (
                      chatMessages.map(
                        (msg, idx) =>
                          !msg.isHidden && (
                            <div
                              key={idx}
                              style={{
                                ...styles.chatMessage,
                                ...(msg.isSystem
                                  ? styles.systemMessage
                                  : msg.role === "user"
                                    ? styles.userMessage
                                    : styles.assistantMessage),
                                ...(msg.isError ? styles.errorMessage : {}),
                              }}
                            >
                              {!msg.isSystem && (
                                <div style={styles.messageAvatar}>
                                  {msg.role === "user" ? "ðŸ‘¤" : "ðŸ¤–"}
                                </div>
                              )}
                              <div style={styles.messageContent}>
                                {renderTextWithBold(msg.content)}
                              </div>
                            </div>
                          ),
                      )
                    )}
                    {isChatLoading && (
                      <div
                        style={{
                          ...styles.chatMessage,
                          ...styles.assistantMessage,
                        }}
                      >
                        <div style={styles.messageAvatar}>ðŸ¤–</div>
                        <div style={styles.typingIndicator}>
                          <span></span>
                          <span></span>
                          <span></span>
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                  <div style={styles.chatInputContainer}>
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder={
                        callFile
                          ? "Ask about the call..."
                          : "Upload a call log first..."
                      }
                      disabled={!callFile || isChatLoading}
                      style={styles.chatInput}
                    />
                    <button
                      onClick={sendChatMessage}
                      disabled={!callFile || !chatInput.trim() || isChatLoading}
                      style={{
                        ...styles.sendButton,
                        opacity:
                          !callFile || !chatInput.trim() || isChatLoading
                            ? 0.5
                            : 1,
                      }}
                    >
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <line x1="22" y1="2" x2="11" y2="13" />
                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* === DISCHARGE TAB === */}
          {activeTab === "discharge" && (
            <div style={styles.splitViewWide}>
              <div style={styles.panelSmall}>
                <div style={styles.panelHeader}>
                  <h3 style={styles.panelTitle}>
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#0891b2"
                      strokeWidth="2"
                      style={{ marginRight: "8px" }}
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    Discharge Summary
                  </h3>
                </div>
                <div style={styles.uploadContainerCompact}>
                  <input
                    type="file"
                    ref={dischargeFileInputRef}
                    onChange={handleDischargeFileUpload}
                    accept=".pdf,.txt"
                    style={{ display: "none" }}
                  />
                  {!dischargeFile ? (
                    <div
                      style={{ ...styles.dropZoneCompact, minHeight: "80px" }}
                      onClick={() => dischargeFileInputRef.current?.click()}
                    >
                      <svg
                        width="28"
                        height="28"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#0891b2"
                        strokeWidth="1.5"
                      >
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      <span style={styles.dropZoneTextCompact}>
                        Upload Discharge Summary
                      </span>
                      <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                        PDF or TXT
                      </span>
                    </div>
                  ) : (
                    <div style={styles.fileUploadedCompact}>
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="2"
                      >
                        <polyline points="9 11 12 14 22 4" />
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                      </svg>
                      <span style={styles.fileNameCompact}>
                        {dischargeFile.name}
                      </span>
                      <button
                        style={styles.removeFileButtonCompact}
                        onClick={() => {
                          setDischargeFile(null);
                          setDischargeSummary("");
                          setDischargeChatMessages([]);
                        }}
                      >
                        âœ•
                      </button>
                    </div>
                  )}
                </div>
                {dischargeSummary && (
                  <div style={styles.transcriptPreviewCompact}>
                    <h4 style={styles.previewTitleCompact}>
                      Discharge Summary
                    </h4>
                    {hospitalLogo && (
                      <div
                        style={{ marginBottom: "12px", textAlign: "center" }}
                      >
                        <img
                          src={hospitalLogo}
                          alt="Hospital Logo"
                          style={{ maxHeight: "60px", objectFit: "contain" }}
                        />
                      </div>
                    )}
                    <div style={styles.previewContentCompact}>
                      {dischargeSummary.substring(0, 600)}
                      {dischargeSummary.length > 600 && "..."}
                    </div>
                    <div style={{ marginTop: "12px" }}>
                      {preExistingConditions.length > 0 && (
                        <>
                          <h4 style={styles.previewTitleCompact}>
                            Pre-Existing Conditions
                          </h4>
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: "6px",
                            }}
                          >
                            {preExistingConditions.map((c, i) => (
                              <span
                                key={i}
                                style={{
                                  padding: "6px 10px",
                                  background: "#f1f5f9",
                                  borderRadius: "999px",
                                  fontSize: "11px",
                                  fontWeight: "500",
                                  color: "#334155",
                                  border: "1px solid #e2e8f0",
                                }}
                              >
                                {c}
                              </span>
                            ))}
                          </div>
                        </>
                      )}
                      <button
                        style={{
                          width: "100%",
                          marginTop: "12px",
                          padding: "10px",
                          background: "linear-gradient(135deg,#f97316,#ea580c)",
                          color: "white",
                          border: "none",
                          borderRadius: "8px",
                          fontSize: "12px",
                          fontWeight: "600",
                          cursor: "pointer",
                        }}
                        onClick={() => generateCareQuestions(dischargeSummary)}
                        disabled={isGeneratingQuestions}
                      >
                        {isGeneratingQuestions
                          ? "Generating..."
                          : `Generate ${DISCHARGE_QUESTION_COUNT} Questions`}
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div style={styles.panelLarge}>
                <div style={styles.panelHeader}>
                  <h3 style={styles.panelTitle}>
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#f97316"
                      strokeWidth="2"
                      style={{ marginRight: "8px" }}
                    >
                      <circle cx="12" cy="12" r="10" />
                      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    Care Questions Chat
                  </h3>
                </div>
                <div style={styles.chatContainer}>
                  <div style={styles.chatMessages}>
                    {dischargeChatMessages.length === 0 ? (
                      <div style={styles.chatEmpty}>
                        <svg
                          width="64"
                          height="64"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#cbd5e1"
                          strokeWidth="1.5"
                        >
                          <circle cx="12" cy="12" r="10" />
                          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                          <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                        <p>
                          Upload a discharge summary to generate care questions
                        </p>
                      </div>
                    ) : (
                      dischargeChatMessages.map(
                        (msg, idx) =>
                          !msg.isHidden && (
                            <div
                              key={idx}
                              style={{
                                ...styles.chatMessage,
                                ...(msg.isSystem
                                  ? styles.systemMessage
                                  : msg.role === "user"
                                    ? styles.userMessage
                                    : styles.assistantMessage),
                                ...(msg.isError ? styles.errorMessage : {}),
                              }}
                            >
                              {!msg.isSystem && (
                                <div style={styles.messageAvatar}>
                                  {msg.role === "user" ? "ðŸ‘¤" : "ðŸ¤–"}
                                </div>
                              )}
                              <div style={styles.messageContent}>
                                {renderTextWithBold(msg.content)}
                              </div>
                            </div>
                          ),
                      )
                    )}
                    {isDischargeChatLoading && (
                      <div
                        style={{
                          ...styles.chatMessage,
                          ...styles.assistantMessage,
                        }}
                      >
                        <div style={styles.messageAvatar}>ðŸ¤–</div>
                        <div style={styles.typingIndicator}>
                          <span></span>
                          <span></span>
                          <span></span>
                        </div>
                      </div>
                    )}
                    <div ref={dischargeChatEndRef} />
                  </div>
                  <div style={styles.chatInputContainer}>
                    <input
                      type="text"
                      value={dischargeChatInput}
                      onChange={(e) => setDischargeChatInput(e.target.value)}
                      onKeyPress={handleDischargeKeyPress}
                      placeholder={
                        dischargeFile
                          ? "Ask about care questions..."
                          : "Upload a discharge summary first..."
                      }
                      disabled={!dischargeFile || isDischargeChatLoading}
                      style={styles.chatInput}
                    />
                    <button
                      onClick={sendDischargeChatMessage}
                      disabled={
                        !dischargeFile ||
                        !dischargeChatInput.trim() ||
                        isDischargeChatLoading
                      }
                      style={{
                        ...styles.sendButton,
                        background: "linear-gradient(135deg,#f97316,#ea580c)",
                        opacity:
                          !dischargeFile ||
                          !dischargeChatInput.trim() ||
                          isDischargeChatLoading
                            ? 0.5
                            : 1,
                      }}
                    >
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <line x1="22" y1="2" x2="11" y2="13" />
                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* === KYC VOICE ORB TAB === */}
          {activeTab === "voice" && (
            <div style={ft.layout} className="kyc-call-layout">
              <div style={ft.side} className="kyc-field-sidebar">
                <div style={ft.sideHead}>
                  <div style={ft.sideDot} />
                  <span style={ft.sideTitle}>FMR Report</span>
                </div>

                {isExtractingFields && (
                  <div style={{ padding: 28, textAlign: "center" }}>
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        border: "2px solid rgba(255,255,255,0.12)",
                        borderTopColor: "#a78bfa",
                        borderRadius: "50%",
                        animation: "spin 0.8s linear infinite",
                        margin: "0 auto 10px",
                      }}
                    />
                    <p style={{ fontSize: 12, color: "#a78bfa", margin: 0 }}>
                      Analyzing FMR...
                    </p>
                  </div>
                )}

                {kycFields.length > 0 && (
                  <>
                    <div style={ft.progWrap}>
                      <div style={ft.progRow}>
                        <span style={ft.progLabel}>
                          {getCompletedKycFieldCount(kycFields, kycResponses)}{" "}
                          of {kycFields.length}
                        </span>
                        <span style={ft.progPct}>
                          {Math.round(
                            (getCompletedKycFieldCount(
                              kycFields,
                              kycResponses,
                            ) /
                              kycFields.length) *
                              100,
                          )}
                          %
                        </span>
                      </div>
                      <div style={ft.progTrack}>
                        <div
                          style={{
                            ...ft.progBar,
                            width: `${(getCompletedKycFieldCount(kycFields, kycResponses) / kycFields.length) * 100}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div style={ft.fieldScroll}>
                      {kycFields.map((field, idx) => {
                        const done = isKycFieldComplete(field, kycResponses);
                        const cur =
                          idx === kycCurrentFieldIndex &&
                          getCompletedKycFieldCount(kycFields, kycResponses) <
                            kycFields.length;
                        const displayValue = getKycFieldDisplayValue(
                          field,
                          kycResponses,
                        );
                        return (
                          <div
                            key={field.id}
                            style={{
                              ...ft.fRow,
                              ...(cur ? ft.fRowCur : {}),
                              ...(done ? ft.fRowDone : {}),
                            }}
                          >
                            <div
                              style={{
                                ...ft.fNum,
                                background: done
                                  ? "#34d399"
                                  : cur
                                    ? "#8b5cf6"
                                    : "rgba(255,255,255,0.08)",
                                color: done || cur ? "#fff" : "#64748b",
                              }}
                            >
                              {done ? "âœ“" : idx + 1}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p
                                style={{
                                  ...ft.fName,
                                  color: cur ? "#e2e8f0" : "#94a3b8",
                                }}
                              >
                                {field.label}
                              </p>
                              {displayValue && (
                                <p style={ft.fVal}>{displayValue}</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                {kycFields.length > 0 && (
                  <div style={ft.doneBox}>
                    <button style={ft.dlBtn} onClick={downloadCompletedKyc}>
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        Download Filled PDF
                      </button>
                    <button
                      style={{
                        ...ft.dlBtn,
                        background: "linear-gradient(135deg,#0ea5e9,#0284c7)",
                      }}
                      onClick={downloadKycTranscript}
                    >
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      >
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="8" y1="13" x2="16" y2="13" />
                        <line x1="8" y1="17" x2="14" y2="17" />
                      </svg>
                      Download Transcript
                    </button>
                    {callRecordingBlob &&
                      !callTranscription && (
                        <button
                          style={{
                            ...ft.dlBtn,
                            background:
                              "linear-gradient(135deg,#6366f1,#4f46e5)",
                          }}
                          onClick={transcribeRecording}
                          disabled={isTranscribing}
                        >
                          {isTranscribing ? (
                            <>
                              <div
                                style={{
                                  width: 15,
                                  height: 15,
                                  border: "2px solid rgba(255,255,255,0.3)",
                                  borderTopColor: "#fff",
                                  borderRadius: "50%",
                                  animation: "spin 0.8s linear infinite",
                                }}
                              />
                              Transcribing...
                            </>
                          ) : (
                            <>
                              <svg
                                width="15"
                                height="15"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                              >
                                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                              </svg>
                              Transcribe Call
                            </>
                          )}
                        </button>
                      )}
                    {(isRecordingCall || callRecordingBlob) && (
                      <button
                        style={{
                          ...ft.dlBtn,
                          background: "linear-gradient(135deg,#14b8a6,#0f766e)",
                        }}
                        onClick={downloadCallAudioRecording}
                      >
                        {callRecordingBlob ? "Download Audio" : "Stop & Download Audio"}
                      </button>
                    )}
                    {(isRecordingCall || callVideoRecordingBlob) && (
                      <button
                        style={{
                          ...ft.dlBtn,
                          background: "linear-gradient(135deg,#8b5cf6,#6d28d9)",
                        }}
                        onClick={downloadCallVideoRecording}
                      >
                        {callVideoRecordingBlob ? "Download Video" : "Stop & Download Video"}
                      </button>
                    )}
                    {callTranscription && (
                      <button
                        style={{
                          ...ft.dlBtn,
                          background: "linear-gradient(135deg,#f59e0b,#d97706)",
                        }}
                        onClick={downloadTranscription}
                      >
                        <svg
                          width="15"
                          height="15"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                        >
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        Download Transcript
                      </button>
                    )}
                    <button
                      style={ft.newBtn}
                      onClick={restartPresetKycDocument}
                    >
                      New Session
                    </button>
                  </div>
                )}

                {!kycFile && !isExtractingFields && (
                  <div style={{ padding: 20, marginTop: "auto" }}>
                    <p
                      style={{
                        fontSize: 12,
                        color: "#64748b",
                        lineHeight: 1.5,
                        margin: 0,
                      }}
                    >
                      The FMR form loads automatically. Agent Tara will
                      guide you through the full medical examination report.
                    </p>
                  </div>
                )}
              </div>

              <div
                ref={callSurfaceRef}
                className="kyc-call-surface relative flex min-h-[620px] flex-1 overflow-hidden rounded-none bg-[#6668ad] text-white lg:min-h-0"
              >
                <div className="kyc-call-topbar absolute left-0 right-0 top-0 z-30 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-b from-black/65 to-transparent px-3 py-3 sm:px-5">
                  <div className="flex min-w-0 items-center gap-3">
                    {isAvatarConnected && (
                      <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.8)]" />
                    )}
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold sm:text-base">Agent Tara</div>
                    </div>
                  </div>
                  <div className="kyc-call-actions flex flex-wrap items-center justify-end gap-2">
                    {kycFields.length > 0 && (
                      <>
                        <button className="rounded-xl bg-emerald-500 px-3 py-2 text-xs font-bold text-white shadow-lg" onClick={downloadCompletedKyc}>
                          Download Filled PDF
                        </button>
                        <button
                          className="rounded-xl bg-sky-500 px-3 py-2 text-xs font-bold text-white shadow-lg"
                          onClick={downloadKycTranscript}
                        >
                          Download Transcript
                        </button>
                        {(isRecordingCall || callRecordingBlob) && (
                          <button
                            className="rounded-xl bg-teal-500 px-3 py-2 text-xs font-bold text-white shadow-lg"
                            onClick={downloadCallAudioRecording}
                          >
                            {callRecordingBlob ? "Audio" : "Stop + Audio"}
                          </button>
                        )}
                        {(isRecordingCall || callVideoRecordingBlob) && (
                          <button
                            className="rounded-xl bg-violet-500 px-3 py-2 text-xs font-bold text-white shadow-lg"
                            onClick={downloadCallVideoRecording}
                          >
                            {callVideoRecordingBlob ? "Video" : "Stop + Video"}
                          </button>
                        )}
                        <button
                          className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-bold text-white backdrop-blur"
                          onClick={restartPresetKycDocument}
                        >
                          New Session
                        </button>
                      </>
                    )}
                    {isRecordingCall && (
                      <span className="flex items-center gap-2 rounded-xl bg-[#ef6547] px-3 py-2 text-xs font-bold text-white shadow-lg">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                        Recording
                      </span>
                    )}
                    <select
                      value={preferredLanguage}
                      onChange={(e) => setPreferredLanguage(e.target.value)}
                      disabled={Boolean(
                        beyondPresenceSession || isConnectingAvatar,
                      )}
                      title={
                        beyondPresenceSession
                          ? "End or restart the current session to switch language."
                          : "Choose the conversation language before starting the call."
                      }
                      className="min-w-28 rounded-xl border border-white/15 bg-white px-3 py-2 text-xs font-bold text-slate-900 shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {KYC_LANGUAGE_OPTIONS.map((option) => (
                        <option
                          key={option.value}
                          value={option.value}
                          style={ft.langOption}
                        >
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {getCompletedKycFieldCount(kycFields, kycResponses) >=
                      kycFields.length && (
                      <span
                        className="rounded-xl border border-emerald-300/20 bg-emerald-400/15 px-3 py-2 text-xs font-bold text-emerald-200 backdrop-blur"
                      >
                        Complete
                      </span>
                    )}
                  </div>
                </div>

                <div className="kyc-call-stage relative flex h-full min-h-0 w-full items-stretch justify-stretch">
                  {isExtractingFields ? (
                    <div style={ft.mid}>
                      <div
                        style={{
                          width: 52,
                          height: 52,
                          border: "3px solid rgba(255,255,255,0.06)",
                          borderTopColor: "#a78bfa",
                          borderRadius: "50%",
                          animation: "spin 0.8s linear infinite",
                        }}
                      />
                      <p
                        style={{
                          color: "#a78bfa",
                          fontSize: 15,
                          marginTop: 18,
                        }}
                      >
                        Preparing your session...
                      </p>
                    </div>
                  ) : !kycFile ? (
                    kycLoadError ? (
                      <div style={ft.mid}>
                        <div style={ft.errBox}>
                          <p style={ft.errTitle}>FMR load failed</p>
                          <p style={ft.errText}>{kycLoadError}</p>
                          <p style={ft.errHint}>
                            Make sure the backend is running on {API_BASE} and
                            then retry.
                          </p>
                        </div>
                        <button
                          onClick={loadPresetKycDocument}
                          style={{ ...ft.callBtn, marginTop: 18 }}
                        >
                          Retry Loading FMR
                        </button>
                      </div>
                    ) : (
                      <div style={ft.mid}>
                        <p style={{ color: "#475569", fontSize: 15 }}>
                          Loading FMR document...
                        </p>
                      </div>
                    )
                  ) : false && !idCaptureComplete ? (
                    <KycImageCapture
                      key="id-document-capture"
                      title="Upload ID card photo"
                      subtitle="Upload or capture a clear PAN or Aadhaar card photo. Keep the full card readable with no glare."
                      captureLabel="Capture ID card"
                      facingMode="environment"
                      captureType="id"
                      autoCapture
                      onComplete={(dataUrl) => {
                        setIdDocumentPhoto(dataUrl);
                        setIdCaptureComplete(true);
                      }}
                      onSkip={() => setIdCaptureComplete(true)}
                    />
                  ) : false && !fullBodyCaptureComplete ? (
                    <KycImageCapture
                      key="full-body-capture"
                      title="Upload head-to-toe photo"
                      subtitle="Upload or capture a full-body photo with the customer visible from head to toe."
                      captureLabel="Capture head-to-toe photo"
                      facingMode="environment"
                      captureType="fullBody"
                      autoCapture
                      onComplete={(dataUrl) => {
                        setFullBodyPhoto(dataUrl);
                        setFullBodyCaptureComplete(true);
                      }}
                      onSkip={() => setFullBodyCaptureComplete(true)}
                    />
                  ) : beyondPresenceSession &&
                    (!kycComplete ||
                      kycImageCaptureStage === "id" ||
                      kycImageCaptureStage === "fullBody") ? (
                    <div className="relative h-full w-full bg-slate-950">
                      <div className="absolute inset-0 overflow-hidden bg-slate-950">
                        {cameraEnabled ? (
                          <video ref={userVideoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full flex-col items-center justify-center bg-slate-900 text-slate-400">
                            <CameraOff size={40} />
                            <span className="mt-3 text-sm font-bold">Camera off</span>
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-24 pt-10 text-sm font-bold sm:pb-28">
                          Client
                        </div>
                      </div>
                      <div data-avatar-stage className="kyc-avatar-tile absolute right-3 top-20 z-30 h-[34%] min-h-48 w-[34%] min-w-52 max-w-sm overflow-hidden rounded-xl border border-white/20 bg-slate-950 shadow-2xl sm:right-5 sm:top-20 sm:h-[38%] sm:w-[30%]">
                        <BeyondPresenceStream
                          livekitUrl={beyondPresenceSession.livekitUrl}
                          livekitToken={beyondPresenceSession.livekitToken}
                          avatarParticipantIdentity={
                            beyondPresenceSession.avatarParticipantIdentity
                          }
                          onUserTranscription={handleUserTranscription}
                          onAgentTranscription={handleAgentTranscription}
                          onConnected={() => {
                            setIsAvatarConnected(true);
                            if (cameraEnabled) {
                              startUserCamera();
                            }
                            window.setTimeout(() => startCallRecording(), 1500);
                          }}
                          onDisconnected={() => {
                            setIsAvatarConnected(false);
                            stopCallRecording();
                            stopUserCamera();
                            setIsScreenSharing(false);
                          }}
                          onRoomRef={(room) => {
                            beyondPresenceRoomRef.current = room;
                            if (room && cameraEnabled) {
                              window.setTimeout(
                                () => startUserCamera({ requireConnected: false }),
                                250,
                              );
                            }
                          }}
                          onSpeakingChange={(isSpeaking) => {
                            setKycSpeaking(isSpeaking);
                          }}
                          onListeningChange={(isListening) => {
                            setKycListening(isListening);
                          }}
                          onRemoteAudioTrack={(track) => {
                            callRecordingConnectTrackRef.current?.(track);
                          }}
                          onLocalAudioTrack={(track) => {
                            callRecordingConnectTrackRef.current?.(track);
                          }}
                          isMuted={isMuted}
                        />
                        <div className="pointer-events-none absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-2 text-xs font-bold">
                          Agent Tara
                        </div>
                      </div>
                    </div>
                  ) : getCompletedKycFieldCount(kycFields, kycResponses) >=
                    kycFields.length ? (
                    <div style={ft.mid}>
                      <div
                        style={{
                          width: 88,
                          height: 88,
                          borderRadius: "50%",
                          background: "linear-gradient(135deg,#34d399,#059669)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          marginBottom: 20,
                          boxShadow: "0 0 40px rgba(52,211,153,0.2)",
                        }}
                      >
                        <svg
                          width="44"
                          height="44"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#fff"
                          strokeWidth="2.5"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                      <p
                        style={{
                          color: "#34d399",
                          fontSize: 24,
                          fontWeight: 700,
                          margin: "0 0 8px",
                        }}
                      >
                        Verification Complete
                      </p>
                      <p style={{ color: "#64748b", fontSize: 14 }}>
                        Download your filled FMR from the top right
                      </p>
                    </div>
                  ) : beyondPresenceSession ? (
                    <div className="relative h-full w-full bg-slate-950">
                      <div className="absolute inset-0 overflow-hidden bg-slate-950">
                        {cameraEnabled ? (
                          <video ref={userVideoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full flex-col items-center justify-center bg-slate-900 text-slate-400">
                            <CameraOff size={40} />
                            <span className="mt-3 text-sm font-bold">Camera off</span>
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-24 pt-10 text-sm font-bold sm:pb-28">
                          Client
                        </div>
                      </div>
                      <div data-avatar-stage className="kyc-avatar-tile absolute right-3 top-20 z-30 h-[34%] min-h-48 w-[34%] min-w-52 max-w-sm overflow-hidden rounded-xl border border-white/20 bg-slate-950 shadow-2xl sm:right-5 sm:top-20 sm:h-[38%] sm:w-[30%]">
                        <BeyondPresenceStream
                          livekitUrl={beyondPresenceSession.livekitUrl}
                          livekitToken={beyondPresenceSession.livekitToken}
                          avatarParticipantIdentity={
                            beyondPresenceSession.avatarParticipantIdentity
                          }
                          onUserTranscription={handleUserTranscription}
                          onAgentTranscription={handleAgentTranscription}
                          onConnected={() => {
                            setIsAvatarConnected(true);
                            if (cameraEnabled) {
                              startUserCamera();
                            }
                            window.setTimeout(() => startCallRecording(), 1500);
                          }}
                          onDisconnected={() => {
                            setIsAvatarConnected(false);
                            stopCallRecording();
                            stopUserCamera();
                            setIsScreenSharing(false);
                          }}
                          onRoomRef={(room) => {
                            beyondPresenceRoomRef.current = room;
                            if (room && cameraEnabled) {
                              window.setTimeout(
                                () => startUserCamera({ requireConnected: false }),
                                250,
                              );
                            }
                          }}
                          onSpeakingChange={(isSpeaking) => {
                            setKycSpeaking(isSpeaking);
                          }}
                          onListeningChange={(isListening) => {
                            setKycListening(isListening);
                          }}
                          onRemoteAudioTrack={(track) => {
                            callRecordingConnectTrackRef.current?.(track);
                          }}
                          onLocalAudioTrack={(track) => {
                            callRecordingConnectTrackRef.current?.(track);
                          }}
                          isMuted={isMuted}
                        />
                        <div className="pointer-events-none absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-2 text-xs font-bold">
                          Agent Tara
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={ft.mid}>
                      <button
                        onClick={initBeyondPresence}
                        disabled={
                          isConnectingAvatar ||
                          !kycFields.length ||
                          Boolean(avatarConnectionBlockedMessage)
                        }
                        style={{
                          ...ft.callBtn,
                          ...(avatarConnectionBlockedMessage
                            ? ft.callBtnDisabled
                            : {}),
                        }}
                      >
                        {isConnectingAvatar ? (
                          <>
                            <div
                              style={{
                                width: 22,
                                height: 22,
                                border: "2.5px solid rgba(255,255,255,0.3)",
                                borderTopColor: "#fff",
                                borderRadius: "50%",
                                animation: "spin 0.8s linear infinite",
                                marginRight: 12,
                              }}
                            />
                            Connecting...
                          </>
                        ) : (
                          <>
                            <svg
                              width="24"
                              height="24"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              style={{ marginRight: 12 }}
                            >
                              <path d="M15.05 5A5 5 0 0 1 19 8.95M15.05 1A9 9 0 0 1 23 8.94" />
                              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                            </svg>
                            Start Verification Call
                          </>
                        )}
                      </button>
                      {avatarConnectionBlockedMessage && (
                        <div style={ft.errBox}>
                          <p style={ft.errTitle}>Avatar connection blocked</p>
                          <p style={ft.errText}>
                            {avatarConnectionBlockedMessage}
                          </p>
                          <p style={ft.errHint}>
                            Please verify the Beyond Presence agent setup and
                            then restart the session.
                          </p>
                        </div>
                      )}
                      <p
                        style={{
                          color: "#475569",
                          fontSize: 13,
                          marginTop: 18,
                          maxWidth: 300,
                          textAlign: "center",
                          lineHeight: 1.6,
                        }}
                      >
                        Connect with our AI Doctor for your MER Verification
                      </p>
                    </div>
                  )}
                </div>

                {isAvatarConnected &&
                  (kycImageCaptureStage === "id" ||
                    kycImageCaptureStage === "fullBody") && (
                    <div className="kyc-capture-notice absolute left-1/2 top-20 z-40 w-[min(94vw,720px)] -translate-x-1/2 rounded-3xl border border-amber-200/40 bg-slate-950/92 px-5 py-5 text-center font-semibold text-amber-100 shadow-2xl backdrop-blur sm:px-8 sm:py-6">
                      <div className="text-xs uppercase tracking-[0.22em] text-amber-300">
                        {kycImageCaptureStage === "id"
                          ? "ID image capture"
                          : "Head-to-toe image capture"}
                      </div>
                      <div className="mt-2 text-2xl font-black leading-tight text-white sm:text-3xl">
                        {kycImageCaptureStage === "id"
                          ? "Show your ID card clearly"
                          : "Stand for head-to-toe photo"}
                      </div>
                      <div className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-amber-50 sm:text-base">
                        {kycImageCaptureStage === "id"
                          ? "Keep all four corners visible, avoid glare, fill the guide area, and hold the card steady."
                          : "Step back and stand centered. Keep your head, body, legs, and feet visible in the frame."}
                      </div>
                      <div className="mt-4 rounded-2xl border border-amber-200/20 bg-amber-300/10 px-4 py-3 text-sm font-bold text-amber-50">
                        Capture will happen only after the frame is clear.
                      </div>
                      {autoCaptureStatus && (
                        <div className="mt-3 rounded-2xl bg-black/35 px-4 py-3 text-sm font-bold text-slate-100">
                          {autoCaptureStatus}
                        </div>
                      )}
                      <div className="mt-4 flex flex-wrap justify-center gap-3">
                        <button
                          type="button"
                          className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-black text-white shadow-lg"
                          onClick={() => {
                            if (!tryAutoCaptureCallImages("manual capture", { force: true })) {
                              setAutoCaptureStatus(
                                "Frame is not clear yet. Follow the guidance above and try again.",
                              );
                            }
                          }}
                        >
                          Capture Now
                        </button>
                        {cameraDevices.length > 1 && (
                          <button
                            type="button"
                            className="rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-black text-white"
                            onClick={switchToNextCamera}
                          >
                            Switch Camera
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                {isAvatarConnected && (
                  <div className="kyc-live-transcript absolute bottom-24 left-3 z-30 flex max-h-44 w-[min(92vw,520px)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-950/85 text-white shadow-2xl backdrop-blur sm:left-5">
                    <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-xs font-bold text-slate-200">
                      <span>Live Transcript</span>
                      {kycTranscriptPreview && (
                        <span className="max-w-[56%] truncate text-violet-200">
                          client: {kycTranscriptPreview.replace(/^"|"$/g, "")}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3 text-xs leading-5">
                      {buildVisibleTranscriptEntries(kycChatMessages, preferredLanguage).length ? (
                        buildVisibleTranscriptEntries(kycChatMessages, preferredLanguage)
                          .slice(-6)
                          .map((msg, index) => (
                            <div
                              key={`live-${msg.role}-${index}-${String(msg.text || "").slice(0, 24)}`}
                              className="grid grid-cols-[56px_1fr] gap-2 text-slate-200"
                            >
                              <span className={msg.role === "user" ? "font-bold text-sky-300" : "font-bold text-emerald-300"}>
                                {msg.role === "user" ? "client:" : "Dr.:"}
                              </span>
                              <span className="min-w-0 break-words">{msg.text}</span>
                            </div>
                          ))
                      ) : (
                        <div className="text-slate-400">The live conversation will appear here.</div>
                      )}
                      <div ref={kycLiveTranscriptEndRef} />
                    </div>
                  </div>
                )}

                {isChatOpen && (
                  <div className="kyc-side-panel absolute bottom-24 right-3 top-20 z-40 flex w-[min(92vw,360px)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-950/90 shadow-2xl backdrop-blur sm:right-5">
                    <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-sm font-bold">
                      <span>Live Chat</span>
                      <button className="text-white/60 hover:text-white" onClick={() => setIsChatOpen(false)}>
                        <MoreHorizontal size={18} />
                      </button>
                    </div>
                    <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3 text-sm">
                      {buildVisibleTranscriptEntries(kycChatMessages, preferredLanguage).length ? (
                        buildVisibleTranscriptEntries(kycChatMessages, preferredLanguage).map((msg, index) => (
                          <div key={`${msg.role}-${index}-${String(msg.content || "").slice(0, 24)}`} className="rounded-2xl bg-white/[0.08] p-3">
                            <div className={msg.role === "user" ? "text-xs font-bold text-sky-300" : "text-xs font-bold text-emerald-300"}>
                              {msg.role === "user" ? "Client" : "Agent Tara"}
                            </div>
                            <div className="mt-1 text-slate-100">{msg.text}</div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-2xl border border-dashed border-white/10 p-4 text-center text-sm text-slate-400">
                          The live conversation will appear here.
                        </div>
                      )}
                      <div ref={kycChatEndRef} />
                    </div>
                  </div>
                )}

                {isPeopleOpen && (
                  <div className="kyc-side-panel absolute bottom-24 right-3 top-20 z-40 w-[min(92vw,320px)] overflow-hidden rounded-2xl border border-white/10 bg-slate-950/90 shadow-2xl backdrop-blur sm:right-5">
                    <div className="border-b border-white/10 px-4 py-3 text-sm font-bold">People</div>
                    <div className="space-y-3 p-4 text-sm">
                      <div className="flex items-center gap-3 rounded-2xl bg-white/[0.08] p-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-400/20 font-bold text-emerald-200">AT</div>
                        <div>
                          <div className="font-bold">Agent Tara</div>
                          <div className="text-xs text-slate-400">Beyond Presence avatar</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 rounded-2xl bg-white/[0.08] p-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-400/20 font-bold text-sky-200">You</div>
                        <div>
                          <div className="font-bold">Client</div>
                          <div className="text-xs text-slate-400">{cameraEnabled ? "Camera on" : "Camera off"}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {false && isAvatarConnected && (
                  <div className={`absolute bottom-28 right-3 z-30 h-28 w-40 overflow-hidden rounded-sm border border-white/20 bg-slate-900 shadow-2xl sm:bottom-24 sm:right-5 sm:h-36 sm:w-56 ${!cameraEnabled ? "opacity-85" : ""}`}>
                    {cameraEnabled ? (
                      <video ref={userVideoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center bg-slate-900 text-slate-400">
                        <CameraOff size={28} />
                        <span className="mt-2 text-xs font-bold">Camera off</span>
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-black/55 px-2 py-1 text-xs font-bold">
                      You
                    </div>
                  </div>
                )}

                {isAvatarConnected &&
                  (getCompletedKycFieldCount(kycFields, kycResponses) <
                    kycFields.length ||
                    kycImageCaptureStage === "id" ||
                    kycImageCaptureStage === "fullBody") && (
                    <div className="kyc-call-controls absolute bottom-3 left-1/2 z-40 flex w-[min(96vw,760px)] -translate-x-1/2 items-end justify-center gap-2 rounded-3xl bg-slate-950/50 px-2 py-2 shadow-2xl backdrop-blur sm:bottom-5 sm:gap-3 sm:px-4">
                      {[
                        {
                          label: "Cam",
                          icon: cameraEnabled ? <Camera size={22} /> : <CameraOff size={22} />,
                          active: cameraEnabled,
                          onClick: toggleCamera,
                          title: cameraEnabled ? "Camera off" : "Camera on",
                        },
                        {
                          label: "Flip",
                          icon: <SwitchCamera size={22} />,
                          active: false,
                          onClick: switchToNextCamera,
                          title: "Switch camera",
                          hidden: cameraDevices.length < 2,
                        },
                        {
                          label: "Mic",
                          icon: isMuted ? <MicOff size={22} /> : <Mic size={22} />,
                          active: !isMuted,
                          onClick: toggleMute,
                          title: isMuted ? "Unmute" : "Mute",
                        },
                        {
                          label: "Share",
                          icon: isScreenSharing ? <ScreenShareOff size={22} /> : <MonitorUp size={22} />,
                          active: isScreenSharing,
                          onClick: toggleScreenShare,
                          title: isScreenSharing ? "Stop sharing" : "Share screen",
                        },
                        {
                          label: isRecordingCall ? "Stop" : "Record",
                          icon: <Radio size={22} />,
                          active: isRecordingCall,
                          onClick: () =>
                            isRecordingCall
                              ? stopCallRecording({ discard: false })
                              : startCallRecording(),
                          title: isRecordingCall ? "Stop recording" : "Start recording",
                        },
                        {
                          label: "Chat",
                          icon: <MessageSquare size={22} />,
                          active: isChatOpen,
                          onClick: () => setIsChatOpen((prev) => !prev),
                          title: "Chat",
                        },
                        {
                          label: "People",
                          icon: <Users size={22} />,
                          active: isPeopleOpen,
                          onClick: () => setIsPeopleOpen((prev) => !prev),
                          title: "People",
                        },
                      ].filter((control) => !control.hidden).map((control) => (
                        <button
                          key={control.label}
                          type="button"
                          title={control.title}
                          onClick={control.onClick}
                          className={`kyc-control-button flex h-16 min-w-14 flex-col items-center justify-center gap-1 rounded-2xl border border-white/10 px-2 text-[11px] font-bold shadow-lg transition sm:h-[76px] sm:min-w-[76px] sm:text-xs ${
                            control.active
                              ? "bg-emerald-500/80 text-white"
                              : "bg-slate-950/80 text-slate-200 hover:bg-slate-800"
                          }`}
                        >
                          {control.icon}
                          <span>{control.label}</span>
                        </button>
                      ))}
                      <button
                        type="button"
                        title="Leave"
                        onClick={endCallOnly}
                        className="kyc-control-button flex h-16 min-w-14 flex-col items-center justify-center gap-1 rounded-2xl border border-red-300/20 bg-red-600/90 px-2 text-[11px] font-bold text-white shadow-lg transition hover:bg-red-500 sm:h-[76px] sm:min-w-[76px] sm:text-xs"
                      >
                        <DoorOpen size={22} />
                        <span>Leave</span>
                      </button>
                    </div>
                  )}
              </div>
            </div>
          )}

          {/* === CARE PLAN TAB === */}
          {activeTab === "careplan" && (
            <div style={styles.carePlanLayout}>
              <div style={styles.carePlanLeftPanel}>
                <div style={styles.panelHeader}>
                  <h3 style={styles.panelTitle}>
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="2"
                      style={{ marginRight: "8px" }}
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    Care Plan Setup
                  </h3>
                </div>
                <div style={styles.uploadContainerCompact}>
                  <input
                    type="file"
                    ref={dischargeFileInputRef}
                    onChange={handleDischargeFileUpload}
                    accept=".pdf,.txt"
                    style={{ display: "none" }}
                  />
                  {!dischargeFile ? (
                    <div
                      style={{ ...styles.dropZoneCompact, minHeight: "80px" }}
                      onClick={() => dischargeFileInputRef.current?.click()}
                    >
                      <svg
                        width="28"
                        height="28"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="1.5"
                      >
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      <span style={styles.dropZoneTextCompact}>
                        Upload Discharge Summary
                      </span>
                    </div>
                  ) : (
                    <div style={styles.fileUploadedCompact}>
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="2"
                      >
                        <polyline points="9 11 12 14 22 4" />
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                      </svg>
                      <span style={styles.fileNameCompact}>
                        {dischargeFile.name}
                      </span>
                      <button
                        style={styles.removeFileButtonCompact}
                        onClick={() => {
                          setDischargeFile(null);
                          setDischargeSummary("");
                          setCarePlan(null);
                        }}
                      >
                        âœ•
                      </button>
                    </div>
                  )}
                </div>
                {dischargeSummary && !carePlan && (
                  <div
                    style={{
                      padding: "12px 16px",
                      borderTop: "1px solid #e2e8f0",
                    }}
                  >
                    <label
                      style={{
                        display: "block",
                        fontSize: "10px",
                        fontWeight: "600",
                        color: "#64748b",
                        marginBottom: "6px",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      Add Pre-existing Conditions
                    </label>
                    <textarea
                      value={manualConditions}
                      onChange={(e) => setManualConditions(e.target.value)}
                      placeholder="Conditions separated by commas"
                      style={{
                        width: "calc(100% - 8px)",
                        minHeight: "60px",
                        padding: "10px",
                        fontSize: "11px",
                        color: "#1e293b",
                        border: "1px solid #e2e8f0",
                        borderRadius: "6px",
                        resize: "vertical",
                        fontFamily: "inherit",
                        outline: "none",
                        background: "#f8fafc",
                      }}
                    />
                  </div>
                )}
                {dischargeSummary && !carePlan && (
                  <button
                    style={{
                      ...styles.generateButton,
                      margin: "0 16px 16px",
                      background: "linear-gradient(135deg,#10b981,#059669)",
                      opacity: isGeneratingCarePlan ? 0.7 : 1,
                    }}
                    onClick={generateCarePlan}
                    disabled={isGeneratingCarePlan}
                  >
                    {isGeneratingCarePlan ? (
                      <>
                        <span style={styles.spinner}></span>Generating...
                      </>
                    ) : (
                      <>
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          style={{ marginRight: "8px" }}
                        >
                          <path d="M9 11l3 3L22 4" />
                          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                        </svg>
                        Generate Care Plan
                      </>
                    )}
                  </button>
                )}
                {carePlan && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                      margin: "16px",
                    }}
                  >
                    <button
                      style={{
                        ...styles.generateButton,
                        margin: "0",
                        background: "linear-gradient(135deg,#6366f1,#4f46e5)",
                      }}
                      onClick={resetCarePlanAssessment}
                    >
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        style={{ marginRight: "8px" }}
                      >
                        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                        <path d="M21 3v5h-5" />
                      </svg>
                      Restart Assessment
                    </button>
                    <button
                      style={{
                        ...styles.generateButton,
                        margin: "0",
                        background: "linear-gradient(135deg,#10b981,#059669)",
                      }}
                      onClick={downloadCarePlanExcel}
                    >
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        style={{ marginRight: "8px" }}
                      >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      Download (Excel)
                    </button>
                  </div>
                )}
                <div style={styles.alertsPanel}>
                  <h4 style={styles.alertsPanelTitle}>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth="2"
                      style={{ marginRight: "6px" }}
                    >
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    Alerts ({carePlanAlerts.length})
                  </h4>
                  <div style={styles.alertsList}>
                    {carePlanAlerts.length === 0 ? (
                      <p style={styles.noAlertsText}>No alerts triggered</p>
                    ) : (
                      carePlanAlerts.map((a) => (
                        <div key={a.id} style={styles.alertItem}>
                          <div style={styles.alertHeader}>
                            <span style={styles.alertSymptom}>
                              {a.symptom || "Alert"}
                            </span>
                            <span style={styles.alertTime}>{a.timestamp}</span>
                          </div>
                          <p style={styles.alertQuestion}>{a.question}</p>
                          <p style={styles.alertResponse}>
                            Response: <strong>{a.response}</strong>
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
              <div style={styles.carePlanRightPanel}>
                <div style={styles.panelHeader}>
                  <h3 style={styles.panelTitle}>
                    {hospitalLogoUrl && hospitalName && (
                      <img
                        src={hospitalLogoUrl}
                        alt={hospitalName}
                        style={{
                          height: "20px",
                          width: "auto",
                          maxWidth: "100px",
                          objectFit: "contain",
                          marginRight: "8px",
                        }}
                        onError={(e) => {
                          e.target.style.display = "none";
                        }}
                      />
                    )}
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="2"
                      style={{ marginRight: "8px" }}
                    >
                      <circle cx="12" cy="12" r="10" />
                      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    {hospitalName || "Daily Assessment"}
                    {carePlan && (
                      <span
                        style={{
                          marginLeft: "12px",
                          fontSize: "12px",
                          color: "#64748b",
                          fontWeight: "400",
                        }}
                      >
                        Q{" "}
                        {Math.min(
                          currentQuestionIndex + 1,
                          carePlan.questions.length,
                        )}{" "}
                        of {carePlan.questions.length}
                      </span>
                    )}
                  </h3>
                </div>
                <div style={styles.carePlanQuestionsArea}>
                  {!carePlan ? (
                    <div style={styles.chatEmpty}>
                      <svg
                        width="80"
                        height="80"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#cbd5e1"
                        strokeWidth="1"
                      >
                        <path d="M9 11l3 3L22 4" />
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                      </svg>
                      <p style={{ marginTop: "16px", fontSize: "16px" }}>
                        Upload a discharge summary to generate care plan
                      </p>
                    </div>
                  ) : assessmentComplete ? (
                    <div style={styles.assessmentComplete}>
                      <div style={styles.completeIcon}>âœ“</div>
                      <h3 style={styles.completeTitle}>Assessment Complete!</h3>
                      <p style={styles.completeMessage}>
                        {carePlan.thankYouMessage}
                      </p>
                      {carePlanAlerts.length > 0 && (
                        <div style={styles.completeSummary}>
                          <p style={styles.completeSummaryAlert}>
                            {carePlanAlerts.length} alert(s) triggered - A nurse
                            will review.
                          </p>
                        </div>
                      )}
                      <div style={styles.responsesSummary}>
                        <h4 style={{ margin: "0 0 12px", color: "#334155" }}>
                          Response Summary
                        </h4>
                        {carePlan?.questions?.map((q) => {
                          const r = carePlanResponses[q.id];
                          return (
                            <div key={q.id} style={styles.summaryItem}>
                              <span style={styles.summaryQuestion}>
                                {q.questionDescription}
                              </span>
                              <span
                                style={{
                                  ...styles.summaryResponse,
                                  color: r?.triggersAlert
                                    ? "#ef4444"
                                    : "#10b981",
                                }}
                              >
                                {r?.text || "Not answered"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div style={styles.questionsContainer}>
                      {carePlan?.questions?.map((q, idx) => {
                        const cur = idx === currentQuestionIndex,
                          past = idx < currentQuestionIndex;
                        if (!past && !cur) return null;
                        return (
                          <div
                            key={q.id}
                            style={{
                              ...styles.questionCard,
                              opacity: past ? 0.6 : 1,
                              transform: cur ? "scale(1)" : "scale(0.98)",
                            }}
                          >
                            <div style={styles.questionCategory}>
                              {q.category}
                            </div>
                            <p style={styles.questionText}>
                              {q.questionDescription}
                            </p>
                            <div style={styles.optionsGrid}>
                              {q.options.map((o, oi) => {
                                const sel =
                                  carePlanResponses[q.id]?.text === o.text;
                                return (
                                  <button
                                    key={oi}
                                    style={{
                                      ...styles.optionButton,
                                      ...(sel
                                        ? styles.optionButtonSelected
                                        : {}),
                                      ...(o.triggersAlert && sel
                                        ? styles.optionButtonAlert
                                        : {}),
                                      ...(past && !sel
                                        ? styles.optionButtonDisabled
                                        : {}),
                                    }}
                                    onClick={() =>
                                      !past && handleCarePlanResponse(q.id, o)
                                    }
                                    disabled={past}
                                  >
                                    {o.text}
                                  </button>
                                );
                              })}
                            </div>
                            {carePlanResponses[q.id]?.symptom && (
                              <div style={styles.symptomTag}>
                                Symptom: {carePlanResponses[q.id].symptom}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      <div ref={carePlanEndRef} />
                    </div>
                  )}
                </div>
                {carePlan && !assessmentComplete && (
                  <div style={styles.progressBar}>
                    <div
                      style={{
                        ...styles.progressFill,
                        width: `${((currentQuestionIndex + (carePlanResponses[carePlan.questions[currentQuestionIndex]?.id] ? 1 : 0)) / carePlan.questions.length) * 100}%`,
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
      <audio ref={audioRef} />
      <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes bounce { 0%, 60%, 100% { transform: translateY(0); } 30% { transform: translateY(-4px); } }
          @keyframes pulse { 0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239,68,68,0.7); } 50% { transform: scale(1.05); box-shadow: 0 0 0 15px rgba(239,68,68,0); } }
          @keyframes orbBreath { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
          @keyframes orbSpin { 0% { transform: rotate(0deg) scale(1.02); } 100% { transform: rotate(360deg) scale(1.02); } }
          @keyframes micPulse { 0%, 100% { box-shadow: 0 4px 30px rgba(239,68,68,0.2); } 50% { box-shadow: 0 4px 40px rgba(239,68,68,0.45), 0 0 0 12px rgba(239,68,68,0.06); } }
          @keyframes fadeInOut { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
        `}</style>
    </div>
  );
};

const ft = {
  layout: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 0,
    height: "calc(100vh - 100px)",
    borderRadius: "18px",
    overflow: "hidden",
    boxShadow: "0 24px 80px rgba(0,0,0,0.4)",
    border: "1px solid rgba(255,255,255,0.04)",
  },
  side: {
    background: "#0d0d14",
    borderRight: "1px solid rgba(255,255,255,0.05)",
    display: "none",
    flexDirection: "column",
    overflow: "hidden",
  },
  sideHead: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "20px",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
  },
  sideDot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    background: "linear-gradient(135deg,#8b5cf6,#a78bfa)",
    flexShrink: 0,
  },
  sideTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: "#e2e8f0",
    letterSpacing: "-0.3px",
  },
  progWrap: {
    padding: "16px 20px",
    borderBottom: "1px solid rgba(255,255,255,0.04)",
  },
  progRow: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  progLabel: { fontSize: 12, color: "#94a3b8", fontWeight: 500 },
  progPct: { fontSize: 13, color: "#a78bfa", fontWeight: 700 },
  progTrack: {
    height: 3,
    background: "rgba(255,255,255,0.06)",
    borderRadius: 2,
    overflow: "hidden",
  },
  progBar: {
    height: "100%",
    background: "linear-gradient(90deg,#8b5cf6,#a78bfa)",
    borderRadius: 2,
    transition: "width 0.6s ease",
  },
  fieldScroll: {
    flex: 1,
    overflow: "auto",
    padding: "10px 12px",
    display: "flex",
    flexDirection: "column",
    gap: 3,
  },
  fRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid transparent",
    transition: "all 0.2s",
  },
  fRowCur: {
    background: "rgba(139,92,246,0.08)",
    border: "1px solid rgba(139,92,246,0.25)",
  },
  fRowDone: {
    background: "rgba(52,211,153,0.05)",
    border: "1px solid rgba(52,211,153,0.12)",
  },
  fNum: {
    width: 22,
    height: 22,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 10,
    fontWeight: 700,
    flexShrink: 0,
  },
  fName: { margin: 0, fontSize: 12, fontWeight: 500, lineHeight: 1.35 },
  fVal: {
    margin: "3px 0 0",
    fontSize: 11,
    color: "#34d399",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  doneBox: {
    padding: 16,
    borderTop: "1px solid rgba(255,255,255,0.05)",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  dlBtn: {
    padding: 12,
    background: "linear-gradient(135deg,#34d399,#059669)",
    border: "none",
    borderRadius: 10,
    color: "#fff",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  newBtn: {
    padding: 10,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 10,
    color: "#94a3b8",
    fontSize: 12,
    cursor: "pointer",
    textAlign: "center",
  },
  call: {
    position: "relative",
    background: "#000",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 22px",
    background: "linear-gradient(180deg,rgba(0,0,0,0.75) 0%,transparent 100%)",
  },
  topL: { display: "flex", alignItems: "center", gap: 10 },
  live: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#34d399",
    boxShadow: "0 0 10px rgba(52,211,153,0.6)",
    animation: "fadeInOut 2s ease-in-out infinite",
  },
  docName: {
    fontSize: 16,
    fontWeight: 600,
    color: "#fff",
    letterSpacing: "-0.3px",
  },
  docSub: { fontSize: 11, color: "rgba(255,255,255,0.4)", marginLeft: 4 },
  topR: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10,
    flexWrap: "wrap",
  },
  actionBtn: {
    padding: "8px 12px",
    background: "linear-gradient(135deg,#34d399,#059669)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 10,
    color: "#fff",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    lineHeight: 1,
    whiteSpace: "nowrap",
    backdropFilter: "blur(8px)",
  },
  badge: {
    fontSize: 12,
    color: "rgba(255,255,255,0.75)",
    fontWeight: 500,
    background: "rgba(255,255,255,0.08)",
    padding: "4px 12px",
    borderRadius: 8,
    backdropFilter: "blur(8px)",
  },
  langSel: {
    appearance: "none",
    WebkitAppearance: "none",
    background: "#f8fafc",
    border: "1px solid rgba(148,163,184,0.45)",
    borderRadius: 10,
    padding: "7px 30px 7px 12px",
    fontSize: 12,
    fontWeight: 700,
    color: "#0f172a",
    cursor: "pointer",
    outline: "none",
    minWidth: 132,
    boxShadow: "0 8px 22px rgba(15,23,42,0.16)",
    backgroundImage:
      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%230f172a' stroke-width='2.4'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 10px center",
  },
  langOption: {
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 13,
    fontWeight: 600,
  },
  langSelDisabled: {
    opacity: 0.55,
    cursor: "not-allowed",
  },
  vidArea: {
    flex: 1,
    minHeight: 0,
    display: "flex",
    alignItems: "stretch",
    justifyContent: "stretch",
  },
  mid: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: "100%",
  },
  callBtn: {
    padding: "18px 36px",
    background: "linear-gradient(135deg,#22c55e,#16a34a)",
    border: "none",
    borderRadius: 18,
    color: "#fff",
    fontSize: 17,
    fontWeight: 600,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 10px 40px rgba(34,197,94,0.35)",
  },
  callBtnDisabled: { opacity: 0.45, cursor: "not-allowed", boxShadow: "none" },
  errBox: {
    marginTop: 16,
    maxWidth: 360,
    padding: "14px 16px",
    borderRadius: 14,
    border: "1px solid rgba(248,113,113,0.2)",
    background: "rgba(127,29,29,0.18)",
    backdropFilter: "blur(10px)",
  },
  errTitle: { margin: 0, color: "#fca5a5", fontSize: 13, fontWeight: 700 },
  errText: {
    margin: "8px 0 0",
    color: "#fecaca",
    fontSize: 12,
    lineHeight: 1.5,
  },
  errHint: {
    margin: "8px 0 0",
    color: "#cbd5e1",
    fontSize: 11,
    lineHeight: 1.5,
  },
  pip: {
    position: "absolute",
    bottom: 270,
    right: 20,
    width: 130,
    height: 175,
    borderRadius: 14,
    overflow: "hidden",
    boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
    border: "2px solid rgba(255,255,255,0.15)",
    zIndex: 15,
    background: "#111",
  },
  pipOff: { display: "flex", alignItems: "center", justifyContent: "center" },
  pipVid: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    transform: "scaleX(-1)",
    display: "block",
  },
  pipPlaceholder: {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: "#0d0d14",
  },
  qOver: {
    position: "absolute",
    bottom: 80,
    left: 20,
    right: 170,
    zIndex: 12,
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  qChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 16px",
    background: "rgba(0,0,0,0.55)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.08)",
  },
  qNum: {
    fontSize: 11,
    fontWeight: 700,
    color: "#a78bfa",
    letterSpacing: "0.3px",
  },
  qTxt: {
    fontSize: 13,
    fontWeight: 500,
    color: "#e2e8f0",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  tChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "7px 14px",
    background: "rgba(139,92,246,0.12)",
    backdropFilter: "blur(12px)",
    borderRadius: 10,
    border: "1px solid rgba(139,92,246,0.15)",
  },
  tTxt: {
    fontSize: 12,
    fontWeight: 500,
    color: "#c4b5fd",
    fontStyle: "italic",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  liveTranscript: {
    height: 180,
    flexShrink: 0,
    borderTop: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(3,7,18,0.96)",
    padding: "12px 18px 14px",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  transcriptHead: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    color: "#e2e8f0",
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.2px",
  },
  transcriptListening: {
    color: "#c4b5fd",
    fontSize: 11,
    fontWeight: 600,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: "50%",
  },
  transcriptBody: {
    flex: 1,
    overflow: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 8,
    paddingRight: 6,
  },
  transcriptLine: {
    display: "grid",
    gridTemplateColumns: "64px 1fr",
    gap: 10,
    alignItems: "start",
    color: "#cbd5e1",
    fontSize: 13,
    lineHeight: 1.45,
  },
  transcriptRole: {
    fontWeight: 800,
    whiteSpace: "nowrap",
  },
  transcriptText: {
    minWidth: 0,
    overflowWrap: "anywhere",
  },
  transcriptEmpty: {
    color: "#64748b",
    fontSize: 13,
    fontStyle: "italic",
  },
  ctrls: {
    position: "absolute",
    bottom: 180,
    left: 0,
    right: 0,
    zIndex: 20,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
    padding: "18px 24px 28px",
    background: "linear-gradient(0deg,rgba(0,0,0,0.85) 0%,transparent 100%)",
  },
  cBtn: {
    width: 50,
    height: 50,
    borderRadius: "50%",
    border: "none",
    background: "rgba(255,255,255,0.1)",
    color: "#fff",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backdropFilter: "blur(8px)",
  },
  cBtnOn: { background: "rgba(239,68,68,0.25)", color: "#f87171" },
  endBtn: {
    width: 64,
    height: 64,
    borderRadius: "50%",
    border: "none",
    background: "#ef4444",
    color: "#fff",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 6px 24px rgba(239,68,68,0.4)",
  },
};

// === MAIN STYLES ===
const styles = {
  container: {
    display: "flex",
    minHeight: "100vh",
    background: "linear-gradient(135deg,#f8fafc 0%,#e2e8f0 100%)",
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
  },
  sidebar: {
    width: "64px",
    background: "linear-gradient(180deg,#0f172a 0%,#1e293b 100%)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "16px 0",
    boxShadow: "4px 0 20px rgba(0,0,0,0.1)",
  },
  logoContainer: { marginBottom: "32px" },
  logoIcon: {
    width: "40px",
    height: "40px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  nav: { display: "flex", flexDirection: "column", gap: "8px", flex: 1 },
  navButton: {
    width: "48px",
    height: "48px",
    border: "none",
    borderRadius: "12px",
    background: "transparent",
    color: "#94a3b8",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.2s ease",
  },
  navButtonActive: {
    background: "linear-gradient(135deg,#0891b2,#0e7490)",
    color: "#fff",
    boxShadow: "0 4px 12px rgba(8,145,178,0.4)",
  },
  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 32px",
    background: "#fff",
    borderBottom: "1px solid #e2e8f0",
    boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
  },
  headerLeft: { display: "flex", alignItems: "center", gap: "12px" },
  headerBadge: {
    padding: "4px 12px",
    background: "linear-gradient(135deg,#0891b2,#0e7490)",
    color: "#fff",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: "600",
    letterSpacing: "0.5px",
  },
  headerRight: { display: "flex", alignItems: "center" },
  welcomeText: { color: "#64748b", fontSize: "14px", fontWeight: "500" },
  content: { flex: 1, padding: "24px 32px 32px", overflow: "auto" },
  splitViewWide: {
    display: "grid",
    gridTemplateColumns: "280px 1fr",
    gap: "20px",
    height: "calc(100vh - 100px)",
  },
  panelSmall: {
    background: "#fff",
    borderRadius: "16px",
    boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  panelLarge: {
    background: "#fff",
    borderRadius: "16px",
    boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "20px 24px",
    borderBottom: "1px solid #e2e8f0",
    background: "linear-gradient(135deg,#f8fafc,#fff)",
  },
  panelTitle: {
    margin: 0,
    fontSize: "16px",
    fontWeight: "600",
    color: "#1e293b",
    display: "flex",
    alignItems: "center",
  },
  uploadContainerCompact: {
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  uploadLabel: {
    fontSize: "12px",
    fontWeight: "600",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    marginBottom: "4px",
  },
  dropZoneCompact: {
    padding: "16px",
    border: "2px dashed #cbd5e1",
    borderRadius: "10px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    transition: "all 0.2s ease",
    background: "#f8fafc",
    gap: "8px",
  },
  dropZoneTextCompact: {
    fontSize: "13px",
    fontWeight: "500",
    color: "#64748b",
  },
  fileUploadedCompact: {
    display: "flex",
    alignItems: "center",
    padding: "10px 12px",
    background: "#f0fdf4",
    borderRadius: "8px",
    border: "1px solid #86efac",
    gap: "8px",
  },
  fileNameCompact: {
    flex: 1,
    fontSize: "12px",
    fontWeight: "500",
    color: "#166534",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  removeFileButtonCompact: {
    width: "24px",
    height: "24px",
    border: "none",
    borderRadius: "6px",
    background: "#fee2e2",
    color: "#dc2626",
    cursor: "pointer",
    fontSize: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  transcriptPreviewCompact: {
    flex: 1,
    padding: "0 16px 16px",
    overflow: "auto",
  },
  previewTitleCompact: {
    margin: "0 0 8px 0",
    fontSize: "11px",
    fontWeight: "600",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  previewContentCompact: {
    padding: "12px",
    background: "#f8fafc",
    borderRadius: "8px",
    fontSize: "11px",
    lineHeight: "1.5",
    color: "#475569",
    whiteSpace: "pre-wrap",
    maxHeight: "200px",
    overflow: "auto",
  },
  chatContainer: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  chatMessages: {
    flex: 1,
    padding: "24px",
    overflow: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  chatEmpty: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    color: "#94a3b8",
    textAlign: "center",
  },
  chatMessage: {
    display: "flex",
    gap: "12px",
    animation: "fadeIn 0.3s ease-out",
  },
  systemMessage: {
    justifyContent: "center",
    padding: "8px 16px",
    background: "#f1f5f9",
    borderRadius: "8px",
    fontSize: "13px",
    color: "#64748b",
  },
  userMessage: { flexDirection: "row-reverse" },
  assistantMessage: { flexDirection: "row" },
  errorMessage: { opacity: 0.8 },
  messageAvatar: {
    width: "36px",
    height: "36px",
    borderRadius: "10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "18px",
    background: "#f1f5f9",
    flexShrink: 0,
  },
  messageContent: {
    maxWidth: "80%",
    padding: "12px 16px",
    borderRadius: "12px",
    fontSize: "14px",
    lineHeight: "1.6",
    background: "#f1f5f9",
    color: "#1e293b",
    whiteSpace: "pre-wrap",
  },
  typingIndicator: {
    display: "flex",
    gap: "4px",
    padding: "16px",
    background: "#f1f5f9",
    borderRadius: "12px",
  },
  chatInputContainer: {
    padding: "16px 24px 24px",
    display: "flex",
    gap: "12px",
    borderTop: "1px solid #e2e8f0",
  },
  chatInput: {
    flex: 1,
    padding: "14px 18px",
    border: "2px solid #e2e8f0",
    borderRadius: "12px",
    fontSize: "14px",
    outline: "none",
    transition: "border-color 0.2s ease",
  },
  sendButton: {
    width: "48px",
    height: "48px",
    border: "none",
    borderRadius: "12px",
    background: "linear-gradient(135deg,#0891b2,#0e7490)",
    color: "#fff",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.2s ease",
  },
  generateButton: {
    margin: "0 24px 24px",
    padding: "14px 24px",
    background: "linear-gradient(135deg,#f97316,#ea580c)",
    border: "none",
    borderRadius: "12px",
    color: "#fff",
    fontSize: "15px",
    fontWeight: "600",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.2s ease",
    boxShadow: "0 4px 12px rgba(249,115,22,0.3)",
  },
  spinner: {
    width: "18px",
    height: "18px",
    border: "2px solid rgba(255,255,255,0.3)",
    borderTopColor: "#fff",
    borderRadius: "50%",
    marginRight: "10px",
    animation: "spin 0.8s linear infinite",
  },
  questionsContainer: { flex: 1, padding: "24px", overflow: "auto" },
  carePlanLayout: {
    display: "grid",
    gridTemplateColumns: "320px 1fr",
    gap: "20px",
    height: "calc(100vh - 100px)",
  },
  carePlanLeftPanel: {
    background: "#fff",
    borderRadius: "16px",
    boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  carePlanRightPanel: {
    background: "#fff",
    borderRadius: "16px",
    boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  carePlanQuestionsArea: {
    flex: 1,
    padding: "24px",
    overflow: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  alertsPanel: {
    flex: 1,
    padding: "16px",
    borderTop: "1px solid #e2e8f0",
    overflow: "auto",
  },
  alertsPanelTitle: {
    display: "flex",
    alignItems: "center",
    margin: "0 0 12px 0",
    fontSize: "13px",
    fontWeight: "600",
    color: "#ef4444",
  },
  alertsList: { display: "flex", flexDirection: "column", gap: "8px" },
  noAlertsText: {
    fontSize: "12px",
    color: "#94a3b8",
    textAlign: "center",
    padding: "20px",
  },
  alertItem: {
    padding: "10px 12px",
    background: "#fef2f2",
    borderRadius: "8px",
    border: "1px solid #fecaca",
    animation: "fadeIn 0.3s ease-out",
  },
  alertHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "4px",
  },
  alertSymptom: { fontSize: "12px", fontWeight: "600", color: "#dc2626" },
  alertTime: { fontSize: "10px", color: "#94a3b8" },
  alertQuestion: {
    margin: "0",
    fontSize: "11px",
    color: "#64748b",
    lineHeight: "1.4",
  },
  alertResponse: { margin: "4px 0 0", fontSize: "11px", color: "#334155" },
  questionCard: {
    padding: "20px",
    background: "#f8fafc",
    borderRadius: "12px",
    border: "2px solid #e2e8f0",
    transition: "all 0.3s ease",
    animation: "fadeIn 0.3s ease-out",
  },
  questionCategory: {
    display: "inline-block",
    padding: "4px 10px",
    background: "#10b981",
    color: "#fff",
    borderRadius: "20px",
    fontSize: "11px",
    fontWeight: "600",
    marginBottom: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  questionText: {
    margin: "0 0 16px 0",
    fontSize: "16px",
    fontWeight: "500",
    color: "#1e293b",
    lineHeight: "1.5",
  },
  optionsGrid: { display: "flex", flexWrap: "wrap", gap: "10px" },
  optionButton: {
    padding: "12px 24px",
    border: "2px solid #e2e8f0",
    borderRadius: "10px",
    background: "#fff",
    fontSize: "14px",
    fontWeight: "500",
    color: "#334155",
    cursor: "pointer",
    transition: "all 0.2s ease",
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  optionButtonSelected: {
    background: "#10b981",
    borderColor: "#10b981",
    color: "#fff",
  },
  optionButtonAlert: {
    background: "#ef4444",
    borderColor: "#ef4444",
    color: "#fff",
  },
  optionButtonDisabled: { opacity: 0.5, cursor: "default" },
  symptomTag: {
    marginTop: "12px",
    padding: "8px 12px",
    background: "#fef3c7",
    borderRadius: "6px",
    fontSize: "12px",
    color: "#92400e",
  },
  progressBar: {
    height: "4px",
    background: "#e2e8f0",
    borderRadius: "2px",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    background: "linear-gradient(90deg,#10b981,#059669)",
    transition: "width 0.3s ease",
  },
  assessmentComplete: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "flex-start",
    padding: "40px 20px",
    textAlign: "center",
    overflow: "auto",
  },
  completeIcon: {
    width: "80px",
    height: "80px",
    borderRadius: "50%",
    background: "linear-gradient(135deg,#10b981,#059669)",
    color: "#fff",
    fontSize: "40px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "20px",
    boxShadow: "0 4px 20px rgba(16,185,129,0.4)",
  },
  completeTitle: {
    margin: "0 0 10px 0",
    fontSize: "24px",
    fontWeight: "600",
    color: "#1e293b",
  },
  completeMessage: {
    margin: "0 0 20px 0",
    fontSize: "14px",
    color: "#64748b",
    maxWidth: "400px",
    lineHeight: "1.6",
  },
  completeSummary: {
    padding: "16px",
    background: "#fef2f2",
    borderRadius: "10px",
    marginBottom: "20px",
    width: "100%",
    maxWidth: "500px",
  },
  completeSummaryAlert: {
    margin: "0",
    fontSize: "14px",
    fontWeight: "500",
    color: "#dc2626",
  },
  responsesSummary: {
    width: "100%",
    maxWidth: "500px",
    textAlign: "left",
    padding: "20px",
    background: "#f8fafc",
    borderRadius: "12px",
  },
  summaryItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: "8px 0",
    borderBottom: "1px solid #e2e8f0",
    gap: "12px",
  },
  summaryQuestion: { fontSize: "12px", color: "#64748b", flex: 1 },
  summaryResponse: { fontSize: "12px", fontWeight: "600", textAlign: "right" },
};

export default CarelyAIAssistant;
