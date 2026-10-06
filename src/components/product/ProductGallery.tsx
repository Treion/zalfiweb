"use client";

import Image from "next/image";
import clsx from "clsx";
import { useState, type ReactNode } from "react";
import { Lightbox, type LightboxPhoto } from "./Lightbox";

/**
 * The bottle column of a product page, with the perfume's photos from Products → Photos (models,
 * campaign, lifestyle). A row of thumbnails: the lit bottle first, then each photo. Choosing a photo
 * lays it over the bottle (an opaque layer that fades in; the stage and its anchor stay exactly
 * where they are), and tapping it opens the full-screen viewer. The bottle thumbnail brings the lit
 * bottle back. With no photos, it's just the bottle.
 */
export function ProductGallery({
  name,
  bottleImage,
  photos,
  children,
}: {
  name: string;
  bottleImage: string;
  photos: LightboxPhoto[];
  /** The bottle: the stage anchor with its DOM fallback */
  children: ReactNode;
}) {
  const [shown, setShown] = useState(0); // 0: the bottle; n: photo n
  const [viewer, setViewer] = useState<number | null>(null);
  const has = photos.length > 0;
  const photo = shown > 0 ? photos[shown - 1] : undefined;

  const thumbs = (
    <ul className="flex flex-wrap justify-center gap-2" aria-label={`${name}, in photographs`}>
      <li>
        <Thumb on={shown === 0} label={`The ${name} bottle`} onClick={() => setShown(0)}>
          <Image
            src={bottleImage}
            alt=""
            fill
            quality={90}
            sizes="56px"
            className="object-contain"
          />
        </Thumb>
      </li>
      {photos.map((p, i) => (
        <li key={p.url}>
          <Thumb
            on={shown === i + 1}
            label={`Photo ${i + 1}: ${p.alt}`}
            onClick={() => setShown(i + 1)}
          >
            <Image src={p.url} alt="" fill sizes="56px" className="object-cover" />
          </Thumb>
        </li>
      ))}
    </ul>
  );

  return (
    <>
      <div className="relative flex h-[70svh] items-end justify-center pt-24 md:sticky md:top-0 md:h-svh md:items-center md:pt-0">
        {children}
        {photo && (
          <button
            key={photo.url}
            type="button"
            onClick={() => setViewer(shown - 1)}
            aria-label={`Enlarge: ${photo.alt}`}
            data-cursor="Enlarge"
            className="bg-world-bg info-reveal absolute inset-x-0 top-20 bottom-0 cursor-zoom-in md:top-24 md:bottom-28"
          >
            <Image
              src={photo.url}
              alt={photo.alt}
              fill
              sizes="(min-width: 768px) 55vw, 100vw"
              className="object-contain"
            />
          </button>
        )}
        {has && (
          <div className="absolute inset-x-0 bottom-8 hidden justify-center md:flex">{thumbs}</div>
        )}
      </div>
      {has && <div className="mt-4 md:hidden">{thumbs}</div>}
      {has && (
        <Lightbox
          photos={photos}
          index={viewer}
          onIndex={setViewer}
          onClose={() => setViewer(null)}
        />
      )}
    </>
  );
}

function Thumb({
  on,
  label,
  onClick,
  children,
}: {
  on: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={on}
      className={clsx(
        "relative block size-12 overflow-hidden border transition-colors md:size-14",
        on ? "border-current" : "border-current/20 hover:border-current/60",
      )}
    >
      {children}
    </button>
  );
}
