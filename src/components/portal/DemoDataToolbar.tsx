"use client";

import * as React from "react";
import { Beaker, Trash2, Loader2 } from "lucide-react";
import { seedDemoData, clearDemoData } from "@/lib/demo";
import { logActivity } from "@/lib/db";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/ui/toast";

// Admin-only testing helper shown in the top bar: seed a spread of demo
// shipments/submissions, or clear everything tagged demo. Never touches real data.
export function DemoDataToolbar() {
  const { user } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = React.useState<"seed" | "clear" | null>(null);

  async function addDemo() {
    if (!user) return;
    setBusy("seed");
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
      toast.success(
        "Demo data added",
        `${r.shipments} shipments (all stages), ${r.customers} customers, ${r.receipts} receipts, ` +
          `${r.inventory} inventory items, ${r.sailings} sailing notices, ${r.roroDocs} RORO docs, ` +
          `${r.inquiries} submissions. Refresh to see them.`
      );
    } catch {
      toast.error("Could not add demo data", "Please try again.");
    } finally {
      setBusy(null);
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
    setBusy("clear");
    try {
      const removed = await clearDemoData();
      await logActivity({
        actor_id: user.id,
        actor_name: user.full_name,
        actor_role: "admin",
        action: "cleared demo data",
        meta: { removed },
      });
      toast.success("Demo data cleared", `Removed ${removed} demo record(s). Refresh to update.`);
    } catch {
      toast.error("Could not clear demo data", "Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="hidden items-center gap-1.5 sm:flex">
      <button
        onClick={addDemo}
        disabled={busy !== null}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gold/40 bg-gold/10 px-2.5 py-1.5 text-xs font-semibold text-gold-700 transition-colors hover:bg-gold/20 focus-ring disabled:opacity-50 cursor-pointer"
        title="Add demo shipments and submissions for testing"
      >
        {busy === "seed" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Beaker className="h-3.5 w-3.5" />}
        Add demo
      </button>
      <button
        onClick={clearDemo}
        disabled={busy !== null}
        className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 px-2.5 py-1.5 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/5 focus-ring disabled:opacity-50 cursor-pointer"
        title="Delete all demo-tagged data"
      >
        {busy === "clear" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        Clear demo
      </button>
    </div>
  );
}
