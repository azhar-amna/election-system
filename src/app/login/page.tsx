"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  LogIn,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

function getSafeRedirectPath(
  nextParam: string | null,
  isAdmin: boolean
): string {
  const defaultPath = isAdmin ? "/admin" : "/dashboard";

  if (!nextParam || !nextParam.startsWith("/") || nextParam.startsWith("//")) {
    return defaultPath;
  }

  if (isAdmin) {
    return nextParam === "/admin" || nextParam.startsWith("/admin/")
      ? nextParam
      : "/admin";
  }

  const isAllowedVoterPath =
    nextParam === "/dashboard" ||
    nextParam.startsWith("/dashboard/") ||
    nextParam === "/ballot" ||
    nextParam.startsWith("/ballot/");

  return isAllowedVoterPath ? nextParam : "/dashboard";
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      setErrorMessage("Please enter both your email address and password.");
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      const isAdmin = data.user?.app_metadata?.role === "admin";
      const nextParam = searchParams.get("next");
      const destination = getSafeRedirectPath(nextParam, isAdmin);

      router.push(destination);
      router.refresh();
    } catch {
      setErrorMessage("Unable to sign in right now. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="ems-card p-6 sm:p-8">
      {/* Header */}
      <div className="flex flex-col items-start">
        <span className="ems-badge-emerald inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[11px] font-semibold tracking-wider uppercase">
          <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
          Secure Portal Access
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-[#F3F4F6]">
          Sign In to EMS
        </h1>
        <p className="mt-1.5 text-sm text-[#9CA3AF]">
          Unified sign-in for registered Voters and Election Administrators.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-5">
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

        {/* Email */}
        <div className="space-y-1.5">
          <label
            htmlFor="login-email"
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
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full rounded-lg border border-[#1F2E26] bg-[#090D0B] py-2.5 pr-3.5 pl-10 text-sm text-[#F3F4F6] placeholder-[#6B7280] transition-colors focus:border-[#10B981] focus:outline-none"
            />
          </div>
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <label
            htmlFor="login-password"
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
              id="login-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
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
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span>Verifying Credentials...</span>
            </>
          ) : (
            <>
              <span>Sign In</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </>
          )}
        </button>
      </form>

      {/* Footer Links */}
      <div className="mt-6 border-t border-[#1F2E26] pt-5">
        <p className="text-center text-sm text-[#9CA3AF]">
          New voter?{" "}
          <Link
            href="/register"
            className="font-medium text-[#10B981] transition-colors hover:text-[#22C55E]"
          >
            Register with your CNIC
          </Link>
        </p>
        <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-[#6B7280]">
          <ShieldCheck
            className="h-3.5 w-3.5 shrink-0 text-[#10B981]"
            aria-hidden="true"
          />
          <span>
            Role-verified routing directs Voters to Dashboard and Admins to
            Admin Console.
          </span>
        </div>
      </div>
    </div>
  );
}

function LoginFormSkeleton() {
  return (
    <div className="ems-card space-y-5 p-6 sm:p-8" aria-label="Loading login">
      <div className="h-6 w-36 animate-pulse rounded-full bg-[#161F1A]" />
      <div className="space-y-2">
        <div className="h-7 w-48 animate-pulse rounded-md bg-[#161F1A]" />
        <div className="h-4 w-full animate-pulse rounded-md bg-[#161F1A]" />
      </div>
      <div className="space-y-4 pt-2">
        <div className="h-11 w-full animate-pulse rounded-lg bg-[#161F1A]" />
        <div className="h-11 w-full animate-pulse rounded-lg bg-[#161F1A]" />
        <div className="h-11 w-full animate-pulse rounded-lg bg-[#052E16]" />
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-md flex-col justify-center px-4 py-12 sm:px-6">
      <Suspense fallback={<LoginFormSkeleton />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
