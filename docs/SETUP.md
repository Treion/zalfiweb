# Setup (developers)

How to run ZALFI locally: the storefront, the admin, and the test suite. For going live with real payment, SMS, email and courier accounts, see `docs/GO_LIVE.md` (written in phase 8).

## 1. Requirements

- Node 22, npm 10
- PostgreSQL 16 running locally (`pg_ctlcluster 16 main start` on Debian/Ubuntu)

## 2. First run

```bash
npm install
cp .env.example .env          # the defaults work locally
createdb zalfi                # once
npm run db:migrate            # creates every table
npm run db:seed               # the six fragrances, notes and sizes
npm run db:seed:demo          # optional: 90 days of demo orders, customers and coupons
npm run admin                 # answer the questions: email, name, role, password
```

Then, in two terminals:

```bash
npm run db:proxy              # local stand-in for Neon (HTTP and WebSocket) on :4444
npm run dev                   # http://localhost:3000, admin at http://localhost:3000/admin
```

## 3. Day to day

| Command | What it does |
|---|---|
| `npm run check` | Lint, typecheck, unit tests, production build. Run before every commit. |
| `npm test` | Unit tests (Vitest), in `tests/unit`. |
| `npm run db:generate` | Writes a migration after a schema change in `src/db/tables/*`. |
| `npm run db:migrate` | Applies migrations. |
| `npm run db:seed:demo -- --clear` | Removes the demo data only. |
| `npm run stock:check` | Proves every size's stock equals its stock ledger. |
| `npm run admin` | Admin accounts from the terminal: create (owner or manager), list, reset a password, switch off/on. Needs only PostgreSQL running. |

## 4. How the backend is laid out

- `src/db/tables/` holds the schema: `catalogue.ts`, `commerce.ts` and `admin.ts`.
- `src/server/` holds the domain and infrastructure; nothing in it is a React component:
  - `db/pool.ts`: `withTx()` (transactions)
  - `auth/`: Better Auth, the permission matrix, session guards
  - `settings/`: typed settings
  - `admin/`: team, audit queries, CSV
  - `providers/`: email (later also payments, SMS, couriers and storage)
- `src/app/(site)/` is the storefront. `src/app/(admin)/admin/` is the admin, with its own root layout and stylesheet; it never loads GSAP, Lenis or three.js.
- `src/proxy.ts` sends signed-out visitors to `/admin/login` and adds security headers. Pages, actions and route handlers each check the role again.

## 5. Dev email

Without Resend keys, emails (invitations, and later e-receipts) are printed in the terminal and saved as HTML in `.data/outbox/`.
