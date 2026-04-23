# Mobile Reel Page

## Purpose

Plan a phone-first reel page built around short vertical videos that users can swipe like TikTok, YouTube Shorts, or Facebook Reels.

The target outcome is:

- keep `asiatravelplan.com` as the public URL
- keep the current homepage as the main homepage on all screen sizes
- add a separate reel page as one menu item of the website on small screens only
- hide that menu item on larger screens
- show the reel page only on local and staging for now
- never show or expose the reel page on production for now
- reuse the existing booking action and booking modal already used on the homepage
- link reels directly to marketing tours, with only some tours having a reel

This document is a plan only. It does not describe finished implementation.

## Current repository reality

Current relevant behavior in the repo:

- the public homepage is `frontend/pages/index.html`
- the homepage booking flow already exists as a modal on that page
- homepage buttons with `data-open-modal` already open the booking modal through `frontend/scripts/main.js`
- public homepage tours/team content is already generated into static frontend files
- source videos currently live in `content/videos/`
- there is currently one video in `content/videos/`: `Hanoi Sapa Ninh Binh.mp4`

Important deployment constraint:

- local and staging Caddy can fall through to existing repo files
- production Caddy explicitly serves `/assets/*`, `/frontend/*`, `/shared/*`, and backend routes
- production does not currently expose `/content/*`

Conclusion:

- `content/videos/` can be the editorial source of truth
- but the reel page should not depend on `/content/videos/...` as the public runtime URL in production
- reel videos should be copied/generated into static website content under `/assets/...`, with a generated manifest under `/frontend/data/...`
- this should follow the same public-generation pattern already used for staff and tour data: content source files are transformed into static website assets plus generated frontend data

## Product goal

On phones, the website should offer an additional reel page that feels like a short-video feed:

- full-screen vertical video cards
- one video per screen
- vertical swipe between cards
- the active card autoplaying muted
- inactive cards paused
- a persistent booking button at the top
- a lightweight text overlay per reel using the linked marketing tour title

On desktop and tablet:

- the current homepage remains the main experience
- the reel page is not shown as a normal navigation item

Environment scope for now:

- local: enabled
- staging: enabled
- production: disabled

## Recommended scope

Recommended first scope:

1. mobile-only reel page for narrow screens
2. reuse the current booking modal exactly
3. support up to 20 reels from a generated manifest
4. expose it through a dedicated public route
5. add one mobile-only navigation item linking to that route
6. enable the reel page only on local and staging
7. keep the current homepage untouched on desktop and as the default entry page
8. derive reel order from the same ordered marketing tour list already used on the homepage

Not recommended for the first version:

- serving raw files directly from `content/videos`
- a separate mobile domain
- complex per-reel analytics before the feed is stable
- custom gesture physics beyond native snap scrolling
- unmuted autoplay

## Main UX shape

## Mobile behavior

- the reel page viewport becomes a vertical reel feed
- feed uses CSS scroll snap
- each reel occupies `100svh`
- top area contains a fixed booking button with safe-area padding
- each reel should contain:
  - the linked marketing tour title from existing i18n tour data
  - a mute indicator
- each reel should not contain:
  - a reel counter such as `1 / 20`
  - a second booking CTA in v1

## Reel interaction

- swipe up/down moves to the next or previous reel
- only the most visible reel plays
- adjacent reels may preload metadata or enough buffer for smooth transitions
- videos loop continuously until the user swipes away
- tap behavior should be minimal in v1:
  - tap video toggles pause/play
  - booking button opens the same booking form flow as the linked marketing tour

## Desktop behavior

- retain the current homepage
- do not show the reel page as a normal menu item on large screens
- the reel route may still exist, but it is not a primary desktop navigation surface

## Recommended technical approach

## Route strategy

Use a separate public page:

- `frontend/pages/reels.html`

Keep the existing homepage route unchanged:

- `frontend/pages/index.html`

Expose the reel page through one mobile-only navigation item in the existing site menu.

Environment rule:

- local and staging may expose `/reels.html`
- production must not expose `/reels.html` for now
- local and staging may show the mobile-only reel navigation item
- production must not show the reel navigation item

Reason:

- avoids turning the homepage into two competing products
- makes rollout safer because the current homepage stays intact
- fits the request that the reel experience is one menu item of the website
- keeps the feature in preview on local/staging until product quality is proven
- lets us hide the menu item on larger screens without changing the homepage information architecture

## Asset strategy

Introduce a generated static reel pipeline similar to the existing public homepage asset generation.

The intended pattern is:

- source files live under `content/...`
- the generator copies/transcodes them into static website assets under `/assets/...`
- the generator writes a static frontend data file under `/frontend/data/...`

This is the same overall approach already used for public staff and tour data.

Recommended source of truth:

- source videos: `content/videos/`

Recommended generated outputs:

- generated video files copied into static website content: `assets/generated/reels/`
- generated manifest: `frontend/data/generated/reels/public-reels.json`

Recommended generated manifest contents:

- list of reels linked to marketing tours
- marketing tour key/id
- public video URL
- poster URL
- duration
- derived title/caption text from the linked tour's existing i18n title fields
- optional display metadata such as mute state defaults

Reason:

- production already serves `/assets/*` and `/frontend/data/*`
- generated public assets fit the current architecture
- it matches the existing "content source -> generated static website content" pattern already used for tours and staff
- allows future transcoding, poster generation, and cache busting

## Data model recommendation

There are two reasonable directions:

### Option A: file-name driven manifest generation

Source is just video files in `content/videos/`, with metadata inferred from filenames.

Pros:

- fastest to start
- low editorial overhead

Cons:

- weak linkage to marketing tours
- poor control of inherited tour order
- difficult to reuse existing i18n tour titles safely

### Option B: explicit reel manifest in content

Add a content file such as:

- `content/reels.json`

Each reel points to a file in `content/videos/` and to one marketing tour by stable key/id.

Pros:

- explicit marketing-tour linkage
- captions can be derived from existing i18n marketing tour titles
- easier to filter the ordered tour list down to tours that actually have reels
- cleaner editorial workflow

Cons:

- one more maintained content file

Recommendation:

- use Option B
- keep `content/videos/` as binary source
- use a small explicit reel manifest that links reels to marketing tours
- derive reel order from the same homepage marketing-tour ordering logic, then filter to tours that have reels
- derive reel caption/title text from the linked marketing tour i18n title data

## Frontend structure

Recommended additions to the main site navigation:

- one mobile-only nav item linking to `/reels.html`
- hide that nav item on larger screens with CSS and, if useful, runtime guards
- show that nav item only on local and staging
- never show that nav item on production for now

Recommended new page structure:

- `frontend/pages/reels.html`
- `#mobileReelPage`
- `#mobileReelBookingBar`
- `#mobileReelFeed`

This avoids having to hide normal homepage sections just because the user is on a phone.

## Frontend runtime plan

Recommended frontend split:

- keep `frontend/scripts/main.js` as the homepage entrypoint
- add a dedicated reel entrypoint, for example:
  - `frontend/scripts/reels.js`
- add a dedicated module for reel rendering/playback, for example:
  - `frontend/scripts/main_reels.js`

Responsibilities of the reel module:

- load the generated reel manifest
- render reel cards
- manage active reel detection with `IntersectionObserver`
- play only the active video
- pause/reset non-active videos as needed
- manage lightweight preloading for nearby videos
- expose a booking CTA hook that opens the linked marketing tour booking form through the existing modal flow

Responsibilities that remain in `main.js`:

- homepage behavior
- mobile-nav item visibility
- global auth/backend button logic

Recommended shared extraction:

- move booking modal setup into a shared frontend module so both `index.html` and `reels.html` can open the same booking UX without duplicating logic

## Video playback rules

Recommended behavior:

- `muted`, `playsinline`, `loop`, `preload="metadata"`
- autoplay only when the reel is active
- pause when hidden
- only keep 1 active playback at a time

Optional nearby loading strategy:

- active reel: full playback
- next reel: preload metadata or begin soft preload
- all others: metadata only

This keeps memory/network use under control for a 20-video feed.

## Booking integration

The booking action should stay exactly aligned with the existing homepage.

Recommendation:

- the fixed top booking button on `reels.html` opens the same booking modal flow as the linked marketing tour
- no new booking endpoint
- no new booking modal
- no separate reel-specific booking flow

This keeps:

- existing validation
- existing language behavior
- existing budget/month/traveler logic
- existing backend integration
- the same tour-specific booking context the user would get from the linked tour CTA

## SEO and indexing

Recommended v1 posture:

- keep the existing homepage as the main SEO landing page
- treat the reel page as a secondary public page
- do not let the reel page replace homepage metadata or canonical intent

Practical recommendation:

- keep homepage metadata on `/`
- give `/reels.html` its own minimal but valid metadata
- decide later whether `/reels.html` should be indexable or `noindex`

## Performance plan

The main risk is payload size.

With 20 portrait videos, the page can become too heavy if we use raw uploads.

Recommended preparation pipeline:

1. normalize source clips to portrait-friendly dimensions
2. generate compressed delivery MP4s
3. generate poster images
4. optionally generate WebM later if useful
5. include cache-busted public URLs in the generated manifest

Recommended first delivery target:

- one public MP4 per reel
- one poster image per reel
- aggressive browser caching on generated assets
- manifest fetch with explicit cache policy that matches regeneration behavior

## Accessibility plan

Even though the page is video-first, minimum accessibility should be planned from the start.

Recommended baseline:

- keyboard-focusable booking button
- visible focus states
- skip link to main content remains intact
- each reel has accessible text labels
- videos remain muted by default
- `prefers-reduced-motion` should disable autoplay and possibly fall back to posters or paused first frames

## Internationalization plan

The homepage already has frontend i18n infrastructure.

Recommendation:

- keep the reel shell text in frontend i18n
- derive reel caption/title text from the linked marketing tour i18n title fields instead of storing duplicate freeform caption text

For v1:

- shell labels must be localized
- per-reel captions are the linked marketing tour titles, using the existing i18n title data

## Rollout plan

## Phase 1: concept and data shape

- define the reel manifest format
- define reel entries as links from source videos to marketing tours
- define generated reel ordering as "homepage marketing-tour order filtered to tours with reels"
- define generated output locations

## Phase 2: generation pipeline

- add a generator that reads source videos from `content/videos/`
- copy/transcode them into static website content at `assets/generated/reels/`
- generate posters
- write `frontend/data/generated/reels/public-reels.json`

## Phase 3: mobile reel frontend

- add `frontend/pages/reels.html`
- add mobile-only reel styles
- add the reel page script entrypoint
- add `main_reels.js`
- implement snap scrolling and active-video playback

## Phase 4: booking integration

- extract or share the booking modal runtime
- connect the fixed booking button on `reels.html`
- verify it opens the same booking form/context as the linked marketing tour

## Phase 5: mobile navigation integration

- add one reel nav item to the site menu
- show it only on small screens
- show it only on local and staging
- keep desktop homepage navigation unchanged

## Phase 6: environment gating

- ensure local exposes the reel page
- ensure staging exposes the reel page
- ensure production does not expose the reel page
- ensure production does not render the reel nav item

## Phase 7: verification

- test on iPhone-sized and Android-sized viewports
- verify only one video plays at a time
- verify smooth swipe between many reels
- verify active reels loop continuously until swiped away
- verify booking CTA opens the same form/context as the linked marketing tour
- verify reel captions match the linked marketing tour titles in the active language
- verify reel order matches homepage marketing-tour order after filtering to tours with reels
- verify mute indicator is visible
- verify no reel counter is shown
- verify the reel nav item is only shown on small screens
- verify the reel nav item is only shown on local and staging
- verify production never shows or exposes the reel page
- verify the main homepage does not regress

## Acceptance criteria

The reel page plan should be considered successfully implemented later only if:

- `/reels.html` provides the reel experience
- the main homepage remains the default homepage
- the reel page appears as one menu item only on small screens
- the reel page and its nav item are enabled only on local and staging
- production does not show the reel nav item
- production does not expose the reel page for now
- desktop keeps the current homepage and does not show the reel nav item
- booking button opens the existing booking modal
- booking CTA opens the same form/context as the linked marketing tour
- source videos come from `content/videos/` but are copied into generated static website content for public delivery
- each reel is linked to a marketing tour
- reel captions come from the linked marketing tour i18n titles
- reel order matches the existing homepage marketing-tour order, filtered to tours that have reels
- active reels loop continuously until swiped away
- a mute indicator is shown
- no reel counter is shown
- the system supports up to 20 reels without trying to play all videos at once
- production does not depend on direct `/content/videos/...` access

## Main risks

## 1. Production asset serving mismatch

Risk:

- direct `content/videos` URLs may work locally or on staging, but not in production

Mitigation:

- always copy/publish reel assets into static website content at `/assets/generated/reels/`

## 2. Mobile performance

Risk:

- 20 videos may overload low-end phones

Mitigation:

- generated compressed assets
- one-active-video playback rule
- limited preloading

## 3. Booking modal regression

Risk:

- mobile reel shell could interfere with the current modal layering or body scroll lock

Mitigation:

- reuse existing modal code
- keep reel CTA on `data-open-modal`
- explicitly test modal open/close while a reel is active

## 4. Separate-page booking/runtime drift

Risk:

- if the reel page is separate from the homepage, booking behavior may drift between the two pages

Mitigation:

- share booking runtime code
- avoid maintaining two independent booking flows
- test homepage and reel page together

## 5. Tour-order drift

Risk:

- the reel feed order may drift from the homepage marketing-tour order if it is sorted independently

Mitigation:

- derive reel order from the same ordered marketing-tour dataset/logic used on the homepage
- filter that ordered list down to tours that have reels, rather than sorting reels separately

## 6. Accidental production exposure

Risk:

- the reel page may accidentally appear in production before it is ready

Mitigation:

- gate the reel route by environment
- gate the mobile reel nav item by environment
- verify production behavior explicitly before release

## Recommendation

Recommended product/technical direction:

1. keep the current homepage as the homepage
2. build a separate reel page at a dedicated public route
3. expose it as one mobile-only menu item on local and staging only
4. keep it disabled on production for now
5. reuse the existing booking modal via shared frontend code
6. introduce a generated public reel asset pipeline that copies videos into static website content
7. use an explicit reel manifest that links each reel to a marketing tour
8. derive reel title/caption and feed order from the linked marketing tours
9. keep reels looping continuously, show a mute indicator, and do not show a reel counter

That is the cleanest path that fits the current repository structure and matches the requirement that the reel experience is one mobile-only menu item, while keeping it limited to local/staging until it is ready for production.
