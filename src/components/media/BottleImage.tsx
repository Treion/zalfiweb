import Image from "next/image";
import clsx from "clsx";
import type { Fragrance } from "@/lib/fragrance";

type Props = {
  fragrance: Pick<Fragrance, "bottleImage" | "bottleAlt">;
  sizes: string;
  /** Set only for the LCP bottle (hero). Everything else lazy-loads. */
  preload?: boolean;
  className?: string;
};

/**
 * A product bottle photo. The source is a 2000×2000 transparent cutout. It is always shown
 * uncropped (object-contain) at quality 90, and its space is reserved by the square aspect ratio,
 * so there is no layout shift.
 */
export function BottleImage({ fragrance, sizes, preload, className }: Props) {
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
