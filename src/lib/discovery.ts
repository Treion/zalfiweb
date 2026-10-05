/**
 * Discovery sets: three of the house fragrances in small vials, sold only as one boxed pack. They
 * stay out of the home experience and the stage: they live on bone paper (/discovery, a spread
 * after the Story, one-line hints), and are bought like any bottle.
 */
import type { Fragrance, Variant } from "./fragrance";

/** Exactly this many fragrances in every set */
export const SET_SIZE = 3;

export type SetVariant = Variant & { pieces: number };

export type SetFragrance = Pick<
  Fragrance,
  "slug" | "name" | "tagline" | "bottleImage" | "bottleAlt"
>;

export type DiscoverySet = {
  slug: string;
  name: string;
  tagline: string;
  /** For search engines and the product data; not shown as a paragraph */
  story: string;
  image: string;
  imageAlt: string;
  width: number;
  height: number;
  sortOrder: number;
  /** In box order */
  fragrances: SetFragrance[];
  /** The pack. Null while the set has no active price (it is then not shown) */
  variant: SetVariant | null;
};

/** The sets that hold a fragrance, for the "try it first" hints */
export const setsFor = (sets: DiscoverySet[], slug: string) =>
  sets.filter((s) => s.variant && s.fragrances.some((f) => f.slug === slug));

/** The other fragrances in the box, for "with Riven and Maree" */
export const companions = (set: DiscoverySet, slug: string) =>
  set.fragrances.filter((f) => f.slug !== slug).map((f) => f.name);
