# Backup Strategy

## Purpose

Create one backup system that works now with JSON and filesystem storage and later with a database, without changing the operational model.

## Principles

- Production is the source of truth.
- Backups are created on the server, not on laptops.
- Backups are stored off-server.
- Staging is not a backup for production.
- Git can be used for audit/history, but not as the primary backup system.

## Data Domains

Current critical data is split into 3 domains.

### 1. Structured app data

Current:

- `backend/app/data/app-data.json`

Later:

- `app_db.dump`

### 2. Reference content

- `content/atp_staff`
- `content/tours`

### 3. Booking assets

- booking images
- traveler/person photos
- traveler document images
- generated offer PDFs
- travel plan PDFs
- travel plan attachments
- any other uploaded or generated booking files under the runtime data roots configured in `backend/app/src/config/runtime.js`

## Backup Set Format

Each backup run produces one timestamped backup set.

```text
backups/
  production/
    2026-04-05T02-00-00Z/
      manifest.json
      sha256sums.txt
      app_data.zst
      atp_staff.tar.zst
      tours.tar.zst
      booking_assets.tar.zst
      keycloak.dump.zst
```

Meaning:

- `app_data.zst`
  - today: compressed `store.json`
  - later: compressed application database dump
- `atp_staff.tar.zst`
  - `content/atp_staff`
- `tours.tar.zst`
  - `content/tours`
- `booking_assets.tar.zst`
  - all runtime booking media and files
- `keycloak.dump.zst`
  - if Keycloak/Postgres is part of the recovery scope

## Storage Locations

Use 2 destinations.

### 1. Local server backup directory

- fast restore
- short retention

### 2. Off-server backup storage

- Hetzner Storage Box, Backblaze B2, or S3-compatible object storage
- this is the real disaster-recovery backup

## Schedule

### Production

- nightly full backup
- pre-deploy backup before every production deploy
- extra manual backup before migrations

### Staging

- daily backup
- shorter retention
- mainly operational safety

### Local machines

- not part of the backup chain

## Retention

### Production

- 7 daily
- 8 weekly
- 12 monthly

### Staging

- 7 daily
- 4 weekly

## Verification

Every backup run must:

- create `sha256sums.txt`
- verify all artifacts were written
- verify off-server upload succeeded
- write `manifest.json` with:
  - timestamp
  - environment
  - artifact names
  - sizes
  - checksums
  - success/failure status

Operational checks:

- monthly restore test to staging or a temporary directory
- quarterly full recovery drill

A backup that has never been restored is only a theory.

## Restore Modes

Support these restore paths.

### 1. Full restore

- structured data
- reference content
- booking assets
- Keycloak dump if needed

### 2. Content-only restore

- `atp_staff`
- `tours`

### 3. Booking-assets-only restore

- images
- PDFs
- attachments

### 4. Structured-data-only restore

- `store.json` now
- database dump later

## Environment Rules

- Production backups are authoritative.
- Staging can be refreshed from production if desired.
- Local edits must be explicitly published. They are not backups.
- Do not rely on another laptop as recovery.

## Migration to Database

When moving from JSON to a database, do not replace the backup strategy. Only replace one artifact.

Current:

- `app_data.zst` = `store.json.zst`

Later:

- `app_data.zst` = `app_db.dump.zst`

The rest stays the same:

- `atp_staff.tar.zst`
- `tours.tar.zst`
- `booking_assets.tar.zst`

This keeps:

- retention unchanged
- restore process stable
- backup destinations unchanged
- operations simpler

## Recommended Rollout Order

1. Implement this backup system now for JSON, reference content, and booking assets.
2. Run it on staging first.
3. Enable it for production before production launch.
4. Later swap `store.json` backup to a database dump during the database migration.

## Practical Recommendation

Use these backup units.

### `app_data`

- `store.json` now
- application database later

### `reference_content`

- `atp_staff`
- `tours`

### `booking_assets`

- all uploaded and generated booking files

### `identity_data`

- Keycloak/Postgres dump if needed

This structure is the cleanest bridge from the current system to a future database-backed system.
