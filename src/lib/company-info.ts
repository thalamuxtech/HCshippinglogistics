"use client";

// ─────────────────────────────────────────────────────────────
// Admin-editable company details.
//
// Addresses, phone numbers and the storage policy were baked into the COMPANY
// constant, so changing an office address meant a code change and a deploy — and
// the USA address had already drifted out of date in three separate places.
//
// Stored at site_content/company and read with COMPANY as the fallback, so pages
// render correct values immediately and keep working if the doc is missing. Same
// cache/prime shape as pricing-settings, sea-price-list and role-labels.
//
// Note: the Cloud Functions email footer reads its own copy. Functions cannot see
// this client cache, so an address change here updates the website and portals;
// the email template is updated in functions/index.js.
// ─────────────────────────────────────────────────────────────

import * as React from "react";
import { getSiteContent } from "./db";
import { COMPANY } from "./constants";

export interface CompanyInfo {
  name: string;
  email: string;
  usaLines: string[];
  usaPhones: string[];
  nigeriaLines: string[];
  nigeriaPhones: string[];
  freeStorageDays: number;
  dailyStorageNaira: number;
}

export const COMPANY_DEFAULTS: CompanyInfo = {
  name: COMPANY.name,
  email: COMPANY.email,
  usaLines: [...COMPANY.usa.lines],
  usaPhones: [...COMPANY.usa.phones],
  nigeriaLines: [...COMPANY.nigeria.lines],
  nigeriaPhones: [...COMPANY.nigeria.phones],
  freeStorageDays: COMPANY.storagePolicy.freeDays,
  dailyStorageNaira: COMPANY.storagePolicy.dailyChargeNaira,
};

function strArray(v: unknown, fallback: string[]): string[] {
  if (!Array.isArray(v)) return fallback;
  const out = v.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
  return out.length > 0 ? out : fallback;
}

function merge(raw: Record<string, unknown> | null): CompanyInfo {
  if (!raw) return COMPANY_DEFAULTS;
  const str = (v: unknown, fb: string) =>
    typeof v === "string" && v.trim() ? v.trim() : fb;
  const num = (v: unknown, fb: number) => (typeof v === "number" && v >= 0 ? v : fb);
  return {
    name: str(raw.name, COMPANY_DEFAULTS.name),
    email: str(raw.email, COMPANY_DEFAULTS.email),
    usaLines: strArray(raw.usaLines, COMPANY_DEFAULTS.usaLines),
    usaPhones: strArray(raw.usaPhones, COMPANY_DEFAULTS.usaPhones),
    nigeriaLines: strArray(raw.nigeriaLines, COMPANY_DEFAULTS.nigeriaLines),
    nigeriaPhones: strArray(raw.nigeriaPhones, COMPANY_DEFAULTS.nigeriaPhones),
    freeStorageDays: num(raw.freeStorageDays, COMPANY_DEFAULTS.freeStorageDays),
    dailyStorageNaira: num(raw.dailyStorageNaira, COMPANY_DEFAULTS.dailyStorageNaira),
  };
}

// ── Module-level cache shared across hook instances (one fetch per page) ──
let cache: CompanyInfo | undefined;
const listeners = new Set<() => void>();
let inflight: Promise<void> | null = null;

function ensureLoaded() {
  if (cache !== undefined) return;
  if (!inflight) {
    inflight = getSiteContent("company")
      .then((d) => {
        cache = merge(d as Record<string, unknown> | null);
      })
      .catch(() => {
        cache = COMPANY_DEFAULTS;
      })
      .finally(() => {
        listeners.forEach((l) => l());
      });
  }
}

/** Live company details, falling back to the built-in constants. */
export function useCompanyInfo(): CompanyInfo {
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
  return cache ?? COMPANY_DEFAULTS;
}

/** Refresh the shared cache after the admin saves. */
export function primeCompanyInfo(info: CompanyInfo) {
  cache = { ...COMPANY_DEFAULTS, ...info };
  listeners.forEach((l) => l());
}
