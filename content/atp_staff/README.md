# ATP Staff Backup

This folder is a recovery-only backup of ATP staff content.

It is not used by the application at runtime.

Live ATP staff content currently lives in:

- `content/atp_staff/staff.json`
- `content/atp_staff/photos/`

Use these scripts to manage the backup:

```bash
./scripts/backup_atp_staff_to_repo.sh
./scripts/restore_atp_staff_from_repo_backup.sh
```

Recommended workflow:

1. Refresh this backup after meaningful ATP staff edits.
2. Commit the backup snapshot when you want a recovery point in git history.
3. Restore from this folder only when live ATP staff content is damaged or lost.

