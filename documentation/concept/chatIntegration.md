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
- attach each conversation to one canonical booking only
- prefer the already assigned booking if one exists
- otherwise choose the most relevant current booking by backend matching rules
- do not duplicate the same conversation into multiple bookings
- if the same traveler appears in other bookings, expose those as related bookings, not duplicate chat threads
- if matching stays ambiguous and no canonical booking can be chosen safely, keep the conversation unlinked for manual triage

## Current Recommendation

- keep quick-switch links
- keep read-only chat visibility in the booking page
- keep booking/person matching in the backend
- avoid building a separate messaging-specific customer domain

## Booking Page User Interface

The booking page should no longer assume that one booking has only one WhatsApp conversation. A booking can have:
- a conversation with the primary contact
- separate conversations with one or more travelers
- unknown phone numbers that are likely related to the booking but are not yet assigned to a person

The UI should therefore use a booking-scoped conversations model instead of a single booking chat.

### Main Pattern

Reproduce a simple WhatsApp-like interface inside `booking.html`:

1. Conversation list screen
   - show one row per booking person on the booking, even if no chat exists yet
   - each row should show:
     - avatar or initials
     - person name if known
     - role summary such as `Primary contact`, `Traveler`, `Traveler, Payer`
   - if a WhatsApp conversation exists for that person, also show:
     - phone number
     - last message preview
     - time of last message
     - unread message count
   - if no WhatsApp conversation exists yet for that person, show only the person identity row and no message preview

2. Conversation detail screen
   - when ATP staff click a conversation, animate to the right into the message thread
   - hide the conversation list while the thread is open
   - show a back button at the top to return to the list
   - the thread header should show:
     - avatar or initials
     - person name or `Unknown number`
     - phone number
     - optional role line
     - optional `Also in ...` links to other bookings with the same traveler/contact

This is preferable to showing all traveler messages in one combined stream by default.

### List Behavior

- sort conversations by:
  - latest chat message first
- persons without any chat should appear after persons with chat activity
- show unread badges clearly
- keep the list booking-scoped
- preserve read/unread state when ATP staff open a conversation and go back

### Identity Rules In The UI

- if a conversation is linked to a booking person, show that person
- if a conversation cannot be linked confidently, show:
  - `Unknown number`
  - the phone number
  - later optionally: `Assign to person`

- group conversations primarily by phone number, then enrich with person identity if known
- do not assume that all incoming numbers belong to the primary contact
- when the same phone number matches more than one booking, keep one canonical booking owner and show the others as related context only

### Timeline Views

Recommended default:
- `Conversations` view only

Optional later enhancement:
- `All messages` chronological view across all conversations in the booking

If `All messages` is added later, every message row must show which person or phone number it came from.

### Responsive Behavior

Start with a simple two-state interface:
- `conversation_list`
- `active_conversation`

Recommended interaction:
- on open, animate the selected conversation in from the right
- on back, animate back to the list

This pattern works well on mobile and narrow desktop widths, and can later be upgraded to a split view on wide screens if needed.
