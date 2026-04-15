Add optional per-language override files here as `<lang>.json`.

Example:

```json
{
  "home.hero.title": "Your curated manual translation"
}
```

`node scripts/i18n/sync_frontend_i18n.mjs translate` will preserve these keys during future automatic translation runs and write them back into the generated frontend dictionary.
