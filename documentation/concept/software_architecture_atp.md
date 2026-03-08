# ATP Software Architecture

## Scope

This document defines the concrete software architecture for ATP.

It specifies:

- the single point of truth
- the four-layer architecture
- derivation flow
- runtime responsibilities
- generated file structure

## 1. Single Point of Truth

ATP uses one single point of truth:

1. abstract model description

### 1.1 Abstract model description

The abstract model description defines the ATP business domain.

It defines:

- core entities in `model/entities/`
- relationships
- invariants
- canonical terminology
- canonical field meaning
- the `Client` anchor plus `Customer` and `TravelGroup` subtypes

It covers concepts such as:

- user
- role
- booking
- client
- customer
- travel_group
- tour
- pricing
- payment
- invoice
- currency
- stage
- activity
- permissions

It does not define:

- HTTP routes
- storage format
- frontend layout
- iOS navigation

### 1.2 Generated API specification

The API specification is a generated transport artifact that defines the transport contract.

It defines:

- endpoints
- request payloads
- response payloads
- authentication requirements
- versioning metadata

It is used by:

- frontend
- iOS
- public booking flow

## 2. Four-Layer Architecture

ATP uses four layers.

### Layer 1: Abstract model description

Defines:

- domain entities
- field meaning
- relationships
- invariants
- domain vocabulary

### Layer 2: API contract, API code for frontend and mobile

Contains:

- API specification
- generated API request builders for frontend
- generated API request builders for iOS
- generated API client code for frontend
- generated API client code for iOS
- generated transport-level enums and metadata
- generated transport models from `model/api/`

### Layer 3: Backend model, frontend model, mobile model

Contains generated runtime-specific models.

It includes:

- backend model
- frontend model
- iOS model

These models are generated.

### Layer 4: Storage adapters / storage model

Maps the backend model to persistence.

It includes:

- JSON persistence mapping
- future database mapping
- persistence-specific normalization and denormalization
- storage-specific identifiers and indexing

## 3. Derivation Flow

ATP uses this derivation flow:

1. abstract model description -> generated API specification
2. abstract model description -> generated backend model
3. generated API specification -> generated frontend model and API code
4. generated API specification -> generated iOS model and API code
5. generated backend model -> storage adapters / storage model

### 3.1 Current implementation note

ATP now implements Layer 1 as a CUE model under `model/`.

Current source structure:
- `model/root.cue` composes `model/entities/`, `model/api/`, `model/common/`, and `model/enums/`
- `model/ir/normalized.cue` exports the normalized IR used by the generator
- `model/ir/catalogs.cue` exports enum catalogs and currency metadata

Current generation flow:
1. `cue export ./ir -e IR` produces the normalized model IR
2. `cue export ./api -e #TravelerConstraints` exports traveler constraints
3. `tools/generator/generate_mobile_contract_artifacts.rb` writes:
   - `api/generated/openapi.yaml`
   - `api/generated/mobile-api.meta.json`
   - `shared/generated-contract/` JS modules
   - backend/frontend generated JS re-export modules
   - iOS generated Swift files

The generated contract is the main transport contract, but ATP still has a small set of hand-written or partially modeled endpoints outside that flow.

Current exceptions include:
- Meta webhook integration endpoints
- `POST /api/v1/offers/exchange-rates`
- `POST /api/v1/atp_staff`
- tour write/upload endpoints (`POST/PATCH /api/v1/tours`, `POST /api/v1/tours/:tourId/image`)

These should either move into `model/api/` or stay explicitly documented as runtime-internal.

## 4. Runtime Responsibilities

### 4.1 Backend

Responsible for:

- hand-written business logic
- hand-written domain validation rules
- authorization
- pricing and payment calculations
- invoice generation
- concurrency rules
- persistence orchestration

Consumes:

- generated backend model code
- generated shared model definitions

### 4.2 Frontend

Responsible for:

- public booking interactions
- administrative booking UI
- administrative customer UI
- administrative travel-group UI
- administrative tour UI
- administrative payment and invoice UI
- client-side form behavior
- presentation formatting using generated metadata
- calling the backend through generated API code

### 4.3 iOS

Responsible for:

- in-house mobile access to ATP data
- mobile presentation and navigation
- mobile-specific interaction behavior
- calling the backend through generated API code

The iOS app may use a reduced subset of ATP functionality.

## 5. Generated File Structure

ATP uses this generated file structure.

ATP keeps the model split explicit:

- `model/entities/` contains core domain entities
- `model/api/` contains transport-only payloads

### 5.1 Generated contract artifacts

- `~/projects/travelagency/api/generated/openapi.yaml`
- `~/projects/travelagency/api/generated/mobile-api.meta.json`
- `~/projects/travelagency/api/generated/README.md`

`openapi.yaml` is the generated OpenAPI 3.1 contract.

`mobile-api.meta.json` contains:
- `modelVersion`
- `generatorVersion`
- endpoint registry
- enum catalogs
- traveler constraints
- generated timestamp metadata

### 5.2 Shared JS contract

- `~/projects/travelagency/shared/generated-contract/Models/generated_Currency.js`
- `~/projects/travelagency/shared/generated-contract/Models/generated_Language.js`
- `~/projects/travelagency/shared/generated-contract/Models/generated_ATPStaff.js`
- `~/projects/travelagency/shared/generated-contract/Models/generated_Booking.js`
- `~/projects/travelagency/shared/generated-contract/Models/generated_Customer.js`
- `~/projects/travelagency/shared/generated-contract/Models/generated_TravelGroup.js`
- `~/projects/travelagency/shared/generated-contract/Models/generated_Aux.js`
- `~/projects/travelagency/shared/generated-contract/Models/generated_FormConstraints.js`
- `~/projects/travelagency/shared/generated-contract/Models/generated_SchemaRuntime.js`
- `~/projects/travelagency/shared/generated-contract/API/generated_APIRuntime.js`
- `~/projects/travelagency/shared/generated-contract/API/generated_APIModels.js`
- `~/projects/travelagency/shared/generated-contract/API/generated_APIRequestFactory.js`
- `~/projects/travelagency/shared/generated-contract/API/generated_APIClient.js`

This is the canonical JS contract output.

### 5.3 Backend JS re-export modules

- `~/projects/travelagency/backend/app/Generated/Models/generated_Currency.js`
- `~/projects/travelagency/backend/app/Generated/Models/generated_Language.js`
- `~/projects/travelagency/backend/app/Generated/Models/generated_ATPStaff.js`
- `~/projects/travelagency/backend/app/Generated/Models/generated_Booking.js`
- `~/projects/travelagency/backend/app/Generated/Models/generated_Customer.js`
- `~/projects/travelagency/backend/app/Generated/Models/generated_TravelGroup.js`
- `~/projects/travelagency/backend/app/Generated/Models/generated_Aux.js`
- `~/projects/travelagency/backend/app/Generated/Models/generated_FormConstraints.js`
- `~/projects/travelagency/backend/app/Generated/Models/generated_SchemaRuntime.js`
- `~/projects/travelagency/backend/app/Generated/API/generated_APIRuntime.js`
- `~/projects/travelagency/backend/app/Generated/API/generated_APIModels.js`
- `~/projects/travelagency/backend/app/Generated/API/generated_APIRequestFactory.js`
- `~/projects/travelagency/backend/app/Generated/API/generated_APIClient.js`

Backend JS generated files re-export `shared/generated-contract/` so the runtime uses one canonical JS contract.

### 5.4 Frontend JS re-export modules

- `~/projects/travelagency/frontend/Generated/Models/generated_Currency.js`
- `~/projects/travelagency/frontend/Generated/Models/generated_Language.js`
- `~/projects/travelagency/frontend/Generated/Models/generated_ATPStaff.js`
- `~/projects/travelagency/frontend/Generated/Models/generated_Booking.js`
- `~/projects/travelagency/frontend/Generated/Models/generated_Customer.js`
- `~/projects/travelagency/frontend/Generated/Models/generated_TravelGroup.js`
- `~/projects/travelagency/frontend/Generated/Models/generated_Aux.js`
- `~/projects/travelagency/frontend/Generated/Models/generated_FormConstraints.js`
- `~/projects/travelagency/frontend/Generated/Models/generated_SchemaRuntime.js`
- `~/projects/travelagency/frontend/Generated/API/generated_APIRuntime.js`
- `~/projects/travelagency/frontend/Generated/API/generated_APIModels.js`
- `~/projects/travelagency/frontend/Generated/API/generated_APIRequestFactory.js`
- `~/projects/travelagency/frontend/Generated/API/generated_APIClient.js`

Frontend JS generated files also re-export `shared/generated-contract/`.

### 5.5 iOS generated Swift files

- `~/projects/travelagency/mobile/iOS/Generated/Models/generated_Currency.swift`
- `~/projects/travelagency/mobile/iOS/Generated/Models/generated_Language.swift`
- `~/projects/travelagency/mobile/iOS/Generated/Models/generated_ATPStaff.swift`
- `~/projects/travelagency/mobile/iOS/Generated/Models/generated_Booking.swift`
- `~/projects/travelagency/mobile/iOS/Generated/Models/generated_Customer.swift`
- `~/projects/travelagency/mobile/iOS/Generated/Models/generated_TravelGroup.swift`
- `~/projects/travelagency/mobile/iOS/Generated/Models/generated_Aux.swift`
- `~/projects/travelagency/mobile/iOS/Generated/Models/generated_FormConstraints.swift`
- `~/projects/travelagency/mobile/iOS/Generated/Models/generated_Enums.swift`
- `~/projects/travelagency/mobile/iOS/Generated/API/generated_APIModels.swift`
- `~/projects/travelagency/mobile/iOS/Generated/API/generated_APIRequestFactory.swift`
- `~/projects/travelagency/mobile/iOS/Generated/API/generated_APIClient.swift`

## 6. Generated File Responsibilities

### 6.1 Model bundles

Current domain-oriented generated model bundles are:
- `generated_Currency`
- `generated_Language`
- `generated_ATPStaff`
- `generated_Booking`
- `generated_Customer`
- `generated_TravelGroup`
- `generated_Aux`
- `generated_FormConstraints`

These files contain generated schemas, enums, metadata, and structural validators for the modeled types in their domain area.

Examples:
- `generated_Currency` contains currency catalog metadata and currency-code enums
- `generated_Booking` contains booking, pricing, offer, payment, invoice, and activity structures
- `generated_Customer` contains `Client`, `Customer`, `CustomerConsent`, and `CustomerDocument`
- `generated_TravelGroup` contains `TravelGroup` and `TravelGroupMember`
- `generated_FormConstraints` contains generated traveler-count limits and similar UI-facing constraints
- `generated_Language` and `generated_Enums.swift` provide language and enum helpers for Swift/iOS output

### 6.2 `generated_SchemaRuntime`

Contains shared JS schema helpers used by generated validators and API models.

### 6.3 `generated_APIRuntime`

Contains:
- endpoint registry
- route metadata
- contract version constants
- shared endpoint lookup data

### 6.4 `generated_APIModels`

Contains transport-only request and response schemas derived from `model/api/` plus OpenAPI path definitions.

Examples:
- bootstrap payloads
- list/detail wrappers
- paging structures
- endpoint-specific request and response payloads
- generated validation helpers for those payloads

### 6.5 `generated_APIRequestFactory`

Contains path builders, query helpers, and request-construction helpers for generated endpoints.

### 6.6 `generated_APIClient`

Contains the generated client wrapper around the request factory for JS and Swift runtimes.


## 6.7 Entity and Transport Boundary

Core entities belong strictly in entity-oriented generated files.

Examples:

- Booking
- Customer
- Tour
- ATPStaff
- Currency

Transport-only shapes belong in API-oriented generated files and originate in `model/api/`.

Examples:

- BookingList
- TourList
- bootstrap payloads
- paging wrappers
- error shapes
- endpoint-specific request and response payloads

The generator should not mix these categories in the same generated file.

## 7. Generator Responsibilities

The generator is responsible for:

- generating Layer 2 frontend and iOS API code
- generating Layer 3 backend, frontend, and iOS models
- emitting one canonical shared JS contract plus backend/frontend re-export layers
- keeping runtime models aligned with the abstract model description and the generated API specification
- separating generated code by domain area
- keeping transport-only shapes in API-oriented output
- keeping core entities in entity-oriented output
- emitting stable file names and stable output structure

The generator is not responsible for:

- storage adapter implementation
- backend business logic
- backend domain services
- frontend layout
- iOS navigation

## 8. Current Implementation Status and Next Steps

ATP is already using the intended model-first flow.

Current state:
- `model/` is the implemented abstract model
- `api/generated/openapi.yaml` is the generated transport contract
- `mobile-api.meta.json` is the generated compatibility/catalog metadata consumed by tests and mobile bootstrap
- backend/frontend/iOS generated sources are emitted from that contract

Current contract rules:
- field names in generated output come from the modeled field names; ATP currently preserves a mix of existing snake_case and camelCase names where the model requires them
- finite status/type sets are generated as explicit enums
- naming or shape changes must happen in `model/` and then be regenerated, not patched directly in `api/generated/`

Next steps:
1. move the remaining hand-written endpoints into `model/api/`
2. add missing request/response bodies for transitional endpoints already exposed by generated route constants
3. keep backend contract tests aligned with `mobile-api.meta.json` and the generated request factory contract version
