"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  Image as ImageIcon,
  Loader2,
  Lock,
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

export default function BallotClient({
  voter,
  activeElection,
  candidates,
  pollingStations,
}: BallotClientProps) {
  const router = useRouter();

  const [hasVoted, setHasVoted] = useState<boolean>(voter.has_voted);

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

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && confirmModalOpen && !isCasting) {
        setConfirmModalOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [confirmModalOpen, isCasting]);

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
      setErrorMessage("Select a polling station and candidate.");
      return;
    }

    setErrorMessage(null);
    setIsCasting(true);

    try {
      const supabase = createClient();
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

      setSelectedCandidateId(null);
      setConfirmModalOpen(false);
      setHasVoted(true);
      router.refresh();
    } catch {
      setErrorMessage("Unable to submit ballot.");
      setConfirmModalOpen(false);
    } finally {
      setIsCasting(false);
    }
  }

  // Permanent anonymous confirmation card (never reveals chosen candidate)
  if (hasVoted) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col px-4 py-14">
        <section className="ems-card border-[#10B981]/50 p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[#10B981]/50 bg-[#052E16] text-[#22C55E]">
            <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="mt-4 text-xl font-semibold text-[#F3F4F6]">
            Encrypted Ballot Recorded
          </h1>
          <p className="mt-2 text-xs text-[#9CA3AF]">
            {activeElection.title} &bull; {voter.cnic}
          </p>
          <p className="mt-3 text-xs leading-relaxed text-[#9CA3AF]">
            Your encrypted ballot is permanently recorded and cannot be viewed
            or changed.
          </p>
          <div className="mt-6 flex justify-center gap-2.5">
            <Link
              href="/"
              className="rounded-lg bg-[#10B981] px-4 py-2 text-xs font-semibold text-[#090D0B] hover:bg-[#22C55E]"
            >
              Live Results
            </Link>
            <Link
              href="/dashboard"
              className="rounded-lg border border-[#1F2E26] bg-[#090D0B] px-4 py-2 text-xs font-medium text-[#F3F4F6] hover:border-[#10B981]/50"
            >
              Dashboard
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const canOpenConfirm =
    Boolean(selectedStation) && Boolean(selectedCandidate) && !isCasting;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[#F3F4F6]">
            {activeElection.title}
          </h1>
          <p className="mt-0.5 font-mono text-xs text-[#9CA3AF]">
            {voter.cnic}
            {voter.region ? ` • ${voter.region.region_name}` : ""}
          </p>
        </div>

        <div className="w-full sm:w-72">
          <label htmlFor="ballot-station-select" className="sr-only">
            Polling Station
          </label>
          <select
            id="ballot-station-select"
            value={selectedStationId}
            disabled={pollingStations.length === 0}
            onChange={(e) => setSelectedStationId(e.target.value)}
            className="w-full rounded-lg border border-[#1F2E26] bg-[#111814] px-3 py-2 text-sm text-[#F3F4F6] focus:border-[#10B981] focus:outline-none disabled:opacity-60"
          >
            {pollingStations.length === 0 ? (
              <option value="">No polling stations</option>
            ) : (
              pollingStations.map((station) => (
                <option
                  key={station.station_id}
                  value={String(station.station_id)}
                >
                  {station.name}
                  {station.region ? ` (${station.region.region_name})` : ""}
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="flex items-center justify-between rounded-lg border border-[#EF4444]/40 bg-[#2A0D10] px-4 py-2.5 text-xs text-[#EF4444]"
        >
          <span className="inline-flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{errorMessage}</span>
          </span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="cursor-pointer hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Candidate Selection */}
      <section className="ems-card p-5">
        <div className="flex items-center justify-between gap-3 border-b border-[#1F2E26] pb-3">
          <h2 className="text-sm font-semibold text-[#F3F4F6]">
            Select Candidate
          </h2>
          {hasMyRegionCandidates && (
            <div className="inline-flex gap-1 rounded-md border border-[#1F2E26] bg-[#090D0B] p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setRegionScope("ALL")}
                className={`cursor-pointer rounded px-2.5 py-1 ${
                  regionScope === "ALL"
                    ? "bg-[#052E16] text-[#22C55E]"
                    : "text-[#9CA3AF]"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setRegionScope("MY_REGION")}
                className={`cursor-pointer rounded px-2.5 py-1 ${
                  regionScope === "MY_REGION"
                    ? "bg-[#052E16] text-[#22C55E]"
                    : "text-[#9CA3AF]"
                }`}
              >
                My Region
              </button>
            </div>
          )}
        </div>

        {displayedCandidates.length === 0 ? (
          <p className="py-10 text-center text-xs text-[#9CA3AF]">
            No candidates available.
          </p>
        ) : (
          <div
            role="radiogroup"
            aria-label="Candidates"
            className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            {displayedCandidates.map((candidate) => {
              const isSelected =
                selectedCandidateId === candidate.candidate_id;

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
                  className={`flex cursor-pointer items-center gap-3.5 rounded-lg border p-4 text-left transition-colors ${
                    isSelected
                      ? "border-[#10B981] bg-[#052E16]/50"
                      : "border-[#1F2E26] bg-[#090D0B] hover:border-[#10B981]/50"
                  }`}
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#1F2E26] bg-[#111814] p-1">
                    {candidate.election_symbol?.image_url ? (
                      <Image
                        unoptimized
                        src={candidate.election_symbol.image_url}
                        alt={candidate.election_symbol.symbol_name}
                        width={44}
                        height={44}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <ImageIcon
                        className="h-5 w-5 text-[#6B7280]"
                        aria-hidden="true"
                      />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#F3F4F6]">
                      {candidate.name}
                    </p>
                    <p className="truncate text-xs text-[#10B981]">
                      {candidate.political_party?.party_name ?? "Independent"}
                    </p>
                    <p className="truncate text-[11px] text-[#6B7280]">
                      {candidate.region?.region_name ??
                        `Region #${candidate.region_id}`}
                    </p>
                  </div>

                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                      isSelected
                        ? "border-[#22C55E] bg-[#10B981] text-[#090D0B]"
                        : "border-[#1F2E26]"
                    }`}
                  >
                    {isSelected && (
                      <Check className="h-3 w-3" aria-hidden="true" />
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Cast Action */}
      <div className="flex items-center justify-between gap-4">
        <span className="inline-flex items-center gap-1.5 text-xs text-[#9CA3AF]">
          <Lock className="h-3.5 w-3.5 text-[#10B981]" aria-hidden="true" />
          <span>
            {selectedCandidate ? selectedCandidate.name : "Select a candidate"}
          </span>
        </span>
        <button
          type="button"
          disabled={!canOpenConfirm}
          onClick={() => {
            setErrorMessage(null);
            setConfirmModalOpen(true);
          }}
          className="cursor-pointer rounded-lg bg-[#10B981] px-5 py-2.5 text-sm font-semibold text-[#090D0B] transition-colors hover:bg-[#22C55E] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cast Ballot
        </button>
      </div>

      {/* Confirmation Modal */}
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
            className="w-full max-w-md rounded-xl border border-[#10B981]/45 bg-[#111814] p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h2
                id="confirm-ballot-title"
                className="text-base font-semibold text-[#F3F4F6]"
              >
                Confirm Ballot
              </h2>
              <button
                type="button"
                disabled={isCasting}
                onClick={() => setConfirmModalOpen(false)}
                aria-label="Close"
                className="cursor-pointer text-[#9CA3AF] hover:text-[#F3F4F6]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-4 rounded-lg border border-[#1F2E26] bg-[#090D0B] p-3.5 text-sm">
              <p className="font-semibold text-[#F3F4F6]">
                {selectedCandidate.name}
              </p>
              <p className="text-xs text-[#10B981]">
                {selectedCandidate.political_party?.party_name ?? "Independent"}
              </p>
              <p className="mt-2 text-xs text-[#9CA3AF]">
                Station: {selectedStation.name}
              </p>
            </div>

            <div className="mt-4 flex items-start gap-2 rounded-lg border border-[#F59E0B]/40 bg-[#291C06]/70 p-3 text-xs text-[#F59E0B]">
              <AlertTriangle
                className="mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
              />
              <span>
                Once confirmed, your encrypted ballot cannot be changed or
                undone.
              </span>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={isCasting}
                onClick={() => setConfirmModalOpen(false)}
                className="cursor-pointer rounded-lg border border-[#1F2E26] bg-[#090D0B] px-4 py-2 text-xs font-medium text-[#9CA3AF] hover:text-[#F3F4F6]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isCasting}
                onClick={handleConfirmCastVote}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#10B981] px-4 py-2 text-xs font-semibold text-[#090D0B] hover:bg-[#22C55E] disabled:opacity-60"
              >
                {isCasting && (
                  <Loader2
                    className="h-3.5 w-3.5 animate-spin"
                    aria-hidden="true"
                  />
                )}
                <span>Confirm &amp; Cast</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
