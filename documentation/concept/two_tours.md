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

Use CUE composition rather than an object-oriented inheritance model. The model should introduce a neutral base travel plan and then refine it for booking-specific needs.

The base plan should represent the reusable itinerary content:

```cue
#TravelPlan: {
	video?: #TravelPlanVideo
	days?: [...#TravelPlanDay]
}

#TravelPlanVideo: {
	storage_path?: string
	title?:        string
}

#TravelPlanDay: {
	id:         common.#Identifier
	day_number: >0 & int
	title?:    string
	services?: [...#TravelPlanService]
	...
}

#TravelPlanService: {
	id:    common.#Identifier
	title: string
	image?: #TravelPlanServiceImage
	...
}
```

The booking plan should refine the base with operational fields:

```cue
#BookingTravelPlan: #TravelPlan & {
	days?: [...#BookingTravelPlanDay]
	attachments?: [...#BookingTravelPlanAttachment]
}

#BookingTravelPlanDay: #TravelPlanDay & {
	date?:        common.#DateOnly
	date_string?: string
	services?: [...#BookingTravelPlanService]
}

#BookingTravelPlanService: #TravelPlanService & {
	details?:      string
	details_i18n?: [string]: string
}
```

Marketing tours should use `#TravelPlan` directly at first. Add `#MarketingTourTravelPlan` only if marketing tours need constraints beyond the base, such as rejecting booking-only fields at schema level instead of only normalizing them in backend code.

Important modeling decisions:

- Keep the existing `details` field name for booking service descriptions. Do not rename it to `description` unless a separate API migration is planned.
- The target base service has a required `title`. If current stored booking or standard-tour data has blank service titles, keep `title` temporarily optional in phase 1 and tighten it after a data audit/migration.
- Keep `#BookingTravelPlan` as the operational type used by bookings, generated offers, accepted snapshots, and PDFs.
- Add `travel_plan?: databaseModel.#TravelPlan` to `model/json/tour.cue`.
- Make the base day/service structs open with `...` so booking-specific refinements can add fields without fighting CUE closed-struct behavior.
- Move only genuinely shared fields into the base. Booking-only fields such as real dates, attachments, copied provenance, PDFs, and service `details` should stay on booking refinements.
- Remove `model/json/standard_tour.cue` only after standard-tour content has been migrated.

## Backend Plan

### 1. Refactor CUE Contracts Additively

Do this before changing UI or removing standard tours.

- Add neutral `#TravelPlan`, `#TravelPlanVideo`, `#TravelPlanDay`, `#TravelPlanService`, and `#TravelPlanServiceImage` types.
- Refactor `#BookingTravelPlan`, `#BookingTravelPlanDay`, and `#BookingTravelPlanService` to compose the neutral base.
- Keep booking field names stable, especially service `details`.
- Keep existing booking API behavior stable after generated artifacts are regenerated.
- Only then add `travel_plan?: databaseModel.#TravelPlan` to `#Tour`.
- Represent the existing marketing-tour reel video as `travel_plan.video` when practical. The file can stay at `content/tours/{tour_id}/video.mp4` during the transition; the schema should not force a media move.

This fixes the current conceptual problem where non-booking content depends on a booking-named travel-plan schema.

### 2. Split Generic Travel-Plan Logic From Booking Logic

Keep `backend/app/src/domain/travel_plan.js` as the normalization/validation center, but make the mode explicit:

- `normalizeTravelPlan(raw, options)`
- `normalizeBookingTravelPlan(raw, offer, options)`
- `normalizeMarketingTourTravelPlan(raw, options)`
- `validateBookingTravelPlanInput(raw, offer, options)`
- `validateMarketingTourTravelPlanInput(raw, options)`

Booking mode keeps real dates, attachments, copied provenance, and booking translation behavior.

Marketing-tour mode starts from the base `#TravelPlan` and strips accidental booking-only fields such as dates, attachments, copied provenance, and service `details`.

### 3. Extend Marketing Tour APIs

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

### 4. Replace Standard-Tour Apply With Marketing-Tour Apply

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

### 5. Retire Standard-Tour Backend

After migration and UI replacement:

- Remove `backend/app/src/domain/standard_tours.js`.
- Remove `backend/app/src/http/handlers/standard_tours.js`.
- Remove `readStandardTours`, `persistStandardTour`, and `deleteStandardTour` from `backend/app/src/lib/store_utils.js`.
- Remove `STANDARD_TOURS_DIR` from runtime config unless kept temporarily for migration.
- Remove `/api/v1/standard-tours` routes and generated API definitions.
- Remove standard-tour tests or rewrite them to marketing-tour travel-plan tests.

## Frontend Plan

### 1. Make GUI Reuse A Hard Requirement

There should be one shared travel-plan GUI implementation for the two remaining travel plans:

- Booking travel plan
- Marketing-tour travel plan

The booking page and marketing-tour page should not each own their own day/service renderer. They should supply mode, state, endpoints, permissions, and feature flags to a shared editor core.

The target split should be:

```text
frontend/scripts/shared/travel_plan_editor_core.js
frontend/scripts/shared/travel_plan_editor_helpers.js
frontend/scripts/shared/travel_plan_editor_images.js
frontend/scripts/shared/travel_plan_editor_validation.js
frontend/scripts/booking/travel_plan_adapter.js
frontend/scripts/pages/tour_travel_plan_adapter.js
```

The current `frontend/scripts/booking/travel_plan.js` should be treated as the starting point for the shared core. Move reusable rendering and DOM behavior out of the booking folder instead of copying it into `tour.js`.

The current `frontend/scripts/shared/standard_tour_editor.js` should be temporary scaffolding only. Its useful idea is the adapter pattern, not the file itself.

### 2. GUI Reuse Rules

These rules should be treated as implementation acceptance criteria:

- A change to day or service markup should be made in one shared renderer and affect both booking and marketing-tour travel plans.
- A change to add/remove/reorder/collapse behavior should be made in one shared event layer and affect both modes.
- A shared travel-plan control should be added to the shared core first, then enabled or disabled through mode features.
- Booking-specific code may add real dates, `details`, imports, attachments, PDFs, translation, and revision handling, but it should not fork the generic day/service editor.
- Marketing-tour-specific code may map the plan to the tour page and tour endpoints, but it should not implement its own day/service renderer in `tour.js`.
- The two adapters should be thin enough that most defects in travel-plan editing are fixed once in shared code.

### 3. Shared Editor Core Contract

The shared core should accept a context like this:

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
    translation,
    serviceDetails,
    video
  },
  persistence: {
    saveTravelPlan,
    uploadServiceImage,
    deleteServiceImage,
    uploadTravelPlanVideo,
    deleteTravelPlanVideo
  },
  hooks: {
    onDirtyChange,
    onSaved,
    onStatusChange
  }
}
```

The shared core owns:

- Rendering days and services.
- Add/remove/reorder day behavior.
- Add/remove/reorder service behavior.
- Collapse/expand behavior.
- Shared travel-plan normalization for UI state.
- Shared DOM event binding.
- Shared service image preview UI.
- Optional travel-plan video UI when `features.video` is enabled.
- Shared client-side validation that applies to both modes.
- Shared empty/loading/status rendering.
- Shared CSS class naming and mode class application.

Adapters own:

- Loading the parent entity.
- Saving to booking or tour endpoints.
- Revision handling when the parent entity has revisions.
- Mapping API payloads into the shared editor state.
- Mapping shared editor output back into API payloads.
- Deciding which feature flags are enabled.
- Parent-page dirty bar integration.
- Parent-page permissions.

The adapter boundary is important. The booking adapter should translate existing booking state into the shared editor state and back. The marketing-tour adapter should translate tour `travel_plan` state into the same shared editor state and back. The shared core should not know whether the parent entity is a booking or a tour except through `mode`, feature flags, and injected persistence functions.

Persistence functions should only be required when the matching feature is enabled. For example, booking mode can set `video` to false and omit video persistence.

### 4. Mode Differences

Booking mode uses the shared core with all current booking behavior:

- Real day dates.
- Booking service `details`.
- Travel-plan attachments.
- Travel-plan PDFs.
- Translation controls.
- Booking day/plan/service imports.
- Service images stored under booking image storage.
- Travel-plan video hidden unless a later product decision enables it for bookings.
- Booking revision conflict handling.
- Booking activity log updates through backend handlers.

Marketing-tour mode uses the same shared core with a smaller feature set:

- Hide date controls.
- Hide booking-only service `details` controls.
- Hide renumber-days, attachments, PDFs, booking plan imports, booking day imports, and booking service imports.
- Allow creating, reordering, and removing days/services.
- Allow service image upload/delete through tour endpoints.
- Allow one optional travel-plan video through tour video persistence.
- Treat `days.length` as the displayed day count.

The DOM markup for a day and a service should come from the same renderer in both modes. Feature flags should remove individual controls, not fork the whole template.

### 5. Shared Styling

Use the existing travel-plan CSS as the shared visual base:

```text
shared/css/pages/backend-booking-travel-plan.css
```

Rename or reorganize only if useful, but do not create a second marketing-tour travel-plan stylesheet. Mode-specific CSS should be small and scoped by a mode class such as:

```text
travel-plan-editor--booking
travel-plan-editor--marketing-tour
```

### 6. Embed The Travel Plan In `marketing_tour.html`

Add the travel-plan panel to the marketing tour editor page below the current marketing fields:

- Existing gallery/title/description/destination/style fields stay on the same page.
- The existing optional tour video should be treated as the travel-plan video in the model. Because `video` belongs to the base `#TravelPlan`, expose it through the shared editor as a feature-flagged control.
- The first implementation can keep the existing tour video endpoint and disk path, but the marketing-tour adapter should map it to `travel_plan.video`.
- New travel-plan section uses the shared editor core through the marketing-tour adapter.
- The page dirty bar should include both marketing fields and travel-plan changes.
- Save should persist both marketing fields and travel plan, or call a dedicated tour travel-plan endpoint after the main save.

The tour page will need the mounts currently missing from `standard-tour.html` if service images are enabled:

- Hidden file input for service images.
- Image preview modal.
- Travel-plan status mount.

### 7. Update Booking Import UI

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
- Strip attachments, copied provenance, booking service `details`, and all booking-only metadata.
- Convert service image URLs to generated static asset URLs.

Public UI options:

- Expand the existing "more" overlay into a tour detail overlay that can show overview text plus day-by-day plan.
- Keep cards compact and show only title, description, tags, gallery, and CTA on the grid.
- Consider dedicated SEO pages later, but do not make that part of the first migration.

The homepage asset generator must be taught to copy nested tour service images, not just top-level tour images.

## Migration Plan

### 1. Refactor The Base Model First

Add neutral `#TravelPlan` CUE types and refactor `#BookingTravelPlan` to compose them before changing runtime behavior. This keeps the first step focused on model clarity and contract compatibility.

### 2. Add The New Tour Field

Add `travel_plan` to marketing tours while standard tours still exist. This makes the change backwards compatible and lets editors begin filling marketing-tour plans.

### 3. Dry-Run Standard-Tour Migration

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

### 4. Copy Plans Into Marketing Tours

For each migrated standard tour:

- Normalize through base `#TravelPlan` mode.
- Strip dates, attachments, copied provenance, and booking service `details`.
- Copy service images into the destination tour folder when the source file can be resolved.
- Rewrite service image paths to `/public/v1/tour-images/...`.
- Preserve the original standard tour ID in temporary migration metadata, for audit only.

Do not delete `content/standard_tours` in the same step. Keep it until the migrated marketing tours have been reviewed.

### 5. Switch Booking Template Import

After marketing tours have travel plans:

- Switch booking imports from `/api/v1/standard-tours` to `/api/v1/tours`.
- Replace the apply endpoint with the marketing-tour apply endpoint.
- Remove the standard-tour navigation item.

### 6. Remove Standard Tours

After testing and content review:

- Delete standard-tour pages and scripts.
- Delete standard-tour backend routes and handlers.
- Delete standard-tour CUE contracts.
- Remove standard-tour generated API client methods.
- Remove Caddy entries for `standard-tours.html` and `standard-tour.html`, or leave redirects to `marketing_tours.html` for one release.
- Remove standard-tour i18n keys after references are gone.
- Archive `content/standard_tours` outside runtime content.

## Implementation Phases

### Phase 1: Additive CUE Base Refactor

- Add neutral `#TravelPlan` types in `model/database/travel_plan.cue`.
- Refactor `#BookingTravelPlan` to compose the neutral base.
- Keep booking-specific service text as `details`.
- Keep standard tours operational.
- Regenerate API artifacts.
- Add tests that existing booking travel-plan payloads still validate and generated contracts remain compatible.

### Phase 2: Tour Travel-Plan Contracts And Normalization

- Add `travel_plan` to `Tour`.
- Map the existing optional tour video into `travel_plan.video` without requiring an immediate media storage move.
- Add base travel-plan normalization for tour content.
- Strip booking-only fields from marketing-tour plans.
- Keep standard tours operational.
- Add tests for base travel-plan and tour travel-plan normalization.

### Phase 3: Marketing-Tour Backend Endpoints

- Persist tour `travel_plan`.
- Add tour travel-plan PATCH endpoint.
- Add tour service-image upload/delete endpoints.
- Add tests for save, image upload, image delete, and public image serving.

### Phase 4: Shared Frontend Editor

- Extract shared rendering, DOM events, UI-state normalization, validation, image preview, and status rendering from `frontend/scripts/booking/travel_plan.js` into shared travel-plan editor modules.
- Add the optional travel-plan video control to the shared modules as a feature-flagged capability, even if booking mode keeps it disabled.
- Add a booking adapter that keeps existing booking behavior unchanged while delegating day/service rendering and generic interactions to the shared core.
- Add a marketing-tour adapter that mounts the same shared core in `marketing_tour.html` and maps `tour.travel_plan` to the shared editor state.
- Keep `frontend/scripts/pages/tour.js` responsible for marketing fields and parent-page save coordination only. It should not contain copied day/service rendering logic.
- Hide marketing-tour date controls, service `details`, imports, attachments, PDFs, translation controls, and booking-only revision UI through feature flags.
- Enable marketing-tour service image upload/delete by injecting tour persistence functions into the shared core.
- Retire `standard_tour_editor.js` after the shared adapter path is working. Do not preserve it as a second implementation of the same travel-plan GUI.
- Add a source-integrity or frontend test that prevents duplicate travel-plan day/service renderers from reappearing outside the shared core.

### Phase 5: Booking Template Import

- Add marketing-tour apply endpoint for bookings.
- Copy tour service images into booking image storage during apply.
- Update booking import UI labels and calls.
- Add tests that applying a marketing tour creates a valid booking travel plan and renders service images in PDFs.

### Phase 6: Content Migration

- Dry-run migration and review report.
- Apply migration.
- Regenerate homepage assets.
- Review migrated plans in the marketing-tour editor.

### Phase 7: Remove Standard Tours

- Remove standard-tour backend/frontend/contracts/navigation.
- Remove or redirect standard-tour pages.
- Remove standard-tour generated API methods.
- Clean i18n and source-integrity tests.

### Phase 8: Public Display

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
- `frontend/scripts/pages/tour_travel_plan_adapter.js` new
- `frontend/scripts/pages/tours_list.js`
- `frontend/scripts/pages/standard_tour.js`
- `frontend/scripts/pages/standard_tours.js`
- `frontend/scripts/shared/standard_tour_editor.js`
- `frontend/scripts/shared/travel_plan_editor_core.js` new
- `frontend/scripts/shared/travel_plan_editor_helpers.js` new or moved from booking helpers
- `frontend/scripts/shared/travel_plan_editor_images.js` new or moved from booking images
- `frontend/scripts/shared/travel_plan_editor_validation.js` new or moved from booking validation
- `frontend/scripts/shared/nav.js`
- `frontend/scripts/booking/travel_plan.js`
- `frontend/scripts/booking/travel_plan_adapter.js` new
- `frontend/scripts/booking/travel_plan_attachments.js`
- `frontend/scripts/booking/travel_plan_dates.js`
- `frontend/scripts/booking/travel_plan_helpers.js`
- `frontend/scripts/booking/travel_plan_images.js`
- `frontend/scripts/booking/travel_plan_pdfs.js`
- `frontend/scripts/booking/travel_plan_validation.js`
- `frontend/scripts/booking/travel_plan_service_library.js`

Styling and content:

- `shared/css/pages/backend-booking-travel-plan.css`
- `frontend/data/i18n/backend/en.json`
- `frontend/data/i18n/backend/vi.json`
- `deploy-config/Caddyfile`
- `deploy-config/Caddyfile.local`
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

- Neutral `#TravelPlan` validates without booking service `details`.
- `#BookingTravelPlan` still validates with service `details` and real day dates.
- Booking and marketing-tour pages both import the same shared travel-plan editor core.
- Day and service markup is rendered by shared code, not separately in booking and marketing-tour scripts.
- Generic day/service add, remove, reorder, collapse, image-preview, status, and validation behavior is implemented once in shared modules.
- `frontend/scripts/pages/tour.js` does not contain a copied travel-plan day/service renderer.
- Mode feature flags are covered for at least booking mode and marketing-tour mode.
- Both modes use the same travel-plan CSS base with scoped mode overrides only.
- Existing booking travel-plan editing still saves, reloads, imports, uploads images, creates PDFs, and handles revision conflicts.
- Marketing-tour editor can create days and services without dates.
- Marketing-tour editor exposes the optional travel-plan video through the shared feature-flagged control and stores it as `travel_plan.video`.
- Marketing-tour editor does not expose booking service `details` unless a later product decision adds a marketing-specific text field.
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
