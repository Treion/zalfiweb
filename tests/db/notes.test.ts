import { existsSync } from "node:fs";
import path from "node:path";
import { and, eq, like } from "drizzle-orm";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminUsers, auditLog, fragranceNotes, fragrances, notes } from "@/db/schema";
import { poolDb } from "@/server/db/pool";
import {
  createNote,
  deleteNote,
  listNotesAdmin,
  replaceNotePhoto,
  updateNote,
} from "@/server/catalog/notes";
import { UPLOAD_DIR } from "@/server/providers/storage";

/** The notes library (Admin → Notes) against a real database and local photo storage */
const RUN = Date.now().toString(36);
const NAME = `Zz Bergamot ${RUN}`;
const admin = { id: `zz-notes-admin-${RUN}`, email: `zz-notes-${RUN}@zalfi.test` };
let fragranceId = 0;

/** A transparent PNG with a coloured subject in the middle, like a cut-out photo */
async function photo(color: { r: number; g: number; b: number }) {
  const subject = await sharp({
    create: { width: 200, height: 160, channels: 4, background: { ...color, alpha: 1 } },
  })
    .png()
    .toBuffer();
  return sharp({
    create: { width: 400, height: 400, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: subject, left: 100, top: 120 }])
    .png()
    .toBuffer();
}
const fileOf = (url: string) => path.join(UPLOAD_DIR, url.replace(/^\/media\//, ""));

beforeAll(async () => {
  await poolDb().insert(adminUsers).values({ id: admin.id, name: "Test", email: admin.email });
  const [f] = await poolDb()
    .insert(fragrances)
    .values({
      slug: `zz-notes-${RUN}`,
      name: "Zz Notes",
      tagline: "t",
      story: "",
      mood: "m",
      palette: { bg: "#000000", deep: "#000000", accent: "#ffffff", ink: "#ffffff" },
      capFinish: "black",
      bottleImage: "/x.png",
      bottleAlt: "test bottle",
      published: false,
      sortOrder: 999,
    })
    .returning({ id: fragrances.id });
  fragranceId = f!.id;
});

afterAll(async () => {
  await poolDb().delete(fragrances).where(eq(fragrances.id, fragranceId));
  await poolDb()
    .delete(notes)
    .where(like(notes.name, `Zz Bergamot ${RUN}%`));
  await poolDb().delete(auditLog).where(eq(auditLog.actorId, admin.id));
  await poolDb().delete(adminUsers).where(eq(adminUsers.id, admin.id));
});

describe("the notes library", () => {
  it("adds, renames, re-photographs and deletes a note, refusing while a fragrance uses it", async () => {
    const created = await createNote(
      { name: NAME, alt: "A halved bergamot with its leaves" },
      await photo({ r: 220, g: 200, b: 40 }),
      admin,
    );
    expect(created.slug).toBe(`zz-bergamot-${RUN}`);
    expect(created.image).toMatch(/^\/media\/notes\/zz-bergamot-.+\.webp$/);
    expect(existsSync(fileOf(created.image))).toBe(true);
    // Framed: a transparent square, the subject at ~86%
    const m = await sharp(fileOf(created.image)).metadata();
    expect(m.width).toBe(m.height);
    expect(m.width).toBe(Math.round(200 / 0.86));
    expect(m.hasAlpha).toBe(true);

    // The same name twice is refused
    await expect(
      createNote(
        { name: NAME.toUpperCase(), alt: "Another one" },
        await photo({ r: 1, g: 2, b: 3 }),
        admin,
      ),
    ).rejects.toThrow(/already a note called/);

    // A photo without a transparent background is refused, in plain words
    const flat = await sharp({
      create: { width: 300, height: 300, channels: 3, background: { r: 255, g: 255, b: 255 } },
    })
      .jpeg()
      .toBuffer();
    await expect(
      createNote({ name: `${NAME} flat`, alt: "A flat photo" }, flat, admin),
    ).rejects.toThrow(/transparent background/);

    await updateNote(
      created.id,
      { name: `${NAME} Calabria`, alt: "Bergamot from Calabria" },
      admin,
    );
    const { image } = await replaceNotePhoto(
      created.id,
      await photo({ r: 60, g: 160, b: 60 }),
      admin,
    );
    expect(image).not.toBe(created.image);
    expect(existsSync(fileOf(image))).toBe(true);
    expect(existsSync(fileOf(created.image))).toBe(false);

    // In a fragrance: listed where it's used, and can't be deleted
    await poolDb()
      .insert(fragranceNotes)
      .values({
        fragranceId,
        noteId: created.id,
        layer: "top",
        label: "Sunlit Bergamot",
        position: 0,
      });
    const listed = (await listNotesAdmin()).find((n) => n.id === created.id)!;
    expect(listed).toMatchObject({
      name: `${NAME} Calabria`,
      alt: "Bergamot from Calabria",
      image,
    });
    expect(listed.usedIn).toEqual([
      { fragranceId, fragrance: "Zz Notes", layer: "Top", label: "Sunlit Bergamot" },
    ]);
    await expect(deleteNote(created.id, admin)).rejects.toThrow(/is in Zz Notes/);

    await poolDb().delete(fragranceNotes).where(eq(fragranceNotes.noteId, created.id));
    await deleteNote(created.id, admin);
    expect(await poolDb().select().from(notes).where(eq(notes.id, created.id))).toHaveLength(0);
    expect(existsSync(fileOf(image))).toBe(false);

    const actions = (
      await poolDb()
        .select({ action: auditLog.action })
        .from(auditLog)
        .where(and(eq(auditLog.actorId, admin.id), eq(auditLog.entity, "note")))
        .orderBy(auditLog.id)
    ).map((a) => a.action);
    expect(actions).toEqual(["note.create", "note.update", "note.photo", "note.delete"]);
  });
});
