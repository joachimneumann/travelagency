# Traveler Page Concept

## Goal

Allow each traveler to fill in and update their own travel information without requiring a username/password account.

The access pattern should work from:
- WhatsApp
- email

The traveler must only be able to access their own traveler page.

This concept explicitly does not allow:
- a coordinator link that edits all travelers
- a single booking-wide traveler link shared across all travelers

## Recommended Access Model

Use:
- one magic link per traveler
- one-time verification code on top of the magic link

Each traveler receives their own link. That link opens a traveler-specific page for exactly one person record in exactly one booking.

Access is therefore scoped to:
- `booking_id`
- `person_id`
- a narrow set of traveler-facing permissions

The link must not grant access to:
- other travelers in the same booking
- any other booking
- ATP staff-only data

## Why This Model

This is the best tradeoff between usability and security.

It keeps the process simple enough for real travelers:
- no account creation
- no remembered password
- works directly from WhatsApp or email

It also avoids the largest privacy and conflict risks:
- no booking-wide shared link
- no traveler seeing other travelers' data
- no concurrent editing of one shared multi-person page

## User Flow

### Invitation

ATP staff sends an invitation to one traveler through WhatsApp or email.

The message contains:
- a short explanation
- the traveler-specific magic link
- a note that a one-time verification code will be required

### Open Link

When the traveler opens the link:
- the backend validates the magic link token
- the traveler is not logged in yet
- the system asks for one-time verification code entry

### Verification Code

The one-time verification code should be delivered through the same verified channel as the invitation, or through a second verified channel if available.

Recommended rule:
- email invitation -> verification code to the same email address
- WhatsApp invitation -> verification code to the same phone number if the provider supports it reliably
- if both email and phone exist, prefer the channel with stronger delivery reliability and clearer ownership

After successful verification:
- create a short-lived traveler session
- remove the raw token from the browser URL
- redirect to the traveler page

### Edit Session

The traveler may then:
- view their own traveler-facing fields
- update their own traveler-facing fields
- upload their own permitted files or photo if this feature is enabled

The traveler may not:
- view booking notes
- view pricing
- view invoices
- view activities
- view ATP staff assignment details
- see any other traveler record

## Data Scope

The traveler page should expose a dedicated traveler DTO, not the full booking payload.

Allowed fields can include:
- full name
- date of birth
- nationality
- preferred language
- email addresses
- phone numbers
- passport details
- national ID details if relevant
- address
- traveler notes intended for operational travel data

Excluded fields should include:
- booking internal notes
- internal workflow state
- offer and pricing
- payment state
- invoice data
- internal activity log
- chat history
- ATP staff internal identifiers
- other travelers' names, contacts, or document data

## Security Requirements

The security model must assume that:
- links can be forwarded
- email inboxes can be shared
- phones can be borrowed
- users can reopen old messages later
- travelers may use public or hotel Wi-Fi

The system should therefore treat the magic link as only the first factor, not the full authentication mechanism.

## Authentication Terminology

Use these terms consistently:
- `magic link token`: the long random invitation token sent in the URL
- `one-time verification code`: the short code entered by the traveler after opening the link
- `traveler session`: the authenticated browser session created after successful verification

Keep this distinct from the generated-booking confirmation flow:
- `booking confirmation token`: capability token scoped to one frozen generated offer
- `booking confirmation record`: immutable commercial acceptance evidence

Do not call the week-long invitation token a booking confirmation token.

Do not reuse traveler invitation tokens or traveler sessions for booking confirmation.
These are different scopes with different data access:
- traveler page -> traveler data for one booking person
- booking confirmation -> one frozen generated offer and its PDF

### 1. Token design

The magic link token must:
- be generated with cryptographically secure randomness
- contain at least 128 bits of entropy, preferably 192 bits or more
- be single-purpose
- be bound to one traveler record

The magic link token lifecycle should be:
- valid for up to 1 week before first successful use
- after first successful verification, no longer treated as a one-time code
- used only to establish or resume a traveler session according to server-side rules

The token should map server-side to:
- `booking_id`
- `person_id`
- allowed actions
- issued time
- expiry time
- invitation channel
- token status

Do not store the raw token in persistent storage.

Store only:
- a strong hash of the token
- metadata needed for validation and revocation

Recommended approach:
- generate a random token
- hash it with SHA-256 or better before storing
- compare incoming token hashes in constant time

### 2. One-time verification code as second factor

The one-time verification code is mandatory for first access. The magic link alone is not enough.

Verification code requirements:
- 6 to 8 digits
- random, not derived from the token
- short expiry, recommended 5 to 10 minutes
- maximum attempt count, recommended 5 attempts
- resend throttling, recommended at least 30 to 60 seconds between sends

After too many failed verification attempts:
- invalidate the verification code
- temporarily lock further verification for that invitation
- require a new code issuance

For high sensitivity flows, after repeated failures:
- revoke the magic link entirely
- require ATP staff to issue a fresh invitation

### 3. Session handling

After successful first verification, the system should create a traveler session.

The traveler session should:
- be separate from ATP staff auth
- be scoped to one traveler only
- have a fixed lifetime of 3 hours from first successful verification
- be reusable within those 3 hours without requiring a new verification code

The corresponding magic link behavior should be:
- before first successful verification, the invitation can be opened for up to 1 week
- at first successful verification, a 3-hour traveler access window starts
- during those 3 hours, the traveler may reopen the same link and continue using the traveler page
- after those 3 hours, the invitation must no longer grant access without a fresh invitation or re-verification flow, depending on product policy

The session cookie should be:
- `HttpOnly`
- `Secure`
- `SameSite=Lax` or `SameSite=Strict` unless a cross-site flow requires otherwise

Do not keep the magic token in:
- localStorage
- sessionStorage
- JavaScript-readable cookies

After token exchange:
- remove the token query parameter from the URL with a redirect or history replacement
- prevent it from appearing in screenshots, copied URLs, and browser history going forward

### 4. Scope enforcement

Every traveler-facing API request must authorize against the traveler session, not only against a URL parameter.

The backend must validate on every request:
- session is valid
- session is not expired
- session is bound to the requested `booking_id`
- session is bound to the requested `person_id`
- requested operation is in the allowed action set

Never accept client-provided `person_id` or `booking_id` as sufficient proof of access.

Never return the full booking object to the traveler page.

### 5. Single-traveler isolation

The traveler page must be fully isolated per person.

That means:
- one traveler cannot list other persons in the booking
- one traveler cannot navigate to another `person_id`
- one traveler cannot infer how many travelers exist in the booking
- one traveler cannot retrieve another person's photo, file, or document preview

If the system later supports file uploads, those files must be protected resources.

Do not expose sensitive uploads through world-readable static URLs.

For protected files use one of:
- authenticated file endpoints checked against the traveler session
- short-lived signed URLs generated per request

### 6. Replay and forwarding protection

Because links may be forwarded, the system should limit replay.

Recommended controls:
- after first successful verification, move the invitation into an `active_session_window` state instead of leaving it indefinitely reusable
- allow reuse only within the 3-hour traveler session window
- once the 3-hour window expires, reject further access from that link unless a new invitation or explicit re-verification flow is issued
- rotate the session on re-verification
- allow ATP staff to revoke outstanding invitations manually

Useful risk signals include:
- new IP region
- new device or browser fingerprint at a coarse level
- repeated failed verification-code attempts
- suspiciously fast token reuse

Do not rely heavily on fingerprinting for identity, but it can be used as a weak risk signal for step-up checks.

### 7. Rate limiting and abuse controls

Apply rate limits at several levels:
- token validation endpoint
- verification-code verify endpoint
- verification-code resend endpoint
- traveler page read endpoint
- traveler page update endpoint

Rate limits should combine:
- IP-based throttling
- token-based throttling
- invitation-based throttling

Suspicious patterns should trigger:
- temporary slowdown
- generic error responses
- internal logging for staff review

### 8. CSRF and browser protections

If the traveler uses a cookie-based session, state-changing endpoints must be protected against CSRF.

Recommended options:
- `SameSite=Lax` or `Strict` cookie policy
- CSRF token on mutating requests
- reject cross-origin state-changing requests

Also set:
- strict CORS rules for traveler endpoints
- `Cache-Control: no-store` for traveler pages and traveler API responses
- `Referrer-Policy: same-origin` or stricter

The goal is to avoid leaking access details through:
- browser cache
- shared devices
- referrer headers

### 9. Logging and audit

All traveler access and mutations should be logged.

Log events should include:
- invitation created
- invitation resent
- token opened
- verification code sent
- verification code verified
- verification code failed
- session created
- traveler data updated
- invitation revoked

Audit records should capture:
- `booking_id`
- `person_id`
- timestamp
- actor type `traveler`
- invitation id or session id
- changed field names

Do not log:
- raw magic tokens
- raw verification codes
- full passport numbers
- unnecessary sensitive payloads

Sensitive fields in logs should be masked.

### 10. Revocation and recovery

ATP staff must be able to:
- revoke one traveler invitation immediately
- generate a replacement invitation
- invalidate active traveler sessions for that invitation

Revocation should be used when:
- a message was sent to the wrong contact
- a traveler reports the link was forwarded
- suspicious verification attempts are detected
- a passport or other sensitive field was exposed by mistake

### 11. Field-level sensitivity

Passport and national ID data are materially more sensitive than ordinary profile fields.

Recommended approach:
- allow basic profile fields after normal magic-link-plus-verification-code authentication
- for passport or ID fields, consider step-up re-verification if the session is old or risk signals changed

Examples of step-up triggers:
- session older than 30 minutes
- new device since verification
- multiple failed attempts before success

### 12. Concurrency and integrity

Traveler edits should not overwrite unrelated changes.

The current booking backend uses booking-level person revision handling, which is too coarse for a multi-traveler self-service flow.

Recommended change:
- add per-person revision numbers or per-person `updated_at` checks
- reject stale writes only for that traveler's own record
- return the latest traveler DTO on conflict

This avoids one traveler losing work because another traveler updated a different card.

## Recommended Backend Shape

Add traveler-specific endpoints instead of reusing ATP staff booking endpoints.

Suggested areas:
- invitation creation and revocation
- token exchange
- verification-code issuance and verification
- traveler session bootstrap
- traveler read endpoint
- traveler update endpoint
- protected traveler file access if uploads are supported

Do not reuse the current staff booking detail response as-is because it includes the full booking payload.

## Recommended UI Shape

The traveler page should feel like a focused secure form, not like the ATP staff booking page.

Recommended content:
- traveler identity header
- progress indicator for required data
- clearly grouped personal and document sections
- save state and conflict handling
- explicit privacy notice

Do not show:
- other traveler cards
- booking-wide navigation
- internal operational widgets

## Final Recommendation

Use this model:
- one traveler-specific magic link per traveler
- mandatory one-time verification code on first use
- traveler-scoped short-lived session
- traveler-specific API and DTO
- no coordinator link
- no booking-wide shared traveler link

This gives a practical passwordless workflow while keeping privacy boundaries tight and limiting the impact of link forwarding or accidental sharing.
