"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Ship,
  Plane,
  Truck,
  Package,
  MapPin,
  Download,
  ReceiptText,
  RotateCcw,
  FileWarning,
  Home,
} from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  getShipment,
  listStatusLogs,
  listReceiptsForShipment,
} from "@/lib/db";
import { STAGES, STAGE_MAP, stageOrder, SERVICES, RORO_LINES, VEHICLE_CLASSES } from "@/lib/constants";
import type {
  Shipment,
  StatusLog,
  DigitalReceipt,
  ServiceType,
} from "@/lib/types";
import { formatCurrency, formatDate, formatDateTime, cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StageBadge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { PageLoader, EmptyState } from "@/components/ui/misc";

const serviceIcon: Record<ServiceType, typeof Ship> = {
  sea: Ship,
  air: Plane,
  roro: Truck,
};

export default function ShipmentDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const { user } = useAuth();
  const router = useRouter();

  const [shipment, setShipment] = React.useState<Shipment | null | undefined>(undefined);
  const [logs, setLogs] = React.useState<StatusLog[]>([]);
  const [receipts, setReceipts] = React.useState<DigitalReceipt[]>([]);

  React.useEffect(() => {
    if (!id || !user) return;
    let active = true;
    (async () => {
      try {
        const s = await getShipment(id);
        if (!active) return;
        // Guard: only the owning customer may view.
        if (!s || s.customer_id !== user.id) {
          setShipment(null);
          return;
        }
        setShipment(s);
        const [l, r] = await Promise.all([
          listStatusLogs(id),
          listReceiptsForShipment(id),
        ]);
        if (!active) return;
        setLogs(l);
        setReceipts(r);
      } catch {
        if (active) setShipment(null);
      }
    })();
    return () => {
      active = false;
    };
  }, [id, user]);

  if (shipment === undefined) return <PageLoader label="Loading shipment…" />;

  if (shipment === null) {
    return (
      <EmptyState
        icon={<FileWarning className="h-6 w-6" />}
        title="Shipment not found"
        description="This shipment doesn't exist or you don't have access to it."
        action={
          <ButtonLink href="/portal/shipments" variant="outline">
            <ArrowLeft className="h-4 w-4" /> Back to shipments
          </ButtonLink>
        }
      />
    );
  }

  const Icon = serviceIcon[shipment.service_type] ?? Package;
  const current = stageOrder(shipment.current_status);

  // Latest log per stage (logs come newest-first).
  const logByStatus = new Map<string, StatusLog>();
  for (const log of logs) {
    if (!logByStatus.has(log.status)) logByStatus.set(log.status, log);
  }

  function handleReorder() {
    if (!shipment) return;
    const payload = {
      service_type: shipment.service_type,
      items: shipment.items,
      destination_country: shipment.destination_country,
      destination_city: shipment.destination_city,
      weight: shipment.weight,
      dimensions: shipment.dimensions,
      shipping_line: shipment.shipping_line,
      vehicle_class: shipment.vehicle_class,
      vehicle_details: shipment.vehicle_details,
    };
    try {
      sessionStorage.setItem("hc_reorder", JSON.stringify(payload));
    } catch {
      /* ignore */
    }
    router.push("/portal/order");
  }

  return (
    <div className="space-y-8">
      {/* Back + header */}
      <div>
        <Link
          href="/portal/shipments"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-navy focus-ring rounded-md"
        >
          <ArrowLeft className="h-4 w-4" /> All shipments
        </Link>
        <div className="mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="flex items-center gap-4">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-navy text-gold shadow-premium">
              <Icon className="h-7 w-7" />
            </span>
            <div>
              <h1 className="font-mono text-xl font-bold text-navy sm:text-2xl">
                {shipment.tracking_number}
              </h1>
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-ink-muted">
                <MapPin className="h-3.5 w-3.5" />
                {SERVICES[shipment.service_type].label} · {shipment.destination_country}
                {shipment.destination_city ? `, ${shipment.destination_city}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StageBadge status={shipment.current_status} />
            <Button variant="outline" onClick={handleReorder}>
              <RotateCcw className="h-4 w-4" /> Re-order
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* ── Timeline ── */}
        <Card>
          <CardHeader>
            <CardTitle>Tracking timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="relative">
              {STAGES.map((stage, i) => {
                const done = stage.order < current;
                const isCurrent = stage.order === current;
                const future = stage.order > current;
                const log = logByStatus.get(stage.key);
                const isLast = i === STAGES.length - 1;
                return (
                  <li key={stage.key} className="relative flex gap-4 pb-8 last:pb-0">
                    {/* connector line */}
                    {!isLast && (
                      <span
                        className="absolute left-[15px] top-8 h-full w-0.5"
                        style={{
                          backgroundColor: done ? stage.color : "#E2E8F0",
                        }}
                        aria-hidden
                      />
                    )}
                    {/* node */}
                    <span
                      className={cn(
                        "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                        isCurrent && "animate-pulse"
                      )}
                      style={{
                        backgroundColor: done || isCurrent ? stage.color : "#F1F5F9",
                        color: done || isCurrent ? "#fff" : "#94A3B8",
                        boxShadow: isCurrent ? `0 0 0 4px ${stage.color}33` : undefined,
                      }}
                    >
                      {done ? <Check className="h-4 w-4" /> : stage.order}
                    </span>
                    {/* content */}
                    <div className={cn("min-w-0 flex-1", future && "opacity-50")}>
                      <div className="flex flex-wrap items-center gap-2">
                        <p
                          className={cn(
                            "text-sm font-semibold",
                            isCurrent ? "text-navy" : "text-navy/90"
                          )}
                        >
                          {stage.label}
                        </p>
                        {isCurrent && (
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white"
                            style={{ backgroundColor: stage.color }}
                          >
                            Current
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-ink-muted">{stage.description}</p>
                      {log && (
                        <div className="mt-2 rounded-lg border border-border bg-surface px-3 py-2">
                          <p className="font-mono text-[11px] text-ink-muted">
                            {formatDateTime(log.created_at)}
                          </p>
                          {log.notes && (
                            <p className="mt-0.5 text-xs text-navy">{log.notes}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>

        {/* ── Sidebar: details, items, receipts ── */}
        <div className="space-y-6">
          {/* Details */}
          <Card>
            <CardHeader>
              <CardTitle>Shipment details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Detail label="Service" value={SERVICES[shipment.service_type].label} />
              <Detail label="Status" value={STAGE_MAP[shipment.current_status].label} />
              <Detail
                label="Destination"
                value={`${shipment.destination_country}${
                  shipment.destination_city ? `, ${shipment.destination_city}` : ""
                }`}
              />
              {shipment.service_type === "air" && (
                <>
                  <Detail label="Weight" value={`${shipment.weight ?? 0} lb`} />
                  {shipment.dimensional_weight ? (
                    <Detail
                      label="Dim. weight"
                      value={`${shipment.dimensional_weight} lb`}
                    />
                  ) : null}
                </>
              )}
              {shipment.service_type === "roro" && (
                <>
                  {shipment.shipping_line && (
                    <Detail
                      label="Shipping line"
                      value={RORO_LINES[shipment.shipping_line].label}
                    />
                  )}
                  {shipment.vehicle_class && (
                    <Detail
                      label="Vehicle class"
                      value={VEHICLE_CLASSES[shipment.vehicle_class].label}
                    />
                  )}
                  {shipment.vehicle_details && (
                    <Detail label="Vehicle" value={shipment.vehicle_details} />
                  )}
                </>
              )}
              {shipment.door_to_door && (
                <Detail
                  label="Pickup"
                  value={
                    <span className="inline-flex items-center gap-1">
                      <Home className="h-3.5 w-3.5" /> Door-to-door
                    </span>
                  }
                />
              )}
              {typeof shipment.declared_value === "number" && shipment.declared_value > 0 && (
                <Detail
                  label="Declared value"
                  value={formatCurrency(shipment.declared_value, shipment.currency)}
                />
              )}
              <Detail label="Placed" value={formatDate(shipment.created_at)} />
              <div className="flex items-center justify-between border-t border-border pt-3">
                <span className="font-semibold text-navy">Total</span>
                <span className="font-mono text-base font-bold text-navy">
                  {shipment.total_price > 0
                    ? formatCurrency(shipment.total_price, shipment.currency)
                    : "Quoted separately"}
                </span>
              </div>
              {shipment.notes && (
                <div className="border-t border-border pt-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-ink-muted">
                    Notes
                  </p>
                  <p className="mt-1 text-sm text-navy">{shipment.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Items (sea) */}
          {shipment.items && shipment.items.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Items</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="divide-y divide-border">
                  {shipment.items.map((it, i) => (
                    <li
                      key={`${it.price_list_id}-${i}`}
                      className="flex items-center justify-between gap-2 py-2.5 text-sm"
                    >
                      <span className="min-w-0">
                        <span className="text-navy">
                          {it.quantity}× {it.description}
                        </span>
                        {it.dimensions && (
                          <span className="block text-xs text-ink-muted">{it.dimensions}</span>
                        )}
                      </span>
                      <span className="font-mono font-semibold text-navy">
                        {formatCurrency(it.line_total)}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Receipts */}
          <Card>
            <CardHeader>
              <CardTitle>Receipts</CardTitle>
            </CardHeader>
            <CardContent>
              {receipts.length === 0 ? (
                <p className="rounded-lg bg-surface px-4 py-6 text-center text-sm text-ink-muted">
                  No receipts issued yet. They appear here once your shipment is inspected.
                </p>
              ) : (
                <ul className="space-y-2">
                  {receipts.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <ReceiptText className="h-4 w-4 shrink-0 text-navy" />
                        <span className="min-w-0">
                          <span className="block truncate font-mono text-xs font-semibold text-navy">
                            {r.receipt_number}
                          </span>
                          <span className="block text-xs text-ink-muted">
                            {formatCurrency(r.amount, r.currency)} ·{" "}
                            {formatDate(r.generated_at)}
                          </span>
                        </span>
                      </span>
                      {r.pdf_url ? (
                        <ButtonLink
                          href={r.pdf_url}
                          external
                          variant="outline"
                          size="sm"
                          aria-label={`Download receipt ${r.receipt_number}`}
                        >
                          <Download className="h-4 w-4" /> PDF
                        </ButtonLink>
                      ) : (
                        <span className="text-xs text-ink-muted">Pending</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-ink-muted">{label}</span>
      <span className="text-right font-medium text-navy">{value}</span>
    </div>
  );
}
