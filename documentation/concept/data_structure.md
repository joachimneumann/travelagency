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
- `pricing_revision`
- `offer_revision`
- `invoices_revision`
- stage, assignment, notes
- commercial data such as pricing, offer, invoices
- `number_of_travelers`
- `web_form_submission`
- `persons[]`

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

## Invariants

- `booking.persons[]` is the editable person source of truth for that booking
- `web_form_submission` remains the original inbound snapshot
- optimistic concurrency is section-based, not booking-wide
- each writable booking subresource carries its own revision counter
- `updated_at` is for audit/display only and is not used for conflict detection
- one booking may list fewer or more persons than `number_of_travelers`
- UI may warn when those counts differ, but the model allows it
- a booking should usually have one `primary_contact`

## Conflict Detection

The active conflict model uses optimistic locking with integer revision counters.

- core edits use `core_revision`
- notes use `notes_revision`
- persons use `persons_revision`
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
