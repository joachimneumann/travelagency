# AsiaTravelPlan Mobile App Guide

This document should follow the same booking-owned person model as the web backend.

Current status:
- iOS is not the active focus right now
- when mobile work resumes, it should consume the existing generated contract
- mobile must not reintroduce removed master-data concepts that are no longer part of the booking model

## Required Domain Shape

Mobile should treat these as the active domains:
- booking
- booking persons
- ATP staff
- tours
- invoices
- activities

Important rules:
- `booking.persons[]` contains the contact and traveler data
- `booking.web_form_submission` is the immutable inbound snapshot
- there is no standalone shared person directory in the active architecture

## Recommended First Mobile Scope

- login with Keycloak
- booking list
- booking detail
- booking stage changes where allowed
- booking note editing where allowed
- booking activity visibility
- booking invoice visibility
- booking person summary visibility

Out of scope for the first mobile phase:
- standalone person CRUD
- separate shared master-data workflows
- tour editing
- staff administration UI

## Contract Source of Truth

Source model:
- `model/entities/`
- `model/api/`
- `model/enums/`
- `model/common/`
- `model/ir/`

Generated artifacts:
- `api/generated/openapi.yaml`
- `api/generated/mobile-api.meta.json`
- `shared/generated-contract/`
- `backend/app/Generated/`
- `frontend/Generated/`
- `mobile/iOS/Generated/`

## Role Expectations

- `atp_staff`: assigned bookings only
- `atp_manager`: all bookings, assignment changes
- `atp_admin`: manager rights plus tours
- `atp_accountant`: booking read access, stage changes, tours read-only

## Keycloak

Do not use the confidential web backend client inside the app.

Use a separate mobile client, for example:
- `asiatravelplan-ios`

Recommended:
- OpenID Connect
- PKCE
- redirect URI like `asiatravelplan://auth/callback`

## Important Constraint

When mobile work resumes, generated contract artifacts and booking/person vocabulary must stay aligned with the current web/backend implementation. Mobile should follow the model, not preserve older naming.
