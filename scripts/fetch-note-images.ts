/**
 * Sources REAL, openly licensed photographs for the 26 note images from Wikimedia Commons.
 * It cuts them out onto transparency and records every credit.
 *
 * Needs outbound access to commons.wikimedia.org and upload.wikimedia.org (add both to this
 * environment's network allowlist).
 *
 *   npm run notes:fetch                 fetch every missing note image
 *   npm run notes:fetch -- --only iris  one note
 *   npm run notes:fetch -- --dry-run    list candidates without downloading
 *   npm run notes:fetch -- --force      replace existing files too
 *
 * Quality rules (never a cartoon, icon or placeholder):
 *   - bitmap photos only (JPEG/PNG), at least 1200px on the long edge
 *   - licences that allow commercial use: CC0, Public domain, CC BY, CC BY-SA
 *   - only images already isolated on a plain light background (or transparent) are accepted,
 *     so the cut-out is clean. Busy scenes are skipped rather than badly masked.
 * Output: public/images/notes/{slug}.png (transparent, 2000×2000) and CREDITS.md.
 */
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { NOTES } from "../src/db/seed-data";

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "public/images/notes");
const CREDITS_JSON = path.join(ROOT, "public/images/notes/credits.json");
const UA = "ZALFI-site-builder/1.0 (asset sourcing script; contact via repository owner)";

/** Curated search phrases per note, most specific first */
const QUERIES: Record<string, string[]> = {
  pineapple: ["pineapple isolated white background", "pineapple fruit white background"],
  mint: ["mint sprig isolated", "spearmint leaves white background"],
  lavender: ["lavender bunch isolated white", "lavandula flowers white background"],
  oakmoss: ["Evernia prunastri", "oakmoss lichen"],
  vetiver: ["vetiver roots", "Chrysopogon zizanioides roots"],
  "tonka-bean": ["tonka beans", "Dipteryx odorata seeds"],
  cucumber: ["cucumber slices isolated white", "cucumber white background"],
  jasmine: ["jasmine flower isolated white", "Jasminum sambac flowers"],
  lime: ["lime fruit halved white background", "limes isolated white"],
  patchouli: ["patchouli leaves", "Pogostemon cablin leaves"],
  "green-apple": ["granny smith apple white background", "green apple isolated"],
  tuberose: ["tuberose flowers", "Polianthes tuberosa"],
  cedarwood: ["cedar wood cross section", "cedar log slice"],
  sandalwood: ["sandalwood sticks", "Santalum album wood"],
  apple: ["red yellow apple white background", "apple isolated white background"],
  coconut: ["coconut halved white background", "coconut split isolated"],
  vanilla: ["vanilla pods white background", "vanilla beans isolated"],
  iris: ["purple iris flower isolated", "Iris germanica flower white background"],
  nutmeg: ["nutmeg with mace", "nutmeg mace isolated"],
  oud: ["agarwood chips", "oud wood chips"],
  "precious-woods": ["exotic wood samples", "hardwood offcuts"],
  saffron: ["saffron threads white background", "saffron stigmas isolated"],
  "red-rose": ["red rose isolated white background", "red rose flower white"],
  "white-oud": ["light agarwood chips", "aquilaria wood pale"],
  agarwood: ["agarwood resin wood", "Aquilaria agarwood piece"],
  musk: ["ambrette seeds", "Abelmoschus moschatus seeds"],
};

const OK_LICENCE = /^(cc0|public domain|pd|cc[- ]by(-sa)?[- ]?\d)/i;

type Candidate = {
  title: string;
  url: string;
  descUrl: string;
  width: number;
  height: number;
  mime: string;
  license: string;
  artist: string;
};

async function search(q: string): Promise<Candidate[]> {
  const api = new URL("https://commons.wikimedia.org/w/api.php");
  api.search = new URLSearchParams({
    action: "query",
    format: "json",
    generator: "search",
    gsrnamespace: "6",
    gsrsearch: `${q} filetype:bitmap`,
    gsrlimit: "25",
    prop: "imageinfo",
    iiprop: "url|size|mime|extmetadata",
    iiurlwidth: "2000",
  }).toString();
  const res = await fetch(api, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`Commons API ${res.status}`);
  const data = (await res.json()) as {
    query?: { pages?: Record<string, { title: string; imageinfo?: Record<string, unknown>[] }> };
  };
  return Object.values(data.query?.pages ?? {}).flatMap((p) => {
    const ii = p.imageinfo?.[0] as
      | {
          thumburl?: string;
          url: string;
          descriptionurl: string;
          width: number;
          height: number;
          mime: string;
          extmetadata?: Record<string, { value: string }>;
        }
      | undefined;
    if (!ii) return [];
    const strip = (s = "") => s.replace(/<[^>]+>/g, "").trim();
    return [
      {
        title: p.title,
        url: ii.thumburl ?? ii.url,
        descUrl: ii.descriptionurl,
        width: ii.width,
        height: ii.height,
        mime: ii.mime,
        license: strip(ii.extmetadata?.LicenseShortName?.value),
        artist: strip(ii.extmetadata?.Artist?.value) || "Unknown",
      },
    ];
  });
}

/**
 * Flood-fills the plain background from the image borders and turns it transparent.
 * Returns null when the borders are not a plain light backdrop (the photo is not isolated).
 */
export async function cutOut(input: Buffer): Promise<Buffer | null> {
  const img = sharp(input).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const px = (i: number) => [data[i * 4], data[i * 4 + 1], data[i * 4 + 2], data[i * 4 + 3]];

  // Already transparent?
  let transparentBorder = 0;
  let border = 0;
  const bg = [0, 0, 0];
  const edge: number[] = [];
  for (let x = 0; x < W; x++) edge.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y++) edge.push(y * W, y * W + W - 1);
  for (const i of edge) {
    const [r, g, b, a] = px(i);
    border++;
    if (a < 16) transparentBorder++;
    bg[0] += r;
    bg[1] += g;
    bg[2] += b;
  }
  if (transparentBorder / border > 0.9) return sharp(input).png().toBuffer();
  bg.forEach((_, k) => (bg[k] /= border));
  const bgLum = 0.2126 * bg[0] + 0.7152 * bg[1] + 0.0722 * bg[2];
  // Border must be light and uniform
  let far = 0;
  for (const i of edge) {
    const [r, g, b] = px(i);
    if (Math.hypot(r - bg[0], g - bg[1], b - bg[2]) > 40) far++;
  }
  if (bgLum < 200 || far / border > 0.12) return null;

  const TOL = 34;
  const alpha = new Uint8Array(W * H).fill(255);
  const seen = new Uint8Array(W * H);
  const stack = edge.slice();
  while (stack.length) {
    const i = stack.pop()!;
    if (seen[i]) continue;
    seen[i] = 1;
    const [r, g, b] = px(i);
    if (Math.hypot(r - bg[0], g - bg[1], b - bg[2]) > TOL) continue;
    alpha[i] = 0;
    const x = i % W;
    const y = (i / W) | 0;
    if (x > 0) stack.push(i - 1);
    if (x < W - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - W);
    if (y < H - 1) stack.push(i + W);
  }
  // Feather the mask edge by 1px so cut-outs never look jagged
  const soft = await sharp(Buffer.from(alpha), { raw: { width: W, height: H, channels: 1 } })
    .blur(0.8)
    .extractChannel(0)
    .raw()
    .toBuffer();
  for (let i = 0; i < W * H; i++) data[i * 4 + 3] = Math.min(data[i * 4 + 3], soft[i]);
  return sharp(data, { raw: { width: W, height: H, channels: 4 } })
    .png()
    .toBuffer();
}

/** Trim to the subject and centre it on a transparent 2000×2000 canvas at ~80% fill. */
export async function frame(png: Buffer) {
  const trimmed = await sharp(png).trim({ threshold: 1 }).toBuffer();
  const fitted = await sharp(trimmed)
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: false })
    .toBuffer();
  const m = await sharp(fitted).metadata();
  return sharp({
    create: { width: 2000, height: 2000, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      {
        input: fitted,
        left: Math.round((2000 - m.width!) / 2),
        top: Math.round((2000 - m.height!) / 2),
      },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function main() {
  const args = process.argv.slice(2);
  const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;
  const dry = args.includes("--dry-run");
  const force = args.includes("--force");
  await fs.mkdir(OUT, { recursive: true });
  const credits: Record<string, Omit<Candidate, "url">> = JSON.parse(
    await fs.readFile(CREDITS_JSON, "utf8").catch(() => "{}"),
  );

  for (const note of NOTES) {
    if (only && note.slug !== only) continue;
    const file = path.join(OUT, `${note.slug}.png`);
    const exists = await fs.stat(file).then(
      () => true,
      () => false,
    );
    if (exists && !force) {
      console.log(`✓ ${note.slug}: already present`);
      continue;
    }
    let done = false;
    for (const q of QUERIES[note.slug] ?? [note.name]) {
      const cands = (await search(q))
        .filter((c) => /jpeg|png/.test(c.mime) && Math.max(c.width, c.height) >= 1200)
        .filter((c) => OK_LICENCE.test(c.license))
        .sort(
          (a, b) =>
            Number(/isolat|white|background/i.test(b.title)) -
            Number(/isolat|white|background/i.test(a.title)),
        );
      if (dry) {
        console.log(`\n${note.slug} ← "${q}"`);
        cands
          .slice(0, 5)
          .forEach((c) =>
            console.log(`   ${c.license.padEnd(14)} ${c.width}×${c.height}  ${c.title}`),
          );
        continue;
      }
      for (const c of cands) {
        const res = await fetch(c.url, { headers: { "User-Agent": UA } });
        if (!res.ok) continue;
        const cut = await cutOut(Buffer.from(await res.arrayBuffer()));
        if (!cut) continue;
        await fs.writeFile(file, await frame(cut));
        credits[note.slug] = {
          title: c.title,
          descUrl: c.descUrl,
          width: c.width,
          height: c.height,
          mime: c.mime,
          license: c.license,
          artist: c.artist,
        };
        console.log(`✓ ${note.slug}: ${c.title} (${c.license}, ${c.artist})`);
        done = true;
        break;
      }
      if (done || dry) break;
    }
    if (!done && !dry)
      console.log(
        `✗ ${note.slug}: no isolated, openly licensed photo found. Keep the frame or supply one.`,
      );
  }

  if (!dry) {
    await fs.writeFile(CREDITS_JSON, JSON.stringify(credits, null, 2) + "\n");
    const md = [
      "# Image credits",
      "",
      "Note photographs sourced from Wikimedia Commons under open licences.",
      "",
      "| Note | Photo | Author | Licence |",
      "|---|---|---|---|",
      ...Object.entries(credits).map(
        ([slug, c]) =>
          `| ${slug} | [${c.title.replace(/^File:/, "")}](${c.descUrl}) | ${c.artist} | ${c.license} |`,
      ),
      "",
    ].join("\n");
    await fs.writeFile(path.join(ROOT, "CREDITS.md"), md);
    console.log("\nWrote CREDITS.md. Review every image before publishing.");
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
