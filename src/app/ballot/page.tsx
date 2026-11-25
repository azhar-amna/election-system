import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  Clock,
  Lock,
  ShieldAlert,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { parsePositiveInt, sanitizePublicError } from "@/lib/validation";
import BallotClient from "@/components/ballot/BallotClient";

interface BallotPageProps {
  searchParams: Promise<{ election?: string | string[] }>;
}

async function BallotContent({ searchParams }: BallotPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/ballot");
  }

  if (user.app_metadata?.role === "admin") {
    redirect("/admin");
  }

  const [resolvedParams, voterRes, activeElectionsRes, votedElectionsRes] =
    await Promise.all([
      searchParams,
      supabase
        .from("voter")
        .select("*, region(*)")
        .eq("auth_user_id", user.id)
        .maybeSingle(),
      supabase
        .from("election")
        .select("*")
        .eq("status", "ACTIVE")
        .order("start_date", { ascending: false }),
      supabase.rpc("get_my_voted_elections"),
    ]);

  if (voterRes.error || activeElectionsRes.error) {
    const errMsg = sanitizePublicError(
      voterRes.error ?? activeElectionsRes.error,
      "Failed to load ballot eligibility."
    );
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-12 sm:px-6">
        <div
          role="alert"
          className="rounded-xl border border-[#EF4444]/40 bg-[#2A0D10] p-6"
        >
          <div className="flex items-start gap-3">
            <AlertCircle
              className="mt-0.5 h-5 w-5 shrink-0 text-[#EF4444]"
              aria-hidden="true"
            />
            <div className="space-y-2">
              <h1 className="text-lg font-semibold text-[#F3F4F6]">
                Unable to Open Voting Booth
              </h1>
              <p className="text-sm text-[#EF4444]">{errMsg}</p>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1.5 pt-2 text-sm font-medium text-[#10B981] hover:text-[#22C55E]"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                <span>Back to Voter Dashboard</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const voter = voterRes.data;
  const activeElections = activeElectionsRes.data ?? [];

  // Gate 1: Voter must exist, have completed profile, AND be APPROVED
  if (
    !voter ||
    voter.profile_completed !== true ||
    voter.approval_status !== "APPROVED"
  ) {
    const isRejected = voter?.approval_status === "REJECTED";
    const isIncomplete = !voter || !voter.profile_completed;

    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-14 sm:px-6">
        <section
          aria-label="Ballot Access Locked"
          className="ems-card p-8 text-center sm:p-10"
        >
          <div
            className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border ${
              isRejected
                ? "border-[#EF4444]/45 bg-[#2A0D10] text-[#EF4444]"
                : "border-[#F59E0B]/45 bg-[#291C06] text-[#F59E0B]"
            }`}
          >
            {isRejected ? (
              <ShieldAlert className="h-7 w-7" aria-hidden="true" />
            ) : (
              <Lock className="h-7 w-7" aria-hidden="true" />
            )}
          </div>

          <h1 className="mt-4 text-xl font-semibold text-[#F3F4F6]">
            Voting Ballot Locked
          </h1>

          <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-[#9CA3AF]">
            {isRejected
              ? "Your registration was rejected. Update and resubmit your profile from your dashboard."
              : isIncomplete
                ? "Complete your voter profile and wait for admin approval before voting."
                : "Your profile is awaiting admin approval."}
          </p>

          {isRejected && voter?.rejection_reason && (
            <div className="mx-auto mt-4 max-w-md rounded-lg border border-[#EF4444]/35 bg-[#2A0D10]/70 p-3 text-left text-xs text-[#F3F4F6]">
              {voter.rejection_reason}
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#10B981] px-4 py-2 text-xs font-semibold text-[#090D0B] hover:bg-[#22C55E]"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Dashboard</span>
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#1F2E26] bg-[#161F1A] px-4 py-2 text-xs font-medium text-[#F3F4F6] hover:border-[#10B981]/50"
            >
              <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Live Results</span>
            </Link>
          </div>
        </section>
      </div>
    );
  }

  // Gate 2: At least one ACTIVE election must exist
  if (activeElections.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-14 sm:px-6">
        <section
          aria-label="No Active Election"
          className="ems-card p-8 text-center sm:p-10"
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[#1F2E26] bg-[#161F1A] text-[#10B981]">
            <Clock className="h-6 w-6" aria-hidden="true" />
          </div>

          <h1 className="mt-4 text-xl font-semibold text-[#F3F4F6]">
            No Active Elections
          </h1>

          <p className="mx-auto mt-2 max-w-md text-xs text-[#9CA3AF]">
            There are no open elections right now.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#10B981] px-4 py-2 text-xs font-semibold text-[#090D0B] hover:bg-[#22C55E]"
            >
              <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Live Results</span>
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#1F2E26] bg-[#161F1A] px-4 py-2 text-xs font-medium text-[#F3F4F6] hover:border-[#10B981]/50"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Dashboard</span>
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const activeElectionIds = activeElections.map((e) => e.election_id);

  // Per-election voted IDs via RPC (falls back gracefully to [] if RPC is not yet created)
  const votedElectionIds: number[] =
    !votedElectionsRes.error && Array.isArray(votedElectionsRes.data)
      ? votedElectionsRes.data.filter(
          (id): id is number => typeof id === "number" && Number.isInteger(id)
        )
      : [];

  const requestedParam = Array.isArray(resolvedParams.election)
    ? resolvedParams.election[0]
    : resolvedParams.election;
  const requestedElectionId = parsePositiveInt(requestedParam);
  const initialSelectedElectionId =
    requestedElectionId !== null &&
    activeElectionIds.includes(requestedElectionId)
      ? requestedElectionId
      : null;

  // Load candidates for all ACTIVE elections + polling stations
  const [candidatesRes, stationsRes] = await Promise.all([
    supabase
      .from("candidate")
      .select(
        "*, political_party(*), election_symbol(*), region(*), election(*)"
      )
      .in("election_id", activeElectionIds)
      .order("candidate_id", { ascending: true }),
    supabase
      .from("polling_station")
      .select("*, region(*)")
      .order("name", { ascending: true }),
  ]);

  if (candidatesRes.error || stationsRes.error) {
    const errMsg = sanitizePublicError(
      candidatesRes.error ?? stationsRes.error,
      "Unable to load candidates or polling stations."
    );
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-12 sm:px-6">
        <div
          role="alert"
          className="rounded-xl border border-[#EF4444]/40 bg-[#2A0D10] p-6 text-sm text-[#EF4444]"
        >
          {errMsg}
        </div>
      </div>
    );
  }

  return (
    <BallotClient
      voter={voter}
      activeElections={activeElections}
      initialVotedElectionIds={votedElectionIds}
      initialSelectedElectionId={initialSelectedElectionId}
      candidates={candidatesRes.data ?? []}
      pollingStations={stationsRes.data ?? []}
    />
  );
}

function BallotSkeleton() {
  return (
    <div
      aria-label="Loading voting ballot"
      className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-8 sm:px-6"
    >
      <div className="h-12 animate-pulse rounded-lg border border-[#1F2E26] bg-[#111814]" />
      <div className="ems-card p-5">
        <div className="h-5 w-40 animate-pulse rounded bg-[#161F1A]" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-24 animate-pulse rounded-lg border border-[#1F2E26] bg-[#090D0B]"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function BallotPage({ searchParams }: BallotPageProps) {
  return (
    <Suspense fallback={<BallotSkeleton />}>
      <BallotContent searchParams={searchParams} />
    </Suspense>
  );
}
