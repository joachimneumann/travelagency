# Reusing Travel Plan Code Across Booking, Marketing Tours, And Tour Variants

## Goal

Use one shared travel-plan UI and code architecture across:

- `booking.html`
- `marketing_tour.html`
- `tour_variant.html`

The three pages should save the same `travel_plan` JSON shape. Page-specific differences should be expressed as capabilities and rendering modes, not as separate implementations.

The shared editor should include:

- map panel
- vertical day list
- day selection and reordering
- arrival/departure editor
- customizer and customizer timeline
- PDF preview/generation actions
- service display/editing according to page capability
- tour-card image selection where needed

## Product Rules

### Booking

Booking is the full operational travel-plan editor.

Staff can:

- reorder and select days
- edit day titles
- edit day details
- edit day dates
- edit map points
- edit arrival/departure
- edit arrival/departure time fields
- edit services
- edit service time fields
- select images
- use the customizer
- preview/generate PDFs

Booking derives all day dates from the date on day 1.

### Marketing Tour

Marketing tours are reusable tour templates.

Staff can:

- reorder and select days
- edit day titles
- edit day details
- edit map points
- edit arrival/departure
- edit services
- select images
- use the customizer
- preview/generate PDFs

Marketing tours do not show or edit:

- day dates
- arrival/departure time fields
- service time fields

### Tour Variant

Tour variants are lightweight website-ready variants built from selected marketing-tour days.

Staff can:

- reorder and select days
- edit arrival/departure
- select images for the public tour card
- use the customizer and customizer timeline
- preview/generate PDFs

Tour variants cannot edit:

- day titles
- day details
- map points
- destination scope
- services
- service times

Tour variants should show services in compact read-only mode.

### Destination Scope

Nobody edits destination scope directly.

Destination scope is derived from the selected days. The editor may show derived destination information if useful, but it must not render an editable destination-scope form.

## Shared JSON Shape

All three pages should persist the same `travel_plan` shape.

Recommended principle:

- hide unavailable fields in the UI
- keep existing values intact unless the current page explicitly owns them
- derive page-specific presentation from capabilities
- avoid page-specific travel-plan schemas

This lets booking, marketing tours, and tour variants share:

- normalization
- validation
- import/customizer logic
- PDF rendering
- public itinerary rendering
- arrival/departure composition

## Confirmed Implementation Contracts

### Save Ownership

Saves should be PATCH-style merges.

Each page may only mutate the fields owned by its capability preset. Hidden or unsupported fields must be preserved as-is unless the current page explicitly owns and changes them.

### Day Ordering

Array index is sufficient for day order across booking, marketing tours, and tour variants.

### Destination Scope

Destination scope is derived from the set of day map points.

Arrival and departure locations are ignored for destination-scope derivation.

### Permissions

Page access and editing permissions are based on the user role. Presets define the page capability surface; user permissions determine whether the current user can use those capabilities.

### Page Storage And Customizer Contracts

Booking works on copied day objects stored with the booking travel plan. Later changes to marketing-tour days do not mutate existing booking travel plans.

Marketing tours work on resolved day objects stored as canonical tour content. When a marketing-tour day service is edited, tour variants referencing that day should reflect the updated service content.

Tour variants work on day references. Variants must not persist copied day or service content. The editor receives a resolved `travel_plan` read model, but variant saves should persist only references and variant-owned fields such as ordering, arrival/departure, and tour-card image selection.

### Read-Only Variant Services

Tour variants show the services for each referenced day in compact read-only mode.

The compact display must not expose supplier, internal, or cost fields.

### Booking Date Derivation

Booking derives dates from the date on day 1. If day 1 has no date, display fallback labels such as `Day 1`, `Day 2`, and so on.

Marketing tours and tour variants must never show booking travel-plan dates. Booking travel plans live separately in the database JSON and do not interfere with days in `content/tours`.

## Capability Presets

Introduce named presets instead of scattered boolean checks.

Example:

```js
export const TRAVEL_PLAN_EDITOR_PRESETS = {
  booking: {
    workspace: "focused",
    mapPanel: true,
    routeList: true,
    customizer: true,
    pdfs: true,
    dates: true,
    deriveDatesFromFirstDay: true,
    timing: true,
    arrivalDeparture: true,
    arrivalDepartureTiming: true,
    dayTitleEdit: true,
    dayDetailsEdit: true,
    mapPointEdit: true,
    destinationScope: "derived",
    services: "editable",
    serviceTiming: true,
    serviceImages: true,
    tourCardImageSelection: false
  },

  marketingTour: {
    workspace: "focused",
    mapPanel: true,
    routeList: true,
    customizer: true,
    pdfs: true,
    dates: false,
    deriveDatesFromFirstDay: false,
    timing: false,
    arrivalDeparture: true,
    arrivalDepartureTiming: false,
    dayTitleEdit: true,
    dayDetailsEdit: true,
    mapPointEdit: true,
    destinationScope: "derived",
    services: "editable",
    serviceTiming: false,
    serviceImages: true,
    tourCardImageSelection: true
  },

  tourVariant: {
    workspace: "focused",
    mapPanel: true,
    routeList: true,
    customizer: true,
    pdfs: true,
    dates: false,
    deriveDatesFromFirstDay: false,
    timing: false,
    arrivalDeparture: true,
    arrivalDepartureTiming: false,
    dayTitleEdit: false,
    dayDetailsEdit: false,
    mapPointEdit: false,
    destinationScope: "derived",
    services: "readonlyCompact",
    serviceTiming: false,
    serviceImages: false,
    tourCardImageSelection: true
  }
};
```

The final names can change, but the important point is that each page should pass one preset into the same shared editor.

## Architecture

Do not keep growing one large travel-plan editor file.

Split the shared editor into modules with clear ownership.

Recommended modules:

- `travel_plan_editor_core.js`
  - public factory
  - preset resolution
  - page adapter integration
  - top-level render orchestration
- `travel_plan_presets.js`
  - booking, marketing-tour, and tour-variant capability presets
- `travel_plan_workspace.js`
  - shared focused layout
  - map column
  - vertical day list column
  - detail panel column
- `travel_plan_route_list.js`
  - day cards
  - arrival/departure cards
  - select day/boundary
  - reorder days
  - drag placeholder and delete effects
- `travel_plan_boundary_sections.js`
  - arrival/departure form rendering
  - airport selection
  - no-arrival/no-departure clearing rules
- `travel_plan_day_details.js`
  - day title/details/date/map fields according to preset
- `travel_plan_service_editor.js`
  - editable service cards
  - service image editing
  - service timing fields when enabled
- `travel_plan_service_readonly.js`
  - compact read-only service display for tour variants
- `travel_plan_customizer_bridge.js`
  - shared customizer launch
  - shared customizer timeline
  - preset-aware insert/reorder behavior
- `travel_plan_pdf_actions.js`
  - shared PDF action buttons
  - preview window integration
  - page-provided endpoint hooks
- `travel_plan_destination_scope.js`
  - derive destination scope from selected days
  - no editable UI

## Page Adapters

Each page should become a thin adapter around the shared editor.

Adapters provide:

- current entity state
- permissions
- API request builders
- save mutation hook
- PDF endpoint hooks
- image upload/selection hooks
- customizer source-day/search hooks
- page dirty-state hook
- page overlay/status hook

The shared editor should not contain hard-coded assumptions like "booking API" or "marketing tour API". It should call adapter functions.

Example shape:

```js
createTravelPlanEditor({
  preset: "marketingTour",
  state,
  elements,
  adapter: {
    buildSaveRequest,
    buildPdfPreviewRequest,
    buildOnePagerPreviewRequest,
    buildTravelPlanPdfRequest,
    searchReusableDays,
    importReusableDay,
    uploadServiceImage,
    selectTourCardImage,
    markDirty,
    showStatus
  }
});
```

## UI Reuse Rules

### Shared Workspace

All three pages should use the same focused workspace:

- map on the left
- vertical day list in the middle
- details panel on the right

Responsive behavior should be shared.

### Day List

The day list is shared across all three pages.

It always supports:

- selecting a day
- selecting arrival/departure
- reordering days where the preset allows it
- showing arrival/departure cards

Booking-specific date subtitles should be enabled only by the booking preset.

### Detail Panel

The detail panel changes by preset.

Booking:

- editable date
- editable title
- editable details
- editable map points
- editable services

Marketing tour:

- editable title
- editable details
- editable map points
- editable services
- no date/time fields

Tour variant:

- no day field editing
- compact read-only services
- editable arrival/departure only when the selected item is arrival/departure
- tour-card image selection where appropriate

### Services

Services have three rendering modes:

- `editable`
- `readonlyCompact`
- `hidden`

`readonlyCompact` should show enough context for staff to understand the route without allowing edits. Suggested compact service fields:

- service title
- kind icon or kind label
- optional thumbnail if already part of the inherited source day
- short details excerpt only if it does not make the list noisy

### Arrival And Departure

Arrival/departure editing exists in all three pages.

Timing fields exist only in booking.

All pages should use the same boundary editor and save the same boundary-logistics shape.

### PDF Actions

PDF preview/generation exists in all three pages.

The UI should be shared, but endpoints are page-specific:

- booking PDF endpoints
- marketing-tour PDF endpoints
- tour-variant PDF endpoints

The shared PDF action module should receive endpoint builders from the page adapter.

### Customizer

The same customizer and customizer timeline should be available in all three pages.

Preset rules must control what the customizer can mutate:

- booking: full selected-day composition
- marketing tour: template composition, no dates/times
- tour variant: selected-day composition and ordering, no service edits

## Backend Implications

Backend should support the shared frontend contract.

Recommended backend direction:

- keep one normalized travel-plan model
- keep arrival/departure at `travel_plan.boundary_logistics`
- derive destination scope from selected days
- provide PDF endpoints for booking, marketing tour, and tour variant
- use shared PDF generation code for all three
- keep page-specific handlers thin

For tour variants, the source object may store selected-day references, but the editor should work with a resolved `travel_plan` view using the same shape as booking and marketing tours.

If the source storage stays reference-based, add a clear conversion boundary:

- source model: lightweight selected-day references
- editor read model: resolved full `travel_plan`
- save payload: same travel-plan shape or a normalized variant source update, depending on backend decision

The frontend editor should not need to know whether the backend stores variant days as references or full copies.

## Implementation Plan

### Phase 1: Stabilize Current Behavior

Add focused tests for the current booking and marketing-tour travel-plan rendering before large refactors.

Cover:

- booking workspace renders map, day list, detail panel
- marketing tour renders the same shared arrival/departure editor
- booking dates and time fields appear only in booking
- marketing tour has no date/time fields
- PDF action buttons are routed through shared helpers

### Phase 2: Introduce Presets Without UI Changes

Add `travel_plan_presets.js`.

Convert current feature flags into resolved presets.

Initial goal:

- booking still looks the same
- marketing tour still looks the same
- no functional behavior changes

This phase creates the contract for reuse without moving all code at once.

### Phase 3: Extract Shared Workspace

Move the booking-style focused layout into `travel_plan_workspace.js`.

Use it for booking first.

Then enable the same workspace for marketing tours.

Keep page adapters thin and avoid copying markup into page-specific scripts.

### Phase 4: Extract Day List And Drag Behavior

Move vertical day-list rendering, selection, reordering, drag placeholder, and delete animation into `travel_plan_route_list.js`.

The module should receive callbacks:

- `onSelectDay`
- `onSelectBoundary`
- `onMoveDay`
- `onDeleteDay`
- `getBoundaryDisplay`
- `getDayDisplay`

### Phase 5: Extract Day Detail And Service Renderers

Move day detail rendering into `travel_plan_day_details.js`.

Move editable service rendering into `travel_plan_service_editor.js`.

Add `travel_plan_service_readonly.js` for compact tour-variant service display.

Use preset capability to select the service mode.

### Phase 6: Remove Editable Destination Scope UI

Create `travel_plan_destination_scope.js`.

Implement one derivation helper used by all pages.

Remove editable destination-scope UI from booking and marketing tour.

Make sure save and PDF generation still receive a derived destination scope where needed.

### Phase 7: Share Customizer Across All Pages

Move customizer launch and timeline bridge logic into `travel_plan_customizer_bridge.js`.

Make the customizer preset-aware:

- booking can compose operational travel plans
- marketing tour can compose reusable templates
- tour variant can compose selected source days and ordering

### Phase 8: Share PDF Actions

Move PDF buttons and preview behavior into `travel_plan_pdf_actions.js`.

The module receives endpoint builders from each page adapter.

Use the existing no-cache preview helper for all pages.

### Phase 9: Wire Tour Variant

Build the `tourVariant` preset.

Wire `tour_variant.html` to the shared editor with:

- shared map panel
- shared vertical day list
- editable arrival/departure
- compact read-only services
- tour-card image selection
- shared customizer
- shared PDF actions

### Phase 10: Remove Old Duplicate Code

After all three pages use the shared modules, remove:

- page-specific travel-plan layout markup
- old marketing-tour-only arrival/departure UI copies
- old booking-only workspace assumptions
- editable destination-scope UI
- unused feature flags replaced by presets
- leftover source-integrity tests that enforce old file structure

## Testing Plan

Add tests at three levels.

### Unit Tests

- preset resolution
- destination-scope derivation
- boundary-logistics clearing rules
- date derivation only for booking
- service renderer selection by preset

### Source/Integration Tests

- booking wires shared editor with `booking` preset
- marketing tour wires shared editor with `marketingTour` preset
- tour variant wires shared editor with `tourVariant` preset
- all three pages use shared PDF action module
- all three pages use shared workspace module

### Browser/Visual Checks

For each page:

- desktop layout
- narrow responsive layout
- map and day list alignment
- arrival/departure editing
- customizer launch
- PDF preview buttons

Additional checks:

- booking shows date/time fields
- marketing tour does not show date/time fields
- tour variant shows compact read-only services
- tour variant does not allow day title/map point/service edits

## Migration Risks

### Risk: More Conditionals In The Current Core

The current editor is already large. Adding all reuse behavior as inline conditionals will make it harder to reason about.

Mitigation:

- introduce presets first
- extract modules incrementally
- keep page adapters thin
- prefer renderer modules over nested conditional markup

### Risk: Tour Variant Storage Differs From Editor Shape

Tour variants may remain reference-based in storage while the editor wants a full resolved travel-plan view.

Mitigation:

- keep a backend read-model adapter
- let the frontend consume a normal `travel_plan`
- convert back to the source model on save if needed

### Risk: PDF Behavior Diverges

Booking, marketing tour, and variant PDFs may need different wrappers, but the travel-plan body should stay shared.

Mitigation:

- share the travel-plan PDF section renderer
- keep wrapper/title/branding page-specific
- use shared arrival/departure rendering

### Risk: Customizer Mutates Fields A Page Does Not Own

The customizer must respect presets.

Mitigation:

- pass capability preset into the customizer bridge
- block or hide unsupported edit paths
- normalize payload before save

## Acceptance Criteria

The refactor is successful when:

- `booking.html`, `marketing_tour.html`, and `tour_variant.html` all use the same shared travel-plan workspace.
- Arrival/departure editor code is shared across all three pages.
- Map panel and vertical day list code are shared across all three pages.
- Customizer and customizer timeline are shared across all three pages.
- PDF action UI is shared across all three pages.
- Booking remains fully editable and keeps date/time behavior.
- Marketing tour has no date/time fields.
- Tour variant shows compact read-only services and prevents day/service/map edits.
- Destination scope is derived, not edited.
- All three pages persist compatible travel-plan data.
- Old duplicate page-specific travel-plan UI code is removed.
