"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle2,
  Flag,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Plus,
  Radio,
  Trash2,
  Upload,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type {
  Election,
  ElectionStatus,
  ElectionSymbol,
  PoliticalParty,
  PollingStationWithRegion,
  Region,
} from "@/types/database";

type SetupTab = "elections" | "regions" | "stations" | "parties" | "symbols";

interface ElectionsSetupClientProps {
  initialElections: Election[];
  initialRegions: Region[];
  initialStations: PollingStationWithRegion[];
  initialParties: PoliticalParty[];
  initialSymbols: ElectionSymbol[];
  loadError?: string | null;
}

const ELECTION_STATUSES: ElectionStatus[] = ["DRAFT", "ACTIVE", "CLOSED"];
const MAX_SYMBOL_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const REGION_TYPE_SUGGESTIONS = [
  "National Assembly",
  "Provincial Assembly",
  "Municipal",
  "Federal",
] as const;

function formatDisplayDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(parsed);
}

function getFriendlyDeleteError(
  error: { code?: string; message: string },
  entityLabel: string
): string {
  if (error.code === "23503") {
    return `Cannot delete this ${entityLabel} because other records (such as stations, voters, candidates, or results) still reference it.`;
  }
  return error.message;
}

function getStatusBadgeClasses(status: ElectionStatus): string {
  if (status === "ACTIVE") return "ems-badge-emerald";
  if (status === "CLOSED") return "ems-badge-danger";
  return "ems-badge-warning";
}

export default function ElectionsSetupClient({
  initialElections,
  initialRegions,
  initialStations,
  initialParties,
  initialSymbols,
  loadError,
}: ElectionsSetupClientProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [activeTab, setActiveTab] = useState<SetupTab>("elections");

  // Entity lists
  const [elections, setElections] = useState<Election[]>(initialElections);
  const [regions, setRegions] = useState<Region[]>(initialRegions);
  const [stations, setStations] =
    useState<PollingStationWithRegion[]>(initialStations);
  const [parties, setParties] = useState<PoliticalParty[]>(initialParties);
  const [symbols, setSymbols] = useState<ElectionSymbol[]>(initialSymbols);

  // Feedback banners
  const [errorMessage, setErrorMessage] = useState<string | null>(
    loadError ?? null
  );
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Inline 2-click delete confirmation key (e.g. "region:4")
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  // Election form state
  const [electionTitle, setElectionTitle] = useState("");
  const [electionStartDate, setElectionStartDate] = useState("");
  const [electionEndDate, setElectionEndDate] = useState("");
  const [isCreatingElection, setIsCreatingElection] = useState(false);

  // Region form state
  const [regionName, setRegionName] = useState("");
  const [regionLocation, setRegionLocation] = useState("");
  const [regionType, setRegionType] = useState("");
  const [isCreatingRegion, setIsCreatingRegion] = useState(false);

  // Polling station form state
  const [stationName, setStationName] = useState("");
  const [stationLocation, setStationLocation] = useState("");
  const [stationRegionId, setStationRegionId] = useState("");
  const [isCreatingStation, setIsCreatingStation] = useState(false);

  // Political party form state
  const [partyName, setPartyName] = useState("");
  const [partyLeader, setPartyLeader] = useState("");
  const [isCreatingParty, setIsCreatingParty] = useState(false);

  // Election symbol form state
  const [symbolName, setSymbolName] = useState("");
  const [symbolFile, setSymbolFile] = useState<File | null>(null);
  const [symbolPreviewUrl, setSymbolPreviewUrl] = useState<string | null>(null);
  const [isCreatingSymbol, setIsCreatingSymbol] = useState(false);

  useEffect(() => {
    return () => {
      if (symbolPreviewUrl) {
        URL.revokeObjectURL(symbolPreviewUrl);
      }
    };
  }, [symbolPreviewUrl]);

  function clearFeedback() {
    setErrorMessage(null);
    setSuccessMessage(null);
  }

  function handleSymbolFileChange(event: ChangeEvent<HTMLInputElement>) {
    clearFeedback();
    const file = event.target.files?.[0] ?? null;

    if (symbolPreviewUrl) {
      URL.revokeObjectURL(symbolPreviewUrl);
      setSymbolPreviewUrl(null);
    }

    if (!file) {
      setSymbolFile(null);
      return;
    }

    if (!file.type.startsWith("image/")) {
      setErrorMessage("Please select a valid image file (PNG, JPG, WebP, SVG).");
      setSymbolFile(null);
      event.target.value = "";
      return;
    }

    if (file.size > MAX_SYMBOL_SIZE_BYTES) {
      setErrorMessage("Symbol image must be 5 MB or smaller.");
      setSymbolFile(null);
      event.target.value = "";
      return;
    }

    setSymbolFile(file);
    setSymbolPreviewUrl(URL.createObjectURL(file));
  }

  // ---------------------------------------------------------------------------
  // 1. Elections CRUD & Status Switching
  // ---------------------------------------------------------------------------

  async function handleCreateElection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearFeedback();

    const title = electionTitle.trim();
    if (!title || !electionStartDate || !electionEndDate) {
      setErrorMessage("Please provide an election title, start date, and end date.");
      return;
    }

    if (electionEndDate < electionStartDate) {
      setErrorMessage("Election end date must be on or after the start date.");
      return;
    }

    setIsCreatingElection(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("election")
        .insert({
          title,
          start_date: electionStartDate,
          end_date: electionEndDate,
          status: "DRAFT",
        })
        .select("*")
        .single();

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if (data) {
        setElections((prev) => [data, ...prev]);
      }

      setElectionTitle("");
      setElectionStartDate("");
      setElectionEndDate("");
      setSuccessMessage(`Election "${title}" created in DRAFT status.`);
      router.refresh();
    } catch {
      setErrorMessage("Unable to create election right now.");
    } finally {
      setIsCreatingElection(false);
    }
  }

  async function handleChangeElectionStatus(
    electionId: number,
    nextStatus: ElectionStatus
  ) {
    clearFeedback();
    const key = `election-status:${electionId}:${nextStatus}`;
    setBusyKey(key);

    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("election")
        .update({ status: nextStatus })
        .eq("election_id", electionId)
        .select("*")
        .single();

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if (data) {
        setElections((prev) =>
          prev.map((item) => (item.election_id === electionId ? data : item))
        );
        setSuccessMessage(
          `Updated "${data.title}" status to ${data.status}.`
        );
      }
      router.refresh();
    } catch {
      setErrorMessage("Unable to update election status right now.");
    } finally {
      setBusyKey(null);
    }
  }

  // ---------------------------------------------------------------------------
  // 2. Regions Create & Delete
  // ---------------------------------------------------------------------------

  async function handleCreateRegion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearFeedback();

    const trimmedName = regionName.trim();
    if (!trimmedName) {
      setErrorMessage("Please enter a region name.");
      return;
    }

    setIsCreatingRegion(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("region")
        .insert({
          region_name: trimmedName,
          location: regionLocation.trim() || null,
          type: regionType.trim() || null,
        })
        .select("*")
        .single();

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if (data) {
        setRegions((prev) =>
          [...prev, data].sort((a, b) =>
            a.region_name.localeCompare(b.region_name)
          )
        );
      }

      setRegionName("");
      setRegionLocation("");
      setRegionType("");
      setSuccessMessage(`Region "${trimmedName}" added.`);
      router.refresh();
    } catch {
      setErrorMessage("Unable to create region right now.");
    } finally {
      setIsCreatingRegion(false);
    }
  }

  async function handleDeleteRegion(region: Region) {
    clearFeedback();
    const key = `region:${region.region_id}`;
    setBusyKey(key);

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("region")
        .delete()
        .eq("region_id", region.region_id);

      if (error) {
        setErrorMessage(getFriendlyDeleteError(error, "region"));
        return;
      }

      setRegions((prev) =>
        prev.filter((item) => item.region_id !== region.region_id)
      );
      setConfirmDeleteKey(null);
      setSuccessMessage(`Region "${region.region_name}" deleted.`);
      router.refresh();
    } catch {
      setErrorMessage("Unable to delete region right now.");
    } finally {
      setBusyKey(null);
    }
  }

  // ---------------------------------------------------------------------------
  // 3. Polling Stations Create & Delete
  // ---------------------------------------------------------------------------

  async function handleCreateStation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearFeedback();

    const trimmedName = stationName.trim();
    const parsedRegionId = Number(stationRegionId);

    if (!trimmedName) {
      setErrorMessage("Please enter a polling station name.");
      return;
    }
    if (!stationRegionId || !Number.isInteger(parsedRegionId)) {
      setErrorMessage("Please assign a region to the polling station.");
      return;
    }

    setIsCreatingStation(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("polling_station")
        .insert({
          name: trimmedName,
          location: stationLocation.trim() || null,
          region_id: parsedRegionId,
        })
        .select("*, region(*)")
        .single();

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if (data) {
        setStations((prev) =>
          [...prev, data].sort((a, b) => a.name.localeCompare(b.name))
        );
      }

      setStationName("");
      setStationLocation("");
      setStationRegionId("");
      setSuccessMessage(`Polling station "${trimmedName}" created.`);
      router.refresh();
    } catch {
      setErrorMessage("Unable to create polling station right now.");
    } finally {
      setIsCreatingStation(false);
    }
  }

  async function handleDeleteStation(station: PollingStationWithRegion) {
    clearFeedback();
    const key = `station:${station.station_id}`;
    setBusyKey(key);

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("polling_station")
        .delete()
        .eq("station_id", station.station_id);

      if (error) {
        setErrorMessage(getFriendlyDeleteError(error, "polling station"));
        return;
      }

      setStations((prev) =>
        prev.filter((item) => item.station_id !== station.station_id)
      );
      setConfirmDeleteKey(null);
      setSuccessMessage(`Polling station "${station.name}" deleted.`);
      router.refresh();
    } catch {
      setErrorMessage("Unable to delete polling station right now.");
    } finally {
      setBusyKey(null);
    }
  }

  // ---------------------------------------------------------------------------
  // 4. Political Parties Create & Delete
  // ---------------------------------------------------------------------------

  async function handleCreateParty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearFeedback();

    const trimmedName = partyName.trim();
    if (!trimmedName) {
      setErrorMessage("Please enter a political party name.");
      return;
    }

    setIsCreatingParty(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("political_party")
        .insert({
          party_name: trimmedName,
          leader: partyLeader.trim() || null,
        })
        .select("*")
        .single();

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if (data) {
        setParties((prev) =>
          [...prev, data].sort((a, b) =>
            a.party_name.localeCompare(b.party_name)
          )
        );
      }

      setPartyName("");
      setPartyLeader("");
      setSuccessMessage(`Political party "${trimmedName}" created.`);
      router.refresh();
    } catch {
      setErrorMessage("Unable to create political party right now.");
    } finally {
      setIsCreatingParty(false);
    }
  }

  async function handleDeleteParty(party: PoliticalParty) {
    clearFeedback();
    const key = `party:${party.party_id}`;
    setBusyKey(key);

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("political_party")
        .delete()
        .eq("party_id", party.party_id);

      if (error) {
        setErrorMessage(getFriendlyDeleteError(error, "political party"));
        return;
      }

      setParties((prev) =>
        prev.filter((item) => item.party_id !== party.party_id)
      );
      setConfirmDeleteKey(null);
      setSuccessMessage(`Political party "${party.party_name}" deleted.`);
      router.refresh();
    } catch {
      setErrorMessage("Unable to delete political party right now.");
    } finally {
      setBusyKey(null);
    }
  }

  // ---------------------------------------------------------------------------
  // 5. Election Symbols (Upload to `election-symbols` Storage Bucket + Insert)
  // ---------------------------------------------------------------------------

  async function handleCreateSymbol(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearFeedback();

    const trimmedName = symbolName.trim();
    if (!trimmedName) {
      setErrorMessage("Please enter an election symbol name.");
      return;
    }
    if (!symbolFile) {
      setErrorMessage("Please select an image file to upload for this symbol.");
      return;
    }

    setIsCreatingSymbol(true);

    try {
      const supabase = createClient();

      const extension =
        symbolFile.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ||
        "png";
      const safeSlug = trimmedName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 40) || "symbol";
      const uniquePath = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeSlug}.${extension}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("election-symbols")
        .upload(uniquePath, symbolFile, {
          cacheControl: "3600",
          upsert: false,
          contentType: symbolFile.type || undefined,
        });

      if (uploadError) {
        setErrorMessage(
          `Symbol upload failed (bucket "election-symbols"): ${uploadError.message}`
        );
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage
        .from("election-symbols")
        .getPublicUrl(uploadData.path);

      const { data: insertedSymbol, error: insertError } = await supabase
        .from("election_symbol")
        .insert({
          symbol_name: trimmedName,
          image_url: publicUrl,
        })
        .select("*")
        .single();

      if (insertError) {
        // Best-effort cleanup of uploaded file if DB insert failed
        await supabase.storage
          .from("election-symbols")
          .remove([uploadData.path]);
        setErrorMessage(insertError.message);
        return;
      }

      if (insertedSymbol) {
        setSymbols((prev) =>
          [...prev, insertedSymbol].sort((a, b) =>
            a.symbol_name.localeCompare(b.symbol_name)
          )
        );
      }

      setSymbolName("");
      setSymbolFile(null);
      if (symbolPreviewUrl) {
        URL.revokeObjectURL(symbolPreviewUrl);
        setSymbolPreviewUrl(null);
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      setSuccessMessage(
        `Election symbol "${trimmedName}" uploaded and saved.`
      );
      router.refresh();
    } catch {
      setErrorMessage("Unable to upload election symbol right now.");
    } finally {
      setIsCreatingSymbol(false);
    }
  }

  async function handleDeleteSymbol(symbol: ElectionSymbol) {
    clearFeedback();
    const key = `symbol:${symbol.symbol_id}`;
    setBusyKey(key);

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("election_symbol")
        .delete()
        .eq("symbol_id", symbol.symbol_id);

      if (error) {
        setErrorMessage(getFriendlyDeleteError(error, "election symbol"));
        return;
      }

      setSymbols((prev) =>
        prev.filter((item) => item.symbol_id !== symbol.symbol_id)
      );
      setConfirmDeleteKey(null);
      setSuccessMessage(`Election symbol "${symbol.symbol_name}" deleted.`);
      router.refresh();
    } catch {
      setErrorMessage("Unable to delete election symbol right now.");
    } finally {
      setBusyKey(null);
    }
  }

  const tabs: {
    id: SetupTab;
    label: string;
    count: number;
    icon: typeof Radio;
  }[] = [
    { id: "elections", label: "Elections", count: elections.length, icon: Radio },
    { id: "regions", label: "Regions", count: regions.length, icon: MapPin },
    {
      id: "stations",
      label: "Polling Stations",
      count: stations.length,
      icon: Building2,
    },
    {
      id: "parties",
      label: "Political Parties",
      count: parties.length,
      icon: Flag,
    },
    {
      id: "symbols",
      label: "Election Symbols",
      count: symbols.length,
      icon: ImageIcon,
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      {/* Page Header */}
      <div>
        <span className="ems-badge-emerald inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[11px] font-semibold tracking-wider uppercase">
          <Radio className="h-3.5 w-3.5" aria-hidden="true" />
          Elections &amp; Setup
        </span>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-[#F3F4F6] sm:text-3xl">
          Election Configuration &amp; Entities
        </h1>
        <p className="mt-1 text-sm text-[#9CA3AF]">
          Create elections, control voting lifecycle status, and manage regions,
          polling stations, political parties, and ballot symbols.
        </p>
      </div>

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

      {/* Tab Strip */}
      <div
        role="tablist"
        aria-label="Election Setup Sections"
        className="flex flex-wrap gap-2 border-b border-[#1F2E26] pb-3"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => {
                setActiveTab(tab.id);
                setConfirmDeleteKey(null);
              }}
              className={`inline-flex cursor-pointer items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-all ${
                isSelected
                  ? "border border-[#10B981]/45 bg-[#052E16] text-[#22C55E]"
                  : "border border-[#1F2E26] bg-[#111814] text-[#9CA3AF] hover:border-[#10B981]/30 hover:text-[#F3F4F6]"
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span>{tab.label}</span>
              <span
                className={`rounded-full px-2 py-0.5 font-mono text-[11px] ${
                  isSelected
                    ? "bg-[#10B981]/20 text-[#22C55E]"
                    : "bg-[#161F1A] text-[#9CA3AF]"
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: ELECTIONS */}
      {activeTab === "elections" && (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Create Election Form */}
          <section className="ems-card p-6 lg:col-span-4">
            <h2 className="text-base font-semibold text-[#F3F4F6]">
              Create Election
            </h2>
            <p className="mt-1 text-xs text-[#9CA3AF]">
              New elections start in{" "}
              <span className="font-mono text-[#F59E0B]">DRAFT</span> status
              until activated.
            </p>

            <form
              onSubmit={handleCreateElection}
              noValidate
              className="mt-5 space-y-4"
            >
              <div className="space-y-1.5">
                <label
                  htmlFor="election-title"
                  className="block text-xs font-medium text-[#F3F4F6]"
                >
                  Election Title <span className="text-[#EF4444]">*</span>
                </label>
                <input
                  id="election-title"
                  type="text"
                  required
                  value={electionTitle}
                  onChange={(e) => setElectionTitle(e.target.value)}
                  placeholder="e.g. General Election 2026"
                  className="w-full rounded-lg border border-[#1F2E26] bg-[#090D0B] px-3 py-2.5 text-sm text-[#F3F4F6] placeholder-[#6B7280] focus:border-[#10B981] focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="election-start"
                  className="block text-xs font-medium text-[#F3F4F6]"
                >
                  Start Date <span className="text-[#EF4444]">*</span>
                </label>
                <div className="relative">
                  <Calendar
                    className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]"
                    aria-hidden="true"
                  />
                  <input
                    id="election-start"
                    type="date"
                    required
                    value={electionStartDate}
                    onChange={(e) => setElectionStartDate(e.target.value)}
                    className="w-full rounded-lg border border-[#1F2E26] bg-[#090D0B] py-2.5 pr-3 pl-9 text-sm text-[#F3F4F6] focus:border-[#10B981] focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="election-end"
                  className="block text-xs font-medium text-[#F3F4F6]"
                >
                  End Date <span className="text-[#EF4444]">*</span>
                </label>
                <div className="relative">
                  <Calendar
                    className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]"
                    aria-hidden="true"
                  />
                  <input
                    id="election-end"
                    type="date"
                    required
                    value={electionEndDate}
                    onChange={(e) => setElectionEndDate(e.target.value)}
                    className="w-full rounded-lg border border-[#1F2E26] bg-[#090D0B] py-2.5 pr-3 pl-9 text-sm text-[#F3F4F6] focus:border-[#10B981] focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isCreatingElection}
                className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#10B981] px-4 py-2.5 text-sm font-semibold text-[#090D0B] transition-colors hover:bg-[#22C55E] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCreatingElection ? (
                  <>
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    <span>Create Election</span>
                  </>
                )}
              </button>
            </form>
          </section>

          {/* Elections List & Status Controls */}
          <section className="ems-card p-6 lg:col-span-8">
            <div className="flex items-center justify-between gap-2 border-b border-[#1F2E26] pb-4">
              <div>
                <h2 className="text-base font-semibold text-[#F3F4F6]">
                  Election Lifecycle Manager
                </h2>
                <p className="mt-0.5 text-xs text-[#9CA3AF]">
                  Switch elections between DRAFT, ACTIVE (ballot open), and
                  CLOSED.
                </p>
              </div>
              <span className="font-mono text-xs text-[#9CA3AF]">
                {elections.length} total
              </span>
            </div>

            {elections.length === 0 ? (
              <div className="mt-6 rounded-lg border border-dashed border-[#1F2E26] bg-[#090D0B]/60 p-8 text-center">
                <p className="text-sm font-medium text-[#F3F4F6]">
                  No elections created yet
                </p>
                <p className="mt-1 text-xs text-[#9CA3AF]">
                  Use the form on the left to schedule your first election.
                </p>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {elections.map((election) => (
                  <div
                    key={election.election_id}
                    className="flex flex-col justify-between gap-4 rounded-xl border border-[#1F2E26] bg-[#090D0B]/75 p-4 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h3 className="text-sm font-semibold text-[#F3F4F6]">
                          {election.title}
                        </h3>
                        <span
                          className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider uppercase ${getStatusBadgeClasses(
                            election.status
                          )}`}
                        >
                          {election.status}
                        </span>
                      </div>
                      <p className="font-mono text-xs text-[#9CA3AF]">
                        #{election.election_id} &bull;{" "}
                        {formatDisplayDate(election.start_date)} &rarr;{" "}
                        {formatDisplayDate(election.end_date)}
                      </p>
                    </div>

                    <div
                      role="group"
                      aria-label={`Change status for ${election.title}`}
                      className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[#1F2E26] bg-[#111814] p-1"
                    >
                      {ELECTION_STATUSES.map((statusOption) => {
                        const isCurrent = election.status === statusOption;
                        const isUpdating =
                          busyKey ===
                          `election-status:${election.election_id}:${statusOption}`;
                        return (
                          <button
                            key={statusOption}
                            type="button"
                            disabled={isCurrent || busyKey !== null}
                            onClick={() =>
                              handleChangeElectionStatus(
                                election.election_id,
                                statusOption
                              )
                            }
                            className={`inline-flex cursor-pointer items-center gap-1 rounded-md px-2.5 py-1.5 font-mono text-[11px] font-semibold transition-colors disabled:cursor-default ${
                              isCurrent
                                ? statusOption === "ACTIVE"
                                  ? "bg-[#10B981] text-[#090D0B]"
                                  : statusOption === "CLOSED"
                                    ? "bg-[#EF4444] text-[#090D0B]"
                                    : "bg-[#F59E0B] text-[#090D0B]"
                                : "text-[#9CA3AF] hover:bg-[#161F1A] hover:text-[#F3F4F6] disabled:opacity-50"
                            }`}
                          >
                            {isUpdating && (
                              <Loader2
                                className="h-3 w-3 animate-spin"
                                aria-hidden="true"
                              />
                            )}
                            <span>{statusOption}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB 2: REGIONS */}
      {activeTab === "regions" && (
        <div className="grid gap-6 lg:grid-cols-12">
          <section className="ems-card p-6 lg:col-span-4">
            <h2 className="text-base font-semibold text-[#F3F4F6]">
              Add Electoral Region
            </h2>
            <p className="mt-1 text-xs text-[#9CA3AF]">
              Define constituencies used by voters, polling stations, and
              candidates.
            </p>

            <form
              onSubmit={handleCreateRegion}
              noValidate
              className="mt-5 space-y-4"
            >
              <div className="space-y-1.5">
                <label
                  htmlFor="region-name"
                  className="block text-xs font-medium text-[#F3F4F6]"
                >
                  Region Name <span className="text-[#EF4444]">*</span>
                </label>
                <input
                  id="region-name"
                  type="text"
                  required
                  value={regionName}
                  onChange={(e) => setRegionName(e.target.value)}
                  placeholder="e.g. NA-128 Lahore"
                  className="w-full rounded-lg border border-[#1F2E26] bg-[#090D0B] px-3 py-2.5 text-sm text-[#F3F4F6] placeholder-[#6B7280] focus:border-[#10B981] focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="region-location"
                  className="block text-xs font-medium text-[#F3F4F6]"
                >
                  Location
                </label>
                <input
                  id="region-location"
                  type="text"
                  value={regionLocation}
                  onChange={(e) => setRegionLocation(e.target.value)}
                  placeholder="e.g. Lahore, Punjab"
                  className="w-full rounded-lg border border-[#1F2E26] bg-[#090D0B] px-3 py-2.5 text-sm text-[#F3F4F6] placeholder-[#6B7280] focus:border-[#10B981] focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="region-type"
                  className="block text-xs font-medium text-[#F3F4F6]"
                >
                  Type
                </label>
                <input
                  id="region-type"
                  type="text"
                  list="region-type-options"
                  value={regionType}
                  onChange={(e) => setRegionType(e.target.value)}
                  placeholder="e.g. National Assembly"
                  className="w-full rounded-lg border border-[#1F2E26] bg-[#090D0B] px-3 py-2.5 text-sm text-[#F3F4F6] placeholder-[#6B7280] focus:border-[#10B981] focus:outline-none"
                />
                <datalist id="region-type-options">
                  {REGION_TYPE_SUGGESTIONS.map((option) => (
                    <option key={option} value={option} />
                  ))}
                </datalist>
              </div>

              <button
                type="submit"
                disabled={isCreatingRegion}
                className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#10B981] px-4 py-2.5 text-sm font-semibold text-[#090D0B] transition-colors hover:bg-[#22C55E] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCreatingRegion ? (
                  <>
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                    <span>Adding Region...</span>
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    <span>Add Region</span>
                  </>
                )}
              </button>
            </form>
          </section>

          <section className="ems-card p-6 lg:col-span-8">
            <div className="flex items-center justify-between gap-2 border-b border-[#1F2E26] pb-4">
              <h2 className="text-base font-semibold text-[#F3F4F6]">
                Configured Regions
              </h2>
              <span className="font-mono text-xs text-[#9CA3AF]">
                {regions.length} total
              </span>
            </div>

            {regions.length === 0 ? (
              <div className="mt-6 rounded-lg border border-dashed border-[#1F2E26] bg-[#090D0B]/60 p-8 text-center">
                <p className="text-sm font-medium text-[#F3F4F6]">
                  No regions configured yet
                </p>
                <p className="mt-1 text-xs text-[#9CA3AF]">
                  Add electoral regions before creating polling stations or
                  candidates.
                </p>
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-lg border border-[#1F2E26]">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-[#1F2E26] bg-[#090D0B] font-mono text-[11px] text-[#9CA3AF] uppercase">
                    <tr>
                      <th className="px-4 py-3">Region</th>
                      <th className="px-4 py-3">Location</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1F2E26] bg-[#090D0B]/50">
                    {regions.map((region) => {
                      const delKey = `region:${region.region_id}`;
                      const isConfirming = confirmDeleteKey === delKey;
                      const isDeleting = busyKey === delKey;

                      return (
                        <tr key={region.region_id} className="hover:bg-[#161F1A]/50">
                          <td className="px-4 py-3 font-medium text-[#F3F4F6]">
                            {region.region_name}
                          </td>
                          <td className="px-4 py-3 text-[#9CA3AF]">
                            {region.location ?? "—"}
                          </td>
                          <td className="px-4 py-3">
                            {region.type ? (
                              <span className="rounded border border-[#1F2E26] bg-[#111814] px-2 py-0.5 text-xs text-[#10B981]">
                                {region.type}
                              </span>
                            ) : (
                              <span className="text-[#6B7280]">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {isConfirming ? (
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  disabled={isDeleting}
                                  onClick={() => handleDeleteRegion(region)}
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
                                  onClick={() => setConfirmDeleteKey(null)}
                                  className="cursor-pointer rounded-md border border-[#1F2E26] px-2 py-1 text-xs text-[#9CA3AF] hover:text-[#F3F4F6]"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteKey(delKey)}
                                className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-[#1F2E26] px-2.5 py-1 text-xs text-[#9CA3AF] transition-colors hover:border-[#EF4444]/50 hover:bg-[#2A0D10] hover:text-[#EF4444]"
                              >
                                <Trash2
                                  className="h-3.5 w-3.5"
                                  aria-hidden="true"
                                />
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
      )}

      {/* TAB 3: POLLING STATIONS */}
      {activeTab === "stations" && (
        <div className="grid gap-6 lg:grid-cols-12">
          <section className="ems-card p-6 lg:col-span-4">
            <h2 className="text-base font-semibold text-[#F3F4F6]">
              Add Polling Station
            </h2>
            <p className="mt-1 text-xs text-[#9CA3AF]">
              Assign physical voting stations to electoral regions.
            </p>

            <form
              onSubmit={handleCreateStation}
              noValidate
              className="mt-5 space-y-4"
            >
              <div className="space-y-1.5">
                <label
                  htmlFor="station-name"
                  className="block text-xs font-medium text-[#F3F4F6]"
                >
                  Station Name <span className="text-[#EF4444]">*</span>
                </label>
                <input
                  id="station-name"
                  type="text"
                  required
                  value={stationName}
                  onChange={(e) => setStationName(e.target.value)}
                  placeholder="e.g. Govt. High School Block A"
                  className="w-full rounded-lg border border-[#1F2E26] bg-[#090D0B] px-3 py-2.5 text-sm text-[#F3F4F6] placeholder-[#6B7280] focus:border-[#10B981] focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="station-location"
                  className="block text-xs font-medium text-[#F3F4F6]"
                >
                  Location / Address
                </label>
                <input
                  id="station-location"
                  type="text"
                  value={stationLocation}
                  onChange={(e) => setStationLocation(e.target.value)}
                  placeholder="e.g. Model Town, Sector C"
                  className="w-full rounded-lg border border-[#1F2E26] bg-[#090D0B] px-3 py-2.5 text-sm text-[#F3F4F6] placeholder-[#6B7280] focus:border-[#10B981] focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="station-region"
                  className="block text-xs font-medium text-[#F3F4F6]"
                >
                  Region <span className="text-[#EF4444]">*</span>
                </label>
                <select
                  id="station-region"
                  required
                  disabled={regions.length === 0}
                  value={stationRegionId}
                  onChange={(e) => setStationRegionId(e.target.value)}
                  className="w-full rounded-lg border border-[#1F2E26] bg-[#090D0B] px-3 py-2.5 text-sm text-[#F3F4F6] focus:border-[#10B981] focus:outline-none disabled:opacity-60"
                >
                  <option value="" disabled>
                    {regions.length === 0
                      ? "Create a region first"
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
                {regions.length === 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab("regions")}
                    className="cursor-pointer text-xs font-medium text-[#F59E0B] hover:underline"
                  >
                    Switch to Regions tab to create one &rarr;
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={isCreatingStation || regions.length === 0}
                className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#10B981] px-4 py-2.5 text-sm font-semibold text-[#090D0B] transition-colors hover:bg-[#22C55E] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCreatingStation ? (
                  <>
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                    <span>Adding Station...</span>
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    <span>Add Polling Station</span>
                  </>
                )}
              </button>
            </form>
          </section>

          <section className="ems-card p-6 lg:col-span-8">
            <div className="flex items-center justify-between gap-2 border-b border-[#1F2E26] pb-4">
              <h2 className="text-base font-semibold text-[#F3F4F6]">
                Registered Polling Stations
              </h2>
              <span className="font-mono text-xs text-[#9CA3AF]">
                {stations.length} total
              </span>
            </div>

            {stations.length === 0 ? (
              <div className="mt-6 rounded-lg border border-dashed border-[#1F2E26] bg-[#090D0B]/60 p-8 text-center">
                <p className="text-sm font-medium text-[#F3F4F6]">
                  No polling stations yet
                </p>
                <p className="mt-1 text-xs text-[#9CA3AF]">
                  Add polling stations so approved voters can select a station
                  when casting their ballot.
                </p>
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-lg border border-[#1F2E26]">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-[#1F2E26] bg-[#090D0B] font-mono text-[11px] text-[#9CA3AF] uppercase">
                    <tr>
                      <th className="px-4 py-3">Station Name</th>
                      <th className="px-4 py-3">Location</th>
                      <th className="px-4 py-3">Region</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1F2E26] bg-[#090D0B]/50">
                    {stations.map((station) => {
                      const delKey = `station:${station.station_id}`;
                      const isConfirming = confirmDeleteKey === delKey;
                      const isDeleting = busyKey === delKey;
                      const stationRegion =
                        station.region ??
                        regions.find((r) => r.region_id === station.region_id);

                      return (
                        <tr
                          key={station.station_id}
                          className="hover:bg-[#161F1A]/50"
                        >
                          <td className="px-4 py-3 font-medium text-[#F3F4F6]">
                            {station.name}
                          </td>
                          <td className="px-4 py-3 text-[#9CA3AF]">
                            {station.location ?? "—"}
                          </td>
                          <td className="px-4 py-3">
                            <span className="ems-badge-emerald rounded px-2 py-0.5 text-xs">
                              {stationRegion?.region_name ??
                                `Region #${station.region_id}`}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {isConfirming ? (
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  disabled={isDeleting}
                                  onClick={() => handleDeleteStation(station)}
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
                                  onClick={() => setConfirmDeleteKey(null)}
                                  className="cursor-pointer rounded-md border border-[#1F2E26] px-2 py-1 text-xs text-[#9CA3AF] hover:text-[#F3F4F6]"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteKey(delKey)}
                                className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-[#1F2E26] px-2.5 py-1 text-xs text-[#9CA3AF] transition-colors hover:border-[#EF4444]/50 hover:bg-[#2A0D10] hover:text-[#EF4444]"
                              >
                                <Trash2
                                  className="h-3.5 w-3.5"
                                  aria-hidden="true"
                                />
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
      )}

      {/* TAB 4: POLITICAL PARTIES */}
      {activeTab === "parties" && (
        <div className="grid gap-6 lg:grid-cols-12">
          <section className="ems-card p-6 lg:col-span-4">
            <h2 className="text-base font-semibold text-[#F3F4F6]">
              Add Political Party
            </h2>
            <p className="mt-1 text-xs text-[#9CA3AF]">
              Register political parties to affiliate with election candidates.
            </p>

            <form
              onSubmit={handleCreateParty}
              noValidate
              className="mt-5 space-y-4"
            >
              <div className="space-y-1.5">
                <label
                  htmlFor="party-name"
                  className="block text-xs font-medium text-[#F3F4F6]"
                >
                  Party Name <span className="text-[#EF4444]">*</span>
                </label>
                <input
                  id="party-name"
                  type="text"
                  required
                  value={partyName}
                  onChange={(e) => setPartyName(e.target.value)}
                  placeholder="e.g. Civic Progress Alliance"
                  className="w-full rounded-lg border border-[#1F2E26] bg-[#090D0B] px-3 py-2.5 text-sm text-[#F3F4F6] placeholder-[#6B7280] focus:border-[#10B981] focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="party-leader"
                  className="block text-xs font-medium text-[#F3F4F6]"
                >
                  Party Leader
                </label>
                <input
                  id="party-leader"
                  type="text"
                  value={partyLeader}
                  onChange={(e) => setPartyLeader(e.target.value)}
                  placeholder="e.g. Chairperson / Leader name"
                  className="w-full rounded-lg border border-[#1F2E26] bg-[#090D0B] px-3 py-2.5 text-sm text-[#F3F4F6] placeholder-[#6B7280] focus:border-[#10B981] focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isCreatingParty}
                className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#10B981] px-4 py-2.5 text-sm font-semibold text-[#090D0B] transition-colors hover:bg-[#22C55E] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCreatingParty ? (
                  <>
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                    <span>Adding Party...</span>
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    <span>Add Political Party</span>
                  </>
                )}
              </button>
            </form>
          </section>

          <section className="ems-card p-6 lg:col-span-8">
            <div className="flex items-center justify-between gap-2 border-b border-[#1F2E26] pb-4">
              <h2 className="text-base font-semibold text-[#F3F4F6]">
                Registered Political Parties
              </h2>
              <span className="font-mono text-xs text-[#9CA3AF]">
                {parties.length} total
              </span>
            </div>

            {parties.length === 0 ? (
              <div className="mt-6 rounded-lg border border-dashed border-[#1F2E26] bg-[#090D0B]/60 p-8 text-center">
                <p className="text-sm font-medium text-[#F3F4F6]">
                  No political parties yet
                </p>
                <p className="mt-1 text-xs text-[#9CA3AF]">
                  Add political parties to assign to candidates.
                </p>
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-lg border border-[#1F2E26]">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-[#1F2E26] bg-[#090D0B] font-mono text-[11px] text-[#9CA3AF] uppercase">
                    <tr>
                      <th className="px-4 py-3">Party Name</th>
                      <th className="px-4 py-3">Leader</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1F2E26] bg-[#090D0B]/50">
                    {parties.map((party) => {
                      const delKey = `party:${party.party_id}`;
                      const isConfirming = confirmDeleteKey === delKey;
                      const isDeleting = busyKey === delKey;

                      return (
                        <tr
                          key={party.party_id}
                          className="hover:bg-[#161F1A]/50"
                        >
                          <td className="px-4 py-3 font-medium text-[#F3F4F6]">
                            {party.party_name}
                          </td>
                          <td className="px-4 py-3 text-[#9CA3AF]">
                            {party.leader ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {isConfirming ? (
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  disabled={isDeleting}
                                  onClick={() => handleDeleteParty(party)}
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
                                  onClick={() => setConfirmDeleteKey(null)}
                                  className="cursor-pointer rounded-md border border-[#1F2E26] px-2 py-1 text-xs text-[#9CA3AF] hover:text-[#F3F4F6]"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteKey(delKey)}
                                className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-[#1F2E26] px-2.5 py-1 text-xs text-[#9CA3AF] transition-colors hover:border-[#EF4444]/50 hover:bg-[#2A0D10] hover:text-[#EF4444]"
                              >
                                <Trash2
                                  className="h-3.5 w-3.5"
                                  aria-hidden="true"
                                />
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
      )}

      {/* TAB 5: ELECTION SYMBOLS */}
      {activeTab === "symbols" && (
        <div className="grid gap-6 lg:grid-cols-12">
          <section className="ems-card p-6 lg:col-span-4">
            <h2 className="text-base font-semibold text-[#F3F4F6]">
              Upload Election Symbol
            </h2>
            <p className="mt-1 text-xs text-[#9CA3AF]">
              Images upload directly to the{" "}
              <code className="rounded bg-[#090D0B] px-1 py-0.5 font-mono text-[#10B981]">
                election-symbols
              </code>{" "}
              Supabase Storage bucket.
            </p>

            <form
              onSubmit={handleCreateSymbol}
              noValidate
              className="mt-5 space-y-4"
            >
              <div className="space-y-1.5">
                <label
                  htmlFor="symbol-name"
                  className="block text-xs font-medium text-[#F3F4F6]"
                >
                  Symbol Name <span className="text-[#EF4444]">*</span>
                </label>
                <input
                  id="symbol-name"
                  type="text"
                  required
                  value={symbolName}
                  onChange={(e) => setSymbolName(e.target.value)}
                  placeholder="e.g. Scales, Crescent, Star"
                  className="w-full rounded-lg border border-[#1F2E26] bg-[#090D0B] px-3 py-2.5 text-sm text-[#F3F4F6] placeholder-[#6B7280] focus:border-[#10B981] focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="symbol-file"
                  className="block text-xs font-medium text-[#F3F4F6]"
                >
                  Symbol Image <span className="text-[#EF4444]">*</span>
                </label>
                <label
                  htmlFor="symbol-file"
                  className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#1F2E26] bg-[#090D0B] p-5 text-center transition-colors hover:border-[#10B981]/60 hover:bg-[#161F1A]/40"
                >
                  {symbolPreviewUrl ? (
                    <div className="relative h-20 w-20 overflow-hidden rounded-lg border border-[#1F2E26] bg-[#111814] p-1.5">
                      <Image
                        unoptimized
                        src={symbolPreviewUrl}
                        alt="Selected symbol preview"
                        width={80}
                        height={80}
                        className="h-full w-full object-contain"
                      />
                    </div>
                  ) : (
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#1F2E26] bg-[#111814] text-[#10B981]">
                      <Upload className="h-5 w-5" aria-hidden="true" />
                    </span>
                  )}
                  <span className="text-xs font-medium text-[#F3F4F6]">
                    {symbolFile
                      ? symbolFile.name
                      : "Click to choose symbol image"}
                  </span>
                  <span className="text-[11px] text-[#6B7280]">
                    PNG, JPG, WebP, or SVG &bull; Max 5 MB
                  </span>
                  <input
                    ref={fileInputRef}
                    id="symbol-file"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
                    onChange={handleSymbolFileChange}
                    className="sr-only"
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={isCreatingSymbol}
                className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#10B981] px-4 py-2.5 text-sm font-semibold text-[#090D0B] transition-colors hover:bg-[#22C55E] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCreatingSymbol ? (
                  <>
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                    <span>Uploading Symbol...</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" aria-hidden="true" />
                    <span>Upload &amp; Save Symbol</span>
                  </>
                )}
              </button>
            </form>
          </section>

          <section className="ems-card p-6 lg:col-span-8">
            <div className="flex items-center justify-between gap-2 border-b border-[#1F2E26] pb-4">
              <h2 className="text-base font-semibold text-[#F3F4F6]">
                Election Symbol Gallery
              </h2>
              <span className="font-mono text-xs text-[#9CA3AF]">
                {symbols.length} total
              </span>
            </div>

            {symbols.length === 0 ? (
              <div className="mt-6 rounded-lg border border-dashed border-[#1F2E26] bg-[#090D0B]/60 p-8 text-center">
                <p className="text-sm font-medium text-[#F3F4F6]">
                  No election symbols uploaded yet
                </p>
                <p className="mt-1 text-xs text-[#9CA3AF]">
                  Upload visual ballot symbols for candidates and live results
                  displays.
                </p>
              </div>
            ) : (
              <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {symbols.map((symbol) => {
                  const delKey = `symbol:${symbol.symbol_id}`;
                  const isConfirming = confirmDeleteKey === delKey;
                  const isDeleting = busyKey === delKey;

                  return (
                    <div
                      key={symbol.symbol_id}
                      className="flex flex-col justify-between gap-3 rounded-xl border border-[#1F2E26] bg-[#090D0B]/80 p-4"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#1F2E26] bg-[#111814] p-1.5">
                          {symbol.image_url ? (
                            <Image
                              unoptimized
                              src={symbol.image_url}
                              alt={symbol.symbol_name}
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
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[#F3F4F6]">
                            {symbol.symbol_name}
                          </p>
                          <p className="mt-0.5 font-mono text-[11px] text-[#9CA3AF]">
                            Symbol #{symbol.symbol_id}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-end border-t border-[#1F2E26] pt-3">
                        {isConfirming ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={isDeleting}
                              onClick={() => handleDeleteSymbol(symbol)}
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
                              onClick={() => setConfirmDeleteKey(null)}
                              className="cursor-pointer rounded-md border border-[#1F2E26] px-2 py-1 text-xs text-[#9CA3AF] hover:text-[#F3F4F6]"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteKey(delKey)}
                            className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-[#1F2E26] px-2.5 py-1 text-xs text-[#9CA3AF] transition-colors hover:border-[#EF4444]/50 hover:bg-[#2A0D10] hover:text-[#EF4444]"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Delete</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
