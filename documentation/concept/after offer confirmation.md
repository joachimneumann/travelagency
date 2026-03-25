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
