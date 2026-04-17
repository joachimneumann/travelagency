# Software Architecture

## Purpose

This document explains the architectural shape of the current AsiaTravelPlan system.

It is not a generic template. It describes the actual structure used in this repository:
- one model source of truth
- generated transport artifacts
- handwritten runtime workflow code
- booking-owned person data
- modeled read models for API responses
- frozen generated-offer artifacts
- customer confirmation flow and booking confirmation
- standard travel plan templates

## Architecture Summary

The system is built around one rule:

The CUE model in `model/` defines the shared meaning of the system.

Everything else should either be:
- generated from that model
- or handwritten runtime logic that consumes the generated artifacts

The active operational domains are:
- bookings
- booking persons
- ATP staff
- tours
- travel plan templates
- pricing
- payment documents
- activities
- chat timelines linked to bookings
- generated offers
- customer confirmation flow
- booking confirmation

The system intentionally does not use a separate shared master-data layer for contacts or traveler groups.

## The Source of Truth

### Model

The source of truth lives under:
- `model/json/`
- `model/database/`
- `model/api/`
- `model/enums/`
- `model/common/`
- `model/ir/`

This model defines:
- entity shapes
- transport shapes
- enums and catalogs
- naming
- invariants

Important current domain decisions:
- `booking.persons[]` is the editable person structure
- `booking.web_form_submission` is the immutable inbound snapshot
- `TravelPlanTemplate` is a separate reusable entity, not a fake booking

### Why This Matters

Without a single source of truth, drift happens in three places:
- backend starts inventing fields not present in the model
- frontend starts hardcoding enums or response assumptions
- generated contract stops matching real runtime behavior

The architecture is designed to prevent that.

## Model Boundary

### `model/json/` and `model/database/`

Contain the source CUE files for business entities and value objects.

Examples:
- `Booking`
- `BookingPerson`
- `TravelPlanTemplate`
- `GeneratedBookingOffer`

These types describe what the business data means.

Current split:
- `model/json/`
  - file-backed content entities such as ATP staff, country reference, tours, and travel plan templates
- `model/database/`
  - booking-owned operational entities such as bookings, persons, offers, travel plans, and payment documents

### `model/api/`

Contains transport-only shapes.

Examples:
- list responses
- bootstrap payloads
- endpoint request and response envelopes
- read models such as `BookingReadModel`
- read models such as `GeneratedBookingOfferReadModel`
- read models such as `TravelPlanTemplateReadModel`

Important rule:
- transport-only fields such as `pdf_url` or translation summaries belong in `model/api/`
- persisted entity state belongs in `model/json/` or `model/database/` depending on source of truth
- transport-only data must not leak back into entity types

### `model/enums/` and `model/common/`

Contain reusable definitions such as:
- currencies
- languages
- booking stages
- offer categories
- identifiers
- dates

### `model/ir/`

Contains the normalized intermediate representation used by the generator.

This layer exists so code generation works from one normalized shape instead of trying to interpret every source file ad hoc.

## Generation Flow

The generation flow is:

1. CUE model defines entities, transport shapes, and enums.
2. `model/ir` exports normalized IR and catalogs.
3. `tools/generator/generate_mobile_contract_artifacts.rb` generates artifacts.
4. Runtime code consumes those artifacts.

Generated outputs include:
- `api/generated/openapi.yaml`
- `api/generated/mobile-api.meta.json`
- `shared/generated-contract/`
- `backend/app/Generated/`
- `frontend/Generated/`
- `mobile/iOS/Generated/` when explicitly generated for iOS consumption

The generator should own:
- transport schemas
- enum catalogs
- request builders
- runtime model exports

Runtime code should not maintain parallel copies of those definitions.

## Entity vs Read Model

The runtime distinguishes between:
- persisted entity shapes
- generated API read models

Examples:
- `database.#GeneratedBookingOffer`
  - persisted commercial snapshot
  - frozen PDF metadata
  - optional `booking_confirmation`
- `api.#GeneratedBookingOfferReadModel`
  - customer/admin-facing response shape
  - `pdf_url`
  - `booking_confirmation`

- `json.#TravelPlanTemplate`
  - persisted reusable travel plan
- `api.#TravelPlanTemplateReadModel`
  - derived counts and source-booking presentation data

This split exists to stop response-only fields from becoming accidental persisted domain fields.

## Four Layers

### Layer 1: Domain model

Owned by CUE in `model/`.

Responsibilities:
- define domain meaning
- define transport meaning
- define shared enums and catalogs

### Layer 2: Generated contract

Owned by the generator.

Responsibilities:
- publish the transport contract
- expose generated request builders
- expose generated models and catalogs for backend, frontend, and later mobile

### Layer 3: Runtime application code

Owned by handwritten backend/frontend code.

Responsibilities:
- workflow logic
- authorization
- persistence orchestration
- UI behavior
- chat/webhook integration
- pricing, offer, and payment-document calculations
- PDF generation and artifact handling

Current important runtime split:
- `booking_finance.js`
  - offer editing, generation, Gmail draft creation, finance mutations, management approval
- `booking_confirmation.js`
  - generated-offer confirmation snapshot helpers and legacy cleanup
- `travel_plan_templates.js`
  - template CRUD and apply flow
- `booking_confirmation.js` in `domain/`
  - booking confirmation snapshot helpers
  - startup migration for legacy generated offers

### Layer 4: Persistence

Owned by storage adapters.

Current local/runtime persistence is:
- JSON store for bookings and related runtime data
- per-tour folders for tours and images
- per-template folders for standard travel plans
- per-artifact folders for payment documents, generated offers, travel-plan PDFs, and attachments

## Confirmation Boundary

The current intended confirmation split for new data is:
- `booking_confirmation`
  - immutable evidence record
  - currently `DEPOSIT_PAYMENT` or `MANAGEMENT`

Management approval is not modeled as a customer flow.
Instead, the generated offer can freeze a management approver snapshot and later write a `booking_confirmation` with method `MANAGEMENT`.

Compatibility note:
- some legacy public click-confirmation behavior still exists in runtime migration and handler code for older stored offers
- new offers are intended to confirm through deposit payment or internal management approval

## Travel Plan Template Boundary

Templates are a separate entity because they are reusable reference material, not live customer records.

Phase 1 behavior:
- templates are created from an existing booking travel plan
- only published templates can be applied to a booking
- applying a template replaces the booking travel plan by copy
- templates are not live-linked to bookings after apply

## Concurrency Model

The active backend does not use a single booking-wide hash for optimistic locking.

Instead, each writable booking section has its own integer revision counter:
- `core_revision`
- `notes_revision`
- `persons_revision`
- `travel_plan_revision`
- `offer_revision`
- `payment_documents_revision`

Rules:
- endpoints validate only the revision for the section they mutate
- a write increments only that section revision
- `updated_at` remains an audit/display field and must not be used for conflict detection
