#!/usr/bin/env bash
# Daten-Backup der gehosteten Supabase-Datenbank (Schemas public + auth).
#
# Gesichert werden nur die DATEN. Schema, RLS-Policies, Funktionen und Rechte
# kommen bei einer Wiederherstellung aus supabase/migrations/ – so landen sie
# garantiert mit den beabsichtigten (restriktiven) Rechten in der Datenbank.
# Wiederherstellen: scripts/restore-db.sh (siehe dort und README → "Backups").
#
# Bewusst NICHT gesichert:
#   - public.rate_limits: kurzlebige Zähler, nach 24 h ohnehin bedeutungslos
#   - Sessions/Refresh-Tokens & Co. in auth: Ein Restore soll keine Logins
#     wiederbeleben, die inzwischen (z. B. nach Passwort-Reset) widerrufen wurden.
#     Nach einer Wiederherstellung melden sich alle einfach neu an.
#   - auth.schema_migrations: gehört zur Auth-Version des Zielprojekts
#
# Voraussetzungen:
#   - Docker läuft (pg_dump 17 aus postgres:17-alpine, passend zum Server).
#   - DB-Passwort im macOS-Schlüsselbund:
#       security add-generic-password -a "$USER" -s my-wish-list-db -w
#     (alternativ PGPASSWORD setzen)
#
# Ablage (nur für dich lesbar, chmod 600):
#   ~/Backups/my-wish-list/YYYY-MM-DD_HHMM.dump            Daten (pg_dump custom format)
#   ~/Backups/my-wish-list/YYYY-MM-DD_HHMM.migrations.txt  angewendete Migrationen zum Zeitpunkt des Backups
set -euo pipefail
umask 077

DB_HOST="${DB_HOST:-aws-1-eu-central-1.pooler.supabase.com}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres.wikhaxcqrejozhfwqsma}"
DB_NAME="${DB_NAME:-postgres}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/Backups/my-wish-list}"
KEEP_DAYS="${KEEP_DAYS:-30}"
DOCKER_NETWORK="${DOCKER_NETWORK:-bridge}"
IMAGE="postgres:17-alpine"

# launchd startet mit minimalem PATH – Docker Desktop liegt unter /usr/local/bin.
export PATH="$PATH:/usr/local/bin:/opt/homebrew/bin"

if [[ -z "${PGPASSWORD:-}" ]]; then
  PGPASSWORD="$(security find-generic-password -s my-wish-list-db -w 2>/dev/null)" || {
    echo "Fehler: Kein Passwort im Schlüsselbund (Dienst 'my-wish-list-db')." >&2
    exit 1
  }
fi
export PGPASSWORD

docker info >/dev/null 2>&1 || {
  echo "Fehler: Docker läuft nicht." >&2
  exit 1
}

pg() {
  docker run --rm -i --network "$DOCKER_NETWORK" -e PGPASSWORD \
    -e PGHOST="$DB_HOST" -e PGPORT="$DB_PORT" -e PGUSER="$DB_USER" -e PGDATABASE="$DB_NAME" \
    "$IMAGE" "$@"
}

mkdir -p "$BACKUP_DIR"
stamp="$(date +%Y-%m-%d_%H%M)"
target="$BACKUP_DIR/$stamp.dump"
meta="$BACKUP_DIR/$stamp.migrations.txt"
tmp="$target.partial"
trap 'rm -f "$tmp"' EXIT

pg pg_dump </dev/null --format=custom --data-only \
  --schema=public --schema=auth \
  --exclude-table-data=public.rate_limits \
  --exclude-table-data=auth.schema_migrations \
  --exclude-table-data=auth.sessions \
  --exclude-table-data=auth.refresh_tokens \
  --exclude-table-data=auth.mfa_amr_claims \
  --exclude-table-data=auth.flow_state \
  --exclude-table-data=auth.one_time_tokens \
  >"$tmp"

# Plausibilitätsprüfung: Archiv lesbar und enthält die Kerntabellen.
toc="$(pg pg_restore --list <"$tmp")"
for t in "auth users" "public profiles" "public wishes"; do
  grep -q "TABLE DATA $t " <<<"$toc" || {
    echo "Fehler: Backup enthält keine Daten für ${t/ /.} – verworfen." >&2
    exit 1
  }
done

mv "$tmp" "$target"

# Welche Migrationen galten beim Backup? Nötig, um vor einem Restore exakt
# dieses Schema herzustellen. Fehlt die Tabelle, bleibt die Datei leer.
pg psql -XAtq </dev/null -c 'select version from supabase_migrations.schema_migrations order by version' \
  >"$meta" 2>/dev/null || : >"$meta"

echo "Backup erstellt: $target ($(du -h "$target" | cut -f1), Migrationen: $(wc -l <"$meta" | tr -d ' '))"

# Alte Backups aufräumen
find "$BACKUP_DIR" -type f \( -name '*.dump' -o -name '*.migrations.txt' \) \
  -mtime +"$KEEP_DAYS" -print -delete
