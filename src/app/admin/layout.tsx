import type { ReactNode } from "react";
import AdminSidebar from "@/components/admin/AdminSidebar";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] w-full flex-col bg-[#090D0B] lg:flex-row">
      <AdminSidebar />
      <div className="min-w-0 flex-1 px-4 py-8 sm:px-6 lg:px-8">{children}</div>
    </div>
  );
}
