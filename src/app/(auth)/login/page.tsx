"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { login } from "@/lib/auth-service";
import { getUser } from "@/lib/db";
import { ROLE_HOME } from "@/components/providers/RequireRole";
import { AlertCircle } from "lucide-react";
import { PageLoader } from "@/components/ui/misc";

export default function LoginPage() {
  return (
    <React.Suspense fallback={<PageLoader label="Loading…" />}>
      <LoginForm />
    </React.Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const disabled = params.get("disabled") === "1";
  const next = params.get("next");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const cred = await login(email, password);
      const profile = await getUser(cred.user.uid);
      if (profile && !profile.is_active) {
        setError("This account has been deactivated. Please contact support.");
        setLoading(false);
        return;
      }
      toast.success("Welcome back", profile?.full_name ? `Signed in as ${profile.full_name}` : undefined);
      const dest = next || (profile ? ROLE_HOME[profile.role] : "/portal");
      router.push(dest);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Login failed";
      setError(
        /invalid-credential|wrong-password|user-not-found/.test(msg)
          ? "Incorrect email or password."
          : msg.replace("Firebase:", "").trim()
      );
      setLoading(false);
    }
  }

  return (
    <div className="animate-fade-up">
      <h1 className="text-2xl font-extrabold tracking-tight text-navy">Welcome back</h1>
      <p className="mt-2 text-sm text-ink-muted">Log in to manage your shipments.</p>

      {disabled && (
        <div className="mt-5 flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-700 ring-1 ring-amber-200">
          <AlertCircle className="h-4 w-4" /> Your account is currently disabled.
        </div>
      )}

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
          />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="password" required>
              Password
            </Label>
            <Link href="/forgot" className="text-xs font-semibold text-gold-700 hover:underline">
              Forgot?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        <FieldError>{error}</FieldError>

        <Button type="submit" variant="gold" size="lg" className="w-full" loading={loading}>
          Log in
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-muted">
        New to Highclass?{" "}
        <Link href="/signup" className="font-semibold text-gold-700 hover:underline">
          Create an account
        </Link>
      </p>
      <p className="mt-2 text-center text-sm text-ink-muted">
        Have an access code?{" "}
        <Link href="/return" className="font-semibold text-gold-700 hover:underline">
          Return to your account
        </Link>
      </p>
    </div>
  );
}
