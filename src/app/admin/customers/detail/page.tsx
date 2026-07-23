"use client";

import * as React from "react";
import { PageLoader } from "@/components/ui/misc";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Users,
  Mail,
  Phone,
  Hash,
  MapPin,
  Package,
  Send,
  KeyRound,
  RefreshCw,
  UserCheck,
  UserX,
  Copy,
  Trash2,
} from "lucide-react";
import {
  getUser,
  listShipmentsByCustomer,
  updateUserDoc,
  logNotification,
  logActivity,
} from "@/lib/db";
import { sendStageUpdateEmail, sendAccessCodeEmail } from "@/lib/notify";
import { regenerateAccessCode } from "@/lib/auth-service";
import type { AppUser, Shipment } from "@/lib/types";
import { SERVICES } from "@/lib/constants";
import { useAuth } from "@/components/providers/AuthProvider";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StageBadge, Badge } from "@/components/ui/badge";
import { Skeleton, EmptyState } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { formatCurrency, formatDate, initialsOf } from "@/lib/utils";
import type { Timestamp } from "firebase/firestore";

function tsToDate(ts?: Timestamp | null): Date | null {
  if (!ts) return null;
  try {
    return ts.toDate();
  } catch {
    return null;
  }
}

function AdminCustomerDetailPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get("id") ?? "";
  const { user } = useAuth();
  const toast = useToast();

  const [loading, setLoading] = React.useState(true);
  const [customer, setCustomer] = React.useState<AppUser | null>(null);
  const [shipments, setShipments] = React.useState<Shipment[]>([]);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [regenerated, setRegenerated] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    const [c, s] = await Promise.all([getUser(id), listShipmentsByCustomer(id)]);
    setCustomer(c);
    setShipments(s);
  }, [id]);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await load();
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [load]);

  async function toggleActive() {
    if (!customer || !user) return;
    const next = !customer.is_active;
    setBusy("active");
    try {
      await updateUserDoc(customer.id, { is_active: next });
      await logActivity({
        actor_id: user.id,
        actor_name: user.full_name,
        actor_role: "admin",
        action: next ? "reactivated customer" : "deactivated customer",
        target: customer.full_name,
        meta: { customer_id: customer.id },
      });
      await load();
      toast.success(next ? "Account reactivated" : "Account deactivated");
    } catch {
      toast.error("Action failed", "Could not update the account status.");
    } finally {
      setBusy(null);
    }
  }

  async function deleteCustomer() {
    if (!customer || !user) return;
    if (
      !window.confirm(
        `Delete ${customer.full_name}? Their account will be hidden and deactivated. Shipment and receipt records are kept for your files. This can be restored by support if needed.`
      )
    )
      return;
    setBusy("delete");
    try {
      await updateUserDoc(customer.id, { is_active: false, deleted: true });
      await logActivity({
        actor_id: user.id,
        actor_name: user.full_name,
        actor_role: "admin",
        action: "deleted customer",
        target: customer.full_name,
        meta: { customer_id: customer.id },
      });
      toast.success("Customer deleted", `${customer.full_name} has been hidden.`);
      router.push("/admin/customers");
    } catch {
      toast.error("Delete failed", "Could not delete the customer.");
      setBusy(null);
    }
  }

  async function resendCode() {
    if (!customer || !user) return;
    setBusy("resend");
    try {
      const res = await sendAccessCodeEmail({
        email: customer.email,
        fullName: customer.full_name,
      });
      await logActivity({
        actor_id: user.id,
        actor_name: user.full_name,
        actor_role: "admin",
        action: "re-sent access code",
        target: customer.full_name,
        meta: { customer_id: customer.id },
      });
      if (res.ok)
        toast.success(
          "Recovery email sent",
          "The customer received secure return instructions. Use Regenerate to issue a brand-new code."
        );
      else toast.info("Email queued", "Request logged; delivery pending.");
    } catch {
      toast.error("Send failed", "Could not re-send the access code.");
    } finally {
      setBusy(null);
    }
  }

  async function regenerateCode() {
    if (!customer || !user) return;
    if (
      !window.confirm(
        "Regenerate this customer's access code? The old code will stop working immediately and the new one will be emailed to them."
      )
    )
      return;
    setBusy("regen");
    try {
      // Mint a brand-new code (new serial, salt, hash, prefix); invalidates the old.
      const res = await regenerateAccessCode(customer.id);
      if (!res) throw new Error("no-user");
      // Email the NEW plaintext code to the customer's verified address.
      await sendAccessCodeEmail({
        email: customer.email,
        fullName: customer.full_name,
        code: res.accessCode,
      });
      await logActivity({
        actor_id: user.id,
        actor_name: user.full_name,
        actor_role: "admin",
        action: "regenerated access code",
        target: customer.full_name,
        meta: { customer_id: customer.id },
      });
      await load();
      setRegenerated(res.accessCode);
      toast.success("New code generated & emailed", "The previous code no longer works.");
    } catch {
      toast.error("Action failed", "Could not regenerate the access code.");
    } finally {
      setBusy(null);
    }
  }

  async function sendUpdate(shipment: Shipment) {
    if (!user) return;
    setBusy(`ship-${shipment.id}`);
    try {
      const res = await sendStageUpdateEmail({
        shipmentId: shipment.id,
        customerId: shipment.customer_id,
        status: shipment.current_status,
      });
      await logNotification({
        customer_id: shipment.customer_id,
        shipment_id: shipment.id,
        channel: "email",
        type: "stage_update",
        subject: `Update: ${shipment.tracking_number}`,
        status: res.ok ? "sent" : "failed",
      });
      await logActivity({
        actor_id: user.id,
        actor_name: user.full_name,
        actor_role: "admin",
        action: "sent stage update email",
        target: shipment.tracking_number,
        meta: { shipment_id: shipment.id },
      });
      if (res.ok) toast.success("Email sent");
      else toast.info("Email queued");
    } catch {
      toast.error("Send failed");
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!customer) {
    return (
      <EmptyState
        icon={<Users className="h-6 w-6" />}
        title="Customer not found"
        description="This account may have been removed or the link is invalid."
        action={
          <Link href="/admin/customers" className="text-sm font-semibold text-gold-700 hover:underline">
            Back to customers
          </Link>
        }
      />
    );
  }

  const c = customer;

  return (
    <div className="space-y-6">
      <Link
        href="/admin/customers"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-navy focus-ring"
      >
        <ArrowLeft className="h-4 w-4" /> Back to customers
      </Link>

      {/* Header card */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-navy text-lg font-bold text-gold shadow-premium">
              {initialsOf(c.full_name)}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-navy">{c.full_name}</h2>
                {c.is_active ? (
                  <Badge variant="success">Active</Badge>
                ) : (
                  <Badge variant="danger">Inactive</Badge>
                )}
              </div>
              <p className="mt-0.5 font-mono text-xs text-ink-muted">Customer ID: {c.id}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={c.is_active ? "outline" : "primary"}
              size="sm"
              onClick={toggleActive}
              loading={busy === "active"}
              disabled={busy !== null}
            >
              {c.is_active ? (
                <>
                  <UserX className="h-4 w-4" /> Deactivate
                </>
              ) : (
                <>
                  <UserCheck className="h-4 w-4" /> Reactivate
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={resendCode}
              loading={busy === "resend"}
              disabled={busy !== null}
            >
              <KeyRound className="h-4 w-4" /> Re-send code
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={deleteCustomer}
              loading={busy === "delete"}
              disabled={busy !== null}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
            <Button
              variant="gold"
              size="sm"
              onClick={regenerateCode}
              loading={busy === "regen"}
              disabled={busy !== null}
            >
              <RefreshCw className="h-4 w-4" /> Regenerate code
            </Button>
          </div>

          {regenerated && (
            <div className="mt-4 rounded-xl border-2 border-dashed border-gold/40 bg-gold-50/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-gold-700">
                New access code (shown once, also emailed to the customer)
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="select-all rounded bg-white px-3 py-1.5 font-mono text-lg font-bold tracking-[0.15em] text-navy">
                  {regenerated}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(regenerated);
                    toast.success("Copied");
                  }}
                  className="rounded-md p-2 text-ink-muted hover:bg-secondary focus-ring"
                  aria-label="Copy new access code"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contact + account */}
      <Card>
        <CardHeader>
          <CardTitle>Account details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
          <InfoRow icon={Mail} label="Email" value={c.email} />
          <InfoRow icon={Phone} label="Phone" value={c.phone || "-"} />
          <InfoRow
            icon={Users}
            label="Age"
            value={typeof c.age === "number" ? `${c.age} years` : "-"}
          />
          <InfoRow icon={MapPin} label="Address" value={c.address || "-"} />
          <InfoRow
            icon={Hash}
            label="Access code prefix"
            value={c.access_code_prefix ? `${c.access_code_prefix}…` : "-"}
          />
          <InfoRow icon={Users} label="Joined" value={formatDate(tsToDate(c.created_at))} />
          <InfoRow
            icon={Mail}
            label="Notifications"
            value={[
              c.notify_email !== false ? "Email" : null,
              c.notify_sms ? "SMS" : null,
            ]
              .filter(Boolean)
              .join(", ") || "Off"}
          />
        </CardContent>
      </Card>

      {/* Shipment history */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Shipment history ({shipments.length})</CardTitle>
        </CardHeader>
        {shipments.length === 0 ? (
          <CardContent>
            <EmptyState
              icon={<Package className="h-6 w-6" />}
              title="No shipments"
              description="This customer has no shipments yet."
            />
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-y border-border bg-secondary/50 text-left text-xs uppercase tracking-wide text-ink-muted">
                  <th className="px-4 py-3 font-semibold">Tracking #</th>
                  <th className="px-4 py-3 font-semibold">Service</th>
                  <th className="px-4 py-3 font-semibold">Stage</th>
                  <th className="px-4 py-3 text-right font-semibold">Total</th>
                  <th className="px-4 py-3 font-semibold">Created</th>
                  <th className="px-4 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {shipments.map((s) => (
                  <tr key={s.id} className="border-b border-border last:border-0 hover:bg-secondary/40">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/shipments/detail?id=${s.id}`}
                        className="font-mono text-xs font-semibold text-navy hover:text-gold-700 focus-ring"
                      >
                        {s.tracking_number || s.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">{SERVICES[s.service_type].label}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <StageBadge status={s.current_status} />
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs">
                      {formatCurrency(s.total_price, s.currency)}
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-muted">
                      {formatDate(tsToDate(s.created_at))}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => sendUpdate(s)}
                        loading={busy === `ship-${s.id}`}
                        disabled={busy !== null}
                      >
                        <Send className="h-3.5 w-3.5" /> Email update
                      </Button>
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

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-navy/5 text-navy">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-ink-muted">{label}</p>
        <p className="truncate text-sm font-medium text-ink">{value}</p>
      </div>
    </div>
  );
}


export default function Page() {
  return (
    <React.Suspense fallback={<PageLoader label="Loading…" />}>
      <AdminCustomerDetailPageInner />
    </React.Suspense>
  );
}
