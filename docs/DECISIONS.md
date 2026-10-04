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

## Phase 3: Products & inventory

35. **Bottle data lives in the database.** `fragrances.bottle_meta` (trim, aspect, cap) and `bottle_maps` (where the baked maps are) are filled when a bottle photo is uploaded. The six original fragrances keep their generated files until their photo is replaced; `resolveBottle()` chooses. The bake is one module (`server/catalog/bake.ts`) shared by the admin and `npm run assets:bottles`, which still writes byte-identical files. If a bake fails, the photo is kept and the stage shows it unlit.
36. **Bottle photos are checked, never edited:** PNG or WebP with transparency, 600–5000 px. Only the maps are derived; the photo is stored as uploaded.
37. **Storage** is an adapter: `.data/uploads` served at `/media/…` in development, Vercel Blob when `BLOB_READ_WRITE_TOKEN` is set.
38. **Uploads are at most 4 MB each.** Vercel caps a function's request body at 4.5 MB, so server actions allow 5 MB and the forms refuse anything above 4 MB with a plain message. Gallery images are re-encoded as WebP, at most 2400 px on the long side.
39. **The experience counts its fragrances.** The chapter count, the line-up's columns, the chapter index and every "six" in copy (line-up, footer, story, bag, not-found, OG image, metadata) follow the published fragrances. With six, every page is pixel-identical to Phase 2 (0 changed pixels on the line-up).
40. **New fragrances start hidden.** Creating one needs a name, palette, cap and bottle photo; it goes on the shop only when published, and publishing needs at least one active size. Hiding a fragrance removes it from the shop, the sitemap and `/api/stock` at once.
41. **A size's SKU is locked once it has been ordered,** so old orders and receipts never point at a renamed code. Sizes are switched off, never deleted.
42. **Palettes are checked for contrast** when saved: `ink` on `bg` must pass WCAG AA (4.5:1), the same rule as the seed.
43. **The gallery** (ordered, with alt text, drag or keyboard to reorder) shows on the product page only when it has images, so the existing product pages are unchanged.
44. **Stock changes go through one function** (`adjustStock`), which locks the size's row, refuses to go below zero, and for manual reductions refuses to dig into bottles held for unpaid orders. Every change writes a ledger row with a reason; the admin picks the reason from a short list (restock, count correction, damaged, gift or sample, other) plus an optional note.
45. **Reservations** lock all the order's sizes in id order (`SELECT … FOR UPDATE`), so concurrent checkouts can't deadlock and only one gets the last bottle (tested in `tests/db`). Available stock is stock minus active reservations; an expired hold stops counting at once, and a cron job (every 10 minutes) marks it released. Committing a paid order's reservations is idempotent.
46. **`/api/stock`** now returns available stock (after holds) for published, active sizes only.
47. **Low stock** uses each size's own threshold, or the default in Settings → Inventory. The sidebar shows the count of published sizes that are low or out.
48. **Every catalogue or stock change revalidates the whole storefront** (`revalidatePath("/", "layout")`). The catalogue is small, and a stale price is worse than a re-render.

## Phase 4: Checkout & orders

49. **Checkout runs on Node,** not the Edge: it needs transactions (the WebSocket pool), `node:crypto` for codes, and the PDF renderer. The storefront's read-only routes stay edge-portable.
50. **Phone codes.** Six digits, valid 5 minutes, 5 tries, a new one after 60 seconds. Sends are limited to 5 per phone and 20 per IP an hour; checks to 30 per IP per 15 minutes. Only an HMAC of the code (keyed by `BETTER_AUTH_SECRET`) is stored. A verified phone stays verified in that browser for 24 hours: an httpOnly cookie holds a random token, and the database only its hash. With the dev SMS provider and outside production, the checkout shows the code on screen.
51. **BulkSMSBD** is the SMS gateway implemented first (`src/server/providers/sms`). Another gateway is one more object with a `send`.
52. **The total the customer saw is part of the order.** If prices, stock, the coupon or the fee changed in between, nothing is placed: the checkout shows the new total and asks again.
53. **Cash on delivery** orders are confirmed when placed: the bottles are sold from stock and the e-receipt goes out at once. They become paid when they are delivered. **Online** orders wait as "Awaiting payment" with their bottles held; phase 5 connects the payment, and the receipt goes out when payment is confirmed. Unpaid orders cancel themselves after the unpaid-order time (the cron job, every 10 minutes).
54. **Coupons.**
    - A coupon is a percentage (with an optional cap) or a fixed amount, not both. It can also give free shipping.
    - Discounts round down to whole taka, so cash payments never need poisha.
    - A coupon limited to some fragrances discounts only those bottles. The minimum order counts the whole bag.
    - Uses are counted from orders that weren't cancelled. "First order" means no earlier such order from that phone.
    - The coupon's row is locked while an order is placed, so its last use can't go to two orders at once (tested).
    - A used coupon can't be deleted, only switched off.
55. **Free shipping from a threshold** compares what is paid for the bottles, after the discount.
56. **Prices include VAT.** With VAT on in Settings → Invoice, the receipt shows the VAT the total already contains.
57. **The state machine** adds two steps to the spec. "Shipped" can go straight to "delivered", because some couriers skip "out for delivery". A return request can be declined, which takes the order back to "delivered". Admins can make every move by hand except "confirmed", which only payment makes. Cancelling or returning offers to put the bottles back, ticked by default. Cancelling a paid order reminds the admin to refund it (refunds arrive in phase 5). The full returns record (items, condition) arrives with shipping in phase 6.
58. **One invoice, two renderers.** `InvoiceData` is rendered as the e-receipt email (React Email) and the A4 PDF (React PDF), in the same order. The PDF is attached to the receipt, and admins can download it. The PDF uses Hanken Grotesk, with Noto Sans Bengali for ৳ and for addresses typed in Bangla. React PDF doesn't join Bengali conjunct letters perfectly. The email shows them correctly.
59. **The email logo** is a PNG made from the traced logo by `npm run assets:logo` (`public/brand/zalfi-logo-ink.png`), because mail apps don't show SVG reliably.
60. **Customers** are created or updated by phone at each order (the latest name and email win). Their addresses are kept, without duplicates.
61. **The confirmation page** opens with a private access token in its link (24 random bytes). It is not indexed and shows only that order.
62. **The checkout keeps a draft** of the details on the device, so a reload loses nothing. The bag and the draft are cleared once the order is placed.
63. **Orders admin.** The list has quick views (to pack, to ship, on the way, needs attention). Notes are timeline events. The sidebar counts the orders waiting to be packed. The phone search accepts any format (`01712-345678`, `+8801712345678`).

## Storefront changes before phase 5 (owner's requests)

64. **The newsletter section is gone** (the form and `/api/newsletter`). The signups already stored stay in `newsletter_signups`, untouched. This settles the open question from phase 1: the e-receipt is the only email ZALFI sends.
65. **The nav outlines where you are**, with a hairline box that fades in and out: Fragrances while the line-up is open, Find yours on the finder, Info on a house page. "The House" (a link to the story section) is replaced by **Info**, a small menu of the house pages, which also shows on phones.
66. **House pages** use the owner's `all-policies.md`, rewritten at the owner's request in shorter, warmer sentences, with the same facts. Where the owner's documents disagreed, I chose as follows (the owner should confirm):
    - **Returns.** The Terms said returns were accepted within a window, with refunds. The Refund policy and the Privacy policy both say all sales are final. The Terms' returns and damaged-item sections now point to the Refund policy.
    - **Payment methods.** The owner's text (bank transfer, bKash, Nagad with a transaction reference, cash on delivery, preorders at 50/50) is kept as written. The checkout's online payment (SSLCommerz: cards, bKash, Nagad, Rocket) arrives in phase 5. The two should be brought in line then.
    - **The domain.** The owner's text says www.zalfii.com (two i's). The pages say "this website", so a typo can't mislead.
    - **International delivery** is kept in the Terms ("abroad where we can"), though the FAQ and the checkout serve Bangladesh only.
    - **Brand updates by consent** stay in the Privacy policy and Terms, as the owner wrote them, though no newsletter is collected now.
67. **The line-up stands on a plain dark.** The back glow behind each bottle (a row of them read as one muddy band) is off in the line-up. The world's key light and haze fade out while it is open, and return as Reva steps into her chapter.
68. **The stage draws on demand.** It used to draw every frame while a bottle was on screen, even with nothing moving. Now it draws while the scroll, an anchor, the stage state or a loading texture changes, and stops 2.5 s after the last change (every damped follow and page glide finishes within that). Still frames were identical anyway, so nothing looks different. If frames keep coming in slower than about 38 fps, the resolution steps down (2 → 1.5 → 1), and never back up in that visit.

## Phase 5: Payments

69. **One payment interface, two providers.** The test gateway (`mock`) stands in for SSLCommerz while it isn't connected. It is a page on the site with Succeed / Fail / Cancel. It never runs on the live site: it is refused when `VERCEL_ENV` is production, or on any production build unless `ALLOW_TEST_PROVIDERS=true` (for staging; the same switch covers the test courier). Its notices and validation IDs are HMAC-signed, carrying the amount, so a test payment can't be forged either.
70. **Paid means validated.** An order becomes paid only when the provider's validation API answers VALID (or VALIDATED, a repeat check) and our transaction ID, the currency (BDT) and the amount all match. The customer's browser coming back proves nothing alone. The IPN and the return page share one settle function: whichever arrives first settles, and the other finds it done. The payment row is locked while settling, and each IPN is recorded in `webhook_events`, so repeats change nothing.
71. **Failures need a signature.** A failed or cancelled notice changes our records only when its signature checks out (SSLCommerz's `verify_sign`, the test gateway's HMAC). An unsigned one changes nothing, and the customer just sees the outcome they came back with. Every 30 minutes, `reconcilePayments` asks SSLCommerz about attempts still open after 10 minutes, in case both notices were lost.
72. **Each attempt has its own transaction ID** (`ZLF-001046-7KQ2M`), so an unpaid order can be paid again ("Pay now" on its page) while its bottles are held.
73. **Payments that arrive at the wrong moment are kept, and flagged.** A payment validated after the order cancelled itself marks it paid but leaves it cancelled. If the bottles sold out while the customer was paying, the order is paid but stays waiting, and is never cancelled automatically: restock and "Confirm order" by hand, or refund. A second payment for an already-paid order is recorded too. Each case puts a "Needs attention" note at the top of the order. The same happens when SSLCommerz marks a payment as risky.
74. **SSLCommerz session fields.** We don't collect postcodes, but SSLCommerz requires one, so we send `0000`. `shipping_method` is `NO`, because delivery is ours, not SSLCommerz's. The order number goes in `value_a`, and the store password is never stored with the provider's answers.
75. **Refunds.** Full or partial, never more than was paid. Who can refund follows the matrix: owners always; managers only with the owner's toggle.
    - Online payments go back through the provider. SSLCommerz refunds stay "Processing" until the refund status API says refunded. The order page's Check button and the cron ask for that.
    - Cash-on-delivery orders are refunded by hand (cash or a mobile transfer) and recorded, once delivered.
    - The order's payment status follows the completed refunds: partly refunded, then refunded.
76. **The Payments page** lists every online attempt, paid or not, with totals for the current filters: collected, refunded, net, paid and failed. Money figures follow the "managers see revenue" toggle.
77. **The gateway** is chosen in Settings → Payments, by the owner only. The keys stay in the environment. SSLCommerz selected without keys falls back to the test gateway in development, and turns online payment off on the live site.
78. **Placing an order locks its sizes first.** Inserting order lines takes a key-share lock on each size. Two checkouts that both did that, then locked the size to change its stock, could deadlock. The database test caught it when the timing shifted. The sizes are now locked up front, in id order.
79. **The demo seed no longer writes payment rows for cash on delivery.** The shop never creates them (delivery marks the order paid). Rows from older seeds are ignored when working out refunds.
80. **Cron frequency.** The jobs run every 10 and every 30 minutes. Vercel's free (Hobby) plan limits cron jobs (at the time of writing, to once a day), so check the plan before going live: Pro runs these schedules as written. With fewer runs, unpaid orders still stop holding stock on time (availability ignores lapsed holds). Only the tidying, the missed-notice checks and the refund status checks wait longer.
81. **The SSLCommerz sandbox couldn't be reached from the build environment** (network policy). The provider is written to SSLCommerz's documented API and tested with payloads in its documented shapes: session, validation, signature, transaction query, refund and refund status. The first real sandbox payment happens once the keys are added (see GO_LIVE in phase 8).

## Phase 6: Shipping

82. **One courier interface, three couriers** (`src/server/shipping`): the test courier, Pathao and Steadfast. The test courier takes every parcel at once. The admin then plays the courier from the order page ("Courier update"), and each update is a signed webhook through the same code real webhooks use. Like the test gateway, it never runs on the live site (decision 69).
83. **One status file per courier** (`status-mock.ts`, `status-pathao.ts`, `status-steadfast.ts`). Each courier status maps to plain words, the order state it means, and whether the parcel's journey is over. The order then moves along the state machine to that state, through any steps in between (Pathao can report "delivered" for a packed order). A status nobody knows, a repeat, or a step backwards ("in transit" arriving after "delivered") changes nothing. It is kept in the parcel's log.
84. **Sending.**
    - Only confirmed or packed orders can be sent, and online orders only once paid. Sending a confirmed order packs it.
    - A placeholder parcel is written before the courier is called, so a double click can't make two parcels.
    - The courier's reference is the order number, with `-2`, `-3` on a re-send, because couriers refuse a reference they already have.
    - The cash to collect is the total for unpaid cash-on-delivery orders, and nothing otherwise. It is sent to couriers in whole taka.
85. **Pathao needs its own city and zone IDs.** They are matched from the address's district and area, through a list of older spellings (Chittagong, Comilla, Bogra…). When there's no match, the order page offers Pathao's lists to choose from, and a bulk send skips that order with the reason. The parcel goes as normal delivery (48 hours), item type "parcel", at 0.5 kg a bottle.
86. **Webhooks.**
    - Pathao must send the secret we set in its panel (`X-PATHAO-Signature` = `PATHAO_WEBHOOK_SECRET`). We answer 202 with `X-Pathao-Merchant-Webhook-Integration-Secret`, which Pathao's set-up check asks for.
    - Steadfast must send our token as a Bearer header (`STEADFAST_WEBHOOK_TOKEN`).
    - Anything else gets a 401. Repeats are dropped through `webhook_events`.
    - Where the courier's API can be asked, its answer wins over the webhook's payload: the webhook says something happened, the API says where the parcel is now.
    - The cron asks about every parcel still under way, every 30 minutes, in case a webhook was missed.
87. **Cancelling a parcel.** Neither Pathao nor Steadfast has a cancel API. The parcel is cancelled in their panel, then confirmed here (a tick box). It works only before pickup, and the order stays packed, ready to send again. A parcel cancelled here gets its own status (`cancelled_by_zalfi`), so it is never confused with a courier's own "cancelled".
88. **Failed deliveries.** Each failed attempt is counted on the parcel, and the order shows "Delivery failed".
    - While the courier still has the parcel, "Try delivery again" puts the order back on the way. A courier's own re-attempt moves it automatically.
    - Once the courier reports the parcel back with ZALFI, only "Returned" is offered.
    - A courier's warning (coming back, partial delivery, held) shows as "Needs attention" at the top of the order, until an admin moves or refunds the order, or it is returned.
89. **Returns** record the reason, the condition (unopened, opened, damaged, bottles missing) and whether the bottles went back in stock. Restocking is ticked by default, and never offered for missing bottles. A returned order that was paid online is refunded by hand from its Payment panel, not automatically, because the owner decides each case.
90. **The label is ZALFI's own,** a 4 × 6 inch PDF (one per page, for thermal or ordinary printers). It has the order number, the recipient, the cash to collect (or "Paid online: collect nothing"), the courier's consignment ID and a QR code of the tracking code. The courier's own sticker carries its barcode. The sender is the logo at the top, with "If undelivered, return to" and the store's phone and address. Labels print one at a time from the order, or in bulk from Orders or Shipping.
91. **Cash on delivery per courier** (Shipping page): "Collected" is the cash on parcels delivered in the last 30 days, which is what the courier owes before its payout. "Still to collect" is the cash on parcels under way. Couriers' payouts aren't recorded (the spec doesn't ask), so the page says to check the figure against each courier's statement.
92. **Tracking links** for Pathao and Steadfast parcels appear on the confirmation page and in receipts sent after dispatch. The test courier has no public tracking.
93. **Pathao and Steadfast weren't tried live:** no keys exist yet. Both are written to their documented merchant APIs and tested with payloads in those shapes (create, status, webhooks, errors). The first real parcel goes once the keys are added (see GO_LIVE in phase 8). Start with Pathao's sandbox (`PATHAO_IS_LIVE=false`).
94. **The demo seed** now writes each courier's own statuses (Pathao's `in_transit`, Steadfast's `pending`…), so demo parcels read like real ones.

## Phase 7: Dashboard, customers, reports and search

95. **One rule for what counts as a sale** (`src/server/reports/metrics.ts`), used by the overview, customers and reports:
    - An order counts from the day it is placed (in Dhaka time), unless it is still waiting for payment, was cancelled, or came back (returned).
    - Its revenue is its total (bottles after discounts, plus shipping) less completed refunds. A refund lowers its order's day, not the day it was paid back.
    - Cash-on-delivery orders count the day they're placed, so today's numbers aren't empty until couriers deliver.
    - "Item sales" by fragrance and size use bottle prices before order discounts, because a discount belongs to the whole order.
    - Average order is order totals before refunds, divided by orders. A day with no orders has no average (a gap in the line), not ৳0.
96. **Periods are Bangladesh days** (`range.ts`): today, the last 7, 30 or 90 days, this month, or a custom range of up to a year.
    - Charts group by hour (a day or two), day (up to a month), week (from Monday, up to six months), then month. Every bucket shows, empty ones too.
    - The comparison period is the same length just before. For "this month", it's the same days of last month (1–4 Oct against 1–4 Sept).
97. **"Today so far" compares with this time yesterday,** not all of yesterday, so a morning isn't measured against a whole day.
    - The queues (to pack, to send, failed deliveries) are rebuilt for yesterday from each order's status times.
    - Yesterday's low stock comes from the stock ledger.
98. **Charts.** Time series (revenue, orders, average order) use Recharts. Categories are plain bars, with the value at the end of each.
    - Where the spec asks for pies and donuts, the overview shows bars or one part-to-whole bar instead. Orders by status has nine parts, which a pie can't show legibly. Payment method and zone have two parts each. Sizes is a single number while only 50 ml sells.
    - The chart colours were replaced. The old ones failed a colour-blind and contrast check. The new palette is validated on the admin's own light and dark card surfaces (`--chart-*` in admin.css).
    - Every chart has its numbers in a table under it ("Show the numbers"). Charts don't animate, and the previous period is a grey line.
99. **Needs attention** lists:
    - unpaid orders lapsing within the hour;
    - online payments that failed in the last day, on orders still waiting;
    - failed deliveries;
    - return requests;
    - sold-out sizes that are on sale.
    Each links to what to open.
100. **Customers.** "Spent" follows the sales rule. Orders that were unpaid, cancelled or returned show as "placed" beside the sales ("3 of 4"). A customer's district and addresses fall back to the addresses on their orders, since older checkouts (and the demo data) didn't save them.
101. **Reports.** Sales (by day, week or month), fragrances, sizes, stock value, coupons, zones, refunds and returns. Each has a chart, its full table and a CSV.
    - Stock is valued at shop prices, because cost prices aren't recorded.
    - Refunds and returns are dated by when they happened.
    - The coupon report ends with "No code" for comparison.
    - Zone delivery time runs from pickup to delivery.
    - CSV columns carry their unit (`_bdt`, `_pct`, `_utc`), and every export is audit-logged.
102. **Revenue hidden for managers** (Settings → Team toggle off): every money figure goes. That covers tiles, charts, report columns, customer spend and CSV columns. Order totals stay on order lists and in search, because packing and cash on delivery need them.
103. **Global search** (top bar, or press `/` or Ctrl/⌘ K) finds:
    - orders by number, phone, name or email;
    - customers by name, phone or email;
    - fragrances by name, slug or SKU.
    Each group appears only to those who may open it. A phone matches however it's typed (`+880 1712-345678`, `01712345678`, `1712345678`), and an exact order number comes first. Enter with nothing chosen opens the full results page.
104. **The orders list gains a courier filter** (Pathao, Steadfast, test courier, not with a courier), as the spec asks.
