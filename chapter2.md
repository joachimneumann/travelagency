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
- H1:
  - `Private holidays in Vietnam, Thailand, Cambodia and Laos`

### 4.2 Tours (`#tours`)

- H2: `Featured tours you can tailor`
- Intro text for filtering behavior
- Active filter summary area (`#activeFilters`)
- Dynamic card grid (`#tourGrid`)
- Empty-state message (`#noResultsMessage`)

Behavior from JS:
- Trips loaded from `data/trips.json` (fallback from embedded JSON)
- Trip data is fetched with cache-busting query versioning and `cache: reload`
- Filter state from URL params/localStorage (`chapter2_filters`)
- URL sync with `?dest=...&style=...`
- Dynamic page title and section copy based on filters
- Active filter summary remains visible above the grid with italic text and color-highlighted active filter values (not button-styled)
- Spacing between the section subtitle and active filter summary is intentionally tight
- Initially up to 3 tours are shown
- If more tours exist, a contextual `show more tours (<destination>, <style>)` button appears (first reveal capped at 3)
- Only after clicking `Show more`, a `Show the remaining X tours` button can appear to reveal the rest
- If exactly one tour remains, the second button label becomes `There is one more tour`
- Card CTA opens lead modal and pre-fills destination/style

Current inventory:
- 32 trip entries in `data/trips.json` (includes multiple variants within the same country/style)
- Destinations represented: Vietnam, Thailand, Cambodia, Laos
- Styles include: Adventure, Beach, Budget, Culture, Family, Food, Luxury
- Multiple tours per country/style are supported with IDs in the form `trip-<country>-<style>-<variant>`
- Tour images follow `assets/tours/<country>/<style>/<country>-<style>-<variant>.webp`
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
- Tour grid capped at 6 cards with random selection when more than 6 match filters
- Dynamic tours section heading/lead and document title
- FAQ accordion
- Image fallback handling on card thumbnails
- Modal lead capture with 3-step progression
