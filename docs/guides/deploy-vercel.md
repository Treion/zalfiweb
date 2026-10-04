# Put ZALFI online with Vercel

This guide puts the shop and the admin on the internet, step by step, then switches each real service on (payments, SMS, email, couriers) from the admin's Integrations page. It's written so you can follow it without being a developer. Where you need to type a command, it's given in full.

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
| `BETTER_AUTH_SECRET` | 32 or more random characters. Make one with `openssl rand -base64 32` in a terminal, or a password manager. Keep it secret, and never change it once the shop is open (it would sign everyone out, break pending checkout codes, and make the keys saved in Integrations unreadable) |
| `CRON_SECRET` | Another random string, made the same way. Vercel sends it with the background jobs, and the site refuses jobs without it |

That's all. Payment gateways, couriers, SMS and email are set up later in the admin (Part 3), with no more variables. [The full list](#every-environment-variable) is at the end.

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

Every service is set up in the admin, in **Integrations** (sidebar → Admin). No environment variables and no redeploys are needed. Each service has a card with:
- its status (**Not set up**, **Sandbox**, **Live**, **Off**, or **Needs attention** when it's failing);
- an **On/Off** switch;
- **Set up**: sandbox or live, the keys (each with where to find it in that provider's panel), **Test connection**, and the exact address and secret to paste into the provider's panel.

Keys are stored encrypted and never shown again, only their last four characters. If someone changes a key in the provider's panel, the next real call fails. The card then shows **Needs attention**, the **Overview** lists it, and you replace the key in **Set up**.

Keys you already put in Vercel's environment variables keep working: the card says "Using the keys in the hosting settings", and **Move them into the admin** copies them in.

### Payments

**SSLCommerz** (cards, bKash, Nagad, Rocket, internet banking)
1. **Sandbox first.** Register a test store at [developer.sslcommerz.com](https://developer.sslcommerz.com/registration/). The **Store ID** and **Store password** arrive by email.
2. In **Integrations → SSLCommerz → Set up**: choose **Sandbox**, enter both, **Save**, then **Test connection**. It opens a payment page and leaves it: no money moves.
3. Copy the **IPN address** shown (`https://your-domain/api/payments/ipn/sslcommerz`) into the SSLCommerz panel (My Stores → IPN Settings).
4. Switch it **On**. Place a sandbox order with an SSLCommerz test card: it should show **Paid** in the admin.
5. **Live:** apply at [sslcommerz.com](https://sslcommerz.com) (trade licence and bank details). Enter the live Store ID and password, choose **Live**, test, and set the IPN address in the live panel too.

**aamarPay** (cards, bKash, Nagad, Rocket, Upay)
1. In **Integrations → aamarPay → Set up**: choose **Sandbox** and press **Fill in aamarPay's public sandbox account** (store `aamarpaytest`), or enter your own. **Save**, **Test connection**, switch it **On**.
2. **Live:** with your merchant account from [aamarpay.com](https://aamarpay.com), enter the live Store ID and Signature key, and choose **Live**.
3. Optional: ask aamarPay to set the shown IPN address. Payments are confirmed either way: the site checks each one with aamarPay before marking it paid.
4. aamarPay has no refund API. Refunds are made in the aamarPay merchant panel, then recorded on the order.

**Both on:** **Checkout tries first** (top of Payments) picks which one checkout uses. If it can't open a payment page, the other takes over by itself, and the order's timeline says so. Customers always see a single **Pay online**.

**bKash and Nagad by hand:** the fallback that needs no account. Switch it on in the **bKash and Nagad (by hand)** card and enter your numbers. See the [admin guide](admin-guide.md#bkash-and-nagad-paid-by-hand).

**Cash on delivery:** no account needed. Switch it on in **Settings → Payments**. The courier collects the cash, and the **Shipping** page shows what each courier owes.

A payment is only marked paid after the site checks it with the gateway itself, never on the customer's word alone.

### Couriers

Use any. The default is chosen in **Settings → Shipping**, and each order can go with any courier that's on. A courier switched off keeps updating the parcels it already has.

**Pathao**
1. Open a merchant account at [merchant.pathao.com](https://merchant.pathao.com) and create a store (your pickup address). Under **Developer's API**, get the **Client ID** and **Client secret**.
2. In **Integrations → Pathao → Set up**: choose **Sandbox** (or **Fill in Pathao's public sandbox account**). Enter the Client ID, Client secret, and your Pathao login email and password. **Save**, then **Test connection**, and choose your **pickup store** from the list it shows.
3. **Updates:** in Pathao's panel → Developer's API → Webhook, paste the **address** and **webhook secret** shown on the card, and tick the order events. Pathao then shows an **integration secret**: paste it into its field on the card and save.
4. Switch it **On**. For live, enter your live keys and choose **Live**.

**Steadfast**
1. In the Steadfast portal ([portal.packzy.com](https://portal.packzy.com)) → API, generate the **API key** and **Secret key**.
2. In **Integrations → Steadfast → Set up**: enter both, **Save**, **Test connection** (it reads your balance).
3. **Updates:** in the portal's webhook settings, paste the **address** and **auth token** shown.
4. Switch it **On**. Steadfast has no sandbox: a test parcel is real, so cancel it in their portal before pickup.

**RedX**
1. In the RedX merchant panel ([redx.com.bd](https://redx.com.bd)) → Developer API, generate an **API access token**. A sandbox token comes from RedX support.
2. In **Integrations → RedX → Set up**: choose Sandbox or Live, enter the token, **Save**, **Test connection**, and choose your **pickup store**.
3. **Updates:** give RedX the whole **address** shown (it carries a token, which is how the site knows the update is from RedX).
4. Switch it **On**. Sending an order picks the RedX delivery area from the address; you can change it in the send dialog.

**CarryBee**
1. In the CarryBee merchant panel, open **API Credentials**. Sandbox and Production each have a **Client ID**, **Client Secret** and **Client Context**. Create your pickup store in CarryBee's panel too.
2. In **Integrations → CarryBee → Set up**: choose Sandbox or Live, enter the three values, **Save**, **Test connection**, and choose your **pickup store**.
3. **Updates:** on CarryBee's **Webhook Integration** page, paste the **address** shown on the card, and copy CarryBee's secret into **Webhook integration secret** on the card (if CarryBee asks you to choose one, use a long random phrase in both places). The site answers CarryBee's check with that secret.
4. Switch it **On**. Sending an order picks the CarryBee city and zone from the address; you can change them in the send dialog. A parcel can be cancelled from the order page before pickup.

**Other courier or own rider:** for any courier without a connection (Sundarban, Paperfly, your own rider), or when the others are down. It's on by default. See the [admin guide](admin-guide.md#sending-with-another-courier-or-your-own-rider).

Without webhooks, parcels still update: the site asks each connected courier every 30 minutes, and **Check** on an order asks at once.

### Checkout codes: SMS

Every customer verifies their phone with a 6-digit code before ordering. Pick any of these Bangladeshi gateways, and add a second as a backup:

| Gateway | What it needs |
|---|---|
| **BulkSMSBD** ([bulksmsbd.net](https://bulksmsbd.net)) | API key, sender ID |
| **SSL Wireless** (ISMS Plus) | API token, SID |
| **Alpha SMS** ([sms.net.bd](https://sms.net.bd)) | API key (sender ID optional) |
| **MiMSMS** ([mimsms.com](https://www.mimsms.com)) | Login email, API key (activated in their panel), sender name |

1. Open an account, add credit, and have a **sender ID** approved.
2. In **Integrations → SMS**, open the gateway's card → **Set up**: enter its values, **Save**, then **Test connection** with your own number: a test SMS arrives.
3. Switch it **On**. With two or more on, the box at the top of **SMS** sets which goes first; the next takes over if one fails. Until one is on, codes are only written to the server's log, so real customers can't check out.

### The e-receipt: email

ZALFI sends one email to customers: the receipt, with the invoice PDF attached. Team invitations go by email too. Pick any of these, and add a second as a backup:

| Service | What it needs |
|---|---|
| **Resend** ([resend.com](https://resend.com)) | API key (Domains → Add Domain, then API Keys → Create) |
| **Brevo** ([brevo.com](https://www.brevo.com)), free for 300 a day | API key (SMTP & API → API keys), a verified sender |
| **Postmark** ([postmarkapp.com](https://postmarkapp.com)) | Server API token, a verified sender signature |
| **Your mailbox (SMTP)** | Server, port, username, password of a mailbox you already have |

For **your mailbox**: Gmail and Google Workspace use `smtp.gmail.com`, port 465, and an **app password** (Google Account → Security → App passwords), not your normal password. Zoho Mail uses `smtp.zoho.com`, port 465. A web host's email is usually `mail.yourdomain.com`, port 465 or 587. Gmail sends about 500 emails a day at most.

1. Verify the address you send from (or its domain) with the service.
2. In **Integrations → Email**, open its card → **Set up**: enter the values and the **Send from** address (`ZALFI <receipts@zalfi.com>`). **Save**, then **Test connection**: a test email arrives in your inbox.
3. Switch it **On**. With two or more on, the box at the top of **Email** sets which goes first.

### Photo storage: Vercel Blob

Done in Part 1, step 3. Photos go to Blob whenever its token is there, with no switch.

## Part 4: the go-live checklist

- [ ] The site is on the **Pro plan**, on your domain, with `NEXT_PUBLIC_SITE_URL` set to it.
- [ ] `BETTER_AUTH_SECRET` and `CRON_SECRET` are set, long and random.
- [ ] The database is migrated and seeded, and you can sign in as the owner.
- [ ] **Store** and **Invoice details** are filled in. **Shipping** fees and Dhaka areas are right.
- [ ] Real **prices and stock** are set in Products and Inventory.
- [ ] At least one way to pay works: **SSLCommerz** or **aamarPay** live (tested, switched on, IPN address set), or **cash on delivery**, or **bKash and Nagad by hand**.
- [ ] **SMS** sends real codes (Integrations → SMS: one gateway tested and on, a second as backup if you can).
- [ ] **Email** sends the receipt (Integrations → Email: sender verified, tested, on).
- [ ] At least one **courier** is live, tested, its webhook set, and chosen as the default.
- [ ] **Integrations** shows no card as **Needs attention**.
- [ ] **Blob** storage is connected (Part 1, step 3) before uploading photos.
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
| `CREDENTIALS_KEY` | Optional | Encrypts the keys saved in Integrations. Without it, a key derived from `BETTER_AUTH_SECRET` is used |
| `SSLCOMMERZ_*`, `AAMARPAY_*`, `PATHAO_*`, `STEADFAST_*`, `REDX_*`, `BULKSMSBD_*`, `RESEND_API_KEY`, `EMAIL_FROM` | No (set them up in Integrations) | Fallbacks for a site set up before the Integrations page. Keys saved in the admin win. The full list with comments is in `.env.example`. CarryBee, SSL Wireless, Alpha SMS, MiMSMS, Brevo, Postmark and SMTP have no variables: they are set up in the admin only |
| `ALLOW_TEST_PROVIDERS` | Never on the live site | `true` lets the test gateway and courier run on a non-Vercel production build (a staging server) |
| `NEON_LOCAL_PROXY_PORT`, `ADMIN_OWNER_PASSWORD` | Your computer only | The local database bridge; scripted owner creation |

## Updating the site later

- **Code:** every push to the production branch deploys by itself. Pushes to other branches make previews.
- **Database changes:** when an update adds a migration (a new file in `drizzle/`), run `npm run db:migrate` against Neon as in Part 1, step 5, **before or right after** the deploy. Until it runs, the admin keeps working on the keys in Vercel's environment, and Admin → Integrations asks for the migration.
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

**A card in Integrations says "Needs attention"**
The provider refused a real call (a key changed in its panel, or it was down). The card and the Overview show the provider's own words. Open **Set up**, replace the key, **Test connection**. A gateway that can't open a page is skipped for the other one meanwhile.

**"Saved keys can't be read"**
`BETTER_AUTH_SECRET` (or `CREDENTIALS_KEY`) changed since the keys were saved. Enter them again in **Set up**.

**Payments stay "waiting" after paying**
The IPN address isn't set in SSLCommerz's panel, or `NEXT_PUBLIC_SITE_URL` is wrong. The site also checks open payments every 30 minutes, so they settle eventually. Fix the URL for instant confirmation.

**Courier statuses don't update**
Check the webhook URL and secret in the courier's panel match `PATHAO_WEBHOOK_SECRET` or `STEADFAST_WEBHOOK_TOKEN`. **Check** on the order asks the courier directly.

**Uploading a photo fails**
Blob storage isn't connected or switched on (Part 1, step 3, and Part 3).
