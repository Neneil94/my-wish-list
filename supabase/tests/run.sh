#!/usr/bin/env bash
# Führt die Migrationen gegen eine temporäre lokale Postgres-Datenbank aus und
# prüft die Zugriffsregeln (RLS/RPC). Benötigt: psql + laufender Postgres-Server.
set -euo pipefail
cd "$(dirname "$0")"
DB="mywishlist_test_$$"
createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f shim.sql
psql -q -v ON_ERROR_STOP=1 -d "$DB" -c 'create extension if not exists citext with schema extensions;'
for f in ../migrations/*.sql; do psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$f"; done
psql -q -t -A -v ON_ERROR_STOP=1 -d "$DB" -f rls_test.sql 2>&1 | grep -E "NOTICE|FEHLER|ERROR|BESTANDEN" | sed -E "s/^psql:[^ ]+ NOTICE: +//"
