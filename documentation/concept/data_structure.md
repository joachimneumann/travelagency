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
- `booking_hash`
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

## Invariants

- `booking.persons[]` is the editable person source of truth for that booking
- `web_form_submission` remains the original inbound snapshot
- one booking may list fewer or more persons than `number_of_travelers`
- UI may warn when those counts differ, but the model allows it
- a booking should usually have one `primary_contact`

## Why This Shape

Advantages:
- simpler data structure
- easier permission separation for ATP staff
- no cross-booking write conflicts
- inbound web form already matches the booking shape

Tradeoff:
- duplicates across bookings are allowed by design
