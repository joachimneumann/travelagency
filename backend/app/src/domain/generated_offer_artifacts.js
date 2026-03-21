import { readFile } from "node:fs/promises";
import { sha256Hex } from "./offer_acceptance.js";

export function collapseGeneratedOfferPaymentTermsState(store) {
  const bookings = Array.isArray(store?.bookings) ? store.bookings : [];
  let changed = false;
  for (const booking of bookings) {
    const generatedOffers = Array.isArray(booking?.generated_offers) ? booking.generated_offers : [];
    for (const generatedOffer of generatedOffers) {
      if (!generatedOffer || typeof generatedOffer !== "object") continue;
      const legacyPaymentTerms = generatedOffer.payment_terms;
      if (!legacyPaymentTerms) continue;
      if (!generatedOffer.offer || typeof generatedOffer.offer !== "object") {
        generatedOffer.offer = {};
      }
      if (!generatedOffer.offer.payment_terms) {
        generatedOffer.offer.payment_terms = legacyPaymentTerms;
      }
      delete generatedOffer.payment_terms;
      changed = true;
    }
  }
  return changed;
}

export function createGeneratedOfferArtifactHelpers({
  baseCurrency,
  normalizeText,
  normalizePdfLang,
  nowIso,
  normalizeBookingOffer,
  buildBookingOfferPaymentTermsReadModel,
  normalizeBookingTravelPlan,
  generatedOfferPdfPath,
  writeGeneratedOfferPdf,
  persistStore,
  readFileImpl = readFile
}) {
  function normalizeGeneratedOfferSnapshot(generatedOffer, booking) {
    const snapshotLang = normalizePdfLang(
      generatedOffer?.lang
      || booking?.customer_language
      || (Array.isArray(booking?.persons)
        ? booking.persons.find((person) => Array.isArray(person?.roles) && person.roles.includes("primary_contact"))?.preferred_language
        : null)
      || booking?.web_form_submission?.preferred_language
      || "en"
    );
    const snapshotCurrency = normalizeText(
      generatedOffer?.currency
      || generatedOffer?.offer?.currency
      || booking?.offer?.currency
      || booking?.preferred_currency
      || baseCurrency
    ) || baseCurrency;
    const offerSnapshot = normalizeBookingOffer(generatedOffer?.offer, snapshotCurrency, {
      contentLang: snapshotLang,
      flatLang: snapshotLang
    });
    const paymentTerms = buildBookingOfferPaymentTermsReadModel(
      offerSnapshot.payment_terms || null,
      offerSnapshot.currency || snapshotCurrency,
      Number(generatedOffer?.total_price_cents || offerSnapshot.total_price_cents || 0)
    );
    return {
      ...generatedOffer,
      lang: snapshotLang,
      currency: offerSnapshot.currency || snapshotCurrency,
      total_price_cents: Number(generatedOffer?.total_price_cents || offerSnapshot.total_price_cents || 0),
      ...(paymentTerms ? { payment_terms: paymentTerms } : {}),
      offer: offerSnapshot,
      travel_plan: normalizeBookingTravelPlan(generatedOffer?.travel_plan, offerSnapshot, {
        lang: snapshotLang,
        strictReferences: false
      })
    };
  }

  async function ensureFrozenGeneratedOfferPdf(generatedOffer, booking, options = {}) {
    const { store = null, persistMetadata = true } = options;
    const pdfPath = generatedOfferPdfPath(generatedOffer.id);
    const storedFrozenAt = normalizeText(generatedOffer?.pdf_frozen_at);

    try {
      const pdfBuffer = await readFileImpl(pdfPath);
      const sha256 = sha256Hex(pdfBuffer);
      let metadataChanged = false;
      if (!storedFrozenAt) {
        generatedOffer.pdf_frozen_at = normalizeText(generatedOffer?.created_at) || nowIso();
        metadataChanged = true;
      }
      if (normalizeText(generatedOffer?.pdf_sha256) !== sha256) {
        generatedOffer.pdf_sha256 = sha256;
        metadataChanged = true;
      }
      if (metadataChanged && store && persistMetadata) {
        await persistStore(store);
      }
      return { pdfPath, sha256, existed: true };
    } catch (error) {
      if (storedFrozenAt) {
        throw new Error("Frozen generated offer PDF artifact is missing.");
      }
    }

    const snapshot = normalizeGeneratedOfferSnapshot(generatedOffer, booking);
    const artifact = await writeGeneratedOfferPdf(snapshot, booking);
    generatedOffer.pdf_frozen_at = nowIso();
    generatedOffer.pdf_sha256 = artifact?.sha256 || null;
    if (store && persistMetadata) {
      await persistStore(store);
    }
    return {
      pdfPath: artifact?.outputPath || pdfPath,
      sha256: artifact?.sha256 || null,
      existed: false
    };
  }

  return {
    normalizeGeneratedOfferSnapshot,
    ensureFrozenGeneratedOfferPdf
  };
}
