"use client";

import * as React from "react";
import { Beaker, Trash2, Loader2 } from "lucide-react";
import { seedDemoData, clearDemoData, hasDemoData } from "@/lib/demo";
import { logActivity } from "@/lib/db";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/ui/toast";

// Admin-only testing helper shown in the top bar. ONE button that toggles:
// "Add demo" when the database has no demo data, "Clear demo" once it does.
// Never touches real data — every seeded doc is tagged { demo: true }.
export function DemoDataToolbar() {
  const { user } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = React.useState(false);
  // null = still checking, so the button does not flash the wrong label.
  const [seeded, setSeeded] = React.useState<boolean | null>(null);

  const refresh = React.useCallback(async () => {
    try {
      setSeeded(await hasDemoData());
    } catch {
      setSeeded(false);
    }
  }, []);

  React.useEffect(() => {
    if (user) void refresh();
  }, [user, refresh]);

  async function addDemo() {
    if (!user) return;
    setBusy(true);
    try {
      const r = await seedDemoData({ id: user.id });
      await logActivity({
        actor_id: user.id,
        actor_name: user.full_name,
        actor_role: "admin",
        action: "added demo data",
        meta: {
          shipments: r.shipments,
          inquiries: r.inquiries,
          receipts: r.receipts,
          inventory: r.inventory,
          sailings: r.sailings,
          roroDocs: r.roroDocs,
          customers: r.customers,
        },
      });
      setSeeded(true);
      toast.success(
        "Demo data added",
        `${r.shipments} shipments (all stages), ${r.customers} customers, ${r.receipts} receipts, ` +
          `${r.inventory} inventory items, ${r.sailings} sailing notices, ${r.roroDocs} RORO docs, ` +
          `${r.inquiries} submissions. Refresh to see them.`
      );
    } catch {
      toast.error("Could not add demo data", "Please try again.");
      void refresh();
    } finally {
      setBusy(false);
    }
  }

  async function clearDemo() {
    if (!user) return;
    if (
      !window.confirm(
        "Delete ALL demo data?\n\n" +
          "Removes demo shipments, customers, receipts, USA + destination inventory, " +
          "sailing notices, RORO documents, and submissions.\n\n" +
          "Real records are never affected."
      )
    )
      return;
    setBusy(true);
    try {
      const removed = await clearDemoData();
      await logActivity({
        actor_id: user.id,
        actor_name: user.full_name,
        actor_role: "admin",
        action: "cleared demo data",
        meta: { removed },
      });
      setSeeded(false);
      toast.success("Demo data cleared", `Removed ${removed} demo record(s). Refresh to update.`);
    } catch {
      toast.error("Could not clear demo data", "Please try again.");
      void refresh();
    } finally {
      setBusy(false);
    }
  }

  // Hide entirely until we know which state we are in.
  if (seeded === null) return null;

  const isClear = seeded;

  return (
    <div className="hidden items-center gap-1.5 sm:flex">
      <button
        onClick={isClear ? clearDemo : addDemo}
        disabled={busy}
        className={
          isClear
            ? "inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 px-2.5 py-1.5 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/5 focus-ring disabled:opacity-50 cursor-pointer"
            : "inline-flex items-center gap-1.5 rounded-lg border border-gold/40 bg-gold/10 px-2.5 py-1.5 text-xs font-semibold text-gold-700 transition-colors hover:bg-gold/20 focus-ring disabled:opacity-50 cursor-pointer"
        }
        title={
          isClear
            ? "Delete all demo-tagged data (real records are unaffected)"
            : "Add demo shipments, customers, inventory and submissions for testing"
        }
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : isClear ? (
          <Trash2 className="h-3.5 w-3.5" />
        ) : (
          <Beaker className="h-3.5 w-3.5" />
        )}
        {busy ? (isClear ? "Clearing" : "Adding") : isClear ? "Clear demo" : "Add demo"}
      </button>
    </div>
  );
}
