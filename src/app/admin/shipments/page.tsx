"use client";

import * as React from "react";
import Link from "next/link";
import { Package, Search, ChevronRight } from "lucide-react";
import { listAllShipments } from "@/lib/db";
import { useAuth } from "@/components/providers/AuthProvider";
import type { Shipment, ShipmentStatus, ServiceType } from "@/lib/types";
import { STAGES, SERVICES } from "@/lib/constants";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { StageBadge, Badge, FragileBadge } from "@/components/ui/badge";
import { Skeleton, EmptyState } from "@/components/ui/misc";
import { BulkAdvanceBar } from "@/components/portal/BulkAdvanceBar";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
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
  const { user } = useAuth();
  const [loading, setLoading] = React.useState(true);
  const [shipments, setShipments] = React.useState<Shipment[]>([]);
  const [error, setError] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState<ShipmentStatus | "all">("all");
  const [service, setService] = React.useState<ServiceType | "all">("all");

  // ── Bulk selection (the advance flow itself lives in BulkAdvanceBar) ──
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const reload = React.useCallback(async () => {
    try {
      const s = await listAllShipments();
      setShipments(s);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

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

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const filtered = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    return shipments.filter((s) => {
      if (status !== "all" && s.current_status !== status) return false;
      if (service !== "all" && s.service_type !== service) return false;
      if (!term) return true;
      return (
        s.tracking_number?.toLowerCase().includes(term) ||
        s.customer_name?.toLowerCase().includes(term) ||
        s.customer_email?.toLowerCase().includes(term) ||
        s.container_number?.toLowerCase().includes(term)
      );
    });
  }, [shipments, q, status, service]);

  // Keep the selection scoped to what's currently visible, so a bulk action
  // can never touch a shipment the admin filtered out of view.
  React.useEffect(() => {
    setSelected((prev) => {
      if (prev.size === 0) return prev;
      const visible = new Set(filtered.map((s) => s.id));
      const next = new Set<string>();
      prev.forEach((id) => {
        if (visible.has(id)) next.add(id);
      });
      return next.size === prev.size ? prev : next;
    });
  }, [filtered]);

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
                  <th className="px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label="Select all"
                      className="h-5 w-5 cursor-pointer accent-navy"
                      checked={filtered.length > 0 && filtered.every((s) => selected.has(s.id))}
                      ref={(el) => {
                        if (el)
                          el.indeterminate =
                            filtered.some((s) => selected.has(s.id)) &&
                            !filtered.every((s) => selected.has(s.id));
                      }}
                      onChange={(e) => {
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) filtered.forEach((s) => next.add(s.id));
                          else filtered.forEach((s) => next.delete(s.id));
                          return next;
                        });
                      }}
                    />
                  </th>
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
                    className={cn(
                      "group border-b border-border transition-colors last:border-0 hover:bg-secondary/40",
                      selected.has(s.id) && "bg-gold/5"
                    )}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        aria-label={`Select ${s.tracking_number}`}
                        className="h-5 w-5 cursor-pointer accent-navy"
                        checked={selected.has(s.id)}
                        onChange={() => toggle(s.id)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/shipments/detail?id=${s.id}`}
                        className="font-mono text-xs font-semibold text-navy hover:text-gold-700 focus-ring"
                      >
                        {s.tracking_number || s.id.slice(0, 8)}
                      </Link>
                      {s.container_number && (
                        <div className="mt-1 font-mono text-[10px] text-ink-muted">
                          CNT #{s.container_number}
                        </div>
                      )}
                      {s.fragile && (
                        <div className="mt-1">
                          <FragileBadge note={s.fragile_note} />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="max-w-[180px] truncate font-medium text-ink">
                        {s.customer_name || "-"}
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
                        href={`/admin/shipments/detail?id=${s.id}`}
                        className="inline-flex items-center rounded-md p-2 text-ink-muted transition-opacity hover:text-navy focus-ring sm:opacity-0 sm:group-hover:opacity-100"
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

      {/* Bulk selection bar + advance modal (shared with the office portal) */}
      {user && (
        <BulkAdvanceBar
          selected={selected}
          shipments={shipments}
          actor={{ id: user.id, full_name: user.full_name, role: user.role }}
          onDone={reload}
          onClear={() => setSelected(new Set())}
        />
      )}
    </div>
  );
}
