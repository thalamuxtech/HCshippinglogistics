"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { resetPassword } from "@/lib/auth-service";
import { sendAccessCodeEmail } from "@/lib/notify";
import { MailCheck } from "lucide-react";

export default function ForgotPage() {
  const [email, setEmail] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    // Always show success to avoid leaking which emails exist.
    try {
      await resetPassword(email);
    } catch {
      /* ignore */
    }
    try {
      await sendAccessCodeEmail({ email, fullName: "" });
    } catch {
      /* ignore */
    }
    setSent(true);
    setLoading(false);
  }

  if (sent) {
    return (
      <div className="animate-fade-up text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-500">
          <MailCheck className="h-8 w-8" />
        </span>
        <h1 className="mt-4 text-2xl font-extrabold text-navy">Check your email</h1>
        <p className="mt-2 text-sm text-ink-muted">
          If an account exists for <strong className="text-navy">{email}</strong>, we&apos;ve sent a
          password reset link and a copy of your access code.
        </p>
        <Button
          className="mt-6 w-full"
          variant="outline"
          onClick={() => (window.location.href = "/login")}
        >
          Back to log in
        </Button>
      </div>
    );
  }

  return (
    <div className="animate-fade-up">
      <h1 className="text-2xl font-extrabold tracking-tight text-navy">Recover your account</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Enter your email and we&apos;ll send a password reset link plus your access code.
      </p>

      <form onSubmit={onSubmit} className="mt-7 space-y-4" noValidate>
        <div>
          <Label htmlFor="email" required>
            Email
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
        </div>
        <Button type="submit" variant="gold" size="lg" className="w-full" loading={loading}>
          Send recovery email
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-muted">
        Remembered it?{" "}
        <Link href="/login" className="font-semibold text-gold-700 hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
