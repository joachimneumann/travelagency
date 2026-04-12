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

  async function ensureOfferCleanState() {
    if (state.dirty.offer || state.dirty.payment_terms) {
      setOfferStatus("Save edits to enable.");
      return false;
    }
    return true;
  }

  async function persistOffer() {
    if (!state.booking || !state.permissions.canEditBooking) return true;
    if (!state.dirty.offer && !state.dirty.payment_terms) return true;
    clearOfferStatus();

    let offer;
    try {
      offer = collectOfferPayload();
    } catch (error) {
      setOfferStatus(String(error?.message || error));
      return false;
    }

    debugOffer("save:start", {
      booking_id: state.booking.id,
      expected_offer_revision: getBookingRevision("offer_revision"),
      offer
    });

    const request = bookingOfferRequest({ baseURL: apiOrigin, params: { booking_id: state.booking.id } });
    const result = await fetchBookingMutation(request.url, {
      method: request.method,
      body: {
        expected_offer_revision: getBookingRevision("offer_revision"),
        offer,
        actor: state.user,
        content_lang: bookingContentLang()
      }
    });

    debugOffer("save:response", result?.booking
      ? {
          unchanged: Boolean(result?.unchanged),
          offer_revision: result.booking.offer_revision,
          offer: {
            currency: result.booking.offer?.currency,
            discounts: Array.isArray(result.booking.offer?.discounts)
              ? result.booking.offer.discounts.map((discount) => ({
                  reason: discount.reason,
                  amount_cents: discount.amount_cents
                }))
              : [],
            days_internal: Array.isArray(result.booking.offer?.days_internal)
              ? result.booking.offer.days_internal.map((dayPrice) => ({
                  id: dayPrice.id,
                  day_number: dayPrice.day_number,
                  amount_cents: dayPrice.amount_cents
                }))
              : []
          }
        }
      : result);

    if (!result?.booking) {
      clearPendingTotals?.();
      updateOfferTotalsInDom?.();
      return false;
    }

    logOfferPaymentTermDueTypeMismatch?.(offer, result.booking);

    await applyOfferBookingResponse(result, { reloadActivities: true });
    setOfferSaveEnabled(false);
    return true;
  }

  async function saveOffer() {
    return await persistOffer();
  }

  return {
    ensureOfferCleanState,
    saveOffer
  };
}
