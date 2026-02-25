# Chapter2 Backend App (Milestone 1)

This service implements Milestone 1 from `backend/backend_software.md`:
- Lead ingestion API
- Customer deduplication and profile creation
- Lead pipeline stages and transitions
- Owner assignment with workload balancing
- SLA due timestamps
- Lead activity timeline
- Simple admin pages for pipeline and lead detail

## Run

```bash
cd backend/app
npm start
```

Default URL: `http://localhost:8787`

Environment variables:
- `PORT` (default `8787`)
- `CORS_ORIGIN` (default `*`)
- `ADMIN_API_TOKEN` (default `change-me-local`) for all `/api/v1/*` endpoints

## Data Storage

JSON files are used for local persistence:
- `data/store.json`
- `config/staff.json`

## API Endpoints

Public:
- `POST /public/v1/leads`

Admin API:
- `GET /api/v1/leads`
- `GET /api/v1/leads/:leadId`
- `PATCH /api/v1/leads/:leadId/stage`
- `PATCH /api/v1/leads/:leadId/owner`
- `GET /api/v1/leads/:leadId/activities`
- `POST /api/v1/leads/:leadId/activities`
- `GET /api/v1/customers`
- `GET /api/v1/customers/:customerId`

`/api/v1/*` authentication:
- `Authorization: Bearer <ADMIN_API_TOKEN>`
- For browser-only local admin usage, `?api_token=<ADMIN_API_TOKEN>` query param is also accepted.

Lead list query params (`GET /api/v1/leads`):
- `page` (default `1`)
- `page_size` (default `25`, max `100`)
- `stage` (`NEW|QUALIFIED|PROPOSAL_SENT|NEGOTIATION|WON|LOST|POST_TRIP`)
- `owner_id` (exact match)
- `search` (matches lead id, destination, style, owner, notes, customer name/email)
- `sort` (`created_at_desc`, `created_at_asc`, `updated_at_desc`, `sla_due_at_asc`, `sla_due_at_desc`)

Default ordering:
- Leads: newest first (`created_at desc`)
- Customers: newest first (`created_at desc`, fallback `updated_at`)

Admin UI:
- `GET /admin`
- `GET /admin/leads`
- `GET /admin/leads/:leadId`
- `GET /admin/customers`
- `GET /admin/customers/:customerId`

Health:
- `GET /health`

## Example Lead Request

```bash
curl -X POST http://localhost:8787/public/v1/leads \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: demo-001' \
  -d '{
    "destination": "Vietnam",
    "style": "Adventure",
    "travelMonth": "November",
    "duration": "10-14 days",
    "travelers": "2",
    "budget": "$2500-$3500",
    "name": "Alex Morgan",
    "email": "alex@example.com",
    "phone": "+1 415 555 0100",
    "language": "English",
    "notes": "Interested in private guides and food tours",
    "utm_source": "google",
    "utm_medium": "cpc",
    "utm_campaign": "sea_winter",
    "pageUrl": "https://chapter2.live/",
    "referrer": "https://google.com"
  }'
```

## Seed Test Data

```bash
cd backend/app
npm run seed -- --count 40
```
