# PROGRESS.md — Scratchpad (Arbeitsstand der laufenden Aufgabe)

**Stand 29.09.2026, Etappe 2 (Login + Rollen) GEBAUT UND VERIFIZIERT, Commit wartet auf Marcos Freigabe.** Einzige Datei, die überschrieben werden darf. Nichts hier gilt als protokolliert — erledigte Schritte stehen in `docs/CHANGELOG.md` (Hard Rule 2).

## Wo wir stehen

Etappe 1 komplett (Commits `fc50fdf` … `b416e5d`, Doku `ae3a8d0`, Diagnose `cda94b6`). GitHub-Remote `origin` gesetzt und gepusht (M6, Stand `cda94b6`).

Etappe 2 ist **uncommittet** im Arbeitsbaum (Marco: „Committe erst nach meiner Bestätigung"). Vorgeschlagene Commit-Aufteilung, je gezielt per Pfad:

| Schritt | Pfade | Beleg |
|---|---|---|
| M6 Remote (nur Doku) | `TASKS.md` (M5/M6-Zeilen), `docs/CHANGELOG.md` (Eintrag M6) | `git remote -v` |
| E2 Config + Deps | `supabase/config.toml`, `package.json`, `package-lock.json` | REST: signup 422, 11 Zeichen 422 |
| E2.1 Migration + Seed | `supabase/migrations/0003_profiles_roles.sql`, `supabase/seed.sql`, `tests/db.ts` | `tests/profiles-rls.test.ts` 16/16 |
| E2.2 App | `src/**`, `next.config.ts` | `tsc` 0, `eslint` 0, curl-Redirects |
| E2.3 Tests | `tests/access-guard.test.ts`, `tests/profiles-rls.test.ts`, `tests/auth-login.test.ts`, `tests/app-access.test.ts` | `npm test` 53/53 |
| Doku | `TASKS.md`, `docs/RISKS.md`, `docs/DECISIONS.md`, `docs/CHANGELOG.md`, `PROGRESS.md` | — |

(Die Doku-Dateien enthalten Änderungen für mehrere Schritte; entweder ein Doku-Commit am Ende oder `git add -p` — Marco entscheidet.)

**Nächster Schritt nach dem Commit:** Marco testet im Browser (unten), dann E3 (vorher F4-Detail klären). Vor E5: F10, F11, F12, RISKS Nr. 21–23.

## ⚠️ Blocker auf diesem Rechner: Supabase-CLI (RISKS Nr. 24)

Windows Smart App Control blockiert `supabase-go.exe` (unsigniert) → `supabase status/stop/start/db reset` scheitern mit `EUNKNOWN: uv_spawn`. Docker läuft normal. Ausweichwege, die diese Session benutzt hat:

```
# Migration/Seed einspielen (statt supabase db reset — löscht NICHT, nur additiv):
Get-Content supabase\migrations\0003_profiles_roles.sql -Raw | docker exec -i supabase_db_mmb-promoter psql -U postgres -d postgres -v ON_ERROR_STOP=1 -1
Get-Content supabase\seed.sql -Raw | docker exec -i supabase_db_mmb-promoter psql -U postgres -d postgres -v ON_ERROR_STOP=1 -1
# Keys für .env.local (statt supabase status):
docker inspect supabase_studio_mmb-promoter --format '{{range .Config.Env}}{{println .}}{{end}}' | Select-String 'SUPABASE_ANON_KEY|SUPABASE_SERVICE_KEY'
```

Der Auth-Container wurde von Hand mit `GOTRUE_PASSWORD_MIN_LENGTH=12` / `GOTRUE_DISABLE_SIGNUP=true` neu erzeugt (sonst identisch). Sobald die CLI wieder geht: `supabase stop && supabase start && supabase db reset` stellt alles aus `config.toml` + Migrationen + `seed.sql` regulär her.

## Lokal testen — als beide Rollen einloggen

Voraussetzung: Docker-Instanz läuft (`docker ps | findstr mmb-promoter`), `.env.local` im Root vorhanden, `npm run dev` → http://127.0.0.1:3001

| Konto (nur lokal, aus `supabase/seed.sql`) | Passwort | Rolle | Erwartung |
|---|---|---|---|
| operator@mmb-promoter.test | operator-test-2026 | network_operator | landet auf `/admin` („Test-Operator (Gabo)"); `/promoter` → `/kein-zugang` |
| promoter@mmb-promoter.test | promoter-test-2026 | promoter | landet auf `/promoter` („Test-Promoter"); `/admin` → `/kein-zugang` |
| inactive-promoter@mmb-promoter.test | inactive-test-2026 | promoter, deaktiviert | Login-Seite zeigt „Dieses Konto ist deaktiviert.", keine Session |

Ablauf: http://127.0.0.1:3001 → leitet auf `/login`. Anmelden, Landing prüfen, dann die jeweils andere URL von Hand eintippen (`/admin` bzw. `/promoter`) → `/kein-zugang`. „Abmelden" → zurück auf `/login`; danach `/admin` direkt aufrufen → `/login`. Passwort < 12 Zeichen: der Browser blockiert schon im Formular (`minLength`), serverseitig gilt GoTrue (Test in `tests/auth-login.test.ts`). Quelltext der Seite: `<meta name="robots" content="noindex, nofollow">`, Antwort-Header `X-Robots-Tag`.

## Wiedereinstieg — Befehle

```
docker ps --format '{{.Names}} {{.Status}}' | findstr mmb-promoter   # Instanz läuft? (CLI blockiert, s. o.)
npm test                # Vitest: 7 Dateien, 53 Tests (app-access nur mit laufendem Dev-Server, sonst skipped)
npx tsc --noEmit && npx eslint src tests
npx next typegen        # falls tsc über LayoutProps<"/admin"> meckert (Routentypen)
npm run dev             # http://127.0.0.1:3001
git log --oneline       # Stand: cda94b6 + uncommittete E2-Änderungen
```

| Was | Wert |
|---|---|
| Postgres | postgresql://postgres:postgres@127.0.0.1:45322/postgres |
| Supabase API / Studio / Mailpit | 45321 / 45323 / 45324 |
| Container-Präfix | `supabase_*_mmb-promoter` |
| JWT-Secret | `supabase/.env.local` (gitignored); Anon/Service-Key in Root-`.env.local` (gitignored) |

## Was existiert (neu in E2)

- `supabase/migrations/0003_profiles_roles.sql` — `user_role`, `profiles`, Helfer, RLS an auf allen drei Tabellen, erste SELECT-Policies. `supabase/seed.sql` — 3 lokale Konten.
- `src/proxy.ts` (Session-Refresh, optimistischer Redirect) · `src/lib/auth/access.ts` (reine Entscheidung) · `src/lib/auth/dal.ts` (`getCurrentAuth`, `requireArea`) · `src/lib/supabase/server.ts`.
- Routen: `/login`, `/admin` (Layout-Guard), `/promoter` (Layout-Guard), `/gesperrt`, `/kein-zugang`, `/robots.txt`. `/` = Verteiler.
- Tests: `access-guard`, `profiles-rls`, `auth-login`, `app-access` (+ E1: `smoke`, `reserve-function-unchanged`, `overbooking`).

## Was noch NICHT existiert

- Keine Verkaufs-Features, keine Admin-UI, keine Konto-Verwaltung durch Gabo (E3/E4) — Konten nur per Seed.
- Keine Schreib-Policies für `authenticated`; `bookings` für `authenticated` komplett gesperrt (bis E5).
- Keine Passwort-Reset-Strecke, keine E-Mail-Flows.

## Warnungen für den Wiedereinstieg

- **Nie `git add .`** — `.next/` ist ignoriert, aber der Baum enthält viele neue Dateien; gezielt per Pfad (Tabelle oben).
- `next dev` schreibt den Next.js-Block in `AGENTS.md` neu — Diff dort ignorieren bzw. mitcommitten.
- `[auth.email] enable_signup` muss `true` bleiben (sonst kein E-Mail-Login). Selbstregistrierung sperrt `[auth] enable_signup = false`.
- Tests laufen nur gegen localhost (`tests/db.ts`, `auth-login`, `app-access` prüfen die URL).
- Ein zweiter Dev-Server aus dieser Session könnte noch auf 3001 laufen (`Get-Process node`), bevor `npm run dev` neu gestartet wird.
