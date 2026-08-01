"use client";

// RORO line rates and vehicle classes, read from the live admin-managed pricing
// settings (site_content/pricing).
//
// Split out of the (server) RORO service page so that page keeps its exported
// Metadata while these figures track what the admin sets. Previously they came
// from the hardcoded constants, so an admin rate change left this page
// advertising the old base rate while the estimator directly below it quoted the
// new one. The hook returns the built-in defaults synchronously, so the
// server-rendered HTML still carries correct figures for crawlers.

import * as React from "react";
import { Anchor, Car } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Reveal } from "@/components/marketing/Reveal";
import { usePricingSettings } from "@/lib/pricing-settings";
import type { ShippingLine, VehicleClass } from "@/lib/types";

export function RoroLineCards() {
  const { roroLines } = usePricingSettings();
  const keys = Object.keys(roroLines) as ShippingLine[];

  return (
    <div className="mt-14 grid gap-6 md:grid-cols-3">
      {keys.map((key, i) => {
        const line = roroLines[key];
        return (
          <Reveal key={key} delay={i * 0.06}>
            <Card className="flex h-full flex-col p-6">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-navy text-gold-300 shadow-premium">
                <Anchor className="h-5 w-5" />
              </span>
              <h3 className="mt-5 font-bold text-navy">{line.label}</h3>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="font-mono text-3xl font-bold text-navy">
                  ${line.classA.toLocaleString()}
                </span>
                <span className="text-sm text-ink-muted">base</span>
              </div>
              <p className="mt-1 text-xs text-ink-muted">Class A &amp; Class B ocean rate</p>
              <p className="mt-4 border-t border-border pt-4 text-sm text-ink-muted">
                Class C (trucks &amp; trailers): {line.classC}
              </p>
            </Card>
          </Reveal>
        );
      })}
    </div>
  );
}

export function VehicleClassCards() {
  const { vehicleClasses } = usePricingSettings();
  const keys = Object.keys(vehicleClasses) as VehicleClass[];

  return (
    <div className="mt-14 grid gap-6 md:grid-cols-3">
      {keys.map((key, i) => {
        const cls = vehicleClasses[key];
        return (
          <Reveal key={key} delay={i * 0.06}>
            <Card className="h-full p-6">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-navy/5 text-navy">
                  <Car className="h-5 w-5" />
                </span>
                <Badge variant="gold">{key.replace("_", " ").toUpperCase()}</Badge>
              </div>
              <h3 className="mt-4 font-bold text-navy">{cls.label}</h3>
              <p className="mt-1.5 text-sm text-ink-muted">{cls.basis}</p>
            </Card>
          </Reveal>
        );
      })}
    </div>
  );
}
