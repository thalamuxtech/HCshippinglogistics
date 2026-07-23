// ─────────────────────────────────────────────────────────────
// Quote / price-build engine — used by signup price builder,
// order forms, and public calculators. Pure functions, no I/O.
// ─────────────────────────────────────────────────────────────

import { AIR_RATE_PER_LB, computeAirPrice, RORO_LINES, SEA_PRICE_LIST } from "./constants";
import type { SeedPriceItem } from "./constants";
import type { ShippingLine, VehicleClass, ShipmentItem } from "./types";

export interface SeaSelection {
  s_n: number;
  quantity: number;
}

export interface SeaQuote {
  items: ShipmentItem[];
  itemCount: number;
  total: number;
}

/** Build a Sea Cargo quote from a map of selected item S/N -> quantity. */
export function buildSeaQuote(
  selections: SeaSelection[],
  priceList: SeedPriceItem[] = SEA_PRICE_LIST
): SeaQuote {
  const byId = new Map(priceList.map((p) => [p.s_n, p]));
  const items: ShipmentItem[] = [];
  let total = 0;
  let itemCount = 0;

  for (const sel of selections) {
    const p = byId.get(sel.s_n);
    if (!p || sel.quantity <= 0) continue;
    const lineTotal = p.price * sel.quantity;
    total += lineTotal;
    itemCount += sel.quantity;
    items.push({
      price_list_id: String(p.s_n),
      description: p.description,
      category: p.category,
      dimensions: p.dimensions,
      unit_price: p.price,
      quantity: sel.quantity,
      line_total: lineTotal,
    });
  }
  return { items, itemCount, total: Math.round(total * 100) / 100 };
}

export interface AirQuote {
  actualWeight: number;
  dimWeight: number;
  billableWeight: number;
  ratePerLb: number;
  total: number;
}

// Optional live rate/divisor (admin-editable). Falls back to constants.
export function buildAirQuote(
  weightLb: number,
  dims?: { length: number; width: number; height: number },
  opts?: { ratePerLb?: number; dimDivisor?: number }
): AirQuote {
  const ratePerLb = opts?.ratePerLb ?? AIR_RATE_PER_LB;
  const actual = Math.max(0, weightLb || 0);
  let dimWeight = 0;
  if (opts?.dimDivisor && dims && dims.length && dims.width && dims.height) {
    dimWeight =
      Math.round(((dims.length * dims.width * dims.height) / opts.dimDivisor) * 100) / 100;
  }
  if (!opts?.dimDivisor) {
    // Use the constant-based helper when no live divisor is supplied.
    const c = computeAirPrice(weightLb, dims);
    dimWeight = c.dimWeight;
  }
  const billableWeight = Math.round(Math.max(actual, dimWeight) * 100) / 100;
  return {
    actualWeight: actual,
    dimWeight,
    billableWeight,
    ratePerLb,
    total: Math.round(billableWeight * ratePerLb * 100) / 100,
  };
}

export interface RoroQuote {
  line: ShippingLine;
  vehicleClass: VehicleClass;
  quoted: boolean; // true => Class C, price determined by admin
  total: number; // 0 when quoted
  label: string;
}

// Accepts an optional live rate table (admin-editable). Falls back to the
// compiled RORO_LINES constants when not provided.
export function buildRoroQuote(
  line: ShippingLine,
  vehicleClass: VehicleClass,
  lines: Record<ShippingLine, { classA: number; classB: number; classC: string }> = RORO_LINES
): RoroQuote {
  const cfg = lines[line] || RORO_LINES[line];
  if (vehicleClass === "class_c") {
    return { line, vehicleClass, quoted: true, total: 0, label: cfg.classC };
  }
  const total = vehicleClass === "class_a" ? cfg.classA : cfg.classB;
  return { line, vehicleClass, quoted: false, total, label: `$${total.toLocaleString()}` };
}

/** Classify RORO vehicle from curb weight (Class A ≤ 4000 lbs, else Class B). */
export function classifyVehicle(curbWeightLb: number): VehicleClass {
  if (!curbWeightLb) return "class_a";
  return curbWeightLb <= 4000 ? "class_a" : "class_b";
}
