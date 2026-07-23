"use client";

import * as React from "react";
import Link from "next/link";
import {
  MapPin,
  Phone,
  Package,
  AlertTriangle,
  ChevronRight,
  Truck,
} from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { listShipments, where } from "@/lib/db";
import type { Shipment } from "@/lib/types";
import { Skeleton, EmptyState } from "@/components/ui/misc";

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
        const rows = await listShipments([where("assigned_dispatcher_id", "==", user.id)]);
        const delivery = rows
          .filter((s) => s.current_status === "delivery")
          .sort((a, b) => (b.updated_at?.toMillis?.() ?? 0) - (a.updated_at?.toMillis?.() ?? 0));
        if (active) setJobs(delivery);
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
      <div className="flex items-center gap-3">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-navy text-gold">
          <Truck className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-navy">My Jobs</h1>
          <p className="text-sm text-ink-muted">
            {loading ? "Loading…" : `${jobs.length} delivery ${jobs.length === 1 ? "job" : "jobs"} assigned`}
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
          title="No jobs right now"
          description="Deliveries assigned to you will show up here. Check back soon."
        />
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => (
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

              <div className="mt-3 space-y-2.5">
                <div className="flex items-start gap-2.5">
                  <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
                  <p className="text-base font-semibold leading-snug text-navy">
                    {job.delivery_address ||
                      [job.destination_city, job.destination_country].filter(Boolean).join(", ") ||
                      "Address on file"}
                  </p>
                </div>

                <div className="flex items-center gap-2.5">
                  <Phone className="h-5 w-5 shrink-0 text-ink-muted" />
                  <span className="text-base text-ink">
                    {job.customer_name || "Customer"}
                    {job.customer_phone ? ` · ${job.customer_phone}` : ""}
                  </span>
                </div>

                <div className="flex items-start gap-2.5">
                  <Package className="mt-0.5 h-5 w-5 shrink-0 text-ink-muted" />
                  <span className="text-sm text-ink-muted">
                    {job.items?.[0]?.description ||
                      job.item_category ||
                      job.vehicle_details ||
                      "Shipment items"}
                  </span>
                </div>

                {job.notes && (
                  <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 p-3">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                    <span className="text-sm font-medium text-amber-800">{job.notes}</span>
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
