# The shop: how it works, and how to change it

What customers see, how they buy, and where each piece of the shop is changed: in the admin, or in the code.

- [A tour of the shop](#a-tour-of-the-shop)
- [How a customer buys](#how-a-customer-buys)
- [What you change in the admin](#what-you-change-in-the-admin)
- [What's changed in the code](#whats-changed-in-the-code)
- [Photos and artwork](#photos-and-artwork)
- [Motion, and the static version](#motion-and-the-static-version)
- [Checking the shop](#checking-the-shop)

## A tour of the shop

**The home page** (`/`) is one long scroll:

1. **The logo:** the ZALFI emblem and wordmark alone in the dark. They assemble once on arrival, then stay still.
2. **The line-up:** scroll, and the logo sinks back as the six bottles rise into a row, each with its name, price and **Add**. Hovering a bottle fills the room with its world's colours.
3. **The chapters:** scrolling on, Reva steps forward into its world, then each fragrance follows. Each chapter has its name above the bottle, a tagline, its top, heart and base notes, and **Discover** and **Add to bag**. The bottle is the real photograph, relit live (WebGL). Pointing at it lifts it a touch, and clicking it opens its page. Every world is a deep dusk in its own colour, so the text stays light from the first chapter to the last.
4. **The index** on the right (on a computer) lists the chapters. Click one to jump straight there: the screen washes to that world's colour, rather than scrolling through the others. The logo and **Fragrances** in the top bar jump the same way.
5. The story, and the footer with the house pages, contact details and socials.

**Other pages**

| Page | What's there |
|---|---|
| `/fragrances/reva` (and each other name) | The bottle large, price, live stock, Add to bag (it stays at the bottom of the screen as you scroll), the scent profile, the notes, and more photos |
| `/find` | Find your world: three questions, then the fragrance that fits, lit on the stage |
| **Info** in the top bar | The house pages: About, FAQ, Contact, Refunds, Payment policy, Privacy, Terms |
| The cart icon (top right) | The bag, as a drawer: change quantities, then **Checkout** |
| `/checkout` | The checkout, then the confirmation page |

## How a customer buys

1. **The bag:** Add to bag anywhere; the cart icon shows the count. The bag is kept on their device.
2. **Contact:** name, mobile number and email.
3. **The code:** a 6-digit code by SMS to their mobile. It's valid for 5 minutes, with 5 tries; a new one can be sent after 60 seconds. Once verified, the number stays verified on that device for 24 hours.
4. **Delivery:** district (all 64), area or thana, and house, road and street. The shipping fee follows: inside Dhaka (the areas listed in Settings → Shipping) or outside.
5. **A coupon**, if they have one.
6. **Payment:** **Pay online** (cards, bKash, Nagad and Rocket through SSLCommerz) and/or **Cash on delivery**, whichever is switched on in Settings → Payments.
7. **Place order:** the price, stock and fees are checked again on the server, never trusted from the browser.
   - **Online:** they go to SSLCommerz and come back to the confirmation page. If the payment fails, the order waits 30 minutes for them to try again (**Pay now**), holding their bottles.
   - **Cash on delivery:** straight to the confirmation page.
8. **The confirmation page** shows the order number, and a tracking link once the parcel is with the courier. The **e-receipt** (with the PDF invoice) arrives by email.

There are no customer accounts and no marketing emails. The receipt is the only email ZALFI sends; payment and delivery messages come from SSLCommerz and the courier.

## What you change in the admin

These show on the shop at once, with no deploy:

- **Fragrances:** name, tagline, story, mood, notes, scent profile, the world's colours, the cap, and published or hidden (**Products**). A new fragrance gets its own chapter on the home page by itself; the count words ("six worlds") follow.
- **Prices, sizes and stock** (**Products**, **Inventory**). "Sold out" shows by itself when available stock reaches 0.
- **Photos:** the bottle photo and gallery images (**Products**).
- **Shipping fees**, Dhaka areas, free shipping, payment methods (**Settings**).
- **Coupons** (**Coupons**).

The [admin guide](admin-guide.md) explains each screen.

## What's changed in the code

These live in files, so changing them means editing the file, then a push (which redeploys):

| What | Where |
|---|---|
| The house pages' text (About, FAQ, Refunds…) | `src/content/pages.ts`: each page is a list of blocks (a lead line, "in short" points, sections that open, FAQ entries…). The owner's original text is kept in `docs/content/policies-original.md`. |
| Which house pages exist, and the Info menu | `src/content/info-nav.ts` |
| Phone, email, address, Facebook, Instagram | `src/lib/contact.ts` (used by the footer, `/contact` and the icons) |
| The six fragrances' starting data | `src/db/seed-data.ts`. It's what `npm run db:seed` puts in the database, and what the site shows if it has no database. After the first seed, edit fragrances in the admin instead. |
| Headlines and small copy on the home page | `src/components/sections/` (`Landing`, `Lineup`, `Story`, `Footer`) |
| Colours, fonts and sizes | `src/app/(site)/globals.css` |

The design rules (type, colour, motion, what never to do) are in `CLAUDE.md`. Keep copy short: sentences under 15 words.

## Photos and artwork

| What | Files | After changing |
|---|---|---|
| The logo | `public/brand/logo.png` (the original artwork) | `npm run assets:logo` traces it into the site's vector logo and the email logo |
| The six bottles | `public/images/bottles/{reva,riven,maree,solea,bond,oudor}.png`: 2000 × 2000 px, transparent | `npm run assets:bottles` bakes the lighting maps. A photo uploaded in the admin is baked by itself |
| Note photos (lavender, vanilla…) | `public/images/notes/{note}.png` | None: they show as soon as they're there |
| 3D models (optional) | `assets/models/`, see its README | `npm run models:ingest` |

**Bottles:** never crop, recolour or retouch them; the site shows them whole and relights them itself.

**Note photos aren't in yet.** Until they are, each note shows a fine frame with its file name (e.g. `apple.png`), never a drawing or an icon. They must look like real photographs. `npm run notes:fetch` downloads openly licensed real photos from Wikimedia Commons, cuts them out, and writes their credits to `CREDITS.md` (keep that file). Review every one before publishing. The list of notes, and prompts for studio photography, are in `docs/content/note-images.md`.

## Motion, and the static version

The shop moves only when the visitor scrolls, hovers or clicks. Nothing drifts or loops on its own, and with no input the screen is perfectly still. On a phone the scroll is shorter and lighter.

Two kinds of visitor get a calm **static** version of the same pages: the same content, laid out like a magazine spread, with no 3D stage and no scroll choreography:
- people who ask their device to **reduce motion**;
- devices **without a graphics card** (some older laptops, and browsers with hardware acceleration off).

To see the 3D stage on a computer that would get the static version, add `?stage=force` to any address once; `?stage=off` undoes it.

## Checking the shop

- `/lab` (not on the live site) shows the design foundations and which photos are still missing. `/lab/stage?slug=oudor` shows one relit bottle, to judge the light.
- `npm run check` before every push: lint, typecheck, tests and a production build.
- The **calm check** (for anyone changing motion) is described in `CLAUDE.md`: with no input, two screenshots 1.5 seconds apart must be identical.
