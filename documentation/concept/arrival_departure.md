# Arrival And Departure Outside Travel-Plan Days

## Problem

Arrivals, airport pickups, airport drop-offs, and departure transfers are currently stored as normal services inside the first and last travel-plan days.

That creates three product problems:

- A day that includes an airport pickup is harder to reuse in the public customizer.
- A single-day tour created from an existing tour accidentally inherits arrival or departure logistics.
- A day imported into `booking.html` as a drop-in module may bring airport transfer content that does not belong to the new booking.

The core issue is that boundary logistics are not day content. They are trip-level start/end services that should be attached to the displayed itinerary only when a full tour is presented to a client.

## Recommendation

Store arrival and departure independently from `travel_plan.days[]`.

Canonical travel-plan days should contain only reusable itinerary content: activities, meals, accommodation, guides, transfers inside the route, free time, border crossings, and other day-level services.

Arrival and departure should live at travel-plan root level as optional boundary logistics:

```js
travel_plan: {
  destination_scope: [],
  days: [],
  boundary_logistics: {
    arrival: { ... },
    departure: { ... }
  }
}
```

When rendering a customer-facing itinerary, the system should compose a presentation-only travel plan:

- prepend arrival to the first day
- append departure to the last day
- do not create extra days
- do not persist the composed result back into `days[]`

This keeps source data reusable while preserving the client experience: the first day still reads like the arrival day, and the last day still reads like the departure day in tour details and PDFs.

## Data Model

Use the same boundary-service concept for marketing tours and booking travel plans. Boundary services do not store their own arrival/departure dates; booking presentation derives those dates from the itinerary day dates and the selected placement.

Recommended CUE shape:

```cue
#TravelPlanBoundaryKind: "arrival" | "departure"

#TravelPlanBoundaryService: #TravelPlanService & {
  boundary_kind: #TravelPlanBoundaryKind
  kind: *"transport" | enums.#TravelPlanServiceKind
  enabled?: *true | bool

  // Optional structured operational fields.
  airport_code?: string
  from_label?: string
  to_label?: string

  // Controls customer-facing composition.
  presentation?: {
    attach_to: "first_day" | "last_day"
    position:  "start" | "end"
  }
}

#MarketingTourTravelPlanBoundaryService: #TravelPlanBoundaryService

#MarketingTourTravelPlanBoundaryLogistics: {
  arrival?: #MarketingTourTravelPlanBoundaryService
  departure?: #MarketingTourTravelPlanBoundaryService
}

#BookingTravelPlanBoundaryService: #TravelPlanBoundaryService

#BookingTravelPlanBoundaryLogistics: {
  arrival?: #BookingTravelPlanBoundaryService
  departure?: #BookingTravelPlanBoundaryService
}

#MarketingTourTravelPlan: {
  boundary_logistics?: #MarketingTourTravelPlanBoundaryLogistics
  days?: [...#MarketingTourTravelPlanDay]
  ...
}

#BookingTravelPlan: {
  boundary_logistics?: #BookingTravelPlanBoundaryLogistics
  days?: [...#BookingTravelPlanDay]
  ...
}
```

For v1, keep boundary services compatible with the existing service shape:

- `id`
- `timing_kind`
- `time_label`, `time_point`, `start_time`, `end_time`
- `kind`
- `title`, `title_i18n`
- `details`, `details_i18n`
- `image`, if useful

This avoids inventing a second content model for text, timing, translation, and PDF rendering. The additional fields describe why the service is a trip boundary and how it should be presented.

## Presentation Composer

Add one helper that materializes a client-facing itinerary from the canonical travel plan.

Recommended helper:

```js
composeTravelPlanForPresentation(travelPlan, {
  includeBoundaryLogistics: true,
  mode: "client"
})
```

Behavior:

1. Normalize the canonical travel plan.
2. Clone `days[]`.
3. If `boundary_logistics.arrival.enabled !== false` and at least one day exists, convert arrival into a normal presentation service and insert it at the start of day 1.
4. If `boundary_logistics.departure.enabled !== false` and at least one day exists, convert departure into a normal presentation service and insert it at the end of the last day.
5. If the tour has one day, both services are attached to that same day: arrival first, departure last.
6. Preserve day numbers. Do not add an "arrival day" or "departure day".
7. Add internal presentation metadata only if needed, for example `_presentation_source: "boundary_logistics"`, but strip it from public API and PDF output.

The composer should be used by:

- public marketing tour itinerary rendering
- public customized itinerary rendering
- public day-by-day travel-plan PDF generation
- booking travel-plan PDF generation
- generated-offer snapshots when they need the customer-facing itinerary

The canonical plan should continue to be used by:

- customizer source-day pools
- day import/search in `booking.html`
- marketing-tour editor day library
- single-day tour creation
- backend normalization and persistence

## UI Changes

### Marketing Tour Editor

Add an `Arrival & departure` panel near the travel-plan editor.

The panel should expose:

- arrival enabled toggle
- arrival title/details/timing
- arrival metadata, such as airport code or route endpoint labels
- departure enabled toggle
- departure title/details/timing
- departure metadata, such as airport code or route endpoint labels

The day editor should no longer show arrival/departure services as part of the editable day list unless they are legacy content waiting for migration.

### Booking.html

Add the same `Arrival & departure` controls to the booking travel-plan area.

Booking-specific fields can be more operational than marketing-tour fields:

- actual arrival date/time
- actual departure date/time
- driver/supplier reference if needed later
- internal staff notes if needed later

Keep the day import and drop-in workflows based on canonical days only. When staff imports a day from another booking or tour, arrival/departure should not be imported with that day.

The PDF preview/generation area should show the composed customer view so staff can verify that the first and last days read correctly.

## Customizer Behavior

The customizer should work only with reusable day content.

Rules:

- `source_day_pool` excludes boundary logistics.
- Drag/drop timeline days contain canonical day IDs only.
- Finished customizer output sends selected day IDs only.
- The backend reconstructs the selected canonical days and then applies boundary logistics from the base tour or the booking request.

For v1, the customized tour should inherit arrival/departure from the base tour. If the visitor changes the route start or end so much that the original transfer is wrong, the quote request should carry a note for staff to review boundary logistics in `booking.html`.

Later, the customizer can expose start/end hub choices, but that should be separate from day selection.

## Single-Day Tour Creation

When creating a single-day tour from an existing multi-day tour:

- copy only the selected canonical day
- do not copy arrival/departure automatically from the original first/last day
- allow staff to add new root-level boundary logistics if the single-day tour needs pickup/drop-off

This prevents "Hanoi arrival and Old Quarter" from being the only reusable Hanoi day. The reusable day becomes "Old Quarter" or another content-focused day, while airport pickup remains a tour-level start service.

## Booking Drop-In Days

When using days as drop-ins in `booking.html`:

- day search results should show canonical day content only
- import should copy only the selected day and its day-level services
- imported services should not include boundary services unless staff explicitly imports or edits arrival/departure
- if staff imports a complete tour, the importer may optionally copy the tour's `boundary_logistics` into the booking's boundary-logistics section

This gives staff two clear operations:

- import a day as reusable content
- import a whole tour as a complete start-to-end itinerary

## Pricing And Offers

Boundary logistics can be priced, but pricing should not force them back into `days[]`.

Recommended behavior:

- If included in the package price, boundary transfer cost can remain part of the total tour price.
- If visible as a line item, represent it as an offer `additional_item` with category `transport` or `transfer`.
- If pricing is allocated per day internally, arrival maps to day 1 and departure maps to the last day for accounting only.

The customer-facing itinerary still receives boundary logistics from the presentation composer, not from pricing lines.

## Translation

Boundary logistics need translation status like normal travel-plan services.

Recommended translation keys:

- `travel_plan.boundary.arrival.time_label`
- `travel_plan.boundary.arrival.title`
- `travel_plan.boundary.arrival.details`
- `travel_plan.boundary.departure.time_label`
- `travel_plan.boundary.departure.title`
- `travel_plan.boundary.departure.details`

The translation table in `booking.html` should show arrival and departure in their own segment, not hidden inside day 1 or the last day. The rendered itinerary and PDFs still display them inside the first and last days.

## Migration

Migration should be additive and reversible.

1. Add model/API support for `travel_plan.boundary_logistics`.
2. Update normalizers to preserve the new object while leaving existing `days[]` behavior unchanged.
3. Add the presentation composer and use it in public itinerary/PDF rendering.
4. Add editor UI for arrival/departure.
5. Run a detection script for legacy boundary services:
   - first-day services with titles/details such as `arrival`, `airport pickup`, `airport welcome`, `hotel arrival transfer`
   - last-day services with titles/details such as `departure`, `airport drop-off`, `airport transfer`, `farewell`
6. Auto-migrate only high-confidence matches.
7. Mark ambiguous matches for manual review.
8. After migration, day libraries and customizer pools should use the cleaned canonical days.

During migration, keep backward compatibility:

- if no `boundary_logistics` exists, render days exactly as they are today
- if legacy boundary services still exist in `days[]`, do not duplicate them during composition
- once a tour is migrated, boundary services should be removed from `days[]`

## Duplicate Prevention

The presentation composer should avoid showing airport transfers twice.

Recommended rule:

- If a boundary service has been migrated to `boundary_logistics`, remove it from canonical `days[]`.
- For mixed legacy data, skip automatic composition when the target first/last day already contains a service with `boundary_kind` or a `copied_from_boundary_id` matching the boundary service.
- Do not rely only on title matching at render time. Title matching is useful for migration review, not for runtime correctness.

## Acceptance Criteria

- A marketing tour can have arrival and departure configured outside `days[]`.
- Public tour details show arrival as the first service of day 1 and departure as the last service of the final day.
- Day-by-day PDFs show the same composed first and last days.
- The customizer source-day pool does not include arrival/departure-only services.
- Creating a single-day tour from a source day does not copy airport pickup/drop-off unless explicitly requested.
- Importing a day into `booking.html` does not copy boundary logistics.
- Importing a whole tour into `booking.html` can copy boundary logistics into the booking's arrival/departure section.
- Existing tours without `boundary_logistics` still render as before.
- No rendered itinerary shows duplicate airport pickup or drop-off after migration.

## Implementation Plan

### Phase 1: Model And Normalization

- Add boundary-logistics CUE types.
- Update generated API contracts.
- Extend `normalizeTravelPlan` and `normalizeBookingTravelPlan`.
- Include boundary services in translation-status collection.

### Phase 2: Presentation Composer

- Add a shared domain helper for composing customer-facing travel plans.
- Use it in marketing tour details APIs and PDF generation.
- Use it in booking travel-plan PDFs and generated-offer travel-plan snapshots.

### Phase 3: Editor UI

- Add arrival/departure controls to the marketing-tour travel-plan editor.
- Add arrival/departure controls to `booking.html`.
- Keep import/search/drop-in day flows canonical by default.

### Phase 4: Migration

- Build a legacy boundary-service detection report.
- Auto-migrate high-confidence services.
- Manually review ambiguous first/last-day airport transfer content.
- Regenerate affected public/PDF caches where needed.

### Phase 5: Tests

- Unit-test normalization with and without `boundary_logistics`.
- Unit-test composition for multi-day, one-day, arrival-only, departure-only, and empty-day plans.
- Test public tour details rendering.
- Test day-by-day PDF rendering.
- Test customizer output and booking reconstruction.
- Test booking day import does not include boundary logistics.
