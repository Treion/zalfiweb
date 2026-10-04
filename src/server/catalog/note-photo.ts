import sharp from "sharp";

/**
 * How every note photo is framed, whether it comes from the owner's folder (`npm run
 * notes:ingest`) or an upload in Admin → Notes: trimmed to the subject and centred on a
 * transparent square, the subject filling ~86% of it, so every note reads at the same scale.
 * At most 1200px (the site never shows a note wider than ~600 device pixels), never enlarged.
 */
export const NOTE_MAX = 1200;
export const NOTE_FILL = 0.86;

async function framed(input: Buffer) {
  const trimmed = await sharp(input).ensureAlpha().trim({ threshold: 1 }).png().toBuffer();
  const t = await sharp(trimmed).metadata();
  const inner = Math.round(NOTE_MAX * NOTE_FILL);
  const fitted =
    Math.max(t.width!, t.height!) > inner
      ? await sharp(trimmed).resize({ width: inner, height: inner, fit: "inside" }).png().toBuffer()
      : trimmed;
  const m = await sharp(fitted).metadata();
  const side = Math.min(NOTE_MAX, Math.round(Math.max(m.width!, m.height!) / NOTE_FILL));
  return sharp({
    create: { width: side, height: side, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite([
    {
      input: fitted,
      left: Math.round((side - m.width!) / 2),
      top: Math.round((side - m.height!) / 2),
    },
  ]);
}

/** The framed photo as a PNG (the files in public/images/notes) */
export async function frameNote(input: Buffer) {
  return (await framed(input)).png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
}

/** The framed photo as a WebP with alpha (uploads from the admin: a fraction of the size) */
export async function frameNoteWebp(input: Buffer) {
  return (await framed(input)).webp({ quality: 90, alphaQuality: 100 }).toBuffer();
}

/** Whether a file is a photo the site can use as a note: an image with a transparent background */
export async function checkNotePhoto(input: Buffer) {
  const meta = await sharp(input)
    .metadata()
    .catch(() => null);
  if (!meta?.width || !meta.height || !["png", "webp", "avif"].includes(meta.format ?? ""))
    return "Use a PNG, WebP or AVIF photo with a transparent background.";
  if (!meta.hasAlpha)
    return "This photo has no transparent background. Notes float over each fragrance's colour, so cut the background out first.";
  const { data } = await sharp(input)
    .ensureAlpha()
    .extractChannel(3)
    .raw()
    .toBuffer({ resolveWithObject: true });
  let clear = 0;
  for (let i = 0; i < data.length; i += 16) if (data[i]! < 10) clear++;
  if (clear / (data.length / 16) < 0.05)
    return "This photo's background isn't transparent. Cut the background out first.";
  return null;
}
