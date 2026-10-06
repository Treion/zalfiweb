import { eq, sql } from "drizzle-orm";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { adminUsers, banners, fragrances, videos } from "@/db/schema";
import {
  createBanner,
  createVideo,
  deleteBanner,
  deleteVideo,
  listBannersAdmin,
  moveBanner,
  setBannerImage,
  updateBanner,
  updateVideo,
} from "@/server/content";
import { getBanners, getVideos } from "@/server/content/public";
import { poolDb } from "@/server/db/pool";

vi.mock("server-only", () => ({}));

/**
 * Admin → Content against a real database: banners from a picture to the shop (dates, the phone
 * picture, order), and videos attached to a throwaway perfume.
 */
const RUN = Date.now().toString(36);
const SLUG = `zz-content-${RUN}`;
const admin = { id: `zz-admin-${RUN}`, email: `zz-admin-${RUN}@zalfi.test` };
const made: number[] = [];
let fragranceId = 0;

const picture = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: { r: 40, g: 30, b: 60 } } })
    .jpeg()
    .toBuffer();
const details = (over: Partial<Parameters<typeof updateBanner>[1]> = {}) => ({
  alt: "A model holding the bottle",
  headline: "Reva, at dusk",
  line: "",
  buttonLabel: "Shop Reva",
  link: "/fragrances/reva",
  tone: "light" as const,
  textInImage: false,
  active: true,
  startsAt: null,
  endsAt: null,
  ...over,
});

beforeAll(async () => {
  await poolDb().insert(adminUsers).values({ id: admin.id, name: "Test", email: admin.email });
  const [f] = await poolDb()
    .insert(fragrances)
    .values({
      slug: SLUG,
      name: "Zz Filmed",
      tagline: "t",
      story: "",
      mood: "m",
      palette: { bg: "#000000", deep: "#000000", accent: "#ffffff", ink: "#ffffff" },
      capFinish: "black",
      bottleImage: "/x.png",
      bottleAlt: "test bottle",
      published: true,
      sortOrder: 960,
    })
    .returning({ id: fragrances.id });
  fragranceId = f!.id;
});

afterAll(async () => {
  for (const id of made) await poolDb().delete(banners).where(eq(banners.id, id));
  await poolDb()
    .delete(videos)
    .where(sql`${videos.title} like ${`Zz ${RUN}%`}`);
  await poolDb().delete(fragrances).where(eq(fragrances.id, fragranceId));
  await poolDb().execute(sql`delete from audit_log where actor_id = ${admin.id}`);
  await poolDb().delete(adminUsers).where(eq(adminUsers.id, admin.id));
});

describe("banners", () => {
  it("stores the picture whole, as WebP, and shows it on the shop once added", async () => {
    const { id } = await createBanner(
      "shop",
      "A model holding the bottle",
      await picture(3000, 1250),
      admin,
    );
    made.push(id);
    const [b] = await poolDb().select().from(banners).where(eq(banners.id, id));
    // Scaled to fit 2560 px, never cropped: the shape is kept
    expect(b).toMatchObject({ width: 2560, height: 1067, placement: "shop", active: true });
    expect(b!.image).toMatch(/content\/banner-[0-9a-f]{10}\.webp$/);
    const shop = await getBanners("shop");
    expect(shop.find((x) => x.id === id)).toMatchObject({
      alt: "A model holding the bottle",
      mobile: null,
    });
  });

  it("takes words, a link, a phone picture and dates", async () => {
    const id = made[0]!;
    await updateBanner(id, details(), admin);
    await setBannerImage(id, "phone", await picture(1080, 1350), admin);
    const shown = (await getBanners("shop")).find((x) => x.id === id)!;
    expect(shown).toMatchObject({
      headline: "Reva, at dusk",
      buttonLabel: "Shop Reva",
      link: "/fragrances/reva",
    });
    expect(shown.mobile).toMatchObject({ width: 1080, height: 1350 });

    // Not yet started, or already ended: not on the shop
    const later = new Date(Date.now() + 86_400_000).toISOString();
    await updateBanner(id, details({ startsAt: later }), admin);
    expect((await getBanners("shop")).some((x) => x.id === id)).toBe(false);
    const earlier = new Date(Date.now() - 86_400_000).toISOString();
    await updateBanner(id, details({ endsAt: earlier, startsAt: null }), admin);
    expect((await getBanners("shop")).some((x) => x.id === id)).toBe(false);
    await updateBanner(id, details({ active: false }), admin);
    expect((await getBanners("shop")).some((x) => x.id === id)).toBe(false);
    await updateBanner(id, details(), admin);
    expect((await getBanners("shop")).some((x) => x.id === id)).toBe(true);
  });

  it("keeps an order within its place, and leaves with its pictures", async () => {
    const { id: second } = await createBanner(
      "shop",
      "Oudor in smoke",
      await picture(1600, 900),
      admin,
    );
    made.push(second);
    const order = async () =>
      (await listBannersAdmin()).filter((b) => made.includes(b.id)).map((b) => b.id);
    expect(await order()).toEqual([made[0], second]);
    await moveBanner(second, -1, admin);
    expect(await order()).toEqual([second, made[0]]);
    await deleteBanner(second, admin);
    expect(await order()).toEqual([made[0]]);
    const logged = await poolDb().execute(
      sql`select action from audit_log where actor_id = ${admin.id} and entity = 'banner' order by id`,
    );
    expect(logged.rows.map((r) => (r as { action: string }).action)).toContain("banner.delete");
  });
});

describe("videos", () => {
  it("shows a video on its perfume's page and on the shop, until it's switched off", async () => {
    const { id } = await createVideo(
      {
        url: "https://youtu.be/dQw4w9WgXcQ",
        title: `Zz ${RUN} review`,
        channel: "",
        fragranceId,
        active: true,
      },
      admin,
    );
    expect(await getVideos(SLUG)).toEqual([
      { id, youtubeId: "dQw4w9WgXcQ", title: `Zz ${RUN} review`, channel: null },
    ]);
    expect((await getVideos()).some((v) => v.id === id)).toBe(true);
    await updateVideo(
      id,
      {
        url: "dQw4w9WgXcQ",
        title: `Zz ${RUN} review`,
        channel: "Rafi",
        fragranceId,
        active: false,
      },
      admin,
    );
    expect(await getVideos(SLUG)).toEqual([]);
    await deleteVideo(id, admin);
    expect((await poolDb().select().from(videos).where(eq(videos.id, id))).length).toBe(0);
  });
});
