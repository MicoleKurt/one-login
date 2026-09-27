"use client";

import { RotateCw } from "lucide-react";
import { LogoMark } from "@/components/ui/logo";

export default function Error({ retry }: { error: Error; retry: () => void }) {
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div className="flex flex-col items-center gap-4">
        <LogoMark size={44} />
        <h1 className="text-[24px] font-semibold tracking-[-0.03em]">Lost signal for a sec.</h1>
        <p className="max-w-xs text-[15px] text-ink-2">
          Your numbers are safe. Give it another go.
        </p>
        <button
          onClick={() => retry()}
          className="btn-hivis mt-2 flex h-14 items-center gap-2 rounded-2xl px-6 text-[17px] font-semibold"
        >
          <RotateCw className="size-5" /> Try again
        </button>
      </div>
    </main>
  );
}
