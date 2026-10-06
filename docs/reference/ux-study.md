# ZALFI shopper study

How niche and direct-to-consumer perfume sites are built, how ZALFI compared, what was missing, and what was done about it. Written 2026-10-06, after the owner asked for a site that wins awards *and* lets customers "get in and find what they want".

The shareable version (with the interactive chart) is the "ZALFI shopper study" page on claude.ai: https://claude.ai/artifact/FpE1oQvRvZKi5YUXqFKf97 (private to the owner until shared). This file is the copy that lives with the code.

## What the field looks like

Three kinds of sites were studied:

- **Niche houses:** Le Labo, Byredo. Quiet, editorial, few products. Strong on samples, gift packaging and personalisation (Le Labo's labels), weak on reviews.
- **Young direct-to-consumer brands:** Snif, Phlur. Built to convert people aged 18–30: try before you buy, discovery sets, a quiz, reviews everywhere, free-shipping progress in the bag.
- **Bangladeshi perfume shops:** FragranceBD, BPIB and others. Plain design, but they answer the local questions first: cash on delivery and its limits, bKash, delivery inside and outside Dhaka, and WhatsApp. Decants are a big business.

What the evidence says matters:

- **Awwwards** scores a Site of the Day on design (40%), **usability (30%)**, creativity (20%) and content (10%). Usability was ZALFI's weakest part.
- **Baymard Institute** (large-scale usability testing):
  - 64% of shoppers look for the shipping cost on the product page, before adding to the bag.
  - Shoppers act on a delivery *date* (or a usual number of days) more than on a delivery *speed*.
  - 95% rely on reviews to judge a product.
  - Mobile navigation and product lists are where most sites fail.
- **Bangladesh:** about 80% of e-commerce happens on phones, and cash on delivery is 80–90% of e-commerce payments.

## How these sites are built, page by page

| Page | What the field does |
|---|---|
| Home | Brand story and a hero product, then a way into the whole range, the quiz and the samples |
| All products | One grid of everything, filtered by family, mood or note, with a one-tap Add |
| Product page | Bottle, price, size and Add; **delivery cost, time and ways to pay next to the button**; notes; reviews; similar scents; a pointer to the sample set |
| Bag | A drawer, with how far it is to free delivery |
| Checkout | Guest checkout; in Bangladesh, cash on delivery and bKash shown plainly |
| After the order | A tracking page, a review request after delivery, back-in-stock alerts, gift notes |
| Help | WhatsApp or chat in reach, an FAQ |

## The gap chart

● has it · ◐ partly · ○ missing. The field columns are what's typical among the sites studied, not a rule for every one of them.

| # | Feature | Niche | DTC | BD shops | ZALFI before | ZALFI now | Decision |
|---|---|---|---|---|---|---|---|
| 1 | Full menu on phones | ● | ● | ● | ○ only Info and the bag | ● Menu | Built |
| 2 | All fragrances on one page, with filters | ◐ | ● | ● | ◐ only inside the scroll | ● `/fragrances` | Built |
| 3 | Site search | ● | ● | ● | ○ | ○ | Not needed: eight products, the filters do it |
| 4 | Scent finder or quiz | ○ | ● | ○ | ● `/find` | ● | Strength |
| 5 | Discovery or sample sets | ● | ● | ◐ decants | ● | ● | Strength |
| 6 | Notes, longevity, sillage | ◐ | ● | ◐ | ● with real photos | ● | Strength |
| 7 | Delivery fee and time on the product page | ◐ | ◐ | ● | ○ | ● times set in Settings | Built |
| 8 | Cash on delivery and ways to pay before checkout | ○ | ○ | ● | ○ checkout only | ● | Built |
| 9 | Free-delivery threshold and progress | ● | ● | ◐ | ○ set, never shown | ● | Built |
| 10 | Reviews | ◐ | ● | ◐ | ○ | ● verified buyers, approved first | Built |
| 11 | WhatsApp or chat | ◐ | ◐ | ● | ◐ number in the FAQ | ● in context | Built |
| 12 | Order tracking page | ● | ● | ◐ | ◐ links in messages | ● `/track` | Built |
| 13 | Back-in-stock alert | ● | ● | ○ | ○ | ● by SMS | Built |
| 14 | Gift note | ● | ◐ | ○ | ○ | ● free, printed card | Built |
| 15 | Similar scents | ● | ● | ● | ◐ "Next world" only | ● Similar worlds | Built |
| 16 | Guest checkout, local payments | ◐ | ● | ● | ● | ● | Strength |
| 17 | Reduced motion and accessibility | ○ | ○ | ○ | ● | ● | Strength |
| 18 | Accounts and wishlist | ● | ● | ◐ | ○ | ○ | Later: guest checkout with a phone code suits Bangladesh |
| 19 | Newsletter or SMS list | ● | ● | ◐ | ○ removed at the owner's request | ○ | Later; the restock alert covers part of it |
| 20 | Bangla | ○ | ○ | ◐ | ○ | ○ | Later, the owner's call |
| 21 | Analytics (Meta, Google) | ● | ● | ● | ○ | ○ | Later: needs the owner's accounts |
| 22 | Personalised label or engraving | ● Le Labo | ○ | ○ | ○ | ○ | Not now: needs production |
| 23 | Speed (Core Web Vitals) | — | — | — | not measured | ● measured, below | Measured |

**ZALFI before:** 5 of 23 fully, 4 partly. **ZALFI now:** 17 of 23 fully. The six left are one "not needed" and five deliberate "later"s.

## What ZALFI has that the others don't

The six-bottle line-up and the chapters, each bottle the real photograph relit live; a calm site with no idle motion; notes shown as real photographs; a finder whose answer is lit on the stage; a complete static version for reduced motion. None of the sites studied has all of these. The changes keep them untouched: every new page is on bone paper, outside the stage.

## What was built

1. **Find and browse:** Menu on phones; `/fragrances` with Wear it, Season and By note filters kept in the address; two Similar worlds on each product page.
2. **Buy with confidence:** delivery fee and usual days inside and outside Dhaka (set in Settings → Shipping), free delivery, ways to pay and WhatsApp under Add to bag, on Discovery and in the bag; the bag shows how far it is to free delivery.
3. **After the order:** `/track`; Notify me on sold-out sizes (one SMS when stock returns); a free gift note, printed as an A6 card, with GIFT on the label.
4. **Reviews:** verified buyers only, written from the delivered order's page, read and approved in Admin → Reviews, with the house's replies; one email after delivery asks for them. Nothing shows until the first approval.

## Measured

Lighthouse 13 on the production build (local server), 6 October 2026:

| Page | Desktop: performance / accessibility / best practices / SEO | Mobile: performance | LCP desktop / mobile | CLS |
|---|---|---|---|---|
| `/` | 99 / 100 / 100 / 100 | 87 | 0.8 s / 3.2 s | 0 |
| `/fragrances` | 100 / 96 / 100 / 100 | 90 | 0.8 s / 3.6 s | 0 |
| `/fragrances/reva` | 100 / 100 / 100 / 100 | 93 | 0.8 s / 3.2 s | 0 |

`/fragrances` loses points only to the nav's contrast check, which Lighthouse can't compute: the nav draws white with `mix-blend-difference`, which shows near-black on bone paper. The cards' accessible names were fixed after this run. The calm check passed on every page with no input, `/fragrances` and `/track` included.

## Sources

- Baymard Institute: [Current state of e-commerce product page UX](https://baymard.com/research-articles/current-state-ecommerce-product-page-ux) (64% look for shipping costs; 95% rely on reviews), [Show shipping costs on product pages](https://baymard.com/research-articles/show-shipping-costs-on-product-pages), [Shipping speed vs. delivery date](https://baymard.com/research-articles/shipping-speed-vs-delivery-date), [Mobile navigation: "view all"](https://baymard.com/research-articles/mobile-main-nav-view-all), [Mobile filtering benchmark](https://baymard.com/mcommerce-usability/benchmark/mobile-page-types/filtering-options), [User reviews section benchmark](https://baymard.com/product-page/benchmark/page-designs/user-reviews-section)
- Awwwards judging: [hontran.dev, Awwwards judging criteria](https://www.hontran.dev/blog/awwwards-judging-criteria), [utsubo.com, award-winning website design guide](https://www.utsubo.com/blog/award-winning-website-design-guide)
- Bangladesh: [easysellapp.com, Bangladesh e-commerce, bKash and COD](https://easysellapp.com/blogs/wiki/bangladesh-ecommerce-bkash-mobile-money-cod-shopify-market-entry-2026), [egrow.com, Bangladesh COD and WhatsApp](https://www.egrow.com/en/blog/bangladesh-cod-whatsapp-2026), [Dhaka Tribune, Merchants of fragrance](https://www.dhakatribune.com/magazine/weekend-tribune/159204/merchants-of-fragrance), [FragranceBD](https://fragrancebd.com/about-us/)
- DTC brands: [Glossy, Snif is reinventing perfume for young online shoppers](https://www.glossy.co/beauty/snif-is-reinventing-perfume-for-young-online-shoppers/?amp=1), [The Quality Edit, Snif review](https://www.thequalityedit.com/articles/snif-review), [Snif](https://snif.co/products/honorable-mention)
- Niche houses: [Le Labo refills](https://www.lelabofragrances.com/le-labo-refills.html), [Le Labo product page (personalised label)](https://lelabofragrances.com/labdanum-18-305.html)
