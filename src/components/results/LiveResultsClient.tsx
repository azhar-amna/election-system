"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  AlertCircle,
  Award,
  BarChart3,
  Building2,
  Filter,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Radio,
  RefreshCw,
  Users,
  Vote,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
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

function formatDateRange(start: string, end: string): string {
  const fmt = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const s = new Date(start);
  const e = new Date(end);
  const sStr = Number.isNaN(s.getTime()) ? start : fmt.format(s);
  const eStr = Number.isNaN(e.getTime()) ? end : fmt.format(e);
  return `${sStr} — ${eStr}`;
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
  const [lastUpdatedLabel, setLastUpdatedLabel] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    loadError ?? null
  );

  const selectedElection = useMemo(
    () =>
      elections.find((e) => e.election_id === selectedElectionId) ?? null,
    [elections, selectedElectionId]
  );

  // Fetch election data when switching elections or manually refreshing
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
        supabase
          .from("result")
          .select("*")
          .eq("election_id", electionId),
      ]);

      if (candidatesRes.error || resultsRes.error) {
        setErrorMessage(
          candidatesRes.error?.message ??
            resultsRes.error?.message ??
            "Unable to fetch election results."
        );
        return;
      }

      setCandidates(candidatesRes.data ?? []);
      setResults(resultsRes.data ?? []);
      setLastUpdatedLabel(
        new Intl.DateTimeFormat("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }).format(new Date())
      );
    } catch {
      setErrorMessage("Unable to refresh election tallies right now.");
    } finally {
      setIsLoadingElection(false);
      setIsRefreshing(false);
    }
  }

  function handleElectionChange(nextIdRaw: string) {
    const nextId = Number(nextIdRaw);
    if (!Number.isInteger(nextId)) return;
    setSelectedElectionId(nextId);
    setSelectedRegionId("ALL");
    setSelectedStationId("ALL");
    setRealtimeState("CONNECTING");
    void loadElectionData(nextId, true);
  }

  // Subscribe to Supabase Realtime postgres_changes on public.result
  useEffect(() => {
    if (!selectedElectionId) return;

    const supabase = createClient();

    const channel = supabase
      .channel(`ems-public-results-${selectedElectionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "result",
          filter: `election_id=eq.${selectedElectionId}`,
        },
        (payload) => {
          if (
            payload.eventType === "INSERT" ||
            payload.eventType === "UPDATE"
          ) {
            const incoming = payload.new as Result;
            if (!incoming || typeof incoming.result_id !== "number") return;

            setResults((prev) => {
              const existingIndex = prev.findIndex(
                (item) => item.result_id === incoming.result_id
              );
              if (existingIndex >= 0) {
                const updated = [...prev];
                updated[existingIndex] = incoming;
                return updated;
              }
              return [...prev, incoming];
            });

            setLastUpdatedLabel(
              new Intl.DateTimeFormat("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              }).format(new Date())
            );
          } else if (payload.eventType === "DELETE") {
            const removed = payload.old as Partial<Result>;
            if (typeof removed?.result_id === "number") {
              setResults((prev) =>
                prev.filter((item) => item.result_id !== removed.result_id)
              );
              setLastUpdatedLabel(
                new Intl.DateTimeFormat("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                }).format(new Date())
              );
            }
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setRealtimeState("LIVE");
        } else if (
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

  // Filter polling stations dropdown by selected region
  const availableStations = useMemo(() => {
    if (selectedRegionId === "ALL") return stations;
    const regionNum = Number(selectedRegionId);
    return stations.filter((s) => s.region_id === regionNum);
  }, [selectedRegionId, stations]);

  // Filter candidates by selected region
  const filteredCandidates = useMemo(() => {
    if (selectedRegionId === "ALL") return candidates;
    const regionNum = Number(selectedRegionId);
    return candidates.filter((c) => c.region_id === regionNum);
  }, [candidates, selectedRegionId]);

  // Aggregate public.result.total_votes per candidate respecting Region & Station filters
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
        if (votes > 0) {
          reportingStations.add(row.station_id);
        }
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

  const leadingCandidate =
    leaderboard[0] && leaderboard[0].votes > 0 ? leaderboard[0] : null;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      {/* Hero Header & Live Status Banner */}
      <section className="ems-card relative overflow-hidden p-6 sm:p-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-[#10B981]/10 blur-3xl"
        />

        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Pulsing Green LIVE Indicator */}
              <span className="ems-badge-emerald inline-flex items-center gap-2 rounded-full px-3 py-1 font-mono text-[11px] font-semibold tracking-wider uppercase">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22C55E] opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#22C55E]" />
                </span>
                <span>
                  {realtimeState === "LIVE"
                    ? "LIVE • Realtime Stream"
                    : realtimeState === "CONNECTING"
                      ? "LIVE • Connecting"
                      : "LIVE • Reconnecting"}
                </span>
              </span>

              {selectedElection && (
                <span
                  className={`rounded-full px-2.5 py-1 font-mono text-[11px] font-semibold tracking-wider uppercase ${getStatusPillClass(
                    selectedElection.status
                  )}`}
                >
                  {selectedElection.status}
                </span>
              )}

              {lastUpdatedLabel && (
                <span className="font-mono text-[11px] text-[#9CA3AF]">
                  Updated {lastUpdatedLabel}
                </span>
              )}
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-[#F3F4F6] sm:text-4xl">
              {selectedElection
                ? selectedElection.title
                : "Live Election Results"}
            </h1>

            <p className="max-w-2xl text-sm leading-relaxed text-[#9CA3AF]">
              {selectedElection
                ? `Public real-time tally scoreboard (${formatDateRange(
                    selectedElection.start_date,
                    selectedElection.end_date
                  )}). Vote counts stream automatically as encrypted ballots are recorded.`
                : "Public real-time election scoreboard. No login required to view verified polling station tallies."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {selectedElectionId && (
              <button
                type="button"
                disabled={isRefreshing || isLoadingElection}
                onClick={() => void loadElectionData(selectedElectionId, false)}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#1F2E26] bg-[#090D0B] px-3.5 py-2.5 text-xs font-medium text-[#F3F4F6] transition-colors hover:border-[#10B981]/50 hover:text-[#22C55E] disabled:opacity-60"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`}
                  aria-hidden="true"
                />
                <span>{isRefreshing ? "Syncing..." : "Refresh Tally"}</span>
              </button>
            )}
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#10B981] px-4 py-2.5 text-xs font-semibold text-[#090D0B] transition-colors hover:bg-[#22C55E]"
            >
              <Vote className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Voter Portal</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Error Alert */}
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

      {/* Empty State: No Elections Configured */}
      {elections.length === 0 ? (
        <section className="ems-card p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[#1F2E26] bg-[#161F1A] text-[#10B981]">
            <BarChart3 className="h-7 w-7" aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-xl font-semibold text-[#F3F4F6]">
            No Elections Published Yet
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-[#9CA3AF]">
            Live election results will appear here automatically once an
            election administrator creates and opens an election.
          </p>
        </section>
      ) : (
        <>
          {/* Filter Controls Bar: Election Switcher + Optional Region & Polling Station Filters */}
          <section
            aria-label="Result Filters"
            className="ems-card grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {/* Election Switcher */}
            <div className="space-y-1.5">
              <label
                htmlFor="results-election-select"
                className="flex items-center gap-1.5 font-mono text-[11px] font-medium tracking-wider text-[#9CA3AF] uppercase"
              >
                <Radio className="h-3.5 w-3.5 text-[#10B981]" aria-hidden="true" />
                <span>Election</span>
              </label>
              <select
                id="results-election-select"
                value={selectedElectionId ? String(selectedElectionId) : ""}
                onChange={(e) => handleElectionChange(e.target.value)}
                className="w-full rounded-lg border border-[#1F2E26] bg-[#090D0B] px-3 py-2.5 text-sm font-medium text-[#F3F4F6] transition-colors focus:border-[#10B981] focus:outline-none"
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
            </div>

            {/* Optional Region Filter */}
            <div className="space-y-1.5">
              <label
                htmlFor="results-region-select"
                className="flex items-center gap-1.5 font-mono text-[11px] font-medium tracking-wider text-[#9CA3AF] uppercase"
              >
                <MapPin
                  className="h-3.5 w-3.5 text-[#10B981]"
                  aria-hidden="true"
                />
                <span>Region Filter</span>
              </label>
              <select
                id="results-region-select"
                value={selectedRegionId}
                onChange={(e) => {
                  setSelectedRegionId(e.target.value);
                  setSelectedStationId("ALL");
                }}
                className="w-full rounded-lg border border-[#1F2E26] bg-[#090D0B] px-3 py-2.5 text-sm text-[#F3F4F6] transition-colors focus:border-[#10B981] focus:outline-none"
              >
                <option value="ALL">All Regions</option>
                {regions.map((region) => (
                  <option
                    key={region.region_id}
                    value={String(region.region_id)}
                  >
                    {region.region_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Optional Polling Station Filter */}
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
              <label
                htmlFor="results-station-select"
                className="flex items-center gap-1.5 font-mono text-[11px] font-medium tracking-wider text-[#9CA3AF] uppercase"
              >
                <Building2
                  className="h-3.5 w-3.5 text-[#10B981]"
                  aria-hidden="true"
                />
                <span>Polling Station Filter</span>
              </label>
              <select
                id="results-station-select"
                value={selectedStationId}
                onChange={(e) => setSelectedStationId(e.target.value)}
                className="w-full rounded-lg border border-[#1F2E26] bg-[#090D0B] px-3 py-2.5 text-sm text-[#F3F4F6] transition-colors focus:border-[#10B981] focus:outline-none"
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
          </section>

          {/* KPI Summary Strip */}
          <section
            aria-label="Live Scoreboard Summary"
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            {/* Total Votes Cast */}
            <div className="ems-card border-[#10B981]/35 bg-[#052E16]/30 p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium tracking-wider text-[#9CA3AF] uppercase">
                  Total Votes Cast
                </span>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#10B981]/40 bg-[#052E16] text-[#22C55E]">
                  <Vote className="h-4 w-4" aria-hidden="true" />
                </span>
              </div>
              <p className="mt-3 font-mono text-3xl font-bold text-[#22C55E]">
                {totalVotesCast.toLocaleString()}
              </p>
              <p className="mt-1 text-[11px] text-[#9CA3AF]">
                Aggregated across filtered tallies
              </p>
            </div>

            {/* Participating Candidates */}
            <div className="ems-card p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium tracking-wider text-[#9CA3AF] uppercase">
                  Candidates
                </span>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#1F2E26] bg-[#161F1A] text-[#10B981]">
                  <Users className="h-4 w-4" aria-hidden="true" />
                </span>
              </div>
              <p className="mt-3 font-mono text-3xl font-bold text-[#F3F4F6]">
                {leaderboard.length}
              </p>
              <p className="mt-1 text-[11px] text-[#9CA3AF]">
                In current election view
              </p>
            </div>

            {/* Reporting Polling Stations */}
            <div className="ems-card p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium tracking-wider text-[#9CA3AF] uppercase">
                  Reporting Stations
                </span>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#1F2E26] bg-[#161F1A] text-[#10B981]">
                  <Building2 className="h-4 w-4" aria-hidden="true" />
                </span>
              </div>
              <p className="mt-3 font-mono text-3xl font-bold text-[#F3F4F6]">
                {reportingStationsCount}
              </p>
              <p className="mt-1 text-[11px] text-[#9CA3AF]">
                Stations with tallied ballots
              </p>
            </div>

            {/* Current Leader */}
            <div className="ems-card p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium tracking-wider text-[#9CA3AF] uppercase">
                  Current Leader
                </span>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#10B981]/35 bg-[#052E16] text-[#22C55E]">
                  <Award className="h-4 w-4" aria-hidden="true" />
                </span>
              </div>
              {leadingCandidate ? (
                <>
                  <p
                    className="mt-3 truncate text-lg font-bold text-[#F3F4F6]"
                    title={leadingCandidate.candidate.name}
                  >
                    {leadingCandidate.candidate.name}
                  </p>
                  <p className="mt-1 font-mono text-xs text-[#22C55E]">
                    {leadingCandidate.percentage.toFixed(1)}% &bull;{" "}
                    {leadingCandidate.votes.toLocaleString()} votes
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-3 text-base font-semibold text-[#9CA3AF]">
                    Awaiting First Vote
                  </p>
                  <p className="mt-1 text-[11px] text-[#6B7280]">
                    Updates automatically via Realtime
                  </p>
                </>
              )}
            </div>
          </section>

          {/* Candidate Leaderboard */}
          <section
            aria-label="Live Candidate Standings"
            className="ems-card p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1F2E26] pb-4">
              <div>
                <h2 className="text-lg font-semibold text-[#F3F4F6]">
                  Candidate Standings
                </h2>
                <p className="mt-0.5 text-xs text-[#9CA3AF]">
                  Ranked by total votes descending with real-time emerald tally
                  bars.
                </p>
              </div>

              {(selectedRegionId !== "ALL" || selectedStationId !== "ALL") && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRegionId("ALL");
                    setSelectedStationId("ALL");
                  }}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#1F2E26] bg-[#090D0B] px-3 py-1.5 text-xs font-medium text-[#10B981] hover:border-[#10B981]/50 hover:text-[#22C55E]"
                >
                  <Filter className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Reset Filters</span>
                </button>
              )}
            </div>

            {isLoadingElection ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-sm text-[#9CA3AF]">
                <Loader2
                  className="h-7 w-7 animate-spin text-[#10B981]"
                  aria-hidden="true"
                />
                <span>Loading election tallies...</span>
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="mt-6 rounded-xl border border-dashed border-[#1F2E26] bg-[#090D0B]/70 p-12 text-center">
                <p className="text-sm font-semibold text-[#F3F4F6]">
                  No candidates match the selected filters
                </p>
                <p className="mt-1 text-xs text-[#9CA3AF]">
                  Switch elections or clear the Region / Polling Station filters
                  to view all candidates.
                </p>
              </div>
            ) : (
              <div className="mt-5 space-y-3.5">
                {leaderboard.map(({ candidate, votes, percentage, rank }) => {
                  const isLeader = rank === 1 && votes > 0;
                  const barWidth = Math.min(100, Math.max(0, percentage));

                  return (
                    <article
                      key={candidate.candidate_id}
                      className={`rounded-xl border p-4 transition-all sm:p-5 ${
                        isLeader
                          ? "border-[#10B981]/50 bg-[#052E16]/35"
                          : "border-[#1F2E26] bg-[#090D0B]/75"
                      }`}
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        {/* Left: Rank + Symbol Image + Candidate & Party */}
                        <div className="flex items-center gap-3.5">
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-mono text-sm font-bold ${
                              isLeader
                                ? "bg-[#10B981] text-[#090D0B]"
                                : "border border-[#1F2E26] bg-[#111814] text-[#9CA3AF]"
                            }`}
                          >
                            #{rank}
                          </div>

                          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#1F2E26] bg-[#111814] p-1.5">
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

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-base font-bold text-[#F3F4F6]">
                                {candidate.name}
                              </h3>
                              {isLeader && (
                                <span className="ems-badge-emerald rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold uppercase">
                                  Leading
                                </span>
                              )}
                            </div>

                            <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs">
                              <span className="font-medium text-[#10B981]">
                                {candidate.political_party?.party_name ??
                                  "Independent"}
                              </span>
                              {candidate.election_symbol?.symbol_name && (
                                <span className="text-[#9CA3AF]">
                                  &bull; {candidate.election_symbol.symbol_name}
                                </span>
                              )}
                              {candidate.region?.region_name && (
                                <span className="text-[#9CA3AF]">
                                  &bull; {candidate.region.region_name}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right: Vote Count & Percentage */}
                        <div className="flex items-baseline justify-between gap-4 sm:flex-col sm:items-end sm:gap-0.5">
                          <span className="font-mono text-2xl font-bold text-[#F3F4F6]">
                            {votes.toLocaleString()}
                            <span className="ml-1.5 text-xs font-normal text-[#9CA3AF]">
                              {votes === 1 ? "vote" : "votes"}
                            </span>
                          </span>
                          <span className="font-mono text-sm font-semibold text-[#22C55E]">
                            {percentage.toFixed(1)}%
                          </span>
                        </div>
                      </div>

                      {/* Emerald Green Percentage Progress Bar */}
                      <div
                        role="progressbar"
                        aria-label={`${candidate.name} vote share`}
                        aria-valuenow={Number(percentage.toFixed(1))}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        className="mt-4 h-2.5 w-full overflow-hidden rounded-full border border-[#1F2E26] bg-[#111814]"
                      >
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#10B981] to-[#22C55E] transition-all duration-500 ease-out"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
