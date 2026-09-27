"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";

const colors = ["var(--up)", "var(--hivis)", "#ffffff", "var(--up)"];

/** Fires once per mount - remount (via key) to fire again. The moment you're back in the black. */
export function Celebration() {
  const reduce = useReducedMotion();
  const [pieces] = useState(() =>
    Array.from({ length: 34 }, (_, i) => {
      const angle = (i / 34) * Math.PI * 2 + Math.random() * 0.4;
      const distance = 110 + Math.random() * 150;
      return {
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance * 0.8 + 90,
        rotate: Math.random() * 540 - 270,
        size: 5 + Math.random() * 6,
        round: Math.random() > 0.5,
        color: colors[i % colors.length],
        duration: 1.1 + Math.random() * 0.7,
      };
    }),
  );

  if (reduce) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-[26vh] z-40 flex justify-center"
    >
      <motion.span
        className="absolute size-24 rounded-full border-2 border-up"
        initial={{ scale: 0.2, opacity: 0.9 }}
        animate={{ scale: 5, opacity: 0 }}
        transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
      />
      {pieces.map((p, i) => (
        <motion.span
          key={i}
          className="absolute"
          style={{
            width: p.size,
            height: p.round ? p.size : p.size * 1.8,
            borderRadius: p.round ? 999 : 2,
            background: p.color,
          }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 0.4, rotate: 0 }}
          animate={{ x: p.x, y: p.y, opacity: 0, scale: 1, rotate: p.rotate }}
          transition={{ duration: p.duration, ease: [0.2, 0.8, 0.4, 1] }}
        />
      ))}
    </div>
  );
}
