import { z } from "zod";
import { AA_TEXT, contrastRatio } from "@/lib/contrast";
import { SET_SIZE } from "@/lib/discovery";
import { MOMENTS, SEASONS, type ScentProfile } from "@/lib/fragrance";

/**
 * The catalogue's input rules, shared by the admin forms (instant feedback) and the server (which
 * enforces them). Money is in poisha.
 */
const hex = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use a colour like #1a2b3c")
  .transform((s) => s.toLowerCase());

export const CAP_FINISHES = [
  "silver",
  "gunmetal",
  "gold",
  "chrome",
  "black",
  "gold-sphere",
] as const;

export const paletteSchema = z
  .object({ bg: hex, deep: hex, accent: hex, ink: hex })
  .strict()
  .refine((p) => contrastRatio(p.ink, p.bg) >= AA_TEXT, {
    message: `The text colour needs a contrast of at least ${AA_TEXT}:1 on the background, so it stays readable.`,
    path: ["ink"],
  });

export const profileSchema = z
  .object({
    family: z.string().trim().min(2).max(60),
    longevity: z.number().int().min(1).max(5),
    sillage: z.number().int().min(1).max(5),
    seasons: z.array(z.enum(SEASONS as unknown as [string, ...string[]])).max(4),
    moments: z.array(z.enum(MOMENTS as unknown as [string, ...string[]])).max(3),
  })
  .strict()
  // The ranges above are exactly ScentProfile's
  .transform((p) => p as ScentProfile);

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z][a-z0-9-]{1,30}$/, "Lowercase letters, numbers and dashes, starting with a letter");

/** Everything about a fragrance except its photo, sizes and notes */
export const fragranceDetailsSchema = z
  .object({
    name: z.string().trim().min(1, "Give it a name").max(40),
    tagline: z.string().trim().min(1, "Add a tagline").max(140),
    mood: z.string().trim().min(1).max(60),
    story: z.string().trim().max(2000),
    bottleAlt: z
      .string()
      .trim()
      .min(10, "Describe the bottle for people who can't see it")
      .max(200),
    capFinish: z.enum(CAP_FINISHES),
    palette: paletteSchema,
    profile: profileSchema.nullable(),
    sortOrder: z.number().int().min(0).max(999),
    published: z.boolean(),
  })
  .strict();

export const newFragranceSchema = fragranceDetailsSchema
  .pick({ name: true, tagline: true, mood: true, capFinish: true, palette: true })
  .extend({ slug: slugSchema })
  .strict();

export const variantSchema = z
  .object({
    sizeMl: z.number().int().min(1).max(1000),
    sku: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9][A-Z0-9-]{2,39}$/, "Capital letters, numbers and dashes (3–40)"),
    pricePoisha: z.number().int().min(100, "At least ৳1").max(10_000_000),
    lowStockThreshold: z.number().int().min(0).max(10_000).nullable(),
    active: z.boolean(),
  })
  .strict();

export const notesSchema = z
  .array(
    z
      .object({
        noteSlug: z.string().min(1).max(60),
        layer: z.enum(["top", "heart", "base"]),
        label: z.string().trim().min(1).max(60),
      })
      .strict(),
  )
  .max(30);

/** A note in the library (Admin → Notes): its name and how its photo is described */
export const noteDetailsSchema = z
  .object({
    name: z.string().trim().min(2, "Give the note a name.").max(40),
    alt: z
      .string()
      .trim()
      .min(6, "Describe the photo in a few words (for screen readers).")
      .max(160),
  })
  .strict();

/** A note's slug from its name: "Pink Pepper" → pink-pepper */
export const noteSlugOf = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

export const ADJUST_REASONS = [
  { value: "restock", label: "New stock arrived" },
  { value: "count", label: "Stock count correction" },
  { value: "damaged", label: "Damaged or broken" },
  { value: "sample", label: "Used as a tester or gift" },
  { value: "other", label: "Other" },
] as const;

export const stockAdjustSchema = z
  .object({
    variantId: z.number().int().positive(),
    delta: z
      .number()
      .int()
      .min(-10_000)
      .max(10_000)
      .refine((n) => n !== 0, "Enter how many to add or remove"),
    reason: z.enum(ADJUST_REASONS.map((r) => r.value) as [string, ...string[]]),
    note: z.string().trim().max(200),
  })
  .strict()
  .refine((a) => a.reason !== "other" || a.note.length >= 3, {
    message: "Say why, in a few words",
    path: ["note"],
  });

/* Discovery sets ------------------------------------------------------------------------------ */

/** What's in the box: exactly three different fragrances, in box order */
export const setFragrancesSchema = z
  .array(z.number().int().positive())
  .length(SET_SIZE, `Choose ${SET_SIZE} fragrances.`)
  .refine((ids) => new Set(ids).size === ids.length, "Choose three different fragrances.");

/** Everything about a set except its contents, photo and pack */
export const setDetailsSchema = z
  .object({
    name: z.string().trim().min(1, "Give it a name").max(40),
    tagline: z.string().trim().min(1, "Add a tagline").max(140),
    story: z.string().trim().max(2000),
    imageAlt: z.string().trim().min(10, "Describe the box for people who can't see it").max(200),
    sortOrder: z.number().int().min(0).max(999),
    published: z.boolean(),
  })
  .strict();

/** The pack: the vial size and the price. It always holds one vial of each fragrance. */
export const setPackSchema = z
  .object({
    sizeMl: z.number().int().min(1, "At least 1 ml").max(30, "Decants are 30 ml at most"),
    pricePoisha: z.number().int().min(100, "At least ৳1").max(10_000_000),
    lowStockThreshold: z.number().int().min(0).max(10_000).nullable(),
    active: z.boolean(),
  })
  .strict();

export const newSetSchema = setDetailsSchema
  .pick({ name: true, tagline: true, imageAlt: true })
  .extend({
    slug: slugSchema,
    fragranceIds: setFragrancesSchema,
    sizeMl: setPackSchema.shape.sizeMl,
    pricePoisha: setPackSchema.shape.pricePoisha,
  })
  .strict();
