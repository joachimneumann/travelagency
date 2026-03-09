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
- `mobile/iOS/Generated/`

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

Frontend:
- public website interactions
- backend booking workspace
- booking detail page
- person search page
- tour editing page

## Current Exceptions

Some endpoints and behaviors are still handwritten and should remain explicitly documented if not moved into the model:
- Meta webhook endpoints
- offer exchange-rate preview endpoint
- some ATP staff write behaviors
- some tour upload behaviors

## Naming Rule

The active runtime, model, and docs should consistently use:
- `person` / `persons`
- not `people`
- not legacy shared master-data labels from the earlier architecture
