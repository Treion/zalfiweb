# The admin, day to day

A guide for the owner and the managers: how to run the shop from `/admin`. It follows an order from the moment it comes in to the moment it's delivered, then covers everything else.

- [Signing in](#signing-in)
- [Finding your way](#finding-your-way)
- [An order, from start to finish](#an-order-from-start-to-finish)
- [When a delivery fails, or a parcel comes back](#when-a-delivery-fails-or-a-parcel-comes-back)
- [bKash and Nagad, paid by hand](#bkash-and-nagad-paid-by-hand)
- [Sending with another courier or your own rider](#sending-with-another-courier-or-your-own-rider)
- [Cancelling and refunding](#cancelling-and-refunding)
- [Products, photos and prices](#products-photos-and-prices)
- [Notes](#notes)
- [Banners and videos](#banners-and-videos)
- [Stock](#stock)
- [Reviews](#reviews)
- [Coupons](#coupons)
- [Customers](#customers)
- [The Overview and Reports](#the-overview-and-reports)
- [Settings](#settings)
- [Integrations: gateways, couriers, SMS and email](#integrations-gateways-couriers-sms-and-email)
- [The team, and who can do what](#the-team-and-who-can-do-what)

## Signing in

Go to `https://your-domain/admin` and sign in with your email and password. You're signed out after 4 hours without activity.

- **Forgot your password?** The owner can reset any password from a terminal: `npm run admin -- reset-password you@example.com` (see the [deploy guide](deploy-vercel.md) for doing it against the live database).
- **New manager?** The owner invites you from **Team**. Your link works once, for 48 hours.
- **Light or dark:** the sun/moon button in the top bar. The admin remembers your choice.

## Finding your way

- **The sidebar:** Overview; then Sell (Orders, Customers, Payments, Shipping, Coupons); Catalogue (Products, Notes, Inventory, Content, Reviews); Insight (Reports); Admin (Settings, Integrations, Team, Activity log). You see only what your role allows.
- **The numbers in the sidebar:** next to Orders, the orders waiting to be packed; next to Inventory, the sizes low or sold out; next to Reviews, the reviews waiting to be read.
- **Search** (top bar, or press `/` anywhere): an order number (`ZLF-002063`, or just `2063`), a phone number typed any way (`01712-345678`, `+880 1712 345678`), a name or email, a fragrance or a SKU. Arrow keys and Enter open a result. Enter alone shows every match.
- **Every list** has search, filters, sorting (click a column heading), pages, a **Columns** button to hide columns, and a **CSV** download of what you're looking at. Downloads are recorded in the Activity log, because they contain customer details.

## An order, from start to finish

### 1. It comes in

When a customer places an order, it appears in **Orders**, and the customer gets the e-receipt by email.

- **Cash on delivery** orders arrive **Confirmed**, ready to pack.
- **Online payment** orders arrive **Waiting for payment**. They become **Confirmed** by themselves when the payment is confirmed. An unpaid one cancels itself after 30 minutes (Settings → Payments), and its bottles go back on sale.
- **bKash or Nagad by hand** orders arrive **Waiting for payment** too, until you confirm the customer's transaction ID (see [below](#bkash-and-nagad-paid-by-hand)).

### 2. Pack it

Open the order (click its row). You'll see:
- the items and totals;
- the customer, with one-click **copy** for the phone number and the address;
- **Payment** and **Shipment** panels;
- the **Timeline** of everything that happened, where you can add **notes** for the team (customers never see them).

**A gift?** The order shows an **A gift** card at the top of the right-hand column, with the customer's note. Press **Print gift card**: an A6 card with the logo and their words, no prices. Put it in the box. The label says **GIFT · NOTE CARD INSIDE**, and the customer's receipt says the note is included.

When the bottles are boxed, press **Mark packed**. For several at once: tick them in **Orders**, then **Mark packed**.

### 3. Send it to the courier

On the order, under **Shipment**, press **Send to courier**:
1. Choose the courier (your default is preselected; only couriers switched on in **Integrations** are offered). For Pathao and CarryBee, check the city and zone it matched from the address. For RedX, check the delivery area. For **Other courier**, see [below](#sending-with-another-courier-or-your-own-rider).
2. The dialog shows the cash the courier will collect (the total for unpaid cash-on-delivery orders, nothing for paid ones).
3. Press **Send**. The courier gives a consignment number, and the order shows **Packed** while it waits for pickup.

For several at once: tick them in **Orders**, then **Send to courier** and choose the courier.

### 4. Print the label

**Label** on the order prints ZALFI's 4 × 6 inch label: the order number, the customer, the cash to collect, the consignment number and a QR code of the tracking code. For several: tick them in **Orders** (or **Shipping**), then **Print labels**. One PDF, one label per page. Stick it on the box next to the courier's own sticker.

### 5. Let the courier do the rest

As the courier reports back, the order moves along by itself (**Shipped**, **Out for delivery**, **Delivered**), and each step lands on the timeline. A cash-on-delivery order becomes **Paid** on delivery. Once delivered, the customer gets one short email asking how it wears, with the link to review it (see [Reviews](#reviews); Settings → Reviews switches it off). The timeline notes it. **Check** on the order asks the courier at once; otherwise the site asks every 30 minutes.

If the courier isn't connected, or you deliver yourself, send it with **Other courier** and record its updates (see [below](#sending-with-another-courier-or-your-own-rider)). The buttons at the top (**Mark shipped**, **Out for delivery**, **Mark delivered**, or **More**) also move an order by hand, without a parcel record.

### 6. Paperwork

- **Invoice** downloads the PDF invoice (the same one the receipt email carries).
- **Resend receipt** emails the customer their receipt again.

## When a delivery fails, or a parcel comes back

- **Shipping → Failed deliveries** lists every parcel the courier couldn't deliver, with the number of attempts.
- While the courier still has it, press **Try delivery again** on the order (after you've spoken to the customer).
- Once the courier brings it back, open **More → Returned** on the order and fill in:
  - **how it came back:** unopened, opened, damaged, or bottles missing;
  - **put the bottles back in stock:** ticked by default, and never offered for missing bottles;
  - **why it came back**, in a few words.
  Returns are listed under **Shipping → Returns**.
- Cancelling a parcel before pickup: **Cancel parcel** on the order. Pathao and Steadfast cancel in their own panels, so cancel it there first, then confirm here. The order stays packed, ready to send again.

The **Shipping** page also shows, per courier, the cash collected on delivered parcels in the last 30 days (what the courier owes you), and the cash still to collect. Check it against the courier's payout statement.

## bKash and Nagad, paid by hand

For when the gateways are down, or for customers who'd rather send the money themselves. Switch it on in **Integrations → bKash and Nagad (by hand)**: tick bKash and/or Nagad, enter each number and the kind of account (personal: customers use Send Money; merchant: Payment; agent: Cash In), and **Save**.

1. At checkout the customer chooses **bKash or Nagad (Send Money)** and places the order. Its bottles are held for 24 hours (you can change it on the card).
2. The order's page shows them your number, the exact amount, and the order number to write as the reference. They send it, then enter the number they sent from and the **transaction ID (TrxID)**.
3. The order shows on the **Overview** (**Check payment**) and in **Orders** (filter **To check**). Its timeline and **Payment** panel show the wallet, the sender and the TrxID. Once a TrxID is in, the order doesn't lapse while you check.
4. Look for the payment in your bKash or Nagad app, then on the order:
   - **Payment received**: the order is confirmed, its bottles sold and the receipt emailed, exactly as with a gateway.
   - **Not found**: say what was wrong. The customer sees it on their order's page and can send the TrxID again; the bottles stay held another 24 hours.

A TrxID can only ever pay one order.

**Record payment:** any unpaid order paid another way (a gateway that took the money but didn't report it, a phone order, a bank transfer) can have its payment recorded on the order: **Payment → Record payment**, then the method and its reference. The order moves on as if the gateway had confirmed it.

## Sending with another courier or your own rider

For couriers without a connection (Sundarban, SA Paribahan, Paperfly…), your own rider, or when the connected couriers are down. It's on by default (**Integrations → Other courier or own rider**).

1. **Send to courier** → **Other courier**. Type the courier's name (or pick one), and add its tracking number and tracking link if it has them.
2. The label prints as usual, with the tracking number.
3. As the parcel moves, record it on the order: **Update status** → Picked up, On the way, Out for delivery, Delivered, Delivery failed, On its way back, or Returned to you. The order follows, and a cash-on-delivery order becomes **Paid** on delivery, as with the connected couriers. Each update is in the Activity log with who made it.
4. The customer's **Track your parcel** button opens the link you saved.

## Cancelling and refunding

- **Cancel an order:** **More → Cancel order** on the order. It's offered until the courier has it. Tick **put the bottles back in stock**, and give a reason. ZALFI doesn't message the customer, so call them if they don't know.
- **Refund:** on the order, under **Payment**, press **Refund**:
  - full or part of what was paid, never more;
  - **SSLCommerz payments** go back through SSLCommerz. The refund shows *Processing* until SSLCommerz confirms it (**Check** asks at once).
  - **aamarPay payments:** aamarPay has no refund API. Make the refund in the aamarPay merchant panel, then record it here.
  - **Cash on delivery, bKash or Nagad by hand, and payments recorded by hand** are refunded by you (cash or a mobile transfer). The admin records it.
- A paid order that's cancelled or returned isn't refunded automatically. A note at the top of the order reminds you.
- Who may refund: the owner, and managers only if the owner allows it (Settings → Permissions).

**Needs attention** notes at the top of an order flag anything unusual: a payment that arrived after the order cancelled itself, a courier warning, a refund still owed. A note goes away once someone acts on the order.

## Products, photos and prices

**Products** lists each fragrance with its sizes, prices and stock. Open one to edit:

- **Details:** name, tagline, mood, the scent profile (family, longevity, sillage, seasons, moments), and **Published** (on the shop or hidden). Also:
  - **Story:** on the product page under "About Reva", folded until opened. Search engines read it too.
  - **How to wear it:** a few lines, folded on the product page. Leave it empty and the page gives the house's plain advice.
  - **Badge:** None, New, Bestseller or Limited edition. The word shows on the perfume's card in the shop and above its name.
- **World and cap:** the fragrance's colours on the shop, with a preview, and the cap finish.
- **Bottle photo** (under Details): the main photograph: a cut-out bottle on a transparent background, as PNG or WebP, at least 600 × 600 px (2000 × 2000 is best). Upload a new one and the site checks it and bakes its lighting maps itself.
- **Photos:** models, campaign and lifestyle pictures (a hand holding the bottle, Reva on a pineapple). JPG, PNG, WebP or AVIF, up to 4 MB each. Give each a description for screen readers, and drag them into order. On the shop:
  - they make the gallery beside the bottle on the product page: thumbnails under the bottle, and a tap opens the photo full screen;
  - the first one shows on the perfume's card in the shop when a shopper points at it (on a computer; phones show the bottle).

  Photos are kept whole and never cropped in the gallery; the small thumbnails and the card show the middle of the picture.
- **Notes:** top, heart and base notes. Pick each from the notes library (its photo comes with it) and write how this fragrance names it, e.g. "Crushed Wild Mint". The picker's **New note…** adds a note to the library without leaving the page. The home page shows up to three notes per layer (two on phones); the product page shows them all.
- **Sizes and prices:** each size's price (in taka), SKU, whether it's on sale, and its low-stock level.

Changes show on the shop at once. **New fragrance** (top of Products) adds one; the home page gains a chapter by itself.

### Discovery sets

Below the fragrances, **Discovery sets** lists each set: three fragrances in small vials, sold only as one box. Each set has its own stock of boxes, separate from the bottles: selling a set never changes a 50 ml count. Open one to edit:

- **Details:** name, tagline (under 15 words), a description of the box photo, a description for search engines, its order, and **On the shop** or hidden.
- **In the box:** the three fragrances, one per vial, in order. Each fragrance's page points to the set it's in.
- **Pack and price:** the size of each vial (3 ml today), the price in taka, the low-stock level, and whether it's on sale. Its SKU never changes.
- **Box photo:** the box cut out on a transparent background (PNG or WebP, up to 4 MB). It's shown whole, never cropped.

**New set** adds one. It starts hidden with no boxes: add stock in **Inventory**, then switch it on. A set can't be shown while its pack is off, and its pack can't be switched off while it's shown. Sets are never deleted (old orders refer to them); hide one instead.

## Notes

**Notes** (under Catalogue) is the library of ingredients the fragrances are made of: each with its photo, and which fragrances use it.

- **New note:** a name, a photo and a few words describing the photo (read aloud to people who can't see it). The photo must have a transparent background (PNG or WebP, up to 4 MB): the notes float over each fragrance's colour. It is trimmed and centred for you, so every note sits at the same scale.
- **Open a note** to rename it, describe it, or **Replace the photo**. Changes show on the shop at once. The name here is the ingredient; each fragrance can word it its own way (Products → Notes).
- **Delete** works once no fragrance uses the note. Take it out of those fragrances first; the note's page lists them.
- **No empty spaces on the shop:** a note whose photo is missing is simply left out, and the others close up.

## Banners and videos

**Content** (under Catalogue) holds the pictures a designer made and YouTube videos about your perfumes. Nothing shows on the shop until you add it and switch it on.

### Banners

Two places, each its own list:

- **Top of the shop:** across the top of the Shop page (`/fragrances`). With two or more, shoppers move between them with arrows, dots or a swipe. They never change by themselves.
- **Home, after the worlds:** on the home page, after the six worlds and before the Story, one under the other.

**Add a banner**: choose the wide picture (JPG, PNG, WebP or AVIF, under 4 MB) and say what it shows (read aloud to people who can't see it). Then, on its card:

- **Phone:** an optional upright picture for phones. Without one, phones show the wide picture.
- **Headline, Line under it, Button** (all optional) are drawn over the picture. **Words in** picks light words (for a dark picture) or dark words (for a light picture).
- **The words are in the picture:** tick it when the designer put them in; the shop draws none.
- **Leads to:** where a tap goes. A page on the site, like `/fragrances/reva` or `/discovery`, or a full `https://` address.
- **From / Until** (optional, Dhaka time): it shows only between these dates. Good for an Eid campaign.
- **On the shop:** the switch. Off keeps it here, hidden.
- **Move up / Move down** set the order; **Delete** removes it and its pictures.

Sizes that work well: a wide picture about 2400 × 1000 px, a phone picture about 1080 × 1350 px. Any shape works: the shop shows each picture whole, at its own proportions, never cropped. Keep the important part away from the edges.

### Videos

**Add a video**: paste a YouTube link (any kind: `youtu.be/…`, `watch?v=…`, Shorts). Give it a **Title**, **Who made it** (the channel, optional) and **About**: one perfume, or the house.

- Every video shows on the Shop page under "On YouTube". A video about one perfume also shows on that perfume's page.
- Shoppers see a still cover with a play mark. Nothing loads from YouTube and nothing moves until they tap it.
- **On the shop**, **Move up / Move down** and **Delete** work as for banners.

## Stock

**Inventory** shows every size, and every discovery set (tagged **Set**; it counts boxes):
- **In stock:** on the shelf.
- **Held:** bottles reserved by unpaid online orders, for up to 30 minutes.
- **Available:** what customers can buy.
- **Low at:** the level where it's flagged.
- **Value:** at shop prices.

Low and sold-out sizes are highlighted.

- **Add or remove stock:** open the size's adjustment, then:
  1. choose **Add bottles** or **Remove bottles**;
  2. enter **how many**;
  3. pick a **reason** (New stock arrived, Stock count correction, Damaged or broken, Used as a tester or gift, Other) and add a note (e.g. "Batch from the 12 Oct delivery").
  Removing asks you to press again to confirm.
- **Low at:** type a size's own low-stock level in its row. Leave it empty to use the default (Settings → Inventory).
- **History** (the second tab) lists every change ever made, with who made it and why: sales, cancellations, returns, adjustments. Stock always equals this history.
- **"3 waiting for a back-in-stock text":** shoppers who left their number on a sold-out size (**Notify me** on the shop). When you add stock to it, each gets one SMS, "ZALFI: Reva is back.", with the link. It goes through the SMS gateways in Integrations; one that fails is tried again the next time stock comes back.

## Reviews

Only someone who bought and received a fragrance can review it: their order's own page shows **Review your fragrances** once it's delivered, one review per bottle or set. Nothing shows on the shop until you've read it.

**Reviews** (under Catalogue) has three lists: **To read**, **On the shop**, **Not shown**. Each review shows its stars, the words, how the customer signed it, their name and the order.

- **Approve:** it goes on the fragrance's page (or the set's, on Discovery), and counts in the average shown beside the name.
- **Don't show:** it stays here, never on the shop. You can approve it later, and **Take off the shop** works the same way on an approved one.
- **Reply:** a few words from the house, shown under the review. Save it empty to remove it.

A fragrance with no approved review shows no reviews section at all. Every approval, rejection and reply is in the **Activity log**.

## Coupons

**Coupons → Create coupon**:
- **Code and discount:** the code customers type; a percentage off (with an optional cap), a fixed amount off, and/or **Free shipping**.
- **Rules:**
  - a minimum order;
  - **First order only** (checked by phone number);
  - **Total uses**, and **Per customer**;
  - **Starts** and **Ends**.
- **Applies to:** every fragrance, or **Only some fragrances**.
- **Note for the team:** not shown to customers.

One coupon per order. Each coupon's row shows its uses, the discount given and the revenue it brought in. Switch a coupon off with **Active**.

## Customers

**Customers** has everyone who ordered, one per verified phone number: their orders (and how many were unpaid, cancelled or returned), what they spent, and their first and last order. Filter by customers who came back, one-time customers, or those with no sale yet. Open one to see:
- every order;
- the addresses they've used;
- the fragrances they buy;
- one-click copy for phone, email and address.

## The Overview and Reports

**Overview** is the first screen:

- **Today so far:** revenue, orders, orders to pack, orders to send to a courier, low-stock sizes and failed deliveries. Each is compared with *this time yesterday*. Click a card for the list behind it.
- **A period** (today, 7, 30 or 90 days, this month, or **Custom**), with **Compare** to the period before.
- **Charts:**
  - revenue, orders and the average order over time;
  - top fragrances;
  - orders by status;
  - how customers paid;
  - inside or outside Dhaka;
  - bottle sizes.
  **Show the numbers** under each chart gives its table.
- **Needs attention:** unpaid orders about to lapse, failed payments, failed deliveries, return requests, sold-out sizes, and reviews waiting to be read.

**What counts as revenue:** orders placed in the period, less refunds. Orders waiting for payment, cancelled or returned don't count. Cash-on-delivery orders count the day they're placed.

**Reports** covers sales (by day, week or month), fragrances, sizes, stock value, coupons, zones (orders, shipping collected, delivery time and failures inside and outside Dhaka), and refunds and returns. Each has a chart, its full table and a **CSV** download. Everything is in Bangladesh time.

## Settings

The owner changes settings; managers can read some of them.

- **Store:** name, phone, email and address, used on receipts, invoices and labels.
- **Invoice:** business name and address, trade licence number, BIN, VAT (on and its rate), and a footer note. Each appears on receipts and invoices when filled in.
- **Shipping:**
  - the inside- and outside-Dhaka fees, and free shipping above an amount (optional);
  - **delivery times** inside and outside Dhaka ("1–2", "3–5"), shown on every product page and on Discovery as "usually 1–2 days". Leave one empty to say nothing;
  - which Dhaka areas pay the inside fee;
  - the default courier (from those switched on in Integrations).
- **Payments:** online payment on or off, cash on delivery on or off, and how long an unpaid online order holds its bottles. The gateways themselves, and bKash and Nagad by hand, are in **Integrations**. The shop's product pages and bag say how customers can pay (and whether there's cash on delivery) from these switches.
- **Inventory:** the default low-stock level.
- **Reviews:** whether approved reviews show on the shop, and whether a delivered order gets the email asking for one.
- **Permissions** (owner only): whether managers may issue refunds, and whether they see revenue figures.

Payment gateways, couriers, SMS and email are set up in **Integrations**, below.

## Integrations: gateways, couriers, SMS and email

**Integrations** (owner only; managers can look) has a card for every service: **SSLCommerz**, **aamarPay**, **bKash and Nagad (by hand)**, **Cash on delivery**, **Pathao**, **Steadfast**, **RedX**, **CarryBee**, **Other courier or own rider**; four SMS gateways (**BulkSMSBD**, **SSL Wireless**, **Alpha SMS**, **MiMSMS**) and four email services (**Resend**, **Brevo**, **Postmark**, **Your mailbox (SMTP)**).

- **The badge** says where it stands: **Not set up**, **Sandbox** (test only), **Live**, **Off**, or **Needs attention** (it's failing: the card says why).
- **The switch** turns it on or off at once. A gateway switched off takes no new payments, but payments already under way still settle. A courier switched off takes no new parcels, but keeps updating the ones it has.
- **Set up** opens its page:
  1. **Sandbox** or **Live**.
  2. The keys, each with where to find it in that provider's panel. Some have **Fill in the public sandbox account**. Pathao, RedX and CarryBee list your pickup stores after a test.
  3. **Save**. Keys are stored encrypted and never shown again: a saved one shows its last four characters, with **Replace**.
  4. **Test connection**. It checks the keys with the provider without changing anything that matters: a payment page opened and left, a store list, your balance, one SMS to the number you type (with the balance, for Alpha SMS and MiMSMS), one email to you (SMTP signs in first, so a wrong password is named plainly).
  5. **The webhook** (couriers) or **notification address** (gateways): the exact address, and the secret, to paste into the provider's panel, each with **Copy**. **Make a new secret** replaces it; paste the new one at once.
- **SMS and Email: the send order.** Switch on more than one, as a backup. The box at the top of each section lists the ones that are on, in order, with arrows to move them. Codes and receipts go with the first; if it refuses or doesn't answer, the next sends them by itself, and the one that failed shows **Needs attention**.
- **Checkout tries first** (top of Payments): with SSLCommerz and aamarPay both on, checkout uses this one, and the other takes over by itself if it can't open a payment page.
- **Someone changed a key in the provider's panel?** The next real call fails. The card shows **Needs attention** and the **Overview** lists it. Open **Set up**, replace the key, test again.
- **Keys from the hosting settings** (environment variables, from before this page existed) keep working. The card says so, and **Move them into the admin** copies them in so you can change them here.

Every change is in the **Activity log**: who changed which field (never the value), and every test.

## The team, and who can do what

**Team** (owner only):
- **Invite** a manager by email. They get a link that works once, for 48 hours, or copy the link and send it yourself.
- Change someone's **role**.
- **Switch off** an account at once (it's signed out everywhere).
- See when each person last signed in.

| | Owner | Manager |
|---|---|---|
| Orders, shipping, products, stock, coupons, customers, reports | Yes | Yes |
| Refunds | Yes | If the owner allows it (off at first) |
| Revenue figures | Yes | If the owner allows it (on at first) |
| Settings | Changes them | Reads shipping, payments and inventory |
| Team, Activity log, raw payment details | Yes | No |

**Activity log** (owner only) records every important action: who did it, when, and what changed. That covers sign-ins, stock changes, refunds, exports, settings and team changes. Search and filter it like any list.
