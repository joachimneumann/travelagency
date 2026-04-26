# Marketing Tour Details UI

## Goal

Improve the public homepage marketing tour details panel so each expanded day can show service images in a visual, itinerary-focused layout.

This applies to the public tour grid rendered from `frontend/pages/index.html` through `frontend/scripts/main_tours.js`. The backend marketing-tour editor is out of scope except for ensuring the public generated tour payload contains the required service image fields.

## Final UI Direction

When a visitor expands a tour and opens a day:

- The day header shows the day title only.
- The expanded day body starts with day information, usually the localized day notes.
- Do not show round thumbnail stacks in the day header.
- Do not show service counts such as `5 services`.
- Do not show times.
- Do not show numeric order badges on service images.
- Do not show an extra label such as `Day route information`.
- Show one large featured service card.
- Show the other services as smaller image cards.
- Service title and details overlay the image with a dark gradient for readability.

Reference mockup:

- `mockups/tour-service-images-detail.html`
- `mockups/tour-service-images-detail.png`

## Mockup Guideline

Use `mockups/tour-service-images-detail.png` as the visual guideline for the first implementation.

The intended desktop composition is:

- existing marketing tour card on the left
- details panel on the right
- panel header with `Travel plan` on the left and only the trip duration on the right, for example `3 days`
- expanded day card below the panel header
- day title in the day card header
- day notes directly below the day title
- one large featured service image
- remaining image services as smaller cards to the right
- service title and details overlaid on the image
- no-image services below the visual service layout

The mockup intentionally does not show:

- service times
- numeric service badges
- round day thumbnails
- service-count labels such as `5 services`
- explanatory labels such as `Day route information`
- helper text explaining why a service has no image
- text such as `services in route order`

No-image services should follow the mockup behavior:

- if a service has title and details, show a quiet text row below the image layout
- if a service has only a title, show a smaller compact title-only box
- do not render a fake image placeholder
- do not explain that the service has no image

## Current Code Surface

Primary frontend renderer:

- `frontend/scripts/main_tours.js`

Primary public homepage CSS:

- `shared/css/site-home-critical.css`

Existing relevant renderer functions:

- `renderTourTravelPlanDetails(trip)`
- `renderTourPlanDay(day, index, tripId)`
- `formatTourPlanServiceLine(service)`
- `resolveTravelPlanField(source, fieldName)`
- `absolutizeBackendUrl(urlValue)`

Existing behavior:

- Expanded tour rows already render a side details panel.
- Days are collapsible.
- Services currently render as text lines.

## Data Requirements

Each public tour should expose:

```js
trip.travel_plan.days[].services[]
```

Each service should expose, where available:

```js
service.title
service.title_i18n
service.details
service.details_i18n
service.image_subtitle
service.image_subtitle_i18n
service.image
service.images
```

Image source resolution should support the shapes already used elsewhere:

- `service.image.storage_path`
- `service.image.url`
- `service.image.src`
- `service.images[]`, using primary image first when present
- raw string image URLs if present in legacy data

If the generated public tour JSON does not include service images yet, update the public homepage asset generation path before relying on the UI.

## Rendering Rules

### Day Header

The collapsed/open day toggle should show:

```text
Day 1 - Phu Quoc Airport Pick-Up - Ho Quoc Pagoda - Coconut Tree Prison - Sao Beach - Phu Quoc Night Market
```

Do not include:

- image thumbnails
- service count
- service times
- service order labels

Long day titles should wrap cleanly to two lines on desktop and more naturally on mobile if needed.

### Day Body

The expanded body should render:

1. Day notes, if present.
2. Visual service layout, if at least one service has an image.
3. Text-only fallback services, if needed.

Example structure:

```html
<div class="tour-plan-day__body">
  <p class="tour-plan-day__notes">Start with arrival support...</p>

  <div class="tour-plan-service-media">
    <article class="tour-plan-service-card tour-plan-service-card--featured">
      <img src="..." alt="Airport pick-up" />
      <div class="tour-plan-service-card__body">
        <h5>Airport pick-up</h5>
        <p>Arrival welcome and private transfer.</p>
      </div>
    </article>

    <div class="tour-plan-service-media__side">
      <article class="tour-plan-service-card tour-plan-service-card--small">...</article>
      <article class="tour-plan-service-card tour-plan-service-card--small">...</article>
    </div>
  </div>
</div>
```

### Featured Service

Use the first service with an image as the large featured card.

If the first service has no image but a later service does, the later service becomes featured. Preserve route order for the remaining image cards.

### Smaller Service Cards

Render remaining services with images as smaller cards.

Card text:

- Heading: actual localized service title.
- Body: localized service details, image subtitle, caption, or location, in that fallback order.

Do not use `Service 1`, `Service 2`, etc. as visible text.

### Text-Only Services

If a service has no image:

- Keep it out of the image card layout.
- Render it below the visual layout only if the service has meaningful text.
- If it has title and details, use a quiet full-width text row.
- If it has only a title, use a smaller compact title-only box.
- Do not render a placeholder image.
- Do not add explanatory copy such as "No image is shown".
- Do not show time labels.

If no services have images, keep the existing text-only service list behavior, without times.

## Implementation Steps

1. Add service image helpers in `frontend/scripts/main_tours.js`.

Suggested helpers:

```js
function primaryServiceImage(service) {}
function serviceImageSrc(service) {}
function serviceImageAlt(service) {}
function serviceCardTitle(service) {}
function serviceCardDetails(service) {}
function servicesWithImages(day) {}
```

Use `resolveTravelPlanField()` for localized text.

2. Refactor `formatTourPlanServiceLine(service)`.

Remove time from the public day service text. It should no longer use:

- `time_label`
- `time_point`
- `start_time`
- `end_time`

Service text should prioritize:

- title
- location
- details

3. Refactor `renderTourPlanDay(day, index, tripId)`.

Change the day toggle to render only the heading and plus/minus icon.

Remove header thumbnail markup and service-count text.

In the body:

- render notes first
- render service media layout when images exist
- render text-only fallback when useful

4. Add `renderTourPlanServiceMedia(day)`.

Behavior:

- Build a list of services with valid image sources.
- First image service becomes featured.
- Remaining image services render in the side grid.
- Escape all text and attributes.
- Use lazy loading for service images.

5. Add CSS in `shared/css/site-home-critical.css`.

Core classes:

```css
.tour-plan-service-media {}
.tour-plan-service-card {}
.tour-plan-service-card--featured {}
.tour-plan-service-media__side {}
.tour-plan-service-card--small {}
.tour-plan-service-card__body {}
.tour-plan-text-services {}
.tour-plan-text-service {}
.tour-plan-text-service--title-only {}
```

Desktop layout:

- `tour-plan-service-media`: two columns.
- left column: large featured card.
- right column: two-column grid of smaller cards.

Mobile layout:

- stack everything in one column.
- keep the featured card first.
- smaller cards become a single-column list or two-column grid only if the width supports it.

6. Keep the existing expansion behavior.

Do not change:

- tour-card expand/collapse state
- side-panel row behavior
- animation behavior
- booking modal CTA behavior

7. Update generated CSS copies only if the project requires it.

The public page currently loads `shared/css/site-home-critical.css`. If generated bundled assets are committed as part of deployment, regenerate them after the source changes.

## Accessibility

- Use service title as image `alt` text.
- If the image object has localized `alt_text`, prefer it.
- Overlay text must have enough contrast against images.
- Keep the existing day toggle button semantics:
  - `aria-expanded`
  - `aria-controls`
- Do not put interactive controls inside service image cards unless a future image preview feature is added.

## Edge Cases

- Day has notes and no services: show notes only.
- Day has services and no images: show text-only service list.
- Day has one image service: show one large card only.
- Day has many image services: show featured card plus side cards; the day panel can scroll.
- Long service titles: clamp to two lines on small cards if needed.
- Missing service title: fall back to `image_subtitle`, `location`, then a generic localized `Service`.
- Missing service details: omit the paragraph instead of showing empty space.

## Verification Checklist

- Expand a tour with travel-plan days.
- Open a day with service images.
- Confirm the day header has no round thumbnails and no service count.
- Confirm no times are displayed.
- Confirm no numeric badges are displayed on service images.
- Confirm the day notes appear above the image layout.
- Confirm the first image service is large.
- Confirm remaining image services are smaller cards with text overlay.
- Confirm text-only services still appear when they have no image.
- Confirm title-only no-image services render as compact boxes.
- Confirm no-image services do not show placeholder images or explanatory helper text.
- Confirm the panel header only says the duration, for example `3 days`, and does not append `services in route order`.
- Check desktop, tablet, and mobile widths.
- Check long day titles and long service titles.
- Check keyboard expand/collapse behavior.
