"use client";

import type { HTMLAttributes } from "react";
import { useStageAnchor, type AnchorKind } from "./anchors";

type Props = HTMLAttributes<HTMLDivElement> & { kind: AnchorKind; index?: number; slug?: string };

/** A layout box the WebGL stage draws into. Children are the DOM fallback / static content. */
export function StageAnchor({ kind, index, slug, ...rest }: Props) {
  const ref = useStageAnchor(kind, { index, slug });
  return <div ref={ref} data-stage-anchor={kind} {...rest} />;
}
