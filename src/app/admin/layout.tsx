"use client";

import {
  LayoutDashboard,
  Package,
  Users,
  UserCog,
  Tags,
  Inbox,
  FileText,
  Boxes,
  Container,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { RequireRole } from "@/components/providers/RequireRole";
import { FeatureGuard } from "@/components/providers/FeatureGuard";
import { PortalShell, type PortalNavItem } from "@/components/portal/PortalShell";
import { DemoDataToolbar } from "@/components/portal/DemoDataToolbar";
import { useAuth } from "@/components/providers/AuthProvider";
import { effectiveFeatureKeys, type FeatureKey } from "@/lib/features";

// Full admin NAV (registry order); filtered per-user at render time.
const NAV: (PortalNavItem & { key: FeatureKey })[] = [
  { key: "admin.dashboard", href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { key: "admin.shipments", href: "/admin/shipments", label: "Shipments", icon: Package },
  { key: "admin.inventory", href: "/admin/inventory", label: "Inventory", icon: Boxes },
  { key: "admin.customers", href: "/admin/customers", label: "Customers", icon: Users },
  { key: "admin.staff", href: "/admin/staff", label: "Staff & Roles", icon: UserCog },
  { key: "admin.pricing", href: "/admin/pricing", label: "Pricing", icon: Tags },
  { key: "admin.containers", href: "/admin/containers", label: "Containers", icon: Container },
  { key: "admin.inquiries", href: "/admin/inquiries", label: "Submissions", icon: Inbox },
  { key: "admin.content", href: "/admin/content", label: "Content", icon: FileText },
];

const TITLES: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/shipments": "Shipments",
  "/admin/inventory": "Inventory",
  "/admin/customers": "Customers",
  "/admin/staff": "Staff & Roles",
  "/admin/pricing": "Pricing",
  "/admin/containers": "Container Broadcasts",
  "/admin/inquiries": "Submissions",
  "/admin/content": "Site Content",
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
  const { user, role } = useAuth();

  // Filter the sidebar to the features this specific admin is allowed to see.
  const eff = role ? effectiveFeatureKeys(role, user?.allowed_features) : new Set<FeatureKey>();
  const nav = NAV.filter((item) => eff.has(item.key));

  // Opt-in tool: hidden unless this admin has been granted it under Staff &
  // Roles, so test data cannot reach live records by accident.
  const showDemoTool = eff.has("admin.demodata");

  return (
    <RequireRole roles={["admin"]}>
      <FeatureGuard>
        <PortalShell
          nav={nav}
          title={titleFor(pathname)}
          roleLabel="Administrator"
          headerActions={showDemoTool ? <DemoDataToolbar /> : undefined}
        >
          {children}
        </PortalShell>
      </FeatureGuard>
    </RequireRole>
  );
}
