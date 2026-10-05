# Run ZALFI on your computer

This guide takes you from nothing to the shop and the admin running on `http://localhost:3000`, with demo data, in about fifteen minutes. Nothing here needs a paid account: payments, SMS, email and couriers all have built-in test stand-ins.

- [1. Install the tools](#1-install-the-tools)
- [2. Get the code](#2-get-the-code)
- [3. Create the database](#3-create-the-database)
- [4. Fill it](#4-fill-it)
- [5. Start the site](#5-start-the-site)
- [6. Try an order from start to finish](#6-try-an-order-from-start-to-finish)
- [7. Day-to-day commands](#7-day-to-day-commands)
- [8. Trying real providers locally](#8-trying-real-providers-locally)
- [9. When something goes wrong](#9-when-something-goes-wrong)

## 1. Install the tools

You need **Git**, **Node.js 22 or newer** (with npm) and **PostgreSQL 16**.

**macOS** (with [Homebrew](https://brew.sh)):

```bash
brew install git node postgresql@16
brew services start postgresql@16      # starts now and at every login
```

Homebrew's PostgreSQL uses your Mac user name with no password. In step 3 you'll set `DATABASE_URL` to match.

**Windows:**

1. Install Git from [git-scm.com](https://git-scm.com) and Node.js (the LTS) from [nodejs.org](https://nodejs.org).
2. Install PostgreSQL 16 from [postgresql.org/download/windows](https://www.postgresql.org/download/windows/). Note the password you give the `postgres` user. Keep the port at 5432.
3. It runs as a Windows service, so it's already on after installing.

Use **PowerShell** or **Git Bash** for the commands below. In PowerShell, write `copy` where this guide says `cp`.

**Ubuntu / Debian:**

```bash
sudo apt install git postgresql
# Node 22: see https://nodejs.org/en/download (or use nvm)
sudo service postgresql start          # on WSL or without systemd; otherwise: sudo systemctl start postgresql
sudo -u postgres psql -c "alter user postgres password 'postgres';"
```

Check everything is there:

```bash
node -v      # v22 or higher
psql --version
```

## 2. Get the code

```bash
git clone https://github.com/Treion/zalfiweb.git
cd zalfiweb
git checkout claude/zalfi-backend      # the branch with the backend, until it's merged
npm install
```

Then make your settings file:

```bash
cp .env.example .env
```

The defaults in `.env` work for a local database called `zalfi` with the user `postgres` and password `postgres`. If yours differ, edit the `DATABASE_URL` line:

```
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/zalfi
```

On macOS with Homebrew that's usually `postgresql://YOUR_MAC_USER@localhost:5432/zalfi` (no password).

Use a single `.env` file. Both the site and the command-line scripts read it. An old `.env.local` from earlier versions is no longer needed.

## 3. Create the database

```bash
createdb zalfi
```

If `createdb` isn't found (common on Windows), do the same in psql: `psql -U postgres -c "create database zalfi;"`.

## 4. Fill it

```bash
npm run db:migrate        # creates every table
npm run db:seed           # the six fragrances, their notes and sizes
npm run db:seed:demo      # optional: 90 days of demo orders, customers and coupons, so the admin has something to show
```

Now create your admin account:

```bash
npm run admin
```

Answer the questions: choose **Create an admin**, then your email, your name, the role (**owner** for yourself) and a password of at least 10 characters. You can come back to `npm run admin` any time to add a manager, reset a password or switch someone off. Quick one-liners:

```bash
npm run admin -- create you@example.com "Your Name"            # an owner, password generated and shown once
npm run admin -- create rafi@example.com "Rafi" manager        # a manager
npm run admin -- reset-password you@example.com
npm run admin -- list
```

## 5. Start the site

```bash
npm run dev
```

- The shop: **http://localhost:3000**
- The admin: **http://localhost:3000/admin**, signed in with the account from step 4

`npm run dev` first checks that PostgreSQL answers (and tells you plainly if it doesn't), and applies any new migrations a `git pull` brought. It then starts a small local bridge the site uses to reach the database, then the site itself. `Ctrl+C` stops all of it. To use another port: `npm run dev -- -p 3001`.

**Seeing the 3D stage.** The bottles are relit in WebGL on computers with a graphics card. A computer without one (or a browser with hardware acceleration off) gets the calm static version of the same pages. To force the 3D stage, add `?stage=force` to the address once. `?stage=off` undoes it.

## 6. Try an order from start to finish

1. **Switch on cash on delivery** if you want to try it: Admin → Settings → Payments. Online payment works straight away through the **test gateway**.
2. **Buy:** in the shop, add a bottle to the bag and press **Checkout**.
3. **Verify the phone:** fill in your name and any Bangladeshi mobile number (`01712345678`), then press **Send code**. On your computer the code shows under the field. It's also printed in the terminal and saved in `.data/sms.log`.
4. **Address and payment:** choose a district and area, then **Pay online** (or **Cash on delivery**), and **Place order**.
5. **Pay:** the test gateway opens with **Pay successfully**, **Fail the payment** and **Cancel**. Pay, and you land on the confirmation page with the order number.
6. **The receipt** is saved in `.data/outbox/`, as the email (HTML) and its PDF invoice.
7. **In the admin:** open **Orders** and the new order, then:
   - press **Send to courier**, and **Send** with the test courier;
   - press **Label** to print the shipping label;
   - use **Courier update** to play the courier: picked up, on the way, out for delivery, delivered.
   The order moves along by itself, and a cash-on-delivery order is marked paid on delivery.
8. **Look around:** the Overview, Shipping, Payments, Customers and Reports now include your order.

The test gateway and test courier exist only on your computer and on preview sites. They can't run on the live site.

## 7. Day-to-day commands

| Command | What it does |
|---|---|
| `npm run dev` | Starts the site (and the database bridge) |
| `git pull` then `npm install` and `npm run db:migrate` | Gets the latest version, its packages and its database changes |
| `npm run check` | Lint, typecheck, unit tests and a production build. Run it before you push |
| `npm test` | Unit tests (`tests/unit`) |
| `npm run test:db` | Database tests (`tests/db`): stock, orders, payments, shipping, reports, notes. Needs PostgreSQL running |
| `npm run test:e2e` | Browser tests (`tests/e2e`, Playwright): an order paid online, a failed payment, cash on delivery, a cancellation, a refund, the manager's limits, and every admin page in light and dark on a desktop and a phone. Uses the test gateway and courier, so no keys. Starts `npm run dev` if it isn't running, and cleans up after itself. The first time on a new computer: `npx playwright install chromium`. Screenshots land in `test-results/screens` |
| `npm run db:seed:demo -- --clear` | Removes the demo data only (your own orders stay) |
| `npm run stock:check` | Proves every bottle's stock matches its history |
| `npm run db:generate` | After changing the schema in `src/db/tables/`: writes a migration into `drizzle/` |
| `npm run db:studio` | A browser view of the database tables |
| `npm run format` | Formats every file |

**Where local data goes:** everything the site writes on your computer lives in `.data/` (ignored by git):
- `outbox/`: emails and their PDFs;
- `sms.log`: SMS messages;
- `uploads/`: photos uploaded in the admin.

## 8. Trying real providers locally

Each provider works locally as soon as its keys are in `.env` (restart `npm run dev` afterwards). [`deploy-vercel.md`](deploy-vercel.md) explains where to get each key (the same on Netlify: [`deploy-netlify.md`](deploy-netlify.md)).

- **SSLCommerz sandbox:**
  1. Set `SSLCOMMERZ_STORE_ID`, `SSLCOMMERZ_STORE_PASSWORD` and `SSLCOMMERZ_IS_LIVE=false`.
  2. Choose SSLCommerz in Admin → Settings → Payments → Payment gateway.
  3. On `localhost`, SSLCommerz can send the customer back to the site but can't reach it to confirm the payment, so the return page settles it. To test that confirmation too, expose the site with a tunnel (for example `ngrok http 3000`) and set `NEXT_PUBLIC_SITE_URL` to the tunnel's address.
- **Pathao sandbox:** set the six `PATHAO_*` values with `PATHAO_IS_LIVE=false`, then send an order with Pathao. Its city and zone are matched from the address; when they aren't, choose them in the send dialog.
- **Steadfast:** `STEADFAST_API_KEY` and `STEADFAST_SECRET_KEY`. Ask Steadfast whether your keys are for testing. If they aren't, the parcels are real: cancel a test one in their panel before pickup.
- **Courier updates** arrive by webhook only with a public address (a tunnel). Without one, **Check** on the order asks the courier directly.

## 9. When something goes wrong

**"PostgreSQL isn't running" / "Can't reach the database" / `ECONNREFUSED`**
PostgreSQL isn't started. Start it:
- macOS: `brew services start postgresql@16`
- Windows: Services → postgresql-x64-16 → Start
- Linux: `sudo systemctl start postgresql`
- WSL or Docker-like systems without systemd: `sudo service postgresql start`

The message `postgresql.service not found` means your system has no systemd: use `sudo service postgresql start`.

**`password authentication failed for user "postgres"`**
The password in `DATABASE_URL` doesn't match. Fix the line in `.env`, or set the password: `sudo -u postgres psql -c "alter user postgres password 'postgres';"`.

**`database "zalfi" does not exist`**
Run `createdb zalfi` (step 3).

**`relation … does not exist`** (for example `relation "integrations" does not exist`)
Run `npm run db:migrate`. `npm run dev` also does this by itself for a database on your computer, so restarting it is enough after a `git pull`.

**I can't sign in to the admin**
- Check the account exists: `npm run admin -- list`.
- Reset the password: `npm run admin -- reset-password you@example.com`.
- Accounts that were switched off can't sign in; switch them back on with `npm run admin`.

**The code never arrives at checkout**
Locally there's no real SMS. The code is under the field, in the terminal, and in `.data/sms.log`. After 5 wrong tries, or within 60 seconds of the last code, a new one is refused. Wait a minute, or use another number.

**Cash on delivery isn't offered**
It's off by default. Switch it on in Admin → Settings → Payments.

**`git pull` says "Your local changes to package-lock.json would be overwritten"**
`npm install` touched the lock file. Discard that and pull:

```bash
git checkout -- package-lock.json
git pull
npm install
```

**Port 3000 is in use**
Another site is running. Stop it, or use `npm run dev -- -p 3001`.

**The home page shows the static version, not the 3D bottles**
Your browser has no hardware graphics (or reduces motion). Add `?stage=force` to the address to force the 3D stage.
