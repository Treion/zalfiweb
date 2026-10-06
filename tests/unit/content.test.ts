import { describe, expect, it } from "vitest";
import { isShowing, youtubeCover, youtubeIdOf } from "@/lib/content";
import { bannerDetailsSchema, linkSchema, videoInputSchema } from "@/lib/content-schema";

describe("content: videos", () => {
  it("reads the video id from any YouTube link", () => {
    const id = "dQw4w9WgXcQ";
    for (const link of [
      id,
      `https://www.youtube.com/watch?v=${id}`,
      `https://youtube.com/watch?v=${id}&t=42s`,
      `https://m.youtube.com/watch?v=${id}`,
      `https://youtu.be/${id}`,
      `youtu.be/${id}?si=abc`,
      `https://www.youtube.com/shorts/${id}`,
      `https://www.youtube.com/embed/${id}`,
      `https://www.youtube.com/live/${id}`,
      `https://www.youtube-nocookie.com/embed/${id}`,
    ])
      expect(youtubeIdOf(link), link).toBe(id);
  });

  it("refuses what isn't a YouTube video", () => {
    for (const link of ["", "hello", "https://vimeo.com/123456", "https://youtube.com/@zalfi"])
      expect(youtubeIdOf(link), link).toBeNull();
    expect(
      videoInputSchema.safeParse({
        url: "https://vimeo.com/1",
        title: "x",
        channel: "",
        fragranceId: null,
        active: true,
      }).success,
    ).toBe(false);
  });

  it("uses the cover every public video has", () => {
    expect(youtubeCover("dQw4w9WgXcQ")).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
  });
});

describe("content: banners", () => {
  const base = {
    alt: "A model holding Reva",
    headline: "",
    line: "",
    buttonLabel: "",
    link: "",
    tone: "light" as const,
    textInImage: false,
    active: true,
    startsAt: null,
    endsAt: null,
  };

  it("leads only to a page on the site or an https address", () => {
    for (const ok of ["", "/fragrances/reva", "/discovery#navy", "https://instagram.com/zalfi"])
      expect(linkSchema.safeParse(ok).success, ok).toBe(true);
    for (const bad of ["//evil.com", "javascript:alert(1)", "http://plain.com", "fragrances"])
      expect(linkSchema.safeParse(bad).success, bad).toBe(false);
  });

  it("needs its picture described, and an end after its start", () => {
    expect(bannerDetailsSchema.safeParse(base).success).toBe(true);
    expect(bannerDetailsSchema.safeParse({ ...base, alt: "" }).success).toBe(false);
    expect(
      bannerDetailsSchema.safeParse({
        ...base,
        startsAt: "2026-10-10T00:00:00+06:00",
        endsAt: "2026-10-01T00:00:00+06:00",
      }).success,
    ).toBe(false);
    expect(bannerDetailsSchema.safeParse({ ...base, extra: 1 }).success).toBe(false);
  });

  it("shows only when on, and inside its dates", () => {
    const now = new Date("2026-10-06T12:00:00Z");
    expect(isShowing({ active: true, startsAt: null, endsAt: null }, now)).toBe(true);
    expect(isShowing({ active: false, startsAt: null, endsAt: null }, now)).toBe(false);
    expect(isShowing({ active: true, startsAt: "2026-10-07T00:00:00Z", endsAt: null }, now)).toBe(
      false,
    );
    expect(isShowing({ active: true, startsAt: null, endsAt: "2026-10-06T12:00:00Z" }, now)).toBe(
      false,
    );
    expect(
      isShowing(
        { active: true, startsAt: "2026-10-01T00:00:00Z", endsAt: "2026-10-31T00:00:00Z" },
        now,
      ),
    ).toBe(true);
  });
});
