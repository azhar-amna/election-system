"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  Vote,
  XCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  isValidPastDate,
  isValidPhone,
  parsePositiveInt,
  sanitizePublicError,
} from "@/lib/validation";
import type { Election, Region, VoterWithRegion } from "@/types/database";

interface VoterDashboardClientProps {
  initialVoter: VoterWithRegion;
  regions: Region[];
  activeElections: Pick<
    Election,
    "election_id" | "title" | "start_date" | "end_date" | "status"
  >[];
  initialVotedElectionIds: number[];
  regionsError?: string | null;
}

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

function formatDisplayDate(value: string | null): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(parsed);
}

function formatRegionLabel(region: Region): string {
  const details = [region.location, region.type].filter(Boolean).join(" • ");
  return details ? `${region.region_name} (${details})` : region.region_name;
}

export default function VoterDashboardClient({
  initialVoter,
  regions,
  activeElections,
  initialVotedElectionIds,
  regionsError,
}: VoterDashboardClientProps) {
  const router = useRouter();

  const [voter, setVoter] = useState<VoterWithRegion>(initialVoter);
  const [votedElectionIds, setVotedElectionIds] = useState<number[]>(
    initialVotedElectionIds
  );

  const [name, setName] = useState(initialVoter.name ?? "");
  const [gender, setGender] = useState(initialVoter.gender ?? "");
  const [dob, setDob] = useState(initialVoter.dob ?? "");
  const [phoneNo, setPhoneNo] = useState(initialVoter.phone_no ?? "");
  const [province, setProvince] = useState(initialVoter.province ?? "");
  const [district, setDistrict] = useState(initialVoter.district ?? "");
  const [regionId, setRegionId] = useState(
    initialVoter.region_id ? String(initialVoter.region_id) : ""
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isRejected = voter.approval_status === "REJECTED";
  const isProfileIncomplete = !isRejected && !voter.profile_completed;
  const isApproved =
    voter.profile_completed && voter.approval_status === "APPROVED";
  const isPendingApproval =
    voter.profile_completed && voter.approval_status === "PENDING";

  const canEditProfile = isProfileIncomplete || isRejected;

  const assignedRegion =
    voter.region ??
    regions.find((item) => item.region_id === voter.region_id) ??
    null;

  async function handleRefreshStatus() {
    setIsRefreshing(true);
    setFormError(null);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const [{ data: latestVoter, error }, votedRes] = await Promise.all([
        supabase
          .from("voter")
          .select("*, region(*)")
          .eq("auth_user_id", user.id)
          .single(),
        supabase.rpc("get_my_voted_elections"),
      ]);

      if (error) {
        setFormError(sanitizePublicError(error, "Unable to refresh status."));
        return;
      }

      if (!votedRes.error && Array.isArray(votedRes.data)) {
        setVotedElectionIds(
          votedRes.data.filter(
            (id): id is number => typeof id === "number" && Number.isInteger(id)
          )
        );
      }

      if (latestVoter) {
        setVoter(latestVoter);
        setName(latestVoter.name ?? "");
        setGender(latestVoter.gender ?? "");
        setDob(latestVoter.dob ?? "");
        setPhoneNo(latestVoter.phone_no ?? "");
        setProvince(latestVoter.province ?? "");
        setDistrict(latestVoter.district ?? "");
        setRegionId(latestVoter.region_id ? String(latestVoter.region_id) : "");
      }

      router.refresh();
    } catch {
      setFormError("Unable to refresh status.");
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    const trimmedName = name.trim();
    const trimmedGender = gender.trim();
    const trimmedDob = dob.trim();
    const trimmedPhone = phoneNo.trim();
    const trimmedProvince = province.trim();
    const trimmedDistrict = district.trim();
    const parsedRegionId = parsePositiveInt(regionId);

    if (
      !trimmedName ||
      !trimmedGender ||
      !trimmedDob ||
      !trimmedPhone ||
      !trimmedProvince ||
      !trimmedDistrict ||
      parsedRegionId === null
    ) {
      setFormError("All profile fields are required.");
      return;
    }

    if (
      trimmedName.length > 120 ||
      trimmedProvince.length > 80 ||
      trimmedDistrict.length > 80
    ) {
      setFormError("One or more fields exceed the maximum allowed length.");
      return;
    }

    if (!isValidPastDate(trimmedDob)) {
      setFormError("Enter a valid date of birth.");
      return;
    }

    if (!isValidPhone(trimmedPhone)) {
      setFormError("Enter a valid phone number.");
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: updatedVoter, error } = await supabase
        .from("voter")
        .update({
          name: trimmedName,
          gender: trimmedGender,
          dob: trimmedDob,
          phone_no: trimmedPhone,
          province: trimmedProvince,
          district: trimmedDistrict,
          region_id: parsedRegionId,
          profile_completed: true,
          approval_status: "PENDING",
        })
        .eq("auth_user_id", user.id)
        .select("*, region(*)")
        .single();

      if (error) {
        setFormError(sanitizePublicError(error, "Unable to save profile."));
        return;
      }

      if (updatedVoter) setVoter(updatedVoter);

      setSuccessMessage("Profile submitted for admin approval.");
      router.refresh();
    } catch {
      setFormError("Unable to save profile.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-xl font-semibold tracking-tight text-[#F3F4F6]">
            Voter Dashboard
          </h1>
          <span className="font-mono text-xs text-[#9CA3AF]">{voter.cnic}</span>
        </div>

        <button
          type="button"
          onClick={handleRefreshStatus}
          disabled={isRefreshing}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#1F2E26] bg-[#111814] px-3 py-1.5 text-xs font-medium text-[#9CA3AF] transition-colors hover:border-[#10B981]/50 hover:text-[#F3F4F6] disabled:opacity-60"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
          <span>Refresh</span>
        </button>
      </div>

      {/* Status Card */}
      {isProfileIncomplete && (
        <div className="flex items-start gap-3 rounded-lg border border-[#F59E0B]/40 bg-[#291C06]/60 p-4">
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0 text-[#F59E0B]"
            aria-hidden="true"
          />
          <div>
            <p className="text-sm font-semibold text-[#F59E0B]">
              Profile Incomplete
            </p>
            <p className="mt-0.5 text-xs text-[#F3F4F6]/80">
              Complete your details below to submit for admin verification.
            </p>
          </div>
        </div>
      )}

      {isPendingApproval && (
        <div className="flex items-start gap-3 rounded-lg border border-[#F59E0B]/40 bg-[#291C06]/60 p-4">
          <Clock
            className="mt-0.5 h-4 w-4 shrink-0 text-[#F59E0B]"
            aria-hidden="true"
          />
          <div>
            <p className="text-sm font-semibold text-[#F59E0B]">
              Pending Admin Approval
            </p>
            <p className="mt-0.5 text-xs text-[#F3F4F6]/80">
              Your submitted details are awaiting verification.
            </p>
          </div>
        </div>
      )}

      {isRejected && (
        <div className="flex items-start gap-3 rounded-lg border border-[#EF4444]/45 bg-[#2A0D10]/80 p-4">
          <XCircle
            className="mt-0.5 h-4 w-4 shrink-0 text-[#EF4444]"
            aria-hidden="true"
          />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-[#EF4444]">
              Registration Rejected
            </p>
            <p className="text-xs text-[#F3F4F6]">
              {voter.rejection_reason?.trim() || "Please update and resubmit."}
            </p>
          </div>
        </div>
      )}

      {isApproved && (
        <div className="space-y-3 rounded-lg border border-[#10B981]/50 bg-[#052E16]/70 p-4">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <CheckCircle2
                className="mt-0.5 h-5 w-5 shrink-0 text-[#22C55E]"
                aria-hidden="true"
              />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-[#F3F4F6]">
                    Approved &amp; Verified Voter
                  </p>
                  {activeElections.length > 0 && (
                    <span className="rounded-full border border-[#10B981]/40 bg-[#090D0B] px-2 py-0.5 font-mono text-[10px] font-semibold text-[#22C55E] uppercase">
                      {activeElections.filter(
                        (e) => !votedElectionIds.includes(e.election_id)
                      ).length > 0
                        ? `${
                            activeElections.filter(
                              (e) => !votedElectionIds.includes(e.election_id)
                            ).length
                          } Open to Vote`
                        : "All Active Voted"}
                    </span>
                  )}
                </div>
                {activeElections.length === 0 && (
                  <p className="mt-0.5 text-xs text-[#9CA3AF]">
                    No active elections right now.
                  </p>
                )}
              </div>
            </div>

            <Link
              href="/ballot"
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#10B981] px-4 py-2 text-xs font-semibold text-[#090D0B] transition-colors hover:bg-[#22C55E]"
            >
              <Vote className="h-4 w-4" aria-hidden="true" />
              <span>Go to Voting Ballot</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>

          {activeElections.length > 0 && (
            <div className="divide-y divide-[#1F2E26] overflow-hidden rounded-lg border border-[#1F2E26] bg-[#090D0B]/80">
              {activeElections.map((election) => {
                const alreadyVoted = votedElectionIds.includes(
                  election.election_id
                );
                return (
                  <div
                    key={election.election_id}
                    className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs"
                  >
                    <span className="truncate font-medium text-[#F3F4F6]">
                      {election.title}
                    </span>
                    {alreadyVoted ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#10B981]/35 bg-[#052E16] px-2.5 py-0.5 font-mono text-[10px] font-semibold text-[#22C55E] uppercase">
                        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                        Voted
                      </span>
                    ) : (
                      <Link
                        href={`/ballot?election=${election.election_id}`}
                        className="inline-flex shrink-0 items-center gap-1 rounded-md bg-[#10B981] px-2.5 py-1 font-semibold text-[#090D0B] hover:bg-[#22C55E]"
                      >
                        <span>Vote</span>
                        <ArrowRight className="h-3 w-3" aria-hidden="true" />
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          className="flex items-center justify-between rounded-lg border border-[#10B981]/40 bg-[#052E16]/70 px-4 py-2.5 text-xs text-[#22C55E]"
        >
          <span>{successMessage}</span>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="cursor-pointer text-[#F3F4F6] hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {(formError || regionsError) && (
        <div
          role="alert"
          className="flex items-center justify-between rounded-lg border border-[#EF4444]/40 bg-[#2A0D10] px-4 py-2.5 text-xs text-[#EF4444]"
        >
          <span className="inline-flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{formError ?? regionsError}</span>
          </span>
          {formError && (
            <button
              type="button"
              onClick={() => setFormError(null)}
              className="cursor-pointer hover:underline"
            >
              Dismiss
            </button>
          )}
        </div>
      )}

      {/* Profile Form OR Read-only Details */}
      {canEditProfile ? (
        <section className="ems-card p-6">
          <h2 className="border-b border-[#1F2E26] pb-3 text-sm font-semibold text-[#F3F4F6]">
            {isRejected ? "Update Profile" : "Complete Profile"}
          </h2>

          <form
            onSubmit={handleProfileSubmit}
            noValidate
            className="mt-5 space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <label
                  htmlFor="voter-name"
                  className="block text-xs font-medium text-[#9CA3AF]"
                >
                  Full Name
                </label>
                <input
                  id="voter-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-[#1F2E26] bg-[#090D0B] px-3 py-2 text-sm text-[#F3F4F6] focus:border-[#10B981] focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="voter-gender"
                  className="block text-xs font-medium text-[#9CA3AF]"
                >
                  Gender
                </label>
                <select
                  id="voter-gender"
                  required
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full rounded-lg border border-[#1F2E26] bg-[#090D0B] px-3 py-2 text-sm text-[#F3F4F6] focus:border-[#10B981] focus:outline-none"
                >
                  <option value="" disabled>
                    Select
                  </option>
                  {GENDER_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                  {gender &&
                    !GENDER_OPTIONS.includes(
                      gender as (typeof GENDER_OPTIONS)[number]
                    ) && <option value={gender}>{gender}</option>}
                </select>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="voter-dob"
                  className="block text-xs font-medium text-[#9CA3AF]"
                >
                  Date of Birth
                </label>
                <input
                  id="voter-dob"
                  type="date"
                  required
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full rounded-lg border border-[#1F2E26] bg-[#090D0B] px-3 py-2 text-sm text-[#F3F4F6] focus:border-[#10B981] focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="voter-phone"
                  className="block text-xs font-medium text-[#9CA3AF]"
                >
                  Phone Number
                </label>
                <input
                  id="voter-phone"
                  type="tel"
                  required
                  value={phoneNo}
                  onChange={(e) => setPhoneNo(e.target.value)}
                  placeholder="+92 300 1234567"
                  className="w-full rounded-lg border border-[#1F2E26] bg-[#090D0B] px-3 py-2 text-sm text-[#F3F4F6] placeholder-[#6B7280] focus:border-[#10B981] focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="voter-province"
                  className="block text-xs font-medium text-[#9CA3AF]"
                >
                  Province
                </label>
                <input
                  id="voter-province"
                  type="text"
                  list="ems-province-suggestions"
                  required
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  className="w-full rounded-lg border border-[#1F2E26] bg-[#090D0B] px-3 py-2 text-sm text-[#F3F4F6] focus:border-[#10B981] focus:outline-none"
                />
                <datalist id="ems-province-suggestions">
                  {PROVINCE_SUGGESTIONS.map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="voter-district"
                  className="block text-xs font-medium text-[#9CA3AF]"
                >
                  District
                </label>
                <input
                  id="voter-district"
                  type="text"
                  required
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="w-full rounded-lg border border-[#1F2E26] bg-[#090D0B] px-3 py-2 text-sm text-[#F3F4F6] focus:border-[#10B981] focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="voter-region"
                  className="block text-xs font-medium text-[#9CA3AF]"
                >
                  Region
                </label>
                <select
                  id="voter-region"
                  required
                  disabled={regions.length === 0}
                  value={regionId}
                  onChange={(e) => setRegionId(e.target.value)}
                  className="w-full rounded-lg border border-[#1F2E26] bg-[#090D0B] px-3 py-2 text-sm text-[#F3F4F6] focus:border-[#10B981] focus:outline-none disabled:opacity-60"
                >
                  <option value="" disabled>
                    {regions.length === 0 ? "No regions available" : "Select"}
                  </option>
                  {regions.map((region) => (
                    <option
                      key={region.region_id}
                      value={String(region.region_id)}
                    >
                      {formatRegionLabel(region)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end border-t border-[#1F2E26] pt-4">
              <button
                type="submit"
                disabled={isSubmitting || regions.length === 0}
                className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#10B981] px-4 py-2 text-sm font-semibold text-[#090D0B] transition-colors hover:bg-[#22C55E] disabled:opacity-60"
              >
                {isSubmitting && (
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                )}
                <span>{isRejected ? "Resubmit" : "Submit Profile"}</span>
              </button>
            </div>
          </form>
        </section>
      ) : (
        <section className="ems-card p-6">
          <h2 className="border-b border-[#1F2E26] pb-3 text-sm font-semibold text-[#F3F4F6]">
            Voter Details
          </h2>

          <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { label: "Name", value: voter.name ?? "—" },
              { label: "CNIC", value: voter.cnic, mono: true },
              { label: "Email", value: voter.email },
              { label: "Gender", value: voter.gender ?? "—" },
              { label: "Date of Birth", value: formatDisplayDate(voter.dob) },
              { label: "Phone", value: voter.phone_no ?? "—", mono: true },
              { label: "Province", value: voter.province ?? "—" },
              { label: "District", value: voter.district ?? "—" },
              {
                label: "Region",
                value: assignedRegion
                  ? formatRegionLabel(assignedRegion)
                  : voter.region_id
                    ? `#${voter.region_id}`
                    : "—",
              },
            ].map((field) => (
              <div
                key={field.label}
                className="rounded-lg border border-[#1F2E26] bg-[#090D0B] p-3"
              >
                <dt className="text-[11px] text-[#6B7280]">{field.label}</dt>
                <dd
                  className={`mt-1 truncate text-sm font-medium text-[#F3F4F6] ${
                    field.mono ? "font-mono" : ""
                  }`}
                >
                  {field.value}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </div>
  );
}
