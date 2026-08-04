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
// Ranges are DERIVED FROM THE DATA, not a fixed list, so the dashboard keeps
// working unchanged as the business accumulates 5, 10, or 20 years of records:
//  - rolling presets ("3 months" … "5 years") are only offered while they are
//    shorter than the actual history, so no preset shows an empty tail;
//  - one "Nyyyy" option is generated per calendar year that has records;
//  - "All time" always spans from the earliest record.
// Long spans auto-group by year (see the trend memo) so the chart stays readable.
type RangeKey = string;

type RangeOption = { key: RangeKey; label: string };

// Rolling presets, in months. Anything longer than the available history is
// dropped from the picker (except the shortest, so there is always a choice).
const ROLLING: { key: string; label: string; months: number }[] = [
  { key: "mtd", label: "This month", months: 1 },
  { key: "3m", label: "3 months", months: 3 },
  { key: "6m", label: "6 months", months: 6 },
  { key: "12m", label: "12 months", months: 12 },
  { key: "2y", label: "2 years", months: 24 },
  { key: "5y", label: "5 years", months: 60 },
  { key: "10y", label: "10 years", months: 120 },
];

// Months of history available, given the earliest record (inclusive).
function monthsOfHistory(earliest: Date | null, now: Date): number {
  if (!earliest) return 1;
  return (
    (now.getFullYear() - earliest.getFullYear()) * 12 +
    (now.getMonth() - earliest.getMonth()) +
    1
  );
}

// Build the picker options from the data itself.
function buildRangeOptions(earliest: Date | null, now: Date): RangeOption[] {
  const span = monthsOfHistory(earliest, now);
  const opts: RangeOption[] = [];

  // Keep every rolling preset that fits inside the history, plus the first one
  // beyond it so the newest data always has a wider view available.
  let includedBeyond = false;
  for (const r of ROLLING) {
    if (r.months <= span) {
      opts.push({ key: r.key, label: r.label });
    } else if (!includedBeyond) {
      opts.push({ key: r.key, label: r.label });
      includedBeyond = true;
    }
  }

  opts.push({ key: "ytd", label: "This year" });

  // One option per calendar year with records (newest first), so an admin can
  // always isolate a single past year no matter how far back the history goes.
  if (earliest) {
    for (let y = now.getFullYear(); y >= earliest.getFullYear(); y--) {
      opts.push({ key: `y${y}`, label: String(y) });
    }
  }

  opts.push({ key: "all", label: "All time" });
  return opts;
}

// Start of the selected range. `all` returns null (caller uses the earliest
// record). A `yYYYY` key selects exactly that calendar year.
function rangeStart(key: RangeKey, now: Date): Date | null {
  if (key === "ytd") return new Date(now.getFullYear(), 0, 1);
  if (key === "all") return null;
  const year = /^y(\d{4})$/.exec(key);
  if (year) return new Date(Number(year[1]), 0, 1);
  const rolling = ROLLING.find((r) => r.key === key);
  if (rolling) return new Date(now.getFullYear(), now.getMonth() - (rolling.months - 1), 1);
  return new Date(now.getFullYear(), now.getMonth() - 5, 1); // safe fallback: 6 months
}

// Exclusive end of the selected range — only a single-year selection is bounded;
// every other range runs to "now".
function rangeEnd(key: RangeKey): Date | null {
  const year = /^y(\d{4})$/.exec(key);
  return year ? new Date(Number(year[1]) + 1, 0, 1) : null;
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

  // Earliest record — drives both the derived range options and "all time".
  const earliest = React.useMemo(() => {
    let e: Date | null = null;
    for (const s of shipments) {
      const d = tsToDate(s.created_at) ?? tsToDate(s.updated_at);
      if (d && (!e || d < e)) e = d;
    }
    return e;
  }, [shipments]);

  const rangeOptions = React.useMemo(() => buildRangeOptions(earliest, now), [earliest, now]);
  // The selected key may not exist in the derived list — the default "6m" is
  // absent until there are six months of history, and year options come and go.
  //
  // The fallback must be the WIDEST option, not rangeOptions[0]. Options are
  // built narrowest-first ("This month", "3 months", …), so falling back to
  // index 0 silently narrowed the dashboard to the current month: a business
  // with only a few weeks of history saw $0 revenue while last month's paid
  // shipments sat just outside the window. "All time" is always present, so
  // preferring the last entry can never leave the view blank.
  const activeRange = React.useMemo(() => {
    if (rangeOptions.some((r) => r.key === range)) return range;
    return rangeOptions[rangeOptions.length - 1]?.key ?? "all";
  }, [rangeOptions, range]);
  const start = rangeStart(activeRange, now);
  const end = rangeEnd(activeRange);
  const rangeLabel = rangeOptions.find((r) => r.key === activeRange)?.label ?? "";

  // Shipments created within the selected range.
  const inRange = React.useMemo(() => {
    if (!start && !end) return shipments;
    return shipments.filter((s) => {
      // A shipment whose created_at has not yet resolved (serverTimestamp is
      // null for a moment after creation) must not vanish from revenue — that
      // made freshly created, already-paid shipments invisible. Fall back to
      // updated_at, and keep the record when neither timestamp exists rather
      // than silently dropping money from the totals.
      const d = tsToDate(s.created_at) ?? tsToDate(s.updated_at);
      if (!d) return true;
      if (start && d < start) return false;
      if (end && d >= end) return false;
      return true;
    });
  }, [shipments, start, end]);

  // ── Revenue (scoped to range) ──
  const rangeRevenue = inRange.reduce((a, s) => a + (s.total_price || 0), 0);
  // Money actually taken, INCLUDING part-payments. Counting only fully-paid
  // shipments understated collections and did not reconcile with Outstanding:
  // a $500 shipment with a $400 deposit showed $0 collected but only $100
  // outstanding, so Collected + Outstanding did not equal Revenue.
  const rangePaid = inRange.reduce((a, s) => {
    if (s.payment_status === "paid") return a + (s.total_price || 0);
    if (typeof s.deposit === "number") return a + s.deposit;
    return a;
  }, 0);
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

  // Trend buckets (revenue + volume) covering the selected range. Groups by
  // MONTH for spans up to ~24 months, otherwise by YEAR, so the chart stays
  // readable whether there are 3 months or 10 years of data. Month labels carry
  // the year when the span crosses a calendar year, so nothing is ambiguous.
  const { series: trendSeries, grouping } = React.useMemo(() => {
    // Effective window start: preset start, but never before the first record.
    let from = start;
    if (!from) from = earliest ?? new Date(now.getFullYear(), now.getMonth(), 1);
    if (earliest && from < earliest) from = earliest;

    // Last bucket: the month/year before the exclusive end (single-year
    // selections), otherwise the current month.
    const lastMoment = end ? new Date(end.getFullYear(), end.getMonth() - 1, 1) : now;
    const to = new Date(lastMoment.getFullYear(), lastMoment.getMonth(), 1);
    if (to < from) {
      return { series: [], grouping: "month" as const };
    }

    // Total months spanned (inclusive).
    const monthSpan =
      (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) + 1;

    // Group by year when the window is long; otherwise by month.
    const byYear = monthSpan > 24;
    const crossesYears = from.getFullYear() !== to.getFullYear();

    type Bucket = { name: string; key: string; revenue: number; count: number };
    const buckets: Bucket[] = [];
    const index = new Map<string, Bucket>();

    if (byYear) {
      for (let y = from.getFullYear(); y <= to.getFullYear(); y++) {
        const b: Bucket = { name: String(y), key: `y-${y}`, revenue: 0, count: 0 };
        buckets.push(b);
        index.set(b.key, b);
      }
    } else {
      const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
      while (cursor <= to) {
        const label = crossesYears
          ? cursor.toLocaleString("en-US", { month: "short", year: "2-digit" })
          : cursor.toLocaleString("en-US", { month: "short" });
        const b: Bucket = {
          name: label,
          key: `${cursor.getFullYear()}-${cursor.getMonth()}`,
          revenue: 0,
          count: 0,
        };
        buckets.push(b);
        index.set(b.key, b);
        cursor.setMonth(cursor.getMonth() + 1);
      }
    }

    // Bucket from the already range-filtered set so a single-year selection
    // never picks up shipments from outside the window.
    for (const s of inRange) {
      // Same created_at ?? updated_at fallback as the KPI filter, so the chart
      // total and the Revenue card can never disagree.
      const d = tsToDate(s.created_at) ?? tsToDate(s.updated_at);
      if (!d) continue;
      const key = byYear ? `y-${d.getFullYear()}` : `${d.getFullYear()}-${d.getMonth()}`;
      const b = index.get(key);
      if (b) {
        b.revenue += s.total_price || 0;
        b.count += 1;
      }
    }

    return {
      series: buckets.map(({ name, revenue, count }) => ({ name, revenue, count })),
      grouping: byYear ? ("year" as const) : ("month" as const),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inRange, earliest, start, end, now]);

  const revenueSeries = trendSeries.map(({ name, revenue }) => ({ name, value: revenue }));
  const volumeSeries = trendSeries.map(({ name, count }) => ({ name, value: count }));

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
          {rangeOptions.map((r) => (
            <button
              key={r.key}
              role="tab"
              aria-selected={activeRange === r.key}
              onClick={() => setRange(r.key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200 focus-ring ${
                activeRange === r.key
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
          hint="Payments received"
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
          description={`Billed revenue by ${grouping} · ${rangeLabel.toLowerCase()}`}
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
              description={`New shipments by ${grouping} · ${rangeLabel.toLowerCase()}`}
              caption={`Monthly new shipments, ${volumeSeries.map((d) => `${d.name}: ${d.value}`).join(", ")}.`}
            >
              <TrendChart data={volumeSeries} valueLabel="shipments" />
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
