"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/misc";

type Accent = "navy" | "gold" | "emerald" | "blue" | "purple" | "orange";

// Animate a number from 0 → target with an ease-out curve. Respects
// prefers-reduced-motion (jumps straight to the target). Re-runs when target
// changes so late-loading data still animates in.
function useCountUp(target: number, durationMs = 1100, enabled = true): number {
  const [display, setDisplay] = React.useState(enabled ? 0 : target);

  React.useEffect(() => {
    if (!enabled) {
      setDisplay(target);
      return;
    }
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || target === 0) {
      setDisplay(target);
      return;
    }

    let raf = 0;
    let start: number | null = null;
    const from = 0;
    const step = (ts: number) => {
      if (start === null) start = ts;
      const t = Math.min(1, (ts - start) / durationMs);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (target - from) * eased);
      if (t < 1) raf = requestAnimationFrame(step);
      else setDisplay(target);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs, enabled]);

  return display;
}

// Small internal component so the hook only runs when count-up is requested.
function CountUpValue({
  to,
  format,
  duration,
}: {
  to: number;
  format?: (n: number) => string;
  duration?: number;
}) {
  const n = useCountUp(to, duration);
  const rounded = Math.round(n);
  return <>{format ? format(rounded) : rounded.toLocaleString()}</>;
}

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
  /** When set, the value animates (count-up) from 0 to this number. */
  countTo?: number;
  /** Formats the animated number (e.g. formatCurrency). Defaults to toLocaleString. */
  format?: (n: number) => string;
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
  countTo,
  format,
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
      <p className="mt-3 font-mono text-3xl font-bold tracking-tight text-navy">
        {typeof countTo === "number" ? (
          <CountUpValue to={countTo} format={format} />
        ) : (
          value
        )}
      </p>
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
