"use client";

import { useMemo } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CloudOff, Landmark, Wrench } from "lucide-react";
import { dayHeading, dayKey, formatMoney, timeOfDay, type Cost, type Job } from "@/lib/money";

type Entry = {
  id: string;
  kind: "job" | "cost";
  title: string;
  detail: string;
  cents: number;
  at: string;
  pending?: boolean;
};

export function Feed({
  jobs,
  costs,
  now,
  freshId,
}: {
  jobs: Job[];
  costs: Cost[];
  now: string;
  freshId: string | null;
}) {
  const groups = useMemo(() => {
    const entries: Entry[] = [
      ...jobs.map((j) => ({
        id: j.id,
        kind: "job" as const,
        title: j.customer,
        detail: j.description || "Job",
        cents: j.amount_cents,
        at: j.done_at,
        pending: j.pending,
      })),
      ...costs.map((c) => ({
        id: c.id,
        kind: "cost" as const,
        title: c.payee,
        detail: c.category,
        cents: -c.amount_cents,
        at: c.spent_at,
      })),
    ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

    const byDay = new Map<string, Entry[]>();
    for (const entry of entries) {
      const key = dayKey(entry.at);
      byDay.set(key, [...(byDay.get(key) ?? []), entry]);
    }
    return [...byDay.entries()].map(([key, items]) => ({
      key,
      heading: dayHeading(items[0].at, now),
      items,
    }));
  }, [jobs, costs, now]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 60 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35, duration: 1, ease: [0.16, 1, 0.3, 1] }}
      className="relative z-10 min-h-[75vh] rounded-t-[34px] border-t border-line-strong bg-[#070a08]/88 pb-44 shadow-[0_-40px_80px_-30px_rgb(0_0_0/0.9)] backdrop-blur-2xl"
    >
      <div className="flex justify-center pt-2.5">
        <span className="h-1 w-9 rounded-full bg-white/12" />
      </div>
      <div className="flex items-baseline justify-between px-5 pt-4 pb-1">
        <h2 className="text-[21px] font-semibold tracking-[-0.03em]">This month</h2>
        <span className="text-[13px] text-ink-3">
          {jobs.length} jobs · {costs.length} bills
        </span>
      </div>

      {groups.length === 0 && (
        <p className="px-5 py-16 text-center font-serif text-[20px] text-ink-3 italic">
          Nothing yet this month. Your first job goes here.
        </p>
      )}

      {groups.map((group) => (
        <motion.div key={group.key} layout="position">
          <h3 className="sticky top-[calc(env(safe-area-inset-top)+64px)] z-10 bg-[#070a08]/92 px-5 pt-4 pb-2 text-[12px] font-semibold tracking-[0.08em] text-ink-3 uppercase backdrop-blur-xl">
            {group.heading}
          </h3>
          <ul>
            <AnimatePresence initial={false}>
              {group.items.map((entry) => (
                <Row key={entry.id} entry={entry} fresh={entry.id === freshId} />
              ))}
            </AnimatePresence>
          </ul>
        </motion.div>
      ))}
    </motion.section>
  );
}

function Row({ entry, fresh }: { entry: Entry; fresh: boolean }) {
  const job = entry.kind === "job";
  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: -14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: -30, transition: { duration: 0.22 } }}
      transition={{ type: "spring", damping: 26, stiffness: 300 }}
      className="relative flex items-center gap-3.5 px-5 py-3"
    >
      {fresh && (
        <motion.span
          aria-hidden
          className="absolute inset-x-2.5 inset-y-0.5 rounded-2xl bg-hivis/10 ring-1 ring-hivis/25"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ delay: 1.6, duration: 1.4 }}
        />
      )}
      <span
        className={`relative grid size-11 shrink-0 place-items-center rounded-2xl ${
          job ? "bg-up/12 text-up" : "bg-white/[0.05] text-ink-3"
        }`}
      >
        {job ? <Wrench className="size-[18px]" /> : <Landmark className="size-[18px]" />}
      </span>
      <div className="relative min-w-0 flex-1 leading-tight">
        <p className="truncate text-[15px] font-medium">{entry.title}</p>
        <p className="mt-1 flex items-center gap-1.5 truncate text-[13px] text-ink-3">
          {entry.pending ? (
            <>
              <CloudOff className="size-3.5 shrink-0" /> Syncing…
            </>
          ) : (
            <>
              {entry.detail} · {timeOfDay(entry.at)}
            </>
          )}
        </p>
      </div>
      <span className={`num relative text-[16px] font-semibold ${job ? "text-up" : "text-ink-2"}`}>
        {formatMoney(entry.cents, { sign: true })}
      </span>
    </motion.li>
  );
}
