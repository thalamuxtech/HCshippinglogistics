"use client";

import * as React from "react";
import Link from "next/link";
import {
  Package,
  CheckCircle2,
  Users,
  Activity as ActivityIcon,
  ArrowRight,
  DollarSign,
  Wallet,
  TrendingUp,
} from "lucide-react";
import { listAllShipments, listUsers, listActivity } from "@/lib/db";
import type { Shipment, AppUser, ActivityLog } from "@/lib/types";
import { STAGES, SERVICES } from "@/lib/constants";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { StatCard } from "@/components/portal/StatCard";
import {
  ChartCard,
  CategoryBarChart,
  DonutChart,
  TrendChart,
  type CategoryDatum,
} from "@/components/portal/ChartCard";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton, EmptyState } from "@/components/ui/misc";
import type { Timestamp } from "firebase/firestore";

function tsToDate(ts?: Timestamp | null): Date | null {
  if (!ts) return null;
  try {
    return ts.toDate();
  } catch {
    return null;
  }
}

// ── Revenue date-range presets ──
type RangeKey = "mtd" | "3m" | "6m" | "ytd" | "12m" | "all";
const RANGES: { key: RangeKey; label: string }[] = [
  { key: "mtd", label: "This month" },
  { key: "3m", label: "3 months" },
  { key: "6m", label: "6 months" },
  { key: "ytd", label: "This year" },
  { key: "12m", label: "12 months" },
  { key: "all", label: "All time" },
];

function rangeStart(key: RangeKey, now: Date): Date | null {
  switch (key) {
    case "mtd":
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case "3m":
      return new Date(now.getFullYear(), now.getMonth() - 2, 1);
    case "6m":
      return new Date(now.getFullYear(), now.getMonth() - 5, 1);
    case "ytd":
      return new Date(now.getFullYear(), 0, 1);
    case "12m":
      return new Date(now.getFullYear(), now.getMonth() - 11, 1);
    case "all":
      return null;
  }
}

export default function AdminDashboardPage() {
  const [loading, setLoading] = React.useState(true);
  const [shipments, setShipments] = React.useState<Shipment[]>([]);
  const [customers, setCustomers] = React.useState<AppUser[]>([]);
  const [activity, setActivity] = React.useState<ActivityLog[]>([]);
  const [error, setError] = React.useState(false);
  const [range, setRange] = React.useState<RangeKey>("6m");

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [s, u, act] = await Promise.all([
          listAllShipments(),
          listUsers("customer"),
          listActivity(8),
        ]);
        if (!alive) return;
        setShipments(s);
        setCustomers(u);
        setActivity(act);
      } catch {
        if (alive) setError(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const now = React.useMemo(() => new Date(), []);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const start = rangeStart(range, now);
  const rangeLabel = RANGES.find((r) => r.key === range)?.label ?? "";

  // Shipments created within the selected range.
  const inRange = React.useMemo(() => {
    if (!start) return shipments;
    return shipments.filter((s) => {
      const d = tsToDate(s.created_at);
      return d ? d >= start : false;
    });
  }, [shipments, start]);

  // ── Revenue (scoped to range) ──
  const rangeRevenue = inRange.reduce((a, s) => a + (s.total_price || 0), 0);
  const rangePaid = inRange
    .filter((s) => s.payment_status === "paid")
    .reduce((a, s) => a + (s.total_price || 0), 0);
  const rangeOutstanding = inRange.reduce(
    (a, s) => a + (s.balance != null ? s.balance : s.payment_status === "paid" ? 0 : s.total_price || 0),
    0
  );
  const collectionRate = rangeRevenue > 0 ? Math.round((rangePaid / rangeRevenue) * 100) : 0;

  // ── Operational KPIs (not range-scoped; current state) ──
  const active = shipments.filter((s) => s.current_status !== "completed").length;
  const completedThisMonth = shipments.filter((s) => {
    if (s.current_status !== "completed") return false;
    const d = tsToDate(s.updated_at) ?? tsToDate(s.created_at);
    return d ? d >= monthStart : false;
  }).length;

  // ── Charts ──
  const stageData: CategoryDatum[] = STAGES.map((st) => ({
    name: st.short,
    value: shipments.filter((s) => s.current_status === st.key).length,
    color: st.color,
  }));

  const serviceData: CategoryDatum[] = (["sea", "air", "roro"] as const).map((svc) => ({
    name: SERVICES[svc].label,
    value: inRange.filter((s) => s.service_type === svc).length,
  }));
  const serviceTotal = serviceData.reduce((a, b) => a + b.value, 0);

  const paymentData: CategoryDatum[] = React.useMemo(() => {
    const c = { paid: 0, partial: 0, unpaid: 0 } as Record<string, number>;
    for (const s of inRange) c[s.payment_status || "unpaid"] = (c[s.payment_status || "unpaid"] || 0) + 1;
    return [
      { name: "Paid", value: c.paid, color: "#16A34A" },
      { name: "Part-paid", value: c.partial, color: "#F59E0B" },
      { name: "Unpaid", value: c.unpaid, color: "#DC2626" },
    ].filter((d) => d.value > 0);
  }, [inRange]);

  const itemTypeData: CategoryDatum[] = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of inRange) {
      if (s.items && s.items.length) {
        for (const it of s.items) {
          const cat = it.category || it.description || "Other";
          counts[cat] = (counts[cat] || 0) + (it.quantity || 1);
        }
      } else {
        const label =
          s.service_type === "air" ? "Air freight" : s.service_type === "roro" ? "Vehicle (RORO)" : "Other";
        counts[label] = (counts[label] || 0) + 1;
      }
    }
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [inRange]);

  // Monthly buckets covering the selected range (revenue + volume).
  const monthsBack = range === "mtd" ? 1 : range === "3m" ? 3 : range === "ytd" ? now.getMonth() + 1 : range === "12m" ? 12 : range === "all" ? 12 : 6;
  const monthly = React.useMemo(() => {
    const n = Math.max(1, monthsBack);
    const buckets: { name: string; key: string; revenue: number; count: number }[] = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({
        name: d.toLocaleString("en-US", { month: "short" }),
        key: `${d.getFullYear()}-${d.getMonth()}`,
        revenue: 0,
        count: 0,
      });
    }
    for (const s of shipments) {
      const d = tsToDate(s.created_at);
      if (!d) continue;
      const b = buckets.find((x) => x.key === `${d.getFullYear()}-${d.getMonth()}`);
      if (b) {
        b.revenue += s.total_price || 0;
        b.count += 1;
      }
    }
    return buckets;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shipments, monthsBack, now]);

  const revenueSeries = monthly.map(({ name, revenue }) => ({ name, value: revenue }));
  const volumeSeries = monthly.map(({ name, count }) => ({ name, value: count }));

  if (error) {
    return (
      <EmptyState
        icon={<ActivityIcon className="h-6 w-6" />}
        title="Could not load dashboard"
        description="There was a problem fetching data. Please refresh the page to try again."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Range selector */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-navy">Revenue overview</h1>
          <p className="text-sm text-ink-muted">Showing {rangeLabel.toLowerCase()}</p>
        </div>
        <div
          className="inline-flex flex-wrap gap-1 rounded-xl border border-border bg-white p-1 shadow-card"
          role="tablist"
          aria-label="Revenue date range"
        >
          {RANGES.map((r) => (
            <button
              key={r.key}
              role="tab"
              aria-selected={range === r.key}
              onClick={() => setRange(r.key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200 focus-ring ${
                range === r.key
                  ? "bg-gold-gradient text-white shadow-gold"
                  : "text-ink-muted hover:bg-secondary hover:text-navy"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Revenue KPIs (range-scoped) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Revenue"
          value="-"
          countTo={rangeRevenue}
          format={(n) => formatCurrency(n)}
          icon={DollarSign}
          accent="navy"
          loading={loading}
          hint={rangeLabel}
        />
        <StatCard
          label="Collected"
          value="-"
          countTo={rangePaid}
          format={(n) => formatCurrency(n)}
          icon={CheckCircle2}
          accent="emerald"
          loading={loading}
          hint="Fully paid"
        />
        <StatCard
          label="Outstanding"
          value="-"
          countTo={rangeOutstanding}
          format={(n) => formatCurrency(n)}
          icon={Wallet}
          accent="orange"
          loading={loading}
          hint="Balance due"
        />
        <StatCard
          label="Collection rate"
          value="-"
          countTo={collectionRate}
          format={(n) => `${n}%`}
          icon={TrendingUp}
          accent="gold"
          loading={loading}
          hint="Paid ÷ billed"
        />
      </div>

      {/* Revenue trend (range-scoped) */}
      {loading ? (
        <ChartSkeleton />
      ) : (
        <ChartCard
          title="Revenue over time"
          description={`Monthly billed revenue · ${rangeLabel.toLowerCase()}`}
          caption={`Monthly revenue, ${revenueSeries.map((d) => `${d.name}: ${formatCurrency(d.value)}`).join(", ")}.`}
          height={260}
        >
          <TrendChart data={revenueSeries} valueLabel="" currency />
        </ChartCard>
      )}

      {/* Operational KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Active shipments"
          value="-"
          countTo={active}
          icon={Package}
          accent="blue"
          loading={loading}
          hint="In progress across all stages"
        />
        <StatCard
          label="Completed this month"
          value="-"
          countTo={completedThisMonth}
          icon={CheckCircle2}
          accent="emerald"
          loading={loading}
          hint={now.toLocaleString("en-US", { month: "long" })}
        />
        <StatCard
          label="Total customers"
          value="-"
          countTo={customers.length}
          icon={Users}
          accent="purple"
          loading={loading}
          hint="Registered accounts"
        />
      </div>

      {/* Charts: stage + service mix */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {loading ? (
            <ChartSkeleton />
          ) : (
            <ChartCard
              title="Shipments by stage"
              description="Current distribution across the 8-stage lifecycle"
              caption={`Shipments per stage, ${stageData.map((d) => `${d.name}: ${d.value}`).join(", ")}.`}
            >
              <CategoryBarChart data={stageData} />
            </ChartCard>
          )}
        </div>
        <div>
          {loading ? (
            <ChartSkeleton />
          ) : serviceTotal === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Service mix</CardTitle>
              </CardHeader>
              <CardContent>
                <EmptyState title="No shipments in range" description="Adjust the date range above." />
              </CardContent>
            </Card>
          ) : (
            <ChartCard
              raw
              title="Service mix"
              description={`Sea · Air · RORO · ${rangeLabel.toLowerCase()}`}
              caption={`Service breakdown, ${serviceData.map((d) => `${d.name}: ${d.value}`).join(", ")}.`}
            >
              <DonutChart data={serviceData} centerLabel="Shipments" />
            </ChartCard>
          )}
        </div>
      </div>

      {/* Charts: payment mix + volume */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div>
          {loading ? (
            <ChartSkeleton />
          ) : paymentData.length === 0 ? null : (
            <ChartCard
              raw
              title="Payment status"
              description={`How ${rangeLabel.toLowerCase()} shipments are paid`}
              caption={`Payment status, ${paymentData.map((d) => `${d.name}: ${d.value}`).join(", ")}.`}
            >
              <DonutChart data={paymentData} centerLabel="Shipments" />
            </ChartCard>
          )}
        </div>
        <div className="lg:col-span-2">
          {loading ? (
            <ChartSkeleton />
          ) : (
            <ChartCard
              title="Shipment volume"
              description={`New shipments per month · ${rangeLabel.toLowerCase()}`}
              caption={`Monthly new shipments, ${volumeSeries.map((d) => `${d.name}: ${d.value}`).join(", ")}.`}
            >
              <CategoryBarChart data={volumeSeries} valueLabel="shipments" />
            </ChartCard>
          )}
        </div>
      </div>

      {/* Item types */}
      {!loading && itemTypeData.length > 0 && (
        <ChartCard
          title="What customers are shipping"
          description={`Item types by quantity · ${rangeLabel.toLowerCase()}`}
          caption={`Item types, ${itemTypeData.map((d) => `${d.name}: ${d.value}`).join(", ")}.`}
        >
          <CategoryBarChart data={itemTypeData} valueLabel="items" />
        </ChartCard>
      )}

      {/* Recent activity */}
      <Card className="flex flex-col">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Recent activity</CardTitle>
        </CardHeader>
        <CardContent className="flex-1">
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="mt-1.5 h-2.5 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : activity.length === 0 ? (
            <EmptyState
              icon={<ActivityIcon className="h-6 w-6" />}
              title="No activity yet"
              description="Actions across the portal will appear here."
            />
          ) : (
            <ul className="space-y-4">
              {activity.map((a) => (
                <li key={a.id} className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy/5 text-navy">
                    <ActivityIcon className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm text-ink">
                      <span className="font-semibold text-navy">{a.actor_name ?? "System"}</span> {a.action}
                      {a.target ? ` · ${a.target}` : ""}
                    </p>
                    <p className="text-xs text-ink-muted">{formatDateTime(tsToDate(a.created_at))}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-2 h-3 w-56" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[260px] w-full rounded-lg" />
      </CardContent>
    </Card>
  );
}
