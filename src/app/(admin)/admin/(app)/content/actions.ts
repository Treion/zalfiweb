"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { BANNER_PLACEMENTS, bannerDetailsSchema, videoInputSchema } from "@/lib/content";
import { runAction } from "@/server/auth/session";
import { MAX_UPLOAD_BYTES } from "@/server/catalog/upload";
import {
  createBanner,
  createVideo,
  deleteBanner,
  deleteVideo,
  moveBanner,
  moveVideo,
  removeBannerPhoneImage,
  setBannerImage,
  updateBanner,
  updateVideo,
} from "@/server/content";
import { UserFacingError } from "@/server/errors";

const id = z.number().int().positive();
const dir = z.union([z.literal(-1), z.literal(1)]);

// One picture per request: a wide and a phone picture would go over the 5 MB a request may carry
async function imageOf(form: FormData) {
  const f = form.get("image");
  if (!(f instanceof File) || f.size === 0) throw new UserFacingError("Choose a picture first.");
  if (f.size > MAX_UPLOAD_BYTES) throw new UserFacingError("That picture is over 4 MB.");
  return Buffer.from(await f.arrayBuffer());
}

const json = (form: FormData) => {
  try {
    return JSON.parse(String(form.get("data") ?? "null")) as unknown;
  } catch {
    return null;
  }
};

const refresh = () => revalidatePath("/admin/content");

export async function createBannerAction(form: FormData) {
  return runAction(
    "products.manage",
    z
      .object({
        placement: z.enum(BANNER_PLACEMENTS),
        alt: z.string().trim().min(3, "Describe the picture for people who can't see it.").max(200),
      })
      .strict(),
    json(form),
    async (d, admin) => {
      const r = await createBanner(d.placement, d.alt, await imageOf(form), admin.actor);
      refresh();
      return r;
    },
  );
}

export async function updateBannerAction(input: unknown) {
  return runAction(
    "products.manage",
    z.object({ id, details: bannerDetailsSchema }).strict(),
    input,
    async (d, admin) => {
      await updateBanner(d.id, d.details, admin.actor);
      refresh();
    },
  );
}

export async function setBannerImageAction(form: FormData) {
  return runAction(
    "products.manage",
    z.object({ id, which: z.enum(["wide", "phone"]) }).strict(),
    json(form),
    async (d, admin) => {
      await setBannerImage(d.id, d.which, await imageOf(form), admin.actor);
      refresh();
    },
  );
}

export async function removeBannerPhoneAction(input: unknown) {
  return runAction("products.manage", z.object({ id }).strict(), input, async (d, admin) => {
    await removeBannerPhoneImage(d.id, admin.actor);
    refresh();
  });
}

export async function moveBannerAction(input: unknown) {
  return runAction("products.manage", z.object({ id, dir }).strict(), input, async (d, admin) => {
    await moveBanner(d.id, d.dir, admin.actor);
    refresh();
  });
}

export async function deleteBannerAction(input: unknown) {
  return runAction("products.manage", z.object({ id }).strict(), input, async (d, admin) => {
    await deleteBanner(d.id, admin.actor);
    refresh();
  });
}

export async function createVideoAction(input: unknown) {
  return runAction("products.manage", videoInputSchema, input, async (d, admin) => {
    const r = await createVideo(d, admin.actor);
    refresh();
    return r;
  });
}

export async function updateVideoAction(input: unknown) {
  return runAction(
    "products.manage",
    z.object({ id, video: videoInputSchema }).strict(),
    input,
    async (d, admin) => {
      await updateVideo(d.id, d.video, admin.actor);
      refresh();
    },
  );
}

export async function moveVideoAction(input: unknown) {
  return runAction("products.manage", z.object({ id, dir }).strict(), input, async (d, admin) => {
    await moveVideo(d.id, d.dir, admin.actor);
    refresh();
  });
}

export async function deleteVideoAction(input: unknown) {
  return runAction("products.manage", z.object({ id }).strict(), input, async (d, admin) => {
    await deleteVideo(d.id, admin.actor);
    refresh();
  });
}
