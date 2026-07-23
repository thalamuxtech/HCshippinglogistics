"use client";

import * as React from "react";
import { Mail, Send, Users, History } from "lucide-react";
import {
  listAllShipments,
  listUsers,
  listSailingNotices,
  createSailingNotice,
  logActivity,
} from "@/lib/db";
import { sendSailingBroadcast } from "@/lib/notify";
import type {
  Shipment,
  AppUser,
  SailingNotice,
  ServiceType,
  ShippingLine,
} from "@/lib/types";
import { SERVICES, RORO_LINES, DESTINATION_COUNTRIES } from "@/lib/constants";
import { useAuth } from "@/components/providers/AuthProvider";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input, Textarea, Select, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton, EmptyState } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { formatDateTime } from "@/lib/utils";
import type { Timestamp } from "firebase/firestore";

function tsToDate(ts?: Timestamp | null): Date | null {
  if (!ts) return null;
  try {
    return ts.toDate();
  } catch {
    return null;
  }
}

export default function AdminSailingPage() {
  const { user } = useAuth();
  const toast = useToast();

  const [loading, setLoading] = React.useState(true);
  const [shipments, setShipments] = React.useState<Shipment[]>([]);
  const [customers, setCustomers] = React.useState<AppUser[]>([]);
  const [history, setHistory] = React.useState<SailingNotice[]>([]);

  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  const [svc, setSvc] = React.useState<ServiceType | "all">("all");
  const [line, setLine] = React.useState<ShippingLine | "all">("all");
  const [dest, setDest] = React.useState<string>("all");
  const [sending, setSending] = React.useState(false);

  const load = React.useCallback(async () => {
    const [s, u, h] = await Promise.all([
      listAllShipments(),
      listUsers("customer"),
      listSailingNotices(),
    ]);
    setShipments(s);
    setCustomers(u);
    setHistory(h);
  }, []);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await load();
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [load]);

  // ── Live recipient preview: active customers with active shipments matching filters ──
  const recipientIds = React.useMemo(() => {
    const activeCustomerIds = new Set(
      customers.filter((c) => c.is_active).map((c) => c.id)
    );
    const ids = new Set<string>();
    for (const s of shipments) {
      if (s.current_status === "completed") continue;
      if (!activeCustomerIds.has(s.customer_id)) continue;
      if (svc !== "all" && s.service_type !== svc) continue;
      if (line !== "all" && s.shipping_line !== line) continue;
      if (dest !== "all" && s.destination_country !== dest) continue;
      ids.add(s.customer_id);
    }
    return Array.from(ids);
  }, [shipments, customers, svc, line, dest]);

  async function handleSend() {
    if (!user) return;
    if (!subject.trim() || !body.trim()) {
      toast.error("Missing content", "Subject and body are required.");
      return;
    }
    setSending(true);
    try {
      const filters = {
        service_type: svc === "all" ? undefined : svc,
        shipping_line: line === "all" ? undefined : line,
        destination: dest === "all" ? undefined : dest,
      };
      let recipientCount = recipientIds.length;
      let ids = recipientIds;
      try {
        const res = await sendSailingBroadcast({ subject, body, filters });
        if (res && typeof res.recipientCount === "number") {
          recipientCount = res.recipientCount;
          ids = res.recipientIds ?? recipientIds;
        }
      } catch {
        // Fall back to client-derived recipients if the callable is unavailable.
      }
      await createSailingNotice({
        sent_by: user.id,
        subject,
        body,
        filters,
        recipient_count: recipientCount,
        recipient_ids: ids,
      });
      await logActivity({
        actor_id: user.id,
        actor_name: user.full_name,
        actor_role: "admin",
        action: "sent sailing notice",
        target: subject,
        meta: { recipient_count: recipientCount, ...filters },
      });
      setSubject("");
      setBody("");
      await load();
      toast.success("Sailing notice sent", `Broadcast to ${recipientCount} customer(s).`);
    } catch {
      toast.error("Send failed", "Could not send the sailing notice.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Composer */}
      <div className="lg:col-span-2 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Compose sailing notice</CardTitle>
            <CardDescription>
              Broadcast vessel / flight details, cut-off dates, ETD and ETA to targeted customers.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="subject" required>
                Subject
              </Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Grimaldi Vessel Sailing, Cut-off Aug 20"
              />
            </div>
            <div>
              <Label htmlFor="body" required>
                Message
              </Label>
              <Textarea
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="min-h-[160px]"
                placeholder={
                  "Vessel / Flight: \nCut-off date: \nETD (departure): \nETA (arrival): \n\nAdditional notes…"
                }
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <Label htmlFor="f-svc">Service type</Label>
                <Select
                  id="f-svc"
                  value={svc}
                  onChange={(e) => setSvc(e.target.value as ServiceType | "all")}
                >
                  <option value="all">All services</option>
                  {(["sea", "air", "roro"] as const).map((s) => (
                    <option key={s} value={s}>
                      {SERVICES[s].label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="f-line">Shipping line</Label>
                <Select
                  id="f-line"
                  value={line}
                  onChange={(e) => setLine(e.target.value as ShippingLine | "all")}
                >
                  <option value="all">All lines</option>
                  {(Object.keys(RORO_LINES) as ShippingLine[]).map((l) => (
                    <option key={l} value={l}>
                      {RORO_LINES[l].label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="f-dest">Destination</Label>
                <Select id="f-dest" value={dest} onChange={(e) => setDest(e.target.value)}>
                  <option value="all">All destinations</option>
                  {DESTINATION_COUNTRIES.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-secondary/40 px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-ink">
                <Users className="h-4 w-4 text-gold" aria-hidden />
                {loading ? (
                  <Skeleton className="h-4 w-24" />
                ) : (
                  <span>
                    <span className="font-mono font-bold text-navy">{recipientIds.length}</span>{" "}
                    active customer(s) match these filters
                  </span>
                )}
              </div>
              <Button
                variant="gold"
                onClick={handleSend}
                loading={sending}
                disabled={sending || loading}
              >
                <Send className="h-4 w-4" /> Send broadcast
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* History */}
      <Card className="flex flex-col">
        <CardHeader className="flex-row items-center gap-2 space-y-0">
          <History className="h-4 w-4 text-gold" aria-hidden />
          <CardTitle>Sent notices</CardTitle>
        </CardHeader>
        <CardContent className="flex-1">
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : history.length === 0 ? (
            <EmptyState
              icon={<Mail className="h-6 w-6" />}
              title="No notices sent yet"
              description="Your sent sailing notices will appear here."
            />
          ) : (
            <ul className="space-y-3">
              {history.map((n) => (
                <li
                  key={n.id}
                  className="rounded-lg border border-border p-3 transition-colors hover:bg-secondary/40"
                >
                  <p className="text-sm font-semibold text-navy">{n.subject}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Badge variant="gold">{n.recipient_count} sent</Badge>
                    {n.filters?.service_type && (
                      <Badge variant="muted">{n.filters.service_type}</Badge>
                    )}
                    {n.filters?.destination && (
                      <Badge variant="muted">{n.filters.destination}</Badge>
                    )}
                  </div>
                  <p className="mt-1.5 text-xs text-ink-muted">
                    {formatDateTime(tsToDate(n.sent_at))}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
