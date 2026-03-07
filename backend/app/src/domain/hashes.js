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

export function computeClientHash(client) {
  return hashPayload(client, ["client_hash"]);
}

export function computeCustomerHash(customer) {
  return hashPayload(customer, ["customer_hash"]);
}

export function computeTravelGroupHash(group, members = []) {
  return hashPayload({ ...group, members }, ["travel_group_hash"]);
}

export function computeBookingHash(booking) {
  return hashPayload(booking, ["booking_hash"]);
}
