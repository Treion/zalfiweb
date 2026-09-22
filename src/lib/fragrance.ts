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
  notes: FragranceNote[];
  variants: Variant[];
};

export const notesByLayer = (f: Pick<Fragrance, "notes">, layer: NoteLayer) =>
  f.notes.filter((n) => n.layer === layer).sort((a, b) => a.position - b.position);
