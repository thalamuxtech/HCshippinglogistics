"use client";

import { RequireRole } from "@/components/providers/RequireRole";
import { PortalShell } from "@/components/portal/PortalShell";
import {
  LayoutDashboard,
  Package,
  ReceiptText,
  Boxes,
  ClipboardList,
} from "lucide-react";

const nav = [
  { href: "/office", label: "Dashboard", icon: LayoutDashboard },
  { href: "/office/shipments", label: "Shipments", icon: Package },
  { href: "/office/receipts", label: "Receipts", icon: ReceiptText },
  { href: "/office/inventory", label: "Inventory", icon: Boxes },
  { href: "/office/consignees", label: "Consignees", icon: ClipboardList },
];

export default function OfficeLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireRole roles={["nigeria_office"]}>
      <PortalShell nav={nav} title="Destination Office" roleLabel="Destination Office">
        {children}
      </PortalShell>
    </RequireRole>
  );
}
