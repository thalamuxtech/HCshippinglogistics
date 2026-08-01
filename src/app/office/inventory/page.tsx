"use client";

// ─────────────────────────────────────────────────────────────
// Destination warehouse — DERIVED from shipments, never hand-entered.
//
// The model is Container → Shipments → Items. A container's contents are
// already fully described by the shipments assigned to it, so warehouse stock
// is a projection of shipment stage, not a separate list someone re-types:
// when the admin advances a container to a destination stage the cargo appears
// here automatically, and it leaves when the shipment completes.
//
// This replaced a manual "Receive Item" form that wrote to a parallel
// `destination_inventory` collection with an empty shipment_id — those rows
// duplicated shipment data, could not be reconciled against a container, and
// drifted the moment either side changed.
// ─────────────────────────────────────────────────────────────

import * as React from "react";
import Link from "next/link";
import {
  Boxes,
  Search,
  Container as ContainerIcon,
  PackageCheck,
  Truck,
  Lock,
  ChevronRight,
  Info,
} from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { listShipments, where } from "@/lib/db";
import type { Shipment } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, StageBadge, FragileBadge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/input";
import { Skeleton, EmptyState } from "@/components/ui/misc";
import { StatCard } from "@/components/portal/StatCard";
import { formatDate, isDnr } from "@/lib/utils";
import { stageOrder } from "@/lib/constants";

// Stages at which cargo is physically at (or leaving) the destination
// warehouse. Below 5 it has not arrived; "completed" has been handed over.
const IN_WAREHOUSE: Shipment["current_status"][] = ["clearance", "offloading", "delivery"];

interface ContainerBucket {
  cnt: string;
  label: string;
  shipments: Shipment[];
  itemCount: number;
}

function itemCountOf(s: Shipment): number {
  if (s.items?.length) {
    return s.items.reduce((n, it) => n + (Number(it.quantity) || 1), 0);
  }
  return 1; // air / RORO shipments are a single unit
}

function itemsLabel(s: Shipment): string {
  if (s.items?.length) {
    return s.items
      .map((it) => `${it.quantity && it.quantity > 1 ? `${it.quantity}× ` : ""}${it.description}`)
      .join(", ");
  }
  return s.item_category || s.vehicle_details || "Shipment cargo";
}

export default function OfficeInventoryPage() {
  const { user } = useAuth();
  const country = user?.assigned_country || "Nigeria";

  const [shipments, setShipments] = React.useState<Shipment[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [q, setQ] = React.useState("");
  const [view, setView] = React.useState<"warehouse" | "delivery" | "handed_over" | "all">(
    "warehouse"
  );

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

  // Only cargo that has reached the destination is warehouse stock. RORO is
  // excluded: a vehicle is not shelved stock and is monitored in Operations, so
  // counting it here too would double-count the same cargo across two screens.
  const arrived = React.useMemo(
    () =>
      shipments.filter(
        (s) => stageOrder(s.current_status) >= 5 && s.service_type !== "roro"
      ),
    [shipments]
  );

  const stats = React.useMemo(() => {
    const inWarehouse = arrived.filter((s) => IN_WAREHOUSE.includes(s.current_status));
    return {
      units: inWarehouse.reduce((n, s) => n + itemCountOf(s), 0),
      shipments: inWarehouse.length,
      containers: new Set(inWarehouse.map((s) => (s.container_number || "").trim()).filter(Boolean))
        .size,
      held: inWarehouse.filter((s) => isDnr(s)).length,
    };
  }, [arrived]);

  const filtered = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    return arrived.filter((s) => {
      if (view === "warehouse" && !IN_WAREHOUSE.includes(s.current_status)) return false;
      if (view === "delivery" && s.current_status !== "delivery") return false;
      if (view === "handed_over" && s.current_status !== "completed") return false;
      if (!term) return true;
      return (
        s.tracking_number?.toLowerCase().includes(term) ||
        s.customer_name?.toLowerCase().includes(term) ||
        s.container_number?.toLowerCase().includes(term) ||
        s.receiver?.full_name?.toLowerCase().includes(term) ||
        itemsLabel(s).toLowerCase().includes(term)
      );
    });
  }, [arrived, q, view]);

  // Group into containers — the unit warehouse staff actually work with.
  const buckets = React.useMemo<ContainerBucket[]>(() => {
    const map = new Map<string, ContainerBucket>();
    for (const s of filtered) {
      const cnt = (s.container_number || "").trim();
      const key = cnt || "__none__";
      if (!map.has(key)) {
        map.set(key, {
          cnt,
          label: cnt ? `CNT #${cnt}` : "No container assigned",
          shipments: [],
          itemCount: 0,
        });
      }
      const b = map.get(key)!;
      b.shipments.push(s);
      b.itemCount += itemCountOf(s);
    }
    return Array.from(map.values()).sort((a, b) => {
      // Unassigned last, otherwise natural container order.
      if (!a.cnt) return 1;
      if (!b.cnt) return -1;
      return a.cnt.localeCompare(b.cnt, undefined, { numeric: true });
    });
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-navy sm:text-3xl">
          Warehouse
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Cargo held at the {country} warehouse, grouped by container. Updates automatically as
          shipment stages change — nothing to enter by hand. Vehicles are tracked in{" "}
          <Link href="/office/operations" className="font-semibold text-gold-700 hover:underline">
            Operations
          </Link>
          .
        </p>
      </div>

      {/* Stock summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
        ) : (
          <>
            <StatCard label="Units in warehouse" value={stats.units} icon={Boxes} accent="navy" />
            <StatCard label="Shipments" value={stats.shipments} icon={PackageCheck} accent="blue" />
            <StatCard
              label="Containers"
              value={stats.containers}
              icon={ContainerIcon}
              accent="gold"
            />
            <StatCard
              label="On hold (DNR)"
              value={stats.held}
              icon={Lock}
              accent="orange"
              hint={stats.held > 0 ? "Do not release until head office clears" : undefined}
            />
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
            placeholder="Search tracking #, container, customer, or item…"
            className="pl-10"
            aria-label="Search warehouse"
          />
        </div>
        <Select
          value={view}
          onChange={(e) => setView(e.target.value as typeof view)}
          className="sm:w-60"
          aria-label="Filter warehouse view"
        >
          <option value="warehouse">In warehouse</option>
          <option value="delivery">Ready for delivery</option>
          <option value="handed_over">Handed over</option>
          <option value="all">All arrived cargo</option>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : buckets.length === 0 ? (
        <EmptyState
          icon={<Boxes className="h-6 w-6" />}
          title={arrived.length === 0 ? "Nothing in the warehouse yet" : "No matching cargo"}
          description={
            arrived.length === 0
              ? `Cargo appears here automatically once head office advances a container to a ${country} destination stage.`
              : "Try a different search or view."
          }
        />
      ) : (
        <div className="space-y-5">
          {buckets.map((b) => (
            <Card key={b.label} className="overflow-hidden">
              <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
                <CardTitle className="flex items-center gap-2">
                  <ContainerIcon className="h-4 w-4 text-gold" aria-hidden />
                  <span className="font-mono">{b.label}</span>
                </CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="muted">{b.shipments.length} shipment(s)</Badge>
                  <Badge variant="gold">{b.itemCount} unit(s)</Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y divide-border">
                  {b.shipments.map((s) => {
                    const held = isDnr(s);
                    return (
                      <li key={s.id}>
                        <Link
                          href={`/office/shipments/detail?id=${s.id}`}
                          className="flex items-start justify-between gap-4 px-5 py-4 transition-colors hover:bg-secondary/40 focus-ring"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-sm font-semibold text-navy">
                                {s.tracking_number}
                              </span>
                              <StageBadge status={s.current_status} />
                              {s.fragile && <FragileBadge note={s.fragile_note} />}
                              {held && (
                                <Badge variant="danger">
                                  <Lock className="mr-1 h-3 w-3" /> DNR
                                </Badge>
                              )}
                              {s.current_status === "delivery" && !held && (
                                <Badge variant="success">
                                  <Truck className="mr-1 h-3 w-3" /> Ready
                                </Badge>
                              )}
                            </div>

                            <p className="mt-1 text-sm text-ink">{itemsLabel(s)}</p>

                            <p className="mt-0.5 truncate text-xs text-ink-muted">
                              {s.receiver?.full_name || s.customer_name || "Recipient"}
                              {s.receiver?.phone ? ` · ${s.receiver.phone}` : ""}
                              {s.destination_city ? ` · ${s.destination_city}` : ""}
                            </p>
                          </div>

                          <div className="flex shrink-0 items-center gap-3">
                            <div className="text-right">
                              <p className="font-mono text-sm font-semibold text-navy">
                                {itemCountOf(s)}
                              </p>
                              <p className="text-[11px] uppercase tracking-wide text-ink-muted">
                                unit(s)
                              </p>
                              <p className="mt-0.5 text-[11px] text-ink-muted">
                                {formatDate(s.updated_at)}
                              </p>
                            </div>
                            <ChevronRight className="h-4 w-4 text-ink-muted" />
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="flex items-start gap-2.5 rounded-xl border border-border bg-secondary/40 p-4">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
        <p className="text-xs text-ink-muted">
          This list is generated from shipment records, so it always matches what head office and
          dispatch see. To move cargo out of the warehouse, advance its shipment stage from{" "}
          <Link href="/office/shipments" className="font-semibold text-gold-700 hover:underline">
            Shipments
          </Link>{" "}
          — you can select a whole container there and update it in one action.
        </p>
      </div>
    </div>
  );
}
