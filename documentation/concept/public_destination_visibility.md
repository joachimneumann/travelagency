# Public Destination Visibility

## Purpose

Use one boolean per supported destination to decide whether that destination is visible on the public website.

This is currently a marketing/publication control, not a content-delete mechanism.

## Source of truth

- Model: `model/json/country_reference.cue`
- Runtime file: `content/country_reference_info.json`
- Backend editor: `/emergency.html`
- Field: `published_on_webpage`

Default behavior:

- `published_on_webpage` defaults to `true`
- if a supported country is missing from `content/country_reference_info.json`, the public runtime still treats it as published
- a country becomes hidden only when it is explicitly present with `published_on_webpage: false`

## Public surfaces affected

The flag currently affects these public surfaces:

- `GET /public/v1/tours`
- homepage hero title
- homepage hero destination filter
- homepage tour cards and destination option list

Current public behavior:

- unpublished destinations are removed from `available_destinations`
- tours with no remaining published destinations are removed from the public response
- mixed-destination tours keep only their published destination labels in the public response
- the homepage hero title is built from the published destination labels returned by the public tours payload
- the hero destination filter is shown only when more than one destination is publicly visible
- when zero or one destination is publicly visible, the hero destination filter is hidden and any saved destination selection is cleared
- the hero travel-style filter stays visible regardless of destination count

## Caching

Destination publication changes should appear immediately after a normal page reload.

Current cache policy:

- `GET /public/v1/tours` responds with `Cache-Control: no-store`
- the homepage fetches the public tours payload with `cache: "no-store"`
- there is no separate `localStorage` tours payload cache anymore
- homepage filter state still persists in `localStorage` via `asiatravelplan_filters`

## Non-goals

This flag does not currently:

- remove destinations from internal tour editing
- remove destination codes from the backend catalog
- publish emergency contacts or practical tips on the website
- change booking-form destination handling outside the homepage/tours flow

## Main implementation path

1. ATP staff update `published_on_webpage` in `/emergency.html`
2. the backend reads `content/country_reference_info.json`
3. `backend/app/src/http/handlers/tours.js` filters public tours and destination options
4. `frontend/scripts/main_tours.js` derives the hero title and conditional destination-filter visibility from the public payload
