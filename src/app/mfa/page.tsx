import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { MfaForm } from "@/components/auth/mfa-form";

export const metadata: Metadata = { title: "Two-step verification · One Login" };

export default function MfaPage() {
  return (
    <AuthShell
      title="One more lock."
      accent="Your phone."
      subtitle="Even if someone gets your password, they can't see a dollar without this code."
    >
      <MfaForm />
    </AuthShell>
  );
}
