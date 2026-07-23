"use client";

import * as React from "react";
import { Inbox, Mail, Phone, Building2 } from "lucide-react";
import { listInquiries, updateInquiry, logActivity } from "@/lib/db";
import type { ContactInquiry } from "@/lib/types";
import { useAuth } from "@/components/providers/AuthProvider";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
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

const STATUS_META: Record<ContactInquiry["status"], { label: string; variant: "warning" | "gold" | "success" }> = {
  new: { label: "New", variant: "warning" },
  in_progress: { label: "In progress", variant: "gold" },
  closed: { label: "Closed", variant: "success" },
};

export default function AdminInquiriesPage() {
  const { user } = useAuth();
  const toast = useToast();

  const [loading, setLoading] = React.useState(true);
  const [inquiries, setInquiries] = React.useState<ContactInquiry[]>([]);
  const [error, setError] = React.useState(false);
  const [filter, setFilter] = React.useState<ContactInquiry["status"] | "all">("all");
  const [busy, setBusy] = React.useState<string | null>(null);

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
        action: `marked inquiry ${STATUS_META[status].label.toLowerCase()}`,
        target: inq.name,
        meta: { inquiry_id: inq.id },
      });
      toast.success("Inquiry updated", `Marked as ${STATUS_META[status].label}.`);
    } catch {
      toast.error("Update failed", "Could not update the inquiry.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm text-ink-muted">
          {loading ? "Loading inquiries…" : `${filtered.length} inquiry(ies)`}
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
          title="Could not load inquiries"
          description="Please refresh to try again."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Inbox className="h-6 w-6" />}
          title={inquiries.length === 0 ? "No inquiries yet" : "No matching inquiries"}
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
                      variant="primary"
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
                  <a
                    href={`mailto:${inq.email}`}
                    className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-navy transition-colors hover:bg-navy/5 focus-ring cursor-pointer"
                  >
                    <Mail className="h-3.5 w-3.5" /> Reply by email
                  </a>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
