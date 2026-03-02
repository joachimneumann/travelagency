# Software Architecture

## Purpose

This document describes a software architecture for a system with:

- a backend
- a web frontend
- one or more mobile apps
- generated code shared across those runtimes

The architecture is based on one single point of truth, one generated transport artifact, and a four-layer design.

## Single Point of Truth

The system should define exactly one source of truth.

### Abstract model description

The abstract model description defines the business domain independently from transport, user interface, and storage.

It describes:

- core entities in `entities/`
- relationships
- enumerations
- invariants
- canonical terminology
- business meaning of fields

It should not describe:

- HTTP routes
- JSON persistence layout
- database tables
- frontend framework structures
- mobile framework structures

Its purpose is to define what the system means.

### Generated API specification

The API specification defines how clients communicate with the backend.

It describes:

- endpoints
- HTTP methods
- request shapes
- response shapes
- path and query parameters
- authentication requirements
- versioning and compatibility metadata

Its purpose is to define how the system is accessed.

## Why the Generated API Specification Is Needed

The abstract model description and the generated API specification solve different problems.

### Why the abstract model description is needed

Without an abstract model, the system tends to drift into implementation-defined concepts.

Typical failure modes:

- business meaning exists only in backend code
- frontend and mobile invent their own interpretations of fields
- the same concept is represented differently in different runtimes

The abstract model prevents conceptual drift.

### Why the generated API specification is needed

Without an API specification, each client has to infer the protocol from backend implementation details.

Typical failure modes:

- routes are duplicated by hand
- field names are guessed manually
- mobile and frontend drift apart
- backend changes break clients unexpectedly

The API specification prevents protocol drift.

## Relationship Between the Model and the Generated API Specification

The abstract model description and the generated API specification are related, but they are not the same thing.

- The abstract model describes business meaning.
- The generated API specification describes transport behavior.

The intended direction is:

- the API specification is generated from the abstract model description
- generated code is derived from the API specification

The API specification is a generated transport artifact and should not become an independent business model.

The abstract model should separate:

- `entities/` for core domain entities and value objects
- `api/` for transport-only payloads such as list wrappers, bootstrap payloads, paging wrappers, and error shapes


## Entity and Transport Boundary

The abstract model must keep core business entities separate from transport-only payloads.

### `entities/`

`entities/` contains only domain entities and domain value objects.

Examples:

- `Booking`
- `Customer`
- `Tour`
- `User`
- `Currency`

These types represent business meaning. They are not request wrappers, list envelopes, or transport error payloads.

### `api/`

`api/` contains only transport-oriented shapes.

Examples:

- `BookingList`
- `TourList`
- bootstrap payloads
- paging wrappers
- error shapes
- endpoint-specific request and response payloads

These types represent how data is transported, not what the core domain is.

Generated API output should preserve this split:

- entity-oriented generated files should come from `entities/`
- transport-oriented generated files should come from `api/`

## Four-Layer Architecture

The architecture should be understood as four layers.

### Layer 1: Abstract model description

This is the conceptual business layer.

It defines:

- domain entities
- business relationships
- field meaning
- invariants
- domain vocabulary

This layer is independent of:

- transport
- UI
- storage

It is the most stable layer.

### Layer 2: API contract, API code for frontend and mobile

This layer turns the abstract model into a transport contract and generated client-facing protocol code.

It includes:

- the API specification
- generated API request builders for the frontend
- generated API request builders for mobile
- generated API client code for the frontend
- generated API client code for mobile
- generated transport models from `model/api/`
- generated enums and metadata that belong to the transport layer

This layer is the communication boundary between backend and clients.

It answers questions such as:

- what endpoint exists
- what request is valid
- what response shape is valid
- how the frontend calls the backend
- how the mobile app calls the backend

### Layer 3: Backend model, frontend model, mobile model

This layer contains runtime-specific models derived from the shared sources.
These models are generated by a generator rather than maintained as independent hand-written copies.

It includes:

- backend model
- frontend model
- mobile model

These models are not identical copies of each other. They are platform-specific realizations of the same shared concepts, produced by generation rules for each runtime.

#### Backend model

The backend model should be derived from the abstract model description.

It should be storage-agnostic and contain:

- backend structural types
- enums
- generated validators
- generated metadata needed by backend code

It should not contain hand-written domain behavior.

#### Frontend model

The frontend model should be derived from the API specification.

It should contain:

- view-facing representations of API data
- generated entity models from `entities/`
- generated transport models from `api/`
- generated enums and metadata catalogs
- client-side transport model structures
- UI-adapter logic where needed

#### Mobile model

The mobile model should also be derived from the API specification.

It should contain:

- mobile-facing representations of API data
- generated entity models from `entities/`
- generated transport models from `api/`
- generated enums and metadata catalogs
- mobile transport model structures
- platform-specific adapters where needed

A mobile model may intentionally be smaller than the frontend or backend model. That is acceptable.

The important rule is:

- it must be a subset or projection of the same shared concepts
- it must not become a separately invented model

### Layer 4: Storage adapters / storage model

This is the persistence layer.

It maps the backend model to a concrete storage technology.

Examples:

- JSON file storage
- relational database schema
- document storage
- search index representation
- external persistence adapters

This layer may vary significantly depending on implementation needs.

That is expected.

Storage concerns should be allowed to differ from business concerns.

## Recommended Derivation Flow

The recommended derivation flow is:

1. abstract model description -> generated API specification
2. abstract model description -> generated backend model
3. generated API specification -> frontend API code and mobile API code
4. generated API specification -> frontend model and mobile model
5. generated backend model -> storage adapters / storage model

This is better than deriving the persistence structure directly from the abstract model.

If storage is generated directly from the abstract model without an explicit backend model, storage-specific concerns tend to leak into domain design.

The intent is that the generator consumes the abstract model description and the generated API specification, then emits the runtime-specific model layer for backend, frontend, and mobile.

## Responsibilities by Layer

### Abstract model description owns

- business concepts
- canonical terminology
- relationships
- invariants
- semantic meaning

### Generated API specification owns

- transport contract
- endpoint definitions
- request and response schemas
- compatibility metadata
- authentication surface
- transport-only types derived from `model/api/`

### Generated backend model owns

- structural backend types
- enums
- generated validators
- generated metadata used by backend code

### Hand-written backend domain code owns

- business logic
- domain validation rules beyond generated structural validation
- calculations
- permissions
- transition rules

### Frontend and mobile API code own

- route construction
- request construction
- response decoding
- transport-level client helpers

### Frontend and mobile models own

- runtime-specific typed representations
- presentation adapters where needed
- metadata consumption from generated sources

### Storage adapters own

- persistence-specific mapping
- database layout
- JSON structure
- indexing choices
- storage optimization

## What Should Be Generated

A generator should produce the parts that are repetitive, cross-platform, and contract-driven.

That typically includes:

- generated API request code for the frontend
- generated API client code for the frontend
- generated API request code for mobile
- generated API client code for mobile
- generated frontend model code
- generated mobile model code
- generated enums and metadata catalogs
- generated compatibility metadata

The backend may also derive part of its model or validation structures from the shared sources, depending on the implementation strategy.

## What Should Remain Hand-Written

The following should usually remain hand-written:

- backend business logic
- backend persistence logic
- frontend UI flow
- frontend page or screen controllers
- mobile screen composition
- mobile navigation
- platform-specific interaction logic

Generated code should remain narrow and predictable.

## Why This Architecture Scales

This architecture scales because it separates concerns cleanly.

- The abstract model keeps business meaning stable.
- The generated API specification keeps communication stable.
- Generated API code reduces duplication.
- Runtime-specific models remain aligned but platform-appropriate.
- Storage can evolve independently.

This makes it practical to:

- change storage technology
- add a new client
- reduce the mobile surface area
- evolve the API without duplicating protocol knowledge everywhere

## Mobile-Specific Scope Reduction

A mobile app often does not need the full system surface.

That is normal.

A mobile app may intentionally use:

- fewer endpoints
- fewer fields
- fewer editing capabilities
- fewer administrative concepts

This does not violate the architecture, as long as the mobile app still derives its API code and model code from the same shared sources.

The system should therefore support:

- a full backend surface
- a full or broad frontend surface
- a reduced mobile surface

without changing the underlying meaning of the shared concepts.

## Versioning and Compatibility

The generated API specification should include explicit compatibility signals, especially for mobile.

Typical examples:

- contract version
- minimum supported app version
- latest recommended app version
- feature flags or capability indicators

This allows a mobile app to stop early when it is no longer compatible, instead of continuing with partial or broken behavior.

## Summary

This architecture is built on one single point of truth:

1. abstract model description

It also uses one generated transport artifact:

- API specification

And it is organized into four layers:

1. abstract model description
2. API contract, API code for frontend and mobile
3. backend model, frontend model, mobile model
4. storage adapters / storage model

The central idea is simple:

- define business meaning once
- define transport behavior once
- generate the repetitive client-facing protocol code
- keep runtime-specific models aligned
- allow persistence to vary independently

### Practical adoption notes

In systems like ATP that adopt this architecture incrementally, it is acceptable to:

- use the abstract model description as the source of truth
- generate the API specification from it
- keep the generated API specification transport-oriented and **camelCase** at the JSON layer
- represent status and type fields as **explicit enums** in the contract where the value set is finite
- avoid leaking storage naming or database-column concerns into new API field names
- keep frontend and mobile models generated from the API specification rather than hand-written copies

That gives a system that is easier to understand, easier to evolve, and less likely to drift across backend, frontend, and mobile.
