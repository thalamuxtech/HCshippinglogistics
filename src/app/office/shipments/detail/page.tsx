"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Package,
  MapPin,
  User,
  Phone,
  Mail,
  ArrowRight,
  Clock,
  FileText,
} from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { getShipment, advanceStage, listStatusLogs, logNotification } from "@/lib/db";
import { sendStageUpdateEmail } from "@/lib/notify";
import type { Shipment, StatusLog, ShipmentStatus } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, StageBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/input";
import { PageLoader, EmptyState } from "@/components/ui/misc";
import { PaymentReceiptCard } from "@/components/portal/PaymentReceiptCard";
import { useToast } from "@/components/ui/toast";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { STAGE_MAP, stageOrder } from "@/lib/constants";

// Destination-office workflow: clearance -> offloading -> delivery -> completed.
const NEXT_STAGE: Partial<Record<ShipmentStatus, ShipmentStatus>> = {
  clearance: "offloading",
  offloading: "delivery",
  delivery: "completed",
};

function OfficeShipmentDetailPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get("id") ?? "";
  const { user } = useAuth();
  const toast = useToast();

  const [shipment, setShipment] = React.useState<Shipment | null>(null);
  const [logs, setLogs] = React.useState<StatusLog[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [notes, setNotes] = React.useState("");
  const [advancing, setAdvancing] = React.useState(false);

  const load = React.useCallback(async () => {
    const [s, l] = await Promise.all([getShipment(id), listStatusLogs(id)]);
    setShipment(s);
    setLogs(l);
  }, [id]);

  React.useEffect(() => {
    if (!user) return;
    let active = true;
    const assignedCountry = user.assigned_country || "Nigeria";
    (async () => {
      setLoading(true);
      try {
        const [s, l] = await Promise.all([getShipment(id), listStatusLogs(id)]);
        // Office staff may only view shipments for their assigned country
        // (Firestore rules also enforce this; this is for correct UX).
        const allowed = s && s.destination_country === assignedCountry ? s : null;
        if (active) {
          setShipment(allowed);
          setLogs(allowed ? l : []);
        }
      } catch {
        if (active) setShipment(null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id, user]);

  const next = shipment ? NEXT_STAGE[shipment.current_status] : undefined;
  const inDestinationFlow = shipment ? stageOrder(shipment.current_status) >= 5 : false;

  async function handleAdvance() {
    if (!shipment || !next || !user) return;
    if (!notes.trim()) {
      toast.error("Notes required", "Add a note describing this status update.");
      return;
    }
    setAdvancing(true);
    try {
      await advanceStage({
        shipmentId: shipment.id,
        status: next,
        notes: notes.trim(),
        updatedBy: user.id,
        updatedByName: user.full_name,
      });
      // Notify the customer of the transition.
      await sendStageUpdateEmail({
        shipmentId: shipment.id,
        customerId: shipment.customer_id,
        status: next,
        extraNote: notes.trim(),
      });
      await logNotification({
        customer_id: shipment.customer_id,
        shipment_id: shipment.id,
        channel: "email",
        type: "stage_update",
        subject: `Shipment ${shipment.tracking_number} → ${STAGE_MAP[next].label}`,
        status: "sent",
      });
      toast.success("Status updated", `Advanced to ${STAGE_MAP[next].label}.`);
      setNotes("");
      await load();
    } catch {
      toast.error("Update failed", "Could not advance the shipment. Please try again.");
    } finally {
      setAdvancing(false);
    }
  }


  if (loading) return <PageLoader label="Loading shipment…" />;

  if (!shipment) {
    return (
      <EmptyState
        icon={<Package className="h-6 w-6" />}
        title="Shipment not found"
        description="This shipment may have been removed or is not in your assigned country."
        action={
          <Button variant="outline" onClick={() => router.push("/office/shipments")}>
            <ArrowLeft className="h-4 w-4" /> Back to shipments
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/office/shipments"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-navy focus-ring rounded-md"
      >
        <ArrowLeft className="h-4 w-4" /> Back to shipments
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-2xl font-extrabold tracking-tight text-navy">
              {shipment.tracking_number}
            </h1>
            <StageBadge status={shipment.current_status} />
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            {STAGE_MAP[shipment.current_status]?.label}
          </p>
        </div>
        <div className="text-right">
          <div className="font-mono text-xl font-bold text-navy">
            {formatCurrency(shipment.total_price, shipment.currency)}
          </div>
          <Badge variant="muted" className="mt-1 uppercase">
            {shipment.service_type}
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column: details + workflow */}
        <div className="space-y-6 lg:col-span-2">
          {/* Details */}
          <Card>
            <CardHeader>
              <CardTitle>Shipment Details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Detail icon={User} label="Customer" value={shipment.customer_name} />
              <Detail icon={Phone} label="Phone" value={shipment.customer_phone} />
              <Detail icon={Mail} label="Email" value={shipment.customer_email} />
              <Detail
                icon={MapPin}
                label="Destination"
                value={[shipment.destination_city, shipment.destination_country]
                  .filter(Boolean)
                  .join(", ")}
              />
              <Detail
                icon={MapPin}
                label="Delivery Address"
                value={shipment.delivery_address}
                full
              />
              {shipment.notes && (
                <Detail icon={FileText} label="Notes" value={shipment.notes} full />
              )}
            </CardContent>
          </Card>

          {/* Status update workflow */}
          <Card>
            <CardHeader>
              <CardTitle>Status Update</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!inDestinationFlow ? (
                <p className="rounded-lg border border-border bg-secondary/40 p-4 text-sm text-ink-muted">
                  This shipment is still in USA / transit stages. Destination-office updates begin
                  at the Clearance stage.
                </p>
              ) : next ? (
                <>
                  <div className="flex items-center gap-2 text-sm text-ink-muted">
                    <StageBadge status={shipment.current_status} />
                    <ArrowRight className="h-4 w-4" />
                    <StageBadge status={next} />
                  </div>
                  <div>
                    <Label htmlFor="notes" required>
                      Update notes
                    </Label>
                    <Textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder={`Describe the ${STAGE_MAP[next].short} update (mandatory)…`}
                    />
                  </div>
                  <Button
                    onClick={handleAdvance}
                    loading={advancing}
                    disabled={!notes.trim()}
                    className="w-full sm:w-auto"
                  >
                    Advance to {STAGE_MAP[next].short} <ArrowRight className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">
                  This shipment is completed. No further status updates required.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Status Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <EmptyState
                  icon={<Clock className="h-6 w-6" />}
                  title="No status history yet"
                  description="Updates you post will appear here."
                />
              ) : (
                <ol className="relative space-y-5 border-l border-border pl-6">
                  {logs.map((log) => {
                    const meta = STAGE_MAP[log.status];
                    return (
                      <li key={log.id} className="relative">
                        <span
                          className="absolute -left-[27px] top-1 h-3 w-3 rounded-full ring-4 ring-white"
                          style={{ backgroundColor: meta?.color ?? "#94A3B8" }}
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <StageBadge status={log.status} />
                          <span className="text-xs text-ink-muted">
                            {formatDateTime(log.created_at)}
                          </span>
                        </div>
                        {log.notes && <p className="mt-1 text-sm text-ink">{log.notes}</p>}
                        {log.updated_by_name && (
                          <p className="mt-0.5 text-xs text-ink-muted">by {log.updated_by_name}</p>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column: receipt action */}
        <div className="space-y-6">
          {user && (
            <PaymentReceiptCard
              shipment={shipment}
              actor={{ id: user.id, full_name: user.full_name, role: "nigeria_office" }}
              onChanged={load}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Detail({
  icon: Icon,
  label,
  value,
  full,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value?: string;
  full?: boolean;
}) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink-muted">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <p className="mt-1 text-sm text-navy">{value || "—"}</p>
    </div>
  );
}


export default function Page() {
  return (
    <React.Suspense fallback={<PageLoader label="Loading…" />}>
      <OfficeShipmentDetailPageInner />
    </React.Suspense>
  );
}
