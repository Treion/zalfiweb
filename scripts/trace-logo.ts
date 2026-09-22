/**
 * Traces public/brand/logo.png into vector paths, split into animatable parts.
 *
 * Output:
 *   public/brand/zalfi-logo.svg        complete logo, fill="currentColor"
 *   src/components/brand/logo-paths.ts path data per part (emblem cap, emblem body, Z A L F I)
 *
 * The letterforms are traced from the owner's artwork, never re-drawn or typeset.
 * Run: npm run assets:logo
 */
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
// potrace ships without types
// eslint-disable-next-line @typescript-eslint/no-require-imports
const potrace = require("potrace") as {
  trace: (
    img: Buffer,
    opts: Record<string, unknown>,
    cb: (err: Error | null, svg: string) => void,
  ) => void;
};

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "public/brand/logo.png");

type Part = { id: string; label: string; box: [number, number, number, number] };

async function findParts(): Promise<{ parts: Part[]; bbox: [number, number, number, number] }> {
  const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const ink = (x: number, y: number) => data[(y * W + x) * 4 + 3] > 128;

  const rowHasInk = (y: number, x0 = 0, x1 = W) => {
    for (let x = x0; x < x1; x++) if (ink(x, y)) return true;
    return false;
  };
  const colHasInk = (x: number, y0: number, y1: number) => {
    for (let y = y0; y < y1; y++) if (ink(x, y)) return true;
    return false;
  };
  const runs = (flags: boolean[]) => {
    const out: [number, number][] = [];
    let s = -1;
    flags.forEach((v, i) => {
      if (v && s < 0) s = i;
      if (!v && s >= 0) {
        out.push([s, i]);
        s = -1;
      }
    });
    if (s >= 0) out.push([s, flags.length]);
    return out;
  };

  const rowRuns = runs(Array.from({ length: H }, (_, y) => rowHasInk(y)));
  // Expect: emblem cap, emblem body, wordmark (three vertical bands)
  if (rowRuns.length < 3) throw new Error(`Unexpected logo layout: ${JSON.stringify(rowRuns)}`);
  const [cap, body] = rowRuns;
  const word = rowRuns[rowRuns.length - 1];

  const hRange = (y0: number, y1: number) =>
    runs(Array.from({ length: W }, (_, x) => colHasInk(x, y0, y1)));
  const spanOf = (y0: number, y1: number): [number, number] => {
    const r = hRange(y0, y1);
    return [r[0][0], r[r.length - 1][1]];
  };

  const [cx0, cx1] = spanOf(cap[0], cap[1]);
  const [bx0, bx1] = spanOf(body[0], body[1]);
  const letters = hRange(word[0], word[1]);
  if (letters.length !== 5) throw new Error(`Expected 5 letters, found ${letters.length}`);

  const parts: Part[] = [
    { id: "cap", label: "emblem cap", box: [cx0, cap[0], cx1, cap[1]] },
    { id: "body", label: "emblem body", box: [bx0, body[0], bx1, body[1]] },
    ...["Z", "A", "L", "F", "I"].map((l, i) => ({
      id: l.toLowerCase(),
      label: `letter ${l}`,
      box: [letters[i][0], word[0], letters[i][1], word[1]] as [number, number, number, number],
    })),
  ];
  const xs = parts.flatMap((p) => [p.box[0], p.box[2]]);
  const ys = parts.flatMap((p) => [p.box[1], p.box[3]]);
  return { parts, bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] };
}

function traceRegion(box: [number, number, number, number]): Promise<string> {
  const pad = 6;
  const [x0, y0, x1, y1] = box;
  return sharp(SRC)
    .extract({ left: x0 - pad, top: y0 - pad, width: x1 - x0 + pad * 2, height: y1 - y0 + pad * 2 })
    .flatten({ background: "#ffffff" })
    .png()
    .toBuffer()
    .then(
      (buf) =>
        new Promise<string>((resolve, reject) =>
          potrace.trace(
            buf,
            { threshold: 128, turdSize: 4, optTolerance: 0.2, alphaMax: 1, turnPolicy: "minority" },
            (err, svg) => {
              if (err) return reject(err);
              const d = svg.match(/ d="([^"]+)"/)?.[1];
              if (!d) return reject(new Error("No path traced"));
              // shift into logo coordinates
              resolve(translatePath(d, x0 - pad, y0 - pad));
            },
          ),
        ),
    );
}

/** potrace emits absolute M/L/C commands only, so every number pair is an x,y coordinate. */
function translatePath(d: string, dx: number, dy: number) {
  return d.replace(/(-?\d*\.?\d+)\s*,?\s*(-?\d*\.?\d+)/g, (_, x, y) => {
    const nx = +(parseFloat(x) + dx).toFixed(2);
    const ny = +(parseFloat(y) + dy).toFixed(2);
    return `${nx} ${ny}`;
  });
}

async function main() {
  const { parts, bbox } = await findParts();
  const traced = await Promise.all(parts.map(async (p) => ({ ...p, d: await traceRegion(p.box) })));
  const pad = 8;
  const viewBox = [
    bbox[0] - pad,
    bbox[1] - pad,
    bbox[2] - bbox[0] + pad * 2,
    bbox[3] - bbox[1] + pad * 2,
  ];

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox.join(" ")}" fill="currentColor" role="img" aria-label="ZALFI">
${traced.map((p) => `  <path id="${p.id}" d="${p.d}"/>`).join("\n")}
</svg>
`;
  await fs.writeFile(path.join(ROOT, "public/brand/zalfi-logo.svg"), svg);

  // Emblem only (for favicon / nav mark)
  const emb = traced.filter((p) => p.id === "cap" || p.id === "body");
  const ex0 = Math.min(...emb.map((p) => p.box[0])) - pad;
  const ey0 = Math.min(...emb.map((p) => p.box[1])) - pad;
  const ex1 = Math.max(...emb.map((p) => p.box[2])) + pad;
  const ey1 = Math.max(...emb.map((p) => p.box[3])) + pad;
  const emblemViewBox = [ex0, ey0, ex1 - ex0, ey1 - ey0];
  await fs.writeFile(
    path.join(ROOT, "public/brand/zalfi-emblem.svg"),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${emblemViewBox.join(" ")}" fill="currentColor">\n${emb
      .map((p) => `  <path d="${p.d}"/>`)
      .join("\n")}\n</svg>\n`,
  );

  // Wordmark only (for the nav and footer)
  const wm = traced.filter((p) => p.id !== "cap" && p.id !== "body");
  const wx0 = Math.min(...wm.map((p) => p.box[0])) - pad;
  const wy0 = Math.min(...wm.map((p) => p.box[1])) - pad;
  const wx1 = Math.max(...wm.map((p) => p.box[2])) + pad;
  const wy1 = Math.max(...wm.map((p) => p.box[3])) + pad;

  const ts = `// GENERATED by scripts/trace-logo.ts from public/brand/logo.png. Do not edit by hand.
// Coordinates are in the original logo.png pixel space.

export type LogoPartId = ${traced.map((p) => `"${p.id}"`).join(" | ")};

export type LogoPart = {
  id: LogoPartId;
  label: string;
  /** [x0, y0, x1, y1] in logo pixel space */
  box: readonly [number, number, number, number];
  d: string;
};

export const LOGO_VIEWBOX = "${viewBox.join(" ")}";
export const EMBLEM_VIEWBOX = "${emblemViewBox.join(" ")}";
export const WORDMARK_VIEWBOX = "${[wx0, wy0, wx1 - wx0, wy1 - wy0].join(" ")}";

export const LOGO_PARTS: readonly LogoPart[] = [
${traced
  .map(
    (p) => `  {
    id: "${p.id}",
    label: "${p.label}",
    box: [${p.box.join(", ")}],
    d: "${p.d}",
  },`,
  )
  .join("\n")}
];
`;
  await fs.mkdir(path.join(ROOT, "src/components/brand"), { recursive: true });
  await fs.writeFile(path.join(ROOT, "src/components/brand/logo-paths.ts"), ts);
  console.log(
    "Traced",
    traced.map((p) => `${p.id}(${p.d.length}b)`).join(" "),
    "viewBox",
    viewBox.join(" "),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
