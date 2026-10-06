import { z } from "zod";

/**
 * Banners and videos the owner adds in Admin → Content: what the forms accept, and the small rules
 * the shop follows (which banners are showing, where a link may lead, which YouTube video a link
 * names). Pure, so the admin, the server and the tests share them.
 */
export const BANNER_PLACEMENTS = ["shop", "home"] as const;
export type BannerPlacement = (typeof BANNER_PLACEMENTS)[number];
export const PLACEMENT_LABELS: Record<BannerPlacement, string> = {
  shop: "Top of the shop",
  home: "Home, after the worlds",
};

/** The 11-character id from any YouTube link (watch, youtu.be, shorts, embed, live) or the id itself */
export function youtubeIdOf(input: string): string | null {
  const v = input.trim();
  if (/^[\w-]{11}$/.test(v)) return v;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m|music)\./, "");
  let id: string | null = null;
  if (host === "youtu.be") id = url.pathname.slice(1).split("/")[0] ?? null;
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    id = url.searchParams.get("v");
    const m = url.pathname.match(/^\/(?:shorts|embed|live|v)\/([\w-]{11})/);
    if (!id && m) id = m[1]!;
  }
  return id && /^[\w-]{11}$/.test(id) ? id : null;
}

/** A video's cover (always there for public videos; the larger sizes aren't) */
export const youtubeCover = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
/** The privacy-enhanced player, started by the shopper's tap */
export const youtubePlayer = (id: string) =>
  `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;

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

/** Whether a banner shows now: switched on, and inside its dates when it has them */
export function isShowing(
  b: { active: boolean; startsAt: Date | string | null; endsAt: Date | string | null },
  now: Date = new Date(),
) {
  if (!b.active) return false;
  if (b.startsAt && new Date(b.startsAt) > now) return false;
  if (b.endsAt && new Date(b.endsAt) <= now) return false;
  return true;
}

/** A banner as the shop draws it */
export type ShopBanner = {
  id: number;
  image: { src: string; width: number; height: number };
  mobile: { src: string; width: number; height: number } | null;
  alt: string;
  headline: string | null;
  line: string | null;
  buttonLabel: string | null;
  link: string | null;
  tone: "light" | "dark";
  textInImage: boolean;
};

/** A video as the shop shows it */
export type ShopVideo = { id: number; youtubeId: string; title: string; channel: string | null };
