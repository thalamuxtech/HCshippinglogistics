// ─────────────────────────────────────────────────────────────
// Feature / menu registry
// Single source of truth for the back-end menus available to each staff
// role, and the mechanism for per-user overrides.
//
// Access model: every role has a DEFAULT set of features. An admin may then
// override an individual user's access via `allowed_features` on their user
// doc:
//   - allowed_features == null/undefined  ->  use the role default set
//   - allowed_features == string[]        ->  use exactly this set (intersected
//                                              with what the role is allowed to
//                                              have, so a dispatcher can never be
//                                              granted an admin-only screen)
// ─────────────────────────────────────────────────────────────

import type { Role } from "./types";

export type FeatureKey =
  // Admin
  | "admin.dashboard"
  | "admin.shipments"
  | "admin.receipts"
  | "admin.inventory"
  | "admin.customers"
  | "admin.staff"
  | "admin.pricing"
  | "admin.sailing"
  | "admin.containers"
  | "admin.inquiries"
  | "admin.content"
  | "admin.activity"
  // Destination office
  | "office.dashboard"
  | "office.shipments"
  | "office.receipts"
  | "office.inventory"
  | "office.consignees"
  // Dispatch
  | "dispatch.jobs"
  | "dispatch.completed";

export interface FeatureMeta {
  key: FeatureKey;
  label: string;
  href: string;
  role: Exclude<Role, "customer">;
  /** Core features cannot be turned off (the portal home / primary screen). */
  required?: boolean;
}

// Order here defines sidebar order.
export const FEATURES: FeatureMeta[] = [
  // ── Admin ──
  { key: "admin.dashboard", label: "Dashboard", href: "/admin", role: "admin", required: true },
  { key: "admin.shipments", label: "Shipments", href: "/admin/shipments", role: "admin" },
  { key: "admin.receipts", label: "Receipts", href: "/admin/receipts", role: "admin" },
  { key: "admin.inventory", label: "Inventory", href: "/admin/inventory", role: "admin" },
  { key: "admin.customers", label: "Customers", href: "/admin/customers", role: "admin" },
  { key: "admin.staff", label: "Staff & Roles", href: "/admin/staff", role: "admin", required: true },
  { key: "admin.pricing", label: "Pricing", href: "/admin/pricing", role: "admin" },
  { key: "admin.sailing", label: "Sailing Notices", href: "/admin/sailing", role: "admin" },
  { key: "admin.containers", label: "Containers", href: "/admin/containers", role: "admin" },
  { key: "admin.inquiries", label: "Inquiries", href: "/admin/inquiries", role: "admin" },
  { key: "admin.content", label: "Content", href: "/admin/content", role: "admin" },
  { key: "admin.activity", label: "Activity", href: "/admin/activity", role: "admin" },
  // ── Destination office ──
  { key: "office.dashboard", label: "Dashboard", href: "/office", role: "nigeria_office", required: true },
  { key: "office.shipments", label: "Shipments", href: "/office/shipments", role: "nigeria_office" },
  { key: "office.receipts", label: "Receipts", href: "/office/receipts", role: "nigeria_office" },
  { key: "office.inventory", label: "Inventory", href: "/office/inventory", role: "nigeria_office" },
  { key: "office.consignees", label: "Consignees", href: "/office/consignees", role: "nigeria_office" },
  // ── Dispatch ──
  { key: "dispatch.jobs", label: "My Jobs", href: "/dispatch", role: "dispatcher", required: true },
  { key: "dispatch.completed", label: "Completed Today", href: "/dispatch/completed", role: "dispatcher" },
];

export const FEATURE_MAP: Record<FeatureKey, FeatureMeta> = FEATURES.reduce(
  (acc, f) => ({ ...acc, [f.key]: f }),
  {} as Record<FeatureKey, FeatureMeta>
);

/** All features a given role is ALLOWED to have (the maximum set). */
export function featuresForRole(role: Role): FeatureMeta[] {
  if (role === "customer") return [];
  return FEATURES.filter((f) => f.role === role);
}

/** The default (all role features) keys for a role. */
export function defaultFeatureKeys(role: Role): FeatureKey[] {
  return featuresForRole(role).map((f) => f.key);
}

/** Keys that can never be removed for a role. */
export function requiredFeatureKeys(role: Role): FeatureKey[] {
  return featuresForRole(role)
    .filter((f) => f.required)
    .map((f) => f.key);
}

/**
 * Resolve the effective feature set for a user, given their role and stored
 * `allowed_features`. Always bounded by what the role may have, and always
 * includes the role's required features.
 */
export function effectiveFeatureKeys(
  role: Role,
  allowed?: string[] | null
): Set<FeatureKey> {
  const roleKeys = new Set(defaultFeatureKeys(role));
  const required = requiredFeatureKeys(role);
  if (!allowed) {
    // No override -> full role default set.
    return new Set(roleKeys);
  }
  const set = new Set<FeatureKey>(required);
  for (const k of allowed) {
    if (roleKeys.has(k as FeatureKey)) set.add(k as FeatureKey);
  }
  return set;
}

/** Does a user have access to a given route (longest-prefix match)? */
export function canAccessRoute(
  role: Role,
  allowed: string[] | null | undefined,
  pathname: string
): boolean {
  const eff = effectiveFeatureKeys(role, allowed);
  // Find the feature whose href is the longest prefix of pathname.
  let best: FeatureMeta | null = null;
  for (const f of FEATURES) {
    if (f.role !== role) continue;
    if (pathname === f.href || pathname.startsWith(f.href + "/")) {
      if (!best || f.href.length > best.href.length) best = f;
    }
  }
  // Unlisted routes within the portal are allowed by default (e.g. detail
  // pages that hang off an allowed section already matched above; anything
  // truly unlisted falls through to role gating).
  if (!best) return true;
  return eff.has(best.key);
}
