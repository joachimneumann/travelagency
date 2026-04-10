# Payments

## Purpose

This document defines the preferred booking-page structure and implementation plan for commercial flow, invoice PDF generation, and receipt PDF generation.

The key decision is to organize the UI around the customer and payment journey, not around internal artifact types.

Top-level sections:

- `Proposal`
- `Payments`

Inside `Proposal`, the `Payment plan` is a core subsection of the commercial offer.

`Booking confirmation` remains an important concept, but it is no longer a separate top-level section. It becomes the first milestone inside `Payments`, because in the current model booking confirmation is effectively the confirmed deposit payment.

## Core principle

The business flow is:

1. build the proposal
2. define the payment plan as part of the proposal
3. send the customer-facing offer PDF
4. confirm the booking through deposit payment
5. manage remaining payments
6. handle later changes that affect future payments

The UI should follow this order directly.

ATP staff should not need to infer the current state by reading several tables.

The page should always make two things obvious:

- where we are now
- what the next proposal or payment step is

## Why the current structure feels wrong

The current page splits one continuous business process across several separate sections:

- offer
- payment terms
- booking confirmation
- pricing / payments
- invoices

This makes staff jump between sections to answer one operational question:

- what was agreed?
- what was already confirmed?
- what is the next payment step?
- which PDF should be generated now?

## Proposed information architecture

### Staff guidance UI

Add a compact staff-facing progress layer above the main commercial sections.

This layer should summarize:

- current commercial state
- current payment state
- next recommended action
- blockers, if the next action is not yet available

### Recommended top-of-section progress bar

Add a horizontal progress tracker near the top of the booking page.

Recommended milestones:

1. `Proposal in progress`
2. `Proposal sent`
3. `Booking confirmation / Deposit pending`
4. `Deposit confirmed`
5. `Remaining payments in progress`
6. `Fully paid`

Each milestone should have one of these visual states:

- `done`
- `current`
- `blocked`
- `upcoming`

The tracker should be readable in a few seconds and should not require opening any collapsible section.

### Recommended next-step card

Below or beside the tracker, show a `Next step` card for ATP staff.

This card should include:

- current status sentence
- next recommended action
- reason if blocked
- direct shortcut button

Examples:

- `Proposal is ready to send`
- `Next: Generate and send offer PDF`
- `Deposit is still pending`
- `Next: Record deposit receipt after payment arrives`
- `Remaining balance invoice is due next`
- `Next: Create final payment invoice`

### Recommended status chips inside sections

Each major block should repeat the local state with small chips or badges.

Recommended examples:

- `Draft`
- `Sent`
- `Awaiting deposit`
- `Deposit confirmed`
- `Invoice missing`
- `Invoice sent`
- `Receipt missing`
- `Paid`

This avoids forcing staff to go back to the top tracker for every small decision.

### Deterministic state matrix

The progress tracker and `Next step` card must be derived from explicit booking data, not loose UI heuristics.

`Proposal sent` should be driven by a manual ATP staff action and persisted explicitly.

Recommended persisted fields:

- `proposal_sent_at`
- `proposal_sent_generated_offer_id`
- `proposal_sent_by_atp_staff_id` (optional)

Recommended tracker rules:

| Milestone | Current when | Done when | Blocked when | Next step |
| --- | --- | --- | --- | --- |
| `Proposal in progress` | `proposal_sent_at` is empty | `proposal_sent_at` exists | no usable generated offer PDF exists | generate offer PDF or mark proposal as sent |
| `Proposal sent` | never the active step for long; it becomes complete immediately after the manual send flag is set | `proposal_sent_at` exists | not applicable | wait for deposit or issue revised proposal |
| `Booking confirmation / Deposit pending` | `proposal_sent_at` exists and `deposit_received_at` is empty | `deposit_received_at` exists | deposit term missing, deposit amount invalid, or deposit receipt inputs incomplete | record deposit receipt |
| `Deposit confirmed` | `deposit_received_at` exists and at least one remaining payment milestone is still open | `deposit_received_at` exists | not applicable | move to next unpaid payment milestone |
| `Remaining payments in progress` | `deposit_received_at` exists and at least one non-deposit payment milestone is not fully paid | all non-deposit milestones are fully paid | earliest open milestone cannot yet be invoiced or is missing required data | create invoice, wait for payment, or mark payment as paid for the earliest open milestone |
| `Fully paid` | all payment milestones are fully paid | all payment milestones are fully paid | not applicable | no further payment action |

Recommended `Next step` derivation:

- if `proposal_sent_at` is empty:
  - if no generated offer PDF exists, next step is `Generate offer PDF`
  - otherwise next step is `Mark proposal as sent`
- else if `deposit_received_at` is empty:
  - next step is `Record deposit receipt`
- else if an open post-confirmation change requires invoicing:
  - next step is `Create adjustment invoice`
- else if the earliest unpaid remaining milestone has no invoice:
  - next step is `Create invoice`
- else if the earliest unpaid remaining milestone is invoiced but unpaid:
  - next step is `Wait for payment` or `Mark payment as paid`
- else:
  - next step is `No further payment action`

### 1. Proposal

Purpose:

- define the customer-facing commercial proposal before confirmation

Contains:

- offer lines
- customer-facing discount
- customer-facing supplements / surcharges
- proposal total
- payment plan
- customer-facing summary for the future offer PDF

Rules:

- changes here affect the generated offer PDF
- changes here affect the baseline payment plan until deposit is confirmed
- after deposit is confirmed, this area remains the current working draft, not the frozen accepted record

Recommended section header summary:

- current proposal total
- proposal status
- next proposal action

Example:

- `Proposal total: EUR 6,800`
- `Status: Awaiting customer response`
- `Next: Wait for deposit or send updated offer`

#### Payment plan inside Proposal

Purpose:

- define the intended commercial payment structure before and after booking confirmation

Contains:

- deposit
- `0..n` installments
- final payment
- due rules for each milestone
- payment-plan notes shown to the customer

Rules:

- the payment plan is the baseline schedule from which payment milestones are derived
- deposit is mandatory as a concept, even if its amount is `0`
- final payment is the remainder after deposit and installments
- payment terms should always resolve to the full planned total

The payment plan belongs inside `Proposal` because it is part of what the customer commercially accepts, not only an internal accounting structure.

Recommended payment-plan summary:

- deposit amount
- number of remaining milestones
- next due milestone

Example:

- `Deposit: EUR 2,040`
- `2 remaining payment milestones`
- `Next due: Final payment 30 days before arrival`

### 2. Payments

Purpose:

- execute the real-world payment flow after proposal setup and booking confirmation

This section should be organized into three sub-areas:

1. `Booking confirmation / Deposit`
2. `Remaining payments`
3. `Changes after confirmation`

Recommended section header summary:

- current payment state
- outstanding amount
- next payment action

Example:

- `Outstanding: EUR 4,760`
- `Current state: Deposit pending`
- `Next: Record deposit receipt`

## Booking confirmation inside Payments

### Why it belongs here

`Booking confirmation` is not separate from payments in the current model.

The practical confirmation event is:

- deposit received
- deposit confirmed by ATP staff

This is the first payment milestone, so it belongs inside `Payments`.

### Booking confirmation / Deposit block

This should be the first block in `Payments`.

It should show:

- accepted / frozen offer artifact
- current offer version status
- expected deposit amount
- deposit due rule
- deposit received date
- deposit confirmed by ATP staff
- deposit reference
- booking confirmation PDFs
- accepted customer snapshot summary

Primary actions:

- record deposit receipt
- create booking confirmation PDF
- open existing booking confirmation PDFs

Artifact rule:

- this block must use the accepted / frozen offer artifact as the authoritative customer-agreed document
- if newer draft-generated offers exist after deposit confirmation, they must not replace the accepted artifact here
- newer draft offers belong in `Proposal`, clearly marked as later drafts

Recommended visual emphasis:

- this block should look like the active gate between proposal and live booking execution
- when deposit is still pending, it should be visually highlighted as the current step
- once deposit is confirmed, it should switch to a completed state and reveal the next active payment milestone

### Accepted snapshot after deposit

Once deposit is confirmed, the UI should show a locked accepted baseline:

- accepted offer snapshot
- accepted payment terms snapshot
- accepted travel plan snapshot if available
- accepted deposit amount and currency
- accepted deposit reference

This is the baseline against which later commercial changes are understood.

## Remaining payments

The remaining payment area should render one block per milestone:

- `Installment 1`
- `Installment 2`
- `Final payment`

Each milestone block should show:

- label
- due rule / due date
- planned amount
- paid status
- invoice status
- optional receipt status, if supported
- linked documents
- next recommended action

Each milestone block should also show a local step state:

- `Not ready`
- `Ready for invoice`
- `Invoice sent`
- `Awaiting payment`
- `Paid`

Primary actions per milestone:

- create invoice PDF
- mark payment as paid
- optionally create receipt PDF when that artifact is supported for the milestone

The milestone, not the invoice record, should be the main UI object.

## Changes after confirmation

### Why this needs its own area

Discounts and supplements / surcharges can happen in two different moments:

- before booking confirmation, as part of the proposal
- after booking confirmation, to address unforeseen travel-plan changes

These must not be mixed into one flat list because they have different meaning.

### Proposal adjustments

These belong in `Proposal`.

They affect:

- offer PDF generation
- pre-confirmation totals
- baseline payment plan

### Post-confirmation changes

These belong in `Payments`, under `Changes after confirmation`.

They affect:

- future outstanding payment amounts
- future invoices
- potentially future receipts

Each change item should capture:

- type: `DISCOUNT`, `SUPPLEMENT`, `SURCHARGE`, `CORRECTION`
- reason
- amount
- when it was added
- which payment milestone it affects
- whether it should be merged into the next invoice or billed separately

This area should make it explicit that these changes do not rewrite the accepted historical snapshot.

Recommended summary treatment:

- show a badge such as `Affects future payments`
- show which milestone will absorb the change
- show whether a new invoice action is now required

## Document model for the UI

The UI should not be grouped primarily by artifact type.

It should be grouped by milestone.

Recommended document grouping:

- proposal documents
- booking confirmation / deposit documents
- installment documents
- final payment documents

For each milestone, the user should be able to see:

- source amount
- linked invoice PDFs
- linked receipt PDFs when available
- payment status

For ATP staff, each document group should also show the next expected document action:

- `No invoice yet`
- `Invoice ready to generate`
- `Receipt ready after payment` when receipts are supported for that milestone
- `No further document needed`

## Mapping to current backend concepts

This proposal can be implemented largely on top of existing backend concepts.

Current booking-level concepts already support the model:

- `offer`
- `offer.payment_terms`
- `generated_offers`
- `deposit_received_at`
- `deposit_confirmed_by_atp_staff_id`
- `accepted_offer_snapshot`
- `accepted_payment_terms_snapshot`
- `accepted_travel_plan_snapshot`
- `pricing.payments`
- `booking_confirmation_pdfs`

This means the first implementation should be mostly a frontend restructuring, not a backend redesign.

## Recommended UX rules

- The top-level page should tell a simple story: proposal -> payments.
- The payment plan should be shown as part of the proposal, not as a separate top-level step.
- `Booking confirmation` should remain visible as a label, but only inside `Payments`.
- The deposit milestone is the boundary between draft commercial data and accepted historical data.
- Proposal-phase adjustments and post-confirmation changes must be visually separated.
- The user should always be able to identify the next action from the current milestone block.
- The user should always be able to identify the overall current stage and next step without opening any section.
- Blocked next steps should explain exactly what is missing.

## Tradeoffs

### Short-term recommendation

Do not change the backend model first.

Instead:

- reorganize the frontend around milestones
- reuse the current offer, payment-term, pricing, and invoice structures

This is the safest path and should already make the experience much clearer.

### Long-term possibility

If post-confirmation changes become common, consider introducing an explicit backend distinction between:

- proposal adjustments
- post-confirmation payment adjustments

This is not required for the first UI pass, but it may become valuable later for PDF and accounting clarity.

## Summary

The preferred model is:

- `Proposal` for the customer-facing commercial setup, including the payment plan
- `Payments` for booking confirmation through deposit, remaining payment handling, invoices, receipts, and post-confirmation changes

This structure matches the actual business flow more closely and should make invoice PDF and receipt PDF generation much easier to understand and operate.

## Implementation plan

This section is the concrete rollout plan for implementing the UI on the current booking page.

### Step 1: Add the ATP staff guidance layer

Goal:

- make the current commercial/payment position obvious before any deeper UI restructuring

Implementation:

- add a top-of-page progress tracker above the commercial sections
- add a `Next step` card beside or below the tracker
- derive:
  - current proposal state
  - current payment state
  - next recommended action
  - blocker reason

Likely file changes:

- `frontend/pages/booking.html`
- `frontend/scripts/pages/booking.js`
- `frontend/scripts/booking/pricing.js`
- `frontend/scripts/booking/offers.js`
- `shared/css/pages/backend-booking.css`

Notes:

- this step should avoid broad backend contract changes
- one small persisted addition is recommended for precision: the manual `Proposal sent` flag
- the remaining state can be derived from existing booking fields and existing draft state

### Step 2: Merge offer and payment-term presentation into `Proposal`

Goal:

- make the payment plan visibly part of the proposal

Implementation:

- move the payment-term panel so it renders inside the `Proposal` section
- keep the existing `offer_payment_terms.js` logic and data model
- add a proposal summary header with:
  - proposal total
  - proposal status
  - next proposal action
- add a payment-plan summary with:
  - deposit amount
  - milestone count
  - next due milestone

Likely file changes:

- `frontend/pages/booking.html`
- `frontend/scripts/booking/offers.js`
- `frontend/scripts/booking/offer_payment_terms.js`
- `shared/css/pages/backend-booking.css`

Notes:

- this is primarily a layout and section-boundary change
- internal naming can stay `payment_terms` for now

### Step 3: Merge booking confirmation and payment execution into `Payments`

Goal:

- replace the current split between booking confirmation, pricing/payments, and invoices

Implementation:

- create a single `Payments` section
- make `Booking confirmation / Deposit` the first payment block
- move deposit receipt controls into that block
- move booking confirmation PDF actions into that block
- keep the accepted snapshot visible below the deposit confirmation state

Likely file changes:

- `frontend/pages/booking.html`
- `frontend/scripts/booking/pricing.js`
- `frontend/scripts/booking/offer_generated_offers.js`
- `shared/css/pages/backend-booking.css`

Notes:

- the deposit block is the gate between proposal editing and ongoing payment execution
- accepted snapshot UI should stay clearly read-only

### Step 4: Rebuild remaining payments around milestones

Goal:

- make milestones the main operational object instead of generic finance tables

Implementation:

- render one UI block per remaining payment milestone
- each block shows:
  - label
  - due rule / date
  - amount
  - local status
  - linked invoice PDFs
  - linked receipt PDFs when supported
  - next action
- introduce local status states such as:
  - `Ready for invoice`
  - `Invoice sent`
  - `Awaiting payment`
  - `Paid`

Likely file changes:

- `frontend/scripts/booking/pricing.js`
- `frontend/scripts/booking/invoices.js`
- `shared/css/pages/backend-booking.css`

Notes:

- keep mapping through `pricing.payments`
- avoid backend changes in the first milestone-based UI pass

### Step 5: Attach invoice and receipt actions directly to milestones

Goal:

- make document generation obvious from the payment milestone that needs it

Implementation:

- stop presenting invoices as a detached editor-first area
- keep invoice editing capability, but open it from the relevant milestone
- show document state per milestone:
  - no invoice
  - invoice exists
  - receipt missing, if that milestone supports receipts
  - receipt exists
- show the next expected document action in each block

Likely file changes:

- `frontend/scripts/booking/invoices.js`
- `frontend/scripts/booking/pricing.js`
- `frontend/pages/booking.html`

Notes:

- first pass can reuse the current invoice forms
- deeper invoice UX cleanup can happen later
- installment and final-payment receipt PDFs are optional; phase 1 only requires the existing deposit / booking-confirmation PDF flow

### Step 6: Add `Changes after confirmation`

Goal:

- handle later discounts and supplements without confusing them with proposal adjustments

Implementation:

- add a dedicated `Changes after confirmation` sub-area in `Payments`
- show whether each change affects:
  - next payment
  - final payment
  - separate invoice
- update the outstanding amount and next-step guidance when a new change creates work

Likely file changes:

- `frontend/scripts/booking/pricing.js`
- `frontend/pages/booking.html`
- `shared/css/pages/backend-booking.css`

Notes:

- in the short term this can be backed by the current pricing-adjustment structures
- proposal adjustments must remain visually and conceptually separate

### Step 7: Add state derivation rules explicitly

Goal:

- make tracker, badges, and next-step recommendations deterministic

Implementation:

- define a small frontend state-derivation layer that computes:
  - proposal stage
  - payment stage
  - active milestone
  - next action
  - blocked reason
- use the same derived state in:
  - top progress tracker
  - next-step card
  - section summaries
  - milestone status chips

Likely file changes:

- `frontend/scripts/pages/booking.js`
- `frontend/scripts/booking/pricing.js`
- possibly a new helper module such as `frontend/scripts/booking/payment_flow_state.js`

Notes:

- centralizing this logic will avoid inconsistent UI labels
- this step is important once multiple sections start showing the same status

### Step 8: Polish and verify

Goal:

- make the new flow understandable and safe

Implementation:

- verify that the next-step card always points to a valid action
- verify that deposit-confirmed bookings never look like pre-deposit bookings
- verify that post-confirmation changes do not appear to rewrite accepted history
- review empty states and blocked states
- review mobile layout and narrow desktop widths

Verification:

- update or add tests for UI state derivation where feasible
- manually test:
  - draft proposal only
  - offer sent, deposit pending
  - deposit confirmed
  - installment pending
  - fully paid
  - post-confirmation change added

### Recommended rollout order

Deliver in this order:

1. guidance layer
2. `Proposal` restructure
3. `Payments` merge with deposit block
4. milestone-based remaining payments
5. milestone-linked invoice/receipt actions
6. post-confirmation changes
7. polish and verification

### Recommended non-goals for the first pass

Avoid in the first implementation:

- major backend schema changes
- rewriting invoice persistence
- rewriting accepted snapshot logic
- changing PDF generation contracts unless required by the new UI

The first pass should improve clarity and operator flow while preserving the current business model and storage model as much as possible.
