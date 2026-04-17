# Payments

## Purpose

This document defines the booking payment logic after removing booking stages, milestone buttons, status badges, and next-step tracking.

The payment experience is now driven only by the financial flow:

1. deposit
2. optional installment payments
3. final payment

## Core rules

- Do not model or display booking stage.
- Do not model or display booking milestones.
- Do not model or display next-step state such as `Proposal sent`, `Deposit confirmed`, or `Fully paid`.
- Do not render payment badges such as `Awaiting payment`.
- Keep the proposal payment plan in the offer/proposal area.
- Render the operational payment workflow from the pricing/payment plan rows.

## Payment model

The source of truth is the payment plan plus persisted payment documents and accepted payment snapshots.

Each payment row represents one financial step:

- `DEPOSIT`
- `INSTALLMENT`
- `FINAL_BALANCE`

Each payment row should carry:

- identity and label
- due date
- planned amount values
- payment-term linkage
- request/receipt document linkage
- received payment fields
- offer snapshot linkage

## Derived payment state

The only derived payment state that remains is financial:

- `PENDING` when the payment has no confirmed receipt data
- `PAID` when the payment has complete receipt data

`PAID` is derived from the receipt fields on the payment row, not from a separate stage or milestone action.

Required receipt fields for a recorded payment:

- `received_amount_cents`
- `received_at`
- `confirmed_by_atp_staff_id`

Optional receipt field:

- `reference`

When receipt data is saved for the deposit payment, the accepted commercial snapshot is frozen from that deposit-linked save.

## Page structure

The booking page keeps two different concerns separate:

- `Proposal`
  - defines the offer and payment plan
- `Payments`
  - executes the real financial flow against those planned payments

The `Payments` section renders one card per payment, in payment-plan order:

1. deposit
2. zero or more installments
3. final payment

There is no top payment tracker and no top status summary.

## Per-payment UI

Each payment card contains exactly three operational blocks.

### 1. Request PDF

This block is initially collapsed.

It contains:

- `PDF Texts for personalization` subsection, initially collapsed
- `PDF Attachments` subsection, initially collapsed and initially empty
- table of generated PDFs
- button: `new PDF`

Purpose:

- ask the customer for that payment
- keep all request PDFs attached to the payment they belong to

### 2. Payment received

This block is always visible.

It contains:

- `Amount received`
- `When received`
- `Confirmed by`
- `Receipt reference`
- `Snapshot of the offer`

The offer snapshot must show the payment-linked offer context at the moment the payment receipt was recorded:

- linked generated offer PDF
- offer date
- offer language
- total
- payment-plan summary

If the payment has not been saved with receipt data yet, the UI may preview the latest generated offer as the future snapshot source.

Once saved, the payment should store the linked generated offer id so later changes do not silently rewrite history.

### 3. Customer Receipt

This block is initially collapsed.

It contains:

- `PDF Texts for personalization` subsection, initially collapsed
- `PDF Attachments` subsection, initially collapsed and initially empty
- table of generated PDFs
- button: `new PDF`

Purpose:

- confirm to the customer that the payment was received
- keep the generated receipt PDFs on the payment they belong to

## Document behavior

Request and receipt PDFs are payment-linked documents.

Rules:

- documents belong to a specific payment row
- the UI should not require staff to leave the payment card to understand the document history
- document tables show the generated PDFs newest first
- payment-linked PDFs should remain accessible even if later payments are added or updated

## Removed concepts

The following concepts are intentionally removed from payment logic:

- `Before deposit received`
- `After deposit received`
- `New booking`
- `Travel plan sent`
- `Offer sent`
- `Negotiation`
- `Deposit requested`
- `Deposit received` as a manual stage action
- `In progress`
- `Trip completed`
- `Booking lost`
- `Proposal in progress`
- `Proposal sent`
- `Booking confirmation / Deposit pending`
- `Deposit confirmed`
- `Remaining payments`
- `Fully paid`

These concepts should not drive booking payment UI, API shape, or persistence.

## Implementation notes

- Keep the offer payment plan editable in the proposal area.
- Rebuild pricing payments from the current payment terms when those terms change.
- Persist receipt fields directly on each pricing payment row.
- Persist the linked generated offer id when a payment receipt is saved.
- Prevent deleting a generated offer if a payment snapshot still references it.
- Keep old standalone deposit or milestone widgets removed.
- Keep old stage and milestone endpoints removed.

## Result

Staff should only need to answer three questions:

- Which payment is this?
- Has the money been requested?
- Has the money been received and confirmed?

Everything in the `Payments` section should support those questions directly.
