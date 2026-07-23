"use client";

import {
  LayoutDashboard,
  PackagePlus,
  Package,
  ReceiptText,
  Bell,
  User,
} from "lucide-react";
import { RequireRole } from "@/components/providers/RequireRole";
import { PortalShell } from "@/components/portal/PortalShell";

const nav = [
  { href: "/portal", label: "Dashboard", icon: LayoutDashboard },
  { href: "/portal/order", label: "New Order", icon: PackagePlus },
  { href: "/portal/shipments", label: "My Shipments", icon: Package },
  { href: "/portal/receipts", label: "Receipts", icon: ReceiptText },
  { href: "/portal/notifications", label: "Notifications", icon: Bell },
  { href: "/portal/profile", label: "Profile", icon: User },
];

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireRole roles={["customer"]}>
      <PortalShell nav={nav} title="Customer Portal" roleLabel="Customer">
        {children}
      </PortalShell>
    </RequireRole>
  );
}
