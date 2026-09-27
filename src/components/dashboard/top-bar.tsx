"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useTransform, type MotionValue } from "motion/react";
import { LogOut } from "lucide-react";
import { signOut } from "@/app/actions";
import { LogoMark } from "@/components/ui/logo";
import { AnimatedMoney } from "./animated-number";
import type { Viewer } from "./dashboard";

export function TopBar({
  viewer,
  profit,
  scrollY,
}: {
  viewer: Viewer;
  profit: number;
  scrollY: MotionValue<number>;
}) {
  const background = useTransform(scrollY, [0, 90], ["rgb(5 7 6 / 0)", "rgb(5 7 6 / 0.78)"]);
  const border = useTransform(
    scrollY,
    [0, 90],
    ["rgb(255 255 255 / 0)", "rgb(255 255 255 / 0.08)"],
  );
  // Once the big number scrolls away, a small one takes its place. Profit never leaves the screen.
  const compactOpacity = useTransform(scrollY, [240, 330], [0, 1]);
  const compactY = useTransform(scrollY, [240, 330], [8, 0]);

  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      style={{ backgroundColor: background, borderColor: border }}
      className="sticky top-0 z-30 border-b pt-[env(safe-area-inset-top)] backdrop-blur-xl"
    >
      <div className="flex h-16 items-center justify-between gap-3 px-5">
        <div className="flex min-w-0 items-center gap-3">
          <LogoMark size={34} />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[15px] font-semibold tracking-[-0.02em]">
              {viewer.business}
            </p>
            <p className="truncate text-[12px] text-ink-3">
              G&apos;day, {viewer.name.split(" ")[0]}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <motion.div
            style={{ opacity: compactOpacity, y: compactY }}
            className="text-right leading-tight"
          >
            <p className="text-[10px] font-semibold tracking-[0.1em] text-ink-3 uppercase">
              Profit
            </p>
            <AnimatedMoney
              cents={profit}
              className="num mood-transition text-[16px] font-semibold text-mood"
            />
          </motion.div>
          <AccountMenu viewer={viewer} />
        </div>
      </div>
    </motion.header>
  );
}

function AccountMenu({ viewer }: { viewer: Viewer }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const initials = viewer.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Account"
        aria-expanded={open}
        className="grid size-10 place-items-center rounded-full border border-line-strong bg-gradient-to-b from-white/[0.12] to-white/[0.03] text-[13px] font-semibold tracking-wide"
      >
        {initials}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ type: "spring", damping: 26, stiffness: 420 }}
            className="glass absolute top-12 right-0 w-64 origin-top-right rounded-2xl bg-[#0d1210]/90 p-2"
          >
            <div className="px-3 pt-2 pb-3">
              <p className="text-[15px] font-semibold">{viewer.name}</p>
              <p className="truncate text-[13px] text-ink-3">{viewer.email}</p>
            </div>
            <form action={signOut}>
              <button className="flex h-11 w-full items-center gap-2.5 rounded-xl px-3 text-[15px] text-ink-2 transition-colors hover:bg-white/5 hover:text-ink active:bg-white/10">
                <LogOut className="size-4" /> Sign out
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
