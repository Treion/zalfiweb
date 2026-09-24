# ZALFI: Build Plan

Status: **approved 2026-09-22, revision 2.** M0–M9 built. Waiting on the note photographs (see §8).

## What changed in revision 2

| Change | Effect on the plan |
|---|---|
| **Real rendered bottles.** You asked for shaders, clear reflections and real lighting | New WebGL rendering layer: three.js + React Three Fiber + custom GLSL. New milestone **M2: WebGL stage**. See §2 |
| **Bottle photos received** (`REVA.png` … `Oudor.png`, 2000×2000 transparent cutouts) | They move to `public/images/bottles/{slug}.png` in lowercase. The M0 asset pipeline also derives the lighting maps from them |
| **`logo.png` received.** Use the real logo for the intro instead of typed letters | The logo is traced to SVG, keeping its exact letterforms, and split into emblem + Z·A·L·F·I so each piece can animate. **The ZALFI wordmark is never typeset in a font again**; it is always the logo |
| **Note images may be AI-generated** (your permission) | This session has no image-generation tool, and the sandbox network blocks image sources. Instead, `NOTES_IMAGES_CHECKLIST.md` now has a **ready-to-use prompt pack** so you can generate all 26 in one consistent style. Until they arrive, empty frames show. See §8 |
| Observed: **all six bottles are black smoked glass**, and only the caps differ (silver ribbed, gunmetal ribbed, gold ribbed, chrome sphere, black sphere, gold sphere) | Dark bottles on dark worlds (Bond, Oudor) would disappear. The shader adds a palette-tinted rim light and back glow so the silhouette always reads. The caps reflect each world's colours |

---

## 1. Architecture at a glance

```
Browser
 ├─ Lenis (smooth scroll) ──► drives GSAP ScrollTrigger (one shared ticker)
 ├─ GSAP timelines (scrubbed) ──write──► stageState (plain mutable object, no React re-renders)
 ├─ <Stage/>: ONE fixed full-screen WebGL canvas (R3F), reads stageState every frame
 │     world background shader · relit bottle · reflective floor · caustics · notes · post FX
 ├─ DOM on top: typography, labels, buttons, accessible note list, cart, forms
 └─ Motion: cursor, hover lifts, buttons, menu, cart drawer, modals

Next.js 16 App Router (Vercel)
 ├─ React Server Components read fragrance data (ISR) → static HTML
 ├─ /fragrances/[slug]: generateStaticParams
 └─ Edge route handlers (runtime = "edge")
      /api/newsletter  /api/stock  /api/checkout (Stripe-shaped stub)

PostgreSQL + Drizzle ORM
 ├─ Prod: Neon (Vercel Postgres) via @neondatabase/serverless
 └─ Dev: local Postgres 16, drizzle-kit migrations + seed
```

| Area | Choice |
|---|---|
| Framework | Next.js 16 (App Router), TypeScript strict |
| Styling | Tailwind CSS v4 with design tokens as CSS variables |
| 3D / shaders | `three`, `@react-three/fiber`, `@react-three/drei` (utilities only), custom GLSL materials |
| Scroll | `lenis` + `gsap` + `ScrollTrigger`, driven by the GSAP ticker |
| UI motion | `motion` (`motion/react`) |
| Fonts | **Bodoni Moda** (display: fragrance names, headlines) + **Hanken Grotesk** (body). The brand name itself always uses the logo SVG |
| Build without DB | Queries fall back to the typed seed file if `DATABASE_URL` is missing |
| Cart | Client store (context + `localStorage`) with live stock from `/api/stock` |

---

## 2. Rendering: how the bottles get real light

The bottles are photographs, not 3D models. To get live shaders and reflections without losing a single pixel of the real product, each photo is **relit on the GPU**. In other words, the photo is rendered as a lit surface instead of a flat image.

### 2a. Asset baking (Node script, build time, runs once per bottle)
From each cutout, `scripts/bake-bottle-maps.ts` (using `sharp`) produces:
- **Normal map.** A distance field from the alpha edge gives the rounded glass edges and shoulders their volume, and fine detail from the photo's luminance (for example the ribs on the caps) is added on top. This tells the shader which way each pixel faces.
- **Material mask.** It separates **cap metal**, **glass**, and **label print**, found automatically from the width profile of the alpha channel (the cap is narrower than the cube). Cap tint (silver, gunmetal, gold, chrome, black) is measured from the photo.
- **Thickness map.** Used for the smoked-glass edge glow.
- Output: `public/images/bottles/maps/{slug}-normal.webp`, `{slug}-mask.webp`. These are small, and cached.

### 2b. Bottle material (custom GLSL on a plane that keeps the photo's aspect ratio)
- **Base:** the original photo, colour-accurate, never cropped or distorted.
- **Key light:** a GGX specular highlight from a moving light. The light follows the cursor, and GSAP drives a light sweep across the glass on every chapter reveal.
- **Environment reflection:** the normals sample a procedural "studio" environment tinted with the current fragrance palette. Gold caps pick up burgundy and saffron in Oudor, and the chrome sphere mirrors cream and sand in Solea.
- **Metal caps:** stronger, anisotropic streak highlights on the ribbed caps, and a mirror-like hotspot on the spheres.
- **Glass:** Fresnel rim light in the palette's accent colour, an inner smoked-glass glow through the thickness map, and a faint chromatic fringe on the edges only.
- **Tilt:** cursor and scroll rotate the plane a few degrees in 3D, and the lighting reacts correctly because it uses the normals.

### 2c. Scene
- **Reflective floor:** a mirrored, distance-faded, slightly blurred reflection of the bottle, plus a soft contact shadow.
- **Caustics:** an animated light pattern cast on the floor, as if light passed through the glass, tinted by the fragrance (lime-green in Riven, gold in Oudor).
- **World background shader:** a slow, flowing field of palette colours with soft light shafts from behind the bottle. It crossfades between fragrance worlds through one uniform.
- **Notes:** textured planes at real 3D depth around the bottle. Far planes are sharp but defocused by mip-bias sampling, so there is no blur filter cost. They catch the same key light. DOM labels are projected to their 3D positions.
- **Post-processing:** subtle bloom on highlights only, a vignette, and film grain in the same pass.

### 2d. Performance and fallbacks
- **Loading:** three.js loads **after** first paint (`next/dynamic`, idle callback). The LCP element is the regular `next/image` hero bottle. The canvas fades in on top of it once its textures are ready, so there is no layout shift and Lighthouse stays healthy.
- **Quality tiers:**
  - **High (desktop):** everything.
  - **Medium (laptops on battery, or slow frame-time detected):** no bloom, a cheaper floor.
  - **Low (mobile):** relit bottle + background shader + contact shadow only. DPR is capped at 1.5, with fewer notes.
- **Idle:** rendering pauses when the tab is hidden or the stage is scrolled away.
- **No WebGL or `prefers-reduced-motion`:** the static `next/image` layout, with no canvas at all.
- **Accessibility:** the canvas is `aria-hidden`. Every bottle and note also exists in the DOM with alt text, and the DOM is keyboard-navigable.

---

## 3. Data model (Drizzle)

```
fragrances         id, slug, name, tagline, story, palette (jsonb), bottle_image, bottle_alt,
                   cap_finish enum(silver|gunmetal|gold|chrome|black|gold_sphere), sort_order, published
notes              id, slug, name, image, alt
fragrance_notes    fragrance_id, note_id, layer enum(top|heart|base), label, position
variants           id, fragrance_id, size_ml, price_cents, currency, stock, sku
newsletter_signups id, email (unique, lowercased), source, consent, created_at
```

Placeholder prices (USD, editable in the `variants` table):

| Fragrance | 50 ml | 100 ml |
|---|---|---|
| Reva, Riven, Maree, Solea | 145 | 210 |
| Bond | 165 | 240 |
| Oudor | 185 | 265 |

---

## 4. The six worlds

| Fragrance | Cap | Mood | Palette (bg → deep → accent → ink) | One-liner (draft) |
|---|---|---|---|---|
| **Reva** | silver, ribbed | Frosted fougère | `#DCD8E8` → `#5E6B4A` → `#CFE3D8` → `#1F2420` | *Cold fruit and wild mint, laid over warm earth.* |
| **Riven** | gunmetal, ribbed | Cool greens, glassy light | `#E3EEE9` → `#1E2B24` → `#C7D95A` → `#12201A` | *A green so cold it rings like glass.* |
| **Maree** | gold, ribbed | Seaside garden at dusk | `#F1EEE6` → `#22302C` → `#9DB8AE` → `#1A2220` | *White flowers at low tide, cedar still warm from the sun.* |
| **Solea** | chrome sphere | Warm sand and cream | `#F4EAD8` → `#5A3A22` → `#E3B64B` → `#2B1D12` | *Skin, sun, and a slow vanilla afternoon.* |
| **Bond** | black sphere | Tailored iris and dark wood | `#2A2629` → `#141213` → `#B9B3C4` → `#F2EADB` | *Iris in a dark suit, with oud keeping its secrets.* |
| **Oudor** | gold sphere | Burgundy, smoke, gold | `#4A0F1A` → `#2A080E` → `#C9962E` → `#F3E6D6` | *Saffron and red rose, burning slowly into smoke and gold.* |

---

## 5. Page choreography

| Section | Pinned length | What is scrubbed |
|---|---|---|
| 1. Brand intro | 100vh | **The real ZALFI logo (SVG)**, in light ink on near-black. On load, the emblem rises out of a mask, then Z·A·L·F·I reveal letter by letter from under a baseline mask, followed by a single light glint across the letters. On scroll, the logo scales down, the letters drift apart, and it fades as the hero takes over. A minimal scroll cue sits below |
| 2. Hero bottle | ~150vh | Reva rises into the WebGL stage. The key light sweeps across the glass as it lands, the reflection and contact shadow resolve, and the cursor tilts and relights the bottle |
| 3. Chapters ×6 | ~350vh each | One pinned stage for all six. Each `<FragranceChapter>` adds its sub-timeline to a master timeline: the world shader crossfades → the name and description reveal → TOP, HEART and BASE notes arrive at 3D depth → CTA. Between chapters, notes scatter and dissolve while the old bottle exits and the next enters, with a light sweep on arrival |
| 4. Collection | none | The six bottles in an asymmetric lineup (the same shader, in a second lightweight view). Hovering lifts a bottle, catches the light and shows its notes |
| 5. Story → Newsletter → Footer | none | Editorial text reveals |

On mobile each chapter runs about 220vh, with 2 notes per layer and the Low quality tier. With `prefers-reduced-motion`, there is no pinning or canvas, and the page becomes static editorial spreads.

---

## 6. Folder structure

```
scripts/
  bake-bottle-maps.ts        normal / mask / thickness maps from each bottle cutout
  trace-logo.ts              logo.png → public/brand/zalfi-logo.svg (split into emblem + letters)
src/
  app/                       layout, page, fragrances/[slug], checkout, api/*, sitemap, robots, OG
  components/
    stage/                   Stage (canvas), BottleMaterial, WorldBackground, ReflectiveFloor,
                             Caustics, NotePlane, PostFX, quality.ts, stageState.ts
    stage/shaders/           *.glsl
    motion/                  SmoothScroll, useGsap, useReducedMotion, SplitText
    ui/                      Cursor, Grain, Button, Nav, Logo, CartDrawer, NoteImage (frame fallback)
    sections/                Intro, HeroBottle, FragranceChapters, FragranceChapter, Collection,
                             Story, Newsletter, Footer
    product/                 BottleView, NotesPyramid, VariantPicker, AddToBag
  db/                        schema.ts, client.ts, queries.ts, seed-data.ts, seed.ts
  lib/                       cart, money, palette
public/
  brand/                     zalfi-logo.svg, logo.png (original)
  images/bottles/            reva.png … oudor.png  (+ maps/)
  images/notes/              26 note images (pending)
```

---

## 7. Milestones

Each milestone ends with lint, typecheck, `next build` and `next dev`, then Playwright screenshots at 1440px and 375px plus a reduced-motion run. Then it is committed, pushed and summarised for your review.

| # | Milestone | Contents |
|---|---|---|
| **M0** ✓ | Foundation + asset pipeline | Scaffold, `CLAUDE.md`, fonts and tokens, grain, cursor, Lenis↔ScrollTrigger, reduced-motion hook, frame fallbacks. **Move and rename the bottles, trace the logo to SVG, bake the bottle lighting maps** |
| **M1** ✓ | Data layer | Drizzle schema, migrations, seed, queries, `/api/newsletter`, `/api/stock`, `.env.example` |
| **M2** ✓ | WebGL stage *(new)* | Canvas, relit bottle material, reflective floor, caustics, world background, post FX, quality tiers, fallbacks. Includes a **`/lab` page** (dev only) with a bottle picker and light sliders, so you can judge the lighting directly |
| **M3** ✓ | Logo intro + hero | SVG logo reveal and the handoff to Reva on the stage |
| **M4** ✓ | One perfect chapter (Reva) | **I'll stop for your motion feedback here** |
| **M5** ✓ | All six chapters | Master timeline, transitions, preloading, mobile and reduced-motion versions |
| **M6** ✓ | The Collection | Lit lineup, hover, keyboard support |
| **M7** ✓ | Product pages + cart | Bottle view, notes pyramid, variants, cart drawer, Stripe-ready checkout stub |
| **M8** ✓ | Story, newsletter, footer | |
| **M9** ✓ | Polish | SEO, OG images, sitemap, JSON-LD, Lighthouse, accessibility, 375px sweep |
| **M10** ✓ | Calm & butter | Still light (no rays, caustics, sweeps, pointer tilt or idle spins), static grain, gentle vertical bottle handoffs, soft scrubbed easing, Lenis lerp, transform-only cursor, intro wordmark fix |

---

## 8. Note images: status and options

1. **Recommended: you generate them** with the prompt pack in `NOTES_IMAGES_CHECKLIST.md` (one shared style block plus one line per note) in any image tool. Then upload them to the repo root or `public/images/notes/`, as you did with the bottles. I'll handle renaming, trimming and optimisation.
2. **Alternative:** allow `commons.wikimedia.org` and `upload.wikimedia.org` in this environment's network policy. I can then source openly licensed real photographs, cut them out, and record the credits in `CREDITS.md`.
3. Either way, the site shows a tasteful empty frame with the filename wherever an image is missing. It never falls back to a cartoon or stand-in.

---

## Changelog

- **M10 (2026-09-24):** the owner found the light from the top left "way too flashing", and the area under the collection bottles moving too much. They asked for everything calm and smooth.
  - **Causes:**
    - Pointer-driven light rays in the world shader.
    - Animated caustics under each bottle.
    - Reflections and tilt that followed the pointer.
    - Idle spins.
    - Jittering grain.
    - Large swoops.
  - **Fixes:**
    - The stage no longer uses time or the pointer at all, and idle frames are now pixel-identical.
    - Scroll uses a continuous Lenis glide.
    - Reveals ease with the scroll.
    - Amplitudes are roughly halved.
    - The intro's ZALFI letters had been stuck below their mask since a ScrollTrigger refresh started re-reading their SVG transform. They now rise again.

- **3D (2026-09-24):** the owner asked for Higgsfield 3D models of the bottles and notes. The pipeline is built and tested with throwaway meshes, which are not committed:
  - ingest: optimise, normalise, manifest
  - PBR stage rendering: environment, key and rim lights, tone mapping
  - scroll, hover and drag turning
  - notes anchored to the DOM choreography
  The six bottle photos are uploaded to Higgsfield (media IDs in `assets/models/higgsfield-plan.json`). Generation is blocked on two things: the Higgsfield account has 0 credits (about 500–600 needed), and the environment's network blocks Higgsfield's CloudFront CDN, so results can't be downloaded.

- **M1:** Next 16 deprecates `runtime = "edge"`. The API routes are written to be edge-portable but run on Vercel's default runtime (a one-line change pins them to the Edge). Dev uses a local Neon-protocol proxy, so one driver path runs everywhere.
- **M3–M5:** The intro uses the traced logo (masked letter rise + glint). The fragrance name is set huge in WebGL behind the bottle. Earlier note layers recede and drift upward as later ones arrive, the way top notes evaporate first.
- **Notes:** You chose option 2 (Wikimedia). The sandbox still blocks those domains, so `npm run notes:fetch` is ready (tested offline) to run once they are allowed. Empty frames show until then.
- **M0:** Bond's palette changed to a graphite background with iris-ash accents. The earlier light-ash background with light ink failed contrast. All six worlds now pass WCAG AAA for body text.
