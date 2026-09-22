/**
 * The single typed source for ZALFI's catalogue.
 * - Seeds Postgres (src/db/seed.ts, M1).
 * - Serves as the read fallback when DATABASE_URL is absent, so builds never fail.
 * Prices are placeholders: edit them in the `variants` table once the DB is live.
 */
import type {
  CapFinish,
  Fragrance,
  FragranceNote,
  Note,
  NoteLayer,
  Palette,
} from "@/lib/fragrance";

const NOTE_DATA = {
  pineapple: {
    name: "Pineapple",
    alt: "A whole ripe pineapple with its green crown, cold and dewy",
  },
  mint: { name: "Mint", alt: "A fresh sprig of spearmint leaves" },
  lavender: { name: "Lavender", alt: "A small bundle of violet lavender stems" },
  oakmoss: { name: "Oakmoss", alt: "Grey-green oakmoss lichen on a piece of oak bark" },
  vetiver: { name: "Vetiver", alt: "A bundle of dried golden vetiver roots tied with twine" },
  "tonka-bean": { name: "Tonka Bean", alt: "A cluster of dark, wrinkled tonka beans" },
  cucumber: { name: "Cucumber", alt: "Half a cucumber with thin translucent slices" },
  jasmine: { name: "Jasmine", alt: "A sprig of white jasmine flowers and buds" },
  lime: { name: "Lime", alt: "A whole lime beside a halved lime" },
  patchouli: { name: "Patchouli", alt: "A sprig of broad patchouli leaves" },
  "green-apple": { name: "Green Apple", alt: "A glossy green apple with its stem and leaf" },
  tuberose: { name: "Tuberose", alt: "A stem of waxy white tuberose flowers" },
  cedarwood: { name: "Cedarwood", alt: "A cross-section of cedar showing its growth rings" },
  sandalwood: { name: "Sandalwood", alt: "Pale gold sandalwood sticks and chips" },
  apple: { name: "Apple", alt: "A red-blushed yellow apple" },
  coconut: { name: "Coconut", alt: "A coconut cracked in half, white flesh showing" },
  vanilla: { name: "Vanilla", alt: "Cured vanilla pods with a pale vanilla orchid" },
  iris: { name: "Iris", alt: "A single purple iris flower" },
  nutmeg: { name: "Nutmeg", alt: "A whole nutmeg wrapped in red mace beside a halved nutmeg" },
  oud: { name: "Oud", alt: "Dark oud wood chips veined with resin" },
  "precious-woods": {
    name: "Precious Woods",
    alt: "Polished offcuts of ebony, rosewood and amber-toned wood",
  },
  saffron: { name: "Saffron", alt: "A small mound of crimson saffron threads" },
  "red-rose": { name: "Red Rose", alt: "A single open deep-red rose" },
  "white-oud": { name: "White Oud", alt: "Pale blond oud wood shavings" },
  agarwood: { name: "Agarwood", alt: "A split section of agarwood marbled with dark resin" },
  musk: { name: "Musk", alt: "A small heap of grey-brown ambrette seeds" },
} as const satisfies Record<string, { name: string; alt: string }>;

export type NoteSlug = keyof typeof NOTE_DATA;

export const NOTES: Note[] = Object.entries(NOTE_DATA).map(([slug, n]) => ({
  slug,
  name: n.name,
  image: `/images/notes/${slug}.png`,
  alt: n.alt,
}));

const noteBySlug = new Map(NOTES.map((n) => [n.slug, n]));

type Pyramid = Record<NoteLayer, [NoteSlug, string][]>;

const pyramid = (p: Pyramid): FragranceNote[] =>
  (Object.entries(p) as [NoteLayer, [NoteSlug, string][]][]).flatMap(([layer, list]) =>
    list.map(([slug, label], position) => ({ ...noteBySlug.get(slug)!, layer, label, position })),
  );

const variants = (slug: string, p50: number, p100: number) => [
  {
    sku: `ZLF-${slug.toUpperCase()}-50`,
    sizeMl: 50,
    priceCents: p50 * 100,
    currency: "USD",
    stock: 25,
  },
  {
    sku: `ZLF-${slug.toUpperCase()}-100`,
    sizeMl: 100,
    priceCents: p100 * 100,
    currency: "USD",
    stock: 25,
  },
];

const fragrance = (
  sortOrder: number,
  slug: string,
  name: string,
  capFinish: CapFinish,
  palette: Palette,
  copy: { tagline: string; story: string; mood: string },
  notes: Pyramid,
  prices: [number, number],
): Fragrance => ({
  slug,
  name,
  ...copy,
  palette,
  capFinish,
  bottleImage: `/images/bottles/${slug}.png`,
  bottleAlt: `ZALFI ${name} eau de parfum: a smoked black glass cube with a ${capLabel[capFinish]} cap`,
  sortOrder,
  notes: pyramid(notes),
  variants: variants(slug, ...prices),
});

const capLabel: Record<CapFinish, string> = {
  silver: "ribbed polished silver",
  gunmetal: "ribbed gunmetal",
  gold: "ribbed polished gold",
  chrome: "mirrored chrome sphere",
  black: "glossy black sphere",
  "gold-sphere": "mirrored gold sphere",
};

export const FRAGRANCES: Fragrance[] = [
  fragrance(
    1,
    "reva",
    "Reva",
    "silver",
    { bg: "#DCD8E8", deep: "#5E6B4A", accent: "#CFE3D8", ink: "#1F2420" },
    {
      tagline: "Cold fruit and wild mint, laid over warm earth.",
      story:
        "Frost on pineapple skin, mint crushed between fingers. Then lavender and sunlit moss, and underneath it all the slow warmth of vetiver and tonka.",
      mood: "Frosted fougère",
    },
    {
      top: [
        ["pineapple", "Frosted Pineapple"],
        ["mint", "Crushed Wild Mint"],
      ],
      heart: [
        ["lavender", "French Lavender"],
        ["oakmoss", "Sunlit Oakmoss"],
      ],
      base: [
        ["vetiver", "Earthy Vetiver"],
        ["tonka-bean", "Warm Tonka Bean"],
      ],
    },
    [145, 210],
  ),
  fragrance(
    2,
    "riven",
    "Riven",
    "gunmetal",
    { bg: "#E3EEE9", deep: "#1E2B24", accent: "#C7D95A", ink: "#12201A" },
    {
      tagline: "A green so cold it rings like glass.",
      story:
        "Cucumber split open, jasmine in the shade. Mint and lime cut clean through, then patchouli and oakmoss settle like dusk on wet stone.",
      mood: "Cool greens, glassy light",
    },
    {
      top: [
        ["cucumber", "Crisp Cucumber"],
        ["jasmine", "Jasmine"],
      ],
      heart: [
        ["mint", "Cool Mint"],
        ["lime", "Zesty Lime"],
      ],
      base: [
        ["patchouli", "Rich Patchouli"],
        ["oakmoss", "Earthy Oakmoss"],
      ],
    },
    [145, 210],
  ),
  fragrance(
    3,
    "maree",
    "Maree",
    "gold",
    { bg: "#F1EEE6", deep: "#22302C", accent: "#9DB8AE", ink: "#1A2220" },
    {
      tagline: "White flowers at low tide, cedar still warm from the sun.",
      story:
        "A garden that runs down to the sea. Jasmine and green apple in the salt air, tuberose opening at dusk, and sandalwood holding the last of the day.",
      mood: "Seaside garden at dusk",
    },
    {
      top: [
        ["jasmine", "Jasmine"],
        ["green-apple", "Green Apple"],
        ["cucumber", "Cucumber"],
      ],
      heart: [
        ["tuberose", "Tuberose"],
        ["lavender", "Lavender"],
        ["cedarwood", "Cedarwood"],
      ],
      base: [
        ["sandalwood", "Sandalwood"],
        ["vetiver", "Vetiver"],
        ["patchouli", "Patchouli"],
      ],
    },
    [145, 210],
  ),
  fragrance(
    4,
    "solea",
    "Solea",
    "chrome",
    { bg: "#F4EAD8", deep: "#5A3A22", accent: "#E3B64B", ink: "#2B1D12" },
    {
      tagline: "Skin, sun, and a slow vanilla afternoon.",
      story:
        "Orchard fruit gone golden in the heat. Coconut and lavender on warm skin, and vanilla and tonka lingering long after the light has gone.",
      mood: "Warm sand and cream",
    },
    {
      top: [
        ["apple", "Apple"],
        ["pineapple", "Pineapple"],
      ],
      heart: [
        ["coconut", "Coconut"],
        ["lavender", "Lavender"],
      ],
      base: [
        ["vanilla", "Vanilla"],
        ["tonka-bean", "Tonka Bean"],
      ],
    },
    [145, 210],
  ),
  fragrance(
    5,
    "bond",
    "Bond",
    "black",
    { bg: "#2A2629", deep: "#141213", accent: "#B9B3C4", ink: "#F2EADB" },
    {
      tagline: "Iris in a dark suit, with oud keeping its secrets.",
      story:
        "Powdered iris and a grating of nutmeg. Oud and patchouli beneath the tailoring, and precious woods and vanilla worn close, like a secret.",
      mood: "Tailored iris and dark wood",
    },
    {
      top: [
        ["iris", "Iris"],
        ["nutmeg", "Nutmeg"],
      ],
      heart: [
        ["oud", "Oud"],
        ["patchouli", "Patchouli"],
      ],
      base: [
        ["precious-woods", "Precious Woods"],
        ["vanilla", "Vanilla"],
        ["sandalwood", "Sandalwood"],
      ],
    },
    [165, 240],
  ),
  fragrance(
    6,
    "oudor",
    "Oudor",
    "gold-sphere",
    { bg: "#4A0F1A", deep: "#2A080E", accent: "#C9962E", ink: "#F3E6D6" },
    {
      tagline: "Saffron and red rose, burning slowly into smoke and gold.",
      story:
        "Saffron threads and a red rose held too close to the flame. White oud and agarwood smoulder at the heart, and musk carries the embers into the night.",
      mood: "Burgundy, smoke, gold",
    },
    {
      top: [
        ["saffron", "Saffron"],
        ["red-rose", "Red Rose"],
      ],
      heart: [
        ["white-oud", "White Oud"],
        ["agarwood", "Agarwood"],
      ],
      base: [
        ["patchouli", "Patchouli"],
        ["musk", "Warm Musk"],
      ],
    },
    [185, 265],
  ),
];
