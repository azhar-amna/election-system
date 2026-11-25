import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertCircle } from "lucide-react";
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
  const cls =
    status === "ACTIVE"
      ? "ems-badge-emerald"
      : status === "CLOSED"
        ? "ems-badge-danger"
        : "ems-badge-warning";
  return (
    <span
      className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${cls}`}
    >
      {status}
    </span>
  );
}

async function AdminOverviewContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/admin");
  if (user.app_metadata?.role !== "admin") redirect("/dashboard");

  const [
    pendingVotersRes,
    approvedVotersRes,
    candidatesRes,
    activeElectionRes,
    recentElectionsRes,
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
      .limit(6),
  ]);

  const firstError =
    pendingVotersRes.error ??
    approvedVotersRes.error ??
    candidatesRes.error ??
    activeElectionRes.error ??
    recentElectionsRes.error;

  const pendingVoters = pendingVotersRes.count ?? 0;
  const approvedVoters = approvedVotersRes.count ?? 0;
  const totalCandidates = candidatesRes.count ?? 0;
  const activeElection = activeElectionRes.data ?? null;
  const recentElections = recentElectionsRes.data ?? [];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <h1 className="text-xl font-semibold tracking-tight text-[#F3F4F6]">
        Overview
      </h1>

      {firstError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-[#EF4444]/40 bg-[#2A0D10] p-3.5 text-xs text-[#EF4444]"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{firstError.message}</span>
        </div>
      )}

      {/* 4 KPI Summary Cards */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Link
          href="/admin/voters"
          className="ems-card p-4 transition-colors hover:border-[#F59E0B]/50"
        >
          <p className="text-xs text-[#9CA3AF]">Pending Voters</p>
          <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-[#F59E0B]">
            {pendingVoters}
          </p>
        </Link>

        <Link
          href="/admin/voters"
          className="ems-card p-4 transition-colors hover:border-[#10B981]/50"
        >
          <p className="text-xs text-[#9CA3AF]">Approved Voters</p>
          <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-[#22C55E]">
            {approvedVoters}
          </p>
        </Link>

        <Link
          href="/admin/candidates"
          className="ems-card p-4 transition-colors hover:border-[#10B981]/50"
        >
          <p className="text-xs text-[#9CA3AF]">Total Candidates</p>
          <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-[#F3F4F6]">
            {totalCandidates}
          </p>
        </Link>

        <Link
          href="/admin/elections"
          className="ems-card p-4 transition-colors hover:border-[#10B981]/50"
        >
          <p className="text-xs text-[#9CA3AF]">Active Election</p>
          <p
            className={`mt-2 truncate text-base font-semibold ${
              activeElection ? "text-[#22C55E]" : "text-[#6B7280]"
            }`}
            title={activeElection?.title ?? undefined}
          >
            {activeElection ? activeElection.title : "None"}
          </p>
        </Link>
      </section>

      {/* Elections Table */}
      <section className="ems-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#1F2E26] px-4 py-3">
          <h2 className="text-sm font-medium text-[#F3F4F6]">Elections</h2>
          <Link
            href="/admin/elections"
            className="text-xs text-[#10B981] hover:text-[#22C55E]"
          >
            Manage
          </Link>
        </div>

        {recentElections.length === 0 ? (
          <p className="p-6 text-center text-xs text-[#9CA3AF]">
            No elections yet.
          </p>
        ) : (
          <div className="divide-y divide-[#1F2E26]">
            {recentElections.map((election) => (
              <div
                key={election.election_id}
                className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-[#F3F4F6]">
                    {election.title}
                  </p>
                  <p className="font-mono text-xs text-[#6B7280]">
                    {formatDate(election.start_date)} —{" "}
                    {formatDate(election.end_date)}
                  </p>
                </div>
                <StatusBadge status={election.status} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function AdminOverviewSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="h-7 w-28 animate-pulse rounded bg-[#161F1A]" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((n) => (
          <div
            key={n}
            className="h-24 animate-pulse rounded-lg border border-[#1F2E26] bg-[#111814]"
          />
        ))}
      </div>
      <div className="h-48 animate-pulse rounded-lg border border-[#1F2E26] bg-[#111814]" />
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
