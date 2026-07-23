"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Copy, Mail, ShieldCheck, ArrowRight } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input, Label, FieldError, FieldHint } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { signupCustomer } from "@/lib/auth-service";
import { sendAccessCodeEmail } from "@/lib/notify";

type Errors = Partial<Record<"fullName" | "email" | "password" | "confirm" | "birth" | "zip", string>>;

export default function SignupPage() {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = React.useState(false);
  const [errors, setErrors] = React.useState<Errors>({});
  const [issued, setIssued] = React.useState<{ code: string; email: string } | null>(null);

  const [form, setForm] = React.useState({
    fullName: "",
    email: "",
    password: "",
    confirm: "",
    phone: "",
    birthMonth: "",
    birthYear: "",
    zip: "",
  });

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function validate(): boolean {
    const e: Errors = {};
    if (form.fullName.trim().split(/\s+/).length < 2)
      e.fullName = "Enter your first and last name.";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) e.email = "Enter a valid email address.";
    if (form.password.length < 8) e.password = "Password must be at least 8 characters.";
    if (form.password !== form.confirm) e.confirm = "Passwords do not match.";
    const mo = parseInt(form.birthMonth, 10);
    if (!form.birthYear || !form.birthMonth || mo < 1 || mo > 12 || form.birthYear.length !== 4)
      e.birth = "Enter a valid birth month and 4-digit year.";
    if (form.zip.replace(/\D/g, "").length < 2) e.zip = "Enter your ZIP / postal code.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      // YYMM from 4-digit year + 2-digit month
      const yy = form.birthYear.slice(-2);
      const mm = form.birthMonth.padStart(2, "0");
      const birthYearMonth = `${yy}${mm}`;

      const { accessCode } = await signupCustomer({
        fullName: form.fullName.trim(),
        email: form.email,
        password: form.password,
        phone: form.phone,
        birthYearMonth,
        zip: form.zip,
      });

      // Fire the branded access-code email (stub-safe).
      await sendAccessCodeEmail({ email: form.email, fullName: form.fullName, code: accessCode });

      setIssued({ code: accessCode, email: form.email.trim().toLowerCase() });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Signup failed.";
      if (msg.includes("email-already-in-use")) {
        toast.error("Email already registered", "Try logging in or recover your access code.");
      } else {
        toast.error("Could not create account", msg.replace("Firebase:", "").trim());
      }
    } finally {
      setLoading(false);
    }
  }

  // ── Success: show the access code ONCE ──
  if (issued) {
    return (
      <div className="animate-fade-up">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-500">
            <CheckCircle2 className="h-8 w-8" />
          </span>
          <h1 className="mt-4 text-2xl font-extrabold text-navy">Account created</h1>
          <p className="mt-2 text-sm text-ink-muted">
            Welcome to Highclass Shipping. Here is your unique access code.
          </p>
        </div>

        <div className="rounded-2xl border-2 border-dashed border-gold/40 bg-gold-50/60 p-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-gold-700">
            Your Highclass Access Code
          </p>
          <p className="mt-3 select-all font-mono text-2xl font-bold tracking-[0.2em] text-navy">
            {issued.code}
          </p>
          <button
            onClick={() => {
              navigator.clipboard?.writeText(issued.code);
              toast.success("Copied", "Access code copied to clipboard.");
            }}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-navy shadow-card hover:bg-surface focus-ring"
          >
            <Copy className="h-3.5 w-3.5" /> Copy code
          </button>
        </div>

        <div className="mt-5 flex items-start gap-2.5 rounded-xl bg-surface p-4 text-xs text-ink-muted">
          <Mail className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
          <span>
            We&apos;ve emailed this code to <strong className="text-navy">{issued.email}</strong>.
            Keep it safe — it lets you return to your account and shipment history. We will not show
            it again in full.
          </span>
        </div>

        <Button
          className="mt-6 w-full"
          variant="gold"
          size="lg"
          onClick={() => router.push("/portal")}
        >
          Go to my portal <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="animate-fade-up">
      <h1 className="text-2xl font-extrabold tracking-tight text-navy">Create your account</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Self-service shipping, real-time tracking, and digital receipts — free to join.
      </p>

      <form onSubmit={onSubmit} className="mt-7 space-y-4" noValidate>
        <div>
          <Label htmlFor="fullName" required>
            Full name
          </Label>
          <Input
            id="fullName"
            autoComplete="name"
            value={form.fullName}
            onChange={(e) => set("fullName", e.target.value)}
            placeholder="John Doe"
          />
          <FieldError>{errors.fullName}</FieldError>
        </div>

        <div>
          <Label htmlFor="email" required>
            Email
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="you@example.com"
          />
          <FieldError>{errors.email}</FieldError>
        </div>

        <div>
          <Label htmlFor="phone">Phone (for SMS updates)</Label>
          <Input
            id="phone"
            type="tel"
            autoComplete="tel"
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="+1 555 000 0000"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label required>Password</Label>
            <Input
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              placeholder="••••••••"
            />
            <FieldError>{errors.password}</FieldError>
          </div>
          <div>
            <Label required>Confirm</Label>
            <Input
              type="password"
              autoComplete="new-password"
              value={form.confirm}
              onChange={(e) => set("confirm", e.target.value)}
              placeholder="••••••••"
            />
            <FieldError>{errors.confirm}</FieldError>
          </div>
        </div>

        <div>
          <Label required>Birth month &amp; year</Label>
          <div className="grid grid-cols-2 gap-3">
            <Input
              inputMode="numeric"
              maxLength={2}
              value={form.birthMonth}
              onChange={(e) => set("birthMonth", e.target.value.replace(/\D/g, ""))}
              placeholder="MM"
              aria-label="Birth month"
            />
            <Input
              inputMode="numeric"
              maxLength={4}
              value={form.birthYear}
              onChange={(e) => set("birthYear", e.target.value.replace(/\D/g, ""))}
              placeholder="YYYY"
              aria-label="Birth year"
            />
          </div>
          <FieldError>{errors.birth}</FieldError>
          <FieldHint>Used to build your memorable access code. We never store your birth day.</FieldHint>
        </div>

        <div>
          <Label htmlFor="zip" required>
            ZIP / Postal code
          </Label>
          <Input
            id="zip"
            value={form.zip}
            onChange={(e) => set("zip", e.target.value)}
            placeholder="10001"
          />
          <FieldError>{errors.zip}</FieldError>
        </div>

        <Button type="submit" variant="gold" size="lg" className="w-full" loading={loading}>
          Create account
        </Button>

        <p className="flex items-center justify-center gap-1.5 text-xs text-ink-muted">
          <ShieldCheck className="h-3.5 w-3.5 text-gold" /> Your data is encrypted and never shared.
        </p>
      </form>

      <p className="mt-6 text-center text-sm text-ink-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-gold-700 hover:underline">
          Log in
        </Link>{" "}
        ·{" "}
        <Link href="/return" className="font-semibold text-gold-700 hover:underline">
          Use access code
        </Link>
      </p>
    </div>
  );
}
