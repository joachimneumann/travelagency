# Chat Integration Research

## Goal

Build a reliable communication setup that links each conversation to a booking and its booking persons, supports ATP staff workflows, and can grow from quick-switch chat actions to managed two-way operations.

## Current Model Assumption

The active ownership model is:
- booking
- booking persons
- ATP staff

Chat linkage should therefore use:
- `booking_id`
- booking-person phone numbers and emails for contact matching
- assigned ATP staff from the booking

Do not introduce a separate customer record as the messaging anchor.

## Recommended Integration Path

### Phase 1: Quick switch

- Show WhatsApp, Messenger, and Zalo actions from booking views.
- Open the native app with booking context.
- No in-app sending yet.

### Phase 2: Read-only timeline

- Ingest webhook events.
- Normalize them into conversations and message events.
- Match inbound contacts against booking-person contact data.
- Show a read-only conversation timeline on `booking.html`.

### Phase 3: Managed outbound messaging

- Add backend-mediated sending only after inbound matching and delivery tracking are stable.

## Suggested Internal Model

`conversation`
- `channel`
- `external_thread_id`
- `external_contact_id`
- `booking_id`
- `assigned_atp_staff_id`
- `last_event_at`

`message_event`
- `conversation_id`
- `direction`
- `event_type`
- `sent_at`
- `payload_json`
- `text_preview`

## Matching Rule

- normalize sender phone/email
- attempt match against booking-person contact data
- if exactly one booking matches, attach conversation to that booking
- if ambiguous, mark as unlinked for manual triage

## Current Recommendation

- keep quick-switch links
- keep read-only chat visibility in the booking page
- keep booking/person matching in the backend
- avoid building a separate messaging-specific customer domain
