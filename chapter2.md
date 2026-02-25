# Chapter2.live - Current Page Structure

## 1) Document head

- `title`: `Chapter 2 | Custom Southeast Asia Holidays`
- `meta description`: private holidays in Vietnam, Thailand, Cambodia, Laos
- Canonical URL: `https://chapter2.live/`
- Open Graph + Twitter metadata present
- Favicon + web manifest linked
- Main stylesheet: `assets/css/styles.css`

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

- Full-width background video (`assets/video/rice field.mp4`)
- Poster image (`assets/img/flickr/hero-flickr.jpg`)
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
- Filter state from URL params/localStorage (`chapter2_filters`)
- URL sync with `?dest=...&style=...`
- Dynamic page title and section copy based on filters
- Card CTA opens lead modal and pre-fills destination/style

Current inventory:
- 28 trip entries in `data/trips.json` (4 countries x 7 travel styles)
- Destinations represented: Vietnam, Thailand, Cambodia, Laos
- Styles include: Adventure, Beach, Budget, Culture, Family, Food, Luxury
- One tour per country/style combination with IDs in the form `trip-<country>-<style>`
- Tour images now come from `assets/tours/<country>/<style>/<country>-<style>.jpg`
- Embedded `tripsFallback` JSON in `index.html` is synchronized to the same 28 records

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
- Supporting illustration (`assets/img/support-local-team.svg`)

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
- Supporting image (`assets/img/support-happy-travelers.svg`)

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
- destination, style, month, travelers, budget

Step 2: Contact details
- name, email, phone/WhatsApp, language

Step 3: Notes and consent
- optional notes + required consent checkbox

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
- Dynamic tours section heading/lead and document title
- FAQ accordion
- Image fallback handling on card thumbnails
- Modal lead capture with 3-step progression
