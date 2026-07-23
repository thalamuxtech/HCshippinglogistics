"use client";

import * as React from "react";
import Link from "next/link";
import { ReceiptText, Download, ExternalLink } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { listReceiptsForCustomer } from "@/lib/db";
import type { DigitalReceipt, Shipment } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { Skeleton, EmptyState } from "@/components/ui/misc";

type Row = { receipt: DigitalReceipt; shipment: Shipment };

export default function ReceiptsPage() {
  const { user } = useAuth();
  const [rows, setRows] = React.useState<Row[] | null>(null);

  React.useEffect(() => {
    if (!user) return;
    let active = true;
    listReceiptsForCustomer(user.id)
      .then((r) => {
        if (!active) return;
        r.sort((a, b) => {
          const ta = a.receipt.generated_at?.toMillis?.() ?? 0;
          const tb = b.receipt.generated_at?.toMillis?.() ?? 0;
          return tb - ta;
        });
        setRows(r);
      })
      .catch(() => active && setRows([]));
    return () => {
      active = false;
    };
  }, [user]);

  const loading = rows === null;

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow">Receipts</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-navy sm:text-3xl">
          Digital receipts
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Formal receipts for every shipment — archived permanently and downloadable anytime.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<ReceiptText className="h-6 w-6" />}
          title="No receipts yet"
          description="Once your shipments are inspected and receipted, they will appear here."
          action={
            <ButtonLink href="/portal/shipments" variant="outline">
              View my shipments
            </ButtonLink>
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {rows.map(({ receipt, shipment }) => (
                <li
                  key={receipt.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5"
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-navy/5 text-navy">
                      <ReceiptText className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="font-mono text-sm font-semibold text-navy">
                        {receipt.receipt_number}
                      </p>
                      <Link
                        href={`/portal/shipments/${shipment.id}`}
                        className="inline-flex items-center gap-1 font-mono text-xs text-ink-muted hover:text-navy focus-ring rounded"
                      >
                        {shipment.tracking_number} <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-mono text-sm font-semibold text-navy">
                        {formatCurrency(receipt.amount, receipt.currency)}
                      </p>
                      <p className="text-xs text-ink-muted">
                        {formatDate(receipt.generated_at)}
                      </p>
                    </div>
                    {receipt.pdf_url ? (
                      <ButtonLink
                        href={receipt.pdf_url}
                        external
                        variant="outline"
                        size="sm"
                        aria-label={`Download receipt ${receipt.receipt_number}`}
                      >
                        <Download className="h-4 w-4" /> PDF
                      </ButtonLink>
                    ) : (
                      <span className="text-xs text-ink-muted">Pending</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
