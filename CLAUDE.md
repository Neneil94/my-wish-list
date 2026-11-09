# CLAUDE.md

## Design

Grundlage für jede Design-Frage ist der Claude-Design-Canvas **„my-wish-list – App-Design“**:
https://claude.ai/artifact/MpcY4y2UjJXnydMQ1ufkZv (Artifact-Slug `a89ca148-f3a9-4ec4-95d8-b251036aaf71`).

- Geht es um Design, Screens, UI oder neue Features mit Oberfläche: zuerst den Canvas lesen
  (`project/canvas.json` und die betroffenen `project/*.dc.html`) und darauf aufbauen.
  Keine eigenständigen Mockups, Seiten oder neuen Canvases anlegen.
- Design-Erweiterungen kommen **in diesen Canvas**: bestehende Boards anpassen, neue Boards
  in einer eigenen, betitelten Sektion ergänzen und das Layout in `canvas.json` nachziehen.
  Farben, Schriften, Abstände und Komponenten aus dem Canvas übernehmen (Tokens auch in `src/index.css`).
- Bilder im Canvas sind hochgeladene Assets (`/_blob/…`). Im Repo liegen dieselben Bilder unter
  `docs/design/screens/img/` und werden relativ eingebunden.
- `docs/design/screens/` ist der Export des Canvas und muss mit ihm übereinstimmen: Änderungen am
  Canvas auch dort nachziehen und im dortigen `README.md` unter „Erweiterungen seit der Abnahme“ aufführen.
  Vor dem Hochladen prüfen, ob der Canvas seit dem letzten Export von Hand geändert wurde, und
  solche Änderungen übernehmen statt sie zu überschreiben.
- Für Implementierungen dient das Design als Vorlage. Wo der Code bewusst abweicht, gilt `src/`.
