# ZALFI: Maison de Parfum

The website for ZALFI, a niche perfume house. It uses Next.js 16, Tailwind v4, Drizzle and Postgres (Neon), GSAP with ScrollTrigger, Lenis, Motion, and a WebGL stage built on three.js and React Three Fiber. The stage relights the real bottle photographs live with custom shaders.

Design rules live in `CLAUDE.md`, the build plan in `PLAN.md`, and the note photo list in `NOTES_IMAGES_CHECKLIST.md`.

## Run it locally

```bash
npm install
cp .env.example .env.local      # also used by scripts via .env
# Postgres 16 running locally with a database called "zalfi"
npm run db:migrate              # create tables
npm run db:seed                 # six fragrances, 26 notes, 12 variants
npm run db:proxy                # local stand-in for Neon's HTTP endpoint (keep running)
npm run dev                     # http://localhost:3000
```

Without `DATABASE_URL`, the site still builds and runs from the typed catalogue in `src/db/seed-data.ts`. The newsletter then answers "unavailable".

| Page | What it is |
|---|---|
| `/` | Intro, hero, six chapters, collection, story, newsletter |
| `/fragrances/[slug]` | Product pages: live stock, scent profile, notes pyramid, sticky Add to bag |
| `/find` | Find your world: three questions, and the answer lit on the stage |
| `/checkout` | Placeholder, shaped for Stripe |
| `/lab` | Design foundations and asset status. Hidden in production |
| `/lab/stage?slug=oudor` | One relit bottle, to judge the lighting. Hidden in production |

## Deploy on Vercel

1. Import the repo. In **Storage**, add **Neon Postgres**. This sets `DATABASE_URL` (use the pooled connection string).
2. Set `NEXT_PUBLIC_SITE_URL` to your domain. It is used for canonical URLs, the sitemap and Open Graph images.
3. Run the migrations and seed once against Neon, from your machine:
   ```bash
   DATABASE_URL="postgres://…neon.tech/…?sslmode=require" npm run db:migrate
   DATABASE_URL="postgres://…neon.tech/…?sslmode=require" npm run db:seed
   ```
4. Edit prices, stock and copy directly in the `variants` and `fragrances` tables. Pages refresh within 5 minutes, with no redeploy. `npm run db:seed` never overwrites your edits (`-- --reset` does).

### API routes

These live in `src/app/api/*` and are edge-portable: they use only Web APIs and Neon's fetch-based driver.

| Route | Purpose |
|---|---|
| `POST /api/newsletter` | Newsletter sign-up, saved to Postgres |
| `GET /api/stock?skus=…` | Live stock and prices |
| `POST /api/checkout` | Stripe-shaped placeholder |

Next.js 16 deprecates `export const runtime = "edge"`, so the routes run on Vercel's default (Fluid) runtime. Adding that one line to a route pins it to the Edge again.

### Adding Stripe

`src/app/api/checkout/route.ts` already validates the bag and re-prices it on the server. The steps are written out at the top of that file: create a Checkout Session and return `{ status: "ready", url }`. The cart drawer redirects to it, and `/checkout?status=success` is the return page.

## Assets

| Command | What it does |
|---|---|
| `npm run assets:logo` | Traces `public/brand/logo.png` into the SVG logo and the animatable path data |
| `npm run assets:bottles` | Bakes the relighting maps (normal, material and thickness) from the bottle photos. Re-run it if a photo changes |
| `npm run notes:fetch` | Fetches openly licensed real photographs for the notes from Wikimedia Commons, cuts them out and writes `CREDITS.md`. Needs network access to `commons.wikimedia.org` and `upload.wikimedia.org`. Review every image before publishing |

## The WebGL stage and fallbacks

Browsers without a hardware GPU get the static editorial layout. This includes software GL (SwiftShader or llvmpipe), headless test browsers, and Lighthouse's lab Chrome. Reduced-motion users get the same. Add `?stage=force` to any URL to force the WebGL stage for a session (`?stage=off` resets it).

## Checks

```bash
npm run check          # eslint + typecheck + production build
npm run format         # prettier
```
