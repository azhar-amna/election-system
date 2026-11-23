"use client";

import { useMemo, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Image as ImageIcon,
  Loader2,
  Plus,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type {
  CandidateWithRelations,
  Election,
  ElectionStatus,
  ElectionSymbol,
  PoliticalParty,
  Region,
} from "@/types/database";

interface CandidatesClientProps {
  initialCandidates: CandidateWithRelations[];
  elections: Election[];
  regions: Region[];
  parties: PoliticalParty[];
  symbols: ElectionSymbol[];
  loadError?: string | null;
}

const GENDER_OPTIONS = ["Male", "Female", "Other"] as const;

function getElectionStatusClass(status: ElectionStatus | undefined): string {
  if (status === "ACTIVE") return "ems-badge-emerald";
  if (status === "CLOSED") return "ems-badge-danger";
  return "ems-badge-warning";
}

export default function CandidatesClient({
  initialCandidates,
  elections,
  regions,
  parties,
  symbols,
  loadError,
}: CandidatesClientProps) {
  const router = useRouter();

  const [candidates, setCandidates] =
    useState<CandidateWithRelations[]>(initialCandidates);

  // Add candidate form state
  const [name, setName] = useState("");
  const [gender, setGender] = useState("");
  const [religion, setReligion] = useState("");
  const [partyId, setPartyId] = useState("");
  const [symbolId, setSymbolId] = useState("");
  const [regionId, setRegionId] = useState("");
  const [electionId, setElectionId] = useState(
    elections[0] ? String(elections[0].election_id) : ""
  );

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterElectionId, setFilterElectionId] = useState("ALL");
  const [filterRegionId, setFilterRegionId] = useState("ALL");

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    loadError ?? null
  );
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const selectedSymbol = useMemo(
    () => symbols.find((s) => String(s.symbol_id) === symbolId) ?? null,
    [symbols, symbolId]
  );

  const filteredCandidates = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return candidates.filter((candidate) => {
      if (
        filterElectionId !== "ALL" &&
        String(candidate.election_id) !== filterElectionId
      ) {
        return false;
      }

      if (
        filterRegionId !== "ALL" &&
        String(candidate.region_id) !== filterRegionId
      ) {
        return false;
      }

      if (!q) return true;

      const haystack = [
        candidate.name,
        candidate.political_party?.party_name,
        candidate.election_symbol?.symbol_name,
        candidate.region?.region_name,
        candidate.election?.title,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [candidates, filterElectionId, filterRegionId, searchQuery]);

  const missingRequiredSetup = elections.length === 0 || regions.length === 0;

  async function handleAddCandidate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const trimmedName = name.trim();
    const parsedElectionId = Number(electionId);
    const parsedRegionId = Number(regionId);
    const parsedPartyId = partyId ? Number(partyId) : null;
    const parsedSymbolId = symbolId ? Number(symbolId) : null;

    if (!trimmedName) {
      setErrorMessage("Please enter the candidate's full name.");
      return;
    }
    if (!electionId || !Number.isInteger(parsedElectionId)) {
      setErrorMessage("Please select an election.");
      return;
    }
    if (!regionId || !Number.isInteger(parsedRegionId)) {
      setErrorMessage("Please select an electoral region.");
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("candidate")
        .insert({
          name: trimmedName,
          gender: gender.trim() || null,
          religion: religion.trim() || null,
          party_id: parsedPartyId,
          symbol_id: parsedSymbolId,
          region_id: parsedRegionId,
          election_id: parsedElectionId,
        })
        .select(
          "*, political_party(*), election_symbol(*), region(*), election(*)"
        )
        .single();

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if (data) {
        setCandidates((prev) => [data, ...prev]);
      }

      setName("");
      setGender("");
      setReligion("");
      setPartyId("");
      setSymbolId("");
      setSuccessMessage(`Candidate "${trimmedName}" added to the ballot roster.`);
      router.refresh();
    } catch {
      setErrorMessage("Unable to add candidate right now.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteCandidate(candidate: CandidateWithRelations) {
    setErrorMessage(null);
    setSuccessMessage(null);
    setDeletingId(candidate.candidate_id);

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("candidate")
        .delete()
        .eq("candidate_id", candidate.candidate_id);

      if (error) {
        if (error.code === "23503") {
          setErrorMessage(
            `Cannot delete "${candidate.name}" because election results already reference this candidate.`
          );
        } else {
          setErrorMessage(error.message);
        }
        return;
      }

      setCandidates((prev) =>
        prev.filter((item) => item.candidate_id !== candidate.candidate_id)
      );
      setConfirmDeleteId(null);
      setSuccessMessage(`Candidate "${candidate.name}" removed.`);
      router.refresh();
    } catch {
      setErrorMessage("Unable to delete candidate right now.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="ems-badge-emerald inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[11px] font-semibold tracking-wider uppercase">
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            Candidate Roster
          </span>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-[#F3F4F6] sm:text-3xl">
            Manage Candidates
          </h1>
          <p className="mt-1 text-sm text-[#9CA3AF]">
            Add and remove ballot candidates, linking each candidate to their
            election, constituency, political party, and election symbol.
          </p>
        </div>

        <span className="self-start rounded-lg border border-[#1F2E26] bg-[#111814] px-3.5 py-2 font-mono text-xs text-[#F3F4F6] sm:self-auto">
          {candidates.length} Registered{" "}
          {candidates.length === 1 ? "Candidate" : "Candidates"}
        </span>
      </div>

      {/* Prerequisite Setup Warning */}
      {missingRequiredSetup && (
        <div className="flex flex-col justify-between gap-3 rounded-xl border border-[#F59E0B]/40 bg-[#291C06]/65 p-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-2.5 text-sm text-[#F59E0B]">
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
            />
            <span>
              You need at least one{" "}
              <strong className="text-[#F3F4F6]">Election</strong> and one{" "}
              <strong className="text-[#F3F4F6]">Region</strong> configured
              before registering candidates.
            </span>
          </div>
          <Link
            href="/admin/elections"
            className="shrink-0 rounded-lg bg-[#F59E0B] px-3.5 py-2 text-center text-xs font-semibold text-[#090D0B] hover:bg-[#F59E0B]/90"
          >
            Go to Elections &amp; Setup
          </Link>
        </div>
      )}

      {/* Feedback Banners */}
      {successMessage && (
        <div
          role="status"
          className="flex items-start justify-between gap-3 rounded-xl border border-[#10B981]/40 bg-[#052E16]/75 p-4 text-sm text-[#22C55E]"
        >
          <span className="inline-flex items-start gap-2.5">
            <CheckCircle2
              className="mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
            />
            <span>{successMessage}</span>
          </span>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="cursor-pointer text-xs font-medium text-[#F3F4F6] hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

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

      {/* Add Candidate Form */}
      <section aria-label="Add New Candidate" className="ems-card p-6">
        <div className="border-b border-[#1F2E26] pb-4">
          <h2 className="text-base font-semibold text-[#F3F4F6]">
            Add Candidate to Ballot
          </h2>
          <p className="mt-0.5 text-xs text-[#9CA3AF]">
            Assign candidate personal details, political party, symbol, region,
            and target election.
          </p>
        </div>

        <form
          onSubmit={handleAddCandidate}
          noValidate
          className="mt-5 space-y-5"
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Candidate Name */}
            <div className="space-y-1.5 sm:col-span-2">
              <label
                htmlFor="candidate-name"
                className="block text-xs font-medium text-[#F3F4F6]"
              >
                Candidate Full Name <span className="text-[#EF4444]">*</span>
              </label>
              <input
                id="candidate-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full official ballot name"
                className="w-full rounded-lg border border-[#1F2E26] bg-[#090D0B] px-3 py-2.5 text-sm text-[#F3F4F6] placeholder-[#6B7280] focus:border-[#10B981] focus:outline-none"
              />
            </div>

            {/* Gender */}
            <div className="space-y-1.5">
              <label
                htmlFor="candidate-gender"
                className="block text-xs font-medium text-[#F3F4F6]"
              >
                Gender
              </label>
              <select
                id="candidate-gender"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full rounded-lg border border-[#1F2E26] bg-[#090D0B] px-3 py-2.5 text-sm text-[#F3F4F6] focus:border-[#10B981] focus:outline-none"
              >
                <option value="">Select gender</option>
                {GENDER_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            {/* Religion */}
            <div className="space-y-1.5">
              <label
                htmlFor="candidate-religion"
                className="block text-xs font-medium text-[#F3F4F6]"
              >
                Religion
              </label>
              <input
                id="candidate-religion"
                type="text"
                value={religion}
                onChange={(e) => setReligion(e.target.value)}
                placeholder="e.g. Islam, Christianity, Hinduism"
                className="w-full rounded-lg border border-[#1F2E26] bg-[#090D0B] px-3 py-2.5 text-sm text-[#F3F4F6] placeholder-[#6B7280] focus:border-[#10B981] focus:outline-none"
              />
            </div>

            {/* Election */}
            <div className="space-y-1.5">
              <label
                htmlFor="candidate-election"
                className="block text-xs font-medium text-[#F3F4F6]"
              >
                Election <span className="text-[#EF4444]">*</span>
              </label>
              <select
                id="candidate-election"
                required
                disabled={elections.length === 0}
                value={electionId}
                onChange={(e) => setElectionId(e.target.value)}
                className="w-full rounded-lg border border-[#1F2E26] bg-[#090D0B] px-3 py-2.5 text-sm text-[#F3F4F6] focus:border-[#10B981] focus:outline-none disabled:opacity-60"
              >
                <option value="" disabled>
                  {elections.length === 0
                    ? "No elections available"
                    : "Select election"}
                </option>
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

            {/* Region */}
            <div className="space-y-1.5">
              <label
                htmlFor="candidate-region"
                className="block text-xs font-medium text-[#F3F4F6]"
              >
                Electoral Region <span className="text-[#EF4444]">*</span>
              </label>
              <select
                id="candidate-region"
                required
                disabled={regions.length === 0}
                value={regionId}
                onChange={(e) => setRegionId(e.target.value)}
                className="w-full rounded-lg border border-[#1F2E26] bg-[#090D0B] px-3 py-2.5 text-sm text-[#F3F4F6] focus:border-[#10B981] focus:outline-none disabled:opacity-60"
              >
                <option value="" disabled>
                  {regions.length === 0
                    ? "No regions available"
                    : "Select region"}
                </option>
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

            {/* Political Party */}
            <div className="space-y-1.5">
              <label
                htmlFor="candidate-party"
                className="block text-xs font-medium text-[#F3F4F6]"
              >
                Political Party
              </label>
              <select
                id="candidate-party"
                value={partyId}
                onChange={(e) => setPartyId(e.target.value)}
                className="w-full rounded-lg border border-[#1F2E26] bg-[#090D0B] px-3 py-2.5 text-sm text-[#F3F4F6] focus:border-[#10B981] focus:outline-none"
              >
                <option value="">Independent (No Party)</option>
                {parties.map((party) => (
                  <option key={party.party_id} value={String(party.party_id)}>
                    {party.party_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Election Symbol */}
            <div className="space-y-1.5">
              <label
                htmlFor="candidate-symbol"
                className="block text-xs font-medium text-[#F3F4F6]"
              >
                Election Symbol
              </label>
              <select
                id="candidate-symbol"
                value={symbolId}
                onChange={(e) => setSymbolId(e.target.value)}
                className="w-full rounded-lg border border-[#1F2E26] bg-[#090D0B] px-3 py-2.5 text-sm text-[#F3F4F6] focus:border-[#10B981] focus:outline-none"
              >
                <option value="">No symbol assigned</option>
                {symbols.map((symbol) => (
                  <option
                    key={symbol.symbol_id}
                    value={String(symbol.symbol_id)}
                  >
                    {symbol.symbol_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col items-stretch justify-between gap-4 border-t border-[#1F2E26] pt-4 sm:flex-row sm:items-center">
            {/* Live Selected Symbol Preview */}
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#1F2E26] bg-[#090D0B] p-1">
                {selectedSymbol?.image_url ? (
                  <Image
                    unoptimized
                    src={selectedSymbol.image_url}
                    alt={selectedSymbol.symbol_name}
                    width={40}
                    height={40}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <ImageIcon
                    className="h-4 w-4 text-[#6B7280]"
                    aria-hidden="true"
                  />
                )}
              </div>
              <div className="text-xs">
                <p className="font-medium text-[#F3F4F6]">
                  {selectedSymbol
                    ? `Selected Symbol: ${selectedSymbol.symbol_name}`
                    : "Symbol Preview"}
                </p>
                <p className="text-[#9CA3AF]">
                  {selectedSymbol
                    ? "Displayed alongside the candidate on the voting ballot."
                    : "Choose an election symbol above to preview its thumbnail."}
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || missingRequiredSetup}
              className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#10B981] px-5 py-2.5 text-sm font-semibold text-[#090D0B] transition-colors hover:bg-[#22C55E] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                  <span>Adding Candidate...</span>
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  <span>Add Candidate</span>
                </>
              )}
            </button>
          </div>
        </form>
      </section>

      {/* Candidates Table & Filters */}
      <section aria-label="Registered Candidates Directory" className="ems-card p-6">
        <div className="flex flex-col gap-3 border-b border-[#1F2E26] pb-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-base font-semibold text-[#F3F4F6]">
              Candidate Directory
            </h2>
            <p className="mt-0.5 text-xs text-[#9CA3AF]">
              Showing {filteredCandidates.length} of {candidates.length}{" "}
              candidates.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[#9CA3AF]"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name, party, symbol..."
                aria-label="Search candidates"
                className="w-52 rounded-lg border border-[#1F2E26] bg-[#090D0B] py-2 pr-3 pl-8 text-xs text-[#F3F4F6] placeholder-[#6B7280] focus:border-[#10B981] focus:outline-none"
              />
            </div>

            <select
              aria-label="Filter by election"
              value={filterElectionId}
              onChange={(e) => setFilterElectionId(e.target.value)}
              className="rounded-lg border border-[#1F2E26] bg-[#090D0B] px-3 py-2 text-xs text-[#F3F4F6] focus:border-[#10B981] focus:outline-none"
            >
              <option value="ALL">All Elections</option>
              {elections.map((election) => (
                <option
                  key={election.election_id}
                  value={String(election.election_id)}
                >
                  {election.title}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by region"
              value={filterRegionId}
              onChange={(e) => setFilterRegionId(e.target.value)}
              className="rounded-lg border border-[#1F2E26] bg-[#090D0B] px-3 py-2 text-xs text-[#F3F4F6] focus:border-[#10B981] focus:outline-none"
            >
              <option value="ALL">All Regions</option>
              {regions.map((region) => (
                <option key={region.region_id} value={String(region.region_id)}>
                  {region.region_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filteredCandidates.length === 0 ? (
          <div className="mt-6 rounded-lg border border-dashed border-[#1F2E26] bg-[#090D0B]/60 p-10 text-center">
            <p className="text-sm font-medium text-[#F3F4F6]">
              {candidates.length === 0
                ? "No candidates registered yet"
                : "No candidates match your active filters"}
            </p>
            <p className="mt-1 text-xs text-[#9CA3AF]">
              {candidates.length === 0
                ? "Use the form above to add candidates to an election."
                : "Try clearing the search query or selecting All Elections / All Regions."}
            </p>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-lg border border-[#1F2E26]">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#1F2E26] bg-[#090D0B] font-mono text-[11px] text-[#9CA3AF] uppercase">
                <tr>
                  <th className="px-4 py-3">Symbol &amp; Candidate</th>
                  <th className="px-4 py-3">Political Party</th>
                  <th className="px-4 py-3">Region</th>
                  <th className="px-4 py-3">Election</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1F2E26] bg-[#090D0B]/50">
                {filteredCandidates.map((candidate) => {
                  const isConfirming =
                    confirmDeleteId === candidate.candidate_id;
                  const isDeleting = deletingId === candidate.candidate_id;

                  return (
                    <tr
                      key={candidate.candidate_id}
                      className="hover:bg-[#161F1A]/50"
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#1F2E26] bg-[#111814] p-1">
                            {candidate.election_symbol?.image_url ? (
                              <Image
                                unoptimized
                                src={candidate.election_symbol.image_url}
                                alt={candidate.election_symbol.symbol_name}
                                width={40}
                                height={40}
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
                            <p className="font-semibold text-[#F3F4F6]">
                              {candidate.name}
                            </p>
                            <p className="mt-0.5 text-xs text-[#9CA3AF]">
                              {[
                                candidate.election_symbol?.symbol_name
                                  ? `Symbol: ${candidate.election_symbol.symbol_name}`
                                  : null,
                                candidate.gender,
                                candidate.religion,
                              ]
                                .filter(Boolean)
                                .join(" • ") || "No extra metadata"}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        {candidate.political_party ? (
                          <div>
                            <p className="font-medium text-[#F3F4F6]">
                              {candidate.political_party.party_name}
                            </p>
                            {candidate.political_party.leader && (
                              <p className="text-xs text-[#9CA3AF]">
                                Leader: {candidate.political_party.leader}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="rounded border border-[#1F2E26] bg-[#111814] px-2 py-0.5 text-xs text-[#9CA3AF]">
                            Independent
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        <span className="ems-badge-emerald rounded px-2 py-0.5 text-xs">
                          {candidate.region?.region_name ??
                            `Region #${candidate.region_id}`}
                        </span>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="flex flex-col items-start gap-1">
                          <span className="text-xs font-medium text-[#F3F4F6]">
                            {candidate.election?.title ??
                              `Election #${candidate.election_id}`}
                          </span>
                          {candidate.election?.status && (
                            <span
                              className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${getElectionStatusClass(
                                candidate.election.status
                              )}`}
                            >
                              {candidate.election.status}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        {isConfirming ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={isDeleting}
                              onClick={() => handleDeleteCandidate(candidate)}
                              className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-[#EF4444] px-2.5 py-1 text-xs font-semibold text-[#090D0B] hover:bg-[#EF4444]/90 disabled:opacity-60"
                            >
                              {isDeleting && (
                                <Loader2
                                  className="h-3 w-3 animate-spin"
                                  aria-hidden="true"
                                />
                              )}
                              Confirm
                            </button>
                            <button
                              type="button"
                              disabled={isDeleting}
                              onClick={() => setConfirmDeleteId(null)}
                              className="cursor-pointer rounded-md border border-[#1F2E26] px-2 py-1 text-xs text-[#9CA3AF] hover:text-[#F3F4F6]"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmDeleteId(candidate.candidate_id)
                            }
                            className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-[#1F2E26] px-2.5 py-1 text-xs text-[#9CA3AF] transition-colors hover:border-[#EF4444]/50 hover:bg-[#2A0D10] hover:text-[#EF4444]"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Delete</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
