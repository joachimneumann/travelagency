import { bookingOfferRequest } from "../../Generated/API/generated_APIRequestFactory.js";
import { createQueuedAutosaveController } from "../shared/edit_state.js";
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

  const offerAutosaveController = createQueuedAutosaveController({
    delayMs: 350,
    isEnabled: () => state.permissions.canEditBooking && Boolean(state.booking),
    save: persistOffer
  });

  async function flushOfferAutosave() {
    const result = await offerAutosaveController.flush();
    return result === true ? true : Boolean(result?.booking);
  }

  function scheduleOfferAutosave() {
    offerAutosaveController.schedule();
  }

  async function persistOffer() {
    if (!state.booking || !state.permissions.canEditBooking) return true;
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
    const result = await fetchBookingMutation(request.url, {
      method: request.method,
      body: {
        expected_offer_revision: getBookingRevision("offer_revision"),
        offer,
        actor: state.user,
        lang: bookingContentLang()
      }
    });

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
    return result;
  }

  async function saveOffer() {
    return await offerAutosaveController.runNow();
  }

  return {
    flushOfferAutosave,
    scheduleOfferAutosave,
    saveOffer
  };
}
