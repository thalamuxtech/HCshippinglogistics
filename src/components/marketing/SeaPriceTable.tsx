"use client";

// Sea-cargo price table, reading the live admin-managed price list.
//
// Split out of the (server) sea service page so that page keeps its exported
// Metadata for SEO while the table itself can use the client-side hook. The hook
// returns the built-in constants synchronously, so the first paint is identical
// to the old hardcoded render — no flash, no layout shift — and live prices
// replace them once Firestore resolves.

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { useSeaPriceList } from "@/lib/sea-price-list";
import { formatCurrency } from "@/lib/utils";

export function SeaPriceTable() {
  const items = useSeaPriceList();

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-border bg-surface text-left">
            <th className="px-5 py-3.5 font-mono text-xs font-semibold uppercase tracking-wider text-ink-muted">
              S/N
            </th>
            <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Description
            </th>
            <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Category
            </th>
            <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Dimensions
            </th>
            <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Price
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
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
              <td className="px-5 py-3.5 font-mono text-xs text-ink-muted">{item.dimensions}</td>
              <td className="px-5 py-3.5 text-right font-mono font-semibold text-navy">
                {formatCurrency(item.price)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
