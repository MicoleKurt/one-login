"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "motion/react";
import { MailCheck } from "lucide-react";
import type { AuthError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { breachCount, MIN_PASSWORD_LENGTH, passwordProblem, passwordScore } from "@/lib/password";
import { FormError, PasswordInput, SubmitButton, TextInput } from "./fields";

const strengthLabels = ["", "Too short", "Okay", "Strong", "Very strong"];
const strengthColours = ["", "bg-down", "bg-hivis", "bg-up", "bg-up"];

export function SignupForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checkInbox, setCheckInbox] = useState<string | null>(null);
  const score = passwordScore(password);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const business = String(form.get("business") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();

    const problem = passwordProblem(password, { email, name, business });
    if (problem) return setError(problem);

    setBusy(true);
    const breaches = await breachCount(password);
    if (breaches) {
      setBusy(false);
      return setError(
        `That password has turned up in ${breaches.toLocaleString("en-AU")} data breaches. Pick one nobody else has used.`,
      );
    }

    const { data, error } = await createClient().auth.signUp({
      email,
      password,
      options: {
        data: { name, business_name: business },
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });

    if (error) {
      setBusy(false);
      return setError(signUpMessage(error));
    }
    if (!data.session) {
      setBusy(false);
      return setCheckInbox(email);
    }
    router.replace("/mfa");
    router.refresh();
  }

  if (checkInbox) {
    return (
      <div className="flex flex-col items-center gap-3 px-2 py-4 text-center">
        <span className="grid size-12 place-items-center rounded-2xl bg-hivis/12 text-hivis">
          <MailCheck className="size-6" />
        </span>
        <p className="text-[17px] font-semibold">Check your inbox</p>
        <p className="text-[14px] text-ink-2">
          We sent a confirmation link to <span className="text-ink">{checkInbox}</span>. Tap it,
          then sign in.
        </p>
        <Link href="/login" className="mt-1 text-[14px] font-semibold text-hivis">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2.5">
      <TextInput id="name" label="Your name" autoComplete="name" maxLength={60} />
      <TextInput id="business" label="Business name" autoComplete="organization" maxLength={80} />
      <TextInput
        id="email"
        label="Email"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        maxLength={254}
      />
      <PasswordInput
        id="password"
        autoComplete="new-password"
        placeholder={`Password (${MIN_PASSWORD_LENGTH}+ characters)`}
        value={password}
        onChange={setPassword}
      />

      <div aria-live="polite" className="flex items-center gap-3 px-1">
        <div className="flex h-1.5 flex-1 gap-1">
          {[1, 2, 3, 4].map((step) => (
            <span key={step} className="h-full flex-1 overflow-hidden rounded-full bg-white/[0.08]">
              <motion.span
                className={`block h-full ${strengthColours[score]}`}
                initial={false}
                animate={{ width: score >= step ? "100%" : "0%" }}
                transition={{ duration: 0.3 }}
              />
            </span>
          ))}
        </div>
        <span className="w-20 text-right text-[12px] text-ink-3">{strengthLabels[score]}</span>
      </div>

      <FormError message={error} />
      <SubmitButton busy={busy} busyLabel="Setting you up">
        Create account
      </SubmitButton>
      <p className="pt-2 text-center text-[14px] text-ink-2">
        Already on One Login?{" "}
        <Link href="/login" className="font-semibold text-hivis underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

function signUpMessage(error: AuthError) {
  if (error.status === 429)
    return "Too many sign-ups from this network. Try again in a few minutes.";
  if (error.code === "user_already_exists" || error.code === "email_exists")
    return "There's already an account with that email. Sign in instead.";
  if (error.code === "weak_password") return "Choose a longer, harder-to-guess password.";
  if (error.code === "email_address_invalid" || error.code === "validation_failed")
    return "That email address doesn't look right.";
  return "Couldn't create the account. Check your signal and try again.";
}
