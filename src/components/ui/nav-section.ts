import { useSyncExternalStore } from "react";

/**
 * Which part of the home page the visitor is in, for the nav's outline: "worlds" while the
 * line-up is open, null elsewhere. The experience timeline (motion layout) or an observer on the
 * line-up section (static layout) sets it; the nav reads it. Changes only on a section change, so
 * scroll frames don't re-render React.
 */
export type NavSection = "worlds" | null;

let current: NavSection = null;
const listeners = new Set<() => void>();

export function setNavSection(next: NavSection) {
  if (next === current) return;
  current = next;
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

export const useNavSection = () =>
  useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
