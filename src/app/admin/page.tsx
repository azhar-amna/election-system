import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  Flag,
  Image as ImageIcon,
  MapPin,
  Radio,
  Shield,
  SlidersHorizontal,
  UserCheck,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { ElectionStatus } from "@/types/database";

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(parsed);
}

function StatusBadge({ status }: { status: ElectionStatus }) {
  if (status === "ACTIVE") {
    return (
      <span className="ems-badge-emerald inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold tracking-wider uppercase">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#22C55E]" />
        Active
      </span>
    );
  }
  if (status === "CLOSED") {
    return (
      <span className="ems-badge-danger inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold tracking-wider uppercase">
        Closed
      </span>
    );
  }
  return (
    <span className="ems-badge-warning inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold tracking-wider uppercase">
      Draft
    </span>
  );
}

async function AdminOverviewContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin");
  }

  if (user.app_metadata?.role !== "admin") {
    redirect("/dashboard");
  }

  const [
    pendingVotersRes,
    approvedVotersRes,
    candidatesRes,
    activeElectionRes,
    recentElectionsRes,
    regionsRes,
    stationsRes,
    partiesRes,
    symbolsRes,
  ] = await Promise.all([
    supabase
      .from("voter")
      .select("*", { count: "exact", head: true })
      .eq("approval_status", "PENDING"),
    supabase
      .from("voter")
      .select("*", { count: "exact", head: true })
      .eq("approval_status", "APPROVED"),
    supabase.from("candidate").select("*", { count: "exact", head: true }),
    supabase
      .from("election")
      .select("*")
      .eq("status", "ACTIVE")
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("election")
      .select("*")
      .order("election_id", { ascending: false })
      .limit(5),
    supabase.from("region").select("*", { count: "exact", head: true }),
    supabase
      .from("polling_station")
      .select("*", { count: "exact", head: true }),
    supabase
      .from("political_party")
      .select("*", { count: "exact", head: true }),
    supabase
      .from("election_symbol")
      .select("*", { count: "exact", head: true }),
  ]);

  const queryErrors = [
    pendingVotersRes.error,
    approvedVotersRes.error,
    candidatesRes.error,
    activeElectionRes.error,
    recentElectionsRes.error,
  ].filter(Boolean);

  const pendingVoters = pendingVotersRes.count ?? 0;
  const approvedVoters = approvedVotersRes.count ?? 0;
  const totalCandidates = candidatesRes.count ?? 0;
  const activeElection = activeElectionRes.data ?? null;
  const recentElections = recentElectionsRes.data ?? [];

  const setupStats = [
    { label: "Regions", count: regionsRes.count ?? 0, icon: MapPin },
    {
      label: "Polling Stations",
      count: stationsRes.count ?? 0,
      icon: Building2,
    },
    { label: "Political Parties", count: partiesRes.count ?? 0, icon: Flag },
    {
      label: "Election Symbols",
      count: symbolsRes.count ?? 0,
      icon: ImageIcon,
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="ems-badge-emerald inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[11px] font-semibold tracking-wider uppercase">
            <Shield className="h-3.5 w-3.5" aria-hidden="true" />
            Executive Overview
          </span>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-[#F3F4F6] sm:text-3xl">
            Admin Command Center
          </h1>
          <p className="mt-1 text-sm text-[#9CA3AF]">
            Monitor voter verification queues, configure elections and
            constituencies, and manage candidate rosters.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/admin/elections"
            className="inline-flex items-center gap-2 rounded-lg bg-[#10B981] px-4 py-2.5 text-sm font-semibold text-[#090D0B] transition-colors hover:bg-[#22C55E]"
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            <span>Elections &amp; Setup</span>
          </Link>
          <Link
            href="/admin/candidates"
            className="inline-flex items-center gap-2 rounded-lg border border-[#1F2E26] bg-[#111814] px-4 py-2.5 text-sm font-medium text-[#F3F4F6] transition-colors hover:border-[#10B981]/50 hover:text-[#22C55E]"
          >
            <Users className="h-4 w-4" aria-hidden="true" />
            <span>Candidates</span>
          </Link>
        </div>
      </div>

      {/* Query Error Banner (if any) */}
      {queryErrors.length > 0 && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-[#EF4444]/40 bg-[#2A0D10] p-4 text-sm text-[#EF4444]"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Some metrics could not be loaded: {queryErrors[0]?.message}
          </span>
        </div>
      )}

      {/* 4 Required KPI Summary Cards */}
      <section
        aria-label="Key Election Metrics"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {/* KPI 1: Pending Voters */}
        <Link
          href="/admin/voters"
          className="ems-card group flex flex-col justify-between p-5 transition-colors hover:border-[#F59E0B]/50"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium tracking-wider text-[#9CA3AF] uppercase">
              Pending Voters
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#F59E0B]/35 bg-[#291C06] text-[#F59E0B]">
              <Clock className="h-4 w-4" aria-hidden="true" />
            </span>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <p className="font-mono text-3xl font-bold text-[#F3F4F6]">
              {pendingVoters}
            </p>
            <span className="text-xs font-medium text-[#F59E0B] group-hover:underline">
              Review Queue &rarr;
            </span>
          </div>
        </Link>

        {/* KPI 2: Approved Voters */}
        <Link
          href="/admin/voters"
          className="ems-card group flex flex-col justify-between p-5 transition-colors hover:border-[#10B981]/50"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium tracking-wider text-[#9CA3AF] uppercase">
              Approved Voters
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#10B981]/35 bg-[#052E16] text-[#22C55E]">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            </span>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <p className="font-mono text-3xl font-bold text-[#22C55E]">
              {approvedVoters}
            </p>
            <span className="text-xs font-medium text-[#10B981] group-hover:underline">
              Verified &rarr;
            </span>
          </div>
        </Link>

        {/* KPI 3: Total Candidates */}
        <Link
          href="/admin/candidates"
          className="ems-card group flex flex-col justify-between p-5 transition-colors hover:border-[#10B981]/50"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium tracking-wider text-[#9CA3AF] uppercase">
              Total Candidates
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#10B981]/35 bg-[#052E16] text-[#10B981]">
              <Users className="h-4 w-4" aria-hidden="true" />
            </span>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <p className="font-mono text-3xl font-bold text-[#F3F4F6]">
              {totalCandidates}
            </p>
            <span className="text-xs font-medium text-[#10B981] group-hover:underline">
              Manage Roster &rarr;
            </span>
          </div>
        </Link>

        {/* KPI 4: Active Election */}
        <Link
          href="/admin/elections"
          className={`ems-card group flex flex-col justify-between p-5 transition-colors ${
            activeElection
              ? "border-[#10B981]/45 bg-[#052E16]/35 hover:border-[#22C55E]"
              : "hover:border-[#10B981]/40"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium tracking-wider text-[#9CA3AF] uppercase">
              Active Election
            </span>
            <span
              className={`flex h-9 w-9 items-center justify-center rounded-lg border ${
                activeElection
                  ? "border-[#22C55E]/40 bg-[#052E16] text-[#22C55E]"
                  : "border-[#1F2E26] bg-[#161F1A] text-[#9CA3AF]"
              }`}
            >
              <Radio className="h-4 w-4" aria-hidden="true" />
            </span>
          </div>
          <div className="mt-4">
            {activeElection ? (
              <>
                <p
                  className="truncate text-base font-semibold text-[#F3F4F6]"
                  title={activeElection.title}
                >
                  {activeElection.title}
                </p>
                <p className="mt-1 font-mono text-[11px] text-[#22C55E]">
                  LIVE &bull; Ends {formatDate(activeElection.end_date)}
                </p>
              </>
            ) : (
              <>
                <p className="text-base font-semibold text-[#9CA3AF]">
                  None Active
                </p>
                <p className="mt-1 text-xs text-[#10B981] group-hover:underline">
                  Activate an election &rarr;
                </p>
              </>
            )}
          </div>
        </Link>
      </section>

      {/* Infrastructure Setup Summary + Recent Elections */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Infrastructure Counts */}
        <section
          aria-label="Election Infrastructure Summary"
          className="ems-card flex flex-col justify-between p-6 lg:col-span-2"
        >
          <div>
            <h2 className="text-base font-semibold text-[#F3F4F6]">
              Electoral Infrastructure
            </h2>
            <p className="mt-1 text-xs text-[#9CA3AF]">
              Core lookup entities configured in PostgreSQL.
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3">
              {setupStats.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div
                    key={stat.label}
                    className="rounded-lg border border-[#1F2E26] bg-[#090D0B] p-3.5"
                  >
                    <div className="flex items-center justify-between">
                      <Icon
                        className="h-4 w-4 text-[#10B981]"
                        aria-hidden="true"
                      />
                      <span className="font-mono text-xl font-bold text-[#F3F4F6]">
                        {stat.count}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-[#9CA3AF]">{stat.label}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <Link
            href="/admin/elections"
            className="mt-6 inline-flex items-center justify-between rounded-lg border border-[#1F2E26] bg-[#161F1A] px-4 py-2.5 text-sm font-medium text-[#F3F4F6] transition-colors hover:border-[#10B981]/50 hover:text-[#22C55E]"
          >
            <span>Configure Setup Entities</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </section>

        {/* Recent Elections */}
        <section
          aria-label="Elections Registry"
          className="ems-card flex flex-col justify-between p-6 lg:col-span-3"
        >
          <div>
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-[#F3F4F6]">
                  Recent Elections
                </h2>
                <p className="mt-1 text-xs text-[#9CA3AF]">
                  Latest election cycles and current lifecycle states.
                </p>
              </div>
              <Link
                href="/admin/elections"
                className="text-xs font-medium text-[#10B981] hover:text-[#22C55E]"
              >
                Manage All &rarr;
              </Link>
            </div>

            {recentElections.length === 0 ? (
              <div className="mt-6 rounded-lg border border-dashed border-[#1F2E26] bg-[#090D0B]/60 p-8 text-center">
                <p className="text-sm font-medium text-[#F3F4F6]">
                  No elections configured yet
                </p>
                <p className="mt-1 text-xs text-[#9CA3AF]">
                  Create your first election in Elections &amp; Setup to begin
                  assigning candidates.
                </p>
                <Link
                  href="/admin/elections"
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#10B981] px-4 py-2 text-xs font-semibold text-[#090D0B] hover:bg-[#22C55E]"
                >
                  <span>Create Election</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
            ) : (
              <div className="mt-5 divide-y divide-[#1F2E26] rounded-lg border border-[#1F2E26] bg-[#090D0B]/70">
                {recentElections.map((election) => (
                  <div
                    key={election.election_id}
                    className="flex flex-col justify-between gap-2 px-4 py-3.5 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#F3F4F6]">
                        {election.title}
                      </p>
                      <p className="mt-0.5 font-mono text-xs text-[#9CA3AF]">
                        {formatDate(election.start_date)} &rarr;{" "}
                        {formatDate(election.end_date)}
                      </p>
                    </div>
                    <div className="shrink-0">
                      <StatusBadge status={election.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-2.5 border-t border-[#1F2E26] pt-4">
            <Link
              href="/admin/voters"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#1F2E26] bg-[#161F1A] px-3.5 py-2 text-xs font-medium text-[#F3F4F6] transition-colors hover:border-[#10B981]/50 hover:text-[#22C55E]"
            >
              <UserCheck className="h-3.5 w-3.5 text-[#10B981]" aria-hidden="true" />
              <span>Voter Approvals</span>
            </Link>
            <Link
              href="/admin/candidates"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#1F2E26] bg-[#161F1A] px-3.5 py-2 text-xs font-medium text-[#F3F4F6] transition-colors hover:border-[#10B981]/50 hover:text-[#22C55E]"
            >
              <Users className="h-3.5 w-3.5 text-[#10B981]" aria-hidden="true" />
              <span>Manage Candidates</span>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

function AdminOverviewSkeleton() {
  return (
    <div
      aria-label="Loading admin overview"
      className="mx-auto flex w-full max-w-6xl flex-col gap-8"
    >
      <div className="space-y-3">
        <div className="h-6 w-36 animate-pulse rounded-full bg-[#161F1A]" />
        <div className="h-8 w-64 animate-pulse rounded-md bg-[#161F1A]" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded-md bg-[#161F1A]" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((n) => (
          <div
            key={n}
            className="h-32 animate-pulse rounded-xl border border-[#1F2E26] bg-[#111814]"
          />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="h-72 animate-pulse rounded-xl border border-[#1F2E26] bg-[#111814] lg:col-span-2" />
        <div className="h-72 animate-pulse rounded-xl border border-[#1F2E26] bg-[#111814] lg:col-span-3" />
      </div>
    </div>
  );
}

export default function AdminOverviewPage() {
  return (
    <Suspense fallback={<AdminOverviewSkeleton />}>
      <AdminOverviewContent />
    </Suspense>
  );
}
