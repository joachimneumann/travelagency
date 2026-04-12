# Backend Requirements for AsiaTravelPlan

## Purpose

AsiaTravelPlan needs an operational backend around bookings, tours, ATP staff, pricing, invoices, and communications.

The current domain direction is intentionally simple:
- each booking owns its own person data
- person edits are local to that booking
- permissions and editing are separated at the booking level

## Core Domains

Active operational domains:
- bookings
- booking persons
- tours
- country reference / public destination visibility
- ATP staff
- activities
- invoices
- inbound chat threads linked to bookings

Not active domains:
- separate shared master-data for contacts/travelers outside the booking

## Core Capabilities

### Booking intake and qualification

- capture website booking submissions
- store the immutable inbound payload on the booking
- create normalized booking persons from the submitted contact/traveler information
- manage booking stage, assignment, notes, and service-level expectations

### Booking-owned persons

- store the primary contact and additional travelers on `booking.persons[]`
- support roles such as `traveler` and `primary_contact`
- allow counts in `number_of_travelers` to differ from listed persons when needed
- keep person documents, consents, address, and photo attached to the booking person

### Commercial workflow

- pricing summary and payment schedule
- structured offer components by category
- invoices
- multi-currency handling through the generated currency model

### Operations workflow

- activities timeline
- ATP staff assignment
- read-only Meta chat timeline linked to the booking

### Catalog

- maintain public tours
- serve public tour images
- control which destinations are published on the public website

## Architectural Requirement

The CUE model under `model/` is the single source of truth for:
- domain entities
- API transport shapes
- enums and catalogs

Generated artifacts must stay aligned with that model.

## Non-Goal

Do not rebuild a shared CRM master-data layer for customers or groups unless there is a later business reason strong enough to outweigh the simplicity of booking-owned persons.
