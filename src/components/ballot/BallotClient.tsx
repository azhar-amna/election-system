"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Building2,
  Check,
  CheckCircle2,
  CreditCard,
  Image as ImageIcon,
  Loader2,
  Lock,
  MapPin,
  ShieldCheck,
  Vote,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type {
  CandidateWithRelations,
  Election,
  PollingStationWithRegion,
  VoterWithRegion,
} from "@/types/database";

interface BallotClientProps {
  voter: VoterWithRegion;
  activeElection: Election;
  candidates: CandidateWithRelations[];
  pollingStations: PollingStationWithRegion[];
}

function formatDisplayDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(parsed);
}

export default function BallotClient({
  voter,
  activeElection,
  candidates,
  pollingStations,
}: BallotClientProps) {
  const router = useRouter();

  const [hasVoted, setHasVoted] = useState<boolean>(voter.has_voted);
  const [recordedTimestamp, setRecordedTimestamp] = useState<string | null>(
    null
  );

  // Default polling station to the first station in the voter's assigned region
  const defaultStationId = useMemo(() => {
    const sameRegionStation = pollingStations.find(
      (s) => voter.region_id !== null && s.region_id === voter.region_id
    );
    if (sameRegionStation) return String(sameRegionStation.station_id);
    if (pollingStations[0]) return String(pollingStations[0].station_id);
    return "";
  }, [pollingStations, voter.region_id]);

  const [selectedStationId, setSelectedStationId] =
    useState<string>(defaultStationId);
  const [selectedCandidateId, setSelectedCandidateId] = useState<number | null>(
    null
  );
  const [regionScope, setRegionScope] = useState<"ALL" | "MY_REGION">("ALL");

  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [isCasting, setIsCasting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Escape key closes confirmation modal when not actively casting
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && confirmModalOpen && !isCasting) {
        setConfirmModalOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [confirmModalOpen, isCasting]);

  const myRegionStations = useMemo(
    () =>
      pollingStations.filter(
        (s) => voter.region_id !== null && s.region_id === voter.region_id
      ),
    [pollingStations, voter.region_id]
  );

  const otherRegionStations = useMemo(
    () =>
      pollingStations.filter(
        (s) => voter.region_id === null || s.region_id !== voter.region_id
      ),
    [pollingStations, voter.region_id]
  );

  const hasMyRegionCandidates = useMemo(
    () =>
      voter.region_id !== null &&
      candidates.some((c) => c.region_id === voter.region_id),
    [candidates, voter.region_id]
  );

  const displayedCandidates = useMemo(() => {
    const sorted = [...candidates].sort((a, b) => {
      const aMatch = voter.region_id !== null && a.region_id === voter.region_id;
      const bMatch = voter.region_id !== null && b.region_id === voter.region_id;
      if (aMatch && !bMatch) return -1;
      if (!aMatch && bMatch) return 1;
      return a.name.localeCompare(b.name);
    });

    if (regionScope === "MY_REGION" && voter.region_id !== null) {
      return sorted.filter((c) => c.region_id === voter.region_id);
    }

    return sorted;
  }, [candidates, regionScope, voter.region_id]);

  const selectedCandidate = useMemo(
    () =>
      candidates.find((c) => c.candidate_id === selectedCandidateId) ?? null,
    [candidates, selectedCandidateId]
  );

  const selectedStation = useMemo(
    () =>
      pollingStations.find((s) => String(s.station_id) === selectedStationId) ??
      null,
    [pollingStations, selectedStationId]
  );

  async function handleConfirmCastVote() {
    if (!selectedCandidate || !selectedStation) {
      setErrorMessage(
        "Please select both a polling station and a candidate before submitting."
      );
      return;
    }

    setErrorMessage(null);
    setIsCasting(true);

    try {
      const supabase = createClient();

      // Strictly cast ballot through the Postgres RPC — never insert into vote/result directly
      const { error } = await supabase.rpc("cast_vote", {
        p_election_id: activeElection.election_id,
        p_candidate_id: selectedCandidate.candidate_id,
        p_station_id: selectedStation.station_id,
      });

      if (error) {
        const lower = error.message.toLowerCase();
        if (
          error.code === "23505" ||
          lower.includes("already voted") ||
          lower.includes("already cast")
        ) {
          // Voter already voted in this active election — lock into confirmation card without revealing choice
          setSelectedCandidateId(null);
          setConfirmModalOpen(false);
          setHasVoted(true);
          router.refresh();
          return;
        }
        setErrorMessage(error.message);
        setConfirmModalOpen(false);
        return;
      }

      // Immediately clear candidate selection from client state for ballot secrecy
      setSelectedCandidateId(null);
      setConfirmModalOpen(false);
      setRecordedTimestamp(new Date().toISOString());
      setHasVoted(true);
      router.refresh();
    } catch {
      setErrorMessage(
        "Unable to submit your encrypted ballot right now. Please try again."
      );
      setConfirmModalOpen(false);
    } finally {
      setIsCasting(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Permanent "Encrypted Ballot Recorded" Receipt (Never Reveals Candidate Choice)
  // ---------------------------------------------------------------------------
  if (hasVoted) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-12 sm:px-6 lg:py-16">
        <section
          aria-label="Encrypted Ballot Confirmation"
          className="relative overflow-hidden rounded-2xl border border-[#10B981]/50 bg-[#111814] p-8 sm:p-10"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-20 -right-20 h-60 w-60 rounded-full bg-[#10B981]/12 blur-3xl"
          />

          <div className="relative flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#10B981]/50 bg-[#052E16] text-[#22C55E]">
              <CheckCircle2 className="h-9 w-9" aria-hidden="true" />
            </div>

            <span className="ems-badge-emerald mt-5 inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[11px] font-semibold tracking-wider uppercase">
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              Immutable One-Time Ballot
            </span>

            <h1 className="mt-4 text-2xl font-bold tracking-tight text-[#F3F4F6] sm:text-3xl">
              Encrypted Ballot Recorded
            </h1>

            <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#9CA3AF]">
              Your vote for{" "}
              <strong className="text-[#F3F4F6]">{activeElection.title}</strong>{" "}
              has been cryptographically encrypted and permanently sealed. To
              protect strict ballot secrecy, your candidate selection is never
              linked to your voter identity and cannot be retrieved, modified,
              or cast again.
            </p>

            {/* Secret Ballot Receipt Summary (strictly non-identifying of candidate) */}
            <dl className="mt-8 grid w-full gap-3 text-left sm:grid-cols-2">
              <div className="rounded-xl border border-[#1F2E26] bg-[#090D0B] p-4">
                <dt className="text-[11px] font-medium tracking-wider text-[#9CA3AF] uppercase">
                  Election
                </dt>
                <dd className="mt-1 text-sm font-semibold text-[#F3F4F6]">
                  {activeElection.title}
                </dd>
              </div>

              <div className="rounded-xl border border-[#1F2E26] bg-[#090D0B] p-4">
                <dt className="text-[11px] font-medium tracking-wider text-[#9CA3AF] uppercase">
                  Voter CNIC
                </dt>
                <dd className="mt-1 font-mono text-sm font-semibold text-[#22C55E]">
                  {voter.cnic}
                </dd>
              </div>

              <div className="rounded-xl border border-[#1F2E26] bg-[#090D0B] p-4">
                <dt className="text-[11px] font-medium tracking-wider text-[#9CA3AF] uppercase">
                  Ballot Privacy
                </dt>
                <dd className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-[#10B981]">
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  <span>Encrypted &amp; Anonymous</span>
                </dd>
              </div>

              <div className="rounded-xl border border-[#1F2E26] bg-[#090D0B] p-4">
                <dt className="text-[11px] font-medium tracking-wider text-[#9CA3AF] uppercase">
                  Participation Status
                </dt>
                <dd className="mt-1 font-mono text-xs font-semibold text-[#22C55E]">
                  {recordedTimestamp
                    ? `RECORDED • ${new Intl.DateTimeFormat("en-US", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(recordedTimestamp))}`
                    : "RECORDED • FINAL & IMMUTABLE"}
                </dd>
              </div>
            </dl>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/results"
                className="inline-flex items-center gap-2 rounded-lg bg-[#10B981] px-5 py-3 text-sm font-semibold text-[#090D0B] transition-colors hover:bg-[#22C55E]"
              >
                <BarChart3 className="h-4 w-4" aria-hidden="true" />
                <span>Watch Live Election Results</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-lg border border-[#1F2E26] bg-[#161F1A] px-5 py-3 text-sm font-medium text-[#F3F4F6] transition-colors hover:border-[#10B981]/50 hover:text-[#22C55E]"
              >
                <span>Return to Dashboard</span>
              </Link>
            </div>
          </div>
        </section>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Active Encrypted Voting Booth
  // ---------------------------------------------------------------------------
  const canOpenConfirm =
    Boolean(selectedStation) && Boolean(selectedCandidate) && !isCasting;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      {/* Election & Voter Header */}
      <section className="ems-card p-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="ems-badge-emerald inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[11px] font-semibold tracking-wider uppercase">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[#22C55E]" />
                Active Voting Booth
              </span>
              <span className="rounded-full border border-[#1F2E26] bg-[#090D0B] px-2.5 py-1 font-mono text-[11px] text-[#9CA3AF]">
                {formatDisplayDate(activeElection.start_date)} &rarr;{" "}
                {formatDisplayDate(activeElection.end_date)}
              </span>
            </div>

            <h1 className="mt-3 text-2xl font-bold tracking-tight text-[#F3F4F6] sm:text-3xl">
              {activeElection.title}
            </h1>
            <p className="mt-1 text-sm text-[#9CA3AF]">
              Select your polling station and one candidate below to cast your
              encrypted, anonymous ballot.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="rounded-lg border border-[#1F2E26] bg-[#090D0B] px-3.5 py-2">
              <p className="text-[10px] font-medium tracking-wider text-[#9CA3AF] uppercase">
                Verified CNIC
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 font-mono text-xs font-semibold text-[#22C55E]">
                <CreditCard className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{voter.cnic}</span>
              </p>
            </div>
            {voter.region && (
              <div className="rounded-lg border border-[#1F2E26] bg-[#090D0B] px-3.5 py-2">
                <p className="text-[10px] font-medium tracking-wider text-[#9CA3AF] uppercase">
                  Your Constituency
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-[#F3F4F6]">
                  <MapPin
                    className="h-3.5 w-3.5 text-[#10B981]"
                    aria-hidden="true"
                  />
                  <span>{voter.region.region_name}</span>
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Error Alert Banner */}
      {errorMessage && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-xl border border-[#EF4444]/40 bg-[#2A0D10] p-4 text-sm text-[#EF4444]"
        >
          <span className="inline-flex items-start gap-2.5">
            <AlertCircle
              className="mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
            />
            <span>{errorMessage}</span>
          </span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="cursor-pointer text-xs font-medium hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Step 1: Polling Station Selector */}
      <section aria-label="Step 1: Select Polling Station" className="ems-card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#10B981]/40 bg-[#052E16] font-mono text-xs font-bold text-[#22C55E]">
              1
            </span>
            <div>
              <h2 className="text-base font-semibold text-[#F3F4F6]">
                Select Polling Station
              </h2>
              <p className="mt-0.5 text-xs text-[#9CA3AF]">
                Defaults to a station in your assigned constituency when
                available.
              </p>
            </div>
          </div>

          <div className="w-full sm:w-96">
            <label htmlFor="ballot-station-select" className="sr-only">
              Polling Station
            </label>
            <div className="relative">
              <Building2
                className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#10B981]"
                aria-hidden="true"
              />
              <select
                id="ballot-station-select"
                value={selectedStationId}
                disabled={pollingStations.length === 0}
                onChange={(e) => setSelectedStationId(e.target.value)}
                className="w-full rounded-lg border border-[#1F2E26] bg-[#090D0B] py-2.5 pr-3.5 pl-10 text-sm text-[#F3F4F6] transition-colors focus:border-[#10B981] focus:outline-none disabled:opacity-60"
              >
                {pollingStations.length === 0 ? (
                  <option value="">No polling stations configured yet</option>
                ) : (
                  <>
                    {myRegionStations.length > 0 && (
                      <optgroup label="Stations in Your Region">
                        {myRegionStations.map((station) => (
                          <option
                            key={station.station_id}
                            value={String(station.station_id)}
                          >
                            {station.name}
                            {station.location ? ` — ${station.location}` : ""}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {otherRegionStations.length > 0 && (
                      <optgroup
                        label={
                          myRegionStations.length > 0
                            ? "Other Polling Stations"
                            : "Available Polling Stations"
                        }
                      >
                        {otherRegionStations.map((station) => (
                          <option
                            key={station.station_id}
                            value={String(station.station_id)}
                          >
                            {station.name}
                            {station.region
                              ? ` (${station.region.region_name})`
                              : ""}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </>
                )}
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Step 2: Candidate Selection Grid */}
      <section aria-label="Step 2: Select One Candidate" className="ems-card p-6">
        <div className="flex flex-col gap-3 border-b border-[#1F2E26] pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#10B981]/40 bg-[#052E16] font-mono text-xs font-bold text-[#22C55E]">
              2
            </span>
            <div>
              <h2 className="text-base font-semibold text-[#F3F4F6]">
                Choose Your Candidate
              </h2>
              <p className="mt-0.5 text-xs text-[#9CA3AF]">
                Click one candidate card below to select your ballot choice.
              </p>
            </div>
          </div>

          {hasMyRegionCandidates && (
            <div className="inline-flex items-center gap-1 rounded-lg border border-[#1F2E26] bg-[#090D0B] p-1">
              <button
                type="button"
                onClick={() => setRegionScope("ALL")}
                className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  regionScope === "ALL"
                    ? "bg-[#052E16] text-[#22C55E]"
                    : "text-[#9CA3AF] hover:text-[#F3F4F6]"
                }`}
              >
                All Candidates ({candidates.length})
              </button>
              <button
                type="button"
                onClick={() => setRegionScope("MY_REGION")}
                className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  regionScope === "MY_REGION"
                    ? "bg-[#052E16] text-[#22C55E]"
                    : "text-[#9CA3AF] hover:text-[#F3F4F6]"
                }`}
              >
                My Region
              </button>
            </div>
          )}
        </div>

        {displayedCandidates.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-[#1F2E26] bg-[#090D0B]/70 p-10 text-center">
            <p className="text-sm font-semibold text-[#F3F4F6]">
              No candidates available for this election yet
            </p>
            <p className="mt-1 text-xs text-[#9CA3AF]">
              An election administrator must add candidates to{" "}
              {activeElection.title} before ballots can be cast.
            </p>
          </div>
        ) : (
          <div
            role="radiogroup"
            aria-label="Election Candidates"
            className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {displayedCandidates.map((candidate) => {
              const isSelected =
                selectedCandidateId === candidate.candidate_id;
              const isMyRegion =
                voter.region_id !== null &&
                candidate.region_id === voter.region_id;

              return (
                <button
                  key={candidate.candidate_id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => {
                    setErrorMessage(null);
                    setSelectedCandidateId(candidate.candidate_id);
                  }}
                  className={`group relative flex cursor-pointer flex-col justify-between rounded-xl border p-5 text-left transition-all ${
                    isSelected
                      ? "border-[#10B981] bg-[#052E16]/55 ring-1 ring-[#10B981]/60"
                      : "border-[#1F2E26] bg-[#090D0B]/80 hover:border-[#10B981]/50 hover:bg-[#161F1A]/60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    {/* Symbol Thumbnail */}
                    <div
                      className={`flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border p-2 ${
                        isSelected
                          ? "border-[#10B981]/50 bg-[#090D0B]"
                          : "border-[#1F2E26] bg-[#111814]"
                      }`}
                    >
                      {candidate.election_symbol?.image_url ? (
                        <Image
                          unoptimized
                          src={candidate.election_symbol.image_url}
                          alt={candidate.election_symbol.symbol_name}
                          width={56}
                          height={56}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <ImageIcon
                          className="h-6 w-6 text-[#6B7280]"
                          aria-hidden="true"
                        />
                      )}
                    </div>

                    {/* Selection Radio Indicator */}
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors ${
                        isSelected
                          ? "border-[#22C55E] bg-[#10B981] text-[#090D0B]"
                          : "border-[#1F2E26] bg-[#111814] group-hover:border-[#10B981]/50"
                      }`}
                    >
                      {isSelected && (
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                    </span>
                  </div>

                  <div className="mt-4 space-y-1.5">
                    <h3 className="text-base font-bold text-[#F3F4F6]">
                      {candidate.name}
                    </h3>
                    <p className="text-xs font-medium text-[#10B981]">
                      {candidate.political_party?.party_name ?? "Independent"}
                    </p>
                    {candidate.election_symbol?.symbol_name && (
                      <p className="text-xs text-[#9CA3AF]">
                        Symbol: {candidate.election_symbol.symbol_name}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#1F2E26] pt-3">
                    <span className="inline-flex items-center gap-1 text-[11px] text-[#9CA3AF]">
                      <MapPin
                        className="h-3 w-3 text-[#10B981]"
                        aria-hidden="true"
                      />
                      <span>
                        {candidate.region?.region_name ??
                          `Region #${candidate.region_id}`}
                      </span>
                    </span>
                    {isMyRegion && (
                      <span className="rounded-full border border-[#10B981]/35 bg-[#052E16] px-2 py-0.5 font-mono text-[10px] font-semibold text-[#22C55E] uppercase">
                        Your Region
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Ballot Action Footer */}
      <section className="ems-card flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <Lock
            className="mt-0.5 h-5 w-5 shrink-0 text-[#10B981]"
            aria-hidden="true"
          />
          <div className="text-xs">
            <p className="font-semibold text-[#F3F4F6]">
              {selectedCandidate
                ? `Selected: ${selectedCandidate.name} (${selectedCandidate.political_party?.party_name ?? "Independent"})`
                : "No candidate selected yet"}
            </p>
            <p className="mt-0.5 text-[#9CA3AF]">
              {selectedStation
                ? `Polling Station: ${selectedStation.name}`
                : "Select a polling station and one candidate to continue."}
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={!canOpenConfirm}
          onClick={() => {
            setErrorMessage(null);
            setConfirmModalOpen(true);
          }}
          className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#10B981] px-6 py-3 text-sm font-semibold text-[#090D0B] transition-colors hover:bg-[#22C55E] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Vote className="h-4 w-4" aria-hidden="true" />
          <span>Cast Encrypted Ballot</span>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </section>

      {/* ===================================================================== */}
      {/* EXPLICIT IRREVERSIBLE BALLOT CONFIRMATION MODAL                       */}
      {/* ===================================================================== */}
      {confirmModalOpen && selectedCandidate && selectedStation && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#090D0B]/85 p-4 backdrop-blur-xs"
          onClick={() => {
            if (!isCasting) setConfirmModalOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-ballot-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl border border-[#10B981]/45 bg-[#111814] p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="ems-badge-emerald inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider uppercase">
                  <Lock className="h-3 w-3" aria-hidden="true" />
                  Final Ballot Confirmation
                </span>
                <h2
                  id="confirm-ballot-title"
                  className="mt-2.5 text-xl font-bold text-[#F3F4F6]"
                >
                  Confirm Your Encrypted Ballot
                </h2>
              </div>
              <button
                type="button"
                disabled={isCasting}
                onClick={() => setConfirmModalOpen(false)}
                aria-label="Close confirmation modal"
                className="cursor-pointer rounded-lg border border-[#1F2E26] bg-[#090D0B] p-1.5 text-[#9CA3AF] hover:text-[#F3F4F6] disabled:opacity-50"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {/* Selected Candidate & Station Review */}
            <div className="mt-5 rounded-xl border border-[#1F2E26] bg-[#090D0B] p-4">
              <div className="flex items-center gap-3.5">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#1F2E26] bg-[#111814] p-1.5">
                  {selectedCandidate.election_symbol?.image_url ? (
                    <Image
                      unoptimized
                      src={selectedCandidate.election_symbol.image_url}
                      alt={selectedCandidate.election_symbol.symbol_name}
                      width={48}
                      height={48}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <ImageIcon
                      className="h-5 w-5 text-[#6B7280]"
                      aria-hidden="true"
                    />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium tracking-wider text-[#9CA3AF] uppercase">
                    Selected Candidate
                  </p>
                  <p className="truncate text-base font-bold text-[#F3F4F6]">
                    {selectedCandidate.name}
                  </p>
                  <p className="text-xs text-[#10B981]">
                    {selectedCandidate.political_party?.party_name ??
                      "Independent"}
                    {selectedCandidate.election_symbol?.symbol_name
                      ? ` • ${selectedCandidate.election_symbol.symbol_name}`
                      : ""}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-2 border-t border-[#1F2E26] pt-3 text-xs sm:grid-cols-2">
                <div>
                  <span className="text-[#9CA3AF]">Election: </span>
                  <span className="font-medium text-[#F3F4F6]">
                    {activeElection.title}
                  </span>
                </div>
                <div>
                  <span className="text-[#9CA3AF]">Station: </span>
                  <span className="font-medium text-[#F3F4F6]">
                    {selectedStation.name}
                  </span>
                </div>
              </div>
            </div>

            {/* Mandatory Permanent Ballot Warning */}
            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-[#F59E0B]/45 bg-[#291C06]/70 p-4 text-xs leading-relaxed text-[#F59E0B]">
              <AlertTriangle
                className="mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
              />
              <div>
                <p className="font-semibold text-[#F3F4F6]">
                  Once confirmed, your encrypted ballot cannot be changed or
                  undone.
                </p>
                <p className="mt-1 text-[#F59E0B]">
                  Once submitted, your encrypted ballot is permanent and cannot
                  be changed. Your choice is encrypted without storing your
                  voter ID on the ballot.
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2.5 border-t border-[#1F2E26] pt-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={isCasting}
                onClick={() => setConfirmModalOpen(false)}
                className="cursor-pointer rounded-lg border border-[#1F2E26] bg-[#090D0B] px-4 py-2.5 text-sm font-medium text-[#9CA3AF] transition-colors hover:text-[#F3F4F6] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isCasting}
                onClick={handleConfirmCastVote}
                className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#10B981] px-5 py-2.5 text-sm font-semibold text-[#090D0B] transition-colors hover:bg-[#22C55E] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCasting ? (
                  <>
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                    <span>Encrypting &amp; Submitting...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                    <span>Confirm &amp; Submit Ballot</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
