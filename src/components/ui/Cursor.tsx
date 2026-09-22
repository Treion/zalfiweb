"use client";

import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring, AnimatePresence } from "motion/react";
import { useFinePointer, useReducedMotion } from "@/components/motion/use-reduced-motion";

type CursorState = { kind: "idle" | "link" | "label"; label?: string };

const INTERACTIVE = "a, button, [role='button'], input, select, textarea, label, [data-cursor]";

/**
 * A custom cursor: a precise dot plus a trailing ring. The ring grows over interactive elements, and
 * elements with data-cursor="Discover" show that word inside it. It uses mix-blend-difference so it
 * stays visible on every fragrance world. It only renders on fine pointers with motion allowed.
 */
export function Cursor() {
  const fine = useFinePointer();
  const reduced = useReducedMotion();
  const enabled = fine && !reduced;

  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const rx = useSpring(x, { stiffness: 380, damping: 38, mass: 0.6 });
  const ry = useSpring(y, { stiffness: 380, damping: 38, mass: 0.6 });

  const [state, setState] = useState<CursorState>({ kind: "idle" });
  const [visible, setVisible] = useState(false);
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const root = document.documentElement;
    root.classList.add("has-custom-cursor");

    const move = (e: PointerEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
      setVisible(true);
    };
    const over = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest<HTMLElement>(INTERACTIVE);
      if (!el) return setState({ kind: "idle" });
      const label = el.dataset.cursor;
      setState(label && label !== "true" ? { kind: "label", label } : { kind: "link" });
    };
    const leave = () => setVisible(false);
    const down = () => setPressed(true);
    const up = () => setPressed(false);

    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerover", over, { passive: true });
    document.addEventListener("pointerleave", leave);
    window.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    return () => {
      root.classList.remove("has-custom-cursor");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerover", over);
      document.removeEventListener("pointerleave", leave);
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
    };
  }, [enabled, x, y]);

  if (!enabled) return null;

  const ringSize = state.kind === "label" ? 96 : state.kind === "link" ? 56 : 34;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[95] mix-blend-difference">
      <motion.div
        className="absolute top-0 left-0 flex items-center justify-center rounded-full border border-white/80"
        style={{ x: rx, y: ry, translateX: "-50%", translateY: "-50%" }}
        animate={{
          width: ringSize,
          height: ringSize,
          opacity: visible ? 1 : 0,
          scale: pressed ? 0.85 : 1,
          backgroundColor: state.kind === "label" ? "rgba(255,255,255,1)" : "rgba(255,255,255,0)",
        }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <AnimatePresence>
          {state.kind === "label" && (
            <motion.span
              key={state.label}
              className="eyebrow text-black"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              {state.label}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>
      <motion.div
        className="absolute top-0 left-0 size-1.5 rounded-full bg-white"
        style={{ x, y, translateX: "-50%", translateY: "-50%" }}
        animate={{ opacity: visible && state.kind !== "label" ? 1 : 0 }}
        transition={{ duration: 0.2 }}
      />
    </div>
  );
}
