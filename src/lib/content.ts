/**
 * Banners and videos the owner adds in Admin → Content: the small rules the shop follows (which
 * banners are showing, which YouTube video a link names). Pure and free of zod, so the shop's client
 * components can use them; what the admin's forms accept is in `content-schema.ts`.
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
