# Software Architecture

## Purpose

This document explains the architectural shape of the current AsiaTravelPlan system.

It is not a generic template. It describes the actual structure used in this repository:
- one model source of truth
- generated transport artifacts
- handwritten runtime workflow code
- booking-owned person data

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
- pricing
- invoices
- activities
- chat timelines linked to bookings

The system intentionally does not use a separate shared master-data layer for contacts or traveler groups.

## The Source of Truth

### Model

The source of truth lives under:
- `model/entities/`
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

Important current domain decision:
- `booking.persons[]` is the editable person structure
- `booking.web_form_submission` is the immutable inbound snapshot

### Why This Matters

Without a single source of truth, drift happens in three places:
- backend starts inventing fields not present in the model
- frontend starts hardcoding enums or response assumptions
- generated contract stops matching real runtime behavior

The architecture is designed to prevent that.

## Model Boundary

The CUE model is split intentionally.

### `model/entities/`

Contains business entities and value objects.

Examples:
- `Booking`
- `BookingPerson`
- `Invoice`
- `Tour`

These types describe what the business data means.

### `model/api/`

Contains transport-only shapes.

Examples:
- list responses
- bootstrap payloads
- endpoint request and response envelopes
- error shapes

These types describe how data moves across HTTP.

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
- `mobile/iOS/Generated/`

The generator should own:
- transport schemas
- enum catalogs
- request builders
- runtime model exports

Runtime code should not maintain parallel copies of those definitions.

## Four Layers

### Layer 1: Domain model

Owned by CUE in `model/`.

Responsibilities:
- define domain meaning
- define transport meaning
- define shared enums and catalogs

This is the most stable layer.

### Layer 2: Generated contract

Owned by the generator.

Responsibilities:
- publish the transport contract
- expose generated request builders
- expose generated models and catalogs for backend, frontend, and later mobile

This is the shared communication layer between runtimes.

### Layer 3: Runtime application code

Owned by handwritten backend/frontend code.

Responsibilities:
- workflow logic
- authorization
- persistence orchestration
- UI behavior
- chat/webhook integration
- pricing, offer, and invoice calculations

This layer may add behavior, but it should not redefine the shared data contract.

### Layer 4: Persistence

Owned by storage adapters.

Current local/runtime persistence is:
- JSON store for bookings and related runtime data
- per-tour folders for tours and images
- invoice files/assets

Persistence is allowed to have storage-specific normalization, but that normalization must still map back to the modeled runtime shape.

## Runtime Responsibilities by Area

### Backend

The backend is responsible for:
- authentication and authorization
- booking workflows
- stage transitions
- ATP staff assignment rules
- pricing normalization and calculations
- invoice creation and PDF generation
- chat/webhook ingestion
- persistence

The backend should use generated enums and transport shapes instead of maintaining handwritten parallel catalogs.

### Frontend

The frontend is responsible for:
- public booking form
- public tours catalog
- backend workspace pages
- booking detail page
- person search page
- tour edit page

The frontend should use generated request builders, generated enums, and generated transport models whenever possible.

### Mobile

Mobile is currently secondary, but the architectural rule is already defined:
- mobile should consume the same generated contract
- mobile should use the same booking-owned person vocabulary
- mobile must not reintroduce removed master-data concepts

## Current Domain Shape

The active data shape is centered on the booking.

Key implications:
- a booking owns its contact and traveler data
- person changes are local to that booking
- cross-booking deduplication is not the primary write model
- inbound website data already fits the booking shape

Advantages:
- simpler permissions
- fewer cross-record write conflicts
- easier inbound form handling
- easier maintenance

Tradeoff:
- duplicates across bookings are allowed

This tradeoff is intentional.

## Concurrency Model

The active backend no longer uses a single booking-wide hash for optimistic locking.

Instead, each writable booking section has its own integer revision counter:
- `core_revision`
- `notes_revision`
- `persons_revision`
- `pricing_revision`
- `offer_revision`
- `invoices_revision`

Rules:
- endpoints must validate only the revision for the section they mutate
- a write increments only that section revision
- `updated_at` remains an audit/display field and must not be used for conflict detection
- on a conflict, the frontend should tell the user to reload; it should not silently overwrite with server state

## Where Handwritten Code Is Still Acceptable

Not everything has to be generated.

Handwritten code is still the right place for:
- authorization rules
- workflow transitions
- storage adapters
- pricing calculations
- PDF rendering
- webhook integration
- UI layout and interaction

But handwritten code should not become the source of truth for:
- enum definitions
- transport field names
- endpoint shapes
- shared domain naming

## Exceptions

Some current endpoints or behaviors are still partly handwritten outside the modeled transport layer.

Examples:
- Meta webhook endpoints
- offer exchange-rate preview endpoint
- some ATP staff write flows
- some tour upload behavior

These are acceptable only if they remain explicitly documented and do not drift into shadow schemas.

## Naming Rules

The active architecture should consistently use:
- `person` / `persons`
- `booking person`
- `booking-owned`

Avoid:
- `people`
- removed legacy master-data labels
- duplicate runtime vocabularies for the same concept

## Practical Review Rule

When changing the system, ask these questions in order:

1. Should this change start in `model/`?
2. Should the generator own this shape or enum?
3. Is the backend/frontend adding behavior, not redefining shared meaning?
4. Does the final runtime still reflect booking-owned persons?

If the answer to the first two is yes, the change should not start in handwritten runtime code.
