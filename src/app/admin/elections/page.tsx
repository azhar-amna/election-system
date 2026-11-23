import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ElectionsSetupClient from "@/components/admin/ElectionsSetupClient";

async function AdminElectionsContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin/elections");
  }

  if (user.app_metadata?.role !== "admin") {
    redirect("/dashboard");
  }

  const [electionsRes, regionsRes, stationsRes, partiesRes, symbolsRes] =
    await Promise.all([
      supabase
        .from("election")
        .select("*")
        .order("election_id", { ascending: false }),
      supabase
        .from("region")
        .select("*")
        .order("region_name", { ascending: true }),
      supabase
        .from("polling_station")
        .select("*, region(*)")
        .order("name", { ascending: true }),
      supabase
        .from("political_party")
        .select("*")
        .order("party_name", { ascending: true }),
      supabase
        .from("election_symbol")
        .select("*")
        .order("symbol_name", { ascending: true }),
    ]);

  const firstError =
    electionsRes.error ??
    regionsRes.error ??
    stationsRes.error ??
    partiesRes.error ??
    symbolsRes.error;

  return (
    <ElectionsSetupClient
      initialElections={electionsRes.data ?? []}
      initialRegions={regionsRes.data ?? []}
      initialStations={stationsRes.data ?? []}
      initialParties={partiesRes.data ?? []}
      initialSymbols={symbolsRes.data ?? []}
      loadError={firstError?.message ?? null}
    />
  );
}

function AdminElectionsSkeleton() {
  return (
    <div
      aria-label="Loading elections setup"
      className="mx-auto flex w-full max-w-6xl flex-col gap-6"
    >
      <div className="space-y-3">
        <div className="h-6 w-36 animate-pulse rounded-full bg-[#161F1A]" />
        <div className="h-8 w-72 animate-pulse rounded-md bg-[#161F1A]" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded-md bg-[#161F1A]" />
      </div>
      <div className="flex flex-wrap gap-2 border-b border-[#1F2E26] pb-3">
        {[1, 2, 3, 4, 5].map((n) => (
          <div
            key={n}
            className="h-10 w-36 animate-pulse rounded-lg border border-[#1F2E26] bg-[#111814]"
          />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="h-80 animate-pulse rounded-xl border border-[#1F2E26] bg-[#111814] lg:col-span-4" />
        <div className="h-80 animate-pulse rounded-xl border border-[#1F2E26] bg-[#111814] lg:col-span-8" />
      </div>
    </div>
  );
}

export default function AdminElectionsPage() {
  return (
    <Suspense fallback={<AdminElectionsSkeleton />}>
      <AdminElectionsContent />
    </Suspense>
  );
}
