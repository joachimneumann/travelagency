#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const APP_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const STORE_PATH = path.join(APP_ROOT, "data", "store.json");

function nowStamp() {
  const date = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate())
  ].join("") + "_" + [pad(date.getUTCHours()), pad(date.getUTCMinutes()), pad(date.getUTCSeconds())].join("");
}

function hashPayload(payload) {
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function text(value) {
  return String(value ?? "").trim();
}

function optional(value) {
  const normalized = text(value);
  return normalized || null;
}

function parseLegacyBudgetRange(value) {
  const normalized = text(value);
  if (!normalized || /[€₫฿]/.test(normalized)) {
    return { budget_lower_USD: null, budget_upper_USD: null };
  }
  const matches = normalized.match(/\d[\d,]*/g) || [];
  const numbers = matches
    .map((item) => Number.parseInt(item.replace(/,/g, ""), 10))
    .filter((item) => Number.isInteger(item) && item >= 0);
  if (!numbers.length) {
    return { budget_lower_USD: null, budget_upper_USD: null };
  }
  if (normalized.includes("+")) {
    return { budget_lower_USD: numbers[0], budget_upper_USD: null };
  }
  if (numbers.length >= 2) {
    return { budget_lower_USD: numbers[0], budget_upper_USD: numbers[1] };
  }
  return { budget_lower_USD: numbers[0], budget_upper_USD: null };
}

function currencyCode(value) {
  const normalized = text(value).toUpperCase();
  return normalized || null;
}

function arrayOfStrings(value) {
  if (Array.isArray(value)) return value.map((entry) => text(entry)).filter(Boolean);
  return [];
}

function computeClientHash(client) {
  return hashPayload({
    id: client?.id || null,
    client_type: client?.client_type || null,
    customer_id: client?.customer_id || null,
    travel_group_id: client?.travel_group_id || null
  });
}

function computeCustomerHash(customer) {
  return hashPayload({
    client_id: customer?.client_id || null,
    name: customer?.name || null,
    photo_ref: customer?.photo_ref || null,
    title: customer?.title || null,
    first_name: customer?.first_name || null,
    last_name: customer?.last_name || null,
    date_of_birth: customer?.date_of_birth || null,
    nationality: customer?.nationality || null,
    address_line_1: customer?.address_line_1 || null,
    address_line_2: customer?.address_line_2 || null,
    address_city: customer?.address_city || null,
    address_state_region: customer?.address_state_region || null,
    address_postal_code: customer?.address_postal_code || null,
    address_country_code: customer?.address_country_code || null,
    organization_name: customer?.organization_name || null,
    organization_address: customer?.organization_address || null,
    organization_phone_number: customer?.organization_phone_number || null,
    organization_webpage: customer?.organization_webpage || null,
    organization_email: customer?.organization_email || null,
    tax_id: customer?.tax_id || null,
    phone_number: customer?.phone_number || null,
    email: customer?.email || null,
    preferred_language: customer?.preferred_language || null,
    preferred_currency: customer?.preferred_currency || null,
    timezone: customer?.timezone || null,
    notes: customer?.notes || null,
    created_at: customer?.created_at || null,
    updated_at: customer?.updated_at || null,
    archived_at: customer?.archived_at || null
  });
}

function computeTravelGroupHash(group) {
  return hashPayload({
    id: group?.id || null,
    client_id: group?.client_id || null,
    group_name: group?.group_name || null,
    group_contact_customer_id: group?.group_contact_customer_id || null,
    traveler_customer_ids: Array.isArray(group?.traveler_customer_ids) ? group.traveler_customer_ids : [],
    created_at: group?.created_at || null,
    updated_at: group?.updated_at || null,
    archived_at: group?.archived_at || null
  });
}

function computeBookingHash(booking) {
  return hashPayload({
    id: booking?.id || null,
    client_id: booking?.client_id || null,
    client_type: booking?.client_type || null,
    client_display_name: booking?.client_display_name || null,
    client_primary_phone_number: booking?.client_primary_phone_number || null,
    client_primary_email: booking?.client_primary_email || null,
    stage: booking?.stage || null,
    atp_staff: booking?.atp_staff || null,
    atp_staff_name: booking?.atp_staff_name || null,
    service_level_agreement_due_at: booking?.service_level_agreement_due_at || null,
    destination: arrayOfStrings(booking?.destination),
    style: arrayOfStrings(booking?.style),
    web_form_travel_month: booking?.web_form_travel_month || null,
    travel_start_day: booking?.travel_start_day || null,
    travel_end_day: booking?.travel_end_day || null,
    number_of_travelers: booking?.number_of_travelers ?? null,
    budget_lower_USD: booking?.budget_lower_USD ?? null,
    budget_upper_USD: booking?.budget_upper_USD ?? null,
    preferred_currency: booking?.preferred_currency || null,
    notes: booking?.notes || null,
    web_form_submission: booking?.web_form_submission || null,
    pricing: booking?.pricing || null,
    offer: booking?.offer || null,
    source: booking?.source || null,
    created_at: booking?.created_at || null,
    updated_at: booking?.updated_at || null
  });
}

async function main() {
  const raw = await fs.readFile(STORE_PATH, "utf8");
  const store = JSON.parse(raw);

  const clients = Array.isArray(store.clients) ? store.clients : [];
  const customers = Array.isArray(store.customers) ? store.customers : [];
  const customerConsents = Array.isArray(store.customer_consents) ? store.customer_consents : [];
  const customerDocuments = Array.isArray(store.customer_documents) ? store.customer_documents : [];
  const travelGroups = Array.isArray(store.travel_groups) ? store.travel_groups : [];
  const travelGroupMembers = Array.isArray(store.travel_group_members) ? store.travel_group_members : [];
  const bookings = Array.isArray(store.bookings) ? store.bookings : [];
  const activities = Array.isArray(store.activities) ? store.activities : [];
  const invoices = Array.isArray(store.invoices) ? store.invoices : [];
  const chatEvents = Array.isArray(store.chat_events) ? store.chat_events : [];
  const chatConversations = Array.isArray(store.chat_conversations) ? store.chat_conversations : [];
  const chatChannelAccounts = Array.isArray(store.chat_channel_accounts) ? store.chat_channel_accounts : [];

  const normalizedCustomers = customers.map((customer) => ({
    ...customer,
    client_id: text(customer.client_id),
    name: text(customer.name),
    photo_ref: optional(customer.photo_ref),
    title: optional(customer.title),
    first_name: optional(customer.first_name),
    last_name: optional(customer.last_name),
    date_of_birth: optional(customer.date_of_birth),
    nationality: optional(customer.nationality),
    address_line_1: optional(customer.address_line_1),
    address_line_2: optional(customer.address_line_2),
    address_city: optional(customer.address_city),
    address_state_region: optional(customer.address_state_region),
    address_postal_code: optional(customer.address_postal_code),
    address_country_code: optional(customer.address_country_code),
    organization_name: optional(customer.organization_name),
    organization_address: optional(customer.organization_address),
    organization_phone_number: optional(customer.organization_phone_number),
    organization_webpage: optional(customer.organization_webpage),
    organization_email: optional(customer.organization_email),
    tax_id: optional(customer.tax_id),
    phone_number: optional(customer.phone_number),
    email: optional(customer.email),
    preferred_language: optional(customer.preferred_language),
    preferred_currency: currencyCode(customer.preferred_currency),
    timezone: optional(customer.timezone),
    notes: optional(customer.notes),
    created_at: text(customer.created_at) || new Date().toISOString(),
    updated_at: text(customer.updated_at) || text(customer.created_at) || new Date().toISOString(),
    archived_at: optional(customer.archived_at)
  })).map((customer) => ({
    ...customer,
    customer_hash: computeCustomerHash(customer)
  }));

  const customerByClientId = new Map(normalizedCustomers.map((customer) => [customer.client_id, customer]));
  const normalizedTravelGroups = travelGroups.map((group) => ({
    ...group,
    id: text(group.id),
    client_id: text(group.client_id),
    group_name: text(group.group_name),
    group_contact_customer_id: optional(group.group_contact_customer_id),
    traveler_customer_ids: arrayOfStrings(group.traveler_customer_ids),
    created_at: text(group.created_at) || new Date().toISOString(),
    updated_at: text(group.updated_at) || text(group.created_at) || new Date().toISOString(),
    archived_at: optional(group.archived_at)
  })).map((group) => ({
    ...group,
    travel_group_hash: computeTravelGroupHash(group)
  }));

  const normalizedClients = clients.map((client) => {
    const normalized = {
      ...client,
      id: text(client.id),
      client_type: text(client.client_type),
      customer_id: optional(client.customer_id),
      travel_group_id: optional(client.travel_group_id)
    };
    return {
      ...normalized,
      client_hash: computeClientHash(normalized)
    };
  });

  const travelGroupById = new Map(normalizedTravelGroups.map((group) => [group.id, group]));
  const normalizedBookings = bookings.map((booking) => {
    const budgetRange = parseLegacyBudgetRange(booking.budget);
    const normalized = {
      ...booking,
      id: text(booking.id),
      client_id: optional(booking.client_id),
      client_type: optional(booking.client_type),
      client_display_name: optional(booking.client_display_name),
      client_primary_phone_number: optional(booking.client_primary_phone_number),
      client_primary_email: optional(booking.client_primary_email),
      stage: text(booking.stage),
      atp_staff: optional(booking.atp_staff),
      atp_staff_name: optional(booking.atp_staff_name),
      service_level_agreement_due_at: optional(booking.service_level_agreement_due_at),
      destination: arrayOfStrings(booking.destination),
      style: arrayOfStrings(booking.style),
      web_form_travel_month: optional(booking.web_form_travel_month),
      travel_start_day: optional(booking.travel_start_day),
      travel_end_day: optional(booking.travel_end_day),
      number_of_travelers: booking.number_of_travelers ?? null,
      budget_lower_USD: booking.budget_lower_USD ?? budgetRange.budget_lower_USD,
      budget_upper_USD: booking.budget_upper_USD ?? budgetRange.budget_upper_USD,
      preferred_currency: currencyCode(booking.preferred_currency),
      notes: optional(booking.notes),
      web_form_submission: booking.web_form_submission || null,
      pricing: booking.pricing || null,
      offer: booking.offer || null,
      source: booking.source || null,
      created_at: text(booking.created_at) || new Date().toISOString(),
      updated_at: text(booking.updated_at) || text(booking.created_at) || new Date().toISOString()
    };

    if (normalized.client_type === "customer") {
      const customer = normalized.client_id ? customerByClientId.get(normalized.client_id) : null;
      normalized.client_display_name = customer?.name || normalized.client_display_name;
      normalized.client_primary_phone_number = customer?.phone_number || normalized.client_primary_phone_number;
      normalized.client_primary_email = customer?.email || normalized.client_primary_email;
    } else if (normalized.client_type === "travel_group") {
      const group = normalized.client_id
        ? normalizedTravelGroups.find((entry) => entry.client_id === normalized.client_id)
        : null;
      const contact = group?.group_contact_customer_id ? customerByClientId.get(group.group_contact_customer_id) : null;
      normalized.client_display_name = group?.group_name || normalized.client_display_name;
      normalized.client_primary_phone_number = contact?.phone_number || normalized.client_primary_phone_number;
      normalized.client_primary_email = contact?.email || normalized.client_primary_email;
    }

    return {
      ...normalized,
      booking_hash: computeBookingHash(normalized)
    };
  });

  const normalizedTravelGroupMembers = travelGroupMembers
    .map((member) => ({
      ...member,
      id: text(member.id),
      travel_group_id: text(member.travel_group_id),
      customer_client_id: text(member.customer_client_id),
      is_traveling: member.is_traveling ?? false,
      member_roles: Array.isArray(member.member_roles) ? member.member_roles : [],
      notes: optional(member.notes),
      created_at: text(member.created_at) || new Date().toISOString(),
      updated_at: text(member.updated_at) || text(member.created_at) || new Date().toISOString()
    }))
    .filter((member) => member.travel_group_id && member.customer_client_id && travelGroupById.has(member.travel_group_id));

  const normalizedStore = {
    clients: normalizedClients,
    customers: normalizedCustomers,
    customer_consents: customerConsents,
    customer_documents: customerDocuments,
    travel_groups: normalizedTravelGroups,
    travel_group_members: normalizedTravelGroupMembers,
    bookings: normalizedBookings,
    activities,
    invoices,
    chat_events: chatEvents,
    chat_conversations: chatConversations,
    chat_channel_accounts: chatChannelAccounts
  };

  const backupPath = `${STORE_PATH}.bak_${nowStamp()}`;
  await fs.copyFile(STORE_PATH, backupPath);
  await fs.writeFile(STORE_PATH, `${JSON.stringify(normalizedStore, null, 2)}\n`, "utf8");
  console.log(`Migrated local store to canonical client model. Backup: ${path.basename(backupPath)}`);
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
