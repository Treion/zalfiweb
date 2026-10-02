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
