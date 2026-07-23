"use client";

import * as React from "react";
import Link from "next/link";
import { Boxes, Search, Warehouse, Ship, MapPin } from "lucide-react";
import { listAllShipments } from "@/lib/db";
import type { Shipment } from "@/lib/types";
import { STAGE_MAP, DESTINATION_COUNTRIES, stageOrder } from "@/lib/constants";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { StageBadge } from "@/components/ui/badge";
import { Skeleton, EmptyState } from "@/components/ui/misc";
import { formatDate } from "@/lib/utils";
import { StatCard } from "@/components/portal/StatCard";
import type { Timestamp } from "firebase/firestore";

function tsToDate(ts?: Timestamp | null): Date | null {
  if (!ts) return null;
  try {
    return ts.toDate();
  } catch {
    return null;
  }
}

// Location derived from the shipment's current stage.
function locationOf(s: Shipment): "usa" | "transit" | "destination" | "delivered" {
  if (s.current_status === "completed") return "delivered";
  const o = stageOrder(s.current_status);
  if (o <= 3) return "usa";
  if (o === 4) return "transit";
  return "destination";
}

const LOC_LABEL: Record<string, string> = {
  usa: "USA warehouse",
  transit: "In transit",
  destination: "Destination",
  delivered: "Delivered",
};

export default function AdminInventoryPage() {
  const [loading, setLoading] = React.useState(true);
  const [shipments, setShipments] = React.useState<Shipment[]>([]);
  const [error, setError] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [loc, setLoc] = React.useState<"all" | "usa" | "transit" | "destination">("all");
  const [country, setCountry] = React.useState<string>("all");

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

  // In-warehouse = not yet delivered.
  const active = React.useMemo(() => shipments.filter((s) => s.current_status !== "completed"), [shipments]);

  const counts = React.useMemo(() => {
    let usa = 0,
      transit = 0,
      dest = 0;
    for (const s of active) {
      const l = locationOf(s);
      if (l === "usa") usa++;
      else if (l === "transit") transit++;
      else if (l === "destination") dest++;
    }
    return { usa, transit, dest };
  }, [active]);

  const rows = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    return active.filter((s) => {
      const l = locationOf(s);
      if (loc !== "all" && l !== loc) return false;
      if (country !== "all" && s.destination_country !== country) return false;
      if (!term) return true;
      return (
        s.tracking_number?.toLowerCase().includes(term) ||
        s.customer_name?.toLowerCase().includes(term) ||
        s.items?.some((it) => it.description?.toLowerCase().includes(term))
      );
    });
  }, [active, q, loc, country]);

  function itemsSummary(s: Shipment): string {
    if (s.items && s.items.length) {
      const n = s.items.reduce((a, it) => a + it.quantity, 0);
      return `${n} item${n !== 1 ? "s" : ""}`;
    }
    if (s.service_type === "air") return s.weight ? `${s.weight} lbs (air)` : "Air freight";
    if (s.service_type === "roro") return s.vehicle_details || "Vehicle (RORO)";
    return "Shipment";
  }

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="USA warehouse" value={loading ? "-" : counts.usa} icon={Warehouse} accent="navy" />
        <StatCard label="In transit" value={loading ? "-" : counts.transit} icon={Ship} accent="blue" />
        <StatCard label="At destination" value={loading ? "-" : counts.dest} icon={MapPin} accent="gold" />
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search tracking #, customer, or item…"
              className="pl-9"
              aria-label="Search inventory"
            />
          </div>
          <Select value={loc} onChange={(e) => setLoc(e.target.value as typeof loc)} aria-label="Filter by location" className="sm:w-44">
            <option value="all">All locations</option>
            <option value="usa">USA warehouse</option>
            <option value="transit">In transit</option>
            <option value="destination">Destination</option>
          </Select>
          <Select value={country} onChange={(e) => setCountry(e.target.value)} aria-label="Filter by country" className="sm:w-40">
            <option value="all">All countries</option>
            {DESTINATION_COUNTRIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="p-4">
            <EmptyState icon={<Boxes className="h-6 w-6" />} title="Could not load inventory" description="Please refresh to try again." />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={<Boxes className="h-6 w-6" />}
              title="Nothing in inventory"
              description="Active shipments (not yet delivered) appear here, grouped by where they are."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50 text-left text-xs uppercase tracking-wide text-ink-muted">
                  <th className="px-4 py-3 font-semibold">Tracking #</th>
                  <th className="px-4 py-3 font-semibold">Contents</th>
                  <th className="px-4 py-3 font-semibold">Customer</th>
                  <th className="px-4 py-3 font-semibold">Location</th>
                  <th className="px-4 py-3 font-semibold">Destination</th>
                  <th className="px-4 py-3 font-semibold">Stage</th>
                  <th className="px-4 py-3 font-semibold">Received</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id} className="border-b border-border last:border-0 hover:bg-secondary/40">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/shipments/detail?id=${s.id}`}
                        className="font-mono text-xs font-semibold text-navy hover:text-gold-700 focus-ring"
                      >
                        {s.tracking_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink">{itemsSummary(s)}</td>
                    <td className="px-4 py-3">
                      <div className="max-w-[160px] truncate text-ink">{s.customer_name || "-"}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-navy">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: STAGE_MAP[s.current_status]?.color }}
                        />
                        {LOC_LABEL[locationOf(s)]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink">
                      {s.destination_country}
                      {s.destination_city ? `, ${s.destination_city}` : ""}
                    </td>
                    <td className="px-4 py-3">
                      <StageBadge status={s.current_status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-muted">
                      {formatDate(tsToDate(s.created_at))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {!loading && !error && rows.length > 0 && (
        <p className="px-1 text-xs text-ink-muted">
          {rows.length} item{rows.length !== 1 ? "s" : ""} in inventory (excludes delivered).
        </p>
      )}
    </div>
  );
}
