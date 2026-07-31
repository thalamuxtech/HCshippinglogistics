"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, MapPin, Package, ChevronRight, Container } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { getShipment, listCompletedLogsSince } from "@/lib/db";
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

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
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
        // Read TODAY'S completion logs directly rather than every completed
        // shipment ever. The previous version fetched all completed shipments
        // and then ran one listStatusLogs() per shipment — an N+1 that grew
        // without bound as the business completed more deliveries.
        const logs = await listCompletedLogsSince(startOfToday());
        // Only this rider's own completions: the heading promises "you marked
        // complete", but the old query was unfiltered, so every dispatcher saw
        // everyone else's deliveries as their own.
        const mine = logs.filter((l) => l.updated_by === user.id);
        if (mine.length === 0) {
          if (active) setJobs([]);
          return;
        }
        // Newest first, and keep only the latest completion per shipment in case
        // a delivery was re-marked.
        const latest = new Map<string, Date | null>();
        for (const l of mine) {
          const at = tsToDate(l.created_at);
          const seen = latest.get(l.shipment_id);
          if (!seen || (at && at.getTime() > seen.getTime())) latest.set(l.shipment_id, at);
        }
        const resolved = await Promise.all(
          Array.from(latest.keys()).map(async (sid) => {
            const s = await getShipment(sid);
            return s ? ({ ...s, completedAt: latest.get(sid) ?? null } as CompletedJob) : null;
          })
        );
        const todays = resolved
          .filter((s): s is CompletedJob => s !== null && isToday(s.completedAt))
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
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-mono text-sm font-bold text-navy">{job.tracking_number}</p>
                    {job.container_number && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 font-mono text-[11px] font-semibold text-secondary-foreground">
                        <Container className="h-3 w-3" /> CNT #{job.container_number}
                      </span>
                    )}
                  </div>
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
