// ─────────────────────────────────────────────────────────────
// Order total: items + pickup − discount.
//
// One function, used by the admin editor, the customer portal and the invoice, so
// the three can never disagree. Duplicating this arithmetic is how a customer
// ends up seeing a different figure from the one on their invoice.
//
// No "use client" — this is pure arithmetic and the Cloud Functions mirror it.
// ─────────────────────────────────────────────────────────────

import type { Shipment, ShipmentItem } from "./types";

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export interface OrderTotals {
  /** Priced line items only. */
  itemsTotal: number;
  /** Pickup charge, 0 when not requested or not yet quoted. */
  pickupFee: number;
  /** items + pickup, before any discount. */
  subtotal: number;
  /** Money taken off (always a positive amount, or 0). */
  discountAmount: number;
  /** What the customer owes: subtotal − discount, never below zero. */
  total: number;
  /** True when pickup was requested but staff have not priced it yet. */
  pickupPending: boolean;
  /** True when any line item is still awaiting a quote. */
  hasUnquotedItems: boolean;
}

export function computeOrderTotals(
  s: Pick<
    Shipment,
    | "items"
    | "total_price"
    | "pickup_fee"
    | "pickup_fee_pending"
    | "door_to_door"
    | "discount_type"
    | "discount_value"
  >
): OrderTotals {
  const items: ShipmentItem[] = s.items ?? [];
  // Fall back to the stored total for shipments with no line items (air, RORO).
  const itemsTotal = items.length
    ? round2(items.reduce((sum, it) => sum + (Number(it.line_total) || 0), 0))
    : round2(s.total_price ?? 0);

  const pickupFee = round2(s.pickup_fee ?? 0);
  const subtotal = round2(itemsTotal + pickupFee);

  // Percent applies to the subtotal, so a discount agreed as "10% off" still
  // means 10% after pickup is added — which is what a customer expects.
  let discountAmount = 0;
  const value = Number(s.discount_value) || 0;
  if (s.discount_type === "percent" && value > 0) {
    discountAmount = round2((subtotal * Math.min(value, 100)) / 100);
  } else if (s.discount_type === "amount" && value > 0) {
    discountAmount = round2(Math.min(value, subtotal));
  }

  return {
    itemsTotal,
    pickupFee,
    subtotal,
    discountAmount,
    total: round2(Math.max(0, subtotal - discountAmount)),
    pickupPending: !!s.door_to_door && !!s.pickup_fee_pending,
    hasUnquotedItems: items.some((it) => it.needs_quote && Number(it.unit_price) === 0),
  };
}

/** Human label for a discount, e.g. "10% off" or "$25 off". */
export function discountLabel(
  type: Shipment["discount_type"],
  value?: number,
  currency = "USD"
): string {
  const v = Number(value) || 0;
  if (!type || v <= 0) return "";
  if (type === "percent") return `${v}% off`;
  const symbol = currency === "USD" ? "$" : `${currency} `;
  return `${symbol}${v.toFixed(2)} off`;
}
