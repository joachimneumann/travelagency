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
- pricing
- invoice
- activity
- currencies and languages
- generated offers
- generated-booking confirmation

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
- `TranslationStatusSummary`
- public generated-offer access/accept request and response payloads

Current repository note:
- the active iOS target does not currently keep generated Swift artifacts checked in
- the current mobile status is documented in `documentation/backend/mobileApp.md`

### Layer 3: Runtime application code

Handwritten runtime logic:
- backend business logic
- frontend pages and UI behavior
- authentication and authorization
- storage adapters

### Layer 4: Persistence

Current persistence:
- JSON store for local/runtime use
- booking-centered records
- tours and invoices as separate persisted assets

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
- generated-booking confirmation and OTP verification

Frontend:
- public website interactions
- public booking-confirmationance page
- backend booking workspace
- booking detail page
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
- `backend/app/src/http/handlers/booking_booking_confirmation.js`
  - public generated-offer access
  - public generated-offer PDF
  - public acceptance
  - email OTP issue/verify flow
  - resend throttling responses including `retry_after_seconds`
- `backend/app/src/domain/generated_offer_artifacts.js`
  - frozen generated-offer PDF artifact logic
- `backend/app/src/domain/booking_confirmation.js`
  - acceptance-token lifecycle
  - acceptance-token verification
  - OTP challenge helpers
- `frontend/pages/booking-confirmation.html`
  - public acceptance page
- `frontend/scripts/pages/booking_confirmation.js`
  - token-gated public generated-offer read flow
  - email OTP issue/verify UX
  - resend countdown using `retry_after_seconds`

The backend startup path in `backend/app/src/server.js` performs explicit acceptance-token-state backfill for legacy stored generated offers.
This backfill is done at startup, not during booking GET requests.

## Generated Offer and Acceptance Boundary

The persisted entity and the transport read model are intentionally different.

Persisted generated offer entity:
- language
- frozen PDF metadata
- internal acceptance-token state
- acceptance record

Generated read model:
- `pdf_url`
- `public_booking_confirmation_token`
- `public_booking_confirmation_expires_at`
- booking translation summaries and generated-offer capability flags exposed through `BookingReadModel`

These read models are consumed by:
- authenticated backend booking screens
- the public booking-confirmationance page

This prevents public transport fields from becoming stored source-of-truth fields.

## Naming Rule

The active runtime, model, and docs should consistently use:
- `person` / `persons`
- not `people`
- not legacy shared master-data labels from the earlier architecture
