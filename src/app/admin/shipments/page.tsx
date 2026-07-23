"use client";

import * as React from "react";
import Link from "next/link";
import { Package, Search, ChevronRight, Layers, X, Loader2 } from "lucide-react";
import { listAllShipments, advanceStage, logNotification, logActivity } from "@/lib/db";
import { sendStageUpdateEmail } from "@/lib/notify";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/ui/toast";
import type { Shipment, ShipmentStatus, ServiceType } from "@/lib/types";
import { STAGES, STAGE_MAP, SERVICES } from "@/lib/constants";
import { Card } from "@/components/ui/card";
import { Input, Select, Textarea, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StageBadge, Badge } from "@/components/ui/badge";
import { Skeleton, EmptyState, Modal } from "@/components/ui/misc";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import type { Timestamp } from "firebase/firestore";

function tsToDate(ts?: Timestamp | null): Date | null {
  if (!ts) return null;
  try {
    return ts.toDate();
  } catch {
    return null;
  }
}

const SERVICE_LABEL: Record<ServiceType, string> = {
  sea: "Sea",
  air: "Air",
  roro: "RORO",
};

export default function AdminShipmentsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = React.useState(true);
  const [shipments, setShipments] = React.useState<Shipment[]>([]);
  const [error, setError] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState<ShipmentStatus | "all">("all");
  const [service, setService] = React.useState<ServiceType | "all">("all");

  // ── Bulk selection + advance ──
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = React.useState(false);
  const [bulkStage, setBulkStage] = React.useState<ShipmentStatus>("loading");
  const [bulkNotes, setBulkNotes] = React.useState("");
  const [bulkNotify, setBulkNotify] = React.useState(true);
  const [bulkRunning, setBulkRunning] = React.useState(false);
  const [bulkProgress, setBulkProgress] = React.useState(0);

  const reload = React.useCallback(async () => {
    try {
      const s = await listAllShipments();
      setShipments(s);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

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

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function runBulkAdvance() {
    if (!user || selected.size === 0) return;
    setBulkRunning(true);
    setBulkProgress(0);
    const ids = Array.from(selected);
    let done = 0;
    for (const id of ids) {
      const ship = shipments.find((s) => s.id === id);
      if (!ship) continue;
      try {
        await advanceStage({
          shipmentId: id,
          status: bulkStage,
          notes: bulkNotes.trim() || undefined,
          updatedBy: user.id,
          updatedByName: user.full_name,
        });
        if (bulkNotify) {
          const res = await sendStageUpdateEmail({
            shipmentId: id,
            customerId: ship.customer_id,
            status: bulkStage,
          });
          await logNotification({
            customer_id: ship.customer_id,
            shipment_id: id,
            channel: "email",
            type: `bulk_stage_${bulkStage}`,
            subject: `Update: ${STAGE_MAP[bulkStage].label}`,
            status: res.ok ? "sent" : "failed",
          });
        }
      } catch {
        /* continue with the rest */
      }
      done += 1;
      setBulkProgress(done);
    }
    await logActivity({
      actor_id: user.id,
      actor_name: user.full_name,
      actor_role: "admin",
      action: `bulk-advanced ${ids.length} shipments to ${STAGE_MAP[bulkStage].short}`,
      meta: { count: ids.length, status: bulkStage },
    });
    await reload();
    setBulkRunning(false);
    setBulkOpen(false);
    setSelected(new Set());
    toast.success(
      "Batch updated",
      `${ids.length} shipment${ids.length !== 1 ? "s" : ""} advanced to ${STAGE_MAP[bulkStage].label}.`
    );
  }

  const filtered = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    return shipments.filter((s) => {
      if (status !== "all" && s.current_status !== status) return false;
      if (service !== "all" && s.service_type !== service) return false;
      if (!term) return true;
      return (
        s.tracking_number?.toLowerCase().includes(term) ||
        s.customer_name?.toLowerCase().includes(term) ||
        s.customer_email?.toLowerCase().includes(term) ||
        s.container_number?.toLowerCase().includes(term)
      );
    });
  }, [shipments, q, status, service]);

  // Keep the selection scoped to what's currently visible, so a bulk action
  // can never touch a shipment the admin filtered out of view.
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

  return (
    <div className="space-y-5">
      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_auto]">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
              aria-hidden
            />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search tracking # or customer…"
              className="pl-9"
              aria-label="Search shipments"
            />
          </div>
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value as ShipmentStatus | "all")}
            aria-label="Filter by status"
            className="sm:w-48"
          >
            <option value="all">All stages</option>
            {STAGES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.short}
              </option>
            ))}
          </Select>
          <Select
            value={service}
            onChange={(e) => setService(e.target.value as ServiceType | "all")}
            aria-label="Filter by service type"
            className="sm:w-40"
          >
            <option value="all">All services</option>
            {(["sea", "air", "roro"] as const).map((s) => (
              <option key={s} value={s}>
                {SERVICES[s].label}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="p-4">
            <EmptyState
              icon={<Package className="h-6 w-6" />}
              title="Could not load shipments"
              description="Please refresh to try again."
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={<Package className="h-6 w-6" />}
              title={shipments.length === 0 ? "No shipments yet" : "No matching shipments"}
              description={
                shipments.length === 0
                  ? "Shipments will appear here as they are created."
                  : "Try adjusting your search or filters."
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50 text-left text-xs uppercase tracking-wide text-ink-muted">
                  <th className="px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label="Select all"
                      className="h-4 w-4 cursor-pointer accent-navy"
                      checked={filtered.length > 0 && filtered.every((s) => selected.has(s.id))}
                      ref={(el) => {
                        if (el)
                          el.indeterminate =
                            filtered.some((s) => selected.has(s.id)) &&
                            !filtered.every((s) => selected.has(s.id));
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
                  </th>
                  <th className="px-4 py-3 font-semibold">Tracking #</th>
                  <th className="px-4 py-3 font-semibold">Customer</th>
                  <th className="px-4 py-3 font-semibold">Service</th>
                  <th className="px-4 py-3 font-semibold">Destination</th>
                  <th className="px-4 py-3 font-semibold">Stage</th>
                  <th className="px-4 py-3 text-right font-semibold">Total</th>
                  <th className="px-4 py-3 font-semibold">Created</th>
                  <th className="px-4 py-3" aria-label="Open" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr
                    key={s.id}
                    className={cn(
                      "group border-b border-border transition-colors last:border-0 hover:bg-secondary/40",
                      selected.has(s.id) && "bg-gold/5"
                    )}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        aria-label={`Select ${s.tracking_number}`}
                        className="h-4 w-4 cursor-pointer accent-navy"
                        checked={selected.has(s.id)}
                        onChange={() => toggle(s.id)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/shipments/detail?id=${s.id}`}
                        className="font-mono text-xs font-semibold text-navy hover:text-gold-700 focus-ring"
                      >
                        {s.tracking_number || s.id.slice(0, 8)}
                      </Link>
                      {s.container_number && (
                        <div className="mt-1 font-mono text-[10px] text-ink-muted">
                          CNT #{s.container_number}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="max-w-[180px] truncate font-medium text-ink">
                        {s.customer_name || "-"}
                      </div>
                      {s.customer_email && (
                        <div className="max-w-[180px] truncate text-xs text-ink-muted">
                          {s.customer_email}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">{SERVICE_LABEL[s.service_type]}</Badge>
                    </td>
                    <td className="px-4 py-3 text-ink">
                      {s.destination_country}
                      {s.destination_city ? `, ${s.destination_city}` : ""}
                    </td>
                    <td className="px-4 py-3">
                      <StageBadge status={s.current_status} />
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-ink">
                      {formatCurrency(s.total_price, s.currency)}
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-muted">
                      {formatDate(tsToDate(s.created_at))}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/shipments/detail?id=${s.id}`}
                        className="inline-flex items-center rounded-md p-1 text-ink-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-navy focus-ring"
                        aria-label={`Open ${s.tracking_number}`}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {!loading && !error && filtered.length > 0 && (
        <p className="px-1 text-xs text-ink-muted">
          Showing {filtered.length} of {shipments.length} shipments.
        </p>
      )}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
          <div className="flex max-w-[calc(100vw-2rem)] flex-wrap items-center justify-center gap-2 rounded-2xl border border-border bg-white px-4 py-3 shadow-premium animate-fade-up sm:gap-3">
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-navy">
              <Layers className="h-4 w-4 text-gold-700" />
              {selected.size} selected
            </span>
            <Button size="sm" variant="gold" onClick={() => setBulkOpen(true)}>
              Advance stage
            </Button>
            <button
              onClick={() => setSelected(new Set())}
              className="rounded-md p-1.5 text-ink-muted hover:bg-secondary focus-ring"
              aria-label="Clear selection"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Bulk advance modal */}
      <Modal
        open={bulkOpen}
        onClose={() => !bulkRunning && setBulkOpen(false)}
        title={`Advance ${selected.size} shipment${selected.size !== 1 ? "s" : ""}`}
        description="Move every selected shipment to the same stage. Each change is logged to the audit trail."
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="bulk-stage">Target stage</Label>
            <Select
              id="bulk-stage"
              value={bulkStage}
              onChange={(e) => setBulkStage(e.target.value as ShipmentStatus)}
            >
              {STAGES.map((st) => (
                <option key={st.key} value={st.key}>
                  {st.order}. {st.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="bulk-notes">Shared note (optional)</Label>
            <Textarea
              id="bulk-notes"
              value={bulkNotes}
              onChange={(e) => setBulkNotes(e.target.value)}
              placeholder="e.g. Cleared Lagos customs on today's manifest."
            />
          </div>
          <label className="flex items-center gap-2.5 text-sm text-ink">
            <input
              type="checkbox"
              checked={bulkNotify}
              onChange={(e) => setBulkNotify(e.target.checked)}
              className="h-4 w-4 cursor-pointer accent-navy"
            />
            Email each customer the update
          </label>

          {bulkRunning && (
            <div className="rounded-lg bg-surface p-3">
              <div className="flex items-center justify-between text-xs text-ink-muted">
                <span>Updating…</span>
                <span className="font-mono">
                  {bulkProgress}/{selected.size}
                </span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border">
                <div
                  className="h-full rounded-full bg-gold-gradient transition-all"
                  style={{ width: `${(bulkProgress / Math.max(1, selected.size)) * 100}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setBulkOpen(false)}
              disabled={bulkRunning}
            >
              Cancel
            </Button>
            <Button
              variant="gold"
              className="flex-1"
              onClick={runBulkAdvance}
              loading={bulkRunning}
              disabled={bulkRunning}
            >
              {bulkRunning ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Updating
                </>
              ) : (
                `Advance ${selected.size}`
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
