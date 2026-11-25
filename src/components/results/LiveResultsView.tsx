import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import LiveResultsClient from "@/components/results/LiveResultsClient";
import type { Election } from "@/types/database";

function pickDefaultElection(elections: Election[]): Election | null {
  const active = elections.find((e) => e.status === "ACTIVE");
  if (active) return active;

  const closed = elections.find((e) => e.status === "CLOSED");
  if (closed) return closed;

  return elections[0] ?? null;
}

async function fetchInitialElectionData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  electionId: number
) {
  const [candidatesRes, resultsRes] = await Promise.all([
    supabase
      .from("candidate")
      .select(
        "*, political_party(*), election_symbol(*), region(*), election(*)"
      )
      .eq("election_id", electionId)
      .order("candidate_id", { ascending: true }),
    supabase.from("result").select("*").eq("election_id", electionId),
  ]);

  return {
    candidates: candidatesRes.data ?? [],
    results: resultsRes.data ?? [],
    error: candidatesRes.error?.message ?? resultsRes.error?.message ?? null,
  };
}

async function ResultsContent() {
  const supabase = await createClient();

  const [electionsRes, regionsRes, stationsRes] = await Promise.all([
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
      .select("*")
      .order("name", { ascending: true }),
  ]);

  const elections = electionsRes.data ?? [];
  const defaultElection = pickDefaultElection(elections);

  let initialCandidates = [] as Awaited<
    ReturnType<typeof fetchInitialElectionData>
  >["candidates"];
  let initialResults = [] as Awaited<
    ReturnType<typeof fetchInitialElectionData>
  >["results"];
  let detailError: string | null = null;

  if (defaultElection) {
    const detail = await fetchInitialElectionData(
      supabase,
      defaultElection.election_id
    );
    initialCandidates = detail.candidates;
    initialResults = detail.results;
    detailError = detail.error;
  }

  const firstError =
    electionsRes.error?.message ??
    regionsRes.error?.message ??
    stationsRes.error?.message ??
    detailError;

  return (
    <LiveResultsClient
      elections={elections}
      initialElectionId={defaultElection?.election_id ?? null}
      initialCandidates={initialCandidates}
      initialResults={initialResults}
      regions={regionsRes.data ?? []}
      stations={stationsRes.data ?? []}
      loadError={firstError}
    />
  );
}

function ResultsSkeleton() {
  return (
    <div
      aria-label="Loading live election results"
      className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-8 sm:px-6"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="h-7 w-56 animate-pulse rounded bg-[#161F1A]" />
        <div className="h-8 w-20 animate-pulse rounded-lg border border-[#1F2E26] bg-[#111814]" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className="h-10 animate-pulse rounded-lg border border-[#1F2E26] bg-[#111814]"
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className="h-20 animate-pulse rounded-lg border border-[#1F2E26] bg-[#111814]"
          />
        ))}
      </div>
      <div className="ems-card space-y-3 p-4">
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className="h-20 animate-pulse rounded-lg bg-[#090D0B]"
          />
        ))}
      </div>
    </div>
  );
}

export default function LiveResultsView() {
  return (
    <Suspense fallback={<ResultsSkeleton />}>
      <ResultsContent />
    </Suspense>
  );
}
