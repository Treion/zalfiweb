"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useReducedMotion } from "@/components/motion/use-reduced-motion";
import type { StageFragrance } from "./worlds";

const Stage = dynamic(() => import("./Stage"), { ssr: false });

function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/**
 * Loads the WebGL stage after first paint, when the browser is idle, so three.js never competes
 * with LCP. With reduced motion there is no canvas at all. Without WebGL, the page switches to
 * its static editorial layout (html.static-experience).
 */
export function StageLoader({ fragrances }: { fragrances: StageFragrance[] }) {
  const reduced = useReducedMotion();
  const [load, setLoad] = useState(false);

  useEffect(() => {
    if (reduced) return;
    if (!webglAvailable()) {
      document.documentElement.classList.add("static-experience");
      return;
    }
    const start = () => setLoad(true);
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(start, { timeout: 1200 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(start, 300);
    return () => clearTimeout(id);
  }, [reduced]);

  return load ? <Stage fragrances={fragrances} /> : null;
}
