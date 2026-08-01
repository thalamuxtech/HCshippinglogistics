"use client";

import { RequireRole } from "@/components/providers/RequireRole";
import { FeatureGuard } from "@/components/providers/FeatureGuard";
import { PortalShell, type PortalNavItem } from "@/components/portal/PortalShell";
import { useAuth } from "@/components/providers/AuthProvider";
import { effectiveFeatureKeys, type FeatureKey } from "@/lib/features";
import {
  LayoutDashboard,
  Package,
  Boxes,
  Container,
  Car,
} from "lucide-react";

// Ordered to mirror the operating model: a Container holds Shipments, and those
// shipments are what the Warehouse view shows. Operations sits alongside for
// vehicles/RORO, which are routed there instead of into warehouse stock.
const NAV: (PortalNavItem & { key: FeatureKey })[] = [
  { key: "office.dashboard", href: "/office", label: "Dashboard", icon: LayoutDashboard },
  { key: "office.containers", href: "/office/containers", label: "Containers", icon: Container },
  { key: "office.shipments", href: "/office/shipments", label: "Shipments", icon: Package },
  { key: "office.inventory", href: "/office/inventory", label: "Warehouse", icon: Boxes },
  { key: "office.operations", href: "/office/operations", label: "Operations", icon: Car },
];

export default function OfficeLayout({ children }: { children: React.ReactNode }) {
  const { user, role } = useAuth();
  const eff = role ? effectiveFeatureKeys(role, user?.allowed_features) : new Set<FeatureKey>();
  const nav = NAV.filter((item) => eff.has(item.key));

  return (
    <RequireRole roles={["nigeria_office"]}>
      <FeatureGuard>
        <PortalShell nav={nav} title="Destination Office" roleLabel="Destination Office">
          {children}
        </PortalShell>
      </FeatureGuard>
    </RequireRole>
  );
}
