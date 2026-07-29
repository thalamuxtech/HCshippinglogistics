"use client";

import * as React from "react";
import Link from "next/link";
import {
  MapPin,
  Phone,
  Package,
  ChevronRight,
  Truck,
  Container,
  Lock,
} from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { listArrivedShipments } from "@/lib/db";
import type { Shipment } from "@/lib/types";
import { StageBadge } from "@/components/ui/badge";
import { Skeleton, EmptyState } from "@/components/ui/misc";
import { isDnr } from "@/lib/utils";

interface Group {
  cnt: string;
  label: string;
  jobs: Shipment[];
}

export default function DispatchJobsPage() {
  const { user } = useAuth();
  const [jobs, setJobs] = React.useState<Shipment[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!user?.id) return;
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const rows = await listArrivedShipments();
        // Hand-out queue: arrived, not yet completed. Ready-first ordering.
        const open = rows
          .filter((s) => s.current_status !== "completed")
          .sort((a, b) => {
            const ar = a.current_status === "delivery" ? 0 : 1;
            const br = b.current_status === "delivery" ? 0 : 1;
            if (ar !== br) return ar - br;
            return (b.updated_at?.toMillis?.() ?? 0) - (a.updated_at?.toMillis?.() ?? 0);
          });
        if (active) setJobs(open);
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

  // Group by container that arrived.
  const groups = React.useMemo<Group[]>(() => {
    const map = new Map<string, Group>();
    for (const j of jobs) {
      const cnt = (j.container_number || "").trim();
      const key = cnt || "__none__";
      if (!map.has(key)) {
        map.set(key, { cnt, label: cnt ? `CNT #${cnt}` : "Unassigned container", jobs: [] });
      }
      map.get(key)!.jobs.push(j);
    }
    return Array.from(map.values()).sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { numeric: true })
    );
  }, [jobs]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-navy text-gold-300">
          <Truck className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-navy">Hand-out queue</h1>
          <p className="text-sm text-ink-muted">
            {loading
              ? "Loading…"
              : `${jobs.length} item${jobs.length === 1 ? "" : "s"} across ${groups.length} container${
                  groups.length === 1 ? "" : "s"
                }`}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <EmptyState
          icon={<Package className="h-6 w-6" />}
          title="Nothing to hand out yet"
          description="Shipments appear here once their container arrives at the destination warehouse."
        />
      ) : (
        <div className="space-y-7">
          {groups.map((g) => (
            <section key={g.label} className="space-y-3">
              <div className="flex items-center gap-2">
                <Container className="h-4 w-4 text-gold" />
                <h2 className="font-mono text-sm font-bold text-navy">{g.label}</h2>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                  {g.jobs.length} item{g.jobs.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="space-y-3">
                {g.jobs.map((job) => {
                  const held = isDnr(job);
                  return (
                    <Link
                      key={job.id}
                      href={`/dispatch/jobs/detail?id=${job.id}`}
                      className="block rounded-2xl border border-border bg-white p-5 shadow-card transition-colors active:bg-secondary/50 focus-ring"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="font-mono text-base font-bold text-navy">
                          {job.tracking_number}
                        </span>
                        <ChevronRight className="mt-0.5 h-6 w-6 shrink-0 text-ink-muted" />
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <StageBadge status={job.current_status} />
                        {held ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-bold text-red-700 ring-1 ring-red-200">
                            <Lock className="h-3 w-3" /> Do Not Release
                          </span>
                        ) : job.current_status === "delivery" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">
                            Ready to hand out
                          </span>
                        ) : (
                          <span className="text-xs text-ink-muted">At warehouse</span>
                        )}
                      </div>

                      {/* Minimal recipient info, no price */}
                      <div className="mt-3 space-y-2.5">
                        <div className="flex items-center gap-2.5">
                          <Phone className="h-5 w-5 shrink-0 text-ink-muted" />
                          <span className="text-base text-ink">
                            {job.receiver?.full_name || job.customer_name || "Recipient"}
                            {job.receiver?.phone
                              ? ` · ${job.receiver.phone}`
                              : job.customer_phone
                              ? ` · ${job.customer_phone}`
                              : ""}
                          </span>
                        </div>

                        <div className="flex items-start gap-2.5">
                          <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
                          <span className="text-sm text-ink">
                            {job.receiver?.address ||
                              [job.destination_city, job.destination_country]
                                .filter(Boolean)
                                .join(", ") ||
                              "Pickup at warehouse"}
                          </span>
                        </div>

                        <div className="flex items-start gap-2.5">
                          <Package className="mt-0.5 h-5 w-5 shrink-0 text-ink-muted" />
                          <span className="text-sm text-ink-muted">
                            {job.items?.length
                              ? job.items
                                  .map((it) => `${it.quantity && it.quantity > 1 ? `${it.quantity}x ` : ""}${it.description}`)
                                  .join(", ")
                              : job.item_category || job.vehicle_details || "Shipment items"}
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
