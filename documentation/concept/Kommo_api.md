# Kommo API Integration Concept

Date: 2026-05-10

## Purpose

This document describes how AsiaTravelPlan bookings can be integrated with Kommo CRM, and where staff should spend their time.

The main recommendation is:

- Kommo should be the front-office cockpit for leads, communication, task follow-up, sales stages, and management visibility.
- `booking.html` should remain the back-office production system for ATP-specific booking work: travel plans, travelers, offers, pricing, PDFs, payment documents, translations, and internal booking operations.

Do not try to rebuild the full ATP booking workspace inside Kommo. The better workflow is to let staff start in Kommo, then open the ATP booking only when they need specialist booking tools.

## Big Picture Workflow

Staff should spend most day-to-day time in Kommo when they are:

- triaging new inquiries
- replying on phone, email, or other CRM channels
- assigning owners
- moving leads through a sales pipeline
- tracking follow-up tasks
- reviewing pipeline/reporting views

Staff should open `booking.html` when they need to:

- build or edit the travel plan
- manage travelers and travel documents
- prepare offers, pricing, payment terms, and PDFs
- update ATP internal notes and booking-specific data
- handle post-sale operational work

In short:

- Kommo is the sales and communication layer.
- ATP booking is the booking and operations layer.

## Recommended Integration Types

## 1. Create or update a Kommo lead from every ATP booking

When a booking is created from the website or manually in ATP, create a matching Kommo lead and contact.

Useful Kommo APIs:

- [Add leads](https://developers.kommo.com/reference/adding-leads)
- [Complex addition of leads with contact and company](https://developers.kommo.com/reference/complex-leads)
- [Contacts list](https://developers.kommo.com/reference/contacts-list)
- [Add contacts](https://developers.kommo.com/reference/add-contacts)

Recommended ATP fields to store after sync:

- `kommo_lead_id`
- `kommo_contact_id`
- `kommo_pipeline_id`
- `kommo_status_id`
- `kommo_last_synced_at`
- `kommo_sync_error`

The Kommo lead should include a custom field with a direct ATP booking link:

- `ATP Booking URL`

This lets staff work from Kommo and jump into `booking.html` only when needed.

## 2. Map ATP booking metadata into Kommo custom fields

Kommo supports custom fields for leads, contacts, companies, and lists. Field values are passed with `custom_fields_values`.

Useful Kommo API:

- [Custom fields and field groups](https://developers.kommo.com/reference/custom-fields/)

Recommended Kommo lead custom fields:

- ATP booking ID
- ATP booking URL
- customer language
- source channel
- referral kind / referral label
- destination countries
- travel style
- travel month
- travel start day
- travel end day
- number of travelers
- preferred currency
- budget lower / upper
- offer total
- offer status
- deposit/payment status
- UTM source
- UTM medium
- UTM campaign
- last ATP update timestamp

Recommended Kommo contact fields:

- name
- email
- phone
- preferred language
- country or nationality if appropriate

Do not push sensitive traveler document details into Kommo by default. Passport numbers, ID images, allergies, consents, and detailed traveler records should stay in ATP unless there is a strong operational reason to expose them in CRM.

## 3. Use Kommo tasks for staff follow-up

Kommo tasks are useful for reminders and accountability. ATP should create tasks when there is a clear staff action.

Useful Kommo API:

- [Add tasks](https://developers.kommo.com/reference/add-tasks)

Task examples:

- New inquiry: reply within 15 minutes
- Follow up after proposal sent
- Deposit not received after 48 hours
- Traveler details missing
- Passport or ID document missing
- Passport expires soon
- Confirm hotel availability
- Confirm guide or transfer supplier
- Check payment document before sending

Task ownership should follow the Kommo lead owner where possible.

## 4. Write important ATP events into Kommo notes

Kommo notes should show key ATP-side events inside the lead card, so staff do not have to open ATP just to understand recent progress.

Useful Kommo API:

- [Add notes](https://developers.kommo.com/reference/add-notes)

Good note events:

- Booking created in ATP
- Offer generated
- Offer sent to customer
- Travel plan PDF generated
- Traveler details link created
- Traveler submitted details
- Payment document created
- Deposit marked received
- Booking assigned/reassigned
- Booking cancelled or cloned

Keep notes short and decision-oriented. Link back to ATP for full detail.

## 5. Use Kommo pipeline stages for sales status

Kommo should own the sales pipeline. ATP should not try to duplicate every sales state separately.

Useful Kommo APIs:

- [Pipelines list](https://developers.kommo.com/reference/pipelines-list)
- [Update leads](https://developers.kommo.com/reference/updating-leads)

Suggested sales pipeline:

- New inquiry
- Contacted
- Qualifying
- Proposal in progress
- Proposal sent
- Negotiating / revising
- Deposit requested
- Won / deposit received
- Lost

ATP should own operational state:

- travel plan completeness
- offer/pricing data
- payment terms
- traveler data completeness
- generated PDFs
- payment documents
- booking revisions

This boundary matters. It prevents staff from wondering which system has the "real" state.

## 6. Use Kommo webhooks for inbound sync

Kommo webhooks can notify ATP when CRM-side events happen.

Useful Kommo docs:

- [Webhooks](https://developers.kommo.com/docs/webhooks-general)

Useful inbound events:

- lead stage changed
- lead responsible user changed
- contact edited
- task added or completed
- note added
- incoming message received

Important implementation note:

- Kommo expects webhook responses quickly, so ATP should acknowledge the webhook immediately and process sync asynchronously.
- Webhook processing should be idempotent.
- Store the external Kommo event identifiers where available.

## 7. Decide who owns phone and customer communication

This is the most important product decision.

The ATP codebase already has removed messaging webhook storage and a booking chat view. Kommo is also designed around CRM communication and phone workflows.

Recommendation:

- Kommo should own active phone/email customer communication.
- ATP should show a summary, recent activity, or a link back to the Kommo lead.
- Avoid asking staff to reply from both Kommo and ATP.

Reason:

- One active inbox is easier for staff.
- Kommo can tie communication directly to lead stage, tasks, owner, and automation.
- ATP can remain focused on booking production instead of becoming a second CRM inbox.

## 8. Optional Kommo widget

If staff spend most of their time in Kommo, a lightweight Kommo widget can reduce context switching.

Useful Kommo docs:

- [Kommo for developers](https://developers.kommo.com/docs/kommo-for-developers)

Recommended widget scope:

- show ATP booking summary
- show booking status and offer status
- show traveler completeness
- show latest ATP activity
- show direct `Open ATP booking` action
- copy traveler details link
- possibly trigger simple ATP actions later

Do not put the full travel-plan editor, offer editor, document manager, or pricing workspace inside the widget.

## Optional: Incoming leads and sources

Kommo also supports incoming leads and sources.

Useful Kommo APIs:

- [Add incoming leads from form](https://developers.kommo.com/reference/incoming-leads-form)
- [Incoming leads list](https://developers.kommo.com/reference/incoming-leads-list)
- [Get sources](https://developers.kommo.com/reference/get-sources)
- [Add sources](https://developers.kommo.com/reference/add-sources)

This can be useful if ATP wants Kommo to behave like an inquiry inbox where staff accept or reject incoming leads.

For ATP, direct lead creation is probably simpler at first:

- Website form creates ATP booking.
- ATP creates or updates Kommo lead/contact.
- Staff triage the lead in Kommo.

Incoming leads can be considered later if Kommo's native lead inbox becomes important to the team's process.

## Data Ownership

Use a clear source-of-truth model.

Kommo owns:

- sales stage
- lead owner / responsible user
- communication status
- follow-up tasks
- pipeline reporting
- contact-level CRM history

ATP owns:

- booking ID and booking record
- traveler details
- travel plan
- offer/pricing
- payment terms
- generated PDFs
- payment documents
- translation state
- booking revision history

Shared/synced:

- primary contact name
- email
- phone
- customer language
- travel dates
- destination summary
- traveler count
- source/referral/UTM
- offer status and total
- high-level payment status

## Phased Implementation

## Phase 1: ATP to Kommo one-way sync

Build the minimum useful integration:

- create Kommo lead/contact when ATP booking is created
- update Kommo custom fields when important ATP fields change
- add ATP booking link to Kommo
- create initial follow-up task
- write basic ATP events as Kommo notes

This gives staff immediate value without two-way sync complexity.

## Phase 2: Kommo to ATP webhook sync

Add inbound sync:

- lead stage changed
- owner changed
- contact phone/email changed
- task completed
- note added if needed

ATP should record these in its activity timeline where useful.

## Phase 3: Communication consolidation

Choose Kommo as the main customer communication workspace.

ATP should:

- link to the Kommo lead
- show recent communication summary if useful
- avoid becoming a second active reply interface

## Phase 4: Kommo widget

Build a lightweight widget only after staff workflow is stable.

The widget should make Kommo more useful, not duplicate `booking.html`.

## Implementation Notes

Configuration needed:

- Kommo subdomain
- long-lived token or OAuth configuration
- default pipeline ID
- default status ID
- mapping of ATP staff users to Kommo user IDs
- mapping of ATP fields to Kommo custom field IDs
- webhook signing/validation strategy if available

Reliability requirements:

- idempotent lead creation
- retry queue for Kommo API failures
- rate limiting for Kommo API calls
- sync error visibility in ATP
- audit trail for external sync actions

Security requirements:

- keep Kommo credentials server-side only
- never expose Kommo tokens in frontend JavaScript
- do not sync sensitive traveler document fields by default
- log enough to debug sync, but avoid logging secrets or passport/ID values

## Recommended Decision

Use Kommo as the staff-facing CRM and communication cockpit.

Use ATP booking as the operational source of truth.

The ideal staff flow is:

1. New inquiry appears in Kommo.
2. Staff replies and qualifies in Kommo.
3. Staff clicks `Open ATP booking` when they need to build the itinerary, offer, traveler data, or payment document.
4. ATP pushes key progress back to Kommo as fields, notes, tasks, and stage changes.
5. Managers use Kommo for pipeline visibility and ATP for operational detail.

