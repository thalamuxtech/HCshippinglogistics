"use client";

import * as React from "react";
import Link from "next/link";
import { Search, Package, ArrowRight } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { listShipments, where } from "@/lib/db";
import type { Shipment, ShipmentStatus } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { StageBadge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/input";
import { Skeleton, EmptyState } from "@/components/ui/misc";
import { formatDate, cn } from "@/lib/utils";
import { STAGES, stageOrder } from "@/lib/constants";
import { BulkAdvanceBar } from "@/components/portal/BulkAdvanceBar";

export default function OfficeShipmentsPage() {
  const { user } = useAuth();
  const country = user?.assigned_country || "Nigeria";
  const [shipments, setShipments] = React.useState<Shipment[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState<ShipmentStatus | "all" | "destination">(
    "destination"
  );
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const load = React.useCallback(async () => {
    try {
      const rows = await listShipments([where("destination_country", "==", country)]);
      setShipments(rows);
    } catch {
      setShipments([]);
    } finally {
      setLoading(false);
    }
  }, [country]);

  React.useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const rows = await listShipments([where("destination_country", "==", country)]);
        if (active) setShipments(rows);
      } catch {
        if (active) setShipments([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [country]);

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    return shipments
      .filter((s) => {
        if (status === "destination") return stageOrder(s.current_status) >= 5;
        if (status !== "all") return s.current_status === status;
        return true;
      })
      .filter((s) => {
        if (!needle) return true;
        return (
          s.tracking_number?.toLowerCase().includes(needle) ||
          s.customer_name?.toLowerCase().includes(needle) ||
          s.destination_city?.toLowerCase().includes(needle)
        );
      })
      .sort((a, b) => (b.updated_at?.toMillis?.() ?? 0) - (a.updated_at?.toMillis?.() ?? 0));
  }, [shipments, q, status]);

  // Keep the selection scoped to what's visible, so a bulk action can never
  // touch a shipment that has been filtered out of view.
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

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allVisibleSelected = filtered.length > 0 && filtered.every((s) => selected.has(s.id));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-navy sm:text-3xl">Shipments</h1>
        <p className="mt-1 text-sm text-ink-muted">
          All shipments destined for {country}. Focus stages: clearance through completed.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search tracking #, customer, or city…"
            className="pl-10"
            aria-label="Search shipments"
          />
        </div>
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value as ShipmentStatus | "all" | "destination")}
          className="sm:w-64"
          aria-label="Filter by status"
        >
          <option value="destination">Destination stages (5-8)</option>
          <option value="all">All stages</option>
          {STAGES.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Package className="h-6 w-6" />}
          title="No shipments found"
          description="Try adjusting your search or status filter."
        />
      ) : (
        <div className="space-y-3">
          {/* Select-all for batch stage moves (a container, a truckload, a manifest). */}
          <label className="flex w-fit cursor-pointer items-center gap-2.5 px-1 text-xs font-medium text-ink-muted">
            <input
              type="checkbox"
              className="h-5 w-5 cursor-pointer accent-navy"
              checked={allVisibleSelected}
              ref={(el) => {
                if (el)
                  el.indeterminate =
                    filtered.some((s) => selected.has(s.id)) && !allVisibleSelected;
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
            Select all {filtered.length} shown
          </label>

          {filtered.map((s) => (
            <Card
              key={s.id}
              className={cn(
                "group transition-all duration-200 hover:-translate-y-0.5 hover:shadow-premium",
                selected.has(s.id) && "bg-gold/5 ring-1 ring-gold/40"
              )}
            >
              <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  {/* Outside the link so selecting never navigates away. */}
                  <input
                    type="checkbox"
                    aria-label={`Select ${s.tracking_number}`}
                    className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-navy"
                    checked={selected.has(s.id)}
                    onChange={() => toggle(s.id)}
                  />
                  <Link
                    href={`/office/shipments/detail?id=${s.id}`}
                    className="min-w-0 focus-ring rounded-md"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-bold text-navy">
                        {s.tracking_number}
                      </span>
                      <StageBadge status={s.current_status} />
                    </div>
                    <p className="mt-1 truncate text-sm text-ink-muted">
                      {s.customer_name || "-"} ·{" "}
                      {s.destination_city ? `${s.destination_city}, ` : ""}
                      {s.destination_country}
                    </p>
                  </Link>
                </div>
                <Link
                  href={`/office/shipments/detail?id=${s.id}`}
                  className="flex shrink-0 items-center gap-4 focus-ring rounded-md"
                  aria-label={`Open ${s.tracking_number}`}
                >
                  <div className="text-right">
                    <div className="text-xs text-ink-muted">{formatDate(s.updated_at)}</div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-ink-muted transition-transform group-hover:translate-x-1" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Bulk selection bar + advance modal (stages 5-8 for this role) */}
      {user && (
        <BulkAdvanceBar
          selected={selected}
          shipments={shipments}
          actor={{ id: user.id, full_name: user.full_name, role: user.role }}
          onDone={load}
          onClear={() => setSelected(new Set())}
        />
      )}
    </div>
  );
}
