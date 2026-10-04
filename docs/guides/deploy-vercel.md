# Put ZALFI online with Vercel

This guide puts the shop and the admin on the internet, step by step, then switches each real service on (payments, SMS, email, couriers). It's written so you can follow it without being a developer. Where you need to type a command, it's given in full.

- [What you'll need](#what-youll-need)
- [Part 1: the site online](#part-1-the-site-online) (about 30 minutes)
- [Part 2: try it on a preview site](#part-2-try-it-on-a-preview-site)
- [Part 3: going live, one service at a time](#part-3-going-live-one-service-at-a-time)
- [Part 4: the go-live checklist](#part-4-the-go-live-checklist)
- [Every environment variable](#every-environment-variable)
- [Updating the site later](#updating-the-site-later)
- [When something goes wrong](#when-something-goes-wrong)

## What you'll need

- A **GitHub** account with access to this repository.
- A **Vercel** account ([vercel.com](https://vercel.com), sign up with GitHub).
  - Use the **Pro plan** for the live shop. The site runs three background jobs, every 10 and every 30 minutes (releasing held stock, checking payments, checking parcels). Vercel's free Hobby plan only allows jobs once a day, and refuses to deploy a project that asks for more. To try the site on Hobby first, see [When something goes wrong](#when-something-goes-wrong).
- Your **domain** (e.g. `zalfi.com`), if you have one. Vercel's free `*.vercel.app` address works until then.
- The site on your computer once ([`local-setup.md`](local-setup.md)), to run three set-up commands against the online database.

## Part 1: the site online

### 1. Import the project

1. In Vercel: **Add New… → Project**, and pick the `zalfiweb` repository.
2. Vercel recognises Next.js. Leave the build settings as they are.
3. **Production branch:** in the project's **Settings → Git**, set it to the branch you want live (`claude/zalfi-backend` until it's merged into `main`).
4. Press **Deploy**. The first deploy may fail or show an empty shop. That's expected, because the database isn't there yet.

### 2. Add the database (Neon)

1. In the project: **Storage → Create Database → Neon (Serverless Postgres)**, and choose the region closest to Bangladesh (Singapore, `ap-southeast-1`).
2. Connect it to the project for **all environments**. Vercel adds `DATABASE_URL` (and a few more `PG…` variables) for you.
3. Open the database in Neon's dashboard (**Open in Neon**) and copy two connection strings for later:
   - the **pooled** one, which the site uses (it's the `DATABASE_URL` Vercel set);
   - the **direct** one (not pooled; `DATABASE_URL_UNPOOLED` in Vercel), for the set-up commands in step 5.

### 3. Add photo storage (Vercel Blob)

Product photos uploaded in the admin need somewhere to live: Vercel's disk is read-only.

**Storage → Create → Blob**, connect it to the project. Vercel adds `BLOB_READ_WRITE_TOKEN`.

### 4. Set the environment variables

In **Settings → Environment Variables**, add these for **Production** and **Preview**:

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Your address, with `https://` and no slash at the end: `https://zalfi.com`, or `https://zalfiweb.vercel.app` for now |
| `BETTER_AUTH_SECRET` | 32 or more random characters. Make one with `openssl rand -base64 32` in a terminal, or a password manager. Keep it secret, and never change it once the shop is open (it would sign everyone out and break pending checkout codes) |
| `CRON_SECRET` | Another random string, made the same way. Vercel sends it with the background jobs, and the site refuses jobs without it |

Leave the rest empty for now. Part 3 adds them service by service. [The full list](#every-environment-variable) is at the end.

Then **Deployments → the latest → ⋯ → Redeploy**, so the site picks the variables up.

### 5. Prepare the database (once, from your computer)

These three commands run on your computer, but against the online database. Use the **direct** connection string from step 2. Replace `postgres://…` with it; keep the quotes.

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
2. `db:seed` adds the six fragrances, their notes and sizes. Running it again later never overwrites what you've edited in the admin.
3. `admin` creates **your owner account**: choose *Create an admin*, enter your email and name, choose **owner**, and a strong password.

Don't run `db:seed:demo` here: the demo data is for your computer only, and it refuses to touch an online database.

### 6. Your domain

1. **Settings → Domains → Add**, then type your domain and follow Vercel's instructions for your domain registrar's DNS (an `A` record or a `CNAME`).
2. When it shows **Valid**, set `NEXT_PUBLIC_SITE_URL` to `https://your-domain` and redeploy.

### 7. Check it

- Open your address: the logo, then the six bottles.
- Open `/admin` and sign in with the owner account from step 5.
- **Settings:** fill in **Store** (name, phone, email, address) and **Invoice details** (business name, trade licence, BIN, VAT, all optional). Check the **Shipping** fees and Dhaka areas.
- **Products:** set the real prices and stock.
- **Team:** invite your managers. They get a link by email once email is set up (Part 3). Until then, copy the invitation link the Team page shows and send it yourself. Links expire after 48 hours.

At this point the site is online, but **the live shop can't take orders yet**. The test gateway and test courier never run on the live site, and real SMS isn't switched on. Part 3 does that. Meanwhile you can try everything on a preview site.

## Part 2: try it on a preview site

Every branch other than the production branch gets its own **preview** address in Vercel (Deployments → a preview → Visit). On previews, the test gateway and test courier work, so you can place an order and ship it end to end online, exactly as on your computer.

- **Online payment** goes to the test gateway.
- **The checkout code:** on a preview, the code isn't shown on the page. Find it in **Vercel → the deployment → Logs**: search for `sms:dev`. The line reads `[sms:dev] to=01… Your ZALFI code is 123456`.
- **Shipping:** send the order with the test courier, and play the courier with **Courier update**.

Previews use the same database as production unless you give them their own: in Neon, create a branch of the database for previews, and set its `DATABASE_URL` for the Preview environment only. That's recommended once the shop has real orders.

## Part 3: going live, one service at a time

Each service has a free test mode. For each one: open the account, collect the details, put them in **Vercel → Settings → Environment Variables** (Production), redeploy, then switch it on in the admin. **Settings** in the admin always shows what's configured and what isn't, and never shows the secret values.

> **Coming in the next update (phase 8):** a **Settings → Integrations** page with a switch and a **Test connection** button for every service. Until it arrives, SMS, email and photo storage stay on the built-in stand-ins even with keys added. Payment and courier switches already work. The shop is ready to take real orders once that update is in.

### Payments: SSLCommerz (cards, bKash, Nagad, Rocket)

1. **Sandbox first.** Register a test store at [developer.sslcommerz.com](https://developer.sslcommerz.com/registration/). You get a **Store ID** and a **Store Password** by email.
2. Set the variables:

   | Name | Value |
   |---|---|
   | `SSLCOMMERZ_STORE_ID` | your store ID |
   | `SSLCOMMERZ_STORE_PASSWORD` | your store password |
   | `SSLCOMMERZ_IS_LIVE` | `false` for the sandbox, `true` for real money |

3. In the SSLCommerz panel, set the **IPN URL** to `https://your-domain/api/payments/ipn/sslcommerz`. That's how SSLCommerz confirms each payment to the site.
4. Redeploy. In the admin, go to **Settings → Payments → Payment gateway** and choose **SSLCommerz**. Make sure **Online payment** is on.
5. Place a sandbox order with one of SSLCommerz's test cards. The order should show **Paid** in the admin.
6. **Going live:** apply for a live merchant account at [sslcommerz.com](https://sslcommerz.com). They'll ask for your trade licence and bank details. You get live credentials. Replace the two values, set `SSLCOMMERZ_IS_LIVE=true`, set the IPN URL in the live panel too, and redeploy.

A payment is only marked paid after the site checks it with SSLCommerz itself, never on the customer's word alone.

### Cash on delivery

No account needed. Switch it on in **Settings → Payments**. The courier collects the cash and pays you, and the admin's **Shipping** page shows what each courier owes.

### Checkout codes: BulkSMSBD

Every customer verifies their phone with a 6-digit code before ordering.

1. Open an account at [bulksmsbd.net](https://bulksmsbd.net) and add credit.
2. Ask them to approve a **sender ID** (the name the SMS comes from, e.g. `ZALFI`). Until it's approved they may give you a test one.
3. Copy your **API key**.
4. Set `BULKSMSBD_API_KEY` and `BULKSMSBD_SENDER_ID`, and redeploy.
5. Switch SMS to BulkSMSBD in **Settings → Integrations** (next update).

### The e-receipt: Resend

ZALFI sends one email: the receipt, with the invoice PDF attached, when an order is placed.

1. Open an account at [resend.com](https://resend.com).
2. **Domains → Add Domain**: your domain. Add the DNS records Resend shows at your registrar, and wait until it says **Verified**.
3. **API Keys → Create** (sending access).
4. Set the variables:

   | Name | Value |
   |---|---|
   | `RESEND_API_KEY` | the key (starts with `re_`) |
   | `EMAIL_FROM` | the sender, on your verified domain: `ZALFI <receipts@zalfi.com>` |

5. Redeploy, and switch email to Resend in **Settings → Integrations** (next update). Team invitations go out by email from then on too.

### Couriers: Pathao and Steadfast

Use one or both. The default courier is chosen in **Settings → Shipping**, and each order can go with either.

**Pathao**

1. Open a merchant account at [merchant.pathao.com](https://merchant.pathao.com) and create a **store** (your pickup address). Note its **store ID**.
2. Ask Pathao for **API access** (Merchant API). You get a **client ID** and **client secret**, for the sandbox first.
3. Set the variables:

   | Name | Value |
   |---|---|
   | `PATHAO_CLIENT_ID` / `PATHAO_CLIENT_SECRET` | from Pathao |
   | `PATHAO_USERNAME` / `PATHAO_PASSWORD` | your merchant login |
   | `PATHAO_STORE_ID` | your store's ID |
   | `PATHAO_IS_LIVE` | `false` for the sandbox, `true` for real parcels |

4. **Status updates:** in Pathao's panel, set the webhook (callback) URL to `https://your-domain/api/couriers/webhook/pathao`, with a secret you make up. Put that secret in `PATHAO_WEBHOOK_SECRET`. Pathao then shows an **integration secret**: put it in `PATHAO_WEBHOOK_INTEGRATION_SECRET`.
5. Redeploy. **Settings → Shipping → Couriers** shows Pathao as Sandbox or Live.

**Steadfast**

1. Open a merchant account at [steadfast.com.bd](https://steadfast.com.bd). In the portal, under **API**, generate the **API key** and **secret key**.
2. Set `STEADFAST_API_KEY` and `STEADFAST_SECRET_KEY`.
3. **Status updates:** in the portal's webhook settings, set the callback URL to `https://your-domain/api/couriers/webhook/steadfast` and an auth token you make up. Put the token in `STEADFAST_WEBHOOK_TOKEN`.
4. Redeploy. **Settings → Shipping → Couriers** shows Steadfast as Live. Steadfast has no separate test mode: a test parcel is a real one, so cancel it in their portal before pickup.

Without webhooks, parcels still update: the site asks each courier every 30 minutes, and **Check** on an order asks at once.

### Photo storage: Vercel Blob

Done in Part 1, step 3. Switch storage to Blob in **Settings → Integrations** (next update) before uploading product photos on the live site.

## Part 4: the go-live checklist

- [ ] The site is on the **Pro plan**, on your domain, with `NEXT_PUBLIC_SITE_URL` set to it.
- [ ] `BETTER_AUTH_SECRET` and `CRON_SECRET` are set, long and random.
- [ ] The database is migrated and seeded, and you can sign in as the owner.
- [ ] **Store** and **Invoice details** are filled in. **Shipping** fees and Dhaka areas are right.
- [ ] Real **prices and stock** are set in Products and Inventory.
- [ ] At least one way to pay works: **SSLCommerz live** (gateway set to SSLCommerz, IPN URL set), or **cash on delivery** switched on.
- [ ] **SMS** sends real codes (BulkSMSBD, switched on).
- [ ] **Email** sends the receipt (Resend, domain verified, switched on).
- [ ] At least one **courier** is live, its webhook set, and chosen as the default.
- [ ] **Blob** storage is switched on before uploading photos.
- [ ] Your **managers** are invited, and **Settings → Permissions** says what they may do (refunds, revenue figures).
- [ ] One real order end to end: pay, receive the code and the receipt, send it to the courier, see it delivered.
- [ ] The house pages say what you want (see the [storefront guide](storefront-guide.md)).

## Every environment variable

Also listed, with comments, in [`.env.example`](../../.env.example).

| Name | Needed | What it's for |
|---|---|---|
| `DATABASE_URL` | Always (set by the Neon integration) | The database: the pooled connection string |
| `NEXT_PUBLIC_SITE_URL` | Always | The site's address: links in emails, payment return pages, the sitemap |
| `BETTER_AUTH_SECRET` | Always | Signs admin sessions and checkout codes |
| `BETTER_AUTH_URL` | Rarely | The admin's address, only if it differs from the site's |
| `CRON_SECRET` | Always | Lets Vercel's background jobs in |
| `BLOB_READ_WRITE_TOKEN` | For photo uploads (set by the Blob integration) | Vercel Blob |
| `SSLCOMMERZ_STORE_ID`, `SSLCOMMERZ_STORE_PASSWORD`, `SSLCOMMERZ_IS_LIVE` | For online payment | SSLCommerz |
| `BULKSMSBD_API_KEY`, `BULKSMSBD_SENDER_ID` | For checkout codes | BulkSMSBD |
| `RESEND_API_KEY`, `EMAIL_FROM` | For receipts and invitations | Resend |
| `PATHAO_CLIENT_ID`, `PATHAO_CLIENT_SECRET`, `PATHAO_USERNAME`, `PATHAO_PASSWORD`, `PATHAO_STORE_ID`, `PATHAO_IS_LIVE` | For Pathao | Pathao Merchant API |
| `PATHAO_WEBHOOK_SECRET`, `PATHAO_WEBHOOK_INTEGRATION_SECRET` | For Pathao updates | Pathao webhook |
| `STEADFAST_API_KEY`, `STEADFAST_SECRET_KEY` | For Steadfast | Steadfast API |
| `STEADFAST_WEBHOOK_TOKEN` | For Steadfast updates | Steadfast webhook |
| `ALLOW_TEST_PROVIDERS` | Never on the live site | `true` lets the test gateway and courier run on a non-Vercel production build (a staging server) |
| `NEON_LOCAL_PROXY_PORT`, `ADMIN_OWNER_PASSWORD` | Your computer only | The local database bridge; scripted owner creation |

## Updating the site later

- **Code:** every push to the production branch deploys by itself. Pushes to other branches make previews.
- **Database changes:** when an update adds a migration (a new file in `drizzle/`), run `npm run db:migrate` against Neon as in Part 1, step 5, **before or right after** the deploy.
- **Content:** prices, stock, fragrances, photos, coupons and settings are edited in the admin and show on the shop at once, with no deploy.

## When something goes wrong

**The deploy fails with "Hobby accounts are limited to daily cron jobs"**
Upgrade to Pro, or (to try the site on Hobby) change the three schedules in `vercel.json` to once a day (`"0 3 * * *"`), and push. Unpaid orders still stop holding stock on time without the jobs; only the tidying, the missed-payment checks and the parcel checks wait longer.

**The shop is empty or shows errors**
The database isn't migrated or seeded. Run Part 1, step 5. Check `DATABASE_URL` exists for the environment (Production or Preview) you're looking at.

**"BETTER_AUTH_SECRET must be set in production"**
Add it (Part 1, step 4) and redeploy.

**I can't sign in to the admin**
The owner account is created against the online database by `npm run admin` with its `DATABASE_URL` (Part 1, step 5). An account made on your computer only exists on your computer. Reset a password the same way: `DATABASE_URL="…" npm run admin -- reset-password you@example.com`.

**Payments stay "waiting" after paying**
The IPN URL isn't set in SSLCommerz's panel, or `NEXT_PUBLIC_SITE_URL` is wrong. The site also checks open payments every 30 minutes, so they settle eventually. Fix the URL for instant confirmation.

**Courier statuses don't update**
Check the webhook URL and secret in the courier's panel match `PATHAO_WEBHOOK_SECRET` or `STEADFAST_WEBHOOK_TOKEN`. **Check** on the order asks the courier directly.

**Uploading a photo fails**
Blob storage isn't connected or switched on (Part 1, step 3, and Part 3).
