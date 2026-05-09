# Destination Regions And Places

## Summary

Destination scope uses one hierarchy:

```text
Country
  Region
    Place
  Place
```

Examples:

- Country: `Vietnam`
- Region: `Central`
- Place in region: `Hoi An`
- Place without region: a country-level place attached directly to `Vietnam`

There is no `area` concept in the current model. Older `area` fields may be normalized by migration code, but new documentation, UI, APIs, and persisted data should use `region`.

## Rules

- Countries are destination country codes such as `VN`, `TH`, `KH`, and `LA`.
- A country can contain zero or more regions.
- A country can contain places that do not belong to a region.
- A region belongs to exactly one country.
- A place belongs to exactly one country.
- A place may optionally belong to one region in that country.
- Only places have latitude, longitude, and map zoom.
- Regions are grouping nodes only and do not have coordinates.

## Catalog Model

Backend-owned reference entities:

```text
DestinationScopeDestination
  code
  label
  sort_order
  is_active
  created_at
  updated_at

DestinationRegion
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
  destination
  region_id optional
  code
  name
  name_i18n
  latitude optional
  longitude optional
  map_zoom optional
  sort_order
  is_active
  created_at
  updated_at
```

Rules:

- `DestinationScopeDestination.code` must be a supported destination country code.
- `DestinationRegion.destination` must be an existing destination country code.
- `DestinationRegion.code` should be unique within a destination.
- `DestinationPlace.destination` must be an existing destination country code.
- `DestinationPlace.region_id`, when present, must reference a region in the same destination.
- `DestinationPlace.code` should be unique within the same country and region.
- inactive regions and places remain valid for existing tours/bookings but should not be offered for new selection by default.

## Canonical Selection Shape

Use one persisted route-scope structure for country, region, and place selections.

```json
{
  "destination_scope": [
    {
      "destination": "VN",
      "regions": [
        {
          "region_id": "region_vn_central",
          "places": [
            { "place_id": "place_vn_central_hoi_an" }
          ]
        }
      ],
      "places": [
        { "place_id": "place_vn_country_level" }
      ]
    }
  ]
}
```

For a selected destination without selected regions or places:

```json
{
  "destination_scope": [
    {
      "destination": "VN",
      "regions": [],
      "places": []
    }
  ]
}
```

The legacy top-level `destinations[]` field is compatibility output derived from `destination_scope[].destination`.

## Backend Behavior

Backend APIs provide the catalog to the marketing tour editor and booking travel-plan editor.

Required API capabilities:

- list destinations, regions, and places
- create a destination entry from the supported country-code catalog
- create a region under a destination
- create a place under a destination, with optional `region_id`
- delete empty destinations, regions, and places

Editor save endpoints must validate:

- every selected region belongs to the selected destination
- every selected place belongs to the selected destination
- region places are selected under their selected region
- country-level places are selected under the destination entry `places`
- duplicate destination, region, and place selections are normalized away
- removing a destination removes its selected regions and places
- removing a region removes its selected region places

## Editor Behavior

Marketing tours and booking travel plans should let staff:

1. Select one or more countries.
2. Select one or more country-level places.
3. See only regions that belong to the selected countries.
4. Select one or more regions for each selected country.
5. See only places that belong to each selected region.
6. Select one or more places for each selected region.

The detail editors should only offer existing backend catalog entries. The settings/catalog manager can create destinations, regions, and places.
