#!/usr/bin/env bash
# Runs on the server (via cron), calling the app's own authenticated backup
# endpoints (apps/api/src/services/backupService.ts) which already bundle
# DB collections and uploaded attachment files together as one JSON
# envelope. Writes timestamped files to BACKUP_DIR and prunes anything
# older than BACKUP_RETENTION_DAYS.
#
# Requires `jq`. Reads APP_PORT, BACKUP_ADMIN_EMAIL, BACKUP_ADMIN_PASSWORD,
# BACKUP_DIR, BACKUP_RETENTION_DAYS from the project's .env.
#
# NOTE: this only writes backups to local disk. It does not ship them
# off-instance -- decide where they should also go (S3, rclone remote,
# etc.) and add that step below before relying on this for real recovery.
#
# Install as a daily cron job, e.g.:
#   0 3 * * * /opt/nilay-ecom-manager/scripts/backup-cron.sh >> /var/log/nilay-backup.log 2>&1
set -euo pipefail
cd "$(dirname "$0")/.."

set -a
source ./.env
set +a

: "${APP_PORT:?APP_PORT not set in .env}"
: "${BACKUP_ADMIN_EMAIL:?BACKUP_ADMIN_EMAIL not set in .env}"
: "${BACKUP_ADMIN_PASSWORD:?BACKUP_ADMIN_PASSWORD not set in .env}"
: "${BACKUP_DIR:?BACKUP_DIR not set in .env}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

BASE_URL="http://127.0.0.1:${APP_PORT}/api"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"

mkdir -p "$BACKUP_DIR"

echo "[$(date -u +%FT%TZ)] Starting backup..."

TOKEN="$(
  curl -sf -X POST "$BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${BACKUP_ADMIN_EMAIL}\",\"password\":\"${BACKUP_ADMIN_PASSWORD}\"}" \
    | jq -r '.data.token'
)"

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "[$(date -u +%FT%TZ)] Login failed, aborting backup." >&2
  exit 1
fi

curl -sf "$BASE_URL/settings/data-backup" \
  -H "Authorization: Bearer ${TOKEN}" \
  -o "$BACKUP_DIR/data-${TIMESTAMP}.json"

curl -sf "$BASE_URL/settings/backup" \
  -H "Authorization: Bearer ${TOKEN}" \
  -o "$BACKUP_DIR/settings-${TIMESTAMP}.json"

echo "[$(date -u +%FT%TZ)] Wrote $BACKUP_DIR/data-${TIMESTAMP}.json and settings-${TIMESTAMP}.json"

# --- optional: ship off-instance here, e.g.: ---
# rclone copy "$BACKUP_DIR" remote:nilay-ecom-backups --include "*${TIMESTAMP}*"

find "$BACKUP_DIR" -name '*.json' -mtime "+${BACKUP_RETENTION_DAYS}" -print -delete

echo "[$(date -u +%FT%TZ)] Backup complete."
