import { describe, expect, it, vi } from "vitest";

// lib/assets.ts is server-only; the test runs on the server already
vi.mock("server-only", () => ({}));
import sharp from "sharp";
import { slugFor } from "../../scripts/assets/ingest-note-images";
import { checkNotePhoto, frameNote } from "@/server/catalog/note-photo";

describe("bringing in the owner's note photos", () => {
  it("matches files to notes however they were named", () => {
    expect(slugFor("agar wood.png")).toBe("agarwood");
    expect(slugFor("cedar wood.png")).toBe("cedarwood");
    expect(slugFor("green apple.png")).toBe("green-apple");
    expect(slugFor("lime png.png")).toBe("lime");
    expect(slugFor("nut meg.png")).toBe("nutmeg");
    expect(slugFor("pathcouli.png")).toBe("patchouli");
    expect(slugFor("rose.png")).toBe("red-rose");
    expect(slugFor("saffron .webp")).toBe("saffron");
    expect(slugFor("sandal wood.png")).toBe("sandalwood");
    expect(slugFor("tonka bean.png")).toBe("tonka-bean");
    expect(slugFor("Iris.WEBP")).toBe("iris");
    expect(slugFor("Fresh Mint Leaf Cluster.png")).toBe("mint");
    expect(slugFor("Green Apple Slices.png")).toBe("green-apple");
    expect(slugFor("apple.png")).toBe("apple");
    expect(slugFor("holiday photo.png")).toBeNull();
  });

  it("centres the subject on a square, never enlarging a small photo", async () => {
    const subject = await sharp({
      create: {
        width: 300,
        height: 150,
        channels: 4,
        background: { r: 200, g: 40, b: 40, alpha: 1 },
      },
    })
      .png()
      .toBuffer();
    const padded = await sharp({
      create: { width: 500, height: 400, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite([{ input: subject, left: 10, top: 20 }])
      .png()
      .toBuffer();
    const out = await sharp(await frameNote(padded)).metadata();
    expect(out.width).toBe(out.height);
    expect(out.width).toBe(Math.round(300 / 0.86));
    expect(out.hasAlpha).toBe(true);
    // Only a cut-out photo is taken: a transparent background, not a flat one
    expect(await checkNotePhoto(padded)).toBeNull();
    const flat = await sharp({
      create: { width: 300, height: 300, channels: 3, background: { r: 250, g: 250, b: 250 } },
    })
      .jpeg()
      .toBuffer();
    expect(await checkNotePhoto(flat)).toMatch(/PNG, WebP or AVIF/);
    const opaque = await sharp(flat).png().ensureAlpha().toBuffer();
    expect(await checkNotePhoto(opaque)).toMatch(/isn't transparent/);
  });
});

describe("the shop and missing note photos", () => {
  it("counts admin uploads as there, and leaves out a note whose photo isn't", async () => {
    const { imageAvailable, withNotePhotos } = await import("@/lib/assets");
    expect(imageAvailable("/images/notes/mint.png")).toBe(true);
    expect(imageAvailable("/images/notes/white-oud.png")).toBe(false);
    expect(imageAvailable("/media/notes/bergamot-0a1b2c.webp")).toBe(true);
    expect(imageAvailable("https://x.public.blob.vercel-storage.com/notes/b.webp")).toBe(true);
    expect(imageAvailable("")).toBe(false);
    const f = {
      slug: "reva",
      notes: [
        { slug: "mint", image: "/images/notes/mint.png" },
        { slug: "gone", image: "/images/notes/gone.png" },
      ],
    };
    expect(withNotePhotos(f).notes.map((n) => n.slug)).toEqual(["mint"]);
    expect(withNotePhotos(f).slug).toBe("reva");
  });
});
