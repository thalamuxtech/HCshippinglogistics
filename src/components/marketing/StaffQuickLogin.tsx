"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Building2, Truck, User, Lock, X, Loader2 } from "lucide-react";
import { login } from "@/lib/auth-service";
import { getUser } from "@/lib/db";
import { ROLE_HOME } from "@/components/providers/RequireRole";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/types";

// ─────────────────────────────────────────────────────────────
// DEMO quick-login. A low-opacity lock icon in the footer opens this
// panel; clicking a role auto-fills its demo credentials and logs
// straight into the matching portal.
//
// ⚠️  DEMO ONLY — remove this component (and the footer trigger) before
//     the real public launch. Credentials match scripts/seed-demo-users.mjs.
// ─────────────────────────────────────────────────────────────

const DEMO: { role: Role; label: string; email: string; password: string; icon: React.ElementType }[] = [
  { role: "admin", label: "Administrator", email: "admin@highclassshippinglogistics.com", password: "HCshipping@54321", icon: ShieldCheck },
  { role: "nigeria_office", label: "Destination Office", email: "nigeria.office@highclassshippinglogistics.com", password: "HCshipping@54321", icon: Building2 },
  { role: "dispatcher", label: "Dispatcher", email: "dispatcher@highclassshippinglogistics.com", password: "HCshipping@54321", icon: Truck },
  { role: "customer", label: "Customer", email: "customer@highclassshippinglogistics.com", password: "HCshipping@54321", icon: User },
];

export function StaffQuickLogin() {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState<Role | null>(null);
  const router = useRouter();
  const toast = useToast();

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function quickLogin(d: (typeof DEMO)[number]) {
    setBusy(d.role);
    try {
      const cred = await login(d.email, d.password);
      const profile = await getUser(cred.user.uid);
      const dest = profile ? ROLE_HOME[profile.role] : ROLE_HOME[d.role];
      toast.success("Signed in", `Demo ${d.label}`);
      router.push(dest);
    } catch {
      toast.error(
        "Demo account not ready",
        "Run `npm run seed:demo` to create the demo users first."
      );
      setBusy(null);
    }
  }

  return (
    <>
      {/* Low-opacity trigger (footer) */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Staff & admin access"
        title="Staff & admin access"
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-white/25 transition-colors hover:text-gold-200 focus-ring"
      >
        <Lock className="h-4 w-4" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-navy-950/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Demo quick login"
            className="animate-fade-up relative z-10 w-full max-w-md rounded-2xl border border-border bg-white p-6 shadow-premium"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-navy">Portal access</h2>
                <p className="mt-1 text-sm text-ink-muted">
                  Demo sign-in for staff &amp; customers. One click logs you in.
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-ink-muted hover:bg-secondary focus-ring"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 grid gap-2.5">
              {DEMO.map((d) => {
                const Icon = d.icon;
                return (
                  <button
                    key={d.role}
                    onClick={() => quickLogin(d)}
                    disabled={busy !== null}
                    className={cn(
                      "group flex items-center gap-3 rounded-xl border border-border bg-white p-3.5 text-left transition-all hover:border-gold/50 hover:shadow-card focus-ring disabled:opacity-60"
                    )}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-navy text-gold">
                      {busy === d.role ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Icon className="h-5 w-5" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-navy">{d.label}</p>
                      <p className="truncate font-mono text-xs text-ink-muted">{d.email}</p>
                    </div>
                    <span className="text-xs font-semibold text-gold-700 opacity-0 transition-opacity group-hover:opacity-100">
                      Log in →
                    </span>
                  </button>
                );
              })}
            </div>

            <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-center text-xs text-amber-700">
              Demo credentials · password <span className="font-mono">HCshipping@54321</span> ·
              remove before launch
            </p>
          </div>
        </div>
      )}
    </>
  );
}
