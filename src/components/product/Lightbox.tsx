"use client";

import Image from "next/image";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { useLenis } from "@/components/motion/SmoothScroll";

export type LightboxPhoto = { url: string; alt: string };

const EASE = [0.22, 1, 0.36, 1] as const;
const noop = () => () => {};

/**
 * A photo, full screen, on the house dark: arrows, the counter, swipe and the arrow keys move
 * through the photos; Esc or Close leaves. It fades (opacity only), holds the page still, and keeps
 * focus inside until it's closed. Rendered at the end of the body, above the page and the nav.
 */
export function Lightbox({
  photos,
  index,
  onIndex,
  onClose,
}: {
  photos: LightboxPhoto[];
  index: number | null;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  // Only in the browser (the viewer is portalled to the body)
  const mounted = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const panel = useRef<HTMLDivElement>(null);
  const start = useRef<number | null>(null);
  const lenis = useLenis();
  const open = index !== null;
  const many = photos.length > 1;
  const go = (d: number) => index !== null && onIndex((index + d + photos.length) % photos.length);

  // While open: the page holds still, focus starts on Close and goes back where it was after
  useEffect(() => {
    if (!open) return;
    const back = document.activeElement as HTMLElement | null;
    lenis?.stop();
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = "hidden";
    const t = setTimeout(
      () => panel.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus(),
      30,
    );
    return () => {
      clearTimeout(t);
      root.style.overflow = prev;
      lenis?.start();
      back?.focus({ preventScroll: true });
    };
  }, [open, lenis]);

  // Keys: Esc closes, the arrows move, Tab stays inside
  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (many && (e.key === "ArrowRight" || e.key === "ArrowLeft"))
        onIndex((index + (e.key === "ArrowRight" ? 1 : -1) + photos.length) % photos.length);
      if (e.key !== "Tab" || !panel.current) return;
      const f = panel.current.querySelectorAll<HTMLElement>("button:not([disabled])");
      if (!f.length) return;
      const first = f[0]!;
      const last = f[f.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [index, many, photos.length, onIndex, onClose]);

  if (!mounted) return null;
  const photo = index !== null ? photos[index] : undefined;
  return createPortal(
    <AnimatePresence>
      {photo && (
        <motion.div
          ref={panel}
          role="dialog"
          aria-modal="true"
          aria-label="Photos"
          data-lenis-prevent
          className="bg-noir text-bone fixed inset-0 z-[75] flex flex-col"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: EASE }}
          onPointerDown={(e) => {
            if (e.pointerType !== "mouse") start.current = e.clientX;
          }}
          onPointerUp={(e) => {
            if (start.current === null || !many) return;
            const dx = e.clientX - start.current;
            start.current = null;
            if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
          }}
        >
          <div className="px-gutter flex items-center justify-between py-5">
            <span className="eyebrow text-bone-dim tabular-nums" aria-live="polite">
              {many ? `${index! + 1} / ${photos.length}` : ""}
            </span>
            <button
              type="button"
              data-autofocus
              onClick={onClose}
              className="eyebrow border-bone/30 hover:border-bone border-b pb-0.5"
            >
              Close
            </button>
          </div>
          <div className="relative min-h-0 flex-1">
            <Image
              key={photo.url}
              src={photo.url}
              alt={photo.alt}
              fill
              sizes="100vw"
              className="info-reveal object-contain"
            />
          </div>
          <div className="px-gutter flex items-center justify-between gap-6 py-5">
            <p className="text-bone-dim max-w-xl text-sm">{photo.alt}</p>
            {many && (
              <div className="flex shrink-0 items-center gap-6">
                <button
                  type="button"
                  onClick={() => go(-1)}
                  aria-label="Previous photo"
                  className="-m-2 p-2"
                >
                  <svg
                    viewBox="0 0 24 12"
                    aria-hidden
                    className="w-8 -scale-x-100"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1}
                  >
                    <path d="M0 6h22M17 1l5 5-5 5" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => go(1)}
                  aria-label="Next photo"
                  className="-m-2 p-2"
                >
                  <svg
                    viewBox="0 0 24 12"
                    aria-hidden
                    className="w-8"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1}
                  >
                    <path d="M0 6h22M17 1l5 5-5 5" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
