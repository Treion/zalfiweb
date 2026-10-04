# ZALFI documentation

Start with the [README](../README.md) at the top of the repository. Everything else is here.

## Guides: how to do things

| Guide | For |
|---|---|
| [`guides/local-setup.md`](guides/local-setup.md) | Running the shop and the admin on your computer, step by step, with fixes for common problems |
| [`guides/deploy-vercel.md`](guides/deploy-vercel.md) | Putting the site online with Vercel and Neon, then switching each real service on (SSLCommerz, SMS, email, couriers), and the go-live checklist |
| [`guides/admin-guide.md`](guides/admin-guide.md) | Running the shop from `/admin`: orders from start to finish, returns, refunds, products, stock, coupons, reports, settings, the team |
| [`guides/storefront-guide.md`](guides/storefront-guide.md) | What customers see and how they buy, and where to change copy, photos and fragrances |

## Reference: how it's built, and why

| File | What it is |
|---|---|
| [`reference/architecture.md`](reference/architecture.md) | A map of the code: folders, how an order moves through it, providers, tests |
| [`reference/decisions.md`](reference/decisions.md) | Every judgement call made while building, numbered, with the reason |
| [`reference/backend-spec.md`](reference/backend-spec.md) | The owner's specification for the backend and admin (kept as written) |
| [`reference/backend-plan.md`](reference/backend-plan.md) | The backend's discovery notes and phase-by-phase plan, with progress |
| [`reference/storefront-plan.md`](reference/storefront-plan.md) | The original build plan for the shop and its WebGL stage |

The backend spec names its documents by their working titles. `SETUP` is now `guides/local-setup.md`, `GO_LIVE` is `guides/deploy-vercel.md`, `ADMIN_GUIDE` is `guides/admin-guide.md`, and `DECISIONS` is `reference/decisions.md`.

## Content: source material

| File | What it is |
|---|---|
| [`content/policies-original.md`](content/policies-original.md) | The owner's original house-page text. The site's pages (`src/content/pages.ts`) are a shorter rewrite of it with the same facts |
| [`content/note-images.md`](content/note-images.md) | Every note that needs a photograph, with sourcing notes and prompts |

Next to the code: [`assets/fonts/README.md`](../assets/fonts/README.md) (the PDF fonts) and [`assets/models/README.md`](../assets/models/README.md) (3D models). [`CLAUDE.md`](../CLAUDE.md) holds the design and engineering rules.
