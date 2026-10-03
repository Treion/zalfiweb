# Decisions

Judgement calls made while building the backend and admin, newest last. Each one follows the spec's rule: the simplest robust option, written down. Anything marked **(open)** is waiting on the owner.

## Phase 1: Discovery

1. **Branch.** Work happens on `claude/zalfi-backend`, created from `claude/zalfi-perfume-site-liu812`, as the spec asks.
2. **Package manager.** The repo uses npm, so scripts are `npm run …` (for example, `npm run admin:create-owner`).
3. **Money.** All amounts are integers in poisha, BDT only.
   - Migration: rename `variants.price_cents` → `price_poisha` and drop `currency`.
   - Display is `৳1,250`, with Bangladeshi lakh grouping for large sums (`৳1,25,000`).
   - The storefront's prices change from USD placeholders to taka. This is the only visible storefront change, and the spec requires it.
4. **Real prices (open).** The seed uses taka placeholders until the owner provides real prices. They are editable in Products.
5. **Transactions.** Neon's HTTP driver has no interactive transactions.
   - Storefront reads stay on HTTP, so they remain edge-portable and cached.
   - Every write that touches money or stock goes through `withTx()` on Neon's WebSocket `Pool` driver, on the Node runtime.
   - In development, the local proxy also bridges WebSockets to Postgres, so dev and production run the same driver code.
6. **Two root layouts.** Storefront pages move into the `(site)` route group, unchanged. The admin gets its own root layout under `(admin)/admin` and its own stylesheet. This is how the admin never loads GSAP, Lenis, three.js or React Three Fiber.
7. **Admin theme.** shadcn/ui tokens in `admin.css`, light and dark via `next-themes`. Accents come from the existing ZALFI theme; Hanken Grotesk for the interface, Bodoni Moda for page titles only.
8. **Stock.** `variants.stock` stays the cached current stock, updated in the same transaction as its `stock_movements` row. `npm run stock:check` verifies it equals the ledger sum. Existing stock gets an `initial` ledger row.
9. **Addresses.**
   - All 64 districts in a dropdown.
   - The Dhaka city thanas in a dropdown. They define "Inside Dhaka", and the list is editable in Settings → Shipping.
   - A free-text area for the other districts.
   - Courier zone lookups (Pathao) can refine this once live.
10. **New fragrances.**
    - The home experience's chapter count will follow the published fragrances, instead of the fixed `6`.
    - An admin bottle-photo upload is baked into WebGL maps by the same code as `npm run assets:bottles`, in a Node route. If the bake fails, the stage shows the plain photo.
11. **Newsletter (open).** The existing form keeps collecting emails and never sends any, which respects "the e-receipt is the only email". The owner can export the list as CSV (audit-logged). Remove the section if the owner prefers.
12. **Usage counts** (coupon uses, customer order counts, totals spent) are computed from orders, never stored as counters that can drift.
13. **Idempotency.** Every provider callback (SSLCommerz IPN, courier webhooks) is recorded in `webhook_events` under a unique `(provider, event_id)`. A repeat is acknowledged and ignored.

## Phase 2: Foundations

14. **Migrations.** The taka switch is two steps so drizzle-kit never needs an interactive rename prompt: `0003` adds `price_poisha` and copies the placeholder prices (rounded to ৳50); `0004` drops `price_cents` and `currency` and creates every backend table. `0004` also opens the stock ledger with an `initial` row per size.
15. **Order numbers** come from a Postgres sequence starting at 1001 (`ZLF-001001`), so the first real order doesn't read as order number one.
16. **Auth tables** are Better Auth's own, renamed with an `admin_` prefix (`admin_users`, `admin_sessions`, …), so customers and admins can never be confused. Customers have no accounts.
17. **No public sign-up.** The first owner comes from `npm run admin`; everyone else from an invitation. Invitation tokens are 32 random bytes; only their SHA-256 hash is stored. A link works once, for 48 hours. Re-inviting the same email withdraws the older link.
18. **Session timeout:** 4 hours of inactivity (a sliding expiry, extended at most every 15 minutes of use). Deactivating someone deletes their sessions at once, and the session hook refuses inactive users.
19. **Rate limits** come from our own Postgres limiter (`rate_limits`, one atomic statement per hit), not Better Auth's in-memory one, which resets per server instance. Admin sign-in: 20 per IP and 8 per email per 15 minutes. Invitation accepts: 10 per IP per 15 minutes.
20. **The last owner** can't be demoted or deactivated, and nobody can change their own role or deactivate themselves.
21. **Permissions** live in one matrix (`src/server/auth/permissions.ts`). The owner's two toggles (`managersCanRefund`, default off; `managersSeeRevenue`, default on) are settings. Every page calls `requireAdmin(permission)`, every server action goes through `runAction(permission, schema, …)`, and every route handler checks `getAdmin()` and `can()`. `proxy.ts` only does the quick signed-out redirect and adds the headers.
22. **Server actions for admin mutations** (Next's built-in origin check protects them from cross-site requests). Better Auth's own endpoints check the origin against `trustedOrigins`. Inputs are validated with strict Zod schemas, so unknown fields are rejected.
23. **shadcn/ui** components are written into `src/components/admin/ui` by hand, matching the registry's "new-york" source. The shadcn registry (ui.shadcn.com) is blocked by this environment's network policy; npm is not, so the underlying libraries (Radix, cva, tailwind-merge, sonner, tw-animate-css) are normal dependencies. `components.json` is set up, so `npx shadcn add …` works wherever the registry is reachable.
24. **TanStack Table v8** (stable). v9 has a different API and shadcn's patterns target v8.
25. **List pages keep their state in the URL** (search, filters, sort, page), and the server renders that page. Column visibility is remembered per table in the browser. Below `md`, rows become stacked cards.
26. **CSV exports** are route handlers that check the permission, prefix any cell starting with `= + - @` with an apostrophe (spreadsheet formula injection), add a UTF-8 BOM for Excel, and write an `export.*` audit row.
27. **Settings** are one JSON row per section, each validated by its own Zod schema with a default for every field. A section never saved reads as its defaults; a stored field that no longer validates falls back to its default, and the rest is kept.
28. **Email in development** goes to the console and to `.data/outbox` (git-ignored). Resend is used only when `RESEND_API_KEY` is set *and* Settings → Integrations selects it.
29. **The demo seed** (`npm run db:seed:demo`) refuses `NODE_ENV`/`VERCEL_ENV=production` and any non-local database unless `--allow-remote` is passed. Its records are tagged (`demo-` idempotency keys, `@demo.zalfi.test` emails, `[demo]` coupons), so `--clear` removes exactly them and puts stock back to the ledger sum.
30. **The admin icon** is `public/admin-icon.svg`, a copy of the storefront icon, because files inside a route group get hashed URLs.
31. **Lighthouse** is measured on an idle machine. With the dev server compiling in parallel, total blocking time rose to 280 ms and performance read 88; on an idle machine the home page scores 100/100/100/100 (LCP 0.8s, CLS 0), as before.

## After phase 2

32. **`npm run admin`** replaces `admin:create-owner` (kept as an alias). It's a guided terminal tool: create an owner or manager, list admins, reset a password, switch someone off/on. Press Enter at the password prompt to get a generated one (`xxxx-xxxx-xxxx-xxxx`, no look-alike characters), shown once. It talks to PostgreSQL directly with Better Auth's own password hashing, so it works without `db:proxy` or the website running, and each change is written to the activity log as "terminal".
33. **`npm run dev` is one terminal.** `scripts/dev.ts` checks the database, starts the local Neon stand-in when needed, then `next dev`. Blank `.env` values (as copied from `.env.example`) count as unset (`src/lib/env.ts`). In development, sign-in accepts `localhost` and `127.0.0.1` on any port. The login page names the real problem: wrong password (401), switched off, too many attempts, or the database unreachable (5xx).
34. **Password fields have a show/hide (eye) button** (`PasswordInput`) on sign-in and on accepting an invitation.
