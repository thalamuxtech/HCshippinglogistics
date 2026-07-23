"use client";

import {
  LayoutDashboard,
  Package,
  Users,
  UserCog,
  Tags,
  Mail,
  Inbox,
  FileText,
  Activity,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { RequireRole } from "@/components/providers/RequireRole";
import { PortalShell, type PortalNavItem } from "@/components/portal/PortalShell";

const NAV: PortalNavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/shipments", label: "Shipments", icon: Package },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/staff", label: "Staff & Roles", icon: UserCog },
  { href: "/admin/pricing", label: "Pricing", icon: Tags },
  { href: "/admin/sailing", label: "Sailing Notices", icon: Mail },
  { href: "/admin/inquiries", label: "Inquiries", icon: Inbox },
  { href: "/admin/content", label: "Content", icon: FileText },
  { href: "/admin/activity", label: "Activity", icon: Activity },
];

const TITLES: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/shipments": "Shipments",
  "/admin/customers": "Customers",
  "/admin/staff": "Staff & Roles",
  "/admin/pricing": "Pricing",
  "/admin/sailing": "Sailing Notices",
  "/admin/inquiries": "Inquiries",
  "/admin/content": "Site Content",
  "/admin/activity": "Activity Log",
};

function titleFor(pathname: string): string {
  if (TITLES[pathname]) return TITLES[pathname];
  // longest-prefix match for detail routes
  const match = Object.keys(TITLES)
    .filter((k) => k !== "/admin" && pathname.startsWith(k))
    .sort((a, b) => b.length - a.length)[0];
  return match ? TITLES[match] : "Admin";
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <RequireRole roles={["admin"]}>
      <PortalShell nav={NAV} title={titleFor(pathname)} roleLabel="Administrator">
        {children}
      </PortalShell>
    </RequireRole>
  );
}
