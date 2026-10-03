/**
 * The house's information pages, as the nav and footer list them. Light on purpose: the nav ships
 * this to the browser, so the pages' copy (content/pages.ts) stays on the server.
 */
export type InfoGroup = "house" | "help" | "legal";

export const INFO_NAV = [
  { slug: "about", title: "About us", group: "house" },
  { slug: "faq", title: "FAQ", group: "help" },
  { slug: "contact", title: "Contact", group: "help" },
  { slug: "refunds", title: "Refund & return policy", group: "help" },
  { slug: "payment-policy", title: "Payment policy", group: "help" },
  { slug: "privacy", title: "Privacy policy", group: "legal" },
  { slug: "terms", title: "Terms & conditions", group: "legal" },
] as const satisfies readonly { slug: string; title: string; group: InfoGroup }[];

export type InfoSlug = (typeof INFO_NAV)[number]["slug"];

export const INFO_GROUP_LABELS: Record<InfoGroup, string> = {
  house: "The house",
  help: "Help",
  legal: "Legal",
};

export const isInfoPath = (pathname: string) => INFO_NAV.some((p) => pathname === `/${p.slug}`);
