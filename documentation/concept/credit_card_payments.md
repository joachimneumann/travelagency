# Credit Card Payments (Future Direction)

## Current Assumption

If card payments are added later, they should be attached to:
- booking
- offer
- payment document

They should not depend on a separate customer domain.

## Recommended Flow

1. ATP staff prepares a booking-specific offer.
2. The backend creates a payment document for that booking, typically a payment request.
3. A payment link is shared with the booking contact.
4. The booking contact reviews the booking-specific commercial details and pays.
5. Payment status updates are written back to accepted booking payment fields and payment-document records.

## Data Ownership

Use:
- `booking.id`
- `booking.persons[]`
- payment-document identifiers

Do not use:
- separate master-data offer endpoints
- separate master-data payment records

## Public Link Idea

A future public payment page could resolve a signed booking/payment-document token and show:
- booking title
- line items
- payment-document amount
- currency
- payment action

## Current Constraint

This is a future design note only. The active backend currently supports:
- pricing
- offers
- payment documents

but not card processing.
