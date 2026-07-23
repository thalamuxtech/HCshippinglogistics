"use client";

import * as React from "react";
import Link from "next/link";
import { Package, Search, ChevronRight } from "lucide-react";
import { listAllShipments } from "@/lib/db";
import type { Shipment, ShipmentStatus, ServiceType } from "@/lib/types";
import { STAGES, SERVICES } from "@/lib/constants";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { StageBadge, Badge } from "@/components/ui/badge";
import { Skeleton, EmptyState } from "@/components/ui/misc";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Timestamp } from "firebase/firestore";

function tsToDate(ts?: Timestamp | null): Date | null {
  if (!ts) return null;
  try {
    return ts.toDate();
  } catch {
    return null;
  }
}

const SERVICE_LABEL: Record<ServiceType, string> = {
  sea: "Sea",
  air: "Air",
  roro: "RORO",
};

export default function AdminShipmentsPage() {
  const [loading, setLoading] = React.useState(true);
  const [shipments, setShipments] = React.useState<Shipment[]>([]);
  const [error, setError] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState<ShipmentStatus | "all">("all");
  const [service, setService] = React.useState<ServiceType | "all">("all");

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const s = await listAllShipments();
        if (alive) setShipments(s);
      } catch {
        if (alive) setError(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const filtered = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    return shipments.filter((s) => {
      if (status !== "all" && s.current_status !== status) return false;
      if (service !== "all" && s.service_type !== service) return false;
      if (!term) return true;
      return (
        s.tracking_number?.toLowerCase().includes(term) ||
        s.customer_name?.toLowerCase().includes(term) ||
        s.customer_email?.toLowerCase().includes(term)
      );
    });
  }, [shipments, q, status, service]);

  return (
    <div className="space-y-5">
      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_auto]">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
              aria-hidden
            />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search tracking # or customer…"
              className="pl-9"
              aria-label="Search shipments"
            />
          </div>
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value as ShipmentStatus | "all")}
            aria-label="Filter by status"
            className="sm:w-48"
          >
            <option value="all">All stages</option>
            {STAGES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.short}
              </option>
            ))}
          </Select>
          <Select
            value={service}
            onChange={(e) => setService(e.target.value as ServiceType | "all")}
            aria-label="Filter by service type"
            className="sm:w-40"
          >
            <option value="all">All services</option>
            {(["sea", "air", "roro"] as const).map((s) => (
              <option key={s} value={s}>
                {SERVICES[s].label}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="p-4">
            <EmptyState
              icon={<Package className="h-6 w-6" />}
              title="Could not load shipments"
              description="Please refresh to try again."
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={<Package className="h-6 w-6" />}
              title={shipments.length === 0 ? "No shipments yet" : "No matching shipments"}
              description={
                shipments.length === 0
                  ? "Shipments will appear here as they are created."
                  : "Try adjusting your search or filters."
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50 text-left text-xs uppercase tracking-wide text-ink-muted">
                  <th className="px-4 py-3 font-semibold">Tracking #</th>
                  <th className="px-4 py-3 font-semibold">Customer</th>
                  <th className="px-4 py-3 font-semibold">Service</th>
                  <th className="px-4 py-3 font-semibold">Destination</th>
                  <th className="px-4 py-3 font-semibold">Stage</th>
                  <th className="px-4 py-3 text-right font-semibold">Total</th>
                  <th className="px-4 py-3 font-semibold">Created</th>
                  <th className="px-4 py-3" aria-label="Open" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr
                    key={s.id}
                    className="group border-b border-border last:border-0 transition-colors hover:bg-secondary/40"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/shipments/${s.id}`}
                        className="font-mono text-xs font-semibold text-navy hover:text-gold-700 focus-ring"
                      >
                        {s.tracking_number || s.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="max-w-[180px] truncate font-medium text-ink">
                        {s.customer_name || "—"}
                      </div>
                      {s.customer_email && (
                        <div className="max-w-[180px] truncate text-xs text-ink-muted">
                          {s.customer_email}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">{SERVICE_LABEL[s.service_type]}</Badge>
                    </td>
                    <td className="px-4 py-3 text-ink">
                      {s.destination_country}
                      {s.destination_city ? `, ${s.destination_city}` : ""}
                    </td>
                    <td className="px-4 py-3">
                      <StageBadge status={s.current_status} />
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-ink">
                      {formatCurrency(s.total_price, s.currency)}
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-muted">
                      {formatDate(tsToDate(s.created_at))}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/shipments/${s.id}`}
                        className="inline-flex items-center rounded-md p-1 text-ink-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-navy focus-ring"
                        aria-label={`Open ${s.tracking_number}`}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {!loading && !error && filtered.length > 0 && (
        <p className="px-1 text-xs text-ink-muted">
          Showing {filtered.length} of {shipments.length} shipments.
        </p>
      )}
    </div>
  );
}
