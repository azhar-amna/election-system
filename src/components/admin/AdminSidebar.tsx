"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  SlidersHorizontal,
  UserCheck,
  Users,
} from "lucide-react";

interface AdminNavLink {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
}

const ADMIN_NAV_LINKS: AdminNavLink[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/voters", label: "Voters", icon: UserCheck },
  { href: "/admin/elections", label: "Elections", icon: SlidersHorizontal },
  { href: "/admin/candidates", label: "Candidates", icon: Users },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  function isActive(link: AdminNavLink) {
    if (link.exact) return pathname === link.href;
    return pathname === link.href || pathname.startsWith(`${link.href}/`);
  }

  return (
    <>
      {/* Mobile Compact Horizontal Nav */}
      <nav
        aria-label="Admin navigation"
        className="flex items-center gap-1 overflow-x-auto border-b border-[#1F2E26] bg-[#0D1210] px-4 py-2 lg:hidden"
      >
        {ADMIN_NAV_LINKS.map((link) => {
          const Icon = link.icon;
          const active = isActive(link);
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? "bg-[#052E16] text-[#22C55E]"
                  : "text-[#9CA3AF] hover:bg-[#111814] hover:text-[#F3F4F6]"
              }`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{link.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Desktop Collapsible Sidebar */}
      <aside
        className={`hidden shrink-0 border-r border-[#1F2E26] bg-[#0D1210] transition-[width] duration-200 lg:flex lg:flex-col ${
          collapsed ? "w-14" : "w-52"
        }`}
      >
        <div className="sticky top-16 flex flex-col gap-3 p-2.5">
          <div
            className={`flex items-center ${
              collapsed ? "justify-center" : "justify-between px-2"
            }`}
          >
            {!collapsed && (
              <span className="font-mono text-[11px] font-semibold tracking-wider text-[#6B7280] uppercase">
                Admin
              </span>
            )}
            <button
              type="button"
              onClick={() => setCollapsed((prev) => !prev)}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-[#9CA3AF] transition-colors hover:bg-[#161F1A] hover:text-[#F3F4F6]"
            >
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
              ) : (
                <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>

          <nav aria-label="Admin navigation" className="flex flex-col gap-1">
            {ADMIN_NAV_LINKS.map((link) => {
              const Icon = link.icon;
              const active = isActive(link);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  title={collapsed ? link.label : undefined}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center rounded-md text-sm font-medium transition-colors ${
                    collapsed
                      ? "h-9 w-9 justify-center mx-auto"
                      : "gap-2.5 px-2.5 py-2"
                  } ${
                    active
                      ? "bg-[#052E16] text-[#22C55E]"
                      : "text-[#9CA3AF] hover:bg-[#111814] hover:text-[#F3F4F6]"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {!collapsed && <span className="truncate">{link.label}</span>}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>
    </>
  );
}
