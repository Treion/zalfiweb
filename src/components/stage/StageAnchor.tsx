"use client";

import {
  useEffect,
  useRef,
  type HTMLAttributes,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { useStageAnchor, type AnchorKind } from "./anchors";
import { stageState } from "./stage-state";

type Props = HTMLAttributes<HTMLDivElement> & {
  kind: AnchorKind;
  index?: number;
  slug?: string;
  /** Product pages with a 3D bottle: drag (or use the arrow keys) to turn it */
  spin?: boolean;
};

/** A layout box the WebGL stage draws into. Children are the DOM fallback / static content. */
export function StageAnchor({ kind, index, slug, spin, ...rest }: Props) {
  const ref = useStageAnchor(kind, { index, slug });
  const drag = useRef<{ x: number; id: number } | null>(null);

  useEffect(() => {
    if (spin) stageState.spin = 0;
  }, [spin, slug]);

  if (!spin) return <div ref={ref} data-stage-anchor={kind} {...rest} />;

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    drag.current = { x: e.clientX, id: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current || drag.current.id !== e.pointerId) return;
    stageState.spin += (e.clientX - drag.current.x) * 0.012;
    drag.current.x = e.clientX;
  };
  const end = () => (drag.current = null);
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft") stageState.spin -= 0.35;
    else if (e.key === "ArrowRight") stageState.spin += 0.35;
    else return;
    e.preventDefault();
  };

  return (
    <div
      ref={ref}
      data-stage-anchor={kind}
      data-cursor="Turn"
      tabIndex={0}
      role="group"
      aria-roledescription="3D view"
      aria-label="Drag, or use the left and right arrow keys, to turn the bottle"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      onKeyDown={onKeyDown}
      {...rest}
      style={{ touchAction: "pan-y", ...rest.style }}
    />
  );
}
