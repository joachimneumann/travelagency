Add optional per-language override files here as `<lang>.json`.

Example:

```json
{
  "backend.bookings.title": "Your curated manual translation"
}
```

`node scripts/sync_backend_i18n.mjs translate` will preserve these keys during future automatic translation runs and write them back into the generated backend dictionary.
