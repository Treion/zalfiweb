/**
 * Brings the owner's own note photos into the site.
 *
 *   npm run notes:ingest -- <folder> [--force]
 *
 * Every image in the folder (PNG or WebP with a transparent background, named however) is matched
 * to a note by its name: "agar wood.png" → agarwood, "nut meg.png" → nutmeg, "rose.png" →
 * red-rose. Each is trimmed to its subject and centred on a transparent square at ~86% fill, so
 * every note reads at the same scale, at most 1200px square, and written to
 * public/images/notes/{slug}.png. It is never enlarged past its own pixels.
 *
 * Files that match no note are listed and left alone; an existing image is kept unless --force.
 */
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { NOTES } from "../../src/db/seed-data";

const OUT = path.join(process.cwd(), "public/images/notes");
/** The site never shows a note wider than ~600 device pixels: 1200 keeps them sharp and light */
const MAX = 1200;
const FILL = 0.86;

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
  "precious-woods": ["preciouswood", "woods"],
  "white-oud": ["whiteoud"],
  musk: ["whitemusk", "warmmusk"],
};

export function slugFor(filename: string): string | null {
  const k = key(filename);
  for (const n of NOTES) {
    const names = [n.slug, n.name, ...(ALIASES[n.slug] ?? [])].map(key);
    if (names.includes(k)) return n.slug;
  }
  return null;
}

/** Trim to the subject and centre it on a transparent square, the subject filling ~86% of it */
export async function frameNote(input: Buffer) {
  const trimmed = await sharp(input).ensureAlpha().trim({ threshold: 1 }).png().toBuffer();
  const t = await sharp(trimmed).metadata();
  const long = Math.max(t.width!, t.height!);
  const fitted =
    long > MAX * FILL
      ? await sharp(trimmed)
          .resize({ width: MAX * FILL, height: MAX * FILL, fit: "inside" })
          .png()
          .toBuffer()
      : trimmed;
  const m = await sharp(fitted).metadata();
  const side = Math.min(MAX, Math.round(Math.max(m.width!, m.height!) / FILL));
  return sharp({
    create: { width: side, height: side, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      {
        input: fitted,
        left: Math.round((side - m.width!) / 2),
        top: Math.round((side - m.height!) / 2),
      },
    ])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
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
