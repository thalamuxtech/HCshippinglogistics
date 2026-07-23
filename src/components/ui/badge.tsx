import * as React from "react";
import { cn } from "@/lib/utils";
import { STAGE_MAP } from "@/lib/constants";
import type { ShipmentStatus } from "@/lib/types";

type BadgeVariant = "navy" | "gold" | "muted" | "success" | "warning" | "danger" | "outline";

const variants: Record<BadgeVariant, string> = {
  navy: "bg-navy text-white",
  gold: "bg-gold/15 text-gold-700 ring-1 ring-gold/30",
  muted: "bg-secondary text-secondary-foreground",
  success: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  warning: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  danger: "bg-red-50 text-red-700 ring-1 ring-red-200",
  outline: "border border-border text-ink",
};

export function Badge({
  className,
  variant = "muted",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

/** Color-coded shipment stage badge (8-stage lifecycle). */
export function StageBadge({
  status,
  className,
  showDot = true,
}: {
  status: ShipmentStatus;
  className?: string;
  showDot?: boolean;
}) {
  const stage = STAGE_MAP[status];
  if (!stage) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        className
      )}
      style={{
        backgroundColor: `${stage.color}18`,
        color: stage.color,
        boxShadow: `inset 0 0 0 1px ${stage.color}33`,
      }}
    >
      {showDot && (
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: stage.color }} />
      )}
      {stage.short}
    </span>
  );
}
