"use client";

import { RequireRole } from "@/components/providers/RequireRole";
import { FeatureGuard } from "@/components/providers/FeatureGuard";
import { PortalShell, type PortalNavItem } from "@/components/portal/PortalShell";
import { useAuth } from "@/components/providers/AuthProvider";
import { effectiveFeatureKeys, type FeatureKey } from "@/lib/features";
import { ClipboardList, CheckCircle2 } from "lucide-react";

const NAV: (PortalNavItem & { key: FeatureKey })[] = [
  { key: "dispatch.jobs", href: "/dispatch", label: "My Jobs", icon: ClipboardList },
  { key: "dispatch.completed", href: "/dispatch/completed", label: "Completed Today", icon: CheckCircle2 },
];

export default function DispatchLayout({ children }: { children: React.ReactNode }) {
  const { user, role } = useAuth();
  const eff = role ? effectiveFeatureKeys(role, user?.allowed_features) : new Set<FeatureKey>();
  const nav = NAV.filter((item) => eff.has(item.key));

  return (
    <RequireRole roles={["dispatcher"]}>
      <FeatureGuard>
        <PortalShell nav={nav} title="Dispatch" roleLabel="Dispatcher">
          {children}
        </PortalShell>
      </FeatureGuard>
    </RequireRole>
  );
}
