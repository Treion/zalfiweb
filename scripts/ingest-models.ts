/**
 * Ingests 3D models (GLB) generated with Higgsfield into the site.
 *
 *   npm run models:ingest -- --kind bottle --slug reva --src ./reva.glb [--yaw 0]
 *   npm run models:ingest -- --kind note --slug iris --src https://…/iris.glb
 *   npm run models:ingest -- --batch assets/models/sources.json
 *   npm run models:ingest -- --remove bottle:reva
 *
 * `sources.json` is an array of { kind, slug, src, yaw? }. src may be a local path or an https URL
 * (Higgsfield result URLs live on its CloudFront CDN; the environment must allow that host).
 *
 * Each model is:
 *   1. cleaned: dedup, prune and weld; notes are simplified to a web-friendly triangle budget
 *   2. compressed: textures → WebP (2048px bottles, 1024px notes), geometry → meshopt
 *   3. written to public/models/{bottles|notes}/{slug}.glb
 *   4. registered in src/components/stage/model-manifest.ts, with its bounds, triangle count
 *      and a yaw correction so the label faces the camera
 * The stage reads that manifest: anything listed renders in 3D, and anything missing keeps its
 * current fallback (the relit bottle photo, or the note's frame or photo).
 */
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { Document, NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import {
  dedup,
  getBounds,
  meshopt,
  prune,
  simplify,
  textureCompress,
  weld,
} from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";

const ROOT = path.resolve(__dirname, "..");
const OUT = { bottle: "public/models/bottles", note: "public/models/notes" } as const;
const MANIFEST_JSON = path.join(ROOT, "assets/models/manifest.json");
const MANIFEST_TS = path.join(ROOT, "src/components/stage/model-manifest.ts");

type Kind = keyof typeof OUT;
type Entry = {
  kind: Kind;
  slug: string;
  file: string;
  bytes: number;
  triangles: number;
  /** Bounds of the normalised model: height is 1, width/depth relative to it */
  size: [number, number, number];
  /** Degrees around Y so the front (label / most recognisable side) faces the camera */
  yaw: number;
  source: string;
};
type Manifest = Record<string, Entry>; // key: `${kind}:${slug}`

const TRIANGLE_BUDGET: Record<Kind, number> = { bottle: 120_000, note: 24_000 };
const TEXTURE_SIZE: Record<Kind, [number, number]> = { bottle: [2048, 2048], note: [1024, 1024] };

async function io() {
  await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
  return new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });
}

async function readSource(src: string) {
  if (/^https?:\/\//.test(src)) {
    const res = await fetch(src);
    if (!res.ok) throw new Error(`Download failed (${res.status}) for ${src}`);
    return new Uint8Array(await res.arrayBuffer());
  }
  return new Uint8Array(await fs.readFile(path.resolve(src)));
}

function countTriangles(doc: Document) {
  let n = 0;
  for (const mesh of doc.getRoot().listMeshes())
    for (const prim of mesh.listPrimitives()) {
      const idx = prim.getIndices();
      const pos = prim.getAttribute("POSITION");
      n += Math.floor((idx ? idx.getCount() : (pos?.getCount() ?? 0)) / 3);
    }
  return n;
}

/** Centre on X/Z, stand the model on y = 0, and scale it to a height of 1. */
function normalise(doc: Document) {
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  const { min, max } = getBounds(scene);
  const h = max[1] - min[1] || 1;
  const s = 1 / h;
  const pivot = doc
    .createNode("zalfi-normalised")
    .setScale([s, s, s])
    .setTranslation([-((min[0] + max[0]) / 2) * s, -min[1] * s, -((min[2] + max[2]) / 2) * s]);
  for (const child of scene.listChildren()) {
    scene.removeChild(child);
    pivot.addChild(child);
  }
  scene.addChild(pivot);
  const b = getBounds(scene);
  return [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]].map(
    (v) => +v.toFixed(4),
  ) as [number, number, number];
}

async function ingest(kind: Kind, slug: string, src: string, yaw = 0): Promise<Entry> {
  if (!/^[a-z0-9-]+$/.test(slug)) throw new Error(`Bad slug "${slug}"`);
  const nodeIO = await io();
  const doc = await nodeIO.readBinary(await readSource(src));

  await doc.transform(dedup(), prune(), weld());
  const before = countTriangles(doc);
  if (before > TRIANGLE_BUDGET[kind]) {
    await MeshoptSimplifier.ready;
    const ratio = TRIANGLE_BUDGET[kind] / before;
    await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.001 }));
  }
  const size = normalise(doc);
  await doc.transform(
    textureCompress({ encoder: sharp, targetFormat: "webp", resize: TEXTURE_SIZE[kind] }),
    meshopt({ encoder: MeshoptEncoder, level: "medium" }),
  );

  const rel = `${OUT[kind]}/${slug}.glb`;
  await fs.mkdir(path.join(ROOT, OUT[kind]), { recursive: true });
  const bin = await nodeIO.writeBinary(doc);
  await fs.writeFile(path.join(ROOT, rel), bin);
  const entry: Entry = {
    kind,
    slug,
    file: "/" + rel.replace(/^public\//, ""),
    bytes: bin.byteLength,
    triangles: countTriangles(doc),
    size,
    yaw,
    source: /^https?:/.test(src) ? new URL(src).hostname : path.basename(src),
  };
  console.log(
    `✓ ${kind}:${slug}  ${(entry.bytes / 1024).toFixed(0)} KB  ${before}→${entry.triangles} tris  size ${size.join("×")}`,
  );
  return entry;
}

async function readManifest(): Promise<Manifest> {
  return JSON.parse(await fs.readFile(MANIFEST_JSON, "utf8").catch(() => "{}"));
}

async function writeManifest(m: Manifest) {
  const sorted = Object.fromEntries(Object.entries(m).sort(([a], [b]) => a.localeCompare(b)));
  await fs.mkdir(path.dirname(MANIFEST_JSON), { recursive: true });
  await fs.writeFile(MANIFEST_JSON, JSON.stringify(sorted, null, 2) + "\n");
  const pick = (kind: Kind) =>
    Object.fromEntries(
      Object.values(sorted)
        .filter((e) => e.kind === kind)
        .map((e) => [e.slug, { file: e.file, size: e.size, yaw: e.yaw }]),
    );
  const ts = `// GENERATED by scripts/ingest-models.ts. Do not edit by hand.
// Every model listed here renders in 3D on the stage; anything missing keeps its fallback.

export type ModelEntry = {
  /** Public URL of the optimised GLB */
  file: string;
  /** Normalised bounds [width, height (=1), depth] */
  size: readonly [number, number, number];
  /** Degrees around Y so the model's front faces the camera */
  yaw: number;
};

export const BOTTLE_MODELS: Record<string, ModelEntry> = ${JSON.stringify(pick("bottle"), null, 2)};

export const NOTE_MODELS: Record<string, ModelEntry> = ${JSON.stringify(pick("note"), null, 2)};
`;
  await fs.writeFile(MANIFEST_TS, ts);
}

async function main() {
  const args = process.argv.slice(2);
  const arg = (k: string) => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined);
  const manifest = await readManifest();

  const remove = arg("--remove");
  if (remove) {
    const e = manifest[remove];
    if (e) await fs.rm(path.join(ROOT, "public", e.file), { force: true });
    delete manifest[remove];
    await writeManifest(manifest);
    console.log(`Removed ${remove}`);
    return;
  }

  const jobs: { kind: Kind; slug: string; src: string; yaw?: number }[] = [];
  const batch = arg("--batch");
  if (batch) jobs.push(...JSON.parse(await fs.readFile(batch, "utf8")));
  else if (arg("--slug") && arg("--src"))
    jobs.push({
      kind: (arg("--kind") ?? "note") as Kind,
      slug: arg("--slug")!,
      src: arg("--src")!,
      yaw: Number(arg("--yaw") ?? 0),
    });
  else if (!args.includes("--manifest-only")) {
    console.error("Usage: see the header of scripts/ingest-models.ts");
    process.exit(1);
  }

  for (const j of jobs) {
    if (!(j.kind in OUT)) throw new Error(`kind must be bottle or note, got ${j.kind}`);
    try {
      manifest[`${j.kind}:${j.slug}`] = await ingest(j.kind, j.slug, j.src, j.yaw ?? 0);
    } catch (e) {
      console.error(`✗ ${j.kind}:${j.slug}: ${(e as Error).message}`);
    }
  }
  await writeManifest(manifest);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
