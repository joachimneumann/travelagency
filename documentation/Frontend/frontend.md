# AsiaTravelPlan - Current Page Structure

## 0) Live brand and domain status

- Production domain is owned: `asiatravelplan.com`
- Primary business mailbox is active via Google Workspace: `info@asiatravelplan.com`
- Public website and contact copy should use `asiatravelplan.com` and `info@asiatravelplan.com` as the source of truth
- Registrar/DNS and Google Workspace account setup are no longer placeholders for this project

## 1) Document head

- `title`: `AsiaTravelPlan | Custom Southeast Asia Holidays`
- `meta description`: private holidays in Vietnam, Thailand, Cambodia, Laos
- Canonical URL: `https://asiatravelplan.com/`
- Open Graph + Twitter metadata present
- Favicon + web manifest linked
- Main stylesheet: `shared/css/styles.css` loaded directly as a normal stylesheet
- LCP hero poster preloaded from `assets/video/rice field.webp`

## 2) Global layout

- Skip link to `#main-content`
- Header with logo, mobile nav toggle, main navigation
- Main content sections (hero to contact)
- Footer
- Sticky mobile CTA
- Modal booking form (3-step)
- Backend-only tours API integration script
- Main JS bundle: `frontend/scripts/main.js`
- Structured data scripts (`TravelAgency`, `WebSite`)
- Tour hero images managed by backend are converted to WebP and resized to a maximum bounding box of `1000x1000`
## 3) Header and navigation (`#top`)

- Brand logo (`assets/img/logo-asiatravelplan.svg`)
- Mobile menu toggle button (`#navToggle`)
- Anchor links:
  - `#why`
  - `#trust`
  - `#faq`
  - `#contact`

## 4) Main sections

### 4.1 Hero (`#hero`)

- Full-width background video (`assets/video/rice field.webm`) with `assets/video/rice field.mp4` secondary format
- Poster image (`assets/video/rice field.webp`)
- Video container is now full-bleed with no outer margin or rounded corners
- A dark scrim sits over the video for legibility
- H1 (`#heroTitle`) is generated from the published destination list in the generated static tours payload (`frontend/data/generated/homepage/public-tours.<lang>.json`)
- Hero controls:
  - destination multi-select (`#navDestinationWrap`) is shown only when more than one destination is published on the website
  - travel-style multi-select (`#navStyleTrigger`)
  - primary CTA button (`#viewToursBtn`)
- If exactly one destination is published, the title collapses to that country and the destination selector is fully hidden
- If multiple destinations are published, the title uses the localized published-destination list and the destination selector is shown

### 4.2 Tours (`#tours`)

- Dynamic card grid (`#tourGrid`)
- Empty-state message (`#noResultsMessage`)
- The tours title, subtitle, and active filter summary are present in markup but hidden from display
- Tour card thumbnails use `aspect-ratio: 1/1` (square) with full width and `object-fit: cover`

Behavior from JS:
- Trips are loaded from generated static frontend data files at `frontend/data/generated/homepage/public-tours.<lang>.json`
- Team members are loaded from generated static frontend data at `frontend/data/generated/homepage/public-team.json`
- Filter state persists via URL params and `localStorage` (`asiatravelplan_filters`)
- URL sync with `?dest=...&style=...`
- Destination filter options come only from destinations currently published on the website
- Destination filters are automatically cleared when the destination selector is hidden because zero or one destinations remain
- Dynamic page title and hidden tours heading/subtitle still update based on filters
- On each new filter application, tours are ranked by `priority + random(0..50)` before display
- Initially up to 6 tours are shown
- If more tours exist, one `Show all {count} tours` button reveals the remaining results
- Card CTA opens booking modal and pre-fills destination/style
- A bottom-page `Debug priority` button reveals per-tour ranking diagnostics for the current filter (`priority`, `random`, `sum`) in display order

Current inventory:
- Tour source files live under `content/tours/<tour_id>/tour.json`
- Public destination availability is further constrained by `content/country_reference_info.json`
- Public homepage tour JSON is generated to `frontend/data/generated/homepage/public-tours.<lang>.json`
- Public homepage team JSON is generated to `frontend/data/generated/homepage/public-team.json`
- Tour images for the homepage are copied to `assets/generated/homepage/tours/<tour_id>/<file>`
- Staff photos for the homepage are copied to `assets/generated/homepage/team/<file>`
- Each tour entry includes `priority` (human-writable, intended range `0-100`)
- Sync script never overwrites existing `priority`; only brand-new tours default to `50`
- Maintenance helper script available at `assets/tours/to_webp.sh` for non-WebP conversion and cleanup

Homepage source-of-truth model:
- `content/tours/**` remains the editable tour source of truth
- `content/atp_staff/staff.json` remains the editable public team source of truth
- `content/atp_staff/photos/*` remains the editable staff photo source of truth
- `backup/**` is backup only and is not used by runtime homepage generation
- `scripts/assets/generate_public_homepage_assets.mjs` regenerates the public homepage artifacts and should be rerun after changing tour/team homepage content

### 4.3 Trust strip (after tours)

- 4 stat tiles:
  - `4.9/5 traveler rating`
  - `13+ years`
  - `24/7 support`
  - `$500+/week fit`

### 4.4 How it works (`#how-it-works`)

- H2: planning process
- 4 step cards:
  - Free discovery call
  - Route options in 48-72h
  - Refine and confirm
  - Travel with support

### 4.5 Why us (`#why`)

- H2 + bullet-point value proposition
- Supporting illustration (`assets/img/tourist_guides.webp`)

### 4.6 Trust and reviews (`#trust`)

- H2 + supporting booking text
- Metrics row:
  - `96%` proposal-to-booking satisfaction
  - `48-72h` initial proposal time
  - `4 countries` coverage
- 3 testimonial cards

### 4.7 FAQ (`#faq`)

- H2 + FAQ list with 6 questions
- Accordion behavior implemented in JS:
  - per-item open/close
  - `aria-expanded` updates
  - icon toggles `+` / `−`

### 4.8 Contact / primary conversion (`#contact`)

- H2: `Book your free discovery call`
- Benefits list (local experts, clear inclusions, fast proposal, on-trip support)
- CTA row:
  - Primary: `Start planning now` (opens modal)
  - Secondary: `Email us directly` (`mailto:info@asiatravelplan.com`)
- Response-time microcopy
- 3 additional review cards
- Supporting image (`assets/img/happy_tourists.webp`)

## 5) Footer

3 columns:
- Company summary + website
- Contact details (address, WhatsApp, email, license placeholder)
- Social links (placeholder URLs)

## 6) Mobile conversion element

- Sticky bottom CTA button:
  - `Book a free discovery call`
  - Opens the booking modal

## 7) Booking modal form (`#bookingModal`)

- Modal title: `Plan your trip with AsiaTravelPlan`
- Progress indicator with 3 steps
- Multi-step form (`#bookingForm`) with validation

Step 1: Trip basics
- destination, style, month, travelers, travel duration, budget lower/upper in USD

Step 2: Contact details
- name, email, phone/WhatsApp, language

Step 3: Notes
- optional notes

Form UX behavior from JS:
- next/back step controls
- per-field required validation
- modal open/close + ESC handling
- success block shown after submit flow
- inline error message shown when backend submission fails

## 8) Structured data

Two JSON-LD blocks:
- `TravelAgency`
- `WebSite` (with `SearchAction`)

## 9) Key dynamic/interactive features summary

- Mobile menu toggle
- Filterable tours with URL/localStorage persistence for active filters
- Conditional hero destination selector based on published destinations
- Dynamic hero title derived from the published destination list
- Tour list progressive reveal (6 initially, then reveal all remaining)
- Dynamic tours section heading/booking and document title
- FAQ accordion
- Tour image prewarm for faster first render
- Modal booking capture with 3-step progression

## 10) Frontend CSS architecture (current)

- `shared/css/styles.css` is now an entrypoint only
- Current imported layers:
  - `shared/css/tokens.css`
  - `shared/css/base.css`
  - `shared/css/utilities.css`
  - `shared/css/site.css`
  - `shared/css/components/*.css`
  - `shared/css/pages/*.css`
- `shared/css/site.css` contains shared site and backend styles, but page-specific overrides now live in `shared/css/pages/*.css`
- New styles must be added to modular files under:
  - `shared/css/tokens.css`
  - `shared/css/base.css`
  - `shared/css/components/*.css`
  - `shared/css/pages/*.css` for page-scoped styling
- Reusable spacing/visibility helpers now live in `shared/css/utilities.css`
- Naming convention for new styles:
  - BEM classes only (example: `backend-nav__logout`, `backend-login__user`)
  - Avoid introducing new ID-based style selectors
