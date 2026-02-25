# Chapter 2 Landing Page (Static)

This project is a framework-free landing page for a Vietnam-based travel agency.

## Folder structure

- `index.html`
- `assets/css/styles.css`
- `assets/js/main.js`
- `assets/img/*`
- `assets/img/credits.md`
- `data/trips.json`
- `site.webmanifest`

## Run locally

Option 1 (recommended): simple static server.

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

Option 2: open `index.html` directly in your browser.

Note: Some browsers block `fetch()` from `file://`. If tour cards do not load in direct-file mode, use Option 1.

## Edit text and content

- Main page text: `index.html`
- Colors, spacing, typography: `assets/css/styles.css`
- Tour data and filters: `data/trips.json`
- Interactive behavior: `assets/js/main.js`

## Add or edit a trip (JSON)

Edit `data/trips.json` and keep this structure:

```json
{
  "id": "trip-example",
  "title": "Trip title",
  "shortDescription": "Short card description.",
  "destinationCountry": "Vietnam",
  "styles": ["Culture", "Food"],
  "durationDays": 10,
  "priceFrom": 990,
  "image": "assets/img/tour-file.svg",
  "highlights": ["Highlight 1", "Highlight 2"],
  "seasonality": "Best Nov-Mar",
  "rating": 4.9
}
```

After saving, refresh the page.

## Filter URL format

Filters are shareable via query params:

- Destination only: `?dest=Vietnam`
- Style only: `?style=Culture`
- Combined: `?dest=Vietnam&style=Culture`

Use **Clear filters** in the header to reset.

## Lead form behavior

- Hero CTA opens a 3-step modal form.
- Validation is client-side in `assets/js/main.js`.
- Submit uses `mailto:` fallback by default.

### Connect real backend later

Inside `index.html`, in the lead form section, there is a commented placeholder for:

- Formspree (`action="https://formspree.io/f/your-id" method="POST"`)
- Netlify Forms (`data-netlify="true"` + hidden form-name)

## Images and replacements

Current tour card images are local WebP files under `assets/tours/`.
The hero section uses local media from `assets/video/`.

To download prototype media locally in one pass:

```bash
bash scripts/download_prototype_media.sh
```

This saves files under:
- `assets/tours/`
- `assets/video/`

To replace with real photos later:

1. Download and optimize images (`.webp` preferred).
2. Save into `assets/img/`.
3. Update `image` paths in `data/trips.json` and hero/supporting image paths in `index.html`.
4. Update `assets/img/credits.md` with real source links.

## Beginner-safe edit points

- Company name and contact details: footer and schema in `index.html`
- Primary CTA label: search for `Book a free discovery call`
- Accent colors: update CSS variables in `:root` in `styles.css`
- Destination/style list: generated automatically from `data/trips.json`
