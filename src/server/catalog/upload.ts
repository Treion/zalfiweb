import { createHash } from "node:crypto";
import sharp from "sharp";
import { UserFacingError } from "@/server/errors";
import { storageProvider } from "@/server/providers/storage";

/**
 * Photos uploaded in the admin: the size limit, the content-hash file names (so a URL can be
 * cached forever), storing a photo as WebP, and removing one nothing points to any more.
 */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export const hash8 = (b: Buffer) => createHash("sha256").update(b).digest("hex").slice(0, 10);

/**
 * A photo (JPG, PNG, WebP or AVIF) stored as WebP at `${prefix}-${hash}.webp`: turned upright,
 * scaled down to fit `maxPx` on the long side, never enlarged or cropped. Returns its URL and size.
 */
export async function storeWebp(file: Buffer, prefix: string, maxPx = 2400) {
  if (file.byteLength > MAX_UPLOAD_BYTES) throw new UserFacingError("That file is over 4 MB.");
  const meta = await sharp(file)
    .metadata()
    .catch(() => null);
  if (!meta?.width || !meta.height || !["jpeg", "png", "webp", "avif"].includes(meta.format ?? ""))
    throw new UserFacingError("Use a JPG, PNG, WebP or AVIF image.");
  const { data, info } = await sharp(file)
    .rotate()
    .resize({ width: maxPx, height: maxPx, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 90 })
    .toBuffer({ resolveWithObject: true });
  const { url } = await storageProvider().put(`${prefix}-${hash8(data)}.webp`, data, "image/webp");
  return { url, width: info.width, height: info.height };
}

/** An uploaded photo can go once nothing points to it; the original files stay in the repo */
export async function dropUpload(url: string) {
  if (url.startsWith("/images/")) return;
  await storageProvider()
    .remove(url)
    .catch(() => {});
}
