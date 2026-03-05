# Data Structure (Concept)

## 1) Client (Customer) Profile

### 1.1 Customer

`Customer`
- `id` (string, immutable, system-generated)
- `entity_type` (`person` | `organization`)

For persons:
- `date_of_birth` (optional, for person)
- `nationality` (optional, ISO-3166-1 alpha-2)
For organizations:
- `legal_name` (optional)

- `phone number`
- `address_line_1`
- `address_line_2`
- `address_city`, 
- `address_state_region`
- `address_postal_code`
- `address_country_code` (ISO-3166-1 alpha-2)
- `preferred_language` (optional, ISO language code)
- `preferred_currency` (from currency cue)
- `timezone` (optional, IANA timezone)
- `source` (optional, e.g. `web_form`, `manual`, `import`)
- `tags` (array<string>, optional)
- `notes` (optional)
- `can_receive_marketing` (bool, default false)
- `created_at` (datetime)
- `updated_at` (datetime)
- `archived_at` (datetime, optional)


### 1.4 CustomerConsent (compliance)
`CustomerConsent`
- `id`
- `customer_id` (FK)
- `consent_type` (`privacy_policy` | `marketing_email` | `marketing_whatsapp` | `profiling`)
- `status` (`granted` | `withdrawn` | `unknown`)
- `captured_via` (optional, e.g. `web_form`)
- `captured_at` (datetime)
- `evidence_ref` (optional)
- `updated_at`

### 1.5 CustomerDocument (optional, sensitive)
`CustomerDocument`
- `id`
- `customer_id` (FK)
- `document_type` (`passport` | `national_id` | `visa` | `other`)
- `document_number_masked` (required)
- `document picture` (optional)
- `issuing_country` (optional)
- `expires_on` (date, optional)
- `storage_ref` (optional, secure reference)
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
- `member_roles` (required, array<enum>, multiple choice):
  - `is_traveling`
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

## 4) Search indexing recommendations
Include these fields in booking/customer search:
