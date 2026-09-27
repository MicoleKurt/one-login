"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2, Smartphone } from "lucide-react";
import { signOut } from "@/app/actions";
import { createClient } from "@/lib/supabase/client";
import { FormError, SubmitButton } from "./fields";

type Step =
  | { kind: "loading" }
  | { kind: "enrol"; factorId: string; qr: string; secret: string; uri: string }
  | { kind: "verify"; factorId: string }
  | { kind: "failed"; message: string };

/**
 * Two-step verification with any authenticator app (TOTP). Until this passes, the
 * database returns no money rows at all - a stolen password on its own shows nothing.
 */
export function MfaForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>({ kind: "loading" });
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [onPhone, setOnPhone] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // StrictMode runs effects twice; enrol exactly once
    started.current = true;
    setOnPhone(window.matchMedia("(pointer: coarse)").matches);

    (async () => {
      const mfa = createClient().auth.mfa;
      const { data, error } = await mfa.listFactors();
      if (error) {
        setStep({ kind: "failed", message: "Your session expired. Sign in again." });
        return;
      }
      const verified = data.totp[0];
      if (verified) {
        setStep({ kind: "verify", factorId: verified.id });
        return;
      }
      // Clear any half-finished setup, then start fresh.
      for (const factor of data.all.filter((f) => f.status === "unverified")) {
        await mfa.unenroll({ factorId: factor.id });
      }
      const enrolled = await mfa.enroll({
        factorType: "totp",
        issuer: "One Login",
        friendlyName: `One Login ${crypto.randomUUID().slice(0, 6)}`,
      });
      if (enrolled.error) {
        setStep({ kind: "failed", message: "Couldn't start setup. Refresh and try again." });
        return;
      }
      setStep({
        kind: "enrol",
        factorId: enrolled.data.id,
        qr: enrolled.data.totp.qr_code,
        secret: enrolled.data.totp.secret,
        uri: enrolled.data.totp.uri,
      });
    })();
  }, []);

  async function verify(value: string) {
    if (step.kind !== "enrol" && step.kind !== "verify") return;
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.mfa.challengeAndVerify({
      factorId: step.factorId,
      code: value,
    });
    if (error) {
      setBusy(false);
      setCode("");
      setError(
        error.status === 429
          ? "Too many tries. Wait a minute, then use the newest code."
          : "That code didn't match. Codes change every 30 seconds, so use the newest one.",
      );
      return;
    }
    router.replace("/");
    router.refresh();
  }

  function onCodeChange(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 6);
    setCode(digits);
    if (digits.length === 6 && !busy) void verify(digits);
  }

  if (step.kind === "loading") {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-[14px] text-ink-2">
        <Loader2 className="size-5 animate-spin" /> Getting things ready
      </div>
    );
  }

  if (step.kind === "failed") {
    return (
      <div className="flex flex-col gap-3 py-2">
        <FormError message={step.message} />
        <form action={signOut}>
          <SubmitButton busy={false} busyLabel="">
            Back to sign in
          </SubmitButton>
        </form>
      </div>
    );
  }

  const groupedSecret = step.kind === "enrol" ? step.secret.match(/.{1,4}/g)?.join(" ") : "";

  return (
    <div className="flex flex-col gap-4">
      {step.kind === "enrol" && (
        <div className="flex flex-col gap-3">
          <p className="text-[14px] leading-relaxed text-ink-2">
            <span className="font-semibold text-ink">1.</span> Add One Login to an authenticator app
            (Google Authenticator, Microsoft Authenticator, 1Password, or your iPhone&apos;s
            Passwords app).
          </p>

          {onPhone ? (
            <a
              href={step.uri}
              className="flex h-14 items-center justify-center gap-2 rounded-2xl border border-line-strong bg-white/[0.05] text-[16px] font-semibold"
            >
              <Smartphone className="size-5" /> Add to my authenticator
            </a>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- a data: URI SVG from Supabase
            <img
              src={step.qr}
              alt="QR code to add One Login to your authenticator app"
              className="mx-auto size-44 rounded-2xl bg-white p-3"
            />
          )}

          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(step.secret);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-white/[0.03] px-4 py-3 text-left"
          >
            <span className="min-w-0">
              <span className="block text-[12px] text-ink-3">Or type this setup key</span>
              <span className="num block truncate font-mono text-[14px] tracking-normal text-ink">
                {groupedSecret}
              </span>
            </span>
            {copied ? (
              <Check className="size-5 shrink-0 text-up" />
            ) : (
              <Copy className="size-5 shrink-0 text-ink-3" />
            )}
          </button>

          <p className="pt-1 text-[14px] text-ink-2">
            <span className="font-semibold text-ink">2.</span> Enter the 6-digit code it shows.
          </p>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (code.length === 6) void verify(code);
        }}
        className="flex flex-col gap-2.5"
      >
        <label htmlFor="code" className="sr-only">
          6-digit code
        </label>
        <input
          id="code"
          value={code}
          onChange={(e) => onCodeChange(e.target.value)}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          placeholder="000000"
          autoFocus={step.kind === "verify"}
          className="field num h-[68px] text-center text-[32px] font-semibold tracking-[0.35em]"
        />
        <FormError message={error} />
        <SubmitButton busy={busy} busyLabel="Verifying" disabled={code.length !== 6}>
          {step.kind === "enrol" ? "Turn on and continue" : "Verify"}
        </SubmitButton>
      </form>

      <form action={signOut} className="text-center">
        <button className="text-[13px] text-ink-3 underline-offset-4 hover:text-ink hover:underline">
          Not you? Sign out
        </button>
      </form>
    </div>
  );
}
