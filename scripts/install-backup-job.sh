#!/usr/bin/env bash
# Richtet scripts/backup-db.sh als täglichen launchd-Job ein (macOS, nur für deinen Benutzer).
#
#   scripts/install-backup-job.sh             installieren/aktualisieren (täglich 21:00)
#   BACKUP_HOUR=8 scripts/install-backup-job.sh
#   scripts/install-backup-job.sh --uninstall entfernen
#
# War der Mac zur geplanten Zeit im Ruhezustand, holt launchd den Lauf beim
# Aufwachen nach. Läuft Docker nicht, schlägt der Lauf fehl (siehe Log).
# Log: ~/Backups/my-wish-list/backup.log
set -euo pipefail

LABEL="de.my-wish-list.backup"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
SCRIPT="$(cd "$(dirname "$0")" && pwd)/backup-db.sh"
LOG_DIR="${BACKUP_DIR:-$HOME/Backups/my-wish-list}"
HOUR="${BACKUP_HOUR:-21}"

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true

if [[ "${1:-}" == "--uninstall" ]]; then
  rm -f "$PLIST"
  echo "Backup-Job entfernt."
  exit 0
fi

mkdir -p "$LOG_DIR" "$(dirname "$PLIST")"
cat >"$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array><string>/bin/bash</string><string>$SCRIPT</string></array>
  <key>StartCalendarInterval</key>
  <dict><key>Hour</key><integer>$HOUR</integer><key>Minute</key><integer>0</integer></dict>
  <key>StandardOutPath</key><string>$LOG_DIR/backup.log</string>
  <key>StandardErrorPath</key><string>$LOG_DIR/backup.log</string>
</dict>
</plist>
EOF

launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "Backup-Job eingerichtet: täglich $HOUR:00 Uhr → $SCRIPT"
echo "Sofort testen: launchctl kickstart gui/$(id -u)/$LABEL && tail -f $LOG_DIR/backup.log"
