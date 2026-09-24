/** Domain types shared by the database layer, server components and the WebGL stage. */

export type NoteLayer = "top" | "heart" | "base";

export const NOTE_LAYERS: readonly NoteLayer[] = ["top", "heart", "base"];

export type Palette = {
  /** Page background of the fragrance's world */
  bg: string;
  /** Deep tone: shadows, floor, far haze */
  deep: string;
  /** Accent: rim light, caustics, details */
  accent: string;
  /** Text colour that passes WCAG AA on `bg` */
  ink: string;
};

export type CapFinish = "silver" | "gunmetal" | "gold" | "chrome" | "black" | "gold-sphere";

export type Season = "spring" | "summer" | "autumn" | "winter";
export type Moment = "day" | "evening" | "night";
export const SEASONS: readonly Season[] = ["spring", "summer", "autumn", "winter"];
export const MOMENTS: readonly Moment[] = ["day", "evening", "night"];

/**
 * The scent's character, shown on the product page. The seed values are suggestions read from
 * the notes: the owner confirms or edits them in the fragrances table (column `profile`).
 */
export type ScentProfile = {
  /** Olfactive family, e.g. "Aromatic fougère" */
  family: string;
  /** 1 (a few close hours) … 5 (into the next day) */
  longevity: 1 | 2 | 3 | 4 | 5;
  /** 1 (a skin scent) … 5 (fills the room) */
  sillage: 1 | 2 | 3 | 4 | 5;
  seasons: Season[];
  moments: Moment[];
};

export type Note = {
  slug: string;
  /** Canonical ingredient name, e.g. "Mint" */
  name: string;
  /** Public path, e.g. /images/notes/mint.png */
  image: string;
  alt: string;
};

export type FragranceNote = Note & {
  layer: NoteLayer;
  /** How this fragrance names the note, e.g. "Crushed Wild Mint" */
  label: string;
  position: number;
};

export type Variant = {
  sku: string;
  sizeMl: number;
  priceCents: number;
  currency: string;
  stock: number;
};

export type Fragrance = {
  slug: string;
  name: string;
  tagline: string;
  story: string;
  mood: string;
  palette: Palette;
  capFinish: CapFinish;
  bottleImage: string;
  bottleAlt: string;
  sortOrder: number;
  /** Null until the owner (or the seed) has set one: the product page then leaves it out */
  profile: ScentProfile | null;
  notes: FragranceNote[];
  variants: Variant[];
};

export const notesByLayer = (f: Pick<Fragrance, "notes">, layer: NoteLayer) =>
  f.notes.filter((n) => n.layer === layer).sort((a, b) => a.position - b.position);

/** CSS custom properties for a fragrance's world (read by bg-world-bg, text-world-ink, ...). */
export const worldVars = (f: Pick<Fragrance, "palette">) =>
  ({
    "--world-bg": f.palette.bg,
    "--world-deep": f.palette.deep,
    "--world-accent": f.palette.accent,
    "--world-ink": f.palette.ink,
  }) as import("react").CSSProperties;
