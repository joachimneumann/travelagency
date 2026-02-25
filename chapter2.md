# Chapter2.live - Current Page Structure

## 1) Document head

- `title`: `Chapter 2 | Custom Southeast Asia Holidays`
- `meta description`: private holidays in Vietnam, Thailand, Cambodia, Laos
- Canonical URL: `https://chapter2.live/`
- Open Graph + Twitter metadata present
- Favicon + web manifest linked
- Main stylesheet: `assets/css/styles.css` loaded with preload + non-blocking apply (`?v=3`)
- LCP hero poster preloaded from `assets/video/rice field.webp?v=2`
- Hero video preloaded from `assets/video/rice field.webm`
- Small inline critical CSS block included for initial header/hero paint

## 2) Global layout

- Skip link to `#main-content`
- Header with logo, mobile nav toggle, main navigation
- Main content sections (hero to contact)
- Footer
- Sticky mobile CTA
- Modal lead form (3-step)
- Trips fallback JSON script
- Main JS bundle: `assets/js/main.js`
- Structured data scripts (`TravelAgency`, `WebSite`)
- All `.webp` images in the project are normalized to a maximum bounding box of `600x600` while preserving aspect ratio
- Cache headers config file present at `_headers` (long-lived assets + `no-store` for `data/trips.json`)

## 3) Header and navigation (`#top`)

- Brand logo (`assets/img/logo-chapter2.svg`)
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

- Full-width background video (primary `assets/video/rice field.webm` with `assets/video/rice field.mp4` fallback)
- Poster image (`assets/video/rice field.webp`)
- Video container has outer margin and rounded corners
- No dark scrim over video; hero title uses a semi-transparent white background for legibility
- Hero hides subtitle text below the H1 only when both filters are `All`; otherwise it shows the active filter title
- Hero shows only a centered down-arrow link to `#tours`
- Hero title tile remains centered; dynamic subtitle tile is horizontally centered near the bottom of the hero
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
- Trips loaded from `data/trips.json` (fallback from embedded JSON)
- Trip data is fetched with cache-busting query versioning and `cache: reload`
- Filter state from URL params/localStorage (`chapter2_filters`)
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
- Card CTA opens lead modal and pre-fills destination/style
- A bottom-page `Debug priority` button reveals per-tour ranking diagnostics for the current filter (`priority`, `random`, `sum`) in display order

Current inventory:
- 32 trip entries in `data/trips.json` (includes multiple variants within the same country/style)
- Destinations represented: Vietnam, Thailand, Cambodia, Laos
- Styles include: Adventure, Beach, Budget, Culture, Family, Food, Luxury
- Multiple tours per country/style are supported with IDs in the form `trip-<country>-<style>-<variant>`
- Tour images follow `assets/tours/<country>/<style>/<country>-<style>-<variant>.webp`
- Each tour entry includes `priority` (human-writable, intended range `0-100`)
- Sync script never overwrites existing `priority`; only brand-new tours default to `50`
- Embedded `tripsFallback` JSON in `index.html` is synchronized to the same dataset
- Maintenance helper script available at `assets/tours/to_webp.sh` for non-WebP conversion and cleanup
- Dataset sync script available at `scripts/sync_tours_from_images.py` to infer and generate JSON tour content from image variant names

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

- H2 + supporting lead text
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
  - Secondary: `Email us directly` (`mailto:hello@chapter2.live`)
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
  - Opens the lead modal

## 7) Lead modal form (`#leadModal`)

- Modal title: `Plan your trip with Chapter 2`
- Progress indicator with 3 steps
- Multi-step form (`#leadForm`) with validation

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
- fallback mailto link (`hello@chapter2.live`)

## 8) Structured data

Two JSON-LD blocks:
- `TravelAgency`
- `WebSite` (with `SearchAction`)

## 9) Key dynamic/interactive features summary

- Mobile menu toggle
- Filterable tours with URL/localStorage persistence
- Tour list progressive reveal (up to 3 initially, then incremental show-more controls)
- Dynamic tours section heading/lead and document title
- FAQ accordion
- Image fallback handling on card thumbnails
- Modal lead capture with 3-step progression
