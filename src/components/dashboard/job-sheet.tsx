"use client";

import { useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useDragControls } from "motion/react";
import { Check, History, X } from "lucide-react";
import { formatMoney, parseDollars, type Job } from "@/lib/money";

export type JobSheetHandle = { open: () => void };

export type NewJob = { customer: string; description: string; amount_cents: number };

const COMMON_JOBS = ["Hot water", "Blocked drain", "Leaking tap", "Service call", "Gas fitting"];

export function JobSheet({
  ref,
  jobs,
  onOpenChange,
  onSubmit,
}: {
  ref: React.Ref<JobSheetHandle>;
  jobs: Job[];
  onOpenChange: (open: boolean) => void;
  onSubmit: (job: NewJob) => void;
}) {
  const [open, setOpen] = useState(false);
  const [customer, setCustomer] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");

  const rootRef = useRef<HTMLDivElement>(null);
  const customerRef = useRef<HTMLInputElement>(null);
  const jobRef = useRef<HTMLInputElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  const drag = useDragControls();

  const amount = parseDollars(price);
  const ready = customer.trim().length > 0 && amount !== null && amount <= 100_000_000;

  useImperativeHandle(ref, () => ({
    open() {
      // Focus synchronously inside the tap handler - the only way iOS will raise the keyboard.
      if (rootRef.current) rootRef.current.inert = false;
      customerRef.current?.focus({ preventScroll: true });
      setOpen(true);
      onOpenChange(true);
    },
  }));

  function close() {
    (document.activeElement as HTMLElement | null)?.blur();
    setOpen(false);
    onOpenChange(false);
  }

  // Track the visible viewport so the sheet sits above the on-screen keyboard.
  useEffect(() => {
    const vv = window.visualViewport;
    const root = rootRef.current;
    if (!vv || !root) return;
    const sync = () => {
      root.style.setProperty("--vv-top", `${vv.offsetTop}px`);
      root.style.setProperty("--vv-height", `${vv.height}px`);
    };
    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    html.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => {
      html.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const customers = useMemo(() => {
    const seen = new Set<string>();
    const typed = customer.trim().toLowerCase();
    return jobs
      .map((j) => j.customer)
      .filter((name) => {
        const key = name.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return !typed || (key.startsWith(typed) && key !== typed);
      })
      .slice(0, 8);
  }, [jobs, customer]);

  const jobTypes = useMemo(() => {
    const seen = new Set<string>();
    const typed = description.trim().toLowerCase();
    return [...jobs.map((j) => j.description), ...COMMON_JOBS]
      .filter((d) => {
        const key = d.trim().toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return !typed || (key.includes(typed) && key !== typed);
      })
      .slice(0, 8);
  }, [jobs, description]);

  // "Same as last time" - the price you charged for this job before.
  const lastPrice = useMemo(() => {
    const d = description.trim().toLowerCase();
    if (!d) return null;
    return jobs.find((j) => j.description.trim().toLowerCase() === d)?.amount_cents ?? null;
  }, [jobs, description]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || amount === null) return;
    onSubmit({ customer: customer.trim(), description: description.trim(), amount_cents: amount });
    close();
    setCustomer("");
    setDescription("");
    setPrice("");
  }

  function next(e: React.KeyboardEvent, target: React.RefObject<HTMLInputElement | null>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    target.current?.focus();
  }

  return (
    <div
      ref={rootRef}
      inert={!open}
      className="fixed inset-x-0 top-[var(--vv-top,0px)] z-50 h-[var(--vv-height,100dvh)]"
      style={{ pointerEvents: open ? "auto" : "none" }}
    >
      <motion.div
        aria-hidden
        onClick={close}
        initial={false}
        animate={{ opacity: open ? 1 : 0 }}
        transition={{ duration: 0.35 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-[6px]"
      />

      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="job-sheet-title"
        initial={false}
        animate={{ y: open ? 0 : "105%" }}
        transition={{ type: "spring", damping: 34, stiffness: 340, mass: 0.9 }}
        drag="y"
        dragControls={drag}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.7 }}
        onDragEnd={(_, info) => (info.offset.y > 110 || info.velocity.y > 600) && close()}
        className="absolute inset-x-0 top-[max(12px,env(safe-area-inset-top))] bottom-0 mx-auto flex max-w-[480px] flex-col rounded-t-[32px] border-t border-line-strong bg-[#0b0f0d] shadow-[0_-30px_80px_-20px_rgb(0_0_0/0.8)]"
      >
        <div
          onPointerDown={(e) => drag.start(e)}
          className="flex cursor-grab touch-none justify-center pt-3 pb-1 active:cursor-grabbing"
        >
          <span className="h-1.5 w-10 rounded-full bg-white/20" />
        </div>

        <header className="flex items-start justify-between px-5 pt-1">
          <div>
            <h2
              id="job-sheet-title"
              className="text-[26px] leading-tight font-semibold tracking-[-0.035em]"
            >
              Job done
            </h2>
            <p className="font-serif text-[19px] leading-tight text-hivis italic">
              Nice work. Let&apos;s count it.
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="grid size-11 place-items-center rounded-full bg-white/[0.06] text-ink-2 transition-colors hover:text-ink"
          >
            <X className="size-5" />
          </button>
        </header>

        <form
          onSubmit={submit}
          className="no-scrollbar flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 pt-5 pb-[calc(env(safe-area-inset-bottom)+20px)]"
        >
          <Field label="Customer" htmlFor="customer">
            <input
              ref={customerRef}
              id="customer"
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              onKeyDown={(e) => next(e, jobRef)}
              placeholder="Who was it for?"
              autoComplete="off"
              autoCapitalize="words"
              enterKeyHint="next"
              maxLength={80}
              className="field"
            />
            <Chips
              items={customers}
              onPick={(name) => {
                setCustomer(name);
                jobRef.current?.focus();
              }}
            />
          </Field>

          <Field label="Job" htmlFor="job">
            <input
              ref={jobRef}
              id="job"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={(e) => next(e, priceRef)}
              placeholder="What did you do?"
              autoComplete="off"
              autoCapitalize="sentences"
              enterKeyHint="next"
              maxLength={120}
              className="field"
            />
            <Chips
              items={jobTypes}
              onPick={(d) => {
                setDescription(d);
                priceRef.current?.focus();
              }}
            />
          </Field>

          <Field label="Price" htmlFor="price">
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[30px] font-semibold text-ink-3">
                $
              </span>
              <input
                ref={priceRef}
                id="price"
                value={price}
                onChange={(e) => setPrice(e.target.value.replace(/[^0-9.,]/g, ""))}
                onFocus={() =>
                  setTimeout(
                    () => submitRef.current?.scrollIntoView({ block: "end", behavior: "smooth" }),
                    300,
                  )
                }
                placeholder="0"
                inputMode="decimal"
                enterKeyHint="done"
                autoComplete="off"
                className="field num h-[68px] pl-10 text-[34px] font-semibold"
              />
            </div>
            <AnimatePresence initial={false}>
              {lastPrice !== null && parseDollars(price) !== lastPrice && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <button
                    type="button"
                    onClick={() => setPrice(String(lastPrice / 100))}
                    className="mt-2.5 flex items-center gap-1.5 rounded-full border border-line bg-white/[0.04] px-3 py-1.5 text-[13px] text-ink-2 active:bg-white/10"
                  >
                    <History className="size-3.5" /> Same as last time ·{" "}
                    <span className="num font-semibold text-ink">{formatMoney(lastPrice)}</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </Field>

          <motion.button
            ref={submitRef}
            type="submit"
            disabled={!ready}
            whileTap={{ scale: 0.975 }}
            className="btn-hivis mt-1 flex h-16 shrink-0 items-center justify-center gap-2 rounded-[20px] text-[18px] font-semibold tracking-[-0.01em] transition-colors"
          >
            <Check className="size-5" strokeWidth={3} />
            {amount ? (
              <span>
                Add <span className="num">{formatMoney(amount)}</span> to this month
              </span>
            ) : (
              "Add to this month"
            )}
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-2 block px-1 text-[13px] font-medium tracking-wide text-ink-2"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function Chips({ items, onPick }: { items: string[]; onPick: (value: string) => void }) {
  if (items.length === 0) return null;
  return (
    <div className="no-scrollbar -mx-5 mt-2.5 flex gap-2 overflow-x-auto px-5">
      {items.map((item) => (
        <button
          key={item}
          type="button"
          onPointerDown={(e) => e.preventDefault() /* keep the keyboard up */}
          onClick={() => onPick(item)}
          className="h-9 shrink-0 rounded-full border border-line bg-white/[0.04] px-3.5 text-[14px] whitespace-nowrap text-ink-2 transition-colors active:bg-white/10"
        >
          {item}
        </button>
      ))}
    </div>
  );
}
