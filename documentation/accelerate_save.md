# Accelerate Marketing Tour Save

Plan only. Do not implement from this document without a separate implementation request.

## Goals

- Make saving a marketing tour faster.
- Move publishing out of the single-tour dirty bar.
- Publish public homepage assets from the marketing tours list page.
- Keep normal saves focused on backend persistence.

## Plan

1. Move Publish UI
   - Remove `#tour_publish_btn` from the dirty bar in `frontend/pages/marketing_tour.html`.
   - Remove publish button wiring/state handling from `frontend/scripts/pages/tour.js` on the single-tour edit page.
   - Add a large centered Publish button to `frontend/pages/marketing_tours.html`, above the statistics/matrix section.
   - Wire it in `frontend/scripts/pages/tours_list.js` to call a global publish endpoint, not a single-tour publish action.

2. Backend Publish Scope
   - Add or reuse a backend endpoint for publishing all public tour/static homepage assets from the tours list.
   - Current single-tour publish calls `POST /api/v1/tours/{tour_id}/publish`; for the list page, add something like `POST /api/v1/tours/publish`.
   - This endpoint should run the existing public homepage generator once.
   - Keep static homepage asset generation only here, not during normal saves.

3. Dirty/Publish State
   - Keep normal tour saves returning `homepage_assets: { dirty: true }`.
   - The tour edit page can still show "unpublished changes" in the dirty/status copy, but no publish button.
   - The tours list should show a publish status near the new button:
     - clean/unknown
     - publishing
     - published
     - failed
   - Ideally the list page should know whether any tour/static assets are dirty. If there is no reliable global dirty flag yet, add one server-side or derive it from existing dirty markers.

4. Accelerate Save: Duplicate Title
   - Remove client-side `findDuplicateTourTitle()` and its paginated list searches from `frontend/scripts/pages/tour.js`.
   - Add duplicate-title validation inside `handleCreateTour` and `handlePatchTour` in `backend/app/src/http/handlers/tours.js`.
   - Compare normalized title values across relevant localized title fields, excluding the current tour ID.
   - Return `409` or `422` with a clear code like `TOUR_DUPLICATE_TITLE`.
   - Frontend handles that response by showing the existing title error UI.

5. Accelerate Save: Avoid Reload
   - After successful save, stop calling `loadTour({ preserveTravelPlanCollapsedState: true })`.
   - Apply `result.tour` directly:
     - update `state.tour`
     - update localized content state
     - apply tour to travel-plan adapter
     - rerender selectors/header/publication eligibility
     - mark snapshot clean
   - Preserve collapsed travel-plan UI state during this local apply.

6. Accelerate Save: Translation Memory
   - Remove `syncTourManualTranslationsToMemory(updated)` from normal create/update/travel-plan save paths.
   - Move it to Publish, or replace it on save with a light source-text indexing step only.
   - Do not write non-English manual overrides during every save.
   - If publishing all tours from the list, run translation memory sync once as part of that publish flow.

7. Video Save
   - Keep video upload/delete as save-related for now.
   - Later optimization: make video upload an explicit separate action or switch away from base64 JSON to a direct binary upload endpoint.
   - This can be a separate follow-up because it changes UX and request format.

8. Verification
   - Syntax checks:
     - `node --check frontend/scripts/pages/tour.js`
     - `node --check frontend/scripts/pages/tours_list.js`
     - `node --check backend/app/src/http/handlers/tours.js`
   - Targeted tests:
     - tour create/update duplicate-title behavior
     - publish endpoint behavior
     - source-integrity tests for homepage asset generation staying publish-only
   - Manual smoke:
     - save existing tour
     - create duplicate title
     - save with video
     - publish from tours list
     - confirm dirty bar no longer contains Publish
