import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

export function formatDate(d?: Date | { toDate: () => Date } | null): string {
  if (!d) return "—";
  const date = "toDate" in (d as object) ? (d as { toDate: () => Date }).toDate() : (d as Date);
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function formatDateTime(d?: Date | { toDate: () => Date } | null): string {
  if (!d) return "—";
  const date = "toDate" in (d as object) ? (d as { toDate: () => Date }).toDate() : (d as Date);
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

// Human-readable tracking number: HC-YYYYMM-XXXXX (service prefix + serial)
export function generateTrackingNumber(service: "sea" | "air" | "roro", serial: number): string {
  const prefix = { sea: "SEA", air: "AIR", roro: "RRO" }[service];
  const yr = new Date().getFullYear();
  const serialStr = String(serial).padStart(5, "0");
  return `HC-${prefix}-${yr}-${serialStr}`;
}

export function initialsOf(name?: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

// ── Do Not Release (DNR) ──
// A shipment is on Do-Not-Release when the balance is not fully settled (covers
// pay-on-delivery), unless an admin has manually overridden the state.
// dnr_override: null/undefined = follow payment; true = force hold; false = force release.
// Precedence is identical across the client (this helper), the receipt PDF, and
// the viewByCustomerId function: override wins, then the materialized `dnr`
// boolean, then the payment fallback.
export function isDnr(s: {
  payment_status?: string;
  dnr?: boolean;
  dnr_override?: boolean | null;
}): boolean {
  if (s.dnr_override === true) return true;
  if (s.dnr_override === false) return false;
  if (typeof s.dnr === "boolean") return s.dnr;
  return (s.payment_status || "unpaid") !== "paid";
}

// Container label for display, e.g. "CNT #19B". Returns "" when unassigned.
export function containerLabel(container?: string | null): string {
  const c = (container || "").trim();
  return c ? `CNT #${c}` : "";
}
