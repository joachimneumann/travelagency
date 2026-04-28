# Translation Cache And Override Plan

This is a concept plan only. Do not implement from this document without a separate implementation task.

## Goal

Add a dedicated backend menu tab for managing static UI translation overrides and inspecting translation cache state.

The tab should support two translation domains:

- Customer-facing website strings: all frontend/public website languages from `FRONTEND_LANGUAGE_CODES`.
- Backend UI strings: backend staff UI languages, currently `en` and `vi`, with `en` as the source and `vi` as the translated target.

The tab should let admins edit override files, inspect generated translation dictionaries and metadata read-only, and run the existing sync/apply flow from the browser behind a modal wait screen.

## Current State

The existing static UI translation flow is file-based:

- Frontend/public website source dictionary: `frontend/data/i18n/frontend/en.json`.
- Frontend/public website translated dictionaries: `frontend/data/i18n/frontend/<lang>.json`.
- Frontend/public website translation metadata: `frontend/data/i18n/frontend_meta/<lang>.json`.
- Frontend/public website manual overrides: `frontend/data/i18n/frontend_overrides/<lang>.json`.
- Backend UI source dictionary: `frontend/data/i18n/backend/en.json`.
- Backend UI translated dictionary: `frontend/data/i18n/backend/vi.json`.
- Backend UI translation metadata: `frontend/data/i18n/backend/vi.meta.json`.
- Backend UI manual overrides: `frontend/data/i18n/backend_overrides/vi.json`.

The existing scripts are:

- `node scripts/i18n/sync_frontend_i18n.mjs check`
- `node scripts/i18n/sync_frontend_i18n.mjs translate`
- `node scripts/i18n/sync_backend_i18n.mjs check --target vi`
- `node scripts/i18n/sync_backend_i18n.mjs translate --target vi`
- `./scripts/i18n/translate check`
- `./scripts/i18n/translate update`
- `./scripts/i18n/translate all`

Current override behavior:

- Override JSON files are keyed by static i18n key.
- Overrides are applied during sync.
- Applied override entries are written into the generated dictionary.
- Metadata entries are marked with `origin: "manual_override"` and a source hash.
- Override values are ignored if the key does not exist in the source dictionary.
- When a source string changes, its source hash changes. This must automatically make every generated translation for that key stale across all target languages unless the target value is a current manual override.

Important distinction:

- This plan covers static UI dictionaries only.
- It does not replace booking/tour/customer-content localized fields, translation rules, PDF content translations, or per-booking manual target-language locks.

## Target UX

Add a backend navigation tab named `Translations`.

Access:

- Visible only to `atp_admin`.
- Uses normal backend auth and backend language menu.
- Route suggestion: `/translations.html`.
- Backend nav section id suggestion: `translations`.

Main page layout:

- Header with page title, status summary, and primary `Apply` CTA.
- Domain switcher: `Customer-facing website` and `Backend UI`.
- Left column or top toolbar for language selection.
- Main editable override grid.
- Secondary read-only cache viewers.

Customer-facing website override editor:

- Language selector includes every non-source frontend language.
- Source language is `en` and should be shown read-only.
- Table columns: key, English source, current generated translation, override value, origin, stale status, updated timestamp.
- Admin can add or edit override value for a key.
- Empty override value means no override for that key.
- Search by key/source/translation/override.
- Filters: overridden only, missing translation, stale translation, machine translated, manual override.

Backend UI override editor:

- Domain is limited to `en` source and `vi` target unless the backend language catalog expands later.
- Table columns mirror the customer-facing editor.
- Admin edits Vietnamese override values only.

Read-only cache viewers:

- Customer-facing cache viewer reads `frontend/data/i18n/frontend/<lang>.json` plus `frontend/data/i18n/frontend_meta/<lang>.json`.
- Backend cache viewer reads `frontend/data/i18n/backend/<lang>.json` plus `frontend/data/i18n/backend/<lang>.meta.json`.
- Viewers must be explicitly read-only and visually separate from override editing.
- They should expose raw JSON-like detail for a selected key: source value, cached target value, metadata, override value if present.

Apply CTA:

- The page has one primary `Apply` button.
- On click, show a modal wait screen with progress output.
- The modal should block navigation while apply is running.
- Suggested text: `Applying translation overrides. This may translate missing or stale strings and rebuild generated homepage assets.`
- Show live command phases, stdout/stderr tail, and final success/error.
- On success, refresh dictionaries and cache viewers in the page.
- On failure, keep the modal open with error details and do not claim success.

## Proposed Data Model

Keep the file-based dictionary model. Do not introduce a database table unless there is a later need for audit history or concurrent editing.

Add a backend-facing normalized API model over the existing files:

```json
{
  "domain": "frontend",
  "source_lang": "en",
  "target_lang": "de",
  "items": [
    {
      "key": "hero.title",
      "source": "Private holidays in Vietnam",
      "cached": "Private Ferien in Vietnam",
      "override": "Private Vietnam-Reisen",
      "origin": "manual_override",
      "source_hash": "...",
      "expected_source_hash": "...",
      "status": "manual_override"
    }
  ]
}
```

Suggested item statuses:

- `source`: target language is the source language.
- `missing`: source key has no target value.
- `stale`: metadata hash does not match current source.
- `machine`: target exists and metadata origin is machine.
- `manual_override`: override exists or metadata origin is manual override.
- `legacy`: target exists but metadata is missing or has legacy origin.
- `extra`: target or metadata key no longer exists in source.

Override file shape should remain simple:

```json
{
  "hero.title": "Private Vietnam holidays"
}
```

Validation rules:

- Domain must be `frontend` or `backend`.
- Frontend target language must be in `FRONTEND_LANGUAGE_CODES` and not equal to `en`.
- Backend target language must be `vi` for the current implementation.
- Key must exist in the source dictionary before it can be saved as an override.
- Override value must be a string.
- Empty string removes the override.
- JSON writes must be stable and sorted by source dictionary order.
- Template tokens such as `{destination}` must be preserved or flagged before save.

## Proposed Backend API

Add a new handler module, for example:

- `backend/app/src/http/handlers/static_translations.js`

Suggested routes:

- `GET /api/v1/static-translations/domains`
- `GET /api/v1/static-translations/{domain}/languages`
- `GET /api/v1/static-translations/{domain}/{target_lang}`
- `PATCH /api/v1/static-translations/{domain}/{target_lang}/overrides`
- `POST /api/v1/static-translations/apply`
- `POST /api/v1/static-translations/retranslate`

Optional route if streaming logs is needed:

- `GET /api/v1/static-translations/apply/{job_id}/events`

Permissions:

- All routes require an authenticated principal.
- Read routes require `atp_admin` initially.
- Write/apply routes require `atp_admin`.

Patch payload:

```json
{
  "expected_revision": "sha256-of-current-override-file",
  "overrides": {
    "hero.title": "Private Vietnam holidays",
    "unused.key": ""
  }
}
```

Patch response:

```json
{
  "ok": true,
  "revision": "new-sha256",
  "removed_keys": ["unused.key"],
  "saved_keys": ["hero.title"]
}
```

Use an expected revision to avoid silently overwriting manual file edits or another admin's changes.

## Apply Workflow

The `Apply` endpoint should run the existing scripts, not duplicate translation logic in the HTTP handler.

Recommended command sequence:

1. `node scripts/i18n/sync_backend_i18n.mjs translate --target vi`
2. `node scripts/i18n/sync_frontend_i18n.mjs translate`
3. `node scripts/assets/generate_public_homepage_assets.mjs`
4. `node scripts/i18n/sync_backend_i18n.mjs check --target vi`
5. `node scripts/i18n/sync_frontend_i18n.mjs check`

Notes:

- Step 3 matters because public homepage copy is generated into `frontend/data/generated/homepage/public-homepage-copy.global.js` and related static assets.
- The apply endpoint should run from the repo root so all relative paths match current scripts.
- The endpoint should inherit required environment variables such as `OPENAI_API_KEY`, `OPENAI_TRANSLATION_MODEL`, `OPENAI_ORGANIZATION_ID`, and `OPENAI_PROJECT_ID`.
- If no OpenAI key is available, current scripts may fall back to Google Translate through `translation_client.js`; the UI should show the provider in the output when the script prints it.
- Apply should be serialized. If one apply job is running, a second request should return `409`.

Job model:

- Keep an in-memory job registry for the first version.
- Store job id, status, started_at, finished_at, exit code, current phase, and log tail.
- Persisting job history can be deferred unless there is a real audit requirement.

Failure behavior:

- If backend sync fails, stop before frontend sync.
- If frontend sync fails, do not run homepage generation.
- If homepage generation fails, report success for dictionary sync but failure for publish/apply.
- Always show the exact failed phase and command exit code.

## Advanced Retranslation And Cache Invalidation

Admins may be unhappy with generated translations even when the source text has not changed and no dictionary entry is technically stale.

The UI should not call this "invalidate cache" as the primary label, because the important durable value is the generated dictionary entry, not the in-memory translation client cache. Use wording such as:

- `Retranslate current language`
- `Retranslate all customer-facing languages`
- `Retranslate backend Vietnamese`

Current technical behavior:

- The translation client's internal cache is in memory only.
- The static i18n scripts run as separate Node processes, so their in-memory cache does not persist across apply runs.
- The durable "cached" value shown to admins is the generated target dictionary plus metadata in `frontend/data/i18n/...`.

V1 behavior:

- Normal `Apply` should remain incremental: apply overrides, translate missing/stale strings, regenerate homepage assets, and check.
- If a source string changes, `Apply` must automatically retranslate that key for every affected target language because the metadata source hash no longer matches.
- `Retranslate current language` should force-refresh machine-managed generated values for the selected domain/language.
- Manual static dictionary overrides must always win and must not be overwritten.
- Existing override keys should be skipped during force retranslation, matching current `--force-all` script behavior.
- This action must require confirmation because it can change many strings and consume translation quota.

Recommended advanced actions:

- Frontend domain, selected language: run `node scripts/i18n/sync_frontend_i18n.mjs translate --target <lang> --force-all`, then regenerate homepage assets and run checks.
- Frontend domain, all languages: run `node scripts/i18n/sync_frontend_i18n.mjs translate --force-all`, then regenerate homepage assets and run checks.
- Backend domain: run `node scripts/i18n/sync_backend_i18n.mjs translate --target vi --force-all`, then run backend check.

Recommended UI placement:

- Put force-retranslation actions behind an `Advanced` disclosure or secondary menu.
- Show a warning that machine translations may change and manual overrides are preserved.
- Show the same blocking apply/retranslation modal with command phases and log tail.

Future finer-grained support:

- Add script support for `--key <i18n_key>` or `--keys-file <path>` if admins need to retranslate only selected keys.
- Then expose row-level `Retranslate this key` or multi-select `Retranslate selected` actions.
- Until key-level script support exists, avoid pretending row-level retranslation is supported.

## Frontend Page Plan

Add:

- `frontend/pages/translations.html`
- `frontend/scripts/pages/translations.js`
- CSS in `shared/css/pages/backend-translations.css` or existing backend page CSS pattern.
- Backend nav item in `frontend/scripts/shared/nav.js`.
- Caddy local route entry for `/translations.html`.
- Backend i18n keys for the new page labels in `frontend/data/i18n/backend/en.json`.

Page state:

- Active domain.
- Active target language.
- Loaded source dictionary, target dictionary, metadata, and override revision.
- Dirty override map.
- Search and status filters.
- Apply job state.

Interaction details:

- Save override edits separately from Apply, or auto-save before Apply.
- Recommended: page has `Save overrides` and `Apply` buttons.
- `Apply` should be disabled while there are unsaved override edits, unless it first saves overrides with the current revision.
- Use a modal wait screen for apply, similar to existing page overlays.
- After apply succeeds, reload the active domain/language and clear dirty state.

Tradeoff:

- A single `Apply` button is simpler for staff, but conflates saving override JSON with executing translation scripts.
- Separate `Save overrides` and `Apply` is safer because admins can stage edits and review cache status before running translation.
- If the UI must have only one CTA, implement `Apply` as `save dirty overrides first, then run apply`, with an explicit confirmation when there are unsaved edits.

## Cache Viewer Details

The read-only cache viewer should not read arbitrary files.

Backend API should expose normalized dictionary/cache rows instead of raw filesystem browsing:

- Source dictionary value.
- Target cached dictionary value.
- Metadata entry.
- Override value.
- Computed status.

For debugging, expose a selected-key JSON panel:

```json
{
  "key": "hero.title",
  "source": "...",
  "target": "...",
  "metadata": {
    "source_hash": "...",
    "origin": "machine",
    "updated_at": "..."
  },
  "override": "..."
}
```

Do not allow edits in the cache viewer. All writes go through the override editor.

## Concurrency And File Safety

File writes should be atomic:

- Write to a temp file in the same directory.
- Rename over the target file.
- Preserve trailing newline.

Revision calculation:

- Use SHA-256 of the current override file contents.
- Missing override file has a stable empty revision.
- Return new revision after every write.

Conflict handling:

- If expected revision does not match, return `409`.
- Response should include the latest normalized override state so the UI can reload.

## Security

Risks:

- The apply endpoint executes local scripts.
- Override values are displayed in HTML.
- Translation strings can contain template placeholders.

Controls:

- Apply route must not accept arbitrary command strings.
- Domain and language must be allowlisted.
- Override keys must exist in source dictionaries.
- Escape all displayed values in the frontend.
- Validate placeholder preservation before save, or at least show warnings for changed placeholder sets.
- Limit logs returned to the browser to avoid leaking unrelated environment values.

## Implementation Phases

1. Backend read API.
   - Add normalized readers for frontend/backend dictionaries, metadata, and overrides.
   - Add status computation and revision hashes.
   - Add tests for missing, stale, manual override, extra, and legacy states.

2. Backend write API.
   - Add override patch endpoint with revision protection.
   - Add atomic JSON writes.
   - Add tests for save, remove, invalid key, invalid language, and revision conflict.

3. Backend apply API.
   - Add serialized job runner for the fixed command sequence.
   - Capture phase status and log tail.
   - Add tests for command sequencing and lock behavior using injectable command runner.

4. Frontend page.
   - Add backend nav tab and translations page.
   - Build domain/language selectors, override grid, cache viewer, dirty-state handling, and apply modal.
   - Keep the first version table-based and utilitarian.

5. Integration and polish.
   - Add backend i18n labels for the page.
   - Add route to local Caddy config.
   - Run `./scripts/i18n/translate check` after adding labels.
   - Verify apply refreshes homepage generated assets and backend dictionaries.

## Open Questions

- Should admins be able to override the English source dictionaries from this page, or should English remain source-code controlled only?
- Should apply always process all frontend languages, or only the currently selected domain/language?
- Should the page include audit history of who changed an override?
- Should override files remain in git as deployment artifacts, or should production edits be exported and committed through a separate process?
- Should translation cache metadata be renamed in the UI to avoid implying it is disposable cache? It currently affects stale detection and manual override origin.
- Should v1 include only language-level force retranslation, or should key-level script support be implemented before exposing retranslation controls?

## Acceptance Criteria

- Admin can view and edit static customer-facing override values for supported frontend target languages.
- Admin can view and edit static backend UI override values for Vietnamese.
- Admin can inspect generated dictionary and metadata state read-only.
- Apply runs the required sync/generation/check scripts and shows a blocking modal wait state.
- Apply success makes override changes visible in the customer-facing webpage or backend UI after reload.
- Advanced retranslation can force-refresh generated machine translations without overwriting static override keys.
- Invalid keys, invalid languages, concurrent apply jobs, and stale override revisions fail safely.

## Existing Translation Context

The system already has translation context to improve OpenAI translation quality.

Static dictionary scripts:

- Customer-facing website strings use `FRONTEND_TRANSLATION_CONTEXT` in `scripts/i18n/sync_frontend_i18n.mjs`.
- Backend UI strings use `BACKEND_UI_TRANSLATION_CONTEXT` in `scripts/i18n/sync_backend_i18n.mjs`.

Runtime translation profiles:

- `backend/app/src/lib/translation_profiles.js` defines reusable profiles:
  - `marketing_trip_copy`
  - `customer_travel_plan`
  - `staff_backend_ui`
  - `staff_profile`

OpenAI prompt behavior:

- `backend/app/src/lib/translation_client.js` builds instructions from:
  - source language
  - target language
  - domain label
  - context note
  - glossary terms
  - protected terms
  - translation rules
  - JSON/key preservation rules

Translation rules:

- Existing backend-managed translation rules can enforce exact term or phrase translations by target language.
- These rules are separate from static dictionary overrides.
- Rules affect provider input/output during translation, while static dictionary overrides replace final dictionary values by key.

Important limitation:

- Rich context is only used by the OpenAI provider.
- If translation falls back to Google Translate, Google receives source/target language and the masked exact translation-rule behavior, but not the full domain/context prompt.

Plan for the new backend tab:

- V1 should expose the active translation context read-only for each domain.
- The customer-facing domain should show the static frontend context used by `sync_frontend_i18n.mjs`.
- The backend UI domain should show the static backend context used by `sync_backend_i18n.mjs`.
- The page should also explain that translation rules are managed separately in Settings and are applied during translation, while overrides are final per-key replacements.
- Do not make context editable in v1. Keep it code-controlled so cache keys, prompt behavior, and translation quality remain predictable.

## Concept Review

The concept is viable and fits the current architecture because static translations are already file-backed and script-applied. The safest implementation is to wrap the existing dictionary files and sync scripts with a narrow backend API instead of moving translations into the application store.

Recommended decisions:

- Keep override files as the durable source of manual overrides for the first implementation.
- Keep generated dictionaries and metadata read-only in the UI.
- Use `Save overrides` and `Apply` as separate actions, even if `Apply` can offer to save first. This avoids surprising long-running translation work when an admin only wants to stage copy changes.
- Use polling for apply job status instead of server-sent events in the first implementation. The existing app does not have an SSE pattern, polling is simpler to test, and apply jobs are rare admin operations.
- Add a small backend domain module for static translation file handling instead of putting filesystem parsing in the HTTP handler.
- Use fixed command phases for apply. Do not let the browser send command names, script names, or CLI args.
- Add explicit advanced retranslation actions that map to fixed `--force-all` command phases; do not expose arbitrary invalidation commands.
- Do not include source-language override editing in v1. English source dictionaries should remain code-controlled because source changes invalidate all target hashes.
- Add a new backend page rather than expanding settings. The existing settings page already has unrelated `translation-rules`; a separate page reduces confusion between content translation rules and static UI dictionary overrides.

Risks to address before coding:

- Running translation scripts from an HTTP request can take long enough to hit proxy/client timeouts. The API should create an apply job and return immediately.
- The local and production runtime must have write access to `frontend/data/i18n/*`, `frontend/data/generated/homepage/*`, and generated homepage asset paths if production editing is expected.
- Override files are currently deploy artifacts. If production edits happen in the UI, there must be an operational process to export/commit those file changes, or production edits may be overwritten on deploy.
- The generated API request factory is currently used by many backend pages. Either add the new endpoints to the API model and regenerate artifacts, or use local `fetchApiJson` wrappers for the first version and explicitly document that choice.

V1 scope:

- Static frontend dictionary overrides for all non-English frontend languages.
- Static backend UI override for Vietnamese.
- Read-only cache/metadata inspection.
- Apply job with log tail and polling.
- Admin-only access.

Out of scope for v1:

- Editing English source strings.
- Translation memory for booking/tour/customer content.
- Audit history.
- Multi-user collaborative editing.
- Production git commit/export workflow.
- Streaming logs over SSE.

## Implementation Plan

### Phase 1: Backend Static Translation Domain

Add a pure backend domain module:

- `backend/app/src/domain/static_translations.js`

Responsibilities:

- Resolve allowed domains and languages.
- Read source dictionary, target dictionary, metadata, and override file.
- Compute source hashes using the same SHA-256 algorithm as the sync scripts.
- Compute normalized rows and statuses.
- Compute override file revision hash.
- Validate override patches.
- Write override JSON atomically.

Suggested exported functions:

```js
createStaticTranslationService({
  repoRoot,
  frontendLanguageCodes,
  backendTargetLanguages = ["vi"],
  readFile,
  writeFile,
  rename,
  mkdir
})
```

```js
service.listDomains()
service.listLanguages(domain)
service.getLanguageState(domain, targetLang)
service.patchOverrides(domain, targetLang, { expectedRevision, overrides })
```

Data paths:

- Frontend source: `frontend/data/i18n/frontend/en.json`
- Frontend target: `frontend/data/i18n/frontend/<lang>.json`
- Frontend metadata: `frontend/data/i18n/frontend_meta/<lang>.json`
- Frontend overrides: `frontend/data/i18n/frontend_overrides/<lang>.json`
- Backend source: `frontend/data/i18n/backend/en.json`
- Backend target: `frontend/data/i18n/backend/vi.json`
- Backend metadata: `frontend/data/i18n/backend/vi.meta.json`
- Backend overrides: `frontend/data/i18n/backend_overrides/vi.json`

Implementation details:

- Missing override files should be treated as `{}`.
- Missing metadata files should be treated as `{}`.
- Missing target dictionaries should be an error for backend `vi`, but for frontend targets it can be reported as an empty cache only if the language is allowlisted.
- JSON object ordering should follow the source dictionary key order.
- Atomic write should write `<file>.tmp-<pid>-<timestamp>` and rename over the final path.
- Empty override values remove keys.
- Unknown override keys return `400`.
- Revision mismatch returns `409`.

Status calculation:

- `manual_override`: override exists for the key, or metadata origin is `manual_override`.
- `missing`: source key exists and target value is empty.
- `stale`: metadata source hash exists but differs from current source hash.
- `machine`: target value exists and metadata origin is `machine`.
- `legacy`: target value exists but metadata is missing or origin is empty/legacy.
- `extra`: target or metadata key exists outside the source dictionary.

Automatic invalidation requirement:

- Source string changes are detected by comparing the current source hash with the stored metadata `source_hash`.
- A changed source string must automatically mark that key stale for every target language where the key is not currently overridden.
- The next normal `Apply` must refresh those stale translations without requiring a manual cache-invalidation action.
- Manual override keys remain valid final values, but their metadata source hash should be refreshed when overrides are applied so the UI can show they intentionally override the latest source.

Tests:

- `backend/app/test/static_translations.test.js`
- Use a temp repo root with small frontend/backend dictionaries.
- Test read state for machine, manual, missing, stale, legacy, and extra.
- Test that changing one source string marks that key stale across all target languages.
- Test patch save, remove, invalid key, invalid language, and revision conflict.
- Test stable key ordering.
- Test placeholder warning helper if implemented in this phase.

### Phase 2: Backend Apply Job Runner

Add a backend job runner module:

- `backend/app/src/domain/static_translation_apply_jobs.js`

Responsibilities:

- Start one apply job at a time.
- Run fixed command phases.
- Capture status, phase, timestamps, exit code, and bounded log tail.
- Expose job snapshots for polling.

Suggested command phases:

```js
[
  ["backend_translate", "node", ["scripts/i18n/sync_backend_i18n.mjs", "translate", "--target", "vi"]],
  ["frontend_translate", "node", ["scripts/i18n/sync_frontend_i18n.mjs", "translate"]],
  ["homepage_assets", "node", ["scripts/assets/generate_public_homepage_assets.mjs"]],
  ["backend_check", "node", ["scripts/i18n/sync_backend_i18n.mjs", "check", "--target", "vi"]],
  ["frontend_check", "node", ["scripts/i18n/sync_frontend_i18n.mjs", "check"]]
]
```

Suggested fixed retranslation modes:

```js
{
  frontend_current_language: (targetLang) => [
    ["frontend_translate_force", "node", ["scripts/i18n/sync_frontend_i18n.mjs", "translate", "--target", targetLang, "--force-all"]],
    ["homepage_assets", "node", ["scripts/assets/generate_public_homepage_assets.mjs"]],
    ["frontend_check", "node", ["scripts/i18n/sync_frontend_i18n.mjs", "check", "--target", targetLang]]
  ],
  frontend_all_languages: () => [
    ["frontend_translate_force", "node", ["scripts/i18n/sync_frontend_i18n.mjs", "translate", "--force-all"]],
    ["homepage_assets", "node", ["scripts/assets/generate_public_homepage_assets.mjs"]],
    ["frontend_check", "node", ["scripts/i18n/sync_frontend_i18n.mjs", "check"]]
  ],
  backend_vi: () => [
    ["backend_translate_force", "node", ["scripts/i18n/sync_backend_i18n.mjs", "translate", "--target", "vi", "--force-all"]],
    ["backend_check", "node", ["scripts/i18n/sync_backend_i18n.mjs", "check", "--target", "vi"]]
  ]
}
```

Implementation details:

- Use `child_process.spawn`, not `exec`, to avoid buffer limits.
- Set `cwd` to repo root.
- Inherit the backend process environment.
- Keep the last N log lines, for example 400.
- Redact obvious secrets from logs: `OPENAI_API_KEY`, bearer tokens, cookie values.
- Return `409` if a job is already running.
- Keep completed jobs in memory for a short window, for example latest 10 jobs or 1 hour.
- Validate retranslation mode and language server-side.
- Never accept raw commands, script paths, or arbitrary args from the browser.

Job status shape:

```json
{
  "job_id": "uuid",
  "status": "running",
  "phase": "frontend_translate",
  "started_at": "...",
  "finished_at": null,
  "exit_code": null,
  "log_tail": ["..."]
}
```

Tests:

- Use an injectable runner instead of spawning real scripts.
- Test fixed phase order.
- Test stop-on-failure behavior.
- Test lock behavior for concurrent start.
- Test log tail truncation.
- Test completed job snapshot.
- Test force-retranslation mode command selection.

### Phase 3: HTTP API

Add:

- `backend/app/src/http/handlers/static_translations.js`

Wire into:

- `backend/app/src/bootstrap/application_handlers.js`
- `backend/app/src/http/routes.js`

Routes:

- `GET /api/v1/static-translations/domains`
- `GET /api/v1/static-translations/{domain}/languages`
- `GET /api/v1/static-translations/{domain}/{target_lang}`
- `PATCH /api/v1/static-translations/{domain}/{target_lang}/overrides`
- `POST /api/v1/static-translations/apply`
- `POST /api/v1/static-translations/retranslate`
- `GET /api/v1/static-translations/apply/{job_id}`

Permission model:

- Reuse `canReadSettings(principal)` for read in v1, or add a specific `canReadStaticTranslations`.
- Reuse admin-only settings permission for write/apply.
- Return `403` for non-admins.

Response details:

- `GET language state` returns normalized rows, revision, domain metadata, target language label, source language label, and available statuses.
- `PATCH overrides` returns updated normalized language state, not only the saved keys. This simplifies frontend refresh.
- `POST apply` returns `202` with job snapshot.
- `POST retranslate` returns `202` with job snapshot and accepts only fixed modes such as `frontend_current_language`, `frontend_all_languages`, or `backend_vi`.
- `GET apply job` returns `200` for known jobs, `404` for unknown/expired jobs.

Generated API artifacts:

- Preferred: add the endpoints to the API model and regenerate `Generated/API` files.
- Acceptable v1 shortcut: use `fetchApiJson` directly in the frontend page, but document this as a deliberate exception.

Tests:

- Add HTTP route tests for permission denial, read success, patch success, patch conflict, apply start, apply conflict, and job polling.
- Use injectable temp repo paths and fake apply runner where possible.

### Phase 4: Backend Page And Navigation

Add page:

- `frontend/pages/translations.html`

Add script:

- `frontend/scripts/pages/translations.js`

Add CSS:

- Prefer `shared/css/pages/backend-translations.css`.
- Import it from the shared CSS entry if needed.

Wire navigation:

- Add `translations` to `frontend/scripts/shared/nav.js`.
- Add the new nav item visible only to `atp_admin`.
- Use `assets/img/translation.png` as the backend menu icon for the `Translations` tab, following the existing backend nav image pattern.
- Add local Caddy route for `/translations.html` in `deploy-config/Caddyfile.local`.

Translations page layout:

- Header: title, domain segmented control, language selector, status, `Save overrides`, `Apply`.
- Main grid: editable rows table on the left/full width.
- Inspector panel: selected key read-only cache/metadata JSON.
- Apply overlay: blocking modal/overlay with spinner, phase, and log tail.
- Advanced disclosure/menu: `Retranslate current language`, plus all-language action for the frontend domain.

Implementation details:

- Initialize page chrome with existing backend helpers.
- Use `textContent` for dynamic string rendering.
- Use `escapeHtml` only when building table HTML strings.
- Track dirty edits in memory.
- Disable language/domain switches when dirty unless the user confirms discard.
- Disable `Apply` while dirty, or implement `Apply` as save-then-apply with explicit confirmation.
- Poll apply job every 1-2 seconds until terminal status.
- After apply succeeds, reload the active language state.
- Require confirmation before starting any force-retranslation job.
- Make confirmation text clear that manual override keys are preserved but machine translations may change.

Recommended first UI:

- Table with sticky header.
- Search input.
- Status filter select.
- Rows show key, source, cached, override textarea, status badge, updated timestamp.
- Details panel shows selected key JSON.

Avoid:

- Editing raw JSON blobs directly.
- Allowing arbitrary file names or paths.
- Running apply automatically after every override save.

### Phase 5: Backend I18n Keys

Add English backend UI keys for the new page:

- `nav.translations`
- `backend.translations.title`
- `backend.translations.domain.frontend`
- `backend.translations.domain.backend`
- `backend.translations.language`
- `backend.translations.save_overrides`
- `backend.translations.apply`
- `backend.translations.status.*`
- `backend.translations.filters.*`
- `backend.translations.apply_overlay.*`

Then run:

```bash
node scripts/i18n/sync_backend_i18n.mjs translate --target vi
node scripts/i18n/sync_backend_i18n.mjs check --target vi
```

If frontend customer-facing labels are added to public pages as part of this work, run the frontend sync as well. The translations page itself is backend UI, so backend dictionary sync should be sufficient for its labels.

### Phase 6: End-To-End Verification

Backend tests:

```bash
node --test test/static_translations.test.js
node --test test/http_routes.test.js
```

Full backend test suite if route wiring or auth helpers changed:

```bash
node --test test/*.test.js
```

Manual local checks:

1. Start local backend and frontend.
2. Log in as admin.
3. Open `/translations.html`.
4. Select frontend domain and a non-English language.
5. Add a harmless override for a visible key.
6. Save overrides.
7. Apply.
8. Confirm the apply modal reaches success.
9. Reload public homepage in that language and confirm the override is visible.
10. Select backend domain and Vietnamese.
11. Add a harmless backend UI override.
12. Apply and reload backend page with `?lang=vi`.
13. Confirm non-admin users cannot open or call the API.

Regression checks:

- `./scripts/i18n/translate check`
- `node --test backend/app/test/public_homepage_assets.test.js`

### Phase 7: Deployment Notes

Before enabling production editing, decide the persistence model:

- If production override edits are allowed, production must preserve changed override files between deployments.
- If git remains the source of truth, add an export or operational process to commit override files after production edits.
- If deployment overwrites local files, make the page read-only in production until persistence is clarified.

Recommended v1 deployment stance:

- Enable full editing locally/staging.
- Enable production only after confirming generated files and override files are on persistent storage or are committed through the normal deployment workflow.
