"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatCnic, isValidCnic, isValidEmail } from "@/lib/validation";

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

    if (!isValidCnic(normalizedCnic)) {
      setErrorMessage("CNIC must match 12345-1234567-1.");
      return;
    }

    if (!isValidEmail(normalizedEmail)) {
      setErrorMessage("Enter a valid email address.");
      return;
    }

    if (password.length < 6 || password.length > 128) {
      setErrorMessage("Password must be between 6 and 128 characters.");
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: { data: { cnic: normalizedCnic } },
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if (
        data.user &&
        Array.isArray(data.user.identities) &&
        data.user.identities.length === 0
      ) {
        setErrorMessage("An account with this email already exists.");
        return;
      }

      if (data.session) {
        router.push("/dashboard");
        router.refresh();
        return;
      }

      setConfirmationEmail(normalizedEmail);
    } catch {
      setErrorMessage("Registration failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-sm flex-col justify-center px-4 py-10">
      <div className="ems-card p-6">
        <h1 className="text-xl font-semibold tracking-tight text-[#F3F4F6]">
          Voter Registration
        </h1>

        {confirmationEmail ? (
          <div className="mt-5 space-y-4">
            <div
              role="status"
              className="flex items-start gap-2.5 rounded-lg border border-[#10B981]/40 bg-[#052E16]/70 p-3.5 text-xs text-[#F3F4F6]"
            >
              <CheckCircle2
                className="mt-0.5 h-4 w-4 shrink-0 text-[#22C55E]"
                aria-hidden="true"
              />
              <span>
                Check <strong>{confirmationEmail}</strong> to confirm your
                account, then sign in.
              </span>
            </div>
            <Link
              href="/login"
              className="inline-flex w-full items-center justify-center rounded-lg bg-[#10B981] px-4 py-2 text-sm font-semibold text-[#090D0B] hover:bg-[#22C55E]"
            >
              Sign in
            </Link>
          </div>
        ) : (
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
                htmlFor="cnic"
                className="block text-xs font-medium text-[#9CA3AF]"
              >
                CNIC
              </label>
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
                className="w-full rounded-lg border border-[#1F2E26] bg-[#090D0B] px-3 py-2 font-mono text-sm text-[#F3F4F6] placeholder-[#6B7280] focus:border-[#10B981] focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="block text-xs font-medium text-[#9CA3AF]"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voter@example.com"
                className="w-full rounded-lg border border-[#1F2E26] bg-[#090D0B] px-3 py-2 text-sm text-[#F3F4F6] placeholder-[#6B7280] focus:border-[#10B981] focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="block text-xs font-medium text-[#9CA3AF]"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 6 characters"
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
              <span>Register</span>
            </button>
          </form>
        )}

        <p className="mt-5 text-center text-xs text-[#9CA3AF]">
          Already registered?{" "}
          <Link href="/login" className="text-[#10B981] hover:text-[#22C55E]">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
