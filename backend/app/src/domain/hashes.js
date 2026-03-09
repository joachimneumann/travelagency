import { createHash } from "node:crypto";

function stableClone(value, omittedKeys = new Set()) {
  if (Array.isArray(value)) return value.map((entry) => stableClone(entry, omittedKeys));
  if (!value || typeof value !== "object") return value;

  const next = {};
  for (const key of Object.keys(value).sort()) {
    if (omittedKeys.has(key)) continue;
    next[key] = stableClone(value[key], omittedKeys);
  }
  return next;
}

function hashPayload(payload, omittedKeys = []) {
  const prepared = stableClone(payload, new Set(omittedKeys));
  return createHash("sha256").update(JSON.stringify(prepared)).digest("hex");
}

export function computeBookingHash(booking) {
  return hashPayload(booking, ["booking_hash"]);
}
