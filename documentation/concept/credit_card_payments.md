# Credit Card Payments (Stripe) for Chapter2

## 1) Scope and Goal

This document defines requirements and implementation for secure credit card payments using a provider such as Stripe.

Business flow:
1. Staff creates a customer-specific offer containing one or more tours.
2. System generates a non-guessable public link.
3. Customer opens link, reviews tailored tour details, and pays by card.
4. Payment status is tracked in backend records.

## 2) Functional Requirements

### 2.1 Offer and Payment Link

- Create one offer per customer with one or more tour line items.
- Each line item includes:
  - base tour reference (`tour_id`)
  - customer-specific overrides/notes
  - customer-specific pricing (`unit_amount_cents`, `quantity`, `total_amount_cents`)
- Generate a public tokenized URL that is practically impossible to guess.
- Public URL must display:
  - customer-specific itinerary/line items
  - payment totals (`total`, `due now`)
  - payment due date (optional)

### 2.2 Payment Processing

- Start checkout session via Stripe Checkout.
- Charge amount in minor units (`amount_cents`) and explicit currency.
- Associate payment with internal entities via metadata (`offer_id`, `offer_token`, `customer_id`).
- Persist checkout creation event and payment lifecycle in backend (`payments`).
- Accept Stripe webhook events to mark offers as paid.

### 2.3 Security

- Public offer URLs use high-entropy random tokens.
- Admin APIs for creating/sending offers remain protected (`/api/v1/*`).
- Webhook signature verification required (`STRIPE_WEBHOOK_SECRET`).
- Never expose `STRIPE_SECRET_KEY` in frontend.

### 2.4 Operational

- Backend must return clear errors when Stripe is not configured.
- Email sending system is optional in first version; backend provides email preview + link for handoff.
- Support staging and production keys with environment-specific config.

## 3) Non-Functional Requirements

- Idempotent data writes for offer/payment updates.
- Auditability: timestamps and statuses for offer/payment transitions.
- Data portability: JSON model should map cleanly to relational DB later.
- Performance: public offer page should load quickly and depend only on backend/API.

## 4) Stripe Pros and Cons

## Advantages

- Fast setup and mature hosted checkout UX.
- Strong security posture and PCI scope reduction when using Checkout.
- Excellent API and webhook ecosystem.
- Good support for multi-currency and future subscription/deposit flows.
- Clear dashboard and reconciliation tooling for operations/finance.

## Disadvantages

- Provider fees can be significant at scale.
- Dependency on external service availability.
- Webhook + async event handling adds implementation complexity.
- Compliance/legal handling still required (tax, invoicing, local rules).
- Checkout UX customization is limited compared to fully custom payment forms.

## 5) Step-by-Step Setup Guide (Website Owner)

## Step 1: Create Stripe Accounts and Keys

1. Create Stripe account and enable test mode.
2. Copy:
   - `STRIPE_SECRET_KEY` (test first, later live)
   - `STRIPE_PUBLISHABLE_KEY` (optional for future frontend use)
3. Store secrets in shell/env (never in source code).

## Step 2: Configure Backend Environment

Add to your shell profile (`~/.zshrc`):

```bash
export STRIPE_SECRET_KEY='sk_test_...'
export STRIPE_WEBHOOK_SECRET='whsec_...'
export STRIPE_CHECKOUT_SUCCESS_URL='https://your-domain/public/offer/{token}?payment=success'
export STRIPE_CHECKOUT_CANCEL_URL='https://your-domain/public/offer/{token}?payment=cancelled'
export PUBLIC_BASE_URL='https://your-domain'
```

Notes:
- If success/cancel URLs are not set, backend auto-falls back to the public offer URL.
- Keep separate values for staging and production.

## Step 3: Configure Stripe Webhook Endpoint

1. In Stripe Dashboard, create webhook endpoint:
   - `POST https://your-backend-domain/webhooks/stripe`
2. Subscribe to event:
   - `checkout.session.completed`
3. Copy signing secret into `STRIPE_WEBHOOK_SECRET`.

## Step 4: Restart Backend

```bash
cd /Users/internal_admin/projects/travelagency/backend/app
npm start
```

## Step 5: Create Customer Offer (Admin API)

Example:

```bash
curl -X POST "http://localhost:8787/api/v1/customers/<customer_id>/offers" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Your Indochina Spring Journey",
    "intro_message": "Tailored route with private guides and comfort pacing.",
    "currency": "USD",
    "due_at": "2026-04-15",
    "items": [
      {
        "tour_id": "tour_0200cf63-b36c-4d8f-a779-412550766d59",
        "customer_notes": "Private airport transfer and slower day-3 pace.",
        "unit_amount_cents": 245000,
        "quantity": 2,
        "travelers": 2,
        "start_date": "2026-04-20",
        "end_date": "2026-04-30"
      }
    ]
  }'
```

Response includes `public_link` to send to customer.

## Step 6: Send Offer Link to Customer

Option A: Use your email tool manually.

Option B: Use backend send-mark endpoint for a send-ready payload:

```bash
curl -X POST "http://localhost:8787/api/v1/offers/<offer_id>/send" \
  -H "Authorization: Bearer <token>"
```

## Step 7: Customer Payment

- Customer opens `https://.../public/offer/<token>`
- Customer clicks `Pay by card`
- Backend creates Stripe checkout session and redirects to Stripe-hosted payment page.

## Step 8: Verify Payment Status

- Webhook marks offer as `PAID` and records payment status.
- Admin can inspect offer/payment via API and data store.

## 6) Implemented Backend Data Structure

Store (`backend/app/data/store.json`) now supports:

- `customer_offers[]`
  - `id`, `customer_id`, `public_token`, `status`
  - `title`, `intro_message`
  - `items[]` (tour snapshots + customer-specific amendments)
  - `payment` (`currency`, `due_at`, `allow_partial`, `deposit_amount_cents`)
  - `created_at`, `updated_at`, `sent_at`, `paid_at`

- `payments[]`
  - `id`, `offer_id`, `customer_id`
  - `provider`, `provider_session_id`, `provider_payment_intent_id`
  - `amount_cents`, `currency`, `status`
  - `created_at`, `updated_at`

## 7) Implemented API and Public Endpoints

Admin/authenticated endpoints:
- `GET /api/v1/customers/:customerId/offers`
- `POST /api/v1/customers/:customerId/offers`
- `GET /api/v1/offers/:offerId`
- `POST /api/v1/offers/:offerId/send`

Public endpoints:
- `GET /public/v1/offers/:token`
- `POST /public/v1/offers/:token/checkout-session`
- `GET /public/offer/:token` (customer-facing page)
- `POST /webhooks/stripe`

## 8) Security Model for Public Links

- Public links use random 24-byte token entropy (`off_<48 hex chars>`).
- URL is shareable but computationally infeasible to guess.
- No list/index endpoint exists for public offers.
- Only exact token resolves a customer offer.

## 9) Recommended Next Steps

1. Add expiration window to public offers (`expires_at`) and enforce it.
2. Add rate limiting on public offer/payment endpoints.
3. Add optional one-time email verification code before showing full customer details.
4. Add webhook handling for `checkout.session.expired` and charge failure events.
5. Add admin UI screens for offer creation and payment monitoring.
