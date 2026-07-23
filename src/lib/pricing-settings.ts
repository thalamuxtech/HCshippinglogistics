"use client";

// ─────────────────────────────────────────────────────────────
// Pricing settings — admin-editable RORO rates, vehicle-class rules,
// air-freight rate, and terms/storage policy. Stored in Firestore at
// site_content/pricing and read at runtime with the built-in constants as
// the fallback (SEO-safe, no flash: defaults render immediately, live values
// hydrate in). Mirrors the ManagedText caching approach.
// ─────────────────────────────────────────────────────────────

import * as React from "react";
import { getSiteContent } from "./db";
import {
  RORO_LINES,
  VEHICLE_CLASSES,
  AIR_RATE_PER_LB,
  DIM_WEIGHT_DIVISOR,
  COMPANY,
} from "./constants";
import type { ShippingLine, VehicleClass } from "./types";

export interface RoroLineSetting {
  label: string;
  classA: number;
  classB: number;
  classC: string;
}

export interface VehicleClassSetting {
  label: string;
  basis: string;
}

export interface PricingSettings {
  air: {
    ratePerLb: number;
    dimDivisor: number;
  };
  roroLines: Record<ShippingLine, RoroLineSetting>;
  vehicleClasses: Record<VehicleClass, VehicleClassSetting>;
  storage: {
    freeDays: number;
    dailyChargeNaira: number;
  };
  terms: string[];
}

// Defaults derived from the compiled constants.
export const PRICING_DEFAULTS: PricingSettings = {
  air: { ratePerLb: AIR_RATE_PER_LB, dimDivisor: DIM_WEIGHT_DIVISOR },
  roroLines: {
    grimaldi: { ...RORO_LINES.grimaldi },
    sallaum: { ...RORO_LINES.sallaum },
    msc: { ...RORO_LINES.msc },
  },
  vehicleClasses: {
    class_a: { ...VEHICLE_CLASSES.class_a },
    class_b: { ...VEHICLE_CLASSES.class_b },
    class_c: { ...VEHICLE_CLASSES.class_c },
  },
  storage: {
    freeDays: COMPANY.storagePolicy.freeDays,
    dailyChargeNaira: COMPANY.storagePolicy.dailyChargeNaira,
  },
  terms: [...COMPANY.terms],
};

// Deep-merge a stored (possibly partial) settings doc onto the defaults so a
// missing field always falls back cleanly.
export function mergePricingSettings(
  stored: Partial<PricingSettings> | null | undefined
): PricingSettings {
  if (!stored) return PRICING_DEFAULTS;
  const s = stored;
  const line = (k: ShippingLine): RoroLineSetting => ({
    ...PRICING_DEFAULTS.roroLines[k],
    ...(s.roroLines?.[k] || {}),
  });
  const vc = (k: VehicleClass): VehicleClassSetting => ({
    ...PRICING_DEFAULTS.vehicleClasses[k],
    ...(s.vehicleClasses?.[k] || {}),
  });
  return {
    air: { ...PRICING_DEFAULTS.air, ...(s.air || {}) },
    roroLines: { grimaldi: line("grimaldi"), sallaum: line("sallaum"), msc: line("msc") },
    vehicleClasses: { class_a: vc("class_a"), class_b: vc("class_b"), class_c: vc("class_c") },
    storage: { ...PRICING_DEFAULTS.storage, ...(s.storage || {}) },
    terms:
      Array.isArray(s.terms) && s.terms.length > 0
        ? s.terms.filter((t) => typeof t === "string")
        : PRICING_DEFAULTS.terms,
  };
}

// ── Module-level cache shared across hook instances (one fetch per page) ──
let cache: PricingSettings | undefined;
const listeners = new Set<() => void>();
let inflight: Promise<void> | null = null;

function ensureLoaded() {
  if (cache !== undefined) return;
  if (!inflight) {
    inflight = getSiteContent("pricing")
      .then((d) => {
        cache = mergePricingSettings(d as Partial<PricingSettings> | null);
      })
      .catch(() => {
        cache = PRICING_DEFAULTS;
      })
      .finally(() => {
        listeners.forEach((l) => l());
      });
  }
}

/**
 * Read the live pricing settings. Returns PRICING_DEFAULTS until the Firestore
 * doc resolves, so calculators render instantly with correct-by-default values.
 */
export function usePricingSettings(): PricingSettings {
  const [, force] = React.useReducer((n) => n + 1, 0);
  React.useEffect(() => {
    ensureLoaded();
    if (cache !== undefined) return;
    const l = () => force();
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return cache ?? PRICING_DEFAULTS;
}

// Allow the admin editor to refresh the shared cache after saving.
export function primePricingCache(settings: PricingSettings) {
  cache = settings;
  listeners.forEach((l) => l());
}
