"use client";

import * as React from "react";
import { MailCheck, Send, CheckCircle2, AlertTriangle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { sendTestEmail } from "@/lib/notify";
import { useAuth } from "@/components/providers/AuthProvider";

type Result =
  | { state: "idle" }
  | { state: "sending" }
  | { state: "done"; ok: boolean; provider?: string; stub?: boolean; status?: number | null; error?: string | null };

export function EmailTestCard() {
  const { user } = useAuth();
  const [to, setTo] = React.useState(user?.email || "");
  const [res, setRes] = React.useState<Result>({ state: "idle" });

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
                <p>
                  Test sent{res.provider ? ` via ${res.provider}` : ""}. Check the inbox (and spam)
                  for the message.
                </p>
              ) : (
                <p>Could not send{res.provider ? ` via ${res.provider}` : ""}. {res.error || ""}</p>
              )}
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {res.provider && <Badge variant="muted">{res.provider}</Badge>}
                {res.stub && <Badge variant="warning">stub mode — no key set</Badge>}
                {res.status != null && <Badge variant="muted">HTTP {res.status}</Badge>}
              </div>
            </div>
          </div>
        )}

        <p className="text-xs text-ink-muted">
          Uses the same branded template as customer notifications, invoices, and broadcasts. If it
          lands in spam, verify your sending domain in the email provider.
        </p>
      </CardContent>
    </Card>
  );
}
