"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  Loader2,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  ShieldCheck,
  User,
  Vote,
  XCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Election, Region, VoterWithRegion } from "@/types/database";

interface VoterDashboardClientProps {
  initialVoter: VoterWithRegion;
  regions: Region[];
  activeElection: Pick<
    Election,
    "election_id" | "title" | "start_date" | "end_date" | "status"
  > | null;
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
  if (!value) return "Not provided";
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
  activeElection,
  regionsError,
}: VoterDashboardClientProps) {
  const router = useRouter();

  const [voter, setVoter] = useState<VoterWithRegion>(initialVoter);

  // Profile form state (pre-populated for incomplete/rejected re-submission)
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

  // Determine exact onboarding & approval state
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

      const { data: latestVoter, error } = await supabase
        .from("voter")
        .select("*, region(*)")
        .eq("auth_user_id", user.id)
        .single();

      if (error) {
        setFormError(error.message);
        return;
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
      setFormError("Unable to refresh verification status right now.");
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
    const parsedRegionId = Number(regionId);

    if (!trimmedName) {
      setFormError("Please enter your full legal name.");
      return;
    }
    if (!trimmedGender) {
      setFormError("Please select your gender.");
      return;
    }
    if (!trimmedDob) {
      setFormError("Please enter your date of birth.");
      return;
    }

    const dobDate = new Date(trimmedDob);
    if (Number.isNaN(dobDate.getTime()) || dobDate > new Date()) {
      setFormError("Please enter a valid date of birth in the past.");
      return;
    }

    if (!trimmedPhone) {
      setFormError("Please enter your phone number.");
      return;
    }
    if (!trimmedProvince) {
      setFormError("Please enter your province.");
      return;
    }
    if (!trimmedDistrict) {
      setFormError("Please enter your district.");
      return;
    }
    if (!regionId || !Number.isInteger(parsedRegionId) || parsedRegionId <= 0) {
      setFormError("Please select your electoral region.");
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
        setFormError(error.message);
        return;
      }

      if (updatedVoter) {
        setVoter(updatedVoter);
      }

      setSuccessMessage(
        "Your voter profile has been submitted and is now awaiting admin approval."
      );
      router.refresh();
    } catch {
      setFormError(
        "Unable to save your voter profile right now. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  // Step progress state
  const step2Done = voter.profile_completed && !isRejected;
  const step3Done = isApproved;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="ems-badge-emerald inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[11px] font-semibold tracking-wider uppercase">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Voter Portal
          </span>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-[#F3F4F6] sm:text-3xl">
            Voter Dashboard
          </h1>
          <p className="mt-1 text-sm text-[#9CA3AF]">
            Manage your voter identity profile, track administrative approval,
            and access active encrypted ballots.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 rounded-lg border border-[#1F2E26] bg-[#111814] px-3.5 py-2">
            <CreditCard
              className="h-4 w-4 text-[#10B981]"
              aria-hidden="true"
            />
            <span className="text-xs text-[#9CA3AF]">CNIC</span>
            <span className="font-mono text-xs font-semibold tracking-wider text-[#F3F4F6]">
              {voter.cnic}
            </span>
          </div>
          <button
            type="button"
            onClick={handleRefreshStatus}
            disabled={isRefreshing}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#1F2E26] bg-[#111814] px-3.5 py-2 text-xs font-medium text-[#F3F4F6] transition-colors hover:border-[#10B981]/50 hover:text-[#22C55E] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            <span>{isRefreshing ? "Refreshing..." : "Refresh Status"}</span>
          </button>
        </div>
      </div>

      {/* Prominent Status Banner Card */}
      {isProfileIncomplete && (
        <section
          aria-label="Voter Registration Status"
          className="rounded-xl border border-[#F59E0B]/40 bg-[#291C06]/65 p-6"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#F59E0B]/40 bg-[#291C06] text-[#F59E0B]">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="ems-badge-warning rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold tracking-wider uppercase">
                  Profile Incomplete
                </span>
                <span className="font-mono text-xs text-[#9CA3AF]">
                  Step 2 of 3 Required
                </span>
              </div>
              <h2 className="text-lg font-semibold text-[#F3F4F6]">
                Complete Your Voter Profile to Request Verification
              </h2>
              <p className="text-sm leading-relaxed text-[#F3F4F6]/80">
                Your voter account is registered, but your personal details and
                electoral region are still missing. Fill out the form below to
                submit your profile for administrative review. Ballot access
                remains locked until your registration is approved.
              </p>
            </div>
          </div>
        </section>
      )}

      {isPendingApproval && (
        <section
          aria-label="Voter Registration Status"
          className="rounded-xl border border-[#F59E0B]/40 bg-[#291C06]/65 p-6"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#F59E0B]/40 bg-[#291C06] text-[#F59E0B]">
              <Clock className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="ems-badge-warning rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold tracking-wider uppercase">
                  Pending Admin Approval
                </span>
                <span className="font-mono text-xs text-[#9CA3AF]">
                  Under Administrative Review
                </span>
              </div>
              <h2 className="text-lg font-semibold text-[#F3F4F6]">
                Pending Admin Approval
              </h2>
              <p className="text-sm leading-relaxed text-[#F3F4F6]/80">
                Your voter profile has been submitted and is currently locked in
                read-only mode while an election administrator verifies your
                CNIC and constituency details. Check back shortly or click{" "}
                <span className="font-medium text-[#F59E0B]">
                  Refresh Status
                </span>{" "}
                above to see updates.
              </p>
            </div>
          </div>
        </section>
      )}

      {isRejected && (
        <section
          aria-label="Voter Registration Status"
          className="rounded-xl border border-[#EF4444]/45 bg-[#2A0D10]/80 p-6"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#EF4444]/40 bg-[#2A0D10] text-[#EF4444]">
              <XCircle className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="ems-badge-danger rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold tracking-wider uppercase">
                  Registration Rejected
                </span>
                <span className="font-mono text-xs text-[#9CA3AF]">
                  Action Required
                </span>
              </div>
              <h2 className="text-lg font-semibold text-[#F3F4F6]">
                Registration Rejected — Please Correct &amp; Resubmit
              </h2>
              <div className="rounded-lg border border-[#EF4444]/35 bg-[#090D0B]/70 p-3.5">
                <p className="font-mono text-[11px] font-semibold tracking-wider text-[#EF4444] uppercase">
                  Rejection Reason
                </p>
                <p className="mt-1 text-sm text-[#F3F4F6]">
                  {voter.rejection_reason?.trim()
                    ? voter.rejection_reason
                    : "Your submitted profile details could not be verified. Please review all fields carefully and resubmit."}
                </p>
              </div>
              <p className="text-sm text-[#F3F4F6]/80">
                Edit your details in the form below and resubmit to return your
                registration to the administrative approval queue.
              </p>
            </div>
          </div>
        </section>
      )}

      {isApproved && (
        <section
          aria-label="Voter Registration Status"
          className="rounded-xl border border-[#10B981]/50 bg-[#052E16]/75 p-6"
        >
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#10B981]/50 bg-[#052E16] text-[#22C55E]">
                <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
              </div>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="ems-badge-emerald rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold tracking-wider uppercase">
                    Approved &amp; Verified Voter
                  </span>
                  {voter.has_voted ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#22C55E]/40 bg-[#090D0B]/80 px-2.5 py-0.5 font-mono text-[11px] font-semibold tracking-wider text-[#22C55E] uppercase">
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Vote Recorded
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#10B981]/40 bg-[#090D0B]/80 px-2.5 py-0.5 font-mono text-[11px] font-semibold tracking-wider text-[#10B981] uppercase">
                      <Vote className="h-3.5 w-3.5" aria-hidden="true" />
                      Not Yet Voted
                    </span>
                  )}
                </div>

                <h2 className="text-lg font-semibold text-[#F3F4F6]">
                  Approved &amp; Verified Voter
                </h2>

                <p className="max-w-2xl text-sm leading-relaxed text-[#F3F4F6]/80">
                  {voter.has_voted
                    ? "Your identity is verified and your encrypted ballot has already been recorded. You can open the voting booth to view your participation status."
                    : activeElection
                      ? `Your identity is verified for ${activeElection.title}. Enter the voting booth to cast your secret, single-use encrypted ballot.`
                      : "Your voter registration has been approved by an administrator. You are cleared to enter the voting booth when an election is active."}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
              <Link
                href="/ballot"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#10B981] px-5 py-3 text-sm font-semibold text-[#090D0B] transition-colors hover:bg-[#22C55E]"
              >
                <Vote className="h-4 w-4" aria-hidden="true" />
                <span>Go to Voting Ballot</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              {voter.approved_at && (
                <span className="font-mono text-[11px] text-[#9CA3AF]">
                  Verified on {formatDisplayDate(voter.approved_at)}
                </span>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Onboarding Progress Tracker */}
      <section
        aria-label="Verification Progress"
        className="ems-card grid gap-3 p-4 sm:grid-cols-3"
      >
        <div className="flex items-center gap-3 rounded-lg border border-[#10B981]/30 bg-[#052E16]/40 px-3.5 py-2.5">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#10B981] font-mono text-xs font-bold text-[#090D0B]">
            1
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#F3F4F6]">
              Account Registered
            </p>
            <p className="truncate text-[11px] text-[#22C55E]">
              CNIC &amp; Email Linked
            </p>
          </div>
        </div>

        <div
          className={`flex items-center gap-3 rounded-lg border px-3.5 py-2.5 ${
            step2Done
              ? "border-[#10B981]/30 bg-[#052E16]/40"
              : isRejected
                ? "border-[#EF4444]/40 bg-[#2A0D10]/50"
                : "border-[#F59E0B]/40 bg-[#291C06]/40"
          }`}
        >
          <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold ${
              step2Done
                ? "bg-[#10B981] text-[#090D0B]"
                : isRejected
                  ? "bg-[#EF4444] text-[#090D0B]"
                  : "bg-[#F59E0B] text-[#090D0B]"
            }`}
          >
            2
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#F3F4F6]">
              Voter Profile
            </p>
            <p
              className={`truncate text-[11px] ${
                step2Done
                  ? "text-[#22C55E]"
                  : isRejected
                    ? "text-[#EF4444]"
                    : "text-[#F59E0B]"
              }`}
            >
              {step2Done
                ? "Submitted"
                : isRejected
                  ? "Needs Resubmission"
                  : "Incomplete"}
            </p>
          </div>
        </div>

        <div
          className={`flex items-center gap-3 rounded-lg border px-3.5 py-2.5 ${
            step3Done
              ? "border-[#10B981]/30 bg-[#052E16]/40"
              : "border-[#1F2E26] bg-[#090D0B]/60"
          }`}
        >
          <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold ${
              step3Done
                ? "bg-[#10B981] text-[#090D0B]"
                : "border border-[#1F2E26] bg-[#161F1A] text-[#9CA3AF]"
            }`}
          >
            3
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#F3F4F6]">
              Admin Verification
            </p>
            <p
              className={`truncate text-[11px] ${
                step3Done ? "text-[#22C55E]" : "text-[#9CA3AF]"
              }`}
            >
              {step3Done
                ? voter.has_voted
                  ? "Approved • Voted"
                  : "Approved • Ready to Vote"
                : isPendingApproval
                  ? "Awaiting Admin Review"
                  : "Locked"}
            </p>
          </div>
        </div>
      </section>

      {/* Success Toast / Inline Feedback */}
      {successMessage && (
        <div
          role="status"
          className="flex items-start justify-between gap-3 rounded-xl border border-[#10B981]/40 bg-[#052E16]/75 p-4 text-sm text-[#22C55E]"
        >
          <div className="flex items-start gap-2.5">
            <CheckCircle2
              className="mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
            />
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="cursor-pointer text-xs font-medium text-[#F3F4F6] underline-offset-2 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Global Error Alert */}
      {(formError || regionsError) && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-xl border border-[#EF4444]/40 bg-[#2A0D10] p-4 text-sm text-[#EF4444]"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle
              className="mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
            />
            <span>{formError ?? regionsError}</span>
          </div>
          {formError && (
            <button
              type="button"
              onClick={() => setFormError(null)}
              className="cursor-pointer text-xs font-medium underline-offset-2 hover:underline"
            >
              Dismiss
            </button>
          )}
        </div>
      )}

      {/* Main Content: Editable Complete Profile Form OR Read-Only Submitted Details */}
      {canEditProfile ? (
        <section aria-label="Complete Voter Profile" className="ems-card p-6 sm:p-8">
          <div className="border-b border-[#1F2E26] pb-5">
            <h2 className="text-lg font-semibold text-[#F3F4F6]">
              {isRejected
                ? "Edit & Resubmit Voter Profile"
                : "Complete Voter Profile"}
            </h2>
            <p className="mt-1 text-sm text-[#9CA3AF]">
              Provide accurate personal and constituency information matching
              your official CNIC record.
            </p>
          </div>

          {/* Read-only Registered Identifiers */}
          <div className="mt-6 grid gap-4 rounded-xl border border-[#1F2E26] bg-[#090D0B]/80 p-4 sm:grid-cols-2">
            <div className="flex items-center gap-3">
              <CreditCard
                className="h-4 w-4 shrink-0 text-[#10B981]"
                aria-hidden="true"
              />
              <div>
                <p className="text-[11px] font-medium tracking-wider text-[#9CA3AF] uppercase">
                  Registered CNIC (Locked)
                </p>
                <p className="mt-0.5 font-mono text-sm font-semibold text-[#F3F4F6]">
                  {voter.cnic}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Mail
                className="h-4 w-4 shrink-0 text-[#10B981]"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="text-[11px] font-medium tracking-wider text-[#9CA3AF] uppercase">
                  Registered Email (Locked)
                </p>
                <p className="mt-0.5 truncate text-sm font-medium text-[#F3F4F6]">
                  {voter.email}
                </p>
              </div>
            </div>
          </div>

          <form
            onSubmit={handleProfileSubmit}
            noValidate
            className="mt-6 space-y-6"
          >
            <div className="grid gap-5 sm:grid-cols-2">
              {/* Full Name */}
              <div className="space-y-1.5 sm:col-span-2">
                <label
                  htmlFor="voter-name"
                  className="block text-sm font-medium text-[#F3F4F6]"
                >
                  Full Name <span className="text-[#EF4444]">*</span>
                </label>
                <div className="relative">
                  <User
                    className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]"
                    aria-hidden="true"
                  />
                  <input
                    id="voter-name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Full legal name as shown on CNIC"
                    className="w-full rounded-lg border border-[#1F2E26] bg-[#090D0B] py-2.5 pr-3.5 pl-10 text-sm text-[#F3F4F6] placeholder-[#6B7280] transition-colors focus:border-[#10B981] focus:outline-none"
                  />
                </div>
              </div>

              {/* Gender */}
              <div className="space-y-1.5">
                <label
                  htmlFor="voter-gender"
                  className="block text-sm font-medium text-[#F3F4F6]"
                >
                  Gender <span className="text-[#EF4444]">*</span>
                </label>
                <select
                  id="voter-gender"
                  name="gender"
                  required
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full rounded-lg border border-[#1F2E26] bg-[#090D0B] px-3.5 py-2.5 text-sm text-[#F3F4F6] transition-colors focus:border-[#10B981] focus:outline-none"
                >
                  <option value="" disabled>
                    Select gender
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

              {/* Date of Birth */}
              <div className="space-y-1.5">
                <label
                  htmlFor="voter-dob"
                  className="block text-sm font-medium text-[#F3F4F6]"
                >
                  Date of Birth <span className="text-[#EF4444]">*</span>
                </label>
                <div className="relative">
                  <Calendar
                    className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]"
                    aria-hidden="true"
                  />
                  <input
                    id="voter-dob"
                    name="dob"
                    type="date"
                    required
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full rounded-lg border border-[#1F2E26] bg-[#090D0B] py-2.5 pr-3.5 pl-10 text-sm text-[#F3F4F6] transition-colors focus:border-[#10B981] focus:outline-none"
                  />
                </div>
              </div>

              {/* Phone Number */}
              <div className="space-y-1.5">
                <label
                  htmlFor="voter-phone"
                  className="block text-sm font-medium text-[#F3F4F6]"
                >
                  Phone Number <span className="text-[#EF4444]">*</span>
                </label>
                <div className="relative">
                  <Phone
                    className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]"
                    aria-hidden="true"
                  />
                  <input
                    id="voter-phone"
                    name="phone_no"
                    type="tel"
                    autoComplete="tel"
                    required
                    value={phoneNo}
                    onChange={(e) => setPhoneNo(e.target.value)}
                    placeholder="+92 300 1234567"
                    className="w-full rounded-lg border border-[#1F2E26] bg-[#090D0B] py-2.5 pr-3.5 pl-10 text-sm text-[#F3F4F6] placeholder-[#6B7280] transition-colors focus:border-[#10B981] focus:outline-none"
                  />
                </div>
              </div>

              {/* Province */}
              <div className="space-y-1.5">
                <label
                  htmlFor="voter-province"
                  className="block text-sm font-medium text-[#F3F4F6]"
                >
                  Province <span className="text-[#EF4444]">*</span>
                </label>
                <input
                  id="voter-province"
                  name="province"
                  type="text"
                  list="ems-province-suggestions"
                  required
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  placeholder="e.g. Punjab, Sindh, KP, Balochistan"
                  className="w-full rounded-lg border border-[#1F2E26] bg-[#090D0B] px-3.5 py-2.5 text-sm text-[#F3F4F6] placeholder-[#6B7280] transition-colors focus:border-[#10B981] focus:outline-none"
                />
                <datalist id="ems-province-suggestions">
                  {PROVINCE_SUGGESTIONS.map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
              </div>

              {/* District */}
              <div className="space-y-1.5">
                <label
                  htmlFor="voter-district"
                  className="block text-sm font-medium text-[#F3F4F6]"
                >
                  District <span className="text-[#EF4444]">*</span>
                </label>
                <input
                  id="voter-district"
                  name="district"
                  type="text"
                  required
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder="e.g. Lahore, Karachi, Rawalpindi"
                  className="w-full rounded-lg border border-[#1F2E26] bg-[#090D0B] px-3.5 py-2.5 text-sm text-[#F3F4F6] placeholder-[#6B7280] transition-colors focus:border-[#10B981] focus:outline-none"
                />
              </div>

              {/* Electoral Region */}
              <div className="space-y-1.5">
                <label
                  htmlFor="voter-region"
                  className="block text-sm font-medium text-[#F3F4F6]"
                >
                  Electoral Region <span className="text-[#EF4444]">*</span>
                </label>
                <div className="relative">
                  <MapPin
                    className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]"
                    aria-hidden="true"
                  />
                  <select
                    id="voter-region"
                    name="region_id"
                    required
                    disabled={regions.length === 0}
                    value={regionId}
                    onChange={(e) => setRegionId(e.target.value)}
                    className="w-full rounded-lg border border-[#1F2E26] bg-[#090D0B] py-2.5 pr-3.5 pl-10 text-sm text-[#F3F4F6] transition-colors focus:border-[#10B981] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <option value="" disabled>
                      {regions.length === 0
                        ? "No electoral regions available yet"
                        : "Select your electoral region"}
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
                {regions.length === 0 && (
                  <p className="text-xs text-[#F59E0B]">
                    No regions have been configured by an administrator yet.
                    Please contact your election administrator.
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col-reverse items-stretch justify-between gap-3 border-t border-[#1F2E26] pt-6 sm:flex-row sm:items-center">
              <p className="text-xs text-[#9CA3AF]">
                Submitting sets your profile status to{" "}
                <span className="font-mono text-[#F59E0B]">PENDING</span> until
                verified by an administrator.
              </p>

              <button
                type="submit"
                disabled={isSubmitting || regions.length === 0}
                className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#10B981] px-5 py-2.5 text-sm font-semibold text-[#090D0B] transition-colors hover:bg-[#22C55E] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                    <span>Submitting Profile...</span>
                  </>
                ) : (
                  <>
                    <span>
                      {isRejected
                        ? "Resubmit Profile for Approval"
                        : "Submit Profile for Approval"}
                    </span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </>
                )}
              </button>
            </div>
          </form>
        </section>
      ) : (
        <section
          aria-label="Submitted Voter Profile Details"
          className="ems-card p-6 sm:p-8"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1F2E26] pb-5">
            <div>
              <h2 className="text-lg font-semibold text-[#F3F4F6]">
                {isApproved
                  ? "Verified Voter Identity Record"
                  : "Submitted Voter Details (Read-Only)"}
              </h2>
              <p className="mt-1 text-sm text-[#9CA3AF]">
                {isApproved
                  ? "Your personal and constituency details are verified and locked for election integrity."
                  : "Your details are locked while under administrative verification."}
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 font-mono text-[11px] font-semibold tracking-wider uppercase ${
                isApproved ? "ems-badge-emerald" : "ems-badge-warning"
              }`}
            >
              {isApproved ? "Verified Record" : "Read-Only • Pending"}
            </span>
          </div>

          <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border border-[#1F2E26] bg-[#090D0B]/70 p-4">
              <dt className="text-[11px] font-medium tracking-wider text-[#9CA3AF] uppercase">
                Full Name
              </dt>
              <dd className="mt-1.5 text-sm font-semibold text-[#F3F4F6]">
                {voter.name ?? "Not provided"}
              </dd>
            </div>

            <div className="rounded-lg border border-[#1F2E26] bg-[#090D0B]/70 p-4">
              <dt className="text-[11px] font-medium tracking-wider text-[#9CA3AF] uppercase">
                CNIC Number
              </dt>
              <dd className="mt-1.5 font-mono text-sm font-semibold text-[#22C55E]">
                {voter.cnic}
              </dd>
            </div>

            <div className="rounded-lg border border-[#1F2E26] bg-[#090D0B]/70 p-4">
              <dt className="text-[11px] font-medium tracking-wider text-[#9CA3AF] uppercase">
                Email Address
              </dt>
              <dd className="mt-1.5 truncate text-sm font-medium text-[#F3F4F6]">
                {voter.email}
              </dd>
            </div>

            <div className="rounded-lg border border-[#1F2E26] bg-[#090D0B]/70 p-4">
              <dt className="text-[11px] font-medium tracking-wider text-[#9CA3AF] uppercase">
                Gender
              </dt>
              <dd className="mt-1.5 text-sm font-medium text-[#F3F4F6]">
                {voter.gender ?? "Not provided"}
              </dd>
            </div>

            <div className="rounded-lg border border-[#1F2E26] bg-[#090D0B]/70 p-4">
              <dt className="text-[11px] font-medium tracking-wider text-[#9CA3AF] uppercase">
                Date of Birth
              </dt>
              <dd className="mt-1.5 text-sm font-medium text-[#F3F4F6]">
                {formatDisplayDate(voter.dob)}
              </dd>
            </div>

            <div className="rounded-lg border border-[#1F2E26] bg-[#090D0B]/70 p-4">
              <dt className="text-[11px] font-medium tracking-wider text-[#9CA3AF] uppercase">
                Phone Number
              </dt>
              <dd className="mt-1.5 font-mono text-sm font-medium text-[#F3F4F6]">
                {voter.phone_no ?? "Not provided"}
              </dd>
            </div>

            <div className="rounded-lg border border-[#1F2E26] bg-[#090D0B]/70 p-4">
              <dt className="text-[11px] font-medium tracking-wider text-[#9CA3AF] uppercase">
                Province
              </dt>
              <dd className="mt-1.5 text-sm font-medium text-[#F3F4F6]">
                {voter.province ?? "Not provided"}
              </dd>
            </div>

            <div className="rounded-lg border border-[#1F2E26] bg-[#090D0B]/70 p-4">
              <dt className="text-[11px] font-medium tracking-wider text-[#9CA3AF] uppercase">
                District
              </dt>
              <dd className="mt-1.5 text-sm font-medium text-[#F3F4F6]">
                {voter.district ?? "Not provided"}
              </dd>
            </div>

            <div className="rounded-lg border border-[#1F2E26] bg-[#090D0B]/70 p-4">
              <dt className="text-[11px] font-medium tracking-wider text-[#9CA3AF] uppercase">
                Electoral Region
              </dt>
              <dd className="mt-1.5 text-sm font-semibold text-[#10B981]">
                {assignedRegion
                  ? formatRegionLabel(assignedRegion)
                  : voter.region_id
                    ? `Region #${voter.region_id}`
                    : "Not assigned"}
              </dd>
            </div>
          </dl>
        </section>
      )}
    </div>
  );
}
