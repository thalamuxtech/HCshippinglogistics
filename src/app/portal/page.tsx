"use client";

import * as React from "react";
import Link from "next/link";
import {
  Package,
  PackageCheck,
  Boxes,
  PackagePlus,
  Search,
  ArrowRight,
  Ship,
  Plane,
  Truck,
} from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { listShipmentsByCustomer } from "@/lib/db";
import { SERVICES } from "@/lib/constants";
import type { Shipment, ServiceType } from "@/lib/types";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StageBadge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Skeleton, EmptyState } from "@/components/ui/misc";
import { StageProgress } from "./_components/StageProgress";

const serviceIcon: Record<ServiceType, typeof Ship> = {
  sea: Ship,
  air: Plane,
  roro: Truck,
};

const accents = {
  navy: "bg-navy/5 text-navy",
  emerald: "bg-emerald-50 text-emerald-600",
  gold: "bg-gold/15 text-gold-700",
} as const;

function KpiCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  icon: typeof Package;
  accent: keyof typeof accents;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-white p-5 shadow-card">
      <span
        className={cn(
          "inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
          accents[accent]
        )}
      >
        <Icon className="h-6 w-6" />
      </span>
      <div>
        <p className="font-mono text-2xl font-bold text-navy">{value}</p>
        <p className="text-xs font-medium uppercase tracking-wider text-ink-muted">{label}</p>
      </div>
    </div>
  );
}

export default function PortalDashboard() {
  const { user } = useAuth();
  const [shipments, setShipments] = React.useState<Shipment[] | null>(null);

  React.useEffect(() => {
    if (!user) return;
    let active = true;
    listShipmentsByCustomer(user.id)
      .then((rows) => active && setShipments(rows))
      .catch(() => active && setShipments([]));
    return () => {
      active = false;
    };
  }, [user]);

  const firstName = user?.full_name?.trim().split(/\s+/)[0] ?? "there";

  const stats = React.useMemo(() => {
    const list = shipments ?? [];
    const active = list.filter((s) => s.current_status !== "completed").length;
    const completed = list.filter((s) => s.current_status === "completed").length;
    return { active, completed, total: list.length };
  }, [shipments]);

  const recent = (shipments ?? []).slice(0, 5);
  const loading = shipments === null;

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-navy sm:text-3xl">
            Welcome back, {firstName}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Track your shipments, review receipts, and place new orders.
          </p>
        </div>
        <div className="flex gap-3">
          <ButtonLink href="/portal/order" variant="gold">
            <PackagePlus className="h-4 w-4" /> New Order
          </ButtonLink>
          <ButtonLink href="/portal/shipments" variant="outline">
            <Search className="h-4 w-4" /> Track
          </ButtonLink>
        </div>
      </div>

      {/* KPI cards */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <KpiCard label="Active Shipments" value={stats.active} icon={Package} accent="navy" />
          <KpiCard
            label="Completed"
            value={stats.completed}
            icon={PackageCheck}
            accent="emerald"
          />
          <KpiCard label="Total Orders" value={stats.total} icon={Boxes} accent="gold" />
        </div>
      )}

      {/* Recent shipments */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Recent Shipments</CardTitle>
          {recent.length > 0 && (
            <Link
              href="/portal/shipments"
              className="inline-flex items-center gap-1 text-sm font-semibold text-gold-700 hover:text-gold-600 focus-ring rounded-md"
            >
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-24 w-full rounded-xl" />
              ))}
            </div>
          ) : recent.length === 0 ? (
            <EmptyState
              icon={<Package className="h-6 w-6" />}
              title="No shipments yet"
              description="Place your first order and it will appear here with live tracking."
              action={
                <ButtonLink href="/portal/order" variant="gold">
                  <PackagePlus className="h-4 w-4" /> Create your first order
                </ButtonLink>
              }
            />
          ) : (
            <ul className="space-y-3">
              {recent.map((s) => {
                const Icon = serviceIcon[s.service_type] ?? Package;
                return (
                  <li key={s.id}>
                    <Link
                      href={`/portal/shipments/${s.id}`}
                      className={cn(
                        "group block rounded-xl border border-border bg-white p-4 transition-all hover:-translate-y-0.5 hover:shadow-card focus-ring"
                      )}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-navy/5 text-navy">
                            <Icon className="h-5 w-5" />
                          </span>
                          <div>
                            <p className="font-mono text-sm font-semibold text-navy">
                              {s.tracking_number}
                            </p>
                            <p className="text-xs text-ink-muted">
                              {SERVICES[s.service_type].label} · {s.destination_country}
                              {s.destination_city ? `, ${s.destination_city}` : ""}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="hidden text-xs text-ink-muted sm:block">
                            {formatDate(s.created_at)}
                          </span>
                          <span className="font-mono text-sm font-semibold text-navy">
                            {formatCurrency(s.total_price, s.currency)}
                          </span>
                          <StageBadge status={s.current_status} />
                        </div>
                      </div>
                      <div className="mt-4">
                        <StageProgress status={s.current_status} />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
