"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction } from "@/server/auth/session";
import {
  addImage,
  createFragrance,
  createVariant,
  deleteImage,
  MAX_UPLOAD_BYTES,
  reorderImages,
  replaceBottlePhoto,
  setFragranceNotes,
  updateFragrance,
  updateImageAlt,
  updateVariant,
} from "@/server/catalog/products";
import {
  fragranceDetailsSchema,
  newFragranceSchema,
  notesSchema,
  variantSchema,
} from "@/server/catalog/schema";
import { UserFacingError } from "@/server/errors";

const id = z.number().int().positive();

/** A file from a form, as bytes (checked for size before reading) */
async function fileBytes(form: FormData, field: string) {
  const f = form.get(field);
  if (!(f instanceof File) || f.size === 0) throw new UserFacingError("Choose a file first.");
  if (f.size > MAX_UPLOAD_BYTES) throw new UserFacingError("That file is over 4 MB.");
  return Buffer.from(await f.arrayBuffer());
}

/** Form posts carry their fields as JSON in "data", files alongside */
const json = (form: FormData) => {
  try {
    return JSON.parse(String(form.get("data") ?? "null")) as unknown;
  } catch {
    return null;
  }
};

const refresh = (fragranceId?: number) => {
  revalidatePath("/admin/products");
  revalidatePath("/admin/inventory");
  if (fragranceId) revalidatePath(`/admin/products/${fragranceId}`);
};

export async function createFragranceAction(form: FormData) {
  return runAction("products.manage", newFragranceSchema, json(form), async (d, admin) => {
    const newId = await createFragrance(d, await fileBytes(form, "photo"), admin.actor);
    refresh();
    return { id: newId };
  });
}

export async function updateDetailsAction(input: unknown) {
  return runAction(
    "products.manage",
    z.object({ id, details: fragranceDetailsSchema }).strict(),
    input,
    async (d, admin) => {
      await updateFragrance(d.id, d.details, admin.actor);
      refresh(d.id);
    },
  );
}

export async function setNotesAction(input: unknown) {
  return runAction(
    "products.manage",
    z.object({ id, notes: notesSchema }).strict(),
    input,
    async (d, admin) => {
      await setFragranceNotes(d.id, d.notes, admin.actor);
      refresh(d.id);
    },
  );
}

export async function createVariantAction(input: unknown) {
  return runAction(
    "products.manage",
    z
      .object({
        fragranceId: id,
        variant: variantSchema,
        openingStock: z.number().int().min(0).max(10_000),
      })
      .strict(),
    input,
    async (d, admin) => {
      await createVariant(d.fragranceId, d.variant, d.openingStock, admin.actor);
      refresh(d.fragranceId);
    },
  );
}

export async function updateVariantAction(input: unknown) {
  return runAction(
    "products.manage",
    z.object({ id, fragranceId: id, variant: variantSchema }).strict(),
    input,
    async (d, admin) => {
      await updateVariant(d.id, d.variant, admin.actor);
      refresh(d.fragranceId);
    },
  );
}

export async function replaceBottleAction(form: FormData) {
  return runAction("products.manage", z.object({ id }).strict(), json(form), async (d, admin) => {
    const url = await replaceBottlePhoto(d.id, await fileBytes(form, "photo"), admin.actor);
    refresh(d.id);
    return { url };
  });
}

export async function addImagesAction(form: FormData) {
  return runAction(
    "products.manage",
    z.object({ id, alt: z.string().trim().max(200) }).strict(),
    json(form),
    async (d, admin) => {
      const files = form.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
      if (!files.length) throw new UserFacingError("Choose at least one image.");
      if (files.length > 8) throw new UserFacingError("Up to 8 images at a time.");
      for (const f of files) {
        if (f.size > MAX_UPLOAD_BYTES) throw new UserFacingError(`${f.name} is over 4 MB.`);
        const alt = d.alt || `ZALFI ${f.name.replace(/\.[a-z]+$/i, "").replace(/[-_]+/g, " ")}`;
        await addImage(d.id, Buffer.from(await f.arrayBuffer()), alt, admin.actor);
      }
      refresh(d.id);
      return { added: files.length };
    },
  );
}

export async function updateImageAltAction(input: unknown) {
  return runAction(
    "products.manage",
    z
      .object({
        imageId: id,
        fragranceId: id,
        alt: z.string().trim().min(3, "Describe the image").max(200),
      })
      .strict(),
    input,
    async (d, admin) => {
      await updateImageAlt(d.imageId, d.alt, admin.actor);
      refresh(d.fragranceId);
    },
  );
}

export async function reorderImagesAction(input: unknown) {
  return runAction(
    "products.manage",
    z.object({ fragranceId: id, order: z.array(id).max(100) }).strict(),
    input,
    async (d, admin) => {
      await reorderImages(d.fragranceId, d.order, admin.actor);
      refresh(d.fragranceId);
    },
  );
}

export async function deleteImageAction(input: unknown) {
  return runAction(
    "products.manage",
    z.object({ imageId: id, fragranceId: id }).strict(),
    input,
    async (d, admin) => {
      await deleteImage(d.imageId, admin.actor);
      refresh(d.fragranceId);
    },
  );
}
