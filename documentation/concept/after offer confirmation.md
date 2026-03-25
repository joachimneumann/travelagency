# After offer confirmation

## Purpose

This document defines how the backend UI should behave after a customer has confirmed an offer and the deposit has been paid.

The backend must clearly separate:

- current editable working data
- frozen customer-facing records
- deposit receipt logic
- normal stage transitions versus exceptional reversal logic

## Core principle

`Deposit paid` is a business boundary.

After deposit payment:

- the customer-facing commercial state becomes frozen
- ATP staff may continue editing the current working data
- normal workflow must not move the booking back to a pre-deposit state

The frozen area should use the same read-only pattern as `Web form submission`.

## Canonical trigger

The canonical trigger is not a stage button.

There must be no stage button `Deposit received`.

Instead, the canonical trigger is:

- the deposit receipt saved in the payments section

This action persists:

- `deposit_received_at`
- `deposit_confirmed_by_atp_staff_id`

When this is saved for the first time, the system freezes the accepted customer-facing snapshots.

## Payment terms rule

The payment terms must always contain a deposit configuration.

Rules:

- default deposit percentage: `30%`
- allowed deposit percentage: `0%` to `100%`
- additional installment payments are allowed
- the payment rows are:
  - `Deposit`
  - `0..n Installments`
  - `Final payment`
- the total percentage across deposit, installments, and final payment must always be exactly `100%`
- final payment percentage is always the remainder to `100%`
- if deposit is `0%`, ATP staff may still manually press `Deposit received`
- if deposit is `100%`, final payment becomes `0%`

Installment timing must be explicit.

For each installment, the due timing should support:

- `FIXED_DATE`
- `DAYS_AFTER_ACCEPTANCE`
- `DAYS_BEFORE_TRIP_START`
- `DAYS_AFTER_TRIP_START`
- `DAYS_AFTER_TRIP_END`

This allows all non-deposit payments to be anchored either to a calendar date or to the trip dates.

This keeps the payment structure explicit and avoids a separate `Deposit received` stage action.

## Booking page structure

### Top of page

- booking summary
- stage
- ATP staff
- top-level controls
- compact deposit-paid banner when applicable

Recommended banner content:

- `Deposit received on <date>`
- accepted deposit amount
- `Confirmed by <atp_staff>`
- shortcut links to accepted records

### Main editable working area

Keep the editable sections higher on the page.

Recommended section titles:

- `Current travel plan`
- `Current commercial draft`
- `Current payment terms`

These are the ATP staff working sections.

### Read-only historical area near the bottom

Add a frozen section below the editable areas, visually similar to `Web form submission`.

Recommended title:

- `Accepted by Customer`

This section contains read-only snapshots of:

- accepted offer
- accepted payment terms
- accepted travel plan, if one existed at the time deposit was marked received

It should also show:

- deposit amount
- paid date
- payment reference or method, if available
- links to accepted PDFs or customer-facing records

## Why the frozen section belongs near the bottom

This keeps the page easy to understand:

- the top and middle remain the active working area
- the lower section is the historical record
- staff can compare accepted data with the current draft without mixing both states

## Travel plan after deposit paid

The travel plan usually remains editable after deposit paid.

The UI should show:

- the current editable travel plan in the working area
- the accepted travel plan snapshot in `Accepted by Customer`

## Offer after deposit paid

The accepted offer snapshot is frozen and read-only.

If ATP staff make later commercial changes, those changes belong only in `Current commercial draft`. They do not replace the accepted record.

## Payment terms after deposit paid

The accepted payment terms snapshot is frozen and read-only in `Accepted by Customer`.

In `Current payment terms`:

- the deposit row stays clearly marked as paid once received
- the deposit row is locked after receipt is recorded
- remaining unpaid terms may remain editable according to business rules
- later changes are working changes, not historical accepted changes
- `Trip completed` is disabled until all installments and final payment have been paid

## Payments UI

The editable payments section should show:

- expected deposit percentage
- expected deposit amount
- a control labeled `Deposit received at`
- an ATP staff dropdown labeled `Confirmed by`

Recommended behavior:

- the `Deposit received` mechanism exists only in the payments section
- it is independent of the selected first-row stage button
- it is available whenever `deposit_received_at` is not yet set
- the user sets the date
- the user selects the ATP staff member who confirms it
- both fields are required before `Deposit received` can be saved
- `Deposit received` is blocked unless payment terms and offer already exist
- when blocked, the UI shows a clear hint explaining that payment terms and offer must exist first
- saving this sets `deposit_received_at`
- saving this sets `deposit_confirmed_by_atp_staff_id`
- this save is the trigger for freezing the accepted snapshots
- after saving, these fields are read-only for `atp_staff` users
- a future version may allow editing by `atp_admin` users only

## Stage logic after deposit paid

### Stage buttons

The stage UI is organized into two rows of stage buttons.

First row:

- `New booking`
- `Travel plan sent to customer`
- `Offer sent to customer`
- `Negotiation started`
- `Deposit request sent`

Second row:

- `In progress`
- `Trip completed`

Separate terminal action:

- `Booking lost`

### Normal rule

The normal stage control must not allow moving the booking back to a stage before deposit paid.

There is no stage button `Deposit received`.

Before deposit has been paid:

- the first row is enabled
- the second row is disabled
- `Booking lost` is enabled

After deposit has been paid:

- the first row is disabled
- the second row is enabled
- `Booking lost` remains enabled

The switch between both rows is controlled only by the deposit receipt recorded in the payments section.

Instead:

- `deposit_received_at` defines whether the booking is pre-deposit or post-deposit
- once `deposit_received_at` exists, normal stage changes must stay within the second row
- before `deposit_received_at` exists, normal stage changes must stay within the first row

### Reason

Allowing normal backward movement after deposit paid creates confusion in:

- accounting
- operations
- audit history
- customer communication

## Exceptional reversal flow

Do not implement this now.

Possible later solution:

- a separate explicit admin-only action such as `Reverse deposit receipt`
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
- remove the stage button `Deposit received`
- replace the stored stage enum set to match the new two-row flow
- use two stage rows:
  - first row before deposit: `New booking`, `Travel plan sent to customer`, `Offer sent to customer`, `Negotiation started`, `Deposit request sent`
  - second row after deposit: `In progress`, `Trip completed`
  - separate terminal action: `Booking lost`
- always configure a deposit in payment terms, default `30%`
- mark deposit as received in the payments section with date and ATP staff
- allow additional installment payments
- block normal rollback to stages before deposit paid
- keep any future reversal flow separate and explicitly audited

## Detailed implementation plan

### Scope for the first implementation

Implement now:

- frozen accepted snapshots at deposit receipt
- backend UI to display accepted snapshots read-only
- top banner and shortcut links
- clear separation between current editable sections and accepted historical sections
- removal of the stage button `Deposit received`
- deposit configuration always present in payment terms
- deposit receipt UI in the payments section
- support for additional installment payments
- normal stage control blocking rollback to before deposit paid

Do not implement now:

- reversal flow
- refund logic
- compatibility handling for existing bookings

### Data model changes

Store frozen accepted snapshots on the booking.

Recommended booking fields:

- `deposit_received_at`
- `deposit_confirmed_by_atp_staff_id`
- `accepted_deposit_amount`
- `accepted_deposit_currency`
- `accepted_deposit_reference`
- `accepted_offer_snapshot`
- `accepted_payment_terms_snapshot`
- `accepted_travel_plan_snapshot`
- `accepted_offer_artifact_ref`
- `accepted_travel_plan_artifact_ref`

Recommended payment-term rules in the model:

- deposit percentage is mandatory
- default deposit percentage is `30`
- allowed range is `0` to `100`
- additional installments are allowed
- final payment percentage is derived as `100 - deposit percentage - installment percentages total`
- final payment row always exists
- each non-deposit payment row must define a due mode
- supported non-deposit due modes:
  - `FIXED_DATE`
  - `DAYS_AFTER_ACCEPTANCE`
  - `DAYS_BEFORE_TRIP_START`
  - `DAYS_AFTER_TRIP_START`
  - `DAYS_AFTER_TRIP_END`
- for `FIXED_DATE`, a calendar date is required
- for `DAYS_AFTER_ACCEPTANCE`, `DAYS_BEFORE_TRIP_START`, `DAYS_AFTER_TRIP_START`, and `DAYS_AFTER_TRIP_END`, an integer day offset is required

Design rules:

- snapshots are immutable once written
- snapshots are stored directly on the booking
- snapshots contain the customer-facing content at the time deposit was marked received
- if no travel plan existed at that moment, `accepted_travel_plan_snapshot` remains empty
- `deposit_received_at` and `deposit_confirmed_by_atp_staff_id` become read-only for `atp_staff` users after saving `Deposit received`

### Trigger point

Create the accepted snapshots exactly when `Deposit received` is saved in the payments section.

Rules:

- if `deposit_received_at` is set and accepted snapshots do not exist yet, create them
- if accepted snapshots already exist, do not overwrite them

This must be idempotent.

Normal saves must not clear or rewrite accepted snapshots.

### Backend service logic

Add one application-level routine, for example:

- `freezeAcceptedCommercialRecord(booking, store, now)`

Responsibilities:

- validate that the booking has enough data to freeze
- validate that payment terms and offer exist before allowing `Deposit received`
- read the configured deposit payment term
- read `deposit_received_at`
- read `deposit_confirmed_by_atp_staff_id`
- collect current customer-facing offer data
- collect current payment terms
- collect current travel plan if present
- persist immutable accepted snapshot fields
- link accepted artifacts if available

Keep this logic in one place.

### Stage transition logic

Update the stage transition rules so that the stage UI is split into two rows and normal stage control cannot move a booking back before deposit paid.

Rules:

- determine the boundary from `deposit_received_at`, not from a stage button
- before `deposit_received_at`, enable only the first row:
  - `New booking`
  - `Travel plan sent to customer`
  - `Offer sent to customer`
  - `Negotiation started`
  - `Deposit request sent`
- after `deposit_received_at`, disable the first row and enable only the second row:
  - `In progress`
  - `Trip completed`
- keep `Booking lost` as a separate terminal action available both before and after deposit receipt
- reject any normal transition from the second row back to the first row
- allow `Trip completed` only when all installments and final payment have been paid
- remove the stage button `Deposit received` completely
- replace the stored stage enum set rather than only remapping the UI

Enforce this:

- in backend validation
- in frontend stage UI

Frontend-only blocking is not sufficient.

### Backend API changes

Extend the booking detail response so the page can render both current and accepted states.

Recommended additions:

- `accepted_record`
- `accepted_record.available`
- `accepted_record.deposit_received_at`
- `accepted_record.deposit`
- `accepted_record.offer`
- `accepted_record.payment_terms`
- `accepted_record.travel_plan`
- `accepted_record.offer_artifact_url`
- `accepted_record.travel_plan_artifact_url`
- `payments.expected_deposit`
- `payments.deposit_receipt`
- `capabilities.can_move_to_pre_deposit_stage`

### Booking page UI changes

#### Top banner

When accepted record data exists, show:

- `Deposit received on <date>`
- accepted deposit amount
- `Confirmed by <atp_staff>`
- accepted payment reference if available
- links:
  - `Accepted offer`
  - `Accepted payment terms`
  - `Accepted travel plan`

#### Editable sections

Rename section headers if needed:

- `Travel plan` -> `Current travel plan`
- `Offer` -> `Current commercial draft`
- `Payment terms` -> `Current payment terms`

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
- support collapse/expand for large content

#### Payments section

Add:

- expected deposit percentage
- expected deposit amount
- `Deposit received at`
- `Confirmed by`
- installment rows
- final payment row
- due-mode control for each non-deposit payment row
- due-value control for each non-deposit payment row

After saving `Deposit received`:

- the deposit row is marked paid
- the deposit row is locked
- the receipt fields are locked
- accepted snapshots are created if not already present
- the lock applies to `atp_staff` users
- a later version may allow `atp_admin` override

For each installment row, the UI should allow:

- selecting the due mode:
  - `Fixed date`
  - `Days after acceptance`
  - `Days before trip start`
  - `Days after trip start`
  - `Days after trip end`
- entering the matching value:
  - a date for `Fixed date`
  - a day offset for `Days after acceptance`
  - a day offset for `Days before trip start`
  - a day offset for `Days after trip start`
  - a day offset for `Days after trip end`

For the final payment row, the UI should allow the same due-mode choices and matching value input.

### Storage and migration

Rules:

- delete all existing bookings and related local booking artifacts before rollout
- do not backfill accepted snapshots
- start the new flow only with bookings created after this reset

This avoids compatibility code and avoids inventing false historical records from mutable current data.

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

- saving `Deposit received` creates snapshots once
- re-saving deposit receipt does not overwrite accepted snapshots
- accepted snapshots remain stable when current offer changes later
- accepted snapshots remain stable when current travel plan changes later
- accepted snapshots remain stable when payment terms change later
- default deposit is `30%`
- deposit can be `0%` and `100%` with final payment auto-adjusted correctly
- installments can be added and the final payment auto-adjusts correctly
- all non-deposit payments support `FIXED_DATE`, `DAYS_AFTER_ACCEPTANCE`, `DAYS_BEFORE_TRIP_START`, `DAYS_AFTER_TRIP_START`, and `DAYS_AFTER_TRIP_END`
- non-deposit payment validation requires the correct value type for each due mode
- `Deposit received` persists `deposit_received_at`
- `Deposit received` persists `deposit_confirmed_by_atp_staff_id`
- `Deposit received` becomes read-only for `atp_staff` users after save
- `Deposit received` is blocked until payment terms and offer exist
- before `deposit_received_at`, only first-row stage transitions are allowed
- after `deposit_received_at`, only second-row stage transitions are allowed
- `Booking lost` is available as a separate terminal action before and after deposit receipt
- normal stage transition rejects moving from the second row back to the first row
- `Trip completed` is rejected until all installments and final payment are paid
- `Deposit received` is no longer available as a stage action
- the stored stage enum matches the new two-row flow

#### Frontend tests

Add tests for:

- booking page shows top banner when accepted record exists
- booking page renders accepted section only when accepted record exists
- accepted section is read-only
- editable sections still render and remain editable
- payments section shows expected deposit and `Deposit received` controls
- payments section supports installment rows and recalculates final payment
- payments section supports due-mode controls for all non-deposit payment rows
- payments section shows a hint when `Deposit received` is blocked because offer or payment terms are missing
- before deposit, first-row stage buttons are enabled and second-row stage buttons are disabled
- after deposit, first-row stage buttons are disabled and second-row stage buttons are enabled
- `Booking lost` is rendered as a separate terminal action
- `Trip completed` stays disabled until all non-deposit payments are paid
- `Deposit received` is not rendered as a stage button

#### Manual smoke test

1. create a booking
2. create offer, payment terms, and travel plan
3. verify only the first-row stage buttons are enabled
4. verify `Booking lost` is available as a separate action
5. verify deposit defaults to `30%`
6. add installment rows and verify final payment auto-adjusts
7. verify due-mode timing works for installments and final payment with `Fixed date`, `Days after acceptance`, `Days before trip start`, `Days after trip start`, and `Days after trip end`
8. verify `Deposit received` is blocked until payment terms and offer exist and that the UI shows a hint
9. press `Deposit received` in the payments section with date and ATP staff
10. verify accepted section appears
11. verify the first-row stage buttons are disabled
12. verify the second-row stage buttons are enabled
13. verify `Booking lost` is still available
14. verify `Trip completed` is disabled until all remaining payments are paid
15. edit current travel plan
16. verify accepted travel plan remains unchanged
17. edit current payment terms
18. verify accepted payment terms remain unchanged
19. verify `Deposit received` fields are read-only for `atp_staff`
20. attempt normal stage rollback to the first row
21. verify backend rejects it

### Implementation sequence

Recommended order:

1. update the model with deposit receipt and accepted snapshot fields
2. update the payment terms model so deposit is always configured with default `30%`, supports installments, and supports installment due modes
3. generate contract changes
4. implement backend deposit-receipt and snapshot-freeze routine
5. remove the stage button `Deposit received`
6. implement the two-row stage model in backend validation and UI state
7. enforce row switching from `deposit_received_at`
8. extend booking detail response
9. add payments receipt controls in backend UI
10. add top banner and accepted read-only section in backend UI
11. rename editable section labels
12. add automated tests
13. run the manual smoke test

### Risks and tradeoffs

#### Risk: unclear source of truth

If the code still uses several loose indicators for deposit state, snapshot creation may fire at the wrong time.

Mitigation:

- use only the payments receipt fields as the canonical trigger

#### Tradeoff: duplicated snapshot data

The accepted snapshots duplicate current working data at one moment in time.

This is intentional. Stability and audit clarity are more important here than normalization.

#### Tradeoff: destructive reset

Deleting all existing bookings avoids compatibility code and historical ambiguity, but it removes current local booking data and artifacts.

This is intentional for this rollout. The new flow starts from a clean state instead of carrying forward inconsistent legacy data.
