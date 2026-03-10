import { createHmac, randomUUID } from "node:crypto";
import { URL } from "node:url";
import { normalizeText } from "../lib/text.js";
import { firstHeaderValue } from "../lib/request_utils.js";
import { isLikelyPhoneMatch } from "../domain/phone_matching.js";

export function createMetaWebhookHandlers({
  metaWebhookEnabled,
  whatsappWebhookEnabled,
  metaWebhookVerifyToken,
  whatsappWebhookVerifyToken,
  metaAppSecret,
  whatsappAppSecret,
  nowIso,
  readBodyBuffer,
  readStore,
  persistStore,
  sendJson,
  safeEqualText,
  resolveBookingContactByExternalContact,
  resolveBookingById,
  getMetaConversationOpenUrl
}) {
  const status = {
    verify_requests: 0,
    ingest_requests: 0,
    signature_failures: 0,
    json_parse_failures: 0,
    last_verify_at: null,
    last_ingest_at: null,
    last_result: null
  };

  function ensureMetaChatCollections(store) {
    store.chat_channel_accounts ||= [];
    store.chat_conversations ||= [];
    store.chat_events ||= [];
  }

  function normalizeMetaTimestampToIso(value) {
    const text = normalizeText(value);
    if (!text) return nowIso();
    const numeric = Number(text);
    if (Number.isFinite(numeric)) {
      const ms = numeric > 10_000_000_000 ? numeric : numeric * 1000;
      const date = new Date(ms);
      if (!Number.isNaN(date.getTime())) return date.toISOString();
    }
    const date = new Date(text);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
    return nowIso();
  }

  function compactPreviewText(value, fallback = "(event)") {
    const text = normalizeText(value);
    if (!text) return fallback;
    if (text.length <= 240) return text;
    return `${text.slice(0, 240)}...`;
  }

  function extractWhatsAppMessagePreview(message) {
    const type = normalizeText(message?.type).toLowerCase();
    if (type === "text") {
      const body = typeof message?.text === "string" ? message?.text : message?.text?.body;
      return normalizeText(body) || "[text]";
    }
    if (type === "button") {
      return normalizeText(message?.button?.text) || "[button]";
    }
    if (type === "interactive") {
      return normalizeText(message?.interactive?.body?.text) || "[interactive]";
    }
    const fallbackBody = normalizeText(message?.body || message?.message?.body || message?.message?.text?.body || message?.message?.text);
    if (fallbackBody) return fallbackBody;
    if (type) return `[${type}]`;
    return "(message)";
  }

  function upsertMetaChannelAccount(store, { channel, externalAccountId, displayName = "", metadata = {} }) {
    ensureMetaChatCollections(store);
    const normalizedChannel = normalizeText(channel).toLowerCase();
    const normalizedAccountId = normalizeText(externalAccountId);
    if (!normalizedChannel || !normalizedAccountId) return null;

    let account = store.chat_channel_accounts.find(
      (item) => normalizeText(item.channel).toLowerCase() === normalizedChannel && normalizeText(item.external_account_id) === normalizedAccountId
    );

    if (!account) {
      account = {
        id: `chatacct_${randomUUID()}`,
        channel: normalizedChannel,
        external_account_id: normalizedAccountId,
        name: normalizeText(displayName) || null,
        metadata: metadata && typeof metadata === "object" ? metadata : {},
        created_at: nowIso(),
        updated_at: nowIso()
      };
      store.chat_channel_accounts.push(account);
      return account;
    }

    account.name = normalizeText(displayName) || account.name || null;
    account.metadata = metadata && typeof metadata === "object" ? { ...account.metadata, ...metadata } : account.metadata;
    account.updated_at = nowIso();
    return account;
  }

  function findOrCreateMetaConversation(store, {
    channel,
    externalConversationId = "",
    externalContactId = "",
    channelAccountId = "",
    bookingId = null
  }) {
    ensureMetaChatCollections(store);
    const normalizedChannel = normalizeText(channel).toLowerCase();
    const normalizedContactId = normalizeText(externalContactId);
    const normalizedConversationId = normalizeText(externalConversationId || normalizedContactId);
    const normalizedAccountId = normalizeText(channelAccountId);

    if (!normalizedChannel || !normalizedContactId) return null;

    let conversation = store.chat_conversations.find((item) => {
      return (
        normalizeText(item.channel).toLowerCase() === normalizedChannel &&
        normalizeText(item.external_contact_id) === normalizedContactId &&
        normalizeText(item.channel_account_id) === normalizedAccountId
      );
    });

    if (!conversation) {
      conversation = {
        id: `chatconv_${randomUUID()}`,
        channel: normalizedChannel,
        channel_account_id: normalizedAccountId || null,
        external_conversation_id: normalizedConversationId || normalizedContactId,
        external_contact_id: normalizedContactId,
        booking_id: bookingId || null,
        assigned_atp_staff_id: null,
        latest_preview: null,
        last_event_at: null,
        created_at: nowIso(),
        updated_at: nowIso()
      };
      store.chat_conversations.push(conversation);
      return conversation;
    }

    if (!conversation.booking_id && bookingId) conversation.booking_id = bookingId;
    conversation.external_conversation_id = normalizedConversationId || conversation.external_conversation_id || normalizedContactId;
    conversation.updated_at = nowIso();
    return conversation;
  }

  function hasDuplicateMetaChatEvent(store, candidate) {
    return store.chat_events.some((item) => {
      return (
        normalizeText(item.conversation_id) === normalizeText(candidate.conversation_id) &&
        normalizeText(item.external_message_id) === normalizeText(candidate.external_message_id) &&
        normalizeText(item.event_type) === normalizeText(candidate.event_type) &&
        normalizeText(item.direction) === normalizeText(candidate.direction) &&
        normalizeText(item.external_status) === normalizeText(candidate.external_status) &&
        normalizeText(item.sent_at) === normalizeText(candidate.sent_at)
      );
    });
  }

  function appendMetaChatEvent(store, event) {
    ensureMetaChatCollections(store);
    const normalizedEvent = {
      id: `chatevt_${randomUUID()}`,
      conversation_id: normalizeText(event.conversation_id),
      channel: normalizeText(event.channel).toLowerCase(),
      event_type: normalizeText(event.event_type).toLowerCase() || "message",
      direction: normalizeText(event.direction).toLowerCase() || "inbound",
      external_message_id: normalizeText(event.external_message_id) || null,
      external_status: normalizeText(event.external_status).toLowerCase() || null,
      sender_display: normalizeText(event.sender_display) || null,
      sender_contact: normalizeText(event.sender_contact) || null,
      text_preview: compactPreviewText(event.text_preview, "(event)"),
      sent_at: normalizeMetaTimestampToIso(event.sent_at),
      received_at: nowIso(),
      payload_json: event.payload_json && typeof event.payload_json === "object" ? event.payload_json : {},
      created_at: nowIso()
    };

    if (hasDuplicateMetaChatEvent(store, normalizedEvent)) {
      return { inserted: false, event: null };
    }

    store.chat_events.push(normalizedEvent);
    const conversation = store.chat_conversations.find((item) => item.id === normalizedEvent.conversation_id);
    if (conversation) {
      conversation.last_event_at = normalizedEvent.sent_at;
      conversation.latest_preview = normalizedEvent.text_preview;
      conversation.updated_at = nowIso();
    }
    return { inserted: true, event: normalizedEvent };
  }

  function findChatMessageTextByExternalMessageId(store, conversationId, externalMessageId) {
    const targetConversationId = normalizeText(conversationId);
    const targetExternalId = normalizeText(externalMessageId);
    if (!targetConversationId || !targetExternalId) return "";
    const matched = store.chat_events.find((item) => {
      return (
        normalizeText(item.conversation_id) === targetConversationId &&
        normalizeText(item.event_type).toLowerCase() === "message" &&
        normalizeText(item.external_message_id) === targetExternalId
      );
    });
    return normalizeText(matched?.text_preview);
  }

  function buildWhatsAppContext(store, entry, change) {
    const value = change?.value && typeof change.value === "object" ? change.value : {};
    const metadata = value?.metadata && typeof value.metadata === "object" ? value.metadata : {};
    const phoneNumberId = normalizeText(metadata.phone_number_id);
    const displayPhone = normalizeText(metadata.display_phone_number);
    const wabaId = normalizeText(entry?.id);

    const account = upsertMetaChannelAccount(store, {
      channel: "whatsapp",
      externalAccountId: phoneNumberId || wabaId,
      displayName: displayPhone || "WhatsApp",
      metadata: {
        waba_id: wabaId || null,
        display_phone_number: displayPhone || null,
        phone_number_id: phoneNumberId || null
      }
    });

    const contacts = Array.isArray(value?.contacts) ? value.contacts : [];
    const contactMap = new Map(
      contacts
        .map((contact) => [normalizeText(contact?.wa_id), contact])
        .filter(([waId]) => Boolean(waId))
    );

    return { value, account, displayPhone, contacts, contactMap };
  }

  function findOrCreateWhatsAppConversation(store, account, waId) {
    const normalizedWaId = normalizeText(waId);
    if (!normalizedWaId) return null;
    const matchedContact = resolveBookingContactByExternalContact(store, normalizedWaId);
    const matchedBooking = resolveBookingById(store, matchedContact?.booking_id || null);
    return findOrCreateMetaConversation(store, {
      channel: "whatsapp",
      externalConversationId: normalizedWaId,
      externalContactId: normalizedWaId,
      channelAccountId: account?.id || "",
      bookingId: matchedBooking?.id || null
    });
  }

  function coerceWhatsAppMessagePayload(rawMessage) {
    const source = rawMessage && typeof rawMessage === "object" ? rawMessage : {};
    const nested = source?.message && typeof source.message === "object" ? source.message : null;
    if (!nested) return source;
    return {
      ...nested,
      id: normalizeText(source?.id) || normalizeText(nested?.id),
      from: normalizeText(source?.from) || normalizeText(nested?.from),
      to: normalizeText(source?.to) || normalizeText(nested?.to),
      timestamp: normalizeText(source?.timestamp) || normalizeText(nested?.timestamp)
    };
  }

  function resolveWhatsAppDirectionAndContact(message, displayPhone, fallbackContact = "") {
    const from = normalizeText(message?.from);
    const to = normalizeText(message?.to);
    const outboundFromBusiness = Boolean(displayPhone && from) && isLikelyPhoneMatch(from, displayPhone);
    const inboundToBusiness = Boolean(displayPhone && to) && isLikelyPhoneMatch(to, displayPhone);

    if (outboundFromBusiness) {
      return { direction: "outbound", contactId: normalizeText(to || fallbackContact) };
    }
    if (inboundToBusiness) {
      return { direction: "inbound", contactId: normalizeText(from || fallbackContact) };
    }
    return { direction: "inbound", contactId: normalizeText(from || to || fallbackContact) };
  }

  function processWhatsAppMetaChange(store, entry, change) {
    const { value, account, displayPhone, contacts, contactMap } = buildWhatsAppContext(store, entry, change);
    let inserted = 0;
    let ignored = 0;

    const messages = Array.isArray(value?.messages) ? value.messages : [];
    const messageEchoes = Array.isArray(value?.message_echoes) ? value.message_echoes : [];
    const combinedMessages = [...messages, ...messageEchoes];
    for (const rawMessage of combinedMessages) {
      const message = coerceWhatsAppMessagePayload(rawMessage);
      const directionInfo = resolveWhatsAppDirectionAndContact(message, displayPhone, contacts?.[0]?.wa_id || "");
      const waId = normalizeText(directionInfo.contactId);
      if (!waId) {
        ignored += 1;
        continue;
      }
      const conversation = findOrCreateWhatsAppConversation(store, account, waId);
      if (!conversation) {
        ignored += 1;
        continue;
      }

      const profileName = normalizeText(contactMap.get(waId)?.profile?.name);
      const result = appendMetaChatEvent(store, {
        conversation_id: conversation.id,
        channel: "whatsapp",
        event_type: "message",
        direction: directionInfo.direction,
        external_message_id: normalizeText(message?.id),
        external_status: null,
        sender_display: directionInfo.direction === "outbound" ? "business" : profileName || waId,
        sender_contact: directionInfo.direction === "outbound" ? displayPhone || normalizeText(message?.from) : waId,
        text_preview: extractWhatsAppMessagePreview(message),
        sent_at: message?.timestamp,
        payload_json: rawMessage
      });
      if (result.inserted) inserted += 1;
      else ignored += 1;
    }

    const statuses = Array.isArray(value?.statuses) ? value.statuses : [];
    for (const eventStatus of statuses) {
      const waId = normalizeText(eventStatus?.recipient_id || eventStatus?.to || eventStatus?.recipient || "");
      if (!waId) {
        ignored += 1;
        continue;
      }
      const conversation = findOrCreateWhatsAppConversation(store, account, waId);
      if (!conversation) {
        ignored += 1;
        continue;
      }
      const statusCode = normalizeText(eventStatus?.status).toLowerCase() || "unknown";
      const externalStatusMessageId = normalizeText(eventStatus?.id || eventStatus?.message_id || eventStatus?.meta_msg_id);
      const relatedMessageText = findChatMessageTextByExternalMessageId(store, conversation.id, externalStatusMessageId);
      const result = appendMetaChatEvent(store, {
        conversation_id: conversation.id,
        channel: "whatsapp",
        event_type: "status",
        direction: "outbound",
        external_message_id: externalStatusMessageId,
        external_status: statusCode,
        sender_display: "business",
        sender_contact: displayPhone || null,
        text_preview: relatedMessageText ? `Status: ${statusCode} - ${relatedMessageText}` : `Status: ${statusCode}`,
        sent_at: eventStatus?.timestamp,
        payload_json: eventStatus
      });
      if (result.inserted) inserted += 1;
      else ignored += 1;
    }

    return { inserted, ignored };
  }

  function processWhatsAppMessageEchoesChange(store, entry, change) {
    const { value, account, displayPhone, contacts, contactMap } = buildWhatsAppContext(store, entry, change);
    let inserted = 0;
    let ignored = 0;
    const echoes = Array.isArray(value?.message_echoes) ? value.message_echoes : [];

    for (const rawEcho of echoes) {
      const echo = coerceWhatsAppMessagePayload(rawEcho);
      const directionInfo = resolveWhatsAppDirectionAndContact(echo, displayPhone, contacts?.[0]?.wa_id || "");
      const waId = normalizeText(directionInfo.contactId);
      if (!waId) {
        ignored += 1;
        continue;
      }
      const conversation = findOrCreateWhatsAppConversation(store, account, waId);
      if (!conversation) {
        ignored += 1;
        continue;
      }

      const profileName = normalizeText(contactMap.get(waId)?.profile?.name);
      const result = appendMetaChatEvent(store, {
        conversation_id: conversation.id,
        channel: "whatsapp",
        event_type: "message",
        direction: directionInfo.direction,
        external_message_id: normalizeText(echo?.id),
        external_status: null,
        sender_display: directionInfo.direction === "outbound" ? "business" : profileName || waId,
        sender_contact: directionInfo.direction === "outbound" ? displayPhone || normalizeText(echo?.from) : waId,
        text_preview: extractWhatsAppMessagePreview(echo),
        sent_at: echo?.timestamp,
        payload_json: rawEcho
      });
      if (result.inserted) inserted += 1;
      else ignored += 1;
    }

    return { inserted, ignored };
  }

  function processWhatsAppHistoryChange(store, entry, change) {
    const { value, account, displayPhone, contacts } = buildWhatsAppContext(store, entry, change);
    let inserted = 0;
    let ignored = 0;
    const historyItems = Array.isArray(value?.history) ? value.history : [];

    for (const historyItem of historyItems) {
      const fallbackContact = normalizeText(historyItem?.wa_id || historyItem?.chat_id || historyItem?.contact?.wa_id || contacts?.[0]?.wa_id || "");
      const messageItems = Array.isArray(historyItem?.messages) ? historyItem.messages : [historyItem];
      for (const rawMessage of messageItems) {
        const message = coerceWhatsAppMessagePayload(rawMessage);
        const directionInfo = resolveWhatsAppDirectionAndContact(message, displayPhone, fallbackContact);
        const waId = normalizeText(directionInfo.contactId);
        if (!waId) {
          ignored += 1;
          continue;
        }
        const conversation = findOrCreateWhatsAppConversation(store, account, waId);
        if (!conversation) {
          ignored += 1;
          continue;
        }

        const historyStatus = normalizeText(message?.history_context?.status).toLowerCase();
        const eventType = historyStatus ? "status" : "message";
        const textPreview = historyStatus ? `History status: ${historyStatus}` : extractWhatsAppMessagePreview(message);
        const result = appendMetaChatEvent(store, {
          conversation_id: conversation.id,
          channel: "whatsapp",
          event_type: eventType,
          direction: directionInfo.direction,
          external_message_id: normalizeText(message?.id),
          external_status: historyStatus || null,
          sender_display: directionInfo.direction === "outbound" ? "business" : waId,
          sender_contact: directionInfo.direction === "outbound" ? displayPhone || normalizeText(message?.from) : waId,
          text_preview: textPreview,
          sent_at: message?.timestamp || value?.timestamp,
          payload_json: rawMessage
        });
        if (result.inserted) inserted += 1;
        else ignored += 1;
      }
    }

    return { inserted, ignored };
  }

  function processWhatsAppAppStateSyncChange(store, entry, change) {
    const { value, account, displayPhone, contactMap } = buildWhatsAppContext(store, entry, change);
    let inserted = 0;
    let ignored = 0;
    const contacts = Array.isArray(value?.contacts) ? value.contacts : [];

    for (const contact of contacts) {
      const waId = normalizeText(contact?.wa_id || contact?.id || contact?.phone || "");
      if (!waId) {
        ignored += 1;
        continue;
      }
      const conversation = findOrCreateWhatsAppConversation(store, account, waId);
      if (!conversation) {
        ignored += 1;
        continue;
      }
      const profileName = normalizeText(contactMap.get(waId)?.profile?.name || contact?.profile?.name);
      const appState = normalizeText(contact?.state || contact?.status || contact?.app_state || "updated").toLowerCase();
      const result = appendMetaChatEvent(store, {
        conversation_id: conversation.id,
        channel: "whatsapp",
        event_type: "status",
        direction: "inbound",
        external_message_id: normalizeText(contact?.id) || `app_state_sync_${waId}`,
        external_status: "app_state_sync",
        sender_display: profileName || waId,
        sender_contact: waId,
        text_preview: `App state sync: ${appState}`,
        sent_at: value?.timestamp || nowIso(),
        payload_json: contact
      });
      if (result.inserted) inserted += 1;
      else ignored += 1;
    }

    return { inserted, ignored };
  }

  function processMessengerMetaEntry(store, entry) {
    const pageId = normalizeText(entry?.id);
    const account = upsertMetaChannelAccount(store, {
      channel: "messenger",
      externalAccountId: pageId,
      displayName: "Facebook Page",
      metadata: { page_id: pageId || null }
    });

    let inserted = 0;
    let ignored = 0;
    const messagingEvents = Array.isArray(entry?.messaging) ? entry.messaging : [];
    for (const event of messagingEvents) {
      const senderId = normalizeText(event?.sender?.id);
      const recipientId = normalizeText(event?.recipient?.id);
      const isOutbound = senderId === pageId;
      const contactId = isOutbound ? recipientId : senderId;
      if (!contactId) {
        ignored += 1;
        continue;
      }

      const matchedContact = resolveBookingContactByExternalContact(store, contactId);
      const matchedBooking = resolveBookingById(store, matchedContact?.booking_id || null);
      const conversation = findOrCreateMetaConversation(store, {
        channel: "messenger",
        externalConversationId: contactId,
        externalContactId: contactId,
        channelAccountId: account?.id || "",
        bookingId: matchedBooking?.id || null
      });
      if (!conversation) {
        ignored += 1;
        continue;
      }

      const eventType = event?.message ? "message" : "status";
      const externalStatus = event?.delivery ? "delivered" : event?.read ? "read" : event?.postback ? "postback" : null;
      const previewText = event?.message?.text || (event?.message?.attachments ? "[attachment]" : eventType === "status" ? `Status: ${externalStatus || "event"}` : "(message)");

      const result = appendMetaChatEvent(store, {
        conversation_id: conversation.id,
        channel: "messenger",
        event_type: eventType,
        direction: isOutbound ? "outbound" : "inbound",
        external_message_id: normalizeText(event?.message?.mid || event?.delivery?.mids?.[0] || event?.read?.mid),
        external_status: externalStatus,
        sender_display: isOutbound ? "page" : contactId,
        sender_contact: contactId,
        text_preview: previewText,
        sent_at: event?.timestamp,
        payload_json: event
      });

      if (result.inserted) inserted += 1;
      else ignored += 1;
    }

    return { inserted, ignored };
  }

  function processMetaWebhookPayload(store, payload) {
    ensureMetaChatCollections(store);
    const objectType = normalizeText(payload?.object).toLowerCase();
    let inserted = 0;
    let ignored = 0;

    if (objectType === "whatsapp_business_account") {
      const entries = Array.isArray(payload?.entry) ? payload.entry : [];
      for (const entry of entries) {
        const changes = Array.isArray(entry?.changes) ? entry.changes : [];
        for (const change of changes) {
          const field = normalizeText(change?.field).toLowerCase();
          let result = null;
          if (field === "messages") {
            result = processWhatsAppMetaChange(store, entry, change);
          } else if (field === "smb_message_echoes") {
            result = processWhatsAppMessageEchoesChange(store, entry, change);
          } else if (field === "history") {
            result = processWhatsAppHistoryChange(store, entry, change);
          } else if (field === "smb_app_state_sync") {
            result = processWhatsAppAppStateSyncChange(store, entry, change);
          } else {
            continue;
          }
          inserted += result.inserted;
          ignored += result.ignored;
        }
      }
      return { inserted, ignored, channel: "whatsapp" };
    }

    if (objectType === "page") {
      const entries = Array.isArray(payload?.entry) ? payload.entry : [];
      for (const entry of entries) {
        const result = processMessengerMetaEntry(store, entry);
        inserted += result.inserted;
        ignored += result.ignored;
      }
      return { inserted, ignored, channel: "messenger" };
    }

    return { inserted: 0, ignored: 0, channel: "unknown" };
  }

  function verifyMetaWebhookSignature(req, rawBody) {
    const secret = metaAppSecret || whatsappAppSecret;
    if (!secret) return true;
    const signatureHeader = firstHeaderValue(req.headers["x-hub-signature-256"]);
    if (!signatureHeader.startsWith("sha256=")) return false;
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    const actual = signatureHeader.slice("sha256=".length);
    return safeEqualText(actual, expected);
  }

  function isMetaWebhookConfigured() {
    const enabled = metaWebhookEnabled || whatsappWebhookEnabled;
    const verifyToken = metaWebhookVerifyToken || whatsappWebhookVerifyToken;
    if (enabled) return Boolean(verifyToken);
    return Boolean(verifyToken);
  }

  async function handleMetaWebhookVerify(req, res) {
    status.verify_requests += 1;
    status.last_verify_at = nowIso();
    if (!isMetaWebhookConfigured()) {
      sendJson(res, 503, { error: "Meta webhook is disabled" });
      return;
    }
    const requestUrl = new URL(req.url, "http://localhost");
    const mode = normalizeText(requestUrl.searchParams.get("hub.mode"));
    const verifyToken = normalizeText(requestUrl.searchParams.get("hub.verify_token"));
    const challenge = normalizeText(requestUrl.searchParams.get("hub.challenge"));
    const configuredVerifyToken = metaWebhookVerifyToken || whatsappWebhookVerifyToken;

    if (mode === "subscribe" && challenge && safeEqualText(verifyToken, configuredVerifyToken)) {
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(challenge);
      return;
    }

    sendJson(res, 403, { error: "Meta webhook verification failed" });
  }

  async function handleMetaWebhookIngest(req, res) {
    status.ingest_requests += 1;
    status.last_ingest_at = nowIso();
    if (!isMetaWebhookConfigured()) {
      sendJson(res, 503, { error: "Meta webhook is disabled" });
      return;
    }

    let rawBody;
    try {
      rawBody = await readBodyBuffer(req);
    } catch {
      sendJson(res, 400, { error: "Invalid request body" });
      return;
    }

    if (!verifyMetaWebhookSignature(req, rawBody)) {
      status.signature_failures += 1;
      sendJson(res, 401, { error: "Invalid Meta signature" });
      return;
    }

    let payload;
    try {
      payload = JSON.parse(rawBody.toString("utf8"));
    } catch {
      status.json_parse_failures += 1;
      sendJson(res, 400, { error: "Invalid JSON payload" });
      return;
    }

    const store = await readStore();
    const result = processMetaWebhookPayload(store, payload);
    if (result.inserted > 0) {
      await persistStore(store);
    }
    status.last_result = {
      at: nowIso(),
      object: normalizeText(payload?.object).toLowerCase() || "unknown",
      entry_count: Array.isArray(payload?.entry) ? payload.entry.length : 0,
      channel: result.channel,
      inserted: result.inserted,
      ignored: result.ignored,
      sample_entry_id: normalizeText(payload?.entry?.[0]?.id),
      sample_change_field: normalizeText(payload?.entry?.[0]?.changes?.[0]?.field),
      sample_from: normalizeText(payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from)
    };
    sendJson(res, 200, {
      ok: true,
      mode: "read_only",
      channel: result.channel,
      inserted: result.inserted,
      ignored: result.ignored
    });
  }

  async function handleMetaWebhookStatus(_req, res) {
    sendJson(res, 200, {
      ok: true,
      mode: "read_only",
      configured: {
        webhook_enabled: isMetaWebhookConfigured(),
        verify_token_set: Boolean(metaWebhookVerifyToken || whatsappWebhookVerifyToken),
        app_secret_set: Boolean(metaAppSecret || whatsappAppSecret)
      },
      counters: {
        verify_requests: status.verify_requests,
        ingest_requests: status.ingest_requests,
        signature_failures: status.signature_failures,
        json_parse_failures: status.json_parse_failures
      },
      last_verify_at: status.last_verify_at,
      last_ingest_at: status.last_ingest_at,
      last_result: status.last_result
    });
  }

  function buildChatEventReadModel(event, conversation) {
    const channel = normalizeText(event?.channel).toLowerCase();
    const senderContact = normalizeText(event?.sender_contact || conversation?.external_contact_id || "");
    return {
      id: event.id,
      channel,
      direction: event.direction,
      event_type: event.event_type,
      external_status: event.external_status || null,
      text_preview: event.text_preview || "",
      sender_display: event.sender_display || null,
      sender_contact: senderContact || null,
      sent_at: event.sent_at || event.created_at || null,
      received_at: event.received_at || null,
      conversation_id: event.conversation_id,
      open_url: getMetaConversationOpenUrl(channel, senderContact)
    };
  }

  return {
    ensureMetaChatCollections,
    buildChatEventReadModel,
    handleMetaWebhookVerify,
    handleMetaWebhookIngest,
    handleMetaWebhookStatus
  };
}
