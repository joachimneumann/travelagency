# Chat Integration Research: WhatsApp, Zalo, Facebook Messenger

## 1. Goal
Build a reliable customer communication setup that links each conversation to a booking/customer record, supports staff workflows, and can grow from simple contact buttons to managed two-way operations.

## 2. Core Decision Axes
- Time to market
- Engineering complexity
- Compliance and platform policy risk
- Message reliability and observability
- Quality of staff workflow (assignment, handover, audit trail)

## 3. Channel Notes (Practical)
### WhatsApp
- Best enterprise support among the three for API-based messaging.
- Strong for two-way communication, templates, and automation.
- Requires business setup and policy-compliant messaging windows/templates.

### Facebook Messenger
- Good for customers already on Facebook/Instagram ecosystem.
- Page-based identity model; policy constraints apply to outbound messaging.
- Useful as an additional channel, usually not the only one.

### Zalo
- Important for Vietnam market.
- Usually tied to Official Account (OA) flows and platform-specific policy/rate constraints.
- Requirements differ from Meta channels and should be handled as a dedicated integration stream.

## 4. Integration Approaches
### Approach A: Link-out only (no API integration)
- Web/iOS show buttons: "Chat on WhatsApp", "Chat on Messenger", "Chat on Zalo".
- Opens native app/deep link with prefilled booking/customer context.
- Pros: fastest, lowest cost/risk.
- Cons: no central transcript, no unified reporting, no automation.

### Approach B: Direct API integrations per channel
- Backend implements each provider API + webhooks + token lifecycle.
- Store message metadata/transcripts linked to booking/customer.
- Pros: full control, no aggregator lock-in.
- Cons: highest engineering and maintenance cost; each channel differs significantly.

### Approach C: Omnichannel provider (middleware)
- Integrate backend with one provider that unifies channels.
- Provider handles channel adapters; your backend handles domain logic.
- Pros: faster than direct integrations, better operational tooling.
- Cons: recurring vendor cost and platform lock-in risk.

### Approach D: Customer support suite as source of truth
- Use a helpdesk/inbox tool for agent operations.
- Backend syncs only references/events, not full message transport.
- Pros: very fast operations setup.
- Cons: limited product-level control and deeper customization constraints.

### Approach E (Recommended): Hybrid staged model
- Phase 1: Approach A for immediate usability.
- Phase 2: Add Approach C or B for managed inbound/outbound + audit trail.
- Phase 3: Add automation (routing, SLA, reminders, summaries) from backend.

## 5. Recommended Architecture for This Project
- Keep booking/customer/staff ownership in your backend.
- Add a new `chat` integration module with:
  - `conversation` (channel, external thread id, customer id, booking id, assigned atp_staff)
  - `message_event` (direction, timestamp, sender role, delivery status, payload reference)
  - `channel_account` (credentials, token expiry, webhook status)
- Webhooks from channel/provider should enter one ingestion endpoint and be normalized before persistence.
- Outbound sends should go through one backend service API so frontend/iOS never handle channel tokens.

## 6. UX Decision: Embedded Dialog vs Quick Switch
Short answer: use **quick switch now**, add **read-only visibility** next, and defer full in-app chat composer.

### Why
- Full embedded chat across 3 channels is complex and policy-sensitive.
- Native apps (WhatsApp/Zalo/Messenger) already provide strong message UX and trust.
- Staff still needs context and traceability in your system.

### Recommended UX
- Frontend (public site):
  - Keep clear channel buttons/deep links only.
  - Do not show full message history in public frontend.
- Internal backend screen:
  - Show channel links + conversation status + latest message preview.
  - Add "Open chat" quick-action per channel.
- Internal iOS app:
  - Same pattern as backend: summary + "Open chat" actions first.
  - Add read-only timeline when webhook ingestion is ready.

## 7. Security and Compliance Requirements
- Store tokens server-side only (encrypted at rest).
- Verify webhook signatures and keep idempotency keys for events.
- Redact sensitive PII from logs.
- Implement message consent/opt-in tracking per channel.
- Add per-channel rate limiting and retry with dead-letter handling.

## 8. Suggested Implementation Plan
1. Add deep-link chat actions (WhatsApp/Zalo/Messenger) on booking/customer views.
2. Add backend data model for `conversation` and `message_event`.
3. Start with one managed channel first (WhatsApp usually best), then add Messenger, then Zalo.
4. Add webhook ingestion and read-only timeline in backend and iOS.
5. Add outbound send from backend UI/iOS only after delivery tracking is stable.

## 9. Final Recommendation
- **Product recommendation:** do not build full multi-channel in-app chat first.
- **Start with quick-switch buttons** to native chat apps.
- **Then add conversation visibility in backend and iOS** (status + latest message + read-only history).
- Move to full in-app sending only when operational metrics show clear value (SLA, conversion, workload reduction).

## 10. Concrete Implementation: Read-Only WhatsApp Integration
Goal: ingest WhatsApp messages/events into backend and show them in internal UI, without sending messages from your system yet.

### 10.1 Scope (explicitly read-only)
- In scope:
  - Receive inbound WhatsApp messages via webhook.
  - Receive delivery/read/status events.
  - Store normalized message timeline linked to customer/booking.
  - Show timeline in backend UI and iOS app as read-only.
- Out of scope:
  - Sending outbound messages from backend/iOS.
  - Bot auto-replies.
  - Template campaign sending.

### 10.2 Step-by-step rollout
1. Meta setup
- Create/prepare Meta app + WhatsApp Business Platform account.
- Register one pilot number dedicated for integration.
- Configure webhook URL and verify token.
- Subscribe to WhatsApp message/event callbacks.

2. Backend endpoints
- Add `GET /api/v1/integrations/whatsapp/webhook` for verification challenge.
- Add `POST /api/v1/integrations/whatsapp/webhook` for event ingestion.
- Enforce signature verification and reject unsigned/invalid requests.

3. Data model
- Add `chat_channel_account`:
  - `id`, `channel` (`whatsapp`), `phone_number_id`, `waba_id`, `status`.
- Add `chat_conversation`:
  - `id`, `channel`, `external_conversation_id`, `external_contact_id`, `customer_id`, `booking_id`, `assigned_atp_staff_id`, `last_event_at`.
- Add `chat_message_event`:
  - `id`, `conversation_id`, `direction` (`inbound`/`outbound`), `external_message_id`, `event_type` (`message`,`delivered`,`read`,`failed`), `sent_at`, `payload_json`, `text_preview`.
- Add unique constraints for idempotency on external ids.

4. Normalization pipeline
- Parse webhook payload into canonical internal shape.
- Resolve sender phone (`wa_id`) to customer by normalized phone number.
- If customer match is ambiguous, mark as `unlinked` and place in triage queue.
- Never drop raw payload: keep raw JSON for audits/debug.

5. UI integration (internal only)
- Backend booking page:
  - Add read-only "WhatsApp" section with timeline and statuses.
  - Add "Open in WhatsApp" deep-link button.
- iOS booking detail:
  - Add read-only WhatsApp timeline screen.
  - Add quick action to open WhatsApp conversation.

6. Access control
- Reuse booking visibility rules (`atp_staff`, `atp_manager`, `atp_admin`, `atp_accountant`) for chat timeline access.
- Editing/sending remains disabled in this phase.

7. Monitoring and operations
- Add metrics: webhook receive rate, parse failures, signature failures, unlinked-contact count.
- Add dead-letter storage for failed webhook parses.
- Add replay tool for failed events from dead-letter queue.

8. Production hardening gate
- Run pilot with one internal number + small set of customers.
- Require 7+ days stable ingestion before adding outbound features.

## 11. Practical Questions
### 11.1 Can I test with my private phone number and later switch to company number?
Yes, technically you can pilot with a private number and later switch, but the recommended path is:
- Use a dedicated pilot business number first.
- Keep your personal number out of production data and ownership flows.
- Then onboard the final company number and keep the same backend model (`channel_account` swap, no architecture change).

Important operational note (as of March 3, 2026):
- Number eligibility and coexistence behavior are controlled by current Meta policy and country availability.
- Confirm current restrictions in Meta docs during onboarding before locking the rollout.

### 11.2 Should I install WhatsApp Business or can I use normal WhatsApp?
Recommendation:
- Use **WhatsApp Business app** for business onboarding and coexistence scenarios.
- Do not use normal personal WhatsApp as your integration target.
- For API-only numbers, app usage may not be required; for coexistence, WhatsApp Business app is the correct app tier.

## 12. Source Notes
Primary Meta sources were used where accessible for channel/account behavior and cross-channel inbox context:
- Meta Business Suite Inbox overview (Messenger/Instagram/WhatsApp)
- Facebook Page <-> WhatsApp account linking
- Instagram business profile linking to WhatsApp business numbers (app/API)

Developer-specific WhatsApp Platform docs can be rate-limited/unavailable from automated fetch at times; re-check exact onboarding constraints directly in current Meta developer docs during implementation.
