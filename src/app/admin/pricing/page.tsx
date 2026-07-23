"use client";

import * as React from "react";
import { Tags, Search, Save } from "lucide-react";
import { listPriceItems, upsertPriceItem, logActivity } from "@/lib/db";
import type { PriceListItem } from "@/lib/types";
import { SEA_PRICE_LIST } from "@/lib/constants";
import { useAuth } from "@/components/providers/AuthProvider";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton, EmptyState } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/utils";

interface Row {
  s_n: number;
  dimensions: string;
  description: string;
  price: number;
  category: string;
}

export default function AdminPricingPage() {
  const { user } = useAuth();
  const toast = useToast();

  const [loading, setLoading] = React.useState(true);
  const [rows, setRows] = React.useState<Row[]>([]);
  const [q, setQ] = React.useState("");
  const [savingSn, setSavingSn] = React.useState<number | null>(null);
  const [dirty, setDirty] = React.useState<Record<number, boolean>>({});

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const items = await listPriceItems();
        const source: Row[] =
          items.length > 0
            ? items.map((i: PriceListItem) => ({
                s_n: i.s_n,
                dimensions: i.dimensions,
                description: i.description,
                price: i.price,
                category: i.category,
              }))
            : SEA_PRICE_LIST.map((i) => ({ ...i }));
        if (alive) setRows(source.sort((a, b) => a.s_n - b.s_n));
      } catch {
        if (alive) setRows(SEA_PRICE_LIST.map((i) => ({ ...i })));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const filtered = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (r) =>
        r.description.toLowerCase().includes(term) ||
        r.category.toLowerCase().includes(term) ||
        r.dimensions.toLowerCase().includes(term)
    );
  }, [rows, q]);

  function update(s_n: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.s_n === s_n ? { ...r, ...patch } : r)));
    setDirty((d) => ({ ...d, [s_n]: true }));
  }

  async function save(row: Row) {
    if (!user) return;
    setSavingSn(row.s_n);
    try {
      await upsertPriceItem(String(row.s_n), {
        s_n: row.s_n,
        dimensions: row.dimensions,
        description: row.description,
        price: Number(row.price) || 0,
        category: row.category,
        effective_date: new Date().toISOString().slice(0, 10),
      });
      await logActivity({
        actor_id: user.id,
        actor_name: user.full_name,
        actor_role: "admin",
        action: "updated price item",
        target: row.description,
        meta: { s_n: row.s_n, price: row.price },
      });
      setDirty((d) => ({ ...d, [row.s_n]: false }));
      toast.success("Saved", `${row.description} updated.`);
    } catch {
      toast.error("Save failed", "Could not save this price item.");
    } finally {
      setSavingSn(null);
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Sea cargo price list</CardTitle>
          <CardDescription>
            Edit the price or description for any item and save it individually. Changes take effect
            immediately for new quotes.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card className="p-4">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
            aria-hidden
          />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search items by name, category, or dimensions…"
            className="pl-9"
            aria-label="Search price items"
          />
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={<Tags className="h-6 w-6" />}
              title="No matching items"
              description="Try a different search term."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50 text-left text-xs uppercase tracking-wide text-ink-muted">
                  <th className="px-4 py-3 font-semibold">#</th>
                  <th className="px-4 py-3 font-semibold">Category</th>
                  <th className="px-4 py-3 font-semibold">Dimensions</th>
                  <th className="px-4 py-3 font-semibold">Description</th>
                  <th className="px-4 py-3 font-semibold">Price (USD)</th>
                  <th className="px-4 py-3 text-right font-semibold">Save</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.s_n} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-mono text-xs text-ink-muted">{r.s_n}</td>
                    <td className="px-4 py-3">
                      <Badge variant="muted">{r.category}</Badge>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-ink-muted">{r.dimensions}</td>
                    <td className="px-4 py-3">
                      <Input
                        value={r.description}
                        onChange={(e) => update(r.s_n, { description: e.target.value })}
                        className="h-9 min-w-[180px]"
                        aria-label={`Description for item ${r.s_n}`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={0}
                          step="1"
                          value={r.price}
                          onChange={(e) =>
                            update(r.s_n, { price: e.target.valueAsNumber || 0 })
                          }
                          className="h-9 w-28 font-mono"
                          aria-label={`Price for item ${r.s_n}`}
                        />
                        <span className="whitespace-nowrap text-xs text-ink-muted">
                          {formatCurrency(Number(r.price) || 0)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant={dirty[r.s_n] ? "primary" : "outline"}
                        onClick={() => save(r)}
                        loading={savingSn === r.s_n}
                        disabled={savingSn !== null || !dirty[r.s_n]}
                      >
                        <Save className="h-3.5 w-3.5" /> Save
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
