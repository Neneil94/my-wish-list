# App-Design (Stand: Abnahme 8. November 2026)

Export des abgenommenen Design-Canvas „my-wish-list – App-Design“, auf dem die
erste Version der App aufbaut. Die Dateien sind unverändert aus dem Canvas übernommen.

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
| `canvas.json` | Anordnung und Titel der Screens im Canvas |

## Ansehen

Jede `.dc.html`-Datei lässt sich direkt im Browser öffnen. Die Screens verlinken
untereinander, so kann man sich durch die App klicken. Die eingebundene
`support.js` gehört zur Canvas-Umgebung und fehlt hier; für die Darstellung wird
sie nicht gebraucht. Schriften kommen in den Entwürfen von Google Fonts, die App
selbst bindet sie lokal ein.

## Verhältnis zur App

Das Design ist der Ausgangspunkt, nicht die verbindliche Quelle: Wo die App
inzwischen abweicht, gilt der Code in `src/`. Spätere Design-Erweiterungen liegen
als eigene Dateien in `docs/design/`.

Alle Namen und Inhalte in den Entwürfen sind Beispieldaten.
