# ZALFI Backend & Admin Dashboard — Build Specification

You are building the complete backend and the private admin dashboard for **ZALFI**, a Bangladeshi online perfume store. The public storefront is already finished and is beautiful. Your job is to make the store able to take real orders, and to give the ZALFI team (1 owner + 5–6 managers) an excellent, easy dashboard to run the business day to day.

Read this whole file before writing any code. Then follow the **Phases** section at the end, stopping at every checkpoint.

---

## 0. Ground rules (read first)

1. **Study the existing repo before changing anything.** Read the Drizzle schema, existing migrations (including the one that removed 100 ml), the API routes (`/api/stock`, `/api/newsletter`, `/api/checkout`), the Tailwind v4 theme file, and how the bag/cart works on the frontend. You already know the product structure (fragrances, sizes, prices, scent profiles) — reuse it, extend it, never duplicate it.
2. **Do not change the look or behaviour of the public storefront.** No visual changes to existing pages, animations, the 3D stage, fonts or the logo. The only storefront work allowed is wiring the existing cart/checkout UI to the new backend, plus the new checkout steps described in section 4 — and those must reuse the site's existing design tokens, fonts and components so they look native.
3. **Keep the existing quality bar passing:** ESLint, Prettier, TypeScript strict, the Playwright "calm check", and Lighthouse scores on public pages must not get worse. The admin must never load GSAP, Lenis, three.js or React Three Fiber.
4. **Work on a new branch** created from `claude/zalfi-perfume-site-liu812`, named `claude/zalfi-backend`. Commit after each completed step with clear messages.
5. **Every paid integration must work without keys.** SSLCommerz, Pathao, Steadfast, the SMS gateway and the email service are not purchased yet. Build each one behind an adapter with a **mock/dev provider** so the entire flow (order → payment → shipment → delivery → receipt) can be run and tested locally today. When the owner later provides real keys, going live must only require adding environment variables and flipping a switch in the dashboard — no code changes.
6. **Never trust the browser.** Prices, discounts, shipping fees, stock and totals are always recalculated on the server.
7. **When something is ambiguous, choose the simplest robust option, write it down in `docs/DECISIONS.md`, and keep going.** Only stop to ask if a decision would be expensive to reverse.

---

## 1. Tech stack (extend what exists)

- **App:** the existing Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 project. Note that Next 16 uses `proxy.ts` where older versions used `middleware.ts` — check what the repo uses.
- **Database:** existing PostgreSQL on Neon via Drizzle ORM. All schema changes as new Drizzle migrations. Use transactions for anything touching money or stock.
- **Admin UI:** shadcn/ui components (Tailwind v4 compatible), TanStack Table for data tables, Recharts (or shadcn charts, which wrap Recharts) for graphs, `next-themes` for dark/light mode, `lucide-react` icons, React Hook Form + Zod for forms.
- **Auth (admin only):** Better Auth with its Drizzle adapter (fall back to Auth.js v5 only if Better Auth is incompatible with this Next.js version — note the choice in DECISIONS.md). Email + password, passwords hashed with argon2 or the library default.
- **Validation:** Zod schemas shared between server and client.
- **Email:** Resend + React Email templates, behind an `EmailProvider` adapter (dev provider writes emails to the console and to a local preview page).
- **PDF (invoices, shipping labels):** `@react-pdf/renderer`.
- **Background jobs:** Vercel Cron hitting protected route handlers.
- **Rate limiting:** a small Postgres-backed limiter (no extra paid service).
- **Testing:** Vitest for business logic, Playwright for admin and checkout end-to-end flows.
- **Money:** store all amounts as integers in **poisha** (1 taka = 100 poisha). Display as `৳1,250`. Currency is BDT only.
- **Time:** store UTC; display and group reports in **Asia/Dhaka**.

---

## 2. Data model (add to the existing schema)

Adapt names to the existing schema conventions. Minimum entities:

- **Product variants:** each fragrance × bottle size has its own price, SKU, stock quantity, low-stock threshold, and active/hidden flag. Reuse existing tables if they already model this.
- **Product images:** multiple per fragrance, ordered, with alt text. Store uploads in Vercel Blob (adapter-based, so storage can be swapped).
- **Stock movements (ledger):** every stock change is a row — type (`sale`, `cancel_restock`, `return_restock`, `manual_adjustment`, `initial`), quantity delta, reason, order link if any, admin user, timestamp. Current stock must always equal the sum of the ledger (add a check script).
- **Stock reservations:** hold stock for unpaid online-payment orders for 30 minutes (configurable), then release automatically.
- **Customers:** guests only — no customer accounts. Identify a customer by verified phone number. Store name, phone, email, and their addresses. The admin shows a customer list built from this (order count, total spent, first/last order).
- **Orders:** human-friendly number `ZLF-000123`, customer snapshot, delivery address snapshot, line items (snapshot of name, size, unit price, quantity), subtotal, discount, shipping fee, total, payment method, payment status, fulfilment status, courier, tracking code, internal notes, idempotency key, timestamps for every status change.
- **Order events (timeline):** every status change, payment event, courier update, note and admin action, shown as a timeline on the order page.
- **Payments:** provider, transaction IDs, amount, status, raw provider payload (for auditing), validation result.
- **Refunds:** full or partial, amount, reason, provider reference, status, who issued it.
- **Returns:** items, reason, condition, whether stock is restocked.
- **Shipments:** courier, consignment ID, tracking code, status, COD amount, label PDF, raw courier payloads, delivery attempts.
- **Coupons:** see section 7.
- **Phone OTPs:** hashed code, phone, expiry, attempt count, verified flag.
- **Settings:** a single key-value or typed settings table (shipping fees, store info, invoice details, integration toggles, etc.) editable from the dashboard.
- **Admin users, sessions, invitations.**
- **Audit log:** who did what, when, before/after values, IP — for every important admin action.

Seed script: realistic demo data (orders across the last 90 days, mixed statuses, both shipping zones, coupons) so the dashboard charts look meaningful during development. Seeding must never run in production.

---

## 3. Order lifecycle (state machine)

Implement order status as an explicit state machine in one file, with allowed transitions enforced on the server:

`pending_payment` → `confirmed` → `packed` → `shipped` → `out_for_delivery` → `delivered`

Side branches: `cancelled` (from pending/confirmed/packed), `delivery_failed` → (`shipped` again or `returned`), `return_requested` → `returned`, and payment status separately tracking `unpaid`, `paid`, `failed`, `partially_refunded`, `refunded`.

Rules:
- Stock is reserved when an online-payment order is created, and permanently deducted when payment is confirmed (or when a COD order is placed).
- Cancelling or returning (with "restock" ticked) adds stock back via the ledger.
- Every transition writes an order event and, where relevant, an audit log entry.
- Duplicate protection: checkout requires an idempotency key; payment callbacks and courier webhooks must be idempotent (processing the same event twice changes nothing).

---

## 4. Customer checkout flow (guest only)

Wire the existing bag/cart and `/api/checkout` to this flow, using the storefront's existing visual language:

1. Customer adds items to the bag (existing UI).
2. At checkout they enter: **full name, phone number, email, delivery address** (district dropdown with all 64 districts, then area/thana and street address). Validate Bangladeshi mobile numbers (`01XXXXXXXXX`, normalise `+880`).
3. **Phone verification by OTP:** send a 6-digit code by SMS. Code expires in 5 minutes, max 5 attempts, resend allowed after 60 seconds, rate-limited per phone and per IP. Codes stored hashed. Once verified, the phone stays verified for that browser session for 24 hours. SMS sending goes through an `SmsProvider` adapter with a dev provider that logs the code to the console; real providers to support later: BulkSMSBD, SSL Wireless, Alpha SMS (implement one fully, structure the adapter so others are easy).
4. The server calculates the shipping fee (section 6), applies any coupon (section 7), re-checks stock and prices, and shows the final total.
5. Customer chooses a payment method among those enabled in settings:
   - **SSLCommerz** (cards, bKash, Nagad, Rocket, etc.)
   - **Cash on Delivery** (a toggle in settings, **off by default**, so the owner can launch before SSLCommerz is active if they choose)
6. Order is placed. On success the customer sees a confirmation page with their order number, and an **e-receipt email is sent automatically** from ZALFI (the only email ZALFI sends). The receipt contains: ZALFI logo, order number, date, items, sizes, quantities, prices, discount, shipping, total, payment method and status, delivery address, invoice details from settings, and the courier tracking link once available (it may be added later — the receipt is sent at order confirmation).

No customer accounts, no customer login, no marketing emails, no other notifications. Payment messages come from SSLCommerz and delivery messages come from the courier.

---

## 5. Payments — SSLCommerz (ready to plug in)

Build a `PaymentProvider` interface with `createSession`, `validate`, `handleIpn`, `refund`, `getTransaction`. Implement:

- **MockProvider** for development: a simple fake payment page with "Succeed" / "Fail" / "Cancel" buttons that exercises the real callback code paths.
- **SSLCommerzProvider:** follow the official SSLCommerz developer documentation. Support both sandbox and live (`SSLCOMMERZ_STORE_ID`, `SSLCOMMERZ_STORE_PASSWORD`, `SSLCOMMERZ_IS_LIVE`). Implement session initiation, the success/fail/cancel redirect pages, and the **IPN endpoint**. A payment is only marked paid after server-side validation with the SSLCommerz validation API and an amount/currency/transaction-ID match — never based on the browser redirect alone. Implement refunds (full and partial) and refund status checks via their API.

Admin can see, per order: payment status, method used (card/bKash/etc. as reported), transaction ID, amount, validation result, refunds, and raw payloads (collapsed, owner only). There must be a "Payments" page listing all transactions with filters (success, failed, refunded) and totals.

---

## 6. Shipping & couriers — Pathao and Steadfast (both, ready to plug in)

### Shipping fees
- Inside Dhaka: **৳70**. Outside Dhaka: **৳200**. Both editable in **Settings → Shipping**.
- Which districts/areas count as "Inside Dhaka" is an editable list in settings (default: Dhaka city areas).
- Optional free-shipping threshold (off by default) editable in settings.
- Fee is calculated on the server from the address.

### Courier integration
Build a `CourierProvider` interface: `createShipment`, `getStatus`, `cancelShipment`, `handleWebhook`, `getTrackingUrl`, and (where supported) price/zone lookups. Implement:

- **MockCourier** for development, which lets you simulate status updates from the admin.
- **PathaoProvider:** follow the official Pathao Courier Merchant API docs (OAuth token with client ID/secret/username/password, store selection, city/zone/area lookups, order creation, status). Env vars: `PATHAO_CLIENT_ID`, `PATHAO_CLIENT_SECRET`, `PATHAO_USERNAME`, `PATHAO_PASSWORD`, `PATHAO_STORE_ID`, `PATHAO_IS_LIVE`.
- **SteadfastProvider:** follow the official Steadfast Courier API docs (API key + secret key, create order, status by consignment ID / tracking code, webhook). Env vars: `STEADFAST_API_KEY`, `STEADFAST_SECRET_KEY`.

In the admin:
- Set a **default courier** in settings, and allow changing courier per order.
- "Send to courier" button on an order (and bulk action for many orders) creates the shipment, saves consignment ID and tracking code, and moves the order to `shipped` (or `packed` → awaiting pickup, depending on courier status).
- COD amount is passed to the courier automatically for COD orders (0 for prepaid).
- **Shipping label:** generate ZALFI's own printable label PDF (logo, order number, customer name, phone, address, COD amount, consignment ID, QR/barcode of tracking code). Bulk print for multiple orders.
- Delivery status updates via courier webhooks where available, plus a Vercel Cron job that polls active shipments every 30 minutes as a fallback. Map each courier's statuses to ZALFI's order states in one mapping file per courier.
- Failed delivery and return handling: show failed attempts, allow re-attempt or mark as returned (with restock option).

---

## 7. Coupons & discounts

Support all of these, combinable as options on one coupon:
- Percentage off (with optional maximum discount cap)
- Fixed amount off
- Free shipping
- First order only (checked by verified phone number)
- Minimum order value
- Total usage limit and per-customer usage limit (by phone number)
- Start and end date/time
- Restrict to specific fragrances or sizes
- Active/inactive toggle

One coupon per order. Coupon page shows usage count, revenue generated and discount given per coupon.

---

## 8. Admin dashboard

### Access
- Lives at `/admin` in its own route group and layout. `noindex`, excluded from sitemap, blocked in robots.
- Protected at the proxy/middleware level and again in every server action and route handler.
- **Roles:**
  - **Owner** — everything: team management, settings, integrations, refunds, financial reports, audit log, raw payment data.
  - **Manager** — products, stock, orders, shipping, coupons, customers, dashboard and reports.
  - Keep permissions in one config file (a permission matrix), so the owner can later decide, for example, whether managers can issue refunds or see revenue. Add an owner-only toggle for "Managers can issue refunds" (default off) and "Managers can see revenue figures" (default on).
- Owner invites managers by email (invitation link, expires in 48 hours); can deactivate a manager instantly.
- First owner account created by a CLI script (`pnpm admin:create-owner` or the repo's package manager equivalent).
- Session timeout after inactivity; optional TOTP two-factor for the owner.

### Design
- **Desktop-first now, fully responsive-ready later.** Build layouts with responsive Tailwind patterns from day one (collapsible sidebar, tables that can switch to cards) so a phone version is a refinement, not a rewrite. It must be usable on a 1280px laptop without horizontal scroll.
- **Dark mode and light mode are essential.** Toggle in the top bar, respects system preference by default, remembers the choice. Every component, chart, table, badge and PDF preview must look good in both. Chart colours must stay readable in both themes.
- Clean, calm, premium feel that matches ZALFI: use the existing ZALFI logo SVG in the sidebar, and pull accent colours from the existing Tailwind theme. Bodoni Moda may be used sparingly for page titles; Hanken Grotesk for everything else. Prioritise clarity over decoration.
- Left sidebar navigation, top bar with global search (orders by number/phone/name, products by name), theme toggle and user menu.
- Every list page: search, filters, sorting, pagination, column visibility, CSV export, bulk actions where useful.
- Friendly empty states, loading skeletons, toast confirmations, and a confirmation dialog for destructive actions (cancel, refund, delete, stock reduction).
- Status badges with consistent colours across the whole app.
- Keyboard-friendly; accessible labels and focus states.

### Pages
1. **Overview (home)** — the first thing the team sees:
   - Today at a glance cards: today's revenue, orders, orders waiting to be packed, orders waiting to be sent to courier, low-stock items, failed deliveries. Each card compares with yesterday.
   - Date-range picker (today, 7 days, 30 days, this month, custom) with "compare to previous period".
   - Charts: revenue over time (line/area), orders over time (bar), orders by status (donut/pie), revenue by fragrance (bar), sales by bottle size (pie), payment method split (pie), inside vs outside Dhaka (pie), top 10 fragrances table, average order value trend.
   - "Needs attention" list: unpaid orders about to expire, failed payments, failed deliveries, return requests, items out of stock.
2. **Orders** — table with filters (status, payment status, method, courier, zone, date, coupon), bulk actions (mark packed, send to courier, print labels, export). **Order detail page:** customer and address (one-click copy phone/address), items, totals, payment panel, shipment panel with live tracking status, timeline, internal notes, actions (confirm, pack, send to courier, cancel, refund, return, download invoice PDF, resend e-receipt).
3. **Products** — list with image, name, sizes, price per size, stock per size, status. Create/edit fragrance: name, description, scent profile and anything the existing schema already supports, images (drag to reorder), per-size price/SKU/stock/low-stock threshold, publish/hide. Changes must show up on the storefront immediately (revalidate the relevant pages/tags).
4. **Inventory** — every variant with current stock, reserved stock, available stock, low-stock threshold, stock value. Quick inline stock adjustment that requires a reason. Full stock movement history with filters. Low-stock and out-of-stock highlighting.
5. **Customers** — built from verified phones: name, phone, email, orders, total spent, last order, addresses, link to their orders.
6. **Payments** — all transactions, filters, totals, refunds.
7. **Shipping** — all shipments by courier and status, failed deliveries, returns in transit, COD amounts expected from each courier.
8. **Coupons** — create/edit, performance stats.
9. **Reports** — sales report (by day/week/month), product performance, size performance, inventory valuation, coupon report, shipping zone report, refunds/returns report. Each with charts plus a table and CSV export. Revenue numbers respect the "managers can see revenue" toggle.
10. **Settings** (owner, some sections manager-readable):
    - Store info (name, logo, contact phone, email, address)
    - **Invoice details** (business name, address, trade licence number, BIN, VAT on/off and rate, invoice footer note) — all optional, appear on receipts and invoices when filled in
    - **Shipping** (inside/outside Dhaka fees, inside-Dhaka area list, free-shipping threshold, default courier)
    - Payment methods (SSLCommerz on/off, Cash on Delivery on/off, unpaid-order expiry minutes)
    - Low-stock default threshold
    - **Integrations status page:** shows each provider (SSLCommerz, Pathao, Steadfast, SMS, Email, Blob storage) as *Not configured / Sandbox / Live*, with a "Test connection" button. Secrets live in environment variables only — the page shows status, never the secret values.
11. **Team** (owner) — invite, change role, deactivate, see last login.
12. **Activity log** (owner) — searchable audit log.

---

## 9. Invoices & e-receipts

- One shared invoice template rendered as both an email (React Email) and a downloadable PDF (React PDF), so they always match.
- Uses the ZALFI logo and the brand fonts where the renderer supports them, works in plain white for printing.
- Invoice number = order number.
- Admin can download the invoice and resend the e-receipt from the order page.

---

## 10. Security checklist

- Server-side Zod validation on every input; reject unknown fields.
- Role/permission check in every server action and route handler, not only in the UI.
- CSRF protection for admin mutations (use the auth library's mechanism / same-site cookies + origin checks).
- Rate limits on: OTP send, OTP verify, checkout, coupon validation, admin login.
- Webhook and IPN endpoints verify authenticity (signature/validation API/secret path token as each provider supports) and are idempotent.
- Cron endpoints protected with `CRON_SECRET`.
- Never log full OTPs (except the dev SMS provider), passwords, or secrets. Mask phone numbers in logs.
- Security headers on admin routes; admin never cached publicly.
- Customer PII only visible to logged-in admins; CSV exports are audit-logged.
- Database access only through Drizzle with parameterised queries.

---

## 11. Environment & setup files

Create:
- **`.env.example`** listing every variable, grouped and commented: database, auth secret, app URL, Resend, email "from" address, SMS provider keys, SSLCommerz, Pathao, Steadfast, Vercel Blob, cron secret.
- **`docs/SETUP.md`** — how to run locally, run migrations, seed demo data, create the owner account, run tests.
- **`docs/GO_LIVE.md`** — a plain-language checklist written for a non-developer owner. For each provider: what account to open, what details to collect, which environment variable each value goes into, how to switch from sandbox to live, and how to confirm it works using the Integrations page. Goal: the owner hands over the keys and it's done.
- **`docs/DECISIONS.md`** — every judgement call you made.
- **`docs/ADMIN_GUIDE.md`** — a short guide for managers: how to process an order from start to finish, adjust stock, create a coupon, handle a return.

---

## 12. Testing requirements

- Vitest unit tests for: price/total calculation, shipping fee rules, every coupon rule, order state machine transitions, stock ledger and reservations, OTP logic, courier status mapping, SSLCommerz validation logic (with recorded sample payloads).
- Playwright end-to-end tests using mock providers for: full checkout with OTP → mock payment success → e-receipt captured → admin sends to mock courier → mock delivered; payment failure path; COD path; cancellation with restock; refund; manager cannot access owner pages; dark and light mode screenshots of the main admin pages.
- Concurrency test: two simultaneous checkouts for the last bottle — only one succeeds.
- Existing calm check and Lighthouse checks still pass.

---

## 13. Phases (stop at every checkpoint)

Work through these in order. At each **CHECKPOINT**: run lint, type-check and tests, commit, then give me a short summary of what was built, what I can try, and any decisions you made. Wait for my "continue" before the next phase.

1. **Discovery** — read the repo, then reply with: your understanding of the current schema and cart, the planned schema changes, and any conflicts with this spec. **CHECKPOINT.**
2. **Foundations** — schema migrations, settings, admin auth with roles, invitations, owner CLI script, admin layout shell with sidebar, top bar, dark/light mode, audit log, seed script. **CHECKPOINT.**
3. **Products & inventory** — product/variant management, images, stock ledger, reservations, low-stock alerts, storefront revalidation, connect `/api/stock`. **CHECKPOINT.**
4. **Checkout & orders** — guest checkout wiring, OTP with dev SMS provider, server-side pricing, shipping fees, coupons, order state machine, orders list and detail pages, e-receipt email and invoice PDF with dev email provider. **CHECKPOINT.**
5. **Payments** — provider interface, mock provider, SSLCommerz provider (sandbox-ready), IPN, validation, refunds, payments page, COD toggle. **CHECKPOINT.**
6. **Shipping** — courier interface, mock courier, Pathao and Steadfast providers, labels, bulk actions, webhooks, cron polling, failed delivery and returns, shipping page. **CHECKPOINT.**
7. **Dashboard & reports** — overview page with all charts and attention list, customers page, reports with exports, global search. **CHECKPOINT.**
8. **Hardening & docs** — security checklist pass, rate limits, full test suite, responsive-readiness review, integrations status page with test buttons, all docs (`SETUP`, `GO_LIVE`, `DECISIONS`, `ADMIN_GUIDE`). Final summary listing exactly which keys I need to provide to go live. **CHECKPOINT.**
