# Runtime Language Model (Current)

This document describes the language and translation model that is currently implemented in the runtime.

It is not an aspirational design. It records the current behavior, the current exceptions, and the cleanup still needed.

## 1. Language Domains

The system currently uses three separate language concerns:

- frontend website language
  - public site chrome and public-site copy
  - implemented by `frontend/scripts/shared/frontend_i18n.js`
- backend UI language
  - backend workspace chrome and labels
  - currently supported: `en`, `vi`
  - implemented by `frontend/scripts/shared/backend_i18n.js`
- customer content language
  - the language of customer-facing booking, offer, travel-plan, payment-document, and PDF content
  - defined by `shared/generated/language_catalog.js`

These concerns must not be merged conceptually even when they share the same code value.

## 2. Shared Catalog

The shared source for supported languages is:

- `shared/generated/language_catalog.js`

Important generated subsets:

- `BACKEND_UI_LANGUAGES`
  - currently the ATP staff/backend UI languages
  - currently `en` and `vi`
- `CUSTOMER_CONTENT_LANGUAGES`
  - customer-facing content languages
  - larger than the backend UI language set

Operational rule:

- backend UI language selects the ATP staff editing/source language where that workflow has been refactored
- customer content language selects the customer-facing target/read language

## 3. Booking Language Model

Current booking behavior uses:

- `booking.customer_language`
  - persisted customer-facing target language
- backend top-right language menu
  - the current ATP staff editing/source language in `booking.html`
- localized maps such as `title_i18n`, `details_i18n`, `notes_i18n`
  - persisted multilingual content branches

Current runtime behavior in `booking.html`:

- the top-right backend language is the source language for booking editing and translation
- the booking page still has a separate customer-language selector
- page URL uses `content_lang` for the selected customer language
- booking API reads and writes still commonly use `?lang=` as the requested content language for read/write projections

This means:

- `lang` in backend page URLs usually means backend UI language
- `lang` in booking API requests usually means customer-content read/write language
- `content_lang` in `booking.html` keeps those two page-level concerns separate

That split is real and must be understood before changing booking language behavior.

## 4. Tour Language Model

Current runtime behavior in `marketing_tour.html` and `marketing_tours.html`:

- the top-right backend language is the source language for localized tour editing
- `marketing_tour.html` orders localized fields with the active backend language first, then the other `EN`/`VI` language, then the remaining customer-content languages
- tour translation requests send explicit `source_lang` and `target_lang`
- `marketing_tours.html` list/view language already follows the backend `lang` query parameter

Tours do not use a separate persisted editing-language field.

## 5. Localized Field Storage

Customer-facing editable content is stored as language-keyed maps.

Examples:

- booking offer line items
  - `trip_price_internal.label_i18n`
  - `days_internal[].label_i18n`
  - `additional_items[].label_i18n`
  - `additional_items[].details_i18n`
- booking travel plan
  - `title_i18n`
  - `overnight_location_i18n`
  - `time_label_i18n`
  - `details_i18n`
  - `location_i18n`
  - `notes_i18n`
- payment documents
  - `title_i18n`
  - `notes_i18n`
  - component `description_i18n`
- tours
  - `title`
  - `short_description`
  - `highlights`
  - stored and normalized as localized maps by the tour handlers

Key backend helpers:

- `backend/app/src/domain/booking_content_i18n.js`
- `backend/app/src/domain/booking_translation.js`
- `backend/app/src/domain/tour_catalog_i18n.js`

Key frontend helpers:

- `frontend/scripts/booking/i18n.js`
- `frontend/scripts/booking/localized_editor.js`

Current runtime pattern:

- the map is the durable multilingual source
- the flat string is a resolved branch for the requested language context
- translation status metadata stores source-language hashes so stale translations can be detected
- booking section translation metadata can now also store per-language `manual_keys` so manually improved target fields survive later auto-translation runs

## 6. Translation Flow

Translation endpoints use explicit language arguments:

- `source_lang`
- `target_lang`

The translation runtime then:

1. resolves the source-language branch from the localized map
2. translates only fields that have source content
3. writes the target-language branch back into the localized map
4. updates translation metadata with `source_lang`, `source_hash`, `origin`, and `updated_at`

Current manual-override rule:

- a manual edit in a target language can lock that specific field key for that target language
- later auto-translation skips locked target fields and refreshes only the remaining machine-managed fields

Important current rule:

- in bookings and tours, translation should be treated as source-language-to-target-language translation
- it should not be treated as English-to-target translation unless the source language actually is English

## 7. PDFs and Generated Artifacts

Customer-facing generated artifacts use customer/document language, not backend UI language.

Current runtime:

- generated offers use `generatedOffer.lang`, then `booking.customer_language`, then other fallbacks
- travel-plan PDFs use customer/document language
- payment-document PDFs use document language, then customer language fallbacks
- PDF copy is translated through `backend/app/src/lib/pdf_i18n.js`

Operational rule:

- ATP staff/backend UI language is the source authoring language
- customer/document language is the output language for customer-facing artifacts

## 8. Current State

The active implementation now matches the intended source-language model:

- booking source language is derived from the active backend UI language
- booking page and booking runtime helpers no longer expose a separate editing-language selector
- booking API requests use `content_lang` for customer-facing reads/writes and `source_lang` for source-authoring context
- the legacy booking `editing_language` field and `/editing-language` endpoint are removed from the contract
- ATP staff/settings translation now uses the active backend UI language as the source language and orders localized editors with the EN/VI pair first
- translation-pruning maintenance preserves inferred source-language branches instead of hard-coding English
- PDF dictionaries now include all customer-content locales currently flagged as PDF-capable in the shared language catalog

## 9. Files to Read Before Editing This Area

- `shared/generated/language_catalog.js`
- `frontend/scripts/shared/backend_i18n.js`
- `frontend/scripts/shared/frontend_i18n.js`
- `scripts/i18n/sync_backend_i18n.mjs`
- `scripts/i18n/sync_frontend_i18n.mjs`
- `frontend/scripts/booking/i18n.js`
- `frontend/scripts/booking/localized_editor.js`
- `frontend/scripts/pages/booking_page_language.js`
- `frontend/scripts/pages/booking_page_data.js`
- `frontend/scripts/pages/tour.js`
- `backend/app/src/domain/booking_content_i18n.js`
- `backend/app/src/domain/booking_translation.js`
- `backend/app/src/domain/booking_views.js`
- `backend/app/src/http/handlers/booking_core.js`
- `backend/app/src/http/handlers/booking_finance.js`
- `backend/app/src/http/handlers/booking_travel_plan.js`
- `backend/app/src/http/handlers/booking_payment_documents.js`
- `backend/app/src/http/handlers/tours.js`
- `backend/app/src/lib/pdf_i18n.js`

Static dictionary override paths:

- `frontend/data/i18n/backend_overrides/<lang>.json`
- `frontend/data/i18n/frontend_overrides/<lang>.json`
