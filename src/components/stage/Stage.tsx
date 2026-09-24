"use client";

import { useEffect, useMemo, useRef } from "react";
import type * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { gsap } from "@/components/motion/gsap";
import { anchors } from "./anchors";
import { FOV, StageDirector, type Tier } from "./director";
import { anyModels } from "./models";
import type { StageFragrance } from "./worlds";

/**
 * The persistent WebGL stage. One fixed canvas behind the page draws:
 *   the world background → giant fragrance names → back glow → contact shadow →
 *   floor reflection → the relit bottle photo (or its 3D model).
 * It renders only while a stage anchor is on screen, driven by gsap.ticker so it is frame-locked
 * with Lenis and ScrollTrigger. All per-frame work lives in StageDirector (outside React).
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
  const { scene, gl, advance } = useThree();
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

  // Frame-lock rendering to gsap.ticker (after Lenis has updated scroll), and only when needed
  useEffect(() => {
    const tick = (time: number) => {
      const vh = window.innerHeight;
      let visible = false;
      for (const a of anchors.values()) {
        const r = a.el.getBoundingClientRect();
        if (r.bottom > -vh * 0.25 && r.top < vh * 1.25) {
          visible = true;
          break;
        }
      }
      if (layer.current) layer.current.style.visibility = visible ? "visible" : "hidden";
      if (visible && !document.hidden) advance(time * 1000);
    };
    gsap.ticker.add(tick);
    return () => gsap.ticker.remove(tick);
  }, [advance, layer]);

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
