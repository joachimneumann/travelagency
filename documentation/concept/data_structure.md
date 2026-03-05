# Data Structure (Concept)

## 1) Client (Customer) Profile

### 1.1 Customer

`Customer`
- `id` (string, immutable, system-generated)
- `display_name` (required)

- `first_name` (optional)
- `last_name` (optional)
- `date_of_birth` (optional)
- `nationality` (optional, ISO-3166-1 alpha-2)
- `organization_name` (optional)
- `tax_id` (optional)
- `organization_address` (optional)
- `organization_phone_number` (optional)
- `organization_webpage` (optional)
- `organization_email` (optional)

- `phone_number` (optional)
- `email` (optional)
- `address_line_1` (optional)
- `address_line_2` (optional)
- `address_city` (optional) 
- `address_state_region` (optional)
- `address_postal_code` (optional)
- `address_country_code` (optional, ISO-3166-1 alpha-2)
- `preferred_language` (optional, ISO language code)
- `preferred_currency` (optional, from currency cue)
- `timezone` (optional, IANA timezone)
- `tags` (array<string>, optional)
- `notes` (optional)
- `can_receive_marketing` (bool, default false)
- `created_at` (datetime)
- `updated_at` (datetime)
- `archived_at` (datetime, optional)

### 1.2 CustomerConsent (compliance)
`CustomerConsent`
- `id`
- `customer_id` (FK)
- `consent_type` (`privacy_policy` | `marketing_email` | `marketing_whatsapp` | `profiling`)
- `status` (`granted` | `withdrawn` | `unknown`)
- `captured_via` (optional, e.g. `web_form`)
- `captured_at` (datetime)
- `evidence_ref` (optional)
- `updated_at`

### 1.3 CustomerDocument (optional)
`CustomerDocument`
- `id`
- `customer_id` (FK)
- `document_type` (`passport` | `national_id` | `visa` | `other`)
- `document_number` (optional)
- `document_picture_ref` (optional, secure reference to uploaded document photo or scan)
- `issuing_country` (optional)
- `expires_on` (date, optional)
- `created_at`
- `updated_at`

Security note:
- Store only encrypted CustomerDocuments.

## 2) Group Travel

### 2.1 TravelGroup
`TravelGroup`
- `id`
- `booking_id` (FK -> Booking)
- `name` (optional)
- `group_type` (`family` | `friends` | `corporate` | `school` | `other`)
- `notes` (optional)
- `created_at`
- `updated_at`

### 2.2 TravelGroupMember
`TravelGroupMember`
- `id`
- `travel_group_id` (FK -> `TravelGroup.id`)
- `customer_id` (FK -> `Customer.id`, required)
- `is_traveling` (bool, default false)
- `member_roles` (required, array<enum>, multiple choice):
  - `TravelGroupContact`
  - `decision_maker`
  - `payer`
  - `assistant`
  - `other`
- `notes`
- `created_at`
- `updated_at`

## 3) Constraints and invariants

- A booking has zero or one `TravelGroup`.
- A `TravelGroup` has one or more `TravelGroupMember`.
- Multiple primary contacts are represented by multiple members carrying the `TravelGroupContact` role.
- `Customer.dedup_fingerprint` is unique per active customer record and must be recomputed on customer creation/update.
- `TravelGroupMember.customer_id` must always reference an existing `Customer`.
- Unknown traveler flow:
  - When traveler identity is unknown, create a minimal `Customer` first (at least `display_name` and one contact field) before creating `TravelGroupMember`.
- Each `TravelGroup` must have at least one `TravelGroupMember` with role `TravelGroupContact`.

## 4) Search indexing recommendations
Include these fields in booking/customer search:
