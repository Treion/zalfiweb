import { asc, eq, ne } from "drizzle-orm";
import type { z } from "zod";
import { fragranceNotes, fragrances, notes } from "@/db/schema";
import { audit, type Actor } from "@/server/audit";
import { poolDb, withTx, type Executor } from "@/server/db/pool";
import { UserFacingError } from "@/server/errors";
import { storageProvider } from "@/server/providers/storage";
import { checkNotePhoto, frameNoteWebp } from "./note-photo";
import { revalidateStorefront } from "./products";
import { MAX_UPLOAD_BYTES, dropUpload, hash8 } from "./upload";
import { noteSlugOf, type noteDetailsSchema } from "./schema";

/**
 * The note library (Admin → Notes): every ingredient a fragrance's pyramid can use, with its
 * photo. A fragrance picks notes from here (Products → Notes) and gives each its own wording.
 *  - A note always has a photo: the shop leaves out a note it can't show, so a note without
 *    one would simply be missing.
 *  - Photos are framed like the owner's own (note-photo.ts) and stored with the product photos
 *    (local /media, or Vercel Blob). The original 24 live in public/images/notes.
 *  - The slug is fixed once made: 3D models and the stage key on it.
 */

type Details = z.output<typeof noteDetailsSchema>;
const LAYER = { top: "Top", heart: "Heart", base: "Base" } as const;

export async function listNotesAdmin(exec: Executor = poolDb()) {
  const [rows, uses] = await Promise.all([
    exec.select().from(notes).orderBy(asc(notes.name)),
    exec
      .select({
        noteId: fragranceNotes.noteId,
        fragranceId: fragrances.id,
        fragrance: fragrances.name,
        layer: fragranceNotes.layer,
        label: fragranceNotes.label,
      })
      .from(fragranceNotes)
      .innerJoin(fragrances, eq(fragrances.id, fragranceNotes.fragranceId))
      .orderBy(asc(fragrances.sortOrder), asc(fragranceNotes.position)),
  ]);
  return rows.map((n) => ({
    ...n,
    usedIn: uses
      .filter((u) => u.noteId === n.id)
      .map((u) => ({
        fragranceId: u.fragranceId,
        fragrance: u.fragrance,
        layer: LAYER[u.layer],
        label: u.label,
      })),
  }));
}

export type NoteAdmin = Awaited<ReturnType<typeof listNotesAdmin>>[number];

/** Checks, frames and stores a note photo; returns its URL */
async function storePhoto(slug: string, file: Buffer) {
  if (file.byteLength > MAX_UPLOAD_BYTES) throw new UserFacingError("That file is over 4 MB.");
  const problem = await checkNotePhoto(file);
  if (problem) throw new UserFacingError(problem);
  const webp = await frameNoteWebp(file);
  const { url } = await storageProvider().put(
    `notes/${slug}-${hash8(webp)}.webp`,
    webp,
    "image/webp",
  );
  return url;
}


async function freeSlug(name: string, exec: Executor) {
  const base = noteSlugOf(name);
  if (!base || !/^[a-z]/.test(base))
    throw new UserFacingError("Start the name with a letter (A–Z).");
  for (let i = 1; i < 50; i++) {
    const slug = i === 1 ? base : `${base}-${i}`;
    const [taken] = await exec
      .select({ id: notes.id })
      .from(notes)
      .where(eq(notes.slug, slug))
      .limit(1);
    if (!taken) return slug;
  }
  throw new UserFacingError("Choose a different name.");
}

async function sameName(name: string, exceptId: number | null, exec: Executor) {
  const rows = await exec
    .select({ id: notes.id, name: notes.name })
    .from(notes)
    .where(exceptId ? ne(notes.id, exceptId) : undefined);
  return rows.find((r) => r.name.trim().toLowerCase() === name.trim().toLowerCase());
}

export async function createNote(d: Details, photo: Buffer, actor: Actor) {
  const db = poolDb();
  if (await sameName(d.name, null, db))
    throw new UserFacingError(`There's already a note called ${d.name}.`);
  const slug = await freeSlug(d.name, db);
  const image = await storePhoto(slug, photo);
  const row = await withTx(async (tx) => {
    const [n] = await tx
      .insert(notes)
      .values({ slug, name: d.name, alt: d.alt, image })
      .returning();
    await audit(tx, actor, "note.create", {
      entity: "note",
      entityId: n!.id,
      after: { slug, name: d.name, alt: d.alt, image },
    });
    return n!;
  });
  await revalidateStorefront();
  return { id: row.id, slug: row.slug, name: row.name, image: row.image };
}

export async function updateNote(id: number, d: Details, actor: Actor) {
  await withTx(async (tx) => {
    const [before] = await tx.select().from(notes).where(eq(notes.id, id));
    if (!before) throw new UserFacingError("That note no longer exists.");
    if (await sameName(d.name, id, tx))
      throw new UserFacingError(`There's already a note called ${d.name}.`);
    await tx.update(notes).set({ name: d.name, alt: d.alt }).where(eq(notes.id, id));
    await audit(tx, actor, "note.update", {
      entity: "note",
      entityId: id,
      before: { name: before.name, alt: before.alt },
      after: { name: d.name, alt: d.alt },
    });
  });
  await revalidateStorefront();
}

export async function replaceNotePhoto(id: number, photo: Buffer, actor: Actor) {
  const [before] = await poolDb().select().from(notes).where(eq(notes.id, id));
  if (!before) throw new UserFacingError("That note no longer exists.");
  const image = await storePhoto(before.slug, photo);
  await withTx(async (tx) => {
    await tx.update(notes).set({ image }).where(eq(notes.id, id));
    await audit(tx, actor, "note.photo", {
      entity: "note",
      entityId: id,
      before: { image: before.image },
      after: { image },
    });
  });
  if (before.image !== image) await dropUpload(before.image);
  await revalidateStorefront();
  return { image };
}

export async function deleteNote(id: number, actor: Actor) {
  const before = await withTx(async (tx) => {
    const [n] = await tx.select().from(notes).where(eq(notes.id, id));
    if (!n) throw new UserFacingError("That note no longer exists.");
    const used = await tx
      .select({ name: fragrances.name })
      .from(fragranceNotes)
      .innerJoin(fragrances, eq(fragrances.id, fragranceNotes.fragranceId))
      .where(eq(fragranceNotes.noteId, id));
    if (used.length)
      throw new UserFacingError(
        `${n.name} is in ${[...new Set(used.map((u) => u.name))].join(" and ")}. Take it out of ${used.length > 1 ? "those fragrances" : "that fragrance"} first (Products → Notes).`,
      );
    await tx.delete(notes).where(eq(notes.id, id));
    await audit(tx, actor, "note.delete", {
      entity: "note",
      entityId: id,
      before: { slug: n.slug, name: n.name, alt: n.alt, image: n.image },
    });
    return n;
  });
  await dropUpload(before.image);
  await revalidateStorefront();
}
