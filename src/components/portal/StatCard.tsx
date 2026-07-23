"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/misc";

type Accent = "navy" | "gold" | "emerald" | "blue" | "purple" | "orange";

const accentStyles: Record<Accent, { icon: string; ring: string }> = {
  navy: { icon: "bg-navy/5 text-navy", ring: "ring-navy/10" },
  gold: { icon: "bg-gold/15 text-gold-700", ring: "ring-gold/20" },
  emerald: { icon: "bg-emerald-50 text-emerald-600", ring: "ring-emerald-100" },
  blue: { icon: "bg-blue-50 text-blue-600", ring: "ring-blue-100" },
  purple: { icon: "bg-purple-50 text-purple-600", ring: "ring-purple-100" },
  orange: { icon: "bg-orange-50 text-orange-600", ring: "ring-orange-100" },
};

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  accent?: Accent;
  /** Percentage or numeric change; positive = up, negative = down. */
  delta?: number;
  deltaLabel?: string;
  hint?: string;
  loading?: boolean;
  className?: string;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  accent = "navy",
  delta,
  deltaLabel,
  hint,
  loading,
  className,
}: StatCardProps) {
  const a = accentStyles[accent];

  if (loading) {
    return (
      <div className={cn("rounded-xl border border-border bg-white p-5 shadow-card", className)}>
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-4 h-8 w-20" />
        <Skeleton className="mt-3 h-3 w-16" />
      </div>
    );
  }

  const hasDelta = typeof delta === "number";
  const up = hasDelta && (delta as number) >= 0;

  return (
    <div
      className={cn(
        "group rounded-xl border border-border bg-white p-5 shadow-card transition-shadow hover:shadow-premium",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-ink-muted">{label}</p>
        {Icon && (
          <span
            className={cn(
              "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1",
              a.icon,
              a.ring
            )}
          >
            <Icon className="h-5 w-5" aria-hidden />
          </span>
        )}
      </div>
      <p className="mt-3 font-mono text-3xl font-bold tracking-tight text-navy">{value}</p>
      <div className="mt-2 flex items-center gap-2">
        {hasDelta && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold",
              up ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
            )}
          >
            {up ? (
              <ArrowUpRight className="h-3 w-3" aria-hidden />
            ) : (
              <ArrowDownRight className="h-3 w-3" aria-hidden />
            )}
            {Math.abs(delta as number)}%
          </span>
        )}
        {(deltaLabel || hint) && (
          <span className="text-xs text-ink-muted">{deltaLabel ?? hint}</span>
        )}
      </div>
    </div>
  );
}
