"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ChevronDown,
  LayoutDashboard,
  Shield,
  SlidersHorizontal,
  UserCheck,
  Users,
} from "lucide-react";

interface AdminNavLink {
  href: string;
  label: string;
  description: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
}

const ADMIN_NAV_LINKS: AdminNavLink[] = [
  {
    href: "/admin",
    label: "Overview",
    description: "KPIs & operational status",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    href: "/admin/voters",
    label: "Voter Approvals",
    description: "Verify CNIC registrations",
    icon: UserCheck,
  },
  {
    href: "/admin/elections",
    label: "Elections & Setup",
    description: "Regions, stations, parties & symbols",
    icon: SlidersHorizontal,
  },
  {
    href: "/admin/candidates",
    label: "Candidates",
    description: "Roster, party & symbol assignments",
    icon: Users,
  },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  function isActive(link: AdminNavLink) {
    if (link.exact) return pathname === link.href;
    return pathname === link.href || pathname.startsWith(`${link.href}/`);
  }

  const activeLink =
    ADMIN_NAV_LINKS.find((link) => isActive(link)) ?? ADMIN_NAV_LINKS[0];

  return (
    <>
      {/* Mobile / Tablet Compact Switcher */}
      <div className="border-b border-[#1F2E26] bg-[#111814] px-4 py-3 lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#10B981]/40 bg-[#052E16] text-[#22C55E]">
              <Shield className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <p className="font-mono text-[10px] font-semibold tracking-wider text-[#10B981] uppercase">
                Admin Console
              </p>
              <p className="text-sm font-semibold text-[#F3F4F6]">
                {activeLink.label}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-expanded={mobileOpen}
            aria-controls="admin-mobile-nav"
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#1F2E26] bg-[#090D0B] px-3 py-1.5 text-xs font-medium text-[#F3F4F6] transition-colors hover:border-[#10B981]/50 hover:text-[#22C55E]"
          >
            <span>Sections</span>
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${
                mobileOpen ? "rotate-180" : ""
              }`}
              aria-hidden="true"
            />
          </button>
        </div>

        {mobileOpen && (
          <nav
            id="admin-mobile-nav"
            aria-label="Admin Console Mobile Navigation"
            className="mt-3 grid gap-1.5 border-t border-[#1F2E26] pt-3 sm:grid-cols-2"
          >
            {ADMIN_NAV_LINKS.map((link) => {
              const Icon = link.icon;
              const active = isActive(link);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    active
                      ? "border border-[#10B981]/40 bg-[#052E16] text-[#22C55E]"
                      : "border border-[#1F2E26] bg-[#090D0B] text-[#9CA3AF] hover:border-[#10B981]/30 hover:text-[#F3F4F6]"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>
        )}
      </div>

      {/* Desktop Left Sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-[#1F2E26] bg-[#0D1210] lg:flex lg:flex-col">
        <div className="sticky top-16 flex h-[calc(100vh-4rem)] flex-col justify-between p-4">
          <div className="space-y-6">
            {/* Sidebar Header */}
            <div className="rounded-xl border border-[#1F2E26] bg-[#111814] p-3.5">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#10B981]/40 bg-[#052E16] text-[#22C55E]">
                  <Shield className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="font-mono text-[10px] font-semibold tracking-wider text-[#22C55E] uppercase">
                    Admin Console
                  </p>
                  <p className="truncate text-sm font-semibold text-[#F3F4F6]">
                    Election Control
                  </p>
                </div>
              </div>
            </div>

            {/* Navigation Items */}
            <nav aria-label="Admin Console Navigation" className="space-y-1.5">
              <p className="px-2.5 font-mono text-[10px] font-semibold tracking-wider text-[#6B7280] uppercase">
                Operations
              </p>
              {ADMIN_NAV_LINKS.map((link) => {
                const Icon = link.icon;
                const active = isActive(link);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={`group flex items-start gap-3 rounded-lg px-3 py-2.5 transition-all ${
                      active
                        ? "border border-[#10B981]/45 bg-[#052E16] text-[#22C55E]"
                        : "border border-transparent text-[#9CA3AF] hover:border-[#1F2E26] hover:bg-[#111814] hover:text-[#F3F4F6]"
                    }`}
                  >
                    <Icon
                      className={`mt-0.5 h-4 w-4 shrink-0 ${
                        active
                          ? "text-[#22C55E]"
                          : "text-[#9CA3AF] group-hover:text-[#10B981]"
                      }`}
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-tight">
                        {link.label}
                      </p>
                      <p
                        className={`mt-0.5 truncate text-[11px] ${
                          active ? "text-[#10B981]" : "text-[#6B7280]"
                        }`}
                      >
                        {link.description}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Bottom Public Scoreboard Shortcut */}
          <div className="border-t border-[#1F2E26] pt-4">
            <Link
              href="/results"
              className="flex items-center justify-between rounded-lg border border-[#1F2E26] bg-[#111814] px-3 py-2.5 text-xs font-medium text-[#9CA3AF] transition-colors hover:border-[#10B981]/40 hover:text-[#22C55E]"
            >
              <span className="inline-flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-[#10B981]" aria-hidden="true" />
                <span>Public Live Results</span>
              </span>
              <span className="h-2 w-2 rounded-full bg-[#22C55E]" />
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
}
