#!/usr/bin/env bash
# Avvia un PocketBase di PROVA (dati temporanei, ora finta, posta finta) ed esegue tutti i collaudi.
# Uso: PB_BIN=/percorso/pocketbase test/run-local.sh
set -euo pipefail
PB_BIN=${PB_BIN:-pocketbase}
ROOT=$(cd "$(dirname "$0")/.." && pwd)
D=$(mktemp -d)
cp -r "$ROOT/pocketbase/pb_migrations" "$D/pb_migrations"
cp -r "$ROOT/pocketbase/pb_hooks" "$D/pb_hooks"

node "$ROOT/test/regole.test.mjs"

"$PB_BIN" superuser upsert admin@test.it Passw0rd-test-123 --dir="$D/data" --migrationsDir="$D/pb_migrations" >/dev/null
# "lunedì 16 novembre 2026, ore 10:00" (ora di Roma): tutti i test partono da qui
NIDO_FINTA_ORA="2026-11-16T10:00" NIDO_SITE_URL="https://portale.test" \
  "$PB_BIN" serve --http=127.0.0.1:8099 --dir="$D/data" --migrationsDir="$D/pb_migrations" --hooksDir="$D/pb_hooks" >"$D/log.txt" 2>&1 &
PID=$!
trap 'kill $PID 2>/dev/null; rm -rf "$D"' EXIT
for i in $(seq 1 30); do curl -sf http://127.0.0.1:8099/api/health >/dev/null && break; sleep 0.5; done
PB=http://127.0.0.1:8099 node "$ROOT/test/portale.test.mjs" || { echo "--- log del server ---"; tail -40 "$D/log.txt"; exit 1; }
