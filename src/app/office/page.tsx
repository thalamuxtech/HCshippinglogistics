"use client";

import * as React from "react";
import Link from "next/link";
import {
  FileCheck2,
  PackageOpen,
  Truck,
  CheckCircle2,
  ArrowRight,
  Package,
  MapPin,
} from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { listShipments, where, orderBy } from "@/lib/db";
import type { Shipment, ShipmentStatus } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StageBadge } from "@/components/ui/badge";
import { Skeleton, EmptyState } from "@/components/ui/misc";
import { formatDate } from "@/lib/utils";
import { stageOrder } from "@/lib/constants";

const DEST_STAGES: ShipmentStatus[] = ["clearance", "offloading", "delivery", "completed"];

function isThisMonth(ts?: { toDate: () => Date } | null): boolean {
  if (!ts?.toDate) return false;
  const d = ts.toDate();
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export default function OfficeDashboardPage() {
  const { user } = useAuth();
  const country = user?.assigned_country || "Nigeria";
  const [shipments, setShipments] = React.useState<Shipment[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const rows = await listShipments([
          where("destination_country", "==", country),
          orderBy("updated_at", "desc"),
        ]);
        if (active) setShipments(rows);
      } catch {
        // Fallback without orderBy in case index/field is missing.
        try {
          const rows = await listShipments([where("destination_country", "==", country)]);
          if (active) setShipments(rows);
        } catch {
          if (active) setShipments([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [country]);

  const destShipments = shipments.filter((s) => stageOrder(s.current_status) >= 5);

  const kpis = [
    {
      label: "Awaiting Clearance",
      value: destShipments.filter((s) => s.current_status === "clearance").length,
      icon: FileCheck2,
      color: "#F97316",
    },
    {
      label: "Offloading",
      value: destShipments.filter((s) => s.current_status === "offloading").length,
      icon: PackageOpen,
      color: "#06B6D4",
    },
    {
      label: "Out for Delivery",
      value: destShipments.filter((s) => s.current_status === "delivery").length,
      icon: Truck,
      color: "#14B8A6",
    },
    {
      label: "Completed This Month",
      value: destShipments.filter(
        (s) => s.current_status === "completed" && isThisMonth(s.updated_at)
      ).length,
      icon: CheckCircle2,
      color: "#22C55E",
    },
  ];

  const recent = [...destShipments]
    .sort((a, b) => (b.updated_at?.toMillis?.() ?? 0) - (a.updated_at?.toMillis?.() ?? 0))
    .slice(0, 8);

  return (
    <div className="space-y-8">
      <div>
        <span className="eyebrow">Destination Office</span>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-navy sm:text-3xl">
          {country} Operations
        </h1>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-muted">
          <MapPin className="h-4 w-4" /> Managing clearance, offloading & delivery for {country}.
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))
          : kpis.map((k) => {
              const Icon = k.icon;
              return (
                <Card key={k.label} className="overflow-hidden">
                  <CardContent className="flex items-center gap-4 p-5">
                    <span
                      className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                      style={{ backgroundColor: `${k.color}18`, color: k.color }}
                    >
                      <Icon className="h-6 w-6" />
                    </span>
                    <div>
                      <div className="font-mono text-3xl font-bold text-navy">{k.value}</div>
                      <div className="mt-0.5 text-xs font-medium uppercase tracking-wide text-ink-muted">
                        {k.label}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
      </div>

      {/* Recent list */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Recent Activity</CardTitle>
          <Link
            href="/office/shipments"
            className="inline-flex items-center gap-1 text-sm font-semibold text-gold-700 hover:text-gold-600 focus-ring rounded-md"
          >
            View all <ArrowRight className="h-4 w-4" />
          </Link>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-lg" />
              ))}
            </div>
          ) : recent.length === 0 ? (
            <EmptyState
              icon={<Package className="h-6 w-6" />}
              title="No destination-stage shipments"
              description={`Shipments arriving in ${country} for clearance, offloading, or delivery will appear here.`}
            />
          ) : (
            <ul className="divide-y divide-border">
              {recent.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/office/shipments/detail?id=${s.id}`}
                    className="flex items-center justify-between gap-4 py-3.5 transition-colors hover:bg-secondary/40 -mx-2 px-2 rounded-lg focus-ring"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-navy">
                          {s.tracking_number}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-ink-muted">
                        {s.customer_name || "—"} · {s.destination_city || s.destination_country}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <StageBadge status={s.current_status} />
                      <span className="hidden text-xs text-ink-muted sm:inline">
                        {formatDate(s.updated_at)}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
