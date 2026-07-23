"use client";

import * as React from "react";
import { Activity as ActivityIcon, Search } from "lucide-react";
import { listActivity } from "@/lib/db";
import type { ActivityLog } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton, EmptyState } from "@/components/ui/misc";
import { formatDateTime, initialsOf } from "@/lib/utils";
import type { Timestamp } from "firebase/firestore";

function tsToDate(ts?: Timestamp | null): Date | null {
  if (!ts) return null;
  try {
    return ts.toDate();
  } catch {
    return null;
  }
}

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  nigeria_office: "Office",
  dispatcher: "Dispatcher",
  customer: "Customer",
};

export default function AdminActivityPage() {
  const [loading, setLoading] = React.useState(true);
  const [items, setItems] = React.useState<ActivityLog[]>([]);
  const [error, setError] = React.useState(false);
  const [q, setQ] = React.useState("");

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const a = await listActivity(200);
        if (alive) setItems(a);
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

  const filtered = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return items;
    return items.filter(
      (a) =>
        a.actor_name?.toLowerCase().includes(term) ||
        a.action?.toLowerCase().includes(term) ||
        a.target?.toLowerCase().includes(term)
    );
  }, [items, q]);

  return (
    <div className="space-y-5">
      <Card className="p-4">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
            aria-hidden
          />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by actor, action, or target…"
            className="pl-9"
            aria-label="Search activity"
          />
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="p-4">
            <EmptyState
              icon={<ActivityIcon className="h-6 w-6" />}
              title="Could not load activity"
              description="Please refresh to try again."
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={<ActivityIcon className="h-6 w-6" />}
              title={items.length === 0 ? "No activity yet" : "No matching activity"}
              description={
                items.length === 0
                  ? "Actions across the portal will be logged here."
                  : "Try a different search term."
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50 text-left text-xs uppercase tracking-wide text-ink-muted">
                  <th className="px-4 py-3 font-semibold">Actor</th>
                  <th className="px-4 py-3 font-semibold">Action</th>
                  <th className="px-4 py-3 font-semibold">Target</th>
                  <th className="px-4 py-3 font-semibold">When</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.id} className="border-b border-border last:border-0 hover:bg-secondary/40">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy text-[11px] font-bold text-gold-300">
                          {initialsOf(a.actor_name)}
                        </span>
                        <div className="min-w-0">
                          <span className="block max-w-[160px] truncate font-medium text-navy">
                            {a.actor_name ?? "System"}
                          </span>
                          {a.actor_role && (
                            <Badge variant="muted" className="mt-0.5">
                              {ROLE_LABEL[a.actor_role] ?? a.actor_role}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink">{a.action}</td>
                    <td className="px-4 py-3 text-ink-muted">{a.target || "-"}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-ink-muted">
                      {formatDateTime(tsToDate(a.created_at))}
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
