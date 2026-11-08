# my-wish-list

Private Wunschlisten-App für Familie und Freunde: Anlässe anlegen, Mitglieder per Username einladen,
Wünsche pflegen, Geschenke beanspruchen oder gemeinsam als Gruppengeschenk finanzieren – ohne dass
die beschenkte Person etwas davon sieht.

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, TanStack Router (Hash-Routing) & Query, Zod
- **Backend:** Supabase (Free Tier): Postgres mit Row-Level-Security, Supabase Auth, eine Edge Function
- **Hosting:** GitHub Pages, Build & Deploy über GitHub Actions

## Inhalt

- [Architektur](#architektur)
- [Sicherheit](#sicherheit)
- [Lokale Entwicklung](#lokale-entwicklung)
- [Supabase einrichten](#supabase-einrichten)
- [GitHub Pages einrichten](#github-pages-einrichten)
- [Tests](#tests)

## Architektur

```
Browser (statische SPA auf GitHub Pages)
   │  HTTPS, JWT (Bearer)
   ├──► Supabase PostgREST ──► Postgres  (Lesen per RLS, Schreiben nur über geprüfte RPC-Funktionen)
   ├──► Supabase Auth       (Login mit Username → interne Adresse <username>@users.invalid)
   └──► Edge Function "account"
          check-access · register · reset-password · change-password · rotate-recovery
```

| Pfad | Inhalt |
| --- | --- |
| `src/` | React-App (Seiten in `src/pages`, Datenzugriff in `src/lib/api.ts`) |
| `supabase/migrations/` | Datenbankschema, RLS-Policies, RPC-Funktionen |
| `supabase/functions/account/` | Edge Function für Zugangspasswort, Registrierung, Passwort-Reset |
| `supabase/tests/` | Automatische Tests der Zugriffsregeln gegen echtes Postgres |
| `scripts/hash-access-code.mjs` | Erzeugt den Hash für das Zugangspasswort |

## Sicherheit

**Zugang & Auffindbarkeit**
- Zugangspasswort wird **serverseitig** geprüft (Argon2id-Hash als Secret, Rate-Limit 5 Versuche / 15 Min. pro IP).
  Ohne gültiges Zugangspasswort ist keine Registrierung möglich; die öffentliche Supabase-Registrierung ist deaktiviert.
- Hinweis: Eine statische Seite auf GitHub Pages kann ihre eigenen Dateien nicht verstecken. Die App-Hülle enthält
  deshalb keinerlei Daten – alle Inhalte gibt es nur mit Login und passenden Datenbankrechten.
- `noindex`/`nofollow`-Meta-Tags, `robots.txt` mit `Disallow: /`, keine Sitemap, keine Social-Previews.

**Konten**
- Username + Passwort, keine E-Mail. Passwort: mind. 12 Zeichen, nicht den Username enthaltend, Buchstaben +
  Zahl/Sonderzeichen, Abgleich mit Have I Been Pwned (k-Anonymität, serverseitig).
- Einmaliger **Wiederherstellungscode** (≈100 Bit, Argon2id-gehasht) statt E-Mail-Reset. Kein Admin-Reset,
  damit niemand fremde Konten übernehmen kann.
- Kurzlebige JWTs mit Refresh-Token-Rotation; Passwortänderung erfordert das aktuelle Passwort.

**Datenzugriff (OWASP A01)**
- RLS auf allen Tabellen, Default-Deny. Clients dürfen nur lesen; jede Änderung läuft über
  `SECURITY DEFINER`-Funktionen mit expliziter Rechteprüfung und Validierung.
- **Überraschungsschutz in der Datenbank:** Claims eines Wunsches sind für dessen Owner per Policy unsichtbar –
  auch für Admins, auch über die API.
- Usersuche nur eingeloggt und nur exakte Treffer (keine Enumeration über Teiltreffer).

**Weitere Maßnahmen**
- Strikte Content-Security-Policy (keine Inline-Skripte, nur Supabase als Verbindungsziel), `no-referrer`,
  Frame-Busting gegen Clickjacking (Pages erlaubt keine eigenen Header).
- Kein `dangerouslySetInnerHTML`/`innerHTML` (per ESLint verboten); Produkt-Links nur `https:` mit
  `rel="noopener noreferrer nofollow"`, Prüfung im Client **und** per CHECK-Constraint.
- Keine serverseitigen Abrufe von Nutzer-URLs (kein SSRF).
- Schriftarten selbst gehostet (keine Drittanbieter-Requests).
- CI: `npm audit`, Lint, Typecheck, Unit- und RLS-Tests; Actions per Commit-SHA gepinnt; Dependabot.

## Lokale Entwicklung

Voraussetzungen: Node.js ≥ 22, für das lokale Backend Docker.

```bash
npm install
```

```bash
cp .env.example .env.local   # Werte eintragen
```

```bash
npm run dev
```

Lokales Supabase (optional, braucht Docker):

```bash
npx supabase@3.0.0 start -x realtime,storage-api,imgproxy,mailpit,postgres-meta,studio,logflare,vector,supavisor
```

```bash
npx supabase@3.0.0 functions serve --env-file supabase/functions/.env.local
```

`supabase status` zeigt URL und anon key für `.env.local`.

## Supabase einrichten

1. Projekt auf [supabase.com](https://supabase.com) anlegen (Free Tier, Region z. B. Frankfurt).
2. **Authentication → Sign In / Providers:**
   - „Allow new users to sign up“ **aus** (Konten entstehen nur über die Edge Function)
   - E-Mail-Provider **aktiviert lassen** (wird für den Username-Login gebraucht),
     dort „Confirm email“ **aus**, „Secure password change“ **an**
   - Passwort: Mindestlänge **12**, „Lowercase, uppercase letters and digits“ (zusätzliche Absicherung)
3. Schema einspielen:

   ```bash
   npx supabase@3.0.0 link --project-ref <PROJECT-REF>
   ```

   ```bash
   npx supabase@3.0.0 db push
   ```

4. Zugangspasswort-Hash erzeugen (Eingabe verdeckt):

   ```bash
   node scripts/hash-access-code.mjs
   ```

5. Secrets setzen (Datei nach Vorlage `supabase/functions/.env.example` anlegen, **nicht committen**):

   ```bash
   npx supabase@3.0.0 secrets set --env-file supabase/functions/.env.production
   ```

   - `ACCESS_CODE_HASH` – Ausgabe aus Schritt 4
   - `RATE_LIMIT_SALT` – zufälliger Wert, z. B. `openssl rand -hex 32`
   - `ALLOWED_ORIGINS` – `https://<github-user>.github.io` (ohne Pfad)

6. Edge Function deployen:

   ```bash
   npx supabase@3.0.0 functions deploy account --no-verify-jwt
   ```

> Die Function prüft JWTs selbst; öffentliche Aktionen (Zugang, Registrierung, Reset) brauchen keins.

## GitHub Pages einrichten

1. Repository → **Settings → Pages → Source: GitHub Actions**.
2. **Settings → Secrets and variables → Actions → Variables** anlegen:
   - `VITE_SUPABASE_URL` = `https://<PROJECT-REF>.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = anon/publishable Key (öffentlich, Schutz erfolgt über RLS)
3. Push auf `main` → Workflow „CI & Deploy“ baut, testet und veröffentlicht.

Empfohlen: Branch-Protection für `main` (PR + grüne Checks erforderlich).

## Tests

```bash
npm test          # Unit-Tests (Validierung, Beträge)
```

```bash
npm run test:db   # RLS-/RPC-Tests, braucht laufendes Postgres (PGHOST/PGUSER/PGPASSWORD)
```

```bash
npm run lint && npm run typecheck && npm run build
```
