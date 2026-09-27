"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { motion, useScroll } from "motion/react";
import { CheckCircle2 } from "lucide-react";
import { formatMoney, type DashboardData } from "@/lib/money";
import { Backdrop } from "@/components/ui/backdrop";
import { useTilt } from "@/components/ui/use-parallax";
import { Celebration } from "./celebration";
import { Feed } from "./feed";
import { Hero } from "./hero";
import { JobSheet, type JobSheetHandle, type NewJob } from "./job-sheet";
import { Toast, type ToastData } from "./toast";
import { TopBar } from "./top-bar";
import { useJobs } from "./use-jobs";

export type Viewer = { id: string; email: string; name: string; business: string };

const ease = [0.16, 1, 0.3, 1] as const;

export function Dashboard({ data, viewer }: { data: DashboardData; viewer: Viewer }) {
  const { jobs, add, undo } = useJobs(viewer.id, data.month_start, data.jobs);
  const costs = data.costs;

  const moneyIn = useMemo(() => jobs.reduce((sum, j) => sum + j.amount_cents, 0), [jobs]);
  const moneyOut = useMemo(() => costs.reduce((sum, c) => sum + c.amount_cents, 0), [costs]);
  const profit = moneyIn - moneyOut;
  const inTheBlack = profit >= 0;

  const tilt = useTilt();
  const { scrollY } = useScroll();
  const sheet = useRef<JobSheetHandle>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [origin, setOrigin] = useState("50% 50vh");
  const [toast, setToast] = useState<ToastData | null>(null);
  const [burst, setBurst] = useState(0);
  const [freshId, setFreshId] = useState<string | null>(null);

  const dismissToast = useCallback(() => setToast(null), []);

  function openSheet() {
    setOrigin(`50% ${window.scrollY + window.innerHeight / 2}px`);
    sheet.current?.open();
  }

  function handleAdd(input: NewJob) {
    const crossed = profit < 0 && profit + input.amount_cents >= 0;
    const { job, saved } = add(input);

    setFreshId(job.id);
    if (crossed) setBurst((n) => n + 1);
    navigator.vibrate?.(crossed ? [16, 70, 28] : 14);
    window.scrollTo({ top: 0, behavior: "smooth" });

    const toastId = Date.now();
    setToast({
      id: toastId,
      tone: crossed ? "celebrate" : "success",
      title: crossed
        ? "Back in the black."
        : `${formatMoney(input.amount_cents, { sign: true })} in`,
      detail: [input.customer, input.description].filter(Boolean).join(" · "),
      action: {
        label: "Undo",
        run: async () => {
          const ok = await undo(job);
          setToast(
            ok
              ? {
                  id: Date.now(),
                  tone: "success",
                  title: "Undone",
                  detail: `${job.customer} removed`,
                }
              : {
                  id: Date.now(),
                  tone: "error",
                  title: "Couldn't undo",
                  detail: "Check your signal and try again.",
                },
          );
        },
      },
    });

    saved.then((result) => {
      if (result === "saved") return;
      setToast((current) =>
        current?.id !== toastId
          ? current
          : result === "offline"
            ? {
                id: Date.now(),
                tone: "offline",
                title: "Saved on your phone",
                detail: "No signal. It'll sync the moment you're back online.",
              }
            : {
                id: Date.now(),
                tone: "error",
                title: "That job didn't save",
                detail: "Please try adding it again.",
              },
      );
    });
  }

  return (
    <div
      className="mood-transition relative min-h-dvh"
      style={{ "--mood": inTheBlack ? "var(--up)" : "var(--down)" } as React.CSSProperties}
    >
      <Backdrop tilt={tilt} scrollY={scrollY} />

      <motion.div
        animate={{ scale: sheetOpen ? 0.94 : 1, opacity: sheetOpen ? 0.55 : 1 }}
        transition={{ type: "spring", damping: 34, stiffness: 300 }}
        style={{ transformOrigin: origin }}
        className="relative mx-auto max-w-[480px]"
      >
        <TopBar viewer={viewer} profit={profit} scrollY={scrollY} />
        <Hero
          profit={profit}
          moneyIn={moneyIn}
          moneyOut={moneyOut}
          jobCount={jobs.length}
          now={data.now}
          firstName={viewer.name.split(" ")[0]}
          scrollY={scrollY}
        />
        <Feed jobs={jobs} costs={costs} now={data.now} freshId={freshId} />
      </motion.div>

      <motion.div
        initial={{ y: 140 }}
        animate={{ y: sheetOpen ? 160 : 0 }}
        transition={{ delay: sheetOpen ? 0 : 0.45, duration: 0.9, ease }}
        className="pointer-events-none fixed inset-x-0 bottom-0 z-40 bg-gradient-to-t from-bg via-bg/85 to-transparent px-4 pt-12 pb-[max(16px,env(safe-area-inset-bottom))]"
      >
        <motion.button
          onClick={openSheet}
          whileTap={{ scale: 0.965 }}
          whileHover={{ scale: 1.01 }}
          className="btn-hivis sheen pointer-events-auto mx-auto flex h-[68px] w-full max-w-[448px] items-center justify-center gap-2.5 rounded-[24px] text-[20px] font-semibold tracking-[-0.02em]"
        >
          <CheckCircle2 className="size-6" strokeWidth={2.4} />
          Job done
        </motion.button>
      </motion.div>

      <JobSheet ref={sheet} jobs={jobs} onOpenChange={setSheetOpen} onSubmit={handleAdd} />
      <Toast toast={toast} onDismiss={dismissToast} />
      {burst > 0 && <Celebration key={burst} />}
    </div>
  );
}
