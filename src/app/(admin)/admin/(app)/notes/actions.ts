"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction } from "@/server/auth/session";
import { createNote, deleteNote, replaceNotePhoto, updateNote } from "@/server/catalog/notes";
import { MAX_UPLOAD_BYTES } from "@/server/catalog/products";
import { noteDetailsSchema } from "@/server/catalog/schema";
import { UserFacingError } from "@/server/errors";

const id = z.number().int().positive();

async function photoOf(form: FormData) {
  const f = form.get("photo");
  if (!(f instanceof File) || f.size === 0) throw new UserFacingError("Choose a photo first.");
  if (f.size > MAX_UPLOAD_BYTES) throw new UserFacingError("That photo is over 4 MB.");
  return Buffer.from(await f.arrayBuffer());
}

const json = (form: FormData) => {
  try {
    return JSON.parse(String(form.get("data") ?? "null")) as unknown;
  } catch {
    return null;
  }
};

// A note shows on the Notes page and in every product's notes picker
const refresh = () => {
  revalidatePath("/admin/notes");
  revalidatePath("/admin/products", "layout");
};

/** A new note in the library, with its photo */
export async function createNoteAction(form: FormData) {
  return runAction("products.manage", noteDetailsSchema, json(form), async (d, admin) => {
    const note = await createNote(d, await photoOf(form), admin.actor);
    refresh();
    return note;
  });
}

export async function updateNoteAction(input: unknown) {
  return runAction(
    "products.manage",
    noteDetailsSchema.extend({ id }).strict(),
    input,
    async ({ id, ...d }, admin) => {
      await updateNote(id, d, admin.actor);
      refresh();
    },
  );
}

export async function replaceNotePhotoAction(form: FormData) {
  return runAction("products.manage", z.object({ id }).strict(), json(form), async (d, admin) => {
    const r = await replaceNotePhoto(d.id, await photoOf(form), admin.actor);
    refresh();
    return r;
  });
}

export async function deleteNoteAction(input: unknown) {
  return runAction("products.manage", z.object({ id }).strict(), input, async (d, admin) => {
    await deleteNote(d.id, admin.actor);
    refresh();
  });
}
