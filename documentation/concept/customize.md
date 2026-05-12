# Destination-First Tour Customizer

## Summary

Add one `Customize this tour` action to the itinerary area in the public marketing tour details. The action opens a destination-first route builder where a visitor customizes the whole trip by choosing where they want to go, how long they want to stay there, and which services they want on each day.

The important product shift is:

- customers first think in destinations and route shape
- customers then tune the days inside each destination
- the system still stores and renders the result as a normal `travel_plan.days[]` itinerary

The public UI should not ask visitors to assemble abstract day cards first. It should ask:

1. Where do you want to go?
2. How many days do you want there?
3. What do you want to do on those days?

After the visitor finishes the customizer, the public tour details should reflect the customized itinerary. The visible day-by-day itinerary is replaced with the visitor's customized route, day allocation, and selected services. The PDF preview should show a preview of the customized tour instead of the original unchanged marketing tour.

## Product Concept

Rename the customer-facing concept from a day timeline to a route builder.

Recommended customer-facing terms:

- `Route` for the ordered trip structure
- `Destination` or `Stop` for a location in the route
- `Days in this destination` for duration
- `Day plan` for the service-level detail inside a destination

Example customer route:

```text
Hanoi · 2 days -> Ninh Binh · 1 day -> Ha Long Bay · 2 days -> Hoi An · 3 days
```

Each route stop contains one or more days. A customer can click a stop such as `Hoi An · 3 days` and then customize `Day 5`, `Day 6`, and `Day 7` inside that destination.

This keeps the first interaction easy and natural while still allowing detailed day-level customization where it matters.

## V1 Product Decisions

For the first implementation:

- include frontend customization, local customized-state persistence, visible itinerary replacement, and customized PDF preview
- make the customer-facing timeline destination-first, not day-first
- keep the backend travel-plan model day/service-based for now
- flatten customized route stops back into `travel_plan.days[]` when rendering, previewing, or later submitting
- exclude booking submission with the customized itinerary
- keep the existing `Plan this trip` booking flow unchanged until a later request/submission phase
- manually seed coordinates for the current Vietnam destination catalog before relying on route maps
- do not add a heavy map dependency in v1

## Feasibility Findings

The current system already has the right internal building blocks:

- marketing tours contain structured `travel_plan.days[]`
- each day can reference destination places with `primary_location_id` and `secondary_location_id`
- each day contains nested services
- the authenticated marketing-tour editor can search and import existing days from other marketing tours
- destination scope already separates destinations, regions, and places

That means the customer UI can change without rewriting the travel-plan storage model. The customizer should introduce a customer-facing grouping layer called `routeStops`. Each stop groups one or more travel-plan days by destination place. When the visitor finishes, route stops are flattened back into ordered travel-plan days.

For the public customer customizer, do not expose authenticated admin search/import endpoints directly. Those endpoints are designed for staff, require authentication, and may expose internal or unpublished tour content.

Recommended public approach:

- generate a public-safe customization catalog from published marketing tours
- expose destination places that have public-safe day templates or services
- include only customer-visible day content, service content, and customer-visible images
- exclude unpublished tours and internal-only fields
- include only destinations that have usable route coordinates
- generate static public JSON with the existing public tour detail assets where possible
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
      recommended_days: 3,
      min_days: 1,
      max_days: 5,
      thumbnail_url: "...",
      highlights: ["Ancient town", "Food tour", "Countryside cycling"],
      routePoint: { lat: 15.8801, lng: 108.3380 },
      default_day_templates: [
        {
          source_tour_id: "...",
          source_day_id: "...",
          title: "Hoi An ancient town",
          notes: "...",
          services: []
        }
      ],
      optional_services: [
        {
          source_tour_id: "...",
          source_day_id: "...",
          source_service_id: "...",
          kind: "activity",
          title: "Cooking class",
          details: "..."
        }
      ]
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
- only enable it when the tour has structured travel-plan days and at least one routeable destination
- keep the normal itinerary readable without forcing visitors into the customization tool

Opening behavior:

- desktop: open a large modal or full-page overlay
- mobile: open a full-screen overlay
- preserve the original marketing tour page position when the tool is closed

Closing / finishing behavior:

- when the visitor finishes the customizer, apply the customized itinerary to the currently open tour details UI
- replace the visible itinerary with flattened days generated from `routeStops`
- update day numbering, route order, removed stops, added stops, and customized services
- update the PDF preview action so it previews the customized tour
- do not mutate the saved marketing tour record unless the visitor explicitly submits or requests the customized tour
- if the visitor cancels or closes without finishing, keep the original tour details unchanged

## Customization Tool Layout

### Route Map

The map is a simplified visual map of Southeast Asia or the active country/region, not a fully interactive GIS map in the first version.

It should show:

- one representative marker per route stop
- marker labels based on route order, for example `1`, `2`, `3`
- destination labels near or inside the selected route stop marker where space allows
- a dotted line connecting the route stops in order
- enough visual contrast that the route is clear over the background

The map should update whenever:

- a destination is added to the route
- a destination is removed from the route
- route stops are reordered
- a route stop changes destination

For v1, the map can use a static image with marker coordinates resolved from destination place latitude and longitude. A full map library is optional and should only be added if the product needs zooming, panning, or accurate geographic interaction.

### Destination Library

Replace the optional-days panel with a destination library.

The destination library shows available route stops that can be added to the trip. Each destination card should include:

- destination/place name
- region or country label
- recommended duration, for example `Recommended 2-3 days`
- short highlights
- optional thumbnail if available
- clear drag handle or visual drag affordance
- keyboard-accessible `Add` action

The visitor can drag a destination into the route timeline. Dropping the destination inserts a new route stop at the chosen position and creates default day plans for that destination.

If drag and drop is difficult on a device, provide an accessible fallback:

- an `Add` button on each destination
- after adding, place the destination at the end of the route or open a simple placement chooser

### Route Timeline

The route timeline is the source of truth for the customized route.

It should show:

- one item per selected destination stop
- route order based on current position
- destination name
- duration control, for example `- 2 days +`
- compact day chips inside the stop, for example `Day 4`, `Day 5`
- delete action
- drag handle for reordering if supported

The visitor can:

- add destinations into the route
- reorder route stops
- remove route stops
- increase or decrease days in a destination
- open a route stop to customize its day plans

Deleting a route stop removes all generated days inside that destination and triggers a map update. If the deleted stop came from the original base tour, it should become available again in the destination library.

Customers may remove all original destinations. The customized itinerary is valid as long as it stays within the configured day limit and contains at least one route stop before requesting or booking the trip.

The maximum customized itinerary length is 20 days by default. Keep this value configurable.

### Day Service Customizer

When the visitor clicks a route stop, open a detail panel for that destination.

Example:

```text
Hoi An · 3 days

Day 4 | Day 5 | Day 6
```

Inside each selected day, the visitor can customize services:

- keep or remove suggested services
- add optional services available for that destination
- choose service intensity, for example `relaxed`, `balanced`, or `full`
- optionally mark interests such as food, culture, nature, beach, family, photography, or adventure
- add free-text notes for the day or destination

The day service customizer should stay focused. It should not become a full admin editor. Customers need meaningful choices, not every operational field.

Recommended service actions:

- `Keep`
- `Remove`
- `Add to this day`
- `Move to another day in this destination`

Avoid exposing supplier references, internal prices, operational notes, image management, or staff-only fields.

## State Model

Keep the customization state separate from the original tour object.

Recommended customer customization state:

```js
{
  originalTourId: "...",
  routeStops: [
    {
      id: "route_stop_1",
      source: "original",
      placeId: "place_hoi_an",
      label: "Hoi An",
      regionLabel: "Central Vietnam",
      durationDays: 3,
      routePoint: { lat: 15.8801, lng: 108.3380 },
      mapPoint: { x: 63.4, y: 48.2 },
      days: [
        {
          id: "custom_day_1",
          sourceTourId: "...",
          sourceDayId: "...",
          title: "Hoi An ancient town",
          notes: "...",
          services: []
        }
      ],
      destinationNotes: ""
    }
  ],
  availableDestinations: [],
  removedOriginalStopIds: [],
  visitorNotes: ""
}
```

Rules:

- `routeStops` drives the route timeline and map.
- Day numbers are derived from the flattened route-stop order, not stored permanently.
- Each route stop owns its day plans.
- Increasing a stop duration should add a blank or suggested day plan for that destination.
- Decreasing a stop duration should remove the last day by default, with a confirmation if that day has user changes.
- Reordering route stops recalculates all day numbers.
- The original marketing tour data remains unchanged until the visitor explicitly submits or requests the customized tour.
- Public catalog items should have stable ids so destinations and service suggestions can move between panels without duplicating.
- The customized state should persist after the visitor finishes the customizer.
- For v1, persist the customized state in browser storage keyed by original tour id so it survives closing/reopening the details panel and a same-device page reload.
- For v1, do not send the customized itinerary with the `Plan this trip` booking request.
- The existing booking flow can continue to submit the original selected tour context until the customized request flow exists.
- A later request/submission phase can send the customized route with the booking or custom-tour request and use it directly as the initial booking travel plan.
- After that later booking creation flow exists, the durable copy of the customized itinerary should be the booking travel plan.
- A later v2 can add server-side customization drafts if visitors need a shareable link, cross-device access, or recovery after clearing browser data.

### Flattening To Travel Plan Days

The route builder is customer-facing. The internal output remains an ordered travel plan.

Flattening rules:

1. Iterate through `routeStops` in order.
2. Iterate through each stop's `days` in order.
3. Create one `travel_plan.days[]` item per customized day.
4. Set `day_number` from the flattened index.
5. Set the day location fields from the parent route stop.
6. Preserve selected services and user-visible service changes.
7. Preserve source ids where available so the backend can reconstruct public-safe content for previews.

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

Existing marketing tour travel-plan days can seed the initial route. Consecutive days with the same primary destination place should be grouped into one initial route stop.

Each destination used by the customization tool should expose:

- stable place id
- destination/country code
- region label
- customer-visible place label
- recommended duration
- minimum and maximum duration
- short highlights
- route/map point resolved from the destination catalog
- default day templates
- optional service suggestions
- all customer-language translations needed for visible labels and service copy
- optional image
- source flag when the stop came from the original base tour

Each day template should expose:

- stable source tour id
- stable source day id
- title
- notes
- customer-visible services
- source place id
- optional image

Each service suggestion should expose:

- stable source tour id
- stable source day id
- stable source service id
- kind
- title
- details
- location, if customer-visible
- optional image

### Route Coordinates

Do not store latitude and longitude directly on every marketing-tour day as the primary source of truth.

Many marketing-tour days refer to the same real place. If each day stores its own coordinates, the same location is duplicated across many tours. Over time, those copies will drift. For example, several tours may all contain a `Hoi An` day, but each could end up with slightly different latitude and longitude values. The map would then show the same destination in different places depending on which tour supplied the day.

Store coordinates once on reusable destination catalog records instead:

- destination place: exact city, town, site, hotel area, airport, or attraction

Marketing-tour days should reference a destination place for route coordinates. The customizer resolves the route point from that place reference. Regions are grouping nodes only and do not have latitude or longitude.

For v1, use the day primary location as the route-stop source. If a day has many service locations, the map still uses the route stop's destination place unless a tour editor sets a day-level route override.

Recommended catalog shape:

```js
{
  destination_places: [
    {
      id: "place_hoi_an",
      destination: "VN",
      region_id: "region_central_vietnam",
      name: "Hoi An",
      latitude: 15.8801,
      longitude: 108.3380
    }
  ],
  destination_regions: [
    {
      id: "region_central_vietnam",
      destination: "VN",
      name: "Central Vietnam"
    }
  ]
}
```

Route point resolution order:

1. day-level route override, if present
2. referenced destination place coordinates
3. no marker / not available

Day-level overrides are still useful for special cases, for example a river cruise, a mountain pass route, or a multi-stop day where the route marker should sit at a curated midpoint. These overrides should be exceptions, not the default.

Resolved route points can be converted to normalized image coordinates for a static map:

```js
{
  routePoint: { lat: 15.8801, lng: 108.3380 },
  mapPoint: { x: 63.4, y: 48.2 }
}
```

For v1 with a static Southeast Asia image, normalized image coordinates are simpler and more predictable.

Optional destinations can come from:

- any published marketing tour
- public-safe days from the current base tour when those destinations are not currently selected
- destination places configured as customer-visible in the destination catalog

Only show destinations that have usable latitude/longitude. Hide destinations without usable route coordinates until they are maintained.

V1 coordinate seeding decision:

- manually seed latitude and longitude for the current Vietnam destination places
- keep coordinate fields in the reusable destination catalog, not duplicated on each tour day
- add editor maintenance after the seeded catalog proves the route-map workflow

Existing travel-plan days do not consistently have structured destination place fields. They should be normalized so days can resolve their map point through the catalog.

Tour editors should maintain route coordinates inside the marketing tour editor. The editor should make it easy to choose a destination place for each day and should expose latitude/longitude maintenance for the selected place.

If a destination or source day becomes unavailable because the source tour is unpublished or the day is removed after the public customization data was generated, delete that unavailable source from the visitor's available/customized state the next time the state is reconciled.

## Interaction Rules

### Add Destination

1. Visitor drags a destination card into the route timeline or clicks `Add`.
2. The route stop is inserted at the drop position or appended to the end.
3. Default duration is set from the destination recommendation.
4. Default day plans are created from public-safe templates for that destination.
5. Day numbers are recalculated from the full route.
6. The map markers and dotted route line are redrawn.

### Change Duration

1. Visitor increases or decreases the day count on a route stop.
2. Increasing adds the next suggested day template for that destination, or a blank customizable day when no template exists.
3. Decreasing removes the last day in that route stop.
4. If the removed day has user changes, ask for confirmation.
5. Day numbers are recalculated.
6. The visible itinerary preview updates.

### Customize Day Services

1. Visitor opens a route stop.
2. Visitor selects one day inside that destination.
3. Visitor keeps, removes, or adds customer-visible services.
4. Visitor can move a service to another day in the same destination.
5. The route stop remains in the same position unless the visitor explicitly reorders it.

### Delete Route Stop

1. Visitor clicks the delete action on a route stop.
2. The route stop and its days are removed.
3. Day numbers are recalculated.
4. If the route stop came from the original base tour, it appears again in the destination library.
5. The map markers and dotted route line are redrawn.

### Reorder Route Stops

1. Visitor drags a route stop to a new position or uses move controls.
2. The `routeStops` array is reordered.
3. Day numbers are recalculated.
4. The map route line is redrawn in the new order.

## Output And Next Step

The customization tool should eventually produce a customized tour request that sales or operations can review. Before that request is submitted, the customized itinerary should still be applied locally to the current tour details view so the visitor can review the result.

Recommended v1 output:

- original marketing tour id
- ordered list of route stops
- destination place id for each route stop
- duration for each route stop
- ordered source day ids where a day comes from public-safe tour content
- selected service ids where a service comes from public-safe tour content
- removed original route stop ids
- visitor notes, if a notes field is added

The first implementation should stop at frontend customization, updating the visible tour details and PDF preview locally. Booking submission with the customized itinerary is explicitly out of v1 scope. A later backend request flow can add a clear call-to-action such as `Request this customized tour`.

After finishing the customizer:

- the marketing tour details page should show the customized itinerary as the active itinerary for this visitor session
- the PDF preview should render the customized tour itinerary
- the page should retain enough state to reset back to the original tour
- the customized itinerary state should be retained locally so it can be included in a later `Request this customized tour` or booking submission phase

### Customized PDF Preview

The current public PDF preview renders the stored published marketing tour. It does not know about a visitor's local customized route.

To preview a customized itinerary, add a separate public-safe PDF preview path. Do not try to encode the full customized itinerary in a GET URL.

Recommended endpoint:

- `POST /public/v1/tours/{tour_id}/one-pager-preview`

Recommended request body:

```js
{
  lang: "en",
  route_stops: [
    {
      place_id: "place_hoi_an",
      duration_days: 3,
      days: [
        {
          source_tour_id: "...",
          source_day_id: "...",
          selected_service_ids: ["..."]
        }
      ]
    }
  ],
  removed_original_stop_ids: ["..."],
  visitor_notes: ""
}
```

Backend rules:

- validate the base tour is published
- validate every selected destination is public-safe
- validate every selected day and service comes from public-safe published content
- reconstruct the customized travel plan server-side from source ids
- ignore or reject client-supplied full day or service bodies for security
- render a temporary PDF preview
- do not persist a booking or mutate the marketing tour record

The public tour details page should update the PDF preview action after finishing the customizer so it uses this customized preview flow.

There are two practical ways to open the customized PDF:

1. Fetch a PDF Blob from the POST response and open it with a browser object URL.
2. Create a short-lived preview token.

A preview token means the browser first sends the customized route to the server with a POST request. The server validates it, stores the preview data temporarily, and returns a short temporary URL such as `/public/v1/tour-preview/{token}.pdf`. The browser can then open that URL like a normal PDF link. This avoids putting the whole customized itinerary in the URL and makes opening the preview in a new tab easier.

Recommended v1 choice: use a short-lived preview token for the PDF preview.

## Accessibility And Mobile

Drag and drop must not be the only way to customize.

Requirements:

- destination cards have keyboard-accessible `Add` actions
- route stops have keyboard-accessible delete and move actions
- duration controls are normal buttons or steppers with accessible labels
- service cards have keyboard-accessible add/remove actions
- route reorder has a non-drag fallback
- map visualization is decorative unless it exposes useful route text elsewhere
- screen readers can understand the current route as an ordered list of destinations and days
- mobile layout keeps the selected route visible before the destination catalog

Suggested mobile layout:

1. route map preview
2. route timeline
3. selected route stop day/service panel
4. destination library

This keeps the selected itinerary visible before the broader destination catalog.

## Implementation Notes

Use the existing marketing tour details code as the integration point. The customization tool should be its own module instead of growing the tour-card renderer too much.

Recommended frontend structure:

- `frontend/scripts/tour_customize.js`
  - state management
  - route-stop grouping and flattening
  - drag/drop behavior
  - add/delete/reorder actions
  - duration controls
  - service selection inside route stops
  - map redraw orchestration
- dedicated CSS file if styling grows beyond a small block
- static Southeast Asia or Vietnam map asset in the public shared assets directory

For the map rendering, prefer simple HTML/SVG over a map library in v1:

- static image background
- absolutely positioned destination markers
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

## Implementation Plan

### Phase 1: Data Readiness

Goal: make destination places reliable enough to support a route builder.

Tasks:

- audit published tour days and identify missing or inconsistent `primary_location_id` values
- seed latitude and longitude for current Vietnam destination places
- normalize current tour days so routeable days reference destination places
- add or confirm public-safe destination visibility rules
- add tests for destination catalog coordinate normalization and public-safe filtering

Deliverable:

- published tours can be grouped into route stops by destination place

### Phase 2: Public Customization Catalog

Goal: generate the data the public customizer can use without exposing staff endpoints.

Tasks:

- extend the public tour asset generation pipeline with customization options
- group published tour days by destination place
- generate destination cards with recommended durations, highlights, images, route points, default day templates, and optional service suggestions
- include removed base-tour route stops as re-addable destinations
- include language-specific customer-visible fields
- add tests that unpublished/internal content is excluded

Deliverable:

- each public tour has a public-safe customization options asset or endpoint response

### Phase 3: Frontend Route Builder

Goal: build the destination-first customizer overlay.

Tasks:

- add `Customize this tour` entry point to the public tour itinerary area
- add `tour_customize.js` with route state, route-stop grouping, flattening, local persistence, and reset behavior
- render the destination library, route timeline, route map, and route-stop detail panel
- support add, remove, reorder, and duration changes
- support add/remove service customization inside a route stop day
- make all drag interactions available through buttons as well
- add focused frontend/source-integrity tests for module wiring and flattening behavior

Deliverable:

- visitors can build a destination route and customize services locally

### Phase 4: Apply Customized Itinerary Locally

Goal: make the customized route visible on the public tour page.

Tasks:

- flatten `routeStops` into customer-visible `travel_plan.days[]`
- replace the displayed itinerary after the visitor finishes the customizer
- show a clear customized state with a reset action
- persist customized state in browser storage keyed by original tour id
- reconcile stored customizations when the public catalog changes

Deliverable:

- the tour details page shows the visitor's customized itinerary for the current browser session

### Phase 5: Customized PDF Preview

Goal: preview the customized route without trusting client-supplied full content.

Tasks:

- add `POST /public/v1/tours/{tour_id}/one-pager-preview`
- validate base tour, selected route stops, selected days, and selected services against public-safe content
- reconstruct the travel plan server-side from source ids
- generate a short-lived preview token or return a PDF Blob
- update the public page PDF preview action when customization is active
- add backend tests for validation, unpublished content rejection, and PDF preview generation

Deliverable:

- visitors can preview a PDF for the customized route

### Phase 6: Later Request Flow

Goal: let sales or operations receive the customized tour.

Tasks:

- add `Request this customized tour` after the local customizer proves useful
- submit original tour id, route stops, selected source days, selected services, and visitor notes
- create a booking or inquiry with the customized travel plan as the initial booking travel plan
- store the route customization payload for audit/debugging
- decide whether server-side drafts or shareable links are needed

Deliverable:

- customized routes can become operational booking travel plans

## Tradeoffs

Destination-first UI with day-based storage is the recommended path. It adds a frontend grouping layer, but avoids a risky rewrite of the existing travel-plan, PDF, and booking systems.

Static public customization assets are the recommended v1 data source. They are less flexible than live endpoints, but safer, faster to cache, and consistent with the current public tour publishing flow.

A simplified static map is the recommended v1 map. It is less geographically rich than an interactive map, but avoids new dependencies, API keys, billing, privacy concerns, and tile-loading failures.

Service customization should be intentionally limited. Giving customers every admin field would make the product harder to use and could expose internal information.

## Acceptance Scenarios

- A visitor opens a marketing tour itinerary and sees `Customize this tour`.
- Clicking the button opens the destination-first route builder.
- The initial route groups the base tour days into destination stops where possible.
- The map shows one marker per route stop and a dotted line connecting the route.
- Destination cards are visible in the destination library.
- Adding a destination creates a route stop with default duration and suggested day plans.
- Increasing a destination duration adds another day plan for that destination.
- Decreasing a destination duration removes the last day and confirms when that day has user changes.
- Clicking a route stop opens day-level service customization for that destination.
- Adding or removing a service updates the customized day plan.
- Deleting an original route stop makes that destination available to add back.
- Reordering route stops updates day numbers and route order.
- Finishing the customizer closes the tool and updates the public tour details with the customized itinerary.
- After finishing, the PDF preview shows the customized route.
- Cancelling the customizer closes the tool without changing the public tour details or PDF preview.
- Destination and service options shown to visitors come only from public-safe published content.
