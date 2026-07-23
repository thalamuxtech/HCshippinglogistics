"use client";

import { RequireRole } from "@/components/providers/RequireRole";
import { PortalShell } from "@/components/portal/PortalShell";
import { ClipboardList, CheckCircle2 } from "lucide-react";

const nav = [
  { href: "/dispatch", label: "My Jobs", icon: ClipboardList },
  { href: "/dispatch/completed", label: "Completed Today", icon: CheckCircle2 },
];

export default function DispatchLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireRole roles={["dispatcher"]}>
      <PortalShell nav={nav} title="Dispatch" roleLabel="Dispatcher">
        {children}
      </PortalShell>
    </RequireRole>
  );
}
