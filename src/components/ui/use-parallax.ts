"use client";

import { useEffect } from "react";
import { useMotionValue, useReducedMotion, useSpring, type MotionValue } from "motion/react";

export type Tilt = { x: MotionValue<number>; y: MotionValue<number> };

/**
 * A -1..1 "where is the viewer looking" signal that drives every parallax layer.
 * Mouse on desktop, device tilt on Android, and a slow ambient drift on phones
 * that won't share orientation (iOS asks permission - not worth a popup).
 */
export function useTilt(): Tilt {
  const reduce = useReducedMotion();
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const x = useSpring(rawX, { stiffness: 60, damping: 18, mass: 0.6 });
  const y = useSpring(rawY, { stiffness: 60, damping: 18, mass: 0.6 });

  useEffect(() => {
    if (reduce) return;

    let lastInput = 0;
    let frame = 0;
    const start = performance.now();

    const onPointer = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      lastInput = performance.now();
      rawX.set((e.clientX / window.innerWidth) * 2 - 1);
      rawY.set((e.clientY / window.innerHeight) * 2 - 1);
    };

    const onOrientation = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      lastInput = performance.now();
      rawX.set(clamp(e.gamma / 30));
      rawY.set(clamp((e.beta - 50) / 30));
    };

    const drift = (now: number) => {
      if (now - lastInput > 2500) {
        const t = (now - start) / 1000;
        rawX.set(Math.sin(t / 3.1) * 0.45);
        rawY.set(Math.cos(t / 4.3) * 0.3);
      }
      frame = requestAnimationFrame(drift);
    };

    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("deviceorientation", onOrientation, { passive: true });
    frame = requestAnimationFrame(drift);

    return () => {
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("deviceorientation", onOrientation);
      cancelAnimationFrame(frame);
    };
  }, [reduce, rawX, rawY]);

  return { x, y };
}

function clamp(v: number) {
  return Math.max(-1, Math.min(1, v));
}
