# mmb-promoter — Promoter-Netzwerk (eigenständiges Projekt)

Vertriebs-/Promoter-System für Bootstouren auf Mallorca. **Vollständig getrennt von MyMallorcaBoats** (eigene Datenbank, Domain, Login, Deployment, Repo) — siehe [ADR-0001](docs/decisions/0001-vollstaendig-getrennt-von-mymallorcaboats.md).

- **Projektregeln:** [`AGENTS.md`](AGENTS.md) (wird über `CLAUDE.md` in jede Claude-Session geladen)
- **Doku-System:** [`docs/README.md`](docs/README.md) — Changelog, Entscheidungen, Risiken, Fortschritt, Aufgaben
- **Lokal starten:** `supabase start` (Ports 4532x, braucht `supabase/.env.local` — Vorlage `supabase/.env.example`), dann `npm run dev` → http://127.0.0.1:3001
- **Env:** `.env.local` nach Vorlage `.env.local.example`, Werte aus `supabase status`

Stand 16.09.2026: Fundament + Doku, noch keine Features, keine Migration.

---

## Create-Next-App-Boilerplate (Original-README)

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
