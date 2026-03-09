# AsiaTravelPlan Backend Software Plan

## Current Direction

The active architecture is now:
- booking-centered
- booking-owned persons
- model-driven contract/code generation

The backend no longer uses separate shared master-data domains for booking contacts or traveler groups.

## Current Implemented Scope

Implemented now:
- public booking ingestion
- public tours catalog
- Keycloak-protected backend access
- booking stage pipeline
- ATP staff assignment
- booking notes
- pricing and offer editing
- invoice generation
- booking activities
- Meta chat ingestion linked to bookings
- person search derived from bookings

Generated contract flow:
- source model in `model/`
- normalized IR in `model/ir/`
- generated OpenAPI in `api/generated/openapi.yaml`
- generated JS contract in `shared/generated-contract/`
- generated runtime re-exports in backend/frontend

## Milestone 1

Milestone 1 is now defined as:
- capture all incoming booking requests
- store submitted contact/traveler data directly on the booking
- manage bookings through stage, assignment, notes, pricing, offer, invoice, and activity workflows

Key data rule:
- `booking.persons[]` is the editable person record set for that booking
- `booking.web_form_submission` is the immutable inbound snapshot

## Active UI Surface

Backend pages:
- `backend.html`
- `booking.html`
- `persons.html`
- `tour.html`

Removed from active scope:
- standalone person detail CRUD page
- booking reassignment to a separate external record

## Short-Term Priorities

1. Keep the CUE model as the single source of truth.
2. Continue moving remaining handwritten transport details into `model/api/`.
3. Keep backend/frontend enums driven by generated contract artifacts.
4. Expand booking-person editing only if there is a clear operational need.
5. Treat mobile as a later consumer of the same booking/person contract.

## Production Direction

The long-term production direction can still evolve toward a stronger service stack, but the domain shape should remain:
- booking as operational record
- persons nested inside booking
- tours as reusable catalog items
- ATP staff as internal assignment directory

That keeps permissions, inbound form handling, and booking-level editing simpler than a shared cross-booking master-data model.
