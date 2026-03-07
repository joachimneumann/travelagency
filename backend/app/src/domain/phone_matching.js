import { normalizeText } from "../../../../shared/js/text.js";

export function normalizeEmail(value) {
  return normalizeText(value).toLowerCase();
}

export function normalizePhone(value) {
  return String(value || "").replace(/[^\d+]/g, "").trim();
}

export function normalizePhoneDigits(value) {
  return String(value || "").replace(/[^\d]/g, "");
}

const VN_OLD_TO_NEW_MOBILE_PREFIX = Object.freeze({
  "162": "32",
  "163": "33",
  "164": "34",
  "165": "35",
  "166": "36",
  "167": "37",
  "168": "38",
  "169": "39",
  "120": "70",
  "121": "79",
  "122": "77",
  "126": "76",
  "128": "78",
  "123": "83",
  "124": "84",
  "125": "85",
  "127": "81",
  "129": "82",
  "186": "56",
  "188": "58",
  "199": "59"
});

function normalizeVietnamMobileCore(coreRaw) {
  const core = normalizePhoneDigits(coreRaw);
  if (!core) return "";

  if (core.length === 10) {
    const mapped = VN_OLD_TO_NEW_MOBILE_PREFIX[core.slice(0, 3)];
    if (mapped) return `${mapped}${core.slice(3)}`;
  }

  if (core.length === 9) return core;
  return core;
}

function normalizeVietnamPhoneForMatch(value) {
  let digits = normalizePhoneDigits(value);
  if (!digits) return "";
  if (digits.startsWith("00")) digits = digits.slice(2);

  if (digits.startsWith("84")) {
    const normalizedCore = normalizeVietnamMobileCore(digits.slice(2));
    if (normalizedCore.length === 9) return `0${normalizedCore}`;
    return `84${normalizedCore}`;
  }

  if (digits.startsWith("0")) {
    const normalizedCore = normalizeVietnamMobileCore(digits.slice(1));
    if (normalizedCore.length === 9) return `0${normalizedCore}`;
    return `0${normalizedCore}`;
  }

  if (digits.length === 10 && VN_OLD_TO_NEW_MOBILE_PREFIX[digits.slice(0, 3)]) {
    const normalizedCore = normalizeVietnamMobileCore(digits);
    if (normalizedCore.length === 9) return `0${normalizedCore}`;
  }

  if (digits.length === 9) {
    return `0${digits}`;
  }

  return digits;
}

export function canonicalPhoneForMatch(value) {
  const canonical = normalizeVietnamPhoneForMatch(value);
  if (canonical) return canonical;
  return normalizePhoneDigits(value);
}

export function isLikelyPhoneMatch(leftRaw, rightRaw) {
  const leftDigits = normalizePhoneDigits(leftRaw);
  const rightDigits = normalizePhoneDigits(rightRaw);
  if (!leftDigits || !rightDigits) return false;

  const left = normalizeVietnamPhoneForMatch(leftRaw);
  const right = normalizeVietnamPhoneForMatch(rightRaw);
  const leftCandidates = new Set([leftDigits, left].filter(Boolean));
  const rightCandidates = new Set([rightDigits, right].filter(Boolean));

  if (leftCandidates.has(rightDigits) || rightCandidates.has(leftDigits)) {
    return true;
  }

  for (const leftValue of leftCandidates) {
    for (const rightValue of rightCandidates) {
      if (!leftValue || !rightValue) continue;
      if (leftValue === rightValue) return true;

      if (leftValue.length >= 9 && rightValue.length >= 9) {
        if (leftValue.includes(rightValue) || rightValue.includes(leftValue)) {
          return true;
        }
      }

      const minLen = Math.min(leftValue.length, rightValue.length);
      if (minLen < 9) continue;
      for (let tailLength = Math.min(10, minLen); tailLength >= 9; tailLength -= 1) {
        if (leftValue.slice(-tailLength) === rightValue.slice(-tailLength)) return true;
      }
    }
  }

  return false;
}
