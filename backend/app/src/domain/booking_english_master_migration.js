import { normalizeText } from "../lib/text.js";

const ENGLISH_SOURCE_LANG = "en";

function matchesPattern(value, pattern) {
  return pattern.test(String(value || "").trim());
}

function isLocalizedTextMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entries = Object.entries(value);
  return entries.length > 0 && entries.every(([key, entryValue]) =>
    /^[a-z]{2}$/i.test(String(key || "").trim())
    && (typeof entryValue === "string" || entryValue == null)
  );
}

function normalizeLocalizedMap(value) {
  if (!isLocalizedTextMap(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .map(([lang, entryValue]) => [String(lang || "").trim().toLowerCase(), normalizeText(entryValue)])
      .filter(([, entryValue]) => Boolean(entryValue))
  );
}

function collectMissingEnglishSourceMaps(value, currentPath, results) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => collectMissingEnglishSourceMaps(entry, `${currentPath}[${index}]`, results));
    return;
  }
  for (const [key, entryValue] of Object.entries(value)) {
    const nextPath = currentPath ? `${currentPath}.${key}` : key;
    if (/_i18n$/u.test(key) && isLocalizedTextMap(entryValue)) {
      const normalizedMap = normalizeLocalizedMap(entryValue);
      const populatedLanguages = Object.keys(normalizedMap);
      const siblingField = key.slice(0, -5);
      const siblingSourceText = normalizeText(value?.[siblingField]);
      if (populatedLanguages.length > 0 && !siblingSourceText && !populatedLanguages.includes(ENGLISH_SOURCE_LANG)) {
        results.push(nextPath);
      }
      continue;
    }
    collectMissingEnglishSourceMaps(entryValue, nextPath, results);
  }
}

function migrateLocalizedFieldPairs(value) {
  if (!value || typeof value !== "object") return 0;
  if (Array.isArray(value)) {
    return value.reduce((count, entry) => count + migrateLocalizedFieldPairs(entry), 0);
  }
  let fieldChanges = 0;
  for (const [key, entryValue] of Object.entries(value)) {
    if (/_i18n$/u.test(key) && isLocalizedTextMap(entryValue)) {
      const normalizedMap = normalizeLocalizedMap(entryValue);
      const siblingField = key.slice(0, -5);
      const englishText = normalizeText(normalizedMap[ENGLISH_SOURCE_LANG]);
      const currentPlainText = normalizeText(value?.[siblingField]);
      if (englishText && currentPlainText !== englishText) {
        value[siblingField] = englishText;
        fieldChanges += 1;
      }
      const strippedMap = Object.fromEntries(
        Object.entries(normalizedMap).filter(([lang]) => lang !== ENGLISH_SOURCE_LANG)
      );
      if (JSON.stringify(entryValue || {}) !== JSON.stringify(strippedMap)) {
        value[key] = strippedMap;
        fieldChanges += 1;
      }
      continue;
    }
    fieldChanges += migrateLocalizedFieldPairs(entryValue);
  }
  return fieldChanges;
}

function canonicalInstallmentLabel(value) {
  const normalized = normalizeText(value);
  if (!normalized) return "";
  const vietnameseMatch = normalized.match(/^(?:Đợt thanh toán|Dot thanh toan)\s+(\d+)$/i);
  if (vietnameseMatch) return `Installment ${vietnameseMatch[1]}`;
  const englishMatch = normalized.match(/^Installment\s+(\d+)$/i);
  if (englishMatch) return `Installment ${Math.max(1, Number(englishMatch[1] || 1))}`;
  if (/^Installment$/i.test(normalized)) return "Installment 1";
  return normalized;
}

function canonicalPaymentTermLabel(label, kind) {
  const normalized = normalizeText(label);
  if (!normalized) return "";
  const normalizedKind = normalizeText(kind).toUpperCase();
  if (normalizedKind === "DEPOSIT" && matchesPattern(normalized, /^(?:Deposit|Đặt cọc|Dat coc)$/i)) {
    return "Deposit";
  }
  if (normalizedKind === "FINAL_BALANCE" && matchesPattern(normalized, /^(?:Final payment|Thanh toán cuối cùng|Thanh toan cuoi cung)$/i)) {
    return "Final payment";
  }
  if (normalizedKind === "INSTALLMENT") {
    return canonicalInstallmentLabel(normalized);
  }
  return normalized;
}

function canonicalTripOrDayLabel(label, dayNumber = null) {
  const normalized = normalizeText(label);
  if (!normalized) return "";
  if (matchesPattern(normalized, /^(?:Trip total|Tổng chuyến đi|Tong chuyen di)$/i)) {
    return "Trip total";
  }
  const vietnameseDayMatch = normalized.match(/^(?:Ngày|Ngay)\s+(\d+)$/i);
  if (vietnameseDayMatch) return `Day ${vietnameseDayMatch[1]}`;
  const englishDayMatch = normalized.match(/^Day\s+(\d+)$/i);
  if (englishDayMatch) return `Day ${Math.max(1, Number(englishDayMatch[1] || 1))}`;
  if (Number.isInteger(Number(dayNumber)) && /^Day$/i.test(normalized)) {
    return `Day ${Math.max(1, Number(dayNumber))}`;
  }
  return normalized;
}

function canonicalAdditionalItemLabel(label) {
  const normalized = normalizeText(label);
  if (!normalized) return "";
  if (matchesPattern(normalized, /^(?:Additional item|Mục bổ sung|Muc bo sung)$/i)) {
    return "Additional item";
  }
  return normalized;
}

function canonicalAdditionalItemDetails(details) {
  const normalized = normalizeText(details);
  if (!normalized) return "";
  const lower = normalized.toLowerCase();
  if (
    lower === "carry-over surcharge"
    || lower === "carry over surcharge"
    || matchesPattern(normalized, /^(?:Phụ phí chuyển tiếp|Phu phi chuyen tiep)$/i)
  ) {
    return "Carry-over surcharge";
  }
  return normalized;
}

function migrateOfferLike(offer) {
  if (!offer || typeof offer !== "object" || Array.isArray(offer)) return 0;
  let fieldChanges = 0;

  if (offer.trip_price_internal && typeof offer.trip_price_internal === "object") {
    const nextLabel = canonicalTripOrDayLabel(offer.trip_price_internal.label);
    if (nextLabel && nextLabel !== offer.trip_price_internal.label) {
      offer.trip_price_internal.label = nextLabel;
      fieldChanges += 1;
    }
  }

  for (const dayPrice of Array.isArray(offer.days_internal) ? offer.days_internal : []) {
    const nextLabel = canonicalTripOrDayLabel(dayPrice?.label, dayPrice?.day_number);
    if (nextLabel && nextLabel !== dayPrice.label) {
      dayPrice.label = nextLabel;
      fieldChanges += 1;
    }
  }

  for (const item of Array.isArray(offer.additional_items) ? offer.additional_items : []) {
    const nextLabel = canonicalAdditionalItemLabel(item?.label);
    if (nextLabel && nextLabel !== item.label) {
      item.label = nextLabel;
      fieldChanges += 1;
    }
    const nextDetails = canonicalAdditionalItemDetails(item?.details);
    if (nextDetails && nextDetails !== item.details) {
      item.details = nextDetails;
      fieldChanges += 1;
    }
  }

  if (offer.payment_terms && typeof offer.payment_terms === "object") {
    fieldChanges += migratePaymentTermsSnapshot(offer.payment_terms);
  }

  return fieldChanges;
}

function migratePaymentTermsSnapshot(paymentTerms) {
  if (!paymentTerms || typeof paymentTerms !== "object" || Array.isArray(paymentTerms)) return 0;
  let fieldChanges = 0;
  for (const line of Array.isArray(paymentTerms.lines) ? paymentTerms.lines : []) {
    const nextLabel = canonicalPaymentTermLabel(line?.label, line?.kind);
    if (nextLabel && nextLabel !== line.label) {
      line.label = nextLabel;
      fieldChanges += 1;
    }
  }
  return fieldChanges;
}

export function migrateBookingCustomerContentToEnglishMaster(booking) {
  const unsupportedLocalizedPaths = [];
  collectMissingEnglishSourceMaps(booking, "", unsupportedLocalizedPaths);

  if (unsupportedLocalizedPaths.length) {
    return {
      changed: false,
      fieldChanges: 0,
      unsupportedLocalizedPaths
    };
  }

  let fieldChanges = 0;
  fieldChanges += migrateOfferLike(booking?.offer);
  fieldChanges += migrateOfferLike(booking?.accepted_offer_snapshot);
  fieldChanges += migratePaymentTermsSnapshot(booking?.accepted_payment_terms_snapshot);
  fieldChanges += migrateLocalizedFieldPairs(booking?.travel_plan);
  fieldChanges += migrateLocalizedFieldPairs(booking?.accepted_travel_plan_snapshot);
  fieldChanges += migrateLocalizedFieldPairs(booking?.pdf_personalization);

  for (const generatedOffer of Array.isArray(booking?.generated_offers) ? booking.generated_offers : []) {
    fieldChanges += migrateOfferLike(generatedOffer?.offer);
    fieldChanges += migratePaymentTermsSnapshot(generatedOffer?.payment_terms);
    fieldChanges += migrateLocalizedFieldPairs(generatedOffer?.travel_plan);
  }

  return {
    changed: fieldChanges > 0,
    fieldChanges,
    unsupportedLocalizedPaths
  };
}

export function migrateStoreBookingsToEnglishMaster(store) {
  const bookings = Array.isArray(store?.bookings) ? store.bookings : [];
  let bookingsChanged = 0;
  let fieldChanges = 0;
  const unsupportedBookings = [];

  for (const booking of bookings) {
    const result = migrateBookingCustomerContentToEnglishMaster(booking);
    if (result.unsupportedLocalizedPaths.length) {
      unsupportedBookings.push({
        bookingId: normalizeText(booking?.id) || "(missing-id)",
        paths: result.unsupportedLocalizedPaths
      });
      continue;
    }
    if (result.changed) bookingsChanged += 1;
    fieldChanges += result.fieldChanges;
  }

  return {
    changed: bookingsChanged > 0,
    bookingsScanned: bookings.length,
    bookingsChanged,
    fieldChanges,
    unsupportedBookings
  };
}
