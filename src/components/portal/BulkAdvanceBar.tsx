"use client";

// ─────────────────────────────────────────────────────────────
// Bulk stage advance UI, floating selection bar + confirm modal.
// Shared by the admin and destination-office shipment lists so both
// portals behave identically. All rules live in lib/bulk-advance.ts.
// ─────────────────────────────────────────────────────────────

import * as React from "react";
import { Layers, X, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, Textarea, Label } from "@/components/ui/input";
import { Modal } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { STAGE_MAP } from "@/lib/constants";
import {
  planBulkAdvance,
  runBulkAdvance,
  stagesForRole,
  SKIP_LABEL,
  type BulkResult,
} from "@/lib/bulk-advance";
import type { Shipment, ShipmentStatus, Role } from "@/lib/types";

export function BulkAdvanceBar({
  selected,
  shipments,
  actor,
  onDone,
  onClear,
}: {
  /** Ids currently selected in the list. */
  selected: Set<string>;
  /** The full list the selection refers to (used to resolve ids → shipments). */
  shipments: Shipment[];
  actor: { id: string; full_name: string; role: Role };
  /** Called after a batch runs so the parent can reload. */
  onDone: () => Promise<void> | void;
  onClear: () => void;
}) {
  const toast = useToast();
  const stages = React.useMemo(() => stagesForRole(actor.role), [actor.role]);

  const [open, setOpen] = React.useState(false);
  const [target, setTarget] = React.useState<ShipmentStatus>(stages[0]);
  const [notes, setNotes] = React.useState("");
  const [notify, setNotify] = React.useState(true);
  const [running, setRunning] = React.useState(false);
  const [progress, setProgress] = React.useState({ done: 0, total: 0 });
  const [result, setResult] = React.useState<BulkResult | null>(null);

  // Resolve the selection to real shipment records.
  const picked = React.useMemo(
    () => shipments.filter((s) => selected.has(s.id)),
    [shipments, selected]
  );

  // Live preview of what the batch will actually do, so the operator sees
  // skipped items BEFORE committing rather than being surprised afterwards.
  const plan = React.useMemo(
    () => planBulkAdvance(picked, target, actor.role),
    [picked, target, actor.role]
  );

  async function run() {
    setRunning(true);
    setResult(null);
    try {
      const res = await runBulkAdvance({
        shipments: picked,
        target,
        notes,
        notify,
        actor,
        onProgress: (done, total) => setProgress({ done, total }),
      });
      setResult(res);
      await onDone();

      if (res.failures.length === 0 && res.advanced.length > 0) {
        toast.success(
          "Batch updated",
          `${res.advanced.length} shipment${res.advanced.length !== 1 ? "s" : ""} advanced to ${
            STAGE_MAP[target].label
          }.`
        );
        setOpen(false);
        onClear();
        setNotes("");
      } else if (res.advanced.length === 0) {
        toast.error("Nothing was updated", "No shipment in this selection could be advanced.");
      } else {
        // Partial success: keep the modal open so the operator can read which
        // shipments need attention instead of losing that detail to a toast.
        toast.info(
          "Batch finished with issues",
          `${res.advanced.length} updated, ${res.failures.length} need attention.`
        );
      }
    } catch {
      toast.error("Batch failed", "Could not complete the bulk update.");
    } finally {
      setRunning(false);
    }
  }

  function close() {
    if (running) return;
    setOpen(false);
    setResult(null);
  }

  if (selected.size === 0) return null;

  return (
    <>
      {/* Floating selection bar. z-30 keeps it below the mobile nav slide-over
          (z-40) and the modal (z-50), at z-40 it floated on top of the open
          drawer on phones. */}
      <div className="fixed inset-x-0 bottom-4 z-30 flex justify-center px-4">
        <div className="flex max-w-[calc(100vw-2rem)] flex-wrap items-center justify-center gap-2 rounded-2xl border border-border bg-white px-4 py-3 shadow-premium animate-fade-up sm:gap-3">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-navy">
            <Layers className="h-4 w-4 text-gold-700" />
            {selected.size} selected
          </span>
          <Button size="sm" variant="gold" onClick={() => setOpen(true)}>
            Advance stage
          </Button>
          <button
            onClick={onClear}
            className="rounded-md p-1.5 text-ink-muted hover:bg-secondary focus-ring"
            aria-label="Clear selection"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <Modal
        open={open}
        onClose={close}
        title={`Advance ${picked.length} shipment${picked.length !== 1 ? "s" : ""}`}
        description="Every selected shipment moves to the same stage. Each change is logged individually to the audit trail."
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="bulk-stage">Target stage</Label>
            <Select
              id="bulk-stage"
              value={target}
              onChange={(e) => setTarget(e.target.value as ShipmentStatus)}
              disabled={running}
            >
              {stages.map((key) => (
                <option key={key} value={key}>
                  {STAGE_MAP[key].order}. {STAGE_MAP[key].label}
                </option>
              ))}
            </Select>
            {actor.role !== "admin" && (
              <p className="mt-1.5 text-xs text-ink-muted">
                Your role can set destination stages only.
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="bulk-notes">Shared note (optional)</Label>
            <Textarea
              id="bulk-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Container HC-4471 cleared Lagos customs."
              disabled={running}
            />
          </div>

          <label className="flex items-center gap-2.5 text-sm text-ink">
            <input
              type="checkbox"
              checked={notify}
              onChange={(e) => setNotify(e.target.checked)}
              disabled={running}
              className="h-4 w-4 cursor-pointer accent-navy"
            />
            Email each customer the update
          </label>

          {/* Pre-flight summary: what will change, and what will be skipped. */}
          {!result && (
            <div className="rounded-lg border border-border bg-surface p-3 text-sm">
              <p className="font-medium text-ink">
                {plan.advance.length} will advance to {STAGE_MAP[target].short}
              </p>
              {plan.skipped.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-ink-muted">
                  {Object.entries(
                    plan.skipped.reduce<Record<string, number>>((acc, s) => {
                      acc[s.reason] = (acc[s.reason] || 0) + 1;
                      return acc;
                    }, {})
                  ).map(([reason, count]) => (
                    <li key={reason} className="flex items-start gap-1.5">
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
                      {count} skipped, {SKIP_LABEL[reason as keyof typeof SKIP_LABEL]}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {running && (
            <div className="rounded-lg bg-surface p-3">
              <div className="flex items-center justify-between text-xs text-ink-muted">
                <span>Updating…</span>
                <span className="font-mono">
                  {progress.done}/{progress.total}
                </span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border">
                <div
                  className="h-full rounded-full bg-gold-gradient transition-all"
                  style={{
                    width: `${(progress.done / Math.max(1, progress.total)) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Per-shipment outcome, the operator must know exactly what failed. */}
          {result && (
            <div className="space-y-2 rounded-lg border border-border bg-surface p-3 text-sm">
              <p className="inline-flex items-center gap-1.5 font-medium text-ink">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                {result.advanced.length} advanced
                {result.notified > 0 && ` · ${result.notified} emailed`}
              </p>
              {result.failures.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-red-600">
                    Needs attention
                  </p>
                  <ul className="mt-1 max-h-40 space-y-1 overflow-y-auto text-xs text-ink-muted">
                    {result.failures.map((f, i) => (
                      <li key={`${f.shipment.id}-${f.stage}-${i}`}>
                        <span className="font-mono text-ink">
                          {f.shipment.tracking_number || f.shipment.id.slice(0, 8)}
                        </span>{" "}
                       , {f.stage === "notify" ? "stage updated, email failed" : "update failed"}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={close} disabled={running}>
              {result ? "Close" : "Cancel"}
            </Button>
            {!result && (
              <Button
                variant="gold"
                className="flex-1"
                onClick={run}
                loading={running}
                disabled={running || plan.advance.length === 0}
              >
                {running ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Updating
                  </>
                ) : (
                  `Advance ${plan.advance.length}`
                )}
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
