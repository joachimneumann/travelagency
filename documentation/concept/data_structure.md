# Data Structure (Concept)

## 1) Client anchor and customer profile

### 1.1 Client

`Client`
- `id` (string, immutable, system-generated)
- `client_type` (`customer` | `travel_group`)
- `client_hash` (string, concurrency token)

Purpose:
- stable booking-facing reference
- polymorphic anchor for one individual customer or one travel group

Invariant:
- exactly one subtype record exists for every `Client`
- if `client_type == customer`, one `Customer` exists for `Client.id`
- if `client_type == travel_group`, one `TravelGroup` exists for `Client.id`

### 1.2 Customer

`Customer`
- `client_id` (FK -> `Client.id`, required)
- `customer_hash` (string, concurrency token)
- `name` (required)
- `photo_ref` (optional)
- `title` (optional)
- `first_name` (optional)
- `last_name` (optional)
- `date_of_birth` (optional)
- `nationality` (optional, ISO-3166-1 alpha-2)
- `address_line_1` (optional)
- `address_line_2` (optional)
- `address_city` (optional)
- `address_state_region` (optional)
- `address_postal_code` (optional)
- `address_country_code` (optional, ISO-3166-1 alpha-2)
- `organization_name` (optional)
- `tax_id` (optional)
- `organization_address` (optional)
- `organization_phone_number` (optional)
- `organization_webpage` (optional)
- `organization_email` (optional)
- `phone_number` (optional)
- `email` (optional)
- `preferred_language` (optional, generated language enum)
- `preferred_currency` (optional, generated currency enum)
- `timezone` (optional, IANA timezone)
- `notes` (optional)
- `created_at` (datetime)
- `updated_at` (datetime)
- `archived_at` (datetime, optional)

### 1.3 CustomerConsent

`CustomerConsent`
- `id`
- `customer_client_id` (FK -> `Customer.client_id`)
- `consent_type` (`privacy_policy` | `marketing_email` | `marketing_whatsapp` | `profiling`)
- `status` (`granted` | `withdrawn` | `unknown`)
- `captured_via` (optional)
- `captured_at` (datetime)
- `evidence_ref` (optional)
- `updated_at`

### 1.4 CustomerDocument

`CustomerDocument`
- `id`
- `customer_client_id` (FK -> `Customer.client_id`)
- `document_type` (`passport` | `national_id` | `visa` | `other`)
- `document_number` (optional)
- `document_picture_ref` (optional)
- `issuing_country` (optional)
- `expires_on` (date, optional)
- `created_at`
- `updated_at`

Security note:
- store only encrypted `CustomerDocument` payloads and secure file references

## 2) Group travel

### 2.1 TravelGroup

`TravelGroup`
- `id`
- `client_id` (FK -> `Client.id`, required)
- `travel_group_hash` (string, concurrency token)
- `group_name` (required)
- `preferred_language` (optional)
- `preferred_currency` (optional)
- `timezone` (optional)
- `notes` (optional)
- `created_at`
- `updated_at`
- `archived_at` (optional)

### 2.2 TravelGroupMember

`TravelGroupMember`
- `id`
- `travel_group_id` (FK -> `TravelGroup.id`, required)
- `customer_client_id` (FK -> `Customer.client_id`, required)
- `is_traveling` (bool, default false)
- `member_roles` (required, array<enum>):
  - `TravelGroupContact`
  - `other`
- `notes` (optional)
- `created_at`
- `updated_at`

## 3) Booking relationship

A booking belongs to exactly one `Client`.

`Booking`
- `client_id` (FK -> `Client.id`, required)
- `booking_hash` (string, concurrency token)

Read models should also expose resolved client summary fields for convenience:
- `client_type`
- `client_display_name`
- `client_primary_phone_number`
- `client_primary_email`

## 4) Constraints and invariants

- A `Client` is either `customer` or `travel_group`.
- A `Customer` cannot exist without a matching `Client`.
- A `TravelGroup` cannot exist without a matching `Client`.
- A `TravelGroup` has one or more `TravelGroupMember` rows.
- Each `TravelGroup` must have at least one member with role `TravelGroupContact`.
- `TravelGroupMember.customer_client_id` must reference an existing `Customer`.
- Unknown traveler flow:
  - create a minimal `Customer` first, then attach it to a `TravelGroup`.
- False merges are worse than duplicates:
  - exact normalized phone/email may reuse an existing customer
  - fuzzy matches should create duplicate-review candidates, not silent merges

## 5) Search indexing recommendations

Include these fields in booking/customer search:
- booking id
- client display name
- customer name
- phone number
- email
- travel group name
- destination
- style
- notes
