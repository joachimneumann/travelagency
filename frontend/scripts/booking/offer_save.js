import { bookingOfferRequest } from "../../Generated/API/generated_APIRequestFactory.js";
import { bookingContentLang } from "./i18n.js";

export function createBookingOfferSaveController(ctx) {
  const {
    state,
    apiOrigin,
    fetchBookingMutation,
    getBookingRevision,
    clearOfferStatus,
    setOfferStatus,
    collectOfferPayload,
    applyOfferBookingResponse,
    debugOffer,
    clearPendingTotals,
    updateOfferTotalsInDom,
    logOfferPaymentTermDueTypeMismatch,
    setOfferSaveEnabled
  } = ctx;

  let offerAutosaveTimer = null;
  let offerAutosaveInFlight = false;
  let offerAutosavePending = false;
  let offerAutosavePromise = null;

  async function flushOfferAutosave() {
    if (offerAutosaveTimer) {
      window.clearTimeout(offerAutosaveTimer);
      offerAutosaveTimer = null;
      const result = await saveOffer();
      return Boolean(result?.booking);
    }
    if (offerAutosaveInFlight && offerAutosavePromise) {
      const result = await offerAutosavePromise;
      return Boolean(result?.booking);
    }
    if (offerAutosavePending) {
      offerAutosavePending = false;
      const result = await saveOffer();
      return Boolean(result?.booking);
    }
    return true;
  }

  function scheduleOfferAutosave() {
    if (!state.permissions.canEditBooking) return;
    if (offerAutosaveInFlight) {
      offerAutosavePending = true;
      return;
    }
    if (offerAutosaveTimer) window.clearTimeout(offerAutosaveTimer);
    offerAutosaveTimer = window.setTimeout(() => {
      offerAutosaveTimer = null;
      void saveOffer();
    }, 350);
  }

  async function saveOffer() {
    if (!state.booking || !state.permissions.canEditBooking) return;
    if (offerAutosaveInFlight) {
      offerAutosavePending = true;
      return offerAutosavePromise;
    }

    clearOfferStatus();

    let offer;
    try {
      offer = collectOfferPayload();
    } catch (error) {
      setOfferStatus(String(error?.message || error));
      return;
    }

    debugOffer("save:start", {
      booking_id: state.booking.id,
      expected_offer_revision: getBookingRevision("offer_revision"),
      offer
    });

    const request = bookingOfferRequest({ baseURL: apiOrigin, params: { booking_id: state.booking.id } });
    offerAutosaveInFlight = true;
    const runSave = async () => {
      let result;
      try {
        result = await fetchBookingMutation(request.url, {
          method: request.method,
          body: {
            expected_offer_revision: getBookingRevision("offer_revision"),
            offer,
            actor: state.user,
            lang: bookingContentLang()
          }
        });
      } finally {
        offerAutosaveInFlight = false;
      }

      debugOffer("save:response", result?.booking
        ? {
            unchanged: Boolean(result?.unchanged),
            offer_revision: result.booking.offer_revision,
            offer: {
              currency: result.booking.offer?.currency,
              discount: result.booking.offer?.discount
                ? {
                    reason: result.booking.offer.discount.reason,
                    amount_cents: result.booking.offer.discount.amount_cents
                  }
                : null,
              components: Array.isArray(result.booking.offer?.components)
                ? result.booking.offer.components.map((component) => ({
                    id: component.id,
                    category: component.category,
                    details: component.details,
                    quantity: component.quantity,
                    unit_amount_cents: component.unit_amount_cents
                  }))
                : []
            }
          }
        : result);

      if (!result?.booking) {
        clearPendingTotals?.();
        updateOfferTotalsInDom?.();
        return result;
      }

      logOfferPaymentTermDueTypeMismatch?.(offer, result.booking);

      await applyOfferBookingResponse(result, { reloadActivities: true });
      setOfferSaveEnabled(false);
      if (offerAutosavePending) {
        offerAutosavePending = false;
        scheduleOfferAutosave();
      }
      return result;
    };

    offerAutosavePromise = runSave();
    const result = await offerAutosavePromise;
    offerAutosavePromise = null;
    return result;
  }

  return {
    flushOfferAutosave,
    scheduleOfferAutosave,
    saveOffer
  };
}
