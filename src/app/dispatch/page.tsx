"use client";

// ─────────────────────────────────────────────────────────────
// Dispatch, My Jobs dashboard.
//
// A rider's shift view: what is assigned to me, what is ready to hand out, what
// is blocked, and what I have already finished today, then the job list itself
// grouped by container (Container → Shipments → Deliveries).
//
// "Assigned to me" is deliberately surfaced first. The admin sets
// assigned_dispatcher_id on a shipment, but the dispatch portal historically
// ignored it and showed every rider the whole warehouse queue, so an assignment
// had no visible effect. Assigned work now leads the dashboard while unassigned
// arrivals stay reachable below, a small team still shares one pool, so hiding
// the rest would strand cargo nobody was explicitly given.
// ─────────────────────────────────────────────────────────────

import * as React from "react";
import Link from "next/link";
import {
  MapPin,
  Phone,
  Package,
  ChevronRight,
  Truck,
  Container as ContainerIcon,
  Lock,
  CheckCircle2,
  UserCheck,
  Search,
} from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { listArrivedShipments, listCompletedLogsSince } from "@/lib/db";
import type { Shipment } from "@/lib/types";
import { StageBadge, FragileBadge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/input";
import { Skeleton, EmptyState } from "@/components/ui/misc";
import { StatCard } from "@/components/portal/StatCard";
import { isDnr } from "@/lib/utils";

interface Group {
  cnt: string;
  label: string;
  jobs: Shipment[];
  ready: number;
  held: number;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

type Filter = "all" | "mine" | "ready" | "held";

export default function DispatchJobsPage() {
  const { user } = useAuth();
  const [jobs, setJobs] = React.useState<Shipment[]>([]);
  const [doneToday, setDoneToday] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [q, setQ] = React.useState("");
  const [filter, setFilter] = React.useState<Filter>("all");

  React.useEffect(() => {
    if (!user?.id) return;
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const rows = await listArrivedShipments();
        // Hand-out queue: arrived, not yet completed. Ready-first ordering.
        const open = rows
          .filter((s) => s.current_status !== "completed")
          .sort((a, b) => {
            const ar = a.current_status === "delivery" ? 0 : 1;
            const br = b.current_status === "delivery" ? 0 : 1;
            if (ar !== br) return ar - br;
            return (b.updated_at?.toMillis?.() ?? 0) - (a.updated_at?.toMillis?.() ?? 0);
          });
        if (active) setJobs(open);
      } catch {
        if (active) setJobs([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [user?.id]);

  // Today's own completions, for the shift counter. Kept in a separate effect so
  // a failure here (or a missing index) never blanks the job list itself.
  React.useEffect(() => {
    if (!user?.id) return;
    let active = true;
    (async () => {
      try {
        const logs = await listCompletedLogsSince(startOfToday());
        const mine = new Set(
          logs.filter((l) => l.updated_by === user.id).map((l) => l.shipment_id)
        );
        if (active) setDoneToday(mine.size);
      } catch {
        if (active) setDoneToday(0);
      }
    })();
    return () => {
      active = false;
    };
  }, [user?.id]);

  const mineCount = React.useMemo(
    () => jobs.filter((s) => s.assigned_dispatcher_id === user?.id).length,
    [jobs, user?.id]
  );
  const readyCount = React.useMemo(
    () => jobs.filter((s) => s.current_status === "delivery" && !isDnr(s)).length,
    [jobs]
  );
  const heldCount = React.useMemo(() => jobs.filter((s) => isDnr(s)).length, [jobs]);

  const filtered = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    return jobs.filter((s) => {
      if (filter === "mine" && s.assigned_dispatcher_id !== user?.id) return false;
      if (filter === "ready" && !(s.current_status === "delivery" && !isDnr(s))) return false;
      if (filter === "held" && !isDnr(s)) return false;
      if (!term) return true;
      return (
        s.tracking_number?.toLowerCase().includes(term) ||
        s.container_number?.toLowerCase().includes(term) ||
        s.receiver?.full_name?.toLowerCase().includes(term) ||
        s.customer_name?.toLowerCase().includes(term) ||
        s.receiver?.phone?.includes(term) ||
        s.destination_city?.toLowerCase().includes(term)
      );
    });
  }, [jobs, q, filter, user?.id]);

  // Group by container that arrived. Assigned-to-me containers float to the top
  // so a rider's own work is the first thing they scroll into.
  const groups = React.useMemo<Group[]>(() => {
    const map = new Map<string, Group>();
    for (const j of filtered) {
      const cnt = (j.container_number || "").trim();
      const key = cnt || "__none__";
      if (!map.has(key)) {
        map.set(key, {
          cnt,
          label: cnt ? `CNT #${cnt}` : "Unassigned container",
          jobs: [],
          ready: 0,
          held: 0,
        });
      }
      const g = map.get(key)!;
      g.jobs.push(j);
      if (j.current_status === "delivery" && !isDnr(j)) g.ready += 1;
      if (isDnr(j)) g.held += 1;
    }
    return Array.from(map.values()).sort((a, b) => {
      const aMine = a.jobs.some((j) => j.assigned_dispatcher_id === user?.id);
      const bMine = b.jobs.some((j) => j.assigned_dispatcher_id === user?.id);
      if (aMine !== bMine) return aMine ? -1 : 1;
      if (a.ready !== b.ready) return b.ready - a.ready;
      return a.label.localeCompare(b.label, undefined, { numeric: true });
    });
  }, [filtered, user?.id]);

  return (
    <div className="space-y-6">
      {/* Shift header */}
      <div className="flex items-center gap-3">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-navy text-gold-300">
          <Truck className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold tracking-tight text-navy">
            {user?.full_name ? `Hello, ${user.full_name.split(" ")[0]}` : "My Jobs"}
          </h1>
          <p className="text-sm text-ink-muted">
            {loading
              ? "Loading your jobs…"
              : jobs.length === 0
              ? "Nothing to hand out right now."
              : `${jobs.length} item${jobs.length === 1 ? "" : "s"} across ${
                  groups.length
                } container${groups.length === 1 ? "" : "s"}`}
          </p>
        </div>
      </div>

      {/* Shift stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
        ) : (
          <>
            <StatCard
              label="Assigned to me"
              value={mineCount}
              icon={UserCheck}
              accent="navy"
              hint={mineCount === 0 ? "Nothing assigned yet" : undefined}
            />
            <StatCard label="Ready to hand out" value={readyCount} icon={Truck} accent="emerald" />
            <StatCard
              label="On hold (DNR)"
              value={heldCount}
              icon={Lock}
              accent="orange"
              hint={heldCount > 0 ? "Do not release these" : undefined}
            />
            <StatCard
              label="Delivered today"
              value={doneToday}
              icon={CheckCircle2}
              accent="blue"
            />
          </>
        )}
      </div>

      {/* Search + filter */}
      {!loading && jobs.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search tracking #, container, recipient, or phone…"
              className="pl-10"
              aria-label="Search jobs"
            />
          </div>
          <Select
            value={filter}
            onChange={(e) => setFilter(e.target.value as Filter)}
            className="sm:w-56"
            aria-label="Filter jobs"
          >
            <option value="all">All jobs ({jobs.length})</option>
            <option value="mine">Assigned to me ({mineCount})</option>
            <option value="ready">Ready to hand out ({readyCount})</option>
            <option value="held">On hold ({heldCount})</option>
          </Select>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <EmptyState
          icon={<Package className="h-6 w-6" />}
          title="Nothing to hand out yet"
          description="Shipments appear here once their container arrives at the destination warehouse."
        />
      ) : groups.length === 0 ? (
        <EmptyState
          icon={<Search className="h-6 w-6" />}
          title="No jobs match"
          description="Try a different search, or switch the filter back to All jobs."
        />
      ) : (
        <div className="space-y-7">
          {groups.map((g) => {
            const mine = g.jobs.some((j) => j.assigned_dispatcher_id === user?.id);
            return (
              <section key={g.label} className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <ContainerIcon className="h-4 w-4 shrink-0 text-gold" />
                  <h2 className="font-mono text-sm font-bold text-navy">{g.label}</h2>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                    {g.jobs.length} item{g.jobs.length === 1 ? "" : "s"}
                  </span>
                  {mine && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-navy px-2.5 py-0.5 text-xs font-bold text-gold-300">
                      <UserCheck className="h-3 w-3" /> Yours
                    </span>
                  )}
                  {g.ready > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">
                      {g.ready} ready
                    </span>
                  )}
                  {g.held > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-bold text-red-700 ring-1 ring-red-200">
                      <Lock className="h-3 w-3" /> {g.held} held
                    </span>
                  )}
                </div>

                <div className="space-y-3">
                  {g.jobs.map((job) => {
                    const held = isDnr(job);
                    const isMine = job.assigned_dispatcher_id === user?.id;
                    return (
                      <Link
                        key={job.id}
                        href={`/dispatch/jobs/detail?id=${job.id}`}
                        className="block rounded-2xl border border-border bg-white p-5 shadow-card transition-colors active:bg-secondary/50 focus-ring"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span className="font-mono text-base font-bold text-navy">
                            {job.tracking_number}
                          </span>
                          <ChevronRight className="mt-0.5 h-6 w-6 shrink-0 text-ink-muted" />
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <StageBadge status={job.current_status} />
                          {job.fragile && <FragileBadge note={job.fragile_note} />}
                          {isMine && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-navy px-2.5 py-0.5 text-xs font-bold text-gold-300">
                              <UserCheck className="h-3 w-3" /> Assigned to you
                            </span>
                          )}
                          {held ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-bold text-red-700 ring-1 ring-red-200">
                              <Lock className="h-3 w-3" /> Do Not Release
                            </span>
                          ) : job.current_status === "delivery" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">
                              Ready to hand out
                            </span>
                          ) : (
                            <span className="text-xs text-ink-muted">At warehouse</span>
                          )}
                        </div>

                        {/* Minimal recipient info, no price */}
                        <div className="mt-3 space-y-2.5">
                          <div className="flex items-center gap-2.5">
                            <Phone className="h-5 w-5 shrink-0 text-ink-muted" />
                            <span className="text-base text-ink">
                              {job.receiver?.full_name || job.customer_name || "Recipient"}
                              {job.receiver?.phone
                                ? ` · ${job.receiver.phone}`
                                : job.customer_phone
                                ? ` · ${job.customer_phone}`
                                : ""}
                            </span>
                          </div>

                          <div className="flex items-start gap-2.5">
                            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
                            <span className="text-sm text-ink">
                              {job.receiver?.address ||
                                [job.destination_city, job.destination_country]
                                  .filter(Boolean)
                                  .join(", ") ||
                                "Pickup at warehouse"}
                            </span>
                          </div>

                          <div className="flex items-start gap-2.5">
                            <Package className="mt-0.5 h-5 w-5 shrink-0 text-ink-muted" />
                            <span className="text-sm text-ink-muted">
                              {job.items?.length
                                ? job.items
                                    .map(
                                      (it) =>
                                        `${it.quantity && it.quantity > 1 ? `${it.quantity}x ` : ""}${
                                          it.description
                                        }`
                                    )
                                    .join(", ")
                                : job.item_category || job.vehicle_details || "Shipment items"}
                            </span>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
