#!/usr/bin/env bash
# Catch rows created on ONE database after a given timestamp and move them to
# the other. Use after cutover (to pull late writes from the old backend) or
# during a rollback (to rescue writes made on the new backend).
#
# Usage:
#   ./09-delta-sync.sh --since '2026-08-20 10:00:00+00' [--reverse] [--dry-run]
#
#   default:    OLD -> NEW   (normal catch-up after cutover)
#   --reverse:  NEW -> OLD   (rollback rescue)
set -euo pipefail
cd "$(dirname "$0")"
[ -f .env ] && set -a && . ./.env && set +a

SINCE=""; REVERSE=false; DRY_RUN=false
while [ $# -gt 0 ]; do
  case "$1" in
    --since) SINCE="$2"; shift 2;;
    --reverse) REVERSE=true; shift;;
    --dry-run) DRY_RUN=true; shift;;
    *) echo "unknown arg $1"; exit 1;;
  esac
done
[ -n "$SINCE" ] || { echo "--since '<timestamptz>' is required"; exit 1; }

SRC="${OLD_DB_URL:-}"; DST="${NEW_DB_URL:-}"
if $REVERSE; then SRC="${NEW_DB_URL:-}"; DST="${OLD_DB_URL:-}"; fi
[ -n "$SRC" ] && [ -n "$DST" ] || { echo "both DB URLs must be set in .env"; exit 1; }

# Only tables that have created_at and can legitimately gain rows post-cutover.
TABLES=(
  businesses business_photos business_products business_services
  business_reviews business_enquiries business_claims business_favorites
  business_events banner_ads notifications point_events referrals
  discount_claims reports profiles user_roles
)

mkdir -p data/delta
for t in "${TABLES[@]}"; do
  f="data/delta/$t.csv"
  if $DRY_RUN; then
    echo "[dry-run] $t where created_at >= '$SINCE'"
    continue
  fi
  psql "$SRC" -v ON_ERROR_STOP=1 \
    -c "\copy (SELECT * FROM public.$t WHERE created_at >= '$SINCE') TO '$f' WITH CSV HEADER"
  n=$(( $(wc -l < "$f") - 1 ))
  [ "$n" -le 0 ] && { rm -f "$f"; continue; }
  printf '  %-22s %4s new rows -> loading\n' "$t" "$n"
  psql "$DST" -v ON_ERROR_STOP=1 <<SQL
BEGIN;
SET session_replication_role = replica;
CREATE TEMP TABLE _d (LIKE public.$t INCLUDING DEFAULTS) ON COMMIT DROP;
\copy _d FROM '$f' WITH CSV HEADER
INSERT INTO public.$t SELECT * FROM _d ON CONFLICT DO NOTHING;
SET session_replication_role = origin;
COMMIT;
SQL
done
echo "Delta sync complete."
