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
  SlidersHorizontal,
  Check,
  Pencil,
  Tags,
  KeyRound,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, FieldError, FieldHint } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Modal, PageLoader, EmptyState } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { listUsers, setSiteContent } from "@/lib/db";
import { createStaffUser, updateStaffUser, resetStaffPassword } from "@/lib/notify";
import { DESTINATION_COUNTRIES } from "@/lib/constants";
import {
  useRoleLabels,
  primeRoleLabels,
  ROLE_LABEL_DEFAULTS,
  type RoleLabels,
} from "@/lib/role-labels";
import {
  featuresForRole,
  defaultFeatureKeys,
  effectiveFeatureKeys,
  type FeatureMeta,
  type FeatureKey,
} from "@/lib/features";
import { formatDate, initialsOf } from "@/lib/utils";
import type { AppUser, Role } from "@/lib/types";

// Role KEYS are fixed (rules and menus match on them); only the labels are
// admin-editable, via the "Rename roles" editor on this page.
const STAFF_ROLE_KEYS: Exclude<Role, "customer">[] = ["admin", "nigeria_office", "dispatcher"];

const ROLE_ICON: Record<string, React.ElementType> = {
  admin: ShieldCheck,
  nigeria_office: Building2,
  dispatcher: Truck,
};

export default function AdminStaffPage() {
  const toast = useToast();
  // Live, admin-editable role display names.
  const ROLE_LABEL = useRoleLabels();
  const STAFF_ROLES = React.useMemo(
    () =>
      STAFF_ROLE_KEYS.map((value) => ({
        value,
        label: ROLE_LABEL[value],
        icon: ROLE_ICON[value],
      })),
    [ROLE_LABEL]
  );

  // ── Rename roles editor ──
  const [renameOpen, setRenameOpen] = React.useState(false);
  const [renameDraft, setRenameDraft] = React.useState<RoleLabels>(ROLE_LABEL_DEFAULTS);
  const [savingNames, setSavingNames] = React.useState(false);

  function openRename() {
    setRenameDraft({ ...ROLE_LABEL });
    setRenameOpen(true);
  }

  async function saveRoleNames() {
    setSavingNames(true);
    try {
      // Blank entries fall back to the shipped default rather than saving an
      // empty label that would render as a nameless badge.
      const cleaned = Object.fromEntries(
        (Object.keys(ROLE_LABEL_DEFAULTS) as Role[]).map((k) => [
          k,
          renameDraft[k]?.trim() || ROLE_LABEL_DEFAULTS[k],
        ])
      ) as RoleLabels;
      await setSiteContent("role_labels", cleaned);
      primeRoleLabels(cleaned);
      setRenameOpen(false);
      toast.success("Role names saved", "They update across every portal.");
    } catch {
      toast.error("Could not save", "Please try again.");
    } finally {
      setSavingNames(false);
    }
  }

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

  // New-account feature access (defaults to the full set for the chosen role).
  const [createFeatures, setCreateFeatures] = React.useState<Set<FeatureKey>>(
    () => new Set(defaultFeatureKeys("nigeria_office"))
  );

  // Per-user "Manage access" modal.
  const [accessUser, setAccessUser] = React.useState<AppUser | null>(null);

  // ── Per-user "Edit staff" modal ──
  // Previously only country and menu access were editable, so a misspelled name
  // or a wrong sign-in email could not be corrected, and a staff member could
  // not be moved between roles without deleting and recreating the account.
  const [editUser, setEditUser] = React.useState<AppUser | null>(null);
  const [editForm, setEditForm] = React.useState({
    fullName: "",
    email: "",
    phone: "",
    role: "nigeria_office" as Exclude<Role, "customer">,
    assignedCountry: "Nigeria",
  });
  const [editErr, setEditErr] = React.useState<string | null>(null);
  const [savingEdit, setSavingEdit] = React.useState(false);
  // Temp password issued for the account currently open in the edit modal.
  // Shown once so the admin can read it out; never re-retrievable afterwards.
  const [issuedPw, setIssuedPw] = React.useState<{ password: string; emailed: boolean } | null>(
    null
  );
  const [resettingPw, setResettingPw] = React.useState(false);

  async function issueTempPassword() {
    if (!editUser) return;
    if (
      !window.confirm(
        `Issue a new temporary password for ${editUser.full_name}? Their current password stops working immediately.`
      )
    )
      return;
    setResettingPw(true);
    setEditErr(null);
    try {
      const res = await resetStaffPassword({ uid: editUser.id });
      setIssuedPw({ password: res.tempPassword, emailed: res.emailed });
      toast.success(
        "Temporary password issued",
        res.emailed ? `Emailed to ${editUser.email}.` : "Email not sent. Share it directly."
      );
    } catch (err: unknown) {
      setEditErr(err instanceof Error ? err.message : "Could not reset the password.");
    } finally {
      setResettingPw(false);
    }
  }

  function openEdit(u: AppUser) {
    setEditUser(u);
    setEditForm({
      fullName: u.full_name ?? "",
      email: u.email ?? "",
      phone: u.phone ?? "",
      role: (u.role === "customer" ? "nigeria_office" : u.role) as Exclude<Role, "customer">,
      assignedCountry: u.assigned_country || "Nigeria",
    });
    setEditErr(null);
    // Never carry a previous user's password into this dialog.
    setIssuedPw(null);
  }

  async function saveEdit() {
    if (!editUser) return;
    const name = editForm.fullName.trim();
    const email = editForm.email.trim().toLowerCase();
    if (name.length < 2) {
      setEditErr("Enter the staff member's name.");
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setEditErr("Enter a valid email address.");
      return;
    }
    const roleChanged = editForm.role !== editUser.role;
    // Changing role changes which menus exist, so a stale per-user override would
    // no longer make sense, reset to the new role's defaults and let the admin
    // re-customise via Manage access.
    if (
      roleChanged &&
      !window.confirm(
        `Change ${name}'s role from ${ROLE_LABEL[editUser.role]} to ${
          ROLE_LABEL[editForm.role]
        }? Their menu access resets to the new role's defaults.`
      )
    )
      return;

    setSavingEdit(true);
    setEditErr(null);
    try {
      await updateStaffUser({
        uid: editUser.id,
        fullName: name,
        email,
        phone: editForm.phone.trim(),
        role: editForm.role,
        assignedCountry:
          editForm.role === "nigeria_office" ? editForm.assignedCountry : undefined,
        ...(roleChanged ? { allowedFeatures: null } : {}),
      });
      setEditUser(null);
      await load();
      toast.success(
        "Staff updated",
        email !== (editUser.email ?? "").toLowerCase()
          ? `${name} now signs in with ${email}.`
          : name
      );
    } catch (err: unknown) {
      setEditErr(err instanceof Error ? err.message : "Could not save the changes.");
    } finally {
      setSavingEdit(false);
    }
  }

  // Reset the feature selection to the role default whenever the role changes.
  React.useEffect(() => {
    setCreateFeatures(new Set(defaultFeatureKeys(form.role)));
  }, [form.role]);

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
      // Only send an override when the selection differs from the full role
      // default; otherwise leave null so the account tracks role defaults.
      const roleDefaults = defaultFeatureKeys(form.role);
      const isFullDefault =
        createFeatures.size === roleDefaults.length &&
        roleDefaults.every((k) => createFeatures.has(k));
      const res = await createStaffUser({
        email: form.email,
        fullName: form.fullName.trim(),
        role: form.role,
        phone: form.phone,
        assignedCountry: form.role === "nigeria_office" ? form.assignedCountry : undefined,
        allowedFeatures: isFullDefault ? null : Array.from(createFeatures),
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

  async function saveAccess(u: AppUser, keys: FeatureKey[] | null) {
    try {
      await updateStaffUser({ uid: u.id, allowedFeatures: keys });
      setAccessUser(null);
      await load();
      toast.success("Access updated", `${u.full_name}'s menus were saved.`);
    } catch {
      toast.error("Could not update access");
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
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={openRename}>
            <Tags className="h-4 w-4" /> Rename roles
          </Button>
          <Button variant="gold" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Add staff
          </Button>
        </div>
      </div>

      {staff.length === 0 ? (
        <EmptyState
          icon={<UserCog className="h-6 w-6" />}
          title="No staff accounts yet"
          description="Add administrators, destination-office coordinators, and Logistics staff."
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
                {/* min-w-0 + truncate: a long staff email (the default admin
                    address is 36 chars) cannot wrap, and a flex item defaults to
                    min-width:auto, so without these the card overflows the
                    viewport on phones. */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-navy text-sm font-bold text-gold-300">
                      {initialsOf(u.full_name)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-navy">{u.full_name}</p>
                      <p className="truncate text-xs text-ink-muted" title={u.email}>
                        {u.email}
                      </p>
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

                {/* Menu access summary */}
                {(() => {
                  const total = featuresForRole(u.role).length;
                  const eff = effectiveFeatureKeys(u.role, u.allowed_features).size;
                  const custom = u.allowed_features != null;
                  return (
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2">
                      <span className="min-w-0 text-xs text-ink-muted">
                        <span className="font-semibold text-navy">{eff}</span> of {total} menus
                        {custom ? " · customized" : " · role default"}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(u)}>
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setAccessUser(u)}>
                          <SlidersHorizontal className="h-3.5 w-3.5" /> Access
                        </Button>
                      </div>
                    </div>
                  );
                })()}

                <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                  <span className="text-xs text-ink-muted">Joined {formatDate(u.created_at)}</span>
                  {/* Administrators cannot be deactivated from here. */}
                  {u.role === "admin" ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted">
                      <ShieldCheck className="h-3.5 w-3.5 text-navy" /> Administrator
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant={u.is_active ? "outline" : "gold"}
                      onClick={() => toggleActive(u)}
                    >
                      <Power className="h-3.5 w-3.5" />
                      {u.is_active ? "Deactivate" : "Reactivate"}
                    </Button>
                  )}
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

            {/* Menu / feature access for the new account */}
            <div>
              <Label>Menu access</Label>
              <FieldHint>
                {form.role === "admin"
                  ? "Administrators always have full access to every menu. This cannot be changed."
                  : "Choose which back-end menus this person can use. Core menus stay on."}
              </FieldHint>
              <div className="mt-2 space-y-1.5 rounded-lg border border-border p-3">
                {featuresForRole(form.role).map((f) => {
                  // Admins always have every PAGE; those checkboxes are locked
                  // on. Opt-in tools stay toggleable and default to off.
                  const lockAll = form.role === "admin" && !f.optIn;
                  const locked = lockAll || f.required;
                  const checked = lockAll ? true : createFeatures.has(f.key);
                  return (
                    <label
                      key={f.key}
                      className={`flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm ${
                        locked ? "opacity-60" : "cursor-pointer hover:bg-secondary/50"
                      }`}
                    >
                      <span className="text-ink">
                        {f.label}
                        {(f.required || lockAll) && (
                          <span className="ml-1.5 text-[10px] uppercase tracking-wide text-ink-muted">
                            {lockAll ? "always on" : "core"}
                          </span>
                        )}
                        {f.optIn && !checked && (
                          <span className="ml-1.5 text-[10px] uppercase tracking-wide text-amber-600">
                            off by default
                          </span>
                        )}
                      </span>
                      <input
                        type="checkbox"
                        className="h-4 w-4 cursor-pointer accent-navy disabled:cursor-not-allowed"
                        checked={checked}
                        disabled={locked}
                        onChange={(e) =>
                          setCreateFeatures((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(f.key);
                            else next.delete(f.key);
                            return next;
                          })
                        }
                      />
                    </label>
                  );
                })}
              </div>
            </div>

            <Button type="submit" variant="gold" className="w-full" loading={saving}>
              Create staff account
            </Button>
          </form>
        )}
      </Modal>

      {/* Rename roles, labels only; the underlying keys never change */}
      <Modal
        open={renameOpen}
        onClose={() => !savingNames && setRenameOpen(false)}
        title="Rename roles"
        description="Change what each role is called across every portal, badge and staff list."
      >
        <div className="space-y-4">
          {(Object.keys(ROLE_LABEL_DEFAULTS) as Role[]).map((key) => (
            <div key={key}>
              <Label htmlFor={`rn-${key}`}>
                {ROLE_LABEL_DEFAULTS[key]}
                {key === "customer" && " (public-facing)"}
              </Label>
              <Input
                id={`rn-${key}`}
                value={renameDraft[key] ?? ""}
                onChange={(e) =>
                  setRenameDraft((d) => ({ ...d, [key]: e.target.value }))
                }
                placeholder={ROLE_LABEL_DEFAULTS[key]}
              />
            </div>
          ))}

          <p className="rounded-lg border border-border bg-secondary/40 p-3 text-xs text-ink-muted">
            This changes the display name only. Permissions, menus and existing accounts are
            unaffected, so renaming is always safe and reversible. Leave a field blank to restore
            its default.
          </p>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setRenameOpen(false)}
              disabled={savingNames}
            >
              Cancel
            </Button>
            <Button
              variant="gold"
              className="flex-1"
              onClick={saveRoleNames}
              loading={savingNames}
              disabled={savingNames}
            >
              <Check className="h-4 w-4" /> Save names
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit staff member, name, sign-in email, phone, role */}
      <Modal
        open={editUser !== null}
        onClose={() => !savingEdit && setEditUser(null)}
        title="Edit staff member"
        description="Rename, correct the sign-in email, or move this person to a different role."
      >
        {editUser && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="ed-name" required>
                Full name
              </Label>
              <Input
                id="ed-name"
                value={editForm.fullName}
                onChange={(e) => setEditForm((f) => ({ ...f, fullName: e.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="ed-email" required>
                Email (sign-in)
              </Label>
              <Input
                id="ed-email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                className="font-mono"
                autoComplete="off"
              />
              {editForm.email.trim().toLowerCase() !== (editUser.email ?? "").toLowerCase() && (
                <FieldHint>
                  This is their login. They must use the new address next time they sign in. Their
                  password does not change.
                </FieldHint>
              )}
            </div>

            <div>
              <Label htmlFor="ed-phone">Phone</Label>
              <Input
                id="ed-phone"
                value={editForm.phone}
                onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="ed-role" required>
                Role
              </Label>
              <Select
                id="ed-role"
                value={editForm.role}
                onChange={(e) =>
                  setEditForm((f) => ({
                    ...f,
                    role: e.target.value as Exclude<Role, "customer">,
                  }))
                }
              >
                {STAFF_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </Select>
              {editForm.role !== editUser.role && (
                <FieldHint>
                  Menu access resets to the {ROLE_LABEL[editForm.role]} defaults; adjust it
                  afterwards with Access.
                </FieldHint>
              )}
            </div>

            {editForm.role === "nigeria_office" && (
              <div>
                <Label htmlFor="ed-country" required>
                  Assigned destination country
                </Label>
                <Select
                  id="ed-country"
                  value={editForm.assignedCountry}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, assignedCountry: e.target.value }))
                  }
                >
                  {DESTINATION_COUNTRIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            {/* Temporary password, for staff who cannot use the reset email */}
            <div className="rounded-lg border border-border bg-secondary/40 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                    Password
                  </p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    Issue a temporary password to hand over directly.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={issueTempPassword}
                  loading={resettingPw}
                  disabled={resettingPw || savingEdit}
                >
                  <KeyRound className="h-3.5 w-3.5" /> Reset password
                </Button>
              </div>

              {issuedPw && (
                <div className="mt-3 rounded-lg border-2 border-dashed border-gold/40 bg-gold-50/60 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-gold-700">
                    Temporary password (shown once)
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <code className="select-all rounded bg-white px-2.5 py-1.5 font-mono text-base font-bold tracking-wider text-navy">
                      {issuedPw.password}
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(issuedPw.password);
                        toast.success("Copied");
                      }}
                      className="rounded-md p-2 text-ink-muted hover:bg-white focus-ring"
                      aria-label="Copy temporary password"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-ink-muted">
                    {issuedPw.emailed
                      ? "Also emailed to them. They should change it after signing in."
                      : "The email did not send. Read this out or send it another way. It cannot be shown again."}
                  </p>
                </div>
              )}
            </div>

            {editErr && <FieldError>{editErr}</FieldError>}

            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setEditUser(null)}
                disabled={savingEdit}
              >
                Cancel
              </Button>
              <Button
                variant="gold"
                className="flex-1"
                onClick={saveEdit}
                loading={savingEdit}
                disabled={savingEdit}
              >
                <Check className="h-4 w-4" /> Save changes
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Manage per-user access modal */}
      {accessUser && (
        <AccessModal
          user={accessUser}
          onClose={() => setAccessUser(null)}
          onSave={saveAccess}
        />
      )}
    </div>
  );
}

// ── Per-user "Manage access" modal ──
function AccessModal({
  user,
  onClose,
  onSave,
}: {
  user: AppUser;
  onClose: () => void;
  onSave: (u: AppUser, keys: FeatureKey[] | null) => Promise<void> | void;
}) {
  const features = featuresForRole(user.role);
  // Administrators always have full access to every PAGE; their menus are not
  // editable. Opt-in tools are the exception, they stay individually
  // toggleable, because the point of an opt-in tool (e.g. demo data seeding)
  // is that it is off until deliberately granted, even for an admin.
  const lockPages = user.role === "admin";
  const lockAllFor = (f: FeatureMeta) => lockPages && !f.optIn;
  const [selected, setSelected] = React.useState<Set<FeatureKey>>(
    () => effectiveFeatureKeys(user.role, user.allowed_features)
  );
  const [saving, setSaving] = React.useState(false);

  const roleDefaults = defaultFeatureKeys(user.role);
  const isFullDefault =
    selected.size === roleDefaults.length && roleDefaults.every((k) => selected.has(k));

  async function handleSave() {
    setSaving(true);
    // Locked page checkboxes are disabled, so `selected` may not contain them.
    // Re-add every locked feature before saving, otherwise persisting the set
    // would strip an administrator's access to the pages they must always have.
    const toSave = new Set(selected);
    for (const f of features) {
      if (lockAllFor(f) || f.required) toSave.add(f.key);
    }
    const defaults = new Set(roleDefaults);
    const matchesDefault =
      toSave.size === defaults.size && Array.from(toSave).every((k) => defaults.has(k));
    // Matches the role default -> null (keep tracking the role); else exact set.
    await onSave(user, matchesDefault ? null : Array.from(toSave));
    setSaving(false);
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Menu access: ${user.full_name}`}
      description="Turn back-end menus on or off for this account. Core menus cannot be removed."
    >
      <div className="space-y-4">
        {lockPages ? (
          <div className="flex items-start gap-2.5 rounded-lg border border-navy/15 bg-navy/5 p-3 text-sm text-navy">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-navy" />
            <p>
              Administrators always have full access to every menu. Optional tools below can still
              be switched on or off.
            </p>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <Badge variant={isFullDefault ? "muted" : "gold"}>
              {isFullDefault ? "Role default" : "Customized"}
            </Badge>
            <button
              type="button"
              onClick={() => setSelected(new Set(roleDefaults))}
              className="text-xs font-semibold text-gold-700 hover:underline focus-ring rounded"
            >
              Reset to role default
            </button>
          </div>
        )}

        <div className="max-h-[50vh] space-y-1.5 overflow-y-auto rounded-lg border border-border p-3">
          {features.map((f) => {
            const lockAll = lockAllFor(f);
            const locked = lockAll || f.required;
            const checked = lockAll ? true : selected.has(f.key);
            return (
              <label
                key={f.key}
                className={`flex items-center justify-between gap-2 rounded-md px-2 py-2 text-sm ${
                  locked ? "opacity-60" : "cursor-pointer hover:bg-secondary/50"
                }`}
              >
                <span className="flex items-center gap-2 text-ink">
                  {checked ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <span className="h-4 w-4" />
                  )}
                  {f.label}
                  {(f.required || lockAll) && (
                    <span className="text-[10px] uppercase tracking-wide text-ink-muted">
                      {lockAll ? "always on" : "core"}
                    </span>
                  )}
                  {f.optIn && !checked && (
                    <span className="text-[10px] uppercase tracking-wide text-amber-600">
                      off by default
                    </span>
                  )}
                </span>
                <input
                  type="checkbox"
                  className="h-4 w-4 cursor-pointer accent-navy disabled:cursor-not-allowed"
                  checked={checked}
                  disabled={locked}
                  onChange={(e) =>
                    setSelected((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.add(f.key);
                      else next.delete(f.key);
                      return next;
                    })
                  }
                />
              </label>
            );
          })}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="gold" className="flex-1" onClick={handleSave} loading={saving}>
            Save access
          </Button>
        </div>
      </div>
    </Modal>
  );
}
