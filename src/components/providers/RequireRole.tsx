"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { PageLoader } from "@/components/ui/misc";
import type { Role } from "@/lib/types";

// Default landing route per STAFF role after login. Customers do not log in
// (they use their Customer ID at /track), so a customer account has no portal;
// if one ever logs in, send them to the public tracking page.
export const ROLE_HOME: Record<Role, string> = {
  admin: "/admin",
  nigeria_office: "/office",
  dispatcher: "/dispatch",
  customer: "/track",
};

export function RequireRole({
  roles,
  children,
}: {
  roles: Role[];
  children: React.ReactNode;
}) {
  const { user, role, loading } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    if (!user.is_active) {
      router.replace("/login?disabled=1");
      return;
    }
    if (role && !roles.includes(role)) {
      router.replace(ROLE_HOME[role]);
    }
  }, [user, role, loading, roles, router]);

  if (loading) return <PageLoader label="Verifying access…" />;
  if (!user || !role || !roles.includes(role)) return <PageLoader label="Redirecting…" />;
  return <>{children}</>;
}
