import { bookingChatRequest } from "../Generated/API/generated_APIRequestFactory.js";
import { escapeHtml, normalizeText } from "./shared/backend-common.js";

function normalizePhoneDigits(value) {
  return String(value || "").replace(/[^\d]/g, "");
}

function isLikelyPhoneMatch(left, right) {
  const leftDigits = normalizePhoneDigits(left);
  const rightDigits = normalizePhoneDigits(right);
  if (!leftDigits || !rightDigits) return false;
  if (leftDigits === rightDigits) return true;
  if (Math.min(leftDigits.length, rightDigits.length) < 7) return false;
  return leftDigits.endsWith(rightDigits) || rightDigits.endsWith(leftDigits);
}

function parseChatDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function formatChatTime(value) {
  const date = parseChatDate(value);
  if (!date) return "-";
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function chatDayKey(value) {
  const date = parseChatDate(value);
  if (!date) return "";
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatChatDayLabel(value) {
  const date = parseChatDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

function parseDeliveredStatusPayload(textPreview) {
  const text = String(textPreview || "").trim();
  const withMessage = text.match(/^Status:\s*([a-z_ ]+)\s*-\s*(.+)$/i);
  if (withMessage) {
    return { status: String(withMessage[1] || "").trim(), message: String(withMessage[2] || "").trim() };
  }
  const onlyStatus = text.match(/^Status:\s*(.+)$/i);
  if (onlyStatus) {
    return { status: String(onlyStatus[1] || "").trim(), message: "" };
  }
  return { status: "", message: "" };
}

function isSingleEmojiMessage(text) {
  const raw = String(text || "").trim();
  if (!raw) return false;
  const compact = raw.replace(/\s+/g, "");
  if (!compact) return false;
  let graphemes = [];
  if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    graphemes = [...segmenter.segment(compact)].map((part) => part.segment);
  } else {
    graphemes = Array.from(compact);
  }
  if (graphemes.length !== 1) return false;
  return /\p{Extended_Pictographic}/u.test(graphemes[0]);
}

function isDeliveredStatusText(text) {
  const status = String(text || "").trim().toLowerCase();
  return status === "delivered";
}

function buildDeliveredTicksMarkup(isDelivered) {
  if (!isDelivered) return "";
  return '<span class="wa-meta-ticks" aria-label="delivered">&#10003;</span>';
}

function buildThreadRows(items) {
  const orderedItems = [...(Array.isArray(items) ? items : [])].sort((left, right) => {
    const leftTime = String(left?.sent_at || left?.created_at || "");
    const rightTime = String(right?.sent_at || right?.created_at || "");
    return leftTime.localeCompare(rightTime);
  });

  let previousDay = "";
  return orderedItems
    .map((item) => {
      const direction = String(item?.direction || "").toLowerCase();
      const eventType = String(item?.event_type || "").toLowerCase();
      const sentAt = item?.sent_at || item?.created_at || item?.received_at;
      const day = chatDayKey(sentAt);
      const daySeparator =
        day && day !== previousDay
          ? `<div class="wa-day-sep"><span>${escapeHtml(formatChatDayLabel(sentAt))}</span></div>`
          : "";
      if (day) previousDay = day;

      let rowClass = eventType === "status" ? "is-status" : direction === "outbound" ? "is-out" : "is-in";
      let text = String(item?.text_preview || "-");
      const parsedStatus = parseDeliveredStatusPayload(text);
      let deliveredLine = "";
      let deliveredForMeta = false;
      if (eventType === "status" && parsedStatus.message) {
        text = parsedStatus.message;
        rowClass = "is-out";
        deliveredForMeta = isDeliveredStatusText(parsedStatus.status);
        deliveredLine = parsedStatus.status && !isDeliveredStatusText(parsedStatus.status)
          ? `<div class="wa-msg-status"><em>${escapeHtml(parsedStatus.status)}</em></div>`
          : "";
      } else if (eventType === "status" && parsedStatus.status) {
        text = "Status update";
        deliveredForMeta = isDeliveredStatusText(parsedStatus.status);
        deliveredLine = isDeliveredStatusText(parsedStatus.status)
          ? ""
          : `<div class="wa-msg-status"><em>${escapeHtml(parsedStatus.status)}</em></div>`;
      } else if (item?.external_status) {
        deliveredForMeta = isDeliveredStatusText(item.external_status);
        deliveredLine = isDeliveredStatusText(item.external_status)
          ? ""
          : `<div class="wa-msg-status"><em>${escapeHtml(String(item.external_status))}</em></div>`;
      }

      const safeText = escapeHtml(text);
      const time = escapeHtml(formatChatTime(sentAt));
      const bubbleClass = isSingleEmojiMessage(text) ? "wa-msg-bubble is-emoji" : "wa-msg-bubble";
      const metaLine = `${time}${buildDeliveredTicksMarkup(deliveredForMeta)}`;
      return `${daySeparator}<div class="wa-msg-row ${rowClass}">
        <div class="${bubbleClass}">
          <div class="wa-msg-text">${safeText}</div>
          ${deliveredLine}
          <div class="wa-msg-meta">${metaLine}</div>
        </div>
      </div>`;
    })
    .join("");
}

function sortChatEntries(entries) {
  return [...(Array.isArray(entries) ? entries : [])].sort((left, right) => {
    if (Boolean(left?.has_chat) !== Boolean(right?.has_chat)) {
      return left?.has_chat ? -1 : 1;
    }
    const activityCompare = String(right?.last_event_at || "").localeCompare(String(left?.last_event_at || ""));
    if (activityCompare !== 0) return activityCompare;
    return Number(left?.sort_order || 0) - Number(right?.sort_order || 0);
  });
}

export function createBookingWhatsAppController({
  apiOrigin,
  fetchApi,
  getBookingPersons,
  formatPersonRoleLabel,
  getPersonInitials,
  resolvePersonPhotoSrc,
  onNotice
}) {
  const state = {
    items: [],
    conversations: [],
    entries: [],
    active_entry_key: "",
    view: "list",
    initialized: false,
    pollTimer: null,
    isPolling: false
  };

  const els = {};

  function mount(root) {
    if (!root) return;
    root.innerHTML = `
      <article id="meta_chat_panel" class="wa-chat-panel" style="margin-bottom: 1rem;">
        <div class="wa-chat-shell" id="wa_chat_shell" data-chat-view="list">
          <section class="wa-chat-screen wa-chat-screen--list" aria-label="WhatsApp conversations">
            <div class="wa-chat-list-head">
              <h2 class="wa-chat-list-title">WhatsApp</h2>
              <p class="micro wa-chat-meta" id="meta_chat_summary">No WhatsApp data yet.</p>
            </div>
            <div id="wa_chat_contacts" class="wa-chat-contacts" role="list"></div>
          </section>
          <section class="wa-chat-screen wa-chat-screen--thread" aria-label="WhatsApp conversation">
            <div class="wa-chat-thread-head">
              <button class="wa-chat-back-btn" id="wa_chat_back_btn" type="button" aria-label="Back to WhatsApp contacts">&#8249;</button>
              <div class="wa-chat-thread-contact">
                <span class="wa-chat-thread-avatar" id="wa_chat_thread_avatar">P</span>
                <div class="wa-chat-thread-copy">
                  <div class="wa-chat-thread-title" id="wa_chat_thread_title">WhatsApp</div>
                  <div class="wa-chat-thread-subtitle" id="wa_chat_thread_subtitle"></div>
                </div>
              </div>
              <a class="wa-chat-open-btn" id="wa_chat_open_btn" href="#" target="_blank" rel="noopener" aria-label="Open in WhatsApp" title="Open in WhatsApp">
                <svg class="wa-chat-open-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M20 11.46C20 6.77 16.19 3 11.5 3S3 6.77 3 11.46c0 1.88.62 3.61 1.66 5L3.7 20.3l3.97-1.03a8.47 8.47 0 0 0 3.83.92c4.69 0 8.5-3.77 8.5-8.73Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M9.05 8.54c.18-.4.36-.4.53-.4h.45c.14 0 .37.05.57.48.2.43.66 1.47.72 1.57.06.1.1.24.02.39-.08.14-.12.24-.24.37-.12.13-.26.29-.37.39-.12.1-.24.22-.1.43.13.22.6.97 1.29 1.58.88.77 1.62 1.01 1.85 1.12.22.11.35.1.47-.06.13-.15.54-.62.69-.84.15-.21.3-.18.5-.11.2.07 1.29.62 1.51.73.22.11.37.17.42.27.05.1.05.61-.14 1.2-.19.59-1.12 1.13-1.55 1.19-.42.06-.95.09-1.53-.11-.36-.12-.81-.26-1.39-.51-2.43-1.05-4.02-3.63-4.14-3.8-.12-.16-.99-1.31-.99-2.5 0-1.19.62-1.77.84-2.01Z" fill="currentColor"/>
                </svg>
              </a>
            </div>
            <div class="wa-chat-canvas">
              <div id="meta_chat_table" class="wa-chat-list" role="log" aria-live="polite"></div>
            </div>
          </section>
        </div>
      </article>
    `;

    els.shell = root.querySelector("#wa_chat_shell");
    els.summary = root.querySelector("#meta_chat_summary");
    els.contacts = root.querySelector("#wa_chat_contacts");
    els.backBtn = root.querySelector("#wa_chat_back_btn");
    els.threadTitle = root.querySelector("#wa_chat_thread_title");
    els.threadSubtitle = root.querySelector("#wa_chat_thread_subtitle");
    els.threadAvatar = root.querySelector("#wa_chat_thread_avatar");
    els.openBtn = root.querySelector("#wa_chat_open_btn");
    els.table = root.querySelector("#meta_chat_table");

    els.contacts?.addEventListener("click", handleContactsClick);
    els.backBtn?.addEventListener("click", () => {
      setActiveView("list");
    });
  }

  function setActiveView(view) {
    state.view = view === "thread" ? "thread" : "list";
    els.shell?.setAttribute("data-chat-view", state.view);
  }

  function notifyNewChatMessages(items) {
    const count = Array.isArray(items) ? items.length : 0;
    if (!count) return;
    const newest = items[0];
    const summary = count === 1 ? "New WhatsApp message received." : `${count} new WhatsApp messages received.`;
    if (typeof onNotice === "function") onNotice(summary);

    if (!("Notification" in window)) return;
    const body = String(newest?.text_preview || "Open booking chat to read.");
    if (Notification.permission === "granted") {
      new Notification("WhatsApp message", { body });
      return;
    }
    if (Notification.permission === "default") {
      Notification.requestPermission().then((permission) => {
        if (permission === "granted") {
          new Notification("WhatsApp message", { body });
        }
      });
    }
  }

  function getChatEntryTitle(entry) {
    if (entry?.kind === "unknown") return "Unknown number";
    return normalizeText(entry?.person?.name) || "Unnamed person";
  }

  function getChatEntryAvatarMarkup(entry) {
    if (entry?.kind === "person" && normalizeText(entry?.person?.photo_ref)) {
      return `<img src="${escapeHtml(resolvePersonPhotoSrc(entry.person.photo_ref))}" alt="${escapeHtml(getChatEntryTitle(entry))}" />`;
    }
    const initialsSource = entry?.kind === "person"
      ? getChatEntryTitle(entry)
      : normalizeText(entry?.phone_number) || "U";
    return `<span>${escapeHtml(getPersonInitials(initialsSource))}</span>`;
  }

  function getChatEntryRoleSummary(entry) {
    if (entry?.kind !== "person") return "";
    const roles = Array.isArray(entry.person?.roles) ? entry.person.roles : [];
    if (!roles.length) return "";
    const labels = [];
    if (roles.includes("traveler")) labels.push("Traveler");
    labels.push(...roles.filter((role) => role !== "traveler").map(formatPersonRoleLabel));
    return labels.join(", ");
  }

  function getConversationOpenUrl(phoneNumber, fallbackUrl = "") {
    const digits = normalizePhoneDigits(phoneNumber);
    return digits ? `https://wa.me/${digits}` : normalizeText(fallbackUrl) || "";
  }

  function buildChatEntries(booking) {
    const persons = getBookingPersons(booking);
    const conversations = (Array.isArray(state.conversations) ? state.conversations : [])
      .filter((conversation) => String(conversation?.channel || "").toLowerCase() === "whatsapp");
    const conversationIds = new Set(conversations.map((conversation) => String(conversation?.id || "")).filter(Boolean));
    const conversationItemsMap = new Map();
    for (const item of Array.isArray(state.items) ? state.items : []) {
      const conversationId = String(item?.conversation_id || "");
      if (!conversationIds.has(conversationId)) continue;
      if (!conversationItemsMap.has(conversationId)) conversationItemsMap.set(conversationId, []);
      conversationItemsMap.get(conversationId).push(item);
    }
    for (const items of conversationItemsMap.values()) {
      items.sort((left, right) => String(left?.sent_at || left?.created_at || "").localeCompare(String(right?.sent_at || right?.created_at || "")));
    }

    const matchedConversationIds = new Set();
    const personEntries = persons.map((person, index) => {
      const matchedConversations = conversations
        .filter((conversation) => (Array.isArray(person.phone_numbers) ? person.phone_numbers : []).some((phone) => isLikelyPhoneMatch(phone, conversation.external_contact_id)))
        .sort((left, right) => String(right?.last_event_at || "").localeCompare(String(left?.last_event_at || "")));
      matchedConversations.forEach((conversation) => matchedConversationIds.add(String(conversation.id || "")));
      const latestConversation = matchedConversations[0] || null;
      const latestItems = latestConversation ? conversationItemsMap.get(String(latestConversation.id || "")) || [] : [];
      const latestPhone = normalizeText(latestConversation?.external_contact_id) || normalizeText(person.phone_numbers?.[0]) || "";
      return {
        key: `person:${person.id}`,
        kind: "person",
        person,
        phone_number: latestPhone,
        latest_preview: normalizeText(latestConversation?.latest_preview) || normalizeText(latestItems[latestItems.length - 1]?.text_preview) || "",
        last_event_at: normalizeText(latestConversation?.last_event_at) || "",
        has_chat: matchedConversations.length > 0,
        conversations: matchedConversations,
        items: matchedConversations.flatMap((conversation) => conversationItemsMap.get(String(conversation.id || "")) || []),
        open_url: getConversationOpenUrl(latestPhone, latestConversation?.open_url),
        sort_order: index
      };
    });

    const unknownEntries = conversations
      .filter((conversation) => !matchedConversationIds.has(String(conversation.id || "")))
      .map((conversation, index) => {
        const conversationId = String(conversation.id || "");
        const items = conversationItemsMap.get(conversationId) || [];
        const phoneNumber = normalizeText(conversation.external_contact_id) || "";
        return {
          key: `unknown:${conversationId}`,
          kind: "unknown",
          person: null,
          phone_number: phoneNumber,
          latest_preview: normalizeText(conversation.latest_preview) || normalizeText(items[items.length - 1]?.text_preview) || "",
          last_event_at: normalizeText(conversation.last_event_at) || "",
          has_chat: true,
          conversations: [conversation],
          items,
          open_url: getConversationOpenUrl(phoneNumber, conversation.open_url),
          sort_order: persons.length + index
        };
      });

    return sortChatEntries([...personEntries, ...unknownEntries]);
  }

  function getActiveEntry() {
    return state.entries.find((entry) => entry.key === state.active_entry_key) || null;
  }

  function handleContactsClick(event) {
    const contact = event.target.closest("[data-chat-entry-key]");
    if (!contact) return;
    const entryKey = contact.getAttribute("data-chat-entry-key");
    if (!entryKey) return;
    const nextEntry = state.entries.find((entry) => entry.key === entryKey);
    if (!nextEntry) return;
    state.active_entry_key = entryKey;
    setActiveView("thread");
    render();
  }

  function render() {
    if (!els.contacts || !els.table) return;
    const entries = state.entries;
    if (!entries.some((entry) => entry.key === state.active_entry_key)) {
      state.active_entry_key = entries[0]?.key || "";
    }
    const activeEntry = getActiveEntry();
    if (!activeEntry) {
      setActiveView("list");
    }

    if (els.summary) {
      const chatCount = entries.filter((entry) => entry.has_chat).length;
      const personCount = entries.filter((entry) => entry.kind === "person").length;
      const unknownCount = entries.filter((entry) => entry.kind === "unknown").length;
      const summaryParts = [
        `${chatCount} active WhatsApp ${chatCount === 1 ? "chat" : "chats"}`,
        `${personCount} booking ${personCount === 1 ? "person" : "persons"}`
      ];
      if (unknownCount) summaryParts.push(`${unknownCount} unknown ${unknownCount === 1 ? "number" : "numbers"}`);
      els.summary.textContent = summaryParts.join(" • ");
    }

    els.contacts.innerHTML = entries.length
      ? entries.map((entry) => {
          const isSelected = entry.key === state.active_entry_key && state.view === "thread";
          const title = getChatEntryTitle(entry);
          const timeLabel = entry.last_event_at ? formatChatTime(entry.last_event_at) : "";
          const roleSummary = entry.has_chat ? getChatEntryRoleSummary(entry) : "";
          const phoneLine = entry.has_chat ? normalizeText(entry.phone_number) : "";
          const preview = entry.has_chat ? normalizeText(entry.latest_preview) : "";
          const metaParts = [roleSummary, phoneLine].filter(Boolean);
          return `
            <button class="wa-chat-contact${isSelected ? " is-selected" : ""}" type="button" data-chat-entry-key="${escapeHtml(entry.key)}" role="listitem">
              <span class="wa-chat-contact__avatar">${getChatEntryAvatarMarkup(entry)}</span>
              <span class="wa-chat-contact__body">
                <span class="wa-chat-contact__top">
                  <span class="wa-chat-contact__name">${escapeHtml(title)}</span>
                  ${timeLabel ? `<span class="wa-chat-contact__time">${escapeHtml(timeLabel)}</span>` : ""}
                </span>
                ${entry.has_chat && metaParts.length ? `<span class="wa-chat-contact__meta">${escapeHtml(metaParts.join(" • "))}</span>` : ""}
                ${entry.has_chat && preview ? `<span class="wa-chat-contact__preview">${escapeHtml(preview)}</span>` : ""}
              </span>
            </button>
          `;
        }).join("")
      : '<div class="wa-empty">No booking persons or WhatsApp conversations yet.</div>';

    const threadTitle = activeEntry ? getChatEntryTitle(activeEntry) : "WhatsApp";
    const threadSubtitleParts = activeEntry
      ? [getChatEntryRoleSummary(activeEntry), normalizeText(activeEntry.phone_number)].filter(Boolean)
      : [];
    if (els.threadTitle) els.threadTitle.textContent = threadTitle;
    if (els.threadSubtitle) {
      els.threadSubtitle.innerHTML = threadSubtitleParts
        .map((part) => `<span class="wa-chat-thread-subtitle-part">${escapeHtml(part)}</span>`)
        .join("");
      els.threadSubtitle.hidden = !threadSubtitleParts.length;
    }
    if (els.threadAvatar) {
      els.threadAvatar.innerHTML = activeEntry ? getChatEntryAvatarMarkup(activeEntry) : "P";
    }
    if (els.openBtn) {
      const openUrl = normalizeText(activeEntry?.open_url);
      els.openBtn.href = openUrl || "#";
      els.openBtn.setAttribute("aria-disabled", openUrl ? "false" : "true");
      els.openBtn.tabIndex = openUrl ? 0 : -1;
    }

    const rows = activeEntry?.has_chat
      ? buildThreadRows(activeEntry.items)
      : activeEntry
        ? `<div class="wa-empty">No WhatsApp messages with ${escapeHtml(threadTitle)} yet.</div>`
        : '<div class="wa-empty">Select a booking person to view WhatsApp messages.</div>';
    els.table.innerHTML = rows;
    const canvas = els.table.parentElement;
    if (canvas && activeEntry?.has_chat) {
      canvas.scrollTop = canvas.scrollHeight;
    }
  }

  async function load(booking, { fromPoll = false } = {}) {
    if (!booking || !els.table) return;
    const previousIds = new Set((Array.isArray(state.items) ? state.items : []).map((item) => String(item?.id || "")));
    const payload = await fetchApi(
      bookingChatRequest({
        baseURL: apiOrigin,
        params: { booking_id: booking.id },
        query: { limit: 100 }
      }).url
    );
    if (!payload) return;
    const nextItems = Array.isArray(payload.items) ? payload.items : [];
    const newlyArrived = nextItems.filter((item) => {
      const id = String(item?.id || "");
      return id && !previousIds.has(id);
    });
    const inboundNew = newlyArrived.filter((item) => String(item?.direction || "").toLowerCase() === "inbound");
    state.items = nextItems;
    state.conversations = Array.isArray(payload.conversations) ? payload.conversations : [];
    state.entries = buildChatEntries(booking);
    render();
    if (fromPoll && state.initialized && inboundNew.length) {
      notifyNewChatMessages(inboundNew);
    }
    state.initialized = true;
  }

  function rerender(booking) {
    state.entries = buildChatEntries(booking);
    render();
  }

  function startAutoRefresh(getBooking) {
    if (state.pollTimer) return;
    state.pollTimer = window.setInterval(async () => {
      if (state.isPolling) return;
      const booking = typeof getBooking === "function" ? getBooking() : null;
      if (!booking) return;
      state.isPolling = true;
      try {
        await load(booking, { fromPoll: true });
      } finally {
        state.isPolling = false;
      }
    }, 10000);
  }

  function stopAutoRefresh() {
    if (state.pollTimer) {
      window.clearInterval(state.pollTimer);
      state.pollTimer = null;
    }
  }

  return {
    mount,
    load,
    rerender,
    startAutoRefresh,
    stopAutoRefresh
  };
}
