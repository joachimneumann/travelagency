# Tour Variants Concept

## Summary

Add one backend menu tab for staff-managed tour variants that are based on existing marketing-tour days and can be published on the website independently.

Recommended backend tab name: `Tour Variants`.

Use `Tour Variant` as the product and technical name everywhere. It is clear enough for staff, accurate enough for developers, and avoids exposing a second internal-only term in the UI or code model.

Other possible names:

- `Itinerary Variants` if the feature should emphasize that only the day-by-day itinerary changes.
- `Published Variants` if the main workflow is controlling website-visible variants.
- `Ready Tours` if the public-facing promise is preassembled routes that customers can request.
- `Tour Packages` only if pricing, inclusions, and package terms become part of the feature.

Recommendation: keep `Tour Variants`. The alternatives are either narrower, more marketing-heavy, or imply pricing/versioning that is not part of the current concept.

## Product Concept

Tour variants sit between marketing tours and bookings.

Marketing tours remain the reusable itinerary source. They own the rich day and service content, images, translations, destination structure, and customer-facing route story.

Tour variants are lightweight website-ready variants built from selected marketing-tour days. They can combine days from all marketing tours, not only from the marketing tour used when the variant was first created.

A tour variant adds:

- tour name and normal public tour-card metadata
- its own arrival/departure boundary logistics
- ordered selected days from marketing tours
- publication checkbox

Bookings remain customer-specific operational records. A tour variant should not contain traveler identities, payment state, booking notes, accepted offers, pricing, capacity, supplier commitments, or operational revisions.

## Target Workflow

The backend gets a new section in the main menu:

```text
Bookings | Reports and Settings | Translations | Tours | Tour Variants
```

The `Tour Variants` list page should show:

- name
- base marketing tour
- number of selected days
- arrival/departure summary
- publication state
- last updated time

Creating a tour variant starts from a published marketing tour. The base marketing tour initially populates the selected-day timeline, but staff can later add days from any published marketing tour.

The editor opens with a customizer-like interface:

- source tour/day library across all published marketing tours
- route timeline with selected source-day references
- day reordering and removal
- day insertion from eligible published marketing-tour days
- tour name and normal tour-card metadata fields
- arrival/departure boundary-logistics panel
- `Show on web page` checkbox

The editor should feel close to the public customizer, but it is an authenticated staff tool. It can show source-tour references and validation status that would not be shown to customers.

## Recommended V1 Decisions

- Use `Tour Variants` as the backend tab label.
- Use `TourVariant` / `tour_variant` as the technical model name.
- Store tour variants as file-backed JSON content.
- Store them under `content/tour_variants/{tour_variant_id}/tour_variant.json`.
- Keep `base_marketing_tour_id` as the creation seed and publication guard.
- Allow selected days to reference any published marketing tour.
- Do not offer days from unpublished marketing tours in the tour-variant editor.
- Store only source-day references in the tour-variant JSON.
- Do not copy full day/service bodies into the tour-variant source JSON.
- Edits to a marketing-tour day should automatically affect all tour variants that reference that day after the next public-site publish.
- Generate resolved public JSON at publish/build time and merge published tour variants into the existing `public-tours.{lang}.json` payload.
- Inherit day/service content, images, locations, and day/service translations from the referenced marketing-tour days.
- Keep arrival/departure as root-level `boundary_logistics` owned by the tour variant.
- Do not inherit arrival/departure from the base marketing tour.
- Start newly created tour variants with empty arrival/departure boundary-logistics fields.
- Keep publication controlled by `published_on_webpage`.
- Do not allow a tour variant to publish if its base marketing tour is not published on the website.
- Show published tour variants as normal public tour cards.
- Allow customers to customize a tour variant the same way they customize a normal marketing tour.
- Use the same translation workflow as marketing tours for tour-variant titles and arrival/departure notes.
- Limit read/edit access to `atp_tour_editor` in v1.

## Storage Model

Recommended source location:

```text
content/tour_variants/
  tour_variant_.../
    tour_variant.json
```

Recommended JSON shape:

```json
{
  "id": "tour_variant_9f1c2d3e-0000-4000-9000-000000000000",
  "title": "Central Vietnam Highlights with Da Nang Arrival",
  "title_i18n": {},
  "short_description": "A compact Central Vietnam route using selected days from existing marketing tours.",
  "short_description_i18n": {},
  "styles": ["culture", "family", "luxury"],
  "seasonality_start_month": "apr",
  "seasonality_end_month": "oct",
  "priority": 70,
  "base_marketing_tour_id": "tour_16531bfc-a60f-4128-9abe-2eada1f2d7d8",
  "published_on_webpage": false,
  "boundary_logistics": {
    "arrival": {
      "mode": "none",
      "title": "",
      "title_i18n": {},
      "details": "",
      "details_i18n": {},
      "airport_code": ""
    },
    "departure": {
      "mode": "none",
      "title": "",
      "title_i18n": {},
      "details": "",
      "details_i18n": {},
      "airport_code": ""
    }
  },
  "days": [
    {
      "id": "tour_variant_day_11111111-1111-4111-9111-111111111111",
      "day_number": 1,
      "source_tour_id": "tour_16531bfc-a60f-4128-9abe-2eada1f2d7d8",
      "source_day_id": "travel_plan_day_0cc434a5-139d-4ab7-944f-6adc04c534db"
    },
    {
      "id": "tour_variant_day_22222222-2222-4222-9222-222222222222",
      "day_number": 2,
      "source_tour_id": "tour_67b333c8-0eb7-4cd2-a203-13a97c382b22",
      "source_day_id": "travel_plan_day_aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee"
    }
  ],
  "created_at": "2026-05-14T00:00:00.000Z",
  "updated_at": "2026-05-14T00:00:00.000Z"
}
```

The source JSON should remain small. It stores only tour-variant metadata, owned boundary logistics, and selected source-day references. Public rendering resolves the selected day references into full day/service content and writes generated files under the existing generated frontend data area.

`base_marketing_tour_id` is still stored even though the selected days can come from any marketing tour. It records which marketing tour seeded the variant and is used to block publication when that base tour is not published on the website.

## Boundary Logistics

Marketing tours already support root-level `travel_plan.boundary_logistics.arrival` and `travel_plan.boundary_logistics.departure`.

Tour variants should also own root-level `boundary_logistics`. They should not inherit or copy arrival/departure from the base marketing tour, and they should not store arrival or departure as normal day services.

New tour variants should start with empty arrival/departure fields. Staff must define the tour variant's own boundary logistics if the variant should show arrival or departure information.

The tour-variant boundary fields should match the travel-tour arrival/departure editor:

- arrival/departure mode
- title
- details
- airport code

Boundary title and details need the same translation workflow as marketing-tour customer-facing content.

When rendering a customer-facing itinerary, the system should compose boundary logistics into the visible first/last day using the same presentation rules as marketing tours.

## Source-Day References

The selected-day timeline is the source of truth for the tour-variant itinerary.

Each selected day stores:

- local tour-variant day id
- display `day_number`
- `source_tour_id`
- `source_day_id`

The source day content is not copied into the tour variant.

When a marketing-tour day changes, every tour variant that references that day should reflect the change after the next public-site publish. This is intentional. Tour variants are curated references to marketing-tour content, not locked snapshots.

If a source day is deleted, the editor should keep the broken reference visible and ask staff to replace or remove it. Silent removal would make published itineraries change unexpectedly.

## Editor Behavior

Initial creation should seed the timeline from the base marketing tour's `travel_plan.days[]`.

Initial creation should not copy the base marketing tour's arrival/departure fields. The tour variant starts with empty boundary-logistics fields.

After creation, staff should be able to:

- rename the tour variant
- edit normal tour-card metadata
- edit arrival/departure boundary logistics
- reorder selected days
- remove selected days
- add days from any published marketing tour
- toggle `Show on web page`
- save as draft

In v1, staff should edit detailed day/service content in the source marketing tour, not inside the tour-variant editor. This avoids creating a second full travel-plan editor and keeps tour variants lightweight.

## Publication Rules

`published_on_webpage` should control whether the tour variant appears in public generated data.

Publication should require:

- non-empty title
- at least one selected day
- base marketing tour exists
- base marketing tour is published on the website
- every selected source tour exists
- every selected source tour is published on the website
- every selected source day exists in its source tour
- arrival/departure boundary logistics pass the same required-field validation as travel-tour arrival/departure
- selected days contain enough image/location data for a normal public tour card and details view

The base marketing tour does not constrain which days can be selected. It only seeds the initial timeline and controls whether the tour variant can be published.

The editor should not offer days from unpublished marketing tours. If a previously selected source tour later becomes unpublished, the tour variant should fail publication validation until staff removes or replaces that source day.

## Public Website Behavior

Published tour variants should appear as normal tour cards.

Customers should be able to open and customize a tour variant the same way they customize a normal marketing tour.

The public customization catalog for a tour variant should be built from the resolved tour-variant itinerary plus the same public-safe marketing-tour day pool used by normal marketing tours. Staff-only source-day endpoints must not be exposed directly to the public website.

Tour variants should be merged into the existing public tour-card payload:

```text
frontend/data/generated/homepage/public-tours.{lang}.json
```

The public card renderer should receive one normalized public tour-card list. Tour variants may include an internal type marker if needed by the implementation, but the visible website should not force customers to understand the difference.

If separate public detail payloads are still needed, they should follow the existing marketing-tour detail pattern and be resolved from the tour variant's source-day references during generation.

## Backend/API Scope

Add a file-backed content model rather than a booking-owned model.

Likely implementation areas:

- `model/json/tour_variant.cue`
- API request/response contracts for tour-variant list/detail/upsert
- backend domain helper for reading, normalizing, validating, and persisting tour variants
- backend HTTP handlers under `/api/v1/tour-variants`
- frontend list page and editor page
- generated public-site data pipeline

Suggested endpoints:

```text
GET    /api/v1/tour-variants
GET    /api/v1/tour-variants/{tour_variant_id}
POST   /api/v1/tour-variants
PATCH  /api/v1/tour-variants/{tour_variant_id}
DELETE /api/v1/tour-variants/{tour_variant_id}
GET    /api/v1/tour-variants/source-days
```

The source-day endpoint can return eligible marketing-tour days for the staff editor. It should be authenticated and should not be reused directly by the public website.

Role access in v1:

- `atp_tour_editor`: read and edit tour variants
- other backend roles: no tour-variant access unless a later business need is defined

## Metadata Scope

Tour variants should not introduce operational or commercial metadata in v1.

Do not add:

- pricing
- capacity
- minimum group size
- guide assignment
- vehicle assignment
- supplier commitments
- fixed departure dates

Tour variants may use normal marketing-tour metadata needed for public cards and filters, such as title, short description, styles, seasonality, priority, and publication state.

## Translation

Tour-variant customer-facing content needs the same translation workflow as marketing-tour content.

This includes:

- title
- short description
- arrival title/details
- departure title/details

Referenced day and service translations should come from the source marketing-tour days.

Published tour variants should merge their translated title, short description, and boundary-logistics text into the existing `public-tours.{lang}.json` output. Referenced day/service translations should continue to come from the source marketing tours.

## Risks

The main risk is source-day drift. Because tour variants store only references, editing a marketing-tour day can change a tour variant the next time public data is generated. This is an intentional product decision, but the editor should make references and publish validation clear.

The second risk is source visibility. A tour variant can combine days from any published marketing tour. The editor must not offer unpublished marketing-tour days, and publication should fail if an already selected source tour becomes unpublished.

The third risk is scope drift. The name `Tour Variant` stays clean only if the entity remains a reusable content variant. If pricing, fixed dates, capacity, and supplier commitments become central, the feature may need to become `Tour Package` or `Tour Departure` later.

## Remaining Implementation Questions

No open product questions remain for the v1 concept.
