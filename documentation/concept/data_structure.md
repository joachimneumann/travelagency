# Data Structure (Current Concept)

## Core Decision

AsiaTravelPlan uses a booking-owned operational data model.

This means:
- no separate shared person-master-data entity
- no separate booking anchor entity outside the booking itself
- the booking contains the contact and traveler information needed to operate that booking

## Current model layout

The current CUE model is organized like this:

```text
model/
  entities/
  common/
  enums/
  api/
```

Meaning:

- `model/entities`
  - domain entities, including both file-backed content entities and booking-owned operational entities
- `model/common`
  - shared value types such as identifiers, timestamps, money, URLs, and constraints
- `model/enums`
  - shared controlled vocabularies used across the model
- `model/api`
  - request, response, list, and read-model contracts for transport over HTTP

Important boundary:

- `model/common`, `model/enums`, and `model/api` are shared schema layers
- they are not persistence buckets
- persistence interpretation depends on the entity and runtime source of truth, not only on the folder

## File-backed content entities

These entities remain file-backed content and are not part of the booking-owned operational aggregate:

- `AtpStaffProfile`
- `AtpStaffLocalizedTextEntry`
- `CountryPracticalInfo`
- `CountryEmergencyContact`
- `Tour`
- `TravelPlanTemplate`

Current file locations:

- `model/entities/atp_staff.cue`
- `model/entities/country_reference.cue`
- `model/entities/tour.cue`
- `model/entities/travel_plan_template.cue`

Operational meaning:

- ATP staff profiles remain editable content under `content/atp_staff`
- public destination support and publication flags remain editable content under `content/country_reference_info.json`
- marketing tours remain editable content under `content/tours`
- travel plan templates remain editable content under `content/travel_plan_templates`

## Booking-owned operational entities

These entities are part of the booking-owned operational domain:

- `Booking`
- `BookingPerson`
- `BookingPersonAddress`
- `BookingPersonConsent`
- `BookingPersonDocument`
- `BookingOffer`
- `GeneratedBookingOffer`
- `BookingPaymentDocument`
- `BookingActivity`
- `BookingTravelPlan`
- `BookingTravelPlanDay`
- `BookingTravelPlanService`
- `BookingTravelPlanServiceImage`
- `BookingTravelPlanAttachment`

Current file locations:

- `model/entities/booking.cue`
- `model/entities/booking_person.cue`
- `model/entities/booking_offer.cue`
- `model/entities/payment_document.cue`
- `model/entities/travel_plan.cue`

## Booking

`Booking`
- `id`
- `image?`
- `core_revision`
- `notes_revision`
- `persons_revision`
- `travel_plan_revision`
- `offer_revision`
- `payment_documents_revision`
- assignment, referral, and notes
- commercial data such as the mutable offer, accepted commercial snapshots, and payment documents
- `pdf_personalization`
- `travel_start_day`
- `travel_end_day`
- `preferred_currency`
- `customer_language`
- `accepted_deposit_amount_cents`
- `accepted_deposit_currency`
- `accepted_deposit_reference`
- `accepted_offer_snapshot`
- `accepted_payment_terms_snapshot`
- `accepted_travel_plan_snapshot`
- `accepted_offer_artifact_ref`
- `accepted_travel_plan_artifact_ref`
- `number_of_travelers`
- `web_form_submission`
- `persons[]`
- `travel_plan`
- `offer`
- `generated_offers[]`
- `created_at`
- `updated_at`

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
- `photo_ref`
- `gender?`
- `emails[]`
- `phone_numbers[]`
- `preferred_language`
- `food_preferences[]`
- `allergies[]`
- `hotel_room_smoker?`
- `hotel_room_sharing_ok?`
- `date_of_birth`
- `nationality`
- `roles[]`
- `address`
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
- `holder_name?`
- `document_number`
- `document_picture_ref`
- `issuing_country`
- `issued_on?`
- `no_expiration_date?`
- `expires_on`
- `created_at`
- `updated_at`

## BookingTravelPlan

`BookingTravelPlan`
- `destinations[]`
- `days[]`
- `attachments[]`

Current travel-plan notes:
- day and service IDs are booking-local operational IDs
- day and service provenance can be tracked through `copied_from`
- service images can carry an optional `image_subtitle`
- a service image can also store source attribution and focal point metadata
- travel-plan PDFs can be generated independently from generated offers
- travel-plan PDFs can optionally include a `Who is traveling` section

## BookingOffer

`BookingOffer`
- `currency`
- `status`
- `offer_detail_level_internal`
- `offer_detail_level_visible`
- `payment_terms`
- `category_rules[]`
- `trip_price_internal?`
- `days_internal[]`
- `additional_items[]`
- `discounts[]`
- `totals`
- `quotation_summary`
- `total_price_cents`

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
- `day_number?`
- `quantity`
- `unit_amount_cents`
- `unit_tax_amount_cents`
- `unit_total_amount_cents`
  - unit price including tax
- `tax_rate_basis_points`
- `currency`
- `line_net_amount_cents`
- `line_tax_amount_cents`
- `line_gross_amount_cents`
- `line_total_amount_cents`

Notes:
- discounts and credits are modeled by category semantics, not by negative unit prices
- unit amounts stay non-negative
- line totals carry the sign

`totals`
- `net_amount_cents`
- `tax_amount_cents`
- `gross_amount_cents`
- `total_price_cents`
- `items_count`

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
- `pdf_frozen_at`
- `pdf_sha256`

Meaning:
- this is the frozen customer-facing commercial snapshot
- it stores the exact offer and travel plan as generated at that moment
- the PDF artifact is frozen from this snapshot at generation time

Important boundary:
- transport fields such as `pdf_url` are not part of this entity
- those belong to the API read model only

## TravelPlanTemplate

`TravelPlanTemplate`
- `id`
- `title`
- `destinations`
- `travel_plan`

Meaning:
- this is a reusable standard travel plan
- it is stored independently from bookings
- it is currently created from an existing booking travel plan
- applying a template copies its travel plan into a booking with fresh booking-local IDs

## API Read Models

`GeneratedBookingOfferReadModel`
- customer/admin-facing generated-offer response shape
- `payment_terms`
- `pdf_url`

`BookingReadModel`
- booking response shape used for list, detail, activity, and payment-document responses
- `accepted_record`
- `travel_plan_pdfs`
- translation status summaries
- generated-offer email capability flags
- generated offers projected as `GeneratedBookingOfferReadModel[]`

`TravelPlanTemplateReadModel`
- staff-facing template library shape
- mirrors the template entity for transport use

Important boundary:
- response-only fields such as `pdf_url`, `accepted_record`, and `travel_plan_pdfs` must stay in the read models
- booking persistence snapshots such as `accepted_offer_snapshot` stay on the entity side
