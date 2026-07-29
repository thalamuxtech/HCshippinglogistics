"use client";

import * as React from "react";
import { Inbox, Mail, Phone, Building2, Send, Reply, Eye } from "lucide-react";
import { listInquiries, updateInquiry, logActivity } from "@/lib/db";
import { sendInquiryReply } from "@/lib/notify";
import type { ContactInquiry } from "@/lib/types";
import { useAuth } from "@/components/providers/AuthProvider";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Textarea, Label, Select } from "@/components/ui/input";
import { Skeleton, EmptyState, Modal } from "@/components/ui/misc";
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

const STATUS_META: Record<ContactInquiry["status"], { label: string; variant: "warning" | "gold" | "success" }> = {
  new: { label: "New", variant: "warning" },
  in_progress: { label: "In progress", variant: "gold" },
  closed: { label: "Closed", variant: "success" },
};

export default function AdminSubmissionsPage() {
  const { user } = useAuth();
  const toast = useToast();

  const [loading, setLoading] = React.useState(true);
  const [inquiries, setInquiries] = React.useState<ContactInquiry[]>([]);
  const [error, setError] = React.useState(false);
  const [filter, setFilter] = React.useState<ContactInquiry["status"] | "all">("all");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [replyTo, setReplyTo] = React.useState<ContactInquiry | null>(null);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const i = await listInquiries();
        if (alive) setInquiries(i);
      } catch {
        if (alive) setError(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const filtered = React.useMemo(
    () => (filter === "all" ? inquiries : inquiries.filter((i) => i.status === filter)),
    [inquiries, filter]
  );

  async function setStatus(inq: ContactInquiry, status: ContactInquiry["status"]) {
    if (!user) return;
    setBusy(inq.id);
    try {
      await updateInquiry(inq.id, { status });
      setInquiries((list) => list.map((i) => (i.id === inq.id ? { ...i, status } : i)));
      await logActivity({
        actor_id: user.id,
        actor_name: user.full_name,
        actor_role: "admin",
        action: `marked submission ${STATUS_META[status].label.toLowerCase()}`,
        target: inq.name,
        meta: { inquiry_id: inq.id },
      });
      toast.success("Submission updated", `Marked as ${STATUS_META[status].label}.`);
    } catch {
      toast.error("Update failed", "Could not update the submission.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm text-ink-muted">
          {loading ? "Loading submissions…" : `${filtered.length} submission(s)`}
        </p>
        <Select
          value={filter}
          onChange={(e) => setFilter(e.target.value as ContactInquiry["status"] | "all")}
          aria-label="Filter by status"
          className="w-44"
        >
          <option value="all">All statuses</option>
          <option value="new">New</option>
          <option value="in_progress">In progress</option>
          <option value="closed">Closed</option>
        </Select>
      </Card>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <EmptyState
          icon={<Inbox className="h-6 w-6" />}
          title="Could not load submissions"
          description="Please refresh to try again."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Inbox className="h-6 w-6" />}
          title={inquiries.length === 0 ? "No submissions yet" : "No matching submissions"}
          description={
            inquiries.length === 0
              ? "Contact form submissions will appear here."
              : "Try a different status filter."
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((inq) => {
            const meta = STATUS_META[inq.status];
            return (
              <Card key={inq.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-navy">{inq.name}</h3>
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                      {inq.inquiry_type && <Badge variant="outline">{inq.inquiry_type}</Badge>}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
                      <span className="inline-flex items-center gap-1">
                        <Mail className="h-3.5 w-3.5" /> {inq.email}
                      </span>
                      {inq.phone && (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-3.5 w-3.5" /> {inq.phone}
                        </span>
                      )}
                      {inq.company && (
                        <span className="inline-flex items-center gap-1">
                          <Building2 className="h-3.5 w-3.5" /> {inq.company}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="whitespace-nowrap text-xs text-ink-muted">
                    {formatDateTime(tsToDate(inq.created_at))}
                  </span>
                </div>

                <p className="mt-3 whitespace-pre-wrap text-sm text-ink">{inq.message}</p>

                <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                  <Button variant="gold" size="sm" onClick={() => setReplyTo(inq)}>
                    <Reply className="h-3.5 w-3.5" /> Reply
                  </Button>
                  {inq.status !== "in_progress" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setStatus(inq, "in_progress")}
                      loading={busy === inq.id}
                      disabled={busy !== null}
                    >
                      Mark in progress
                    </Button>
                  )}
                  {inq.status !== "closed" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setStatus(inq, "closed")}
                      loading={busy === inq.id}
                      disabled={busy !== null}
                    >
                      Mark closed
                    </Button>
                  )}
                  {inq.status === "closed" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setStatus(inq, "new")}
                      loading={busy === inq.id}
                      disabled={busy !== null}
                    >
                      Reopen
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {replyTo && (
        <ReplyModal
          inquiry={replyTo}
          onClose={() => setReplyTo(null)}
          onSent={(inqId) => {
            // Reflect the auto status bump (new -> in_progress) locally.
            setInquiries((list) =>
              list.map((i) => (i.id === inqId && i.status === "new" ? { ...i, status: "in_progress" } : i))
            );
          }}
        />
      )}
    </div>
  );
}

// ── Reply composer with a live email preview on the side ──
function ReplyModal({
  inquiry,
  onClose,
  onSent,
}: {
  inquiry: ContactInquiry;
  onClose: () => void;
  onSent: (inquiryId: string) => void;
}) {
  const toast = useToast();
  const [to, setTo] = React.useState(inquiry.email || "");
  const [subject, setSubject] = React.useState(
    `Re: your message to Highclass Shipping${inquiry.inquiry_type ? ` (${inquiry.inquiry_type})` : ""}`
  );
  const [message, setMessage] = React.useState(
    `Hello ${inquiry.name || "there"},\n\nThank you for reaching out to Highclass Shipping & Logistics. \n\n\n\nWarm regards,\nHighclass Shipping & Logistics Inc.`
  );
  const [sending, setSending] = React.useState(false);

  const emailRe = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

  async function handleSend() {
    if (!emailRe.test(to.trim())) {
      toast.error("Invalid recipient", "Enter a valid email address.");
      return;
    }
    if (!subject.trim() || !message.trim()) {
      toast.error("Missing content", "Subject and message are required.");
      return;
    }
    setSending(true);
    try {
      const res = await sendInquiryReply({
        to: to.trim(),
        subject: subject.trim(),
        message: message.trim(),
        inquiryId: inquiry.id,
      });
      if (res.ok) {
        toast.success("Reply sent", `Delivered to ${to.trim()}${res.provider ? ` via ${res.provider}` : ""}.`);
        onSent(inquiry.id);
        onClose();
      } else {
        toast.error("Send failed", res.error || "The reply could not be delivered.");
      }
    } catch {
      toast.error("Send failed", "Could not send the reply.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Reply to ${inquiry.name}`} size="xl">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Composer */}
        <div className="space-y-4">
          {/* Original message, for context */}
          <div className="rounded-lg border border-border bg-secondary/40 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
              Original message
            </p>
            <p className="mt-1.5 max-h-24 overflow-y-auto whitespace-pre-wrap text-xs text-ink">
              {inquiry.message}
            </p>
          </div>

          <div>
            <Label htmlFor="reply-to" required>
              To
            </Label>
            <Input
              id="reply-to"
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="customer@example.com"
            />
          </div>
          <div>
            <Label htmlFor="reply-subject" required>
              Subject
            </Label>
            <Input
              id="reply-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="reply-message" required>
              Message
            </Label>
            <Textarea
              id="reply-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[180px]"
            />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={sending}>
              Cancel
            </Button>
            <Button variant="gold" className="flex-1" onClick={handleSend} loading={sending} disabled={sending}>
              <Send className="h-4 w-4" /> Send reply
            </Button>
          </div>
        </div>

        {/* Live preview */}
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
            <Eye className="h-3.5 w-3.5" /> Email preview
          </p>
          <ReplyPreview subject={subject} message={message} />
        </div>
      </div>
    </Modal>
  );
}

// Visual preview that mirrors the server emailShell template.
function ReplyPreview({ subject, message }: { subject: string; message: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="bg-navy-gradient px-6 py-5 text-center">
        <p className="text-base font-extrabold text-white">
          Highclass Shipping <span className="text-gold">&amp; Logistics</span>
        </p>
        <p className="mt-1 text-[9px] uppercase tracking-[0.2em] text-gold-200">
          Excellence in handling your valuables
        </p>
      </div>
      <div className="h-1 bg-gold" />
      <div className="space-y-3 bg-white px-6 py-5 text-sm">
        <h3 className="text-base font-bold leading-snug text-navy">{subject || "Subject line"}</h3>
        <p className="whitespace-pre-line leading-relaxed text-ink">{message || "Your message"}</p>
        <span className="mt-1 inline-block rounded-lg bg-gold px-4 py-2 text-xs font-bold text-white">
          Contact us
        </span>
        <p className="border-t border-border pt-3 text-[11px] leading-relaxed text-ink-muted">
          FMC Licensed since 2017 · Registered in Maryland, USA &amp; Nigeria (CAC)
          <br />
          You are receiving this because you contacted Highclass Shipping.
        </p>
      </div>
    </div>
  );
}
