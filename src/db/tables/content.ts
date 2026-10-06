import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { fragrances } from "./catalogue";

/**
 * What the owner adds around the products from Admin → Content: banners a designer made (the top
 * of the shop, and the home page after the worlds) and YouTube videos (a creator reviewing a
 * perfume). Nothing here shows until it's added and switched on.
 */
const ts = (name: string) => timestamp(name, { withTimezone: true });

export const bannerPlacement = pgEnum("banner_placement", ["shop", "home"]);
export const bannerTone = pgEnum("banner_tone", ["light", "dark"]);

export const banners = pgTable(
  "banners",
  {
    id: serial("id").primaryKey(),
    placement: bannerPlacement("placement").notNull(),
    /** The wide picture (computers), kept whole */
    image: text("image").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    /** A taller picture for phones (null: the wide one is used) */
    mobileImage: text("mobile_image"),
    mobileWidth: integer("mobile_width"),
    mobileHeight: integer("mobile_height"),
    /** What the picture shows, read aloud */
    alt: text("alt").notNull(),
    /** Optional words drawn over the picture */
    headline: text("headline"),
    line: text("line"),
    buttonLabel: text("button_label"),
    /** Where the banner leads: a path on the site ("/fragrances/reva") or a full https address */
    link: text("link"),
    /** Light or dark words, for the picture behind them */
    tone: bannerTone("tone").notNull().default("light"),
    /** The designer put the words in the picture: draw none */
    textInImage: boolean("text_in_image").notNull().default(false),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    startsAt: ts("starts_at"),
    endsAt: ts("ends_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("banners_placement_idx").on(t.placement, t.active, t.sortOrder)],
);

export const videos = pgTable(
  "videos",
  {
    id: serial("id").primaryKey(),
    /** The 11-character YouTube id, from any YouTube link */
    youtubeId: text("youtube_id").notNull(),
    title: text("title").notNull(),
    /** Who made it ("Rafi's Reviews") */
    channel: text("channel"),
    /** The perfume it's about: shown on that product page (null: the shop only) */
    fragranceId: integer("fragrance_id").references(() => fragrances.id, { onDelete: "set null" }),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("videos_fragrance_idx").on(t.fragranceId, t.active)],
);
