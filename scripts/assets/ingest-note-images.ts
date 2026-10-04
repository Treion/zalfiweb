/**
 * Brings the owner's own note photos into the site.
 *
 *   npm run notes:ingest -- <folder> [--force]
 *
 * Every image in the folder (PNG or WebP with a transparent background, named however) is matched
 * to a note by its name: "agar wood.png" → agarwood, "nut meg.png" → nutmeg, "rose.png" →
 * red-rose, "Fresh Mint Leaf Cluster.png" → mint. Each is framed by frameNote()
 * (src/server/catalog/note-photo.ts, shared with Admin → Notes) and written to
 * public/images/notes/{slug}.png.
 *
 * Files that match no note are listed and left alone; an existing image is kept unless --force.
 */
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { NOTES } from "../../src/db/seed-data";
import { frameNote } from "../../src/server/catalog/note-photo";

export { frameNote };

const OUT = path.join(process.cwd(), "public/images/notes");

const key = (s: string) =>
  s
    .toLowerCase()
    .replace(/\.(png|webp|jpe?g|avif)$/i, "")
    .replace(/\bpng\b/g, "")
    .replace(/[^a-z0-9]+/g, "");

/** Names people actually give these files, beyond the note's own slug and name */
const ALIASES: Record<string, string[]> = {
  "red-rose": ["rose", "redroses", "roses"],
  patchouli: ["pathcouli", "patchouly", "patchouli"],
  "tonka-bean": ["tonka", "tonkabeans"],
  agarwood: ["agar", "agarwood"],
  cedarwood: ["cedar"],
  sandalwood: ["sandal"],
  musk: ["whitemusk", "warmmusk"],
};

export function slugFor(filename: string): string | null {
  const k = key(filename);
  const named = NOTES.map((n) => ({
    slug: n.slug,
    names: [n.slug, n.name, ...(ALIASES[n.slug] ?? [])].map(key),
  }));
  const exact = named.find((n) => n.names.includes(k));
  if (exact) return exact.slug;
  // "Fresh Mint Leaf Cluster" → mint: the longest note name inside the file name wins, so
  // "Green Apple Slices" is green-apple, not apple
  let best: { slug: string; len: number } | null = null;
  for (const n of named)
    for (const name of n.names)
      if (name.length >= 3 && k.includes(name) && (!best || name.length > best.len))
        best = { slug: n.slug, len: name.length };
  return best?.slug ?? null;
}

async function main() {
  const args = process.argv.slice(2);
  const dir = args.find((a) => !a.startsWith("--"));
  const force = args.includes("--force");
  if (!dir) throw new Error("Usage: npm run notes:ingest -- <folder> [--force]");
  await fs.mkdir(OUT, { recursive: true });
  const files = (await fs.readdir(dir)).filter((f) => /\.(png|webp)$/i.test(f)).sort();
  const done = new Set<string>();
  for (const f of files) {
    const slug = slugFor(f);
    if (!slug) {
      console.log(`? ${f}: no note by that name (rename it, or add an alias)`);
      continue;
    }
    if (done.has(slug)) {
      console.log(`? ${f}: a second image for ${slug}, skipped`);
      continue;
    }
    const target = path.join(OUT, `${slug}.png`);
    const exists = await fs.stat(target).then(
      () => true,
      () => false,
    );
    if (exists && !force) {
      console.log(`✓ ${slug}: already present (use --force to replace)`);
      done.add(slug);
      continue;
    }
    const meta = await sharp(path.join(dir, f)).metadata();
    if (!meta.hasAlpha) {
      console.log(`? ${f}: no transparent background, skipped`);
      continue;
    }
    const png = await frameNote(await fs.readFile(path.join(dir, f)));
    await fs.writeFile(target, png);
    const out = await sharp(png).metadata();
    console.log(`+ ${f} → ${slug}.png (${out.width}×${out.height})`);
    done.add(slug);
  }
  const present = new Set(await fs.readdir(OUT));
  const still = NOTES.map((n) => `${n.slug}.png`).filter((f) => !present.has(f));
  if (still.length) console.log(`\nStill to come (shown as frames): ${still.join(", ")}`);
}

if (process.argv[1]?.includes("ingest-note-images")) void main();
