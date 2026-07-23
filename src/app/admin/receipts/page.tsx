"use client";

import * as React from "react";
import Link from "next/link";
import { ReceiptText, Search, Download, ExternalLink } from "lucide-react";
import { listAllReceipts, listAllShipments } from "@/lib/db";
import type { DigitalReceipt, Shipment } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton, EmptyState } from "@/components/ui/misc";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Timestamp } from "firebase/firestore";

function tsToDate(ts?: Timestamp | null): Date | null {
  if (!ts) return null;
  try {
    return ts.toDate();
  } catch {
    return null;
  }
}

const PAY_BADGE: Record<string, "success" | "warning" | "danger"> = {
  paid: "success",
  partial: "warning",
  unpaid: "danger",
};

export default function AdminReceiptsPage() {
  const [loading, setLoading] = React.useState(true);
  const [receipts, setReceipts] = React.useState<DigitalReceipt[]>([]);
  const [shipments, setShipments] = React.useState<Record<string, Shipment>>({});
  const [error, setError] = React.useState(false);
  const [q, setQ] = React.useState("");

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [r, ships] = await Promise.all([listAllReceipts(), listAllShipments()]);
        if (!alive) return;
        setReceipts(r);
        setShipments(Object.fromEntries(ships.map((s) => [s.id, s])));
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

  const rows = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    return receipts
      .map((r) => ({ r, s: shipments[r.shipment_id] }))
      .filter(({ r, s }) => {
        if (!term) return true;
        return (
          r.receipt_number?.toLowerCase().includes(term) ||
          s?.tracking_number?.toLowerCase().includes(term) ||
          s?.customer_name?.toLowerCase().includes(term) ||
          s?.customer_email?.toLowerCase().includes(term)
        );
      });
  }, [receipts, shipments, q]);

  return (
    <div className="space-y-5">
      <Card className="p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search receipt #, tracking #, or customer…"
            className="pl-9"
            aria-label="Search receipts"
          />
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="p-4">
            <EmptyState icon={<ReceiptText className="h-6 w-6" />} title="Could not load receipts" description="Please refresh to try again." />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={<ReceiptText className="h-6 w-6" />}
              title={receipts.length === 0 ? "No receipts yet" : "No matching receipts"}
              description={
                receipts.length === 0
                  ? "Receipts appear here once staff generate them from a shipment."
                  : "Try a different search."
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50 text-left text-xs uppercase tracking-wide text-ink-muted">
                  <th className="px-4 py-3 font-semibold">Receipt #</th>
                  <th className="px-4 py-3 font-semibold">Tracking #</th>
                  <th className="px-4 py-3 font-semibold">Customer</th>
                  <th className="px-4 py-3 text-right font-semibold">Amount</th>
                  <th className="px-4 py-3 font-semibold">Payment</th>
                  <th className="px-4 py-3 font-semibold">Issued</th>
                  <th className="px-4 py-3" aria-label="Download" />
                </tr>
              </thead>
              <tbody>
                {rows.map(({ r, s }) => (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-secondary/40">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-navy">
                      {r.receipt_number}
                    </td>
                    <td className="px-4 py-3">
                      {s ? (
                        <Link
                          href={`/admin/shipments/detail?id=${s.id}`}
                          className="font-mono text-xs text-navy hover:text-gold-700 focus-ring"
                        >
                          {s.tracking_number}
                        </Link>
                      ) : (
                        <span className="text-xs text-ink-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="max-w-[180px] truncate text-ink">{s?.customer_name || "-"}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs">
                      {formatCurrency(r.amount, r.currency)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={PAY_BADGE[r.payment_status || "unpaid"]}>
                        {(r.payment_status || "unpaid").replace("partial", "part-paid")}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-muted">
                      {formatDate(tsToDate(r.generated_at))}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.pdf_url ? (
                        <a
                          href={r.pdf_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-gold-700 hover:bg-gold/10 focus-ring"
                          aria-label={`Download ${r.receipt_number}`}
                        >
                          <Download className="h-3.5 w-3.5" /> PDF
                        </a>
                      ) : (
                        <ExternalLink className="ml-auto h-4 w-4 text-border" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {!loading && !error && rows.length > 0 && (
        <p className="px-1 text-xs text-ink-muted">
          {rows.length} of {receipts.length} receipts.
        </p>
      )}
    </div>
  );
}
