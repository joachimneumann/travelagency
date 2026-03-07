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

function currencyCode(value) {
  const normalized = text(value).toUpperCase();
  if (!normalized) return null;
  if (normalized === "EURO") return "EUR";
  return normalized;
}

function arrayOfStrings(value) {
  if (Array.isArray(value)) return value.map((entry) => text(entry)).filter(Boolean);
  const normalized = text(value);
  return normalized ? [normalized] : [];
}

function computeClientHash(client) {
  return hashPayload({
    id: client?.id || null,
    client_type: client?.client_type || null
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

function computeTravelGroupHash(group, members) {
  return hashPayload({
    id: group?.id || null,
    client_id: group?.client_id || null,
    group_name: group?.group_name || null,
    preferred_language: group?.preferred_language || null,
    preferred_currency: group?.preferred_currency || null,
    timezone: group?.timezone || null,
    notes: group?.notes || null,
    created_at: group?.created_at || null,
    updated_at: group?.updated_at || null,
    archived_at: group?.archived_at || null,
    members: (members || []).map((member) => ({
      id: member?.id || null,
      customer_client_id: member?.customer_client_id || null,
      is_traveling: member?.is_traveling ?? null,
      member_roles: Array.isArray(member?.member_roles) ? member.member_roles : [],
      notes: member?.notes || null,
      created_at: member?.created_at || null,
      updated_at: member?.updated_at || null
    }))
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
    owner_id: booking?.owner_id || null,
    owner_name: booking?.owner_name || null,
    sla_due_at: booking?.sla_due_at || null,
    destination: Array.isArray(booking?.destination) ? booking.destination : [],
    style: Array.isArray(booking?.style) ? booking.style : [],
    travel_month: booking?.travel_month || null,
    travelers: booking?.travelers ?? null,
    duration: booking?.duration || null,
    budget: booking?.budget || null,
    preferred_currency: booking?.preferred_currency || null,
    notes: booking?.notes || null,
    pricing: booking?.pricing || null,
    offer: booking?.offer || null,
    source: booking?.source || null,
    created_at: booking?.created_at || null,
    updated_at: booking?.updated_at || null
  });
}

function normalizeCustomer(legacyCustomer) {
  const clientId = text(legacyCustomer.id);
  const customer = {
    client_id: clientId,
    name: text(legacyCustomer.name),
    photo_ref: optional(legacyCustomer.photo_ref),
    title: optional(legacyCustomer.title),
    first_name: optional(legacyCustomer.first_name),
    last_name: optional(legacyCustomer.last_name),
    date_of_birth: optional(legacyCustomer.date_of_birth),
    nationality: optional(legacyCustomer.nationality),
    address_line_1: optional(legacyCustomer.address_line_1),
    address_line_2: optional(legacyCustomer.address_line_2),
    address_city: optional(legacyCustomer.address_city),
    address_state_region: optional(legacyCustomer.address_state_region),
    address_postal_code: optional(legacyCustomer.address_postal_code),
    address_country_code: optional(legacyCustomer.address_country_code),
    organization_name: optional(legacyCustomer.organization_name),
    organization_address: optional(legacyCustomer.organization_address),
    organization_phone_number: optional(legacyCustomer.organization_phone_number),
    organization_webpage: optional(legacyCustomer.organization_webpage),
    organization_email: optional(legacyCustomer.organization_email),
    tax_id: optional(legacyCustomer.tax_id),
    phone_number: optional(legacyCustomer.phone_number || legacyCustomer.phone),
    email: optional(legacyCustomer.email),
    preferred_language: optional(legacyCustomer.preferred_language || legacyCustomer.language),
    preferred_currency: currencyCode(legacyCustomer.preferred_currency),
    timezone: optional(legacyCustomer.timezone),
    notes: optional(legacyCustomer.notes),
    created_at: text(legacyCustomer.created_at) || new Date().toISOString(),
    updated_at: text(legacyCustomer.updated_at) || text(legacyCustomer.created_at) || new Date().toISOString(),
    archived_at: optional(legacyCustomer.archived_at)
  };
  customer.customer_hash = computeCustomerHash(customer);
  return customer;
}

function normalizeClient(clientId, clientType = "customer") {
  const client = {
    id: clientId,
    client_type: clientType
  };
  client.client_hash = computeClientHash(client);
  return client;
}

async function main() {
  const raw = await fs.readFile(STORE_PATH, "utf8");
  const store = JSON.parse(raw);

  const legacyCustomers = Array.isArray(store.customers) ? store.customers : [];
  const legacyCustomerConsents = Array.isArray(store.customer_consents) ? store.customer_consents : [];
  const legacyCustomerDocuments = Array.isArray(store.customer_documents) ? store.customer_documents : [];
  const travelGroups = Array.isArray(store.travel_groups) ? store.travel_groups : [];
  const travelGroupMembers = Array.isArray(store.travel_group_members) ? store.travel_group_members : [];

  const migratedCustomers = legacyCustomers.map((customer) => normalizeCustomer(customer));
  const customerIds = new Set(migratedCustomers.map((customer) => customer.client_id));
  const clients = migratedCustomers.map((customer) => normalizeClient(customer.client_id, "customer"));

  const migratedTravelGroups = travelGroups.map((group) => {
    const existingClientId = text(group.client_id);
    const fallbackClientId = text(group.id) ? `client_${text(group.id)}` : "";
    const clientId = existingClientId || fallbackClientId;
    const normalized = {
      id: text(group.id),
      client_id: clientId,
      group_name: text(group.group_name || group.name) || "Travel group",
      preferred_language: optional(group.preferred_language),
      preferred_currency: currencyCode(group.preferred_currency),
      timezone: optional(group.timezone),
      notes: optional(group.notes),
      created_at: text(group.created_at) || new Date().toISOString(),
      updated_at: text(group.updated_at) || text(group.created_at) || new Date().toISOString(),
      archived_at: optional(group.archived_at)
    };
    const groupMembers = travelGroupMembers
      .filter((member) => text(member.travel_group_id) === normalized.id)
      .map((member) => ({
        id: text(member.id),
        travel_group_id: normalized.id,
        customer_client_id: text(member.customer_client_id || member.customer_id),
        is_traveling: member.is_traveling ?? false,
        member_roles: Array.isArray(member.member_roles) ? member.member_roles : [],
        notes: optional(member.notes),
        created_at: text(member.created_at) || new Date().toISOString(),
        updated_at: text(member.updated_at) || text(member.created_at) || new Date().toISOString()
      }))
      .filter((member) => member.customer_client_id && customerIds.has(member.customer_client_id));
    normalized.travel_group_hash = computeTravelGroupHash(normalized, groupMembers);
    return normalized;
  });

  const migratedTravelGroupMembers = travelGroupMembers
    .map((member) => ({
      id: text(member.id),
      travel_group_id: text(member.travel_group_id),
      customer_client_id: text(member.customer_client_id || member.customer_id),
      is_traveling: member.is_traveling ?? false,
      member_roles: Array.isArray(member.member_roles) ? member.member_roles : [],
      notes: optional(member.notes),
      created_at: text(member.created_at) || new Date().toISOString(),
      updated_at: text(member.updated_at) || text(member.created_at) || new Date().toISOString()
    }))
    .filter((member) => member.travel_group_id && member.customer_client_id && customerIds.has(member.customer_client_id));

  for (const group of migratedTravelGroups) {
    if (group.client_id && !clients.some((client) => client.id === group.client_id)) {
      clients.push(normalizeClient(group.client_id, "travel_group"));
    }
  }

  const customerByClientId = new Map(migratedCustomers.map((customer) => [customer.client_id, customer]));
  const groupByClientId = new Map(migratedTravelGroups.map((group) => [group.client_id, group]));

  const migratedBookings = (Array.isArray(store.bookings) ? store.bookings : []).map((booking) => {
    const clientId = text(booking.client_id || booking.customer_id);
    const customer = customerByClientId.get(clientId) || null;
    const group = groupByClientId.get(clientId) || null;
    const normalized = {
      ...booking,
      client_id: clientId,
      client_type: group ? "travel_group" : "customer",
      client_display_name: group ? group.group_name : text(customer?.name),
      client_primary_phone_number: group ? null : optional(customer?.phone_number),
      client_primary_email: group ? null : optional(customer?.email),
      destination: arrayOfStrings(booking.destination),
      style: arrayOfStrings(booking.style),
      travel_month: optional(booking.travel_month),
      preferred_currency: currencyCode(booking.preferred_currency),
      updated_at: text(booking.updated_at) || text(booking.created_at) || new Date().toISOString()
    };
    delete normalized.customer_id;
    normalized.booking_hash = computeBookingHash(normalized);
    return normalized;
  });

  const migratedConsents = legacyCustomerConsents
    .map((consent) => ({
      ...consent,
      customer_client_id: text(consent.customer_client_id || consent.customer_id)
    }))
    .filter((consent) => consent.customer_client_id && customerIds.has(consent.customer_client_id))
    .map((consent) => {
      const normalized = { ...consent };
      delete normalized.customer_id;
      return normalized;
    });

  const migratedDocuments = legacyCustomerDocuments
    .map((document) => ({
      ...document,
      customer_client_id: text(document.customer_client_id || document.customer_id)
    }))
    .filter((document) => document.customer_client_id && customerIds.has(document.customer_client_id))
    .map((document) => {
      const normalized = { ...document };
      delete normalized.customer_id;
      return normalized;
    });

  const migratedChatConversations = (Array.isArray(store.chat_conversations) ? store.chat_conversations : []).map((conversation) => {
    const normalized = {
      ...conversation,
      client_id: text(conversation.client_id || conversation.customer_id) || null
    };
    delete normalized.customer_id;
    return normalized;
  });

  const migratedChatEvents = (Array.isArray(store.chat_events) ? store.chat_events : []).map((event) => {
    const normalized = {
      ...event,
      client_id: text(event.client_id || event.customer_id) || null
    };
    delete normalized.customer_id;
    return normalized;
  });

  const migratedInvoices = (Array.isArray(store.invoices) ? store.invoices : []).map((invoice) => {
    const normalized = {
      ...invoice,
      client_id: text(invoice.client_id || invoice.customer_id) || null
    };
    delete normalized.customer_id;
    return normalized;
  });

  const migratedStore = {
    ...store,
    clients,
    customers: migratedCustomers,
    customer_consents: migratedConsents,
    customer_documents: migratedDocuments,
    travel_groups: migratedTravelGroups,
    travel_group_members: migratedTravelGroupMembers,
    bookings: migratedBookings,
    chat_conversations: migratedChatConversations,
    chat_events: migratedChatEvents,
    invoices: migratedInvoices
  };

  const backupPath = `${STORE_PATH}.bak_${nowStamp()}`;
  await fs.writeFile(backupPath, raw);
  await fs.writeFile(STORE_PATH, `${JSON.stringify(migratedStore, null, 2)}\n`);

  const summary = {
    backup: backupPath,
    clients: migratedStore.clients.length,
    customers: migratedStore.customers.length,
    customer_consents: migratedStore.customer_consents.length,
    customer_documents: migratedStore.customer_documents.length,
    bookings: migratedStore.bookings.length,
    travel_groups: migratedStore.travel_groups.length,
    travel_group_members: migratedStore.travel_group_members.length
  };

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
