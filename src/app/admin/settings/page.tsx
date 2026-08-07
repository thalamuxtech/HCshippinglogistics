"use client";

// ─────────────────────────────────────────────────────────────
// Admin → Settings
//
// One place for the system-level controls that were previously scattered (or had
// no home at all): company details used across the site and every email, role
// naming, email deliverability, and full backup / restore.
//
// Company details live in site_content/company and are read through
// useCompanyInfo, which falls back to the built-in COMPANY constant — so the site
// renders correct values before Firestore resolves and keeps working if the doc
// is absent.
// ─────────────────────────────────────────────────────────────

import * as React from "react";
import Link from "next/link";
import {
  Building2,
  Download,
  Upload,
  DatabaseBackup,
  AlertTriangle,
  Check,
  Loader2,
  Tags,
  Mail,
  ShieldCheck,
  Info,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea, FieldHint } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { EmailTestCard } from "@/components/portal/EmailTestCard";
import { useAuth } from "@/components/providers/AuthProvider";
import { setSiteContent, logActivity } from "@/lib/db";
import { exportBackup, restoreBackup, type BackupFile } from "@/lib/notify";
import { useCompanyInfo, primeCompanyInfo, type CompanyInfo } from "@/lib/company-info";
import { useRoleLabels, primeRoleLabels, ROLE_LABEL_DEFAULTS, type RoleLabels } from "@/lib/role-labels";
import type { Role } from "@/lib/types";

export default function AdminSettingsPage() {
  const toast = useToast();
  const { user } = useAuth();
  const company = useCompanyInfo();
  const roleLabels = useRoleLabels();

  // ── Company details ──
  const [form, setForm] = React.useState<CompanyInfo>(company);
  const [savingCompany, setSavingCompany] = React.useState(false);
  // Re-seed once the live doc resolves, unless the admin has started editing.
  const touched = React.useRef(false);
  React.useEffect(() => {
    if (!touched.current) setForm(company);
  }, [company]);
  const setField = <K extends keyof CompanyInfo>(k: K, v: CompanyInfo[K]) => {
    touched.current = true;
    setForm((f) => ({ ...f, [k]: v }));
  };

  async function saveCompany() {
    setSavingCompany(true);
    try {
      const clean: CompanyInfo = {
        ...form,
        usaLines: form.usaLines.filter((l) => l.trim()),
        usaPhones: form.usaPhones.filter((p) => p.trim()),
        nigeriaLines: form.nigeriaLines.filter((l) => l.trim()),
        nigeriaPhones: form.nigeriaPhones.filter((p) => p.trim()),
      };
      await setSiteContent("company", clean as unknown as Record<string, unknown>);
      primeCompanyInfo(clean);
      touched.current = false;
      toast.success("Company details saved", "They update across the site and emails.");
    } catch {
      toast.error("Could not save", "Please try again.");
    } finally {
      setSavingCompany(false);
    }
  }

  // ── Role names ──
  const [names, setNames] = React.useState<RoleLabels>(roleLabels);
  const [savingNames, setSavingNames] = React.useState(false);
  const namesTouched = React.useRef(false);
  React.useEffect(() => {
    if (!namesTouched.current) setNames(roleLabels);
  }, [roleLabels]);

  async function saveNames() {
    setSavingNames(true);
    try {
      const cleaned = Object.fromEntries(
        (Object.keys(ROLE_LABEL_DEFAULTS) as Role[]).map((k) => [
          k,
          names[k]?.trim() || ROLE_LABEL_DEFAULTS[k],
        ])
      ) as RoleLabels;
      await setSiteContent("role_labels", cleaned);
      primeRoleLabels(cleaned);
      namesTouched.current = false;
      toast.success("Role names saved", "They update across every portal.");
    } catch {
      toast.error("Could not save", "Please try again.");
    } finally {
      setSavingNames(false);
    }
  }

  // ── Backup / restore ──
  const [exporting, setExporting] = React.useState(false);
  const [pending, setPending] = React.useState<BackupFile | null>(null);
  const [restoreMode, setRestoreMode] = React.useState<"merge" | "replace">("merge");
  const [restoring, setRestoring] = React.useState(false);
  const [confirmText, setConfirmText] = React.useState("");
  const fileRef = React.useRef<HTMLInputElement>(null);

  async function handleExport() {
    setExporting(true);
    try {
      const backup = await exportBackup();
      // Download entirely client-side — the file never touches a third party.
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      a.href = url;
      a.download = `highclass-backup-${stamp}.json`;
      // The anchor must be IN the document and the object URL must outlive the
      // click: revoking it synchronously cancels the download for a file this
      // size, which is exactly when a backup matters most.
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 60_000);
      toast.success(
        "Backup downloaded",
        `${backup.total.toLocaleString()} records across ${Object.keys(backup.counts).length} collections.`
      );
    } catch (e) {
      toast.error(
        "Backup failed",
        e instanceof Error ? e.message.slice(0, 160) : "Please try again."
      );
    } finally {
      setExporting(false);
    }
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as BackupFile;
        if (!parsed?.data || typeof parsed.format !== "number") {
          toast.error("Not a backup file", "Choose a file exported from this page.");
          return;
        }
        setPending(parsed);
        setRestoreMode("merge");
        setConfirmText("");
      } catch {
        toast.error("Could not read that file", "It is not valid JSON.");
      }
    };
    reader.onerror = () => toast.error("Could not read that file");
    reader.readAsText(file);
  }

  async function handleRestore() {
    if (!pending || !user) return;
    setRestoring(true);
    try {
      const res = await restoreBackup({ backup: pending, mode: restoreMode });
      await logActivity({
        actor_id: user.id,
        actor_name: user.full_name,
        actor_role: "admin",
        action: `restored backup (${restoreMode})`,
        meta: { documents: res.writes, exported_at: pending.exported_at },
      });
      setPending(null);
      toast.success(
        "Restore complete",
        `${res.writes.toLocaleString()} records written. Reload to see the restored data.`
      );
    } catch (e) {
      toast.error(
        "Restore failed",
        e instanceof Error ? e.message.slice(0, 160) : "Please try again."
      );
    } finally {
      setRestoring(false);
    }
  }

  const pendingTotal = pending
    ? Object.values(pending.counts ?? {}).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-navy">Settings</h1>
        <p className="text-sm text-ink-muted">
          Company details, role naming, email delivery, and system backup.
        </p>
      </div>

      {/* ── Company details ── */}
      <Card>
        <CardHeader className="flex-row items-start gap-2 space-y-0">
          <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden />
          <div>
            <CardTitle>Company details</CardTitle>
            <CardDescription className="mt-1">
              Used on the website, invoices and every email. Changing them here updates all of
              those at once.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="c-name">Company name</Label>
              <Input
                id="c-name"
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="c-email">Contact email</Label>
              <Input
                id="c-email"
                type="email"
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
                className="font-mono"
              />
            </div>
          </div>

          <div className="rounded-lg border border-border p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              USA office &amp; warehouse
            </p>
            <div className="mt-2 space-y-2">
              <Textarea
                aria-label="USA address lines"
                value={form.usaLines.join("\n")}
                onChange={(e) => setField("usaLines", e.target.value.split("\n"))}
                className="min-h-[70px]"
                placeholder="One line per row"
              />
              <Input
                aria-label="USA phone numbers"
                value={form.usaPhones.join(", ")}
                onChange={(e) =>
                  setField("usaPhones", e.target.value.split(",").map((p) => p.trim()))
                }
                placeholder="Comma-separated"
              />
            </div>
            <FieldHint>Both numbers show in the website header, in this order.</FieldHint>
          </div>

          <div className="rounded-lg border border-border p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Destination office
            </p>
            <div className="mt-2 space-y-2">
              <Textarea
                aria-label="Destination address lines"
                value={form.nigeriaLines.join("\n")}
                onChange={(e) => setField("nigeriaLines", e.target.value.split("\n"))}
                className="min-h-[70px]"
              />
              <Input
                aria-label="Destination phone numbers"
                value={form.nigeriaPhones.join(", ")}
                onChange={(e) =>
                  setField("nigeriaPhones", e.target.value.split(",").map((p) => p.trim()))
                }
                placeholder="Comma-separated"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="c-free">Free storage days</Label>
              <Input
                id="c-free"
                type="number"
                min="0"
                value={form.freeStorageDays}
                onChange={(e) => setField("freeStorageDays", Number(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label htmlFor="c-daily">Daily storage charge (₦)</Label>
              <Input
                id="c-daily"
                type="number"
                min="0"
                value={form.dailyStorageNaira}
                onChange={(e) => setField("dailyStorageNaira", Number(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button variant="gold" onClick={saveCompany} loading={savingCompany} disabled={savingCompany}>
              <Check className="h-4 w-4" /> Save company details
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Role names ── */}
      <Card>
        <CardHeader className="flex-row items-start gap-2 space-y-0">
          <Tags className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden />
          <div>
            <CardTitle>Role names</CardTitle>
            <CardDescription className="mt-1">
              What each role is called across the portals. Permissions and existing accounts are
              unaffected, so renaming is always safe.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {(Object.keys(ROLE_LABEL_DEFAULTS) as Role[]).map((k) => (
              <div key={k}>
                <Label htmlFor={`rn-${k}`}>{ROLE_LABEL_DEFAULTS[k]}</Label>
                <Input
                  id={`rn-${k}`}
                  value={names[k] ?? ""}
                  onChange={(e) => {
                    namesTouched.current = true;
                    setNames((n) => ({ ...n, [k]: e.target.value }));
                  }}
                  placeholder={ROLE_LABEL_DEFAULTS[k]}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={saveNames} loading={savingNames} disabled={savingNames}>
              <Check className="h-4 w-4" /> Save role names
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Email delivery ── */}
      <EmailTestCard />

      {/* ── Backup & restore ── */}
      <Card>
        <CardHeader className="flex-row items-start gap-2 space-y-0">
          <DatabaseBackup className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden />
          <div>
            <CardTitle>Backup &amp; restore</CardTitle>
            <CardDescription className="mt-1">
              Download every record as a single JSON file, and restore it later. JSON is used
              rather than CSV because it preserves nested data (items, receiver details) and real
              dates exactly — a CSV round-trip would corrupt them.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="gold" onClick={handleExport} loading={exporting} disabled={exporting}>
              {exporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Preparing…
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" /> Download backup
                </>
              )}
            </Button>
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" /> Restore from file
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              onChange={onPickFile}
              className="sr-only"
              aria-label="Choose a backup file"
            />
          </div>

          <div className="flex items-start gap-2.5 rounded-lg border border-border bg-secondary/40 p-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
            <div className="text-xs text-ink-muted">
              <p>
                The file contains customer names, addresses, phone numbers and order history.
                Store it somewhere private — treat it like the database itself.
              </p>
              <p className="mt-1.5">
                Uploaded files stay in your browser until you confirm the restore. Invoice PDFs and
                delivery photos live in file storage and are not part of this backup.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <p className="flex items-center gap-1.5 px-1 text-xs text-ink-muted">
        <ShieldCheck className="h-3.5 w-3.5" />
        Staff accounts and menu access are managed under{" "}
        <Link href="/admin/staff" className="font-semibold text-gold-700 hover:underline">
          Staff &amp; Roles
        </Link>
        ; prices under{" "}
        <Link href="/admin/pricing" className="font-semibold text-gold-700 hover:underline">
          Pricing
        </Link>
        .
      </p>

      {/* Restore confirmation */}
      <Modal
        open={pending !== null}
        onClose={() => !restoring && setPending(null)}
        title="Restore from backup"
        description="Check this is the right file before continuing."
      >
        {pending && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-secondary/40 p-3 text-sm">
              <p className="text-ink">
                Taken{" "}
                <strong>
                  {(() => {
                    try {
                      return new Date(pending.exported_at).toLocaleString();
                    } catch {
                      return pending.exported_at;
                    }
                  })()}
                </strong>
              </p>
              <p className="mt-0.5 text-ink-muted">
                {pendingTotal.toLocaleString()} records ·{" "}
                {Object.keys(pending.counts ?? {}).length} collections
              </p>
              <ul className="mt-2 grid grid-cols-2 gap-x-4 text-xs text-ink-muted">
                {Object.entries(pending.counts ?? {})
                  .filter(([, n]) => n > 0)
                  .map(([name, n]) => (
                    <li key={name} className="flex justify-between gap-2">
                      <span className="truncate">{name}</span>
                      <span className="font-mono">{n}</span>
                    </li>
                  ))}
              </ul>
            </div>

            <div className="space-y-2">
              <Label>How should it be applied?</Label>
              {(
                [
                  {
                    key: "merge" as const,
                    title: "Merge (recommended)",
                    desc: "Writes the backup over current data. Records created since the backup are left alone.",
                  },
                  {
                    key: "replace" as const,
                    title: "Replace",
                    desc: "Also deletes records that are not in the backup, so the database matches the file exactly.",
                  },
                ]
              ).map((opt) => (
                <label
                  key={opt.key}
                  className={`flex cursor-pointer gap-2.5 rounded-lg border p-3 ${
                    restoreMode === opt.key
                      ? "border-gold bg-gold/5"
                      : "border-border hover:bg-secondary/40"
                  }`}
                >
                  <input
                    type="radio"
                    name="restore-mode"
                    checked={restoreMode === opt.key}
                    onChange={() => {
                      setRestoreMode(opt.key);
                      setConfirmText("");
                    }}
                    className="mt-0.5 h-4 w-4 cursor-pointer accent-navy"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-navy">{opt.title}</span>
                    <span className="block text-xs text-ink-muted">{opt.desc}</span>
                  </span>
                </label>
              ))}
            </div>

            {restoreMode === "replace" && (
              <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="flex items-start gap-2 text-sm font-semibold text-red-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  This deletes anything not in the backup — including orders placed since it was
                  taken.
                </p>
                <div>
                  <Label htmlFor="restore-confirm" required>
                    Type <span className="font-mono">REPLACE</span> to continue
                  </Label>
                  <Input
                    id="restore-confirm"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    autoComplete="off"
                  />
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setPending(null)}
                disabled={restoring}
              >
                Cancel
              </Button>
              <Button
                variant={restoreMode === "replace" ? "destructive" : "gold"}
                className="flex-1"
                onClick={handleRestore}
                loading={restoring}
                disabled={
                  restoring || (restoreMode === "replace" && confirmText.trim() !== "REPLACE")
                }
              >
                <Upload className="h-4 w-4" />
                {restoreMode === "replace" ? "Replace everything" : "Merge backup"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
