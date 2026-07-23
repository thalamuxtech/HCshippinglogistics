"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError, FieldHint } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { lookupByAccessCode } from "@/lib/auth-service";
import { validateCheckChar } from "@/lib/access-code";
import { CheckCircle2, KeyRound } from "lucide-react";

export default function ReturnPage() {
  const toast = useToast();
  const [code, setCode] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [found, setFound] = React.useState<{ email: string } | null>(null);

  const looksValid = code.replace(/\s/g, "").length >= 10 && validateCheckChar(code);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFound(null);
    setLoading(true);
    try {
      const res = await lookupByAccessCode(code);
      if (res.found) {
        setFound({ email: res.hint || "" });
        toast.success("Account found", "Log in with your email to continue.");
      } else {
        setError(res.hint || "No matching account found.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="animate-fade-up">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy/5 text-navy">
          <KeyRound className="h-5 w-5" />
        </span>
      </div>
      <h1 className="text-2xl font-extrabold tracking-tight text-navy">Return with your code</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Enter the access code we emailed you when you signed up.
      </p>

      {found ? (
        <div className="mt-7 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-6">
          <div className="flex items-center gap-2 text-emerald-700">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-semibold">We found your account</span>
          </div>
          <p className="mt-2 text-sm text-ink-muted">
            Your durable shipping history is linked to{" "}
            <strong className="text-navy">{found.email}</strong>. Log in with that email to see all
            your past and current shipments.
          </p>
          <Button
            className="mt-5 w-full"
            variant="gold"
            onClick={() => (window.location.href = "/login")}
          >
            Continue to log in
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-7 space-y-4" noValidate>
          <div>
            <Label htmlFor="code" required>
              Access code
            </Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="JD980610A4FK"
              className="font-mono tracking-[0.18em]"
              maxLength={14}
              autoCapitalize="characters"
            />
            <FieldHint>10–12 characters. We check for typos before searching.</FieldHint>
            <FieldError>{error}</FieldError>
          </div>

          <Button
            type="submit"
            variant="gold"
            size="lg"
            className="w-full"
            loading={loading}
            disabled={!looksValid}
          >
            Find my account
          </Button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-ink-muted">
        Lost your code?{" "}
        <Link href="/forgot" className="font-semibold text-gold-700 hover:underline">
          Recover via email
        </Link>
      </p>
      <p className="mt-2 text-center text-sm text-ink-muted">
        Prefer email &amp; password?{" "}
        <Link href="/login" className="font-semibold text-gold-700 hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
