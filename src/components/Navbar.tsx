"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { LogOut, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const isAdmin = user?.app_metadata?.role === "admin";
  const inAdminArea = pathname.startsWith("/admin");
  const inVoterArea =
    pathname.startsWith("/dashboard") || pathname.startsWith("/ballot");

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function loadUser() {
      try {
        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser();
        if (isMounted) setUser(currentUser ?? null);
      } catch {
        if (isMounted) setUser(null);
      } finally {
        if (isMounted) setIsAuthLoading(false);
      }
    }

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) {
        setUser(session?.user ?? null);
        setIsAuthLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleLogout() {
    setIsSigningOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      setUser(null);
      router.push("/");
      router.refresh();
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <div className="pointer-events-none sticky top-3 z-50 flex w-full justify-center px-3">
      <header className="pointer-events-auto flex h-11 items-center gap-2 rounded-full border border-[#1F2E26] bg-[#111814]/92 px-2.5 shadow-lg shadow-black/50 backdrop-blur-md">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-full px-2 py-1 text-sm font-semibold tracking-tight text-[#F3F4F6] transition-colors hover:text-[#22C55E]"
        >
          <ShieldCheck
            className="h-4 w-4 text-[#10B981]"
            aria-hidden="true"
          />
          <span>Electys</span>
        </Link>

        <span className="h-4 w-px bg-[#1F2E26]" aria-hidden="true" />

        {isAuthLoading ? (
          <div
            aria-label="Loading session"
            className="h-7 w-24 animate-pulse rounded-full bg-[#161F1A]"
          />
        ) : user ? (
          <div className="flex items-center gap-1.5">
            {isAdmin ? (
              <Link
                href={inAdminArea ? "/" : "/admin"}
                className="rounded-full px-3 py-1 text-xs font-medium text-[#9CA3AF] transition-colors hover:bg-[#161F1A] hover:text-[#F3F4F6]"
              >
                {inAdminArea ? "Results" : "Console"}
              </Link>
            ) : (
              <Link
                href={inVoterArea ? "/" : "/dashboard"}
                className="rounded-full px-3 py-1 text-xs font-medium text-[#9CA3AF] transition-colors hover:bg-[#161F1A] hover:text-[#F3F4F6]"
              >
                {inVoterArea ? "Results" : "Portal"}
              </Link>
            )}

            <span
              className="hidden max-w-[140px] truncate rounded-full border border-[#1F2E26] bg-[#090D0B] px-2.5 py-1 text-[11px] text-[#9CA3AF] sm:inline-block"
              title={user.email ?? undefined}
            >
              {user.email}
            </span>

            <button
              type="button"
              onClick={handleLogout}
              disabled={isSigningOut}
              title="Logout"
              aria-label="Logout"
              className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-full border border-[#1F2E26] bg-[#090D0B] px-2.5 text-xs font-medium text-[#9CA3AF] transition-colors hover:border-[#EF4444]/50 hover:text-[#EF4444] disabled:opacity-50"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <Link
              href="/register"
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                pathname === "/register"
                  ? "bg-[#161F1A] text-[#F3F4F6]"
                  : "text-[#9CA3AF] hover:text-[#F3F4F6]"
              }`}
            >
              Register
            </Link>
            <Link
              href="/login"
              className="rounded-full bg-[#10B981] px-3.5 py-1 text-xs font-semibold text-[#090D0B] transition-colors hover:bg-[#22C55E]"
            >
              Login
            </Link>
          </div>
        )}
      </header>
    </div>
  );
}
