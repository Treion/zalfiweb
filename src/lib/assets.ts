import "server-only";
import fs from "node:fs";
import path from "node:path";

const PUBLIC_DIR = path.join(process.cwd(), "public");

/** Whether a file exists under /public. Runs on the server at build/render time only. */
export function publicFileExists(publicPath: string) {
  const resolved = path.join(PUBLIC_DIR, publicPath);
  if (!resolved.startsWith(PUBLIC_DIR)) return false;
  try {
    return fs.statSync(resolved).isFile();
  } catch {
    return false;
  }
}

/**
 * Whether an image can be shown: a file under /public must be there; a photo uploaded in the
 * admin (/media/… locally, https://… on Vercel Blob) was checked when it was saved.
 */
export function imageAvailable(src: string) {
  if (!src) return false;
  if (src.startsWith("/media/") || src.startsWith("https://")) return true;
  return publicFileExists(src);
}

/** Map of image path → available, for handing to client components. */
export function availability(paths: string[]): Record<string, boolean> {
  return Object.fromEntries(paths.map((p) => [p, imageAvailable(p)]));
}

/**
 * The shop never shows an empty space for a note: one whose photo isn't there yet is left out
 * (the others close up), and comes back once its photo is added in Admin → Notes. /lab still
 * shows every note, with a frame where a photo is missing.
 */
export function withNotePhotos<F extends { notes: { image: string }[] }>(f: F): F {
  return { ...f, notes: f.notes.filter((n) => imageAvailable(n.image)) };
}
