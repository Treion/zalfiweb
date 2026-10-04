/**
 * Renders the traced logo (src/components/brand/logo-paths.ts) as a PNG for email, where SVG isn't
 * reliable: public/brand/zalfi-logo-ink.png, dark ink on transparent. Run by `npm run assets:logo`.
 */
import path from "node:path";
import sharp from "sharp";
import { LOGO_PARTS, LOGO_VIEWBOX } from "../../src/components/brand/logo-paths";

const INK = "#1A1816";
const WIDTH = 480;

const [, , w, h] = LOGO_VIEWBOX.split(" ").map(Number);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${LOGO_VIEWBOX}" width="${WIDTH}" height="${Math.round((WIDTH * h!) / w!)}" fill="${INK}">${LOGO_PARTS.map((p) => `<path d="${p.d}"/>`).join("")}</svg>`;
const out = path.join(process.cwd(), "public/brand/zalfi-logo-ink.png");
void sharp(Buffer.from(svg), { density: 300 })
  .resize({ width: WIDTH })
  .png({ compressionLevel: 9 })
  .toFile(out)
  .then(() => console.log(`Wrote ${path.relative(process.cwd(), out)}`));
