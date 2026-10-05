"use client";

import { useRef, type ReactNode } from "react";
import { EASE, gsap, useGSAP } from "@/components/motion/gsap";
import { useReducedMotion } from "@/components/motion/use-reduced-motion";

/**
 * A box photo that rises a little as it scrolls into view, scrubbed to the scroll (8% of its own
 * height, then still). With reduced motion it simply stands in place.
 */
export function Rise({ children, className }: { children: ReactNode; className?: string }) {
  const root = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  useGSAP(
    () => {
      if (reduced || !root.current) return;
      gsap.fromTo(
        root.current,
        { yPercent: 8 },
        {
          yPercent: 0,
          ease: EASE.soft,
          scrollTrigger: {
            trigger: root.current,
            start: "top bottom",
            end: "center 60%",
            scrub: true,
          },
        },
      );
    },
    { scope: root, dependencies: [reduced] },
  );
  return (
    <div ref={root} className={className}>
      {children}
    </div>
  );
}
