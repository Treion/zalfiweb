import Image from "next/image";
import clsx from "clsx";
import type { Fragrance } from "@/lib/fragrance";
import { BOTTLE_META } from "@/components/stage/bottle-meta";

type Props = {
  fragrance: Pick<Fragrance, "slug" | "bottleImage" | "bottleAlt">;
  /** `sizes` for the rendered bottle box (the helper widens it for the transparent margins) */
  sizes: string;
  /** Only for the LCP bottle. Everything else lazy-loads. */
  preload?: boolean;
  /**
   * "square": the 2000×2000 photo, object-contain, in a square box.
   * "trim": the bottle's own bounds fill the parent exactly. This matches how the WebGL stage
   * places the relit bottle, so the fallback and the render line up pixel for pixel. The
   * transparent margins overflow the box, and the bottle itself is never cropped.
   */
  fit?: "square" | "trim";
  className?: string;
};

/**
 * A product bottle photo. The owner's shots are 2000×2000 transparent cutouts, always shown
 * uncropped and undistorted at quality 90, with space reserved by aspect ratio (no layout shift).
 */
export function BottleImage({ fragrance, sizes, preload, fit = "square", className }: Props) {
  if (fit === "trim") {
    const m = BOTTLE_META[fragrance.slug];
    const sx = m.source.w / m.trim.w;
    return (
      <div className={clsx("relative h-full w-full", className)}>
        <div
          className="absolute"
          style={{
            width: `${sx * 100}%`,
            height: `${(m.source.h / m.trim.h) * 100}%`,
            left: `${(-m.trim.x / m.trim.w) * 100}%`,
            top: `${(-m.trim.y / m.trim.h) * 100}%`,
          }}
        >
          <Image
            src={fragrance.bottleImage}
            alt={fragrance.bottleAlt}
            fill
            sizes={scaleSizes(sizes, sx)}
            quality={90}
            preload={preload}
            className="object-contain"
          />
        </div>
      </div>
    );
  }
  return (
    <div className={clsx("relative aspect-square w-full", className)}>
      <Image
        src={fragrance.bottleImage}
        alt={fragrance.bottleAlt}
        fill
        sizes={sizes}
        quality={90}
        preload={preload}
        className="object-contain"
      />
    </div>
  );
}

/** "(min-width: 768px) 30vw, 60vw" × 2.1 → "(min-width: 768px) 63vw, 126vw" */
function scaleSizes(sizes: string, k: number) {
  return sizes.replace(
    /(\d+(?:\.\d+)?)(vw|px)/g,
    (_, n, u) => `${Math.round(parseFloat(n) * k)}${u}`,
  );
}

/** CSS aspect-ratio of a bottle's trimmed bounds, e.g. "940 / 1334" */
export const bottleAspect = (slug: string) => {
  const m = BOTTLE_META[slug];
  return `${m.trim.w} / ${m.trim.h}`;
};
