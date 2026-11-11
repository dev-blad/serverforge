#!/usr/bin/env bash
# Vercel build: generate client → apply migrations → (demo) seed an empty DB → build.
set -euo pipefail

# Accept Neon (DATABASE_URL / DATABASE_URL_UNPOOLED) or Supabase (POSTGRES_PRISMA_URL / POSTGRES_URL_NON_POOLING) env names.
export DATABASE_URL="${DATABASE_URL:-${POSTGRES_PRISMA_URL:-}}"
if [ -z "$DATABASE_URL" ]; then
  echo "✖ No database configured. In Vercel: Storage → Create Database → Neon → connect to this project, then redeploy." >&2
  exit 1
fi
MIGRATE_URL="${DATABASE_URL_UNPOOLED:-${POSTGRES_URL_NON_POOLING:-${DIRECT_URL:-$DATABASE_URL}}}"

npx prisma generate
DATABASE_URL="$MIGRATE_URL" npx prisma migrate deploy
if [ "${DEMO_AUTO_SEED:-false}" = "true" ]; then
  DATABASE_URL="$MIGRATE_URL" npx tsx prisma/seed-if-empty.ts
fi
npx next build
