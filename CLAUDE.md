@AGENTS.md

# ZALFI: project rules

ZALFI is a niche perfume house. This site must feel like an Awwwards Site of the Day, not a template.
Audience: 18–30. Goal: make them fall in love with the brand and buy. Every scroll is a reveal.
The build plan lives in `PLAN.md`, and the note photo list and prompts in `NOTES_IMAGES_CHECKLIST.md`.

## Stack (do not swap)

- Next.js 16 App Router, React Server Components, TypeScript strict. **Next 16 differs from older versions.** Read `node_modules/next/dist/docs/` before using an API you are unsure of (for example, `next/image` uses `preload`, not the deprecated `priority`, and `images.qualities` must allowlist every quality used).
- Tailwind CSS v4. Tokens are in `src/app/globals.css` (`@theme`).
- Vercel edge route handlers (`export const runtime = "edge"`) for `/api/*`.
- PostgreSQL + Drizzle ORM. Neon HTTP driver in production, local Postgres 16 in dev. `src/db/seed-data.ts` is the typed catalogue source and the fallback when `DATABASE_URL` is missing.
- GSAP + ScrollTrigger for scroll-scrubbed sequences. **Import from `@/components/motion/gsap`**, never from `gsap` directly.
- Motion (`motion/react`) for UI interactions: hover, buttons, menus, drawer, modals, cursor.
- Lenis smooth scroll, driven by `gsap.ticker` (`src/components/motion/SmoothScroll.tsx`).
- three.js + React Three Fiber + custom GLSL for the WebGL stage (bottle relighting, reflections, caustics).

## Brand assets

- **Logo:** `public/brand/logo.png` is the owner's artwork. `npm run assets:logo` traces it into `public/brand/zalfi-logo.svg` and `src/components/brand/logo-paths.ts`. **The name ZALFI is always rendered with `<Logo />`, never typeset in any font.** Parts are addressable (`data-logo-part="cap|body|z|a|l|f|i"`) for animation.
- **Bottles:** `public/images/bottles/{reva,riven,maree,solea,bond,oudor}.png` are the owner's real product shots (2000×2000 transparent). They are the hero of the site.
  - Never crop, distort, recolour or retouch them. Always `object-contain`, quality 90.
  - All six are black smoked-glass cubes and differ only by cap (silver ribbed, gunmetal ribbed, gold ribbed, chrome sphere, black sphere, gold sphere). On dark worlds they need rim or back light to read.
  - `npm run assets:bottles` bakes `maps/{slug}-{color,normal,mask}.webp` and `src/components/stage/bottle-meta.ts` for the WebGL relighting. Re-run it if a bottle photo changes. Never edit generated files by hand.
- **Note images:** `public/images/notes/{slug}.png`. They must be photorealistic: real photos, or owner-approved AI images that are indistinguishable from studio photography. If one is missing, render `<AssetFrame>` (hairline frame + filename), **never** a cartoon, icon or placeholder art. Check availability on the server with `src/lib/assets.ts`.

## Design direction: NOT generic AI design

**Never:** purple-blue gradients, glassmorphism cards, rounded "SaaS" card grids, stock icon sets, centred-everything layouts, emoji, Inter-only typography, drop-shadowed cards, "Elevate your senses" copy.

**Always:**
- Editorial, fashion-magazine composition: asymmetric 12-column layouts, oversized type as a design element, intentional negative space, and text that overlaps imagery.
- Type:
  - **Bodoni Moda** (`font-display`, `display-italic`) for fragrance names and headlines.
  - **Hanken Grotesk** (`font-sans`) for body text.
  - Sizes: `text-mega`, `text-display`, `text-headline`.
  - `eyebrow` for small uppercase tracked labels.
- Film grain overlay (`<Grain />`) stays on every page.
- Custom cursor (`<Cursor />`). Mark interactive elements with `data-cursor="Discover"` to show a word in the cursor. It is disabled on touch devices and with reduced motion.
- Hairlines (`border-current/20`) over boxes. Square corners. No rounded cards.
- Copy: short, sensual, confident, like a niche perfume house. Sentences under 15 words. Sensory nouns over adjectives.

## Fragrance worlds

Each fragrance has a palette (`bg`, `deep`, `accent`, `ink`) in `seed-data.ts` / the DB. Components read the CSS variables `--world-bg|deep|accent|ink` (Tailwind: `bg-world-bg`, `text-world-ink`, …), set on a wrapper. **Never hard-code a world colour inside a component.** `ink` on `bg` must pass WCAG AA (all six currently pass AAA).

| Fragrance | World |
|---|---|
| Reva | Frosted fougère: lavender haze, moss, frost mint |
| Riven | Cool greens, glassy light, lime |
| Maree | Seaside garden at dusk: ivory, sea glass, cedar |
| Solea | Warm sand and cream, vanilla, pineapple gold |
| Bond | Tailored: graphite, iris ash, dark wood |
| Oudor | Deep burgundy, smoke, saffron gold |

## Animation rules

- Scroll sequences are **scrubbed** to scroll position (`scrub: true` or a small number), not just triggered.
- Animate **only `transform` and `opacity`** in the DOM. Never animate `filter`, `width`, `top` or colours on large layers. World colour changes happen in the WebGL shader (via uniforms) or by crossfading stacked layers' opacity.
- Easing is cinematic (`EASE` in `motion/gsap.ts`: expo.out, power2.inOut). **No bounce, no elastic, no overshoot springs** on content.
- Always clean up: use `useGSAP` with a scope ref.
- `prefers-reduced-motion`: no pinning, no scrub, no canvas, no Lenis, no cursor. Show a complete static editorial layout (`useReducedMotion()` returns `true` on the server, so SSR output is the static version).
- Mobile (<768px, test at 375px): shorter pins, fewer floating notes (2 per layer), Low WebGL tier, no cursor or tilt effects.
- 60fps target. Pause WebGL when the tab is hidden or the stage is off-screen.

## WebGL stage rules

- There is one persistent fixed `<Stage />` canvas. GSAP writes to a mutable `stageState` object, and the render loop reads it. **Do not drive per-frame values through React state.**
- The bottle is the real photo, relit in GLSL with the baked normal and mask maps: GGX key light, palette-tinted environment reflection, Fresnel rim, metal-cap highlights, reflective floor, caustics.
- Load three.js after first paint (`next/dynamic`). The LCP element is the DOM `next/image` hero bottle, and the canvas crossfades in over it.
- Quality tiers: high / medium / low, chosen by device and frame time. Fallback when there is no WebGL or reduced motion is on: static `next/image` layout.
- The canvas is `aria-hidden`. Every visual element has a DOM equivalent with alt text.

## Performance, SEO, accessibility

- `next/image` everywhere with accurate `sizes`. Only the hero bottle gets `preload`. Preload the next chapter's images.
- Lighthouse desktop 85+, CLS about 0 (reserve space with aspect ratios).
- `generateMetadata` per page, OG images from bottle photos, `sitemap.ts`, `robots.ts`, JSON-LD Product.
- Alt text on every image, logical heading order, visible focus rings, keyboard parity for every hover interaction, `SkipLink` first in the body.

## Code conventions

- Folders:
  - `src/components/{motion,ui,media,brand,sections,stage,product}`
  - `src/db` (schema, client, queries, seed)
  - `src/lib` (domain types, helpers)
  - `scripts/` (asset pipeline)
- Chapters are data-driven: one `<FragranceChapter fragrance={...} />`, no duplicated sections.
- Server components by default. Add `"use client"` only for interactivity and animation.
- `/lab` is the internal review page, hidden when `VERCEL_ENV === "production"`.

## Workflow

- Work one milestone at a time (see `PLAN.md`). After each one:
  1. Run `npm run check` (lint + typecheck + build).
  2. Run the dev server and take Playwright screenshots at 1440px and 375px, plus one with reduced motion.
  3. Commit and push to the working branch.
  4. Summarise for review.
- Playwright uses the preinstalled Chromium (`/opt/pw-browsers`). Do not run `playwright install`.
