"use client";

import * as React from "react";
import { Receipt, Download, CheckCircle2, Loader2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { setPayment, logActivity } from "@/lib/db";
import { generateReceiptPdf } from "@/lib/notify";
import { formatCurrency } from "@/lib/utils";
import type { Shipment, Role } from "@/lib/types";

const STATUS_BADGE: Record<string, { label: string; variant: "success" | "warning" | "danger" }> = {
  paid: { label: "Paid", variant: "success" },
  partial: { label: "Part-paid", variant: "warning" },
  unpaid: { label: "Unpaid", variant: "danger" },
};

// Staff-only card: record deposit / mark paid, and generate the branded PDF receipt.
export function PaymentReceiptCard({
  shipment,
  actor,
  onChanged,
}: {
  shipment: Shipment;
  actor: { id: string; full_name: string; role: Role };
  onChanged: () => Promise<void> | void;
}) {
  const toast = useToast();
  const total = shipment.total_price || 0;
  const status = shipment.payment_status || "unpaid";
  const badge = STATUS_BADGE[status] ?? STATUS_BADGE.unpaid;

  const [deposit, setDeposit] = React.useState<string>(String(shipment.deposit ?? 0));
  const [saving, setSaving] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);

  const depositNum = Math.max(0, Math.min(Number(deposit) || 0, total));
  const balance = Math.round((total - depositNum) * 100) / 100;

  async function savePayment(markPaid: boolean) {
    setSaving(true);
    try {
      const res = await setPayment(shipment.id, {
        total,
        deposit: markPaid ? total : depositNum,
      });
      await logActivity({
        actor_id: actor.id,
        actor_name: actor.full_name,
        actor_role: actor.role,
        action: markPaid ? "marked shipment paid" : "updated payment",
        target: shipment.tracking_number,
        meta: { shipment_id: shipment.id, status: res.payment_status },
      });

      // When the shipment becomes fully paid, generate the invoice ONCE and
      // release it for download (this is the only point an invoice is created).
      if (res.payment_status === "paid" && !shipment.receipt_number) {
        setGenerating(true);
        try {
          const r = await generateReceiptPdf({ shipmentId: shipment.id });
          if (r.ok) {
            await logActivity({
              actor_id: actor.id,
              actor_name: actor.full_name,
              actor_role: actor.role,
              action: "generated paid invoice",
              target: shipment.tracking_number,
              meta: { shipment_id: shipment.id, receipt: r.receiptNumber },
            });
            toast.success("Marked paid + invoice ready", r.receiptNumber);
          } else {
            toast.info("Marked paid", "Invoice could not be generated; try Regenerate.");
          }
        } catch {
          toast.info("Marked paid", "Invoice service unavailable; try Regenerate shortly.");
        } finally {
          setGenerating(false);
        }
      } else {
        toast.success(
          markPaid ? "Marked as paid" : "Payment updated",
          `Balance ${formatCurrency(res.balance, shipment.currency)}`
        );
      }

      await onChanged();
    } catch {
      toast.error("Could not update payment");
    } finally {
      setSaving(false);
    }
  }

  // Manual regenerate (only relevant once paid, e.g. if the first attempt failed).
  async function regenerateInvoice() {
    setGenerating(true);
    try {
      const res = await generateReceiptPdf({ shipmentId: shipment.id });
      if (res.ok) {
        await onChanged();
        toast.success("Invoice ready", res.receiptNumber);
        if (res.pdfUrl) window.open(res.pdfUrl, "_blank");
      } else {
        toast.error("Invoice failed", "Please try again.");
      }
    } catch {
      toast.error("Invoice failed", "The invoice service is unavailable.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Payment &amp; receipt</CardTitle>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-surface p-2.5">
            <p className="text-[10px] uppercase tracking-wide text-ink-muted">Total</p>
            <p className="font-mono text-sm font-bold text-navy">
              {formatCurrency(total, shipment.currency)}
            </p>
          </div>
          <div className="rounded-lg bg-surface p-2.5">
            <p className="text-[10px] uppercase tracking-wide text-ink-muted">Deposit</p>
            <p className="font-mono text-sm font-bold text-navy">
              {formatCurrency(depositNum, shipment.currency)}
            </p>
          </div>
          <div className="rounded-lg bg-surface p-2.5">
            <p className="text-[10px] uppercase tracking-wide text-ink-muted">Balance</p>
            <p className="font-mono text-sm font-bold text-navy">
              {formatCurrency(balance, shipment.currency)}
            </p>
          </div>
        </div>

        {status !== "paid" && (
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label htmlFor="deposit">Record deposit ({shipment.currency || "USD"})</Label>
              <Input
                id="deposit"
                type="number"
                min={0}
                max={total}
                value={deposit}
                onChange={(e) => setDeposit(e.target.value)}
              />
            </div>
            <Button variant="outline" onClick={() => savePayment(false)} loading={saving}>
              Save
            </Button>
          </div>
        )}

        {status !== "paid" ? (
          <Button
            variant="primary"
            className="w-full"
            onClick={() => savePayment(true)}
            loading={saving || generating}
            disabled={saving || generating}
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Generating invoice…
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" /> Mark fully paid &amp; issue invoice
              </>
            )}
          </Button>
        ) : (
          <Button
            variant="outline"
            className="w-full"
            onClick={regenerateInvoice}
            loading={generating}
            disabled={generating}
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}
            {shipment.receipt_number ? "Regenerate invoice" : "Generate invoice"}
          </Button>
        )}

        {shipment.receipt_pdf_url && (
          <a
            href={shipment.receipt_pdf_url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 rounded-lg border border-border bg-white py-2.5 text-sm font-semibold text-navy hover:bg-surface focus-ring"
          >
            <Download className="h-4 w-4" /> Download {shipment.receipt_number}
          </a>
        )}

        <p className="text-center text-xs text-ink-muted">
          {status === "paid"
            ? "Paid. The invoice is available to the customer to download."
            : "The invoice is issued once you mark this shipment fully paid."}
        </p>
      </CardContent>
    </Card>
  );
}
