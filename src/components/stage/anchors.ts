"use client";

import { useCallback } from "react";

/**
 * DOM anchors tell the WebGL stage WHERE to draw. Layout stays in CSS (responsive, accessible),
 * and the stage reads each anchor's rect every frame and places the bottle (or note) exactly on
 * it. When the stage draws an anchor it sets data-ready="true" on it, which fades out the DOM
 * fallback inside ([data-model-fallback]).
 */
export type AnchorKind = "experience" | "collection" | "collection-section" | "product" | "note";

export type Anchor = {
  kind: AnchorKind;
  el: HTMLElement;
  index: number;
  slug?: string;
  /** performance.now() when the anchor mounted: a fresh page's anchors are only moments old */
  mountedAt: number;
};

export const anchors = new Map<string, Anchor>();

export function useStageAnchor(kind: AnchorKind, opts: { index?: number; slug?: string } = {}) {
  const key = `${kind}:${opts.index ?? 0}:${opts.slug ?? ""}`;
  return useCallback(
    (el: HTMLElement | null) => {
      if (el)
        anchors.set(key, {
          kind,
          el,
          index: opts.index ?? 0,
          slug: opts.slug,
          mountedAt: performance.now(),
        });
      else anchors.delete(key);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );
}
