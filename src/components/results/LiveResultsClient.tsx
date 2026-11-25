"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  AlertCircle,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { parsePositiveInt, sanitizePublicError } from "@/lib/validation";
import type {
  CandidateWithRelations,
  Election,
  ElectionStatus,
  PollingStation,
  Region,
  Result,
} from "@/types/database";

interface LiveResultsClientProps {
  elections: Election[];
  initialElectionId: number | null;
  initialCandidates: CandidateWithRelations[];
  initialResults: Result[];
  regions: Region[];
  stations: PollingStation[];
  loadError?: string | null;
}

type RealtimeConnectionState = "CONNECTING" | "LIVE" | "RECONNECTING";

interface RankedCandidate {
  candidate: CandidateWithRelations;
  votes: number;
  percentage: number;
  rank: number;
}

function getStatusPillClass(status: ElectionStatus): string {
  if (status === "ACTIVE") return "ems-badge-emerald";
  if (status === "CLOSED") return "ems-badge-danger";
  return "ems-badge-warning";
}

export default function LiveResultsClient({
  elections,
  initialElectionId,
  initialCandidates,
  initialResults,
  regions,
  stations,
  loadError,
}: LiveResultsClientProps) {
  const [selectedElectionId, setSelectedElectionId] = useState<number | null>(
    initialElectionId
  );
  const [selectedRegionId, setSelectedRegionId] = useState<string>("ALL");
  const [selectedStationId, setSelectedStationId] = useState<string>("ALL");

  const [candidates, setCandidates] =
    useState<CandidateWithRelations[]>(initialCandidates);
  const [results, setResults] = useState<Result[]>(initialResults);

  const [isLoadingElection, setIsLoadingElection] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [realtimeState, setRealtimeState] =
    useState<RealtimeConnectionState>("CONNECTING");
  const [errorMessage, setErrorMessage] = useState<string | null>(
    loadError ?? null
  );

  const selectedElection = useMemo(
    () =>
      elections.find((e) => e.election_id === selectedElectionId) ?? null,
    [elections, selectedElectionId]
  );

  async function loadElectionData(electionId: number, showFullLoader: boolean) {
    setErrorMessage(null);
    if (showFullLoader) setIsLoadingElection(true);
    else setIsRefreshing(true);

    try {
      const supabase = createClient();
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

      if (candidatesRes.error || resultsRes.error) {
        setErrorMessage(
          sanitizePublicError(
            candidatesRes.error ?? resultsRes.error,
            "Unable to fetch results."
          )
        );
        return;
      }

      setCandidates(candidatesRes.data ?? []);
      setResults(resultsRes.data ?? []);
    } catch {
      setErrorMessage("Unable to fetch results.");
    } finally {
      setIsLoadingElection(false);
      setIsRefreshing(false);
    }
  }

  function handleElectionChange(nextIdRaw: string) {
    const nextId = parsePositiveInt(nextIdRaw);
    if (nextId === null) return;
    setSelectedElectionId(nextId);
    setSelectedRegionId("ALL");
    setSelectedStationId("ALL");
    setRealtimeState("CONNECTING");
    void loadElectionData(nextId, true);
  }

  useEffect(() => {
    const validElectionId = parsePositiveInt(selectedElectionId);
    if (validElectionId === null) return;

    const supabase = createClient();

    const channel = supabase
      .channel(`ems-public-results-${validElectionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "result",
          filter: `election_id=eq.${validElectionId}`,
        },
        (payload) => {
          if (
            payload.eventType === "INSERT" ||
            payload.eventType === "UPDATE"
          ) {
            const incoming = payload.new as Result;
            if (!incoming || typeof incoming.result_id !== "number") return;

            setResults((prev) => {
              const idx = prev.findIndex(
                (item) => item.result_id === incoming.result_id
              );
              if (idx >= 0) {
                const updated = [...prev];
                updated[idx] = incoming;
                return updated;
              }
              return [...prev, incoming];
            });
          } else if (payload.eventType === "DELETE") {
            const removed = payload.old as Partial<Result>;
            if (typeof removed?.result_id === "number") {
              setResults((prev) =>
                prev.filter((item) => item.result_id !== removed.result_id)
              );
            }
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setRealtimeState("LIVE");
        else if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          setRealtimeState("RECONNECTING");
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [selectedElectionId]);

  const availableStations = useMemo(() => {
    if (selectedRegionId === "ALL") return stations;
    const regionNum = Number(selectedRegionId);
    return stations.filter((s) => s.region_id === regionNum);
  }, [selectedRegionId, stations]);

  const filteredCandidates = useMemo(() => {
    if (selectedRegionId === "ALL") return candidates;
    const regionNum = Number(selectedRegionId);
    return candidates.filter((c) => c.region_id === regionNum);
  }, [candidates, selectedRegionId]);

  const { leaderboard, totalVotesCast, reportingStationsCount } =
    useMemo(() => {
      const allowedCandidateIds = new Set(
        filteredCandidates.map((c) => c.candidate_id)
      );
      const allowedStationIds =
        selectedStationId !== "ALL"
          ? new Set([Number(selectedStationId)])
          : selectedRegionId !== "ALL"
            ? new Set(availableStations.map((s) => s.station_id))
            : null;

      const votesMap = new Map<number, number>();
      const reportingStations = new Set<number>();

      for (const row of results) {
        if (!allowedCandidateIds.has(row.candidate_id)) continue;
        if (allowedStationIds && !allowedStationIds.has(row.station_id)) {
          continue;
        }
        const votes = Number(row.total_votes) || 0;
        votesMap.set(
          row.candidate_id,
          (votesMap.get(row.candidate_id) ?? 0) + votes
        );
        if (votes > 0) reportingStations.add(row.station_id);
      }

      const unsorted = filteredCandidates.map((candidate) => ({
        candidate,
        votes: votesMap.get(candidate.candidate_id) ?? 0,
      }));

      const grandTotal = unsorted.reduce((sum, entry) => sum + entry.votes, 0);

      unsorted.sort((a, b) => {
        if (b.votes !== a.votes) return b.votes - a.votes;
        return a.candidate.name.localeCompare(b.candidate.name);
      });

      const ranked: RankedCandidate[] = unsorted.map((entry, idx) => ({
        candidate: entry.candidate,
        votes: entry.votes,
        percentage: grandTotal > 0 ? (entry.votes / grandTotal) * 100 : 0,
        rank: idx + 1,
      }));

      return {
        leaderboard: ranked,
        totalVotesCast: grandTotal,
        reportingStationsCount: reportingStations.size,
      };
    }, [
      availableStations,
      filteredCandidates,
      results,
      selectedRegionId,
      selectedStationId,
    ]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-8 sm:px-6">
      {/* Top Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-xl font-semibold tracking-tight text-[#F3F4F6] sm:text-2xl">
            {selectedElection ? selectedElection.title : "Election Results"}
          </h1>

          <span className="ems-badge-emerald inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22C55E] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#22C55E]" />
            </span>
            <span>{realtimeState === "LIVE" ? "Live" : realtimeState}</span>
          </span>

          {selectedElection && (
            <span
              className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${getStatusPillClass(
                selectedElection.status
              )}`}
            >
              {selectedElection.status}
            </span>
          )}
        </div>

        {selectedElectionId && (
          <button
            type="button"
            disabled={isRefreshing || isLoadingElection}
            onClick={() => void loadElectionData(selectedElectionId, false)}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#1F2E26] bg-[#111814] px-3 py-1.5 text-xs font-medium text-[#9CA3AF] transition-colors hover:border-[#10B981]/50 hover:text-[#F3F4F6] disabled:opacity-60"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            <span>Refresh</span>
          </button>
        )}
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-lg border border-[#EF4444]/40 bg-[#2A0D10] px-4 py-2.5 text-xs text-[#EF4444]"
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

      {elections.length === 0 ? (
        <div className="ems-card p-10 text-center text-sm text-[#9CA3AF]">
          No elections published yet.
        </div>
      ) : (
        <>
          {/* Filters */}
          <div className="grid gap-3 sm:grid-cols-3">
            <select
              aria-label="Election"
              value={selectedElectionId ? String(selectedElectionId) : ""}
              onChange={(e) => handleElectionChange(e.target.value)}
              className="rounded-lg border border-[#1F2E26] bg-[#111814] px-3 py-2 text-sm text-[#F3F4F6] focus:border-[#10B981] focus:outline-none"
            >
              {elections.map((election) => (
                <option
                  key={election.election_id}
                  value={String(election.election_id)}
                >
                  {election.title} ({election.status})
                </option>
              ))}
            </select>

            <select
              aria-label="Region"
              value={selectedRegionId}
              onChange={(e) => {
                setSelectedRegionId(e.target.value);
                setSelectedStationId("ALL");
              }}
              className="rounded-lg border border-[#1F2E26] bg-[#111814] px-3 py-2 text-sm text-[#F3F4F6] focus:border-[#10B981] focus:outline-none"
            >
              <option value="ALL">All Regions</option>
              {regions.map((region) => (
                <option key={region.region_id} value={String(region.region_id)}>
                  {region.region_name}
                </option>
              ))}
            </select>

            <select
              aria-label="Polling Station"
              value={selectedStationId}
              onChange={(e) => setSelectedStationId(e.target.value)}
              className="rounded-lg border border-[#1F2E26] bg-[#111814] px-3 py-2 text-sm text-[#F3F4F6] focus:border-[#10B981] focus:outline-none"
            >
              <option value="ALL">All Polling Stations</option>
              {availableStations.map((station) => (
                <option
                  key={station.station_id}
                  value={String(station.station_id)}
                >
                  {station.name}
                </option>
              ))}
            </select>
          </div>

          {/* KPI Strip */}
          <div className="grid grid-cols-3 gap-3">
            <div className="ems-card p-4">
              <p className="text-xs text-[#9CA3AF]">Total Votes</p>
              <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-[#22C55E]">
                {totalVotesCast.toLocaleString()}
              </p>
            </div>
            <div className="ems-card p-4">
              <p className="text-xs text-[#9CA3AF]">Candidates</p>
              <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-[#F3F4F6]">
                {leaderboard.length}
              </p>
            </div>
            <div className="ems-card p-4">
              <p className="text-xs text-[#9CA3AF]">Stations Reporting</p>
              <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-[#F3F4F6]">
                {reportingStationsCount}
              </p>
            </div>
          </div>

          {/* Standings */}
          <section className="ems-card divide-y divide-[#1F2E26] overflow-hidden">
            {isLoadingElection ? (
              <div className="flex items-center justify-center py-12">
                <Loader2
                  className="h-5 w-5 animate-spin text-[#10B981]"
                  aria-hidden="true"
                />
              </div>
            ) : leaderboard.length === 0 ? (
              <p className="p-8 text-center text-xs text-[#9CA3AF]">
                No candidates found.
              </p>
            ) : (
              leaderboard.map(({ candidate, votes, percentage, rank }) => {
                const isLeader = rank === 1 && votes > 0;
                const barWidth = Math.min(100, Math.max(0, percentage));

                return (
                  <div
                    key={candidate.candidate_id}
                    className={`p-4 ${isLeader ? "bg-[#052E16]/25" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded font-mono text-xs font-semibold ${
                            isLeader
                              ? "bg-[#10B981] text-[#090D0B]"
                              : "bg-[#161F1A] text-[#9CA3AF]"
                          }`}
                        >
                          {rank}
                        </span>

                        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded border border-[#1F2E26] bg-[#090D0B] p-1">
                          {candidate.election_symbol?.image_url ? (
                            <Image
                              unoptimized
                              src={candidate.election_symbol.image_url}
                              alt={candidate.election_symbol.symbol_name}
                              width={36}
                              height={36}
                              className="h-full w-full object-contain"
                            />
                          ) : (
                            <ImageIcon
                              className="h-4 w-4 text-[#6B7280]"
                              aria-hidden="true"
                            />
                          )}
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[#F3F4F6]">
                            {candidate.name}
                          </p>
                          <p className="truncate text-xs text-[#9CA3AF]">
                            <span className="text-[#10B981]">
                              {candidate.political_party?.party_name ??
                                "Independent"}
                            </span>
                            {candidate.region?.region_name
                              ? ` · ${candidate.region.region_name}`
                              : ""}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 text-right font-mono tabular-nums">
                        <p className="text-base font-semibold text-[#F3F4F6]">
                          {votes.toLocaleString()}
                        </p>
                        <p className="text-xs text-[#22C55E]">
                          {percentage.toFixed(1)}%
                        </p>
                      </div>
                    </div>

                    <div
                      role="progressbar"
                      aria-label={`${candidate.name} vote share`}
                      aria-valuenow={Number(percentage.toFixed(1))}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[#161F1A]"
                    >
                      <div
                        className="h-full rounded-full bg-[#10B981] transition-all duration-500 ease-out"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </section>
        </>
      )}
    </div>
  );
}
