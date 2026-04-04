# Data Structure (Current Concept)

## Core Decision

AsiaTravelPlan uses a booking-owned operational data model.

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
- `offer_component_links[]`
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
- `components[]`
- `totals`
- `quotation_summary`
- `pdf_personalization`

The offer model separates:
- internal arithmetic totals
- customer-facing quotation totals

`components[]`
- `category`
- `label`
- `details`
- `quantity`
- `unit_amount_cents`
  - unit price before tax
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
- `customer_confirmation_flow?`
- `booking_confirmation_token_nonce?`
- `booking_confirmation_token_created_at?`
- `booking_confirmation_token_expires_at?`
- `booking_confirmation_token_revoked_at?`
- `booking_confirmation?`

Meaning:
- this is the frozen customer-facing commercial snapshot
- it stores the exact offer and travel plan as generated at that moment
- the PDF artifact is frozen from this snapshot at generation time
- the generated offer can optionally freeze who may later approve it internally

Important boundary:
- transport fields such as `pdf_url` and `public_booking_confirmation_token` are not part of this entity
- those belong to the API read model only

## GeneratedOfferCustomerConfirmationFlow

`GeneratedOfferCustomerConfirmationFlow`
- `mode`
- `status`
- `selected_at?`
- `selected_by_atp_staff_id?`
- `expires_at?`
- `customer_message_snapshot?`
- `deposit_rule?`

Meaning:
- this is customer-facing confirmation setup attached to a generated offer
- it is not itself the final confirmation evidence record

For new data, the intended mode is:
- `DEPOSIT_PAYMENT`

`deposit_rule`
- `payment_term_line_id`
- `payment_term_label`
- `required_amount_cents`
- `currency`
- `aggregation_mode`

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
- `public_booking_confirmation_token`
- `public_booking_confirmation_expires_at`
- `customer_confirmation_flow`
- `booking_confirmation`

`BookingReadModel`
- booking response shape used for list, detail, activity, and invoice responses
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

