import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = { title: "Create your account · One Login" };

export default function SignupPage() {
  return (
    <AuthShell
      title="Your numbers."
      accent="Nobody else's."
      subtitle="Each business is sealed off from every other one, right down to the database."
    >
      <SignupForm />
    </AuthShell>
  );
}
