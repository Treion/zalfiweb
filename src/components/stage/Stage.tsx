"use client";

import { useEffect, useMemo, useRef } from "react";
import type * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { gsap } from "@/components/motion/gsap";
import { anchors } from "./anchors";
import { FOV, StageDirector, type Tier } from "./director";
import { anyModels } from "./models";
import { stageState } from "./stage-state";
import type { StageFragrance } from "./worlds";

/** How long the stage keeps drawing after the last change (every follow and glide is done by then) */
const SETTLE_MS = 2500;

/**
 * The persistent WebGL stage. One fixed canvas behind the page draws:
 *   the world background → giant fragrance names → back glow → contact shadow →
 *   floor reflection → the relit bottle photo (or its 3D model).
 * It renders only while a stage anchor is on screen and something is moving, driven by gsap.ticker
 * so it is frame-locked with Lenis and ScrollTrigger. All per-frame work lives in StageDirector
 * (outside React).
 */
export default function Stage({ fragrances }: { fragrances: StageFragrance[] }) {
  const tier: Tier = useMemo(
    () =>
      window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 768 ? "low" : "high",
    [],
  );
  const layer = useRef<HTMLDivElement>(null);
  return (
    <div ref={layer} aria-hidden className="stage-layer pointer-events-none fixed inset-0 -z-10">
      <Canvas
        frameloop="never"
        flat
        dpr={tier === "high" ? [1, 2] : [1, 1.5]}
        gl={{
          // Photo planes have no visible geometry edges, so MSAA only pays off for 3D models
          antialias: tier === "high" && anyModels(),
          alpha: false,
          depth: true,
          stencil: false,
          powerPreference: "high-performance",
        }}
        camera={{ fov: FOV, near: 1, far: 30000, position: [0, 0, 1500] }}
      >
        <Scene fragrances={fragrances} layer={layer} />
      </Canvas>
    </div>
  );
}

function Scene({
  fragrances,
  layer,
}: {
  fragrances: StageFragrance[];
  layer: React.RefObject<HTMLDivElement | null>;
}) {
  const { scene, gl, advance, setDpr } = useThree();
  const director = useRef<StageDirector | null>(null);

  useEffect(() => {
    const d = new StageDirector(fragrances);
    director.current = d;
    d.attach(scene, gl);
    void d.load(gl);
    return () => {
      d.detach(scene);
      director.current = null;
    };
  }, [fragrances, scene, gl]);

  // Frame-lock rendering to gsap.ticker (after Lenis has updated scroll), and only when needed:
  //  - only while a stage anchor is on (or near) the screen
  //  - only while something moves: the scroll, an anchor, the stage state, or a texture arriving.
  //    Once everything has been still for SETTLE_MS (long enough for every damped follow, fade
  //    and page-to-page glide to finish), drawing stops until the next change. Still frames are
  //    identical anyway, so this costs nothing to see and saves the GPU all the idle time.
  //  - on a machine that can't keep up, the resolution steps down (never back up)
  useEffect(() => {
    let last = NaN;
    let changedAt = -Infinity;
    let shown: boolean | null = null;
    let slow = 0;
    let lastDraw = 0;
    let dpr = gl.getPixelRatio();
    const tick = (time: number) => {
      const vh = window.innerHeight;
      const vw = window.innerWidth;
      let visible = false;
      // A cheap fingerprint of everything the frame depends on
      let sig = vw * 7 + vh * 13 + stageState.s * 17 + stageState.k * 19;
      sig += stageState.collectionHover * 23 + stageState.spin * 29;
      let n = 0;
      for (const a of anchors.values()) {
        const r = a.el.getBoundingClientRect();
        n++;
        sig += (r.top * 31 + r.left * 37 + r.width * 41 + r.height * 43) * ((n % 7) + 1);
        if (!visible && r.bottom > -vh * 0.25 && r.top < vh * 1.25) visible = true;
      }
      sig += n * 47;
      if (visible !== shown && layer.current) {
        shown = visible;
        layer.current.style.visibility = visible ? "visible" : "hidden";
      }
      const now = performance.now();
      if (sig !== last) {
        last = sig;
        changedAt = now;
      }
      const awake = now - changedAt < SETTLE_MS || now < stageState.awakeUntil;
      if (!visible || document.hidden || !awake) {
        lastDraw = 0;
        return;
      }
      // Frame budget: sustained slow frames lower the resolution one step
      if (lastDraw) {
        const ms = now - lastDraw;
        slow = ms > 26 && ms < 250 ? slow + 1 : Math.max(0, slow - 2);
        if (slow > 45 && dpr > 1) {
          dpr = Math.max(1, Math.round((dpr - 0.5) * 4) / 4);
          setDpr(dpr);
          slow = 0;
        }
      }
      lastDraw = now;
      advance(time * 1000);
    };
    gsap.ticker.add(tick);
    return () => gsap.ticker.remove(tick);
  }, [advance, layer, gl, setDpr]);

  useFrame((state, delta) => {
    director.current?.update(
      state.camera as THREE.PerspectiveCamera,
      state.size.width,
      state.size.height,
      state.clock.elapsedTime,
      delta,
    );
  });

  return null;
}
