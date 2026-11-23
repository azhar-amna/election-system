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
import BallotClient from "@/components/ballot/BallotClient";

async function BallotContent() {
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

  const [voterRes, activeElectionRes] = await Promise.all([
    supabase
      .from("voter")
      .select("*, region(*)")
      .eq("auth_user_id", user.id)
      .maybeSingle(),
    supabase
      .from("election")
      .select("*")
      .eq("status", "ACTIVE")
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (voterRes.error || activeElectionRes.error) {
    const errMsg =
      voterRes.error?.message ??
      activeElectionRes.error?.message ??
      "Failed to load ballot eligibility.";
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
  const activeElection = activeElectionRes.data;

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

          <span
            className={`mt-5 inline-flex rounded-full px-3 py-1 font-mono text-[11px] font-semibold tracking-wider uppercase ${
              isRejected ? "ems-badge-danger" : "ems-badge-warning"
            }`}
          >
            {isRejected
              ? "Registration Rejected"
              : isIncomplete
                ? "Profile Incomplete"
                : "Pending Admin Approval"}
          </span>

          <h1 className="mt-4 text-2xl font-bold text-[#F3F4F6]">
            Voting Ballot Locked
          </h1>

          <p className="mx-auto mt-2.5 max-w-md text-sm leading-relaxed text-[#9CA3AF]">
            {isRejected
              ? "Your voter registration was rejected by an administrator. Update and resubmit your profile from your dashboard to regain eligibility."
              : isIncomplete
                ? "You must complete your voter profile and receive administrative approval before entering the voting booth."
                : "Your profile has been submitted and is currently awaiting administrative verification. Ballot access will unlock automatically once approved."}
          </p>

          {isRejected && voter?.rejection_reason && (
            <div className="mx-auto mt-5 max-w-md rounded-lg border border-[#EF4444]/35 bg-[#2A0D10]/70 p-3.5 text-left">
              <p className="font-mono text-[10px] font-semibold tracking-wider text-[#EF4444] uppercase">
                Rejection Reason
              </p>
              <p className="mt-1 text-sm text-[#F3F4F6]">
                {voter.rejection_reason}
              </p>
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-lg bg-[#10B981] px-5 py-2.5 text-sm font-semibold text-[#090D0B] transition-colors hover:bg-[#22C55E]"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span>Go to Voter Dashboard</span>
            </Link>
            <Link
              href="/results"
              className="inline-flex items-center gap-2 rounded-lg border border-[#1F2E26] bg-[#161F1A] px-5 py-2.5 text-sm font-medium text-[#F3F4F6] transition-colors hover:border-[#10B981]/50 hover:text-[#22C55E]"
            >
              <BarChart3 className="h-4 w-4" aria-hidden="true" />
              <span>View Live Results</span>
            </Link>
          </div>
        </section>
      </div>
    );
  }

  // Gate 2: An ACTIVE election must exist
  if (!activeElection) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-14 sm:px-6">
        <section
          aria-label="No Active Election"
          className="ems-card p-8 text-center sm:p-10"
        >
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[#1F2E26] bg-[#161F1A] text-[#10B981]">
            <Clock className="h-7 w-7" aria-hidden="true" />
          </div>

          <span className="ems-badge-warning mt-5 inline-flex rounded-full px-3 py-1 font-mono text-[11px] font-semibold tracking-wider uppercase">
            Polls Currently Closed
          </span>

          <h1 className="mt-4 text-2xl font-bold text-[#F3F4F6]">
            No Active Election Right Now
          </h1>

          <p className="mx-auto mt-2.5 max-w-md text-sm leading-relaxed text-[#9CA3AF]">
            Your voter registration is verified and approved, but there is no
            election currently in{" "}
            <code className="font-mono text-[#10B981]">ACTIVE</code> status.
            Check back once polls open or view public election results.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/results"
              className="inline-flex items-center gap-2 rounded-lg bg-[#10B981] px-5 py-2.5 text-sm font-semibold text-[#090D0B] transition-colors hover:bg-[#22C55E]"
            >
              <BarChart3 className="h-4 w-4" aria-hidden="true" />
              <span>View Election Results</span>
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-lg border border-[#1F2E26] bg-[#161F1A] px-5 py-2.5 text-sm font-medium text-[#F3F4F6] transition-colors hover:border-[#10B981]/50 hover:text-[#22C55E]"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span>Back to Dashboard</span>
            </Link>
          </div>
        </section>
      </div>
    );
  }

  // Load candidates for the ACTIVE election + polling stations
  const [candidatesRes, stationsRes] = await Promise.all([
    supabase
      .from("candidate")
      .select(
        "*, political_party(*), election_symbol(*), region(*), election(*)"
      )
      .eq("election_id", activeElection.election_id)
      .order("candidate_id", { ascending: true }),
    supabase
      .from("polling_station")
      .select("*, region(*)")
      .order("name", { ascending: true }),
  ]);

  if (candidatesRes.error || stationsRes.error) {
    const errMsg =
      candidatesRes.error?.message ??
      stationsRes.error?.message ??
      "Unable to load candidates or polling stations.";
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
      activeElection={activeElection}
      candidates={candidatesRes.data ?? []}
      pollingStations={stationsRes.data ?? []}
    />
  );
}

function BallotSkeleton() {
  return (
    <div
      aria-label="Loading voting ballot"
      className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8 lg:py-10"
    >
      <div className="h-32 animate-pulse rounded-xl border border-[#1F2E26] bg-[#111814]" />
      <div className="h-24 animate-pulse rounded-xl border border-[#1F2E26] bg-[#111814]" />
      <div className="ems-card p-6">
        <div className="h-6 w-48 animate-pulse rounded-md bg-[#161F1A]" />
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={n}
              className="h-48 animate-pulse rounded-xl border border-[#1F2E26] bg-[#090D0B]"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function BallotPage() {
  return (
    <Suspense fallback={<BallotSkeleton />}>
      <BallotContent />
    </Suspense>
  );
}
