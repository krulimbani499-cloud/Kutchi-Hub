#!/usr/bin/env bash
# Export every public table from the OLD project to CSV, in dependency order.
# READ-ONLY: this script never writes to the old database.
#
# Usage:  ./02-export.sh [--dry-run]
#
# Requires OLD_DB_URL in migration/.env.
# If you don't have OLD_DB_URL, use Lovable -> Cloud -> Advanced settings ->
# Export data and save each CSV into migration/data/<table>.csv instead.
set -euo pipefail
cd "$(dirname "$0")"
[ -f .env ] && set -a && . ./.env && set +a

DRY_RUN=false
[ "${1:-}" = "--dry-run" ] && DRY_RUN=true

# Dependency order: parents first. 03-import.sh uses the exact same order.
TABLES=(
  plans
  categories
  ad_slots
  profiles
  user_roles
  businesses
  business_photos
  business_products
  business_services
  business_subscriptions
  business_reviews
  business_enquiries
  business_claims
  business_favorites
  business_events
  banner_ads
  events
  notifications
  point_events
  referrals
  discount_claims
  reports
  audit_logs
)

OUT="data"
mkdir -p "$OUT"

if [ -z "${OLD_DB_URL:-}" ]; then
  echo "OLD_DB_URL is not set."
  echo "Use Lovable -> Cloud -> Advanced settings -> Export data and place the"
  echo "CSV files in migration/$OUT/ with these names:"
  for t in "${TABLES[@]}"; do echo "  $OUT/$t.csv"; done
  exit 1
fi

echo "Exporting ${#TABLES[@]} tables -> migration/$OUT/"
for t in "${TABLES[@]}"; do
  if $DRY_RUN; then
    echo "  [dry-run] COPY (SELECT * FROM public.$t) -> $OUT/$t.csv"
    continue
  fi
  psql "$OLD_DB_URL" -v ON_ERROR_STOP=1 \
    -c "\copy (SELECT * FROM public.$t) TO '$OUT/$t.csv' WITH CSV HEADER"
  rows=$(( $(wc -l < "$OUT/$t.csv") - 1 ))
  printf '  %-24s %6s rows\n' "$t" "$rows"
done

# Also snapshot the auth user list for 05-auth-users.ts
if ! $DRY_RUN; then
  psql "$OLD_DB_URL" -v ON_ERROR_STOP=1 -c "\copy (
     SELECT id, email, phone, created_at, email_confirmed_at,
            raw_user_meta_data::text AS raw_user_meta_data
     FROM auth.users ORDER BY created_at
  ) TO '$OUT/auth_users.csv' WITH CSV HEADER"
  echo "  auth_users.csv written"
fi

echo
echo "Done. Archive migration/$OUT/ somewhere safe before you continue."
