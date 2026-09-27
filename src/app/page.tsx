import { redirect } from "next/navigation";
import { Dashboard } from "@/components/dashboard/dashboard";
import type { DashboardData } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const claims = auth?.claims;
  if (!claims) redirect("/login");

  const { data, error } = await supabase.rpc("dashboard");
  if (error) throw new Error("Couldn't load this month's numbers.");

  const meta = (claims.user_metadata ?? {}) as { name?: string; business?: string };
  const email = claims.email ?? "";

  return (
    <Dashboard
      data={data as DashboardData}
      viewer={{
        id: claims.sub,
        email,
        name: meta.name ?? email.split("@")[0],
        business: meta.business ?? "My business",
      }}
    />
  );
}
