# ZALFI backend: discovery and plan (Phase 1)

This is my reading of the repo against `ZALFI_BACKEND_SPEC.md`, the schema changes I plan, and where the spec conflicts with what exists. Judgement calls are recorded in `docs/DECISIONS.md`.

---

## 1. What exists today

### Database (Postgres + Drizzle, migrations `0000`–`0002`)

| Table | Holds |
|---|---|
| `fragrances` | slug, name, tagline, story, mood, `palette` (jsonb: bg/deep/accent/ink), `cap_finish` (enum), bottle image + alt, sort order, `profile` (jsonb scent profile), `published`, `updated_at` |
| `notes` | the note library (slug, name, image, alt) |
| `fragrance_notes` | fragrance ↔ note, with layer (top/heart/base), label, position |
| `variants` | one row per fragrance × size: `sku` (unique), `size_ml`, `price_cents`, `currency` (default **USD**), `stock` (a plain integer) |
| `newsletter_signups` | email, source, consent |

- Migration `0002_only_50ml` deleted every non-50 ml variant. Today there are six variants, one per fragrance.
- **Prices are USD placeholders** (`$145`–`$185`, stored as cents).
- **The driver is Neon's HTTP driver** everywhere (`src/db/client.ts`). In development, `scripts/neon-local-proxy.ts` speaks Neon's HTTP protocol to local Postgres 16.
  - The HTTP driver **cannot run interactive transactions**: `db.transaction()` throws. It can only send a fixed batch of statements.
  - The seed script uses node-postgres (`pg`) directly, which can.
- `src/db/seed-data.ts` is the typed catalogue. `getFragrances()` falls back to it when there is no `DATABASE_URL`, so builds never break.

### API routes
- **`GET /api/stock?skus=`**
  - Returns live stock and price per SKU, cached for 30s at the edge.
  - The product page uses it to show "in stock" and refresh the price.
- **`POST /api/checkout`**
  - Validates `{ items: [{ sku, qty ≤ 10 }] }` with Zod, re-prices it on the server and checks stock.
  - It then always answers `unavailable` ("Checkout opens soon"). There are no orders yet.
  - The comments describe a Stripe plan, which no longer applies.
- **`POST /api/newsletter`**
  - Zod validation, a honeypot field, and an insert that ignores duplicate emails.
  - Collects addresses only; nothing is ever sent.

### Bag and checkout (frontend)
- **`cart-store.tsx`**
  - The bag is a React context saved in `localStorage` (`zalfi.bag.v1`). Each line holds `sku, slug, name, sizeMl, priceCents, currency, bottleImage, qty`, with at most 10 of each bottle.
  - When it is restored, the root layout's `catalogue` (sku → price) drops sizes that are no longer sold and refreshes prices.
- **`CartDrawer`** posts the bag to `/api/checkout` and redirects if it gets a `url` back. Otherwise it shows the message it received.
- **`/checkout`** is a placeholder page: "Almost yours", plus `CheckoutSummary`.
- **Quick Add** buttons exist on the line-up, the chapters, the product page (including a sticky bar) and the finder. They all go through `useCart().add`.

### App shell
- **One root layout** (`src/app/layout.tsx`) wraps every page in Lenis, the cursor, grain, nav, footer, the bag drawer and the WebGL stage loader.
- **No `proxy.ts`.** Next 16 renamed `middleware.ts` to `proxy.ts`; the docs in `node_modules/next/dist/docs` confirm it.
- **Package manager:** npm. The spec's `pnpm admin:create-owner` becomes `npm run admin:create-owner`.
- **Network:** the npm registry is reachable. Better Auth 1.x supports `drizzle-orm ^0.45`, which matches the repo.

---

## 2. Conflicts with the spec, and how I propose to resolve them

| # | Conflict | Proposal |
|---|---|---|
| 1 | **Currency.** The catalogue is in USD cents (`$145`); the spec wants BDT in poisha (`৳1,250`). | Migration: rename `price_cents` → `price_poisha` and set the currency to BDT everywhere. `formatPrice` becomes `৳1,250`, with Bangladeshi lakh grouping for large sums (`৳1,25,000`). **This is the one visible storefront change: prices show in taka.** **I need your real taka prices.** Until then, the seed uses placeholders (`৳4,500` / `৳5,000` / `৳5,500`), editable later in Products. |
| 2 | **Transactions.** The Neon HTTP driver can't run the transactions the spec requires (stock, money, the last-bottle race). | Keep HTTP for storefront reads (still edge-portable). Money and stock writes use Neon's **WebSocket `Pool`** driver, which supports real transactions, through one `withTx()` helper. The admin and checkout routes run on Node. In development I'll add a small WebSocket → Postgres bridge to the existing local proxy, so dev and production run the same driver code. |
| 3 | **The admin must never load GSAP, Lenis or three.js**, but today's single root layout loads them on every page. | Split into two root layouts with route groups: `app/(site)/layout.tsx` (today's layout, moved unchanged) and `app/(admin)/admin/layout.tsx` (a clean shell with its own CSS). Pages move into `(site)`; their URLs and behaviour don't change. Moving between the site and the admin is a full page load, which is fine. |
| 4 | **Styles.** shadcn/ui needs its own CSS tokens and a light/dark theme; the storefront `globals.css` sets a dark body, grain and `cursor: none`. | The admin gets `admin.css`: Tailwind v4, shadcn tokens for light and dark (`next-themes`), and ZALFI accents taken from the existing theme (bone, noir, the world colours). Hanken Grotesk for the interface, with Bodoni Moda for page titles only. `globals.css` stays storefront-only. |
| 5 | **New fragrances from the admin.** The home experience is built for exactly six chapters (`CHAPTER_COUNT = 6` in `stage/config.ts`). Each fragrance also needs a world palette, a cap finish, notes, and baked WebGL maps from its bottle photo. | Phase 3: the admin edits everything about the existing fragrances, can hide them, and can create new ones. I'll make the chapter count follow the published fragrances, so the experience adapts without anyone touching code. The **3D relighting maps** are baked from the photo by `npm run assets:bottles` (sharp). For an admin upload, I'll run the same bake in a Node route and store the maps beside the image. If a bake fails, the stage falls back to the plain photo. Uploaded **gallery** images (multiple, ordered, with alt text) appear on the product page and in receipts; the hero bottle stays the owner's real photo. |
| 6 | **"The e-receipt is the only email ZALFI sends"** vs the existing newsletter form. | Keep the form collecting addresses (it never sent anything). In the admin, add an owner-only CSV export of subscribers, audit-logged. **Tell me if you'd rather remove the newsletter section.** |
| 7 | **Addresses.** "64 districts, then area/thana": the district list is fixed and small, but a full, correct thana list (~495) per district is a data-quality risk to type out by hand. | District: a dropdown of all 64 (bundled). Area/thana: a dropdown for Dhaka district's city thanas, which drive "Inside Dhaka" (and live in an editable settings list); a free-text area field for the other districts. When Pathao goes live, its city/zone/area lookups can replace this per courier. |
| 8 | **Sizes.** The spec talks about several bottle sizes; ZALFI sells 50 ml only. | The data model already supports many sizes per fragrance (variants), and the admin will let you add one. The storefront size chooser still appears only when a fragrance has more than one active size. |
| 9 | **Stock.** It is a plain integer today; the spec wants a ledger. | Keep `variants.stock` as the cached current stock, updated in the same transaction as each ledger row. A check script (`npm run stock:check`) proves stock equals the sum of the ledger. The migration writes an `initial` ledger row for today's stock. |
| 10 | **Branch.** The site work lives on `claude/zalfi-perfume-site-liu812`; the spec asks for `claude/zalfi-backend`. | Created `claude/zalfi-backend` from it, as the spec says. Storefront fixes (if any) would go back to the site branch only if you ask. |

---

## 3. Planned schema changes (Phase 2 migrations; names follow the existing snake_case style)

**Catalogue (extended, not duplicated)**
- `variants`
  - Rename `price_cents` → `price_poisha` and drop `currency` (BDT only).
  - Add `low_stock_threshold` (nullable: falls back to the settings default), `active` (bool), `created_at` and `updated_at`.
  - Add a `stock >= 0` check constraint.
- `fragrance_images`: id, fragrance_id, url, alt, position, width/height, created_at. Uploads go through a `StorageProvider`: Vercel Blob in production, `public/uploads` in development.

**Stock**
- `stock_movements`: id, variant_id, type (`initial | sale | cancel_restock | return_restock | manual_adjustment`), delta, reason, order_id?, admin_user_id?, created_at.
- `stock_reservations`: id, order_id, variant_id, qty, expires_at, released_at?
  - "Available" stock = stock minus active reservations.

**Customers and checkout**
- `customers`: id, phone (unique, normalised `01XXXXXXXXX`), name, email, first_order_at, last_order_at.
  - Order count and total spent are computed from orders, not stored.
- `customer_addresses`: id, customer_id, district, area, street, is_inside_dhaka, created_at.
- `phone_otps`: id, phone, code_hash, expires_at, attempts, verified_at, ip, created_at.
- `phone_verifications`: a verified phone tied to a browser session token, valid for 24h. A signed cookie holds the token; the DB holds its hash.

**Orders**
- `orders`
  - Identity: id; number (`ZLF-000123`, from a Postgres sequence); idempotency_key (unique).
  - Customer and address: customer_id; snapshots of customer name/phone/email and address (district, area, street, zone).
  - Money: subtotal, discount, shipping_fee, total (all poisha); coupon_id? and a code snapshot.
  - Payment: payment_method (`sslcommerz | cod`), payment_status (`unpaid | paid | failed | partially_refunded | refunded`).
  - Fulfilment: status (`pending_payment | confirmed | packed | shipped | out_for_delivery | delivered | cancelled | delivery_failed | return_requested | returned`), courier?, tracking_code?, internal_notes.
  - Time: expires_at (unpaid orders), and a timestamp per status (`confirmed_at`, `packed_at`, `shipped_at`, …), created_at.
- `order_items`: id, order_id, variant_id, and snapshots of sku, name, size_ml, unit_price and qty, plus line_total.
- `order_events`: id, order_id, type, from_status?, to_status?, message, data (jsonb), actor (`system | customer | admin:<id> | courier | payment`), created_at.

**Payments**
- `payments`: id, order_id, provider, tran_id (unique), val_id?, amount, status, method_reported (card/bKash/…), validation (jsonb), raw (jsonb, owner-only), created_at, updated_at.
- `refunds`: id, order_id, payment_id, amount, reason, provider_ref?, status, issued_by, created_at.

**Returns and shipping**
- `returns`: id, order_id, items (jsonb), reason, condition, restocked (bool), created_by, created_at.
- `shipments`: id, order_id, courier (`mock | pathao | steadfast`), consignment_id, tracking_code, status, cod_amount, label_url?, attempts, raw (jsonb), created_at, updated_at.
- `webhook_events`: provider, event_id (unique), received_at. This makes every IPN and courier webhook idempotent: the same event twice changes nothing.

**Coupons**
- `coupons`
  - code (unique, case-insensitive), active, starts_at, ends_at.
  - Discount: percent_off, max_discount, amount_off, free_shipping.
  - Limits: min_subtotal, first_order_only, usage_limit, per_customer_limit.
  - Restrictions: fragrance_ids and variant_ids (int arrays).
- Usage is counted from `orders.coupon_id`, so there is no separate counter to drift.

**Settings, admin and safety**
- `settings`: key (text PK), value (jsonb), updated_by, updated_at. Values are validated by one Zod schema per key, so each is typed and has defaults: store, invoice, shipping, payments, inventory, permissions, integrations.
- Better Auth tables (`user`, `session`, `account`, `verification`), with added `role` (`owner | manager`), `active` and `last_login_at`. Optional owner TOTP comes from Better Auth's two-factor plugin.
- `admin_invitations`: email, role, token_hash, expires_at (48h), invited_by, accepted_at.
- `audit_log`: id, actor_id, action, entity, entity_id, before (jsonb), after (jsonb), ip, created_at.
- `rate_limits`: key, window_start, count. A Postgres-backed fixed-window limiter.

---

## 4. Architecture in one picture

```
storefront (site)  ── reads ──▶ Neon HTTP (edge-portable, cached)
checkout + admin   ── writes ─▶ withTx() → Neon WebSocket Pool (transactions)
                                   │
domain (src/server/*): pricing · shipping · coupons · order state machine · stock ledger · OTP
                                   │
adapters (src/server/providers/*): Payment (mock | SSLCommerz) · Courier (mock | Pathao | Steadfast)
                                   Sms (dev | BulkSMSBD …) · Email (dev | Resend) · Storage (local | Blob)
```

- Business rules live in plain TypeScript modules with no framework imports, so Vitest can test them directly.
- Route handlers and server actions stay thin: validate with Zod, check permissions, call the domain, write audit and event rows.
- Each provider is picked from environment variables **and** a switch on the Integrations page. With no keys, the mock or dev provider runs, so the whole flow works locally today.

---

## 5. Phases (from the spec, each ends at a checkpoint)

1. **Discovery** (this document). ✅
2. ✅ **Foundations:** migrations, settings, Better Auth and roles, invitations, `admin:create-owner`, the admin shell (sidebar, top bar, dark/light), audit log, demo seed.
3. **Products & inventory:** fragrance and variant editing, images, stock ledger, reservations, low stock, storefront revalidation, `/api/stock`.
4. **Checkout & orders:** checkout steps, OTP (dev SMS), server pricing, shipping fees, coupons, the state machine, order pages, e-receipt and invoice PDF (dev email).
5. **Payments:** mock provider, SSLCommerz (sandbox-ready), IPN and validation, refunds, the payments page, the COD toggle.
6. **Shipping:** mock courier, Pathao and Steadfast, labels, bulk actions, webhooks, cron polling, failed deliveries and returns.
7. **Dashboard & reports:** overview charts, needs-attention list, customers, reports and CSV, global search.
8. **Hardening & docs:** the security pass, the full test suite, integration status with test buttons, `SETUP`, `GO_LIVE`, `DECISIONS` and `ADMIN_GUIDE`.

## 6. What I need from you (no rush, nothing blocks Phase 2)

- **Real prices in taka** for the six fragrances (50 ml).
- Whether to **keep the newsletter** section (it only collects emails).
- The **email address** for the first owner account (used by `npm run admin:create-owner`).
