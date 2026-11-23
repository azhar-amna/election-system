"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const CNIC_PATTERN = /^\d{5}-\d{7}-\d$/;

function formatCnic(input: string): string {
  const digits = input.replace(/\D/g, "").slice(0, 13);
  if (digits.length <= 5) {
    return digits;
  }
  if (digits.length <= 12) {
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
}

export default function RegisterPage() {
  const router = useRouter();

  const [cnic, setCnic] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(
    null
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    const normalizedCnic = formatCnic(cnic.trim());
    const normalizedEmail = email.trim().toLowerCase();

    if (!CNIC_PATTERN.test(normalizedCnic)) {
      setErrorMessage(
        "Enter a valid 13-digit CNIC formatted as 12345-1234567-1."
      );
      return;
    }

    if (!normalizedEmail) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters long.");
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            cnic: normalizedCnic,
          },
        },
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      // Supabase returns an obfuscated user with empty identities if the email is already registered
      if (
        data.user &&
        Array.isArray(data.user.identities) &&
        data.user.identities.length === 0
      ) {
        setErrorMessage(
          "An account with this email already exists. Please sign in instead."
        );
        return;
      }

      if (data.session) {
        router.push("/dashboard");
        router.refresh();
        return;
      }

      // Email confirmation is enabled in Supabase Auth
      setConfirmationEmail(normalizedEmail);
    } catch {
      setErrorMessage(
        "Unable to complete registration right now. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-md flex-col justify-center px-4 py-12 sm:px-6">
      <div className="ems-card p-6 sm:p-8">
        {/* Header */}
        <div className="flex flex-col items-start">
          <span className="ems-badge-emerald inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[11px] font-semibold tracking-wider uppercase">
            <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
            Voter Registration
          </span>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-[#F3F4F6]">
            Create Voter Account
          </h1>
          <p className="mt-1.5 text-sm text-[#9CA3AF]">
            Register with your CNIC, email, and password. You will complete your
            voter profile on the dashboard for administrative verification.
          </p>
        </div>

        {/* Email Verification Confirmation State */}
        {confirmationEmail ? (
          <div className="mt-6 space-y-5">
            <div
              role="status"
              className="rounded-xl border border-[#10B981]/40 bg-[#052E16]/70 p-5"
            >
              <div className="flex items-start gap-3">
                <CheckCircle2
                  className="mt-0.5 h-5 w-5 shrink-0 text-[#22C55E]"
                  aria-hidden="true"
                />
                <div className="space-y-1.5">
                  <h2 className="text-sm font-semibold text-[#F3F4F6]">
                    Verify Your Email to Continue
                  </h2>
                  <p className="text-sm leading-relaxed text-[#9CA3AF]">
                    Your voter account has been created and linked to CNIC{" "}
                    <span className="font-mono font-medium text-[#22C55E]">
                      {formatCnic(cnic)}
                    </span>
                    . We sent a confirmation link to{" "}
                    <span className="font-medium text-[#F3F4F6]">
                      {confirmationEmail}
                    </span>
                    .
                  </p>
                  <p className="text-xs text-[#9CA3AF]">
                    Once verified, sign in to complete your voter profile and
                    submit it for admin approval.
                  </p>
                </div>
              </div>
            </div>

            <Link
              href="/login"
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#10B981] px-4 py-2.5 text-sm font-semibold text-[#090D0B] transition-colors hover:bg-[#22C55E]"
            >
              <span>Proceed to Login</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-5">
            {/* Error Alert */}
            {errorMessage && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-lg border border-[#EF4444]/40 bg-[#2A0D10] p-3.5 text-sm text-[#EF4444]"
              >
                <AlertCircle
                  className="mt-0.5 h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Field 1: CNIC */}
            <div className="space-y-1.5">
              <label
                htmlFor="cnic"
                className="block text-sm font-medium text-[#F3F4F6]"
              >
                CNIC Number
              </label>
              <div className="relative">
                <CreditCard
                  className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]"
                  aria-hidden="true"
                />
                <input
                  id="cnic"
                  name="cnic"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  required
                  maxLength={15}
                  value={cnic}
                  onChange={(e) => setCnic(formatCnic(e.target.value))}
                  placeholder="12345-1234567-1"
                  aria-describedby="cnic-hint"
                  className="w-full rounded-lg border border-[#1F2E26] bg-[#090D0B] py-2.5 pr-3.5 pl-10 font-mono text-sm tracking-wider text-[#F3F4F6] placeholder-[#6B7280] transition-colors focus:border-[#10B981] focus:outline-none"
                />
              </div>
              <p id="cnic-hint" className="text-xs text-[#9CA3AF]">
                13-digit national identity number formatted as{" "}
                <span className="font-mono text-[#F3F4F6]">
                  12345-1234567-1
                </span>
                .
              </p>
            </div>

            {/* Field 2: Email */}
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="block text-sm font-medium text-[#F3F4F6]"
              >
                Email Address
              </label>
              <div className="relative">
                <Mail
                  className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]"
                  aria-hidden="true"
                />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voter@example.com"
                  className="w-full rounded-lg border border-[#1F2E26] bg-[#090D0B] py-2.5 pr-3.5 pl-10 text-sm text-[#F3F4F6] placeholder-[#6B7280] transition-colors focus:border-[#10B981] focus:outline-none"
                />
              </div>
            </div>

            {/* Field 3: Password */}
            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-[#F3F4F6]"
              >
                Password
              </label>
              <div className="relative">
                <Lock
                  className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]"
                  aria-hidden="true"
                />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full rounded-lg border border-[#1F2E26] bg-[#090D0B] py-2.5 pr-11 pl-10 text-sm text-[#F3F4F6] placeholder-[#6B7280] transition-colors focus:border-[#10B981] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer text-[#9CA3AF] transition-colors hover:text-[#F3F4F6]"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#10B981] px-4 py-2.5 text-sm font-semibold text-[#090D0B] transition-colors hover:bg-[#22C55E] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                  <span>Registering Voter...</span>
                </>
              ) : (
                <>
                  <span>Register as Voter</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </>
              )}
            </button>
          </form>
        )}

        {/* Footer Links & Civic Notice */}
        <div className="mt-6 border-t border-[#1F2E26] pt-5">
          <p className="text-center text-sm text-[#9CA3AF]">
            Already registered?{" "}
            <Link
              href="/login"
              className="font-medium text-[#10B981] transition-colors hover:text-[#22C55E]"
            >
              Sign in
            </Link>
          </p>
          <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-[#6B7280]">
            <ShieldCheck
              className="h-3.5 w-3.5 shrink-0 text-[#10B981]"
              aria-hidden="true"
            />
            <span>
              Public registration is strictly for voters. Approval is required
              before ballot access.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
