"use client";

// ─────────────────────────────────────────────────────────────
// Destructive-action confirmation.
//
// Permanent deletes are irreversible and cascade (a customer takes their
// shipments, a shipment takes its receipts), so a one-click window.confirm is
// too weak: it gives no inventory of what is about to be destroyed and is
// dismissed by reflex. This modal states the exact counts and — when the delete
// cascades — requires the operator to type the record's name.
// ─────────────────────────────────────────────────────────────

import * as React from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export interface DeleteImpactLine {
  label: string;
  count: number;
  /** Kept rather than deleted (e.g. the append-only audit trail). */
  retained?: boolean;
}

export function ConfirmDeleteModal({
  open,
  onClose,
  onConfirm,
  title,
  subject,
  description,
  impact = [],
  /** When set, the operator must type this string exactly to enable Delete. */
  requireTyped,
  busy,
  confirmLabel = "Delete permanently",
  progress,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  subject: string;
  description?: string;
  impact?: DeleteImpactLine[];
  requireTyped?: string;
  busy?: boolean;
  confirmLabel?: string;
  progress?: { done: number; total: number } | null;
}) {
  const [typed, setTyped] = React.useState("");

  // Reset the typed guard whenever the dialog opens on a new subject, so a
  // previous confirmation can never carry over and pre-arm this one.
  React.useEffect(() => {
    if (open) setTyped("");
  }, [open, subject]);

  const typedOk = !requireTyped || typed.trim() === requireTyped.trim();
  const destroyed = impact.filter((i) => !i.retained && i.count > 0);
  const retained = impact.filter((i) => i.retained && i.count > 0);

  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      title={title}
      size="md"
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-red-800">
              This permanently deletes {subject}.
            </p>
            <p className="mt-1 text-sm text-red-700">
              {description ?? "This cannot be undone."}
            </p>
          </div>
        </div>

        {destroyed.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Will be deleted
            </p>
            <ul className="mt-2 space-y-1.5">
              {destroyed.map((i) => (
                <li key={i.label} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-ink">{i.label}</span>
                  <span className="font-mono font-semibold text-red-700">{i.count}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {retained.length > 0 && (
          <div className="rounded-lg border border-border bg-secondary/40 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Kept for your records
            </p>
            <ul className="mt-1.5 space-y-1">
              {retained.map((i) => (
                <li key={i.label} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-ink-muted">{i.label}</span>
                  <span className="font-mono text-ink-muted">{i.count}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {requireTyped && (
          <div>
            <Label htmlFor="confirm-typed" required>
              Type <span className="font-mono font-bold text-navy">{requireTyped}</span> to confirm
            </Label>
            <Input
              id="confirm-typed"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={requireTyped}
              autoComplete="off"
              disabled={busy}
            />
          </div>
        )}

        {progress && progress.total > 0 && (
          <div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full bg-gold-gradient transition-[width] duration-200"
                style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-ink-muted">
              Deleting {progress.done} of {progress.total}…
            </p>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            onClick={onConfirm}
            loading={busy}
            disabled={busy || !typedOk}
          >
            <Trash2 className="h-4 w-4" /> {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
