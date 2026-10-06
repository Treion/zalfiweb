# ZALFI

The website and back office of ZALFI, a niche perfume house in Bangladesh.

- **The shop** (`/`): a scroll-driven home page where six real bottle photographs are relit live in WebGL, one "world" per fragrance; product pages; a scent finder; house pages; a guest checkout with phone verification, cash on delivery or online payment (SSLCommerz).
- **The admin** (`/admin`): orders, payments and refunds, shipping with Pathao or Steadfast, products and stock, coupons, customers, reports, settings and the team, in light and dark.

Everything runs on your computer without any paid account: a built-in **test gateway**, **test courier**, and local stand-ins for SMS and email let you place an order, pay, ship and deliver it end to end. Real providers (SSLCommerz, aamarPay; Pathao, Steadfast, RedX, CarryBee; BulkSMSBD, SSL Wireless, Alpha SMS, MiMSMS; Resend, Brevo, Postmark or your own mailbox over SMTP) are set up, tested and switched on in **Admin → Integrations**, with no code or redeploy. When they're down, bKash or Nagad paid by hand and "other courier" keep the shop running.

| I want to… | Read |
|---|---|
| Run it on my computer | [Run it locally](#run-it-locally), then [`docs/guides/local-setup.md`](docs/guides/local-setup.md) |
| Put it online | [Put it on Vercel](#put-it-on-vercel) ([`deploy-vercel.md`](docs/guides/deploy-vercel.md)), or [on Netlify](#or-put-it-on-netlify) ([`deploy-netlify.md`](docs/guides/deploy-netlify.md)) |
| Use the admin day to day | [`docs/guides/admin-guide.md`](docs/guides/admin-guide.md) |
| Change the shop (copy, photos, fragrances) | [`docs/guides/storefront-guide.md`](docs/guides/storefront-guide.md) |
| Find my way around the code | [`docs/reference/architecture.md`](docs/reference/architecture.md) |
| See why something was built a certain way | [`docs/reference/decisions.md`](docs/reference/decisions.md) |

---

## Run it locally

You need **Node.js 22 or newer** and **PostgreSQL 16**. The full guide, with install steps for macOS, Windows and Linux and fixes for common problems, is [`docs/guides/local-setup.md`](docs/guides/local-setup.md). On **Windows**, starting from nothing, follow [`docs/guides/windows-setup.md`](docs/guides/windows-setup.md): every click and command, from installing Git to the running shop.

```bash
git clone -b claude/zalfi-backend https://github.com/Treion/zalfiweb.git   # the branch with the backend
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
7. **Go live** in **Admin → Integrations**: enter the keys for a gateway (SSLCommerz or aamarPay), SMS (BulkSMSBD, SSL Wireless, Alpha SMS or MiMSMS), email (Resend, Brevo, Postmark or your mailbox) and a courier (Pathao, Steadfast, RedX or CarryBee), test each and switch it on, as the guide explains.

On a **preview** deployment (any branch except production) the test gateway and test courier work, so you can try the whole flow online. On **production** they never run.

### Or put it on Netlify

The step-by-step guide is [`docs/guides/deploy-netlify.md`](docs/guides/deploy-netlify.md). In short:

1. **Create a Neon database** (Singapore) at neon.tech.
2. **Import** this repository in Netlify. `netlify.toml` sets the build.
3. **Set the environment variables** `DATABASE_URL`, `BETTER_AUTH_SECRET`, `CRON_SECRET`, `NEXT_PUBLIC_SITE_URL`, and `SITE_ENV=production` for Production only.
4. **Prepare the database** from your computer, as for Vercel, then deploy.
5. **Schedule the three background jobs** on cron-job.org, with the `CRON_SECRET` header.
6. **Go live** in **Admin → Integrations**, the same as on Vercel. Uploaded photos go to Netlify Blobs by themselves.

## Using the website

**The shop**

| Page | What it is |
|---|---|
| `/` | Lands on the ZALFI logo. Scroll and the six bottles rise into a line-up (hover one to fill the room with its world), then each fragrance gets its own chapter: name, tagline, notes, Add to bag. The chapter index on the right jumps between them. |
| `/fragrances` | All fragrances on one page, with filters (when to wear it, season, note) and one-tap Add. |
| `/fragrances/[name]` | Each fragrance: the bottle (drag to turn it where a 3D model exists), price, live stock, Add to bag (or Notify me when sold out), delivery fees and times, ways to pay, scent profile, notes, approved reviews, and two similar worlds. |
| `/find` | Find your world: three questions, and the answer lit on the stage. |
| `/discovery` | The discovery sets: three fragrances in 3 ml vials, one box each, with what's inside and Add the set. Also a spread on the home page after the story. |
| `/checkout` | Guest checkout: contact, phone code, delivery address, an optional free gift note, payment. Then the order's own page: its status, tracking, and (once delivered) Review your fragrances. |
| `/track` | Track your order: the order number and phone open the order's page. |
| `/about`, `/faq`, `/contact`, `/refunds`, `/payment-policy`, `/privacy`, `/terms` | The house pages, under **Info** in the top bar (**Menu** on a phone, with the shop links). |

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
| Products, Notes, Inventory | Fragrances, discovery sets, notes, prices, photos, stock and its history, and who waits for a back-in-stock text |
| Reviews | Read buyers' reviews, approve them for the shop, reply |
| Reports | Sales, fragrances, sizes, stock value, coupons, zones, refunds, with CSV |
| Settings, Team, Activity log | Store details, fees and delivery times, payment methods, reviews; managers; who did what |

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
| `npm test` / `npm run test:db` / `npm run test:e2e` | Unit tests / database tests (need PostgreSQL) / browser tests (Playwright, test providers) |
| `npm run stock:check` | Proves every bottle's stock matches its history |
| `npm run assets:logo` / `assets:bottles` | Rebuilds the logo and the bottle lighting maps from the photos |
| `npm run notes:ingest -- <folder>` | Brings in note photos you supply (transparent PNG or WebP, any file names) |
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
