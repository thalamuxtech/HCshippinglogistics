"use client";

import * as React from "react";
import Link from "next/link";
import { Package, Search, PackagePlus, Ship, Plane, Truck, ArrowRight } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { listShipmentsByCustomer } from "@/lib/db";
import { SERVICES, STAGES } from "@/lib/constants";
import type { Shipment, ServiceType, ShipmentStatus } from "@/lib/types";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { StageBadge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/input";
import { ButtonLink } from "@/components/ui/button";
import { Skeleton, EmptyState } from "@/components/ui/misc";
import { StageProgress } from "../_components/StageProgress";

const serviceIcon: Record<ServiceType, typeof Ship> = {
  sea: Ship,
  air: Plane,
  roro: Truck,
};

const ALL = "all";

export default function ShipmentsPage() {
  const { user } = useAuth();
  const [shipments, setShipments] = React.useState<Shipment[] | null>(null);
  const [statusFilter, setStatusFilter] = React.useState<string>(ALL);
  const [search, setSearch] = React.useState("");

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

  const loading = shipments === null;

  const filtered = React.useMemo(() => {
    let list = shipments ?? [];
    if (statusFilter !== ALL)
      list = list.filter((s) => s.current_status === (statusFilter as ShipmentStatus));
    const q = search.trim().toLowerCase();
    if (q)
      list = list.filter(
        (s) =>
          s.tracking_number.toLowerCase().includes(q) ||
          s.destination_country.toLowerCase().includes(q) ||
          (s.destination_city ?? "").toLowerCase().includes(q)
      );
    return list;
  }, [shipments, statusFilter, search]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow">My Shipments</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-navy sm:text-3xl">
            All shipments
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Search, filter, and open any shipment for full tracking.
          </p>
        </div>
        <ButtonLink href="/portal/order" variant="gold">
          <PackagePlus className="h-4 w-4" /> New Order
        </ButtonLink>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <Input
            className="pl-9"
            placeholder="Search by tracking number or destination…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search shipments"
          />
        </div>
        <Select
          className="sm:w-56"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
        >
          <option value={ALL}>All statuses</option>
          {STAGES.map((s) => (
            <option key={s.key} value={s.key}>
              {s.short}
            </option>
          ))}
        </Select>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      ) : (shipments ?? []).length === 0 ? (
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
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Search className="h-6 w-6" />}
          title="No matching shipments"
          description="Try a different search term or clear the status filter."
        />
      ) : (
        <div className="grid gap-4">
          {filtered.map((s) => {
            const Icon = serviceIcon[s.service_type] ?? Package;
            return (
              <Link key={s.id} href={`/portal/shipments/detail?id=${s.id}`} className="group block focus-ring rounded-xl">
                <Card className="transition-all group-hover:-translate-y-0.5 group-hover:shadow-premium">
                  <CardContent className="p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-navy/5 text-navy">
                          <Icon className="h-5 w-5" />
                        </span>
                        <div>
                          <p className="font-mono text-sm font-semibold text-navy">
                            {s.tracking_number}
                          </p>
                          <p className="text-xs text-ink-muted">
                            {SERVICES[s.service_type].label} · {s.destination_country}
                            {s.destination_city ? `, ${s.destination_city}` : ""} ·{" "}
                            {formatDate(s.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-mono text-sm font-semibold text-navy">
                          {formatCurrency(s.total_price, s.currency)}
                        </span>
                        <StageBadge status={s.current_status} />
                        <ArrowRight
                          className={cn(
                            "h-4 w-4 text-ink-muted transition-transform group-hover:translate-x-1"
                          )}
                        />
                      </div>
                    </div>
                    <div className="mt-4">
                      <StageProgress status={s.current_status} />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
