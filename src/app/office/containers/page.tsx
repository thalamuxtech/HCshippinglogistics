"use client";

// ─────────────────────────────────────────────────────────────
// Destination office, Containers.
//
// Top of the operating hierarchy: Container → Shipments → Warehouse stock.
// Office staff work a container at a time (it clears customs as one, it is
// offloaded as one), so this screen exists to select a whole container and move
// it through a stage in a single action. Stage rules and the audit trail are the
// shared ones in lib/bulk-advance.ts, this role is limited to stages 5-8.
//
// Read-only with respect to composition: assigning shipments TO a container is
// a head-office action (loading happens in the USA), so there is no create or
// re-assign control here by design.
// ─────────────────────────────────────────────────────────────

import * as React from "react";
import Link from "next/link";
import {
  Container as ContainerIcon,
  Search,
  Layers,
  Lock,
  ChevronRight,
  Info,
} from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { listShipments, where } from "@/lib/db";
import type { Shipment } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge, StageBadge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/input";
import { Skeleton, EmptyState } from "@/components/ui/misc";
import { BulkAdvanceBar } from "@/components/portal/BulkAdvanceBar";
import { formatDate, isDnr } from "@/lib/utils";
import { STAGE_MAP, stageOrder } from "@/lib/constants";

interface Bucket {
  cnt: string;
  label: string;
  shipments: Shipment[];
  /** Stage tally, so staff see at a glance whether a container is mixed. */
  stages: { status: Shipment["current_status"]; count: number }[];
  heldCount: number;
  lastUpdated: number;
}

export default function OfficeContainersPage() {
  const { user } = useAuth();
  const country = user?.assigned_country || "Nigeria";

  const [shipments, setShipments] = React.useState<Shipment[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [q, setQ] = React.useState("");
  const [scope, setScope] = React.useState<"active" | "all">("active");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const load = React.useCallback(async () => {
    try {
      const rows = await listShipments([where("destination_country", "==", country)]);
      setShipments(rows);
    } catch {
      setShipments([]);
    } finally {
      setLoading(false);
    }
  }, [country]);

  React.useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const rows = await listShipments([where("destination_country", "==", country)]);
        if (active) setShipments(rows);
      } catch {
        if (active) setShipments([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [country]);

  // This role owns the destination half of the lifecycle (stages 5-8), matching
  // OFFICE_MIN_STAGE in lib/bulk-advance.ts.
  const relevant = React.useMemo(
    () => shipments.filter((s) => stageOrder(s.current_status) >= 5),
    [shipments]
  );

  const buckets = React.useMemo<Bucket[]>(() => {
    const term = q.trim().toLowerCase();
    const map = new Map<string, Shipment[]>();

    for (const s of relevant) {
      // "Active" hides containers whose cargo is fully handed over, so the list
      // stays the day's work rather than an ever-growing archive.
      if (scope === "active" && s.current_status === "completed") continue;
      if (term) {
        const hit =
          s.container_number?.toLowerCase().includes(term) ||
          s.tracking_number?.toLowerCase().includes(term) ||
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
      const tally = new Map<Shipment["current_status"], number>();
      list.forEach((s) => tally.set(s.current_status, (tally.get(s.current_status) || 0) + 1));
      out.push({
        cnt: key === "__none__" ? "" : key,
        label: key === "__none__" ? "No container assigned" : `CNT #${key}`,
        shipments: list.sort((a, b) => stageOrder(a.current_status) - stageOrder(b.current_status)),
        stages: Array.from(tally.entries())
          .map(([status, count]) => ({ status, count }))
          .sort((a, b) => stageOrder(a.status) - stageOrder(b.status)),
        heldCount: list.filter((s) => isDnr(s)).length,
        lastUpdated: Math.max(...list.map((s) => s.updated_at?.toMillis?.() ?? 0)),
      });
    });

    // Most recently touched container first, that is what staff are working on.
    return out.sort((a, b) => {
      if (!a.cnt) return 1;
      if (!b.cnt) return -1;
      return b.lastUpdated - a.lastUpdated;
    });
  }, [relevant, q, scope]);

  const visibleIds = React.useMemo(
    () => new Set(buckets.flatMap((b) => b.shipments.map((s) => s.id))),
    [buckets]
  );

  // Never let a bulk action reach a shipment the operator has filtered away.
  React.useEffect(() => {
    setSelected((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set<string>();
      prev.forEach((id) => {
        if (visibleIds.has(id)) next.add(id);
      });
      return next.size === prev.size ? prev : next;
    });
  }, [visibleIds]);

  function toggleContainer(b: Bucket, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      b.shipments.forEach((s) => (on ? next.add(s.id) : next.delete(s.id)));
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-navy sm:text-3xl">Containers</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Containers arriving in {country}. Select a container to move all of its shipments through
          a stage at once.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search container, tracking #, customer, or city…"
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
          <option value="active">Active containers</option>
          <option value="all">Include handed over</option>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : buckets.length === 0 ? (
        <EmptyState
          icon={<ContainerIcon className="h-6 w-6" />}
          title={relevant.length === 0 ? "No containers have arrived yet" : "No matching containers"}
          description={
            relevant.length === 0
              ? `Containers appear here once head office advances their shipments to a ${country} destination stage.`
              : "Try a different search, or include handed-over containers."
          }
        />
      ) : (
        <div className="space-y-5">
          {buckets.map((b) => {
            const allOn = b.shipments.every((s) => selected.has(s.id));
            const someOn = b.shipments.some((s) => selected.has(s.id));
            return (
              <Card key={b.label} className="overflow-hidden">
                <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
                  <div className="min-w-0">
                    <CardTitle className="flex flex-wrap items-center gap-2">
                      <ContainerIcon className="h-4 w-4 text-gold" aria-hidden />
                      <span className="font-mono">{b.label}</span>
                      {b.heldCount > 0 && (
                        <Badge variant="danger">
                          <Lock className="mr-1 h-3 w-3" /> {b.heldCount} on hold
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span>{b.shipments.length} shipment(s)</span>
                      {b.stages.map((st) => (
                        <Badge key={st.status} variant="muted">
                          {st.count} · {STAGE_MAP[st.status]?.short ?? st.status}
                        </Badge>
                      ))}
                    </CardDescription>
                  </div>
                  <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs font-medium text-ink-muted">
                    <input
                      type="checkbox"
                      className="h-5 w-5 cursor-pointer accent-navy"
                      checked={allOn}
                      ref={(el) => {
                        if (el) el.indeterminate = someOn && !allOn;
                      }}
                      onChange={(e) => toggleContainer(b, e.target.checked)}
                      aria-label={`Select all shipments on ${b.label}`}
                    />
                    Select container
                  </label>
                </CardHeader>

                <CardContent className="p-0">
                  <ul className="divide-y divide-border">
                    {b.shipments.map((s) => {
                      const held = isDnr(s);
                      return (
                        <li key={s.id} className="flex items-start gap-3 px-5 py-3.5">
                          <input
                            type="checkbox"
                            aria-label={`Select ${s.tracking_number}`}
                            className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-navy"
                            checked={selected.has(s.id)}
                            onChange={() =>
                              setSelected((prev) => {
                                const next = new Set(prev);
                                if (next.has(s.id)) next.delete(s.id);
                                else next.add(s.id);
                                return next;
                              })
                            }
                          />
                          <Link
                            href={`/office/shipments/detail?id=${s.id}`}
                            className="min-w-0 flex-1 focus-ring rounded-md"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-sm font-semibold text-navy">
                                {s.tracking_number}
                              </span>
                              <StageBadge status={s.current_status} />
                              {held && (
                                <Badge variant="danger">
                                  <Lock className="mr-1 h-3 w-3" /> DNR
                                </Badge>
                              )}
                            </div>
                            <p className="mt-0.5 truncate text-xs text-ink-muted">
                              {s.customer_name || "-"}
                              {s.destination_city ? ` · ${s.destination_city}` : ""} ·{" "}
                              {formatDate(s.updated_at)}
                            </p>
                          </Link>
                          <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-ink-muted" />
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="flex items-start gap-2.5 rounded-xl border border-border bg-secondary/40 p-4">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
        <p className="text-xs text-ink-muted">
          Containers are loaded and numbered by head office in the USA. Your portal covers the
          destination stages: clearance, offloading, delivery and hand-over. Advancing a container
          here updates the{" "}
          <Link href="/office/inventory" className="font-semibold text-gold-700 hover:underline">
            Warehouse
          </Link>{" "}
          list and the Logistics queue automatically.
        </p>
      </div>

      {user && (
        <BulkAdvanceBar
          selected={selected}
          shipments={shipments}
          actor={{ id: user.id, full_name: user.full_name, role: user.role }}
          onDone={load}
          onClear={() => setSelected(new Set())}
        />
      )}
    </div>
  );
}
