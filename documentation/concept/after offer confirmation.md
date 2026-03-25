# After offer confirmation

## Purpose

This document defines how the backend UI should behave after a customer has confirmed an offer and the deposit has been paid.

The UI must clearly separate:

- current editable working data
- frozen customer-facing records
- exceptional reversal logic

## Core principle

`Deposit paid` is a business boundary.

After deposit payment:

- the customer-facing commercial state becomes frozen
- ATP staff may continue editing the current working data
- normal workflow must not move the booking back to a pre-deposit state

The frozen area should follow the same read-only pattern as `Web form submission`.

## Booking page structure

### Top of page

- booking summary
- stage
- ATP staff
- top-level controls
- compact status banner when deposit is paid

Recommended banner content:

- `Deposit paid on <date>`
- accepted deposit amount
- shortcut links to accepted records

### Main editable working area

Keep the editable sections in the normal working area higher on the page.

Recommended section titles:

- `Current travel plan`
- `Current commercial draft`
- `Current payment terms`

These are the ATP staff working sections.

### Read-only historical area near the bottom

Add a frozen section below the editable areas, visually similar to `Web form submission`.

Recommended title:

- `Accepted by Customer`

This section should contain read-only snapshots of:

- accepted offer
- accepted payment terms
- accepted travel plan, if one existed at the time of deposit payment

It should also show:

- deposit amount
- paid date
- payment reference or method, if available
- links to accepted PDFs or customer-facing records

## Why the frozen section belongs near the bottom

This keeps the page easy to understand:

- the top and middle remain the active working area
- the lower section becomes the historical record
- staff can compare accepted data with the current draft without mixing both states

## Travel plan after deposit paid

The travel plan should usually remain editable after deposit paid.

The UI should show:

- the current editable travel plan in the working area
- the accepted travel plan snapshot in `Accepted by Customer`

## Offer after deposit paid

The accepted offer snapshot is frozen and read-only.

If ATP staff make further commercial edits after deposit paid, those changes belong only in the current working section. They do not replace the accepted record.

## Payment terms after deposit paid

The accepted payment terms snapshot is frozen and read-only in `Accepted by Customer`.

In the editable working area:

- the deposit row stays clearly marked as paid
- remaining unpaid terms may remain editable according to business rules
- any later edits must be clearly shown as post-deposit working changes, not as the accepted terms

## Stage logic after deposit paid

### Normal rule

The normal stage control must not allow moving the booking back to a stage before deposit paid.

If the stage UI is shown in two rows, the split should be:

- before deposit paid
- after deposit paid

Once the booking is in the post-deposit row, normal stage changes must stay within that row.

### Reason

Allowing normal backward movement after deposit paid creates confusion in:

- accounting
- operations
- audit history
- customer communication

## Exceptional reversal flow

Do not implement this now.

Possible later solution:

- a separate explicit admin-only action such as `Reverse deposit milestone`
- mandatory reason
- confirmation step
- audit log entry
- optional refund or void details if relevant

This must not be part of the normal stage control.

## Naming guidance

To reduce ambiguity:

- do not label the editable post-deposit section simply `Offer`
- do not mix accepted and editable data in the same section

Preferred labels:

- `Current travel plan`
- `Current commercial draft`
- `Current payment terms`
- `Accepted by Customer`

## Summary

After offer confirmation and deposit payment:

- keep travel plan, offer, and payment terms editable in the main working area
- add a frozen read-only section near the bottom, similar to `Web form submission`
- store and show accepted offer, accepted payment terms, and accepted travel plan there
- block normal rollback to stages before deposit paid
- keep any future reversal flow separate and explicitly audited

## Detailed implementation plan

### Scope for the first implementation

Implement now:

- frozen accepted snapshots at deposit payment
- backend UI to display accepted snapshots read-only
- top banner and shortcut links
- clear separation between current editable sections and accepted historical sections
- normal stage control blocking rollback to before deposit paid

Do not implement now:

- admin reversal flow
- refund logic
- special accounting workflows beyond showing the paid deposit row

### Assumptions

- `deposit paid` is represented by an existing booking stage or milestone action
- the booking already has editable current sections for travel plan, commercial data, and payment terms
- accepted customer-facing PDFs or artifacts may already exist for offer and travel plan

If the current runtime does not yet have a single canonical `deposit paid` event, that should be normalized first. The rest of this implementation should be anchored to one explicit business event.

### Data model changes

Store frozen accepted snapshots on the booking.

Recommended new booking fields:

- `accepted_at`
- `accepted_deposit_amount`
- `accepted_deposit_currency`
- `accepted_deposit_reference`
- `accepted_offer_snapshot`
- `accepted_payment_terms_snapshot`
- `accepted_travel_plan_snapshot`
- `accepted_offer_artifact_ref`
- `accepted_travel_plan_artifact_ref`

Design rules:

- snapshots are immutable once written
- snapshots are stored directly on the booking, not recalculated from current editable state
- snapshots contain the customer-facing content at the moment deposit is paid
- if no travel plan existed at that moment, `accepted_travel_plan_snapshot` remains empty

### Snapshot shape

The snapshot should be self-contained enough for stable rendering later.

Recommended approach:

- `accepted_offer_snapshot`: full commercial read model shown to the customer
- `accepted_payment_terms_snapshot`: full accepted payment schedule
- `accepted_travel_plan_snapshot`: customer-facing travel-plan snapshot only

Do not reference current mutable objects from the snapshot. Store a frozen copy.

### Trigger point

Create the accepted snapshots exactly when the booking crosses into `deposit paid`.

Recommended rule:

- if booking enters `deposit paid` and accepted snapshots do not exist yet, create them
- if accepted snapshots already exist, do not overwrite them

This logic should be idempotent.

### Backend service logic

Add one dedicated application-level routine, for example:

- `freezeAcceptedCommercialRecord(booking, store, now)`

Responsibilities:

- validate that the booking has enough data to freeze
- collect current customer-facing offer data
- collect current payment terms
- collect current travel plan if present
- persist immutable accepted snapshot fields
- link any existing accepted artifacts if available

Keep this logic in one place. Do not duplicate snapshot-building logic across handlers.

### Stage transition logic

Update the stage transition rules so that the normal stage control cannot move a booking back before `deposit paid`.

Recommended implementation:

- define a stage boundary at `deposit paid`
- allow normal transitions only within the pre-deposit group or within the post-deposit group
- disallow normal transitions from any post-deposit stage back to any pre-deposit stage

Enforce this:

- in backend validation
- in frontend stage UI

Frontend blocking alone is not sufficient.

### Backend API changes

Extend the booking detail response so the page can render both working and accepted states.

Recommended additions to booking detail response:

- `accepted_record`
- `accepted_record.available`
- `accepted_record.accepted_at`
- `accepted_record.deposit`
- `accepted_record.offer`
- `accepted_record.payment_terms`
- `accepted_record.travel_plan`
- `accepted_record.offer_artifact_url`
- `accepted_record.travel_plan_artifact_url`
- `capabilities.can_move_before_deposit_paid`

This keeps UI logic simple and avoids reconstructing accepted state in the browser.

### Booking page UI changes

#### Top banner

When the booking has an accepted record, show a compact banner near the top with:

- `Deposit paid on <date>`
- accepted deposit amount
- accepted payment reference if available
- links:
  - `Accepted offer`
  - `Accepted payment terms`
  - `Accepted travel plan`

#### Editable sections

Rename existing editable section headers if needed:

- `Travel plan` -> `Current travel plan`
- `Offer` -> `Current commercial draft`
- `Payment terms` -> `Current payment terms`

These sections remain editable.

#### Read-only accepted section

Add a new read-only block near the bottom, after `Web form submission`.

Title:

- `Accepted by Customer`

Subsections:

- `Accepted offer`
- `Accepted payment terms`
- `Accepted travel plan`

Each subsection should:

- use the same visual language as other read-only backend sections
- avoid edit controls
- support collapsed/expanded display if content is large

### Payment terms UI rules

In the editable section:

- show the deposit row as paid and visually locked
- allow editing of remaining unpaid terms if business rules allow it
- if the working payment terms differ from the accepted snapshot, show the difference implicitly by keeping accepted terms below in the read-only section

Do not try to merge both views into a single table in the first implementation.

### Travel plan UI rules

In the editable section:

- keep the current travel plan fully editable

In the read-only section:

- show the accepted travel plan snapshot exactly as frozen

The accepted snapshot should not depend on the current travel-plan draft.

### Offer UI rules

In the editable section:

- keep the current commercial offer editable according to existing rules

In the read-only section:

- show the accepted offer snapshot

If current and accepted offer differ, that is expected and should not require special warning in the first implementation. The visual separation already communicates the distinction.

### Storage and migration

Existing bookings will likely fall into three groups:

- bookings before deposit paid: no accepted snapshot needed
- bookings after deposit paid with enough current data to backfill snapshots
- bookings after deposit paid but with incomplete historical data

Recommended first migration:

- do not backfill aggressively in the first pass
- for already-paid bookings, create accepted snapshots only when there is a reliable accepted source
- if reliable accepted source is missing, leave accepted record empty and show no accepted section for that booking

This avoids inventing false historical records.

### Rendering order on `booking.html`

Recommended order:

1. booking summary and top controls
2. deposit-paid banner if available
3. current travel plan
4. current commercial draft
5. current payment terms
6. web form submission
7. accepted by customer
8. danger zone

### Testing plan

#### Backend tests

Add tests for:

- entering `deposit paid` creates snapshots once
- re-entering or re-saving does not overwrite accepted snapshots
- accepted snapshots remain stable when current offer changes later
- accepted snapshots remain stable when current travel plan changes later
- accepted snapshots remain stable when payment terms change later
- normal stage transition rejects moving from post-deposit to pre-deposit

#### Frontend tests

Add tests for:

- booking page shows top banner when accepted record exists
- booking page renders accepted section only when accepted record exists
- accepted section is read-only
- editable sections still render and remain editable
- normal stage UI does not offer invalid pre-deposit rollback

#### Manual smoke tests

Manual flow:

1. create a booking
2. create offer, payment terms, and travel plan
3. mark deposit paid
4. verify accepted section appears
5. edit current travel plan
6. verify accepted travel plan remains unchanged
7. edit current payment terms
8. verify accepted payment terms remain unchanged
9. attempt normal stage rollback to pre-deposit
10. verify backend rejects it

### Implementation sequence

Recommended order of work:

1. define accepted snapshot fields in the model
2. generate contract changes
3. implement backend snapshot-freeze routine
4. enforce backend stage-transition rule
5. extend booking detail response
6. add top banner and accepted read-only section in backend UI
7. rename editable section labels
8. add automated tests
9. run manual smoke test on a booking that crosses the deposit-paid boundary

### Risks and tradeoffs

#### Risk: unclear source of truth for deposit paid

If current code uses several loosely related indicators, snapshot creation may fire at the wrong time.

Mitigation:

- define one canonical trigger before implementation

#### Risk: weak historical data for old bookings

Backfilling accepted snapshots for existing bookings may create inaccurate history.

Mitigation:

- do not fabricate history
- backfill only when the accepted source is reliable

#### Tradeoff: duplicated data on the booking

The accepted snapshots duplicate current working data at one moment in time.

This is intentional. Stability and audit clarity are more important here than normalization.
