"use client";

// ─────────────────────────────────────────────────────────────
// Dispatch — Containers received.
//
// Same hierarchy as the office portal: Container → Shipments → Deliveries.
// A rider is handed a container's worth of cargo, so this screen shows what
// arrived per container and how much of it is still to deliver. Read-only:
// riders never change stage from here — a delivery is completed from its own
// job page, with proof-of-delivery photos.
//
// Mobile-first (riders are on phones): large tap targets, no tables, no
// horizontal scrolling, and no prices anywhere.
// ─────────────────────────────────────────────────────────────

import * as React from "react";
import Link from "next/link";
import {
  Container as ContainerIcon,
  Search,
  Package,
  Lock,
  ChevronRight,
  CheckCircle2,
  Truck,
  Info,
} from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { listArrivedShipments } from "@/lib/db";
import type { Shipment } from "@/lib/types";
import { StageBadge, FragileBadge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/input";
import { Skeleton, EmptyState } from "@/components/ui/misc";
import { isDnr } from "@/lib/utils";

interface Bucket {
  cnt: string;
  label: string;
  jobs: Shipment[];
  ready: number;
  held: number;
  done: number;
  lastUpdated: number;
}

export default function DispatchContainersPage() {
  const { user } = useAuth();
  const [rows, setRows] = React.useState<Shipment[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [q, setQ] = React.useState("");
  const [scope, setScope] = React.useState<"open" | "all">("open");

  React.useEffect(() => {
    if (!user?.id) return;
    let active = true;
    (async () => {
      setLoading(true);
      try {
        // Same source as the hand-out queue: shipments that reached the
        // destination (offloading / delivery / completed).
        const arrived = await listArrivedShipments();
        if (active) setRows(arrived);
      } catch {
        if (active) setRows([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [user?.id]);

  const buckets = React.useMemo<Bucket[]>(() => {
    const term = q.trim().toLowerCase();
    const map = new Map<string, Shipment[]>();

    for (const s of rows) {
      if (term) {
        const hit =
          s.container_number?.toLowerCase().includes(term) ||
          s.tracking_number?.toLowerCase().includes(term) ||
          s.receiver?.full_name?.toLowerCase().includes(term) ||
          s.customer_name?.toLowerCase().includes(term) ||
          s.destination_city?.toLowerCase().includes(term);
        if (!hit) continue;
      }
      const cnt = (s.container_number || "").trim();
      const key = cnt || "__none__";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }

    const out: Bucket[] = [];
    map.forEach((list, key) => {
      const done = list.filter((s) => s.current_status === "completed").length;
      // "Open" hides containers fully handed over, so the list stays today's work.
      if (scope === "open" && done === list.length) return;
      out.push({
        cnt: key === "__none__" ? "" : key,
        label: key === "__none__" ? "No container assigned" : `CNT #${key}`,
        // Ready-to-hand-out first, then still-at-warehouse, completed last.
        jobs: list.slice().sort((a, b) => {
          const rank = (s: Shipment) =>
            s.current_status === "completed" ? 2 : s.current_status === "delivery" ? 0 : 1;
          const d = rank(a) - rank(b);
          if (d !== 0) return d;
          return (b.updated_at?.toMillis?.() ?? 0) - (a.updated_at?.toMillis?.() ?? 0);
        }),
        ready: list.filter((s) => s.current_status === "delivery" && !isDnr(s)).length,
        held: list.filter((s) => s.current_status !== "completed" && isDnr(s)).length,
        done,
        lastUpdated: Math.max(...list.map((s) => s.updated_at?.toMillis?.() ?? 0)),
      });
    });

    return out.sort((a, b) => {
      if (!a.cnt) return 1;
      if (!b.cnt) return -1;
      // Containers with work ready to hand out come first.
      if (a.ready !== b.ready) return b.ready - a.ready;
      return b.lastUpdated - a.lastUpdated;
    });
  }, [rows, q, scope]);

  const totalOpen = rows.filter((s) => s.current_status !== "completed").length;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-navy text-gold-300">
          <ContainerIcon className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold tracking-tight text-navy">Containers received</h1>
          <p className="text-sm text-ink-muted">
            {loading
              ? "Loading…"
              : `${buckets.length} container${buckets.length === 1 ? "" : "s"} · ${totalOpen} item${
                  totalOpen === 1 ? "" : "s"
                } to hand out`}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search container, tracking #, or recipient…"
            className="pl-10"
            aria-label="Search containers"
          />
        </div>
        <Select
          value={scope}
          onChange={(e) => setScope(e.target.value as typeof scope)}
          className="sm:w-56"
          aria-label="Filter containers"
        >
          <option value="open">With items to hand out</option>
          <option value="all">Include fully delivered</option>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-2xl" />
          ))}
        </div>
      ) : buckets.length === 0 ? (
        <EmptyState
          icon={<ContainerIcon className="h-6 w-6" />}
          title={rows.length === 0 ? "No containers received yet" : "Nothing matches"}
          description={
            rows.length === 0
              ? "Containers appear here once their shipments arrive at the destination warehouse."
              : "Try a different search, or include fully delivered containers."
          }
        />
      ) : (
        <div className="space-y-5">
          {buckets.map((b) => (
            <section
              key={b.label}
              className="overflow-hidden rounded-2xl border border-border bg-white shadow-card"
            >
              {/* Container header */}
              <div className="border-b border-border bg-secondary/40 px-4 py-3.5">
                <div className="flex items-center gap-2">
                  <ContainerIcon className="h-4 w-4 shrink-0 text-gold" aria-hidden />
                  <h2 className="font-mono text-sm font-bold text-navy">{b.label}</h2>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-secondary-foreground ring-1 ring-border">
                    {b.jobs.length} item{b.jobs.length === 1 ? "" : "s"}
                  </span>
                  {b.ready > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">
                      <Truck className="h-3 w-3" /> {b.ready} ready
                    </span>
                  )}
                  {b.held > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-bold text-red-700 ring-1 ring-red-200">
                      <Lock className="h-3 w-3" /> {b.held} on hold
                    </span>
                  )}
                  {b.done > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-ink-muted ring-1 ring-border">
                      <CheckCircle2 className="h-3 w-3" /> {b.done} delivered
                    </span>
                  )}
                </div>
              </div>

              {/* Deliveries inside this container */}
              <ul className="divide-y divide-border">
                {b.jobs.map((job) => {
                  const held = isDnr(job);
                  const doneJob = job.current_status === "completed";
                  return (
                    <li key={job.id}>
                      <Link
                        href={`/dispatch/jobs/detail?id=${job.id}`}
                        className="flex items-start gap-3 px-4 py-4 transition-colors active:bg-secondary/50 focus-ring"
                      >
                        <span
                          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                            doneJob
                              ? "bg-emerald-50 text-emerald-600"
                              : held
                              ? "bg-red-50 text-red-600"
                              : "bg-navy/5 text-navy"
                          }`}
                        >
                          {doneJob ? (
                            <CheckCircle2 className="h-5 w-5" />
                          ) : held ? (
                            <Lock className="h-4 w-4" />
                          ) : (
                            <Package className="h-4 w-4" />
                          )}
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-sm font-bold text-navy">
                              {job.tracking_number}
                            </span>
                            <StageBadge status={job.current_status} />
                            {job.fragile && <FragileBadge note={job.fragile_note} />}
                            {held && !doneJob && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700 ring-1 ring-red-200">
                                Do Not Release
                              </span>
                            )}
                          </div>

                          {/* Recipient + address, no prices (rider-facing). */}
                          <p className="mt-1 text-sm text-ink">
                            {job.receiver?.full_name || job.customer_name || "Recipient"}
                            {job.receiver?.phone
                              ? ` · ${job.receiver.phone}`
                              : job.customer_phone
                              ? ` · ${job.customer_phone}`
                              : ""}
                          </p>
                          <p className="mt-0.5 text-xs text-ink-muted">
                            {job.receiver?.address ||
                              job.delivery_address ||
                              [job.destination_city, job.destination_country]
                                .filter(Boolean)
                                .join(", ") ||
                              "Pickup at warehouse"}
                          </p>
                        </div>

                        <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-ink-muted" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <div className="flex items-start gap-2.5 rounded-xl border border-border bg-secondary/40 p-4">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
        <p className="text-xs text-ink-muted">
          Open an item to call the recipient, add proof-of-delivery photos and mark it delivered.
          Items marked <strong>Do Not Release</strong> must not be handed over until the office
          lifts the hold.
        </p>
      </div>
    </div>
  );
}
