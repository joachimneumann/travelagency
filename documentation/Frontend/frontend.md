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
- Main stylesheet: `shared/css/styles.css` loaded directly as a normal stylesheet (`?v=3`)
- LCP hero poster preloaded from `assets/video/rice field.webp?v=2`

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
- Filter controls embedded in nav:
  - Destination select (`#navDestination`)
  - Travel style select (`#navStyle`)
  - Clear filters button (`#clearFilters`)
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
- Hero hides subtitle text below the H1 only when both filters are `All`; otherwise it shows the active filter title
- Hero shows only a centered down-arrow link to `#tours`
- Hero title remains centered without a boxed title tile; dynamic subtitle link is horizontally centered near the bottom of the hero
- Hover/focus interaction at hero bottom highlights only the arrow circle (not the full subtitle link area)
- Arrow click uses smooth scrolling with sticky-header offset so the hero exits view while top spacing in the tours section remains visible
- H1:
  - `Private holidays in Vietnam, Thailand, Cambodia and Laos`

### 4.2 Tours (`#tours`)

- Dynamic card grid (`#tourGrid`)
- Empty-state message (`#noResultsMessage`)
- The tours title, subtitle, and active filter summary are present in markup but hidden from display
- Tour card thumbnails use `aspect-ratio: 1/1` (square) with full width and `object-fit: cover`

Behavior from JS:
- Trips are loaded from backend `GET /public/v1/tours` (primary source)
- Backend responses are cached in localStorage (`asiatravelplan_tours_cache_v1`) with TTL
- Filter state from URL params/localStorage (`asiatravelplan_filters`)
- URL sync with `?dest=...&style=...`
- Dynamic page title and hidden tours heading/subtitle still update based on filters
- On each new filter application, tours are ranked by `priority + random(0..50)` before display
- Initially up to 3 tours are shown
- If more tours exist, the first reveal button appears (capped at 3):
- No active filters: `show more tours`
- Style filter active: `show X more <style> tours` (example: `show 3 more adventure tours`)
- Destination-only filter active: `show X more tours in <destination>`
- Only after clicking `Show more`, a `Show the remaining X tours` button can appear to reveal the rest
- If exactly one tour remains, the second button label becomes `There is one more tour`
- Progressive reveal buttons are horizontally centered below the tour grid
- Card CTA opens booking modal and pre-fills destination/style
- A bottom-page `Debug priority` button reveals per-tour ranking diagnostics for the current filter (`priority`, `random`, `sum`) in display order

Current inventory:
- 32 trip entries in backend tour storage (`backend/app/data/tours/<tour_id>/tour.json`)
- Destinations represented: Vietnam, Thailand, Cambodia, Laos
- Styles include: Adventure, Beach, Budget, Culture, Family, Food, Luxury
- Multiple tours per country/style are supported with IDs in the form `trip-<country>-<style>-<variant>`
- Tour images are served by backend under `/public/v1/tour-images/<tour_id>/<tour_id>.webp`
- Each tour entry includes `priority` (human-writable, intended range `0-100`)
- Sync script never overwrites existing `priority`; only brand-new tours default to `50`
- Maintenance helper script available at `assets/tours/to_webp.sh` for non-WebP conversion and cleanup

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
- destination, style, month, travelers, travel duration, budget

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
- Filterable tours with URL/localStorage persistence
- Tour list progressive reveal (up to 3 initially, then incremental show-more controls)
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
  - `shared/css/tailwind.generated.css`
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
- Tailwind + PurgeCSS toolchain scaffold lives in `frontend/`:
  - `frontend/package.json`
  - `frontend/tailwind.config.cjs`
  - `frontend/postcss.config.cjs`
  - Input: `shared/css/tailwind.input.css`
  - Output: `shared/css/tailwind.generated.css`
