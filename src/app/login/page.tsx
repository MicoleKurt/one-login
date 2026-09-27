import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Sign in · One Login" };

export default function LoginPage() {
  return (
    <AuthShell
      hero
      title="Your whole business."
      accent="One screen."
      subtitle="Money in, money out, profit. Nothing to learn."
    >
      <LoginForm />
    </AuthShell>
  );
}
