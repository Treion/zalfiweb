# Put ZALFI online with Netlify

This guide puts the shop and the admin on Netlify, step by step. It's written so you can follow it without being a developer: where you need to type a command, it's given in full. Everything the site needs on Netlify is already in the code (`netlify.toml`, photo storage in Netlify Blobs), so you only click, paste and type.

If you'd rather use Vercel, follow [`deploy-vercel.md`](deploy-vercel.md) instead. The shop works the same on both.

- [Have these ready](#have-these-ready)
- [What you'll need](#what-youll-need)
- [Part 1: the site online](#part-1-the-site-online) (about 30 minutes)
- [Part 2: the background jobs](#part-2-the-background-jobs) (10 minutes)
- [Part 3: try it on a preview](#part-3-try-it-on-a-preview)
- [Part 4: going live, one service at a time](#part-4-going-live-one-service-at-a-time)
- [Part 5: your domain](#part-5-your-domain)
- [Part 6: the go-live checklist](#part-6-the-go-live-checklist)
- [Every environment variable](#every-environment-variable)
- [Updating the site later](#updating-the-site-later)
- [When something goes wrong](#when-something-goes-wrong)

## Have these ready

| What | Where it goes | Needed for |
|---|---|---|
| `DATABASE_URL` | Netlify (from Neon, Part 1, step 1) | Everything |
| `BETTER_AUTH_SECRET` | Netlify (you make it, Part 1, step 3) | Admin sign-in, checkout codes, and sealing the keys below |
| `CRON_SECRET` | Netlify, and the cron service (Part 2) | The background jobs |
| `NEXT_PUBLIC_SITE_URL` | Netlify: your address, e.g. `https://zalfi.com` | Links in emails, payment return pages |
| `SITE_ENV` = `production` | Netlify, **Production only** | Marks the live shop: the test gateway and courier and the internal `/lab` page are switched off there |
| **One way to be paid online:** SSLCommerz **Store ID** and **Store password**, or aamarPay **Store ID** and **Signature key** | Admin → Integrations | Card, bKash and Nagad payments. Cash on delivery and bKash/Nagad by hand need no keys |
| **One SMS gateway:** BulkSMSBD, SSL Wireless, Alpha SMS or MiMSMS | Admin → Integrations → SMS | The checkout's phone code. **Without one, customers can't check out** |
| **One email service:** Resend, Brevo, Postmark or your mailbox (SMTP), plus a verified **Send from** address | Admin → Integrations → Email | The e-receipt and team invitations |
| **One courier, if you use one:** Pathao, Steadfast, RedX or CarryBee | Admin → Integrations → Couriers | Sending parcels from the admin. "Other courier" needs no keys |

**Photos uploaded in the admin need nothing:** on Netlify they are kept in Netlify Blobs automatically, with no account or key.

## What you'll need

- A **GitHub** account with access to this repository.
- A **Netlify** account ([netlify.com](https://www.netlify.com), sign up with GitHub). The free plan is enough to start. A paid plan gives longer time limits per request and lets you run the site's code in Singapore, close to the database (see [When something goes wrong](#when-something-goes-wrong)).
- A **Neon** account ([neon.tech](https://neon.tech), sign up with GitHub) for the database. The free plan is enough to start.
- A free **cron-job.org** account ([cron-job.org](https://cron-job.org)) for the three background jobs.
- Your **domain** (e.g. `zalfi.com`), if you have one. Netlify's free `*.netlify.app` address works until then.
- The site on your computer once ([`local-setup.md`](local-setup.md)), to run three set-up commands against the online database.

## Part 1: the site online

### 1. Create the database (Neon)

1. In Neon: **New Project**. Name it `zalfi`, Postgres version 16 or newer, and region **AWS Asia Pacific (Singapore)**, the closest to Bangladesh.
2. On the project's **Dashboard**, press **Connect**. You need two connection strings; copy both somewhere safe:
   - **Pooled** (the **Connection pooling** switch on). Its host contains `-pooler`. This one goes into Netlify as `DATABASE_URL`.
   - **Direct** (the switch off). This one is for the set-up commands in step 4.

   Both look like `postgresql://neondb_owner:…@ep-….ap-southeast-1.aws.neon.tech/neondb?sslmode=require`.

### 2. Import the project into Netlify

1. In Netlify: **Add new project → Import an existing project → GitHub** (older screens say **Add new site**), and pick the `zalfiweb` repository.
2. **Branch to deploy:** the branch you want live (`claude/zalfi-backend` until it's merged into `main`).
3. Leave the build settings as Netlify fills them in. They come from `netlify.toml` in the repository (build command `npm run build`, publish directory `.next`, Node 22), and Netlify recognises Next.js by itself.
4. Don't deploy yet if Netlify lets you add environment variables on this screen: add them now (next step), then press **Deploy**. If it deploys straight away, that first deploy may fail. That's expected, because the database isn't ready yet.

### 3. Set the environment variables

In Netlify: **Project configuration → Environment variables → Add a variable** (choose **Add a single variable** each time). For each, leave **Scopes** on **All scopes**.

| Key | Value | Deploy contexts |
|---|---|---|
| `DATABASE_URL` | The **pooled** connection string from step 1 | Same value for all |
| `BETTER_AUTH_SECRET` | 32 or more random characters. Make one with `openssl rand -base64 32` in a terminal, or a password manager. Keep it secret, and never change it once the shop is open (it would sign everyone out, break pending checkout codes, and make the keys saved in Integrations unreadable) | Same value for all |
| `CRON_SECRET` | Another random string, made the same way. Keep a copy: Part 2 needs it | Same value for all |
| `NEXT_PUBLIC_SITE_URL` | Your address, with `https://` and no slash at the end: `https://zalfi.com`, or `https://your-project.netlify.app` for now | **Production** only (previews work it out themselves) |
| `SITE_ENV` | `production` | **Production** only. Never set it for previews |

Payment gateways, couriers, SMS and email are set up later in the admin (Part 4), with no more variables. [The full list](#every-environment-variable) is at the end.

### 4. Prepare the database (once, from your computer)

These three commands run on your computer, but against the online database. Use the **direct** connection string from step 1. Replace `postgres://…` with it; keep the quotes.

macOS / Linux / Git Bash:

```bash
cd zalfiweb
DATABASE_URL="postgres://…neon.tech/neondb?sslmode=require" npm run db:migrate
DATABASE_URL="postgres://…neon.tech/neondb?sslmode=require" npm run db:seed
DATABASE_URL="postgres://…neon.tech/neondb?sslmode=require" npm run admin
```

Windows PowerShell:

```powershell
cd zalfiweb
$env:DATABASE_URL="postgres://…neon.tech/neondb?sslmode=require"
npm run db:migrate
npm run db:seed
npm run admin
Remove-Item Env:DATABASE_URL
```

1. `db:migrate` creates the tables.
2. `db:seed` adds the six fragrances, their notes and sizes, and the two discovery sets. Running it again later never overwrites what you've edited in the admin.
3. `admin` creates **your owner account**: choose *Create an admin*, enter your email and name, choose **owner**, and a strong password.

Don't run `db:seed:demo` here: the demo data is for your computer only, and it refuses to touch an online database.

### 5. Deploy

**Deploys → Trigger deploy → Clear cache and deploy project** (older screens: *deploy site*). The build takes a few minutes; it reads the database while it builds, which is why the database came first. When it says **Published**, press **Open production deploy**.

### 6. Check it

- Open your address: the logo, then the six bottles.
- Open `/admin` and sign in with the owner account from step 4.
- **Settings:** fill in **Store** (name, phone, email, address) and **Invoice details**. Check the **Shipping** fees and Dhaka areas.
- **Products:** set the real prices and stock, the discovery sets included.
- **Upload one photo** (any product's gallery, or a note): it should show at once. That proves photo storage works.
- **Team:** invite your managers. They get a link by email once email is set up (Part 4). Until then, copy the invitation link the Team page shows and send it yourself.

At this point the site is online, but **the live shop can't take orders yet**: the test gateway and test courier never run on the live site, and real SMS isn't switched on. Part 4 does that. First, the background jobs.

## Part 2: the background jobs

The site has three jobs that must run on a timer. On Netlify they are called by cron-job.org, a free service that visits an address on a schedule.

| Job | What it does | Address | How often |
|---|---|---|---|
| Release held stock | Frees the bottles held by unpaid online orders that ran out of time | `https://your-address/api/cron/release-reservations` | Every 10 minutes |
| Check payments | Asks the gateway about payments still open, in case both its notices were lost | `https://your-address/api/cron/payments` | Every 30 minutes |
| Check parcels | Asks each courier about parcels on the way | `https://your-address/api/cron/shipping` | Every 30 minutes |

For **each** of the three, in cron-job.org:

1. **Dashboard → Create cronjob.**
2. **Title:** e.g. `ZALFI: release held stock`. **URL:** the address from the table, with your real address (the same as `NEXT_PUBLIC_SITE_URL`).
3. **Execution schedule:** **Every 10 minutes** (or **Every 30 minutes**).
4. Open the **Advanced** tab:
   - **Request method:** `GET`.
   - **Headers → Add:** key `Authorization`, value `Bearer ` followed by your `CRON_SECRET` (the word Bearer, one space, then the secret), e.g. `Bearer 4f9c…`.
   - **Timezone:** any; the jobs don't depend on it.
5. **Create**. Then open the job and press **Test run** (or **Run now**): the response should be **200**, with a short answer like `{"expired":0,"released":0}`.
   - **401** means the header doesn't match `CRON_SECRET` exactly (check the space after Bearer, and no extra spaces at the end).
   - **404** means the address is wrong.

Turn on **Notify me when the job fails** in cron-job.org's settings, so you hear if a job stops working.

If the jobs stop for a while, nothing breaks: unpaid orders still stop holding stock on time, and **Check** on an order asks the courier or gateway at once. Only the tidying waits.

## Part 3: try it on a preview

Netlify builds a **Deploy Preview** for every pull request, and you can turn on **Branch deploys** (**Project configuration → Build & deploy → Branches and deploy contexts**) for other branches. On a preview you can place an order and ship it end to end, exactly as on your computer, with the test gateway and courier:

1. **Project configuration → Environment variables → Add a variable:** `ALLOW_TEST_PROVIDERS` = `true`, for the **Deploy Previews** and **Branch deploys** contexts only. **Never** set it for Production. (Even if you did, the live shop refuses the test providers because of `SITE_ENV`.)
2. **The checkout code:** on a preview, the code isn't shown on the page. Find it in **Logs → Functions** (pick the deploy, then the server handler): search for `sms:dev`. The line reads `[sms:dev] to=01… Your ZALFI code is 123456`.
3. **Shipping:** send the order with the test courier, and play the courier with **Courier update** on the order.

Previews use the same database as production unless you give them their own. In Neon, create a **branch** of the database for previews, and set its pooled string as `DATABASE_URL` for the **Deploy Previews** and **Branch deploys** contexts only. That's recommended once the shop has real orders.

## Part 4: going live, one service at a time

Every service is set up in the admin (**Integrations**, sidebar → Admin), exactly as on Vercel: no environment variables and no redeploys. Follow these sections of the Vercel guide, which are word for word the same on Netlify:

1. [Payments](deploy-vercel.md#payments): SSLCommerz or aamarPay, bKash and Nagad by hand, cash on delivery. The **IPN address** to paste into the gateway's panel is shown on its card, with your Netlify address.
2. [Couriers](deploy-vercel.md#couriers): Pathao, Steadfast, RedX, CarryBee, or "other courier". Each card shows the webhook address and secret to paste into the courier's panel.
3. [Checkout codes: SMS](deploy-vercel.md#checkout-codes-sms): one gateway at least, two if you can.
4. [The e-receipt: email](deploy-vercel.md#the-e-receipt-email): one service, with a verified sender.

Two differences from the Vercel guide:
- Where it says "the keys in the hosting settings", that means Netlify's environment variables.
- **Photo storage needs nothing:** skip "Photo storage: Vercel Blob". On Netlify, photos go to Netlify Blobs by themselves.

Each card has **Test connection**. Use it every time you enter or change a key.

## Part 5: your domain

1. **Domain management → Add a domain** (or **Add custom domain**), type `zalfi.com`, and confirm.
2. Netlify shows what to change at your domain's registrar. Either:
   - point the domain's **name servers** to Netlify's (simplest: Netlify then manages the DNS), or
   - keep your registrar's DNS and add the records Netlify lists (an `A` record or `ALIAS` for `zalfi.com`, and a `CNAME` for `www` to `your-project.netlify.app`).
3. Wait until Netlify shows the domain as verified, and **HTTPS** shows a certificate (it's free and automatic; it can take up to an hour after DNS changes).
4. Change `NEXT_PUBLIC_SITE_URL` (Production) to `https://zalfi.com`, then **Deploys → Trigger deploy → Deploy project**.
5. **Update every address you pasted elsewhere** to the new domain:
   - the three jobs in cron-job.org (Part 2);
   - the IPN address in your payment gateway's panel;
   - the webhook addresses in your couriers' panels.

   The cards in **Integrations** show the new addresses.

## Part 6: the go-live checklist

- [ ] The site is on your domain, with HTTPS, and `NEXT_PUBLIC_SITE_URL` set to it.
- [ ] `BETTER_AUTH_SECRET` and `CRON_SECRET` are set, long and random. `SITE_ENV=production` is set for **Production only**.
- [ ] The database is migrated and seeded, and you can sign in as the owner.
- [ ] The **three cron jobs** run green on cron-job.org (a 200 on each), with failure emails on.
- [ ] An **uploaded photo** shows on the shop.
- [ ] **Store** and **Invoice details** are filled in. **Shipping** fees and Dhaka areas are right.
- [ ] Real **prices and stock** are set in Products and Inventory, discovery sets included.
- [ ] At least one way to pay works: **SSLCommerz** or **aamarPay** live (tested, switched on, IPN address set), or **cash on delivery**, or **bKash and Nagad by hand**.
- [ ] **SMS** sends real codes (one gateway tested and on, a second as backup if you can).
- [ ] **Email** sends the receipt (sender verified, tested, on).
- [ ] At least one **courier** is live, tested, its webhook set, and chosen as the default.
- [ ] **Integrations** shows no card as **Needs attention**.
- [ ] Your **managers** are invited, and **Settings → Permissions** says what they may do.
- [ ] One real order end to end: pay, receive the code and the receipt, send it to the courier, see it delivered.
- [ ] `/lab` shows "not found" on the live address (that proves `SITE_ENV` is right).

## Every environment variable

Also listed, with comments, in [`.env.example`](../../.env.example).

| Name | Needed | What it's for |
|---|---|---|
| `DATABASE_URL` | Always | The database: Neon's **pooled** connection string |
| `NEXT_PUBLIC_SITE_URL` | Always (Production) | The site's address: links in emails, payment return pages, the sitemap |
| `BETTER_AUTH_SECRET` | Always | Signs admin sessions and checkout codes |
| `CRON_SECRET` | Always | Lets the background jobs in (the same value goes into cron-job.org) |
| `SITE_ENV` | Production only: `production` | Marks the live shop. Test providers and `/lab` are off there |
| `ALLOW_TEST_PROVIDERS` | Previews only, if you want test orders | `true` lets the test gateway and courier run |
| `BETTER_AUTH_URL` | Rarely | The admin's address, only if it differs from the site's |
| `CREDENTIALS_KEY` | Optional | Encrypts the keys saved in Integrations. Without it, a key derived from `BETTER_AUTH_SECRET` is used |
| `UPLOAD_STORAGE` | No | `netlify` forces Netlify Blobs; normally detected by itself |
| `BLOB_READ_WRITE_TOKEN` | No | Only to keep photos in Vercel Blob instead. If it's set, it wins over Netlify Blobs |
| Provider variables (`SSLCOMMERZ_*`, `PATHAO_*`, …) | No | Fallbacks for sites set up before the Integrations page. Use the admin instead |

Netlify sets `NETLIFY`, `CONTEXT` and its own Blobs details itself. Don't add them.

## Updating the site later

- **Code:** every push to the production branch builds and publishes by itself. Pull requests get Deploy Previews.
- **Database changes:** when an update adds a migration (a new file in `drizzle/`), run `npm run db:migrate` against Neon as in Part 1, step 4, **before or right after** the deploy.
- **Content:** prices, stock, fragrances, discovery sets, photos, coupons and settings are edited in the admin and show on the shop at once, with no deploy.
- **A bad deploy:** **Deploys**, pick the last good one, then **Publish deploy**. It's live again in seconds. (A database migration isn't undone by this.)

## When something goes wrong

**The build fails**
Open **Deploys → the failed deploy** and read the log from the bottom up:
- "Node version" errors: `netlify.toml` asks for Node 22. Check no `NODE_VERSION` variable in the Netlify UI overrides it with an older one.
- Errors reading the database while building (`ECONNREFUSED`, "password authentication failed"): `DATABASE_URL` is missing for the context being built, or it was copied with a typo. The build reads the catalogue, so it needs the database.

**The shop is empty or shows errors**
The database isn't migrated or seeded. Run Part 1, step 4. Check `DATABASE_URL` exists for the context (Production, Deploy Previews) you're looking at.

**"BETTER_AUTH_SECRET must be set in production"**
Add it (Part 1, step 3) and deploy again.

**I can't sign in to the admin**
The owner account is created against the online database by `npm run admin` with its `DATABASE_URL` (Part 1, step 4). An account made on your computer only exists on your computer. Reset a password the same way: `DATABASE_URL="…" npm run admin -- reset-password you@example.com`.

**Pages are slow**
By default Netlify runs the site's code in the United States, while the database is in Singapore, so every page waits for the round trip. If your plan offers it, set **Project configuration → Build & deploy → Functions → Functions region** to **Singapore (ap-southeast-1)**, then deploy again. The shop's pages are also cached and rebuilt in the background, so most visitors don't wait.

**"Function timed out", or "Task timed out"**
Netlify gives each request a time limit, which depends on your plan. Uploading a new **bottle photo** is the slowest thing the site does: it bakes the lighting maps. If it times out, try a smaller photo (2000 × 2000 px, under 4 MB), or move to a plan with a longer limit. Everything else is quick.

**Uploading a photo fails**
Files over 4 MB are refused; make it smaller. Bottle photos and set boxes must be transparent PNG or WebP. **Logs → Functions** shows the error the upload hit.

**A cron job shows 401 or 404**
See [Part 2](#part-2-the-background-jobs): 401 is the `Authorization` header, 404 the address.

**An edit in the admin doesn't show on the shop**
Reload once. The admin refreshes the shop's pages after each edit; Netlify clears its cache for them within seconds. If an old page persists, **Deploys → Trigger deploy → Clear cache and deploy project**.

**A card in Integrations says "Needs attention", payments stay "waiting", or courier statuses don't update**
The same as on Vercel: see [When something goes wrong](deploy-vercel.md#when-something-goes-wrong) in the Vercel guide. The fixes are in the admin and in the providers' panels, not in the hosting.
