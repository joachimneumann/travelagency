export function createBookingChatHandlers(deps) {
  const {
    readStore,
    sendJson,
    getPrincipal,
    canAccessBooking,
    ensureMetaChatCollections,
    clamp,
    safeInt,
    conversationMatchesBooking,
    resolveCanonicalConversationBookingId,
    buildChatEventReadModel,
    buildConversationRelatedBookings,
    normalizeText,
    getMetaConversationOpenUrl
  } = deps;

  async function handleListBookingChatEvents(req, res, [bookingId]) {
    const store = await readStore();
    const booking = store.bookings.find((item) => item.id === bookingId);
    if (!booking) {
      sendJson(res, 404, { error: "Booking not found" });
      return;
    }

    const principal = getPrincipal(req);
    if (!canAccessBooking(principal, booking)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }

    ensureMetaChatCollections(store);
    const requestUrl = new URL(req.url, "http://localhost");
    const limit = clamp(safeInt(requestUrl.searchParams.get("limit")) || 100, 1, 500);

    const conversationItems = store.chat_conversations.filter((conversation) => conversationMatchesBooking(store, conversation, bookingId));
    const conversationMap = new Map(conversationItems.map((item) => [item.id, item]));
    const events = store.chat_events
      .filter((event) => conversationMap.has(event.conversation_id))
      .sort((a, b) => String(b.sent_at || b.created_at || "").localeCompare(String(a.sent_at || a.created_at || "")))
      .slice(0, limit);

    const items = events.map((event) => buildChatEventReadModel(event, conversationMap.get(event.conversation_id)));
    const conversations = conversationItems
      .map((conversation) => {
        const channel = normalizeText(conversation.channel).toLowerCase();
        const canonicalBookingId = resolveCanonicalConversationBookingId(store, conversation) || normalizeText(bookingId) || null;
        return {
          id: conversation.id,
          channel,
          external_contact_id: conversation.external_contact_id || null,
          booking_id: canonicalBookingId,
          related_bookings: buildConversationRelatedBookings(store, conversation, bookingId),
          last_event_at: conversation.last_event_at || null,
          latest_preview: conversation.latest_preview || null,
          open_url: getMetaConversationOpenUrl(channel, conversation.external_contact_id)
        };
      })
      .sort((a, b) => String(b.last_event_at || "").localeCompare(String(a.last_event_at || "")));

    sendJson(res, 200, {
      mode: "read_only",
      items,
      total: items.length,
      conversations,
      conversation_total: conversations.length
    });
  }

  return {
    handleListBookingChatEvents
  };
}
