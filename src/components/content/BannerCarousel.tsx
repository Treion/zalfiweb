"use client";

import Link from "next/link";
import { getImageProps } from "next/image";
import clsx from "clsx";
import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { ShopBanner } from "@/lib/content";

/**
 * Banners from Admin → Content, shown whole at the designer's own proportions: the phone picture
 * below md (when there is one), the wide one above. The box takes the first banner's shape, so
 * the page never jumps; other shapes sit centred in it.
 *
 * With more than one: arrows, dots, swipe and the arrow keys move between them, and they cross-fade.
 * They never move on their own (the owner is sensitive to motion; so are many shoppers).
 */
export function BannerCarousel({
  banners,
  label = "From the house",
  eager = false,
  className,
}: {
  banners: ShopBanner[];
  label?: string;
  /** The first thing on the page: load the first picture at once (it's the largest paint) */
  eager?: boolean;
  className?: string;
}) {
  const [index, setIndex] = useState(0);
  const start = useRef<number | null>(null);
  if (!banners.length) return null;
  const many = banners.length > 1;
  const go = (to: number) => setIndex((to + banners.length) % banners.length);
  const first = banners[0]!;
  const ratio = (b: ShopBanner, phone: boolean) => {
    const img = phone && b.mobile ? b.mobile : b.image;
    return `${img.width} / ${img.height}`;
  };

  return (
    <section
      aria-roledescription={many ? "carousel" : undefined}
      aria-label={label}
      className={clsx("relative", className)}
      onKeyDown={(e) => {
        if (!many) return;
        if (e.key === "ArrowRight") go(index + 1);
        if (e.key === "ArrowLeft") go(index - 1);
      }}
      onPointerDown={(e) => {
        if (e.pointerType !== "mouse") start.current = e.clientX;
      }}
      onPointerUp={(e) => {
        if (start.current === null || !many) return;
        const dx = e.clientX - start.current;
        start.current = null;
        if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
      }}
    >
      <div
        className="bg-noir relative [aspect-ratio:var(--r-m)] w-full overflow-hidden md:[aspect-ratio:var(--r)]"
        style={{ "--r": ratio(first, false), "--r-m": ratio(first, true) } as CSSProperties}
      >
        {banners.map((b, i) => (
          <Slide
            key={b.id}
            banner={b}
            shown={i === index}
            eager={eager && i === 0}
            position={many ? `${i + 1} of ${banners.length}` : undefined}
          />
        ))}
      </div>

      {many && (
        <div className="mt-4 flex items-center justify-between gap-6">
          <div className="flex items-center gap-2" role="group" aria-label="Choose a banner">
            {banners.map((b, i) => (
              <button
                key={b.id}
                type="button"
                onClick={() => go(i)}
                aria-label={`Banner ${i + 1} of ${banners.length}`}
                aria-current={i === index ? "true" : undefined}
                className="group -my-3 py-3"
              >
                <span
                  className={clsx(
                    "block h-px w-8 bg-current transition-opacity duration-500",
                    i === index ? "opacity-100" : "opacity-25 group-hover:opacity-60",
                  )}
                />
              </button>
            ))}
          </div>
          <div className="flex items-center gap-5">
            <Arrow label="Previous banner" onClick={() => go(index - 1)} flip />
            <span className="eyebrow tabular-nums opacity-70" aria-hidden>
              {`${index + 1} / ${banners.length}`}
            </span>
            <Arrow label="Next banner" onClick={() => go(index + 1)} />
          </div>
        </div>
      )}
    </section>
  );
}

function Slide({
  banner: b,
  shown,
  eager,
  position,
}: {
  banner: ShopBanner;
  shown: boolean;
  eager: boolean;
  position?: string;
}) {
  const common = {
    alt: b.alt,
    quality: 90,
    sizes: "100vw",
    ...(eager ? { loading: "eager" as const, fetchPriority: "high" as const } : {}),
  };
  const wide = getImageProps({ ...common, src: b.image.src, ...size(b.image) }).props;
  const phone = b.mobile
    ? getImageProps({ ...common, src: b.mobile.src, ...size(b.mobile) }).props
    : null;
  const words = !b.textInImage && (b.headline || b.line || b.buttonLabel);

  const picture = (
    <picture>
      {phone && <source media="(max-width: 767.98px)" srcSet={phone.srcSet} sizes="100vw" />}
      {/* eslint-disable-next-line jsx-a11y/alt-text -- alt comes with the image props */}
      <img {...wide} className="absolute inset-0 h-full w-full object-contain" />
    </picture>
  );

  const content: ReactNode = (
    <>
      {picture}
      {words && (
        <span
          className={clsx(
            "px-gutter absolute inset-x-0 bottom-0 flex flex-col items-start gap-3 pb-8 md:pb-12",
            b.tone === "light" ? "text-bone" : "text-noir",
          )}
        >
          {b.headline && (
            <span className="font-display text-[clamp(2.25rem,5.5vw,5.5rem)] leading-[0.95]">
              {b.headline}
            </span>
          )}
          {b.line && <span className="max-w-md text-base leading-snug md:text-lg">{b.line}</span>}
          {b.buttonLabel && b.link && (
            <span className="eyebrow mt-2 border border-current px-6 py-3">{b.buttonLabel}</span>
          )}
        </span>
      )}
    </>
  );

  const external = !!b.link && /^https:\/\//.test(b.link);
  const linkLabel = b.headline || b.alt;
  return (
    <div
      role={position ? "group" : undefined}
      aria-roledescription={position ? "slide" : undefined}
      aria-label={position}
      aria-hidden={!shown}
      inert={!shown}
      className={clsx(
        "absolute inset-0 transition-opacity duration-700 ease-(--ease-cinema)",
        shown ? "opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      {b.link ? (
        external ? (
          <a
            href={b.link}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={linkLabel}
            className="absolute inset-0 block"
          >
            {content}
          </a>
        ) : (
          <Link
            href={b.link}
            aria-label={linkLabel}
            data-cursor="Discover"
            className="absolute inset-0 block"
          >
            {content}
          </Link>
        )
      ) : (
        content
      )}
    </div>
  );
}

const size = (i: { width: number; height: number }) => ({ width: i.width, height: i.height });

function Arrow({ label, onClick, flip }: { label: string; onClick: () => void; flip?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="-m-2 p-2">
      <svg
        viewBox="0 0 24 12"
        aria-hidden
        className={clsx("w-7", flip && "-scale-x-100")}
        fill="none"
        stroke="currentColor"
        strokeWidth={1}
      >
        <path d="M0 6h22M17 1l5 5-5 5" />
      </svg>
    </button>
  );
}
