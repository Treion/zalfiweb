/**
 * The house's information pages. The owner writes the copy: paste it into `sections` (a heading
 * is optional; each paragraph is one string). Until a page has copy, it shows a short note with
 * the contact details instead of invented text.
 */
export type InfoSection = { heading?: string; paragraphs: string[] };

export type InfoPage = {
  slug: string;
  title: string;
  /** Footer group it belongs to */
  group: "house" | "help" | "legal";
  /** Search result / share description */
  description: string;
  sections: InfoSection[];
};

export const INFO_PAGES: InfoPage[] = [
  {
    slug: "about",
    title: "About us",
    group: "house",
    description: "The story of ZALFI, a perfume house from Dhaka.",
    sections: [],
  },
  {
    slug: "faq",
    title: "FAQ",
    group: "help",
    description: "Answers to common questions about ZALFI fragrances, orders and delivery.",
    sections: [],
  },
  {
    slug: "contact",
    title: "Contact",
    group: "help",
    description:
      "Reach ZALFI by phone, email, Facebook or Instagram, or visit us in Kakrail, Dhaka.",
    sections: [],
  },
  {
    slug: "refunds",
    title: "Refund & return policy",
    group: "help",
    description: "How refunds and returns work at ZALFI.",
    sections: [],
  },
  {
    slug: "payment-policy",
    title: "Payment policy",
    group: "help",
    description: "How you can pay for your ZALFI order.",
    sections: [],
  },
  {
    slug: "privacy",
    title: "Privacy policy",
    group: "legal",
    description: "How ZALFI collects, uses and protects your information.",
    sections: [],
  },
  {
    slug: "terms",
    title: "Terms & conditions",
    group: "legal",
    description: "The terms of using the ZALFI website and buying from us.",
    sections: [],
  },
];

export const infoPage = (slug: string) => INFO_PAGES.find((p) => p.slug === slug);
