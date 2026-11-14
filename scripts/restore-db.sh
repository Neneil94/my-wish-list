#!/usr/bin/env bash
# Spielt ein Daten-Backup aus scripts/backup-db.sh in eine Supabase-Datenbank ein.
#
# Das Schema muss vorher stehen – und zwar mit denselben Migrationen wie beim
# Backup (siehe <backup>.migrations.txt), z. B. per `npx supabase@3.0.0 db push`.
# Dieses Script spielt nur Daten ein; Rechte und Policies kommen aus den Migrationen.
#
# Aufruf:
#   scripts/restore-db.sh <backup.dump>            Ziel muss leer sein (frisches Projekt)
#   scripts/restore-db.sh --replace <backup.dump>  vorhandene Daten ERSETZEN
#
# --replace leert alle im Backup enthaltenen Tabellen (inkl. aller Nutzer und
# Sessions) und spielt das Backup ein. Alles läuft in EINER Transaktion: Bei
# einem Fehler bleibt die Datenbank unverändert.
#
# Ziel-Datenbank wie bei backup-db.sh über DB_HOST/DB_PORT/DB_USER/DB_NAME,
# Passwort aus dem Schlüsselbund (Dienst 'my-wish-list-db') oder PGPASSWORD.
# Für ein anderes Projekt also z. B.:
#   DB_USER=postgres.<neue-ref> PGPASSWORD=... scripts/restore-db.sh <datei>
set -euo pipefail

DB_HOST="${DB_HOST:-aws-1-eu-central-1.pooler.supabase.com}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres.wikhaxcqrejozhfwqsma}"
DB_NAME="${DB_NAME:-postgres}"
DOCKER_NETWORK="${DOCKER_NETWORK:-bridge}"
IMAGE="postgres:17-alpine"

replace=false
assume_yes=false
file=""
for arg in "$@"; do
  case "$arg" in
    --replace) replace=true ;;
    --yes) assume_yes=true ;;
    -*) echo "Unbekannte Option: $arg" >&2; exit 2 ;;
    *) file="$arg" ;;
  esac
done
[[ -n "$file" && -f "$file" ]] || {
  echo "Aufruf: $0 [--replace] [--yes] <backup.dump>" >&2
  exit 2
}
file="$(cd "$(dirname "$file")" && pwd)/$(basename "$file")"

if [[ -z "${PGPASSWORD:-}" ]]; then
  PGPASSWORD="$(security find-generic-password -s my-wish-list-db -w 2>/dev/null)" || {
    echo "Fehler: Kein Passwort im Schlüsselbund (Dienst 'my-wish-list-db')." >&2
    exit 1
  }
fi
export PGPASSWORD

# Nur pg_in bekommt stdin – sonst würde docker die Bestätigungseingabe verschlucken.
pg() { _docker "" "$@" </dev/null; }
pg_in() { _docker -i "$@"; }
_docker() {
  local interactive="$1"; shift
  docker run --rm $interactive --network "$DOCKER_NETWORK" -e PGPASSWORD \
    -e PGHOST="$DB_HOST" -e PGPORT="$DB_PORT" -e PGUSER="$DB_USER" -e PGDATABASE="$DB_NAME" \
    -v "$file:/backup.dump:ro" "$IMAGE" "$@"
}
psql_q() { pg psql -XAtq -v ON_ERROR_STOP=1 "$@"; }

# Tabellen mit Daten im Backup, als schema.tabelle
tables=()
while IFS= read -r t; do tables+=("$t"); done < <(
  pg pg_restore --list /backup.dump | awk '$4 == "TABLE" && $5 == "DATA" { print $6 "." $7 }'
)
[[ ${#tables[@]} -gt 0 ]] || { echo "Fehler: Keine Tabellendaten im Backup." >&2; exit 1; }
quoted="$(printf '%s\n' "${tables[@]}" | sed -E 's/^([^.]+)\.(.+)$/"\1"."\2"/' | paste -sd, -)"

# Schema-Stand vergleichen, falls die Migrationsliste vorliegt.
meta="${file%.dump}.migrations.txt"
if [[ -s "$meta" ]]; then
  current="$(psql_q -c 'select version from supabase_migrations.schema_migrations order by version' 2>/dev/null || true)"
  if [[ "$current" != "$(cat "$meta")" ]]; then
    echo "Warnung: Die Migrationen im Ziel weichen vom Stand des Backups ab." >&2
    diff <(cat "$meta") <(printf '%s\n' "$current") >&2 || true
    echo "Erst das Schema angleichen (db push), sonst passen die Daten evtl. nicht." >&2
    $assume_yes || { read -r -p "Trotzdem fortfahren? [j/N] " a || a=""; [[ "$a" == j ]] || exit 1; }
  fi
fi

# Vorhandene Daten zählen
existing="$(psql_q -c "select coalesce(sum(n), 0) from (
  select count(*) as n from auth.users
  union all select count(*) from public.profiles) s")"

if [[ "$existing" != "0" ]] && ! $replace; then
  echo "Fehler: Ziel enthält bereits Daten ($existing Zeilen in auth.users/public.profiles)." >&2
  echo "Zum Ersetzen mit --replace aufrufen." >&2
  exit 1
fi

echo "Ziel:   $DB_USER@$DB_HOST/$DB_NAME"
echo "Backup: $file"
echo "Tabellen (${#tables[@]}): ${tables[*]}"
if $replace; then
  echo "ACHTUNG: Alle Daten dieser Tabellen werden gelöscht und ersetzt; alle Nutzer werden abgemeldet."
fi
if ! $assume_yes; then
  read -r -p "Zum Fortfahren 'wiederherstellen' eintippen: " answer || answer=""
  [[ "$answer" == "wiederherstellen" ]] || { echo "Abgebrochen."; exit 1; }
fi

{
  echo '\set ON_ERROR_STOP 1'
  echo 'begin;'
  # CASCADE leert auch abhängige Tabellen ohne Backup-Daten (Sessions, Refresh-Tokens).
  $replace && echo "truncate $quoted cascade;"
  pg pg_restore --data-only --no-owner --file=- /backup.dump
  echo 'commit;'
} | pg_in psql -Xq -v ON_ERROR_STOP=1 >/dev/null

echo "Wiederherstellung abgeschlossen."
psql_q -c "select 'auth.users: ' || count(*) from auth.users
  union all select 'public.profiles: ' || count(*) from public.profiles
  union all select 'public.groups: ' || count(*) from public.groups
  union all select 'public.wishes: ' || count(*) from public.wishes"
