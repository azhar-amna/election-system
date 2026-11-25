"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  Eye,
  Loader2,
  Mail,
  MapPin,
  RefreshCw,
  Search,
  Trash2,
  UserPlus,
  Vote,
  X,
  XCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type {
  ApprovalStatus,
  Region,
  VoterWithRegion,
} from "@/types/database";

type VoterFilterTab = "PENDING" | "APPROVED" | "REJECTED" | "ALL";

interface VotersClientProps {
  adminUserId: string;
  initialVoters: VoterWithRegion[];
  regions: Region[];
  loadError?: string | null;
}

const CNIC_PATTERN = /^\d{5}-\d{7}-\d$/;

const GENDER_OPTIONS = ["Male", "Female", "Other"] as const;

const PROVINCE_SUGGESTIONS = [
  "Punjab",
  "Sindh",
  "Khyber Pakhtunkhwa",
  "Balochistan",
  "Islamabad Capital Territory",
  "Gilgit-Baltistan",
  "Azad Jammu & Kashmir",
] as const;

const QUICK_REJECTION_REASONS = [
  "CNIC does not match the provided full name.",
  "Electoral region does not match district / residence details.",
  "Date of birth or phone number could not be verified.",
  "Incomplete or inconsistent voter profile information.",
] as const;

function formatCnic(input: string): string {
  const digits = input.replace(/\D/g, "").slice(0, 13);
  if (digits.length <= 5) return digits;
  if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
}

function formatDisplayDate(value: string | null): string {
  if (!value) return "Not provided";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(parsed);
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function formatRegionLabel(region: Region | null, fallbackId: number | null): string {
  if (region) {
    return region.location
      ? `${region.region_name} (${region.location})`
      : region.region_name;
  }
  return fallbackId ? `Region #${fallbackId}` : "Unassigned";
}

function ApprovalStatusBadge({ status }: { status: ApprovalStatus }) {
  if (status === "APPROVED") {
    return (
      <span className="ems-badge-emerald inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider uppercase">
        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
        Approved
      </span>
    );
  }
  if (status === "REJECTED") {
    return (
      <span className="ems-badge-danger inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider uppercase">
        <XCircle className="h-3 w-3" aria-hidden="true" />
        Rejected
      </span>
    );
  }
  return (
    <span className="ems-badge-warning inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider uppercase">
      <Clock className="h-3 w-3" aria-hidden="true" />
      Pending
    </span>
  );
}

export default function VotersClient({
  adminUserId,
  initialVoters,
  regions,
  loadError,
}: VotersClientProps) {
  const router = useRouter();

  const [voters, setVoters] = useState<VoterWithRegion[]>(initialVoters);
  const [activeTab, setActiveTab] = useState<VoterFilterTab>("PENDING");
  const [searchQuery, setSearchQuery] = useState("");

  // Selected / modal targets
  const [selectedVoter, setSelectedVoter] = useState<VoterWithRegion | null>(
    null
  );
  const [rejectTarget, setRejectTarget] = useState<VoterWithRegion | null>(
    null
  );
  const [rejectionReason, setRejectionReason] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<VoterWithRegion | null>(
    null
  );
  const [addModalOpen, setAddModalOpen] = useState(false);

  // Add Voter modal form fields
  const [newCnic, setNewCnic] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newGender, setNewGender] = useState("");
  const [newDob, setNewDob] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newProvince, setNewProvince] = useState("");
  const [newDistrict, setNewDistrict] = useState("");
  const [newRegionId, setNewRegionId] = useState("");
  const [newApprovalStatus, setNewApprovalStatus] =
    useState<ApprovalStatus>("APPROVED");
  const [newProfileCompleted, setNewProfileCompleted] = useState(true);

  // Async & feedback state
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    loadError ?? null
  );
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  // Close active modal/drawer on Escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (rejectTarget) {
        setRejectTarget(null);
        setModalError(null);
      } else if (deleteTarget) {
        setDeleteTarget(null);
        setModalError(null);
      } else if (addModalOpen) {
        setAddModalOpen(false);
        setModalError(null);
      } else if (selectedVoter) {
        setSelectedVoter(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [addModalOpen, deleteTarget, rejectTarget, selectedVoter]);

  const counts = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;

    for (const v of voters) {
      if (v.approval_status === "PENDING") pending += 1;
      else if (v.approval_status === "APPROVED") approved += 1;
      else if (v.approval_status === "REJECTED") rejected += 1;
    }

    return {
      PENDING: pending,
      APPROVED: approved,
      REJECTED: rejected,
      ALL: voters.length,
    };
  }, [voters]);

  const filteredVoters = useMemo(() => {
    const rawQuery = searchQuery.trim().toLowerCase();
    const digitsQuery = rawQuery.replace(/\D/g, "");

    return voters.filter((voter) => {
      if (activeTab !== "ALL" && voter.approval_status !== activeTab) {
        return false;
      }

      if (!rawQuery) return true;

      const cnicLower = voter.cnic.toLowerCase();
      const cnicDigits = voter.cnic.replace(/\D/g, "");
      const nameLower = (voter.name ?? "").toLowerCase();
      const emailLower = voter.email.toLowerCase();

      return (
        cnicLower.includes(rawQuery) ||
        (digitsQuery.length > 0 && cnicDigits.includes(digitsQuery)) ||
        nameLower.includes(rawQuery) ||
        emailLower.includes(rawQuery)
      );
    });
  }, [activeTab, searchQuery, voters]);

  function clearFeedback() {
    setErrorMessage(null);
    setSuccessMessage(null);
    setModalError(null);
  }

  function syncUpdatedVoter(updated: VoterWithRegion) {
    setVoters((prev) =>
      prev.map((item) =>
        item.voter_id === updated.voter_id ? updated : item
      )
    );
    setSelectedVoter((prev) =>
      prev && prev.voter_id === updated.voter_id ? updated : prev
    );
  }

  async function handleRefreshList() {
    setIsRefreshing(true);
    setErrorMessage(null);

    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("voter")
        .select("*, region(*)")
        .order("created_at", { ascending: false });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if (data) {
        setVoters(data);
        setSelectedVoter((prev) =>
          prev ? data.find((v) => v.voter_id === prev.voter_id) ?? null : null
        );
      }
      router.refresh();
    } catch {
      setErrorMessage("Unable to refresh voter registry right now.");
    } finally {
      setIsRefreshing(false);
    }
  }

  // ---------------------------------------------------------------------------
  // One-Click Approve
  // ---------------------------------------------------------------------------

  async function handleApproveVoter(voter: VoterWithRegion) {
    clearFeedback();
    setBusyAction(`approve:${voter.voter_id}`);

    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("voter")
        .update({
          approval_status: "APPROVED",
          approved_at: new Date().toISOString(),
          approved_by: adminUserId,
          rejection_reason: null,
        })
        .eq("voter_id", voter.voter_id)
        .select("*, region(*)")
        .single();

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if (data) {
        syncUpdatedVoter(data);
        setSuccessMessage(
          `Approved voter ${data.name ?? data.cnic} (${data.cnic}).`
        );
      }
      router.refresh();
    } catch {
      setErrorMessage("Unable to approve voter right now.");
    } finally {
      setBusyAction(null);
    }
  }

  // ---------------------------------------------------------------------------
  // Reject with Reason
  // ---------------------------------------------------------------------------

  function openRejectModal(voter: VoterWithRegion) {
    setModalError(null);
    setRejectionReason(voter.rejection_reason ?? "");
    setRejectTarget(voter);
  }

  async function handleConfirmReject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!rejectTarget) return;

    const trimmedReason = rejectionReason.trim();
    if (!trimmedReason) {
      setModalError("Please enter a clear rejection reason for the voter.");
      return;
    }

    setModalError(null);
    setBusyAction(`reject:${rejectTarget.voter_id}`);

    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("voter")
        .update({
          approval_status: "REJECTED",
          rejection_reason: trimmedReason,
          approved_at: null,
          approved_by: null,
        })
        .eq("voter_id", rejectTarget.voter_id)
        .select("*, region(*)")
        .single();

      if (error) {
        setModalError(error.message);
        return;
      }

      if (data) {
        syncUpdatedVoter(data);
        setSuccessMessage(
          `Rejected voter ${data.name ?? data.cnic} with feedback saved.`
        );
      }

      setRejectTarget(null);
      setRejectionReason("");
      router.refresh();
    } catch {
      setModalError("Unable to reject voter right now.");
    } finally {
      setBusyAction(null);
    }
  }

  // ---------------------------------------------------------------------------
  // Add Voter Manually
  // ---------------------------------------------------------------------------

  function resetAddForm() {
    setNewCnic("");
    setNewEmail("");
    setNewName("");
    setNewGender("");
    setNewDob("");
    setNewPhone("");
    setNewProvince("");
    setNewDistrict("");
    setNewRegionId("");
    setNewApprovalStatus("APPROVED");
    setNewProfileCompleted(true);
    setModalError(null);
  }

  async function handleAddVoter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setModalError(null);

    const normalizedCnic = formatCnic(newCnic.trim());
    const normalizedEmail = newEmail.trim().toLowerCase();
    const trimmedName = newName.trim();

    if (!CNIC_PATTERN.test(normalizedCnic)) {
      setModalError(
        "Enter a valid 13-digit CNIC formatted as 12345-1234567-1."
      );
      return;
    }

    if (!normalizedEmail) {
      setModalError("Please provide an email address.");
      return;
    }

    if (newProfileCompleted && !trimmedName) {
      setModalError("Please provide the voter's full name.");
      return;
    }

    const parsedRegionId = newRegionId ? Number(newRegionId) : null;
    const isPreApproved = newApprovalStatus === "APPROVED";

    setBusyAction("add-voter");

    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("voter")
        .insert({
          cnic: normalizedCnic,
          email: normalizedEmail,
          name: trimmedName || null,
          gender: newGender.trim() || null,
          dob: newDob.trim() || null,
          phone_no: newPhone.trim() || null,
          province: newProvince.trim() || null,
          district: newDistrict.trim() || null,
          region_id: parsedRegionId,
          profile_completed: newProfileCompleted,
          approval_status: newApprovalStatus,
          approved_at: isPreApproved ? new Date().toISOString() : null,
          approved_by: isPreApproved ? adminUserId : null,
          rejection_reason: null,
        })
        .select("*, region(*)")
        .single();

      if (error) {
        if (error.code === "23505") {
          setModalError(
            "A voter with this CNIC or email already exists in the registry."
          );
        } else {
          setModalError(error.message);
        }
        return;
      }

      if (data) {
        setVoters((prev) => [data, ...prev]);
        setSuccessMessage(
          `Added voter ${data.name ?? data.cnic} (${data.approval_status}).`
        );
      }

      resetAddForm();
      setAddModalOpen(false);
      router.refresh();
    } catch {
      setModalError("Unable to insert voter record right now.");
    } finally {
      setBusyAction(null);
    }
  }

  // ---------------------------------------------------------------------------
  // Delete Voter with Confirmation
  // ---------------------------------------------------------------------------

  async function handleConfirmDelete() {
    if (!deleteTarget) return;

    setModalError(null);
    setBusyAction(`delete:${deleteTarget.voter_id}`);

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("voter")
        .delete()
        .eq("voter_id", deleteTarget.voter_id);

      if (error) {
        if (error.code === "23503") {
          setModalError(
            "Cannot delete this voter because immutable turnout or security audit logs reference this voter."
          );
        } else {
          setModalError(error.message);
        }
        return;
      }

      const deletedLabel = deleteTarget.name ?? deleteTarget.cnic;
      setVoters((prev) =>
        prev.filter((item) => item.voter_id !== deleteTarget.voter_id)
      );
      setSelectedVoter((prev) =>
        prev && prev.voter_id === deleteTarget.voter_id ? null : prev
      );
      setDeleteTarget(null);
      setSuccessMessage(`Deleted voter record for ${deletedLabel}.`);
      router.refresh();
    } catch {
      setModalError("Unable to delete voter record right now.");
    } finally {
      setBusyAction(null);
    }
  }

  const filterTabs: {
    id: VoterFilterTab;
    label: string;
    count: number;
  }[] = [
    { id: "PENDING", label: "Pending Review", count: counts.PENDING },
    { id: "APPROVED", label: "Approved", count: counts.APPROVED },
    { id: "REJECTED", label: "Rejected", count: counts.REJECTED },
    { id: "ALL", label: "All Voters", count: counts.ALL },
  ];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight text-[#F3F4F6]">
          Voter Approvals
        </h1>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefreshList}
            disabled={isRefreshing}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#1F2E26] bg-[#111814] px-3 py-2 text-xs font-medium text-[#F3F4F6] transition-colors hover:border-[#10B981]/50 hover:text-[#22C55E] disabled:opacity-60"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={() => {
              resetAddForm();
              setAddModalOpen(true);
            }}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#10B981] px-3.5 py-2 text-xs font-semibold text-[#090D0B] transition-colors hover:bg-[#22C55E]"
          >
            <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Add Voter</span>
          </button>
        </div>
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

      {/* Filter Tabs + Search Bar */}
      <div className="flex flex-col gap-3 border-b border-[#1F2E26] pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div
          role="tablist"
          aria-label="Filter voters by approval status"
          className="flex flex-wrap gap-2"
        >
          {filterTabs.map((tab) => {
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex cursor-pointer items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-all ${
                  isSelected
                    ? tab.id === "PENDING"
                      ? "border border-[#F59E0B]/45 bg-[#291C06] text-[#F59E0B]"
                      : tab.id === "REJECTED"
                        ? "border border-[#EF4444]/45 bg-[#2A0D10] text-[#EF4444]"
                        : "border border-[#10B981]/45 bg-[#052E16] text-[#22C55E]"
                    : "border border-[#1F2E26] bg-[#111814] text-[#9CA3AF] hover:border-[#10B981]/30 hover:text-[#F3F4F6]"
                }`}
              >
                <span>{tab.label}</span>
                <span className="rounded-full bg-[#090D0B]/70 px-2 py-0.5 font-mono text-[11px]">
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative w-full lg:w-80">
          <Search
            className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by CNIC, name, or email..."
            aria-label="Search voters by CNIC, name, or email"
            className="w-full rounded-lg border border-[#1F2E26] bg-[#111814] py-2.5 pr-3.5 pl-10 text-sm text-[#F3F4F6] placeholder-[#6B7280] transition-colors focus:border-[#10B981] focus:outline-none"
          />
        </div>
      </div>

      {/* Voters Table */}
      <section aria-label="Voter Records Table" className="ems-card overflow-hidden">
        {filteredVoters.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-semibold text-[#F3F4F6]">
              {searchQuery.trim()
                ? "No voters match your search query"
                : activeTab === "PENDING"
                  ? "No voters pending review"
                  : activeTab === "APPROVED"
                    ? "No approved voters yet"
                    : activeTab === "REJECTED"
                      ? "No rejected voter records"
                      : "No voter records found"}
            </p>
            <p className="mt-1 text-xs text-[#9CA3AF]">
              {searchQuery.trim()
                ? "Try searching with a different CNIC, voter name, or email address."
                : "New voters appear automatically when they register or when added manually."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#1F2E26] bg-[#090D0B] font-mono text-[11px] text-[#9CA3AF] uppercase">
                <tr>
                  <th className="px-4 py-3.5">Voter</th>
                  <th className="px-4 py-3.5">CNIC</th>
                  <th className="px-4 py-3.5">Region</th>
                  <th className="px-4 py-3.5">Profile &amp; Status</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1F2E26] bg-[#090D0B]/40">
                {filteredVoters.map((voter) => {
                  const isApproving = busyAction === `approve:${voter.voter_id}`;
                  const voterRegion =
                    voter.region ??
                    regions.find((r) => r.region_id === voter.region_id) ??
                    null;

                  return (
                    <tr
                      key={voter.voter_id}
                      className="transition-colors hover:bg-[#161F1A]/50"
                    >
                      <td className="px-4 py-3.5">
                        <div className="min-w-[180px]">
                          <p className="font-semibold text-[#F3F4F6]">
                            {voter.name ?? (
                              <span className="font-normal text-[#9CA3AF] italic">
                                Name not submitted
                              </span>
                            )}
                          </p>
                          <p className="mt-0.5 text-xs text-[#9CA3AF]">
                            {voter.email}
                          </p>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <span className="font-mono text-xs font-semibold tracking-wider text-[#22C55E]">
                          {voter.cnic}
                        </span>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="min-w-[140px]">
                          <p className="text-xs font-medium text-[#F3F4F6]">
                            {voterRegion?.region_name ?? (
                              <span className="text-[#6B7280]">Unassigned</span>
                            )}
                          </p>
                          {(voter.district || voter.province) && (
                            <p className="mt-0.5 text-[11px] text-[#9CA3AF]">
                              {[voter.district, voter.province]
                                .filter(Boolean)
                                .join(", ")}
                            </p>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <ApprovalStatusBadge status={voter.approval_status} />
                          <span
                            className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-medium uppercase ${
                              voter.profile_completed
                                ? "border border-[#1F2E26] bg-[#161F1A] text-[#10B981]"
                                : "border border-[#F59E0B]/35 bg-[#291C06]/60 text-[#F59E0B]"
                            }`}
                          >
                            {voter.profile_completed
                              ? "Profile Complete"
                              : "Incomplete"}
                          </span>
                          {voter.has_voted && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-[#22C55E]/40 bg-[#052E16] px-2 py-0.5 font-mono text-[10px] font-semibold text-[#22C55E] uppercase">
                              <Vote className="h-3 w-3" aria-hidden="true" />
                              Voted
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedVoter(voter)}
                            className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-[#1F2E26] bg-[#111814] px-2.5 py-1.5 text-xs font-medium text-[#F3F4F6] transition-colors hover:border-[#10B981]/50 hover:text-[#22C55E]"
                          >
                            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Inspect</span>
                          </button>

                          {voter.approval_status !== "APPROVED" && (
                            <button
                              type="button"
                              disabled={busyAction !== null}
                              onClick={() => handleApproveVoter(voter)}
                              className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-[#10B981] px-2.5 py-1.5 text-xs font-semibold text-[#090D0B] transition-colors hover:bg-[#22C55E] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isApproving ? (
                                <Loader2
                                  className="h-3.5 w-3.5 animate-spin"
                                  aria-hidden="true"
                                />
                              ) : (
                                <Check
                                  className="h-3.5 w-3.5"
                                  aria-hidden="true"
                                />
                              )}
                              <span>Approve</span>
                            </button>
                          )}

                          {voter.approval_status !== "REJECTED" && (
                            <button
                              type="button"
                              disabled={busyAction !== null}
                              onClick={() => openRejectModal(voter)}
                              className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-[#EF4444]/40 bg-[#2A0D10] px-2.5 py-1.5 text-xs font-medium text-[#EF4444] transition-colors hover:bg-[#EF4444]/15 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <XCircle
                                className="h-3.5 w-3.5"
                                aria-hidden="true"
                              />
                              <span>Reject</span>
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={busyAction !== null}
                            onClick={() => {
                              setModalError(null);
                              setDeleteTarget(voter);
                            }}
                            aria-label={`Delete voter ${voter.name ?? voter.cnic}`}
                            className="inline-flex cursor-pointer items-center justify-center rounded-md border border-[#1F2E26] bg-[#111814] p-1.5 text-[#9CA3AF] transition-colors hover:border-[#EF4444]/50 hover:bg-[#2A0D10] hover:text-[#EF4444] disabled:opacity-60"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ===================================================================== */}
      {/* DETAIL DRAWER (Inspect Voter Record)                                  */}
      {/* ===================================================================== */}
      {selectedVoter && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-[#090D0B]/75 backdrop-blur-xs"
          onClick={() => setSelectedVoter(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="voter-drawer-title"
            onClick={(e) => e.stopPropagation()}
            className="flex h-full w-full max-w-lg flex-col border-l border-[#1F2E26] bg-[#111814] shadow-2xl"
          >
            {/* Drawer Header */}
            <div className="flex items-start justify-between gap-4 border-b border-[#1F2E26] p-6">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <ApprovalStatusBadge status={selectedVoter.approval_status} />
                  <span
                    className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase ${
                      selectedVoter.profile_completed
                        ? "border border-[#10B981]/35 bg-[#052E16]/70 text-[#22C55E]"
                        : "border border-[#F59E0B]/40 bg-[#291C06] text-[#F59E0B]"
                    }`}
                  >
                    profile_completed:{" "}
                    {selectedVoter.profile_completed ? "true" : "false"}
                  </span>
                </div>
                <h2
                  id="voter-drawer-title"
                  className="mt-3 text-xl font-bold text-[#F3F4F6]"
                >
                  {selectedVoter.name ?? "Unnamed Voter"}
                </h2>
                <p className="mt-0.5 font-mono text-xs text-[#22C55E]">
                  CNIC: {selectedVoter.cnic}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedVoter(null)}
                aria-label="Close voter details"
                className="cursor-pointer rounded-lg border border-[#1F2E26] bg-[#090D0B] p-2 text-[#9CA3AF] transition-colors hover:border-[#10B981]/50 hover:text-[#F3F4F6]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 space-y-5 overflow-y-auto p-6">
              {!selectedVoter.profile_completed && (
                <div className="flex items-start gap-2.5 rounded-lg border border-[#F59E0B]/40 bg-[#291C06]/65 p-3.5 text-xs text-[#F59E0B]">
                  <AlertTriangle
                    className="mt-0.5 h-4 w-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    This voter has not completed their profile yet. Even if
                    pre-approved, ballot access requires{" "}
                    <code className="font-mono text-[#F3F4F6]">
                      profile_completed === true
                    </code>
                    .
                  </span>
                </div>
              )}

              {selectedVoter.approval_status === "REJECTED" &&
                selectedVoter.rejection_reason && (
                  <div className="rounded-lg border border-[#EF4444]/40 bg-[#2A0D10] p-3.5">
                    <p className="font-mono text-[10px] font-semibold tracking-wider text-[#EF4444] uppercase">
                      Recorded Rejection Reason
                    </p>
                    <p className="mt-1 text-sm text-[#F3F4F6]">
                      {selectedVoter.rejection_reason}
                    </p>
                  </div>
                )}

              <dl className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-[#1F2E26] bg-[#090D0B] p-3.5 sm:col-span-2">
                  <dt className="flex items-center gap-1.5 text-[11px] font-medium text-[#9CA3AF] uppercase">
                    <CreditCard
                      className="h-3.5 w-3.5 text-[#10B981]"
                      aria-hidden="true"
                    />
                    CNIC Number
                  </dt>
                  <dd className="mt-1 font-mono text-sm font-semibold text-[#22C55E]">
                    {selectedVoter.cnic}
                  </dd>
                </div>

                <div className="rounded-lg border border-[#1F2E26] bg-[#090D0B] p-3.5 sm:col-span-2">
                  <dt className="flex items-center gap-1.5 text-[11px] font-medium text-[#9CA3AF] uppercase">
                    <Mail
                      className="h-3.5 w-3.5 text-[#10B981]"
                      aria-hidden="true"
                    />
                    Email Address
                  </dt>
                  <dd className="mt-1 break-all text-sm font-medium text-[#F3F4F6]">
                    {selectedVoter.email}
                  </dd>
                </div>

                <div className="rounded-lg border border-[#1F2E26] bg-[#090D0B] p-3.5">
                  <dt className="text-[11px] font-medium text-[#9CA3AF] uppercase">
                    Full Name
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-[#F3F4F6]">
                    {selectedVoter.name ?? "Not provided"}
                  </dd>
                </div>

                <div className="rounded-lg border border-[#1F2E26] bg-[#090D0B] p-3.5">
                  <dt className="text-[11px] font-medium text-[#9CA3AF] uppercase">
                    Gender
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-[#F3F4F6]">
                    {selectedVoter.gender ?? "Not provided"}
                  </dd>
                </div>

                <div className="rounded-lg border border-[#1F2E26] bg-[#090D0B] p-3.5">
                  <dt className="text-[11px] font-medium text-[#9CA3AF] uppercase">
                    Date of Birth
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-[#F3F4F6]">
                    {formatDisplayDate(selectedVoter.dob)}
                  </dd>
                </div>

                <div className="rounded-lg border border-[#1F2E26] bg-[#090D0B] p-3.5">
                  <dt className="text-[11px] font-medium text-[#9CA3AF] uppercase">
                    Phone Number
                  </dt>
                  <dd className="mt-1 font-mono text-sm font-medium text-[#F3F4F6]">
                    {selectedVoter.phone_no ?? "Not provided"}
                  </dd>
                </div>

                <div className="rounded-lg border border-[#1F2E26] bg-[#090D0B] p-3.5">
                  <dt className="text-[11px] font-medium text-[#9CA3AF] uppercase">
                    Province
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-[#F3F4F6]">
                    {selectedVoter.province ?? "Not provided"}
                  </dd>
                </div>

                <div className="rounded-lg border border-[#1F2E26] bg-[#090D0B] p-3.5">
                  <dt className="text-[11px] font-medium text-[#9CA3AF] uppercase">
                    District
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-[#F3F4F6]">
                    {selectedVoter.district ?? "Not provided"}
                  </dd>
                </div>

                <div className="rounded-lg border border-[#1F2E26] bg-[#090D0B] p-3.5 sm:col-span-2">
                  <dt className="flex items-center gap-1.5 text-[11px] font-medium text-[#9CA3AF] uppercase">
                    <MapPin
                      className="h-3.5 w-3.5 text-[#10B981]"
                      aria-hidden="true"
                    />
                    Electoral Region
                  </dt>
                  <dd className="mt-1 text-sm font-semibold text-[#10B981]">
                    {formatRegionLabel(
                      selectedVoter.region ??
                        regions.find(
                          (r) => r.region_id === selectedVoter.region_id
                        ) ??
                        null,
                      selectedVoter.region_id
                    )}
                  </dd>
                </div>

                <div className="rounded-lg border border-[#1F2E26] bg-[#090D0B] p-3.5">
                  <dt className="text-[11px] font-medium text-[#9CA3AF] uppercase">
                    Voting Status
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-[#F3F4F6]">
                    {selectedVoter.has_voted ? (
                      <span className="text-[#22C55E]">Has Voted</span>
                    ) : (
                      <span className="text-[#9CA3AF]">Not Yet Voted</span>
                    )}
                  </dd>
                </div>

                <div className="rounded-lg border border-[#1F2E26] bg-[#090D0B] p-3.5">
                  <dt className="text-[11px] font-medium text-[#9CA3AF] uppercase">
                    Approved At
                  </dt>
                  <dd className="mt-1 font-mono text-xs text-[#F3F4F6]">
                    {formatDateTime(selectedVoter.approved_at)}
                  </dd>
                </div>

                <div className="rounded-lg border border-[#1F2E26] bg-[#090D0B] p-3.5 sm:col-span-2">
                  <dt className="text-[11px] font-medium text-[#9CA3AF] uppercase">
                    Registry Metadata
                  </dt>
                  <dd className="mt-1 space-y-1 font-mono text-xs text-[#9CA3AF]">
                    <p>Voter ID: #{selectedVoter.voter_id}</p>
                    <p>
                      Auth Account:{" "}
                      {selectedVoter.auth_user_id ? "Linked" : "Manual Entry"}
                    </p>
                    <p>Registered: {formatDateTime(selectedVoter.created_at)}</p>
                  </dd>
                </div>
              </dl>
            </div>

            {/* Drawer Decision Footer */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-[#1F2E26] bg-[#090D0B]/80 p-5">
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={() => {
                  setModalError(null);
                  setDeleteTarget(selectedVoter);
                }}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#1F2E26] bg-[#111814] px-3.5 py-2 text-xs font-medium text-[#9CA3AF] transition-colors hover:border-[#EF4444]/50 hover:bg-[#2A0D10] hover:text-[#EF4444]"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Delete</span>
              </button>

              <div className="flex items-center gap-2">
                {selectedVoter.approval_status !== "REJECTED" && (
                  <button
                    type="button"
                    disabled={busyAction !== null}
                    onClick={() => openRejectModal(selectedVoter)}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#EF4444]/45 bg-[#2A0D10] px-4 py-2 text-xs font-semibold text-[#EF4444] transition-colors hover:bg-[#EF4444]/15 disabled:opacity-60"
                  >
                    <XCircle className="h-4 w-4" aria-hidden="true" />
                    <span>Reject</span>
                  </button>
                )}

                {selectedVoter.approval_status !== "APPROVED" && (
                  <button
                    type="button"
                    disabled={busyAction !== null}
                    onClick={() => handleApproveVoter(selectedVoter)}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#10B981] px-4 py-2 text-xs font-semibold text-[#090D0B] transition-colors hover:bg-[#22C55E] disabled:opacity-60"
                  >
                    {busyAction === `approve:${selectedVoter.voter_id}` ? (
                      <Loader2
                        className="h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <Check className="h-4 w-4" aria-hidden="true" />
                    )}
                    <span>Approve Voter</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* REJECT VOTER MODAL                                                    */}
      {/* ===================================================================== */}
      {rejectTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#090D0B]/80 p-4 backdrop-blur-xs"
          onClick={() => {
            setRejectTarget(null);
            setModalError(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reject-modal-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-xl border border-[#EF4444]/40 bg-[#111814] p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2
                  id="reject-modal-title"
                  className="text-base font-semibold text-[#F3F4F6]"
                >
                  Reject {rejectTarget.name ?? rejectTarget.cnic}
                </h2>
                <p className="mt-0.5 font-mono text-xs text-[#9CA3AF]">
                  {rejectTarget.cnic}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setRejectTarget(null);
                  setModalError(null);
                }}
                aria-label="Close reject modal"
                className="cursor-pointer rounded-lg border border-[#1F2E26] bg-[#090D0B] p-1.5 text-[#9CA3AF] hover:text-[#F3F4F6]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <form
              onSubmit={handleConfirmReject}
              noValidate
              className="mt-5 space-y-4"
            >
              {modalError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-lg border border-[#EF4444]/40 bg-[#2A0D10] p-3 text-xs text-[#EF4444]"
                >
                  <AlertCircle
                    className="mt-0.5 h-4 w-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span>{modalError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label
                  htmlFor="rejection-reason-input"
                  className="block text-xs font-medium text-[#F3F4F6]"
                >
                  Rejection Reason <span className="text-[#EF4444]">*</span>
                </label>
                <textarea
                  id="rejection-reason-input"
                  rows={3}
                  required
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Explain what the voter must fix before resubmitting..."
                  className="w-full rounded-lg border border-[#1F2E26] bg-[#090D0B] p-3 text-sm text-[#F3F4F6] placeholder-[#6B7280] focus:border-[#EF4444] focus:outline-none"
                />
              </div>

              {/* Quick Reason Chips */}
              <div className="space-y-1.5">
                <p className="text-[11px] font-medium text-[#9CA3AF]">
                  Quick templates:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_REJECTION_REASONS.map((reason) => (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => setRejectionReason(reason)}
                      className="cursor-pointer rounded-md border border-[#1F2E26] bg-[#090D0B] px-2.5 py-1 text-left text-[11px] text-[#9CA3AF] transition-colors hover:border-[#EF4444]/40 hover:text-[#F3F4F6]"
                    >
                      {reason}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 border-t border-[#1F2E26] pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setRejectTarget(null);
                    setModalError(null);
                  }}
                  className="cursor-pointer rounded-lg border border-[#1F2E26] bg-[#090D0B] px-4 py-2 text-xs font-medium text-[#9CA3AF] hover:text-[#F3F4F6]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busyAction !== null}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#EF4444] px-4 py-2 text-xs font-semibold text-[#090D0B] transition-colors hover:bg-[#EF4444]/90 disabled:opacity-60"
                >
                  {busyAction === `reject:${rejectTarget.voter_id}` ? (
                    <Loader2
                      className="h-3.5 w-3.5 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  <span>Confirm Rejection</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* DELETE VOTER CONFIRMATION MODAL                                       */}
      {/* ===================================================================== */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#090D0B]/80 p-4 backdrop-blur-xs"
          onClick={() => {
            setDeleteTarget(null);
            setModalError(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-voter-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-xl border border-[#EF4444]/45 bg-[#111814] p-6 shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#EF4444]/40 bg-[#2A0D10] text-[#EF4444]">
                <Trash2 className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h2
                  id="delete-voter-title"
                  className="text-base font-semibold text-[#F3F4F6]"
                >
                  Delete Voter Record?
                </h2>
                <p className="mt-1 text-sm text-[#9CA3AF]">
                  This permanently removes{" "}
                  <strong className="text-[#F3F4F6]">
                    {deleteTarget.name ?? deleteTarget.email}
                  </strong>{" "}
                  (<span className="font-mono text-[#F3F4F6]">{deleteTarget.cnic}</span>)
                  from <code className="font-mono text-xs">public.voter</code>.
                </p>
              </div>
            </div>

            {modalError && (
              <div
                role="alert"
                className="mt-4 flex items-start gap-2 rounded-lg border border-[#EF4444]/40 bg-[#2A0D10] p-3 text-xs text-[#EF4444]"
              >
                <AlertCircle
                  className="mt-0.5 h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                <span>{modalError}</span>
              </div>
            )}

            <div className="mt-6 flex items-center justify-end gap-2.5 border-t border-[#1F2E26] pt-4">
              <button
                type="button"
                onClick={() => {
                  setDeleteTarget(null);
                  setModalError(null);
                }}
                className="cursor-pointer rounded-lg border border-[#1F2E26] bg-[#090D0B] px-4 py-2 text-xs font-medium text-[#9CA3AF] hover:text-[#F3F4F6]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={handleConfirmDelete}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#EF4444] px-4 py-2 text-xs font-semibold text-[#090D0B] transition-colors hover:bg-[#EF4444]/90 disabled:opacity-60"
              >
                {busyAction === `delete:${deleteTarget.voter_id}` ? (
                  <Loader2
                    className="h-3.5 w-3.5 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span>Delete Permanently</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* ADD VOTER MODAL                                                       */}
      {/* ===================================================================== */}
      {addModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#090D0B]/80 p-4 backdrop-blur-xs"
          onClick={() => {
            setAddModalOpen(false);
            setModalError(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-voter-title"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-[#1F2E26] bg-[#111814] p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-[#1F2E26] pb-4">
              <h2
                id="add-voter-title"
                className="text-base font-semibold text-[#F3F4F6]"
              >
                Add Voter
              </h2>
              <button
                type="button"
                onClick={() => {
                  setAddModalOpen(false);
                  setModalError(null);
                }}
                aria-label="Close add voter modal"
                className="cursor-pointer rounded-lg border border-[#1F2E26] bg-[#090D0B] p-1.5 text-[#9CA3AF] hover:text-[#F3F4F6]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <form
              onSubmit={handleAddVoter}
              noValidate
              className="mt-5 space-y-5"
            >
              {modalError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-lg border border-[#EF4444]/40 bg-[#2A0D10] p-3 text-xs text-[#EF4444]"
                >
                  <AlertCircle
                    className="mt-0.5 h-4 w-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span>{modalError}</span>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                {/* CNIC */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="add-voter-cnic"
                    className="block text-xs font-medium text-[#F3F4F6]"
                  >
                    CNIC <span className="text-[#EF4444]">*</span>
                  </label>
                  <input
                    id="add-voter-cnic"
                    type="text"
                    inputMode="numeric"
                    maxLength={15}
                    required
                    value={newCnic}
                    onChange={(e) => setNewCnic(formatCnic(e.target.value))}
                    placeholder="12345-1234567-1"
                    className="w-full rounded-lg border border-[#1F2E26] bg-[#090D0B] px-3 py-2.5 font-mono text-sm text-[#F3F4F6] placeholder-[#6B7280] focus:border-[#10B981] focus:outline-none"
                  />
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="add-voter-email"
                    className="block text-xs font-medium text-[#F3F4F6]"
                  >
                    Email <span className="text-[#EF4444]">*</span>
                  </label>
                  <input
                    id="add-voter-email"
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="voter@example.com"
                    className="w-full rounded-lg border border-[#1F2E26] bg-[#090D0B] px-3 py-2.5 text-sm text-[#F3F4F6] placeholder-[#6B7280] focus:border-[#10B981] focus:outline-none"
                  />
                </div>

                {/* Full Name */}
                <div className="space-y-1.5 sm:col-span-2">
                  <label
                    htmlFor="add-voter-name"
                    className="block text-xs font-medium text-[#F3F4F6]"
                  >
                    Full Name
                  </label>
                  <input
                    id="add-voter-name"
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Full legal name"
                    className="w-full rounded-lg border border-[#1F2E26] bg-[#090D0B] px-3 py-2.5 text-sm text-[#F3F4F6] placeholder-[#6B7280] focus:border-[#10B981] focus:outline-none"
                  />
                </div>

                {/* Gender */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="add-voter-gender"
                    className="block text-xs font-medium text-[#F3F4F6]"
                  >
                    Gender
                  </label>
                  <select
                    id="add-voter-gender"
                    value={newGender}
                    onChange={(e) => setNewGender(e.target.value)}
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

                {/* Date of Birth */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="add-voter-dob"
                    className="block text-xs font-medium text-[#F3F4F6]"
                  >
                    Date of Birth
                  </label>
                  <input
                    id="add-voter-dob"
                    type="date"
                    value={newDob}
                    onChange={(e) => setNewDob(e.target.value)}
                    className="w-full rounded-lg border border-[#1F2E26] bg-[#090D0B] px-3 py-2.5 text-sm text-[#F3F4F6] focus:border-[#10B981] focus:outline-none"
                  />
                </div>

                {/* Phone */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="add-voter-phone"
                    className="block text-xs font-medium text-[#F3F4F6]"
                  >
                    Phone Number
                  </label>
                  <input
                    id="add-voter-phone"
                    type="tel"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="+92 300 1234567"
                    className="w-full rounded-lg border border-[#1F2E26] bg-[#090D0B] px-3 py-2.5 text-sm text-[#F3F4F6] placeholder-[#6B7280] focus:border-[#10B981] focus:outline-none"
                  />
                </div>

                {/* Province */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="add-voter-province"
                    className="block text-xs font-medium text-[#F3F4F6]"
                  >
                    Province
                  </label>
                  <input
                    id="add-voter-province"
                    type="text"
                    list="admin-voter-provinces"
                    value={newProvince}
                    onChange={(e) => setNewProvince(e.target.value)}
                    placeholder="e.g. Punjab"
                    className="w-full rounded-lg border border-[#1F2E26] bg-[#090D0B] px-3 py-2.5 text-sm text-[#F3F4F6] placeholder-[#6B7280] focus:border-[#10B981] focus:outline-none"
                  />
                  <datalist id="admin-voter-provinces">
                    {PROVINCE_SUGGESTIONS.map((item) => (
                      <option key={item} value={item} />
                    ))}
                  </datalist>
                </div>

                {/* District */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="add-voter-district"
                    className="block text-xs font-medium text-[#F3F4F6]"
                  >
                    District
                  </label>
                  <input
                    id="add-voter-district"
                    type="text"
                    value={newDistrict}
                    onChange={(e) => setNewDistrict(e.target.value)}
                    placeholder="e.g. Lahore"
                    className="w-full rounded-lg border border-[#1F2E26] bg-[#090D0B] px-3 py-2.5 text-sm text-[#F3F4F6] placeholder-[#6B7280] focus:border-[#10B981] focus:outline-none"
                  />
                </div>

                {/* Electoral Region */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="add-voter-region"
                    className="block text-xs font-medium text-[#F3F4F6]"
                  >
                    Electoral Region
                  </label>
                  <select
                    id="add-voter-region"
                    value={newRegionId}
                    onChange={(e) => setNewRegionId(e.target.value)}
                    className="w-full rounded-lg border border-[#1F2E26] bg-[#090D0B] px-3 py-2.5 text-sm text-[#F3F4F6] focus:border-[#10B981] focus:outline-none"
                  >
                    <option value="">Unassigned</option>
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

                {/* Initial Approval Status */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="add-voter-status"
                    className="block text-xs font-medium text-[#F3F4F6]"
                  >
                    Initial Approval Status
                  </label>
                  <select
                    id="add-voter-status"
                    value={newApprovalStatus}
                    onChange={(e) =>
                      setNewApprovalStatus(e.target.value as ApprovalStatus)
                    }
                    className="w-full rounded-lg border border-[#1F2E26] bg-[#090D0B] px-3 py-2.5 text-sm text-[#F3F4F6] focus:border-[#10B981] focus:outline-none"
                  >
                    <option value="APPROVED">APPROVED (Pre-Approved)</option>
                    <option value="PENDING">PENDING (Needs Review)</option>
                  </select>
                </div>

                {/* Profile Completed Toggle */}
                <div className="flex items-end pb-1">
                  <label className="inline-flex cursor-pointer items-center gap-2.5 rounded-lg border border-[#1F2E26] bg-[#090D0B] px-3.5 py-2.5 text-xs font-medium text-[#F3F4F6]">
                    <input
                      type="checkbox"
                      checked={newProfileCompleted}
                      onChange={(e) => setNewProfileCompleted(e.target.checked)}
                      className="h-4 w-4 accent-[#10B981]"
                    />
                    <span>Mark profile as completed</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 border-t border-[#1F2E26] pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setAddModalOpen(false);
                    setModalError(null);
                  }}
                  className="cursor-pointer rounded-lg border border-[#1F2E26] bg-[#090D0B] px-4 py-2 text-xs font-medium text-[#9CA3AF] hover:text-[#F3F4F6]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busyAction !== null}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#10B981] px-4 py-2 text-xs font-semibold text-[#090D0B] transition-colors hover:bg-[#22C55E] disabled:opacity-60"
                >
                  {busyAction === "add-voter" ? (
                    <Loader2
                      className="h-3.5 w-3.5 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  <span>Save Voter Record</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
