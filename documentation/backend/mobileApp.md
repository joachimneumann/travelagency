# AsiaTravelPlan Mobile App Guide

This document defines the first iPhone app for AsiaTravelPlan.

Current implementation scaffold:
- `/Users/internal_admin/projects/travelagency/mobile/iOS`
- Xcode project: `/Users/internal_admin/projects/travelagency/mobile/iOS/AsiaTravelPlan.xcodeproj`
- project generator: `/Users/internal_admin/projects/travelagency/mobile/iOS/generate_xcodeproj.rb`
- contract source: `/Users/internal_admin/projects/travelagency/contracts/mobile-api.openapi.yaml`

The app scope is intentionally narrow:
- allow login only for `atp_admin`, `atp_manager`, `atp_accountant`, `atp_staff`
- show bookings
- allow booking actions according to role
- later add customer interaction features

The app should not try to reproduce the full website backend.

## 1) App scope

The mobile app should be a native iPhone app, not a wrapper around `backend.html`.

Version 1 should include:
- login with Keycloak
- booking list
- booking detail
- booking stage changes where allowed
- booking note/activity creation where allowed
- booking staff assignment only for manager/admin
- logout

Later phase:
- customer interaction workflows
- customer detail screens
- direct communication actions

Out of scope for the first mobile version:
- tour editing
- staff management UI
- full finance UI
- customer administration UI

## 2) Allowed roles only

The app must allow access only when the authenticated user has at least one of these roles:
- `atp_admin`
- `atp_manager`
- `atp_accountant`
- `atp_staff`

All other users must be treated as unauthorized.

This should be enforced in two places:
1. backend authorization
2. app session gating after login

If the token does not contain one of those roles, the app should:
- clear local session state
- show an unauthorized message
- not enter the booking UI

## 3) Authentication architecture

Use:
- Swift
- SwiftUI
- `ASWebAuthenticationSession`
- OpenID Connect Authorization Code Flow with PKCE
- Keychain for token storage

Do not use the confidential web client `asiatravelplan-backend` inside the iPhone app.

Create a separate Keycloak client for mobile, for example:
- `asiatravelplan-ios`

Recommended Keycloak client setup:
- Client type: `OpenID Connect`
- Client authentication: `Off`
- Standard flow: `On`
- PKCE: enabled or required
- Redirect URI: `asiatravelplan://auth/callback`
- Valid post logout redirect URI: `asiatravelplan://auth/callback`

Logout behavior:
- `Sign out` in the app clears the local Keychain session and also calls the Keycloak end-session endpoint through `ASWebAuthenticationSession`
- if the client does not allow `asiatravelplan://auth/callback` as a post-logout redirect URI, remote logout will fail

## 4) API access model

The mobile app should treat the OpenAPI contract as the only stable interface.
It should not infer response shapes from backend internals or JSON storage.

Contract source of truth:
- `/Users/internal_admin/projects/travelagency/contracts/mobile-api.openapi.yaml`

Generated artifacts:
- `/Users/internal_admin/projects/travelagency/contracts/generated/mobile-api.meta.json`
- `/Users/internal_admin/projects/travelagency/mobile/iOS/Generated/MobileAPIModels.swift`
- `/Users/internal_admin/projects/travelagency/mobile/iOS/Generated/MobileAPIRequestFactory.swift`

The mobile app should call backend APIs with bearer tokens:

```http
GET /api/v1/bookings?page=1&page_size=20&sort=created_at_desc
Authorization: Bearer <access_token>
```

The app should target the same backend API used by the browser backend.

Recommended first endpoints:
- `GET /public/v1/mobile/bootstrap`
- `GET /api/v1/bookings`
- `GET /api/v1/bookings/:bookingId`
- `PATCH /api/v1/bookings/:bookingId/stage`
- `PATCH /api/v1/bookings/:bookingId/owner`
- `GET /api/v1/bookings/:bookingId/activities`
- `POST /api/v1/bookings/:bookingId/activities`
- `GET /api/v1/bookings/:bookingId/invoices`

Note:
- the current assignment route path is still `PATCH /api/v1/bookings/:bookingId/owner`
- semantically this is now a staff assignment endpoint
- request body may send `owner_id` for compatibility or `staff`

## 5) Current backend role behavior

The backend now enforces this booking/tour authorization model.

`atp_staff`
- can read only bookings assigned to that staff member
- can edit only bookings assigned to that staff member
- cannot change staff assignments
- cannot access tours

`atp_manager`
- can read all bookings
- can edit all bookings
- can change booking staff assignments
- can create new staff records
- does not edit tours

`atp_admin`
- can read all bookings
- can edit all bookings
- can change booking staff assignments
- can create new staff records
- can read and edit tours

`atp_accountant`
- can read all bookings
- cannot edit bookings generally
- can change booking stage
- has read-only access to tours

This is the source of truth for the mobile UI.
The app should reflect these permissions, but the backend must remain authoritative.

## 6) Staff identity mapping

For `atp_staff`, the backend resolves access based on the Keycloak username.

Required mapping rule:
- Keycloak `preferred_username` must match one of the entries in `backend/app/config/staff.json -> usernames[]`

Example:

```json
{
  "id": "staff_123",
  "name": "Joachim",
  "active": true,
  "usernames": ["joachim"]
}
```

If the logged-in `atp_staff` user cannot be mapped to a staff record, the backend will not allow staff-scoped booking access.

## 7) Recommended mobile UI behavior by role

`atp_staff`
- show only assigned bookings
- allow note creation only on assigned bookings
- allow stage changes only on assigned bookings
- hide staff assignment controls
- hide tours section

`atp_manager`
- show all bookings
- allow booking editing
- show staff assignment controls
- hide tours section

`atp_admin`
- show all bookings
- allow booking editing
- show staff assignment controls
- if tours are added later to mobile, allow editing

`atp_accountant`
- show all bookings
- allow stage changes only
- keep other booking actions read-only
- if tours are added later to mobile, allow read-only viewing only

## 8) First-version screens

Recommended screens:
- Login
- Booking list
- Booking detail
- Booking stage update
- Booking activity timeline
- Add note/activity
- Staff assignment picker for manager/admin only
- Settings / logout

Later screens:
- customer interaction inbox
- customer detail
- customer contact actions

## 9) Token handling rules

Store tokens only in:
- iOS Keychain

Do not store tokens in:
- `UserDefaults`
- plain files

Use:
- access token for API calls
- refresh token for renewal

Recommended behavior:
- refresh shortly before expiry
- on refresh failure, log out cleanly

## 10) Suggested app structure

Suggested modules:
- `Auth`
- `Networking`
- `Models`
- `Bookings`
- `Session`
- `Settings`

Later:
- `Customers`

Suggested services:
- `AuthService`
- `TokenStore`
- `APIClient`
- `SessionStore`
- `RoleService`

`RoleService` should expose:
- `isATPAdmin`
- `isATPManager`
- `isATPAccountant`
- `isATPStaff`
- `isAllowedATPUser`

## 11) Recommended backend support for mobile

Current version/bootstrap endpoint:

`GET /public/v1/mobile/bootstrap`

Current response:

```json
{
  "app": {
    "min_supported_version": "1.0.0",
    "latest_version": "1.0.0",
    "force_update": false
  },
  "api": {
    "contract_version": "2026-03-01.1"
  },
  "features": {
    "bookings": true,
    "customers": false,
    "tours": false
  }
}
```

Startup rule:
- app starts
- fetches `/public/v1/mobile/bootstrap`
- compares installed app version against `min_supported_version`
- if installed build is too old, show `Please update` and stop app usage

This is the intended behavior for in-house distribution. Backward compatibility beyond the minimum supported version is not a goal.

The mobile app will be simpler if the backend provides:

1. `GET /api/v1/me`
- current identity
- resolved roles
- possibly resolved staff record id

Suggested response shape:

```json
{
  "authenticated": true,
  "user": {
    "sub": "...",
    "preferred_username": "joachim",
    "email": "info@asiatravelplan.com",
    "roles": ["atp_admin"]
  }
}
```

2. stable booking payload fields
- `staff`
- `staff_name`
- current stage
- activities

3. stable staff assignment behavior
- manager/admin only
- path compatibility kept even if route name still says `owner`

## 12) Summary

The correct first iPhone app is:
- native
- authenticated through Keycloak with PKCE
- restricted to `atp_admin`, `atp_manager`, `atp_accountant`, `atp_staff`
- focused on bookings first
- prepared for later customer interaction

That will keep the app aligned with the real backend permissions instead of copying the browser backend UI mechanically.
