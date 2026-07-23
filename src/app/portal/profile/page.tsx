"use client";

import * as React from "react";
import { User, Mail, KeyRound, Copy, Check, ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/ui/toast";
import { updateUserDoc, logActivity } from "@/lib/db";
import { sendAccessCodeEmail } from "@/lib/notify";
import { regenerateAccessCode } from "@/lib/auth-service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldHint } from "@/components/ui/input";
import { PageLoader } from "@/components/ui/misc";

export default function ProfilePage() {
  const { user, refresh } = useAuth();
  const toast = useToast();

  const [fullName, setFullName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [notifyEmail, setNotifyEmail] = React.useState(true);
  const [notifySms, setNotifySms] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [sendingCode, setSendingCode] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [newCode, setNewCode] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!user) return;
    setFullName(user.full_name ?? "");
    setPhone(user.phone ?? "");
    setNotifyEmail(user.notify_email ?? true);
    setNotifySms(user.notify_sms ?? false);
  }, [user]);

  if (!user) return <PageLoader label="Loading profile…" />;

  async function handleSave() {
    if (!user) return;
    if (!fullName.trim()) {
      toast.error("Name required", "Please enter your full name.");
      return;
    }
    setSaving(true);
    try {
      await updateUserDoc(user.id, {
        full_name: fullName.trim(),
        phone: phone.trim() || undefined,
        notify_email: notifyEmail,
        notify_sms: notifySms,
      });
      await refresh();
      toast.success("Profile updated", "Your changes have been saved.");
    } catch {
      toast.error("Could not save", "Please try again in a moment.");
    } finally {
      setSaving(false);
    }
  }

  async function handleEmailCode() {
    if (!user) return;
    setSendingCode(true);
    try {
      // Plaintext codes are never stored (only a salted hash), so we issue a
      // fresh code, show it once, and email it to the verified address. The
      // previous code stops working — the customer always has one valid code.
      const res = await regenerateAccessCode(user.id);
      if (!res) throw new Error("no-user");
      await sendAccessCodeEmail({
        email: user.email,
        fullName: user.full_name,
        code: res.accessCode,
      });
      await logActivity({
        actor_id: user.id,
        actor_name: user.full_name,
        actor_role: "customer",
        action: "self re-issued access code",
        target: user.id,
      });
      setNewCode(res.accessCode);
      await refresh();
      toast.success("New access code issued", `We also emailed it to ${user.email}.`);
    } catch {
      toast.error("Could not send", "Please try again shortly.");
    } finally {
      setSendingCode(false);
    }
  }

  async function copyId() {
    if (!user) return;
    try {
      await navigator.clipboard.writeText(user.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow">Profile</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-navy sm:text-3xl">
          Account settings
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Manage your contact details and notification preferences.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Details form */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Personal details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <Label htmlFor="full-name" required>
                  Full name
                </Label>
                <Input
                  id="full-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={user.email} disabled />
                <FieldHint>Contact support to change your login email.</FieldHint>
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                />
                <FieldHint>Required for SMS notifications.</FieldHint>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notification preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <ToggleRow
                label="Email notifications"
                description="Stage updates, receipts, and confirmations by email."
                checked={notifyEmail}
                onChange={setNotifyEmail}
              />
              <ToggleRow
                label="SMS notifications"
                description="Text alerts for key shipment milestones."
                checked={notifySms}
                onChange={setNotifySms}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button variant="gold" onClick={handleSave} loading={saving}>
              Save changes
            </Button>
          </div>
        </div>

        {/* Sidebar: identity + access code */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Your customer ID</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-border bg-surface p-4">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-ink-muted">
                  <ShieldCheck className="h-4 w-4" /> Durable ID
                </div>
                <p className="mt-2 break-all font-mono text-sm font-semibold text-navy">
                  {user.id}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full"
                  onClick={copyId}
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" /> Copy ID
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-ink-muted">
                Keep this ID for your records — it never changes and identifies your account.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Access code</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="flex items-start gap-2 text-sm text-ink-muted">
                <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-navy" />
                Your access code lets you return to your account and full shipment history. For your
                security we store it encrypted — so we issue a fresh code and email it to you.
              </p>

              {newCode && (
                <div className="rounded-xl border-2 border-dashed border-gold/40 bg-gold-50/60 p-4 text-center">
                  <p className="text-xs font-semibold uppercase tracking-widest text-gold-700">
                    Your new access code
                  </p>
                  <p className="mt-2 select-all font-mono text-xl font-bold tracking-[0.18em] text-navy">
                    {newCode}
                  </p>
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(newCode);
                      toast.success("Copied");
                    }}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-navy shadow-card hover:bg-surface focus-ring"
                  >
                    <Copy className="h-3.5 w-3.5" /> Copy
                  </button>
                </div>
              )}

              <Button
                variant="primary"
                className="w-full"
                onClick={handleEmailCode}
                loading={sendingCode}
              >
                <Mail className="h-4 w-4" /> Email me a fresh access code
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-border p-4 transition-colors hover:bg-surface">
      <span>
        <span className="text-sm font-semibold text-navy">{label}</span>
        <span className="mt-0.5 block text-xs text-ink-muted">{description}</span>
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="h-6 w-11 rounded-full bg-secondary transition-colors peer-checked:bg-navy peer-focus-visible:ring-2 peer-focus-visible:ring-gold peer-focus-visible:ring-offset-2" />
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}
