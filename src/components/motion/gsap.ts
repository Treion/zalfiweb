"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

// Register once, client-side. Import gsap from here, never directly, so plugins are always registered.
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
  gsap.defaults({ ease: "power3.out", duration: 1.2 });
}

/**
 * Cinematic easing presets. Nothing bouncy, nothing elastic.
 * Time-based UI (intro, menus, drawer) uses `cinema`. Scroll-scrubbed motion uses `soft` and
 * `glide`: they spread movement evenly across the scroll distance, so nothing snaps into place.
 */
export const EASE = {
  cinema: "expo.out",
  silk: "power2.inOut",
  enter: "power3.out",
  exit: "power2.in",
  /** Scrubbed reveals: arrives with the scroll, settles softly */
  soft: "power2.out",
  /** Scrubbed recedes and exits: starts and ends at rest */
  glide: "sine.inOut",
} as const;

export { gsap, ScrollTrigger, useGSAP };
