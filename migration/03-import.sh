#!/usr/bin/env bash
# Load migration/data/*.csv into the NEW project, in dependency order.
#
# Usage:  ./03-import.sh [--dry-run]
#
# Safety:
#  - runs inside a single transaction; any failure rolls the whole load back
#  - session_replication_role = replica disables triggers + FK checks during
#    the load, so trigger side effects (points, notifications, audit logs)
#    are NOT re-fired and rows land exactly as exported
#  - idempotent: loads into a temp table then INSERT ... ON CONFLICT DO NOTHING,
#    so re-running never duplicates rows
set -euo pipefail
cd "$(dirname "$0")"
[ -f .env ] && set -a && . ./.env && set +a

DRY_RUN=false
[ "${1:-}" = "--dry-run" ] && DRY_RUN=true

: "${NEW_DB_URL:?NEW_DB_URL is not set in migration/.env}"

TABLES=(
  plans categories ad_slots profiles user_roles businesses
  business_photos business_products business_services business_subscriptions
  business_reviews business_enquiries business_claims business_favorites
  business_events banner_ads events notifications point_events referrals
  discount_claims reports audit_logs
)

SQL_FILE=$(mktemp)
{
  echo "BEGIN;"
  echo "SET session_replication_role = replica;"
  for t in "${TABLES[@]}"; do
    f="data/$t.csv"
    [ -f "$f" ] || { echo "\\echo skipping $t (no CSV)"; continue; }
    # header-only file => nothing to load
    if [ "$(wc -l < "$f")" -le 1 ]; then
      echo "\\echo $t: empty, skipped"
      continue
    fi
    cat <<SQL
\\echo importing $t
CREATE TEMP TABLE _stage_$t (LIKE public.$t INCLUDING DEFAULTS) ON COMMIT DROP;
\\copy _stage_$t FROM '$f' WITH CSV HEADER
INSERT INTO public.$t SELECT * FROM _stage_$t ON CONFLICT DO NOTHING;
SQL
  done
  echo "SET session_replication_role = origin;"
  echo "COMMIT;"
} > "$SQL_FILE"

if $DRY_RUN; then
  echo "--- SQL that would run ---"
  cat "$SQL_FILE"
  rm -f "$SQL_FILE"
  exit 0
fi

psql "$NEW_DB_URL" -v ON_ERROR_STOP=1 -f "$SQL_FILE"
rm -f "$SQL_FILE"

echo
echo "Import complete. Now run 04-verify.sql against BOTH databases."
