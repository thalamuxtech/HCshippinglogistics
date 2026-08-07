"use client";

// ─────────────────────────────────────────────────────────────
// Admin-editable role display names.
//
// The stored role KEYS ("admin" | "nigeria_office" | "dispatcher" | "customer")
// are load-bearing: Firestore rules match on them, features.ts gates menus by
// them, and every existing user document carries one. So they are fixed forever.
// Only the human-readable LABEL is editable here, which is what staff actually
// see, and what changes when a team is renamed (Dispatch → Logistics).
//
// Stored at site_content/role_labels and read with the built-in defaults as the
// fallback, so labels render instantly and correctly before Firestore resolves.
// Same cache/prime shape as pricing-settings and sea-price-list.
// ─────────────────────────────────────────────────────────────

import * as React from "react";
import { getSiteContent } from "./db";
import type { Role } from "./types";

export type RoleLabels = Record<Role, string>;

/** Shipped defaults. "Logistics" is the current name for the dispatch team. */
export const ROLE_LABEL_DEFAULTS: RoleLabels = {
  admin: "Administrator",
  nigeria_office: "Destination Office",
  dispatcher: "Logistics",
  customer: "Customer",
};

const ROLE_KEYS: Role[] = ["admin", "nigeria_office", "dispatcher", "customer"];

function merge(raw: Record<string, unknown> | null): RoleLabels {
  const out = { ...ROLE_LABEL_DEFAULTS };
  if (!raw) return out;
  for (const key of ROLE_KEYS) {
    const v = raw[key];
    // Blank / non-string values fall back to the default rather than rendering an
    // empty badge where a role name should be.
    if (typeof v === "string" && v.trim()) out[key] = v.trim();
  }
  return out;
}

// ── Module-level cache shared across hook instances (one fetch per page) ──
let cache: RoleLabels | undefined;
const listeners = new Set<() => void>();
let inflight: Promise<void> | null = null;

function ensureLoaded() {
  if (cache !== undefined) return;
  if (!inflight) {
    inflight = getSiteContent("role_labels")
      .then((d) => {
        cache = merge(d as Record<string, unknown> | null);
      })
      .catch(() => {
        cache = ROLE_LABEL_DEFAULTS;
      })
      .finally(() => {
        listeners.forEach((l) => l());
      });
  }
}

/**
 * Read the live role labels. Returns the built-in defaults until the Firestore
 * doc resolves, so nothing flashes and server-rendered output stays correct.
 */
export function useRoleLabels(): RoleLabels {
  const [, force] = React.useReducer((n) => n + 1, 0);
  React.useEffect(() => {
    ensureLoaded();
    if (cache !== undefined) return;
    const l = () => force();
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return cache ?? ROLE_LABEL_DEFAULTS;
}

/** Refresh the shared cache after the admin saves. */
export function primeRoleLabels(labels: RoleLabels) {
  cache = { ...ROLE_LABEL_DEFAULTS, ...labels };
  listeners.forEach((l) => l());
}
