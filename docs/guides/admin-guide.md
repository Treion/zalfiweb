# The admin, day to day

A guide for the owner and the managers: how to run the shop from `/admin`. It follows an order from the moment it comes in to the moment it's delivered, then covers everything else.

- [Signing in](#signing-in)
- [Finding your way](#finding-your-way)
- [An order, from start to finish](#an-order-from-start-to-finish)
- [When a delivery fails, or a parcel comes back](#when-a-delivery-fails-or-a-parcel-comes-back)
- [Cancelling and refunding](#cancelling-and-refunding)
- [Products, photos and prices](#products-photos-and-prices)
- [Stock](#stock)
- [Coupons](#coupons)
- [Customers](#customers)
- [The Overview and Reports](#the-overview-and-reports)
- [Settings](#settings)
- [The team, and who can do what](#the-team-and-who-can-do-what)

## Signing in

Go to `https://your-domain/admin` and sign in with your email and password. You're signed out after 4 hours without activity.

- **Forgot your password?** The owner can reset any password from a terminal: `npm run admin -- reset-password you@example.com` (see the [deploy guide](deploy-vercel.md) for doing it against the live database).
- **New manager?** The owner invites you from **Team**. Your link works once, for 48 hours.
- **Light or dark:** the sun/moon button in the top bar. The admin remembers your choice.

## Finding your way

- **The sidebar:** Overview; then Sell (Orders, Customers, Payments, Shipping, Coupons); Catalogue (Products, Inventory); Insight (Reports); Admin (Settings, Team, Activity log). You see only what your role allows.
- **The number next to Orders** is how many orders are waiting to be packed.
- **Search** (top bar, or press `/` anywhere): an order number (`ZLF-002063`, or just `2063`), a phone number typed any way (`01712-345678`, `+880 1712 345678`), a name or email, a fragrance or a SKU. Arrow keys and Enter open a result. Enter alone shows every match.
- **Every list** has search, filters, sorting (click a column heading), pages, a **Columns** button to hide columns, and a **CSV** download of what you're looking at. Downloads are recorded in the Activity log, because they contain customer details.

## An order, from start to finish

### 1. It comes in

When a customer places an order, it appears in **Orders**, and the customer gets the e-receipt by email.

- **Cash on delivery** orders arrive **Confirmed**, ready to pack.
- **Online payment** orders arrive **Waiting for payment**. They become **Confirmed** by themselves when the payment is confirmed. An unpaid one cancels itself after 30 minutes (Settings → Payments), and its bottles go back on sale.

### 2. Pack it

Open the order (click its row). You'll see:
- the items and totals;
- the customer, with one-click **copy** for the phone number and the address;
- **Payment** and **Shipment** panels;
- the **Timeline** of everything that happened, where you can add **notes** for the team (customers never see them).

When the bottles are boxed, press **Mark packed**. For several at once: tick them in **Orders**, then **Mark packed**.

### 3. Send it to the courier

On the order, under **Shipment**, press **Send to courier**:
1. Choose the courier (your default is preselected). For Pathao, check the city and zone it matched from the address.
2. The dialog shows the cash the courier will collect (the total for unpaid cash-on-delivery orders, nothing for paid ones).
3. Press **Send**. The courier gives a consignment number, and the order shows **Packed** while it waits for pickup.

For several at once: tick them in **Orders**, then **Send to courier** and choose the courier.

### 4. Print the label

**Label** on the order prints ZALFI's 4 × 6 inch label: the order number, the customer, the cash to collect, the consignment number and a QR code of the tracking code. For several: tick them in **Orders** (or **Shipping**), then **Print labels**. One PDF, one label per page. Stick it on the box next to the courier's own sticker.

### 5. Let the courier do the rest

As the courier reports back, the order moves along by itself (**Shipped**, **Out for delivery**, **Delivered**), and each step lands on the timeline. A cash-on-delivery order becomes **Paid** on delivery. **Check** on the order asks the courier at once; otherwise the site asks every 30 minutes.

To move an order by hand (if a courier isn't connected, or you deliver yourself), use the buttons at the top: **Mark shipped**, **Out for delivery**, **Mark delivered**, or **More** for the rest.

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

## Cancelling and refunding

- **Cancel an order:** **More → Cancel order** on the order. It's offered until the courier has it. Tick **put the bottles back in stock**, and give a reason. ZALFI doesn't message the customer, so call them if they don't know.
- **Refund:** on the order, under **Payment**, press **Refund**:
  - full or part of what was paid, never more;
  - **Online payments** go back through SSLCommerz. The refund shows *Processing* until SSLCommerz confirms it (**Check** asks at once).
  - **Cash on delivery** orders are refunded by you (cash or a mobile transfer). The admin records it.
- A paid order that's cancelled or returned isn't refunded automatically. A note at the top of the order reminds you.
- Who may refund: the owner, and managers only if the owner allows it (Settings → Permissions).

**Needs attention** notes at the top of an order flag anything unusual: a payment that arrived after the order cancelled itself, a courier warning, a refund still owed. A note goes away once someone acts on the order.

## Products, photos and prices

**Products** lists each fragrance with its sizes, prices and stock. Open one to edit:

- **Details:** name, tagline, mood, story, the scent profile (family, longevity, sillage, seasons, moments), and **Published** (on the shop or hidden).
- **World and cap:** the fragrance's colours on the shop, with a preview, and the cap finish.
- **Bottle photo:** the main photograph: a cut-out bottle on a transparent background, as PNG or WebP, at least 600 × 600 px (2000 × 2000 is best). Upload a new one and the site checks it and bakes its lighting maps itself.
- **Gallery:** more photos, with descriptions for screen readers. Drag them into order.
- **Notes:** top, heart and base notes.
- **Sizes and prices:** each size's price (in taka), SKU, whether it's on sale, and its low-stock level.

Changes show on the shop at once. **New fragrance** (top of Products) adds one; the home page gains a chapter by itself.

## Stock

**Inventory** shows every size:
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
- **Needs attention:** unpaid orders about to lapse, failed payments, failed deliveries, return requests, sold-out sizes.

**What counts as revenue:** orders placed in the period, less refunds. Orders waiting for payment, cancelled or returned don't count. Cash-on-delivery orders count the day they're placed.

**Reports** covers sales (by day, week or month), fragrances, sizes, stock value, coupons, zones (orders, shipping collected, delivery time and failures inside and outside Dhaka), and refunds and returns. Each has a chart, its full table and a **CSV** download. Everything is in Bangladesh time.

## Settings

The owner changes settings; managers can read some of them.

- **Store:** name, phone, email and address, used on receipts, invoices and labels.
- **Invoice:** business name and address, trade licence number, BIN, VAT (on and its rate), and a footer note. Each appears on receipts and invoices when filled in.
- **Shipping:**
  - the inside- and outside-Dhaka fees, and free shipping above an amount (optional);
  - which Dhaka areas pay the inside fee;
  - the default courier, and each courier's status (Live, Sandbox, Not set up).
- **Payments:**
  - online payment on or off, cash on delivery on or off, and how long an unpaid order holds its bottles;
  - the **payment gateway** (the test gateway, or SSLCommerz).
- **Inventory:** the default low-stock level.
- **Permissions** (owner only): whether managers may issue refunds, and whether they see revenue figures.

Keys for payments, SMS, email and couriers are never typed into the admin. They live in the hosting settings (see the [deploy guide](deploy-vercel.md)). The admin shows whether each one is set.

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
