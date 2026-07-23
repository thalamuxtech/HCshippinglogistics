"use client";

import { RequireRole } from "@/components/providers/RequireRole";
import { FeatureGuard } from "@/components/providers/FeatureGuard";
import { PortalShell, type PortalNavItem } from "@/components/portal/PortalShell";
import { useAuth } from "@/components/providers/AuthProvider";
import { effectiveFeatureKeys, type FeatureKey } from "@/lib/features";
import {
  LayoutDashboard,
  Package,
  ReceiptText,
  Boxes,
  ClipboardList,
} from "lucide-react";

const NAV: (PortalNavItem & { key: FeatureKey })[] = [
  { key: "office.dashboard", href: "/office", label: "Dashboard", icon: LayoutDashboard },
  { key: "office.shipments", href: "/office/shipments", label: "Shipments", icon: Package },
  { key: "office.receipts", href: "/office/receipts", label: "Receipts", icon: ReceiptText },
  { key: "office.inventory", href: "/office/inventory", label: "Inventory", icon: Boxes },
  { key: "office.consignees", href: "/office/consignees", label: "Consignees", icon: ClipboardList },
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
