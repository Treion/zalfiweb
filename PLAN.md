# ZALFI: Build Plan

Status: **waiting for approval.** No application code has been written yet.

---

## 1. Architecture at a glance

```
Browser
 ├─ Lenis (smooth scroll) ──► drives GSAP ScrollTrigger (one shared ticker)
 ├─ GSAP timelines: intro, hero, chapters (scrubbed to scroll position)
 └─ Motion: cursor, hover lifts, buttons, menu, cart drawer, modals

Next.js App Router (Vercel)
 ├─ React Server Components read fragrance data at build/ISR time → static HTML
 ├─ /fragrances/[slug]: generateStaticParams, one page per perfume
 └─ Edge route handlers (runtime = "edge")
      /api/newsletter   POST: validate (zod) → insert into Postgres
      /api/stock        GET: live stock for the cart and product page
      /api/checkout     POST: placeholder, with a Stripe-shaped interface

PostgreSQL + Drizzle ORM
 ├─ Prod: Neon (Vercel Postgres) via @neondatabase/serverless (edge-safe HTTP driver)
 └─ Dev: local Postgres 16, same schema, via drizzle-kit migrations + seed script
```

**Key decisions**

| Area | Choice | Why |
|---|---|---|
| Framework | Latest stable Next.js, App Router, TypeScript strict | As specified |
| Styling | Tailwind CSS v4, with design tokens as CSS variables | Each fragrance world is a set of variables, so colour transitions only change a few variables |
| Scroll | `lenis` + `gsap` + `ScrollTrigger`, with `gsap.ticker` driving Lenis | One RAF loop. Keeps scrub animations in sync with no jitter |
| UI motion | `motion` (`motion/react`) | Hover, buttons, drawer, menu, cursor |
| Data access | `server-only` query module used by RSCs, pages revalidated (ISR) | Pages stay static and fast for Lighthouse, and price/stock edits in the DB show up without a redeploy |
| Build without DB | Queries fall back to the typed seed file if `DATABASE_URL` is missing | `next build` never fails in CI or preview. The DB stays the source of truth whenever it is present |
| Cart | Client store (React context + `localStorage`), stock checked against `/api/stock` | No login needed. Easy to hand off to Stripe Checkout later |
| Fonts | `next/font/google`: **Bodoni Moda** (display, high-contrast Didone) + **Hanken Grotesk** (body) | Fashion-magazine contrast without falling back to Inter. Alternatives: Cormorant Garamond / Italiana + Instrument Sans |
| Grain | Inline SVG `feTurbulence` noise, fixed overlay, `pointer-events: none` | No image request, and it looks tactile |

---

## 2. Data model (Drizzle)

```
fragrances        id, slug, name, tagline, story, palette (jsonb), bottle_image,
                  bottle_alt, sort_order, published
notes             id, slug, name, image (e.g. /images/notes/iris.png), alt
fragrance_notes   fragrance_id → fragrances, note_id → notes,
                  layer enum('top','heart','base'), label ("Frosted Pineapple"), position
variants          id, fragrance_id → fragrances, size_ml, price_cents, currency, stock, sku
newsletter_signups id, email (unique, lowercased), source, consent, created_at
```

`label` lives on the join table, so "Crushed Wild Mint" (Reva) and "Cool Mint" (Riven) both use `mint.png` but show their own names.

**Placeholder prices** (change in the `variants` table):

| Fragrance | 50 ml | 100 ml |
|---|---|---|
| Reva, Riven, Maree, Solea | 145.00 | 210.00 |
| Bond | 165.00 | 240.00 |
| Oudor | 185.00 | 265.00 |

Currency defaults to USD, stored per variant. Stock is seeded at 25 per variant.

---

## 3. The six worlds

| Fragrance | Mood | Palette (bg → deep → accent → ink) | One-liner (draft) |
|---|---|---|---|
| **Reva** | Frosted fougère: cold fruit over warm earth | `#DCD8E8` lavender haze → `#5E6B4A` moss → `#CFE3D8` frost mint → `#1F2420` | *Cold fruit and wild mint, laid over warm earth.* |
| **Riven** | Cool greens, glassy light | `#E3EEE9` glacier → `#1E2B24` deep leaf → `#C7D95A` lime → `#12201A` | *A green so cold it rings like glass.* |
| **Maree** | A seaside garden at dusk (marée = tide) | `#F1EEE6` tuberose ivory → `#22302C` tidal green → `#9DB8AE` sea glass → `#1A2220` | *White flowers at low tide, cedar still warm from the sun.* |
| **Solea** | Warm sand and cream, slow afternoon | `#F4EAD8` cream → `#5A3A22` vanilla bean → `#E3B64B` pineapple gold → `#2B1D12` | *Skin, sun, and a slow vanilla afternoon.* |
| **Bond** | Tailored: iris powder and dark wood | `#B9B3C4` iris ash → `#2A2629` graphite → `#7A4B2F` nutmeg → `#F2EADB` (light ink on dark) | *Iris in a dark suit, with oud keeping its secrets.* |
| **Oudor** | Deep burgundy, smoke, gold | `#4A0F1A` burgundy → `#2A080E` oxblood → `#C9962E` saffron gold → `#F3E6D6` (light ink on dark) | *Saffron and red rose, burning slowly into smoke and gold.* |

Every palette is checked for WCAG AA contrast between text and background before it ships.

---

## 4. Page choreography (scroll budget, desktop)

| Section | Pinned length | What is scrubbed |
|---|---|---|
| 1. Brand intro | 100vh (not pinned) | On load: letter-by-letter mask reveal of Z·A·L·F·I (a one-time intro, not scroll). On scroll: the wordmark scales down, spreads its tracking, and fades as the hero takes over |
| 2. Hero bottle | ~150vh | The bottle rises from below into center, and the shadow sharpens as it lands. Cursor tilt (Motion spring, ±6°) and a light sheen that follows the pointer. **The hero bottle is Reva**, so the hero hands off seamlessly into Chapter 1 |
| 3. Chapters ×6 | ~350vh each | One **pinned stage** for all six. Each `<FragranceChapter>` adds its own sub-timeline to a master timeline: background fades to the fragrance's palette → name/description typographic reveal → TOP notes float in → HEART → BASE → CTA. Between chapters, notes scatter outward and dissolve while the old bottle exits up-left and the next rises from below-right, all in the same scrubbed timeline |
| 4. Collection | none | A lineup of all 6 bottles in an asymmetric, staggered row. Hovering lifts a bottle and shows its notes. Clicking opens `/fragrances/[slug]` |
| 5. Story → Newsletter → Footer | none | Editorial text reveals triggered on enter |

**Depth for notes.** Each layer places notes on 3 depth planes:

- **Near:** larger, sharp, fastest parallax.
- **Mid:** normal size and speed.
- **Far:** smaller, slowest, with a *static* CSS blur applied once and never animated.

Only `transform` and `opacity` ever animate. On hover a note lifts (Motion) and its label reveals.

**Performance inside chapters.** Only the current chapter and its two neighbours are mounted with real images. The next chapter's bottle and notes are preloaded. Everything else is lightweight placeholders.

**Mobile (≤ 768px, tested at 375px).** Chapters run about 220vh each, with 2 notes per layer instead of 3–4. There is no depth blur, no cursor, and no tilt. The bottle scales to about 55vh.

**`prefers-reduced-motion`.** Nothing pins. Each chapter becomes a static editorial spread: the bottle, the name, a notes pyramid, and the CTA. Lenis is disabled and native scroll is used.

---

## 5. Folder structure

```
src/
  app/
    layout.tsx               fonts, grain, cursor, SmoothScroll provider, CartProvider
    page.tsx                 RSC: loads fragrances → <Intro/><Hero/><Chapters/><Collection/><Story/><Newsletter/>
    fragrances/[slug]/
      page.tsx               product page (RSC) + generateMetadata + generateStaticParams
      opengraph-image.tsx    OG image built from the bottle photo
    checkout/page.tsx        placeholder
    api/newsletter/route.ts  edge
    api/stock/route.ts       edge
    api/checkout/route.ts    edge, Stripe-ready stub
    sitemap.ts, robots.ts, opengraph-image.tsx
  components/
    motion/                  SmoothScroll, useGsap, useReducedMotion, SplitText (custom, no paid plugin)
    ui/                      Cursor, Grain, Button, Nav, CartDrawer, NoteImage (with empty-frame fallback)
    sections/                Intro, HeroBottle, FragranceChapters, FragranceChapter, Collection, Story, Newsletter, Footer
    product/                 BottleGallery, NotesPyramid, VariantPicker, AddToBag
  db/
    schema.ts, client.ts (neon-http | node-postgres), queries.ts (server-only)
    seed-data.ts             the single typed source for the six fragrances
    seed.ts                  inserts seed-data into Postgres
  lib/                       cart store, money formatting, palette helpers
drizzle/                     generated migrations
public/images/{bottles,notes}/
CLAUDE.md  PLAN.md  NOTES_IMAGES_CHECKLIST.md
```

---

## 6. Milestones

Each milestone ends with the same steps: `npm run lint` + `tsc --noEmit` + `npm run build` + `npm run dev`, then Playwright screenshots at **1440px and 375px** (and one run with reduced motion). After that, a git commit, a push, and a summary for your review.

### M0: Foundation
- Scaffold Next.js + TS + Tailwind v4, ESLint, Prettier, path aliases.
- **CLAUDE.md** with all design, animation, performance and a11y rules from your brief.
- Fonts, colour tokens, base typography scale (the oversized display sizes).
- Grain overlay, custom cursor (hidden on touch and reduced motion), skip link.
- `SmoothScroll` provider (Lenis ↔ ScrollTrigger sync) and a `useReducedMotion` hook.
- `NoteImage` / `BottleImage` components with the tasteful empty-frame fallback, so the site works before your photos arrive.

### M1: Data layer
- Drizzle schema, migrations, local Postgres setup, and a seed script with all six fragrances, 26 notes and the variants.
- Neon edge driver for production, `pg` locally, chosen automatically from the environment.
- Typed query functions (`getFragrances`, `getFragrance(slug)`), plus the seed-data fallback for DB-less builds.
- `/api/newsletter` edge route (zod validation, duplicate-safe insert, honeypot field against spam) and `/api/stock`.
- `.env.example` and a README section on connecting Neon on Vercel.

### M2: Brand intro + hero bottle
- Letter-by-letter mask reveal of the ZALFI wordmark, and a minimal scroll cue.
- Scrubbed handoff: the wordmark recedes as the bottle rises. The pinned hero has cursor tilt, a light sheen, and a layered contact + ambient shadow.
- The hero bottle uses `priority` and exact `sizes`, with reserved space so there is no layout shift.

### M3: One perfect chapter (Reva)
- `<FragranceChapter>`, driven entirely by data: palette transition, name and description reveal, TOP → HEART → BASE note layers across 3 depth planes, hover lift with label, and the "Discover Reva" / "Add to bag" CTA.
- Tuned until it feels right. **I'll stop here for your feedback on the motion before cloning it five times.**

### M4: All six chapters + transitions
- One master pinned stage and seamless handoffs (notes scatter, bottle exits while the next enters).
- Mount window of current ±1 chapters, and next-chapter preloading.
- Mobile timeline variant, and the static reduced-motion layout.

### M5: The Collection
- Asymmetric bottle lineup, hover lift + notes reveal, keyboard focus that shows the same state as hover, and links to product pages.

### M6: Product pages + cart
- `/fragrances/[slug]`: large bottle imagery, notes pyramid with images, size/price picker, stock-aware "Add to bag".
- A cart drawer built with Motion: focus trap, Esc to close, quantity controls.
- `/api/checkout` stub + `/checkout` placeholder page. They accept a `{ items: [{ variantId, qty }] }` payload, so Stripe Checkout Sessions can drop in later.
- "Next fragrance" link at the bottom to keep people browsing.

### M7: Brand story, newsletter, footer
- A short editorial brand story with overlapping type and image.
- Newsletter form with optimistic UI and states (success, already subscribed, error), connected to the edge route.
- A refined footer.

### M8: Polish, SEO, performance, a11y
- Per-page `generateMetadata`, OG images from the bottle photos, `sitemap.ts`, `robots.ts`, and JSON-LD `Product` markup.
- Lighthouse desktop pass (target 85+, CLS about 0), bundle check (GSAP loaded only where needed).
- Accessibility pass: alt text, focus order, visible focus rings, contrast per palette, ARIA for the drawer and cursor.
- Final 375px sweep and a written list of anything left for you to decide.

---

## 7. Things I need from you (or defaults I'll use)

1. **Bottle photos.** Are they transparent-background PNGs? Please add them to `public/images/bottles/`. Until they arrive I'll build with empty frames.
2. **Hero bottle.** Default: **Reva**, since it opens Chapter 1 and makes the handoff seamless.
3. **Currency and sizes.** Default: **USD, 50 ml and 100 ml.**
4. **Fonts.** Default: **Bodoni Moda + Hanken Grotesk.**
5. **Database.** Local Postgres for development now. For production, you connect Neon (Vercel Postgres) and I'll document the one env var it needs.
