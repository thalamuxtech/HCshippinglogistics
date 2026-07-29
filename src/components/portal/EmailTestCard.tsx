"use client";

import * as React from "react";
import { MailCheck, Send, CheckCircle2, AlertTriangle, Eye } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/misc";
import { sendTestEmail } from "@/lib/notify";
import { useAuth } from "@/components/providers/AuthProvider";

type Result =
  | { state: "idle" }
  | { state: "sending" }
  | { state: "done"; ok: boolean; provider?: string; stub?: boolean; status?: number | null; error?: string | null };

// Kept in sync with the server sendTestEmail template (functions/index.js).
const TEST_EMAIL = {
  heading: "Your email setup is working",
  body: [
    "This is a test message sent from the Highclass Shipping admin portal to confirm that transactional email is configured and delivering correctly.",
    "If you received this in your inbox (not spam), you are ready to send customer notifications, invoices, and broadcasts.",
  ],
  tracking: "HC-TEST-0001",
  cta: "Open My Shipments",
};

export function EmailTestCard() {
  const { user } = useAuth();
  const [to, setTo] = React.useState(user?.email || "");
  const [res, setRes] = React.useState<Result>({ state: "idle" });
  const [preview, setPreview] = React.useState(false);

  React.useEffect(() => {
    if (user?.email && !to) setTo(user.email);
  }, [user?.email, to]);

  async function run() {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to.trim())) {
      setRes({ state: "done", ok: false, error: "Enter a valid email address." });
      return;
    }
    setRes({ state: "sending" });
    try {
      const r = await sendTestEmail({ to: to.trim() });
      setRes({ state: "done", ok: r.ok, provider: r.provider, stub: r.stub, status: r.status, error: r.error });
    } catch (e) {
      setRes({ state: "done", ok: false, error: e instanceof Error ? e.message : "Request failed." });
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start gap-2 space-y-0">
        <MailCheck className="mt-0.5 h-4 w-4 text-gold" aria-hidden />
        <div>
          <CardTitle>Email delivery</CardTitle>
          <CardDescription>
            Send a branded test email to confirm the provider is configured and delivering.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="test-to">Send test to</Label>
          <div className="mt-1 flex flex-col gap-2 sm:flex-row">
            <Input
              id="test-to"
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="you@example.com"
            />
            <Button variant="outline" onClick={() => setPreview(true)}>
              <Eye className="h-4 w-4" /> Preview
            </Button>
            <Button
              variant="gold"
              onClick={run}
              loading={res.state === "sending"}
              disabled={res.state === "sending"}
            >
              <Send className="h-4 w-4" /> Send test
            </Button>
          </div>
        </div>

        {res.state === "done" && (
          <div
            className={`flex items-start gap-2.5 rounded-lg border p-3 text-sm ${
              res.ok
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {res.ok ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <div className="min-w-0">
              {res.ok ? (
                <p>Test email sent successfully to the email address.</p>
              ) : (
                <>
                  <p>Could not send the test email. {res.error || ""}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {res.provider && <Badge variant="muted">{res.provider}</Badge>}
                    {res.stub && <Badge variant="warning">stub mode (no key set)</Badge>}
                    {res.status != null && <Badge variant="muted">HTTP {res.status}</Badge>}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <p className="text-xs text-ink-muted">
          Uses the same branded template as customer notifications, invoices, and broadcasts. If it
          lands in spam, verify your sending domain in the email provider.
        </p>
      </CardContent>

      {/* Exact preview of the test email */}
      <Modal open={preview} onClose={() => setPreview(false)} title="Test email preview" size="md">
        <EmailPreview />
      </Modal>
    </Card>
  );
}

// Visual preview mirroring the server emailShell used by sendTestEmail.
function EmailPreview() {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      {/* Header with logo on a white plate over navy */}
      <div className="bg-navy-gradient px-6 py-6 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/logo-email.png"
          alt="Highclass Shipping & Logistics Inc."
          className="mx-auto h-auto w-[180px] max-w-[70%] rounded-xl bg-white px-3 py-2"
        />
        <p className="mt-3 text-[9px] uppercase tracking-[0.2em] text-gold-200">
          Excellence in handling your valuables
        </p>
      </div>
      <div className="h-1 bg-gold" />
      {/* Body */}
      <div className="space-y-3 bg-white px-6 py-5 text-sm">
        <h3 className="text-base font-bold leading-snug text-navy">{TEST_EMAIL.heading}</h3>
        {TEST_EMAIL.body.map((p, i) => (
          <p key={i} className="leading-relaxed text-ink">
            {p}
          </p>
        ))}
        <div className="rounded-lg border border-border bg-surface px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
            Tracking number
          </p>
          <p className="mt-0.5 font-mono text-base font-bold text-navy">{TEST_EMAIL.tracking}</p>
        </div>
        <span className="mt-1 inline-block rounded-lg bg-gold px-5 py-2.5 text-xs font-bold text-white">
          {TEST_EMAIL.cta}
        </span>

        {/* Office footer */}
        <div className="grid grid-cols-2 gap-4 border-t border-border pt-4 text-xs">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-gold-700">USA Office</p>
            <p className="mt-1 leading-relaxed text-ink-muted">
              6600 Foxley Road, Gate C
              <br />
              Upper Marlboro, Maryland 20772
              <br />
              +1 (240) 374-8394
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-gold-700">
              Nigeria Office
            </p>
            <p className="mt-1 leading-relaxed text-ink-muted">
              28 Moleye Street, Alagomeji
              <br />
              Yaba, Lagos
              <br />
              +234 808 029 1754
            </p>
          </div>
        </div>

        <p className="border-t border-border pt-3 text-[11px] leading-relaxed text-ink-muted">
          FMC Licensed since 2017 · Registered in Maryland, USA &amp; Nigeria (CAC)
          <br />
          Test message. No action required.
        </p>
      </div>
    </div>
  );
}
