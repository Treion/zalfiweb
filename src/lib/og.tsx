/* eslint-disable @next/next/no-img-element -- next/og (satori) renders plain <img>, not next/image */
import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { ImageResponse } from "next/og";
import { BOTTLE_META } from "@/components/stage/bottle-meta";
import { LOGO_PARTS, LOGO_VIEWBOX, WORDMARK_VIEWBOX } from "@/components/brand/logo-paths";
import type { Fragrance } from "@/lib/fragrance";

export const OG_SIZE = { width: 1200, height: 630 };

const root = process.cwd();
const fonts = async () => [
  {
    name: "Bodoni",
    data: await readFile(path.join(root, "assets/fonts/BodoniModa-Regular.ttf")),
    style: "normal" as const,
    weight: 400 as const,
  },
  {
    name: "Bodoni",
    data: await readFile(path.join(root, "assets/fonts/BodoniModa-Italic.ttf")),
    style: "italic" as const,
    weight: 400 as const,
  },
];

/** The real bottle photo, trimmed to its bounds and resized: never cropped, never redrawn. */
async function bottleDataUrl(slug: string, height: number) {
  const m = BOTTLE_META[slug];
  const buf = await sharp(path.join(root, "public/images/bottles", `${slug}.png`))
    .extract({ left: m.trim.x, top: m.trim.y, width: m.trim.w, height: m.trim.h })
    .resize({ height })
    .png()
    .toBuffer();
  return {
    src: `data:image/png;base64,${buf.toString("base64")}`,
    w: Math.round((m.trim.w / m.trim.h) * height),
    h: height,
  };
}

function logoDataUrl(color: string, variant: "full" | "wordmark") {
  const ids = variant === "full" ? null : new Set(["z", "a", "l", "f", "i"]);
  const paths = LOGO_PARTS.filter((p) => !ids || ids.has(p.id))
    .map((p) => `<path d="${p.d}"/>`)
    .join("");
  const vb = variant === "full" ? LOGO_VIEWBOX : WORDMARK_VIEWBOX;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" fill="${color}">${paths}</svg>`;
  const [, , w, h] = vb.split(" ").map(Number);
  return { src: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`, ratio: w / h };
}

export async function houseOgImage(fragrances: Fragrance[]) {
  const logo = logoDataUrl("#EFEAE1", "full");
  const picks = ["reva", "oudor", "solea"].filter((s) => fragrances.some((f) => f.slug === s));
  const bottles = await Promise.all(picks.map((s, i) => bottleDataUrl(s, i === 1 ? 470 : 400)));
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: "#0E0D0C",
        color: "#EFEAE1",
        fontFamily: "Bodoni",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "70px 0 64px 72px",
          width: 560,
        }}
      >
        <img src={logo.src} width={300} height={300 / logo.ratio} alt="" />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 54, lineHeight: 1 }}>Six worlds,</div>
          <div style={{ fontSize: 54, lineHeight: 1.05, fontStyle: "italic" }}>
            in smoked glass.
          </div>
          <div style={{ marginTop: 26, fontSize: 18, letterSpacing: 6, color: "#B9B2A6" }}>
            EAUX DE PARFUM
          </div>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          flex: 1,
          paddingBottom: 60,
        }}
      >
        {bottles.map((b, i) => (
          <img
            key={i}
            src={b.src}
            width={b.w}
            height={b.h}
            alt=""
            style={{ marginLeft: i ? -60 : 0 }}
          />
        ))}
      </div>
    </div>,
    { ...OG_SIZE, fonts: await fonts() },
  );
}

export async function fragranceOgImage(f: Fragrance) {
  const logo = logoDataUrl(f.palette.ink, "wordmark");
  const bottle = await bottleDataUrl(f.slug, 540);
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: f.palette.bg,
        color: f.palette.ink,
        fontFamily: "Bodoni",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 0 64px 72px",
          width: 660,
        }}
      >
        <img src={logo.src} width={170} height={170 / logo.ratio} alt="" />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 17, letterSpacing: 6, opacity: 0.7 }}>{f.mood.toUpperCase()}</div>
          <div style={{ fontSize: 168, lineHeight: 0.9, marginTop: 18 }}>{f.name}</div>
          <div
            style={{
              fontSize: 34,
              fontStyle: "italic",
              lineHeight: 1.2,
              marginTop: 22,
              maxWidth: 560,
            }}
          >
            {f.tagline}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center" }}>
        <img src={bottle.src} width={bottle.w} height={bottle.h} alt="" />
      </div>
    </div>,
    { ...OG_SIZE, fonts: await fonts() },
  );
}
