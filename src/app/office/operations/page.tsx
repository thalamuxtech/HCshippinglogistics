"use client";

// ─────────────────────────────────────────────────────────────
// Destination office, Operations (vehicles / RORO).
//
// Cars and other RORO cargo are routed here rather than into general Warehouse
// stock. A vehicle is not shelved cargo: it is driven off the vessel, parked,
// cleared and released against a title, so it needs its own monitoring view
// keyed on vehicle identity (class, curb weight, shipping line) instead of
// box counts.
//
// Derived from shipments the same way the Warehouse view is, a RORO shipment
// appears here automatically once it reaches a destination stage. Bulk stage
// advance uses the shared rules in lib/bulk-advance (stages 5-8 for this role).
// ─────────────────────────────────────────────────────────────

import * as React from "react";
import Link from "next/link";
import {
  Car,
  Search,
  Ship,
  Lock,
  ChevronRight,
  Info,
  Gauge,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { listShipments, where } from "@/lib/db";
import type { Shipment } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge, StageBadge, FragileBadge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/input";
import { Skeleton, EmptyState } from "@/components/ui/misc";
import { StatCard } from "@/components/portal/StatCard";
import { BulkAdvanceBar } from "@/components/portal/BulkAdvanceBar";
import { formatDate, isDnr } from "@/lib/utils";
import { STAGE_MAP, stageOrder } from "@/lib/constants";

const CLASS_LABEL: Record<string, string> = {
  class_a: "Class A",
  class_b: "Class B",
  class_c: "Class C",
};

function vehicleTitle(s: Shipment): string {
  return s.vehicle_details?.trim() || s.item_category?.trim() || "Vehicle";
}

export default function OfficeOperationsPage() {
  const { user } = useAuth();
  const country = user?.assigned_country || "Nigeria";

  const [shipments, setShipments] = React.useState<Shipment[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [q, setQ] = React.useState("");
  const [view, setView] = React.useState<"active" | "released" | "all">("active");
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

  // RORO only, and only once it has reached the destination half of the
  // lifecycle, this role owns stages 5-8.
  const vehicles = React.useMemo(
    () =>
      shipments.filter((s) => s.service_type === "roro" && stageOrder(s.current_status) >= 5),
    [shipments]
  );

  const stats = React.useMemo(() => {
    const open = vehicles.filter((s) => s.current_status !== "completed");
    return {
      onSite: open.length,
      awaitingClearance: open.filter((s) => s.current_status === "clearance").length,
      held: open.filter((s) => isDnr(s)).length,
      released: vehicles.filter((s) => s.current_status === "completed").length,
    };
  }, [vehicles]);

  const filtered = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    return vehicles.filter((s) => {
      if (view === "active" && s.current_status === "completed") return false;
      if (view === "released" && s.current_status !== "completed") return false;
      if (!term) return true;
      return (
        s.tracking_number?.toLowerCase().includes(term) ||
        vehicleTitle(s).toLowerCase().includes(term) ||
        s.customer_name?.toLowerCase().includes(term) ||
        s.receiver?.full_name?.toLowerCase().includes(term) ||
        s.shipping_line?.toLowerCase().includes(term) ||
        s.container_number?.toLowerCase().includes(term)
      );
    });
  }, [vehicles, q, view]);

  // Keep the selection scoped to what is visible, so a bulk action can never
  // touch a vehicle filtered out of view.
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

  const allVisibleSelected = filtered.length > 0 && filtered.every((s) => selected.has(s.id));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-navy sm:text-3xl">Operations</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Vehicles and RORO cargo arriving in {country}. Routed here directly rather than into
          general warehouse stock, and monitored until released.
        </p>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
        ) : (
          <>
            <StatCard label="Vehicles on site" value={stats.onSite} icon={Car} accent="navy" />
            <StatCard
              label="Awaiting clearance"
              value={stats.awaitingClearance}
              icon={Ship}
              accent="orange"
            />
            <StatCard
              label="On hold (DNR)"
              value={stats.held}
              icon={Lock}
              accent="purple"
              hint={stats.held > 0 ? "Do not release until head office clears" : undefined}
            />
            <StatCard label="Released" value={stats.released} icon={CheckCircle2} accent="emerald" />
          </>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search vehicle, tracking #, owner, or shipping line…"
            className="pl-10"
            aria-label="Search vehicles"
          />
        </div>
        <Select
          value={view}
          onChange={(e) => setView(e.target.value as typeof view)}
          className="sm:w-56"
          aria-label="Filter vehicles"
        >
          <option value="active">On site</option>
          <option value="released">Released</option>
          <option value="all">All vehicles</option>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Car className="h-6 w-6" />}
          title={vehicles.length === 0 ? "No vehicles here yet" : "No matching vehicles"}
          description={
            vehicles.length === 0
              ? `RORO shipments appear here automatically once head office advances them to a ${country} destination stage.`
              : "Try a different search or view."
          }
        />
      ) : (
        <div className="space-y-3">
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

          {filtered.map((s) => {
            const held = isDnr(s);
            return (
              <Card key={s.id} className={selected.has(s.id) ? "bg-gold/5 ring-1 ring-gold/40" : ""}>
                <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start">
                  <input
                    type="checkbox"
                    aria-label={`Select ${s.tracking_number}`}
                    className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-navy"
                    checked={selected.has(s.id)}
                    onChange={() =>
                      setSelected((prev) => {
                        const next = new Set(prev);
                        if (next.has(s.id)) next.delete(s.id);
                        else next.add(s.id);
                        return next;
                      })
                    }
                  />

                  <Link
                    href={`/office/shipments/detail?id=${s.id}`}
                    className="min-w-0 flex-1 focus-ring rounded-md"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-navy/5 text-navy">
                        <Car className="h-4 w-4" />
                      </span>
                      <span className="font-semibold text-navy">{vehicleTitle(s)}</span>
                      <StageBadge status={s.current_status} />
                      {s.fragile && <FragileBadge note={s.fragile_note} />}
                      {held && (
                        <Badge variant="danger">
                          <Lock className="mr-1 h-3 w-3" /> DNR
                        </Badge>
                      )}
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
                      <span className="font-mono font-semibold text-navy">
                        {s.tracking_number}
                      </span>
                      {s.vehicle_class && (
                        <span className="inline-flex items-center gap-1">
                          <Gauge className="h-3.5 w-3.5" />
                          {CLASS_LABEL[s.vehicle_class] ?? s.vehicle_class}
                        </span>
                      )}
                      {s.curb_weight ? <span>{s.curb_weight} lbs curb</span> : null}
                      {s.shipping_line && (
                        <span className="inline-flex items-center gap-1">
                          <Ship className="h-3.5 w-3.5" />
                          {s.shipping_line.toUpperCase()}
                        </span>
                      )}
                      {s.container_number && (
                        <span className="font-mono">CNT #{s.container_number}</span>
                      )}
                    </div>

                    <p className="mt-1.5 truncate text-xs text-ink-muted">
                      Owner: {s.customer_name || "-"}
                      {s.receiver?.full_name ? ` · Collect by ${s.receiver.full_name}` : ""}
                      {s.receiver?.phone ? ` · ${s.receiver.phone}` : ""}
                    </p>
                  </Link>

                  <div className="shrink-0 text-right">
                    <p className="text-[11px] uppercase tracking-wide text-ink-muted">Updated</p>
                    <p className="text-xs text-ink-muted">{formatDate(s.updated_at)}</p>
                    <ChevronRight className="ml-auto mt-1 h-4 w-4 text-ink-muted" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Stage mix, so staff can see where the fleet sits at a glance. */}
      {!loading && vehicles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Fleet status</CardTitle>
            <CardDescription>Where the vehicles on this site currently sit.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {Object.entries(
              vehicles.reduce<Record<string, number>>((acc, s) => {
                acc[s.current_status] = (acc[s.current_status] || 0) + 1;
                return acc;
              }, {})
            )
              .sort(
                (a, b) =>
                  stageOrder(a[0] as Shipment["current_status"]) -
                  stageOrder(b[0] as Shipment["current_status"])
              )
              .map(([status, count]) => (
                <Badge key={status} variant="muted">
                  {count} · {STAGE_MAP[status as keyof typeof STAGE_MAP]?.short ?? status}
                </Badge>
              ))}
          </CardContent>
        </Card>
      )}

      <div className="flex items-start gap-2.5 rounded-xl border border-border bg-secondary/40 p-4">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
        <p className="text-xs text-ink-muted">
          Vehicles are released against the consignee&apos;s documents. A vehicle marked{" "}
          <strong>DNR</strong> must not be handed over until head office clears the hold, regardless
          of who presents for collection.
        </p>
      </div>

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
