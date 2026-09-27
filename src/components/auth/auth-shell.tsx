"use client";

import { motion, useScroll, useTransform, type MotionValue } from "motion/react";
import { Check, LockKeyhole, ShieldCheck } from "lucide-react";
import { Backdrop } from "@/components/ui/backdrop";
import { Wordmark } from "@/components/ui/logo";
import { useTilt, type Tilt } from "@/components/ui/use-parallax";

const ease = [0.16, 1, 0.3, 1] as const;

/** The parallax frame shared by sign in, sign up and two-step verification. */
export function AuthShell({
  title,
  accent,
  subtitle,
  hero = false,
  children,
}: {
  title: string;
  accent: string;
  subtitle: string;
  hero?: boolean;
  children: React.ReactNode;
}) {
  const tilt = useTilt();
  const { scrollY } = useScroll();

  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-[440px] flex-col px-5 pt-[calc(env(safe-area-inset-top)+18px)] pb-[calc(env(safe-area-inset-bottom)+18px)]">
      <Backdrop tilt={tilt} scrollY={scrollY} />

      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease }}
        className="flex items-center justify-between"
      >
        <Wordmark />
        <span className="flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[11px] font-medium text-ink-2">
          <ShieldCheck className="size-3.5 text-up" strokeWidth={2.2} />
          Hosted in Sydney
        </span>
      </motion.header>

      {hero ? <HeroCards tilt={tilt} scrollY={scrollY} /> : <div className="h-10" />}

      <div className="relative">
        <h1 className="text-[34px] leading-[1.04] font-semibold tracking-[-0.045em] text-balance">
          <Reveal delay={0.3}>{title}</Reveal>
          <Reveal delay={0.42}>
            <span className="font-serif text-[40px] font-normal tracking-[-0.02em] text-hivis italic">
              {accent}
            </span>
          </Reveal>
        </h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 1 }}
          className="mt-2 text-[15px] leading-relaxed text-ink-2"
        >
          {subtitle}
        </motion.p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.9, ease }}
        className="glass mt-5 rounded-[28px] p-4"
      >
        {children}
      </motion.div>

      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 1 }}
        className="mt-auto flex items-center justify-center gap-1.5 pt-5 text-[11px] tracking-wide text-ink-3"
      >
        <LockKeyhole className="size-3" /> Encrypted · Two-step verified · Site VIP &amp; Angus
        Shield
      </motion.footer>
    </main>
  );
}

function Reveal({ children, delay }: { children: React.ReactNode; delay: number }) {
  return (
    <span className="block overflow-hidden pb-1">
      <motion.span
        className="block"
        initial={{ y: "110%" }}
        animate={{ y: 0 }}
        transition={{ delay, duration: 1, ease }}
      >
        {children}
      </motion.span>
    </span>
  );
}

/* ---------- Six systems, drifting into one screen ---------- */

function HeroCards({ tilt, scrollY }: { tilt: Tilt; scrollY: MotionValue<number> }) {
  return (
    <div className="relative my-3 h-[min(27vh,270px)] min-h-[196px] [perspective:900px]">
      <Layer tilt={tilt} scrollY={scrollY} depth={0.25} className="top-[4%] left-[2%]" delay={0.5}>
        <Chip>
          <span className="size-1.5 rounded-full bg-up" /> INV-0412 · Paid
        </Chip>
      </Layer>

      <Layer
        tilt={tilt}
        scrollY={scrollY}
        depth={0.35}
        className="right-[0%] bottom-[2%]"
        delay={0.75}
      >
        <Chip>
          <ShieldCheck className="size-3.5 text-hivis" /> Safety sign-off · 7:02am
        </Chip>
      </Layer>

      <Layer tilt={tilt} scrollY={scrollY} depth={0.15} className="top-[0%] right-[6%]" delay={0.9}>
        <Chip dim>BAS · ready to lodge</Chip>
      </Layer>

      <Layer
        tilt={tilt}
        scrollY={scrollY}
        depth={1}
        className="top-[16%] right-[4%] left-[18%]"
        delay={0.25}
      >
        <div className="glass rounded-3xl p-4">
          <div className="flex items-center justify-between text-[12px] text-ink-2">
            <span>Profit · this month</span>
            <span className="flex items-center gap-1 rounded-full bg-up/12 px-2 py-0.5 text-[11px] font-medium text-up">
              <span className="live-dot size-1.5 rounded-full bg-up text-up" /> In the black
            </span>
          </div>
          <div className="num mt-1 text-[40px] leading-none font-semibold text-up">$8,420</div>
          <Sparkline />
        </div>
      </Layer>

      <Layer
        tilt={tilt}
        scrollY={scrollY}
        depth={0.6}
        className="bottom-[10%] left-[0%]"
        delay={0.6}
      >
        <div className="glass flex items-center gap-3 rounded-2xl py-2.5 pr-4 pl-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-hivis text-hivis-ink">
            <Check className="size-5" strokeWidth={3} />
          </span>
          <span className="leading-tight">
            <span className="num block text-[16px] font-semibold text-up">+$1,850</span>
            <span className="text-[12px] text-ink-2">Hot water · Nguyen</span>
          </span>
        </div>
      </Layer>
    </div>
  );
}

function Layer({
  tilt,
  scrollY,
  depth,
  delay,
  className,
  children,
}: {
  tilt: Tilt;
  scrollY: MotionValue<number>;
  depth: number;
  delay: number;
  className: string;
  children: React.ReactNode;
}) {
  const x = useTransform(tilt.x, (v) => v * 34 * depth);
  const y = useTransform([tilt.y, scrollY], ([t, s]: number[]) => t * 22 * depth - s * depth * 0.6);
  const rotateY = useTransform(tilt.x, (v) => v * 9 * depth);
  const rotateX = useTransform(tilt.y, (v) => v * -7 * depth);

  return (
    <motion.div
      style={{ x, y, rotateX, rotateY, zIndex: Math.round(depth * 10) }}
      className={`absolute will-change-transform ${className}`}
    >
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.9, filter: "blur(10px)" }}
        animate={{ opacity: depth < 0.3 ? 0.75 : 1, y: 0, scale: 1, filter: "blur(0px)" }}
        transition={{ delay, duration: 1.2, ease }}
      >
        <motion.div
          animate={{ y: [0, -5 - depth * 4, 0] }}
          transition={{ duration: 5 + depth * 2, repeat: Infinity, ease: "easeInOut", delay }}
        >
          {children}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

function Chip({ children, dim }: { children: React.ReactNode; dim?: boolean }) {
  return (
    <span
      className={`glass flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-medium whitespace-nowrap ${
        dim ? "text-ink-3" : "text-ink-2"
      }`}
    >
      {children}
    </span>
  );
}

function Sparkline() {
  return (
    <svg viewBox="0 0 200 40" className="mt-2 h-9 w-full" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="spark" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--up)" stopOpacity="0.35" />
          <stop offset="1" stopColor="var(--up)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path
        d="M0 34 C 20 30, 30 36, 50 28 S 80 22, 100 24 S 130 12, 150 14 S 180 4, 200 6 L 200 40 L 0 40 Z"
        fill="url(#spark)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.1, duration: 1 }}
      />
      <motion.path
        d="M0 34 C 20 30, 30 36, 50 28 S 80 22, 100 24 S 130 12, 150 14 S 180 4, 200 6"
        fill="none"
        stroke="var(--up)"
        strokeWidth="2.2"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ delay: 0.6, duration: 1.6, ease }}
      />
    </svg>
  );
}
