# Data Structure (Current Concept)

## Core Decision

AsiaTravelPlan now uses a booking-owned person structure.

This means:
- no separate shared person-master-data entity
- no separate booking anchor entity outside the booking itself
- the booking contains the contact and traveler information needed to operate that booking

## Booking

`Booking`
- `id`
- `core_revision`
- `notes_revision`
- `persons_revision`
- `travel_plan_revision`
- `pricing_revision`
- `offer_revision`
- `invoices_revision`
- stage, assignment, notes
- commercial data such as pricing, offer, invoices
- `customer_language`
- `confirmed_generated_offer_id`
- `number_of_travelers`
- `web_form_submission`
- `persons[]`
- `generated_offers[]`

Current language meaning:
- `customer_language`
  - persisted customer-facing target language
- backend UI language
  - current ATP staff editing/source language in `booking.html`
- source language
  - derived at runtime from the current backend UI language
  - passed through booking API calls as `source_lang`

`web_form_submission`
- immutable snapshot of the original website submission
- used for audit and input traceability

`persons[]`
- editable operational person records for the booking

## BookingPerson

`BookingPerson`
- `id`
- `name`
- `emails[]`
- `phone_numbers[]`
- `preferred_language`
- `date_of_birth`
- `nationality`
- `roles[]`
- `address`
- `photo_ref`
- `documents[]`
- `consents[]`
- `notes`

Important role examples:
- `primary_contact`
- `traveler`
- `decision_maker`
- `payer`
- `assistant`

Multiple roles are allowed on the same person.

## BookingPersonAddress

`BookingPersonAddress`
- `line_1`
- `line_2`
- `city`
- `state_region`
- `postal_code`
- `country_code`

## BookingPersonConsent

`BookingPersonConsent`
- `id`
- `consent_type`
- `status`
- `captured_via`
- `captured_at`
- `evidence_ref`
- `updated_at`

## BookingPersonDocument

`BookingPersonDocument`
- `id`
- `document_type`
- `document_number`
- `document_picture_ref`
- `issuing_country`
- `expires_on`
- `created_at`
- `updated_at`

## BookingOffer

`BookingOffer`
- `currency`
- `status`
- `category_rules[]`
- `components[]`
- `totals`
- `quotation_summary`

The offer model now separates:
- internal arithmetic totals
- customer-facing quotation totals

`components[]`
- `category`
- `label`
- `details`
- `quantity`
- `unit_amount_cents`
  this is the unit price before tax
- `unit_tax_amount_cents`
- `unit_total_amount_cents`
  this is the unit price including tax
- `tax_rate_basis_points`
- `line_net_amount_cents`
- `line_tax_amount_cents`
- `line_gross_amount_cents`

Notes:
- discounts and credits are modeled by category semantics, not by negative unit prices
- unit amounts stay non-negative
- line totals carry the sign

`totals`
- `net_amount_cents`
- `tax_amount_cents`
- `gross_amount_cents`

`quotation_summary`
- `tax_included`
- `subtotal_net_amount_cents`
- `total_tax_amount_cents`
- `grand_total_amount_cents`
- `tax_breakdown[]`

`tax_breakdown[]`
- one entry per tax-rate bucket used in the offer
- contains net, tax, and gross totals for that rate

ATP quotation semantics:
- customer-facing line prices are tax-inclusive
- the quotation still exposes tax transparently in the summary
- mixed tax rates are supported through `tax_breakdown[]`

## GeneratedBookingOffer

`GeneratedBookingOffer`
- `id`
- `booking_id`
- `version`
- `filename`
- `lang`
- `comment`
- `created_at`
- `created_by`
- `currency`
- `total_price_cents`
- `offer`
- `travel_plan`
- `pdf_frozen_at`
- `pdf_sha256`
- `booking_confirmation_token_nonce`
- `booking_confirmation_token_created_at`
- `booking_confirmation_token_expires_at`
- `booking_confirmation_token_revoked_at`
- `acceptance`

Meaning:
- this is the frozen customer-facing commercial snapshot
- it stores the exact offer and travel plan as generated at that moment
- the PDF artifact is frozen from this snapshot at generation time

Important boundary:
- transport fields such as `pdf_url` and `public_booking_confirmation_token` are not part of this entity
- those belong to the API read model only

## GeneratedOfferBookingConfirmation

`GeneratedOfferBookingConfirmation`
- `id`
- `accepted_at`
- `accepted_by_name`
- `accepted_by_email?`
- `accepted_by_phone?`
- `accepted_by_person_id?`
- `language`
- `method`
- `statement_snapshot`
- `terms_version`
- `terms_snapshot`
- `offer_currency`
- `offer_total_price_cents`
- `offer_pdf_sha256`
- `offer_snapshot_sha256`
- `ip_address?`
- `user_agent?`
- `deposit_payment_id?`

Meaning:
- this is the immutable evidence record for accepting one frozen generated offer
- it stores what was accepted, how it was accepted, and what exact PDF/snapshot hashes were involved
- it is written only after acceptance-token verification

Current implementation note:
- booking confirmation is token-gated
- challenge-state throttling details are not stored inside `GeneratedOfferBookingConfirmation`

## API Read Models

`GeneratedBookingOfferReadModel`
- customer/admin-facing generated-offer response shape
- `pdf_url`
- `public_booking_confirmation_token`
- `public_booking_confirmation_expires_at`
- acceptance data projected for UI/API consumption

`BookingReadModel`
- booking response shape used for list, detail, activity, and invoice responses
- translation status summaries
- generated-offer email capability flags
- generated offers projected as `GeneratedBookingOfferReadModel[]`

Important boundary:
- these are transport models, not persisted entities
- they may contain derived links, capability tokens, and UI-facing summaries that must not be written back into `Booking` or `GeneratedBookingOffer`

## Invariants

- `booking.persons[]` is the editable person source of truth for that booking
- `web_form_submission` remains the original inbound snapshot
- optimistic concurrency is section-based, not booking-wide
- each writable booking subresource carries its own revision counter
- `updated_at` is for audit/display only and is not used for conflict detection
- one booking may list fewer or more persons than `number_of_travelers`
- UI may warn when those counts differ, but the model allows it
- a booking should usually have one `primary_contact`
- a generated offer is an immutable snapshot once created
- the generated-offer PDF is frozen at generation time
- `confirmed_generated_offer_id` may point to at most one confirmed generated offer per booking
- public booking confirmation is authorized by a dedicated booking confirmation token, not by `booking_id` and `generated_offer_id` alone
- public generated-offer links and PDF URLs belong to API read models, not persisted entities

## Conflict Detection

The active conflict model uses optimistic locking with integer revision counters.

- core edits use `core_revision`
- notes use `notes_revision`
- persons use `persons_revision`
- travel plan uses `travel_plan_revision`
- pricing uses `pricing_revision`
- offer uses `offer_revision`
- invoices use `invoices_revision`

When the backend returns a conflict because another device already wrote a newer revision, the frontend should stop the edit and ask the user to reload the page. It should not silently refresh the booking or retry automatically.

## Why This Shape

Advantages:
- simpler data structure
- easier permission separation for ATP staff
- no cross-booking write conflicts
- inbound web form already matches the booking shape

Tradeoff:
- duplicates across bookings are allowed by design
