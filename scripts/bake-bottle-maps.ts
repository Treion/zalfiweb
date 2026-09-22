/**
 * Bakes relighting maps from the bottle cutouts so the WebGL stage can light the real
 * product photos with live shaders (see PLAN.md §2).
 *
 * For each public/images/bottles/{slug}.png it writes public/images/bottles/maps/:
 *   {slug}-color.webp   the photo trimmed to its alpha bounds (lossless crop, no resampling)
 *   {slug}-normal.webp  tangent-space normals (RGB = n * 0.5 + 0.5)
 *   {slug}-mask.webp    R = cap metal, G = glass, B = printed label, A = glass thickness
 * and src/components/stage/bottle-meta.ts with per-bottle layout data.
 *
 * Run: npm run assets:bottles
 */
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(__dirname, "..");
const DIR = path.join(ROOT, "public/images/bottles");
const OUT = path.join(DIR, "maps");
const SLUGS = ["reva", "riven", "maree", "solea", "bond", "oudor"] as const;

type Meta = {
  slug: string;
  /** Source image size */
  source: { w: number; h: number };
  /** Trimmed rect inside the source image, px */
  trim: { x: number; y: number; w: number; h: number };
  /** Row (0..1 of trimmed height) where the cap ends and the glass shoulder begins */
  shoulder: number;
  capShape: "cylinder" | "sphere";
  /** Average cap colour, linear-ish sRGB 0..1, used to tint metal reflections */
  capTint: [number, number, number];
};

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

/** Two-pass chamfer (3-4) distance transform: distance of each inside pixel to the nearest outside pixel. */
function distanceField(inside: Uint8Array, w: number, h: number) {
  const INF = 1e9;
  const d = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) d[i] = inside[i] ? INF : 0;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d[y * w + x]);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!d[i]) continue;
      d[i] = Math.min(
        d[i],
        at(x - 1, y) + 3,
        at(x, y - 1) + 3,
        at(x - 1, y - 1) + 4,
        at(x + 1, y - 1) + 4,
      );
    }
  for (let y = h - 1; y >= 0; y--)
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (!d[i]) continue;
      d[i] = Math.min(
        d[i],
        at(x + 1, y) + 3,
        at(x, y + 1) + 3,
        at(x + 1, y + 1) + 4,
        at(x - 1, y + 1) + 4,
      );
    }
  for (let i = 0; i < w * h; i++) d[i] /= 3;
  return d;
}

/** Separable box blur (radius r), used to soften luminance before extracting surface detail. */
function blur(src: Float32Array, w: number, h: number, r: number) {
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  const n = r * 2 + 1;
  for (let y = 0; y < h; y++) {
    let acc = 0;
    for (let x = -r; x <= r; x++) acc += src[y * w + clamp(x, 0, w - 1)];
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = acc / n;
      acc += src[y * w + Math.min(w - 1, x + r + 1)] - src[y * w + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[clamp(y, 0, h - 1) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / n;
      acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
  return out;
}

async function bake(slug: string): Promise<Meta> {
  const file = path.join(DIR, `${slug}.png`);
  const src = sharp(file).ensureAlpha();
  const { width: SW, height: SH } = await src.metadata();

  // Trim to alpha bounds with a small margin so edge normals have room.
  const full = await src.raw().toBuffer({ resolveWithObject: true });
  let x0 = SW!,
    y0 = SH!,
    x1 = 0,
    y1 = 0;
  for (let y = 0; y < SH!; y++)
    for (let x = 0; x < SW!; x++)
      if (full.data[(y * SW! + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  const m = 12;
  const trim = {
    x: Math.max(0, x0 - m),
    y: Math.max(0, y0 - m),
    w: Math.min(SW!, x1 + m + 1) - Math.max(0, x0 - m),
    h: Math.min(SH!, y1 + m + 1) - Math.max(0, y0 - m),
  };
  const W = trim.w,
    H = trim.h;

  const color = sharp(file).extract({ left: trim.x, top: trim.y, width: W, height: H });
  await color
    .clone()
    .webp({ quality: 95, alphaQuality: 100, smartSubsample: true })
    .toFile(path.join(OUT, `${slug}-color.webp`));
  const { data } = await color.clone().ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  const alpha = new Float32Array(W * H);
  const lum = new Float32Array(W * H);
  const inside = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    alpha[i] = data[i * 4 + 3] / 255;
    inside[i] = alpha[i] > 0.5 ? 1 : 0;
    lum[i] = (0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2]) / 255;
  }

  // Row extents → find where the (narrow) cap meets the (wide) glass cube.
  const left = new Int32Array(H).fill(-1);
  const right = new Int32Array(H).fill(-1);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++)
      if (inside[y * W + x]) {
        left[y] = x;
        break;
      }
    for (let x = W - 1; x >= 0; x--)
      if (inside[y * W + x]) {
        right[y] = x;
        break;
      }
  }
  const widthAt = (y: number) => (left[y] < 0 ? 0 : right[y] - left[y] + 1);
  let maxW = 0;
  for (let y = 0; y < H; y++) maxW = Math.max(maxW, widthAt(y));
  let top = 0;
  while (top < H && widthAt(top) === 0) top++;
  let shoulderY = top;
  while (shoulderY < H && widthAt(shoulderY) < maxW * 0.7) shoulderY++;

  // Cap shape: a sphere is narrow near its top, a ribbed cylinder is nearly full width.
  // Ignore the flare where the cap meets the glass shoulder.
  const capBody = top + Math.round((shoulderY - top) * 0.8);
  let capMaxW = 0;
  for (let y = top; y < capBody; y++) capMaxW = Math.max(capMaxW, widthAt(y));
  const probe = top + Math.round((shoulderY - top) * 0.08);
  const capShape: Meta["capShape"] = widthAt(probe) < capMaxW * 0.75 ? "sphere" : "cylinder";

  // Sphere geometry: centre/radius from the widest cap row.
  let sphereCy = top,
    sphereR = capMaxW / 2,
    sphereCx = W / 2;
  if (capShape === "sphere") {
    for (let y = top; y < capBody; y++)
      if (widthAt(y) >= capMaxW - 1) {
        sphereCy = y;
        sphereCx = (left[y] + right[y]) / 2;
        break;
      }
    sphereR = capMaxW / 2;
  }

  const dist = distanceField(inside, W, H);
  const detail = blur(lum, W, H, 2);
  const EDGE = Math.max(10, maxW * 0.035); // glass edge rounding radius, px
  const DETAIL = 2.2; // strength of photo-derived surface detail

  const normal = Buffer.alloc(W * H * 3);
  const mask = Buffer.alloc(W * H * 4);
  let capR = 0,
    capG = 0,
    capB = 0,
    capN = 0;
  let glassLumSum = 0,
    glassN = 0;
  for (let y = shoulderY; y < H; y++)
    for (let x = 0; x < W; x++)
      if (inside[y * W + x]) {
        glassLumSum += lum[y * W + x];
        glassN++;
      }
  const glassLum = glassLumSum / Math.max(1, glassN);

  for (let y = 0; y < H; y++) {
    const isCap = y < shoulderY;
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let nx = 0,
        ny = 0,
        nz = 1;
      if (inside[i]) {
        // photo-derived micro detail (ribs, bevels, engraved print)
        const gx = detail[y * W + Math.min(W - 1, x + 1)] - detail[y * W + Math.max(0, x - 1)];
        const gy = detail[Math.min(H - 1, y + 1) * W + x] - detail[Math.max(0, y - 1) * W + x];

        if (isCap && capShape === "sphere" && Math.hypot(x - sphereCx, y - sphereCy) < sphereR) {
          nx = (x - sphereCx) / sphereR;
          ny = (y - sphereCy) / sphereR;
          nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
          nx -= gx * DETAIL * 0.3;
          ny -= gy * DETAIL * 0.3;
        } else if (isCap) {
          // cylinder (or collar): curvature across the row, ribs from the photo vertically
          const half = Math.max(1, (right[y] - left[y]) / 2);
          nx = clamp((x - (left[y] + half)) / half, -0.98, 0.98);
          nz = Math.sqrt(1 - nx * nx);
          ny = -gy * DETAIL * 1.4;
        } else {
          // glass cube: flat front face, rounded silhouette edges
          const e = smooth(0, EDGE, dist[i]);
          const cx = (left[y] + right[y]) / 2;
          const side = Math.sign(x - cx) || 1;
          nx = (1 - e) * side * 0.9;
          // The photos are three-quarter views: the cube's left side face occupies roughly the
          // first 15% of each row. Turn it away from the camera so it catches light as its own plane.
          const rowW = right[y] - left[y];
          const sideFace = 1 - smooth(rowW * 0.13, rowW * 0.17, x - left[y]);
          nx = nx * (1 - sideFace) - 0.62 * sideFace * e;
          const nearTop =
            y - shoulderY < EDGE * 1.5 ? (1 - smooth(0, EDGE * 1.5, y - shoulderY)) * -0.8 : 0;
          const nearBottom = dist[i] < EDGE && y > H * 0.9 ? (1 - e) * 0.8 : 0;
          ny = nearTop + nearBottom;
          nx -= gx * DETAIL;
          ny -= gy * DETAIL;
        }
        const len = Math.hypot(nx, ny, nz) || 1;
        nx /= len;
        ny /= len;
        nz /= len;
      }
      // Stored in GL convention: +Y up
      normal[i * 3] = Math.round((nx * 0.5 + 0.5) * 255);
      normal[i * 3 + 1] = Math.round((-ny * 0.5 + 0.5) * 255);
      normal[i * 3 + 2] = Math.round((nz * 0.5 + 0.5) * 255);

      const a = alpha[i];
      const metal = isCap ? a : 0;
      const glass = isCap ? 0 : a;
      // printed silver text/emblem: much brighter than the smoked glass, away from the silhouette
      const onFrontFace =
        !isCap && x - left[y] > (right[y] - left[y]) * 0.22 && dist[i] > EDGE * 2.5;
      const print = onFrontFace ? smooth(glassLum + 0.18, glassLum + 0.4, lum[i]) : 0;
      const thickness = clamp(dist[i] / (maxW * 0.18));
      mask[i * 4] = Math.round(metal * 255);
      mask[i * 4 + 1] = Math.round(glass * 255);
      mask[i * 4 + 2] = Math.round(print * 255);
      mask[i * 4 + 3] = Math.round(thickness * 255);

      if (isCap && inside[i]) {
        capR += data[i * 4];
        capG += data[i * 4 + 1];
        capB += data[i * 4 + 2];
        capN++;
      }
    }
  }

  await sharp(normal, { raw: { width: W, height: H, channels: 3 } })
    .webp({ lossless: true })
    .toFile(path.join(OUT, `${slug}-normal.webp`));
  await sharp(mask, { raw: { width: W, height: H, channels: 4 } })
    .webp({ lossless: true })
    .toFile(path.join(OUT, `${slug}-mask.webp`));

  const round = (v: number) => +v.toFixed(3);
  return {
    slug,
    source: { w: SW!, h: SH! },
    trim,
    shoulder: round(shoulderY / H),
    capShape,
    capTint: [round(capR / capN / 255), round(capG / capN / 255), round(capB / capN / 255)],
  };
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const metas: Meta[] = [];
  for (const slug of SLUGS) {
    const meta = await bake(slug);
    metas.push(meta);
    console.log(
      slug,
      meta.capShape,
      `shoulder=${meta.shoulder}`,
      `trim=${meta.trim.w}x${meta.trim.h}`,
      `cap=${meta.capTint}`,
    );
  }
  const ts = `// GENERATED by scripts/bake-bottle-maps.ts. Do not edit by hand.

export type BottleMeta = {
  slug: string;
  source: { w: number; h: number };
  trim: { x: number; y: number; w: number; h: number };
  shoulder: number;
  capShape: "cylinder" | "sphere";
  capTint: readonly [number, number, number];
};

export const BOTTLE_META: Record<string, BottleMeta> = ${JSON.stringify(
    Object.fromEntries(metas.map((m) => [m.slug, m])),
    null,
    2,
  )};
`;
  await fs.mkdir(path.join(ROOT, "src/components/stage"), { recursive: true });
  await fs.writeFile(path.join(ROOT, "src/components/stage/bottle-meta.ts"), ts);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
