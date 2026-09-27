"use client";

import { motion, useMotionValue, useTransform, type MotionValue } from "motion/react";
import type { Tilt } from "./use-parallax";

/**
 * Three depth planes behind everything: a mood-coloured glow (far), a hi-vis
 * counter-glow (mid) and a receding site-grid floor (near). Each plane moves a
 * different distance for the same tilt/scroll - that difference is the parallax.
 */
export function Backdrop({ tilt, scrollY }: { tilt: Tilt; scrollY?: MotionValue<number> }) {
  const zero = useMotionValue(0);
  const scroll = scrollY ?? zero;

  const farX = useTransform(tilt.x, [-1, 1], [-26, 26]);
  const farY = useTransform([tilt.y, scroll], ([t, s]: number[]) => t * 18 - s * 0.12);

  const midX = useTransform(tilt.x, [-1, 1], [40, -40]);
  const midY = useTransform([tilt.y, scroll], ([t, s]: number[]) => t * -26 - s * 0.28);

  const gridX = useTransform(tilt.x, [-1, 1], [-60, 60]);
  const gridY = useTransform(scroll, (s) => -s * 0.5);
  const gridRotate = useTransform(tilt.y, [-1, 1], [62, 56]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_-10%,#101712_0%,var(--bg)_60%)]" />

      <motion.div
        style={{ x: farX, y: farY }}
        className="absolute -top-[28vh] left-1/2 h-[95vh] w-[150vw] -translate-x-1/2 will-change-transform"
      >
        <div className="mood-transition h-full w-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--mood)_42%,transparent),color-mix(in_oklab,var(--mood)_10%,transparent)_55%,transparent)] opacity-80" />
      </motion.div>

      <motion.div
        style={{ x: midX, y: midY }}
        className="absolute top-[38vh] -left-[30vw] h-[60vh] w-[90vw] will-change-transform"
      >
        <div className="h-full w-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--hivis)_16%,transparent),transparent)]" />
      </motion.div>

      <div className="absolute inset-x-0 bottom-0 h-[70vh] [perspective:700px]">
        <motion.div
          style={{ x: gridX, y: gridY, rotateX: gridRotate }}
          className="absolute -inset-x-[40%] -bottom-[30%] h-[160%] origin-bottom [mask-image:linear-gradient(to_top,black_10%,transparent_75%)] will-change-transform"
        >
          <div className="grid-floor h-full w-full" />
        </motion.div>
      </div>

      <style>{`
        .grid-floor {
          background-image:
            linear-gradient(to right, rgb(255 255 255 / 0.07) 1px, transparent 1px),
            linear-gradient(to bottom, rgb(255 255 255 / 0.07) 1px, transparent 1px);
          background-size: 56px 56px;
          animation: floor 9s linear infinite;
        }
        @keyframes floor { to { background-position: 0 56px; } }
        @media (prefers-reduced-motion: reduce) { .grid-floor { animation: none; } }
      `}</style>
    </div>
  );
}
