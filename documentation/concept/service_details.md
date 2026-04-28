# Marketing Tour Service Details Plan

## Goal

Add `details` and `details_i18n` to travel-plan services in marketing tours, consistently with booking travel plans, while reusing the existing shared travel-plan editor and normalization code.

Marketing-tour service details should be editable, stored on the tour, translated, searchable/importable, and copied into bookings when a marketing tour is applied or imported.

## Current State

The shared travel-plan normalizer already reads service `details` and `details_i18n`, but marketing-tour normalization strips them before storage.

Current model split:

- `TravelPlanService` is the base service model used by marketing tours.
- `BookingTravelPlanService` is an alias of `TravelPlanService`; booking-only copy provenance has been removed.
- The marketing-tour adapter previously disabled service details in the shared editor with `serviceDetails: false`.

Important current locations:

- `model/database/travel_plan.cue`
- `backend/app/src/domain/travel_plan.js`
- `frontend/scripts/pages/tour_travel_plan_adapter.js`
- `frontend/scripts/shared/travel_plan_editor_core.js`
- `frontend/scripts/pages/tour.js`
- `backend/app/src/http/handlers/tours.js`
- `backend/app/src/http/handlers/marketing_tour_booking_travel_plan.js`

## Implementation Plan

1. Move `details` into the shared service model.

   Update `model/database/travel_plan.cue` so `#TravelPlanService` includes:

   ```cue
   details?: string
   details_i18n?: [string]: string
   ```

   Then remove those two fields from `#BookingTravelPlanService`, leaving it as the shared service model.

2. Regenerate contracts.

   Run the existing model/API generation flow so generated schema files include `details` and `details_i18n` on the base `TravelPlanService`.

   Expected generated areas may include:

   - `model/ir/normalized.cue`
   - `shared/generated-contract/Models/generated_SchemaRuntime.js`
   - API/OpenAPI generated files if `TravelPlanService` is exposed there.

3. Stop stripping details from marketing-tour travel plans.

   Update `backend/app/src/domain/travel_plan.js`.

   The current `stripBookingFieldsFromTravelPlanDay()` removes service `details` and `details_i18n`. Change it to strip only truly booking-specific fields:

   - day `date`
   - day `date_string`
   - day `copied_from`
   - service `copied_from`

   Rename the helper to `stripBookingOnlyFieldsFromTravelPlanDay()` for clarity.

4. Enable service details in the reused marketing-tour editor.

   Update `frontend/scripts/pages/tour_travel_plan_adapter.js`:

   ```js
   serviceDetails: true
   ```

   This reuses the existing details field rendering and DOM collection in `frontend/scripts/shared/travel_plan_editor_core.js`.

5. Include details in marketing-tour translation.

   Update `frontend/scripts/pages/tour.js` in `collectTravelPlanTranslationFields()`.

   Add service `details/details_i18n`, mirroring the booking translation collector in `backend/app/src/domain/booking_translation.js`.

6. Preserve details during marketing-tour imports.

   Update `backend/app/src/http/handlers/tours.js`.

   `copyMarketingTourServiceForImport()` should copy:

   - `details`
   - `details_i18n`

   This keeps "copy existing day/service" behavior consistent between marketing tours.

7. Copy details when applying or importing a marketing tour into a booking.

   Update `backend/app/src/http/handlers/marketing_tour_booking_travel_plan.js`.

   `cloneMarketingTourServiceForBooking()` currently sets:

   ```js
   details: null,
   details_i18n: {}
   ```

   Change it to clone the marketing-tour service details into the booking.

8. Confirm service search behavior.

   `TourTravelPlanServiceSearchResult` already exposes `details` in `model/api/responses.cue`, and `backend/app/src/http/handlers/tours.js` already returns `details` in service search results.

   Once details are preserved in marketing-tour plans, search results should include them naturally.

## Tradeoff

Moving `details` into `TravelPlanService` means marketing-tour details may also appear in public marketing-tour API responses.

That is consistent if service details are intended to be part of public tour content. If details should be backend-template-only, add an explicit public read-model filter instead of keeping the field out of the shared model.

## Tests

Add or adjust tests for:

- Marketing-tour normalization preserves `details` and `details_i18n`.
- Booking normalization still preserves service details.
- Marketing-tour save/read roundtrip keeps details.
- Marketing-tour translation collector includes service details.
- Applying a marketing tour to a booking copies service details.
- Importing a marketing-tour service/day copies service details.

## Verification

Run:

```bash
node --check frontend/scripts/pages/tour.js
node --check frontend/scripts/pages/tour_travel_plan_adapter.js
npm test
```

Also run the contract/source-integrity tests if generated model/API artifacts change.
