# ZALFI

The website and back office of ZALFI, a niche perfume house in Bangladesh.

- **The shop** (`/`): a scroll-driven home page where six real bottle photographs are relit live in WebGL, one "world" per fragrance; product pages; a scent finder; house pages; a guest checkout with phone verification, cash on delivery or online payment (SSLCommerz).
- **The admin** (`/admin`): orders, payments and refunds, shipping with Pathao or Steadfast, products and stock, coupons, customers, reports, settings and the team, in light and dark.

Everything runs on your computer without any paid account: a built-in **test gateway**, **test courier**, and local stand-ins for SMS and email let you place an order, pay, ship and deliver it end to end. Real providers switch on when their keys are added.

| I want to… | Read |
|---|---|
| Run it on my computer | [Run it locally](#run-it-locally), then [`docs/guides/local-setup.md`](docs/guides/local-setup.md) |
| Put it online | [Put it on Vercel](#put-it-on-vercel), then [`docs/guides/deploy-vercel.md`](docs/guides/deploy-vercel.md) |
| Use the admin day to day | [`docs/guides/admin-guide.md`](docs/guides/admin-guide.md) |
| Change the shop (copy, photos, fragrances) | [`docs/guides/storefront-guide.md`](docs/guides/storefront-guide.md) |
| Find my way around the code | [`docs/reference/architecture.md`](docs/reference/architecture.md) |
| See why something was built a certain way | [`docs/reference/decisions.md`](docs/reference/decisions.md) |

---

## Run it locally

You need **Node.js 22 or newer** and **PostgreSQL 16**. The full guide, with install steps for macOS, Windows and Linux and fixes for common problems, is [`docs/guides/local-setup.md`](docs/guides/local-setup.md).

```bash
git clone https://github.com/Treion/zalfiweb.git
cd zalfiweb
npm install

cp .env.example .env            # the defaults work on your computer
createdb zalfi                  # an empty database called "zalfi"

npm run db:migrate              # create the tables
npm run db:seed                 # the six fragrances, their notes and sizes
npm run db:seed:demo            # optional: 90 days of demo orders, customers and coupons
npm run admin                   # create your admin account (answer the questions)

npm run dev                     # the shop: http://localhost:3000   the admin: http://localhost:3000/admin
```

`npm run dev` checks that PostgreSQL is running and starts everything else it needs. Stop it with `Ctrl+C`.

**Try an order:** add a bottle to the bag, press **Checkout**, fill in your details and press **Send code**. The code appears under the field (and in the terminal). Choose **Pay online** to see the test gateway, then open the order in the admin and send it with the test courier. Cash on delivery is off until you switch it on in **Admin → Settings → Payments**.

## Put it on Vercel

The step-by-step guide, including every key you will need to go live, is [`docs/guides/deploy-vercel.md`](docs/guides/deploy-vercel.md). In short:

1. **Import** this GitHub repository in Vercel (Add New → Project).
2. **Add a database:** Storage → Create → Neon Postgres, connected to the project. It sets `DATABASE_URL`.
3. **Add Blob storage** (Storage → Create → Blob) for product photos. It sets `BLOB_READ_WRITE_TOKEN`.
4. **Set the environment variables** `NEXT_PUBLIC_SITE_URL`, `BETTER_AUTH_SECRET` and `CRON_SECRET` (Settings → Environment Variables).
5. **Deploy**, then, once, from your computer against the Neon database: `npm run db:migrate`, `npm run db:seed`, `npm run admin`.
6. **Sign in** at `https://your-domain/admin`, and work through Settings.
7. **Go live** by adding the keys for SSLCommerz, BulkSMSBD, Resend, and Pathao or Steadfast, as the guide explains.

On a **preview** deployment (any branch except production) the test gateway and test courier work, so you can try the whole flow online. On **production** they never run.

## Using the website

**The shop**

| Page | What it is |
|---|---|
| `/` | Lands on the ZALFI logo. Scroll and the six bottles rise into a line-up (hover one to fill the room with its world), then each fragrance gets its own chapter: name, tagline, notes, Add to bag. The chapter index on the right jumps between them. |
| `/fragrances/[name]` | Each fragrance: the bottle (drag to turn it where a 3D model exists), price, live stock, scent profile, notes, Add to bag. |
| `/find` | Find your world: three questions, and the answer lit on the stage. |
| `/checkout` | Guest checkout: contact, phone code, delivery address, payment. Then the confirmation page with the order number. |
| `/about`, `/faq`, `/contact`, `/refunds`, `/payment-policy`, `/privacy`, `/terms` | The house pages, under **Info** in the top bar. |

Visitors who prefer reduced motion, and devices without a graphics card, get a calm static version of the same pages.

**The admin** (`/admin`): the full walkthrough is [`docs/guides/admin-guide.md`](docs/guides/admin-guide.md).

| Section | What you do there |
|---|---|
| Overview | Today so far, the period you choose, charts, and what needs attention |
| Orders | Pack, send to a courier, print labels, cancel, refund, mark returned, invoices |
| Customers | Everyone who ordered, with their orders, spend and addresses |
| Payments | Every online payment and refund |
| Shipping | Parcels by courier, failed deliveries, returns, cash each courier owes you |
| Coupons | Discount codes and how they perform |
| Products, Inventory | Fragrances, prices, photos, stock and its history |
| Reports | Sales, fragrances, sizes, stock value, coupons, zones, refunds, with CSV |
| Settings, Team, Activity log | Store details, fees, payment methods; managers; who did what |

Search everything from the top bar (or press `/`).

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Starts the site at http://localhost:3000 (and the local database bridge) |
| `npm run admin` | Admin accounts: create (owner or manager), list, reset a password, switch off |
| `npm run db:migrate` | Applies database changes (run after every pull that adds a migration) |
| `npm run db:seed` | Adds the six fragrances. Never overwrites your edits (`-- --reset` does) |
| `npm run db:seed:demo` | Demo orders, customers and coupons (`-- --clear` removes them). Local only |
| `npm run check` | Lint, typecheck, unit tests and a production build: run before you push |
| `npm test` / `npm run test:db` | Unit tests / database tests (need PostgreSQL) |
| `npm run stock:check` | Proves every bottle's stock matches its history |
| `npm run assets:logo` / `assets:bottles` | Rebuilds the logo and the bottle lighting maps from the photos |
| `npm run notes:fetch` | Fetches openly licensed note photographs (see the storefront guide) |
| `npm run format` | Formats every file (Prettier) |

## How the repository is organised

```
src/
  app/(site)/          the shop's pages            app/(admin)/admin/   the admin's pages
  app/api/             checkout, payments, couriers, cron jobs, admin downloads
  components/          the shop's components (sections, stage = WebGL, cart, …) and admin/
  server/              everything behind the pages: orders, payments, shipping, reports, auth…
  db/                  the database schema, the catalogue and the seed scripts
  content/             the house pages' copy        lib/   small shared helpers
public/                images: logo, bottle photos and their maps, note photos
assets/                source files: fonts for PDFs, 3D models
scripts/               db/ (local database bridge, stock check), assets/ (logo, bottles, notes, models), admin.ts
drizzle/               database migrations          tests/   unit/ and db/
docs/                  guides/, reference/, content/  (see docs/README.md)
```

`CLAUDE.md` holds the project's design and engineering rules (read by the AI assistant that builds the site, and useful for anyone changing it). `AGENTS.md` is written by Next.js.

## Built with

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · PostgreSQL (Neon) with Drizzle · GSAP, Lenis and Motion · three.js with React Three Fiber · Better Auth · shadcn/ui, TanStack Table and Recharts for the admin · React Email and React PDF · Vitest and Playwright.
