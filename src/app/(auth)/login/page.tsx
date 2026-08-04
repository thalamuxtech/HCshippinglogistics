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
import { AlertCircle, Eye, EyeOff, Clock } from "lucide-react";
import { PageLoader } from "@/components/ui/misc";
import { Logo } from "@/components/brand/Logo";
import { isPortalHostAllowed } from "@/lib/portal-host";
import { NotFoundScreen } from "@/components/marketing/NotFoundScreen";

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
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const disabled = params.get("disabled") === "1";
  const timedOut = params.get("timeout") === "1";
  const next = params.get("next");

  // The host is only knowable on the client (this page is prerendered by the
  // static export), so start as "unknown" and show nothing until it resolves.
  // Defaulting to allowed would flash the sign-in form on the public domain
  // before the 404 replaced it — a glimpse is all it takes to reveal the portal.
  const [hostAllowed, setHostAllowed] = React.useState<boolean | null>(null);
  React.useEffect(() => {
    setHostAllowed(isPortalHostAllowed());
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Belt and braces: on the public domain the form is never rendered, so this
    // cannot normally be reached — but a submit must never fall through to
    // Firebase from there.
    if (hostAllowed !== true) return;
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
      const dest = next || (profile ? ROLE_HOME[profile.role] : "/");
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

  // Public domain: /login is simply not a page here. Rendering the very same
  // NotFoundScreen as any mistyped URL means there is nothing to distinguish a
  // withheld route from one that never existed.
  if (hostAllowed === false) return <NotFoundScreen />;
  // Host not yet resolved — render nothing rather than risk flashing the form.
  if (hostAllowed === null) return <PageLoader label="Loading…" />;

  return (
    <div className="animate-fade-up">
      {/* Big centered brand mark */}
      <div className="mb-8 flex justify-center">
        <Logo href="/" size="3xl" />
      </div>

      <h1 className="text-center text-2xl font-extrabold tracking-tight text-navy">
        Staff sign in
      </h1>
      <p className="mt-2 text-center text-sm text-ink-muted">
        For Highclass team members. Customers do not need an account.
      </p>

      {disabled && (
        <div className="mt-5 flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-700 ring-1 ring-amber-200">
          <AlertCircle className="h-4 w-4" /> Your account is currently disabled.
        </div>
      )}

      {timedOut && (
        <div className="mt-5 flex items-start gap-2 rounded-lg bg-secondary p-3 text-sm text-ink ring-1 ring-border">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" />
          <span>
            You were signed out after 20 minutes of inactivity. Please sign in again to continue.
          </span>
        </div>
      )}

      {/* Reached only on the portal host — see the hostAllowed guard above. */}
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
          <Label htmlFor="password" required>
            Password
          </Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="pr-11"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-1 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-ink-muted hover:text-navy focus-ring"
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
        </div>

        <FieldError>{error}</FieldError>

        <Button
          type="submit"
          variant="gold"
          size="lg"
          className="w-full"
          loading={loading}
        >
          Log in
        </Button>
      </form>

      {/* No self-service password reset: this is a three-account staff portal,
          so a forgotten password is handled by an admin issuing a temporary one
          from Staff & Roles. A public reset form on a portal this small is just
          another way in. */}
      <p className="mt-6 text-center text-sm text-ink-muted">
        Are you a customer? Check your shipment with your Customer ID on the{" "}
        <Link href="/track" className="font-semibold text-gold-700 hover:underline">
          tracking page
        </Link>
        .
      </p>
    </div>
  );
}

