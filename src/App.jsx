//new code

import React, { useState, useRef, useEffect } from "react";
import CarelyLogoFull from "./assets/carely-logo-full.png";
import CarelyLogoIcon from "./assets/carely-logo-icon.png";
import BeyondPresenceStream from "./BeyondPresenceStream";
import PanCardCapture from "./PanCardCapture";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min?url";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

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
  "ha",
  "han",
  "ho",
  "hoy",
  "hoi",
  "true",
  "हो",
  "होय",
  "हाँ",
  "हां",
]);
const NO_ANSWER_VALUES = new Set([
  "no",
  "n",
  "nope",
  "nah",
  "nahi",
  "nahi",
  "naahi",
  "false",
  "नहीं",
  "नही",
  "नाही",
]);

const parseYesNoAnswer = (text) => {
  const t = normalize(text || "");
  if (!t) return null;

  if (YES_ANSWER_VALUES.has(t)) return "Yes";
  if (NO_ANSWER_VALUES.has(t)) return "No";

  if (/^(yes|haan|ha|ho|hoy|hoi)\b/.test(t)) return "Yes";
  if (/^(no|nahi|nahi|naahi)\b/.test(t)) return "No";
  return null;
};

const inferImplicitYesNoAnswer = (field, text) => {
  if (!isYesNoField(field)) return null;

  const raw = String(text || "").trim();
  if (!raw) return null;

  const explicit = parseYesNoAnswer(raw);
  if (explicit) return explicit;

  const normalized = normalizeIndicSpeechText(raw).toLowerCase();
  if (
    /\b(no|none|nil|never|nothing|dont|don't|do not|not taking|not on any|no treatment|no medication|not hospitalized|not admitted|not operated)\b/.test(
      normalized,
    )
  ) {
    return "No";
  }

  if (field?.id === "treatment_medication") {
    if (
      /\b(medicine|medication|tablet|capsule|insulin|therapy|treatment|surgery|operation|hospital|hospitalized|admitted|under treatment|taking)\b/.test(
        normalized,
      )
    ) {
      return "Yes";
    }
  }

  if (field?.requiresReasonOnYes && /[a-z0-9]/i.test(raw) && raw.length >= 4) {
    return "Yes";
  }

  return null;
};

const normalizeIndicSpeechText = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/ऑक्टोबर|अक्टूबर|ऑक्टूबर/gi, " october ")
    .replace(/सप्टेंबर|सितंबर|सितम्बर/gi, " september ")
    .replace(/नवंबर|नोव्हेंबर/gi, " november ")
    .replace(/डिसेंबर|दिसंबर/gi, " december ")
    .replace(/शून्य|सुन्य|सु्न्य/gi, " zero ")
    .replace(/एक/gi, " one ")
    .replace(/दोन|दो/gi, " two ")
    .replace(/तीन/gi, " three ")
    .replace(/चार/gi, " four ")
    .replace(/पाच/gi, " five ")
    .replace(/सहा|छह/gi, " six ")
    .replace(/सात/gi, " seven ")
    .replace(/आठ/gi, " eight ")
    .replace(/नऊ|नौ/gi, " nine ")
    .replace(/दहा|दस/gi, " ten ")
    .replace(/हजार/gi, " thousand ")
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
    .replace(/एकशे|एक शे/gi, " one hundred ")
    .replace(/दोनशे|दोशे|दोन शे|दो शे/gi, " two hundred ")
    .replace(/तीनशे|तीन शे/gi, " three hundred ")
    .replace(/चारशे|चार शे/gi, " four hundred ")
    .replace(/पाचशे|पाच शे/gi, " five hundred ")
    .replace(/सहाशे|सहा शे|छह सौ/gi, " six hundred ")
    .replace(/सातशे|सात शे/gi, " seven hundred ")
    .replace(/आठशे|आठ शे/gi, " eight hundred ")
    .replace(/नऊशे|नौ सौ|नऊ शे/gi, " nine hundred ")
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
    .replace(/एकोणऐंशी|एकोणऐशी/gi, " seventy nine ")
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

const buildKycQuestionPrompt = (field, stepIndex = null, total = null) => {
  const stepText =
    stepIndex != null && total != null
      ? ` (Step ${stepIndex + 1} of ${total})`
      : "";

  if (field?.prompt) {
    return `${field.prompt}${stepText}`;
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
  { value: "en", label: "🇬🇧 English" },
  { value: "hi", label: "🇮🇳 हिन्दी (Hindi)" },
  { value: "bn", label: "🇮🇳 বাংলা (Bengali)" },
  { value: "te", label: "🇮🇳 తెలుగు (Telugu)" },
  { value: "ta", label: "🇮🇳 தமிழ் (Tamil)" },
  { value: "mr", label: "🇮🇳 मराठी (Marathi)" },
  { value: "gu", label: "🇮🇳 ગુજરાતી (Gujarati)" },
  { value: "kn", label: "🇮🇳 ಕನ್ನಡ (Kannada)" },
  { value: "ml", label: "🇮🇳 മലയാളം (Malayalam)" },
  { value: "pa", label: "🇮🇳 ਪੰਜਾਬੀ (Punjabi)" },
  { value: "or", label: "🇮🇳 ଓଡ଼ିଆ (Odia)" },
  { value: "ur", label: "🇮🇳 اردو (Urdu)" },
];

const SARVAM_LANGUAGE_CODES = {
  en: "en-IN",
  hi: "hi-IN",
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
    acroFieldName: "p2_field_13",
    genderRestriction: "all",
  },
  {
    id: "weight_kg",
    label: "Weight (in kgs)",
    type: "number",
    section: "Physical",
    prompt: "What is your weight in kilograms?",
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
    fieldId: "chest_pain_history",
    type: "yes_no",
    page: 1,
    yesX: 453,
    yesY: 523,
    noX: 495,
    noY: 523,
    reasonX: 519,
    reasonY: 516,
    reasonWidth: 38,
    reasonHeight: 24,
    reasonResponseId: "chest_pain_history_reason",
  },
  {
    fieldId: "hypertension",
    type: "yes_no",
    page: 1,
    yesX: 453,
    yesY: 541,
    noX: 495,
    noY: 541,
    reasonX: 519,
    reasonY: 535,
    reasonWidth: 38,
    reasonHeight: 15,
    reasonResponseId: "hypertension_reason",
  },
  {
    fieldId: "diabetes_thyroid",
    type: "yes_no",
    page: 1,
    yesX: 453,
    yesY: 557,
    noX: 495,
    noY: 557,
    reasonX: 519,
    reasonY: 551,
    reasonWidth: 38,
    reasonHeight: 15,
    reasonResponseId: "diabetes_thyroid_reason",
  },
  {
    fieldId: "respiratory",
    type: "yes_no",
    page: 1,
    yesX: 453,
    yesY: 574,
    noX: 495,
    noY: 574,
    reasonX: 519,
    reasonY: 568,
    reasonWidth: 38,
    reasonHeight: 15,
    reasonResponseId: "respiratory_reason",
  },
  {
    fieldId: "blood_disorder",
    type: "yes_no",
    page: 1,
    yesX: 453,
    yesY: 590,
    noX: 495,
    noY: 590,
    reasonX: 519,
    reasonY: 584,
    reasonWidth: 38,
    reasonHeight: 15,
    reasonResponseId: "blood_disorder_reason",
  },
  {
    fieldId: "liver_disorder",
    type: "yes_no",
    page: 1,
    yesX: 453,
    yesY: 607,
    noX: 495,
    noY: 607,
    reasonX: 519,
    reasonY: 601,
    reasonWidth: 38,
    reasonHeight: 15,
    reasonResponseId: "liver_disorder_reason",
  },
  {
    fieldId: "disability_congenital",
    type: "yes_no",
    page: 1,
    yesX: 453,
    yesY: 624,
    noX: 495,
    noY: 624,
    reasonX: 519,
    reasonY: 618,
    reasonWidth: 38,
    reasonHeight: 15,
    reasonResponseId: "disability_congenital_reason",
  },
  {
    fieldId: "cancer_tumour",
    type: "yes_no",
    page: 1,
    yesX: 453,
    yesY: 640,
    noX: 495,
    noY: 640,
    reasonX: 519,
    reasonY: 634,
    reasonWidth: 38,
    reasonHeight: 15,
    reasonResponseId: "cancer_tumour_reason",
  },
  {
    fieldId: "kidney_disease",
    type: "yes_no",
    page: 1,
    yesX: 453,
    yesY: 662,
    noX: 495,
    noY: 662,
    reasonX: 519,
    reasonY: 655,
    reasonWidth: 38,
    reasonHeight: 24,
    reasonResponseId: "kidney_disease_reason",
  },
  {
    fieldId: "epilepsy_nervous",
    type: "yes_no",
    page: 1,
    yesX: 453,
    yesY: 681,
    noX: 495,
    noY: 681,
    reasonX: 519,
    reasonY: 675,
    reasonWidth: 38,
    reasonHeight: 15,
    reasonResponseId: "epilepsy_nervous_reason",
  },
  {
    fieldId: "ent_disorder",
    type: "yes_no",
    page: 1,
    yesX: 453,
    yesY: 697,
    noX: 495,
    noY: 697,
    reasonX: 519,
    reasonY: 691,
    reasonWidth: 38,
    reasonHeight: 15,
    reasonResponseId: "ent_disorder_reason",
  },
  {
    fieldId: "musculoskeletal",
    type: "yes_no",
    page: 1,
    yesX: 453,
    yesY: 714,
    noX: 495,
    noY: 714,
    reasonX: 519,
    reasonY: 708,
    reasonWidth: 38,
    reasonHeight: 15,
    reasonResponseId: "musculoskeletal_reason",
  },
];

const KYC_UNCAPTURED_VALUE = "__KYC_NOT_CAPTURED__";
const KYC_UNCAPTURED_LABEL = "Not captured";

const isUncapturedKycValue = (value) =>
  String(value ?? "").trim() === KYC_UNCAPTURED_VALUE;
const hasMeaningfulKycValue = (value) => String(value ?? "").trim().length > 0;
const hasRecordedKycValue = (value) =>
  hasMeaningfulKycValue(value) || isUncapturedKycValue(value);

const padKycDatePart = (value) => String(value).padStart(2, "0");

const formatDateOfBirthForPdf = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const cleaned = normalizeIndicSpeechText(raw)
    .replace(/,/g, " ")
    .replace(/(\d+)(st|nd|rd|th)\b/g, "$1")
    .replace(/\b(date of birth|dob|born on|birth date|my birthday is)\b/g, " ")
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

const formatGenderForPdf = (value) => {
  const raw = String(value || "").trim();
  const normalizedValue = raw.toLowerCase().replace(/[^a-z]/g, "");

  if (
    [
      "m",
      "male",
      "man",
      "boy",
      "mail",
      "meal",
      "mael",
      "mela",
      "deal",
      "deel",
      "dill",
      "dale",
    ].includes(normalizedValue)
  )
    return "Male";
  if (
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

const formatNameForPdf = (value) => {
  const extractSpelledCompact = (input) => {
    const matches = String(input || "").match(/(?:\b[a-z]\b[\s-]*){4,}/gi);
    if (!matches?.length) return "";

    return (
      matches
        .map((part) => part.replace(/[^a-z]/gi, "").toLowerCase())
        .sort((a, b) => b.length - a.length)[0] || ""
    );
  };

  let cleaned = String(value ?? "")
    .replace(
      /^(my name is|name is|this is|i am|i'm|mera naam|mera naam hai|naam hai)\s+/i,
      "",
    )
    .replace(/[^\w\s'.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const spelledCompact = extractSpelledCompact(value);

  const nameFixes = {
    "sankop kira": "Sankalp Khira",
    "sankalp kira": "Sankalp Khira",
    "sankalp khira": "Sankalp Khira",
    "sankalp kheera": "Sankalp Khira",
    "sankalp kh eera": "Sankalp Khira",
    "sankal khira": "Sankalp Khira",
    "kira alpacaera": "Sankalp Khira",
    "alpacaera kira": "Sankalp Khira",
  };
  const spelledNameFixes = {
    sankalpkhira: "Sankalp Khira",
    sankalpakhira: "Sankalp Khira",
    sankalpkheera: "Sankalp Khira",
  };

  const lowerCleaned = cleaned.toLowerCase();
  for (const [wrong, right] of Object.entries(nameFixes)) {
    if (lowerCleaned.includes(wrong)) {
      cleaned = cleaned.replace(new RegExp(wrong, "gi"), right);
    }
  }

  if (spelledCompact && spelledNameFixes[spelledCompact]) {
    cleaned = spelledNameFixes[spelledCompact];
  }

  return cleaned
    .split(/\s+/)
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
  const tokens = raw.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean);
  const allDigits = tokens.every(
    t => digitWords[t] !== undefined || /^\d+$/.test(t)
  );
  if (allDigits && tokens.length >= 2) {
    return tokens.map(t => digitWords[t] ?? t).join('');
  }
  return raw;
}

  if (field?.id === "date_of_birth" || field?.type === "date") {
    return formatDateOfBirthForPdf(raw);
  }

  if (field?.id === "gender") {
    return formatGenderForPdf(raw);
  }

  if (
    field?.id === "contact_no" ||
    String(field?.label || "")
      .toLowerCase()
      .includes("contact")
  ) {
    return formatPhoneForPdf(raw);
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

const extractReasonFromAffirmativeAnswer = (text) => {
  const raw = String(text || "").trim();
  if (!raw) return "";

  const withoutYesPrefix = raw
    .replace(/^(yes|yeah|yep|haan|ha|ho|hoy|hoi|हो|होय)\b[\s,:-]*/i, "")
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
    !hasRecordedKycValue(responses[field.reasonResponseId]),
  );

const isCompleteKycDateFieldValue = (field, value) => {
  if (field?.type !== "date") return true;
  if (isUncapturedKycValue(value)) return true;
  return /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(String(value || "").trim());
};

const isKycFieldComplete = (field, responses = {}) => {
  if (shouldSkipFieldForGender(field, responses)) return true;
  if (!hasRecordedKycValue(responses[field.id])) return false;

  if (!isCompleteKycDateFieldValue(field, responses[field.id])) return false;

  if (!field?.requiresReasonOnYes) return true;
  if (responses[field.id] !== 'Yes') return true;
  return hasRecordedKycValue(responses[field.reasonResponseId]);
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

const getAgentClarificationMode = (text) => {
  const raw = String(text || "").trim();
  if (!raw) return null;

  const normalized = raw.toLowerCase();
  if (
    /\b(is that (correct|right)|did i (get|hear) that right|did i hear you correctly|is this correct|so that'?s .* correct)\b/i.test(
      normalized,
    ) ||
    /\bi heard .* is that correct\b/i.test(normalized)
  ) {
    return "confirm";
  }

  if (
    /\b(could you (repeat|say that again|spell|spell that|spell it out)|can you (repeat|say that again|spell)|please repeat|please spell|i (didn't|did not|couldn't|could not) catch|say that again|repeat that)\b/i.test(
      normalized,
    )
    ||
    /\b(complete the (date|year)|full date including|including (the )?day,? month,? and year|including day,? month,? and year)\b/i.test(
      normalized,
    )
  ) {
    return "clarify";
  }

  return null;
};

const isReasonFollowUpText = (text) => {
  const normalized = normalize(text);
  if (!normalized) return false;
  return /\b(reason|details|brief details|what happened|why|name of medicine|provide details|tell me the reason)\b/i.test(
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
  if (!isLikelyAgentQuestionText(text, getAgentClarificationMode(text)))
    return -1;

  const fallbackField = fields[fallbackIndex];
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

  return findReferencedFieldIndexFromAgentText(text, fields, fallbackIndex);
};

const getKycFieldDisplayValue = (field, responses = {}) => {
  if (shouldSkipFieldForGender(field, responses)) return "Skipped";
  const value = responses[field.id];
  if (isUncapturedKycValue(value)) return KYC_UNCAPTURED_LABEL;
  if (!hasMeaningfulKycValue(value)) return "";

  if (field?.requiresReasonOnYes && value === "Yes") {
    const reason = String(responses[field.reasonResponseId] || "").trim();
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
      !isCompleteKycDateFieldValue(field, updated[field.id])
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

const getActiveKycPromptLabel = (field, responses = {}) => {
  if (!field) return "";
  if (isKycFieldAwaitingReason(field, responses)) {
    return field.reasonPromptLabel || "If yes, please tell me the reason";
  }
  return field.prompt || field.label;
};

const extractTranscriptText = (payload) => {
  if (!payload) return "";
  if (typeof payload === "string") return payload.trim();

  const directCandidates = [
    payload.text,
    payload.transcript,
    payload.message,
    payload.body,
    payload.content,
    payload.data?.text,
    payload.data?.transcript,
    payload.data?.message,
    payload.data?.body,
    payload.data?.content,
    payload.payload?.text,
    payload.payload?.transcript,
    payload.payload?.message,
    payload.payload?.content,
  ];

  for (const candidate of directCandidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  const collectionCandidates = [
    payload.content,
    payload.parts,
    payload.data?.content,
    payload.data?.parts,
    payload.payload?.content,
    payload.payload?.parts,
  ];

  for (const collection of collectionCandidates) {
    if (!Array.isArray(collection)) continue;
    const joined = collection
      .map((item) => extractTranscriptText(item))
      .filter(Boolean)
      .join(" ")
      .trim();
    if (joined) return joined;
  }

  return "";
};

const extractTranscriptRole = (payload) => {
  const roleTokens = [
    payload?.role,
    payload?.sender,
    payload?.speaker,
    payload?.author_type,
    payload?.participant_type,
    payload?.source,
    payload?.origin,
    payload?.participant_role,
    payload?.participant?.role,
    payload?.author?.role,
    payload?.data?.role,
    payload?.data?.sender,
    payload?.data?.speaker,
    payload?.data?.author_type,
    payload?.data?.participant_type,
    payload?.data?.source,
    payload?.data?.origin,
    payload?.type,
    payload?.event_type,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const identityTokens = [
    payload?.identity,
    payload?.participant?.identity,
    payload?.author?.name,
    payload?.name,
    payload?.author?.type,
    payload?.data?.identity,
    payload?.data?.name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const combined = `${roleTokens} ${identityTokens}`;
  if (
    /(assistant|agent|avatar|doctor|bot|ai|nurse|carely|christiana)/.test(
      combined,
    )
  )
    return "assistant";
  if (
    /(user|patient|human|local|caller|client|member|customer|guest|visitor|end_user)/.test(
      combined,
    )
  )
    return "user";
  return null;
};

const extractCallMessages = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.messages)) return payload.messages;
  if (Array.isArray(payload?.data?.messages)) return payload.data.messages;
  if (Array.isArray(payload?.call?.messages)) return payload.call.messages;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
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
  if (/[ऀ-ॿ]/.test(t)) return "hi";
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
      field.setText(value);
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

const setTextAcroFieldValue = (field, value = "") => {
  if (!field || typeof field.setText !== "function") return false;

  try {
    field.setText(String(value));
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

const fillNamedKycAcroFields = (form, pages, fields, responses) => {
  const fieldsByName = new Map(
    form.getFields().map((field) => [field.getName?.() || "", field]),
  );
  const matchedFieldIds = new Set();
  let filledCount = 0;

  fields.forEach((field) => {
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
      const reasonValue =
        isYes && field.reasonResponseId
          ? getKycPdfFillValue(
              { type: "text" },
              responses[field.reasonResponseId],
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
      setTextAcroFieldValue(reasonField, reasonValue);

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
- Analyze nurse–patient call transcripts
- Compare nurse statements with discharge instructions
- Identify:
  • Unsafe medical advice
  • Statements outside nursing scope
  • Contradictions to discharge instructions
  • Dismissive or misleading language
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

const CarelyAIAssistant = () => {
  const [preferredLanguage, setPreferredLanguage] = useState("en");

  const [activeTab, setActiveTab] = useState("call-logs");

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
  const [panCaptureComplete, setPanCaptureComplete] = useState(false);
  const [panOcrData, setPanOcrData] = useState(null);
  const [isRecordingCall, setIsRecordingCall] = useState(false);
  const [callRecordingBlob, setCallRecordingBlob] = useState(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [callTranscription, setCallTranscription] = useState("");

  const currentAudioRef = useRef(null);
  const currentAudioUrlRef = useRef(null);
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
  const transcriptHandlerRefs = useRef({ onUser: null, onAgent: null });
  const processedTranscriptKeysRef = useRef(new Set());
  const recentTranscriptFingerprintsRef = useRef(new Map());
  const beyondPresenceRoomRef = useRef(null);
  const userVideoRef = useRef(null);
  const userCameraStreamRef = useRef(null);
  const callRecorderRef = useRef(null);
  const callAudioChunksRef = useRef([]);
  const callRecordingAudioContextRef = useRef(null);
  const callRecordingSourcesRef = useRef([]);

  const stopUserCamera = () => {
    if (userCameraStreamRef.current) {
      userCameraStreamRef.current.getTracks().forEach((track) => track.stop());
      userCameraStreamRef.current = null;
    }

    if (userVideoRef.current) {
      userVideoRef.current.srcObject = null;
    }
  };

  const startUserCamera = async () => {
    if (
      !cameraEnabled ||
      !isAvatarConnected ||
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      return;
    }

    try {
      if (!userCameraStreamRef.current) {
        userCameraStreamRef.current = await navigator.mediaDevices.getUserMedia(
          {
            video: {
              facingMode: "user",
              width: { ideal: 720 },
              height: { ideal: 960 },
            },
            audio: false,
          },
        );
      }

      if (userVideoRef.current) {
        userVideoRef.current.srcObject = userCameraStreamRef.current;
      }
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

  const toggleMute = () => {
    setIsMuted((prev) => !prev);
  };

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

    callRecordingSourcesRef.current.forEach((source) => {
      try {
        source.disconnect();
      } catch {
        // noop
      }
    });
    callRecordingSourcesRef.current = [];
    callAudioChunksRef.current = [];

    if (callRecordingAudioContextRef.current) {
      callRecordingAudioContextRef.current.close().catch(() => {});
      callRecordingAudioContextRef.current = null;
    }
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
      callRecordingSourcesRef.current = [];

      const connectAudioTracks = (tracks = []) => {
        tracks.forEach((track) => {
          if (!track) return;
          const source = audioCtx.createMediaStreamSource(
            new MediaStream([track]),
          );
          source.connect(dest);
          callRecordingSourcesRef.current.push(source);
        });
      };

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
          const mediaTrack = pub.track?.mediaStreamTrack;
          if (mediaTrack) {
            connectAudioTracks([mediaTrack]);
          }
        }
      }

      if (audioCtx.state === "suspended") {
        audioCtx.resume().catch(() => {});
      }

      callAudioChunksRef.current = [];
      setCallRecordingBlob(null);
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
      recorder.start(1000);
      callRecorderRef.current = recorder;
      setIsRecordingCall(true);
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
      }
      releaseCallRecordingResources();
      return;
    }

    recorder.onstop = () => {
      const blob = new Blob(callAudioChunksRef.current, { type: "audio/webm" });
      if (!discard && blob.size > 0) {
        setCallRecordingBlob(blob);
      } else if (discard) {
        setCallRecordingBlob(null);
      }
      callAudioChunksRef.current = [];
      setIsRecordingCall(false);
      callRecorderRef.current = null;
      releaseCallRecordingResources();
      console.log("[Recording] Stopped, blob size:", blob.size);
    };
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

  const initBeyondPresence = async () => {
    if (
      beyondPresenceSession ||
      isConnectingAvatar ||
      !kycFields.length ||
      !panCaptureComplete ||
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
        kycCompleteRef.current = true;
        setKycComplete(true);
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
            prompt: field.prompt,
            followUpIfYes: field.followUpIfYes || null,
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
  const nextIndex = findNextPendingKycFieldIndex(kycFields, responses, fromIndex);
  if (nextIndex < kycFields.length) {
    kycCurrentFieldIndexRef.current = nextIndex;
    setKycCurrentFieldIndex(nextIndex);
    lastAnswerTimestampRef.current = 0; // ← ADD THIS
    return nextIndex;
  }
  kycCompleteRef.current = true;
  setKycComplete(true);
  return -1;
};

  const handleUserTranscription = async (text, options = {}) => {
    const cleanText = stripClarificationPrefix(String(text || '').trim());
    if (!cleanText) return;
    const now = Date.now();
    if (kycTurnLockRef.current || kycCompleteRef.current) return;
    const activeIndex = kycCurrentFieldIndexRef.current;
    if (activeIndex >= kycFields.length) return;

    const currentResponses = kycResponsesRef.current;
    const pendingClarification = pendingClarificationTargetRef.current;
    const recentAskedField =
      lastAgentAskedFieldRef.current &&
      now - lastAgentAskedFieldRef.current.timestamp < 30000
        ? lastAgentAskedFieldRef.current
        : null;
    const safeRecentAskedField =
      recentAskedField &&
      Number.isInteger(recentAskedField.index) &&
      recentAskedField.index >= activeIndex &&
      kycFields[recentAskedField.index] &&
      !isKycFieldComplete(kycFields[recentAskedField.index], currentResponses)
        ? recentAskedField
        : null;
    const hasFreshClarification =
      pendingClarification && now - pendingClarification.timestamp < 15000;
    let targetFieldIndex = hasFreshClarification
      ? pendingClarification.index
      : safeRecentAskedField?.index ?? activeIndex;
    if (
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
    const answerMode =
      (hasFreshClarification ? pendingClarification.mode : null) ||
      (safeRecentAskedField?.index != null && safeRecentAskedField.index !== activeIndex ? 'followup' : 'answer');

    const eventKey = getTranscriptMessageKey('user', cleanText, options?.eventKey);
    const fingerprint = getTranscriptFingerprint(
      'user',
      cleanText,
      targetFieldIndex,
      answerMode
    );
    if (!registerProcessedTranscript({ rawKey: eventKey, fingerprint, windowMs: 12000 })) return;

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
    setKycTranscriptPreview(`"${cleanText}"`);
    setKycChatMessages((prev) => [
      ...prev,
      { role: 'user', content: cleanText, isVoice: true },
    ]);

    if (pendingClarification && now - pendingClarification.timestamp < 15000) {
      const targetField = kycFields[targetFieldIndex];

      if (targetField) {
        const confirmation = parseYesNoAnswer(cleanText);
        if (pendingClarification.mode === 'confirm' && confirmation === 'Yes') {
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
          const normalizedCorrection = await normalizeKycAnswerForPdf(cleanText, targetField, preferredLanguage);
          let correctedAnswer = normalizedCorrection.canonicalYesNo || normalizedCorrection.englishText || cleanText;

          if (isYesNoField(targetField)) {
            const parsed =
              normalizedCorrection.canonicalYesNo ||
              parseYesNoAnswer(correctedAnswer) ||
              inferImplicitYesNoAnswer(targetField, cleanText);
            if (!parsed) return;
            correctedAnswer = parsed;
          }

          const formattedCorrection = formatKycAnswerForPdf(targetField, correctedAnswer);
          const correctedResponses = {
            ...currentResponses,
            [targetField.id]: formattedCorrection,
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

          if (!isCompleteKycDateFieldValue(targetField, formattedCorrection)) {
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

          const correctionNeedsReason =
            targetField.requiresReasonOnYes &&
            correctedResponses[targetField.id] === 'Yes' &&
            !hasMeaningfulKycValue(correctedResponses[targetField.reasonResponseId]);

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

    if (now - lastAnswerTimestampRef.current < ANSWER_COOLDOWN_MS) {
      console.log('Cooldown active, skipping:', cleanText);
      return;
    }

    const currentField = kycFields[targetFieldIndex];
    if (!currentField) return;

    if (isLikelyFiller(cleanText, currentField)) {
      console.log('Filler detected, ignoring:', cleanText);
      return;
    }

    kycTurnLockRef.current = true;
    try {
      const awaitingReason = isKycFieldAwaitingReason(currentField, currentResponses);

      if (awaitingReason) {
        const reasonNormalized = await normalizeKycAnswerForPdf(
          cleanText,
          { ...currentField, type: 'text', label: currentField.reasonPromptLabel || currentField.label },
          preferredLanguage
        );
        const normalizedReason = reasonNormalized.englishText || cleanText;
        if (!hasMeaningfulKycValue(normalizedReason)) return;

        const nextResponses = {
          ...currentResponses,
          [currentField.reasonResponseId]: normalizedReason,
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
        advanceKycToNextPendingField(nextResponses, targetFieldIndex + 1);
        return;
      }

      const normalized = await normalizeKycAnswerForPdf(cleanText, currentField, preferredLanguage);
      let normalizedAnswer = normalized.canonicalYesNo || normalized.englishText || cleanText;

      if (isYesNoField(currentField)) {
        const parsed =
          normalized.canonicalYesNo ||
          parseYesNoAnswer(normalizedAnswer) ||
          inferImplicitYesNoAnswer(currentField, cleanText);
        if (!parsed) {
          return;
        }
        normalizedAnswer = parsed;
      }

      const formattedAnswer = formatKycAnswerForPdf(currentField, normalizedAnswer);
      const inlineReason =
        currentField.requiresReasonOnYes && formattedAnswer === 'Yes'
          ? extractReasonFromAffirmativeAnswer(cleanText)
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

      if (!isCompleteKycDateFieldValue(currentField, formattedAnswer)) {
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

      if (currentField.requiresReasonOnYes && formattedAnswer === 'Yes' && !hasMeaningfulKycValue(inlineReason)) {
        return;
      }

      advanceKycToNextPendingField(nextResponses, targetFieldIndex + 1);
    } catch (err) {
      console.error('Answer processing error:', err);
    } finally {
      kycTurnLockRef.current = false;
    }
  };

  const handleAgentTranscription = (text, options = {}) => {
    const cleanText = String(text || "").trim();
    if (!cleanText) return;
    const now = Date.now();
    const clarificationMode = getAgentClarificationMode(cleanText);
    const lastCommitted = lastCommittedFieldRef.current;
    const activeIndex = kycCurrentFieldIndexRef.current;
    const activeField = kycFieldsRef.current[activeIndex];
    let matchedFieldIndex = -1;

    if (!kycCompleteRef.current && kycFields.length > 0) {
      matchedFieldIndex = resolveAgentAskedFieldIndex(
        cleanText,
        kycFields,
        kycResponsesRef.current,
        activeIndex,
        lastCommitted,
      );

      if (
        matchedFieldIndex === -1 &&
        activeField &&
        isKycFieldAwaitingReason(activeField, kycResponsesRef.current) &&
        isReasonFollowUpText(cleanText)
      ) {
        matchedFieldIndex = activeIndex;
      }
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

    const clarificationTargetIndex =
      matchedFieldIndex >= 0 ? matchedFieldIndex : lastCommitted?.index;
    const clarificationTargetField =
      clarificationTargetIndex != null ? kycFields[clarificationTargetIndex] : null;

    if (
      clarificationMode &&
      clarificationTargetField &&
      (
        matchedFieldIndex >= 0 ||
        (lastCommitted && Date.now() - lastCommitted.timestamp < 20000)
      )
    ) {
      pendingClarificationTargetRef.current = {
        index: clarificationTargetIndex,
        fieldId: clarificationTargetField.id,
        mode: clarificationMode,
        timestamp: now,
      };
      lastAgentAskedFieldRef.current = {
        index: clarificationTargetIndex,
        timestamp: now,
        text: cleanText,
      };
    } else {
      pendingClarificationTargetRef.current = null;
    }

  if (!kycCompleteRef.current && kycFields.length > 0) {
  if (matchedFieldIndex >= 0 && matchedFieldIndex !== kycCurrentFieldIndexRef.current) {
    const wouldGoBackwards = matchedFieldIndex < kycCurrentFieldIndexRef.current;
    const targetAlreadyComplete = isKycFieldComplete(
      kycFields[matchedFieldIndex],
      kycResponsesRef.current
    );
    if (!wouldGoBackwards || !targetAlreadyComplete) {
      kycCurrentFieldIndexRef.current = matchedFieldIndex;
      setKycCurrentFieldIndex(matchedFieldIndex);
    }
  }

  if (matchedFieldIndex >= 0) {
    lastAgentAskedFieldRef.current = {
      index: matchedFieldIndex,
      timestamp: now,
      text: cleanText,
    };
  }
}

    console.log("Agent said:", cleanText);
    setKycChatMessages((prev) => [
      ...prev,
      { role: "assistant", content: cleanText },
    ]);

    if (isKycCompletionAnnouncement(cleanText)) {
      window.setTimeout(() => {
        finalizeKycSession({
          reason: "completion_announcement",
          announce: false,
        });
      }, 1200);
    }
  };

  useEffect(() => {
    if (
      !kycFile ||
      !kycFields.length ||
      kycComplete ||
      isExtractingFields ||
      !panCaptureComplete ||
      avatarConnectionBlockedMessage
    )
      return;
    if (beyondPresenceSession || isConnectingAvatar) return;
    initBeyondPresence();
  }, [
    avatarConnectionBlockedMessage,
    isConnectingAvatar,
    isExtractingFields,
    kycComplete,
    kycFields,
    kycFile,
    beyondPresenceSession,
    panCaptureComplete,
  ]);

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
    const agentId = beyondPresenceSession?.agentId;
    const sessionMode = beyondPresenceSession?.mode;
    if (!agentId || sessionMode !== "iframe_embed") return undefined;

    let cancelled = false;

    const pollMessages = async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/beyondpresence/agent-call-messages/${agentId}`,
        );
        const data = await res.json();
        if (cancelled) return;
         if (kycCompleteRef.current) return;
        if (!res.ok || data?.error) {
          console.error(
            "Beyond Presence message poll failed:",
            data?.error || res.statusText,
          );
          return;
        }

        const call = data?.call || null;
        const callId = data?.callId || null;
        const isCallActive = Boolean(callId) && !call?.ended_at;
        setIsAvatarConnected(isCallActive);

        if (!isCallActive) {
          setKycListening(false);
          setKycSpeaking(false);
        }

        const messages = extractCallMessages(data)
          .slice()
          .sort((a, b) => {
            const aTime = new Date(
              a?.sent_at ||
                a?.created_at ||
                a?.timestamp ||
                a?.data?.sent_at ||
                a?.data?.created_at ||
                0,
            ).getTime();
            const bTime = new Date(
              b?.sent_at ||
                b?.created_at ||
                b?.timestamp ||
                b?.data?.sent_at ||
                b?.data?.created_at ||
                0,
            ).getTime();
            return aTime - bTime;
          });
const processedKeys = processedTranscriptKeysRef.current;


for (const message of messages) {
  const text = extractTranscriptText(message);
  if (!text) continue;

  const extractedRole = extractTranscriptRole(message);
  const sender =
    extractedRole ||
    (isLikelyAgentQuestionText(text, getAgentClarificationMode(text))
      ? "assistant"
      : "user");
  const eventKey = String(
    message?.id ||
      `${callId || agentId}_${sender}_${message?.sent_at || message?.created_at || message?.timestamp || ""}_${text}`,
  );

  if (processedKeys.has(eventKey)) continue;
  processedKeys.add(eventKey);

  if (sender === "assistant") {
    transcriptHandlerRefs.current.onAgent?.(text, {
      source: "beyondpresence_poll",
      eventKey,
    });
    continue;
  }

  transcriptHandlerRefs.current.onUser?.(text, {
    source: "beyondpresence_poll",
    eventKey,
  });
}
if (!isCallActive && !kycCompleteRef.current && messages.length > 0) {
  finalizeKycSession({ reason: "iframe_call_ended", announce: true });
}
      } catch (err) {
        if (!cancelled) {
          console.error("Beyond Presence poll failed:", err);
        }
      }
    };

    pollMessages();
    const timerId = window.setInterval(pollMessages, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(timerId);
      setIsAvatarConnected(false);
      setKycListening(false);
      setKycSpeaking(false);
    };
  }, [
    API_BASE,
    beyondPresenceSession?.agentId,
    beyondPresenceSession?.mode,
  ]);

  useEffect(() => {
    if (beyondPresenceSession?.mode === "iframe_embed") {
      stopUserCamera();
      return undefined;
    }

    if (isAvatarConnected && cameraEnabled) {
      startUserCamera();
      return undefined;
    }

    stopUserCamera();
    return undefined;
  }, [beyondPresenceSession?.mode, cameraEnabled, isAvatarConnected]);

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
  }, [kycChatMessages]);

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

  const localizeKycText = async (text, languageCode = preferredLanguage) => {
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
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "KYC localization failed");
      }

      return data.text || trimmed;
    } catch (err) {
      console.error("KYC localization fallback:", err);
      return trimmed;
    }
  };

  const normalizeKycAnswerForPdf = async (
    text,
    field,
    languageCode = preferredLanguage,
  ) => {
    const trimmed = String(text || "").trim();
    if (!field) {
    console.error("normalizeKycAnswerForPdf: field is undefined, skipping");
    return { englishText: trimmed, canonicalYesNo: null };
  }

    if (!trimmed) {
      return { englishText: "", canonicalYesNo: null };
    }

    const localStructured = normalizeStructuredKycAnswerLocally(field, trimmed);
    if (
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
          content: `📁 Uploaded: ${file.name}`,
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
        { role: "user", content: "🎤 Voice message sent...", isVoice: true },
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
              "🚨 Nurse has been alerted. A human will contact the patient shortly.",
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
          content: `🎤 "${data.transcription || "Voice message"}"`,
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
  // 3. DOWNLOAD COMPLETED KYC — Creates AcroForm fields on PDF
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
    const activeFields = kycFieldsRef.current.length
      ? kycFieldsRef.current
      : kycFields;
    const activeResponses = Object.keys(kycResponsesRef.current).length
      ? kycResponsesRef.current
      : kycResponses;
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
        console.warn("Existing AcroForm fill failed:", acroErr);
      }

      // Fallback-fill only those fields not matched to existing AcroForm inputs.
      for (const mapping of activeMappings) {
        if (acroFillResult.matchedFieldIds.has(mapping.fieldId)) continue;
         const answer = activeResponses[mapping.fieldId];
        if (!answer && answer !== false) continue;
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
            // ---- CREATE TEXT FIELD ----
            if (!pdfAnswer) continue;
            const fieldName = uniqueFieldName(`field_${scaled.fieldId}`);
            const textField = form.createTextField(fieldName);

            const x = scaled.inputX || 0;
            // Convert from top-left origin (AI output) to bottom-left origin (pdf-lib)
            const y = pageHeight - (scaled.inputY || 0) - (scaled.height || 14);
            const width = scaled.width || 200;
            const height = scaled.height || 14;
            const fontSize = scaled.fontSize || 9;

            textField.addToPage(page, {
              x: x,
              y: y,
              width: width,
              height: height,
              font: helvetica,
              borderWidth: 0,
              backgroundColor: rgb(1, 1, 1),
            });

            textField.setText(String(pdfAnswer));
            textField.setFontSize(fontSize);

            // Make it appear non-editable (visual only)
            textField.defaultUpdateAppearances(helvetica);
          } else if (scaled.type === "yes_no") {
            // ---- CREATE YES/NO CHECKBOXES ----
            if (!pdfAnswer) continue;
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

            const reasonValue =
              isYes && scaled.reasonResponseId
                ? getKycPdfFillValue(
                    { id: scaled.reasonResponseId, type: "text" },
                    activeResponses[scaled.reasonResponseId],
                  )
                : "";
            if (
              reasonValue &&
              scaled.reasonX != null &&
              scaled.reasonY != null
            ) {
              const reasonField = form.createTextField(
                uniqueFieldName(`field_${scaled.fieldId}_reason`),
              );
              reasonField.addToPage(page, {
                x: scaled.reasonX,
                y:
                  pageHeight -
                  scaled.reasonY -
                  (scaled.reasonHeight || 14),
                width: scaled.reasonWidth || 40,
                height: scaled.reasonHeight || 14,
                font: helvetica,
                borderWidth: 0,
                backgroundColor: rgb(1, 1, 1),
              });
              reasonField.setText(String(reasonValue));
              reasonField.setFontSize(scaled.fontSize || 8);
              reasonField.defaultUpdateAppearances(helvetica);
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

      // Flatten the form — bakes values into the PDF permanently
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

  const downloadKycTranscript = () => {
    const transcriptLines = kycChatMessages
      .filter((msg) => !msg?.isHidden && !msg?.isSystem)
      .map((msg) => {
        const role =
          msg.role === "user"
            ? "client"
            : msg.role === "assistant"
              ? "Agent"
              : "System";
        return `${role}: ${String(msg.content || "").trim()}`;
      })
      .filter((line) => line.trim().length > 0);

    if (!transcriptLines.length) return;

    const content = transcriptLines.join("\n\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
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
    kycCompleteRef.current = true;
    setKycComplete(true);

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
    setPanCaptureComplete(false);
    setPanOcrData(null);
    setIsRecordingCall(false);
    setCallRecordingBlob(null);
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
    kycCurrentFieldIndexRef.current = 0;
    kycCompleteRef.current = false;
    kycTurnLockRef.current = false;
    processedTranscriptKeysRef.current.clear();
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
    setPanCaptureComplete(true);
    kycCompleteRef.current = true;
    setKycComplete(true);
    finalizeKycSession({ reason: "manual_end", announce: true });
  };

  const restartPresetKycDocument = () => {
    resetKyc();
    loadPresetKycDocument().catch((err) => {
      console.error("Failed to reload preset KYC document:", err);
    });
  };

  const isManagedIframeMode = beyondPresenceSession?.mode === "iframe_embed";

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
      const awaitingReason = isKycFieldAwaitingReason(
        currentField,
        currentResponses,
      );

      if (awaitingReason) {
        const reasonNormalized = await normalizeKycAnswerForPdf(
          cleanUserMessage,
          {
            ...currentField,
            type: "text",
            label: currentField.reasonPromptLabel || currentField.label,
          },
          preferredLanguage,
        );
        const normalizedReason =
          reasonNormalized.englishText || cleanUserMessage;
        if (!hasMeaningfulKycValue(normalizedReason)) return;

        const nextResponses = {
          ...currentResponses,
          [currentField.reasonResponseId]: normalizedReason,
        };
       kycResponsesRef.current = nextResponses;
setKycResponses(nextResponses);
recentTranscriptFingerprintsRef.current.set(`answer:${normalize(cleanText).slice(0, 120)}`, Date.now());
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
          kycCompleteRef.current = true;
          setKycComplete(true);
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
recentTranscriptFingerprintsRef.current.set(`answer:${normalize(cleanText).slice(0, 120)}`, Date.now());

      if (
        currentField.requiresReasonOnYes &&
        formattedAnswer === "Yes" &&
        !hasMeaningfulKycValue(inlineReason)
      ) {
        const followUpEnglish =
          currentField.followUpIfYes || "If yes, please tell me the reason.";
        const followUpText = await localizeKycText(
          followUpEnglish,
          preferredLanguage,
        );
        setKycChatMessages((prev) => [
          ...prev,
          { role: "assistant", content: followUpText },
        ]);
        return;
      }

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
        kycCompleteRef.current = true;
        setKycComplete(true);
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
const activeResponses = Object.keys(kycResponsesRef.current).length ? kycResponsesRef.current : kycResponses;
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
        if (acroFillResult.matchedFieldIds.has(mapping.fieldId)) continue;
        const answer = activeResponses[mapping.fieldId];
        if (!answer && answer !== false) continue;
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
            const textField = form.createTextField(scaled.fieldId);
            textField.addToPage(page, {
              x: scaled.inputX || 0,
              y: pageHeight - (scaled.inputY || 0) - (scaled.height || 14),
              width: scaled.width || 200,
              height: scaled.height || 14,
              font: helvetica,
              borderColor: rgb(0.8, 0.8, 0.8),
              borderWidth: 0.5,
            });
            textField.setText(String(pdfAnswer));
            textField.setFontSize(scaled.fontSize || 9);
            textField.defaultUpdateAppearances(helvetica);
          } else if (scaled.type === "yes_no") {
            if (!pdfAnswer) continue;
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

            const reasonValue =
              isYes && scaled.reasonResponseId
                ? getKycPdfFillValue(
                    { id: scaled.reasonResponseId, type: "text" },
                    activeResponses[scaled.reasonResponseId],
                  )
                : "";
            if (
              reasonValue &&
              scaled.reasonX != null &&
              scaled.reasonY != null
            ) {
              const reasonField = form.createTextField(
                uniqueFieldName(`field_${scaled.fieldId}_reason`),
              );
              reasonField.addToPage(page, {
                x: scaled.reasonX,
                y:
                  pageHeight -
                  scaled.reasonY -
                  (scaled.reasonHeight || 14),
                width: scaled.reasonWidth || 40,
                height: scaled.reasonHeight || 14,
                font: helvetica,
                borderWidth: 0,
              });
              reasonField.setText(String(reasonValue));
              reasonField.setFontSize(scaled.fontSize || 8);
              reasonField.defaultUpdateAppearances(helvetica);
            }
          }
          // ... same pattern for gender_checkbox, marital_checkbox
        } catch (e) {
          console.warn(`Editable field ${mapping.fieldId} failed:`, e);
        }
      }

      // NO flatten — keep fields editable
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
    <div style={styles.container}>
      {/* Sidebar */}
      <aside style={styles.sidebar}>
        <div style={styles.logoContainer}>
          <div style={styles.logoIcon}>
            <img
              src={CarelyLogoIcon}
              alt="Carely"
              style={{ width: "36px", height: "36px", objectFit: "contain" }}
            />
          </div>
        </div>
        <nav style={styles.nav}>
          <button
            style={{
              ...styles.navButton,
              ...(activeTab === "call-logs" ? styles.navButtonActive : {}),
            }}
            onClick={() => setActiveTab("call-logs")}
            title="Call Analysis"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
          </button>
          <button
            style={{
              ...styles.navButton,
              ...(activeTab === "discharge" ? styles.navButtonActive : {}),
            }}
            onClick={() => setActiveTab("discharge")}
            title="Care Questions"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </button>
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
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </button>
          <button
            style={{
              ...styles.navButton,
              ...(activeTab === "careplan" ? styles.navButtonActive : {}),
            }}
            onClick={() => setActiveTab("careplan")}
            title="Care Plan"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          </button>
        </nav>
      </aside>

      {/* Main */}
      <main style={styles.main}>
        <header style={styles.header}>
          <div style={styles.headerLeft}>
            <img
              src={CarelyLogoFull}
              alt="Carely"
              style={{ height: "36px", objectFit: "contain" }}
            />
            <span style={styles.headerBadge}>AI Assistant</span>
          </div>
          <div style={styles.headerRight}>
            <span style={styles.welcomeText}>
              Healthcare Intelligence Platform
            </span>
          </div>
        </header>
        <div style={styles.content}>
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
                          ✕
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
                            ✕
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
                                  {msg.role === "user" ? "👤" : "🤖"}
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
                        <div style={styles.messageAvatar}>🤖</div>
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
                        ✕
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
                                  {msg.role === "user" ? "👤" : "🤖"}
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
                        <div style={styles.messageAvatar}>🤖</div>
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
            <div style={ft.layout}>
              <div style={ft.side}>
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
                              {done ? "✓" : idx + 1}
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

                {getCompletedKycFieldCount(kycFields, kycResponses) >=
                  kycFields.length && (
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
                    {kycChatMessages.length > 0 && (
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
                    )}
                    {!isManagedIframeMode &&
                      callRecordingBlob &&
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
                    {!isManagedIframeMode && callTranscription && (
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
                      The FMR form loads automatically. Dr. Christiana will
                      guide you through the full medical examination report.
                    </p>
                  </div>
                )}
              </div>

              <div style={ft.call}>
                <div style={ft.topBar}>
                  <div style={ft.topL}>
                    {isAvatarConnected && <div style={ft.live} />}
                    <span style={ft.docName}>Dr. Christiana</span>
                    <span style={ft.docSub}>Carely Health</span>
                  </div>
                  <div style={ft.topR}>
                    {getCompletedKycFieldCount(kycFields, kycResponses) >=
                      kycFields.length && (
                      <>
                        <button style={ft.actionBtn} onClick={downloadCompletedKyc}>
                          Download Filled PDF
                        </button>
                        {kycChatMessages.length > 0 && (
                          <button
                            style={{
                              ...ft.actionBtn,
                              background: "linear-gradient(135deg,#0ea5e9,#0284c7)",
                            }}
                            onClick={downloadKycTranscript}
                          >
                            Download Transcript
                          </button>
                        )}
                        <button
                          style={{
                            ...ft.actionBtn,
                            background: "rgba(255,255,255,0.08)",
                          }}
                          onClick={restartPresetKycDocument}
                        >
                          New Session
                        </button>
                      </>
                    )}
                    {!isManagedIframeMode && isRecordingCall && (
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: 11,
                          color: "#ef4444",
                          fontWeight: 600,
                        }}
                      >
                        <div
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: "#ef4444",
                            animation: "fadeInOut 1s ease-in-out infinite",
                          }}
                        />
                        REC
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
                      style={{
                        ...ft.langSel,
                        ...(beyondPresenceSession || isConnectingAvatar
                          ? ft.langSelDisabled
                          : {}),
                      }}
                    >
                      {KYC_LANGUAGE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {isAvatarConnected &&
                      getCompletedKycFieldCount(kycFields, kycResponses) <
                        kycFields.length && (
                        <span style={ft.badge}>
                          Q
                          {Math.min(kycCurrentFieldIndex + 1, kycFields.length)}
                          /{kycFields.length}
                        </span>
                      )}
                    {getCompletedKycFieldCount(kycFields, kycResponses) >=
                      kycFields.length && (
                      <span
                        style={{
                          ...ft.badge,
                          background: "rgba(52,211,153,0.15)",
                          color: "#34d399",
                        }}
                      >
                        Complete
                      </span>
                    )}
                  </div>
                </div>

                <div style={ft.vidArea}>
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
                  ) : !panCaptureComplete ? (
                    <PanCardCapture
                      apiBase={API_BASE}
                      onComplete={(ocrData) => {
                        setPanCaptureComplete(true);
                        if (ocrData) prefillFromPanOcr(ocrData);
                      }}
                      onSkip={() => setPanCaptureComplete(true)}
                    />
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
                  ) : isManagedIframeMode ? (
                    <div style={ft.embedShell}>
                      <iframe
                        title="Dr. Christiana"
                        src={beyondPresenceSession.agentUrl}
                        allow="camera; microphone; autoplay; fullscreen"
                        allowFullScreen
                        style={ft.embedFrame}
                      />
                    </div>
                  ) : beyondPresenceSession ? (
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
                      }}
                      onRoomRef={(room) => {
                        beyondPresenceRoomRef.current = room;
                      }}
                      onSpeakingChange={(isSpeaking) => {
                        setKycSpeaking(isSpeaking);
                      }}
                      onListeningChange={(isListening) => {
                        setKycListening(isListening);
                      }}
                      isMuted={isMuted}
                    />
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
                        Connect with Dr. Christiana for your FMR verification
                      </p>
                    </div>
                  )}
                </div>

                <div style={ft.liveTranscript}>
                  <div style={ft.transcriptHead}>
                    <span>Live Transcript</span>
                    {kycTranscriptPreview && (
                      <span style={ft.transcriptListening}>
                        client: {kycTranscriptPreview.replace(/^"|"$/g, "")}
                      </span>
                    )}
                  </div>
                  <div style={ft.transcriptBody}>
                    {kycChatMessages.filter((msg) => !msg?.isHidden && !msg?.isSystem).length ? (
                      kycChatMessages
                        .filter((msg) => !msg?.isHidden && !msg?.isSystem)
                        .map((msg, index) => (
                          <div
                            key={`${msg.role}-${index}-${String(msg.content || "").slice(0, 24)}`}
                            style={ft.transcriptLine}
                          >
                            <span
                              style={{
                                ...ft.transcriptRole,
                                color:
                                  msg.role === "user" ? "#38bdf8" : "#34d399",
                              }}
                            >
                              {msg.role === "user" ? "client:" : "Agent:"}
                            </span>
                            <span style={ft.transcriptText}>
                              {String(msg.content || "").trim()}
                            </span>
                          </div>
                        ))
                    ) : (
                      <div style={ft.transcriptEmpty}>
                        The live conversation will appear here.
                      </div>
                    )}
                    <div ref={kycChatEndRef} />
                  </div>
                </div>

                {isAvatarConnected && !isManagedIframeMode && (
                  <div
                    style={{ ...ft.pip, ...(!cameraEnabled ? ft.pipOff : {}) }}
                  >
                    {cameraEnabled ? (
                      <video
                        ref={userVideoRef}
                        autoPlay
                        playsInline
                        muted
                        style={ft.pipVid}
                      />
                    ) : (
                      <div style={ft.pipPlaceholder}>
                        <svg
                          width="28"
                          height="28"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#64748b"
                          strokeWidth="1.8"
                        >
                          <path d="M1 1l22 22" />
                          <path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3m3-3h6l2 3h4a2 2 0 0 1 2 2v9.34" />
                          <path d="M14.12 14.12A3 3 0 1 1 9.88 9.88" />
                        </svg>
                        <span
                          style={{
                            fontSize: 9,
                            color: "#475569",
                            marginTop: 4,
                            fontWeight: 500,
                          }}
                        >
                          Camera off
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {false &&
                  kycFields.length > 0 &&
                  getCompletedKycFieldCount(kycFields, kycResponses) <
                    kycFields.length &&
                  isAvatarConnected && (
                    <div style={ft.qOver}>
                      <div style={ft.qChip}>
                        <span style={ft.qNum}>
                          Q
                          {Math.min(kycCurrentFieldIndex + 1, kycFields.length)}
                        </span>
                        <span style={ft.qTxt}>
                          {getActiveKycPromptLabel(
                            kycFields[kycCurrentFieldIndex],
                            kycResponses,
                          ) || ""}
                        </span>
                      </div>
                      {kycTranscriptPreview && (
                        <div style={ft.tChip}>
                          <span>Mic</span>
                          <span style={ft.tTxt}>{kycTranscriptPreview}</span>
                        </div>
                      )}
                    </div>
                  )}

                {isAvatarConnected &&
                  getCompletedKycFieldCount(kycFields, kycResponses) <
                    kycFields.length &&
                  (isManagedIframeMode ? (
                    <div style={ft.ctrls}>
                      <button
                        style={ft.endBtn}
                       onClick={endCallOnly}
                        title="End Session"
                      >
                        <svg
                          width="28"
                          height="28"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.956.956 0 0 1-.29-.7c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71s-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <div style={ft.ctrls}>
                      <button
                        style={{ ...ft.cBtn, ...(isMuted ? ft.cBtnOn : {}) }}
                        onClick={toggleMute}
                        title={isMuted ? "Unmute" : "Mute"}
                      >
                        {isMuted ? (
                          <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <line x1="1" y1="1" x2="23" y2="23" />
                            <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                            <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .76-.13 1.49-.35 2.17" />
                            <line x1="12" y1="19" x2="12" y2="23" />
                            <line x1="8" y1="23" x2="16" y2="23" />
                          </svg>
                        ) : (
                          <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                            <line x1="12" y1="19" x2="12" y2="23" />
                            <line x1="8" y1="23" x2="16" y2="23" />
                          </svg>
                        )}
                      </button>

                      <button
                        style={ft.endBtn}
                        onClick={endCallOnly}
                        title="End Call"
                      >
                        <svg
                          width="28"
                          height="28"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.956.956 0 0 1-.29-.7c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71s-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
                        </svg>
                      </button>

                      <button
                        style={{
                          ...ft.cBtn,
                          ...(!cameraEnabled ? ft.cBtnOn : {}),
                        }}
                        onClick={toggleCamera}
                        title={cameraEnabled ? "Camera off" : "Camera on"}
                      >
                        {cameraEnabled ? (
                          <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M23 7l-7 5 7 5V7z" />
                            <rect x="1" y="5" width="15" height="14" rx="2" />
                          </svg>
                        ) : (
                          <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </svg>
                        )}
                      </button>
                    </div>
                  ))}
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
                        ✕
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
                      <div style={styles.completeIcon}>✓</div>
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
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 10,
    padding: "7px 30px 7px 12px",
    fontSize: 12,
    fontWeight: 500,
    color: "#e2e8f0",
    cursor: "pointer",
    outline: "none",
    minWidth: 132,
    backdropFilter: "blur(8px)",
    backgroundImage:
      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23cbd5e1' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 10px center",
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
  embedShell: { width: "100%", height: "100%", background: "#05070d" },
  embedFrame: {
    width: "100%",
    height: "100%",
    border: "none",
    display: "block",
    background: "#05070d",
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
