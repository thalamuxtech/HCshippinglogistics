"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, MapPin, Package, ChevronRight } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { listShipments, listStatusLogs, where } from "@/lib/db";
import type { Shipment } from "@/lib/types";
import { Skeleton, EmptyState } from "@/components/ui/misc";
import { formatDateTime } from "@/lib/utils";
import type { Timestamp } from "firebase/firestore";

function tsToDate(ts?: Timestamp | null): Date | null {
  if (!ts) return null;
  try {
    return ts.toDate();
  } catch {
    return null;
  }
}

function isToday(d: Date | null): boolean {
  if (!d) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

interface CompletedJob extends Shipment {
  completedAt: Date | null;
}

export default function DispatchCompletedPage() {
  const { user } = useAuth();
  const [jobs, setJobs] = React.useState<CompletedJob[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!user?.id) return;
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const rows = await listShipments([where("assigned_dispatcher_id", "==", user.id)]);
        const completed = rows.filter((s) => s.current_status === "completed");
        // Resolve when THIS dispatcher marked it completed (from the status log).
        const withTimes = await Promise.all(
          completed.map(async (s) => {
            const logs = await listStatusLogs(s.id);
            const doneLog = logs.find((l) => l.status === "completed");
            return { ...s, completedAt: tsToDate(doneLog?.created_at) } as CompletedJob;
          })
        );
        const todays = withTimes
          .filter((s) => isToday(s.completedAt))
          .sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0));
        if (active) setJobs(todays);
      } catch {
        if (active) setJobs([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [user?.id]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-navy">Completed today</h1>
        <p className="text-sm text-ink-muted">
          Deliveries you marked complete today{jobs.length ? ` · ${jobs.length}` : ""}.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="h-6 w-6" />}
          title="No deliveries completed yet today"
          description="Completed deliveries will appear here with their timestamps."
          action={
            <Link href="/dispatch" className="text-sm font-semibold text-gold-700 hover:underline">
              View my jobs
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {jobs.map((job) => (
            <li key={job.id}>
              <Link
                href={`/dispatch/jobs/detail?id=${job.id}`}
                className="flex items-center gap-4 rounded-2xl border border-border bg-white p-5 shadow-card transition hover:border-gold/40 focus-ring"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-500">
                  <CheckCircle2 className="h-6 w-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-sm font-bold text-navy">{job.tracking_number}</p>
                  <p className="mt-1 flex items-center gap-1.5 truncate text-sm text-ink-muted">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    {job.delivery_address || job.destination_city || job.destination_country}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-muted">
                    <Package className="h-3.5 w-3.5 shrink-0" />
                    Delivered {formatDateTime(job.completedAt)}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-ink-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
