"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import {
  AlertCircle,
  BarChart3,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  Shield,
  ShieldCheck,
  UserPlus,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface NavItem {
  href: string;
  label: string;
  icon: typeof BarChart3;
  isLive?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    href: "/results",
    label: "Live Results",
    icon: BarChart3,
    isLive: true,
  },
  {
    href: "/dashboard",
    label: "Voter Dashboard",
    icon: LayoutDashboard,
  },
  {
    href: "/admin",
    label: "Admin",
    icon: Shield,
  },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isAdmin = user?.app_metadata?.role === "admin";

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function loadUser() {
      try {
        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser();
        if (isMounted) {
          setUser(currentUser ?? null);
        }
      } catch {
        if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsAuthLoading(false);
        }
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
    setAuthError(null);
    setIsSigningOut(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();
      if (error) {
        setAuthError(error.message);
        return;
      }
      setUser(null);
      setMobileMenuOpen(false);
      router.push("/");
      router.refresh();
    } catch {
      setAuthError("Unable to sign out right now. Please try again.");
    } finally {
      setIsSigningOut(false);
    }
  }

  function isActivePath(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-[#1F2E26] bg-[#090D0B]/92 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* Brand Identity */}
        <Link
          href="/"
          onClick={() => setMobileMenuOpen(false)}
          className="group flex items-center gap-3 focus-visible:rounded-lg"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#10B981]/40 bg-[#052E16] text-[#22C55E] transition-colors group-hover:border-[#10B981] group-hover:bg-[#10B981]/20">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-bold tracking-wide text-[#F3F4F6]">
              EMS
            </span>
            <span className="hidden text-[11px] font-medium tracking-wider text-[#9CA3AF] uppercase sm:inline">
              Election Management
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav
          aria-label="Primary Navigation"
          className="hidden items-center gap-1 md:flex"
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActivePath(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-all ${
                  active
                    ? "border border-[#10B981]/40 bg-[#052E16] text-[#22C55E]"
                    : "border border-transparent text-[#9CA3AF] hover:border-[#1F2E26] hover:bg-[#111814] hover:text-[#F3F4F6]"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span>{item.label}</span>
                {item.isLive && (
                  <span className="relative flex h-2 w-2" aria-hidden="true">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22C55E] opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-[#22C55E]" />
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Desktop Auth Controls */}
        <div className="hidden items-center gap-2.5 md:flex">
          {isAuthLoading ? (
            <div
              aria-label="Loading authentication status"
              className="h-9 w-36 animate-pulse rounded-lg border border-[#1F2E26] bg-[#111814]"
            />
          ) : user ? (
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-2 rounded-lg border border-[#1F2E26] bg-[#111814] px-3 py-1.5">
                <span
                  className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider uppercase ${
                    isAdmin
                      ? "bg-[#052E16] text-[#22C55E] border border-[#10B981]/40"
                      : "bg-[#161F1A] text-[#10B981] border border-[#1F2E26]"
                  }`}
                >
                  {isAdmin ? "Admin" : "Voter"}
                </span>
                <span
                  className="max-w-[160px] truncate text-xs font-medium text-[#F3F4F6]"
                  title={user.email ?? undefined}
                >
                  {user.email}
                </span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                disabled={isSigningOut}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#1F2E26] bg-[#111814] px-3.5 py-2 text-sm font-medium text-[#F3F4F6] transition-colors hover:border-[#EF4444]/50 hover:bg-[#2A0D10] hover:text-[#EF4444] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                <span>{isSigningOut ? "Signing out..." : "Logout"}</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/register"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#1F2E26] bg-[#111814] px-3.5 py-2 text-sm font-medium text-[#F3F4F6] transition-colors hover:border-[#10B981]/50 hover:bg-[#161F1A] hover:text-[#22C55E]"
              >
                <UserPlus className="h-4 w-4" aria-hidden="true" />
                <span>Register</span>
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#10B981] px-4 py-2 text-sm font-semibold text-[#090D0B] transition-colors hover:bg-[#22C55E]"
              >
                <LogIn className="h-4 w-4" aria-hidden="true" />
                <span>Login</span>
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Menu Toggle */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-navigation-panel"
          aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
          className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-[#1F2E26] bg-[#111814] text-[#F3F4F6] transition-colors hover:border-[#10B981]/50 hover:text-[#10B981] md:hidden"
        >
          {mobileMenuOpen ? (
            <X className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Menu className="h-5 w-5" aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Inline Auth Error Banner */}
      {authError && (
        <div
          role="alert"
          className="border-t border-[#EF4444]/30 bg-[#2A0D10] px-4 py-2 text-xs text-[#EF4444]"
        >
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 sm:px-6 lg:px-8">
            <span className="inline-flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {authError}
            </span>
            <button
              type="button"
              onClick={() => setAuthError(null)}
              className="cursor-pointer font-medium underline-offset-2 hover:underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div
          id="mobile-navigation-panel"
          className="border-t border-[#1F2E26] bg-[#111814] px-4 py-4 md:hidden"
        >
          <nav aria-label="Mobile Navigation" className="flex flex-col gap-1.5">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isActivePath(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center justify-between rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors ${
                    active
                      ? "border border-[#10B981]/40 bg-[#052E16] text-[#22C55E]"
                      : "border border-transparent text-[#9CA3AF] hover:border-[#1F2E26] hover:bg-[#161F1A] hover:text-[#F3F4F6]"
                  }`}
                >
                  <span className="inline-flex items-center gap-2.5">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    <span>{item.label}</span>
                  </span>
                  {item.isLive && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#052E16] px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wider text-[#22C55E] uppercase">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#22C55E]" />
                      Live
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="mt-4 border-t border-[#1F2E26] pt-4">
            {isAuthLoading ? (
              <div className="h-10 w-full animate-pulse rounded-lg border border-[#1F2E26] bg-[#161F1A]" />
            ) : user ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between rounded-lg border border-[#1F2E26] bg-[#090D0B] px-3 py-2">
                  <span className="truncate text-xs font-medium text-[#F3F4F6]">
                    {user.email}
                  </span>
                  <span className="ml-2 shrink-0 rounded border border-[#10B981]/40 bg-[#052E16] px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wider text-[#22C55E] uppercase">
                    {isAdmin ? "Admin" : "Voter"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={isSigningOut}
                  className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#EF4444]/40 bg-[#2A0D10] px-4 py-2.5 text-sm font-medium text-[#EF4444] transition-colors hover:bg-[#EF4444]/15 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  <span>{isSigningOut ? "Signing out..." : "Logout"}</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                <Link
                  href="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#1F2E26] bg-[#090D0B] px-3.5 py-2.5 text-sm font-medium text-[#F3F4F6] transition-colors hover:border-[#10B981]/50 hover:text-[#22C55E]"
                >
                  <UserPlus className="h-4 w-4" aria-hidden="true" />
                  <span>Register</span>
                </Link>
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#10B981] px-3.5 py-2.5 text-sm font-semibold text-[#090D0B] transition-colors hover:bg-[#22C55E]"
                >
                  <LogIn className="h-4 w-4" aria-hidden="true" />
                  <span>Login</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
