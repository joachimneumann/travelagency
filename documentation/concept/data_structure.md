# Data Structure (Current Concept)

## Core Decision

AsiaTravelPlan uses a booking-owned operational data model.

This means:
- no separate shared person-master-data entity
- no separate booking anchor entity outside the booking itself
- the booking contains the contact and traveler information needed to operate that booking

## Target model folder split

This document distinguishes between persistence buckets and shared schema layers.

Target folder layout:

```text
model/
  json/
  database/
  common/
  enums/
  api/
```

Intended meaning:

- `model/json`
  - entities whose source of truth remains JSON files under `content/`
- `model/database`
  - entities whose source of truth is planned to move to PostgreSQL
- `model/common`
  - shared value types such as identifiers, timestamps, money, URLs, and constraints
- `model/enums`
  - shared controlled vocabularies used by both JSON-backed and database-backed models
- `model/api`
  - request, response, list, and read-model contracts for transport over HTTP

Important boundary:

- `model/common`, `model/enums`, and `model/api` are shared schema layers
- they are not persistence buckets
- they should not be interpreted as standalone PostgreSQL tables or standalone JSON content collections

Status note:

- this is the intended conceptual split
- the repo may still temporarily use `model/entities` until the refactor is implemented

## JSON-backed content models

These models remain file-backed content and do not belong to the PostgreSQL migration scope:

- `AtpStaffProfile`
- `AtpStaffLocalizedTextEntry`
- `CountryPracticalInfo`
- `CountryEmergencyContact`
- `Tour`
- `TravelPlanTemplate`

Planned file grouping:

- `model/json/atp_staff.cue`
- `model/json/country_reference.cue`
- `model/json/tour.cue`
- `model/json/travel_plan_template.cue`

Operational meaning:

- ATP staff profiles remain editable content under `content/atp_staff`
- public destination support and publication flags remain editable content under `content/country_reference_info.json`
- marketing tours remain editable content under `content/tours`
- travel plan templates remain editable content under `content/travel_plan_templates`

## Database-backed operational models

These models are part of the booking-owned operational domain and belong in the PostgreSQL direction:

- `Booking`
- `BookingPerson`
- `BookingPersonAddress`
- `BookingPersonConsent`
- `BookingPersonDocument`
- `BookingOffer`
- `GeneratedBookingOffer`
- `PaymentDocument`
- `PaymentDocumentComponent`
- `PricingAdjustment`
- `BookingTravelPlan`
- `BookingTravelPlanDay`
- `BookingTravelPlanService`
- `BookingTravelPlanServiceImage`
- `BookingTravelPlanAttachment`

Planned file grouping:

- `model/database/booking.cue`
- `model/database/booking_person.cue`
- `model/database/booking_offer.cue`
- `model/database/payment_document.cue`
- `model/database/travel_plan.cue`

## Booking

`Booking`
- `id`
- `core_revision`
- `notes_revision`
- `persons_revision`
- `travel_plan_revision`
- `offer_revision`
- `payment_documents_revision`
- stage, assignment, notes
- commercial data such as offer snapshots and payment documents
- `customer_language`
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
- `gender?`
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

## BookingTravelPlan

`BookingTravelPlan`
- `days[]`
- `attachments[]`

Current travel-plan notes:
- day and service IDs are booking-local operational IDs
- service images can carry an optional `image_subtitle`
- travel-plan PDFs can be generated independently from generated offers
- travel-plan PDFs can optionally include a `Who is traveling` section

## BookingOffer

`BookingOffer`
- `currency`
- `status`
- `payment_terms`
- `category_rules[]`
- `trip_price_internal?`
- `days_internal[]`
- `additional_items[]`
- `discount?`
- `totals`
- `quotation_summary`
- `pdf_personalization`

The offer model separates:
- internal arithmetic totals
- customer-facing quotation totals

`days_internal[]`
- `day_number`
- `label`
- `amount_cents`
- `tax_rate_basis_points`

`additional_items[]`
- `category?`
- `label`
- `details`
- `quantity`
- `unit_amount_cents`
- `unit_tax_amount_cents`
- `unit_total_amount_cents`
  - unit price including tax
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

ATP quotation semantics:
- customer-facing line prices are tax-inclusive
- the quotation exposes tax transparently when tax is non-zero
- mixed tax rates are supported through `tax_breakdown[]`
- zero-tax offers omit the quotation tax summary in the customer PDF

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
- `management_approver_atp_staff_id?`
- `management_approver_label?`
- `pdf_frozen_at`
- `pdf_sha256`
- `booking_confirmation?`

Meaning:
- this is the frozen customer-facing commercial snapshot
- it stores the exact offer and travel plan as generated at that moment
- the PDF artifact is frozen from this snapshot at generation time
- the generated offer can optionally freeze who may later approve it internally

Important boundary:
- transport fields such as `pdf_url` are not part of this entity
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
- `management_approver_atp_staff_id?`
- `deposit_payment_id?`
- `accepted_payment_term_line_id?`
- `accepted_payment_ids?`
- `accepted_amount_cents?`
- `accepted_currency?`

Meaning:
- this is the immutable evidence record for confirming one frozen generated offer
- it stores what was confirmed, how it was confirmed, and what exact PDF/snapshot hashes were involved

Current intended methods for new data:
- `DEPOSIT_PAYMENT`
- `MANAGEMENT`

Compatibility note:
- older stored data may still contain legacy confirmation methods until an explicit historical migration rule is chosen

## TravelPlanTemplate

`TravelPlanTemplate`
- `id`
- `title`
- `description?`
- `status`
- `destinations?`
- `travel_styles?`
- `source_booking_id?`
- `created_by_atp_staff_id?`
- `travel_plan`
- `created_at?`
- `updated_at?`

Meaning:
- this is a reusable standard travel plan
- it is stored independently from bookings
- it is currently created from an existing booking travel plan
- applying a template copies its travel plan into a booking with fresh booking-local IDs

Current lifecycle:
- `draft`
- `published`
- `archived`

## API Read Models

`GeneratedBookingOfferReadModel`
- customer/admin-facing generated-offer response shape
- `pdf_url`
- `booking_confirmation`

`BookingReadModel`
- booking response shape used for list, detail, activity, and payment-document responses
- translation status summaries
- generated-offer email capability flags
- generated offers projected as `GeneratedBookingOfferReadModel[]`

`TravelPlanTemplateReadModel`
- staff-facing template library shape
- derived template counts such as `day_count` and `service_count`
- optional source-booking label and thumbnail

Important boundary:
- response-only fields must stay in the read models
- persistence-only token state must stay on the entity side
