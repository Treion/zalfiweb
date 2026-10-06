import type { DiscoverySet } from "./discovery";
import type { Fragrance } from "./fragrance";

/**
 * The header search: a small index built on the server from the catalogue (a dozen entries), and
 * the matching, which runs in the browser as the shopper types. Pure, so it's tested on its own.
 */
export type SearchEntry = {
  kind: "fragrance" | "set" | "page";
  name: string;
  href: string;
  /** One line under the name: the mood, the set's contents, or what the page is for */
  line: string;
  /** Everything else it can be found by, lower-cased */
  words: string;
  /** For one-tap Add (fragrances and sets) */
  buy?: {
    sku: string;
    slug: string;
    sizeMl: number;
    pieces?: number;
    pricePoisha: number;
    image: string;
    soldOut: boolean;
  };
};

const PAGES: SearchEntry[] = [
  {
    kind: "page",
    name: "Track your order",
    href: "/track",
    line: "With its number and your phone",
    words: "track order parcel delivery where status courier",
  },
  {
    kind: "page",
    name: "Find your world",
    href: "/find",
    line: "Three questions, one fragrance",
    words: "quiz finder help choose recommend which",
  },
  {
    kind: "page",
    name: "Delivery and payment",
    href: "/payment-policy",
    line: "Fees, cash on delivery, bKash and Nagad",
    words: "delivery shipping cash cod bkash nagad card pay payment",
  },
  {
    kind: "page",
    name: "Refunds and returns",
    href: "/refunds",
    line: "If something isn't right",
    words: "refund return exchange broken damaged",
  },
  {
    kind: "page",
    name: "FAQ",
    href: "/faq",
    line: "Questions people ask",
    words: "faq questions help longevity authentic",
  },
  {
    kind: "page",
    name: "Contact",
    href: "/contact",
    line: "Phone, email, WhatsApp",
    words: "contact phone email whatsapp address",
  },
];

/** The index, built where the catalogue is loaded (the site layout) */
export function buildSearchIndex(fragrances: Fragrance[], sets: DiscoverySet[]): SearchEntry[] {
  const perfumes = fragrances.map((f): SearchEntry => {
    const v = f.variants[0];
    return {
      kind: "fragrance",
      name: f.name,
      href: `/fragrances/${f.slug}`,
      line: f.mood,
      words: [
        f.tagline,
        f.profile?.family,
        ...(f.profile?.moments ?? []),
        ...(f.profile?.seasons ?? []),
        ...f.notes.flatMap((n) => [n.name, n.label]),
        "eau de parfum perfume fragrance",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
      buy: v && {
        sku: v.sku,
        slug: f.slug,
        sizeMl: v.sizeMl,
        pricePoisha: v.pricePoisha,
        image: f.bottleImage,
        soldOut: v.stock <= 0,
      },
    };
  });
  const boxes = sets.map((s): SearchEntry => {
    const v = s.variant;
    return {
      kind: "set",
      name: s.name,
      href: `/discovery#${s.slug}`,
      line: `Discovery set: ${s.fragrances.map((f) => f.name).join(", ")}`,
      words: [
        s.tagline,
        ...s.fragrances.map((f) => f.name),
        "discovery set sample samples vials try gift box",
      ]
        .join(" ")
        .toLowerCase(),
      buy: v
        ? {
            sku: v.sku,
            slug: s.slug,
            sizeMl: v.sizeMl,
            pieces: v.pieces,
            pricePoisha: v.pricePoisha,
            image: s.image,
            soldOut: v.stock <= 0,
          }
        : undefined,
    };
  });
  return [...perfumes, ...boxes, ...PAGES];
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ঀ-৿]+/g, " ")
    .trim();

/**
 * Entries that match every word typed (each as the start of a word), best first: a match in the
 * name counts most, then in its line, then anywhere else. Ties keep the catalogue's order.
 */
export function searchEntries(index: SearchEntry[], query: string, limit = 8) {
  const terms = norm(query).split(" ").filter(Boolean);
  if (!terms.length) return [];
  const scored = index.flatMap((e, i) => {
    const fields = [norm(e.name), norm(e.line), norm(e.words)].map((f) => ` ${f}`);
    let score = 0;
    for (const t of terms) {
      const at = fields.findIndex((f) => f.includes(` ${t}`));
      if (at < 0) return [];
      score += [10, 4, 2][at]!;
      if (fields[0] === ` ${t}`) score += 10;
    }
    return [{ e, score, i }];
  });
  return scored
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, limit)
    .map((s) => s.e);
}

/** Suggestions for an empty box: only words that find something in this catalogue */
export function popularSearches(index: SearchEntry[], candidates: string[], count = 4) {
  return candidates.filter((c) => searchEntries(index, c, 1).length > 0).slice(0, count);
}

export const POPULAR = ["Fresh", "Oud", "Rose", "Vanilla", "Evening", "Winter", "Gift"];
