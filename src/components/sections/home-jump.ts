"use client";

import { usePathname } from "next/navigation";
import type { MouseEvent } from "react";

/**
 * Links back into the home experience (the logo, "Fragrances", "The collection") jump instead of
 * scrolling: on the home page a smooth scroll would rush back through every world in between.
 * The experience registers how it jumps (behind a veil, see Experience.tsx); links ask for one.
 * Elsewhere, and with reduced motion, links just navigate as usual.
 */
export type HomeTarget = "top" | "collection";

let jump: ((to: HomeTarget) => boolean) | null = null;

export function registerHomeJump(fn: (to: HomeTarget) => boolean) {
  jump = fn;
  return () => {
    if (jump === fn) jump = null;
  };
}

/** An onClick for a link to the home page: jumps in place when already there */
export function useHomeJump(to: HomeTarget) {
  const pathname = usePathname();
  return (e: MouseEvent<HTMLAnchorElement>) => {
    if (pathname !== "/" || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0)
      return;
    if (jump?.(to)) e.preventDefault();
  };
}
