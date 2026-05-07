# Customize Marketing Tour

## Summary

Add one `Customize this tour` action to the itinerary area in the public marketing tour details. The action customizes the whole itinerary, not just one expanded day. The button opens a customization tool where a visitor can adapt the day-by-day route before contacting the agency or continuing into a booking flow.

After the visitor finishes the customization tool, the public tour details should reflect the customized itinerary. The visible day-by-day itinerary is replaced with the visitor's customized order and day selection, and the PDF preview should show a preview of the customized tour rather than the original unchanged marketing tour.

The tool has three main areas:

- bottom: a horizontal timeline containing the current days in the selected tour
- top left: a simplified Southeast Asia route map showing the selected itinerary route, connected by a dotted route line
- top right: a list of optional days from published marketing tours, plus any removed days from the current base tour, that can be dragged into the timeline

When the visitor adds, removes, or reorders days, the map updates immediately so the visual route always reflects the timeline.

## V1 Product Decisions

For the first implementation:

- include frontend customization, local customized-state persistence, visible itinerary replacement, and customized PDF preview
- exclude booking submission with the customized itinerary
- keep the existing `Plan this trip` booking flow unchanged until a later request/submission phase
- include deleted base-tour days in the optional-days panel so visitors can add them back
- manually seed coordinates for the current Vietnam destination catalog before relying on route maps

## Feasibility Findings

The current system already supports a similar day-copy workflow in the authenticated marketing-tour editor. Admin users can search travel-plan days from other marketing tours and import them into the current tour. This proves that the day-as-reusable-module idea fits the existing data and UI direction.

For the public customer customizer, do not expose the authenticated admin day search/import endpoints directly. Those endpoints are designed for staff, require authentication, and may expose internal or unpublished tour content.

Recommended public approach:

- build a public-safe optional-day catalog from all published marketing tours
- include the current base tour's public-safe days when they are not currently selected in the visitor's timeline
- include only customer-visible day content and customer-visible images
- exclude unpublished tours and internal-only fields
- include only days that have overnight latitude/longitude
- hide days that do not have usable route coordinates
- generate this as static public JSON with the existing public tour detail assets where possible
- include all customer-language translations needed to preserve the customized itinerary during language switching

Recommended public endpoint or asset shape:

```js
{
  tour_id: "...",
  optional_days: [
    {
      source_tour_id: "...",
      source_day_id: "...",
      title: "...",
      locationLabel: "...",
      notes: "...",
      thumbnail_url: "...",
      routePoint: { lat: 15.8801, lng: 108.3380 }
    }
  ]
}
```

This can later become a live endpoint such as:

- `GET /public/v1/tours/{tour_id}/customization-options`

For v1, static generated JSON is likely simpler, safer, and consistent with the existing public homepage data pipeline.

## Entry Point

The customization entry point belongs inside the expanded marketing tour details UI, in the itinerary area near the visible day list.

Recommended placement:

- show one tour-level button inside the itinerary area, after the travel plan header or below the day list header
- label: `Customize this tour`
- only enable it when the tour has structured travel-plan days
- keep the normal itinerary readable without forcing visitors into the customization tool

Opening behavior:

- desktop: open a large modal or full-page overlay
- mobile: open a full-screen overlay
- preserve the original marketing tour page position when the tool is closed

Closing / finishing behavior:

- when the visitor finishes the customizer, apply the customized itinerary to the currently open tour details UI
- replace the visible itinerary with the customized `timelineDays`
- update day numbering, route/order, removed days, and added optional days in the tour details
- update the PDF preview action so it previews the customized tour
- do not mutate the saved marketing tour record unless the visitor explicitly submits or requests the customized tour
- if the visitor cancels or closes without finishing, keep the original tour details unchanged

## Customization Tool Layout

### Top Left: Route Map

The map is a simplified visual map of Southeast Asia, not a fully interactive GIS map in the first version.

It should show:

- the country or region outline as a static background image
- one representative marker per timeline day, grouped when several days resolve to the same route point
- day number labels on the markers
- a dotted line connecting the markers in timeline order
- enough visual contrast that the route is clear over the background

The map should update whenever:

- an optional day is added to the timeline
- a day is deleted from the timeline
- the timeline order changes

For v1, the map can use a static image with marker coordinates resolved from destination place/area latitude and longitude. A full map library is optional and should only be added if the product needs zooming, panning, or accurate geographic interaction.

### Several Days At The Same Location

The timeline remains one item per day, but the map should represent distinct route points. If several timeline days resolve to the same location, draw one marker for that route point instead of overlapping duplicate markers.

Marker label rules:

- one day at the location: show the day number, for example `3`
- consecutive days at the location: show a range, for example `2-4`
- non-consecutive days returning to the same location: show comma/range text, for example `2, 5` or `2-3, 6`

Map route rules:

- do not draw zero-length route segments between consecutive days at identical coordinates
- connect only distinct route points in timeline order
- if the customized route leaves a place and later returns to the same place, the route line may logically pass through that same marker again, but the UI should still avoid duplicate overlapping markers

Interaction rules:

- hovering or tapping a grouped marker should show the days at that location
- the marker accessible label should describe the grouped days, for example `Days 2 to 4, Hoi An`
- timeline days stay individually visible, reorderable, and removable even when they share a map marker
- consecutive same-location days should read as a stay, not as extra travel

### Top Right: Optional Days

The optional-days panel shows available day modules that are not currently part of the tour timeline. This includes public-safe days from other published marketing tours and public-safe days from the current base tour after the visitor removes them from the timeline.

Each optional day card should include:

- title
- short location label
- short description or highlights
- optional thumbnail if available
- a clear drag handle or visual drag affordance

The visitor can drag an optional day into the timeline. Dropping the day into the timeline inserts it at the chosen position and removes it from the optional-days list.

If drag and drop is difficult on a device, provide an accessible fallback:

- an `Add` button on each optional day
- after adding, place the day at the end of the timeline or open a simple placement chooser

### Bottom: Timeline

The timeline is the source of truth for the customized itinerary.

It should show:

- one item per selected day
- day number based on current order
- day title
- location
- delete action
- drag handle for reordering if supported

The visitor can:

- drag optional days into the timeline
- reorder existing timeline days
- delete days from the timeline

Deleting a day removes it from the timeline and triggers a map update. If the deleted day is reusable public-safe content, including an original base-tour day, it should become available in the optional-days panel.

Customers may remove all original days. The customized itinerary is still valid as long as it stays within the configured day limit and contains at least one selected day before requesting or booking the trip.

The maximum customized itinerary length is 20 days by default. Keep this value configurable.

## State Model

Keep the customization state separate from the original tour object.

Recommended state:

```js
{
  originalTourId: "...",
  timelineDays: [
    {
      id: "...",
      source: "original",
      sourceTourId: "...",
      sourceDayId: "...",
      title: "...",
      locationLabel: "...",
      routePoint: { lat: 15.8801, lng: 108.3380 },
      mapPoint: { x: 52, y: 38 }
    }
  ],
  optionalDays: [
    {
      id: "...",
      source: "optional",
      sourceTourId: "...",
      sourceDayId: "...",
      title: "...",
      locationLabel: "...",
      routePoint: { lat: 15.8799, lng: 108.3274 },
      mapPoint: { x: 58, y: 44 }
    }
  ]
}
```

Rules:

- `timelineDays` drives both the timeline UI and the map route.
- Map markers are rendered from `timelineDays` in order.
- Day numbers are derived from the current array position, not stored permanently.
- The original marketing tour data remains unchanged until the visitor explicitly submits or requests the customized tour.
- Optional days should have stable ids so they can move between panels without duplicating.
- The customized state should persist after the visitor finishes the customizer.
- For v1, persist the customized state in browser storage keyed by original tour id so it survives closing/reopening the details panel and a same-device page reload.
- For v1, do not send the customized itinerary with the `Plan this trip` booking request.
- For v1, the existing booking flow can continue to submit the original selected tour context.
- A later request/submission phase can send the customized itinerary with the booking or custom-tour request and use it directly as the initial booking travel plan.
- After that later booking creation flow exists, the durable copy of the customized itinerary should be the booking travel plan.
- A later v2 can add server-side customization drafts if visitors need a shareable link, cross-device access, or recovery after clearing browser data.

## Data Requirements

Existing marketing tour travel-plan days can seed the initial timeline.

Each day used by the customization tool should expose:

- stable `id`
- source tour id when the day comes from another marketing tour
- source day id when the day comes from another marketing tour
- title
- location label
- short description or notes
- route/map point resolved from the destination catalog
- all customer-language translations needed for title, location label, notes, and visible service copy
- optional image
- source flag: original tour day or optional day

### Route Coordinates

Do not store latitude and longitude directly on every marketing-tour day as the primary source of truth.

Many marketing-tour days refer to the same real place. If each day stores its own coordinates, the same location is duplicated across many tours. Over time, those copies will drift. For example, several tours may all contain a `Hoi An` day, but each could end up with slightly different latitude and longitude values. The map would then show the same destination in different places depending on which tour supplied the day.

Store coordinates once on reusable destination catalog records instead:

- destination place: exact city, town, site, hotel area, airport, or attraction
- destination area: broader region or fallback centroid

Marketing-tour days should reference a destination place or area. The customizer resolves the route point from that reference.

For v1, use the day overnight location as the route-marker source. One representative marker per day is acceptable. If a day has many service locations, the map still uses the overnight location unless a tour editor sets a day-level route override.

Recommended catalog shape:

```js
{
  destination_places: [
    {
      id: "place_hoi_an",
      area_id: "area_central_vietnam",
      name: "Hội An",
      latitude: 15.8801,
      longitude: 108.3380
    }
  ],
  destination_areas: [
    {
      id: "area_central_vietnam",
      destination: "VN",
      name: "Central Vietnam",
      latitude: 16.3,
      longitude: 107.6
    }
  ]
}
```

Recommended travel-plan day shape:

```js
{
  id: "day_...",
  title: "Explore Hoi An Ancient Town",
  destination_place_id: "place_hoi_an",
  destination_area_id: "area_central_vietnam"
}
```

Route point resolution order:

1. day-level route override, if present
2. referenced destination place coordinates
3. referenced destination area coordinates
4. no marker / not available

Day-level overrides are still useful for special cases, for example a river cruise, a mountain pass route, or a multi-stop day where the route marker should sit at a curated midpoint. These overrides should be exceptions, not the default.

Resolved route points can be converted to normalized image coordinates for a static map:

```js
{
  routePoint: { lat: 15.8801, lng: 108.3380 },
  mapPoint: { x: 63.4, y: 48.2 }
}
```

For v1 with a static Southeast Asia image, normalized image coordinates are simpler and more predictable.

Optional days can come from:

- any published marketing tour
- public-safe days from the current base tour when those days are not currently selected

Only show optional days that have overnight latitude/longitude. Days without usable route coordinates should be hidden from the optional-days catalog.

The current destination scope catalog already has destinations, areas, and places, but it does not yet store latitude or longitude. Coordinates should be added to that catalog before relying on route maps.

V1 coordinate seeding decision:

- manually seed latitude and longitude for the current Vietnam destination areas and places
- keep the coordinate fields in the reusable destination catalog, not duplicated on each tour day
- add editor maintenance after the seeded catalog proves the route-map workflow

Existing travel-plan days also do not currently have structured `destination_place_id` or `destination_area_id` fields. They should be added so days can resolve their map point through the catalog.

Tour editors should maintain the route coordinates inside the marketing tour editor. The editor should make it easy to choose a destination place or area for each day and should expose latitude/longitude maintenance for the selected overnight location.

If an optional day source becomes unavailable because the source tour is unpublished or the day is removed after the public customization data was generated, delete that optional day from the visitor's available/customized state the next time the state is reconciled.

## Interaction Rules

### Add Optional Day

1. Visitor drags an optional day card into the timeline.
2. The day is inserted at the drop position.
3. Timeline day numbers are recalculated.
4. The day is removed from the optional-days panel.
5. The map markers and dotted route line are redrawn.

### Delete Timeline Day

1. Visitor clicks the delete action on a timeline day.
2. The day is removed from the timeline.
3. Timeline day numbers are recalculated.
4. If the day is reusable, including a removed original base-tour day, it appears again in optional days.
5. The map markers and dotted route line are redrawn.

### Reorder Timeline Days

1. Visitor drags a timeline day to a new position.
2. The timeline array is reordered.
3. Day numbers are recalculated.
4. The map route line is redrawn in the new order.

## Output And Next Step

The customization tool should eventually produce a customized tour request that sales or operations can review. Before that request is submitted, the customized itinerary should still be applied locally to the current tour details view so the visitor can review the result.

Recommended v1 output:

- original marketing tour id
- ordered list of selected day ids
- added optional day ids
- removed original day ids
- visitor notes, if a notes field is added

The first implementation should stop at frontend customization, updating the visible tour details and PDF preview locally. Booking submission with the customized itinerary is explicitly out of v1 scope. A later backend request flow can add a clear call-to-action such as `Request this customized tour`.

After finishing the customizer:

- the marketing tour details page should show the customized itinerary as the active itinerary for this visitor session
- the PDF preview should render the customized itinerary
- the page should still retain enough state to reset back to the original tour if a reset action is provided
- the customized itinerary state should be retained locally so it can be included in a later `Request this customized tour` or booking submission phase

### Customized PDF Preview

The current public PDF preview renders the stored published marketing tour. It does not know about a visitor's local customized itinerary.

To preview a customized itinerary, add a separate public-safe PDF preview path. Do not try to encode the full customized itinerary in a GET URL.

Recommended endpoint:

- `POST /public/v1/tours/{tour_id}/one-pager-preview`

Recommended request body:

```js
{
  lang: "en",
  selected_days: [
    { source_tour_id: "...", source_day_id: "..." }
  ],
  removed_original_day_ids: ["..."],
  visitor_notes: ""
}
```

Backend rules:

- validate the base tour is published
- validate every selected day comes from public-safe published content
- reconstruct the customized travel plan server-side from source ids
- ignore or reject client-supplied full day bodies for security
- render a temporary PDF preview
- do not persist a booking or mutate the marketing tour record

The public tour details page should update the PDF preview action after finishing the customizer so it uses this customized preview flow.

There are two practical ways to open the customized PDF:

1. Fetch a PDF Blob from the POST response and open it with a browser object URL.
2. Create a short-lived preview token.

A preview token means the browser first sends the customized day ids to the server with a POST request. The server validates them, stores the preview data temporarily, and returns a short temporary URL such as `/public/v1/tour-preview/{token}.pdf`. The browser can then open that URL like a normal PDF link. This avoids putting the whole customized itinerary in the URL and makes opening the preview in a new tab easier.

Recommended v1 choice: use a short-lived preview token for the PDF preview.

## Accessibility And Mobile

Drag and drop must not be the only way to customize.

Requirements:

- optional-day cards have keyboard-accessible `Add` actions
- timeline days have keyboard-accessible delete actions
- timeline reorder should have a non-drag fallback if reordering is part of v1
- map visualization is decorative unless it exposes useful route text elsewhere
- screen readers should be able to understand the current timeline as an ordered list
- mobile layout should stack map, optional days, and timeline while keeping the timeline easy to reach

Suggested mobile layout:

1. map preview
2. timeline
3. optional days

This keeps the selected itinerary visible before the optional-day catalog.

## Implementation Notes

Use the existing marketing tour details code as the integration point. The customization tool should be its own module instead of growing the tour-card renderer too much.

Recommended frontend structure:

- `frontend/scripts/tour_customize.js`
  - state management
  - drag/drop behavior
  - add/delete/reorder actions
  - map redraw orchestration
- dedicated CSS file if styling grows beyond a small block
- static Southeast Asia map asset in the public shared assets directory

For the map rendering, prefer simple HTML/SVG over a map library in v1:

- static image background
- absolutely positioned day markers
- SVG overlay for dotted route lines

This keeps the first version lightweight and avoids introducing a large mapping dependency before the interaction proves valuable.

Do not use Google Maps for v1. A simplified static map is sufficient and avoids API keys, billing, tile loading, tracking/privacy concerns, and dependency weight.

Recommended map projection for a fixed Southeast Asia/Vietnam map:

```js
function projectLatLng({ lat, lng }) {
  const bounds = {
    north: 24.5,
    south: 7.0,
    west: 97.0,
    east: 110.5
  };

  return {
    x: ((lng - bounds.west) / (bounds.east - bounds.west)) * 100,
    y: ((bounds.north - lat) / (bounds.north - bounds.south)) * 100
  };
}
```

The projected `{ x, y }` values can drive marker placement with percentages and a route `<polyline>` in an SVG overlay.

Recommended implementation sequence:

1. Add coordinate fields to destination areas and places.
2. Manually seed coordinates for the current Vietnam destination catalog.
3. Add day references to destination place/area records.
4. Generate public-safe optional-day data from published marketing tours and removed base-tour days.
5. Build the frontend customizer overlay and local itinerary state.
6. Apply finished customization back into the visible tour details.
7. Add the customized PDF preview endpoint.
8. Later: add the request/submission flow for sales follow-up and customized booking creation.

## Acceptance Scenarios

- A visitor opens a marketing tour itinerary and sees `Customize this tour`.
- Clicking the button opens the customization tool with the tour's existing days in the bottom timeline.
- The map shows the selected route with distinct route-point markers and a dotted line connecting the route.
- Several days at the same route point are grouped into one map marker with a day range or day list.
- Optional days are visible in the top-right panel.
- Dragging an optional day into the timeline adds it to the selected itinerary.
- Adding a day updates marker numbering and redraws the dotted route.
- Deleting a timeline day removes it from the timeline and updates the map.
- Deleting an original base-tour day makes it available in the optional-days panel so the visitor can add it back.
- Reordering timeline days updates the route order on the map.
- Finishing the customizer closes the tool and updates the public tour details with the customized itinerary.
- After finishing, the PDF preview shows the customized tour itinerary.
- Cancelling the customizer closes the tool without changing the public tour details or PDF preview.
- Optional days shown to visitors come only from public-safe published marketing-tour content.
- Days without resolvable route coordinates are hidden from the optional-days catalog.
- Route markers are drawn on a simplified static map without Google Maps.
- The tool remains usable on mobile without requiring drag and drop.
- V1 does not send the customized itinerary through the booking submission flow.
