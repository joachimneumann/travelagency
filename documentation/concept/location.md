# Location Concept

## Summary

Use one location concept across the product.

The current system already has most of the pieces:

- destinations: country-level entries such as `Vietnam`
- areas: broad route regions such as `North`, `Central`, `South`
- places: concrete selectable locations such as `Hanoi`, `Hoi An`, `Ba Na Hills`
- travel-plan day fields: `primary_location_id` and `secondary_location_id`

The missing concept is a clear hierarchy that can cover all location use cases:

- public website filters
- marketing tour route scope
- day-by-day map anchors
- customer tour customization
- grouping several days at the same location
- static public content generation
- future SEO pages by country, region, area, or place

Recommended direction: treat every geographic concept as a `Location` node in a tree, even if the current storage keeps destinations, areas, and places in separate arrays for compatibility.

## Location Hierarchy

Recommended hierarchy:

```text
Country / Destination
  Region
    Area
      Place
```

Example:

```text
Vietnam
  Central Vietnam
    Da Nang area
      Marble Mountains
      Son Tra Peninsula
      Ba Na Hills
    Hoi An area
      Hoi An Ancient Town
      Bay Mau Coconut Forest
```

The hierarchy should be flexible. Not every country needs every level.

Valid examples:

```text
Vietnam -> North -> Hanoi
Vietnam -> Central -> Hoi An
Vietnam -> South -> Phu Quoc -> VinWonders
Thailand -> Bangkok
```

Rules:

- a country can contain regions, areas, or places
- a region can contain areas or places
- an area can contain places
- a place is normally the lowest selectable map anchor
- the public UI should not need to know whether an item is stored as an area or a place; it should receive a generated filter model

## Location Types

`Country`
- The top-level destination, usually represented by an ISO-like country code such as `VN`.
- Used for public destination filters, tour scope, and country-level SEO.
- Example: `Vietnam`.

`Region`
- A broad route grouping inside a country.
- Useful for filters and route planning.
- Example: `North`, `Central`, `South`.

`Area`
- A smaller travel cluster, city, province, island, bay, or route base.
- Useful for grouping places and grouping days in the customization UI.
- Examples: `Da Nang`, `Ninh Binh`, `Phu Quoc`, `Mui Ne`.

`Place`
- A concrete location used as a day anchor.
- This is the preferred level for `travel_plan.days[].primary_location_id`.
- Examples: `Marble Mountains`, `Hoi An`, `Trang An`, `Ba Na Hills`.

## Coordinates

Every location type should be allowed to have optional geographic metadata:

```json
{
  "latitude": 16.0544,
  "longitude": 108.2022,
  "map_zoom": 10
}
```

Meaning:

- for a country, coordinates represent a map center
- for a region, coordinates represent a region center
- for an area, coordinates represent an area center
- for a place, coordinates represent the actual point or best map anchor

Coordinates should be optional, not required.

For non-point locations, `bounds` may be useful later:

```json
{
  "bounds": {
    "north": 23.4,
    "south": 8.2,
    "east": 109.5,
    "west": 102.1
  }
}
```

Use `latitude` and `longitude` as the practical map center for route drawing. Add `bounds` only when the product needs better map fitting.

## Canonical Model

Long term, the cleanest model is one location table/catalog:

```json
{
  "id": "loc_vn_central_da_nang_marble_mountains",
  "type": "place",
  "parent_id": "loc_vn_central_da_nang",
  "country_code": "VN",
  "code": "marble-mountains",
  "name": "Marble Mountains",
  "name_i18n": {
    "vi": "Ngũ Hành Sơn"
  },
  "latitude": 16.0108,
  "longitude": 108.2532,
  "map_zoom": 13,
  "sort_order": 100,
  "is_active": true,
  "is_public": true,
  "created_at": "2026-05-08T00:00:00.000Z",
  "updated_at": "2026-05-08T00:00:00.000Z"
}
```

Important fields:

- `id`: stable internal ID
- `type`: `country`, `region`, `area`, or `place`
- `parent_id`: parent location, null for top-level countries
- `country_code`: denormalized country code for fast filtering
- `code`: readable stable slug within the parent
- `name`: English source name
- `name_i18n`: translated names, eventually from `content/translations`
- `latitude`, `longitude`: optional map center
- `map_zoom`: optional default zoom
- `is_active`: available internally
- `is_public`: visible on the public website

The current implementation can keep using:

- `destination_scope_destinations`
- `destination_areas`
- `destination_places`

But the read model should behave like the unified location tree.

## Tour Scope

Tour scope describes where the whole tour belongs.

Use scope for filters, cards, search, SEO grouping, and broad customer expectations.

Example:

```json
{
  "location_scope": [
    "loc_vn",
    "loc_vn_central",
    "loc_vn_central_da_nang",
    "loc_vn_central_hoi_an"
  ]
}
```

With the current data shape, this is still represented as `destination_scope`.

Rules:

- scope may include broad locations such as country or region
- scope may include area/place locations when the tour is clearly about them
- scope does not replace day-level route anchors
- selected child locations imply their ancestors for filtering

Example: if a tour selects `Hoi An`, the generated public filter set should include:

```text
Vietnam -> Central -> Hoi An
```

## Day Locations

Day locations describe where an itinerary day happens.

Use:

```json
{
  "primary_location_id": "loc_vn_central_da_nang_marble_mountains",
  "secondary_location_id": "loc_vn_central_hoi_an"
}
```

Rules:

- `primary_location_id` is the main map anchor for the day
- `secondary_location_id` is optional and can support route segments or extra stops
- a day should prefer the most specific reliable location
- if a specific place is not known, an area or region is acceptable as a fallback
- day map drawing should ignore locations without coordinates

The customization UI should group days by `primary_location_id`.

If several days share the same primary location:

- show one map marker
- show the day range or list on the marker
- keep each day as a separate timeline item
- let the customer choose which day module at that location fits their trip

## Public Static Content

The public website should not show every location in the catalog.

During static public content generation:

1. Read all published marketing tours.
2. Read each tour's scope locations.
3. Read each travel-plan day's primary and secondary locations.
4. Resolve every referenced location against the catalog.
5. Add every referenced location and all of its ancestors to a generated public location set.
6. Build filter lists from that generated set.

Generated public filter model:

```json
{
  "countries": [
    { "id": "loc_vn", "label": "Vietnam", "tour_count": 36 }
  ],
  "regions": [
    { "id": "loc_vn_central", "parent_id": "loc_vn", "label": "Central", "tour_count": 12 }
  ],
  "areas": [
    { "id": "loc_vn_central_da_nang", "parent_id": "loc_vn_central", "label": "Da Nang", "tour_count": 8 }
  ],
  "places": [
    { "id": "loc_vn_central_da_nang_marble_mountains", "parent_id": "loc_vn_central_da_nang", "label": "Marble Mountains", "tour_count": 4 }
  ]
}
```

The frontend should render filters from this generated model.

Benefits:

- no empty public filters
- no browser-side inference from raw tour JSON
- consistent translations and sorting
- easier SEO and landing-page generation later
- stable behavior even if the internal catalog contains inactive or staff-only locations

## Customization UI

The customization UI needs location data for two different jobs:

1. Route map anchors.
2. Grouping optional day modules.

Recommended generated optional-day shape:

```json
{
  "source_tour_id": "tour_...",
  "source_day_id": "day_3",
  "title": "Marble Mountains and Hoi An",
  "primary_location_id": "loc_vn_central_da_nang_marble_mountains",
  "primary_location_label": "Marble Mountains",
  "parent_area_label": "Da Nang",
  "latitude": 16.0108,
  "longitude": 108.2532
}
```

The optional-days panel can group by:

- country for multi-country products
- region for broad browsing
- area for practical route building
- primary place for choosing among several day modules at the same place

For Vietnam tour customization, area or primary place grouping is likely the most useful.

## Geocoding

Geocoding is a catalog maintenance tool, not a runtime dependency.

Rules:

- run geocoding in scripts or admin tools
- review dry-run reports before writing
- store the resulting location in the catalog
- assign days to catalog IDs, not raw geocoder output
- never require the public website to call a geocoder

Good workflow:

1. Extract candidate locations from tour/day titles.
2. Match existing catalog locations first.
3. Geocode unresolved candidates.
4. Create missing catalog locations.
5. Assign `primary_location_id` to days.
6. Review unresolved or low-confidence matches manually.

## Translations

Location names should follow the same central translation direction as marketing tour content.

Recommended rule:

- English source name lives on the location record.
- Runtime translations come from `content/translations`.
- Existing `name_i18n` can remain as a compatibility field until location translations are migrated.

The public static build should emit translated labels for the current language, not ask the browser to resolve internal translation state.

## Migration Path

Step 1: Stabilize current catalog
- Keep `destination_scope_destinations`, `destination_areas`, and `destination_places`.
- Add missing coordinates where useful.
- Backfill `primary_location_id` on marketing-tour days.
- Treat existing areas and places as location nodes in code.

Step 2: Generate public location filters
- During static build, derive the public filter model from published tours.
- Include referenced locations plus ancestors.
- Exclude unused catalog locations.

Step 3: Improve hierarchy
- Decide whether `North/Central/South` are regions and cities/islands are areas.
- Add area-level nodes such as `Da Nang`, `Ninh Binh`, `Phu Quoc`, `Mui Ne`.
- Move attraction-level entries such as `Marble Mountains` under the right area.

Step 4: Unify storage
- Optional later migration to one `locations` catalog.
- Keep compatibility adapters for existing APIs until the frontend and backend are fully moved.

## Design Principles

- The catalog is the list of possible locations.
- Published content determines which locations appear on the public website.
- Tour scope describes broad coverage.
- Day locations describe map anchors.
- Places are preferred for day anchors.
- Areas and regions are useful for grouping, fallback map centers, filters, and SEO.
- Coordinates are optional for all location types, but highly valuable for route maps.
- The public frontend should consume generated location data, not reconstruct hierarchy from raw tour JSON.
