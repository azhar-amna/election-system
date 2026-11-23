import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertCircle, ArrowLeft, ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import VoterDashboardClient from "@/components/dashboard/VoterDashboardClient";

async function DashboardContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard");
  }

  if (user.app_metadata?.role === "admin") {
    redirect("/admin");
  }

  const [voterResult, regionsResult, activeElectionResult] = await Promise.all([
    supabase
      .from("voter")
      .select("*, region(*)")
      .eq("auth_user_id", user.id)
      .maybeSingle(),
    supabase
      .from("region")
      .select("*")
      .order("region_name", { ascending: true }),
    supabase
      .from("election")
      .select("election_id, title, start_date, end_date, status")
      .eq("status", "ACTIVE")
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (voterResult.error) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-12 sm:px-6">
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
                Unable to Load Voter Profile
              </h1>
              <p className="text-sm text-[#EF4444]">
                {voterResult.error.message}
              </p>
              <Link
                href="/"
                className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-[#10B981] hover:text-[#22C55E]"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                <span>Return Home</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!voterResult.data) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-12 sm:px-6">
        <div className="ems-card p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-[#F59E0B]/40 bg-[#291C06] text-[#F59E0B]">
            <ShieldAlert className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="mt-4 text-xl font-semibold text-[#F3F4F6]">
            Voter Record Not Found
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-[#9CA3AF]">
            Your authenticated account ({user.email}) does not have an
            associated row in the voter registry yet. Please contact an election
            administrator if this persists.
          </p>
          <div className="mt-6 flex justify-center">
            <Link
              href="/results"
              className="inline-flex items-center gap-2 rounded-lg border border-[#1F2E26] bg-[#161F1A] px-4 py-2.5 text-sm font-medium text-[#F3F4F6] transition-colors hover:border-[#10B981]/50 hover:text-[#22C55E]"
            >
              <span>View Public Live Results</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <VoterDashboardClient
      initialVoter={voterResult.data}
      regions={regionsResult.data ?? []}
      activeElection={activeElectionResult.data ?? null}
      regionsError={regionsResult.error?.message ?? null}
    />
  );
}

function DashboardSkeleton() {
  return (
    <div
      aria-label="Loading voter dashboard"
      className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8 lg:py-10"
    >
      {/* Header Skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-3">
          <div className="h-6 w-28 animate-pulse rounded-full bg-[#161F1A]" />
          <div className="h-8 w-56 animate-pulse rounded-md bg-[#161F1A]" />
          <div className="h-4 w-80 max-w-full animate-pulse rounded-md bg-[#161F1A]" />
        </div>
        <div className="flex gap-2.5">
          <div className="h-9 w-44 animate-pulse rounded-lg border border-[#1F2E26] bg-[#111814]" />
          <div className="h-9 w-28 animate-pulse rounded-lg border border-[#1F2E26] bg-[#111814]" />
        </div>
      </div>

      {/* Status Card Skeleton */}
      <div className="h-36 w-full animate-pulse rounded-xl border border-[#1F2E26] bg-[#111814]" />

      {/* Stepper Skeleton */}
      <div className="ems-card grid gap-3 p-4 sm:grid-cols-3">
        <div className="h-14 animate-pulse rounded-lg bg-[#161F1A]" />
        <div className="h-14 animate-pulse rounded-lg bg-[#161F1A]" />
        <div className="h-14 animate-pulse rounded-lg bg-[#161F1A]" />
      </div>

      {/* Form / Details Skeleton */}
      <div className="ems-card space-y-5 p-6 sm:p-8">
        <div className="space-y-2 border-b border-[#1F2E26] pb-5">
          <div className="h-6 w-52 animate-pulse rounded-md bg-[#161F1A]" />
          <div className="h-4 w-96 max-w-full animate-pulse rounded-md bg-[#161F1A]" />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="h-11 animate-pulse rounded-lg bg-[#161F1A] sm:col-span-2" />
          <div className="h-11 animate-pulse rounded-lg bg-[#161F1A]" />
          <div className="h-11 animate-pulse rounded-lg bg-[#161F1A]" />
          <div className="h-11 animate-pulse rounded-lg bg-[#161F1A]" />
          <div className="h-11 animate-pulse rounded-lg bg-[#161F1A]" />
          <div className="h-11 animate-pulse rounded-lg bg-[#161F1A]" />
          <div className="h-11 animate-pulse rounded-lg bg-[#161F1A]" />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}
