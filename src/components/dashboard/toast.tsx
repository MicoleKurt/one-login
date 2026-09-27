"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CircleAlert, CircleCheck, CloudOff, PartyPopper } from "lucide-react";

export type ToastData = {
  id: number;
  tone: "success" | "celebrate" | "offline" | "error";
  title: string;
  detail?: string;
  action?: { label: string; run: () => void };
};

const icons = {
  success: <CircleCheck className="size-5 text-up" />,
  celebrate: <PartyPopper className="size-5 text-hivis" />,
  offline: <CloudOff className="size-5 text-ink-2" />,
  error: <CircleAlert className="size-5 text-down" />,
};

export function Toast({ toast, onDismiss }: { toast: ToastData | null; onDismiss: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onDismiss, toast.action ? 6000 : 4000);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+72px)] z-50 flex justify-center px-4"
    >
      <AnimatePresence mode="popLayout">
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -24, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.96 }}
            transition={{ type: "spring", damping: 26, stiffness: 380 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            onDragEnd={(_, info) => info.offset.y < -20 && onDismiss()}
            className="glass pointer-events-auto flex w-full max-w-[420px] items-center gap-3 rounded-2xl bg-[#0d1210]/80 py-3 pr-2 pl-3.5"
          >
            {icons[toast.tone]}
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-[15px] font-semibold">{toast.title}</p>
              {toast.detail && <p className="truncate text-[13px] text-ink-2">{toast.detail}</p>}
            </div>
            {toast.action && (
              <button
                onClick={toast.action.run}
                className="h-10 rounded-xl px-3.5 text-[14px] font-semibold text-hivis transition-colors hover:bg-white/5 active:bg-white/10"
              >
                {toast.action.label}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
