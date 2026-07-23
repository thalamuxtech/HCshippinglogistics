"use client";

import * as React from "react";
import {
  Container,
  Users,
  Send,
  Mail,
  Eye,
  Package,
  ChevronRight,
  FlaskConical,
} from "lucide-react";
import { listAllShipments, listUsers, logActivity } from "@/lib/db";
import { sendContainerBroadcast } from "@/lib/notify";
import type { Shipment, AppUser } from "@/lib/types";
import { COMPANY } from "@/lib/constants";
import { useAuth } from "@/components/providers/AuthProvider";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input, Textarea, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton, EmptyState } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";

// A container grouped from shipments.
interface ContainerGroup {
  cnt: string;
  shipments: Shipment[];
  customerIds: Set<string>;
}

const DEFAULT_OFFICE_NAME = COMPANY.name;
const DEFAULT_OFFICE_ADDRESS = COMPANY.nigeria.lines.join("\n");
const DEFAULT_OFFICE_PHONE = COMPANY.nigeria.phones[0] || "";
const DEFAULT_US_PHONES = COMPANY.usa.phones.join(" or ");

export default function AdminContainersPage() {
  const { user } = useAuth();
  const toast = useToast();

  const [loading, setLoading] = React.useState(true);
  const [shipments, setShipments] = React.useState<Shipment[]>([]);
  const [customers, setCustomers] = React.useState<AppUser[]>([]);
  const [selected, setSelected] = React.useState<string>("");

  // Message fields
  const [subject, setSubject] = React.useState(
    "Your container has arrived and is ready for pickup"
  );
  const [body, setBody] = React.useState(
    "Dear Valued Customer,\n\nWe are pleased to inform you that the container carrying your goods is now available for pickup at our warehouse. Please bring a valid ID when collecting your items."
  );
  const [officeName, setOfficeName] = React.useState(DEFAULT_OFFICE_NAME);
  const [officeAddress, setOfficeAddress] = React.useState(DEFAULT_OFFICE_ADDRESS);
  const [officePhone, setOfficePhone] = React.useState(DEFAULT_OFFICE_PHONE);
  const [deliveryContactName, setDeliveryContactName] = React.useState("Mr. Biyi Odunuga");
  const [deliveryContactPhone, setDeliveryContactPhone] = React.useState("+234 811 574 6737");
  const [nextLoadingDate, setNextLoadingDate] = React.useState("");
  const [nextLoadingNote, setNextLoadingNote] = React.useState(
    "Please bring your boxes, plastic totes, Ghana must go bags, drums, and other household goods."
  );
  const [usPhones, setUsPhones] = React.useState(DEFAULT_US_PHONES);

  const [testEmail, setTestEmail] = React.useState(user?.email || "");
  const [testing, setTesting] = React.useState(false);
  const [sending, setSending] = React.useState(false);

  const load = React.useCallback(async () => {
    const [s, u] = await Promise.all([listAllShipments(), listUsers("customer")]);
    setShipments(s);
    setCustomers(u);
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

  React.useEffect(() => {
    if (user?.email && !testEmail) setTestEmail(user.email);
  }, [user?.email, testEmail]);

  // Group shipments by container number.
  const groups = React.useMemo<ContainerGroup[]>(() => {
    const map = new Map<string, ContainerGroup>();
    for (const s of shipments) {
      const cnt = (s.container_number || "").trim();
      if (!cnt) continue;
      if (!map.has(cnt)) map.set(cnt, { cnt, shipments: [], customerIds: new Set() });
      const g = map.get(cnt)!;
      g.shipments.push(s);
      if (s.customer_id) g.customerIds.add(s.customer_id);
    }
    return Array.from(map.values()).sort((a, b) =>
      a.cnt.localeCompare(b.cnt, undefined, { numeric: true })
    );
  }, [shipments]);

  const activeCustomerIds = React.useMemo(
    () => new Set(customers.filter((c) => c.is_active !== false && !c.deleted).map((c) => c.id)),
    [customers]
  );

  const selectedGroup = groups.find((g) => g.cnt === selected) || null;

  // Recipients = active customers with email on the selected container.
  const recipients = React.useMemo(() => {
    if (!selectedGroup) return [] as AppUser[];
    const byId = new Map(customers.map((c) => [c.id, c]));
    const out: AppUser[] = [];
    for (const cid of selectedGroup.customerIds) {
      const c = byId.get(cid);
      if (c && activeCustomerIds.has(cid) && c.email && c.notify_email !== false) out.push(c);
    }
    return out;
  }, [selectedGroup, customers, activeCustomerIds]);

  async function handleTest() {
    if (!selected) return;
    if (!testEmail.trim()) {
      toast.error("Add a test address", "Enter an email to receive the preview.");
      return;
    }
    setTesting(true);
    try {
      const res = await sendContainerBroadcast({
        containerNumber: selected,
        subject,
        body,
        officeName,
        officeAddress,
        officePhone,
        deliveryContactName,
        deliveryContactPhone,
        nextLoadingDate,
        nextLoadingNote,
        usPhones,
        testEmail: testEmail.trim(),
      });
      if (res.ok) toast.success("Test sent", `Preview delivered to ${testEmail.trim()}.`);
      else toast.info("Test queued", "Delivery pending; check the address shortly.");
    } catch {
      toast.error("Test failed", "Could not send the test email.");
    } finally {
      setTesting(false);
    }
  }

  async function handleBroadcast() {
    if (!user || !selected) return;
    if (!subject.trim() || !body.trim()) {
      toast.error("Missing content", "Subject and message are required.");
      return;
    }
    if (
      !window.confirm(
        `Send this notice to ${recipients.length} customer(s) with cargo on CNT #${selected}?`
      )
    )
      return;
    setSending(true);
    try {
      const res = await sendContainerBroadcast({
        containerNumber: selected,
        subject,
        body,
        officeName,
        officeAddress,
        officePhone,
        deliveryContactName,
        deliveryContactPhone,
        nextLoadingDate,
        nextLoadingNote,
        usPhones,
      });
      await logActivity({
        actor_id: user.id,
        actor_name: user.full_name,
        actor_role: "admin",
        action: `sent container broadcast (CNT #${selected})`,
        target: subject,
        meta: { container_number: selected, recipient_count: res.recipientCount },
      });
      toast.success(
        "Broadcast sent",
        `Notice delivered to ${res.recipientCount} customer(s) on CNT #${selected}.`
      );
    } catch {
      toast.error("Send failed", "Could not send the broadcast.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
      {/* Container list */}
      <Card className="flex h-fit flex-col">
        <CardHeader className="flex-row items-center gap-2 space-y-0">
          <Container className="h-4 w-4 text-gold" aria-hidden />
          <CardTitle>Containers</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : groups.length === 0 ? (
            <EmptyState
              icon={<Container className="h-6 w-6" />}
              title="No containers yet"
              description="Assign a container (CNT) to shipments from their detail page. Grouped containers appear here."
            />
          ) : (
            <ul className="space-y-2">
              {groups.map((g) => {
                const active = g.cnt === selected;
                return (
                  <li key={g.cnt}>
                    <button
                      onClick={() => setSelected(g.cnt)}
                      className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors focus-ring ${
                        active
                          ? "border-gold bg-gold/10"
                          : "border-border hover:bg-secondary/50"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="font-mono text-sm font-bold text-navy">CNT #{g.cnt}</p>
                        <p className="text-xs text-ink-muted">
                          {g.shipments.length} shipment(s) · {g.customerIds.size} customer(s)
                        </p>
                      </div>
                      <ChevronRight
                        className={`h-4 w-4 shrink-0 ${active ? "text-gold" : "text-ink-muted"}`}
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Composer + preview */}
      {!selectedGroup ? (
        <Card>
          <CardContent className="py-16">
            <EmptyState
              icon={<Mail className="h-6 w-6" />}
              title="Select a container"
              description="Choose a container on the left to compose and broadcast a pickup notice to every customer with cargo on it."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Recipients summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="font-mono">CNT #{selectedGroup.cnt}</span>
                <Badge variant="gold">{recipients.length} recipient(s)</Badge>
              </CardTitle>
              <CardDescription>
                Customers with active email on this container. Soft-deleted, inactive, or
                opted-out customers are excluded automatically.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recipients.length === 0 ? (
                <p className="text-sm text-ink-muted">
                  No reachable customers on this container yet.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {recipients.map((c) => (
                    <span
                      key={c.id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground"
                    >
                      <Users className="h-3 w-3" /> {c.full_name}
                    </span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 xl:grid-cols-2">
            {/* Composer */}
            <Card>
              <CardHeader>
                <CardTitle>Compose notice</CardTitle>
                <CardDescription>
                  Edit any field. The message is wrapped in a premium branded layout.
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
                    className="min-h-[120px]"
                  />
                </div>

                <div className="rounded-lg border border-border p-3 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                    Pickup location
                  </p>
                  <div>
                    <Label htmlFor="office-name">Office name</Label>
                    <Input
                      id="office-name"
                      value={officeName}
                      onChange={(e) => setOfficeName(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="office-address">Office address</Label>
                    <Textarea
                      id="office-address"
                      value={officeAddress}
                      onChange={(e) => setOfficeAddress(e.target.value)}
                      className="min-h-[70px]"
                    />
                  </div>
                  <div>
                    <Label htmlFor="office-phone">Office phone</Label>
                    <Input
                      id="office-phone"
                      value={officePhone}
                      onChange={(e) => setOfficePhone(e.target.value)}
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-border p-3 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                    Delivery contact
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="dc-name">Name</Label>
                      <Input
                        id="dc-name"
                        value={deliveryContactName}
                        onChange={(e) => setDeliveryContactName(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="dc-phone">Phone</Label>
                      <Input
                        id="dc-phone"
                        value={deliveryContactPhone}
                        onChange={(e) => setDeliveryContactPhone(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-border p-3 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                    Next loading reminder (optional)
                  </p>
                  <div>
                    <Label htmlFor="nl-date">Next loading date</Label>
                    <Input
                      id="nl-date"
                      value={nextLoadingDate}
                      onChange={(e) => setNextLoadingDate(e.target.value)}
                      placeholder="e.g. Sunday, July 26, 2026"
                    />
                  </div>
                  <div>
                    <Label htmlFor="nl-note">Reminder note</Label>
                    <Textarea
                      id="nl-note"
                      value={nextLoadingNote}
                      onChange={(e) => setNextLoadingNote(e.target.value)}
                      className="min-h-[60px]"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="us-phones">USA information line</Label>
                  <Input
                    id="us-phones"
                    value={usPhones}
                    onChange={(e) => setUsPhones(e.target.value)}
                  />
                </div>

                {/* Test send */}
                <div className="rounded-lg border border-border bg-secondary/40 p-3">
                  <Label htmlFor="test-email" className="flex items-center gap-1.5">
                    <FlaskConical className="h-3.5 w-3.5" /> Test send
                  </Label>
                  <div className="mt-1 flex gap-2">
                    <Input
                      id="test-email"
                      type="email"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                      placeholder="you@example.com"
                    />
                    <Button variant="outline" onClick={handleTest} loading={testing} disabled={testing}>
                      Send test
                    </Button>
                  </div>
                  <p className="mt-1.5 text-xs text-ink-muted">
                    Delivers a single preview to this address only. Customers are not contacted.
                  </p>
                </div>

                <Button
                  variant="gold"
                  onClick={handleBroadcast}
                  loading={sending}
                  disabled={sending || recipients.length === 0}
                  className="w-full"
                >
                  <Send className="h-4 w-4" /> Broadcast to {recipients.length} customer(s)
                </Button>
              </CardContent>
            </Card>

            {/* Live preview */}
            <Card className="h-fit">
              <CardHeader className="flex-row items-center gap-2 space-y-0">
                <Eye className="h-4 w-4 text-gold" aria-hidden />
                <CardTitle>Email preview</CardTitle>
              </CardHeader>
              <CardContent>
                <EmailPreview
                  subject={subject}
                  body={body}
                  cnt={selectedGroup.cnt}
                  officeName={officeName}
                  officeAddress={officeAddress}
                  officePhone={officePhone}
                  deliveryContactName={deliveryContactName}
                  deliveryContactPhone={deliveryContactPhone}
                  nextLoadingDate={nextLoadingDate}
                  nextLoadingNote={nextLoadingNote}
                  usPhones={usPhones}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

// Visual preview that mirrors the server email template (containerNoticeEmail).
function EmailPreview(props: {
  subject: string;
  body: string;
  cnt: string;
  officeName: string;
  officeAddress: string;
  officePhone: string;
  deliveryContactName: string;
  deliveryContactPhone: string;
  nextLoadingDate: string;
  nextLoadingNote: string;
  usPhones: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      {/* Header */}
      <div className="bg-navy-gradient px-6 py-6">
        <p className="text-lg font-extrabold text-white">
          Highclass Shipping <span className="text-gold">&amp; Logistics</span>
        </p>
        <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-gold-200">
          Excellence in handling your valuables
        </p>
      </div>
      <div className="h-1 bg-gold" />
      {/* Body */}
      <div className="space-y-4 bg-white px-6 py-6 text-sm">
        <span className="inline-block rounded-full bg-navy px-3 py-1.5 text-xs font-bold tracking-wide text-gold-300">
          CNT #{props.cnt}
        </span>
        <h3 className="text-lg font-bold leading-snug text-navy">
          {props.subject || "Subject line"}
        </h3>
        <p className="whitespace-pre-line leading-relaxed text-ink">
          {props.body || "Message body"}
        </p>

        {(props.officeAddress || props.officePhone) && (
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-gold-700">
              Pickup location
            </p>
            {props.officeName && (
              <p className="font-semibold text-navy">{props.officeName}</p>
            )}
            {props.officeAddress && (
              <p className="whitespace-pre-line text-ink">{props.officeAddress}</p>
            )}
            {props.officePhone && (
              <p className="mt-1 font-semibold text-navy">{props.officePhone}</p>
            )}
          </div>
        )}

        {(props.deliveryContactName || props.deliveryContactPhone) && (
          <div className="border-l-[3px] border-gold pl-3.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-ink-muted">
              Need delivery?
            </p>
            <p className="text-ink">
              Call our Logistics Manager{" "}
              {props.deliveryContactName && (
                <strong>{props.deliveryContactName}</strong>
              )}
              {props.deliveryContactPhone && (
                <>
                  {" "}
                  on <strong>{props.deliveryContactPhone}</strong>
                </>
              )}
              .
            </p>
          </div>
        )}

        {(props.nextLoadingDate || props.nextLoadingNote) && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-700">
              Reminder
            </p>
            {props.nextLoadingDate && (
              <p className="font-bold text-amber-900">
                Next loading date: {props.nextLoadingDate}
              </p>
            )}
            {props.nextLoadingNote && (
              <p className="mt-0.5 text-amber-800">{props.nextLoadingNote}</p>
            )}
          </div>
        )}

        {props.usPhones && (
          <p className="text-ink-muted">
            For more information please call{" "}
            <strong className="text-navy">{props.usPhones}</strong>.
          </p>
        )}

        <p className="border-t border-border pt-3 text-[11px] leading-relaxed text-ink-muted">
          FMC Licensed since 2017 · Registered in Maryland, USA &amp; Nigeria (CAC)
          <br />
          Highclass Shipping and Logistics Inc.
        </p>
      </div>
    </div>
  );
}
