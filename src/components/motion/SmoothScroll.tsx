"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { MotionConfig } from "motion/react";
import Lenis from "lenis";
import { gsap, ScrollTrigger } from "./gsap";
import { useReducedMotion } from "./use-reduced-motion";

const LenisContext = createContext<Lenis | null>(null);

/** The active Lenis instance, or null when smooth scrolling is off (reduced motion, SSR). */
export const useLenis = () => useContext(LenisContext);

/**
 * Smooth scrolling synced with GSAP ScrollTrigger on a single RAF loop:
 * gsap.ticker drives Lenis, and every Lenis scroll event updates ScrollTrigger.
 * With prefers-reduced-motion, Lenis is not created and native scrolling is used, and Motion
 * skips its transform animations (MotionConfig reducedMotion="user").
 */
export function SmoothScroll({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  const [lenis, setLenis] = useState<Lenis | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (reduced) return;

    const instance = new Lenis({
      // One continuous damped glide (rather than a new eased tween per wheel tick), so wheel and
      // trackpad input both feel like butter.
      lerp: 0.08,
      smoothWheel: true,
      // Touch stays native: momentum scrolling on phones already feels right and costs nothing.
      syncTouch: false,
    });

    instance.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => instance.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    // Deliberate: the instance only becomes available once the effect has created it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLenis(instance);
    ScrollTrigger.refresh();

    return () => {
      gsap.ticker.remove(tick);
      instance.destroy();
      setLenis(null);
    };
  }, [reduced]);

  // A new page: adopt its scroll position (set by the router) instead of finishing a glide that
  // belonged to the previous page. stop() + start() is Lenis's public way to drop a glide.
  useEffect(() => {
    if (!lenis) return;
    if (!lenis.isStopped) {
      lenis.stop();
      lenis.start();
    }
    lenis.resize();
  }, [lenis, pathname]);

  return (
    <MotionConfig reducedMotion="user">
      <LenisContext.Provider value={lenis}>{children}</LenisContext.Provider>
    </MotionConfig>
  );
}
