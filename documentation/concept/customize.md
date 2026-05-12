# Destination-First Tour Customizer

## Summary

Add one `Customize this tour` action to the itinerary area in the public marketing tour details. The action opens a destination-first customizer with a destination library and a day-based route timeline.

The important product shift is:

- customers choose destinations first
- the timeline remains based on individual days
- one drag from the destination library creates one day in the timeline
- the system still stores, renders, previews, and submits the result as normal `travel_plan.days[]`

The public UI should not ask visitors to choose from abstract optional day cards first. It should ask:

1. Where do you want to go next?
2. In what order should those destination days appear?
3. Do you want to repeat a destination for another day?

After the visitor finishes the customizer, the public tour details should reflect the customized day list. The visible day-by-day itinerary is replaced with the visitor's customized timeline. Both public PDF previews should show the customized tour instead of the original unchanged marketing tour.

The customizer itself does not contain `Plan this trip`, `Get a quote`, or booking/request buttons. The `Get a quote` action remains in the tour details UI. When a visitor has an active customization and then clicks `Get a quote`, the customized ordered list of days must be transmitted and appear in `bookings.html`.

## Product Concept

The customer-facing concept is destination-first, but the timeline stays day-based.

Recommended customer-facing terms:

- `Route` for the ordered trip structure
- `Destination` for a place that can be dragged from the library
- `Day` for one item in the route timeline

Example customer route:

```text
Day 1: Hanoi -> Day 2: Ninh Binh -> Day 3: Hoi An -> Day 4: Hoi An
```

Each destination library card represents exactly one `DestinationPlace`. A destination card does not represent a multi-day stop and does not expose a list of selectable day templates. If a visitor wants multiple days in the same destination, they drag that destination into the timeline multiple times.

Each timeline item is one day. Non-consecutive repeats of the same destination become separate route visits. Consecutive repeats remain separate day items in the timeline, but the route map may combine their marker when they share the same coordinates.

When a destination is dropped into the timeline, the system assigns one public-safe source day for that destination. If several source days are available, the assignment is random. If the visitor uses the same destination more times than there are available templates, repeated suggestions are allowed.

## V1 Product Decisions

For the first implementation:

- include frontend customization, local customized-state persistence, visible itinerary replacement, customized quote handoff, and customized PDF previews
- make the library destination-first while keeping the route timeline day-based
- make each destination library card exactly one `DestinationPlace`
- support Vietnam only
- include only destinations that exist in existing public-safe marketing tour days
- include only destinations with route coordinates; destinations without coordinates are not shown
- keep destination cards visible in the library after they are dragged into the timeline
- do not show an `Add` button on destination cards
- do not add service-level customization in the customizer
- randomly assign one source day when a destination is dropped into the timeline
- allow repeated source-day suggestions when a destination is used more times than its available source-day pool
- store local customizations using IDs only, not copied day or service bodies
- keep route coordinates in the customization tool only
- use the existing day/service-based backend travel-plan model
- do not add a heavy map dependency in v1

## Feasibility Findings

The current system already has the right internal building blocks:

- marketing tours contain structured `travel_plan.days[]`
- each day can reference destination places with `primary_location_id` and `secondary_location_id`
- each day contains nested services that can be copied from the chosen source day
- the authenticated marketing-tour editor can search and import existing days from other marketing tours
- destination scope already separates destinations, regions, and places

That means the customer UI can change without rewriting the travel-plan storage model. The customizer should use a day-based customer state called `timelineDays`. Each timeline item points to one destination place and one assigned public-safe source day. When the visitor finishes, `timelineDays` are rendered directly as ordered `travel_plan.days[]`.

For the public customer customizer, do not expose authenticated admin search/import endpoints directly. Those endpoints are designed for staff, require authentication, and may expose internal or unpublished tour content.

Recommended public approach:

- generate a public-safe customization catalog from published marketing tours
- limit v1 catalog generation to Vietnam
- expose one destination card per Vietnam `DestinationPlace`
- include only destination places that appear in existing public-safe marketing tour days
- include only destination places that have usable customizer route coordinates
- include a pool of source day IDs for each destination place
- include only customer-visible day content and service content when day bodies are needed for rendering
- exclude unpublished tours and internal-only fields
- include all customer-language translations needed to preserve the customized itinerary during language switching

Recommended public endpoint or asset shape:

```js
{
  tour_id: "...",
  destinations: [
    {
      place_id: "place_hoi_an",
      label: "Hoi An",
      region_label: "Central Vietnam",
      destination_code: "VN",
      thumbnail_url: "...",
      highlights: ["Ancient town", "Food tour", "Countryside cycling"],
      routePoint: { lat: 15.8801, lng: 108.3380 },
      mapPoint: { x: 63.4, y: 48.2 },
      source_day_pool: [
        {
          source_tour_id: "...",
          source_day_id: "..."
        }
      ]
    }
  ]
}
```

`source_day_pool` is not a customer-facing list of days. It is the public-safe ID pool used by the customizer when a destination is dropped into the day timeline.

This can later become a live endpoint such as:

- `GET /public/v1/tours/{tour_id}/customization-options`

For v1, static generated JSON is likely simpler, safer, and consistent with the existing public homepage data pipeline.

## Entry Point

The customization entry point belongs inside the expanded marketing tour details UI, in the itinerary area near the visible day list.

Recommended placement:

- show one tour-level button inside the itinerary area, after the travel plan header or below the day list header
- label: `Customize this tour`
- only enable it for Vietnam tours whose travel-plan days can resolve to routeable destination places
- keep the normal itinerary readable without forcing visitors into the customization tool

Opening behavior:

- desktop: open a large modal or full-page overlay
- mobile: open a full-screen overlay
- preserve the original marketing tour page position when the tool is closed

Closing / finishing behavior:

- when the visitor finishes the customizer, apply the customized itinerary to the currently open tour details UI
- replace the visible itinerary with days generated from `timelineDays`
- update day numbering, route order, removed days, added days, repeated destinations, and copied source-day services
- update both PDF preview actions so they preview the customized tour
- keep `Get a quote` outside the customizer, in the tour details UI
- when `Get a quote` is clicked with an active customization, submit the customized ordered day IDs with the quote request so `bookings.html` shows the customized travel plan
- do not mutate the saved marketing tour record
- if the visitor cancels or closes without finishing, keep the original tour details unchanged

## Customization Tool Layout

### Route Map

The map is a simplified visual map for Vietnam, not a fully interactive GIS map in the first version.

It should show:

- representative markers for the current day timeline
- marker labels based on timeline day numbers, for example `1`, `2`, `3`, or `3-4`
- destination labels near or inside markers where space allows
- a dotted line connecting the route in timeline order
- enough visual contrast that the route is clear over the background

Marker rules:

- if two consecutive timeline days share the same coordinates, show a combined marker
- if two non-consecutive timeline days share the same coordinates, show separate markers with a slight visual offset
- the timeline remains day-based even when consecutive markers are visually combined

The map should update whenever:

- a destination is dragged into the timeline
- a timeline day is removed
- timeline days are reordered
- a source day is assigned or reassigned

For v1, the map can use a static image with marker coordinates resolved from customizer-owned route coordinate data. A full map library is optional and should only be added if the product needs zooming, panning, or accurate geographic interaction.

### Destination Library

Replace the optional-days panel with a destination library.

The destination library shows Vietnam destinations that can be dragged into the trip. Each destination card is exactly one `DestinationPlace` and should include:

- destination/place name
- region or country label
- short highlights
- optional thumbnail if available
- clear drag handle or visual drag affordance

Destination library rules:

- do not show an `Add` button
- do not remove a destination card from the library after it is dragged into the timeline
- do not show destinations outside Vietnam in v1
- do not show destinations that do not appear in existing public-safe marketing tour days
- do not show destinations without customizer route coordinates
- do not show day-template lists inside destination cards

The visitor drags a destination into the route timeline. Dropping the destination inserts one day at the chosen position and randomly assigns one source day from that destination's public-safe source-day pool.

If drag and drop is difficult on a device or for keyboard users, provide an accessible placement flow that does not use an `Add` button. For example, the visitor can pick up a focused destination card, move focus to a timeline drop slot, and confirm placement.

### Route Timeline

The route timeline is the source of truth for the customized route and remains based on days.

It should show:

- one item per selected day
- route order based on current timeline position
- day number
- destination name
- assigned source-day title or short description when available
- delete action
- drag handle for reordering if supported

The visitor can:

- drag destinations into the timeline to create days
- drag the same destination multiple times to create multiple days in that destination
- reorder timeline days
- remove timeline days
- open a day to preview the copied day content

The visitor cannot:

- change a destination duration with a stepper
- expand one destination into multiple nested days
- edit services
- add optional services
- move services between days

Deleting a timeline day removes that day only. The destination remains available in the destination library, regardless of whether the deleted day came from the original base tour or was added by the visitor.

The customized itinerary is valid as long as it stays within the configured day limit and contains at least one timeline day before previewing, quoting, or submitting the trip.

The maximum customized itinerary length is 20 days by default. Keep this value configurable.

### Day Preview

When the visitor clicks a timeline day, open a read-only detail panel for that day.

The panel may show:

- day title
- day notes
- copied customer-visible services from the assigned source day
- customer-visible images, if available

The day preview is not an admin editor and not a service customizer. Avoid exposing supplier references, internal prices, operational notes, image management, or staff-only fields.

## State Model

Keep the customization state separate from the original tour object.

Persist only IDs in browser storage. Do not persist copied day bodies, service bodies, labels, coordinates, or images.

Recommended customer customization state:

```js
{
  originalTourId: "...",
  timelineDays: [
    {
      timelineItemId: "custom_day_1",
      placeId: "place_hoi_an",
      sourceTourId: "...",
      sourceDayId: "..."
    }
  ],
  removedOriginalDayIds: [],
  visitorNotes: ""
}
```

Rules:

- `timelineDays` drives the route timeline and map
- each `timelineDays[]` item is exactly one customized day
- day numbers are derived from the timeline order, not stored permanently
- reordering timeline days recalculates all day numbers
- dragging the same `DestinationPlace` multiple times creates multiple timeline days
- the destination library is not depleted by timeline use
- the original marketing tour data remains unchanged
- public catalog items must have stable IDs
- local customized state should persist after the visitor finishes the customizer
- for v1, persist customized state in browser storage keyed by original tour id so it survives closing/reopening the details panel and a same-device page reload
- for v1, submit the customized day IDs with the tour details `Get a quote` flow when customization is active
- after quote submission, the durable copy of the customized itinerary should be the booking travel plan shown in `bookings.html`
- a later v2 can add server-side customization drafts if visitors need a shareable link, cross-device access, or recovery after clearing browser data

When stored customizations are reconciled against a newer public catalog:

- if a stored destination still exists but its stored source day no longer exists, choose another random public-safe source day for that destination when possible
- if no public-safe source day remains for a stored destination, remove that timeline day
- if a stored destination no longer has route coordinates, remove that timeline day

### Flattening To Travel Plan Days

The customer UI is destination-first. The internal output remains an ordered travel plan.

Flattening rules:

1. Iterate through `timelineDays` in order.
2. Resolve each item by `sourceTourId` and `sourceDayId`.
3. Create one `travel_plan.days[]` item per timeline day.
4. Set `day_number` from the flattened index.
5. Set the day location fields from the assigned source day and destination place.
6. Preserve the source day services as-is, filtered to customer-visible public content.
7. Preserve source IDs so the backend can reconstruct public-safe content for previews and quote submission.

Recommended flattened day shape:

```js
{
  id: "custom_day_1",
  day_number: 4,
  title: "Hoi An ancient town",
  primary_location_id: "place_hoi_an",
  services: [],
  customization_source: {
    source_tour_id: "...",
    source_day_id: "..."
  }
}
```

## Data Requirements

Existing marketing tour travel-plan days seed the initial timeline. The initial timeline remains day-based; consecutive days with the same primary destination place are not grouped into a multi-day stop.

Each destination used by the customization tool should expose:

- stable place id
- destination/country code, limited to `VN` in v1
- region label
- customer-visible place label
- short highlights
- customizer route/map point
- source day ID pool
- all customer-language translations needed for visible labels and day copy
- optional image

Each source day should expose or be resolvable by:

- stable source tour id
- stable source day id
- title
- notes
- customer-visible services
- source place id
- optional image

Do not expose service suggestions as independent customizer options in v1.

### Route Coordinates

Route coordinates live in the customization tool only.

Do not store latitude and longitude directly on every marketing-tour day as the primary source of truth. Do not require the generic destination catalog or marketing tour editor to become the v1 maintenance surface for route-map coordinates.

For v1, maintain customizer route coordinates in customization-specific data keyed by `DestinationPlace.id`. The customizer resolves a day location by using the day primary location, then looking up that place in the customization coordinate data.

Recommended customization route coordinate shape:

```js
{
  customization_route_points: [
    {
      place_id: "place_hoi_an",
      lat: 15.8801,
      lng: 108.3380,
      mapPoint: { x: 63.4, y: 48.2 }
    }
  ]
}
```

Route point resolution order:

1. referenced destination place id in the customization coordinate data
2. no marker and no destination library entry

No destinations without coordinates is a hard v1 rule. Hide destinations without usable route coordinates until they are maintained in the customization tool.

Existing travel-plan days do not consistently have structured destination place fields. They should be normalized so Vietnam days can resolve their customizer map point through `primary_location_id`.

If a destination or source day becomes unavailable because the source tour is unpublished or the day is removed after the public customization data was generated, remove or reassign that source from the visitor's available/customized state the next time the state is reconciled.

## Interaction Rules

### Drag Destination Into Timeline

1. Visitor drags a destination card into the route timeline.
2. The destination is inserted as one timeline day at the drop position.
3. The destination card remains visible in the library.
4. The customizer randomly assigns one public-safe source day from that destination's source-day pool.
5. If the destination has fewer source templates than the number of times it is used, repeated suggestions are allowed.
6. Day numbers are recalculated from the full timeline.
7. The map markers and dotted route line are redrawn.

### Repeat Destination

1. Visitor drags the same destination into the timeline again.
2. The new timeline item becomes another day in that destination.
3. If the repeated destination is consecutive with an existing day at the same coordinates, the map can combine the marker label.
4. If the repeated destination is non-consecutive, the map shows a separate marker with slight offset.
5. Timeline day items remain separate in both cases.

### Preview Day

1. Visitor opens a timeline day.
2. The customizer shows the resolved source day content.
3. Services are read-only.
4. The timeline day remains in the same position unless the visitor explicitly reorders it.

### Delete Timeline Day

1. Visitor deletes one timeline day.
2. Only that timeline day is removed.
3. Day numbers are recalculated.
4. The destination remains available in the destination library.
5. The map markers and dotted route line are redrawn.

### Reorder Timeline Days

1. Visitor drags a timeline day to a new position or uses an accessible move flow.
2. The `timelineDays` array is reordered.
3. Day numbers are recalculated.
4. Consecutive/non-consecutive marker grouping is recalculated.
5. The map route line is redrawn in the new order.

## Output And Quote Handoff

The customization tool produces an ordered customized day list. The customizer itself does not submit a quote request and does not show `Get a quote`.

Recommended v1 output:

- original marketing tour id
- ordered list of timeline days
- destination place id for each timeline day
- source tour id for each timeline day
- source day id for each timeline day
- removed original day ids
- visitor notes, if a notes field is added

After finishing the customizer:

- the marketing tour details page should show the customized itinerary as the active itinerary for this visitor session
- both PDF previews should render the customized tour itinerary
- the page should retain enough state to reset back to the original tour
- the customized itinerary state should be retained locally

When the visitor clicks `Get a quote` in the tour details UI:

- if no customization is active, keep the existing quote behavior
- if customization is active, transmit the customized ordered day IDs with the quote request
- the backend should reconstruct the booking travel plan from public-safe source days
- the resulting customized travel plan should appear in `bookings.html`
- the saved marketing tour record should not be mutated

### Customized PDF Preview

The current public PDF preview renders the stored published marketing tour unless a visitor has an active local customization.

To preview a customized itinerary, use public-safe preview paths. Do not encode the full customized itinerary in a GET URL.

Recommended endpoints:

- `POST /public/v1/tours/{tour_id}/one-pager-preview`
- `POST /public/v1/tours/{tour_id}/travel-plan-preview`

Recommended request body:

```js
{
  lang: "en",
  selected_days: [
    {
      source_tour_id: "...",
      source_day_id: "..."
    }
  ],
  title: "Customized Vietnam route"
}
```

Backend rules:

- validate the base tour is published
- validate every selected source day comes from public-safe published content
- reconstruct the customized travel plan server-side from source IDs
- ignore or reject client-supplied full day or service bodies for security
- render a temporary PDF preview
- do not persist a booking or mutate the marketing tour record from PDF preview requests

The public tour details page should update both PDF preview actions after finishing the customizer so they use this customized preview flow.

There are two practical ways to open the customized PDF:

1. Fetch a PDF Blob from the POST response and open it with a browser object URL.
2. Create a short-lived preview token.

A preview token means the browser first sends the customized day list to the server with a POST request. The server validates it, stores the preview data temporarily, and returns a short temporary URL such as `/public/v1/tour-preview/{token}.pdf` or `/public/v1/tour-preview/{token}/travel-plan.pdf`. The browser can then open that URL like a normal PDF link. This avoids putting the whole customized itinerary in the URL and makes opening the preview in a new tab easier.

Recommended v1 choice: use short-lived preview tokens for both customized PDF previews.

## Accessibility And Mobile

Drag and drop must not be the only usable way to customize, but destination cards should not show an `Add` button.

Requirements:

- destination cards have keyboard-accessible pickup/placement behavior
- timeline days have keyboard-accessible delete and move actions
- route reorder has a non-drag accessible flow
- map visualization is decorative unless it exposes useful route text elsewhere
- screen readers can understand the current route as an ordered list of days and destinations
- mobile layout keeps the selected route visible before the destination catalog

Suggested mobile layout:

1. route map preview
2. route timeline
3. selected day preview
4. destination library

This keeps the selected itinerary visible before the broader destination catalog.

## Implementation Notes

Use the existing marketing tour details code as the integration point. The customization tool should be its own module instead of growing the tour-card renderer too much.

Recommended frontend structure:

- `frontend/scripts/tour_customize.js`
  - state management
  - destination library rendering
  - day-based timeline state
  - random source-day assignment
  - drag/drop behavior
  - delete/reorder actions
  - read-only day preview
  - local ID-only persistence
  - map redraw orchestration
- dedicated CSS file if styling grows beyond a small block
- static Vietnam map asset in the public shared assets directory
- customization-owned route coordinate data keyed by `DestinationPlace.id`

For the map rendering, prefer simple HTML/SVG over a map library in v1:

- static image background
- absolutely positioned destination markers
- SVG overlay for dotted route lines
- marker combining for consecutive repeated coordinates
- slight marker offsets for non-consecutive repeated coordinates

This keeps the first version lightweight and avoids introducing a large mapping dependency before the interaction proves valuable.

Do not use Google Maps for v1. A simplified static map is sufficient and avoids API keys, billing, tile loading, tracking/privacy concerns, and dependency weight.

Recommended map projection for a fixed Vietnam map:

```js
function projectLatLng({ lat, lng }) {
  const bounds = {
    north: 24.5,
    south: 7.0,
    west: 101.0,
    east: 110.5
  };

  return {
    x: ((lng - bounds.west) / (bounds.east - bounds.west)) * 100,
    y: ((bounds.north - lat) / (bounds.north - bounds.south)) * 100
  };
}
```

The projected `{ x, y }` values can drive marker placement with percentages and a route `<polyline>` in an SVG overlay.

## Implementation Plan

### Phase 1: Data Readiness

Goal: make Vietnam destination places reliable enough to support a day-based destination customizer.

Tasks:

- audit published Vietnam tour days and identify missing or inconsistent `primary_location_id` values
- normalize Vietnam tour days so routeable days reference `DestinationPlace` records
- create customization-owned route coordinate data for Vietnam destination places used by marketing tour days
- exclude destinations without customizer coordinates
- add tests for Vietnam-only filtering, source-day eligibility, and coordinate gating

Deliverable:

- published Vietnam tour days can be resolved to destination library cards and source-day pools

### Phase 2: Public Customization Catalog

Goal: generate the data the public customizer can use without exposing staff endpoints.

Tasks:

- extend the public tour asset generation pipeline with customization options
- generate one destination card per eligible Vietnam `DestinationPlace`
- include only destinations that appear in existing public-safe marketing tour days
- include a source-day ID pool for each destination
- include route/map points from customization-owned coordinate data
- include language-specific customer-visible labels and day copy
- add tests that unpublished/internal content and non-Vietnam destinations are excluded

Deliverable:

- each eligible public Vietnam tour has a public-safe customization options asset or endpoint response

### Phase 3: Frontend Destination Library And Day Timeline

Goal: build the destination-first customizer overlay while keeping the timeline day-based.

Tasks:

- add `Customize this tour` entry point to the public tour itinerary area
- render the destination library, day timeline, route map, and read-only day preview
- support drag-to-insert from destination library into timeline
- randomly assign one source day when a destination is inserted
- keep destination cards visible after insertion
- support delete and reorder for timeline days
- support accessible pickup/drop placement without an `Add` button
- add focused frontend/source-integrity tests for module wiring, ID-only persistence, random assignment, and timeline flattening

Deliverable:

- visitors can build a customized day timeline by dragging Vietnam destinations

### Phase 4: Apply Customized Itinerary And Quote Handoff

Goal: make the customized day timeline visible on the public tour page and available to quote submission.

Tasks:

- flatten `timelineDays` into customer-visible `travel_plan.days[]`
- replace the displayed itinerary after the visitor finishes the customizer
- show a clear customized state with a reset action
- persist customized state in browser storage keyed by original tour id using IDs only
- reconcile stored customizations when the public catalog changes
- submit customized ordered day IDs when the tour details `Get a quote` action is used
- ensure `bookings.html` displays the customized booking travel plan

Deliverable:

- the tour details page and booking workspace show the visitor's customized itinerary

### Phase 5: Customized PDF Previews

Goal: preview the customized route without trusting client-supplied full content.

Tasks:

- support `POST /public/v1/tours/{tour_id}/one-pager-preview`
- support `POST /public/v1/tours/{tour_id}/travel-plan-preview`
- validate base tour and selected source days against public-safe content
- reconstruct the travel plan server-side from source IDs
- generate short-lived preview tokens or return PDF Blobs
- update both public page PDF preview actions when customization is active
- add backend tests for validation, unpublished content rejection, one-page preview generation, and full travel-plan preview generation

Deliverable:

- visitors can preview both customized PDFs for the active day timeline

## Tradeoffs

Destination-first UI with a day-based timeline is the recommended path. It gives visitors a natural way to choose places while avoiding a risky rewrite of the existing travel-plan, PDF, and booking systems.

Static public customization assets are the recommended v1 data source. They are less flexible than live endpoints, but safer, faster to cache, and consistent with the current public tour publishing flow.

A simplified static map is the recommended v1 map. It is less geographically rich than an interactive map, but avoids new dependencies, API keys, billing, privacy concerns, and tile-loading failures.

No service customization in v1 keeps the product focused. Customers can shape the route and day order without being exposed to operational fields or supplier details.

Keeping coordinates inside the customization tool reduces the scope of v1. The tradeoff is that route-map maintenance is customizer-specific until the workflow proves useful enough to justify broader catalog maintenance.

## Acceptance Scenarios

- A visitor opens a Vietnam marketing tour itinerary and sees `Customize this tour`.
- Clicking the button opens the destination-first customizer.
- The initial timeline is day-based, not grouped into multi-day stops.
- Destination cards are visible in the destination library.
- Each destination card represents exactly one `DestinationPlace`.
- Dragging a destination into the timeline creates one day.
- Dragging the same destination multiple times creates multiple days.
- A destination remains visible in the library after it is dragged into the timeline.
- No destination card shows an `Add` button.
- The customizer randomly assigns a public-safe source day when a destination is dropped.
- Repeated source-day suggestions are allowed when a destination is used more times than its available templates.
- Destinations outside Vietnam are not shown in v1.
- Destinations without customizer route coordinates are not shown.
- The map combines markers for consecutive repeated coordinates.
- The map slightly offsets markers for non-consecutive repeated coordinates.
- Clicking a timeline day opens read-only day details.
- Services cannot be edited in the customizer.
- Deleting a timeline day leaves its destination available in the library.
- Reordering timeline days updates day numbers and route order.
- Finishing the customizer closes the tool and updates the public tour details with the customized itinerary.
- After finishing, both PDF previews show the customized route.
- The customizer itself does not show `Get a quote`.
- Clicking `Get a quote` in tour details transmits the customized ordered day IDs when customization is active.
- The customized travel plan appears in `bookings.html`.
- Cancelling the customizer closes the tool without changing the public tour details or PDF previews.
- Destination and day options shown to visitors come only from public-safe published content.
