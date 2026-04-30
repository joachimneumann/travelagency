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

## Keyword strategy

Define a small keyword map for every public marketing tour before writing metadata or renaming assets. The goal is not to repeat keywords mechanically, but to describe the tour with the same terms a real traveler may use in search.

For each tour, define:

- Primary keyword: the main search phrase, for example `Phu Quoc private tour`.
- Secondary keywords: natural variants, for example `Phu Quoc 4 day itinerary`, `Phu Quoc island tour`, `Sao Beach tour`, `Hon Thom cable car`.
- Search intent: what the visitor likely wants, for example itinerary inspiration, private transfer, family trip, luxury beach holiday, or guided day-by-day tour.
- Location terms: destination, region, country, nearby landmarks, airport, islands, beaches, and city names.
- Experience terms: beach, culture, food, nature, family, honeymoon, luxury, private driver, slow travel, adventure.

Use the keyword map in the places that matter most:

- Page `<title>` and visible `<h1>`.
- Meta description.
- URL slug.
- First paragraph or summary text.
- Day headings and itinerary copy.
- Internal link text from homepage, destination pages, and related tours.
- Image filenames and image `alt` text.

Example for a Phu Quoc tour:

- Primary keyword: `Phu Quoc private tour`.
- Secondary keywords: `Phu Quoc 4D3N itinerary`, `Phu Quoc beach holiday`, `Sao Beach`, `Hon Thom cable car`, `Sunset Town`.
- Good title: `Phu Quoc Private Tour 4D3N | Beaches, Islands & Sunset Town`.
- Weak title: `Phu Quoc, Phu Quoc Tour, Phu Quoc Travel, Phu Quoc Trip`.

Avoid keyword stuffing. Titles and copy should read naturally and accurately describe the visible page content.

## Image SEO improvements

Images should help search engines understand the tour, not just decorate the page.

Use descriptive image filenames before upload or generation:

- Good: `phu-quoc-sao-beach-private-tour.webp`
- Good: `da-nang-hue-hoi-an-marble-mountains-tour.webp`
- Good: `mekong-delta-private-boat-tour-family.webp`
- Weak: `image1.webp`
- Weak: `rice field.webp` if the image is used for a specific tour and can be named more precisely.

Use descriptive `alt` text:

- Good: `Sao Beach in Phu Quoc on a private 4D3N island tour`.
- Good: `Marble Mountains stop on a Da Nang, Hue, and Hoi An itinerary`.
- Weak: `tour image`.

Image handling rules:

- Use the most important tour image as the Open Graph image for the tour page.
- Keep hero images accessible in the initial HTML with a normal `img src`.
- Use responsive image sizes so mobile and desktop do not download unnecessarily large files.
- Lazy-load non-critical gallery images, but do not lazy-load the main hero image too aggressively.
- Consider adding important tour images to the sitemap if image search becomes a priority.
- Keep filenames lowercase, hyphen-separated, ASCII-only, and stable after deployment.

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

## Page performance and technical quality goals

Use Google Search and PageSpeed guidance as the baseline for launch readiness. These goals should be checked for the homepage, `/tours`, and a representative sample of generated `/tours/{slug}` pages.

Core Web Vitals:

- Pass Core Web Vitals for mobile and desktop separately.
- Largest Contentful Paint (LCP): `<= 2.5s`.
- Interaction to Next Paint (INP): `<= 200ms`.
- Cumulative Layout Shift (CLS): `<= 0.1`.
- Measure the Core Web Vitals pass/fail target at the 75th percentile of real page loads, not only in a local lab run.
- Use PageSpeed Insights and Search Console Core Web Vitals reports for field data, then use Lighthouse/DevTools lab data to debug specific regressions.

Mobile-first indexing:

- Prefer responsive design: same URL and same HTML content, adapted with CSS for mobile and desktop.
- Keep mobile content equivalent to desktop content. Details may be inside accordions or tabs, but important tour content must still be present and accessible in the mobile DOM.
- Do not lazy-load primary content only after a user interaction such as tapping, swiping, or typing.
- Use equivalent titles, meta descriptions, headings, image alt text, and structured data on mobile and desktop.
- Make sure important tour images are visible to Google on mobile, use supported formats, and keep image URLs stable.

Validity and crawlability:

- Production pages must be accessible to Googlebot, return HTTP `200`, and contain indexable HTML content.
- Generated pages should have valid HTML in the `<head>` so Google can reliably read title, meta description, canonical, Open Graph, and structured data tags.
- Keep invalid elements such as `img` and `iframe` out of the `<head>`.
- Structured data should pass the Rich Results Test where applicable and must describe content that is visible on the page.
- Production pages should use HTTPS and avoid intrusive interstitials or dialogs that cover the main content.

Load and stability:

- Give hero images explicit dimensions or aspect-ratio rules to prevent layout shift.
- Preload only critical resources that are actually used shortly after load.
- Do not preload desktop-only or hidden images on mobile.
- Serve appropriately sized responsive images for mobile and desktop.
- Lazy-load non-critical gallery/detail images, but keep the primary hero image discoverable and fast.
- Keep JavaScript small enough that tour card interaction remains responsive on mobile.
- Use browser caching and compression for static assets.

## Additional SEO measures

Content:

- Add enough unique text to each tour page to make it useful without relying on the homepage card.
- Include practical traveler questions where relevant: best season, who the tour fits, pace, transfers, included highlights, and suggested customization.
- Add short related-tour links, for example `More beach tours in Vietnam` or `Similar private family tours`.
- Add destination landing pages that link to tours by destination, for example `/destinations/phu-quoc` and `/destinations/hoi-an`.
- Add travel-style landing pages that link to tours by intent, for example `/travel-styles/family-tours`, `/travel-styles/luxury-vietnam`, and `/travel-styles/beach-holidays`.
- Add FAQ content only when the questions and answers are genuinely useful and visible on the page.

Technical:

- Keep production pages crawlable and indexable, while staging and local environments should remain blocked or protected.
- Use stable canonical URLs and redirects when URLs change.
- Keep page titles unique, concise, and descriptive.
- Keep meta descriptions unique and written for click-through, even though they are not guaranteed to be shown.
- Use semantic headings: one `<h1>`, then meaningful `<h2>` and `<h3>` sections.
- Keep internal links as real `<a href>` links with descriptive anchor text.
- Maintain good Core Web Vitals by optimizing image size, avoiding layout shift, and keeping JavaScript non-blocking where possible.
- Add `lastmod` dates to the sitemap when content changes can be tracked reliably.

Trust and conversion:

- Make contact details, company information, and booking flow easy to find.
- Show real testimonials, reviews, or references only if they are genuine and maintainable.
- Make CTAs descriptive, for example `Plan this Phu Quoc tour`, not only `Click here`.
- Use Open Graph and social preview metadata so shared tour links look specific and trustworthy.

Measurement:

- Add Google Search Console for the production domain.
- Submit the generated sitemap after deployment.
- Inspect a sample tour URL after launch to confirm Google sees the generated HTML, canonical, title, description, and structured data.
- Track queries and impressions per tour, then adjust titles and copy based on real search terms rather than guesses.

## What to avoid

- Do not rely on hash URLs like `/#phu-quoc` as the main SEO strategy.
- Do not make the details state accessible only through JavaScript click handlers.
- Do not use the same title and meta description for every tour.
- Do not canonicalize all tour pages to the homepage.
- Do not block tour URLs with `robots.txt`, `noindex`, or auth requirements.
- Do not generate thin pages that only contain a title and image. The itinerary and meaningful copy should be in the HTML.
- Do not rename public image files or URLs casually after deployment without redirects or an intentional cache strategy.
- Do not repeat the same keyword list across every page.
- Do not publish AI-generated or placeholder travel claims that have not been checked against the actual tour offer.

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

## Codebase implementation plan

Some of the SEO surface already exists in the current codebase:

- `scripts/assets/generate_public_homepage_assets.mjs` already generates static SEO pages for `/destinations`, `/travel-styles`, `/tours`, and `/tours/{slug}`.
- `frontend/data/generated/homepage/sitemap.xml` already includes generated public SEO URLs.
- `deploy-config/Caddyfile` and `deploy-config/Caddyfile.local` already route the generated SEO paths to static HTML files.
- The generated tour pages already include basic metadata and JSON-LD, but the content should be made richer before relying on these pages as the main SEO surface.

Recommended implementation sequence:

1. Preserve the existing static SEO page generator and harden it instead of starting over.
2. Add explicit stable `seo_slug` values to marketing tour data, so URLs do not change when titles are edited.
3. Keep generated aliases for old title-based slugs or add redirects if a slug changes after deployment.
4. Update homepage tour cards so the Details entry point is a real `<a href="/tours/{slug}">` link instead of only a JavaScript button.
5. Intercept those links on the homepage with JavaScript to keep the current inline expand/collapse experience.
6. Improve generated tour pages so the initial HTML includes the full itinerary, day notes, service descriptions, duration, destination/style labels, CTA copy, and useful image alt text.
7. Keep each generated tour page self-canonical, and do not canonicalize tour pages back to the homepage.
8. Expand JSON-LD only where the data is accurate and visible on the page.
9. Add tests that verify every public marketing tour has a slug, generated page, sitemap entry, canonical URL, unique title, and crawlable homepage link.
10. Validate deployed pages with Google Search Console URL inspection and confirm staging/basic-auth pages are not treated as production SEO targets.

First implementation slice:

1. Add explicit `seo_slug` support.
2. Render homepage Details actions as crawlable links.
3. Keep the JavaScript-enhanced inline details behavior for users.
4. Extend tests around generated tour URLs and homepage links.

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
- Google Search Central: SEO Starter Guide: https://developers.google.com/search/docs/fundamentals/seo-starter-guide
- Google Search Central: Title links: https://developers.google.com/search/docs/appearance/title-link
- Google Search Central: Image SEO best practices: https://developers.google.com/search/docs/appearance/google-images
- Google Search Central: Core Web Vitals and Google Search: https://developers.google.com/search/docs/appearance/core-web-vitals
- Google Search Central: Mobile-first indexing best practices: https://developers.google.com/search/docs/crawling-indexing/mobile/mobile-sites-mobile-first-indexing
- Google Search Central: Technical requirements: https://developers.google.com/search/docs/essentials/technical
- Google Search Central: Valid page metadata: https://developers.google.com/search/docs/crawling-indexing/valid-page-metadata
- Google Search Central: Avoid intrusive interstitials and dialogs: https://developers.google.com/search/docs/appearance/avoid-intrusive-interstitials
- Google Developers: PageSpeed Insights: https://developers.google.com/speed/docs/insights/v5/about
- web.dev: Web Vitals: https://web.dev/articles/vitals
