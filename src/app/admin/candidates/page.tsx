import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CandidatesClient from "@/components/admin/CandidatesClient";

async function AdminCandidatesContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin/candidates");
  }

  if (user.app_metadata?.role !== "admin") {
    redirect("/dashboard");
  }

  const [candidatesRes, electionsRes, regionsRes, partiesRes, symbolsRes] =
    await Promise.all([
      supabase
        .from("candidate")
        .select(
          "*, political_party(*), election_symbol(*), region(*), election(*)"
        )
        .order("candidate_id", { ascending: false }),
      supabase
        .from("election")
        .select("*")
        .order("election_id", { ascending: false }),
      supabase
        .from("region")
        .select("*")
        .order("region_name", { ascending: true }),
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
    candidatesRes.error ??
    electionsRes.error ??
    regionsRes.error ??
    partiesRes.error ??
    symbolsRes.error;

  return (
    <CandidatesClient
      initialCandidates={candidatesRes.data ?? []}
      elections={electionsRes.data ?? []}
      regions={regionsRes.data ?? []}
      parties={partiesRes.data ?? []}
      symbols={symbolsRes.data ?? []}
      loadError={firstError?.message ?? null}
    />
  );
}

function AdminCandidatesSkeleton() {
  return (
    <div
      aria-label="Loading candidates management"
      className="mx-auto flex w-full max-w-6xl flex-col gap-6"
    >
      <div className="space-y-3">
        <div className="h-6 w-36 animate-pulse rounded-full bg-[#161F1A]" />
        <div className="h-8 w-64 animate-pulse rounded-md bg-[#161F1A]" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded-md bg-[#161F1A]" />
      </div>
      <div className="h-64 animate-pulse rounded-xl border border-[#1F2E26] bg-[#111814]" />
      <div className="h-80 animate-pulse rounded-xl border border-[#1F2E26] bg-[#111814]" />
    </div>
  );
}

export default function AdminCandidatesPage() {
  return (
    <Suspense fallback={<AdminCandidatesSkeleton />}>
      <AdminCandidatesContent />
    </Suspense>
  );
}
