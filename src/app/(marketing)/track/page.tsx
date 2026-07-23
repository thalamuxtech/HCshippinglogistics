"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  PackageSearch,
  MapPin,
  User,
  Phone,
  FileText,
  Ship,
  Plane,
  Truck,
  ArrowRight,
  Info,
  PackagePlus,
  Container,
  Lock,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import {
  viewByCustomerId,
  publicTrack,
  type CustomerView,
  type PublicTrackResult,
} from "@/lib/notify";
import { STAGES, STAGE_MAP } from "@/lib/constants";
import type { ShipmentStatus, ServiceType } from "@/lib/types";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge, StageBadge } from "@/components/ui/badge";
import { EmptyState, PageLoader, Skeleton } from "@/components/ui/misc";
import { Reveal } from "@/components/marketing/Reveal";
import { BrandPattern } from "@/components/marketing/BrandPattern";

const SERVICE_ICON: Record<string, typeof Ship> = {
  sea: Ship,
  air: Plane,
  roro: Truck,
};

type Mode = "idle" | "loading" | "customer" | "tracking" | "notfound";

export default function TrackPage() {
  return (
    <React.Suspense fallback={<PageLoader label="Loading…" />}>
      <TrackHub />
    </React.Suspense>
  );
}

function TrackHub() {
  const params = useSearchParams();
  const [code, setCode] = React.useState("");
  const [mode, setMode] = React.useState<Mode>("idle");
  const [customer, setCustomer] = React.useState<CustomerView | null>(null);
  const [tracking, setTracking] = React.useState<PublicTrackResult | null>(null);
  const [searched, setSearched] = React.useState("");

  const runLookup = React.useCallback(async (raw: string) => {
    const value = raw.trim();
    if (!value) return;
    setMode("loading");
    setCustomer(null);
    setTracking(null);
    setSearched(value);
    try {
      const view = await viewByCustomerId(value);
      if (view.found && view.shipments && view.shipments.length > 0) {
        setCustomer(view);
        setMode("customer");
        return;
      }
      // Fall back to tracking-number lookup (minimal, no PII)
      const t = await publicTrack(value);
      if (t.found) {
        setTracking(t);
        setMode("tracking");
      } else {
        setMode("notfound");
      }
    } catch {
      setMode("notfound");
    }
  }, []);

  // Auto-run from ?id= (e.g. redirected from order success)
  React.useEffect(() => {
    const id = params.get("id");
    if (id) {
      setCode(id);
      runLookup(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    runLookup(code);
  }

  return (
    <>
      {/* Hero band + input */}
      <section className="relative overflow-hidden bg-navy-gradient text-white">
        <div className="pointer-events-none absolute inset-0 bg-hero-radial" />
        <BrandPattern intensity="hero" />
        <div className="container-page relative py-16 sm:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-gold-200 ring-1 ring-white/15 backdrop-blur">
                <PackageSearch className="h-4 w-4" /> Track your shipment
              </span>
            </Reveal>
            <Reveal delay={0.08}>
              <h1 className="mt-6 text-balance text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl">
                Check your shipment status
              </h1>
            </Reveal>
            <Reveal delay={0.16}>
              <p className="mx-auto mt-5 max-w-xl text-balance text-lg leading-relaxed text-white/75">
                Enter your Customer ID to see all your shipments, full details, and your receipt.
                A tracking number shows quick status only.
              </p>
            </Reveal>
          </div>

          <Reveal delay={0.24}>
            <form
              onSubmit={onSubmit}
              className="mx-auto mt-10 flex max-w-xl flex-col gap-2 rounded-2xl bg-white/10 p-1.5 ring-1 ring-white/15 backdrop-blur sm:flex-row"
            >
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-white/50" />
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Enter your Customer ID or tracking number"
                  aria-label="Customer ID or tracking number"
                  className="h-12 w-full rounded-xl border-0 bg-transparent pl-11 pr-3 text-sm text-white placeholder:text-white/70 focus-ring"
                />
              </div>
              <button
                type="submit"
                disabled={mode === "loading"}
                className="inline-flex h-12 min-h-[44px] items-center justify-center gap-2 rounded-xl bg-gold-gradient px-6 text-sm font-semibold text-white shadow-gold transition hover:brightness-105 focus-ring disabled:opacity-60"
              >
                {mode === "loading" ? "Checking…" : "Check status"}
              </button>
            </form>
          </Reveal>
        </div>
      </section>

      {/* Results */}
      <section className="container-page py-12 sm:py-16">
        <div className="mx-auto max-w-3xl">
          {mode === "loading" && <ResultsSkeleton />}

          {mode === "customer" && customer && <CustomerResults view={customer} />}

          {mode === "tracking" && tracking && <TrackingResult result={tracking} />}

          {mode === "notfound" && (
            <EmptyState
              icon={<PackageSearch className="h-6 w-6" />}
              title="No match found"
              description={`We could not find anything for "${searched}". Double-check the Customer ID or tracking number from your confirmation email.`}
              action={
                <ButtonLink href="/order" variant="gold">
                  Start an order <ArrowRight className="h-4 w-4" />
                </ButtonLink>
              }
            />
          )}

          {mode === "idle" && <IdleHelp />}
        </div>
      </section>

      {/* CTA */}
      {(mode === "idle" || mode === "notfound") && (
        <section className="border-t border-border bg-surface">
          <div className="container-page py-14 text-center">
            <Reveal>
              <h2 className="text-2xl font-extrabold tracking-tight text-navy">
                Don&apos;t have a shipment yet?
              </h2>
              <p className="mx-auto mt-2 max-w-md text-ink-muted">
                Build your order in minutes. You get a Customer ID to track it and download your
                receipt.
              </p>
              <div className="mt-6">
                <ButtonLink href="/order" variant="gold" size="lg">
                  Start an order <ArrowRight className="h-4 w-4" />
                </ButtonLink>
              </div>
            </Reveal>
          </div>
        </section>
      )}
    </>
  );
}

/* ─────────────────────────── Idle help ─────────────────────────── */

function IdleHelp() {
  return (
    <Reveal>
      <div className="rounded-2xl border border-border bg-white p-6 shadow-card sm:p-8">
        <h2 className="text-lg font-bold text-navy">How to check your shipment</h2>
        <ul className="mt-4 space-y-3 text-sm text-ink-muted">
          <li className="flex items-start gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy/5 font-mono text-xs font-bold text-navy">
              1
            </span>
            <span>
              Enter your <span className="font-semibold text-navy">Customer ID</span> to see every
              shipment on your account, full details, totals, and your receipt.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy/5 font-mono text-xs font-bold text-navy">
              2
            </span>
            <span>
              Or enter a <span className="font-semibold text-navy">tracking number</span> for a quick
              status check. Full details need your Customer ID.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy/5 font-mono text-xs font-bold text-navy">
              3
            </span>
            <span>
              We emailed both codes to you when you placed your order. Check your inbox if you cannot
              find them.
            </span>
          </li>
        </ul>
      </div>
    </Reveal>
  );
}

/* ─────────────────────────── Customer results ─────────────────────────── */

function CustomerResults({ view }: { view: CustomerView }) {
  const shipments = view.shipments ?? [];

  function sendAnother(reuseReceiver: boolean) {
    // Prefill the order form with saved details. Sender always; receiver only
    // if the customer confirms it's going to the same person.
    const last = shipments[0];
    const payload: Record<string, unknown> = {
      // Full sender details, so a returning customer only fills the new items.
      customer_id: view.customer?.id || "",
      full_name: view.customer?.full_name || "",
      email: view.customer?.email || "",
      phone: view.customer?.phone || "",
      dob: view.customer?.dob || "",
      address: view.customer?.address || "",
      destination_country: last?.destination_country,
      destination_city: last?.destination_city,
      service_type: last?.service_type,
    };
    if (reuseReceiver && last?.receiver) payload.receiver = last.receiver;
    try {
      sessionStorage.setItem("hc_reorder", JSON.stringify(payload));
    } catch {
      /* ignore */
    }
    window.location.href = "/order";
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="rounded-2xl border border-border bg-white p-5 shadow-card"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              My Shipments
            </p>
            <h2 className="mt-0.5 truncate text-xl font-extrabold tracking-tight text-navy">
              {view.customer?.full_name
                ? `Welcome back, ${view.customer.full_name.split(" ")[0]}`
                : "Your shipments"}
            </h2>
            {view.customer?.id && (
              <p className="mt-0.5 font-mono text-xs text-ink-muted">
                Customer ID: {view.customer.id}
              </p>
            )}
          </div>
          <Badge variant="navy">
            {shipments.length} shipment{shipments.length !== 1 ? "s" : ""}
          </Badge>
        </div>

        {/* Send another item */}
        <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ink-muted">Sending something else?</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="gold" onClick={() => sendAnother(true)}>
              <PackagePlus className="h-4 w-4" /> Send to the same receiver
            </Button>
            <Button size="sm" variant="outline" onClick={() => sendAnother(false)}>
              New receiver
            </Button>
          </div>
        </div>
      </motion.div>

      <div className="space-y-5">
        {shipments.map((s, i) => (
          <ShipmentCard key={s.id} shipment={s} index={i} />
        ))}
      </div>
    </div>
  );
}

function ShipmentCard({
  shipment: s,
  index,
}: {
  shipment: NonNullable<CustomerView["shipments"]>[number];
  index: number;
}) {
  const status = s.current_status as ShipmentStatus;
  const currentOrder = STAGE_MAP[status]?.order ?? 0;
  const Icon = SERVICE_ICON[s.service_type] ?? Ship;
  const payment = (s.payment_status || "unpaid").toLowerCase();

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card className="overflow-hidden">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy text-gold-300">
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <p className="font-mono text-sm font-bold text-navy">{s.tracking_number}</p>
              <p className="text-xs text-ink-muted">
                {s.service_type.toUpperCase()} · {s.destination_country}
                {s.destination_city ? `, ${s.destination_city}` : ""}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {s.container_number && (
              <Badge variant="muted">
                <Container className="mr-1 h-3.5 w-3.5" />
                CNT #{s.container_number}
              </Badge>
            )}
            <StageBadge status={status} />
          </div>
        </div>

        <CardContent className="space-y-6 pt-5">
          {/* Progress: 8-stage */}
          <StageProgress currentOrder={currentOrder} />

          {/* Receiver + created */}
          <div className="grid gap-4 sm:grid-cols-2">
            {s.receiver && (
              <InfoBlock icon={<User className="h-4 w-4" />} label="Receiver">
                <p className="font-medium text-navy">{s.receiver.full_name}</p>
                {s.receiver.phone && (
                  <p className="flex items-center gap-1.5 text-ink-muted">
                    <Phone className="h-3 w-3" /> {s.receiver.phone}
                  </p>
                )}
                {s.receiver.address && <p className="text-ink-muted">{s.receiver.address}</p>}
              </InfoBlock>
            )}
            <InfoBlock icon={<MapPin className="h-4 w-4" />} label="Destination">
              <p className="font-medium text-navy">
                {s.destination_country}
                {s.destination_city ? `, ${s.destination_city}` : ""}
              </p>
              {s.created_at && (
                <p className="text-ink-muted">Ordered {formatDate(new Date(s.created_at))}</p>
              )}
            </InfoBlock>
          </div>

          {/* Items table (sea) */}
          {s.items && s.items.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                Items
              </p>
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-surface text-left text-xs text-ink-muted">
                      <th className="px-3 py-2 font-medium">Description</th>
                      <th className="px-3 py-2 text-center font-medium">Qty</th>
                      <th className="px-3 py-2 text-right font-medium">Unit</th>
                      <th className="px-3 py-2 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.items.map((it, idx) => (
                      <tr key={idx} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 text-navy">
                          {it.description}
                          {it.dimensions ? (
                            <span className="block text-xs text-ink-muted">{it.dimensions}</span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 text-center font-mono text-navy">{it.quantity}</td>
                        <td className="px-3 py-2 text-right font-mono text-ink-muted">
                          {formatCurrency(it.unit_price, s.currency)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-semibold text-navy">
                          {formatCurrency(it.line_total, s.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Air / RORO details */}
          {(s.weight != null || s.shipping_line || s.vehicle_class) && (
            <div className="grid gap-3 rounded-xl border border-border bg-surface p-4 text-sm sm:grid-cols-2">
              {s.weight != null && (
                <DetailRow label="Weight" value={`${s.weight} lb`} />
              )}
              {s.shipping_line && <DetailRow label="Shipping line" value={s.shipping_line} />}
              {s.vehicle_class && (
                <DetailRow label="Vehicle class" value={s.vehicle_class.replace("_", " ")} />
              )}
            </div>
          )}

          {/* Payment + total */}
          <div className="rounded-xl border border-border bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-ink-muted">Total</span>
                <PaymentBadge status={payment} />
              </div>
              <span className="font-mono text-xl font-bold text-navy">
                {formatCurrency(s.total_price, s.currency)}
              </span>
            </div>
            {(s.deposit > 0 || s.balance > 0) && (
              <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">Paid</span>
                  <span className="font-mono font-medium text-navy">
                    {formatCurrency(s.deposit, s.currency)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">Balance</span>
                  <span className="font-mono font-semibold text-navy">
                    {formatCurrency(s.balance, s.currency)}
                  </span>
                </div>
              </div>
            )}
            {s.dnr && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                <Lock className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  <span className="font-semibold">On hold (Do Not Release).</span> This
                  shipment will be released once the outstanding balance is settled. Please
                  contact us to complete payment.
                </p>
              </div>
            )}
          </div>

          {/* Invoice — available to the customer once the shipment is fully paid */}
          {payment === "paid" && s.receipt_pdf_url && (
            <a
              href={s.receipt_pdf_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-navy/20 bg-white px-5 py-2.5 text-sm font-semibold text-navy transition-colors hover:bg-navy/5 focus-ring sm:w-auto"
            >
              <FileText className="h-4 w-4" />
              Download invoice
            </a>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function StageProgress({ currentOrder }: { currentOrder: number }) {
  return (
    <div>
      {/* Bars */}
      <div className="flex gap-1">
        {STAGES.map((s) => (
          <div
            key={s.key}
            className="h-1.5 flex-1 rounded-full transition-all"
            style={{ backgroundColor: s.order <= currentOrder ? s.color : "#E2E8F0" }}
            title={s.label}
          />
        ))}
      </div>
      {/* Labelled steps (wrap on mobile) */}
      <ol className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-8">
        {STAGES.map((s) => {
          const done = s.order <= currentOrder;
          const current = s.order === currentOrder;
          return (
            <li key={s.key} className="flex flex-col items-center text-center">
              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full font-mono text-xs font-bold transition-colors",
                  done ? "text-white" : "bg-secondary text-ink-muted",
                  current && "ring-2 ring-offset-2"
                )}
                style={
                  done
                    ? { backgroundColor: s.color, ...(current ? { boxShadow: `0 0 0 2px #fff, 0 0 0 4px ${s.color}` } : {}) }
                    : undefined
                }
              >
                {s.order}
              </span>
              <span
                className={cn(
                  "mt-1.5 text-[11px] leading-tight sm:text-xs",
                  current ? "font-semibold text-navy" : "text-ink-muted"
                )}
              >
                {s.short}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-center text-xs text-ink-muted">
        Stage {currentOrder} of 8
      </p>
    </div>
  );
}

function InfoBlock({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-muted">
        {icon} {label}
      </p>
      <div className="mt-2 space-y-0.5 text-sm">{children}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-ink-muted">{label}</span>
      <span className="font-medium capitalize text-navy">{value}</span>
    </div>
  );
}

function PaymentBadge({ status }: { status: string }) {
  if (status === "paid") return <Badge variant="success">Paid</Badge>;
  if (status === "partial") return <Badge variant="warning">Part-paid</Badge>;
  return <Badge variant="danger">Unpaid</Badge>;
}

/* ─────────────────────────── Tracking-only result ─────────────────────────── */

function TrackingResult({ result }: { result: PublicTrackResult }) {
  const status = (result.current_status ?? "collection") as ShipmentStatus;
  const currentOrder = STAGE_MAP[status]?.order ?? 0;
  const service = (result.service_type ?? "sea") as ServiceType;
  const Icon = SERVICE_ICON[service] ?? Ship;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy text-gold-300">
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <p className="font-mono text-sm font-bold text-navy">
                {result.tracking_number ?? "Shipment"}
              </p>
              <p className="text-xs text-ink-muted">
                {service.toUpperCase()}
                {result.destination_country ? ` · ${result.destination_country}` : ""}
              </p>
            </div>
          </div>
          <StageBadge status={status} />
        </div>
        <CardContent className="space-y-5 pt-5">
          <StageProgress currentOrder={currentOrder} />

          <div className="flex items-start gap-3 rounded-xl border border-gold/40 bg-gold/5 p-4 text-sm">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
            <div>
              <p className="font-semibold text-navy">Quick status only</p>
              <p className="mt-0.5 text-ink-muted">
                For full details and your receipt, enter your Customer ID above.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/* ─────────────────────────── Skeleton ─────────────────────────── */

function ResultsSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-20 w-full rounded-2xl" />
      <Card className="overflow-hidden">
        <div className="flex items-center gap-3 border-b border-border bg-surface px-5 py-4">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <CardContent className="space-y-4 pt-5">
          <Skeleton className="h-2 w-full" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
          <Skeleton className="h-20 w-full rounded-xl" />
        </CardContent>
      </Card>
    </div>
  );
}
