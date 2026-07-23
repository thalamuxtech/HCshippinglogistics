"use client";

import * as React from "react";
import {
  UserCog,
  Plus,
  ShieldCheck,
  Building2,
  Truck,
  Copy,
  Power,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, FieldError, FieldHint } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Modal, PageLoader, EmptyState } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { listUsers } from "@/lib/db";
import { createStaffUser, updateStaffUser } from "@/lib/notify";
import { DESTINATION_COUNTRIES } from "@/lib/constants";
import { formatDate, initialsOf } from "@/lib/utils";
import type { AppUser, Role } from "@/lib/types";

const STAFF_ROLES: { value: Exclude<Role, "customer">; label: string; icon: React.ElementType }[] = [
  { value: "admin", label: "Administrator", icon: ShieldCheck },
  { value: "nigeria_office", label: "Destination Office", icon: Building2 },
  { value: "dispatcher", label: "Dispatcher", icon: Truck },
];

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrator",
  nigeria_office: "Destination Office",
  dispatcher: "Dispatcher",
  customer: "Customer",
};

export default function AdminStaffPage() {
  const toast = useToast();
  const [staff, setStaff] = React.useState<AppUser[] | null>(null);
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [created, setCreated] = React.useState<{ email: string; tempPassword: string } | null>(null);

  const [form, setForm] = React.useState({
    fullName: "",
    email: "",
    phone: "",
    role: "nigeria_office" as Exclude<Role, "customer">,
    assignedCountry: "Nigeria",
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const load = React.useCallback(async () => {
    // Staff = all users whose role is not "customer".
    const all = await listUsers();
    setStaff(all.filter((u) => u.role !== "customer"));
  }, []);

  React.useEffect(() => {
    load().catch(() => setStaff([]));
  }, [load]);

  function validate() {
    const e: Record<string, string> = {};
    if (form.fullName.trim().length < 2) e.fullName = "Enter the staff member's name.";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) e.email = "Enter a valid email.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function onCreate(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const res = await createStaffUser({
        email: form.email,
        fullName: form.fullName.trim(),
        role: form.role,
        phone: form.phone,
        assignedCountry: form.role === "nigeria_office" ? form.assignedCountry : undefined,
      });
      setCreated({ email: form.email.trim().toLowerCase(), tempPassword: res.tempPassword });
      setForm({ fullName: "", email: "", phone: "", role: "nigeria_office", assignedCountry: "Nigeria" });
      await load();
      toast.success("Staff account created", "Temporary password emailed to them.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not create staff account.";
      toast.error("Failed", msg);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(u: AppUser) {
    try {
      await updateStaffUser({ uid: u.id, isActive: !u.is_active });
      await load();
      toast.success(u.is_active ? "Deactivated" : "Reactivated", u.full_name);
    } catch {
      toast.error("Could not update status");
    }
  }

  async function changeCountry(u: AppUser, country: string) {
    try {
      await updateStaffUser({ uid: u.id, assignedCountry: country });
      await load();
      toast.success("Country updated", `${u.full_name} → ${country}`);
    } catch {
      toast.error("Could not update country");
    }
  }

  if (!staff) return <PageLoader label="Loading staff…" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-navy">Staff &amp; Roles</h1>
          <p className="text-sm text-ink-muted">
            Create staff accounts, assign roles, and scope destination offices by country.
          </p>
        </div>
        <Button variant="gold" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Add staff
        </Button>
      </div>

      {staff.length === 0 ? (
        <EmptyState
          icon={<UserCog className="h-6 w-6" />}
          title="No staff accounts yet"
          description="Add administrators, destination-office coordinators, and dispatchers."
          action={
            <Button variant="gold" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> Add your first staff member
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {staff.map((u) => (
            <Card key={u.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-navy text-sm font-bold text-gold-300">
                      {initialsOf(u.full_name)}
                    </span>
                    <div>
                      <p className="font-semibold text-navy">{u.full_name}</p>
                      <p className="text-xs text-ink-muted">{u.email}</p>
                    </div>
                  </div>
                  <Badge variant={u.is_active ? "success" : "danger"}>
                    {u.is_active ? "Active" : "Disabled"}
                  </Badge>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Badge variant="navy">{ROLE_LABEL[u.role]}</Badge>
                  {u.role === "nigeria_office" && (
                    <Badge variant="gold">{u.assigned_country || "No country"}</Badge>
                  )}
                </div>

                {u.role === "nigeria_office" && (
                  <div className="mt-4">
                    <Label className="text-xs">Assigned country</Label>
                    <Select
                      value={u.assigned_country || "Nigeria"}
                      onChange={(e) => changeCountry(u, e.target.value)}
                      aria-label={`Assigned country for ${u.full_name}`}
                    >
                      {DESTINATION_COUNTRIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </Select>
                  </div>
                )}

                <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                  <span className="text-xs text-ink-muted">Joined {formatDate(u.created_at)}</span>
                  <Button
                    size="sm"
                    variant={u.is_active ? "outline" : "gold"}
                    onClick={() => toggleActive(u)}
                  >
                    <Power className="h-3.5 w-3.5" />
                    {u.is_active ? "Deactivate" : "Reactivate"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create staff modal */}
      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          setCreated(null);
        }}
        title={created ? "Staff account created" : "Add staff member"}
        description={
          created
            ? "Share these credentials securely. They can also reset via email."
            : "They'll receive a temporary password by email to log in and change."
        }
      >
        {created ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                Login email
              </p>
              <p className="mt-1 font-mono text-sm text-navy">{created.email}</p>
              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                Temporary password
              </p>
              <div className="mt-1 flex items-center gap-2">
                <code className="rounded bg-white px-2 py-1 font-mono text-sm text-navy">
                  {created.tempPassword}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(created.tempPassword);
                    toast.success("Copied");
                  }}
                  className="rounded-md p-1.5 text-ink-muted hover:bg-secondary focus-ring"
                  aria-label="Copy temporary password"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </div>
            <Button
              className="w-full"
              variant="gold"
              onClick={() => {
                setOpen(false);
                setCreated(null);
              }}
            >
              Done
            </Button>
          </div>
        ) : (
          <form onSubmit={onCreate} className="space-y-4" noValidate>
            <div>
              <Label required>Full name</Label>
              <Input
                value={form.fullName}
                onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                placeholder="Jane Okafor"
              />
              <FieldError>{errors.fullName}</FieldError>
            </div>
            <div>
              <Label required>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="staff@example.com"
              />
              <FieldError>{errors.email}</FieldError>
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+234 800 000 0000"
              />
            </div>
            <div>
              <Label required>Role</Label>
              <Select
                value={form.role}
                onChange={(e) =>
                  setForm((f) => ({ ...f, role: e.target.value as Exclude<Role, "customer"> }))
                }
              >
                {STAFF_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </div>
            {form.role === "nigeria_office" && (
              <div>
                <Label required>Assigned destination country</Label>
                <Select
                  value={form.assignedCountry}
                  onChange={(e) => setForm((f) => ({ ...f, assignedCountry: e.target.value }))}
                >
                  {DESTINATION_COUNTRIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
                <FieldHint>This office will only see shipments for this country.</FieldHint>
              </div>
            )}
            <Button type="submit" variant="gold" className="w-full" loading={saving}>
              Create staff account
            </Button>
          </form>
        )}
      </Modal>
    </div>
  );
}
