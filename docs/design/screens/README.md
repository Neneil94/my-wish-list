# App-Design (Stand: Abnahme 8. November 2026)

Export des abgenommenen Design-Canvas „my-wish-list – App-Design“, auf dem die
erste Version der App aufbaut.

**Erweiterungen seit der Abnahme**

- *Bild zum Wunsch* (Entwurf, noch nicht abgenommen): Die Screens 07, 10, 11, 12, 13 und 15
  haben jetzt Vorschaubilder bzw. ein Bildfeld. 11 und 13 sind dafür höher (1200 bzw. 1080 px),
  und die Zeilen darunter sind im Canvas nach unten gerückt. Neu sind `WishImage.dc.html`,
  `WishFormEdit.dc.html` (11b) und `WishImageView.dc.html` (13b).

| Datei | Inhalt |
|---|---|
| `Main.dc.html` | Konzept: Architektur, Sicherheit und Design-Tokens |
| `Gate.dc.html` | 01 Zugangspasswort |
| `Login.dc.html` | 02 Login |
| `Register.dc.html` | 03 Registrierung |
| `Profile.dc.html` | 04 Profil |
| `Groups.dc.html` | 05 Anlässe (Übersicht) |
| `NewGroup.dc.html` | 06 Anlass erstellen |
| `MyGifts.dc.html` | 07 Meine Geschenke |
| `GroupDetail.dc.html` | 08 Anlass – Detail |
| `Members.dc.html` | 09 Mitglieder und Einladen |
| `MyList.dc.html` | 10 Meine Wunschliste |
| `WishForm.dc.html` | 11 Wunsch anlegen |
| `MemberList.dc.html` | 12 Liste einer anderen Person |
| `WishDetail.dc.html` | 13 Wunsch – Gruppengeschenk |
| `Contribute.dc.html` | 14 Beanspruchen oder beitragen |
| `DesktopGroup.dc.html` | 15 Desktop – Anlass-Detail |
| `WishImage.dc.html` | Erweiterung: Bild zum Wunsch – Konzept, Zustände, Texte, Technik |
| `WishFormEdit.dc.html` | 11b Wunsch bearbeiten – mit Bild |
| `WishImageView.dc.html` | 13b Wunschbild – Vollbild |
| `img/` | Beispielbilder (Illustrationen) für die Wunschbild-Screens |
| `canvas.json` | Anordnung und Titel der Screens im Canvas |

## Ansehen

Jede `.dc.html`-Datei lässt sich direkt im Browser öffnen. Die Screens verlinken
untereinander, so kann man sich durch die App klicken. Die eingebundene
`support.js` gehört zur Canvas-Umgebung und fehlt hier; für die Darstellung wird
sie nicht gebraucht. Schriften kommen in den Entwürfen von Google Fonts, die App
selbst bindet sie lokal ein.

## Verhältnis zur App

Das Design ist der Ausgangspunkt, nicht die verbindliche Quelle: Wo die App
inzwischen abweicht, gilt der Code in `src/`. Design-Erweiterungen werden direkt
in diesem Canvas ergänzt und oben aufgeführt.

Alle Namen und Inhalte in den Entwürfen sind Beispieldaten.
