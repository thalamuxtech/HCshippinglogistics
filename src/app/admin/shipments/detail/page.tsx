"use client";

import * as React from "react";
import { PageLoader } from "@/components/ui/misc";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Package,
  User,
  MapPin,
  Ship,
  Mail,
  Send,
  History,
  Container,
  Lock,
  LockOpen,
  Pencil,
  Trash2,
  Truck,
  Warehouse,
  UserCheck,
} from "lucide-react";
import {
  getShipment,
  listStatusLogs,
  advanceStage,
  logNotification,
  logActivity,
  updateShipment,
  listUsers,
  deleteShipment,
  planDeleteShipment,
  type DeleteShipmentPlan,
} from "@/lib/db";
import { sendStageUpdateEmail } from "@/lib/notify";
import type { Shipment, StatusLog, ShipmentStatus, AppUser } from "@/lib/types";
import { STAGES, STAGE_MAP, SERVICES, stageOrder } from "@/lib/constants";
import { useAuth } from "@/components/providers/AuthProvider";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea, Label } from "@/components/ui/input";
import { StageBadge, Badge } from "@/components/ui/badge";
import { Skeleton, EmptyState } from "@/components/ui/misc";
import { PaymentReceiptCard } from "@/components/portal/PaymentReceiptCard";
import { ConfirmDeleteModal } from "@/components/portal/ConfirmDeleteModal";
import { EditShipmentModal } from "@/components/portal/EditShipmentModal";
import { useToast } from "@/components/ui/toast";
import { formatCurrency, formatDateTime, isDnr, containerLabel } from "@/lib/utils";
import type { Timestamp } from "firebase/firestore";

function tsToDate(ts?: Timestamp | null): Date | null {
  if (!ts) return null;
  try {
    return ts.toDate();
  } catch {
    return null;
  }
}

function AdminShipmentDetailPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get("id") ?? "";
  const { user } = useAuth();
  const toast = useToast();

  const [loading, setLoading] = React.useState(true);
  const [shipment, setShipment] = React.useState<Shipment | null>(null);
  const [logs, setLogs] = React.useState<StatusLog[]>([]);

  const [targetStage, setTargetStage] = React.useState<ShipmentStatus>("collection");
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [sending, setSending] = React.useState(false);

  const [dispatchers, setDispatchers] = React.useState<AppUser[]>([]);
  const [assignee, setAssignee] = React.useState<string>("");
  const [assigning, setAssigning] = React.useState(false);

  const [cnt, setCnt] = React.useState<string>("");
  const [cntDate, setCntDate] = React.useState<string>("");
  const [savingCnt, setSavingCnt] = React.useState(false);
  const [savingDnr, setSavingDnr] = React.useState(false);

  // Edit / delete
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [delPlan, setDelPlan] = React.useState<DeleteShipmentPlan | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const load = React.useCallback(async () => {
    const [s, l, disp] = await Promise.all([
      getShipment(id),
      listStatusLogs(id),
      listUsers("dispatcher"),
    ]);
    setShipment(s);
    setLogs(l);
    setDispatchers(disp.filter((d) => d.is_active !== false));
    if (s) {
      setTargetStage(s.current_status);
      setAssignee(s.assigned_dispatcher_id || "");
      setCnt(s.container_number || "");
      setCntDate(s.container_shipped_on || "");
    }
  }, [id]);

  async function handleSaveEdit(patch: Partial<Shipment>) {
    if (!shipment || !user) return;
    await updateShipment(shipment.id, patch);
    await logActivity({
      actor_id: user.id,
      actor_name: user.full_name,
      actor_role: "admin",
      action: "edited shipment record",
      target: shipment.tracking_number,
      meta: { shipment_id: shipment.id, fields: Object.keys(patch) },
    });
    await load();
    toast.success("Shipment updated", "The record has been saved.");
  }

  // Counts are fetched when the dialog OPENS (not on page load) so the warning
  // reflects the state at the moment of the decision.
  async function openDelete() {
    if (!shipment) return;
    setDeleteOpen(true);
    setDelPlan(null);
    try {
      setDelPlan(await planDeleteShipment(shipment.id));
    } catch {
      // Leave the plan null: the dialog still works, just without counts.
    }
  }

  async function handleDeleteShipment() {
    if (!shipment || !user) return;
    setDeleting(true);
    const tracking = shipment.tracking_number;
    try {
      await deleteShipment(shipment.id);
      await logActivity({
        actor_id: user.id,
        actor_name: user.full_name,
        actor_role: "admin",
        action: "deleted shipment",
        target: tracking,
        meta: {
          shipment_id: shipment.id,
          customer_id: shipment.customer_id,
          container_number: shipment.container_number ?? null,
        },
      });
      toast.success("Shipment deleted", `${tracking} has been permanently removed.`);
      router.push("/admin/shipments");
    } catch {
      toast.error("Delete failed", "Could not delete the shipment. Please try again.");
      setDeleting(false);
    }
  }

  async function handleSaveContainer() {
    if (!shipment || !user) return;
    setSavingCnt(true);
    try {
      const value = cnt.trim();
      await updateShipment(shipment.id, {
        container_number: value || null,
        container_shipped_on: value ? cntDate || null : null,
      });
      await logActivity({
        actor_id: user.id,
        actor_name: user.full_name,
        actor_role: "admin",
        action: value ? `assigned container CNT #${value}` : "cleared container",
        target: shipment.tracking_number,
        meta: { shipment_id: shipment.id, container_number: value || null },
      });
      await load();
      toast.success(
        value ? `Container ${containerLabel(value)} saved` : "Container cleared",
        value ? "It now shows on the invoice and the customer's shipment." : undefined
      );
    } catch {
      toast.error("Save failed", "Could not update the container.");
    } finally {
      setSavingCnt(false);
    }
  }

  async function handleSetDnr(next: boolean | null) {
    if (!shipment || !user) return;
    setSavingDnr(true);
    try {
      // dnr_override: null follows payment; true/false is a manual lock.
      const effective =
        next === true ? true : next === false ? false : (shipment.payment_status || "unpaid") !== "paid";
      const patch: Record<string, unknown> = { dnr_override: next, dnr: effective };
      // Clearing the hold resolves any pending dispatcher release request.
      if (!effective && shipment.dnr_release_requested) {
        patch.dnr_release_requested = false;
        patch.dnr_release_requested_by = null;
        patch.dnr_release_requested_by_name = null;
        patch.dnr_release_requested_at = null;
        patch.dnr_release_note = null;
      }
      await updateShipment(shipment.id, patch);
      await logActivity({
        actor_id: user.id,
        actor_name: user.full_name,
        actor_role: "admin",
        action:
          next === true
            ? "set Do-Not-Release hold"
            : next === false
            ? "released hold (allow release)"
            : "reset release to follow payment",
        target: shipment.tracking_number,
        meta: { shipment_id: shipment.id, dnr: effective },
      });
      await load();
      toast.success(effective ? "Do-Not-Release is ON" : "Release allowed");
    } catch {
      toast.error("Update failed", "Could not change the release status.");
    } finally {
      setSavingDnr(false);
    }
  }

  async function handleAssignDispatcher() {
    if (!shipment || !user) return;
    setAssigning(true);
    try {
      await updateShipment(shipment.id, { assigned_dispatcher_id: assignee || null });
      const name = dispatchers.find((d) => d.id === assignee)?.full_name;
      await logActivity({
        actor_id: user.id,
        actor_name: user.full_name,
        actor_role: "admin",
        action: assignee ? "assigned dispatcher" : "unassigned dispatcher",
        target: shipment.tracking_number,
        meta: { shipment_id: shipment.id, dispatcher_id: assignee || null },
      });
      await load();
      toast.success(
        assignee ? "Dispatcher assigned" : "Dispatcher removed",
        assignee ? `${name} will see this job.` : undefined
      );
    } catch {
      toast.error("Assignment failed", "Could not update the assigned dispatcher.");
    } finally {
      setAssigning(false);
    }
  }

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await load();
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [load]);

  async function handleAdvance() {
    if (!shipment || !user) return;
    setSaving(true);
    try {
      await advanceStage({
        shipmentId: shipment.id,
        status: targetStage,
        notes: notes.trim() || undefined,
        updatedBy: user.id,
        updatedByName: user.full_name,
      });
      await logActivity({
        actor_id: user.id,
        actor_name: user.full_name,
        actor_role: "admin",
        action: `set stage to ${STAGE_MAP[targetStage].short}`,
        target: shipment.tracking_number,
        meta: { shipment_id: shipment.id, status: targetStage },
      });
      setNotes("");
      await load();
      toast.success("Stage updated", `Shipment is now at ${STAGE_MAP[targetStage].label}.`);
    } catch {
      toast.error("Update failed", "Could not update the shipment stage.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSendEmail() {
    if (!shipment || !user) return;
    setSending(true);
    try {
      const res = await sendStageUpdateEmail({
        shipmentId: shipment.id,
        customerId: shipment.customer_id,
        status: shipment.current_status,
        extraNote: notes.trim() || undefined,
      });
      await logNotification({
        customer_id: shipment.customer_id,
        shipment_id: shipment.id,
        channel: "email",
        type: "stage_update",
        subject: `Update: ${STAGE_MAP[shipment.current_status].label}`,
        status: res.ok ? "sent" : "failed",
      });
      await logActivity({
        actor_id: user.id,
        actor_name: user.full_name,
        actor_role: "admin",
        action: "sent stage update email",
        target: shipment.tracking_number,
        meta: { shipment_id: shipment.id },
      });
      if (res.ok) toast.success("Email sent", "Customer notified of the current stage.");
      else toast.info("Email queued", "Notification logged; delivery pending.");
    } catch {
      toast.error("Send failed", "Could not send the update email.");
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-40" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-64 lg:col-span-2" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!shipment) {
    return (
      <EmptyState
        icon={<Package className="h-6 w-6" />}
        title="Shipment not found"
        description="This shipment may have been removed or the link is invalid."
        action={
          <Link href="/admin/shipments" className="text-sm font-semibold text-gold-700 hover:underline">
            Back to shipments
          </Link>
        }
      />
    );
  }

  const s = shipment;

  return (
    <div className="space-y-6">
      <Link
        href="/admin/shipments"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-navy focus-ring"
      >
        <ArrowLeft className="h-4 w-4" /> Back to shipments
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="font-mono text-xl font-bold text-navy">
              {s.tracking_number || s.id}
            </h2>
            <StageBadge status={s.current_status} />
            {s.container_number && (
              <Badge variant="muted">
                <Container className="mr-1 h-3.5 w-3.5" />
                {containerLabel(s.container_number)}
              </Badge>
            )}
            {isDnr(s) && (
              <Badge variant="danger">
                <Lock className="mr-1 h-3.5 w-3.5" />
                Do Not Release
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            {SERVICES[s.service_type].label} · to {s.destination_country}
            {s.destination_city ? `, ${s.destination_city}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-ink-muted">Total</p>
            <p className="font-mono text-lg font-bold text-navy">
              {formatCurrency(s.total_price, s.currency)}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" /> Edit
            </Button>
            <Button variant="destructive" size="sm" onClick={openDelete}>
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column */}
        <div className="space-y-6 lg:col-span-2">
          {/* Info */}
          <Card>
            <CardHeader>
              <CardTitle>Shipment details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
              <InfoRow icon={User} label="Customer" value={s.customer_name || "-"} />
              <InfoRow icon={Mail} label="Email" value={s.customer_email || "-"} />
              <InfoRow icon={User} label="Phone" value={s.customer_phone || "-"} />
              <InfoRow
                icon={MapPin}
                label="Destination"
                value={`${s.destination_country}${s.destination_city ? `, ${s.destination_city}` : ""}`}
              />
              <InfoRow icon={Ship} label="Service" value={SERVICES[s.service_type].label} />
              {s.shipping_line && (
                <InfoRow icon={Ship} label="Shipping line" value={s.shipping_line.toUpperCase()} />
              )}
              {s.weight != null && (
                <InfoRow icon={Package} label="Weight" value={`${s.weight} lbs`} />
              )}
              {s.vehicle_class && (
                <InfoRow icon={Package} label="Vehicle class" value={s.vehicle_class.replace("_", " ").toUpperCase()} />
              )}
              {s.door_to_door != null && (
                <InfoRow icon={MapPin} label="Door to door" value={s.door_to_door ? "Yes" : "No"} />
              )}
              {s.declared_value != null && (
                <InfoRow icon={Package} label="Declared value" value={formatCurrency(s.declared_value, s.currency)} />
              )}
            </CardContent>
            {(s.pickup_address || s.delivery_address || s.notes) && (
              <CardContent className="border-t border-border pt-4 space-y-3">
                {s.pickup_address && (
                  <p className="text-sm text-ink">
                    <span className="font-semibold text-navy">Pickup: </span>
                    {s.pickup_address}
                  </p>
                )}
                {s.delivery_address && (
                  <p className="text-sm text-ink">
                    <span className="font-semibold text-navy">Delivery: </span>
                    {s.delivery_address}
                  </p>
                )}
                {s.notes && (
                  <p className="text-sm text-ink">
                    <span className="font-semibold text-navy">Notes: </span>
                    {s.notes}
                  </p>
                )}
              </CardContent>
            )}
          </Card>

          {/* Items */}
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Items</CardTitle>
            </CardHeader>
            {s.items && s.items.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="border-y border-border bg-secondary/50 text-left text-xs uppercase tracking-wide text-ink-muted">
                      <th className="px-4 py-2.5 font-semibold">Description</th>
                      <th className="px-4 py-2.5 font-semibold">Dimensions</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Unit</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Qty</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Line total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.items.map((it, i) => (
                      <tr key={i} className="border-b border-border last:border-0">
                        <td className="px-4 py-3 text-ink">
                          {it.description}
                          {it.category && (
                            <span className="ml-2 text-xs text-ink-muted">{it.category}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-ink-muted">
                          {it.dimensions || "-"}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs">
                          {formatCurrency(it.unit_price, s.currency)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs">{it.quantity}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-navy">
                          {formatCurrency(it.line_total, s.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-secondary/40">
                      <td className="px-4 py-3 text-right text-xs font-semibold uppercase text-ink-muted" colSpan={4}>
                        Total
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm font-bold text-navy">
                        {formatCurrency(s.total_price, s.currency)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <CardContent>
                <EmptyState
                  icon={<Package className="h-6 w-6" />}
                  title="No line items"
                  description="This shipment has no itemized cargo (e.g. air or RORO)."
                />
              </CardContent>
            )}
          </Card>

          {/* Hand-over record — who released the cargo, how, and who signed. */}
          {(s.delivered_by_name || s.handover_method || s.current_status === "completed") && (
            <Card>
              <CardHeader className="flex-row items-center gap-2 space-y-0">
                {s.handover_method === "warehouse_pickup" ? (
                  <Warehouse className="h-4 w-4 text-gold" aria-hidden />
                ) : (
                  <Truck className="h-4 w-4 text-gold" aria-hidden />
                )}
                <CardTitle>Hand-over record</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
                <InfoRow
                  icon={s.handover_method === "warehouse_pickup" ? Warehouse : Truck}
                  label="Method"
                  value={
                    s.handover_method === "warehouse_pickup"
                      ? "Collected at warehouse"
                      : s.handover_method === "delivery"
                      ? "Delivered to address"
                      : "Not recorded"
                  }
                />
                <InfoRow
                  icon={UserCheck}
                  label="Released by"
                  value={s.delivered_by_name || "Not recorded"}
                />
                <InfoRow
                  icon={User}
                  label="Signed for by"
                  value={s.received_by_name || "Not recorded"}
                />
                <InfoRow
                  icon={History}
                  label="Completed at"
                  value={
                    s.delivered_at ? formatDateTime(tsToDate(s.delivered_at)) : "Not recorded"
                  }
                />
              </CardContent>
              {s.proof_photos && s.proof_photos.length > 0 && (
                <CardContent className="border-t border-border pt-4">
                  <p className="text-xs uppercase tracking-wide text-ink-muted">
                    Proof of hand-over
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {s.proof_photos.map((src, i) => (
                      <a
                        key={src}
                        href={src}
                        target="_blank"
                        rel="noreferrer"
                        className="group relative block h-24 w-24 overflow-hidden rounded-lg border border-border focus-ring"
                        title="Open full size"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={src}
                          alt={`Proof ${i + 1}`}
                          className="h-full w-full object-cover transition-transform group-hover:scale-105"
                          loading="lazy"
                        />
                      </a>
                    ))}
                  </div>
                </CardContent>
              )}
              {!s.delivered_by_name && s.current_status === "completed" && (
                <CardContent className="pt-0">
                  <p className="text-xs text-ink-muted">
                    This shipment was completed before hand-over details were captured. The status
                    timeline below still shows who marked it complete.
                  </p>
                </CardContent>
              )}
            </Card>
          )}

          {/* Timeline */}
          <Card>
            <CardHeader className="flex-row items-center gap-2 space-y-0">
              <History className="h-4 w-4 text-gold" aria-hidden />
              <CardTitle>Status timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <EmptyState title="No status history" description="Stage changes will appear here." />
              ) : (
                <ol className="relative space-y-5 border-l border-border pl-6">
                  {logs.map((log) => {
                    const meta = STAGE_MAP[log.status];
                    return (
                      <li key={log.id} className="relative">
                        <span
                          className="absolute -left-[27px] top-1 h-3 w-3 rounded-full ring-4 ring-white"
                          style={{ backgroundColor: meta?.color ?? "#94A3B8" }}
                          aria-hidden
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <StageBadge status={log.status} />
                          <span className="text-xs text-ink-muted">
                            {formatDateTime(tsToDate(log.created_at))}
                          </span>
                        </div>
                        {log.notes && <p className="mt-1 text-sm text-ink">{log.notes}</p>}
                        {log.updated_by_name && (
                          <p className="mt-0.5 text-xs text-ink-muted">by {log.updated_by_name}</p>
                        )}
                        {/* Proof-of-delivery photos were uploaded by riders but
                            never shown anywhere — the whole point of capturing
                            them is that the office can check the hand-over. */}
                        {log.photos && log.photos.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {log.photos.map((src, i) => (
                              <a
                                key={src}
                                href={src}
                                target="_blank"
                                rel="noreferrer"
                                className="group relative block h-20 w-20 overflow-hidden rounded-lg border border-border focus-ring"
                                title="Open full size"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={src}
                                  alt={`Proof ${i + 1}`}
                                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                                  loading="lazy"
                                />
                              </a>
                            ))}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column, controls */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Advance stage</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="stage">Set stage</Label>
                <Select
                  id="stage"
                  value={targetStage}
                  onChange={(e) => setTargetStage(e.target.value as ShipmentStatus)}
                >
                  {STAGES.map((st) => (
                    <option key={st.key} value={st.key}>
                      {st.order}. {st.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add context for this stage change…"
                />
              </div>
              <Button
                onClick={handleAdvance}
                loading={saving}
                disabled={saving || targetStage === s.current_status}
                className="w-full"
              >
                {targetStage === s.current_status ? "Already at this stage" : "Update stage"}
              </Button>
              {stageOrder(targetStage) < stageOrder(s.current_status) &&
                targetStage !== s.current_status && (
                  <p className="text-xs text-amber-600">
                    Note: this moves the shipment to an earlier stage.
                  </p>
                )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notify customer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-ink-muted">
                Email the customer the current stage
                {notes.trim() ? " with your note above" : ""}.
              </p>
              <Button
                variant="gold"
                onClick={handleSendEmail}
                loading={sending}
                disabled={sending}
                className="w-full"
              >
                <Send className="h-4 w-4" /> Send update email
              </Button>
              <div className="flex items-center gap-2 pt-1 text-xs text-ink-muted">
                <Badge variant="muted">Current</Badge>
                {STAGE_MAP[s.current_status].label}
              </div>
            </CardContent>
          </Card>

          {/* Payment & receipt */}
          {user && (
            <PaymentReceiptCard
              shipment={s}
              actor={{ id: user.id, full_name: user.full_name, role: "admin" }}
              onChanged={load}
            />
          )}

          {/* Container assignment + release control */}
          <Card>
            <CardHeader className="flex-row items-center gap-2 space-y-0">
              <Container className="h-4 w-4 text-gold" aria-hidden />
              <CardTitle>Container &amp; release</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="cnt">Container number (CNT)</Label>
                <Input
                  id="cnt"
                  value={cnt}
                  onChange={(e) => setCnt(e.target.value)}
                  placeholder="e.g. 19B"
                />
                <p className="mt-1.5 text-xs text-ink-muted">
                  The container carrying this shipment. Shows on the invoice and the
                  customer&apos;s shipment, and groups it for container broadcasts.
                </p>
              </div>
              <div>
                <Label htmlFor="cnt-date">Container shipped on (optional)</Label>
                <Input
                  id="cnt-date"
                  type="date"
                  value={cntDate}
                  onChange={(e) => setCntDate(e.target.value)}
                />
              </div>
              <Button
                variant="outline"
                onClick={handleSaveContainer}
                loading={savingCnt}
                disabled={
                  savingCnt ||
                  (cnt.trim() === (s.container_number || "") &&
                    cntDate === (s.container_shipped_on || ""))
                }
                className="w-full"
              >
                Save container
              </Button>

              {/* Do Not Release */}
              <div className="rounded-lg border border-border bg-secondary/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {isDnr(s) ? (
                      <Lock className="h-4 w-4 text-destructive" aria-hidden />
                    ) : (
                      <LockOpen className="h-4 w-4 text-emerald-600" aria-hidden />
                    )}
                    <span className="text-sm font-semibold text-navy">
                      {isDnr(s) ? "Do Not Release" : "Release allowed"}
                    </span>
                  </div>
                  <Badge variant={isDnr(s) ? "danger" : "success"}>
                    {isDnr(s) ? "DNR" : "OK"}
                  </Badge>
                </div>
                <p className="mt-1.5 text-xs text-ink-muted">
                  {s.dnr_override == null
                    ? "Following payment: held automatically until fully paid (covers pay-on-delivery)."
                    : s.dnr_override
                    ? "Manually held. Packages must not be released until you clear this."
                    : "Manually cleared for release regardless of payment."}
                </p>

                {/* Dispatcher release request */}
                {isDnr(s) && s.dnr_release_requested && (
                  <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
                    <p className="text-xs font-semibold text-amber-800">
                      Release requested by {s.dnr_release_requested_by_name || "a dispatcher"}
                    </p>
                    {s.dnr_release_note && (
                      <p className="mt-1 text-xs text-amber-700">&ldquo;{s.dnr_release_note}&rdquo;</p>
                    )}
                    <p className="mt-1 text-[11px] text-amber-700">
                      Approve with &ldquo;Allow release&rdquo; below once payment is settled.
                    </p>
                  </div>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant={isDnr(s) ? "outline" : "primary"}
                    size="sm"
                    onClick={() => handleSetDnr(true)}
                    loading={savingDnr}
                    disabled={savingDnr}
                  >
                    <Lock className="h-3.5 w-3.5" /> Hold
                  </Button>
                  <Button
                    variant={isDnr(s) ? "primary" : "outline"}
                    size="sm"
                    onClick={() => handleSetDnr(false)}
                    loading={savingDnr}
                    disabled={savingDnr}
                  >
                    <LockOpen className="h-3.5 w-3.5" /> Allow release
                  </Button>
                  {s.dnr_override != null && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSetDnr(null)}
                      loading={savingDnr}
                      disabled={savingDnr}
                    >
                      Follow payment
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Assign dispatcher for last-mile delivery */}
          <Card>
            <CardHeader>
              <CardTitle>Last-mile dispatcher</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-ink-muted">
                Assign a dispatcher so this delivery appears in their mobile job list.
              </p>
              <div>
                <Label htmlFor="assignee">Dispatcher</Label>
                <Select
                  id="assignee"
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {dispatchers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.full_name}
                    </option>
                  ))}
                </Select>
                {dispatchers.length === 0 && (
                  <p className="mt-1.5 text-xs text-ink-muted">
                    No active dispatchers yet. Add one under Staff &amp; Roles.
                  </p>
                )}
              </div>
              <Button
                variant="outline"
                onClick={handleAssignDispatcher}
                loading={assigning}
                disabled={assigning || assignee === (s.assigned_dispatcher_id || "")}
                className="w-full"
              >
                Save assignment
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <EditShipmentModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        shipment={s}
        onSave={handleSaveEdit}
      />

      <ConfirmDeleteModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDeleteShipment}
        title="Delete shipment"
        subject={`shipment ${s.tracking_number}`}
        description={
          s.container_number
            ? `It will also be removed from ${containerLabel(s.container_number)} and from the dispatch queue.`
            : "It will also be removed from the dispatch queue and all admin lists."
        }
        requireTyped={s.tracking_number}
        impact={
          delPlan
            ? [
                { label: "Shipment record", count: 1 },
                { label: "Invoices / receipts", count: delPlan.receipts },
                { label: "Warehouse inventory rows", count: delPlan.inventory },
                { label: "RORO documents", count: delPlan.roroDocs },
                { label: "Status history entries (audit trail)", count: delPlan.statusLogs, retained: true },
              ]
            : []
        }
        busy={deleting}
      />
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-navy/5 text-navy">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-ink-muted">{label}</p>
        <p className="truncate text-sm font-medium text-ink">{value}</p>
      </div>
    </div>
  );
}


export default function Page() {
  return (
    <React.Suspense fallback={<PageLoader label="Loading…" />}>
      <AdminShipmentDetailPageInner />
    </React.Suspense>
  );
}
