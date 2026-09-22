"use client";

import { useCallback } from "react";

/**
 * DOM anchors tell the WebGL stage WHERE to draw. Layout stays in CSS (responsive, accessible),
 * and the stage reads each anchor's rect every frame and places the relit bottle exactly on it.
 */
export type AnchorKind = "experience" | "collection" | "collection-section" | "product";

export type Anchor = { kind: AnchorKind; el: HTMLElement; index: number; slug?: string };

export const anchors = new Map<string, Anchor>();

export function useStageAnchor(kind: AnchorKind, opts: { index?: number; slug?: string } = {}) {
  const key = `${kind}:${opts.index ?? 0}:${opts.slug ?? ""}`;
  return useCallback(
    (el: HTMLElement | null) => {
      if (el) anchors.set(key, { kind, el, index: opts.index ?? 0, slug: opts.slug });
      else anchors.delete(key);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );
}
