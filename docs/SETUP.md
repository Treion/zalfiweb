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

Then start everything with one command:

```bash
npm run dev                   # http://localhost:3000, admin at http://localhost:3000/admin
```

It checks PostgreSQL is reachable (and says so plainly if not), starts the local Neon stand-in
(`npm run db:proxy`, HTTP and WebSocket on :4444) when the database is local, then starts Next.
`npm run dev:next` starts Next alone.

## 3. Day to day

| Command | What it does |
|---|---|
| `npm run check` | Lint, typecheck, unit tests, production build. Run before every commit. |
| `npm test` | Unit tests (Vitest), in `tests/unit`. |
| `npm run test:db` | Database tests in `tests/db` (stock ledger, reservations, the last-bottle race). Needs PostgreSQL running; starts the local stand-in itself. |
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
  - `catalog/`: products, sizes, images, the bottle-photo bake (`bake.ts`), the stock ledger and reservations (`stock.ts`), inventory
  - `providers/`: email and storage (later also payments, SMS and couriers)
- `src/app/(site)/` is the storefront. `src/app/(admin)/admin/` is the admin, with its own root layout and stylesheet; it never loads GSAP, Lenis or three.js.
- `src/proxy.ts` sends signed-out visitors to `/admin/login` and adds security headers. Pages, actions and route handlers each check the role again.

## 5. Dev email and SMS

Without Resend keys, emails (invitations and e-receipts) are printed in the terminal and saved in `.data/outbox/`: the HTML, and for receipts the PDF invoice that was attached.

Without BulkSMSBD keys, checkout codes are printed in the terminal and appended to `.data/sms.log`. Outside production the checkout also shows the code under the code field, so you can test on one screen.

## Trying a checkout locally

1. Choose how to pay:
   - **Pay online** works out of the box: it goes to the built-in **test gateway**, a page with "Pay successfully", "Fail the payment" and "Cancel" buttons. No money moves.
   - **Cash on delivery** is off by default: switch it on in **Settings → Payments**.
2. Add a bottle to the bag on the shop and press **Checkout**.
3. Fill in your details and press **Send code**. Type the code shown under the field.
4. Choose a district and area, then **Place order**. The receipt lands in `.data/outbox/`, and the order appears in **Admin → Orders**.

## 6. Uploads

Without `BLOB_READ_WRITE_TOKEN`, photos uploaded in the admin (bottle photos, gallery images and their baked maps) are saved in `.data/uploads/` (git-ignored) and served from `/media/…`. With the token set, they go to Vercel Blob. Each upload is at most 4 MB.

## 7. Scheduled jobs

`vercel.json` runs `/api/cron/release-reservations` every 10 minutes on Vercel, which releases stock held by unpaid orders once their time is up. It needs `CRON_SECRET`. Locally, availability already ignores expired holds, so nothing needs to run.

## 8. Payments

- **Test gateway** (the default): Settings → Payments → Payment gateway shows "Test gateway". Its buttons send the same signed notices SSLCommerz does, through the same code: the IPN first, then the customer's return. "Pay ৳1 more than asked" shows the amount check refusing a payment.
- **SSLCommerz sandbox**: put the sandbox store ID and password in `.env` (`SSLCOMMERZ_STORE_ID`, `SSLCOMMERZ_STORE_PASSWORD`, `SSLCOMMERZ_IS_LIVE=false`), restart, then choose SSLCommerz in Settings → Payments.
  - On `localhost`, SSLCommerz can send the customer back but can't reach the IPN, so the return page settles the payment.
  - To test the IPN too, expose the site with a tunnel and set `NEXT_PUBLIC_SITE_URL` to the tunnel's URL.
- **Refunds**: on an order's page, under Payment. A test-gateway refund completes at once. An SSLCommerz refund shows "Processing" until its status check (the Check button, or the cron) says refunded.
- **Cron** (`vercel.json`): `/api/cron/payments` every 30 minutes asks the provider about payments still open, and about refunds still processing.
