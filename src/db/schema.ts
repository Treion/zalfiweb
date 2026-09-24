import {
  boolean,
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
    /** Placeholder prices. Edit freely: the site reads them live (ISR). */
    priceCents: integer("price_cents").notNull(),
    currency: text("currency").notNull().default("USD"),
    stock: integer("stock").notNull().default(0),
  },
  (t) => [
    uniqueIndex("variants_sku_idx").on(t.sku),
    index("variants_fragrance_idx").on(t.fragranceId),
  ],
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
