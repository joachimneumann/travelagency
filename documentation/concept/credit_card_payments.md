# Credit Card Payments (Future Direction)

## Current Assumption

If card payments are added later, they should be attached to:
- booking
- offer
- invoice

They should not depend on a separate customer domain.

## Recommended Flow

1. ATP staff prepares a booking-specific offer.
2. The backend creates an invoice or payment request for that booking.
3. A payment link is shared with the booking contact.
4. The booking contact reviews the booking-specific commercial details and pays.
5. Payment status updates are written back to the booking pricing and invoice records.

## Data Ownership

Use:
- `booking.id`
- `booking.persons[]`
- invoice identifiers

Do not use:
- separate master-data offer endpoints
- separate master-data payment records

## Public Link Idea

A future public payment page could resolve a signed booking/invoice token and show:
- booking title
- line items
- invoice amount
- currency
- payment action

## Current Constraint

This is a future design note only. The active backend currently supports:
- pricing
- offers
- invoices

but not card processing.
