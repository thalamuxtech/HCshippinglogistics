"use client";

import * as React from "react";
import Link from "next/link";
import {
  Package,
  CheckCircle2,
  Users,
  Inbox,
  Flag,
  MapPin,
  Activity as ActivityIcon,
  ArrowRight,
} from "lucide-react";
import { listAllShipments, listUsers, listInquiries, listActivity } from "@/lib/db";
import type { Shipment, AppUser, ContactInquiry, ActivityLog } from "@/lib/types";
import { STAGES, SERVICES } from "@/lib/constants";
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
import { formatDateTime } from "@/lib/utils";
import type { Timestamp } from "firebase/firestore";

function tsToDate(ts?: Timestamp | null): Date | null {
  if (!ts) return null;
  try {
    return ts.toDate();
  } catch {
    return null;
  }
}

export default function AdminDashboardPage() {
  const [loading, setLoading] = React.useState(true);
  const [shipments, setShipments] = React.useState<Shipment[]>([]);
  const [customers, setCustomers] = React.useState<AppUser[]>([]);
  const [inquiries, setInquiries] = React.useState<ContactInquiry[]>([]);
  const [activity, setActivity] = React.useState<ActivityLog[]>([]);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [s, u, inq, act] = await Promise.all([
          listAllShipments(),
          listUsers("customer"),
          listInquiries(),
          listActivity(8),
        ]);
        if (!alive) return;
        setShipments(s);
        setCustomers(u);
        setInquiries(inq);
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

  // ── Derived KPIs ──
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const active = shipments.filter((s) => s.current_status !== "completed").length;
  const completedThisMonth = shipments.filter((s) => {
    if (s.current_status !== "completed") return false;
    const d = tsToDate(s.updated_at) ?? tsToDate(s.created_at);
    return d ? d >= monthStart : false;
  }).length;
  const newInquiries = inquiries.filter((i) => i.status === "new").length;

  const usaSide = shipments.filter((s) =>
    ["collection", "inspection", "loading"].includes(s.current_status)
  ).length;
  const destSide = shipments.filter((s) =>
    ["clearance", "offloading", "delivery", "completed"].includes(s.current_status)
  ).length;

  // ── Chart data ──
  const stageData: CategoryDatum[] = STAGES.map((st) => ({
    name: st.short,
    value: shipments.filter((s) => s.current_status === st.key).length,
    color: st.color,
  }));

  const serviceData: CategoryDatum[] = (["sea", "air", "roro"] as const).map((svc) => ({
    name: SERVICES[svc].label,
    value: shipments.filter((s) => s.service_type === svc).length,
  }));
  const serviceTotal = serviceData.reduce((a, b) => a + b.value, 0);

  const monthsData = React.useMemo(() => {
    const buckets: { name: string; key: string; value: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({
        name: d.toLocaleString("en-US", { month: "short" }),
        key: `${d.getFullYear()}-${d.getMonth()}`,
        value: 0,
      });
    }
    for (const s of shipments) {
      const d = tsToDate(s.created_at);
      if (!d) continue;
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const b = buckets.find((x) => x.key === key);
      if (b) b.value += 1;
    }
    return buckets.map(({ name, value }) => ({ name, value }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shipments]);

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
      {/* KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Active shipments"
          value={loading ? "—" : active}
          icon={Package}
          accent="navy"
          loading={loading}
          hint="In progress across all stages"
        />
        <StatCard
          label="Completed this month"
          value={loading ? "—" : completedThisMonth}
          icon={CheckCircle2}
          accent="emerald"
          loading={loading}
          hint={now.toLocaleString("en-US", { month: "long", year: "numeric" })}
        />
        <StatCard
          label="Total customers"
          value={loading ? "—" : customers.length}
          icon={Users}
          accent="gold"
          loading={loading}
          hint="Registered accounts"
        />
        <StatCard
          label="New inquiries"
          value={loading ? "—" : newInquiries}
          icon={Inbox}
          accent="orange"
          loading={loading}
          hint="Awaiting response"
        />
        <StatCard
          label="USA-side shipments"
          value={loading ? "—" : usaSide}
          icon={Flag}
          accent="blue"
          loading={loading}
          hint="Collection · Inspection · Loading"
        />
        <StatCard
          label="Destination-side"
          value={loading ? "—" : destSide}
          icon={MapPin}
          accent="purple"
          loading={loading}
          hint="Clearance through delivery"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {loading ? (
            <ChartSkeleton />
          ) : (
            <ChartCard
              title="Shipments by stage"
              description="Current distribution across the 8-stage lifecycle"
              caption={`Shipments per stage — ${stageData
                .map((d) => `${d.name}: ${d.value}`)
                .join(", ")}.`}
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
                <EmptyState title="No shipments yet" description="Service breakdown appears here." />
              </CardContent>
            </Card>
          ) : (
            <ChartCard
              title="Service mix"
              description="Sea · Air · RORO"
              caption={`Service type breakdown — ${serviceData
                .map((d) => `${d.name}: ${d.value}`)
                .join(", ")}.`}
            >
              <DonutChart data={serviceData} />
            </ChartCard>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {loading ? (
            <ChartSkeleton />
          ) : (
            <ChartCard
              title="Shipment volume"
              description="New shipments over the last 6 months"
              caption={`Monthly new shipments — ${monthsData
                .map((d) => `${d.name}: ${d.value}`)
                .join(", ")}.`}
            >
              <TrendChart data={monthsData} />
            </ChartCard>
          )}
        </div>

        {/* Recent activity */}
        <Card className="flex flex-col">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Recent activity</CardTitle>
            <Link
              href="/admin/activity"
              className="inline-flex items-center gap-1 text-xs font-semibold text-gold-700 hover:underline focus-ring"
            >
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
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
                        <span className="font-semibold text-navy">
                          {a.actor_name ?? "System"}
                        </span>{" "}
                        {a.action}
                        {a.target ? ` · ${a.target}` : ""}
                      </p>
                      <p className="text-xs text-ink-muted">
                        {formatDateTime(tsToDate(a.created_at))}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
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
        <Skeleton className="h-[280px] w-full rounded-lg" />
      </CardContent>
    </Card>
  );
}
