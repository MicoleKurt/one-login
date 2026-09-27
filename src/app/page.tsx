import { redirect } from "next/navigation";
import { Dashboard } from "@/components/dashboard/dashboard";
import type { DashboardData } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const claims = auth?.claims;
  if (!claims) redirect("/login");
  if (claims.aal !== "aal2") redirect("/mfa");

  const { data, error } = await supabase.rpc("dashboard");
  if (error) throw new Error("Couldn't load this month's numbers.");

  const dashboard = data as DashboardData;
  if (!dashboard.business) throw new Error("This login isn't linked to a business.");

  const email = claims.email ?? "";
  const name = String((claims.user_metadata as { name?: string } | undefined)?.name ?? "").trim();

  return (
    <Dashboard
      data={dashboard}
      viewer={{
        id: claims.sub,
        email,
        name: name || email.split("@")[0],
        businessId: dashboard.business.id,
        business: dashboard.business.name,
      }}
    />
  );
}
