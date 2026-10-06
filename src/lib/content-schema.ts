import { z } from "zod";
import { youtubeIdOf } from "./content";

/**
 * What the forms in Admin → Content accept. Kept apart from `content.ts` so zod never reaches the
 * shop's client components (the video card only needs the YouTube helpers).
 */

/** Where a banner may lead: a page on the site ("/fragrances/reva") or a full https address */
export const linkSchema = z
  .string()
  .trim()
  .max(300)
  .refine(
    (v) => v === "" || /^\/(?!\/)\S*$/.test(v) || /^https:\/\/[^\s/]+\.\S+$/.test(v),
    "Use a page on the site (like /fragrances/reva) or a full https:// address.",
  );

const optional = (max: number) => z.string().trim().max(max);

export const bannerDetailsSchema = z
  .object({
    alt: z.string().trim().min(3, "Describe the picture for people who can't see it.").max(200),
    headline: optional(80),
    line: optional(140),
    buttonLabel: optional(30),
    link: linkSchema,
    tone: z.enum(["light", "dark"]),
    textInImage: z.boolean(),
    active: z.boolean(),
    /** ISO instants (the admin types Dhaka time), or null for no limit */
    startsAt: z.iso.datetime({ offset: true }).nullable(),
    endsAt: z.iso.datetime({ offset: true }).nullable(),
  })
  .strict()
  .refine((b) => !b.startsAt || !b.endsAt || new Date(b.endsAt) > new Date(b.startsAt), {
    message: "The end has to come after the start.",
    path: ["endsAt"],
  });
export type BannerDetails = z.output<typeof bannerDetailsSchema>;

export const videoInputSchema = z
  .object({
    url: z
      .string()
      .trim()
      .max(300)
      .refine((v) => youtubeIdOf(v) !== null, "Paste a YouTube link, like youtu.be/…"),
    title: z.string().trim().min(1, "Give it a title.").max(120),
    channel: optional(80),
    fragranceId: z.number().int().positive().nullable(),
    active: z.boolean(),
  })
  .strict();
