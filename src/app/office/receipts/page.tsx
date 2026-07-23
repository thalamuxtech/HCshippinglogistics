"use client";

import * as React from "react";
import { Search, ReceiptText, Download } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { listShipments, listReceiptsForShipment, where } from "@/lib/db";
import type { DigitalReceipt, Shipment } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton, EmptyState } from "@/components/ui/misc";
import { formatCurrency, formatDateTime } from "@/lib/utils";

interface ReceiptRow extends DigitalReceipt {
  tracking_number?: string;
  customer_name?: string;
}

export default function OfficeReceiptsPage() {
  const { user } = useAuth();
  const country = user?.assigned_country || "Nigeria";
  const [rows, setRows] = React.useState<ReceiptRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [q, setQ] = React.useState("");

  React.useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const shipments = await listShipments([where("destination_country", "==", country)]);
        const byId = new Map<string, Shipment>(shipments.map((s) => [s.id, s]));
        const receiptLists = await Promise.all(
          shipments.map((s) => listReceiptsForShipment(s.id).catch(() => []))
        );
        const flat: ReceiptRow[] = receiptLists.flat().map((r) => {
          const s = byId.get(r.shipment_id);
          return { ...r, tracking_number: s?.tracking_number, customer_name: s?.customer_name };
        });
        flat.sort((a, b) => (b.generated_at?.toMillis?.() ?? 0) - (a.generated_at?.toMillis?.() ?? 0));
        if (active) setRows(flat);
      } catch {
        if (active) setRows([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [country]);

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (r) =>
        r.receipt_number?.toLowerCase().includes(needle) ||
        r.tracking_number?.toLowerCase().includes(needle) ||
        r.customer_name?.toLowerCase().includes(needle)
    );
  }, [rows, q]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-navy sm:text-3xl">
          Receipt Archive
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Digital receipts for {country} shipments. Re-download anytime.
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search receipt #, tracking #, or customer…"
          className="pl-10"
          aria-label="Search receipts"
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<ReceiptText className="h-6 w-6" />}
          title="No receipts found"
          description="Generate a receipt from a shipment detail page to see it archived here."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <Card key={r.id}>
              <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <span className="font-mono text-sm font-bold text-navy">
                    {r.receipt_number}
                  </span>
                  <p className="mt-1 truncate text-sm text-ink-muted">
                    {r.tracking_number || "—"}
                    {r.customer_name ? ` · ${r.customer_name}` : ""}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-muted">{formatDateTime(r.generated_at)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  <span className="font-mono text-sm font-semibold text-navy">
                    {formatCurrency(r.amount, r.currency)}
                  </span>
                  {r.pdf_url ? (
                    <ButtonLink href={r.pdf_url} external variant="outline" size="sm">
                      <Download className="h-4 w-4" /> PDF
                    </ButtonLink>
                  ) : (
                    <span className="text-xs text-ink-muted">Processing…</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
