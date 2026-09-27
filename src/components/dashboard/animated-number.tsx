"use client";

import { useEffect, useRef } from "react";
import { animate, useMotionValue, useMotionValueEvent, useReducedMotion } from "motion/react";
import { formatMoney } from "@/lib/money";

/** Counts up on first paint, then glides between values. Writes straight to the DOM - no re-renders per frame. */
export function AnimatedMoney({
  cents,
  delay = 0,
  className,
  style,
}: {
  cents: number;
  delay?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const target = useRef(cents);
  const first = useRef(true);
  const value = useMotionValue(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    target.current = cents;
    const controls = animate(value, cents, {
      duration: reduce ? 0 : first.current ? 1.6 : 0.9,
      delay: first.current && !reduce ? delay : 0,
      ease: [0.16, 1, 0.3, 1],
    });
    first.current = false;
    return () => controls.stop();
  }, [cents, delay, reduce, value]);

  useMotionValueEvent(value, "change", (v) => {
    if (!ref.current) return;
    const settled = Math.abs(v - target.current) < 1;
    ref.current.textContent = formatMoney(settled ? target.current : Math.round(v / 100) * 100);
  });

  return (
    <span ref={ref} className={className} style={style}>
      {formatMoney(0)}
    </span>
  );
}
