"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isValidEmail } from "@/lib/validation";

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
    if (!isValidEmail(normalizedEmail) || !password || password.length > 128) {
      setErrorMessage("Enter a valid email and password.");
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
      const destination = getSafeRedirectPath(
        searchParams.get("next"),
        isAdmin
      );

      router.push(destination);
      router.refresh();
    } catch {
      setErrorMessage("Sign in failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="ems-card p-6">
      <h1 className="text-xl font-semibold tracking-tight text-[#F3F4F6]">
        Sign in
      </h1>

      <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-4">
        {errorMessage && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-[#EF4444]/40 bg-[#2A0D10] p-3 text-xs text-[#EF4444]"
          >
            <AlertCircle
              className="mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
            />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="space-y-1.5">
          <label
            htmlFor="login-email"
            className="block text-xs font-medium text-[#9CA3AF]"
          >
            Email
          </label>
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            className="w-full rounded-lg border border-[#1F2E26] bg-[#090D0B] px-3 py-2 text-sm text-[#F3F4F6] placeholder-[#6B7280] focus:border-[#10B981] focus:outline-none"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="login-password"
            className="block text-xs font-medium text-[#9CA3AF]"
          >
            Password
          </label>
          <div className="relative">
            <input
              id="login-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full rounded-lg border border-[#1F2E26] bg-[#090D0B] py-2 pr-10 pl-3 text-sm text-[#F3F4F6] placeholder-[#6B7280] focus:border-[#10B981] focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer text-[#6B7280] hover:text-[#F3F4F6]"
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
          className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#10B981] px-4 py-2 text-sm font-semibold text-[#090D0B] transition-colors hover:bg-[#22C55E] disabled:opacity-60"
        >
          {isSubmitting && (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          )}
          <span>Sign in</span>
        </button>
      </form>

      <p className="mt-5 text-center text-xs text-[#9CA3AF]">
        No account?{" "}
        <Link href="/register" className="text-[#10B981] hover:text-[#22C55E]">
          Register
        </Link>
      </p>
    </div>
  );
}

function LoginSkeleton() {
  return (
    <div className="ems-card space-y-4 p-6">
      <div className="h-6 w-24 animate-pulse rounded bg-[#161F1A]" />
      <div className="h-9 w-full animate-pulse rounded-lg bg-[#161F1A]" />
      <div className="h-9 w-full animate-pulse rounded-lg bg-[#161F1A]" />
      <div className="h-9 w-full animate-pulse rounded-lg bg-[#052E16]" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-sm flex-col justify-center px-4 py-10">
      <Suspense fallback={<LoginSkeleton />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
