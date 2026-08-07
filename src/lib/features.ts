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
  | "admin.inventory"
  | "admin.customers"
  | "admin.staff"
  | "admin.pricing"
  | "admin.containers"
  | "admin.inquiries"
  | "admin.content"
  | "admin.settings"
  | "admin.demodata"
  // Destination office
  | "office.dashboard"
  | "office.containers"
  | "office.shipments"
  | "office.inventory"
  | "office.operations"
  // Logistics (formerly "Dispatch" — the team handles pickup and delivery)
  | "dispatch.jobs"
  | "dispatch.containers"
  | "dispatch.completed";

export interface FeatureMeta {
  key: FeatureKey;
  label: string;
  href: string;
  role: Exclude<Role, "customer">;
  /** Core features cannot be turned off (the portal home / primary screen). */
  required?: boolean;
  /**
   * A top-bar tool rather than a sidebar page. It still appears in the admin's
   * per-user access editor, but has no route of its own — so canAccessRoute must
   * not treat its href as a page prefix.
   */
  tool?: boolean;
  /**
   * OFF unless explicitly granted. Everything else is on by default for its
   * role; an opt-in feature is excluded even from the "role default" set, so a
   * production tool stays hidden until an admin deliberately enables it.
   */
  optIn?: boolean;
}

// Order here defines sidebar order.
export const FEATURES: FeatureMeta[] = [
  // ── Admin ──
  { key: "admin.dashboard", label: "Dashboard", href: "/admin", role: "admin", required: true },
  { key: "admin.shipments", label: "Shipments", href: "/admin/shipments", role: "admin" },
  { key: "admin.inventory", label: "Inventory", href: "/admin/inventory", role: "admin" },
  { key: "admin.customers", label: "Customers", href: "/admin/customers", role: "admin" },
  { key: "admin.staff", label: "Staff & Roles", href: "/admin/staff", role: "admin", required: true },
  { key: "admin.pricing", label: "Pricing", href: "/admin/pricing", role: "admin" },
  { key: "admin.containers", label: "Containers", href: "/admin/containers", role: "admin" },
  { key: "admin.inquiries", label: "Submissions", href: "/admin/inquiries", role: "admin" },
  { key: "admin.content", label: "Content", href: "/admin/content", role: "admin" },
  // Settings is `required`: it holds backup/restore, so an admin locked out of it
  // could not recover the system.
  { key: "admin.settings", label: "Settings", href: "/admin/settings", role: "admin", required: true },
  // Top-bar tool, not a page: seeds/clears demo records (all tagged demo:true).
  // optIn — hidden for every admin until deliberately enabled under Staff &
  // Roles, so nobody can push test data into the live system by accident.
  {
    key: "admin.demodata",
    label: "Demo data tool",
    href: "/admin#demo-data",
    role: "admin",
    tool: true,
    optIn: true,
  },
  // ── Destination office ──
  { key: "office.dashboard", label: "Dashboard", href: "/office", role: "nigeria_office", required: true },
  // Order reflects the operating model: a Container holds Shipments, and those
  // shipments are what the Warehouse view lists. Warehouse is read-only —
  // stock appears automatically when a container reaches a destination stage.
  { key: "office.containers", label: "Containers", href: "/office/containers", role: "nigeria_office" },
  { key: "office.shipments", label: "Shipments", href: "/office/shipments", role: "nigeria_office" },
  { key: "office.inventory", label: "Warehouse", href: "/office/inventory", role: "nigeria_office" },
  // Vehicles (RORO) route straight to Operations rather than through general
  // warehouse stock — a car is not shelved cargo and is monitored separately.
  { key: "office.operations", label: "Operations", href: "/office/operations", role: "nigeria_office" },
  // ── Logistics (pickup & delivery) ──
  { key: "dispatch.jobs", label: "My Jobs", href: "/dispatch", role: "dispatcher", required: true },
  // Same Container → Shipments → Deliveries hierarchy the office portal uses,
  // read-only: a rider receives a container and works the deliveries inside it.
  { key: "dispatch.containers", label: "Containers", href: "/dispatch/containers", role: "dispatcher" },
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

/**
 * The default keys for a role: everything the role may have EXCEPT opt-in
 * features, which stay off until an admin grants them explicitly.
 */
export function defaultFeatureKeys(role: Role): FeatureKey[] {
  return featuresForRole(role)
    .filter((f) => !f.optIn)
    .map((f) => f.key);
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
  // Two different sets, and the distinction matters:
  //  - grantable = everything the ROLE may ever have (includes opt-in features),
  //    used to bound an explicit override.
  //  - defaults  = what the role gets with no override (excludes opt-in).
  // Bounding the override by `defaults` would silently drop any opt-in key an
  // admin granted, making it impossible to ever switch on.
  const grantable = new Set(featuresForRole(role).map((f) => f.key));
  const required = requiredFeatureKeys(role);
  if (!allowed) {
    // No override -> role defaults (opt-in features stay off).
    return new Set(defaultFeatureKeys(role));
  }
  const set = new Set<FeatureKey>(required);
  for (const k of allowed) {
    if (grantable.has(k as FeatureKey)) set.add(k as FeatureKey);
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
    // Tools have no page of their own; matching their href would gate a real
    // route on a toolbar toggle.
    if (f.tool) continue;
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
