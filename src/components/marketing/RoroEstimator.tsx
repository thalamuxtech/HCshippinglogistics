"use client";

import * as React from "react";
import { Truck, Scale, Anchor } from "lucide-react";
import { buildRoroQuote, classifyVehicle } from "@/lib/pricing";
import { usePricingSettings } from "@/lib/pricing-settings";
import type { ShippingLine } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Input, Label, Select, FieldHint } from "@/components/ui/input";

const LINES: ShippingLine[] = ["grimaldi", "sallaum", "msc"];

export function RoroEstimator() {
  const settings = usePricingSettings();
  const [line, setLine] = React.useState<ShippingLine>("grimaldi");
  const [curbWeight, setCurbWeight] = React.useState("");

  const weight = React.useMemo(() => {
    const n = parseFloat(curbWeight);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [curbWeight]);

  const vehicleClass = classifyVehicle(weight);
  const quote = React.useMemo(
    () => buildRoroQuote(line, vehicleClass, settings.roroLines),
    [line, vehicleClass, settings.roroLines]
  );
  const classMeta = settings.vehicleClasses[vehicleClass];

  return (
    <Card className="overflow-hidden shadow-premium">
      <div className="grid md:grid-cols-2">
        <div className="p-6 sm:p-8">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-navy text-gold-300">
              <Truck className="h-4.5 w-4.5" />
            </span>
            <h3 className="text-lg font-bold text-navy">RORO Estimator</h3>
          </div>
          <p className="mt-2 text-sm text-ink-muted">
            Pick a shipping line and enter your vehicle&apos;s curb weight for an instant class and
            rate.
          </p>

          <div className="mt-6 space-y-5">
            <div>
              <Label htmlFor="roro-line" required>
                <span className="inline-flex items-center gap-1.5">
                  <Anchor className="h-3.5 w-3.5" /> Shipping line
                </span>
              </Label>
              <Select
                id="roro-line"
                value={line}
                onChange={(e) => setLine(e.target.value as ShippingLine)}
              >
                {LINES.map((key) => (
                  <option key={key} value={key}>
                    {settings.roroLines[key].label}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label htmlFor="roro-weight" required>
                <span className="inline-flex items-center gap-1.5">
                  <Scale className="h-3.5 w-3.5" /> Curb weight (lb)
                </span>
              </Label>
              <Input
                id="roro-weight"
                type="number"
                inputMode="decimal"
                min={0}
                step="50"
                value={curbWeight}
                onChange={(e) => setCurbWeight(e.target.value)}
                placeholder="e.g. 3800"
                className="font-mono"
              />
              <FieldHint>Class A ≤ 4,000 lbs · Class B &gt; 4,000 lbs · Class C by dimensions</FieldHint>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden bg-navy-gradient p-6 text-white sm:p-8">
          <div className="pointer-events-none absolute inset-0 bg-hero-radial opacity-60" />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold-200">
              Estimated rate
            </p>
            <div className="mt-2 font-mono text-4xl font-bold text-gold">
              {quote.quoted ? "Custom" : formatCurrency(quote.total)}
            </div>
            <p className="mt-1 text-xs text-white/60">
              {settings.roroLines[line].label}
            </p>

            <dl className="mt-6 space-y-3 text-sm">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <dt className="text-white/70">Curb weight</dt>
                <dd className="font-mono font-semibold">
                  {weight > 0 ? `${weight.toLocaleString()} lb` : "-"}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-white/70">Vehicle class</dt>
                <dd className="text-right font-semibold text-gold-200">{classMeta.label}</dd>
              </div>
            </dl>

            <p className="mt-5 rounded-lg bg-white/5 p-3 text-xs text-white/70 ring-1 ring-white/10">
              {quote.quoted
                ? "Trucks & trailers (Class C) are quoted individually by volume and dimensions. Contact us for a formal quote."
                : classMeta.basis}
            </p>
            <p className="mt-4 text-[11px] leading-relaxed text-white/45">
              Base ocean rate only. Excludes destination port, clearance, and last-mile charges.
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
