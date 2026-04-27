# Images In Travel Tour Card

## Goal

Change marketing tour card image selection so the public tour card uses images selected from the tour's travel plan services instead of a separate picture list at the top of `marketing_tour.html`.

The editor should remove the standalone marketing-tour picture upload UI and replace it with an explicit checkbox on each travel-plan service image:

```text
Include in travel tour card
```

When this checkbox is enabled, that service image becomes part of the public marketing tour card gallery.
(remember i18n to VI)

## Current State

Marketing tour card images are currently managed as tour-level pictures:

- `frontend/pages/marketing_tour.html` renders a top-level picture editor before the reel video and tour metadata.
- `frontend/scripts/pages/tour.js` manages `tour_picture_list`, `tour_add_picture_btn`, `tour_picture_upload`, pending picture drafts, upload, and delete behavior.
- The tour model/API carries `pictures`.
- The backend exposes dedicated tour picture upload/delete endpoints.
- Public homepage generation copies `tour.pictures` into the generated tour JSON.
- `frontend/scripts/main_tours.js` renders the tour card gallery from `trip.pictures`.

This creates a separate image workflow that is disconnected from the day-by-day travel plan. Editors can upload a tour-card picture that does not correspond to any service in the itinerary.

## Desired State

Tour card images should come from travel-plan service images only.

Each travel-plan service image gets a boolean flag:

```js
include_in_travel_tour_card: true | false
```

Recommended default:

```js
include_in_travel_tour_card: false
```

The checkbox belongs to the image, not the service text, because the image is the thing being selected for card display. The current implementation stores one primary image per service as `service.image`, so the checkbox can be rendered beside that image in the service image panel. If the model later supports multiple images per service again, the same boolean can stay image-level.

## Editor Behavior

In the marketing tour travel-plan editor:

- Keep the existing service image upload/delete flow.
- Add a checkbox next to each uploaded service image.
- Label: `Include in travel tour card`.
- Disable or hide the checkbox when the service has no uploaded image.
- Persist checkbox changes as part of the travel plan save.
- Do not require a separate image upload action for tour cards.

The standalone picture editor at the top of the marketing tour page should be removed:

- remove `tour_picture_list`
- remove `tour_add_picture_btn`
- remove `tour_picture_upload`
- remove `.tour-picture-*` CSS used only for the old editor
- remove picture draft state and picture upload/delete handlers from `frontend/scripts/pages/tour.js`

The reel video editor remains unchanged. This change is only about marketing tour card still images.

## Public Card Rendering

The public marketing tour card gallery should be built from selected service images:

```js
trip.travel_plan.days[]
  .flatMap(day => day.services)
  .map(service => service.image)
  .filter(image => image.include_in_travel_tour_card === true)
```

Selection order should follow itinerary order:

1. Day order.
2. Service order inside the day.
3. Image order inside the service, if multiple images are supported later.

Rendering rules:

- If one image is selected, render the card with a static image.
- If multiple images are selected, keep the existing tour-card gallery/cycle behavior.
- If no service images are selected, use the existing default tour placeholder image.
- Do not automatically include every service image. The checkbox should be the editorial control.
- Ignore image records without `storage_path`.
- Ignore images where `is_customer_visible === false`, if that field is present.

Card alt text should prefer:

1. `image.alt_text`
2. `image.caption`
3. `service.image_subtitle`
4. `service.title`
5. tour title

## Data Model

Add the boolean to the travel-plan service image model:

```cue
#TravelPlanServiceImage: {
  id:                   common.#Identifier
  storage_path:         string & !=""
  caption?:             string
  caption_i18n?:        [string]: string
  alt_text?:            string
  alt_text_i18n?:       [string]: string
  sort_order:           >=0 & int
  is_primary?:          bool
  is_customer_visible?: bool
  include_in_travel_tour_card?: bool
  width_px?:            >0 & int
  height_px?:           >0 & int
  source_attribution?:  #TravelPlanServiceImageSourceAttribution
  focal_point?:         #TravelPlanServiceImageFocalPoint
  created_at?:          common.#Timestamp
}
```

Normalize missing values to `false`.

The tour-level `pictures` field should be removed from the marketing tour write model and public read model after the migration is complete.

## API And Backend

Remove or retire the dedicated tour picture endpoints:

- `POST /api/v1/tours/{tour_id}/pictures`
- `DELETE /api/v1/tours/{tour_id}/pictures/{picture_name}`

Update tour normalization:

- stop normalizing legacy `tour.image` into `tour.pictures`
- stop returning `pictures` from the public/editor tour response once the UI no longer needs it
- preserve and validate `include_in_travel_tour_card` on `travel_plan.days[].services[].image`

Update public homepage asset generation:

- derive card pictures from travel-plan service images with `include_in_travel_tour_card === true`
- copy those selected service images into the generated homepage assets
- emit them in the same public payload shape expected by the current card renderer, or rename the payload field in a coordinated frontend change

Pragmatic transition option:

- Keep a derived `pictures` array in the public generated JSON for one release, but populate it from selected service images.
- Remove stored tour-level `pictures` only after all frontend code stops depending on it.

## Frontend Code Areas

Marketing tour editor:

- `frontend/pages/marketing_tour.html`
- `frontend/scripts/pages/tour.js`
- `frontend/scripts/pages/tour_travel_plan_adapter.js`
- `frontend/scripts/shared/travel_plan_editor_core.js`
- `frontend/scripts/booking/travel_plan_images.js`

Public homepage:

- `scripts/assets/generate_public_homepage_assets.mjs`
- `frontend/scripts/main_tours.js`
- generated homepage artifacts under `frontend/data/generated/homepage/`

Models/contracts:

- `model/database/travel_plan.cue`
- `model/api/requests.cue`
- `model/api/responses.cue`
- `model/api/endpoints.cue`
- generated OpenAPI/API request factory files

Backend:

- `backend/app/src/domain/travel_plan.js`
- `backend/app/src/domain/tours_support.js`
- `backend/app/src/http/handlers/tours.js`
- routes for tour picture upload/delete

Tests:

- update source-integrity tests that expect the old top-level picture editor
- add tests for persisting `include_in_travel_tour_card`
- add tests that public tour card images are derived from selected service images
- add tests that unselected service images still appear in travel-plan details but not in the tour card

## Migration

Existing tour-level pictures cannot be mapped reliably to specific travel-plan services. The migration should avoid guessing.

Recommended migration:

1. Keep existing travel-plan service images unchanged.
2. Add `include_in_travel_tour_card: false` to normalized image output by default.
3. Remove the top-level picture editor from the marketing tour UI.
4. Let editors manually choose the service images that should appear on the public card.
5. After editors have reviewed tours, delete or archive orphaned old tour-level picture files if storage cleanup is required.

If a temporary compatibility path is needed, public generation may use old `tour.pictures` only when no service image has been selected yet. This should be time-limited because it keeps the old source of truth alive.

## Acceptance Criteria

- The top of `marketing_tour.html` no longer has a standalone picture upload section.
- Marketing tour card image selection is controlled from travel-plan service images.
- Every service image in the marketing tour editor can be marked with `Include in travel tour card`.
- Saving and reloading a tour preserves the checkbox value.
- Public tour cards display selected service images in itinerary order.
- Expanded tour details still display service images even when they are not selected for the card.
- Unselected service images are not included in the public card gallery.
- The old tour-level picture model and upload/delete code are removed or explicitly marked as temporary compatibility code.
