"use client";

import * as React from "react";
import { Boxes, Plus, PackageCheck, PackageOpen } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  listDestinationInventory,
  addInventoryItem,
  updateInventoryItem,
  serverTimestamp,
  COL,
} from "@/lib/db";
import type { InventoryItem } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Skeleton, EmptyState } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/utils";

export default function OfficeInventoryPage() {
  const { user } = useAuth();
  const country = user?.assigned_country || "Nigeria";
  const toast = useToast();

  const [items, setItems] = React.useState<InventoryItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  const [desc, setDesc] = React.useState("");
  const [tracking, setTracking] = React.useState("");
  const [locNotes, setLocNotes] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listDestinationInventory(country);
      setItems(rows);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [country]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function handleIntake(e: React.FormEvent) {
    e.preventDefault();
    if (!desc.trim()) {
      toast.error("Description required", "Enter an item description.");
      return;
    }
    setSaving(true);
    try {
      await addInventoryItem(COL.destInventory, {
        item_description: desc.trim(),
        tracking_number: tracking.trim() || undefined,
        location_notes: locNotes.trim() || undefined,
        destination_country: country,
        shipment_id: "",
      });
      toast.success("Item received", "Added to destination inventory.");
      setDesc("");
      setTracking("");
      setLocNotes("");
      await load();
    } catch {
      toast.error("Failed to add item", "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function markDispatched(item: InventoryItem) {
    try {
      await updateInventoryItem(COL.destInventory, item.id, {
        dispatched_at: serverTimestamp() as unknown as InventoryItem["dispatched_at"],
      });
      toast.success("Marked dispatched", item.item_description);
      await load();
    } catch {
      toast.error("Update failed", "Please try again.");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-navy sm:text-3xl">
          Warehouse Inventory
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Destination warehouse intake &amp; dispatch tracking for {country}.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Intake form */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-gold" /> Receive Item
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleIntake} className="space-y-4">
              <div>
                <Label htmlFor="desc" required>
                  Item description
                </Label>
                <Input
                  id="desc"
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="e.g. Large Electronic Box"
                />
              </div>
              <div>
                <Label htmlFor="tracking">Tracking #</Label>
                <Input
                  id="tracking"
                  value={tracking}
                  onChange={(e) => setTracking(e.target.value)}
                  placeholder="HC-SEA-2026-00001"
                  className="font-mono"
                />
              </div>
              <div>
                <Label htmlFor="loc">Location notes</Label>
                <Textarea
                  id="loc"
                  value={locNotes}
                  onChange={(e) => setLocNotes(e.target.value)}
                  placeholder="e.g. Bay 3, Rack B"
                />
              </div>
              <Button type="submit" loading={saving} className="w-full">
                <PackageCheck className="h-4 w-4" /> Add to inventory
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Inventory table */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Current Inventory</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 rounded-lg" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <EmptyState
                icon={<Boxes className="h-6 w-6" />}
                title="No inventory yet"
                description="Received items will appear here. Use the intake form to log arrivals."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-ink-muted">
                      <th className="pb-2 pr-3 font-medium">Item</th>
                      <th className="pb-2 pr-3 font-medium">Tracking</th>
                      <th className="pb-2 pr-3 font-medium">Location</th>
                      <th className="pb-2 pr-3 font-medium">Status</th>
                      <th className="pb-2 font-medium" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {items.map((it) => {
                      const dispatched = !!it.dispatched_at;
                      return (
                        <tr key={it.id} className="align-top">
                          <td className="py-3 pr-3">
                            <span className="font-medium text-navy">{it.item_description}</span>
                            <div className="text-xs text-ink-muted">
                              Received {formatDate(it.received_at)}
                            </div>
                          </td>
                          <td className="py-3 pr-3 font-mono text-xs text-ink-muted">
                            {it.tracking_number || "—"}
                          </td>
                          <td className="py-3 pr-3 text-xs text-ink-muted">
                            {it.location_notes || "—"}
                          </td>
                          <td className="py-3 pr-3">
                            {dispatched ? (
                              <Badge variant="muted">Dispatched</Badge>
                            ) : (
                              <Badge variant="success">Received</Badge>
                            )}
                          </td>
                          <td className="py-3 text-right">
                            {!dispatched && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => markDispatched(it)}
                              >
                                <PackageOpen className="h-4 w-4" /> Dispatch
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
