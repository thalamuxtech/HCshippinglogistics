"use client";

import * as React from "react";
import {
  Ship,
  Plane,
  Truck,
  ArrowUpDown,
  ArrowRight,
  Calculator,
} from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Reveal } from "@/components/marketing/Reveal";
import {
  SEA_PRICE_LIST,
  PRICE_CATEGORIES,
  AIR_RATE_PER_LB,
  RORO_LINES,
} from "@/lib/constants";
import type { ShippingLine } from "@/lib/types";
import { formatCurrency, cn } from "@/lib/utils";

type SortKey = "s_n" | "price" | "dimensions";
type SortDir = "asc" | "desc";

const lineKeys = Object.keys(RORO_LINES) as ShippingLine[];

export default function PricingPage() {
  const [category, setCategory] = React.useState<string>("All");
  const [sortKey, setSortKey] = React.useState<SortKey>("s_n");
  const [sortDir, setSortDir] = React.useState<SortDir>("asc");

  const rows = React.useMemo(() => {
    const filtered =
      category === "All"
        ? [...SEA_PRICE_LIST]
        : SEA_PRICE_LIST.filter((i) => i.category === category);
    filtered.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "price") cmp = a.price - b.price;
      else if (sortKey === "dimensions") cmp = a.dimensions.localeCompare(b.dimensions);
      else cmp = a.s_n - b.s_n;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return filtered;
  }, [category, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const chips = ["All", ...PRICE_CATEGORIES];

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-navy-gradient text-white">
        <div className="pointer-events-none absolute inset-0 bg-hero-radial" />
        <div className="container-page relative py-20 sm:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <Reveal>
              <span className="eyebrow text-gold-200">Transparent pricing</span>
            </Reveal>
            <Reveal delay={0.08}>
              <h1 className="mt-4 text-balance text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl">
                Every rate, out in the open.
              </h1>
            </Reveal>
            <Reveal delay={0.16}>
              <p className="mx-auto mt-6 max-w-2xl text-balance text-lg leading-relaxed text-white/75">
                Per-item sea cargo pricing, a flat air rate, and class-based RORO rates. Clear,
                published rates with no hidden fees.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Service summary cards */}
      <section className="container-page py-16 sm:py-20">
        <div className="grid gap-6 md:grid-cols-3">
          <Reveal>
            <Card className="flex h-full flex-col p-6">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-navy text-gold-300 shadow-premium">
                <Ship className="h-5 w-5" />
              </span>
              <h2 className="mt-5 text-lg font-bold text-navy">Sea Cargo</h2>
              <p className="mt-1 text-sm text-ink-muted">Priced per item. See the full table below.</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="font-mono text-3xl font-bold text-navy">
                  {formatCurrency(Math.min(...SEA_PRICE_LIST.map((i) => i.price)))}
                </span>
                <span className="text-sm text-ink-muted">starting</span>
              </div>
              <ButtonLink href="/services/sea" variant="link" className="mt-auto justify-start px-0 pt-4">
                Sea Cargo details <ArrowRight className="h-4 w-4" />
              </ButtonLink>
            </Card>
          </Reveal>

          <Reveal delay={0.06}>
            <Card className="flex h-full flex-col p-6">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-navy text-gold-300 shadow-premium">
                <Plane className="h-5 w-5" />
              </span>
              <h2 className="mt-5 text-lg font-bold text-navy">Air Freight</h2>
              <p className="mt-1 text-sm text-ink-muted">Flat rate on billable weight, 7–10 days.</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="font-mono text-3xl font-bold text-navy">
                  {formatCurrency(AIR_RATE_PER_LB)}
                </span>
                <span className="text-sm text-ink-muted">/ lb</span>
              </div>
              <ButtonLink
                href="/services/air#calculator"
                variant="link"
                className="mt-auto justify-start px-0 pt-4"
              >
                <Calculator className="h-4 w-4" /> Open air calculator
              </ButtonLink>
            </Card>
          </Reveal>

          <Reveal delay={0.12}>
            <Card className="flex h-full flex-col p-6">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-navy text-gold-300 shadow-premium">
                <Truck className="h-5 w-5" />
              </span>
              <h2 className="mt-5 text-lg font-bold text-navy">RORO Vehicles</h2>
              <p className="mt-1 text-sm text-ink-muted">Class-based ocean rates by carrier.</p>
              <ul className="mt-4 space-y-1.5 text-sm">
                {lineKeys.map((key) => (
                  <li key={key} className="flex items-center justify-between gap-2">
                    <span className="text-ink-muted">{RORO_LINES[key].label.split(" ")[0]}</span>
                    <span className="font-mono font-semibold text-navy">
                      ${RORO_LINES[key].classA.toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
              <ButtonLink
                href="/services/roro#estimator"
                variant="link"
                className="mt-auto justify-start px-0 pt-4"
              >
                <Calculator className="h-4 w-4" /> Open RORO estimator
              </ButtonLink>
            </Card>
          </Reveal>
        </div>
      </section>

      {/* Sea price table */}
      <section className="container-page pb-20 sm:pb-24">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="eyebrow">Sea Cargo price list</span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">
            All 28 items
          </h2>
          <p className="mt-4 text-ink-muted">
            Filter by category and sort by price or dimensions. Rates effective January 1, 2024.
          </p>
        </Reveal>

        {/* Category chips */}
        <Reveal delay={0.06}>
          <div className="mt-10 flex flex-wrap justify-center gap-2">
            {chips.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                aria-pressed={category === c}
                className={cn(
                  "cursor-pointer rounded-full px-4 py-1.5 text-sm font-medium transition-colors focus-ring",
                  category === c
                    ? "bg-navy text-white shadow-card"
                    : "border border-border bg-white text-ink-muted hover:bg-surface hover:text-navy"
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <Card className="mt-8 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface text-left">
                    <th className="px-5 py-3.5">
                      <SortButton
                        label="S/N"
                        active={sortKey === "s_n"}
                        dir={sortDir}
                        onClick={() => toggleSort("s_n")}
                      />
                    </th>
                    <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                      Description
                    </th>
                    <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                      Category
                    </th>
                    <th className="px-5 py-3.5">
                      <SortButton
                        label="Dimensions"
                        active={sortKey === "dimensions"}
                        dir={sortDir}
                        onClick={() => toggleSort("dimensions")}
                      />
                    </th>
                    <th className="px-5 py-3.5 text-right">
                      <SortButton
                        label="Price"
                        active={sortKey === "price"}
                        dir={sortDir}
                        onClick={() => toggleSort("price")}
                        align="right"
                      />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((item) => (
                    <tr
                      key={item.s_n}
                      className="border-b border-border/60 transition-colors last:border-0 hover:bg-surface/60"
                    >
                      <td className="px-5 py-3.5 font-mono text-ink-muted">
                        {String(item.s_n).padStart(2, "0")}
                      </td>
                      <td className="px-5 py-3.5 font-medium text-navy">{item.description}</td>
                      <td className="px-5 py-3.5">
                        <Badge variant="muted">{item.category}</Badge>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-ink-muted">
                        {item.dimensions}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono font-semibold text-navy">
                        {formatCurrency(item.price)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </Reveal>
      </section>

      {/* CTA */}
      <section className="container-page pb-8">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-navy-gradient px-8 py-14 text-center text-white sm:px-16 sm:py-16">
            <div className="pointer-events-none absolute inset-0 bg-hero-radial" />
            <div className="relative mx-auto max-w-2xl">
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                Ready to lock in a rate?
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-white/75">
                Start your order to build a full quote, request a pickup, and track your shipment
                through all 8 stages.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <ButtonLink href="/order" variant="gold" size="lg" className="w-full sm:w-auto">
                  Start your order <ArrowRight className="h-4 w-4" />
                </ButtonLink>
                <ButtonLink
                  href="/contact"
                  size="lg"
                  className="w-full border border-white/20 bg-white/5 text-white hover:bg-white/10 sm:w-auto"
                >
                  Talk to sales
                </ButtonLink>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}

function SortButton({
  label,
  active,
  dir,
  onClick,
  align = "left",
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  align?: "left" | "right";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold uppercase tracking-wider transition-colors focus-ring rounded-md",
        active ? "text-navy" : "text-ink-muted hover:text-navy",
        align === "right" && "flex-row-reverse"
      )}
      aria-label={`Sort by ${label}${active ? `, ${dir === "asc" ? "ascending" : "descending"}` : ""}`}
    >
      {label}
      <ArrowUpDown className={cn("h-3.5 w-3.5", active ? "text-gold" : "opacity-50")} />
    </button>
  );
}
