import { normalizeText } from "../../../../shared/js/text.js";

export function nowIso() {
  return new Date().toISOString();
}

export function firstHeaderValue(value) {
  if (Array.isArray(value)) return normalizeText(value[0]);
  return normalizeText(value);
}

export function normalizeIpAddress(value) {
  const raw = normalizeText(value);
  if (!raw) return "";
  if (raw.startsWith("::ffff:")) return raw.slice(7);
  return raw;
}

export function getRequestIpAddress(req) {
  const forwardedFor = firstHeaderValue(req.headers["x-forwarded-for"]);
  if (forwardedFor) {
    const [firstIp] = forwardedFor.split(",");
    return normalizeIpAddress(firstIp);
  }
  const remoteAddress = req.socket?.remoteAddress || "";
  return normalizeIpAddress(remoteAddress);
}

export function isPrivateOrLocalIp(value) {
  const ip = normalizeIpAddress(value);
  if (!ip) return true;
  if (ip === "127.0.0.1" || ip === "::1") return true;
  if (ip.startsWith("10.") || ip.startsWith("192.168.")) return true;
  if (ip.startsWith("172.")) {
    const second = safeInt(ip.split(".")[1]);
    return second >= 16 && second <= 31;
  }
  return false;
}

export function ipv4ToInt(value) {
  const parts = normalizeIpAddress(value).split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
  return ((parts[0] << 24) >>> 0) + ((parts[1] << 16) >>> 0) + ((parts[2] << 8) >>> 0) + (parts[3] >>> 0);
}

export function ipv4CidrContains(cidr, ip) {
  const [base, prefixText] = String(cidr || "").split("/");
  const prefix = Number(prefixText);
  const ipValue = ipv4ToInt(ip);
  const baseValue = ipv4ToInt(base);
  if (ipValue === null || baseValue === null || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) return false;
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (ipValue & mask) === (baseValue & mask);
}

export function guessCountryFromIpRange(ip) {
  const normalizedIp = normalizeIpAddress(ip);
  if (!normalizedIp || isPrivateOrLocalIp(normalizedIp)) return null;

  const ipRanges = [
    { cidr: "42.112.0.0/13", countryCode: "VN", countryName: "Vietnam" },
    { cidr: "113.160.0.0/11", countryCode: "VN", countryName: "Vietnam" },
    { cidr: "171.224.0.0/11", countryCode: "VN", countryName: "Vietnam" },
    { cidr: "27.72.0.0/13", countryCode: "VN", countryName: "Vietnam" },
    { cidr: "103.1.200.0/22", countryCode: "VN", countryName: "Vietnam" },
    { cidr: "185.197.248.0/22", countryCode: "DE", countryName: "Germany" },
    { cidr: "31.3.152.0/21", countryCode: "DE", countryName: "Germany" },
    { cidr: "91.0.0.0/10", countryCode: "DE", countryName: "Germany" }
  ];

  return ipRanges.find((entry) => ipv4CidrContains(entry.cidr, normalizedIp)) || null;
}

export function formatCountryGuessLabel(countryGuess) {
  if (!countryGuess?.countryName || !countryGuess?.countryCode) return "";
  return `${countryGuess.countryName} (${countryGuess.countryCode})`;
}

export function guessCountryFromRequest(req) {
  return guessCountryFromIpRange(getRequestIpAddress(req));
}

export function safeInt(value) {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function safeOptionalInt(value) {
  const text = normalizeText(value);
  if (!text) return null;
  const parsed = Number.parseInt(text, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function safeFloat(value) {
  const parsed = Number.parseFloat(String(value ?? "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}
