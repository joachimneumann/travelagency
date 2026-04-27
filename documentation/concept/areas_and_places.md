# Destination Areas And Places

## Summary

Add destination areas and places as structured route-scope selections for marketing tours and booking travel plans.

Concept:

- a destination is the country-level destination, for example `Vietnam`
- an area is a sub-category of a destination, for example `Central`
- a place belongs to an area, for example `Hoi An`
- places are optional; an area may exist without any places

Example hierarchy:

```text
destination: Vietnam
area: Central
place: Hoi An
```

The list of possible destinations, areas, and places must be stored in the backend, not in the `content` folder. Marketing tours may remain file-backed as tours, but the selectable destination/area/place catalog is backend-managed reference data.

The selected route scope should be represented by one canonical structure: `destination_scope`. New writes should not maintain a separate destination-only source of truth. Missing `destination_scope` means no destination scope is specified, even if a legacy `destinations` field is present.

## Scope

In scope:

- backend-managed destination area/place catalog
- selecting areas and places on marketing tours
- selecting areas and places on booking travel plans
- adding missing destinations, areas, and places from the marketing tours list page
- validation so selected areas and places match the selected destinations
- deriving destination-only read-model fields from the canonical route scope where existing consumers still need them

Out of scope for the first implementation:

- public homepage area/place filters
- public booking-form area/place selection
- SEO landing pages by area/place
- automatic inference of places from free-text itinerary content

## Terminology

`Destination`
- Existing country-level destination code, such as `VN`.
- Current tour and booking models already use destination country codes.
- Staff can add supported destination country codes to the backend destination-scope catalog from `marketing_tours.html`.

`Area`
- Backend-managed child of one destination.
- Examples for Vietnam: `North`, `Central`, `South`.
- Areas are selectable even when they have no places.

`Place`
- Backend-managed child of one area.
- Examples for Vietnam Central: `Hoi An`, `Da Nang`, `Hue`.
- A place cannot exist without an area.

`Selected route scope`
- The specific destinations, areas, and places attached to a marketing tour or booking travel plan.
- This is not the same as day-by-day travel-plan services. It describes the route coverage at a higher level.

## Data Ownership

The destination/area/place catalog should be database-backed or otherwise backend-owned operational reference data.

Do not store the list of possible destinations, areas, and places in:

- `content/tours`
- `content/standard_tours`
- `content/country_reference_info.json`
- generated frontend data

Marketing tours can store references to selected areas and places, but the canonical list of possible options must come from backend APIs.

## Recommended Catalog Model

Add backend-owned reference entities:

```text
DestinationScopeDestination
  code
  label
  sort_order
  is_active
  created_at
  updated_at

DestinationArea
  id
  destination
  code
  name
  name_i18n
  sort_order
  is_active
  created_at
  updated_at

DestinationPlace
  id
  area_id
  code
  name
  name_i18n
  sort_order
  is_active
  created_at
  updated_at
```

Rules:

- `DestinationScopeDestination.code` must be a supported destination country code.
- `DestinationArea.destination` must be an existing destination country code.
- `DestinationArea.code` should be unique within a destination.
- `DestinationPlace.code` should be unique within an area.
- inactive areas and places remain valid for existing tours/bookings but should not be offered for new selection by default.
- display labels should support localization through `name_i18n`, with fallback to `name`.

## Canonical Selection Shape

Use one persisted route-scope structure for destination, area, and place selections. Do not keep a separately editable `destinations[]` field beside it.

Recommended shape:

```json
{
  "destination_scope": [
    {
      "destination": "VN",
      "areas": [
        {
          "area_id": "area_vn_central",
          "places": [
            { "place_id": "place_vn_central_hoi_an" }
          ]
        }
      ]
    }
  ]
}
```

This shape avoids orphaned place selections because places live under their selected area.

For a selected destination without selected areas:

```json
{
  "destination_scope": [
    {
      "destination": "VN",
      "areas": []
    }
  ]
}
```

Apply the same concept to:

- marketing tour travel plans
- booking travel plans

The existing country-level `destinations[]` field should become compatibility output, not the editable or persisted source for marketing tours. It can be derived as:

```text
destinations = destination_scope[].destination
```

Clean cutover rule for marketing tour JSON: existing records with only:

```json
{
  "destinations": ["VN"]
}
```

do not imply a destination scope. They should behave as if no destination was specified until `destination_scope` is added explicitly. When a marketing tour is saved, omit the legacy top-level `destinations` field.

## Backend Behavior

Backend APIs should provide the catalog to both the marketing tour editor and the booking travel-plan editor.

Recommended API capabilities:

- list areas and places for one or more destinations
- create a destination entry from the supported country-code catalog
- create an area under a destination
- create a place under an area
- update/deactivate an area or place later if needed

The editor save endpoints must validate:

- every selected area belongs to the selected destination
- every selected place belongs to the selected area
- duplicate destination, area, and place selections are normalized away
- removing a destination removes its selected areas and places
- removing an area removes its selected places

Old write payloads that include only top-level `destinations[]` should not be converted to `destination_scope` for marketing tours. New frontend code writes `destination_scope` only.

For bookings, travel-plan updates should continue to use `travel_plan_revision` conflict handling.

## Marketing Tour Editor

The list page is `marketing_tours.html`; the detailed tour editor is `marketing_tour.html`.

In the marketing tour editor, staff should be able to:

1. Select one or more destinations.
2. See only areas that belong to the selected destinations.
3. Select one or more areas for each selected destination.
4. See only places that belong to each selected area.
5. Select one or more places for each selected area.

The detail editor should only offer existing backend catalog entries. It should not create destinations, areas, or places inline.

In the marketing tours list page, `marketing_tours.html`, staff should be able to open a collapsible `Destinations` area at the bottom of the page and:

1. Add supported destinations to the destination-scope catalog.
2. Add areas under an existing destination.
3. Add places under an existing area.

Recommended UI behavior:

- group area controls by destination
- group place controls below their selected area
- hide or disable areas for destinations that are not selected
- hide or clear places when their parent area is unselected
- show selected areas even if they later become inactive
- show selected places even if they later become inactive
- save selections as part of the tour save flow

## Booking Travel Plan Editor

In `booking.html`, the Travel plan section should expose the same destination/area/place selection pattern.

The booking travel plan should support:

- one or more destinations
- one or more areas across all selected destinations
- one or more places per selected area

The booking travel-plan route scope should be saved with the booking travel plan, not only with the booking core details. Existing booking-level destination fields may still be used to initialize the travel-plan destinations.

Recommended behavior:

- when creating a booking travel plan from a marketing tour or standard tour, copy the selected destination scope
- when copying a travel plan between bookings, copy the selected destination scope
- when generating a customer-facing travel-plan PDF, render selected destination/area/place labels if the PDF design later needs them
- generated offers and PDFs should freeze the selected labels at generation time, consistent with other customer-facing snapshots

## Public And Generated Data

For v1, area/place selections do not need to change public homepage behavior.

If public tour JSON includes this data later, it should include resolved labels and stable IDs, not require the public frontend to know the entire backend catalog.

## Validation Examples

Valid:

```json
{
  "destination_scope": [
    {
      "destination": "VN",
      "areas": [
        {
          "area_id": "area_vn_central",
          "places": [
            { "place_id": "place_vn_central_hoi_an" }
          ]
        }
      ]
    }
  ]
}
```

Invalid:

- `area_vn_central` selected under a destination other than `VN`
- `place_vn_central_hoi_an` selected without its parent area
- a place from Vietnam Central selected under Vietnam North
- duplicate entries for the same area or place

## Implementation Notes

Likely model touch points:

- `model/database/travel_plan.cue`
- `model/json/tour.cue`
- `model/api/requests.cue`
- `model/api/responses.cue`
- `model/ir/normalized.cue`

Likely backend touch points:

- add catalog persistence and API handlers for destination areas/places
- include catalog options in marketing tour detail/list option payloads
- validate selected destination scope during tour save
- validate selected destination scope during booking travel-plan save
- preserve selected scope through travel-plan import/copy flows
- derive destination-only read-model fields from `destination_scope`
- treat existing destination-only marketing tour records as unspecified until `destination_scope` is added

Likely frontend touch points:

- `frontend/pages/marketing_tour.html`
- `frontend/scripts/pages/tour.js`
- shared travel-plan editor modules used by marketing tours and bookings
- `frontend/scripts/booking/travel_plan*.js`

## Acceptance Scenarios

1. Staff creates area `Central` under destination `Vietnam` from the marketing tour editor.
2. Staff creates place `Hoi An` under `Vietnam / Central` from the marketing tour editor.
3. Staff selects `Vietnam`, `Central`, and `Hoi An` on a marketing tour and saves it.
4. Reloading the marketing tour preserves the selected destination, area, and place.
5. Staff cannot select `Hoi An` unless `Central` is selected.
6. Staff cannot select `Central` unless `Vietnam` is selected.
7. A booking travel plan can select `Vietnam`, `Central`, and `Hoi An`.
8. Copying/importing a travel plan preserves the selected destination scope.
9. Existing tours and bookings without `destination_scope` still load and save correctly, with no destination selected.
10. Existing destination-only API/read-model fields are derived from `destination_scope` when present, not from legacy tour JSON.
