# Central Translation Management Plan

This is a concept plan only. Do not implement from this document without a separate implementation task.

This document replaces the earlier static UI cache/override plan. The new goal is broader: editing should stay fast and English-first, while translation is managed centrally as either an operational booking workflow or a staging/local publishing workflow.

## Goals

- Remove translation work from normal backend content editing flows.
- Keep backend editing pages fast by defaulting to English/source editing.
- Manage non-booking translations centrally in `translations.html`.
- Allow production to translate bookings immediately.
- Allow staging/local to translate and publish static/public/marketing content.
- Keep production deployment safe when translations are missing or stale.
- Preserve manual translation edits and override values.
- Let staff choose a translation engine per job.

## Core Rules

- English is the source language for all editable content covered by this plan.
- Stable `source_ref` and `source_hash` values are required for every translatable source string.
- Machine translation immediately clears dirty state when it succeeds.
- Machine translation must not overwrite existing booking translations or fields with override values.
- Non-booking public/backend translations are not visible until staff clicks `Publish` in the translation tab.
- `Publish` is blocked unless all enabled target languages are clean.
- Production may translate bookings only.
- Production must not run non-booking translation jobs.
- Production reads generated runtime files only. It does not read translation job state at runtime.
- `content/translations` contains published translations only.

## Two Translation Lanes

### 1. Booking Translation Lane

Booking translation is operational, immediate, and allowed in production.

`booking.html` should expose customer language and edit mode controls:

- `Edit in <target language>`
- `Edit in English and EN -> <target language>`

When translation mode is selected, `booking.html` should show a translation section at the bottom of the page. That section should manage only customer-facing booking fields.

Booking translation behavior:

- Booking translations are excluded from the translation tab `Translate all` button.
- Booking translation results are stored in production-owned booking translation storage.
- Booking machine translation skips fields that already have a target translation.
- Booking machine translation skips fields that have an override/manual value.
- Staff can manually edit customer-facing target-language fields.
- Manual target-language edits remain protected unless staff explicitly clears or force-retranslates them.
- Translation jobs can be run from production for a selected booking/language.
- Engine choice applies only to the selected booking job.

Booking translation result identity:

```text
booking_id
source_ref
source_hash
target_lang
target_text
origin
engine_provider
engine_model
translated_at
```

Bookings do not require historical stability across future English edits. If English changes, affected translations become stale and can be regenerated.

### 2. Published Translation Lane

Static UI, public website, marketing tours, customer-visible settings content, and document chrome are translated on local/staging and published.

The translation tab exists only on local and staging. Production should hide the tab or deny access to it.

The translation tab owns:

- Dirty state detection.
- Translation jobs.
- Manual translation edits and overrides.
- Engine selection per job.
- Publish.
- Published snapshot generation under `content/translations`.
- Triggering generation of frontend/backend/public runtime files.

Production receives published translations by manual rsync of `content/translations`, then generates runtime files from that snapshot.

## Translation Tab UX

The backend nav should show a dirty translation icon or badge. Dirty means at least one required non-booking translation is missing, stale, failed, or translated but unpublished.

`translations.html` should have two top-level sections:

- `Staff`
- `Customers`

Each section can have subsections. Every level should show status and actions:

- Whole translation page.
- Each section.
- Each subsection.
- Optional per-language and per-item drilldown.

Each level should show:

- Missing count.
- Stale count.
- Failed count.
- Translated but unpublished count.
- Current/clean count.
- Last translated timestamp.
- Last published timestamp.
- `Translate` button.
- Advanced `Retranslate` action with engine selection.

`Translate` should translate missing and stale strings only.

`Retranslate` should be a separate advanced action. It can retranslate machine/cache-origin translations with the selected engine. Manual and override-origin translations should be protected unless staff explicitly includes them.

The translation worker is non-modal. Staff can leave the page while jobs run. The tab should show running jobs and recent job results.

## Translation Scope

### Staff

Staff translations are backend-facing.

Initial scope:

- Backend static UI strings from `frontend/data/i18n/backend/en.json`.
- Target language is currently Vietnamese (`vi`).

Production should generate `frontend/data/i18n/backend/vi.json` from published translations in `content/translations`, not depend on translated files committed to git.

### Customers

Customer translations are customer-facing.

Initial scope:

- Public frontend static UI strings from `frontend/data/i18n/frontend/en.json`.
- Public dynamic/catalog text:
  - destination labels
  - area labels
  - place labels
  - public staff profile/team text
- Marketing tours:
  - tour title
  - short description
  - highlights if present
  - travel-plan day titles
  - overnight locations
  - notes
  - service time labels
  - service titles
  - service details
  - service locations
  - image subtitles
  - image captions
  - image alt text
- Customer document chrome:
  - offer PDF static labels
  - travel-plan PDF static labels
  - payment document static labels
  - customer email static labels
- Catalog/reference labels where they are customer-visible.

Excluded from this lane:

- Booking-specific translations.
- Runtime booking translation jobs.

Question to resolve during implementation: emergency/settings content should be classified as `Customers` if it is customer-visible, and excluded or classified as `Staff` if it is internal-only.

## Source Index

Every translatable string should be represented as a source item.

Recommended source item shape:

```json
{
  "source_ref": "marketing_tour:tour_123:travel_plan.day_1.service_2.title",
  "domain": "marketing_tours",
  "section": "customers",
  "subsection": "marketing_tours",
  "audience": "customer",
  "source_lang": "en",
  "source_text": "Airport transfer",
  "source_hash": "sha256...",
  "context": "Customer-facing marketing tour travel-plan service title",
  "required": true
}
```

`source_ref` must be stable across edits to the English text. It should be based on entity identity and field path, not on English text.

Examples:

```text
backend_static:common.save
frontend_static:hero.title
public_dynamic:destination.VN.label
public_dynamic:area.area_north.name
public_staff:<username>:short_description
marketing_tour:<tour_id>:title
marketing_tour:<tour_id>:travel_plan.<day_id>.<service_id>.details
document_chrome:offer.total
booking:<booking_id>:travel_plan.<day_id>.<service_id>.title
```

Production and staging must be able to build their expected source index from current English/source content.

## Working State Storage

Use database tables for local/staging translation work state.

Recommended tables:

- `translation_sources`
- `translation_targets`
- `translation_jobs`
- `translation_job_items`
- `translation_engine_runs`

Suggested `translation_targets` fields:

```text
source_ref
source_hash
target_lang
target_text
origin: machine | manual | cache | override
freshness_state: missing | stale | current
job_state: idle | queued | running | failed
publish_state: unpublished | published
review_state: unreviewed | reviewed | protected
engine_provider
engine_model
engine_profile
translated_at
reviewed_at
published_at
updated_by
```

The database is the working state for translation jobs. It can include in-progress jobs, failures, logs, retries, manual drafts, and engine metadata.

Do not collapse these dimensions into one status field. A target can be manual, current, unpublished, and protected at the same time. UI labels and counts should be derived from the separate dimensions.

## Published Snapshot

`content/translations` is the published translation snapshot and the release artifact for translations.

It is ignored by git and copied manually by rsync between environments. Rsync remains the backup and transport mechanism between repositories, but production must still validate and atomically apply the snapshot before generated runtime files change.

It must contain only published translations. It should not contain in-progress job state.

Published translations may have these origins:

- `machine`
- `manual`
- `cache`
- `override`

Recommended shape:

```text
content/translations/
  manifest.json
  staff/
    backend-ui.vi.json
  customers/
    frontend-static.<lang>.json
    public-dynamic.<lang>.json
    marketing-tours.<lang>.json
    documents.<lang>.json
    catalogs.<lang>.json
```

Manifest example:

```json
{
  "schema_version": 1,
  "published_at": "2026-05-01T00:00:00.000Z",
  "published_from": "staging",
  "source_set_hash": "sha256...",
  "staff_languages": ["vi"],
  "customer_languages": ["ar", "de", "fr", "vi"],
  "items_count": 1234
}
```

Item example:

```json
{
  "source_ref": "marketing_tour:tour_123:short_description",
  "source_hash": "sha256...",
  "source_text": "Explore Hanoi by night",
  "target_lang": "de",
  "target_text": "Entdecken Sie Hanoi bei Nacht",
  "origin": "machine",
  "engine": {
    "provider": "openai",
    "model": "gpt-5.1"
  },
  "published_at": "2026-05-01T00:00:00.000Z"
}
```

`source_text` is useful for debugging. Validation must trust the current environment source index and `source_hash`, not the copied `source_text`.

## Publish Workflow

`Publish` deploys all non-booking translations in the staging/local environment.

It should:

1. Build the current non-booking source index.
2. Verify all enabled target languages are clean.
3. Block publish if any required item is missing, stale, failed, running, or unpublished.
4. Write a new published snapshot under `content/translations`.
5. Trigger generation of backend/frontend/public runtime files.
6. Verify generated outputs.
7. Mark the published state clean.

Publish is all-or-nothing for enabled target languages.

This is intentional. Enabled target languages are the production contract, so staff should only enable languages that must ship together.

Public website translations become visible only after `Publish`.

## Production Deployment Workflow

Production deployment should use rsynced `content/translations` to generate the published website/backend runtime files.

Production deployment must start by identifying missing or stale translations.

It should:

1. Read `content/translations`.
2. Build the production source index from current English/source content.
3. Validate every required non-booking `source_ref` and target language:
   - item exists
   - `source_hash` matches
   - `target_text` is non-empty
   - origin is allowed
4. Abort deployment if validation fails.
5. Leave the currently deployed production site untouched if validation fails.
6. If validation passes, generate runtime files into a temporary location.
7. Run integrity checks.
8. Atomically replace generated runtime files.

Production should not break the deployed site because of a bad translation snapshot.

Production should not call OpenAI, Google, or any other translation engine for non-booking content.

Runtime should read generated data only, for example:

- `frontend/data/i18n/backend/vi.json`
- `frontend/data/i18n/frontend/<lang>.json`
- `frontend/data/generated/homepage/public-tours.<lang>.json`
- `frontend/data/generated/homepage/public-team.json`
- generated SEO files

## Atomic Rsync And Apply

Avoid production reading half-copied translation snapshots.

Recommended options:

```text
content/translations/releases/<timestamp>/
content/translations/current -> releases/<timestamp>
```

or:

```text
rsync into content/translations.next
validate content/translations.next
rename content/translations.next to content/translations
```

The production apply command should validate before changing generated runtime files.

## Job And Concurrency Model

Translation jobs should claim work item by item. Do not use one global lock for all translation.

Suggested job item fields:

```text
job_id
source_ref
source_hash
target_lang
status
locked_by_job_id
locked_until
started_at
finished_at
engine_provider
engine_model
error
```

Two staff can press `Translate all` at the same time.

If jobs overlap:

- They may claim different items independently.
- If both jobs translate the same item, last completed wins.
- Last completed wins only when the completed result still matches the current `source_hash`.
- If a job completes for an old `source_hash`, discard the result as stale.
- If a job crashes, `locked_until` expires and another job can reclaim the item.

Engine choice is per job only. It does not change defaults for future jobs unless a separate settings feature is added.

## Translation Memory And Cache

Translation memory should be separate from translation targets.

Translation memory answers:

```text
Have we translated this exact English phrase before?
```

Translation targets answer:

```text
What is the current translation for this exact source_ref, source_hash, and target language?
```

For now, translation memory identity is global exact-English text plus target language. Identical English strings should reuse identical translations independent of context.

Translation memory can be used as a provider/cache for both booking and non-booking jobs, but booking-specific result storage should stay production-owned and should not be overwritten by global non-booking retranslation jobs.

## Dirty State

Dirty state should be computed from the source index and target/published state.

Dirty state should not be stored as one status. It is derived from separate target state dimensions:

- `freshness_state`: `missing`, `stale`, or `current`.
- `job_state`: `idle`, `queued`, `running`, or `failed`.
- `publish_state`: `unpublished` or `published`.
- `review_state`: `unreviewed`, `reviewed`, or `protected`.
- `origin`: `machine`, `manual`, `cache`, or `override`.

A required item is dirty when:

- freshness is `missing` or `stale`.
- job state is `queued`, `running`, or `failed`.
- publish state is `unpublished`.
- review is required and review state is `unreviewed`.

The UI can still show friendly derived labels such as `Missing`, `Stale`, `Running`, `Failed`, `Translated but unpublished`, `Published`, or `Manual protected`, but those labels should be computed from the dimensions above.

The nav icon can show a simple dirty indicator, but the translation tab should expose detailed counts.

## Implementation Phases

1. Source index prototype.
   - Build source collectors for backend static UI, frontend static UI, public dynamic content, marketing tours, documents, and booking customer fields.
   - Add stable `source_ref` conventions.
   - Add coverage checks.

2. Database working state.
   - Add translation source/target/job tables.
   - Add item-level job claiming and source-hash guarded completion.
   - Add per-job engine selection.

3. Booking lane.
   - Update `booking.html` edit mode selector.
   - Add bottom translation section for customer-facing fields only.
   - Add production-safe booking translation jobs.
   - Enforce skip-existing and skip-override rules.

4. Translation tab lane.
   - Restrict tab to local/staging.
   - Add `Staff` and `Customers` sections with flags.
   - Add dirty counts and translate actions at page, section, and subsection levels.
   - Add non-modal job progress.

5. Publish and snapshot.
   - Add publish validation.
   - Write published snapshots to `content/translations`.
   - Trigger backend/frontend/public generation.
   - Block publish unless all enabled target languages are clean.

6. Production apply.
   - Add production command to validate `content/translations`.
   - Abort before modifying generated files if missing/stale translations are found.
   - Generate backend/public runtime files from the published snapshot.
   - Add atomic generated output replacement.

## Open Questions

- Which target languages are considered enabled and therefore required for publish?
- Should emergency/settings content be classified as customer-facing or internal-only?
- Should staging be the only environment allowed to create `content/translations`, or can local publish snapshots too?
- Should failed optional strings block publish, or only required strings?
