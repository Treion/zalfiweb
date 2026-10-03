import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { BottleMeta } from "@/components/stage/bottle-meta";
import type { Palette, ScentProfile } from "@/lib/fragrance";

export const noteLayer = pgEnum("note_layer", ["top", "heart", "base"]);
export const capFinish = pgEnum("cap_finish", [
  "silver",
  "gunmetal",
  "gold",
  "chrome",
  "black",
  "gold-sphere",
]);

export const fragrances = pgTable(
  "fragrances",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    tagline: text("tagline").notNull(),
    story: text("story").notNull(),
    mood: text("mood").notNull(),
    palette: jsonb("palette").$type<Palette>().notNull(),
    capFinish: capFinish("cap_finish").notNull(),
    bottleImage: text("bottle_image").notNull(),
    bottleAlt: text("bottle_alt").notNull(),
    /** Layout data of an admin-uploaded bottle photo (trim, shoulder, cap). Null: the generated
     *  BOTTLE_META for this slug (the six launch bottles, baked by `npm run assets:bottles`). */
    bottleMeta: jsonb("bottle_meta").$type<BottleMeta>(),
    /** URL prefix of that photo's relighting maps: `${bottleMaps}-color.webp`, -normal, -mask.
     *  Null: /images/bottles/maps/{slug}. */
    bottleMaps: text("bottle_maps"),
    sortOrder: integer("sort_order").notNull().default(0),
    /** Family, longevity, sillage, seasons and moments (see ScentProfile). Null hides it. */
    profile: jsonb("profile").$type<ScentProfile>(),
    published: boolean("published").notNull().default(true),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("fragrances_slug_idx").on(t.slug)],
);

export const notes = pgTable(
  "notes",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    image: text("image").notNull(),
    alt: text("alt").notNull(),
  },
  (t) => [uniqueIndex("notes_slug_idx").on(t.slug)],
);

export const fragranceNotes = pgTable(
  "fragrance_notes",
  {
    fragranceId: integer("fragrance_id")
      .notNull()
      .references(() => fragrances.id, { onDelete: "cascade" }),
    noteId: integer("note_id")
      .notNull()
      .references(() => notes.id, { onDelete: "restrict" }),
    layer: noteLayer("layer").notNull(),
    /** How this fragrance names the note, e.g. "Crushed Wild Mint" */
    label: text("label").notNull(),
    position: integer("position").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.fragranceId, t.noteId, t.layer] }),
    index("fragrance_notes_fragrance_idx").on(t.fragranceId),
  ],
);

export const variants = pgTable(
  "variants",
  {
    id: serial("id").primaryKey(),
    fragranceId: integer("fragrance_id")
      .notNull()
      .references(() => fragrances.id, { onDelete: "cascade" }),
    sku: text("sku").notNull(),
    sizeMl: integer("size_ml").notNull(),
    /** Price in poisha (1 taka = 100 poisha). BDT only. Edited in the admin (Products). */
    pricePoisha: integer("price_poisha").notNull().default(0),
    stock: integer("stock").notNull().default(0),
    /** Below this, the size counts as low stock. Null uses the default from Settings. */
    lowStockThreshold: integer("low_stock_threshold"),
    /** Inactive sizes are hidden from the storefront and can't be ordered */
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("variants_sku_idx").on(t.sku),
    index("variants_fragrance_idx").on(t.fragranceId),
    check("variants_stock_nonnegative", sql`${t.stock} >= 0`),
    check("variants_price_nonnegative", sql`${t.pricePoisha} >= 0`),
  ],
);

/** Gallery images for a fragrance (product page, receipts), in order. The hero bottle photo stays
 *  `fragrances.bottle_image`, which the WebGL stage relights. */
export const fragranceImages = pgTable(
  "fragrance_images",
  {
    id: serial("id").primaryKey(),
    fragranceId: integer("fragrance_id")
      .notNull()
      .references(() => fragrances.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    alt: text("alt").notNull(),
    position: integer("position").notNull().default(0),
    width: integer("width"),
    height: integer("height"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("fragrance_images_fragrance_idx").on(t.fragranceId, t.position)],
);

export const newsletterSignups = pgTable(
  "newsletter_signups",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    source: text("source").notNull().default("site"),
    consent: boolean("consent").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("newsletter_email_idx").on(t.email)],
);
