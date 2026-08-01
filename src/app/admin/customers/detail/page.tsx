"use client";

import * as React from "react";
import { PageLoader } from "@/components/ui/misc";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Users,
  Mail,
  MailCheck,
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
  Pencil,
  Save,
} from "lucide-react";
import {
  getUser,
  listShipmentsByCustomer,
  updateUserDoc,
  logNotification,
  logActivity,
  planDeleteCustomer,
  deleteCustomerCascade,
  updateShipment,
  type DeleteCustomerPlan,
} from "@/lib/db";
import { sendStageUpdateEmail, sendAccessCodeEmail } from "@/lib/notify";
import { regenerateAccessCode } from "@/lib/auth-service";
import type { AppUser, Shipment } from "@/lib/types";
import { SERVICES } from "@/lib/constants";
import { useAuth } from "@/components/providers/AuthProvider";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StageBadge, Badge } from "@/components/ui/badge";
import { Skeleton, EmptyState, Modal } from "@/components/ui/misc";
import { Input, Label } from "@/components/ui/input";
import { ConfirmDeleteModal } from "@/components/portal/ConfirmDeleteModal";
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
  // Whether the code currently shown has been emailed yet (see regenerateCode).
  const [codeEmailed, setCodeEmailed] = React.useState(false);

  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [delPlan, setDelPlan] = React.useState<DeleteCustomerPlan | null>(null);
  const [delProgress, setDelProgress] = React.useState<{ done: number; total: number } | null>(null);

  // ── Contact editing ──
  // Notification emails are addressed from users/{id}.email server-side, so a
  // typo made at signup keeps every email bouncing until the stored value is
  // corrected. There was no UI to do that at all.
  const [editOpen, setEditOpen] = React.useState(false);
  const [fEmail, setFEmail] = React.useState("");
  const [fPhone, setFPhone] = React.useState("");
  const [fName, setFName] = React.useState("");
  const [fAddress, setFAddress] = React.useState("");
  const [savingContact, setSavingContact] = React.useState(false);
  const [contactError, setContactError] = React.useState<string | null>(null);

  function openEdit() {
    if (!customer) return;
    setFEmail(customer.email ?? "");
    setFPhone(customer.phone ?? "");
    setFName(customer.full_name ?? "");
    setFAddress(customer.address ?? "");
    setContactError(null);
    setEditOpen(true);
  }

  async function saveContact() {
    if (!customer || !user) return;
    const email = fEmail.trim().toLowerCase();
    const phone = fPhone.trim();
    const name = fName.trim();
    if (!name) {
      setContactError("Full name is required.");
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setContactError("Enter a valid email address.");
      return;
    }
    if (!phone) {
      setContactError("Phone number is required.");
      return;
    }
    setSavingContact(true);
    setContactError(null);
    const emailChanged = email !== (customer.email ?? "").toLowerCase();
    try {
      await updateUserDoc(customer.id, {
        email,
        phone,
        full_name: name,
        address: fAddress.trim() || undefined,
      });
      // Shipments carry denormalized copies of the customer's contact details
      // (used by invoices and the dispatch job card). Leaving them stale is what
      // makes a "corrected" address look correct in one place and wrong in
      // another, so update them alongside the account.
      const stale = shipments.filter(
        (s) =>
          (s.customer_email ?? "") !== email ||
          (s.customer_phone ?? "") !== phone ||
          (s.customer_name ?? "") !== name
      );
      let shipmentFailures = 0;
      for (const s of stale) {
        try {
          await updateShipment(s.id, {
            customer_email: email,
            customer_phone: phone,
            customer_name: name,
          });
        } catch {
          shipmentFailures += 1;
        }
      }
      await logActivity({
        actor_id: user.id,
        actor_name: user.full_name,
        actor_role: "admin",
        action: emailChanged ? "corrected customer email" : "updated customer contact details",
        target: name,
        meta: {
          customer_id: customer.id,
          old_email: customer.email ?? null,
          new_email: email,
          shipments_updated: stale.length - shipmentFailures,
        },
      });
      await load();
      setEditOpen(false);
      toast.success(
        "Contact details saved",
        shipmentFailures > 0
          ? `Account updated. ${shipmentFailures} shipment record(s) could not be synced.`
          : emailChanged
          ? "Future emails will go to the new address."
          : undefined
      );
    } catch {
      setContactError("Could not save. Please try again.");
    } finally {
      setSavingContact(false);
    }
  }

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

  // Impact counts are gathered when the dialog opens so the warning names real
  // numbers (and real tracking numbers) instead of a vague caution.
  async function openDelete() {
    if (!customer) return;
    setDeleteOpen(true);
    setDelPlan(null);
    setDelProgress(null);
    try {
      setDelPlan(await planDeleteCustomer(customer.id));
    } catch {
      // Dialog still functions without counts; the typed guard still applies.
    }
  }

  async function deleteCustomer() {
    if (!customer || !user) return;
    setBusy("delete");
    const name = customer.full_name;
    try {
      // Audit FIRST: activity_log requires actor_id == the caller's uid, and the
      // entry must survive the delete. Writing it afterwards would also work,
      // but logging the intent before a destructive cascade means a partial
      // failure still leaves a record that it was attempted.
      await logActivity({
        actor_id: user.id,
        actor_name: user.full_name,
        actor_role: "admin",
        action: "deleted customer and all their shipments",
        target: name,
        meta: {
          customer_id: customer.id,
          email: customer.email,
          shipments_deleted: delPlan?.shipments ?? null,
          tracking_numbers: delPlan?.trackingNumbers ?? [],
        },
      });
      const { shipmentsDeleted } = await deleteCustomerCascade(customer.id, (done, total) =>
        setDelProgress({ done, total })
      );
      toast.success(
        "Customer deleted",
        shipmentsDeleted > 0
          ? `${name} and ${shipmentsDeleted} shipment(s) permanently removed.`
          : `${name} has been permanently removed.`
      );
      router.push("/admin/customers");
    } catch {
      toast.error(
        "Delete failed",
        "Some records may not have been removed. Re-open the customer and try again."
      );
      setBusy(null);
      setDelProgress(null);
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
        "Regenerate this customer's access code? The old code stops working immediately. The new code is shown to you here — nothing is emailed until you choose to send it."
      )
    )
      return;
    setBusy("regen");
    try {
      // Mint a brand-new code (new serial, salt, hash, prefix); invalidates the old.
      const res = await regenerateAccessCode(customer.id);
      if (!res) throw new Error("no-user");
      // Deliberately NOT emailed here. The admin may be regenerating while the
      // customer is on the phone, or for an address that is known-bad, so
      // sending is an explicit second step ("Email code to customer" below).
      await logActivity({
        actor_id: user.id,
        actor_name: user.full_name,
        actor_role: "admin",
        action: "regenerated access code (not yet sent)",
        target: customer.full_name,
        meta: { customer_id: customer.id },
      });
      await load();
      setRegenerated(res.accessCode);
      setCodeEmailed(false);
      toast.success(
        "New code generated",
        "The previous code no longer works. Choose how to share the new one."
      );
    } catch {
      toast.error("Action failed", "Could not regenerate the access code.");
    } finally {
      setBusy(null);
    }
  }

  // Send the code currently on screen. Separate from minting it, so an admin can
  // read it out over the phone and never email it, or email it later.
  async function emailRegeneratedCode() {
    if (!customer || !user || !regenerated) return;
    setBusy("email-code");
    try {
      const res = await sendAccessCodeEmail({
        email: customer.email,
        fullName: customer.full_name,
        code: regenerated,
      });
      await logNotification({
        customer_id: customer.id,
        channel: "email",
        type: "access_code",
        subject: "Your new access code",
        status: res.ok ? "sent" : "failed",
      });
      await logActivity({
        actor_id: user.id,
        actor_name: user.full_name,
        actor_role: "admin",
        action: "emailed regenerated access code",
        target: customer.full_name,
        meta: { customer_id: customer.id },
      });
      if (res.ok) {
        setCodeEmailed(true);
        toast.success("Code emailed", `Sent to ${customer.email}.`);
      } else {
        toast.error(
          "Email not delivered",
          "The provider rejected the send. Read the code to the customer instead."
        );
      }
    } catch {
      toast.error("Send failed", "Could not email the access code.");
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
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-navy text-lg font-bold text-gold-300 shadow-premium">
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
            <Button variant="outline" size="sm" onClick={openEdit} disabled={busy !== null}>
              <Pencil className="h-4 w-4" /> Edit details
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
              onClick={openDelete}
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
            <div className="mt-4 w-full rounded-xl border-2 border-dashed border-gold/40 bg-gold-50/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-gold-700">
                New access code — shown once
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
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

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {codeEmailed ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                    <MailCheck className="h-3.5 w-3.5" /> Emailed to {c.email}
                  </span>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={emailRegeneratedCode}
                    loading={busy === "email-code"}
                    disabled={busy !== null}
                  >
                    <Mail className="h-4 w-4" /> Email code to customer
                  </Button>
                )}
              </div>
              <p className="mt-2 text-xs text-ink-muted">
                {codeEmailed
                  ? "The customer has been sent the new code."
                  : "Nothing has been emailed yet. Copy it to share by phone or WhatsApp, or email it above. It cannot be shown again after you leave this page."}
              </p>
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

      {/* Edit contact details — the fix for a signup typo. */}
      <Modal
        open={editOpen}
        onClose={() => !savingContact && setEditOpen(false)}
        title="Edit customer details"
        description="Notification emails are sent to the address stored here, so correcting it here fixes future delivery."
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="c-name" required>
              Full name
            </Label>
            <Input id="c-name" value={fName} onChange={(e) => setFName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="c-email" required>
              Email
            </Label>
            <Input
              id="c-email"
              type="email"
              value={fEmail}
              onChange={(e) => setFEmail(e.target.value)}
              autoComplete="off"
              className="font-mono"
            />
            {fEmail.trim().toLowerCase() !== (c.email ?? "").toLowerCase() && (
              <p className="mt-1.5 text-xs font-medium text-amber-600">
                Changing from {c.email || "(none)"}. The customer signs in with their access code,
                not this address, so their login is unaffected.
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="c-phone" required>
              Phone
            </Label>
            <Input id="c-phone" value={fPhone} onChange={(e) => setFPhone(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="c-address">Address</Label>
            <Input id="c-address" value={fAddress} onChange={(e) => setFAddress(e.target.value)} />
          </div>

          {shipments.length > 0 && (
            <p className="rounded-lg border border-border bg-secondary/40 p-3 text-xs text-ink-muted">
              {shipments.length} shipment record(s) carry a copy of these contact details for
              invoices and dispatch job cards. They will be updated too, so nothing is left
              showing the old value.
            </p>
          )}

          {contactError && (
            <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
              {contactError}
            </p>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setEditOpen(false)}
              disabled={savingContact}
            >
              Cancel
            </Button>
            <Button
              variant="gold"
              className="flex-1"
              onClick={saveContact}
              loading={savingContact}
              disabled={savingContact}
            >
              <Save className="h-4 w-4" /> Save details
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDeleteModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={deleteCustomer}
        title="Delete customer"
        subject={`${c.full_name} and everything belonging to them`}
        description={
          delPlan === null
            ? "Checking what this will remove…"
            : delPlan.shipments > 0
            ? `All ${delPlan.shipments} of their shipments will be deleted too, and will disappear from the container lists and the dispatch queue. This cannot be undone.`
            : "This customer has no shipments. Their account will be permanently removed. This cannot be undone."
        }
        requireTyped={c.full_name}
        impact={
          delPlan
            ? [
                { label: "Customer account", count: 1 },
                { label: "Shipments", count: delPlan.shipments },
                { label: "Invoices / receipts", count: delPlan.receipts },
                { label: "Warehouse inventory rows", count: delPlan.inventory },
                { label: "RORO documents", count: delPlan.roroDocs },
                {
                  label: "Status history entries (audit trail)",
                  count: delPlan.statusLogs,
                  retained: true,
                },
              ]
            : []
        }
        busy={busy === "delete"}
        progress={delProgress}
        confirmLabel="Delete customer & shipments"
      />
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
