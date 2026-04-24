# Two Tours Restructuring Plan

## Goal

Move from three tour concepts to two:

- Bookings stay the operational, customer-specific trip record. They keep real travelers, dates, offer/payment flow, generated PDFs, and booking-owned revision handling.
- Marketing tours become the reusable public trip template. They keep the current marketing content and additionally gain a basic reusable travel plan.
- Standard tours disappear as a separate entity, page, API, storage collection, and navigation item.

The travel-plan editor should be shared as much as practical between bookings and marketing tours. The marketing-tour version should feel like the same editor, but without booking-only concepts such as real dates, booking imports, attachments, generated PDFs, offer coupling, or activity logs.

## Current State

Bookings already own the full operational travel plan:

- Schema: `model/database/travel_plan.cue`
- Booking schema link: `model/database/booking.cue`
- Domain helpers: `backend/app/src/domain/travel_plan.js`
- Booking HTTP handlers: `backend/app/src/http/handlers/booking_travel_plan*.js`
- Frontend editor: `frontend/scripts/booking/travel_plan.js`
- Frontend helpers: `frontend/scripts/booking/travel_plan_helpers.js`

Standard tours already reuse much of the booking travel-plan editor:

- Schema: `model/json/standard_tour.cue`
- Domain helpers: `backend/app/src/domain/standard_tours.js`
- HTTP handlers: `backend/app/src/http/handlers/standard_tours.js`
- Pages: `frontend/pages/standard-tours.html`, `frontend/pages/standard-tour.html`
- Frontend wrapper: `frontend/scripts/shared/standard_tour_editor.js`

That wrapper is important because it proves the booking travel-plan UI can be reused outside an actual booking. Today it disables imports and image upload. For the new design, this wrapper should evolve into the marketing-tour travel-plan adapter.

Marketing tours currently contain marketing content only:

- Schema: `model/json/tour.cue`
- Backend helpers: `backend/app/src/domain/tours_support.js`
- HTTP handlers: `backend/app/src/http/handlers/tours.js`
- Editor page: `frontend/pages/marketing_tour.html`
- Editor script: `frontend/scripts/pages/tour.js`
- Storage: `content/tours/{tour_id}/tour.json`
- Media: `content/tours/{tour_id}/...`, served through `/public/v1/tour-images/...`
- Public homepage generation: `scripts/assets/generate_public_homepage_assets.mjs`

## Target Model

Use one travel-plan shape for both booking and marketing-tour plans, with different validation and UI modes.

The existing `BookingTravelPlan` structure is a good base:

```text
travel_plan
  destinations[]
  days[]
    id
    day_number
    date?
    date_string?
    title
    title_i18n?
    overnight_location?
    overnight_location_i18n?
    notes?
    notes_i18n?
    services[]
      id
      timing_kind
      time_label?
      time_label_i18n?
      kind
      title?
      title_i18n?
      details?
      details_i18n?
      location?
      location_i18n?
      image?
```

For marketing tours, apply stricter normalization:

- `days.length` is the number of days. Do not add a separate duration field unless we later need empty-day scaffolding without day records.
- Day `date` is always empty/null in storage.
- Date-specific service fields (`time_point`, `start_time`, `end_time`) are either hidden in the UI or normalized away for v1.
- `attachments` are always empty for marketing tours.
- `copied_from` metadata is stripped for marketing tours.
- Service images are allowed, but stored under the tour media tree, not booking media.

The CUE layer should introduce a shared travel-plan type instead of continuing to make file-backed content import a booking-named type:

- Add a shared `#TravelPlan` and related day/service/image types, probably in `model/database/travel_plan.cue` initially to minimize churn.
- Keep `#BookingTravelPlan` as an alias or wrapper for compatibility.
- Add `#MarketingTourTravelPlan` as the constrained form used by `#Tour`.
- Extend `model/json/tour.cue` with `travel_plan?: #MarketingTourTravelPlan`.
- Remove `model/json/standard_tour.cue` after migration.

## Backend Plan

### 1. Split Generic Travel-Plan Logic From Booking Logic

Keep `backend/app/src/domain/travel_plan.js` as the normalization/validation center, but make the mode explicit:

- `normalizeTravelPlan(raw, options)`
- `normalizeBookingTravelPlan(raw, offer, options)`
- `normalizeMarketingTourTravelPlan(raw, options)`
- `validateBookingTravelPlanInput(raw, offer, options)`
- `validateMarketingTourTravelPlanInput(raw, options)`

Booking mode keeps real dates, attachments, copied provenance, and booking translation behavior.

Marketing-tour mode strips dates, attachments, copied provenance, and booking-only metadata.

### 2. Extend Marketing Tour APIs

Extend existing tour payloads instead of creating another top-level resource:

- `GET /api/v1/tours`
- `GET /api/v1/tours/{tour_id}`
- `POST /api/v1/tours`
- `PATCH /api/v1/tours/{tour_id}`

Add `travel_plan` to the tour request/response contracts:

- `model/api/requests.cue`: `TourUpsertRequest.travel_plan?`
- `model/api/responses.cue`: `TourResponse` and `TourDetail` through `jsonModel.#Tour`
- `model/json/tour.cue`: `travel_plan?`

Add dedicated travel-plan endpoints for tour service images, because the existing booking image endpoints mutate booking state and write to booking image storage:

- `PATCH /api/v1/tours/{tour_id}/travel-plan`
- `POST /api/v1/tours/{tour_id}/travel-plan/days/{day_id}/services/{service_id}/image`
- `DELETE /api/v1/tours/{tour_id}/travel-plan/days/{day_id}/services/{service_id}/image`

These should reuse the same image conversion pipeline as bookings, but write to:

```text
content/tours/{tour_id}/travel-plan-services/{generated_name}.webp
```

The stored `storage_path` should be:

```text
/public/v1/tour-images/{tour_id}/travel-plan-services/{generated_name}.webp
```

### 3. Replace Standard-Tour Apply With Marketing-Tour Apply

Standard tours currently act as templates that can replace a booking travel plan. Marketing tours should take over that job.

Add a replacement endpoint:

```text
POST /api/v1/bookings/{booking_id}/travel-plan/tours/{tour_id}/apply
```

It should clone the marketing-tour plan into the booking:

- Generate new booking-local day IDs.
- Generate new booking-local service IDs.
- Set booking day dates to null unless the UI later asks the user to choose a start date during import.
- Strip marketing-only/public-only fields if any are added later.
- Copy service images into booking image storage and rewrite paths to `/public/v1/booking-images/...`.

Copying images is preferable to referencing `/public/v1/tour-images/...` from booking plans because the PDF renderer currently resolves service images from booking image storage. It also makes accepted booking snapshots less dependent on later marketing-tour edits.

### 4. Retire Standard-Tour Backend

After migration and UI replacement:

- Remove `backend/app/src/domain/standard_tours.js`.
- Remove `backend/app/src/http/handlers/standard_tours.js`.
- Remove `readStandardTours`, `persistStandardTour`, and `deleteStandardTour` from `backend/app/src/lib/store_utils.js`.
- Remove `STANDARD_TOURS_DIR` from runtime config unless kept temporarily for migration.
- Remove `/api/v1/standard-tours` routes and generated API definitions.
- Remove standard-tour tests or rewrite them to marketing-tour travel-plan tests.

## Frontend Plan

### 1. Turn The Standard-Tour Wrapper Into A Generic Adapter

The current `frontend/scripts/shared/standard_tour_editor.js` should become a generic travel-plan editor adapter, for example:

```text
frontend/scripts/shared/travel_plan_editor_adapter.js
```

The adapter should wrap `createBookingTravelPlanModule`, but accept a context:

```text
{
  mode: "booking" | "marketing_tour",
  features: {
    dates,
    dayImport,
    planImport,
    tourImport,
    serviceImport,
    imageUpload,
    attachments,
    pdfs,
    translation
  },
  persistence: {
    saveTravelPlan,
    uploadServiceImage,
    deleteServiceImage
  }
}
```

Booking mode uses the existing booking endpoints and keeps all existing behavior.

Marketing-tour mode should use the same day/service rendering where possible, with these differences:

- Hide date controls.
- Hide renumber-days, attachments, PDFs, booking plan imports, booking day imports, and booking service imports.
- Allow creating, reordering, and removing days/services.
- Allow service image upload/delete through tour endpoints.
- Treat `days.length` as the displayed day count.

### 2. Embed The Travel Plan In `marketing_tour.html`

Add the travel-plan panel to the marketing tour editor page below the current marketing fields:

- Existing gallery/video/title/description/destination/style fields stay on the same page.
- New travel-plan section uses the shared editor adapter.
- The page dirty bar should include both marketing fields and travel-plan changes.
- Save should persist both marketing fields and travel plan, or call a dedicated tour travel-plan endpoint after the main save.

The tour page will need the mounts currently missing from `standard-tour.html` if service images are enabled:

- Hidden file input for service images.
- Image preview modal.
- Travel-plan status mount.

### 3. Update Booking Import UI

Replace "Standard tours" with "Marketing tours" wherever booking travel-plan templates are offered.

Likely changes:

- `frontend/scripts/booking/travel_plan_service_library.js`
- `frontend/scripts/booking/travel_plan.js`
- backend i18n keys under `booking.travel_plan.*standard_tour*`

The library mode can keep the same card layout, but it should query tours and show:

- marketing title
- destinations/styles
- day count
- service count
- first service image or main tour image

## Public Website Plan

The public homepage currently displays tour cards from generated static JSON. Add travel-plan data only after the backend/editor migration is stable.

Public payload options:

- Include a trimmed, localized `travel_plan` in `public-tours.{lang}.json`.
- Strip internal IDs only if no frontend interactions need them; otherwise keep stable IDs.
- Strip attachments, copied provenance, and all booking-only metadata.
- Convert service image URLs to generated static asset URLs.

Public UI options:

- Expand the existing "more" overlay into a tour detail overlay that can show overview text plus day-by-day plan.
- Keep cards compact and show only title, description, tags, gallery, and CTA on the grid.
- Consider dedicated SEO pages later, but do not make that part of the first migration.

The homepage asset generator must be taught to copy nested tour service images, not just top-level tour images.

## Migration Plan

### 1. Add The New Field First

Add `travel_plan` to marketing tours while standard tours still exist. This makes the change backwards compatible and lets editors begin filling marketing-tour plans.

### 2. Dry-Run Standard-Tour Migration

Create a migration script that reads:

```text
content/standard_tours/*/standard_tour.json
```

and produces a report:

- standard tour ID
- title
- destinations
- day count
- service count
- image count
- suggested matching marketing tour ID, if any
- unresolved images

Matching should be conservative:

- Prefer an explicit mapping file for important tours.
- Use normalized title matching as a fallback.
- If no match exists, create a new marketing tour draft with the standard-tour title and travel plan.

### 3. Copy Plans Into Marketing Tours

For each migrated standard tour:

- Normalize through marketing-tour mode.
- Strip dates, attachments, and copied provenance.
- Copy service images into the destination tour folder when the source file can be resolved.
- Rewrite service image paths to `/public/v1/tour-images/...`.
- Preserve the original standard tour ID in temporary migration metadata, for audit only.

Do not delete `content/standard_tours` in the same step. Keep it until the migrated marketing tours have been reviewed.

### 4. Switch Booking Template Import

After marketing tours have travel plans:

- Switch booking imports from `/api/v1/standard-tours` to `/api/v1/tours`.
- Replace the apply endpoint with the marketing-tour apply endpoint.
- Remove the standard-tour navigation item.

### 5. Remove Standard Tours

After testing and content review:

- Delete standard-tour pages and scripts.
- Delete standard-tour backend routes and handlers.
- Delete standard-tour CUE contracts.
- Remove standard-tour generated API client methods.
- Remove Caddy entries for `standard-tours.html` and `standard-tour.html`, or leave redirects to `marketing_tours.html` for one release.
- Remove standard-tour i18n keys after references are gone.
- Archive `content/standard_tours` outside runtime content.

## Implementation Phases

### Phase 1: Contracts And Normalization

- Add `travel_plan` to `Tour`.
- Add marketing-tour travel-plan normalization/validation.
- Keep standard tours operational.
- Regenerate API artifacts.
- Add tests for marketing-tour plan normalization.

### Phase 2: Marketing-Tour Backend Endpoints

- Persist tour `travel_plan`.
- Add tour travel-plan PATCH endpoint.
- Add tour service-image upload/delete endpoints.
- Add tests for save, image upload, image delete, and public image serving.

### Phase 3: Shared Frontend Editor

- Replace `standard_tour_editor.js` with a generic adapter.
- Keep booking behavior unchanged.
- Mount the adapter in `marketing_tour.html`.
- Hide marketing-tour date/booking-only controls.
- Enable marketing-tour service image upload.

### Phase 4: Booking Template Import

- Add marketing-tour apply endpoint for bookings.
- Copy tour service images into booking image storage during apply.
- Update booking import UI labels and calls.
- Add tests that applying a marketing tour creates a valid booking travel plan and renders service images in PDFs.

### Phase 5: Content Migration

- Dry-run migration and review report.
- Apply migration.
- Regenerate homepage assets.
- Review migrated plans in the marketing-tour editor.

### Phase 6: Remove Standard Tours

- Remove standard-tour backend/frontend/contracts/navigation.
- Remove or redirect standard-tour pages.
- Remove standard-tour generated API methods.
- Clean i18n and source-integrity tests.

### Phase 7: Public Display

- Add localized travel-plan data to generated public tour JSON.
- Add day-by-day plan display to the public tour detail overlay.
- Ensure generated static assets include nested service images.

## Files Likely To Change

Contracts and models:

- `model/json/tour.cue`
- `model/json/standard_tour.cue`
- `model/database/travel_plan.cue`
- `model/api/requests.cue`
- `model/api/responses.cue`
- `model/api/endpoints.cue`
- generated API artifacts under `api/generated`, `frontend/Generated`, `backend/app/Generated`, and `shared/generated-contract`

Backend:

- `backend/app/src/domain/travel_plan.js`
- `backend/app/src/domain/tours_support.js`
- `backend/app/src/domain/standard_tours.js`
- `backend/app/src/http/handlers/tours.js`
- `backend/app/src/http/handlers/standard_tours.js`
- `backend/app/src/http/handlers/booking_travel_plan_import.js`
- `backend/app/src/http/handlers/booking_travel_plan_images.js`
- `backend/app/src/http/routes.js`
- `backend/app/src/lib/store_utils.js`
- `backend/app/src/config/runtime.js`
- `scripts/assets/generate_public_homepage_assets.mjs`

Frontend:

- `frontend/pages/marketing_tour.html`
- `frontend/pages/marketing_tours.html`
- `frontend/pages/standard-tour.html`
- `frontend/pages/standard-tours.html`
- `frontend/scripts/pages/tour.js`
- `frontend/scripts/pages/tours_list.js`
- `frontend/scripts/pages/standard_tour.js`
- `frontend/scripts/pages/standard_tours.js`
- `frontend/scripts/shared/standard_tour_editor.js`
- `frontend/scripts/shared/nav.js`
- `frontend/scripts/booking/travel_plan.js`
- `frontend/scripts/booking/travel_plan_helpers.js`
- `frontend/scripts/booking/travel_plan_images.js`
- `frontend/scripts/booking/travel_plan_service_library.js`

Styling and content:

- `shared/css/pages/backend-booking-travel-plan.css`
- `frontend/data/i18n/backend/en.json`
- `frontend/data/i18n/backend/vi.json`
- `deploy/Caddyfile`
- `deploy/Caddyfile.local`
- `content/tours`
- `content/standard_tours`

Tests:

- `backend/app/test/http_routes.test.js`
- `backend/app/test/tours_support.test.js`
- `backend/app/test/tour_catalog_i18n.test.js`
- `backend/app/test/booking_travel_plan_pdf_handlers.test.js`
- `backend/app/test/travel_plan_pdf_artifacts.test.js`
- `backend/app/test/source-integrity.test.js`

## Verification Checklist

- Existing booking travel-plan editing still saves, reloads, imports, uploads images, creates PDFs, and handles revision conflicts.
- Marketing-tour editor can create days and services without dates.
- Marketing-tour service images upload, display, persist, and are served through `/public/v1/tour-images/...`.
- Applying a marketing tour to a booking creates a booking-local copy of the plan.
- Applied booking plans use booking-local image paths so travel-plan PDFs include service images.
- Public homepage asset generation still works before public travel-plan display is added.
- After public display is added, static generated JSON includes localized plan content and valid service image URLs.
- No standard-tour route, nav item, CUE type, API operation, generated API method, or page remains after the removal phase.

## Open Decisions

- Whether marketing-tour travel-plan text should use the same full translation behavior as booking plans in v1, or stay source-language only until public display needs translations.
- Whether applying a marketing tour to a booking should allow the user to choose a start date and auto-fill day dates immediately, or import without dates and let staff set dates later.
- Whether migrated standard tours without matching marketing media should become unpublished/draft marketing tours or be merged manually into existing marketing tours.
- Whether old `standard-tours.html` URLs should hard-redirect to `marketing_tours.html` for one release or be removed immediately.
