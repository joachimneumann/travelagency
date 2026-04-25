# Marketing Tour Details Expansion

## Summary

The change is feasible and fits the current homepage architecture. This concept applies only to the public homepage tour grid, not to the backend tour list. The public tour grid is rendered from `frontend/scripts/main_tours.js`, styled through `shared/css/site-home-critical.css` and `shared/css/site-home-deferred.css`, and the generated public tour JSON already contains `travel_plan.days`.

The main implementation choice is how strictly to interpret "same row cards move into the next row". A simple CSS-only `grid-column: 1 / -1` expansion is not enough, because if the user clicks the second or third card in a row, earlier cards in that row can remain above the expanded card. To satisfy the requested behavior, the renderer should group visible tours by row and deliberately render the expanded tour as a full-width row before rendering the other cards from that same row.

My opinion: this is a good change if the travel plans are concise and useful. It gives visitors more confidence without forcing them into the booking modal. The main risk is layout movement: moving neighboring cards down is visually clear, but it can feel jumpy if users repeatedly expand cards. The interaction needs smooth spacing, clear multi-expanded behavior, and careful mobile behavior.

## Current State

- The homepage tour grid lives in `frontend/pages/index.html` under `#tourGrid`.
- Tour cards are rendered by `renderTrips()` in `frontend/scripts/main_tours.js`.
- The backend tour list in `frontend/pages/marketing_tours.html` and `frontend/scripts/pages/tours_list.js` is out of scope for this change.
- The page has two different "more" concepts today:
  - `#showMoreTours` shows all remaining tours.
  - The small description toggle opens a description overlay.
- The per-tour CTA button currently uses `data-tour-card-show-more` and the label "Show more", but it does not yet render inline tour details.
- Public generated tour data already includes `travel_plan: { days: [...] }`, so the first version should not need a new public API endpoint.

## Step 1: Navigation And Row Expansion

### Desired Behavior

When a visitor clicks a tour card's "Show more" button:

1. That tour is expanded. More than one tour may be expanded at the same time.
2. The selected tour gets a full-width row in the tour grid.
3. Inside that full-width row:
   - the tour card remains on the left
   - the right side is reserved for details
   - in Step 1, the right side can be empty or show a minimal placeholder
4. The other cards that were originally in the same row move to the row below.
5. The clicked button changes to "Show less".
6. Clicking "Show less" collapses the selected tour and recalculates the row layout. If no other tours from that original row are expanded, the cards move back into their original row. If another tour from that row remains expanded, the collapsed card joins the non-expanded cards below the remaining expanded row.

If a tour has no `travel_plan.days`, its card-level "Show more" button should be disabled. The disabled state should make clear that there is no detailed plan available for that tour yet.

When a tour does have a travel plan, append the tour duration after the tour title:

- use `1D` for a one-day tour
- use `{days}D{nights}N` for tours longer than one day

The day count should come from `trip.travel_plan.days.length`. The night count should be one less than the day count, so a three-day tour displays as `3D2N`.

### Recommended Layout Algorithm

Use row-aware rendering instead of relying on CSS grid placement alone.

1. Compute the current number of grid columns:
   - desktop: 3 columns
   - tablet: 2 columns
   - mobile: 1 column
2. Slice the visible tours into rows using the same breakpoints as CSS.
3. If no tours are expanded, render the grid normally.
4. If one or more tours in a row are expanded:
   - render all rows before that row normally
   - render each expanded tour from that row as its own full-width expanded row, preserving the original tour order
   - render the remaining non-expanded tours from that original row after the expanded row or rows
   - render the following rows normally

This satisfies the requested behavior for first, middle, and last cards in a row.

### Suggested Markup Shape

```html
<article class="tour-details-row" data-expanded-tour-id="...">
  <div class="tour-details-row__card">
    <!-- existing tour card markup, with Show less button -->
  </div>
  <aside class="tour-details-row__panel" id="tour-details-...">
    <!-- Step 1: empty/reserved -->
    <!-- Step 2: travel plan accordion -->
  </aside>
</article>
```

The expanded row should be a single grid item:

```css
.tour-details-row {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: minmax(260px, 0.9fr) minmax(0, 1.6fr);
  gap: 1.25rem;
  align-items: stretch;
}
```

On mobile, it should stack:

```css
@media (max-width: 760px) {
  .tour-details-row {
    grid-template-columns: 1fr;
  }
}
```

### State And Events

Add frontend state:

```js
expandedTourIds: new Set()
```

Expected event rules:

- Clicking "Show more" adds that tour id to `expandedTourIds` and re-renders visible tours.
- Clicking "Show less" removes that tour id from `expandedTourIds` and re-renders visible tours.
- Clicking another tour's "Show more" should not close already expanded tours.
- Changing filters should not clear `expandedTourIds`. If an expanded tour still matches the new filters, it remains visible and expanded. If it no longer matches, it disappears from the rendered grid but may reappear expanded if a later filter change includes it again.
- Changing language should keep the expanded tours open. Only the rendered text should change.
- Clicking the global "Show all tours" should keep any expanded tours that are included in the rendered set.
- Resizing the viewport should re-render because the number of columns changes.

Accessibility:

- The button should set `aria-expanded="true"` when open.
- The button should set `aria-controls` to the expanded details panel id.
- Disabled "Show more" buttons for tours without travel-plan days should use the native `disabled` attribute.
- Focus should remain on the clicked button after re-render, or be restored to the equivalent button in the new DOM.

## Step 2: More Details Travel Plan

### Desired Behavior

The right side of the expanded row shows a simple travel plan UI:

- Each day is initially collapsed.
- The day title line shows `Day 1`, `Day 2`, etc. plus the day title when available.
- Expanding a day shows:
  - the day details
  - a bullet list of services
- The right-side panel is scrollable.
- Tours without travel-plan days do not open this UI because their "Show more" button is disabled.

### Data Mapping

Use the existing public tour object:

```js
trip.travel_plan.days
```

Day fields to render:

- `day.day_number`
- `day.title`
- `day.title_i18n`
- `day.notes`
- `day.notes_i18n`
- `day.services`

Service fields to render in bullet points:

- `service.time_label` or `service.time_point`
- `service.title`
- `service.title_i18n`
- `service.location`
- `service.location_i18n`
- `service.details`
- `service.details_i18n`

Service bullets should combine available fields into one compact line. Recommended order:

```text
Time - Title - Location
```

If details are short, they may be appended after the title or location. If details are long, keep them out of the bullet line or clamp/truncate them so the service list remains scannable. The UI should avoid very long single-line bullets by using CSS such as `line-clamp`, `overflow-wrap`, or a maximum character count in the renderer.

The generated JSON is already language-specific for top-level tour fields, but the travel plan still includes several `*_i18n` fields. The renderer should use a small helper that resolves the current frontend language, then falls back to English, then to the plain field.

### Suggested UI

Use a local accordion pattern, either with native `details/summary` or with buttons matching the existing FAQ behavior. I recommend buttons for consistency with the current homepage FAQ.

Example structure:

```html
<div class="tour-plan">
  <article class="tour-plan-day">
    <button class="tour-plan-day__toggle" type="button" aria-expanded="false">
      <span>Day 1 - Arrival in Hanoi</span>
      <span aria-hidden="true">+</span>
    </button>
    <div class="tour-plan-day__body" hidden>
      <p>Day details...</p>
      <ul>
        <li>09:00 - Airport pickup - Hanoi</li>
        <li>Private transfer to hotel - Old Quarter</li>
      </ul>
    </div>
  </article>
</div>
```

Use hyphenated fallback text:

- If a day has no title: `Day 1`
- If a day has no details: omit the paragraph
- If a day has no services: show a quiet empty state such as `No services listed yet.`

### Scroll Behavior

On desktop and tablet, the right detail panel should be independently scrollable:

```css
.tour-details-row__panel {
  max-height: min(70vh, 720px);
  overflow-y: auto;
}
```

On mobile, prefer normal page scroll instead of a nested scroll area:

```css
@media (max-width: 760px) {
  .tour-details-row__panel {
    max-height: none;
    overflow: visible;
  }
}
```

Nested scrolling on mobile often feels awkward, especially inside a long homepage.

## Implementation Plan

1. Refactor tour card rendering in `frontend/scripts/main_tours.js`.
   - Extract the existing card HTML into a helper such as `renderTourCard(trip, options)`.
   - Add a helper such as `formatTourDurationSuffix(trip)` and append it after the tour title when `trip.travel_plan.days` exists.
   - Keep the button labels as "Show more" and "Show less".
   - Let the helper render either "Show more" or "Show less" based on whether the tour id is present in `expandedTourIds`.
   - Disable the card-level "Show more" button when `trip.travel_plan.days` is empty or missing.

2. Add row-aware rendering.
   - Add `getTourGridColumnCount()` using `window.matchMedia`.
   - Update `renderTrips()` to render normal rows and the expanded full-width row in the correct order.
   - Support multiple expanded tours, including multiple expanded tours from the same original row.
   - Add a resize listener that re-renders only when the column count changes.

3. Add expanded row markup and Step 1 placeholder.
   - Add a full-width `.tour-details-row`.
   - Keep the selected tour card on the left.
   - Render an empty right panel or a minimal placeholder in Step 1.

4. Add Step 2 travel plan rendering.
   - Add `renderTourTravelPlanDetails(trip)`.
   - Add `renderTourPlanDay(day, index, tripId)`.
   - Add `formatTourPlanServiceLine(service)` to combine time, title, details, and location when available while keeping the line short.
   - Add localized text helpers for `*_i18n` fields.
   - Add delegated click handling for day accordion toggles.

5. Add CSS.
   - Put critical layout CSS in `shared/css/site-home-critical.css`.
   - Put accordion/detail polish in `shared/css/site-home-deferred.css` if it is not needed for first paint.
   - Keep mobile stacked and avoid nested scrolling on small screens.
   - Clamp or wrap service bullet text so one service cannot make the panel too wide.

6. Add or update i18n keys.
   - `tour.card.show_more`
   - `tour.card.show_less`
   - `tour.plan.no_days`
   - `tour.plan.no_services`
   - `tour.plan.day_label`
   - `tour.plan.details_unavailable` if the disabled button needs a tooltip or accessible explanation.

7. Verify manually.
   - Desktop: click first, middle, and last cards in a 3-column row.
   - Desktop: expand multiple tours at the same time, including two tours from the same original row.
   - Tablet: click first and second cards in a 2-column row.
   - Mobile: confirm the expanded row stacks cleanly.
   - Confirm "Show less" restores only that tour to the normal grid while other expanded tours stay open.
   - Confirm tours without travel-plan days have a disabled "Show more" button.
   - Confirm filter changes keep matching expanded tours open and hide non-matching expanded tours.
   - Confirm language changes keep expanded tours open and update the rendered text.
   - Confirm global "Show all tours", gallery image cycling, booking modal CTA, and description "more" still work.

## Alternative Idea

The lower-risk alternative is to keep the current card row stable and insert a full-width details panel below the entire row, instead of moving same-row cards below the selected tour.

That version would:

- reduce layout jump
- preserve visual scanability of the row
- be simpler to implement
- keep DOM order closer to visual order

The tradeoff is that the selected card would not truly take the whole horizontal row by itself. If the exact requested behavior is important, use the row-aware expansion plan above. If the priority is a calmer browsing experience, the below-row detail panel is probably better.

Another alternative is a side drawer or modal. I would avoid that for the first version because the travel plan is useful browsing content, and keeping it inline makes comparison between tours easier.

## Recommendation

Implement the requested row-aware inline expansion. It is feasible with the current static tour data and should not require backend changes.

Keep the public button labels as "Show more" and "Show less". The implementation can still distinguish this card-level action from the global tour loading control by using specific data attributes such as `data-tour-card-show-more`.
