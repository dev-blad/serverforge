#!/usr/bin/env bash
# Run Lighthouse (mobile, default throttling) against a running production server.
# Usage: CHROME_PATH=/path/to/chrome scripts/lighthouse.sh [base_url]
set -euo pipefail
BASE="${1:-http://localhost:3000}"
OUT=".lighthouse"
mkdir -p "$OUT"
PAGES=("/" "/c/rackets" "/products/kestrel-apex-carbon" "/products/courtline-tour-ball" "/cart" "/find-a-game" "/help" "/policies/returns" "/account/login" "/racket-finder")
printf "%-36s %5s %5s %5s %5s\n" "page" "perf" "a11y" "bp" "seo"
for p in "${PAGES[@]}"; do
  name=$(echo "$p" | sed 's#[/?=]#_#g'); [ "$name" = "_" ] && name="home"
  npx lighthouse "$BASE$p" --quiet --chrome-flags="--headless=new --no-sandbox" \
    --only-categories=performance,accessibility,best-practices,seo \
    --output=json --output-path="$OUT/$name.json" >/dev/null 2>&1 || { echo "$p failed"; continue; }
  node -e '
    const r=require(process.argv[1]); const c=r.categories; const s=k=>Math.round(c[k].score*100);
    console.log(process.argv[2].padEnd(36), String(s("performance")).padStart(5), String(s("accessibility")).padStart(5), String(s("best-practices")).padStart(5), String(s("seo")).padStart(5));
  ' "$PWD/$OUT/$name.json" "$p"
done
