"use client";

import * as React from "react";
import { Plane, Scale, Ruler, Package } from "lucide-react";
import { buildAirQuote } from "@/lib/pricing";
import { AIR_RATE_PER_LB, DIM_WEIGHT_DIVISOR } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Input, Label, FieldHint } from "@/components/ui/input";

function toNum(v: string): number {
  const n = parseFloat(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function AirCalculator() {
  const [weight, setWeight] = React.useState("");
  const [length, setLength] = React.useState("");
  const [width, setWidth] = React.useState("");
  const [height, setHeight] = React.useState("");

  const w = toNum(weight);
  const l = toNum(length);
  const wd = toNum(width);
  const h = toNum(height);
  const hasDims = l > 0 && wd > 0 && h > 0;

  const quote = React.useMemo(
    () => buildAirQuote(w, hasDims ? { length: l, width: wd, height: h } : undefined),
    [w, l, wd, h, hasDims]
  );

  const dimApplies = quote.dimWeight > quote.actualWeight;

  return (
    <Card className="overflow-hidden shadow-premium">
      <div className="grid md:grid-cols-2">
        {/* Inputs */}
        <div className="p-6 sm:p-8">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-navy text-gold">
              <Plane className="h-4.5 w-4.5" />
            </span>
            <h3 className="text-lg font-bold text-navy">Air Freight Calculator</h3>
          </div>
          <p className="mt-2 text-sm text-ink-muted">
            Enter your package weight. Add dimensions for an accurate dimensional-weight estimate.
          </p>

          <div className="mt-6 space-y-5">
            <div>
              <Label htmlFor="air-weight" required>
                <span className="inline-flex items-center gap-1.5">
                  <Scale className="h-3.5 w-3.5" /> Actual weight (lb)
                </span>
              </Label>
              <Input
                id="air-weight"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.1"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="e.g. 22"
                className="font-mono"
              />
            </div>

            <div>
              <Label>
                <span className="inline-flex items-center gap-1.5">
                  <Ruler className="h-3.5 w-3.5" /> Dimensions (in), optional
                </span>
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "air-l", val: length, set: setLength, ph: "L" },
                  { id: "air-w", val: width, set: setWidth, ph: "W" },
                  { id: "air-h", val: height, set: setHeight, ph: "H" },
                ].map((f) => (
                  <Input
                    key={f.id}
                    id={f.id}
                    aria-label={`${f.ph} in inches`}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.1"
                    value={f.val}
                    onChange={(e) => f.set(e.target.value)}
                    placeholder={f.ph}
                    className="text-center font-mono"
                  />
                ))}
              </div>
              <FieldHint>Dimensional weight = (L × W × H) ÷ {DIM_WEIGHT_DIVISOR}</FieldHint>
            </div>
          </div>
        </div>

        {/* Result */}
        <div className="relative overflow-hidden bg-navy-gradient p-6 text-white sm:p-8">
          <div className="pointer-events-none absolute inset-0 bg-hero-radial opacity-60" />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold-200">
              Estimated quote
            </p>
            <div className="mt-2 font-mono text-4xl font-bold text-gold">
              {formatCurrency(quote.total)}
            </div>
            <p className="mt-1 text-xs text-white/60">
              at {formatCurrency(AIR_RATE_PER_LB)}/lb · billable weight
            </p>

            <dl className="mt-6 space-y-3 text-sm">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <dt className="inline-flex items-center gap-2 text-white/70">
                  <Package className="h-4 w-4" /> Actual weight
                </dt>
                <dd className="font-mono font-semibold">{quote.actualWeight.toFixed(2)} lb</dd>
              </div>
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <dt className="inline-flex items-center gap-2 text-white/70">
                  <Ruler className="h-4 w-4" /> Dimensional weight
                </dt>
                <dd className="font-mono font-semibold">
                  {hasDims ? `${quote.dimWeight.toFixed(2)} lb` : "-"}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="inline-flex items-center gap-2 font-semibold text-gold-200">
                  <Scale className="h-4 w-4" /> Billable weight
                </dt>
                <dd className="font-mono text-base font-bold text-gold">
                  {quote.billableWeight.toFixed(2)} lb
                </dd>
              </div>
            </dl>

            {hasDims && (
              <p className="mt-5 rounded-lg bg-white/5 p-3 text-xs text-white/70 ring-1 ring-white/10">
                {dimApplies
                  ? "Dimensional weight exceeds actual weight, so you are billed on volume."
                  : "Actual weight exceeds dimensional weight, so you are billed on weight."}
              </p>
            )}
            <p className="mt-4 text-[11px] leading-relaxed text-white/45">
              Estimate only. Final pricing is confirmed after inspection at our USA warehouse.
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
