"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction } from "@/server/auth/session";
import { MAX_UPLOAD_BYTES } from "@/server/catalog/products";
import {
  newSetSchema,
  setDetailsSchema,
  setFragrancesSchema,
  setPackSchema,
} from "@/server/catalog/schema";
import {
  createSet,
  replaceSetPhoto,
  setSetContents,
  updateSet,
  updateSetPack,
} from "@/server/catalog/sets";
import { UserFacingError } from "@/server/errors";

const id = z.number().int().positive();

/** A file from a form, as bytes (checked for size before reading) */
async function fileBytes(form: FormData, field: string) {
  const f = form.get(field);
  if (!(f instanceof File) || f.size === 0) throw new UserFacingError("Choose a photo first.");
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

const refresh = (setId?: number) => {
  revalidatePath("/admin/products");
  revalidatePath("/admin/inventory");
  if (setId) revalidatePath(`/admin/products/sets/${setId}`);
};

export async function createSetAction(form: FormData) {
  return runAction("products.manage", newSetSchema, json(form), async (d, admin) => {
    const newId = await createSet(d, await fileBytes(form, "photo"), admin.actor);
    refresh();
    return { id: newId };
  });
}

export async function updateSetAction(input: unknown) {
  return runAction(
    "products.manage",
    z.object({ id, details: setDetailsSchema }).strict(),
    input,
    async (d, admin) => {
      await updateSet(d.id, d.details, admin.actor);
      refresh(d.id);
    },
  );
}

export async function setSetContentsAction(input: unknown) {
  return runAction(
    "products.manage",
    z.object({ id, fragranceIds: setFragrancesSchema }).strict(),
    input,
    async (d, admin) => {
      await setSetContents(d.id, d.fragranceIds, admin.actor);
      refresh(d.id);
    },
  );
}

export async function updateSetPackAction(input: unknown) {
  return runAction(
    "products.manage",
    z.object({ id, pack: setPackSchema }).strict(),
    input,
    async (d, admin) => {
      await updateSetPack(d.id, d.pack, admin.actor);
      refresh(d.id);
    },
  );
}

export async function replaceSetPhotoAction(form: FormData) {
  return runAction("products.manage", z.object({ id }).strict(), json(form), async (d, admin) => {
    const url = await replaceSetPhoto(d.id, await fileBytes(form, "photo"), admin.actor);
    refresh(d.id);
    return { url };
  });
}
