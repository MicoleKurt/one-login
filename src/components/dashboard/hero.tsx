"use client";

import { AnimatePresence, motion, useTransform, type MotionValue } from "motion/react";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { dayOfMonth, formatMoney, monthLabel } from "@/lib/money";
import { AnimatedMoney } from "./animated-number";

const ease = [0.16, 1, 0.3, 1] as const;

const rise = {
  hidden: { opacity: 0, y: 18, filter: "blur(6px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.9, ease } },
};

export function Hero({
  profit,
  moneyIn,
  moneyOut,
  jobCount,
  now,
  firstName,
  scrollY,
}: {
  profit: number;
  moneyIn: number;
  moneyOut: number;
  jobCount: number;
  now: string;
  firstName: string;
  scrollY: MotionValue<number>;
}) {
  // Parallax: the numbers drift up slower than the page and fade as the feed slides over them.
  const y = useTransform(scrollY, [0, 500], [0, 190]);
  const opacity = useTransform(scrollY, [0, 380], [1, 0]);
  const scale = useTransform(scrollY, [0, 500], [1, 0.9]);

  const up = profit >= 0;
  const { day, daysInMonth } = dayOfMonth(now);
  const digits = formatMoney(profit).length;
  const size = digits <= 6 ? 92 : digits <= 8 ? 76 : 60;
  const covered = moneyOut === 0 ? 1 : moneyIn / moneyOut;
  const avgJob = jobCount ? moneyIn / jobCount : 0;
  const jobsToGo = avgJob ? Math.max(1, Math.ceil(-profit / avgJob)) : 0;

  return (
    <motion.section
      style={{ y, opacity, scale }}
      initial="hidden"
      animate="show"
      transition={{ staggerChildren: 0.08, delayChildren: 0.1 }}
      className="origin-top px-5 pt-5 pb-10 will-change-transform"
    >
      <motion.p variants={rise} className="text-[13px] font-medium text-ink-3">
        {monthLabel(now)} · day {day} of {daysInMonth}
      </motion.p>

      <motion.h1 variants={rise} className="mt-5 text-[16px] font-medium text-ink-2">
        Profit this month
      </motion.h1>

      <motion.div variants={rise}>
        <AnimatedMoney
          cents={profit}
          delay={0.25}
          className="num mood-transition block leading-[0.95] font-semibold text-mood transition-[font-size] duration-500"
          style={{
            fontSize: `min(${size}px, ${size / 4.1}vw)`,
            textShadow: "0 0 60px color-mix(in oklab, var(--mood) 35%, transparent)",
          }}
        />
      </motion.div>

      <motion.div variants={rise} className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="mood-transition flex items-center gap-2 rounded-full bg-mood/14 px-3 py-1 text-[13px] font-semibold text-mood">
          <span className="live-dot size-2 rounded-full bg-mood text-mood" />
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={up ? "black" : "red"}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
            >
              {up ? "In the black" : "In the red"}
            </motion.span>
          </AnimatePresence>
        </span>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={up ? "up" : `down-${jobsToGo}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="font-serif text-[19px] leading-tight text-ink-2 italic"
          >
            {up
              ? profit === 0
                ? "Break-even. Next job is profit."
                : `Good month, ${firstName}.`
              : jobsToGo
                ? `${formatMoney(-profit)} to go · about ${jobsToGo === 1 ? "one job" : `${jobsToGo} jobs`}`
                : `${formatMoney(-profit)} to go`}
          </motion.span>
        </AnimatePresence>
      </motion.div>

      <motion.div variants={rise} className="mt-8 grid grid-cols-2 gap-3">
        <Stat
          label="Money in"
          icon={<ArrowDownLeft className="size-3.5" strokeWidth={2.6} />}
          iconClass="bg-up/15 text-up"
          cents={moneyIn}
          foot={`${jobCount} job${jobCount === 1 ? "" : "s"}`}
        />
        <Stat
          label="Money out"
          icon={<ArrowUpRight className="size-3.5" strokeWidth={2.6} />}
          iconClass="bg-white/[0.08] text-ink-2"
          cents={moneyOut}
          foot={
            <span className="flex items-center gap-1.5">
              <span className="live-dot size-1.5 rounded-full bg-up text-up" /> Bank feed · live
            </span>
          }
        />
      </motion.div>

      <motion.div variants={rise} className="mt-5">
        <div className="flex items-baseline justify-between text-[12px] text-ink-3">
          <span>Costs covered</span>
          <span className="num text-[13px] font-semibold text-ink-2">
            {Math.round(covered * 100)}%
          </span>
        </div>
        <div className="relative mt-2 h-2 overflow-hidden rounded-full bg-white/[0.07]">
          <motion.div
            className="mood-transition absolute inset-y-0 left-0 rounded-full bg-mood"
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(covered, 1) * 100}%` }}
            transition={{ duration: 1.4, ease, delay: 0.3 }}
            style={{ boxShadow: "0 0 18px color-mix(in oklab, var(--mood) 60%, transparent)" }}
          />
        </div>
      </motion.div>
    </motion.section>
  );
}

function Stat({
  label,
  icon,
  iconClass,
  cents,
  foot,
}: {
  label: string;
  icon: React.ReactNode;
  iconClass: string;
  cents: number;
  foot: React.ReactNode;
}) {
  return (
    <div className="glass rounded-[24px] p-4">
      <div className="flex items-center gap-2 text-[13px] font-medium text-ink-2">
        <span className={`grid size-6 place-items-center rounded-full ${iconClass}`}>{icon}</span>
        {label}
      </div>
      <AnimatedMoney
        cents={cents}
        delay={0.35}
        className="num mt-2.5 block text-[27px] leading-none font-semibold"
      />
      <div className="mt-2 text-[12px] text-ink-3">{foot}</div>
    </div>
  );
}
