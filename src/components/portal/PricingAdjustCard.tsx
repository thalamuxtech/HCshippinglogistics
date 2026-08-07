"use client";

// ─────────────────────────────────────────────────────────────
// Staff pricing adjustments: quote the pickup fee, apply a discount.
//
// Separate from the Edit modal on purpose. Editing items is a correction to the
// record; pickup and discount are commercial decisions that change what the
// customer owes, so they sit next to Payment where that consequence is visible.
//
// The total is always recomputed through computeOrderTotals, the same function
// the customer portal and the invoice use, so the three can never disagree.
// ─────────────────────────────────────────────────────────────

import * as React from "react";
import { Percent, Tag, Truck, Check, Info } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { updateShipment, setPayment, logActivity } from "@/lib/db";
import { computeOrderTotals } from "@/lib/order-total";
import { formatCurrency } from "@/lib/utils";
import type { Shipment, Role } from "@/lib/types";

export function PricingAdjustCard({
  shipment,
  actor,
  onChanged,
}: {
  shipment: Shipment;
  actor: { id: string; full_name: string; role: Role };
  onChanged: () => Promise<void> | void;
}) {
  const toast = useToast();
  const currency = shipment.currency || "USD";

  const [pickup, setPickup] = React.useState(String(shipment.pickup_fee ?? 0));
  const [dType, setDType] = React.useState<"none" | "percent" | "amount">(
    shipment.discount_type === "percent" || shipment.discount_type === "amount"
      ? shipment.discount_type
      : "none"
  );
  const [dValue, setDValue] = React.useState(String(shipment.discount_value ?? 0));
  const [reason, setReason] = React.useState(shipment.discount_reason ?? "");
  const [saving, setSaving] = React.useState(false);

  // Re-seed when the shipment reloads after a save elsewhere on the page.
  React.useEffect(() => {
    setPickup(String(shipment.pickup_fee ?? 0));
    setDType(
      shipment.discount_type === "percent" || shipment.discount_type === "amount"
        ? shipment.discount_type
        : "none"
    );
    setDValue(String(shipment.discount_value ?? 0));
    setReason(shipment.discount_reason ?? "");
  }, [shipment]);

  // Live preview of the draft, so staff see the effect before saving.
  const preview = computeOrderTotals({
    ...shipment,
    pickup_fee: Number(pickup) || 0,
    pickup_fee_pending: false,
    discount_type: dType === "none" ? null : dType,
    discount_value: Number(dValue) || 0,
  });

  const current = computeOrderTotals(shipment);
  const changed =
    preview.pickupFee !== current.pickupFee ||
    preview.discountAmount !== current.discountAmount ||
    (reason ?? "") !== (shipment.discount_reason ?? "");

  async function save() {
    setSaving(true);
    try {
      const pickupFee = Math.max(0, Number(pickup) || 0);
      const value = Math.max(0, Number(dValue) || 0);
      const type = dType === "none" || value <= 0 ? null : dType;

      const totals = computeOrderTotals({
        ...shipment,
        pickup_fee: pickupFee,
        pickup_fee_pending: false,
        discount_type: type,
        discount_value: value,
      });

      await updateShipment(shipment.id, {
        pickup_fee: pickupFee,
        // Requesting a pickup leaves this pending; saving a figure resolves it,
        // even if the figure is 0 (staff may waive it).
        pickup_fee_pending: false,
        discount_type: type,
        discount_value: type ? value : 0,
        discount_amount: totals.discountAmount,
        discount_reason: type ? reason.trim() || undefined : undefined,
        subtotal: totals.subtotal,
        total_price: totals.total,
      });

      // The balance is derived from total_price, so it must be recomputed or the
      // customer would be chased for the pre-adjustment amount. setPayment reads
      // the stored total inside a transaction, so it picks up what we just wrote.
      await setPayment(shipment.id, {
        total: totals.total,
        deposit: shipment.deposit ?? 0,
        dnr_override: shipment.dnr_override ?? null,
      });

      await logActivity({
        actor_id: actor.id,
        actor_name: actor.full_name,
        actor_role: actor.role,
        action: "adjusted shipment pricing",
        target: shipment.tracking_number,
        meta: {
          shipment_id: shipment.id,
          pickup_fee: pickupFee,
          discount_type: type,
          discount_value: type ? value : 0,
          discount_amount: totals.discountAmount,
          total: totals.total,
        },
      });

      await onChanged();
      toast.success(
        "Pricing updated",
        `New total ${formatCurrency(totals.total, currency)}.`
      );
    } catch {
      toast.error("Could not save", "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start gap-2 space-y-0">
        <Tag className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden />
        <div>
          <CardTitle>Pricing adjustments</CardTitle>
          <CardDescription className="mt-1">
            Quote the pickup fee and apply any discount. The balance and the customer&apos;s portal
            update together.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Pickup */}
        <div className="rounded-lg border border-border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-navy">
              <Truck className="h-4 w-4 text-ink-muted" /> Door-to-door pickup
            </span>
            {shipment.door_to_door ? (
              current.pickupPending ? (
                <Badge variant="warning">Requested, not priced</Badge>
              ) : (
                <Badge variant="success">Priced</Badge>
              )
            ) : (
              <Badge variant="muted">Not requested</Badge>
            )}
          </div>
          {shipment.door_to_door ? (
            <>
              <div className="mt-2">
                <Label htmlFor="pickup-fee">Pickup fee ({currency})</Label>
                <Input
                  id="pickup-fee"
                  type="number"
                  min="0"
                  step="0.01"
                  value={pickup}
                  onChange={(e) => setPickup(e.target.value)}
                  className="font-mono"
                />
              </div>
              {shipment.pickup_address && (
                <p className="mt-1.5 text-xs text-ink-muted">
                  Collect from: {shipment.pickup_address}
                </p>
              )}
            </>
          ) : (
            <p className="mt-1.5 text-xs text-ink-muted">
              This customer is dropping off at the warehouse, so there is nothing to quote.
            </p>
          )}
        </div>

        {/* Discount */}
        <div className="rounded-lg border border-border p-3">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-navy">
            <Percent className="h-4 w-4 text-ink-muted" /> Discount
          </span>
          <div className="mt-2 grid gap-2 sm:grid-cols-[130px_1fr]">
            <div>
              <Label htmlFor="d-type">Type</Label>
              <Select
                id="d-type"
                value={dType}
                onChange={(e) => setDType(e.target.value as typeof dType)}
              >
                <option value="none">None</option>
                <option value="percent">Percent</option>
                <option value="amount">Fixed amount</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="d-value">
                {dType === "percent" ? "Percent off" : `Amount off (${currency})`}
              </Label>
              <Input
                id="d-value"
                type="number"
                min="0"
                max={dType === "percent" ? 100 : undefined}
                step={dType === "percent" ? "1" : "0.01"}
                value={dValue}
                onChange={(e) => setDValue(e.target.value)}
                disabled={dType === "none"}
                className="font-mono"
              />
            </div>
          </div>
          {dType !== "none" && (
            <div className="mt-2">
              <Label htmlFor="d-reason">Reason (shown to the customer)</Label>
              <Input
                id="d-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Repeat customer, goodwill on delayed sailing"
              />
            </div>
          )}
        </div>

        {/* Breakdown */}
        <div className="space-y-1.5 rounded-lg bg-surface p-3 text-sm">
          <Row label="Items" value={formatCurrency(preview.itemsTotal, currency)} />
          {(shipment.door_to_door || preview.pickupFee > 0) && (
            <Row label="Pickup" value={formatCurrency(preview.pickupFee, currency)} />
          )}
          <Row
            label="Subtotal"
            value={formatCurrency(preview.subtotal, currency)}
            className="border-t border-border pt-1.5"
          />
          {preview.discountAmount > 0 && (
            <Row
              label={`Discount${dType === "percent" ? ` (${Number(dValue) || 0}%)` : ""}`}
              value={`- ${formatCurrency(preview.discountAmount, currency)}`}
              emphasis="discount"
            />
          )}
          <Row
            label="Total"
            value={formatCurrency(preview.total, currency)}
            className="border-t border-border pt-1.5"
            emphasis="total"
          />
        </div>

        {preview.hasUnquotedItems && (
          <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Some items are still unpriced, so this total is not final yet.
          </p>
        )}

        <Button
          variant="gold"
          className="w-full"
          onClick={save}
          loading={saving}
          disabled={saving || !changed}
        >
          <Check className="h-4 w-4" /> {changed ? "Save pricing" : "No changes"}
        </Button>
      </CardContent>
    </Card>
  );
}

function Row({
  label,
  value,
  className,
  emphasis,
}: {
  label: string;
  value: string;
  className?: string;
  emphasis?: "discount" | "total";
}) {
  return (
    <div className={`flex items-center justify-between gap-3 ${className ?? ""}`}>
      <span
        className={
          emphasis === "total" ? "font-semibold text-navy" : "text-ink-muted"
        }
      >
        {label}
      </span>
      <span
        className={`font-mono ${
          emphasis === "total"
            ? "text-base font-bold text-navy"
            : emphasis === "discount"
            ? "font-semibold text-emerald-700"
            : "text-ink"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
