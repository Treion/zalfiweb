import { INFO_NAV, type InfoGroup, type InfoSlug } from "./info-nav";

/**
 * The house's information pages. The copy is the owner's (docs/content/policies-original.md), rewritten in the
 * house voice at the owner's request: the same facts and terms, in plainer, warmer words. Change
 * the substance only with the owner.
 *
 * A page is a list of blocks. Text may hold links written as [label](/path).
 */
export type InfoBlock =
  /** The opening line, set large */
  | { kind: "lead"; text: string }
  /** "In short": three key facts */
  | { kind: "points"; items: { title: string; text: string }[] }
  | { kind: "text"; heading?: string; paragraphs: string[] }
  | { kind: "list"; heading?: string; intro?: string; items: string[] }
  /** Questions that open one at a time, with a search */
  | { kind: "faq"; items: { q: string; a: string[] }[] }
  /** Sections that open and close, with "open all" */
  | { kind: "accordion"; heading?: string; items: { title: string; body: string[] }[] }
  /** "What happened?": pick a case, see the answer */
  | {
      kind: "chooser";
      heading: string;
      intro?: string;
      options: {
        label: string;
        verdict: "covered" | "not-covered";
        answer: string[];
        steps?: string[];
      }[];
    }
  | { kind: "timeline"; heading?: string; items: { mark: string; text: string }[] }
  /** Three words; choosing one shows its meaning */
  | { kind: "pillars"; heading: string; intro: string; items: { word: string; text: string }[] }
  /** A split shown as a bar, e.g. a 50/50 preorder payment */
  | {
      kind: "split";
      heading: string;
      intro?: string;
      parts: { share: number; label: string; text: string }[];
      after?: string;
    }
  | { kind: "methods"; heading?: string; items: { name: string; text: string }[]; notes?: string[] }
  /** Rows of "what" and "why" */
  | { kind: "ledger"; heading: string; rows: { what: string; why: string }[] }
  | { kind: "quote"; text: string };

export type InfoPage = {
  slug: InfoSlug;
  title: string;
  group: InfoGroup;
  /** Search result / share description */
  description: string;
  blocks: InfoBlock[];
};

const CONTENT: Record<InfoSlug, { description: string; blocks: InfoBlock[] }> = {
  about: {
    description:
      "ZALFI is a niche perfume house from Bangladesh, built on fifty years of perfumery at Moon Perfumery House.",
    blocks: [
      {
        kind: "lead",
        text: "A perfume house from Bangladesh, built on fifty years of knowing scent.",
      },
      {
        kind: "text",
        heading: "Where we come from",
        paragraphs: [
          "ZALFI is a new name. Its roots are not.",
          "We are a sister concern of Moon Perfumery House. Since 1975, Moon has led Bangladesh's local perfumery and chemical industry.",
          "Moon built the science and the structure of fragrance. ZALFI brings the soul.",
        ],
      },
      {
        kind: "timeline",
        items: [
          { mark: "1975", text: "Moon Perfumery House opens, and begins shaping local perfumery." },
          { mark: "50 years", text: "Decades of formulas, sourcing and technical craft." },
          { mark: "Now", text: "ZALFI: scents that tell stories, stir feeling and stay with you." },
        ],
      },
      {
        kind: "pillars",
        heading: "The name",
        intro: "Zalfi means sword handle: the part you hold. It stands for three things.",
        items: [
          { word: "Strength", text: "Potent formulas with real presence." },
          {
            word: "Balance",
            text: "Rare aromatics from around the world, set against modern accords.",
          },
          { word: "Control", text: "Precision in every drop. Scents that hold, and endure." },
        ],
      },
      {
        kind: "text",
        heading: "Made for our weather",
        paragraphs: [
          "Heat and humidity break most perfumes by noon. Ours are built for them.",
          "We source the finest ingredients worldwide: rare absolutes, rich natural oils.",
          "Then we blend for long wear and real projection. The scent adapts, and lasts all day.",
        ],
      },
      {
        kind: "text",
        heading: "For collectors",
        paragraphs: [
          "ZALFI is also a way into collecting fragrance.",
          "Our Discovery Sets and limited editions let you explore, then own a piece of olfactory art.",
          "Fragrance, to us, is an experience, a statement and a legacy.",
        ],
      },
      { kind: "quote", text: "Strength in scent. Legacy in luxury." },
    ],
  },

  faq: {
    description: "Answers to common questions about ZALFI fragrances, payment and delivery.",
    blocks: [
      { kind: "lead", text: "Questions we hear often, answered plainly." },
      {
        kind: "faq",
        items: [
          {
            q: "What is ZALFI?",
            a: [
              "A niche perfume house from Bangladesh. We make original, high-quality fragrances, never copies.",
              "Our focus is craft, authenticity and scent that tells a story.",
            ],
          },
          {
            q: "What makes ZALFI niche?",
            a: [
              "We make small quantities from carefully chosen materials.",
              "Each composition is built for character and depth, not mass appeal.",
            ],
          },
          {
            q: "Are your perfumes inspired by other brands?",
            a: [
              "No. We don't make inspired or replica scents.",
              "Every ZALFI fragrance is an original composition, with its own identity.",
            ],
          },
          {
            q: "Where are they made?",
            a: [
              "In Bangladesh. We develop and curate every scent here.",
              "We use global perfumery practice, and a close knowledge of our climate, culture and taste.",
            ],
          },
          {
            q: "Why do you cost less than other niche brands?",
            a: [
              "Much of a niche price pays for branding and distribution. We skip most of that.",
              "The quality, the formulas and the craft stay exactly the same.",
            ],
          },
          {
            q: "How can I pay?",
            a: [
              "By bank transfer, bKash or Nagad.",
              "Cash on delivery works for items that aren't preorders, where the courier delivers.",
              "The details are in our [payment policy](/payment-policy).",
            ],
          },
          {
            q: "How long does it last on skin?",
            a: [
              "It depends on the fragrance and on your skin.",
              "Our concentrations are high, so expect a scent that lasts and evolves through the day.",
            ],
          },
          {
            q: "Do you deliver across Bangladesh?",
            a: [
              "Yes, to selected places across the country.",
              "Delivery times depend on where you are, and on the courier.",
            ],
          },
          {
            q: "How do I reach you?",
            a: [
              "For orders, collaborations or anything else, write to zalfi.elixir@gmail.com.",
              "Or call or WhatsApp +880 1810-524672. Everything is on our [contact page](/contact).",
            ],
          },
        ],
      },
    ],
  },

  contact: {
    description:
      "Reach ZALFI by phone, email, Facebook or Instagram, or visit us in Kakrail, Dhaka.",
    blocks: [],
  },

  refunds: {
    description: "ZALFI sales are final. Damaged or wrong items can be replaced within 24 hours.",
    blocks: [
      {
        kind: "lead",
        text: "Every bottle leaves us sealed and checked. So every sale is final.",
      },
      {
        kind: "points",
        items: [
          { title: "Final sale", text: "No refunds, returns or exchanges once it's delivered." },
          { title: "24 hours", text: "Damaged or wrong item? Tell us within a day of delivery." },
          {
            title: "Replacement",
            text: "Approved claims get the same product, while stock lasts.",
          },
        ],
      },
      {
        kind: "chooser",
        heading: "What happened?",
        intro: "Pick what fits, and we'll tell you where you stand.",
        options: [
          {
            label: "I changed my mind",
            verdict: "not-covered",
            answer: [
              "We can't take it back. Perfume is personal, and a sealed bottle is a hygienic one.",
              "Read the notes and details carefully before you order.",
            ],
          },
          {
            label: "I don't love the scent",
            verdict: "not-covered",
            answer: [
              "We're sorry it isn't the one. Scent preference isn't covered, though.",
              "Read the notes, and try our [Find your world](/find) guide before you order.",
            ],
          },
          {
            label: "It didn't agree with my skin",
            verdict: "not-covered",
            answer: [
              "Sensitivity or a reaction to a fragrance isn't covered, sadly.",
              "Check the notes for anything you react to before ordering.",
            ],
          },
          {
            label: "I ordered the wrong one",
            verdict: "not-covered",
            answer: [
              "A choice made by mistake isn't covered. All sales are final.",
              "Check your bag before you place the order.",
            ],
          },
          {
            label: "It arrived damaged",
            verdict: "covered",
            answer: [
              "We'll make it right. Contact us within 24 hours of delivery.",
              "Once we've checked, we may replace it with the same product, if it's in stock.",
              "We don't give refunds, even here.",
            ],
            steps: [
              "Clear photos of the product",
              "Photos of the outer packaging",
              "Your order number",
            ],
          },
          {
            label: "I got the wrong item",
            verdict: "covered",
            answer: [
              "Our mistake, and we'll fix it. Contact us within 24 hours of delivery.",
              "Once we've checked, we may replace it with the right product, if it's in stock.",
              "We don't give refunds, even here.",
            ],
            steps: [
              "Clear photos of the product",
              "Photos of the outer packaging",
              "Your order number",
            ],
          },
        ],
      },
      {
        kind: "accordion",
        heading: "The fine print",
        items: [
          {
            title: "What we can't consider",
            body: [
              "Bottles that have been used, opened or tampered with.",
              "Missing original packaging or labels.",
              "Claims about how a scent smells or performs.",
              "Damage that happened after delivery.",
              "Claims made after 24 hours, or without enough evidence.",
            ],
          },
          {
            title: "Who decides",
            body: [
              "ZALFI reviews every claim and makes the final call.",
              "Misuse, repeated claims or false reports may mean we refuse service.",
            ],
          },
          {
            title: "Your agreement",
            body: ["By buying from ZALFI, you confirm you've read and accept this policy in full."],
          },
        ],
      },
    ],
  },

  "payment-policy": {
    description: "How to pay for a ZALFI order: bank transfer, bKash, Nagad or cash on delivery.",
    blocks: [
      { kind: "lead", text: "Simple ways to pay, and every payment checked before we pack." },
      {
        kind: "methods",
        heading: "Ways to pay",
        items: [
          {
            name: "Bank transfer",
            text: "Pay straight into ZALFI's bank account. We share the details at checkout or when we confirm.",
          },
          { name: "bKash", text: "Pay through bKash, then give us the transaction reference." },
          { name: "Nagad", text: "Just like bKash: pay, then share the reference." },
          {
            name: "Cash on delivery",
            text: "Pay the courier. For items that aren't preorders, where the courier delivers.",
          },
        ],
        notes: [
          "Cash on delivery isn't available for preorder, limited edition or customised items.",
          "We may decline cash on delivery for an order's value, its area, or past order history.",
        ],
      },
      {
        kind: "split",
        heading: "Preorders",
        intro: "Some fragrances are made in small, careful batches. Those we take as preorders.",
        parts: [
          {
            share: 50,
            label: "Now",
            text: "An advance, by bank transfer, bKash or Nagad. Not cash.",
          },
          { share: 50, label: "On delivery", text: "The rest, when your bottle reaches you." },
        ],
        after: "We begin making and setting aside your bottle once the advance is verified.",
      },
      {
        kind: "accordion",
        heading: "Good to know",
        items: [
          {
            title: "When your order is confirmed",
            body: [
              "We confirm and process an order once its payment is verified.",
              "If confirmation is slow, we may hold the order. If we can't verify payment in reasonable time, we may cancel it.",
              "Double-check your payment details to avoid delays.",
            ],
          },
          {
            title: "Prices",
            body: [
              "Prices are in Bangladeshi Taka and include applicable taxes, unless we say otherwise.",
              "Any delivery charge is shown at checkout.",
              "Prices can change, but never on an order we've already confirmed.",
            ],
          },
          {
            title: "Failed or refused payments",
            body: [
              "If a payment fails or is incomplete, or a delivery is refused, we may cancel the order.",
              "A preorder advance may not be refundable, unless ZALFI cancelled the order.",
              "Any eligible refund follows our [refund and return policy](/refunds).",
            ],
          },
          {
            title: "Security",
            body: [
              "We may run checks on payments and orders, to keep shopping safe.",
              "Orders that look fraudulent may be delayed, declined or cancelled without notice.",
            ],
          },
        ],
      },
    ],
  },

  privacy: {
    description: "What ZALFI collects, why, who sees it, and your rights over it.",
    blocks: [
      {
        kind: "lead",
        text: "We treat your details as we treat our fragrances: with care and discretion.",
      },
      {
        kind: "points",
        items: [
          { title: "Only what's needed", text: "Your details, your orders, and basic site data." },
          { title: "Never sold", text: "We don't sell or trade your personal data. Ever." },
          {
            title: "No card storage",
            text: "Trusted gateways handle payment. We never keep card or bank details.",
          },
        ],
      },
      {
        kind: "ledger",
        heading: "What we collect, and why",
        rows: [
          {
            what: "Your name, phone, email and address",
            why: "To deliver your order, and tell you about it",
          },
          { what: "Your orders and payments", why: "To process them, and to help when you ask" },
          {
            what: "Your browser and how you use the site",
            why: "To keep the site working, and make it better",
          },
          { what: "Your consent to brand updates", why: "To send news, only if you said yes" },
        ],
      },
      {
        kind: "accordion",
        heading: "The detail",
        items: [
          {
            title: "Who we share it with",
            body: [
              "Only partners who help us take payment, deliver your order, or meet the law.",
              "Each of them must keep your data strictly confidential.",
            ],
          },
          {
            title: "How we protect it",
            body: [
              "We use sensible safeguards to protect your information.",
              "No system is perfectly secure, but we take every reasonable step.",
            ],
          },
          {
            title: "Cookies",
            body: [
              "Cookies help the site work and make browsing smoother.",
              "You can switch them off, but some features may stop working.",
            ],
          },
          {
            title: "Your rights",
            body: [
              "Ask us to see or correct your data, or to stop marketing messages.",
              "Reach us through any of our official channels, listed on our [contact page](/contact).",
            ],
          },
          {
            title: "All sales are final",
            body: [
              "Once payment is confirmed, we don't offer refunds or money back.",
              "Our [refund and return policy](/refunds) explains the exceptions.",
            ],
          },
          {
            title: "Changes to this policy",
            body: [
              "We may update this policy from time to time.",
              "Using the site after an update means you accept it.",
            ],
          },
          {
            title: "The law",
            body: [
              "This policy follows the laws of the People's Republic of Bangladesh.",
              "Bangladeshi courts have exclusive jurisdiction.",
            ],
          },
        ],
      },
      { kind: "text", paragraphs: ["By using our website, you agree to this policy."] },
    ],
  },

  terms: {
    description: "The terms for using the ZALFI website and buying from it.",
    blocks: [
      {
        kind: "lead",
        text: "The terms for using this site and buying from it, in plain words.",
      },
      {
        kind: "points",
        items: [
          { title: "Personal use", text: "We sell to individuals, for personal use only." },
          {
            title: "Online orders",
            text: "These terms cover this website, not shops or other sellers.",
          },
          { title: "Bangladesh law", text: "Any dispute goes to the courts of Bangladesh." },
        ],
      },
      {
        kind: "text",
        paragraphs: [
          "These terms apply to every visit and every order on this website. By using it, you accept them in full.",
        ],
      },
      {
        kind: "accordion",
        items: [
          {
            title: "Changes to these terms",
            body: [
              "We may update these terms at any time. Changes apply as soon as they're published.",
              "It's worth checking back now and then.",
            ],
          },
          {
            title: "Stock and accuracy",
            body: [
              "We do our best to keep stock right, but it can change.",
              "If something sells out after you order, we'll contact you quickly.",
              "Small errors in descriptions, images or prices can happen. We may correct them without notice.",
              "If your order had the wrong price, you choose: pay the right price, or cancel. If we can't reach you, we may cancel it.",
            ],
          },
          {
            title: "Our liability",
            body: [
              "Some services behind this site come from trusted partners. We can't answer for failures beyond our control.",
              "We aren't liable for indirect or consequential loss from using the site, or being unable to.",
              "We can't promise the site is always uninterrupted, error-free or fully secure.",
            ],
          },
          {
            title: "Our content",
            body: [
              "Fragrance names, logos, text, images and designs here belong to ZALFI or its licensors.",
              "You may view them for personal, non-commercial use.",
              "Copying, changing, sharing or selling them needs our written permission. No other rights are given.",
            ],
          },
          {
            title: "Trademarks",
            body: [
              "ZALFI, its name, emblem and branding are protected trademarks.",
              "Don't use or register them without our written permission. Browsing gives you no right to them.",
            ],
          },
          {
            title: "Your data",
            body: [
              "We use your details to process orders, help you, and share brand news only if you agree.",
              "We never sell them. We share them only to fulfil your order, or when the law requires.",
              "You can opt out, or ask to see, correct or delete your data, at any time.",
              "Orders may go through verification and security checks. We may delay or decline one that needs more.",
              "Our [privacy policy](/privacy) has the full detail.",
            ],
          },
          {
            title: "Cookies",
            body: [
              "Cookies run the site smoothly, remember your preferences and help us understand its use.",
              "Switching them off may break some features.",
            ],
          },
          {
            title: "Links to other sites",
            body: [
              "We may link to other websites. Their content and practices aren't ours to answer for.",
            ],
          },
          {
            title: "Prices and payment",
            body: [
              "Prices are in Bangladeshi Taka and include applicable taxes, unless we say otherwise.",
              "Shipping, if any, is added at checkout. You always see the final amount before you confirm.",
              "We may change prices. Payments go through secure gateways we approve.",
            ],
          },
          {
            title: "Delivery",
            body: [
              "We deliver to selected places in Bangladesh, and abroad where we can.",
              "Delivery times are estimates. Couriers and events can change them.",
              "For international orders, customs duties and import taxes are paid by the recipient.",
            ],
          },
          {
            title: "Returns and refunds",
            body: [
              "Our [refund and return policy](/refunds) sets out exactly what we accept.",
              "In short: sales are final. A damaged or wrong item can be replaced, if you tell us within 24 hours of delivery.",
            ],
          },
          {
            title: "Damaged items",
            body: [
              "Every order is checked and packed with care before it leaves.",
              "If yours arrives damaged, tell the courier straight away. Then send us photos.",
              "Once we've reviewed it, we may replace it. Claims outside our policy may be declined.",
            ],
          },
          {
            title: "Misuse",
            body: [
              "Misusing the site, breaking these terms, or using our brand without permission may lead to blocked access and legal action.",
            ],
          },
          {
            title: "Events beyond our control",
            body: [
              "We aren't responsible for delays we can't control.",
              "That includes natural disasters, government action, strikes, power cuts and internet outages.",
            ],
          },
          {
            title: "Governing law",
            body: [
              "These terms follow the laws of the People's Republic of Bangladesh.",
              "Bangladeshi courts have exclusive jurisdiction over any dispute.",
            ],
          },
        ],
      },
    ],
  },
};

export const INFO_PAGES: InfoPage[] = INFO_NAV.map((p) => ({ ...p, ...CONTENT[p.slug] }));

export const infoPage = (slug: string) => INFO_PAGES.find((p) => p.slug === slug);
