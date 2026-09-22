"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

const subscribe = (cb: () => void) => {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", cb);
  return () => mql.removeEventListener("change", cb);
};

/**
 * SSR-safe reduced-motion preference. The server renders as if motion were reduced (the static,
 * fully readable layout), and the client upgrades after hydration. Motion is never shown first
 * and then taken away.
 */
export function useReducedMotion() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => true,
  );
}

const FINE = "(hover: hover) and (pointer: fine)";
const subscribeFine = (cb: () => void) => {
  const mql = window.matchMedia(FINE);
  mql.addEventListener("change", cb);
  return () => mql.removeEventListener("change", cb);
};

/** True on devices with a precise hovering pointer (mouse or trackpad). */
export function useFinePointer() {
  return useSyncExternalStore(
    subscribeFine,
    () => window.matchMedia(FINE).matches,
    () => false,
  );
}
