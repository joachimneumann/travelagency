# SEO Plan for Marketing Tour URLs

## Goal

The public homepage currently works as a one-pager with expandable marketing tour cards. This is good for the user experience, but weak for SEO because each tour does not have its own crawlable, shareable, indexable URL.

The target is to keep the one-page experience for users while giving search engines a real URL and real HTML document for every marketing tour.

## Recommended approach

Create one canonical URL per marketing tour, for example:

- `/tours/phu-quoc-4d3n`
- `/tours/da-nang-hue-hoi-an`
- `/tours/vietnam-family-adventure`

Each URL should return a real HTML response generated from the same marketing tour data used by the homepage. The homepage can still behave like a one-pager: when a user clicks a tour link, JavaScript can intercept the click and open the inline details instead of doing a full navigation.

If a visitor or crawler lands directly on a tour URL, the page should render either:

- a focused tour detail page, or
- the homepage with that tour already expanded and scrolled into view.

The focused tour detail page is the cleaner SEO option. The expanded-homepage option keeps implementation closer to the current UI.

## Crawlable links

Tour cards should expose real links with `href` attributes. Avoid JS-only buttons for SEO entry points.

Good:

```html
<a href="/tours/phu-quoc-4d3n" class="tour-card__details-link">Details</a>
```

Still acceptable for the one-page UX:

```js
link.addEventListener("click", (event) => {
  event.preventDefault();
  openTourDetailsInline(tourId);
  history.pushState({}, "", link.href);
});
```

This gives crawlers a normal URL and gives users the current smooth inline interaction.

## Per-tour SEO requirements

Each marketing tour URL should have unique metadata:

- Unique `<title>`, for example `Phu Quoc 4D3N Private Tour | Asia Travel Plan`.
- Unique `<meta name="description">` based on the tour summary.
- A self-referencing canonical URL, for example `<link rel="canonical" href="https://asiatravelplan.com/tours/phu-quoc-4d3n">`.
- Open Graph title, description, image, and URL.
- One clear `<h1>` containing the tour name.
- Full tour description and itinerary content in the initial HTML.
- Real image `alt` text.
- Internal links back to related tours, destinations, and the homepage.

Do not canonicalize individual tour URLs back to the homepage. That would tell search engines that the homepage is the preferred page, and the tour URLs may not be indexed separately.

## Sitemap and international SEO

Add every public marketing tour URL to `sitemap.xml`.

If tour pages exist in multiple frontend languages, add `hreflang` alternates between language variants. Each language version should canonicalize to itself, not to the English page, unless the translated page is intentionally not meant to be indexed.

Example URL shape options:

- `/en/tours/phu-quoc-4d3n`
- `/de/tours/phu-quoc-4d3n`
- `/vi/tours/phu-quoc-4d3n`

or, if the current language system does not use path prefixes yet:

- `/tours/phu-quoc-4d3n?lang=en`
- `/tours/phu-quoc-4d3n?lang=de`

Path-based language URLs are usually cleaner for SEO.

## Structured data

Add JSON-LD per tour page where the data is accurate and visible on the page. Useful schema.org types may include:

- `TouristTrip`
- `Trip`
- `Product` or `Service` if the page includes bookable/commercial offer information
- `BreadcrumbList`
- `Organization`

Do not add misleading structured data just to chase rich results. The structured data must match visible page content.

## What to avoid

- Do not rely on hash URLs like `/#phu-quoc` as the main SEO strategy.
- Do not make the details state accessible only through JavaScript click handlers.
- Do not use the same title and meta description for every tour.
- Do not canonicalize all tour pages to the homepage.
- Do not block tour URLs with `robots.txt`, `noindex`, or auth requirements.
- Do not generate thin pages that only contain a title and image. The itinerary and meaningful copy should be in the HTML.

## Implementation plan

1. Add stable slugs and optional SEO fields to marketing tour data.
2. Extend the public homepage asset generator to create static tour detail pages from the same data source.
3. Add route/static serving support for `/tours/{slug}`.
4. Update homepage tour cards so the Details entry point is a real crawlable link.
5. Intercept same-page clicks with JavaScript to preserve the inline one-page experience.
6. On direct load of `/tours/{slug}`, render the tour details page or render the homepage with the tour expanded.
7. Generate per-tour metadata, canonical URLs, Open Graph data, and JSON-LD.
8. Add all tour URLs to `sitemap.xml`.
9. Add language alternates when language-specific tour URLs are available.
10. Verify with Google Search Console URL inspection once deployed.

## Preferred decision

Use static generated tour detail pages as the SEO foundation, then progressively enhance the homepage links so they open inline when JavaScript is available.

This gives us the best balance:

- Search engines get stable, indexable HTML pages.
- Users keep the fast one-page browsing experience.
- Social sharing gets clean tour-specific previews.
- The implementation can reuse existing marketing tour data instead of maintaining separate SEO content.

## References

- Google Search Central: JavaScript SEO basics: https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics
- Google Search Central: Crawlable links: https://developers.google.com/search/docs/crawling-indexing/links-crawlable
- Google Search Central: Canonical URLs: https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls
- Google Search Central: Structured data guidelines: https://developers.google.com/search/docs/appearance/structured-data/sd-policies
