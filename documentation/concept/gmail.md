# Gmail Draft Integration

## Goal

Create a Gmail draft from the ATP backend so ATP staff can:
- click `email` in the booking offer history
- open Gmail in a separate tab
- review and edit the message
- send it manually from `info@asiatravelplan.com`

This is intentionally a **draft creation** flow, not an automatic send flow.

It is also intentionally separate from the generated-offer confirmation flow.

Current backend booking UI distinction:
- `Email` in the generated-offers table creates a Gmail draft with the frozen PDF attachment
- generated-offer confirmation is handled separately from Gmail draft creation

## Recommended Architecture

Use:
- Google Cloud
- Gmail API
- a Google service account
- Google Workspace domain-wide delegation
- impersonation of the shared mailbox `info@asiatravelplan.com`

Why this approach:
- one shared mailbox identity
- no local mail app dependency
- ATP staff can still edit the draft before sending
- HTML email and PDF attachment are both possible

## High-Level Flow

1. ATP staff clicks `email` in `booking.html`.
2. Backend loads the generated offer PDF for that booking.
3. Backend authenticates to Gmail API using a service account.
4. Backend impersonates `info@asiatravelplan.com`.
5. Backend creates a Gmail draft with:
   - recipient
   - subject
   - HTML body
   - PDF attachment
6. Frontend opens Gmail Drafts in a separate browser tab.
7. ATP staff opens the new draft from Gmail Drafts, edits it, and clicks `Send`.

## Google Cloud Setup

### 1. Create a Google Cloud project

Create or select a dedicated project, for example:
- `asiatravelplan-gmail-drafts`

The organization already exists through Google Workspace, so only the project is required.

### 2. Enable Gmail API

Enable:
- Gmail API

Official reference:
- [Gmail API overview](https://developers.google.com/workspace/gmail/api/guides)

### 3. Create a service account

Create a service account, for example:
- `asiatravelplan-gmail-drafts`

This service account is used only by the backend.

### 4. Enable domain-wide delegation

On the service account, enable:
- Google Workspace domain-wide delegation

This exposes the service account client ID that Google Workspace will later authorize.

Official reference:
- [Using OAuth 2.0 for server-to-server applications](https://developers.google.com/identity/protocols/oauth2/service-account)

### 5. Allow service account key creation if blocked

Some organizations enforce this legacy or managed policy:
- `iam.disableServiceAccountKeyCreation`
- `iam.managed.disableServiceAccountKeyCreation`

If JSON key creation is blocked, temporarily override the project policy so key creation is **not enforced** for the Gmail draft project.

Important:
- the legacy constraint may still be the real blocker even when the managed one is not enforced
- both can be evaluated concurrently

After the override is active, create a JSON key for the service account.

Official references:
- [Create and delete service account keys](https://cloud.google.com/iam/docs/keys-create-delete)
- [Troubleshoot organization policy errors for service accounts](https://cloud.google.com/iam/docs/troubleshoot-org-policies)

### 6. Download the JSON key

Create a JSON key for the service account and store it securely outside the repository.

Recommended local path:
- `/Users/internal_admin/.config/asiatravelplan/gmail-service-account.json`

Never commit this file to git.

## Google Workspace Setup

### 1. Open Google Workspace Admin

Use:
- [Google Workspace Admin Console](https://admin.google.com/)

### 2. Authorize the service account for domain-wide delegation

Go to:
- `Security`
- `Access and data control`
- `API controls`
- `Domain-wide delegation`

Add the service account client ID and authorize this scope:

- `https://www.googleapis.com/auth/gmail.compose`

This scope is sufficient for draft creation.

If later the backend should send emails directly, also authorize:
- `https://www.googleapis.com/auth/gmail.send`

But for the current design, `gmail.compose` is enough.

Official reference:
- [Control API access with domain-wide delegation](https://support.google.com/a/answer/162106)

## Mailbox Strategy

Use one shared mailbox:
- `Asia Travel Plan <info@asiatravelplan.com>`

The backend impersonates this mailbox when it creates drafts.

This keeps the sender identity stable and avoids per-staff mailbox setup.

## Backend Configuration

Set these environment variables:

```bash
GOOGLE_SERVICE_ACCOUNT_JSON_PATH=/absolute/path/to/gmail-service-account.json
GOOGLE_IMPERSONATED_EMAIL=info@asiatravelplan.com
```

Recommended:
- keep the JSON key outside the repo
- load these values from shell startup or deployment secrets

For local development, if values are stored in `~/.zshrc`, backend startup should source it before launch.

## Draft Content

The Gmail draft should contain:
- recipient from the resolved booking contact email
- clear subject line
- branded HTML body
- attached generated offer PDF

Suggested subject:
- `Your Asia Travel Plan offer`

Suggested body content:
- short greeting
- brief introduction that this is the current offer
- a note that the customer can reply with changes or approval
- signature:
  - `The Asia Travel Plan Team`

## Booking Workflow

### Offer generation

The generated offer PDF is still created from the frozen generated-offer snapshot in the booking.

That means:
- the PDF is immutable once generated
- the Gmail draft always uses the frozen artifact, not a re-rendered historical PDF
- later edits to the draft offer do not change already generated PDFs
- booking confirmation records can reference the same frozen PDF hash

### Booking confirmation relationship

Generated-offer email and booking confirmation are separate workflows.

Email draft flow:
- ATP staff prepares outbound customer communication
- draft lives in Gmail
- draft creation does not by itself mark the offer as sent
- draft creation does not by itself mark the offer as accepted

Booking confirmation flow:
- new offers are intended to confirm either by deposit payment or by internal management approval
- `booking-confirmation.html` remains the token-gated public generated-offer access page
- direct public click-confirmation is no longer used
- confirmation is tied to the frozen generated-offer snapshot and frozen PDF

This separation is intentional:
- Gmail handles staff communication workflow
- the backend remains the system of record for commercial acceptance

### Email action

When ATP staff clicks `email` for a generated offer:

1. backend ensures the generated PDF exists
2. backend authenticates with Gmail API
3. backend creates a Gmail draft in `info@asiatravelplan.com`
4. backend returns the created `draft_id` and a Gmail web URL for Gmail Drafts
5. frontend opens that URL

ATP staff then:
- opens the newly created draft from Gmail Drafts
- edits the draft in Gmail
- optionally changes the text
- sends it manually

If ATP later includes a booking confirmation link in the email body, that link should point to the dedicated public generated-offer access page and tokenized confirmation flow, not to a mutable booking page.

### Generated-offer link helpers

The backend workspace keeps generated-offer communication and generated-offer confirmation as separate concerns.
The Gmail draft flow does not itself confirm the booking, and booking confirmation does not itself create a Gmail draft.

## Browser Behavior

The current implementation intentionally opens:
- `https://mail.google.com/mail/u/0/#drafts`

It does not deep-link directly into the compose editor for a specific existing draft.

Reason:
- Gmail API exposes `draft.id`
- Google does not document a stable Gmail web URL format for opening an existing draft directly in the compose editor
- earlier attempts at undocumented deep links were not reliable in practice

This keeps the integration stable even though it adds one click inside Gmail.

## Why This Is Better Than `mailto:`

`mailto:` is not sufficient because it cannot reliably provide:
- HTML body
- PDF attachment
- sender control through Google Workspace
- a Gmail draft owned by the shared mailbox

The Gmail API draft approach solves all of those.

## Security Notes

- Keep the service-account JSON file outside the repository.
- Restrict file permissions on the JSON key.
- Use the smallest required scope:
  - `gmail.compose`
- Do not use the key for unrelated Google APIs.
- If the key is exposed, rotate it immediately.

## Operational Notes

- Draft creation should be logged as a booking activity.
- Draft creation should not mark an offer as sent.
- Sending remains a manual ATP staff action in Gmail.
- If draft creation succeeds but activity logging fails afterward, the API should still return success with a warning.
- If Gmail draft creation fails, the booking UI should show a clear error and not silently fall back to `mailto:`.

## References

- [Gmail API guides](https://developers.google.com/workspace/gmail/api/guides)
- [Creating Gmail drafts](https://developers.google.com/workspace/gmail/api/guides/drafts)
- [Using OAuth 2.0 for server-to-server applications](https://developers.google.com/identity/protocols/oauth2/service-account)
- [Control API access with domain-wide delegation](https://support.google.com/a/answer/162106)
- [Create and delete service account keys](https://cloud.google.com/iam/docs/keys-create-delete)
- [Troubleshoot organization policy errors for service accounts](https://cloud.google.com/iam/docs/troubleshoot-org-policies)
