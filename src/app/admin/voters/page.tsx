import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import VotersClient from "@/components/admin/VotersClient";

async function AdminVotersContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin/voters");
  }

  if (user.app_metadata?.role !== "admin") {
    redirect("/dashboard");
  }

  const [votersRes, regionsRes] = await Promise.all([
    supabase
      .from("voter")
      .select("*, region(*)")
      .order("created_at", { ascending: false }),
    supabase
      .from("region")
      .select("*")
      .order("region_name", { ascending: true }),
  ]);

  const firstError = votersRes.error ?? regionsRes.error;

  return (
    <VotersClient
      adminUserId={user.id}
      initialVoters={votersRes.data ?? []}
      regions={regionsRes.data ?? []}
      loadError={firstError?.message ?? null}
    />
  );
}

function AdminVotersSkeleton() {
  return (
    <div
      aria-label="Loading voter approvals"
      className="mx-auto flex w-full max-w-6xl flex-col gap-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-3">
          <div className="h-6 w-44 animate-pulse rounded-full bg-[#161F1A]" />
          <div className="h-8 w-56 animate-pulse rounded-md bg-[#161F1A]" />
          <div className="h-4 w-96 max-w-full animate-pulse rounded-md bg-[#161F1A]" />
        </div>
        <div className="flex gap-2.5">
          <div className="h-10 w-24 animate-pulse rounded-lg border border-[#1F2E26] bg-[#111814]" />
          <div className="h-10 w-28 animate-pulse rounded-lg bg-[#052E16]" />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1F2E26] pb-4">
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="h-10 w-32 animate-pulse rounded-lg border border-[#1F2E26] bg-[#111814]"
            />
          ))}
        </div>
        <div className="h-10 w-72 animate-pulse rounded-lg border border-[#1F2E26] bg-[#111814]" />
      </div>

      <div className="h-96 animate-pulse rounded-xl border border-[#1F2E26] bg-[#111814]" />
    </div>
  );
}

export default function AdminVotersPage() {
  return (
    <Suspense fallback={<AdminVotersSkeleton />}>
      <AdminVotersContent />
    </Suspense>
  );
}
