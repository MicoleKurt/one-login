"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { AuthError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { FormError, PasswordInput, SubmitButton, TextInput } from "./fields";

/**
 * Credentials go straight from the browser to Supabase Auth (bcrypt-hashed there).
 * Our own server never sees a password, and Supabase rate-limits by the real client IP.
 */
export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);

    const form = new FormData(event.currentTarget);
    const { error } = await createClient().auth.signInWithPassword({
      email: String(form.get("email") ?? "").trim(),
      password: String(form.get("password") ?? ""),
    });

    if (error) {
      setBusy(false);
      setError(signInMessage(error));
      return;
    }
    router.replace("/mfa");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2.5">
      <TextInput
        id="email"
        label="Email"
        type="email"
        inputMode="email"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        maxLength={254}
      />
      <PasswordInput id="password" autoComplete="current-password" placeholder="Password" />
      <FormError message={error} />
      <SubmitButton busy={busy} busyLabel="Checking">
        Sign in
      </SubmitButton>
      <p className="pt-2 text-center text-[14px] text-ink-2">
        New here?{" "}
        <Link
          href="/signup"
          className="font-semibold text-hivis underline-offset-4 hover:underline"
        >
          Create your account
        </Link>
      </p>
    </form>
  );
}

function signInMessage(error: AuthError) {
  if (error.status === 429)
    return "Too many attempts. Take a breather and try again in a few minutes.";
  if (error.code === "email_not_confirmed")
    return "Confirm your email first. The link is in your inbox.";
  // Same message for "no such email" and "wrong password": no account enumeration.
  if (error.status && error.status < 500) return "That email and password don't match.";
  return "Couldn't reach the server. Check your signal and try again.";
}
