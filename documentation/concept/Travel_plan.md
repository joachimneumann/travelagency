# Travel Plan Implementation (Modular)

## Summary

Implement Travel plan as a booking-owned, structured day-by-day itinerary, placed on `booking.html` between WhatsApp and Offer. Build it as a new booking subresource with its own revision and new dedicated frontend/backend modules so existing booking files do not grow further.

## Data Model and API

Add to the booking model:

- `travel_plan_revision`
- `travel_plan`

Travel plan shape:

- `title`
- `summary`
- `days[]`

Each day:

- `id`
- `day_number`
- `date?`
- `title`
- `overnight_location?`
- `segments[]`
- `notes?`

Each segment:

- `id`
- `time_label?`
- `kind`
- `title`
- `details?`
- `location?`
- `supplier_or_reference?`
- `start_time?`
- `end_time?`

Recommended `kind` enum values:

- `transport`
- `accommodation`
- `activity`
- `meal`
- `guide`
- `free_time`
- `border_crossing`
- `other`

Backend/API:

- include `travel_plan` in booking detail/list read model where appropriate
- add `PATCH /api/v1/bookings/:booking_id/travel-plan`
- request body should carry:
  - full `travel_plan`
  - `expected_travel_plan_revision`
- response should return updated booking detail payload
- update booking activity log on successful save

## Backend Structure

Do not add this logic into the existing large booking files beyond wiring.

Add new backend files:

- `backend/app/src/http/handlers/booking_travel_plan.js`
  - request validation
  - revision check
  - persistence
  - activity creation
- `backend/app/src/domain/travel_plan.js`
  - normalization
  - defaulting
  - validation helpers
  - ordering / cleanup logic

Update:

- `backend/app/src/http/routes.js`
  - register the new route
- `backend/app/src/http/handlers/bookings.js`
  - compose in the new handler only
- `backend/app/src/http/handlers/booking_query.js`
  - include `travel_plan` in the read model
- CUE model and contract files:
  - `model/entities/booking.cue`
  - `model/api/requests.cue`
  - `model/api/responses.cue`
  - `model/api/endpoints.cue`
  - `model/ir/normalized.cue`

Validation rules:

- `days` sorted by `day_number`
- each segment must have `kind` and `title`
- empty days/segments may exist only while editing on the frontend; backend should normalize obvious empty strings but keep legitimate blanks optional
- no pricing/invoice fields inside `travel_plan`

## Frontend Structure

Add the UI as its own booking module, not inside the page shell.

Add new frontend files:

- `frontend/scripts/booking/travel_plan.js`
  - render section
  - add/remove day
  - add/remove segment
  - reorder segments
  - save action
  - dirty state
- `frontend/scripts/booking/travel_plan_helpers.js`
  - client-side factories for blank day/segment
  - normalization for UI state
  - segment-kind labels

Update:

- `frontend/scripts/pages/booking.js`
  - mount/wire the travel-plan module only
- `frontend/pages/booking.html`
  - add a collapsible Travel plan section between WhatsApp and Offer
- add styling in a dedicated CSS file if it grows beyond a small block:
  - prefer `shared/css/pages/backend-booking-travel-plan.css`
  - import through the shared stylesheet chain

UI behavior:

- collapsible section titled `Travel plan`
- top inputs:
  - travel plan title
  - travel plan summary
- below: day cards
- each day card shows:
  - `Day N`
  - optional date
  - title
  - overnight location
  - notes
  - ordered segment list
- each segment row/card shows:
  - time label
  - kind
  - title
  - location
  - details
- actions:
  - new day
  - new segment
  - remove day
  - remove segment
  - move segment up/down

Save behavior for v1:

- explicit section save button for the whole Travel plan
- not autosave
- use `travel_plan_revision` conflict handling consistent with the rest of booking editing

## Tests

Backend tests:

- `PATCH /travel-plan` creates and updates a travel plan
- stale `expected_travel_plan_revision` returns conflict
- activity row is created for travel-plan update
- travel plan survives booking reload/read model
- invalid segment without required `kind` or `title` is rejected

Frontend/source-integrity tests:

- booking page imports and wires `travel_plan.js`
- Travel plan section exists in `booking.html` in the correct position
- save path uses `travel_plan_revision`
- add/remove/reorder helpers remain available from the module

Acceptance scenarios:

- create a travel plan with 2 days and multiple segments
- edit a day title and overnight location
- remove one segment
- save and reload booking; structure remains intact
- open same booking on two sessions; stale revision save is rejected

## Assumptions

- Travel plan is the only user-facing term
- v1 is structured day-by-day, not rich text and not PDF-exportable yet
- Travel plan is operational only and separate from Offer/Payments
- placement is between WhatsApp and Offer
- save model is section-level explicit save, not autosave
