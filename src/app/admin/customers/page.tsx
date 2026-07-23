"use client";

import * as React from "react";
import Link from "next/link";
import { Users, Search, ChevronRight } from "lucide-react";
import { listUsers } from "@/lib/db";
import type { AppUser } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton, EmptyState } from "@/components/ui/misc";
import { formatDate, initialsOf } from "@/lib/utils";
import type { Timestamp } from "firebase/firestore";

function tsToDate(ts?: Timestamp | null): Date | null {
  if (!ts) return null;
  try {
    return ts.toDate();
  } catch {
    return null;
  }
}

export default function AdminCustomersPage() {
  const [loading, setLoading] = React.useState(true);
  const [customers, setCustomers] = React.useState<AppUser[]>([]);
  const [error, setError] = React.useState(false);
  const [q, setQ] = React.useState("");

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const u = await listUsers("customer");
        if (alive) setCustomers(u);
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
    if (!term) return customers;
    return customers.filter(
      (c) =>
        c.full_name?.toLowerCase().includes(term) ||
        c.email?.toLowerCase().includes(term) ||
        c.phone?.toLowerCase().includes(term) ||
        c.access_code_prefix?.toLowerCase().includes(term) ||
        c.id?.toLowerCase().includes(term)
    );
  }, [customers, q]);

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
            placeholder="Search by name, email, phone, code prefix, or ID…"
            className="pl-9"
            aria-label="Search customers"
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
        ) : error ? (
          <div className="p-4">
            <EmptyState
              icon={<Users className="h-6 w-6" />}
              title="Could not load customers"
              description="Please refresh to try again."
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={<Users className="h-6 w-6" />}
              title={customers.length === 0 ? "No customers yet" : "No matching customers"}
              description={
                customers.length === 0
                  ? "Customer accounts will appear here."
                  : "Try a different search term."
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50 text-left text-xs uppercase tracking-wide text-ink-muted">
                  <th className="px-4 py-3 font-semibold">Customer</th>
                  <th className="px-4 py-3 font-semibold">Contact</th>
                  <th className="px-4 py-3 font-semibold">Code prefix</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Joined</th>
                  <th className="px-4 py-3" aria-label="Open" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    className="group border-b border-border last:border-0 transition-colors hover:bg-secondary/40"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/customers/detail?id=${c.id}`}
                        className="flex items-center gap-3 focus-ring"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-bold text-gold">
                          {initialsOf(c.full_name)}
                        </span>
                        <span className="min-w-0">
                          <span className="block max-w-[180px] truncate font-semibold text-navy">
                            {c.full_name}
                          </span>
                          <span className="block max-w-[180px] truncate font-mono text-[11px] text-ink-muted">
                            {c.id}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="max-w-[200px] truncate text-ink">{c.email}</div>
                      {c.phone && <div className="text-xs text-ink-muted">{c.phone}</div>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-ink-muted">
                      {c.access_code_prefix ? `${c.access_code_prefix}…` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {c.is_active ? (
                        <Badge variant="success">Active</Badge>
                      ) : (
                        <Badge variant="danger">Inactive</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-muted">
                      {formatDate(tsToDate(c.created_at))}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/customers/detail?id=${c.id}`}
                        className="inline-flex items-center rounded-md p-1 text-ink-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-navy focus-ring"
                        aria-label={`Open ${c.full_name}`}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {!loading && !error && filtered.length > 0 && (
        <p className="px-1 text-xs text-ink-muted">
          Showing {filtered.length} of {customers.length} customers.
        </p>
      )}
    </div>
  );
}
