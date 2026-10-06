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

**The home page** (`/`) is one long scroll, but nobody has to take it:

1. **The logo:** the ZALFI emblem and wordmark alone in the dark. They assemble once on arrival, then stay still. Under them, three ways in:
   - **Shop** goes straight to every fragrance (`/fragrances`);
   - **Explore the worlds** glides down to the line-up;
   - **Not sure? Find yours** opens the finder (`/find`).

   "Or scroll" says the rest. The three fade as the page moves on.
2. **The line-up:** scroll, and the logo sinks back as the six bottles rise into a row, each with its name, price and **Add**. Hovering a bottle fills the room with its world's colours.
3. **The chapters:** scrolling on, Reva steps forward into its world, then each fragrance follows. Each chapter has its name above the bottle, a tagline, its top, heart and base notes, and **Discover** and **Add to bag**. The bottle is the real photograph, relit live (WebGL). Pointing at it lifts it a touch, and clicking it opens its page. Every world is a deep dusk in its own colour, so the text stays light from the first chapter to the last.
4. **The index** on the right (on a computer) lists the chapters. Click one to jump straight there: the screen washes to that world's colour, rather than scrolling through the others. The logo and **The worlds** in the top bar jump the same way.
5. **From the house:** the home banners from Admin → Content (campaign pictures, a designer's banner), one under the other, each whole. With none, this part isn't there.
6. The story, on bone paper.
7. **Discovery sets:** on the same bone paper, the boxes side by side, each with what's inside, its price and **Add the set**. No pinning and no stage: the boxes only rise a little as they scroll in.
8. The footer, with the house pages, contact details, socials and the ways to pay ("We accept").

**The top bar** on a computer: **Shop**, **The worlds** (the line-up on the home page), **Discovery**, **Find yours**, **Info**, the search mark and the bag. On a phone: **Menu**, search and the bag. The page you're on is outlined.

**Search** (the magnifier, or the `/` key): results appear as you type, by name, note, mood, family, moment or season ("oud", "fresh", "evening"), with the bottle, price and a one-tap **Add**. Discovery sets and a few pages (Track your order, Delivery and payment, Refunds, FAQ, Contact) are found too. An empty box offers popular searches.

**Other pages**

| Page | What's there |
|---|---|
| `/fragrances` (**Shop**) | Every fragrance on one page, on bone paper. At the top, the shop banners (Admin → Content): with more than one, arrows, dots or a swipe move between them, never by themselves. Then a line of services (free delivery over the threshold, cash on delivery, the free gift note, discovery sets, WhatsApp: each only when it's true). **Sort** (Featured, Price low to high or high to low, Top rated once there are reviews) and filters for **Wear it** (day, evening, night), **Season** and **By note**; both stay in the address, so a list can be shared. Each card: bottle, badge (New, Bestseller, Limited edition), name, mood, stars once reviewed, top notes, price and **Add**; on a computer, pointing at it shows its first photo (a model, a campaign shot). Then videos (**On YouTube**, if any), the discovery sets, and **Recently viewed** |
| `/fragrances/reva` (and each other name) | "Shop / Reva" and the badge, the bottle large with a row of thumbnails under it (the lit bottle, then each photo from Products → Photos; tap the photo to see it full screen), price, live stock, Add to bag (it stays at the bottom of the screen as you scroll), and under it the delivery fees and usual times, how to pay, and WhatsApp. Then sections that open: **About Reva** (the story), **How to wear it**, **Delivery and returns**. Then the scent profile, the notes, **Worn by** (approved reviews, once there are any), **On YouTube** (videos about it, if any), two **similar worlds** and **Recently viewed**. Sold out, Add becomes **Notify me**: a phone number, and one SMS when it's back |
| `/track` (**Track your order**) | The order number and the phone it was placed with open the order's own page: its status, its parcel, and how to pay if it's still waiting |
| `/find` | Find your world: three questions, then the fragrance that fits, lit on the stage, and the discovery set it's in |
| `/discovery` (**Discovery**) | The discovery sets: each box large, the three fragrances inside (each to its own page), the price and **Add the set**. Each fragrance's page has one line pointing to its set ("Try it first: in the Black Set, with Riven and Maree") |
| **Info** in the top bar | The house pages: About, FAQ, Contact, Refunds, Payment policy, Privacy, Terms |
| **Menu** in the top bar (phones) | On a phone, Info becomes **Menu**: Shop, The worlds, Discovery sets, Find yours, Track your order and WhatsApp on top, the house pages below |
| The cart icon (top right) | The bag, as a drawer: change quantities, then **Checkout** |
| `/checkout` | The checkout, then the confirmation page |

## How a customer buys

1. **The bag:** Add to bag anywhere; the cart icon shows the count. The bag is kept on their device. It says how far they are from free delivery (when Settings has a threshold), and whether there's cash on delivery.
2. **Contact:** name, mobile number and email.
3. **The code:** a 6-digit code by SMS to their mobile. It's valid for 5 minutes, with 5 tries; a new one can be sent after 60 seconds. Once verified, the number stays verified on that device for 24 hours.
4. **Delivery:** district (all 64), area or thana, and house, road and street. The shipping fee follows: inside Dhaka (the areas listed in Settings → Shipping) or outside.
5. **A gift?** "This is a gift" (free) takes a note of up to 200 characters. The team prints it on a card for the box; the receipt and the order's page show it.
6. **A coupon**, if they have one.
7. **Payment:** whichever is switched on:
   - **Pay online:** cards, bKash, Nagad and Rocket through SSLCommerz or aamarPay (whichever the owner puts first; the other takes over if it can't open);
   - **bKash or Nagad (Send Money):** the customer sends the money themselves and gives the transaction ID on their order's page; the team confirms it;
   - **Cash on delivery.**
8. **Place order:** the price, stock and fees are checked again on the server, never trusted from the browser.
   - **Online:** they go to SSLCommerz and come back to the confirmation page. If the payment fails, the order waits 30 minutes for them to try again (**Pay now**), holding their bottles.
   - **bKash or Nagad:** to the order's page, which shows the number to send to, the amount and the reference, and takes the transaction ID. The bottles are held for 24 hours, and as long as the team needs to check a transaction ID.
   - **Cash on delivery:** straight to the confirmation page.
9. **The confirmation page** is the order's own page from then on: the order number, its status, and a tracking link once the parcel is with the courier. `/track` finds it again from the order number and the phone. The **e-receipt** (with the PDF invoice) arrives by email.
10. **Delivered:** one short email asks how it wears, with the link back to the order's page, which now offers **Review your fragrances** (stars, a few words, how to sign it). A review shows on the shop once the team approves it.

There are no customer accounts and no marketing emails. ZALFI sends the receipt, the one review email after delivery, and a "back in stock" SMS to those who asked; payment and delivery messages come from the gateway and the courier.

## What you change in the admin

These show on the shop at once, with no deploy:

- **Fragrances:** name, tagline, story, mood, notes, scent profile, the world's colours, the cap, and published or hidden (**Products**). A new fragrance gets its own chapter on the home page by itself; the count words ("six worlds") follow.
- **Prices, sizes and stock** (**Products**, **Inventory**). "Sold out" shows by itself when available stock reaches 0.
- **Discovery sets:** name, tagline, the three fragrances, vial size, price, box photo, shown or hidden (**Products → Discovery sets**), and their boxes in stock (**Inventory**).
- **Photos:** the bottle photo (**Products → Details**), and models, campaign and lifestyle photos (**Products → Photos**): the gallery on the product page and the photo on the shop card.
- **Badge** and **How to wear it** for each fragrance (**Products → Details**).
- **Banners** for the top of the shop and the home page, with a phone version, words, a link and dates, and **YouTube videos** (**Content**).
- **Shipping fees**, delivery times, Dhaka areas, free shipping, payment methods (**Settings**). The product pages, Discovery and the bag say what these say.
- **Reviews:** which show (**Reviews**), and whether reviews show at all or are asked for (**Settings → Reviews**).
- **Payment gateways, couriers, SMS and email:** keys, sandbox or live, on or off (**Integrations**).
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
| Note photos (lavender, vanilla…) | Admin → Notes, or `public/images/notes/{note}.png` | None: they show as soon as they're there |
| Model, campaign and lifestyle photos | Admin → Products → a fragrance → Photos: JPG, PNG, WebP or AVIF, up to 4 MB | None. Shown whole in the gallery and the viewer |
| Banners | Admin → Content: a wide picture (about 2400 × 1000 px) and, optionally, an upright one for phones (about 1080 × 1350 px), up to 4 MB each | None. Shown whole, at their own shape |
| Discovery set boxes | Admin → Products → a set → Box photo, or `public/images/sets/{set}.webp`: transparent | None: shown whole, on bone paper |
| 3D models (optional) | `assets/models/`, see its README | `npm run models:ingest` |

**Bottles:** never crop, recolour or retouch them; the site shows them whole and relights them itself.

**Note photos:** every note has one (yours). Add, rename or re-photograph notes in the admin (**Catalogue → Notes**), and put them in a fragrance from **Products → Notes**. A note without a photo is left out of the shop, never shown as an empty space. To bring in a folder of photos at once (transparent PNG or WebP, named however you like, e.g. `white oud.png`), run `npm run notes:ingest -- <folder>` (add `--force` to replace ones already there): it renames them, trims and centres them, and saves them to `public/images/notes/`. They must look like real photographs. `npm run notes:fetch` can find openly licensed real photos on Wikimedia Commons and writes their credits to `CREDITS.md` (keep that file). The note list is in `docs/content/note-images.md`.

## Motion, and the static version

The shop moves only when the visitor scrolls, hovers or clicks. Nothing drifts or loops on its own, and with no input the screen is perfectly still. Banners never change by themselves, and a video plays only when it's tapped. On a phone the scroll is shorter and lighter.

Two kinds of visitor get a calm **static** version of the same pages: the same content, laid out like a magazine spread, with no 3D stage and no scroll choreography:
- people who ask their device to **reduce motion**;
- devices **without a graphics card** (some older laptops, and browsers with hardware acceleration off).

To see the 3D stage on a computer that would get the static version, add `?stage=force` to any address once; `?stage=off` undoes it.

## Checking the shop

- `/lab` (not on the live site) shows the design foundations and which photos are still missing. `/lab/stage?slug=oudor` shows one relit bottle, to judge the light.
- `npm run check` before every push: lint, typecheck, tests and a production build.
- The **calm check** (for anyone changing motion) is described in `CLAUDE.md`: with no input, two screenshots 1.5 seconds apart must be identical.
