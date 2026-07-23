"use client";

import * as React from "react";
import { Bell, Mail, MessageSquare } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { listNotificationsForCustomer } from "@/lib/db";
import type { NotificationLog } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton, EmptyState } from "@/components/ui/misc";

const statusVariant: Record<
  NotificationLog["status"],
  "success" | "muted" | "danger" | "warning"
> = {
  delivered: "success",
  sent: "success",
  queued: "warning",
  failed: "danger",
};

export default function NotificationsPage() {
  const { user } = useAuth();
  const [items, setItems] = React.useState<NotificationLog[] | null>(null);

  React.useEffect(() => {
    if (!user) return;
    let active = true;
    listNotificationsForCustomer(user.id)
      .then((rows) => active && setItems(rows))
      .catch(() => active && setItems([]));
    return () => {
      active = false;
    };
  }, [user]);

  const loading = items === null;

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow">Notifications</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-navy sm:text-3xl">
          Notification history
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Every email and SMS update we&apos;ve sent about your shipments.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-6 w-6" />}
          title="No notifications yet"
          description="Stage updates and confirmations will show up here as your shipments progress."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            {/* Table on md+, stacked list on mobile */}
            <div className="hidden md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-ink-muted">
                    <th className="px-5 py-3 font-medium">Channel</th>
                    <th className="px-5 py-3 font-medium">Subject</th>
                    <th className="px-5 py-3 font-medium">Type</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((n) => (
                    <tr key={n.id} className="hover:bg-surface">
                      <td className="px-5 py-3">
                        <ChannelPill channel={n.channel} />
                      </td>
                      <td className="px-5 py-3 text-navy">{n.subject || "—"}</td>
                      <td className="px-5 py-3 text-ink-muted">{n.type}</td>
                      <td className="px-5 py-3">
                        <Badge variant={statusVariant[n.status] ?? "muted"} className="capitalize">
                          {n.status}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-ink-muted">
                        {formatDateTime(n.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-border md:hidden">
              {items.map((n) => (
                <li key={n.id} className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <ChannelPill channel={n.channel} />
                    <Badge variant={statusVariant[n.status] ?? "muted"} className="capitalize">
                      {n.status}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm font-medium text-navy">{n.subject || n.type}</p>
                  <p className="mt-0.5 font-mono text-xs text-ink-muted">
                    {formatDateTime(n.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ChannelPill({ channel }: { channel: "email" | "sms" }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-navy">
      {channel === "email" ? (
        <Mail className="h-4 w-4 text-navy/70" />
      ) : (
        <MessageSquare className="h-4 w-4 text-navy/70" />
      )}
      <span className="uppercase">{channel}</span>
    </span>
  );
}
