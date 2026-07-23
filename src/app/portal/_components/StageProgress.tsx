"use client";

import { STAGES, stageOrder } from "@/lib/constants";
import type { ShipmentStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Compact horizontal 8-stage progress bar for shipment cards. */
export function StageProgress({
  status,
  className,
}: {
  status: ShipmentStatus;
  className?: string;
}) {
  const current = stageOrder(status);
  return (
    <div
      className={cn("flex items-center gap-1", className)}
      role="img"
      aria-label={`Stage ${current} of ${STAGES.length}`}
    >
      {STAGES.map((s) => {
        const done = s.order <= current;
        const isCurrent = s.order === current;
        return (
          <span
            key={s.key}
            title={s.label}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors",
              isCurrent && "animate-pulse"
            )}
            style={{ backgroundColor: done ? s.color : "#E2E8F0" }}
          />
        );
      })}
    </div>
  );
}
