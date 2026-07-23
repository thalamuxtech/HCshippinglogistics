"use client";

import * as React from "react";
import { Tags, Search, Save, Ship, Truck, Plane, FileText, Plus, Trash2 } from "lucide-react";
import {
  listPriceItems,
  upsertPriceItem,
  getSiteContent,
  setSiteContent,
  logActivity,
} from "@/lib/db";
import type { PriceListItem } from "@/lib/types";
import { SEA_PRICE_LIST } from "@/lib/constants";
import {
  PRICING_DEFAULTS,
  mergePricingSettings,
  primePricingCache,
  type PricingSettings,
} from "@/lib/pricing-settings";
import { useAuth } from "@/components/providers/AuthProvider";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton, EmptyState } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { formatCurrency, cn } from "@/lib/utils";
import type { ShippingLine, VehicleClass } from "@/lib/types";

type Tab = "sea" | "roro" | "vehicle" | "air" | "terms";

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "sea", label: "Sea cargo", icon: Ship },
  { key: "roro", label: "RORO rates", icon: Truck },
  { key: "vehicle", label: "Vehicle classes", icon: Truck },
  { key: "air", label: "Air freight", icon: Plane },
  { key: "terms", label: "Terms & storage", icon: FileText },
];

export default function AdminPricingPage() {
  const [tab, setTab] = React.useState<Tab>("sea");

  return (
    <div className="space-y-5">
      {/* Tab bar */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const active = tab === t.key;
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors focus-ring",
                active
                  ? "border-gold bg-gold/10 text-navy"
                  : "border-border bg-white text-ink/70 hover:bg-secondary/50"
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "sea" && <SeaSection />}
      {tab === "roro" && <RoroSection />}
      {tab === "vehicle" && <VehicleSection />}
      {tab === "air" && <AirSection />}
      {tab === "terms" && <TermsSection />}
    </div>
  );
}

/* ───────────────────────── Sea cargo ───────────────────────── */

interface Row {
  s_n: number;
  dimensions: string;
  description: string;
  price: number;
  category: string;
}

function SeaSection() {
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
                          onChange={(e) => update(r.s_n, { price: e.target.valueAsNumber || 0 })}
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

/* ─────────────── Shared settings loader for the non-sea tabs ─────────────── */

function useSettingsDraft() {
  const [loading, setLoading] = React.useState(true);
  const [draft, setDraft] = React.useState<PricingSettings>(PRICING_DEFAULTS);
  const [dirty, setDirty] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d = await getSiteContent("pricing");
        if (alive) setDraft(mergePricingSettings(d as Partial<PricingSettings> | null));
      } catch {
        if (alive) setDraft(PRICING_DEFAULTS);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const patch = React.useCallback((updater: (d: PricingSettings) => PricingSettings) => {
    setDraft((d) => updater(d));
    setDirty(true);
  }, []);

  return { loading, draft, setDraft, dirty, setDirty, saving, setSaving, patch };
}

function SectionSaveBar({
  dirty,
  saving,
  onSave,
}: {
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
}) {
  return (
    <div className="flex items-center justify-end">
      <Button variant="gold" onClick={onSave} loading={saving} disabled={saving || !dirty}>
        <Save className="h-4 w-4" /> Save changes
      </Button>
    </div>
  );
}

async function persist(
  draft: PricingSettings,
  user: { id: string; full_name: string } | null,
  section: string
) {
  // Persist the whole settings object (single doc) so partial sections merge safely.
  await setSiteContent("pricing", draft as unknown as Record<string, unknown>);
  primePricingCache(draft);
  if (user) {
    await logActivity({
      actor_id: user.id,
      actor_name: user.full_name,
      actor_role: "admin",
      action: `updated pricing settings (${section})`,
      target: section,
    });
  }
}

/* ───────────────────────── RORO rates ───────────────────────── */

function RoroSection() {
  const { user } = useAuth();
  const toast = useToast();
  const { loading, draft, dirty, saving, setSaving, setDirty, patch } = useSettingsDraft();

  const lines: ShippingLine[] = ["grimaldi", "sallaum", "msc"];

  async function save() {
    setSaving(true);
    try {
      await persist(draft, user, "RORO rates");
      setDirty(false);
      toast.success("Saved", "RORO rates updated for new quotes.");
    } catch {
      toast.error("Save failed", "Could not save RORO rates.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>RORO rates by shipping line</CardTitle>
          <CardDescription>
            Set the Class A and Class B flat rates (USD) per line, and the Class C note. These feed
            the RORO estimator and the order form.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {lines.map((key) => {
          const l = draft.roroLines[key];
          return (
            <Card key={key}>
              <CardContent className="space-y-3 p-5">
                <div>
                  <Label>Line name</Label>
                  <Input
                    value={l.label}
                    onChange={(e) =>
                      patch((d) => ({
                        ...d,
                        roroLines: { ...d.roroLines, [key]: { ...d.roroLines[key], label: e.target.value } },
                      }))
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Class A (USD)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={l.classA}
                      onChange={(e) =>
                        patch((d) => ({
                          ...d,
                          roroLines: {
                            ...d.roroLines,
                            [key]: { ...d.roroLines[key], classA: e.target.valueAsNumber || 0 },
                          },
                        }))
                      }
                      className="font-mono"
                    />
                  </div>
                  <div>
                    <Label>Class B (USD)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={l.classB}
                      onChange={(e) =>
                        patch((d) => ({
                          ...d,
                          roroLines: {
                            ...d.roroLines,
                            [key]: { ...d.roroLines[key], classB: e.target.valueAsNumber || 0 },
                          },
                        }))
                      }
                      className="font-mono"
                    />
                  </div>
                </div>
                <div>
                  <Label>Class C note</Label>
                  <Input
                    value={l.classC}
                    onChange={(e) =>
                      patch((d) => ({
                        ...d,
                        roroLines: { ...d.roroLines, [key]: { ...d.roroLines[key], classC: e.target.value } },
                      }))
                    }
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <SectionSaveBar dirty={dirty} saving={saving} onSave={save} />
    </div>
  );
}

/* ───────────────────────── Vehicle classes ───────────────────────── */

function VehicleSection() {
  const { user } = useAuth();
  const toast = useToast();
  const { loading, draft, dirty, saving, setSaving, setDirty, patch } = useSettingsDraft();

  const classes: VehicleClass[] = ["class_a", "class_b", "class_c"];

  async function save() {
    setSaving(true);
    try {
      await persist(draft, user, "vehicle classes");
      setDirty(false);
      toast.success("Saved", "Vehicle class rules updated.");
    } catch {
      toast.error("Save failed", "Could not save vehicle classes.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Vehicle class rules</CardTitle>
          <CardDescription>
            The label and rule/basis text shown for each RORO vehicle class on the site and order
            form.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {classes.map((key) => {
          const c = draft.vehicleClasses[key];
          return (
            <Card key={key}>
              <CardContent className="space-y-3 p-5">
                <Badge variant="navy">{key.replace("_", " ").toUpperCase()}</Badge>
                <div>
                  <Label>Label</Label>
                  <Input
                    value={c.label}
                    onChange={(e) =>
                      patch((d) => ({
                        ...d,
                        vehicleClasses: {
                          ...d.vehicleClasses,
                          [key]: { ...d.vehicleClasses[key], label: e.target.value },
                        },
                      }))
                    }
                  />
                </div>
                <div>
                  <Label>Rule / basis</Label>
                  <Textarea
                    value={c.basis}
                    onChange={(e) =>
                      patch((d) => ({
                        ...d,
                        vehicleClasses: {
                          ...d.vehicleClasses,
                          [key]: { ...d.vehicleClasses[key], basis: e.target.value },
                        },
                      }))
                    }
                    className="min-h-[70px]"
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <SectionSaveBar dirty={dirty} saving={saving} onSave={save} />
    </div>
  );
}

/* ───────────────────────── Air freight ───────────────────────── */

function AirSection() {
  const { user } = useAuth();
  const toast = useToast();
  const { loading, draft, dirty, saving, setSaving, setDirty, patch } = useSettingsDraft();

  async function save() {
    setSaving(true);
    try {
      await persist(draft, user, "air freight");
      setDirty(false);
      toast.success("Saved", "Air freight rate updated for new quotes.");
    } catch {
      toast.error("Save failed", "Could not save the air rate.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Skeleton className="h-48 w-full" />;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Air freight rate</CardTitle>
          <CardDescription>
            The per-pound rate and dimensional-weight divisor used by the air freight calculator and
            order form.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Rate per lb (USD)</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={draft.air.ratePerLb}
              onChange={(e) =>
                patch((d) => ({ ...d, air: { ...d.air, ratePerLb: e.target.valueAsNumber || 0 } }))
              }
              className="font-mono"
            />
          </div>
          <div>
            <Label>Dimensional weight divisor</Label>
            <Input
              type="number"
              min={1}
              value={draft.air.dimDivisor}
              onChange={(e) =>
                patch((d) => ({ ...d, air: { ...d.air, dimDivisor: e.target.valueAsNumber || 1 } }))
              }
              className="font-mono"
            />
            <p className="mt-1.5 text-xs text-ink-muted">
              Cubic inches per lb (industry standard is 166).
            </p>
          </div>
        </CardContent>
      </Card>

      <SectionSaveBar dirty={dirty} saving={saving} onSave={save} />
    </div>
  );
}

/* ───────────────────────── Terms & storage ───────────────────────── */

function TermsSection() {
  const { user } = useAuth();
  const toast = useToast();
  const { loading, draft, dirty, saving, setSaving, setDirty, patch } = useSettingsDraft();

  async function save() {
    setSaving(true);
    try {
      // Drop empty term lines before saving.
      const cleaned = {
        ...draft,
        terms: draft.terms.map((t) => t.trim()).filter(Boolean),
      };
      await persist(cleaned, user, "terms & storage");
      setDirty(false);
      toast.success("Saved", "Terms and storage policy updated.");
    } catch {
      toast.error("Save failed", "Could not save terms.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Terms &amp; storage policy</CardTitle>
          <CardDescription>
            Shipment terms shown on the site and invoice, plus the free-storage window and daily
            storage charge.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Free storage (days)</Label>
            <Input
              type="number"
              min={0}
              value={draft.storage.freeDays}
              onChange={(e) =>
                patch((d) => ({
                  ...d,
                  storage: { ...d.storage, freeDays: e.target.valueAsNumber || 0 },
                }))
              }
              className="font-mono"
            />
          </div>
          <div>
            <Label>Daily storage charge (₦)</Label>
            <Input
              type="number"
              min={0}
              value={draft.storage.dailyChargeNaira}
              onChange={(e) =>
                patch((d) => ({
                  ...d,
                  storage: { ...d.storage, dailyChargeNaira: e.target.valueAsNumber || 0 },
                }))
              }
              className="font-mono"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Shipment terms</CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() => patch((d) => ({ ...d, terms: [...d.terms, ""] }))}
          >
            <Plus className="h-3.5 w-3.5" /> Add term
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {draft.terms.map((t, i) => (
            <div key={i} className="flex items-start gap-2">
              <Textarea
                value={t}
                onChange={(e) =>
                  patch((d) => {
                    const terms = [...d.terms];
                    terms[i] = e.target.value;
                    return { ...d, terms };
                  })
                }
                className="min-h-[52px] flex-1"
                placeholder="Term text…"
              />
              <button
                onClick={() =>
                  patch((d) => ({ ...d, terms: d.terms.filter((_, idx) => idx !== i) }))
                }
                aria-label={`Remove term ${i + 1}`}
                className="mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/5 focus-ring"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          {draft.terms.length === 0 && (
            <p className="text-sm text-ink-muted">No terms yet. Add one above.</p>
          )}
        </CardContent>
      </Card>

      <SectionSaveBar dirty={dirty} saving={saving} onSave={save} />
    </div>
  );
}
