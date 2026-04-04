# ATP Software Architecture

## Scope

This document describes the current architecture used by the active codebase.

## Single Source of Truth

ATP uses the CUE model in `model/` as the single source of truth.

It defines:
- core entities
- API payloads
- enums and catalogs
- naming and invariants

The current active domain vocabulary includes:
- booking
- booking person
- ATP staff
- tour
- travel plan template
- pricing
- invoice
- activity
- generated offers
- customer confirmation flow
- booking confirmation

It does not include separate shared person-master-data entities outside the booking.

## Layers

### Layer 1: Model

Source files under:
- `model/entities/`
- `model/api/`
- `model/enums/`
- `model/common/`
- `model/ir/`

### Layer 2: Generated contract

Generated from the model:
- `api/generated/openapi.yaml`
- `api/generated/mobile-api.meta.json`
- `shared/generated-contract/`
- `backend/app/Generated/`
- `frontend/Generated/`
- `mobile/iOS/Generated/` when explicitly generated for iOS consumption

Important generated transport types:
- `BookingReadModel`
- `GeneratedBookingOfferReadModel`
- `TravelPlanTemplateReadModel`
- `TranslationStatusSummary`
- public generated-offer access request and response payloads

Current repository note:
- the active iOS target does not currently keep generated Swift artifacts checked in
- the current mobile status is documented in `documentation/backend/mobileApp.md`

### Layer 3: Runtime application code

Handwritten runtime logic:
- backend business logic
- frontend pages and UI behavior
- authentication and authorization
- persistence orchestration and storage adapters

### Layer 4: Persistence

Current persistence:
- JSON store for bookings and related runtime state
- per-folder persisted assets for tours
- per-folder persisted assets for travel plan templates
- PDF and attachment folders for generated offer, invoice, and travel-plan artifacts

## Derivation Flow

1. CUE model defines the business and transport structure.
2. IR is exported from `model/ir`.
3. Generator writes OpenAPI and generated runtime modules.
4. Backend and frontend consume the generated artifacts.
5. Runtime logic adds authorization, workflow rules, and persistence.

## Runtime Responsibilities

Backend:
- authorization
- workflow and validation
- pricing and invoice logic
- persistence orchestration
- chat/webhook integration
- generated-offer freezing and serving
- deposit-based customer confirmation
- management approval
- travel-plan template CRUD and apply flow

Frontend:
- public website interactions
- public generated-offer access page
- backend booking workspace
- backend booking list page
- backend standard travel plans page
- tour editing page

## Current Exceptions

Some endpoints and behaviors are still handwritten and should remain explicitly documented if not moved into the model:
- Meta webhook endpoints
- offer exchange-rate preview endpoint
- some ATP staff write behaviors
- some tour upload behaviors

The important current handler split is:
- `backend/app/src/http/handlers/booking_finance.js`
  - finance and offer mutation flow
  - generated-offer creation
  - generated-offer Gmail draft flow
  - management approval
- `backend/app/src/http/handlers/booking_confirmation.js`
  - public generated-offer access
  - public generated-offer PDF
  - token-gated confirmation-flow status responses
- `backend/app/src/http/handlers/travel_plan_templates.js`
  - template CRUD
  - apply-template-to-booking flow
- `backend/app/src/domain/booking_confirmation.js`
  - customer confirmation flow normalization
  - booking confirmation token lifecycle
  - startup migration and state backfill for legacy generated offers
- `backend/app/src/domain/travel_plan_templates.js`
  - template normalization
  - clone-from-booking and clone-into-booking logic
- `frontend/pages/booking-confirmation.html`
  - token-gated public generated-offer read flow
- `frontend/pages/standard-travel-plans.html`
  - staff template library page

The backend startup path in `backend/app/src/server.js` performs explicit writeback migrations for legacy stored generated offers before serving requests.
This backfill is done at startup, not during booking GET requests.

## Generated Offer and Confirmation Boundary

The persisted entity and the transport read model are intentionally different.

Persisted generated offer entity:
- language
- frozen PDF metadata
- internal booking-confirmation token state
- optional `customer_confirmation_flow`
- optional `booking_confirmation`
- optional frozen management approver snapshot

Generated read model:
- `pdf_url`
- `public_booking_confirmation_token`
- `public_booking_confirmation_expires_at`
- `customer_confirmation_flow`
- booking translation summaries and generated-offer capability flags exposed through `BookingReadModel`

These read models are consumed by:
- authenticated backend booking screens
- the public generated-offer access page

This prevents public transport fields from becoming stored source-of-truth fields.

## Confirmation Model

The current intended confirmation model for new data is:
- `customer_confirmation_flow`
  - customer-facing setup
  - currently only `DEPOSIT_PAYMENT`
- `booking_confirmation`
  - immutable evidence record for the final confirmation result
  - currently `DEPOSIT_PAYMENT` or `MANAGEMENT`

Management approval is intentionally not modeled as a customer flow.
Instead, the generated offer can freeze:
- `management_approver_atp_staff_id`
- `management_approver_label`

and the actual confirmation record is written later with method `MANAGEMENT`.

Compatibility note:
- legacy public click-confirmation support still exists in runtime migration and handler code for older generated offers
- new offers are intended to confirm either by deposit payment or by management approval

## Travel Plan Template Model

`TravelPlanTemplate` is a dedicated entity.
It is not implemented as a fake booking.

Phase 1 behavior:
- templates are created from an existing booking travel plan
- templates are stored independently from bookings
- published templates can replace a booking travel plan by copy
- copied template content gets fresh booking travel-plan IDs
- templates are not live-linked back to bookings after apply

Template lifecycle:
- `draft`
- `published`
- `archived`

## Naming Rule

The active runtime, model, and docs should consistently use:
- `person` / `persons`
- `customer_confirmation_flow`
- `booking_confirmation`

and should avoid reintroducing:
- `people`
- old route-style confirmation naming
- `acceptance_route`
