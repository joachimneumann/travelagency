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

It covers concepts such as:

- user
- role
- booking
- customer
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

### 5.1 Backend

- `Backend/Models/generated_Currency.js`
- `Backend/Models/generated_User.js`
- `Backend/Models/generated_Booking.js`
- `Backend/Models/generated_Aux.js`
- `Backend/API/generated_APIModels.js`
- `Backend/API/generated_APIRequestFactory.js` when required for outbound backend API use

`generated_Booking.js` includes booking-related structures for:

- pricing
- payments
- invoices
- booking-related activities

### 5.2 Frontend

- `Frontend/Models/generated_Currency.js`
- `Frontend/Models/generated_User.js`
- `Frontend/Models/generated_Booking.js`
- `Frontend/Models/generated_Aux.js`
- `Frontend/API/generated_APIModels.js`
- `Frontend/API/generated_APIRequestFactory.js`
- `Frontend/API/generated_APIClient.js`

### 5.3 iOS

- `iOS/Models/generated_Currency.swift`
- `iOS/Models/generated_User.swift`
- `iOS/Models/generated_Booking.swift`
- `iOS/Models/generated_Aux.swift`
- `iOS/API/generated_APIModels.swift`
- `iOS/API/generated_APIRequestFactory.swift`
- `iOS/API/generated_APIClient.swift`

## 6. Generated File Responsibilities

### 6.1 `generated_Currency`

Contains:

- valid currencies
- symbols
- decimal places
- canonical currency metadata
- currency-related enums and helpers

### 6.2 `generated_User`

Contains:

- user transport structures
- user roles
- authenticated user payloads
- user-related enums and helpers

### 6.3 `generated_Booking`

Contains:

- booking entity structures
- pricing structures
- payment structures
- invoice structures
- booking-related enums

Transport wrappers, list payloads, and endpoint-specific request or response shapes do not belong here.

### 6.4 `generated_Aux`

Contains:

- supporting enums and model types not owned by Currency, User, or Booking
- non-transport shared value objects when they are not first-class entities

Transport-only payloads do not belong here.

Transport-only payloads belong in `model/api/` and in generated API-facing output, for example:

- bootstrap structures
- list wrappers
- generic paging structures
- error shapes
- endpoint-specific request and response payloads

### 6.5 `generated_APIRequestFactory`

Contains:

- path builders
- query builders
- request payload helpers
- API request construction helpers

### 6.6 `generated_APIClient`

Contains:

- typed API calls
- response decoding entry points
- transport-level request execution helpers


## 6.7 Entity and Transport Boundary

Core entities belong strictly in entity-oriented generated files.

Examples:

- Booking
- Customer
- Tour
- User
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

At the time of writing, the abstract model description (Layer 1) is not yet implemented as a separate artifact.

ATP currently uses:

- the backend model and business code as the practical source of domain truth
- the generated OpenAPI specification (`contracts/mobile-api.openapi.yaml`) as the transport contract and generator input

The goal is to evolve towards the full four-layer design by introducing a minimal abstract model description that sits above both the backend model and the generated API specification.

### 8.1 Interim rules for the API contract

Until the abstract model description is introduced, the following rules apply to the API contract:

- JSON field names in the generated OpenAPI specification use **camelCase** consistently at the transport layer.
- Status and type fields that have a finite set of values are modeled as **enums** in the generated OpenAPI specification, not as free-form strings.
- Legacy or storage-oriented naming (for example, snake_case or database column names) is kept inside the backend and storage layers, not exposed as new transport field names.

These rules keep the mobile and frontend models predictable while the abstract model is being designed.

### 8.2 Planned abstract model introduction

The planned next step is to introduce a minimal abstract model artifact that:

- defines the core ATP entities (user, role, booking, customer, tour, pricing, payment, invoice, currency, stage, activity, permissions)
- defines canonical field names and business meaning at the model level
- feeds both the backend model generation and the API specification generation

Once this abstract model exists, the intended derivation flow for ATP is:

1. abstract model description → generated API specification
2. abstract model description → generated backend model
3. generated API specification → generated frontend and iOS API code and models
4. generated backend model → storage adapters / storage model

This keeps the ATP implementation aligned with the general architecture described in `software_architecture.md` while acknowledging the current incremental adoption path.
