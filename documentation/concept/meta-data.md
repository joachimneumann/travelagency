# Tour Metadata Concept

## Summary

Move route and content metadata closer to the itinerary day.

The marketing tour should keep only metadata that genuinely describes the whole product. Day-specific metadata should live on the travel-plan day, then the tour read model and public static build can derive tour-level aggregates from the days.

This concept covers:

- location and secondary location per day
- destination and destination scope using one consistent location concept
- one or more experience highlights per day
- derived tour-level location scope
- derived tour-level experience highlights

Travel style remains a direct tour-level field.

## Core Direction

Today, tour metadata is split across several concepts:

- tour destinations and destination scope
- destination areas and places
- day `primary_location_id` and `secondary_location_id`
- tour-level experience highlights
- travel style

Recommended direction:

- Treat destination, region, area, and place as one `Location` hierarchy.
- Store the most specific useful location references on each travel-plan day.
- Store day-specific experience highlights on each travel-plan day.
- Derive the tour's public filter scope and tour-level highlights from the days.
- Keep travel style on the tour because it describes the product positioning, not a specific day.

## Location Model

Use one location concept across the product.

Recommended hierarchy:

```text
Country / Destination
  Region
    Area
      Place
```

Examples:

```text
Vietnam
  Central Vietnam
    Da Nang
      Marble Mountains
      Son Tra Peninsula
      Ba Na Hills
    Hoi An
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
- the UI should use the word `location` consistently when the level does not matter
- public filters can still label levels as country, region, area, and place where helpful

## Location Types

`Country`
- The top-level destination, usually represented by an ISO-like country code such as `VN`.
- Used for public destination filters, tour scope, and country-level SEO.
- Example: `Vietnam`.

`Region`
- A broad route grouping inside a country.
- Useful for filters and route planning.
- Examples: `North`, `Central`, `South`.

`Area`
- A smaller travel cluster, city, province, island, bay, or route base.
- Useful for grouping places and grouping days in the customization UI.
- Examples: `Da Nang`, `Ninh Binh`, `Phu Quoc`, `Mui Ne`.

`Place`
- A concrete location used as a day anchor.
- This is the preferred level for `travel_plan.days[].primary_location_id`.
- Examples: `Marble Mountains`, `Hoi An Ancient Town`, `Trang An`, `Ba Na Hills`.

## Canonical Location Record

Long term, the cleanest model is one location catalog:

```json
{
  "id": "loc_vn_central_da_nang_marble_mountains",
  "type": "place",
  "parent_id": "loc_vn_central_da_nang",
  "country_code": "VN",
  "code": "marble-mountains",
  "name": "Marble Mountains",
  "name_i18n": {
    "vi": "Ngu Hanh Son"
  },
  "latitude": 16.0108,
  "longitude": 108.2532,
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
- `name_i18n`: translated names until location translations move fully into central translations
- `latitude`, `longitude`: optional map anchor or center
- `is_active`: available internally
- `is_public`: eligible for public website use

The current implementation can keep using:

- `destination_scope_destinations`
- `destination_areas`
- `destination_places`

But the read model should behave like one unified location tree.

## Day Metadata

The travel-plan day becomes the source of route and content metadata.

Recommended shape:

```json
{
  "id": "travel_plan_day_1",
  "day_number": 1,
  "title": "Marble Mountains and Hoi An",
  "primary_location_id": "loc_vn_central_da_nang_marble_mountains",
  "secondary_location_id": "loc_vn_central_hoi_an_ancient_town",
  "experience_highlight_ids": [
    "iconic_landmarks",
    "cultural_heritage"
  ],
  "services": []
}
```

Rules:

- `primary_location_id` is the main map anchor for the day.
- `secondary_location_id` is optional and supports a second stop or route segment.
- A day should prefer the most specific reliable location.
- If a specific place is not known, an area or region is acceptable as a fallback.
- Day map drawing should ignore locations without coordinates.
- `experience_highlight_ids` can contain zero, one, or many highlights.
- Highlights should describe what the customer experiences on that day, not generic tour marketing copy.

## Destination Scope

Destination scope should become a derived location scope.

Instead of manually maintaining a separate tour-level destination scope, derive it from day locations:

1. Read every `primary_location_id` and `secondary_location_id`.
2. Resolve each location in the location tree.
3. Add the location and all ancestors.
4. Deduplicate the set.
5. Emit the result as the tour's location scope.

Example day locations:

```text
Marble Mountains
Hoi An Ancient Town
Hue Imperial City
```

Derived location scope:

```text
Vietnam
Central Vietnam
Da Nang
Marble Mountains
Hoi An
Hoi An Ancient Town
Hue
Hue Imperial City
```

For compatibility, this can still be serialized into the existing `destination_scope` response shape until the frontend and API are fully migrated to `location_scope`.

Naming recommendation:

- Use `location_scope` for the derived set.
- Use `primary_location_id` and `secondary_location_id` for day anchors.
- Avoid mixing `destination`, `area`, and `place` as separate conceptual systems in new UI copy.
- Keep public-facing labels such as "Destination" where that wording is clearer for customers.

## Tour Metadata Derived From Days

The tour should accumulate metadata from its travel-plan days.

### Location Scope

The tour-level location scope is the superset of all day locations and their ancestors.

Input:

```json
[
  {
    "primary_location_id": "loc_vn_central_da_nang_marble_mountains",
    "secondary_location_id": "loc_vn_central_hoi_an_ancient_town"
  },
  {
    "primary_location_id": "loc_vn_central_hue_imperial_city"
  }
]
```

Output:

```json
{
  "location_scope": [
    "loc_vn",
    "loc_vn_central",
    "loc_vn_central_da_nang",
    "loc_vn_central_da_nang_marble_mountains",
    "loc_vn_central_hoi_an",
    "loc_vn_central_hoi_an_ancient_town",
    "loc_vn_central_hue",
    "loc_vn_central_hue_imperial_city"
  ]
}
```

### Experience Highlights

The tour-level experience highlights should be derived from day highlights.

Rule:

- Count all `experience_highlight_ids` across all days.
- Sort by frequency descending.
- Use a stable tie-breaker:
  1. first day appearance
  2. configured catalog order
  3. highlight ID
- Pick the top 4.

Example:

```json
[
  { "experience_highlight_ids": ["cultural_heritage", "iconic_landmarks"] },
  { "experience_highlight_ids": ["local_experiences", "cultural_heritage"] },
  { "experience_highlight_ids": ["delicious_cuisine", "cultural_heritage"] },
  { "experience_highlight_ids": ["iconic_landmarks"] }
]
```

Derived tour highlights:

```json
[
  "cultural_heritage",
  "iconic_landmarks",
  "local_experiences",
  "delicious_cuisine"
]
```

The derived highlights are used for:

- tour cards
- one-pager defaults
- public filtering if needed later
- SEO metadata if useful

The day-level highlights are used for:

- itinerary cards
- customizer module search/filtering
- one-pager day narratives
- future day-level visual badges

## Travel Style

Travel style remains part of the tour.

Reason:

- style is product positioning, not a day fact
- examples: classic, luxury, family, adventure, honeymoon
- a single day can contain multiple kinds of experiences, but the tour still has one or more intended styles

Keep:

```json
{
  "styles": ["classic", "family"]
}
```

Do not derive style from day highlights unless there is a separate recommendation feature later.

## Public Static Content

The public website should not expose every internal location.

During static public content generation:

1. Read all published marketing tours.
2. Read each travel-plan day's primary and secondary locations.
3. Resolve every referenced location against the catalog.
4. Add every referenced location and all ancestors to the generated public location set.
5. Build filter lists from that generated set.
6. Count day-level experience highlights.
7. Emit the top 4 derived tour highlights.

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

Benefits:

- no empty public filters
- no browser-side inference from raw tour JSON
- consistent translations and sorting
- location and highlight metadata come from the itinerary
- easier SEO and landing-page generation later

## Customization UI

The customizer should use day metadata directly.

Locations support:

- route map anchors
- dashed line between primary and secondary points
- grouping optional day modules by location
- detecting repeated days at the same location

Experience highlights support:

- filtering optional days by experience
- showing badges on day modules
- explaining why a suggested day fits the customer

Recommended optional-day shape:

```json
{
  "source_tour_id": "tour_...",
  "source_day_id": "day_3",
  "title": "Marble Mountains and Hoi An",
  "primary_location_id": "loc_vn_central_da_nang_marble_mountains",
  "primary_location_label": "Marble Mountains",
  "secondary_location_id": "loc_vn_central_hoi_an_ancient_town",
  "secondary_location_label": "Hoi An Ancient Town",
  "parent_area_label": "Da Nang",
  "latitude": 16.0108,
  "longitude": 108.2532,
  "experience_highlight_ids": ["iconic_landmarks", "cultural_heritage"]
}
```

## Admin UI

Recommended editing model:

- Tour-level form keeps title, description, travel style, priority, publication, SEO, and media.
- Travel-plan day editor owns:
  - primary location
  - secondary location
  - one or more experience highlights
- The tour page can show derived read-only summaries:
  - location scope
  - top 4 tour highlights
- The tours list can show derived public metadata for quick review.

Avoid asking staff to maintain the same metadata in two places.

## Migration Path

Step 1: Keep current compatibility fields
- Keep existing `destination_scope` and day `primary_location_id` / `secondary_location_id`.
- Add `experience_highlight_ids` to travel-plan days.
- Keep tour-level `styles`.

Step 2: Derive metadata in read models
- Derive `location_scope` from day locations.
- Derive top 4 tour experience highlights from day highlights.
- Keep existing tour-level fields as compatibility output where needed.

Step 3: Move UI ownership
- Move location scope editing out of the tour-level area over time.
- Add day-level experience highlight controls.
- Show derived summaries at tour level.

Step 4: Update public generation
- Generate public filters from derived location scope.
- Generate tour card and one-pager highlight defaults from derived day highlights.

Step 5: Optional storage cleanup
- Later migrate to a unified `locations` catalog.
- Later remove manually maintained tour-level destination scope if all consumers use derived scope.

## Design Principles

- The day is the source of route and experience facts.
- The tour aggregates day facts for public search, filters, cards, and SEO.
- Travel style remains tour-level.
- Locations should use one consistent concept and naming model.
- Public generated data should be derived, denormalized, and easy for the frontend to render.
- Staff should not maintain the same metadata twice.
