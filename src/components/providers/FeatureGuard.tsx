"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { canAccessRoute } from "@/lib/features";
import { ShieldAlert } from "lucide-react";

// Blocks a staff page when the current user's per-user feature overrides remove
// access to that section. UI-level enforcement layered on top of the role gate
// (RequireRole). Firestore security rules remain role-based; tightening them
// per-user is a separate, larger change.
export function FeatureGuard({ children }: { children: React.ReactNode }) {
  const { user, role } = useAuth();
  const pathname = usePathname();

  const allowed = React.useMemo(() => {
    if (!role) return true;
    return canAccessRoute(role, user?.allowed_features, pathname);
  }, [role, user?.allowed_features, pathname]);

  if (allowed) return <>{children}</>;

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <div className="max-w-md rounded-2xl border border-border bg-white p-8 text-center shadow-card">
        <span className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
          <ShieldAlert className="h-6 w-6" />
        </span>
        <h2 className="text-lg font-bold text-navy">This section is not available to you</h2>
        <p className="mt-2 text-sm text-ink-muted">
          Your administrator has not enabled this feature for your account. Contact them if you
          need access.
        </p>
        <Link
          href="/"
          className="mt-5 inline-flex items-center justify-center rounded-lg bg-navy px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy-700 focus-ring"
        >
          Go to home
        </Link>
      </div>
    </div>
  );
}
