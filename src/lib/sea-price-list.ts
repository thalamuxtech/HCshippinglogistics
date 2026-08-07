"use client";

// ─────────────────────────────────────────────────────────────
// Live sea-cargo price list.
//
// The admin Pricing screen writes every row to Firestore `price_list`, but the
// public pricing page, the sea service page and, most importantly, the
// customer order form all imported the hardcoded SEA_PRICE_LIST from
// constants.ts. Admin price edits therefore never reached customers, who were
// quoted stale figures at checkout.
//
// Same shape and caching as usePricingSettings (site_content/pricing): built-in
// constants render instantly so there is no layout flash and the page stays
// SEO-safe, then live values hydrate in. One fetch per page load, shared across
// every hook instance.
// ─────────────────────────────────────────────────────────────

import * as React from "react";
import { listPriceItems } from "./db";
import { SEA_PRICE_LIST, type SeedPriceItem } from "./constants";

// ── Module-level cache shared across hook instances (one fetch per page) ──
let cache: SeedPriceItem[] | undefined;
const listeners = new Set<() => void>();
let inflight: Promise<void> | null = null;

function normalize(rows: { s_n?: number; dimensions?: string; description?: string; price?: number; category?: string }[]): SeedPriceItem[] {
  const clean = rows
    .filter((r) => typeof r.s_n === "number" && typeof r.price === "number" && r.description)
    .map((r) => ({
      s_n: r.s_n as number,
      dimensions: r.dimensions ?? "",
      description: r.description as string,
      price: r.price as number,
      category: r.category ?? "Other",
    }));
  // An empty or unreadable collection must fall back to the built-ins rather
  // than showing customers an empty price list.
  return clean.length > 0 ? clean.sort((a, b) => a.s_n - b.s_n) : SEA_PRICE_LIST;
}

function ensureLoaded() {
  if (cache !== undefined) return;
  if (!inflight) {
    inflight = listPriceItems()
      .then((rows) => {
        cache = normalize(rows);
      })
      .catch(() => {
        cache = SEA_PRICE_LIST;
      })
      .finally(() => {
        listeners.forEach((l) => l());
      });
  }
}

/**
 * Read the live sea price list. Returns the built-in SEA_PRICE_LIST until the
 * Firestore read resolves, so pricing tables and the order form render
 * immediately with correct-by-default values.
 */
export function useSeaPriceList(): SeedPriceItem[] {
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
  return cache ?? SEA_PRICE_LIST;
}

/** Categories present in the live list, in first-seen order. */
export function categoriesOf(list: SeedPriceItem[]): string[] {
  const seen: string[] = [];
  for (const item of list) {
    if (!seen.includes(item.category)) seen.push(item.category);
  }
  return seen;
}

/** Let the admin editor refresh the shared cache immediately after saving. */
export function primeSeaPriceCache(rows: SeedPriceItem[]) {
  cache = normalize(rows);
  listeners.forEach((l) => l());
}
