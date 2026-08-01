"use client";

// Inline live rates for marketing prose.
//
// The air and RORO service pages are server components (they export Metadata),
// so they cannot call usePricingSettings themselves. These tiny client wrappers
// let a quoted figure inside otherwise-static copy track what the admin sets in
// site_content/pricing — previously the pages hardcoded the constant, so an
// admin rate change left the marketing copy advertising the old price while the
// calculator on the same page quoted the new one.
//
// Renders the built-in default synchronously, so there is no flash and the
// server-rendered HTML still contains a correct figure for crawlers.

import { usePricingSettings } from "@/lib/pricing-settings";
import { formatCurrency } from "@/lib/utils";

/** The air freight rate per pound, e.g. "$9.50". */
export function AirRate() {
  const settings = usePricingSettings();
  return <>{formatCurrency(settings.air.ratePerLb)}</>;
}

/** The dimensional-weight divisor, e.g. "139". */
export function DimDivisor() {
  const settings = usePricingSettings();
  return <>{settings.air.dimDivisor}</>;
}
