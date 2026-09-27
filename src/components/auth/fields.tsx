"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";

export function FormError({ message }: { message: string | null }) {
  return (
    <AnimatePresence initial={false}>
      {message && (
        <motion.p
          role="alert"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="px-1 text-[14px] leading-snug text-down"
        >
          {message}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

export function SubmitButton({
  busy,
  busyLabel,
  children,
  disabled,
}: {
  busy: boolean;
  busyLabel: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <motion.button
      type="submit"
      whileTap={{ scale: 0.975 }}
      disabled={busy || disabled}
      className="btn-hivis mt-1 flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-[17px] font-semibold tracking-[-0.01em]"
    >
      {busy ? (
        <>
          <Loader2 className="size-5 animate-spin" /> {busyLabel}
        </>
      ) : (
        <>
          {children} <ArrowRight className="size-5" strokeWidth={2.4} />
        </>
      )}
    </motion.button>
  );
}

export function PasswordInput({
  id,
  autoComplete,
  placeholder,
  value,
  onChange,
}: {
  id: string;
  autoComplete: "current-password" | "new-password";
  placeholder: string;
  value?: string;
  onChange?: (value: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <label className="sr-only" htmlFor={id}>
        {placeholder}
      </label>
      <input
        id={id}
        name="password"
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required
        maxLength={72}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        className="field pr-14"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-1 grid w-12 place-items-center text-ink-3 transition-colors hover:text-ink"
      >
        {visible ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
      </button>
    </div>
  );
}

export function TextInput({
  id,
  label,
  ...props
}: { id: string; label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <>
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <input id={id} name={id} placeholder={label} required className="field" {...props} />
    </>
  );
}
