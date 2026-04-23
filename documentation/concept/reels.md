# Reels

## Purpose

Plan a phone-first reels experience for the public homepage using short vertical videos that users can swipe like TikTok, YouTube Shorts, or Facebook Reels.

This is an in-page homepage feature, not a separate public page.

The target outcome is:

- keep `asiatravelplan.com` as the public URL
- keep `frontend/pages/index.html` as the public page
- add a `Reels` button in the header next to the menu-toggle button
- when pressed, show reels full screen below the menu bar/header
- convert the `Reels` button into a red `X` while reels are open
- when the red `X` is pressed, close reels and return to the normal homepage view
- keep the existing booking action and booking modal
- use the same localized tour payload the homepage already uses for reel titles and booking context
- keep reel ordering aligned with the same homepage ranking logic
- allow the reel runtime to compute its own randomized order if needed
- enable reels only on local and staging for now
- never show or expose the reels UI or generated reel assets on production for now
- allow editors to upload and manage tour-owned reel videos in production even while the public reels UI remains disabled there

This document is a plan only. It does not describe finished implementation.

## Current Repository Reality

Current relevant behavior in the repo:

- the public homepage is `frontend/pages/index.html`
- homepage behavior currently lives in `frontend/scripts/main.js`
- the booking flow already exists as a modal on the homepage
- homepage buttons with `data-open-modal` already open that modal through `frontend/scripts/main.js`
- public homepage tours and team content are already generated into static frontend files
- reel videos should be treated as tour-owned source content
- the source location should be `content/tours/<tour-key>/video.mp4`
- a tour has a reel only if its own folder contains that `video.mp4`
- the tour editor needs to support uploading exactly one reel video per tour
- because reel source videos live under `content/tours/`, they must move through the same `rsync` and backup workflows already used for tour content
- `scripts/content/clipVideo` already exists and should be reused for reel-video normalization work where possible

Important deployment constraint:

- production Caddy serves public assets from allowlisted static roots
- production does not expose `/content/*`
- generated reel assets must therefore never be runtime-loaded from `content/tours/...`

Conclusion:

- `content/tours/<tour-key>/video.mp4` is the editorial source of truth
- public reels should use generated assets, not direct `content/...` URLs
- the source-of-truth backup and `rsync` unit remains `content/tours/...`
- generated reel outputs are rebuildable artifacts, not backup source of truth

## Product Shape

The homepage should gain a reels mode on phones:

- header shows a `Reels` button next to the three-line menu-toggle button
- pressing `Reels` opens a full-screen reel layer below the header
- while open, the `Reels` button becomes a red `X`
- pressing the red `X` closes reels and restores the normal homepage
- reels occupy the viewport below the header
- each reel uses one full screen-height card
- the active reel autoplaying muted
- inactive reels paused
- vertical swipe between reels
- the existing fixed bottom mobile booking CTA is reused and overlaid on top of the video at the bottom of the screen
- lightweight text overlay using the owning marketing tour title

Desktop and tablet behavior:

- keep the current homepage as the primary experience
- do not show the reels toggle on larger screens

Environment scope for now:

- local: enabled
- staging: enabled
- production: disabled

## Recommended Scope

Recommended first scope:

1. add reels as an in-page fullscreen homepage mode
2. keep everything on `index.html`
3. reuse the existing booking modal exactly
4. support up to 20 reels from generated media metadata
5. add one header-level `Reels` toggle button on small screens only
6. enable reels only on local and staging
7. keep the current homepage untouched on desktop and as the default entry view
8. use the same homepage ranking logic already used for tours

Not recommended for the first version:

- a separate `reels.html` page
- an `iframe`
- serving raw files directly from `content/tours/.../video.mp4`
- complex per-reel analytics before the feed is stable
- custom gesture physics beyond native snap scrolling
- unmuted autoplay

## Main UX Shape

### Header Behavior

- add a `Reels` button in the header next to the menu-toggle button
- on open:
  - button label/icon changes into a red `X`
  - the homepage enters reels mode
  - `#siteNav` is closed immediately
  - the menu-toggle button is disabled while reels are open so it cannot open a competing overlay
- on close:
  - button returns to normal `Reels` state
  - reels mode is dismissed
  - the homepage returns to its normal view
  - the menu-toggle button is re-enabled

### Reels Mode

- the reels layer is full screen below the header
- feed uses CSS scroll snap
- each reel occupies the available viewport below the header
- only the most visible reel plays
- reels loop continuously until the user swipes away
- tap video toggles pause/play
- booking CTA opens the same booking flow as the active tour

### Homepage Interaction While Reels Are Open

- normal homepage sections should be hidden, inert, or otherwise non-interactive while reels are open
- the homepage remains the same page underneath
- closing reels restores the normal homepage without page navigation
- `#siteNav` must be closed while reels are open
- `.mobile-cta` must stay visible but be repositioned/overlaid on top of the active reel at the bottom of the screen
- the menu-toggle button should be disabled while reels are open

## Recommended Technical Approach

### Page Strategy

Do not create a second public page.

Use:

- `frontend/pages/index.html`

Add an in-page reel layer, for example:

- `#mobileReelToggle`
- `#mobileReelLayer`
- `#mobileReelFeed`
- `#mobileReelBookingBar`

Reason:

- direct reuse of homepage modal/runtime/state is easier
- no second public route is needed
- no public allowlist for `reels.html` is needed
- the homepage remains the only page, with a second fullscreen mode layered inside it

### Asset Strategy

Use a generated reel-media pipeline similar to the existing public homepage asset generation.

Recommended source of truth:

- `content/tours/<tour-key>/video.mp4`

Recommended generated outputs for local and staging only:

- `assets/generated/reels/`
- `frontend/data/generated/reels/public-reels.json`

Production rule:

- do not generate these reel outputs in production
- do not publish them in production
- this production rule applies to public runtime assets only, not to editor-side upload/edit capability

Recommended generated reel manifest contents:

- owning marketing tour key/id
- public video URL
- poster URL
- duration
- optional display metadata such as mute defaults

Do not duplicate localized caption/title content in the reel manifest if the reel layer can join media metadata with the same localized homepage tour payload already used on the page.

### Data Model Recommendation

Recommended source structure:

- each marketing tour keeps its own reel at `content/tours/<tour-key>/video.mp4`
- there is at most one reel source video per tour
- no separate reel-to-tour ownership file is needed
- the tour editor should allow uploading exactly one reel video per tour
- replacing the reel video should overwrite the previous `video.mp4`
- removing the reel video should remove that tour from reels
- those source videos must be included whenever `content/tours/` is synced, backed up, or restored

Recommended generated reel entry:

- `tourId`
- generated public video URL
- generated poster URL
- duration

Recommended ordering rule:

- do not treat generator order as final browser order
- the reel runtime should apply the same homepage ranking logic used for tours
- it may compute its own randomized order
- it should then filter that ordered list down to tours that actually have reel media
- it should use the currently filtered homepage subset, not all tours globally

### Frontend Runtime Plan

Keep reels inside the homepage runtime.

Recommended split:

- keep homepage entry at `frontend/scripts/main.js`
- add a dedicated reel module, for example `frontend/scripts/main_reels.js`
- optionally extract shared homepage helpers into `frontend/scripts/shared/` if the reel layer needs cleaner boundaries

Responsibilities of the reel module:

- load generated reel media metadata
- use the same localized homepage tour payload already loaded for the current language
- derive reel title text from that tour payload
- render reel cards into the reel layer
- manage active reel detection with `IntersectionObserver`
- play only the active video
- pause/reset non-active videos as needed
- manage nearby preloading
- expose open/close behavior for reels mode
- update the header `Reels` button into a red `X` while active
- apply the same homepage ranking logic to the currently filtered homepage subset before filtering to tours that have reels
- wire the booking CTA to open the existing modal for the active tour
- close `#siteNav` when reels open
- disable the menu-toggle button while reels are open
- reposition the existing `.mobile-cta` as an overlay on top of the reel video at the bottom of the screen

Responsibilities that remain in the homepage runtime:

- normal homepage behavior
- mobile navigation behavior
- global auth/backend button logic
- existing booking modal lifecycle

## Booking Integration

The booking action should stay exactly aligned with the existing homepage.

Recommendation:

- the fixed booking button in reels mode opens the same booking modal flow as the active marketing tour
- no new booking endpoint
- no new booking modal
- no separate reel-specific booking flow

The intended linkage is:

1. a video lives inside one tour folder at `content/tours/<tour-key>/video.mp4`
2. the generator emits reel media metadata for that same `<tour-key>`
3. the reel runtime keeps that same `<tour-key>` as the active reel identity
4. the reel runtime resolves the title from the same localized homepage tour payload
5. the booking button opens the existing modal using that same `<tour-key>`

This keeps:

- existing validation
- existing language behavior
- existing budget/month/traveler logic
- existing backend integration
- the same tour-specific booking context as the homepage CTA

## Accessibility Plan

Recommended baseline:

- keyboard-focusable `Reels` toggle button
- visible focus states
- the red `X` remains keyboard-accessible
- each reel has accessible text labels
- videos remain muted by default
- `prefers-reduced-motion` should disable autoplay and allow a paused/poster-first experience

## Internationalization Plan

Recommendation:

- keep reel shell text in frontend i18n
- use the same language menu already mounted on the homepage
- use the same localized homepage tour payload for reel titles and booking context
- do not create separate reel caption copy for v1

## Implementation Plan

### Workstream 1: Tour-Owned Source Videos

- treat `content/tours/<tour-key>/video.mp4` as the only editorial source location for reel videos
- do not introduce a central `content/videos/` pool
- do not introduce a separate reel ownership file
- extend the tour editor/backend so editors can upload exactly one reel video per tour
- support replacement and deletion of that video
- keep reel source videos part of the same operational content unit as `content/tours/` for `rsync`, backup, and restore
- allow the same editor-side video management in production even while the public reels UI and generated reel assets remain disabled there

### Workstream 2: Generated Reel Media Assets

- add reel generation to the public asset pipeline
- the generator should:
  - check tours for `content/tours/<tour-key>/video.mp4`
  - reuse `scripts/content/clipVideo` for normalization/transcoding where practical
  - copy or transcode those files into `assets/generated/reels/`
  - generate posters
  - write `frontend/data/generated/reels/public-reels.json`
- each generated reel entry should contain:
  - `tourId`
  - generated public video URL
  - generated poster URL
  - duration
- do not duplicate localized captions in this output if the homepage tour payload already provides them
- reel regeneration must hook into the same post-edit regeneration path already used after tour edits and tour image changes

### Workstream 3: Tour Editor Video Management

- update `marketing_tour.html` and its frontend/backend support so a tour can have one uploaded reel video
- show current reel-video state in the tour editor
- allow upload, replacement, and removal
- after upload, replacement, or removal, trigger the same post-edit public asset regeneration flow so homepage assets and reel assets remain synchronized

### Workstream 4: Homepage Reels Layer

- update `frontend/pages/index.html`
- add a header-level `Reels` button next to the menu-toggle button
- add a hidden fullscreen reel layer below the header
- add a reel runtime module such as `frontend/scripts/main_reels.js`
- when reels open:
  - show the reel layer
  - convert the `Reels` button into a red `X`
  - hide or inert the normal homepage sections
  - close `#siteNav`
  - disable the menu-toggle button while reels are open
  - keep `.mobile-cta` visible as an overlay on top of the reel video at the bottom of the screen
- when reels close:
  - hide the reel layer
  - restore the normal header button state
  - restore normal homepage interaction
  - re-enable the menu-toggle button
  - restore `.mobile-cta` to its normal homepage behavior

### Workstream 5: Shared Homepage Infrastructure

- even without a second page, this still benefits from deliberate extraction of shared public-page infrastructure inside the homepage runtime
- this is not just helper cleanup
- extract reusable pieces where needed:
  - reel-layer state management
  - booking-modal opener helpers
  - ranking helpers shared with tour display logic
  - language/tour-payload integration points
  - environment gating helpers based on the existing hostname-based checks in `main.js`

### Workstream 6: Deployment, Sync, and Backup Coverage

- update local and staging flows so reel assets are generated whenever public assets are generated
- update backend post-edit regeneration hooks so reel assets regenerate on relevant tour editor changes
- ensure production does not generate or publish reel outputs
- gate the public reels UI in the homepage runtime by using the existing hostname-based environment helpers in `frontend/scripts/main.js`
- ensure reel source videos are covered by the same `rsync` workflows that already sync `content/tours/`
- ensure reel source videos are covered by the same backup and restore workflows that already cover `content/tours/`
- treat generated reel assets as rebuildable outputs, not the backup source of truth

### Workstream 7: Verification and Release Gating

- verify the homepage still opens the booking modal correctly
- verify reels mode opens the modal with the same tour context as the homepage CTA for the same tour
- verify the header `Reels` button becomes a red `X` while reels are open
- verify closing reels returns the user to the normal homepage without navigation
- verify reel ordering uses the same homepage ranking logic on the currently filtered subset after filtering to tours with `video.mp4`
- verify opening reels closes `#siteNav`
- verify the menu-toggle button is disabled while reels are open
- verify `.mobile-cta` overlays the reel video at the bottom of the screen while reels are open
- verify generated reel assets are served only on local and staging
- verify production does not publish or serve generated reel assets or reel manifest files
- verify production does not render the public reels UI because the homepage runtime uses the existing hostname-based environment helpers in `main.js`
- verify production editors can still upload, replace, and delete reel source videos
- verify no part of the public runtime fetches `/content/tours/.../video.mp4`
- verify tour edits, tour image changes, reel video upload, reel video replacement, and reel video deletion all trigger reel regeneration through the same post-edit asset-sync path
- verify reel source videos are included when `content/tours/` is synced, backed up, and restored

Recommended implementation order:

1. build tour-editor video support
2. build reel-media generation and regeneration hooks
3. add the in-page reels layer to `index.html`
4. wire the header `Reels` button and red `X` toggle behavior
5. verify on local and staging
6. keep production disabled until quality and performance are proven

## Acceptance Criteria

The reels plan should be considered successfully implemented only if:

- the public homepage remains `index.html`
- a `Reels` button appears in the header next to the menu-toggle button on small screens
- pressing `Reels` opens reels full screen below the header
- while open, the `Reels` button becomes a red `X`
- pressing the red `X` closes reels and returns the homepage to normal
- the homepage does not navigate to a separate public reels page
- booking button opens the existing booking modal
- booking CTA opens the same form/context as the active tour on the homepage
- source videos come from `content/tours/<tour-key>/video.mp4`
- each tour can have at most one reel source video
- reel titles come from the same localized homepage tour payload used on the homepage
- reel ordering uses the same homepage ranking logic on the currently filtered subset after filtering to tours with reels
- active reels loop continuously until swiped away
- a mute indicator is shown
- no reel counter is shown
- the system supports up to 20 reels without trying to play all videos at once
- opening reels closes `#siteNav`
- the menu-toggle button is disabled while reels are open
- the existing `.mobile-cta` is overlaid at the bottom of the video while reels are open
- local and staging generate and serve reel assets
- production does not show the reels UI
- production does not generate or publish reel assets or reel manifest files
- production editors can still upload and manage reel source videos
- production does not depend on direct `/content/tours/.../video.mp4` access
- reel source videos are included in the same `rsync`, backup, and restore flows as `content/tours/`

## Main Risks

### 1. Mobile Performance

Risk:

- 20 videos may overload low-end phones

Mitigation:

- generated compressed assets
- one-active-video playback rule
- limited preloading

### 2. Homepage Complexity

Risk:

- adding reels mode into `index.html` can make homepage runtime and DOM state more complex

Mitigation:

- keep reels mode isolated in a dedicated module/layer
- deliberately extract shared homepage infrastructure where needed
- keep open/close state transitions explicit

### 3. Booking Modal Regression

Risk:

- the reel layer could interfere with the current modal layering or body scroll lock

Mitigation:

- reuse existing modal code
- test modal open/close while a reel is active

### 4. Tour-Order Drift

Risk:

- reel order could drift from homepage behavior if reels use different ranking logic

Mitigation:

- reuse the same ranking logic as the homepage
- apply that logic to the current filtered subset rather than to a separate all-tours list
- filter the ranked list down to tours that actually have reels

### 5. Accidental Production Exposure

Risk:

- reels could accidentally appear in production before they are ready

Mitigation:

- gate the reels UI by using the existing hostname-based environment helpers in `main.js`
- do not generate or publish reel assets in production
- verify production behavior explicitly before release

## Recommendation

Recommended product/technical direction:

1. keep the homepage as the only public page
2. add a header-level `Reels` toggle on small screens
3. open reels as a fullscreen layer below the header
4. convert that toggle into a red `X` while reels are open
5. close reels back to the normal homepage without navigation
6. reuse the existing booking modal and homepage tour payload
7. treat each reel as tour-owned content stored at `content/tours/<tour-key>/video.mp4`
8. generate reel media assets only for local and staging, while still allowing production editors to manage reel source videos
9. keep reel source videos inside the existing `content/tours/` sync and backup model

That is the cleanest path for the currently requested UX: reels behave like a fullscreen homepage mode rather than a separate public page.
