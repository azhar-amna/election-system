import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Lock,
  Shield,
  ShieldCheck,
  UserCheck,
} from "lucide-react";

export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-12 px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
      {/* Hero Section */}
      <section className="ems-card relative overflow-hidden p-8 sm:p-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-[#10B981]/10 blur-3xl"
        />

        <div className="relative max-w-3xl">
          <span className="ems-badge-emerald inline-flex items-center gap-2 rounded-full px-3 py-1 font-mono text-xs font-semibold tracking-wider uppercase">
            <span className="h-2 w-2 rounded-full bg-[#22C55E]" />
            Civic Digital Voting Infrastructure
          </span>

          <h1 className="mt-5 text-3xl font-bold tracking-tight text-[#F3F4F6] sm:text-5xl">
            Transparent Elections.{" "}
            <span className="text-[#10B981]">Encrypted Ballots.</span>
          </h1>

          <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#9CA3AF] sm:text-lg">
            Verify voter identity through CNIC onboarding and administrative
            approval, cast immutable single-use encrypted ballots, and monitor
            polling station tallies in real time.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/results"
              className="inline-flex items-center gap-2 rounded-lg bg-[#10B981] px-5 py-3 text-sm font-semibold text-[#090D0B] transition-colors hover:bg-[#22C55E]"
            >
              <BarChart3 className="h-4 w-4" aria-hidden="true" />
              <span>View Live Results</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>

            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-lg border border-[#1F2E26] bg-[#161F1A] px-5 py-3 text-sm font-medium text-[#F3F4F6] transition-colors hover:border-[#10B981]/50 hover:text-[#22C55E]"
            >
              <UserCheck className="h-4 w-4" aria-hidden="true" />
              <span>Voter Dashboard</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Core Pillars */}
      <section aria-label="System Capabilities" className="grid gap-6 md:grid-cols-3">
        <div className="ems-card flex flex-col justify-between p-6 transition-colors hover:border-[#10B981]/40">
          <div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#10B981]/30 bg-[#052E16] text-[#22C55E]">
              <Lock className="h-5 w-5" aria-hidden="true" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-[#F3F4F6]">
              Secret &amp; Immutable Ballots
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#9CA3AF]">
              Ballots are encrypted server-side without linking voter identities
              to candidate selections, guaranteeing strict ballot secrecy and
              one-time voting enforcement.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-[#10B981] hover:text-[#22C55E]"
          >
            <span>Enter Voter Portal</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="ems-card flex flex-col justify-between p-6 transition-colors hover:border-[#10B981]/40">
          <div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#10B981]/30 bg-[#052E16] text-[#22C55E]">
              <BarChart3 className="h-5 w-5" aria-hidden="true" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-[#F3F4F6]">
              Real-Time Public Tally
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#9CA3AF]">
              Public election scoreboards stream live vote counts across regions
              and polling stations with zero authentication required for public
              observers.
            </p>
          </div>
          <Link
            href="/results"
            className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-[#10B981] hover:text-[#22C55E]"
          >
            <span>Open Live Results</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="ems-card flex flex-col justify-between p-6 transition-colors hover:border-[#10B981]/40">
          <div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#10B981]/30 bg-[#052E16] text-[#22C55E]">
              <Shield className="h-5 w-5" aria-hidden="true" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-[#F3F4F6]">
              Verified Administration
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#9CA3AF]">
              Provisioned administrators verify voter CNIC registrations,
              manage elections, regions, polling stations, symbols, and
              candidate rosters.
            </p>
          </div>
          <Link
            href="/admin"
            className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-[#10B981] hover:text-[#22C55E]"
          >
            <span>Admin Console</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

      {/* Integrity Notice */}
      <section className="flex flex-col items-start justify-between gap-4 rounded-xl border border-[#1F2E26] bg-[#111814] p-6 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <ShieldCheck
            className="mt-0.5 h-5 w-5 shrink-0 text-[#10B981]"
            aria-hidden="true"
          />
          <div>
            <h3 className="text-sm font-semibold text-[#F3F4F6]">
              Strict Role &amp; Database Security Enforced
            </h3>
            <p className="mt-1 text-xs text-[#9CA3AF]">
              Row-Level Security, CNIC voter approval gates, and atomic RPC
              ballot casting protect every phase of the election lifecycle.
            </p>
          </div>
        </div>
        <span className="shrink-0 rounded-md border border-[#10B981]/30 bg-[#052E16] px-3 py-1 font-mono text-xs text-[#22C55E]">
          PHASE 1 READY
        </span>
      </section>
    </div>
  );
}
