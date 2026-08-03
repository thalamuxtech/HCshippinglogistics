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
  Plus,
  Search,
  X,
  Layers,
  Pencil,
  Check,
} from "lucide-react";
import { listAllShipments, listUsers, logActivity, updateShipment } from "@/lib/db";
import { sendContainerBroadcast } from "@/lib/notify";
import type { Shipment, AppUser } from "@/lib/types";
import { COMPANY, SERVICES, STAGE_MAP } from "@/lib/constants";
import { useAuth } from "@/components/providers/AuthProvider";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input, Textarea, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StageBadge } from "@/components/ui/badge";
import { Skeleton, EmptyState, Modal } from "@/components/ui/misc";
import { BulkAdvanceBar } from "@/components/portal/BulkAdvanceBar";
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

  // Starts blank: this is a deliberate "send one preview to this address" field,
  // so it should not be pre-aimed at the signed-in admin.
  const [testEmail, setTestEmail] = React.useState("");
  const [testing, setTesting] = React.useState(false);
  const [sending, setSending] = React.useState(false);

  // Editable recipient list: derived customers can be removed; extra ad-hoc
  // emails can be added. Keyed per container so switching containers resets it.
  const [removedEmails, setRemovedEmails] = React.useState<Set<string>>(new Set());
  const [extraEmails, setExtraEmails] = React.useState<string[]>([]);
  const [newEmail, setNewEmail] = React.useState("");

  // Inline CNT rename (the composer header doubles as the editor).
  const [editingCnt, setEditingCnt] = React.useState(false);
  const [cntDraft, setCntDraft] = React.useState("");
  const [renaming, setRenaming] = React.useState(false);

  // Stage selection for the container's shipments (bulk advance).
  const [stageSel, setStageSel] = React.useState<Set<string>>(new Set());

  // Create / assign container modal
  const [assignOpen, setAssignOpen] = React.useState(false);
  const [assignCnt, setAssignCnt] = React.useState("");
  const [assignDate, setAssignDate] = React.useState("");
  const [assignQuery, setAssignQuery] = React.useState("");
  const [assignPicked, setAssignPicked] = React.useState<Set<string>>(new Set());
  const [assigning, setAssigning] = React.useState(false);

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

  // Reset the recipient edits whenever the selected container changes.
  React.useEffect(() => {
    setRemovedEmails(new Set());
    setExtraEmails([]);
    setNewEmail("");
    // Also drop any stage selection and close the rename editor — both belong to
    // the container being left behind.
    setStageSel(new Set());
    setEditingCnt(false);
    setCntDraft(selected);
  }, [selected]);

  /**
   * Rename a container: rewrites container_number on every shipment in the
   * group. Written per-shipment with failures collected, so one rejected write
   * cannot leave the operator thinking nothing changed when most did.
   */
  async function handleRenameCnt() {
    if (!user || !selectedGroup) return;
    const from = selectedGroup.cnt;
    const to = cntDraft.trim();
    if (!to || to === from) {
      setEditingCnt(false);
      setCntDraft(from);
      return;
    }
    const merging = groups.some((g) => g.cnt === to);
    if (
      !window.confirm(
        merging
          ? `CNT #${to} already exists. Move all ${selectedGroup.shipments.length} shipment(s) from CNT #${from} into it? The two containers will be merged.`
          : `Rename CNT #${from} to CNT #${to}? This updates ${selectedGroup.shipments.length} shipment(s).`
      )
    )
      return;

    setRenaming(true);
    const failed: string[] = [];
    try {
      for (const s of selectedGroup.shipments) {
        try {
          await updateShipment(s.id, { container_number: to });
        } catch {
          failed.push(s.tracking_number || s.id.slice(0, 8));
        }
      }
      await logActivity({
        actor_id: user.id,
        actor_name: user.full_name,
        actor_role: "admin",
        action: merging
          ? `merged CNT #${from} into CNT #${to}`
          : `renamed CNT #${from} to CNT #${to}`,
        target: `CNT #${to}`,
        meta: {
          from,
          to,
          count: selectedGroup.shipments.length - failed.length,
          failed: failed.length,
        },
      });
      await load();
      setSelected(to);
      setEditingCnt(false);
      if (failed.length === 0) {
        toast.success(
          merging ? "Containers merged" : "Container renamed",
          `Now CNT #${to}.`
        );
      } else {
        toast.info(
          "Renamed with issues",
          `${selectedGroup.shipments.length - failed.length} moved, ${failed.length} failed: ${failed
            .slice(0, 3)
            .join(", ")}.`
        );
      }
    } catch {
      toast.error("Rename failed", "Could not rename the container.");
    } finally {
      setRenaming(false);
    }
  }

  const emailRe = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

  // The final, editable recipient list: derived customers (minus removed) plus
  // any ad-hoc emails, de-duplicated case-insensitively.
  const finalRecipients = React.useMemo(() => {
    const seen = new Set<string>();
    const list: { email: string; name?: string; adhoc: boolean }[] = [];
    const add = (email: string, name: string | undefined, adhoc: boolean) => {
      const key = email.trim().toLowerCase();
      if (!email || seen.has(key) || removedEmails.has(key)) return;
      seen.add(key);
      list.push({ email: email.trim(), name, adhoc });
    };
    for (const c of recipients) if (c.email) add(c.email, c.full_name, false);
    for (const e of extraEmails) add(e, undefined, true);
    return list;
  }, [recipients, extraEmails, removedEmails]);

  const finalEmails = React.useMemo(
    () => finalRecipients.map((r) => r.email),
    [finalRecipients]
  );

  // Gate the test-send button on a well-formed address, so the only way to fire
  // a send is with something deliverable (same shape the callable validates).
  const testEmailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(testEmail.trim());

  function removeRecipient(email: string) {
    setRemovedEmails((prev) => new Set(prev).add(email.trim().toLowerCase()));
    setExtraEmails((prev) => prev.filter((e) => e.trim().toLowerCase() !== email.trim().toLowerCase()));
  }

  function addRecipient() {
    const e = newEmail.trim();
    if (!emailRe.test(e)) {
      toast.error("Invalid email", "Enter a valid email address to add.");
      return;
    }
    const key = e.toLowerCase();
    // Un-remove if it was a removed derived recipient; otherwise add as ad-hoc.
    setRemovedEmails((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    const isDerived = recipients.some((c) => c.email?.trim().toLowerCase() === key);
    if (!isDerived && !extraEmails.some((x) => x.trim().toLowerCase() === key)) {
      setExtraEmails((prev) => [...prev, e]);
    }
    setNewEmail("");
  }

  async function handleTest() {
    if (!selected) return;
    if (!testEmailValid) {
      toast.error("Add a test address", "Enter a valid email to receive the preview.");
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
      // A failed send is a real failure, not a "queued" one — reporting it as
      // pending hid provider rejections (e.g. Brevo IP allowlist 401s).
      else
        toast.error(
          "Test not delivered",
          res.error
            ? String(res.error).slice(0, 180)
            : "The email provider rejected the send. Check Email delivery in Settings."
        );
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
    if (finalEmails.length === 0) {
      toast.error("No recipients", "Add at least one recipient before sending.");
      return;
    }
    if (
      !window.confirm(
        `Send this notice to ${finalEmails.length} recipient(s) for CNT #${selected}?`
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
        emails: finalEmails,
      });
      await logActivity({
        actor_id: user.id,
        actor_name: user.full_name,
        actor_role: "admin",
        action: `sent container broadcast (CNT #${selected})`,
        target: subject,
        meta: { container_number: selected, recipient_count: res.recipientCount },
      });
      if (res.failedCount && res.failedCount > 0) {
        const delivered = res.recipientCount - res.failedCount;
        const reason = res.error ? ` ${String(res.error).slice(0, 180)}` : "";
        // Nothing delivered is an outright failure, not an "issue" — and always
        // include the provider's reason so it is actionable.
        if (delivered === 0) {
          toast.error("Broadcast not delivered", `All ${res.failedCount} failed.${reason}`);
        } else {
          toast.info(
            "Broadcast sent with issues",
            `${delivered} delivered, ${res.failedCount} failed.${reason}`
          );
        }
      } else {
        toast.success(
          "Broadcast sent",
          `Notice delivered to ${res.recipientCount} recipient(s) on CNT #${selected}.`
        );
      }
    } catch {
      toast.error("Send failed", "Could not send the broadcast.");
    } finally {
      setSending(false);
    }
  }

  // ── Create / assign container ──
  function openAssign(prefillCnt?: string) {
    setAssignCnt(prefillCnt || "");
    setAssignDate("");
    setAssignQuery("");
    setAssignPicked(new Set());
    setAssignOpen(true);
  }

  const assignMatches = React.useMemo(() => {
    const term = assignQuery.trim().toLowerCase();
    return shipments
      .filter((s) => {
        if (!term) return true;
        return (
          s.tracking_number?.toLowerCase().includes(term) ||
          s.customer_name?.toLowerCase().includes(term) ||
          s.customer_email?.toLowerCase().includes(term) ||
          s.container_number?.toLowerCase().includes(term)
        );
      })
      .slice(0, 60);
  }, [shipments, assignQuery]);

  async function handleAssign() {
    if (!user) return;
    const cnt = assignCnt.trim();
    if (!cnt) {
      toast.error("Container number required", "Enter a CNT to assign to.");
      return;
    }
    if (assignPicked.size === 0) {
      toast.error("No shipments selected", "Pick at least one shipment.");
      return;
    }
    setAssigning(true);
    try {
      const ids = Array.from(assignPicked);
      // Per-shipment error capture: a single rejected write must not be reported
      // as a total failure when the rest succeeded, or the operator re-runs the
      // whole batch trying to fix one item.
      const failed: string[] = [];
      let ok = 0;
      for (const id of ids) {
        try {
          await updateShipment(id, {
            container_number: cnt,
            // Only stamp the sail date when one was entered, so assigning to an
            // existing container does not blank out the date already recorded.
            ...(assignDate ? { container_shipped_on: assignDate } : {}),
          });
          ok += 1;
        } catch {
          const s = shipments.find((x) => x.id === id);
          failed.push(s?.tracking_number || id.slice(0, 8));
        }
      }
      await logActivity({
        actor_id: user.id,
        actor_name: user.full_name,
        actor_role: "admin",
        action: `assigned ${ok} shipment(s) to CNT #${cnt}`,
        target: `CNT #${cnt}`,
        meta: { container_number: cnt, count: ok, failed: failed.length },
      });
      await load();
      setSelected(cnt);
      if (failed.length === 0) {
        setAssignOpen(false);
        toast.success("Shipments assigned", `${ok} shipment(s) added to CNT #${cnt}.`);
      } else if (ok === 0) {
        toast.error("Assign failed", "Could not assign any of the selected shipments.");
      } else {
        // Keep the modal open on partial success so the operator can see and
        // retry just the ones that failed.
        setAssignPicked(new Set(ids.filter((id) => {
          const s = shipments.find((x) => x.id === id);
          return failed.includes(s?.tracking_number || id.slice(0, 8));
        })));
        toast.info(
          "Assigned with issues",
          `${ok} added, ${failed.length} failed: ${failed.slice(0, 3).join(", ")}.`
        );
      }
    } catch {
      toast.error("Assign failed", "Could not assign the selected shipments.");
    } finally {
      setAssigning(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
      {/* Container list */}
      <Card className="flex h-fit flex-col">
        <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
          <div className="flex items-center gap-2">
            <Container className="h-4 w-4 text-gold" aria-hidden />
            <CardTitle>Containers</CardTitle>
          </div>
          <Button size="sm" variant="gold" onClick={() => openAssign()}>
            <Plus className="h-3.5 w-3.5" /> New
          </Button>
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
          {/* Recipients — editable */}
          <Card>
            <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
              <div className="min-w-0">
                <CardTitle className="flex flex-wrap items-center gap-2">
                  {editingCnt ? (
                    <span className="flex items-center gap-1.5">
                      <Input
                        value={cntDraft}
                        onChange={(e) => setCntDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void handleRenameCnt();
                          }
                          if (e.key === "Escape") {
                            setEditingCnt(false);
                            setCntDraft(selectedGroup.cnt);
                          }
                        }}
                        className="h-9 w-28 font-mono"
                        aria-label="Container number"
                        autoFocus
                        disabled={renaming}
                      />
                      <Button
                        size="sm"
                        variant="gold"
                        onClick={handleRenameCnt}
                        loading={renaming}
                        disabled={renaming || !cntDraft.trim()}
                      >
                        <Check className="h-3.5 w-3.5" /> Save
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingCnt(false);
                          setCntDraft(selectedGroup.cnt);
                        }}
                        disabled={renaming}
                      >
                        Cancel
                      </Button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setCntDraft(selectedGroup.cnt);
                        setEditingCnt(true);
                      }}
                      className="group inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 font-mono transition-colors hover:bg-secondary focus-ring"
                      title="Rename this container"
                    >
                      CNT #{selectedGroup.cnt}
                      <Pencil className="h-3.5 w-3.5 text-ink-muted transition-colors group-hover:text-navy" />
                    </button>
                  )}
                  <Badge variant="gold">{finalEmails.length} recipient(s)</Badge>
                </CardTitle>
                <CardDescription className="mt-1">
                  {selectedGroup.shipments.length} shipment(s) on this container. Remove anyone you
                  do not want to email, or add extra addresses. This exact list is what gets the
                  broadcast.
                </CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={() => openAssign(selectedGroup.cnt)}>
                <Plus className="h-3.5 w-3.5" /> Add shipments
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {finalRecipients.length === 0 ? (
                <p className="text-sm text-ink-muted">
                  No recipients yet. Add an email below, or add shipments to this container.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {finalRecipients.map((r) => (
                    <span
                      key={r.email}
                      className={`group inline-flex items-center gap-1.5 rounded-full py-1 pl-3 pr-1.5 text-xs ${
                        r.adhoc
                          ? "bg-gold/10 text-gold-700 ring-1 ring-gold/25"
                          : "bg-secondary text-secondary-foreground"
                      }`}
                      title={r.email}
                    >
                      <Users className="h-3 w-3 shrink-0" />
                      <span className="max-w-[180px] truncate">{r.name || r.email}</span>
                      <button
                        type="button"
                        onClick={() => removeRecipient(r.email)}
                        aria-label={`Remove ${r.name || r.email}`}
                        className="ml-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-red-100 hover:text-red-600 focus-ring"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Add an ad-hoc recipient */}
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addRecipient();
                    }
                  }}
                  placeholder="Add another email address"
                  aria-label="Add recipient email"
                />
                <Button variant="outline" onClick={addRecipient} disabled={!newEmail.trim()}>
                  <Plus className="h-4 w-4" /> Add
                </Button>
              </div>

              {removedEmails.size > 0 && (
                <button
                  type="button"
                  onClick={() => setRemovedEmails(new Set())}
                  className="text-xs font-medium text-gold-700 hover:underline focus-ring"
                >
                  Restore removed customers
                </button>
              )}
            </CardContent>
          </Card>

          {/* Shipments on this container — stage control for the whole container.
              Moving a container through a stage is ONE physical event, so it
              belongs here rather than forcing the admin to re-find the same
              shipments on the Shipments list and filter by CNT. */}
          <Card>
            <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-gold" aria-hidden />
                  Shipments on this container
                </CardTitle>
                <CardDescription className="mt-1">
                  Select shipments to move them through a stage together. Advancing to a
                  destination stage is what places them in the Lagos office warehouse and the
                  Logistics queue.
                </CardDescription>
              </div>
              <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs font-medium text-ink-muted">
                <input
                  type="checkbox"
                  className="h-5 w-5 cursor-pointer accent-navy"
                  checked={
                    selectedGroup.shipments.length > 0 &&
                    selectedGroup.shipments.every((s) => stageSel.has(s.id))
                  }
                  ref={(el) => {
                    if (el)
                      el.indeterminate =
                        selectedGroup.shipments.some((s) => stageSel.has(s.id)) &&
                        !selectedGroup.shipments.every((s) => stageSel.has(s.id));
                  }}
                  onChange={(e) => {
                    setStageSel(() => {
                      const next = new Set<string>();
                      if (e.target.checked) selectedGroup.shipments.forEach((s) => next.add(s.id));
                      return next;
                    });
                  }}
                />
                Select all
              </label>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border">
                {selectedGroup.shipments.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 py-2.5">
                    <input
                      type="checkbox"
                      aria-label={`Select ${s.tracking_number}`}
                      className="h-5 w-5 shrink-0 cursor-pointer accent-navy"
                      checked={stageSel.has(s.id)}
                      onChange={() =>
                        setStageSel((prev) => {
                          const next = new Set(prev);
                          if (next.has(s.id)) next.delete(s.id);
                          else next.add(s.id);
                          return next;
                        })
                      }
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <a
                          href={`/admin/shipments/detail?id=${s.id}`}
                          className="font-mono text-xs font-semibold text-navy hover:text-gold-700 focus-ring"
                        >
                          {s.tracking_number || s.id.slice(0, 8)}
                        </a>
                        <StageBadge status={s.current_status} />
                      </div>
                      <p className="mt-0.5 truncate text-xs text-ink-muted">
                        {s.customer_name || "Customer"} · {s.destination_country}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Where the container currently sits, at a glance. */}
              <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                {Object.entries(
                  selectedGroup.shipments.reduce<Record<string, number>>((acc, s) => {
                    acc[s.current_status] = (acc[s.current_status] || 0) + 1;
                    return acc;
                  }, {})
                ).map(([status, count]) => (
                  <Badge key={status} variant="muted">
                    {count} · {STAGE_MAP[status as keyof typeof STAGE_MAP]?.short ?? status}
                  </Badge>
                ))}
              </div>
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
                    <Button
                      variant="outline"
                      onClick={handleTest}
                      loading={testing}
                      disabled={testing || !testEmailValid}
                    >
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
                  disabled={sending || finalEmails.length === 0}
                  className="w-full"
                >
                  <Send className="h-4 w-4" /> Broadcast to {finalEmails.length} recipient(s)
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

      {/* Bulk stage advance for the selected container's shipments (same rules
          and audit trail as the Shipments list). */}
      {user && (
        <BulkAdvanceBar
          selected={stageSel}
          shipments={shipments}
          actor={{ id: user.id, full_name: user.full_name, role: user.role }}
          onDone={load}
          onClear={() => setStageSel(new Set())}
        />
      )}

      {/* Create / assign container modal */}
      <Modal
        open={assignOpen}
        onClose={() => !assigning && setAssignOpen(false)}
        title="Create or assign a container"
        description="Give the container a number, then pick the customer shipments it carries."
      >
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="assign-cnt" required>
                Container number (CNT)
              </Label>
              <Input
                id="assign-cnt"
                value={assignCnt}
                onChange={(e) => setAssignCnt(e.target.value)}
                placeholder="e.g. 19B"
              />
            </div>
            <div>
              <Label htmlFor="assign-date">Shipped on (optional)</Label>
              <Input
                id="assign-date"
                type="date"
                value={assignDate}
                onChange={(e) => setAssignDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label>Shipments</Label>
            <div className="relative mt-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
              <Input
                value={assignQuery}
                onChange={(e) => setAssignQuery(e.target.value)}
                placeholder="Search tracking #, customer, or current CNT…"
                className="pl-9"
              />
            </div>

            <div className="mt-2 flex items-center justify-between text-xs text-ink-muted">
              <span>{assignPicked.size} selected</span>
              {assignPicked.size > 0 && (
                <button
                  type="button"
                  onClick={() => setAssignPicked(new Set())}
                  className="font-semibold text-gold-700 hover:underline focus-ring rounded"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="mt-1 max-h-[42vh] space-y-1 overflow-y-auto rounded-lg border border-border p-2">
              {assignMatches.length === 0 ? (
                <p className="p-3 text-sm text-ink-muted">No shipments match.</p>
              ) : (
                assignMatches.map((s) => {
                  const picked = assignPicked.has(s.id);
                  const onOther =
                    s.container_number && s.container_number.trim() !== assignCnt.trim();
                  return (
                    <label
                      key={s.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-secondary/50 ${
                        picked ? "bg-gold/5" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 cursor-pointer accent-navy"
                        checked={picked}
                        onChange={(e) =>
                          setAssignPicked((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(s.id);
                            else next.delete(s.id);
                            return next;
                          })
                        }
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-navy">
                            {s.tracking_number || s.id.slice(0, 8)}
                          </span>
                          <Badge variant="outline">{SERVICES[s.service_type].label}</Badge>
                          {s.container_number && (
                            <Badge variant={onOther ? "warning" : "muted"}>
                              CNT #{s.container_number}
                            </Badge>
                          )}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-ink-muted">
                          {s.customer_name || "Customer"} · {s.destination_country}
                        </span>
                      </span>
                    </label>
                  );
                })
              )}
            </div>
            <p className="mt-1.5 text-xs text-ink-muted">
              Shipments already on another container show an amber tag; assigning moves them here.
              {assignMatches.length >= 60 && " Showing the first 60. Refine your search to narrow it."}
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setAssignOpen(false)}
              disabled={assigning}
            >
              Cancel
            </Button>
            <Button
              variant="gold"
              className="flex-1"
              onClick={handleAssign}
              loading={assigning}
              disabled={assigning || !assignCnt.trim() || assignPicked.size === 0}
            >
              Assign {assignPicked.size || ""} to CNT #{assignCnt.trim() || "…"}
            </Button>
          </div>
        </div>
      </Modal>
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
