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
