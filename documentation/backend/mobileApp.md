# AsiaTravelPlan iPhone App Integration Guide

This document explains how to build an iPhone app that uses the AsiaTravelPlan backend.

The app scope is intentionally limited:
- log in with Keycloak
- allow access only for users with one of these roles:
  - `atp_admin`
  - `atp_manager`
  - `atp_accountant`
  - `atp_staff`
- allow users to see and edit bookings
- later add customer interaction features

The app should not try to reproduce the full website backend immediately.

## 1) Scope

The iPhone app is not a wrapper around `backend.html`.

It should be a native app that:
- authenticates directly against Keycloak
- receives an access token
- calls `/api/v1/*` with `Authorization: Bearer <access_token>`
- renders a mobile UI based on the authenticated role

The first version should focus on:
- login
- booking list
- booking detail
- booking actions
- activity timeline

Customer features should come later.

## 2) Allowed roles only

The app must allow login only for users whose token contains at least one of these roles:
- `atp_admin`
- `atp_manager`
- `atp_accountant`
- `atp_staff`

All other users should be treated as unauthorized for the app.

This rule should be enforced in two places:

1. Backend
- the backend should reject users without one of the allowed roles

2. App
- after login, the app should inspect token/user role data
- if none of the allowed roles are present, the app should log the user out and show an unauthorized message

## 3) Recommended architecture

Use:
- Swift
- SwiftUI
- `ASWebAuthenticationSession`
- OpenID Connect Authorization Code Flow with PKCE
- iOS Keychain for token storage

Backend/API:
- staging: `https://api-staging.asiatravelplan.com`

Identity:
- Keycloak
- separate mobile client in Keycloak

## 4) Important auth rule

Do not use the confidential web client `asiatravelplan-backend` inside the iPhone app.

Reason:
- it uses a client secret
- mobile apps must not embed confidential client secrets

Create a separate Keycloak client for mobile, for example:
- `asiatravelplan-ios`

That mobile client should be:
- OpenID Connect
- public client
- PKCE enabled
- no client secret in the app

## 5) Keycloak setup for mobile

Create a mobile client in Keycloak:
- Client ID: `asiatravelplan-ios`
- Client type: `OpenID Connect`
- Client authentication: `Off`
- Standard flow: `On`
- PKCE: enabled or required

Recommended redirect URI:
- `asiatravelplan://auth/callback`

Recommended valid redirect URIs:
- `asiatravelplan://auth/callback`

The mobile client should expose the same business role names used by the backend:
- `atp_admin`
- `atp_manager`
- `atp_accountant`
- `atp_staff`

## 6) Current backend reality

The backend already supports:
- bearer token authentication on `/api/v1/*`
- role extraction from Keycloak token claims

The backend is still evolving and does not yet fully enforce every detailed business permission rule for each role.

Desired role behavior:
- `atp_staff`
  - can see only bookings assigned to them
  - can edit only bookings assigned to them
- `atp_manager`
  - can see and edit all bookings
- `atp_accountant`
  - can see all bookings
  - cannot fully edit bookings
  - can change booking stage only
- `atp_admin`
  - full access

This means:
- login and role detection are possible now
- fine-grained booking authorization still needs to be enforced completely in backend code

## 7) Recommended mobile login flow

1. User taps `Log in`
2. App opens Keycloak login with `ASWebAuthenticationSession`
3. User authenticates
4. Keycloak redirects to `asiatravelplan://auth/callback?code=...&state=...`
5. App exchanges the code for tokens using PKCE
6. App stores:
   - access token
   - refresh token
   - expiry metadata
7. App inspects the authenticated roles
8. If none of `atp_admin`, `atp_manager`, `atp_accountant`, `atp_staff` is present:
   - clear session
   - deny access
9. If at least one allowed role is present:
   - continue into the app

## 8) Token handling rules

Store tokens in:
- iOS Keychain

Do not store tokens in:
- `UserDefaults`
- plain files

Use:
- access token for API calls
- refresh token to renew access

Recommended behavior:
- refresh shortly before expiry
- on refresh failure, force a clean logout

## 9) API usage

Use bearer token requests:

```http
GET /api/v1/bookings?page=1&page_size=20&sort=created_at_desc
Authorization: Bearer <access_token>
```

The first app version should focus on booking endpoints:
- `GET /api/v1/bookings`
- `GET /api/v1/bookings/:bookingId`
- `PATCH /api/v1/bookings/:bookingId/stage`
- `PATCH /api/v1/bookings/:bookingId/owner`
- `GET /api/v1/bookings/:bookingId/activities`
- `POST /api/v1/bookings/:bookingId/activities`
- `GET /api/v1/bookings/:bookingId/invoices`

Later, add customer endpoints:
- `GET /api/v1/customers`
- `GET /api/v1/customers/:customerId`

## 10) First-version screens

Recommended first-version screens:
- Login
- Booking list
- Booking detail
- Booking stage update
- Booking owner update
- Activity timeline
- Add note/activity
- Settings / logout

Customer-related screens should be a later phase.

## 11) Role-specific app behavior

`atp_staff`
- show only assigned bookings
- allow editing only on assigned bookings

`atp_manager`
- show all bookings
- allow full booking editing

`atp_accountant`
- show all bookings
- allow stage update
- keep other booking fields read-only

`atp_admin`
- full booking access

The app UI should reflect these differences, but the backend must remain the source of truth.

## 12) Recommended app structure

Suggested Swift modules:
- `Auth`
- `Networking`
- `Models`
- `Bookings`
- `Settings`

Later:
- `Customers`

Suggested core services:
- `AuthService`
- `TokenStore`
- `APIClient`
- `SessionStore`
- `RoleService`

`RoleService` should expose convenience checks:
- `isATPAdmin`
- `isATPManager`
- `isATPAccountant`
- `isATPStaff`
- `isAllowedATPUser`

## 13) Backend support recommended for mobile

The mobile app will be simpler if the backend adds:

1. `GET /api/v1/me`
- return current authenticated identity and roles

Suggested response:

```json
{
  "user": {
    "sub": "uuid",
    "preferred_username": "joachim",
    "email": "info@asiatravelplan.com",
    "roles": ["atp_admin"]
  }
}
```

2. strict role-based authorization on booking endpoints

3. a reliable mapping between Keycloak identity and booking ownership for `atp_staff`

## 14) Security rules

- use PKCE
- do not embed confidential secrets in the app
- store tokens in Keychain only
- use HTTPS only
- allow only `atp_admin`, `atp_manager`, `atp_accountant`, `atp_staff`
- let backend enforce final authorization

## 15) Recommended implementation order

1. Create Keycloak mobile client
2. Implement OIDC login with PKCE
3. Implement token storage and refresh
4. Enforce allowed roles in app login state
5. Build booking list
6. Build booking detail
7. Build booking actions
8. Add `GET /api/v1/me` on backend
9. Add customer functionality later

## 16) Summary

The correct first mobile app is:
- native iPhone app
- separate Keycloak mobile client
- OIDC Authorization Code + PKCE
- bearer token API access
- access limited to:
  - `atp_admin`
  - `atp_manager`
  - `atp_accountant`
  - `atp_staff`
- focused on bookings first
- customer interaction added later
