import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { frameNote, slugFor } from "../../scripts/assets/ingest-note-images";

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
  });
});
