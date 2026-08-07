"use client";

// ─────────────────────────────────────────────────────────────
// Edit a shipment's core record (admin).
//
// Scope note: stage, payment, container, DNR and dispatcher assignment each
// already have their own purpose-built control on the detail page (they carry
// side effects, audit logs, emails, balance recalculation). This modal edits
// only the descriptive record: who it is for, where it goes, what is in it.
// Keeping those concerns apart is why editing here cannot silently change a
// customer's balance.
// ─────────────────────────────────────────────────────────────

import * as React from "react";
import { Plus, Trash2, Save, AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea, Label, FieldHint } from "@/components/ui/input";
import { DESTINATION_COUNTRIES } from "@/lib/constants";
import { formatCurrency, cn } from "@/lib/utils";
import type { Shipment, ShipmentItem, ServiceType, ShippingLine } from "@/lib/types";

type Draft = {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  service_type: ServiceType;
  destination_country: string;
  destination_city: string;
  shipping_line: string;
  weight: string;
  declared_value: string;
  item_category: string;
  vehicle_details: string;
  pickup_address: string;
  delivery_address: string;
  receiver_name: string;
  receiver_phone: string;
  receiver_address: string;
  notes: string;
  total_price: string;
  fragile: boolean;
  fragile_note: string;
};

function draftFrom(s: Shipment): Draft {
  return {
    customer_name: s.customer_name ?? "",
    customer_email: s.customer_email ?? "",
    customer_phone: s.customer_phone ?? "",
    service_type: s.service_type,
    destination_country: s.destination_country ?? "",
    destination_city: s.destination_city ?? "",
    shipping_line: s.shipping_line ?? "",
    weight: s.weight != null ? String(s.weight) : "",
    declared_value: s.declared_value != null ? String(s.declared_value) : "",
    item_category: s.item_category ?? "",
    vehicle_details: s.vehicle_details ?? "",
    pickup_address: s.pickup_address ?? "",
    delivery_address: s.delivery_address ?? "",
    receiver_name: s.receiver?.full_name ?? "",
    receiver_phone: s.receiver?.phone ?? "",
    receiver_address: s.receiver?.address ?? "",
    notes: s.notes ?? "",
    total_price: s.total_price != null ? String(s.total_price) : "0",
    fragile: !!s.fragile,
    fragile_note: s.fragile_note ?? "",
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function EditShipmentModal({
  open,
  onClose,
  shipment,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  shipment: Shipment;
  /** Receives only changed fields; resolves when the write completes. */
  onSave: (patch: Partial<Shipment>) => Promise<void>;
}) {
  const [draft, setDraft] = React.useState<Draft>(() => draftFrom(shipment));
  const [items, setItems] = React.useState<ShipmentItem[]>(() => shipment.items ?? []);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Re-seed whenever the dialog opens, so a cancelled edit never persists into
  // the next one and a reload elsewhere on the page is picked up.
  React.useEffect(() => {
    if (open) {
      setDraft(draftFrom(shipment));
      setItems(shipment.items ?? []);
      setError(null);
    }
  }, [open, shipment]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const hasItems = items.length > 0;
  // With line items present the total is DERIVED, never hand-typed, otherwise
  // the invoice total and the items that justify it can disagree.
  const itemsTotal = React.useMemo(
    () => round2(items.reduce((sum, it) => sum + (Number(it.line_total) || 0), 0)),
    [items]
  );
  const effectiveTotal = hasItems ? itemsTotal : round2(Number(draft.total_price) || 0);

  function updateItem(idx: number, patch: Partial<ShipmentItem>) {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        const next = { ...it, ...patch };
        const qty = Number(next.quantity) || 0;
        const unit = Number(next.unit_price) || 0;
        return {
          ...next,
          quantity: qty,
          unit_price: unit,
          line_total: round2(qty * unit),
          // Giving an off-list item a price IS the quote, so the flag resolves to
          // FALSE, not undefined. Leaving it true would badge the row forever;
          // deleting the key would erase the fact that this line was ever quoted,
          // and the "quote ready to send" prompt keys off exactly that history.
          needs_quote: unit > 0 ? false : next.needs_quote,
        };
      })
    );
  }

  function addItem() {
    setItems((prev) => [
      ...prev,
      { description: "", unit_price: 0, quantity: 1, line_total: 0 },
    ]);
  }

  async function handleSave() {
    if (!draft.customer_name.trim()) {
      setError("Customer name is required.");
      return;
    }
    if (!draft.destination_country.trim()) {
      setError("Destination country is required.");
      return;
    }
    if (hasItems && items.some((it) => !it.description.trim())) {
      setError("Every line item needs a description.");
      return;
    }
    if (!hasItems && !(Number(draft.total_price) >= 0)) {
      setError("Enter a valid total price.");
      return;
    }
    setError(null);

    // Build a MINIMAL patch: only fields the operator actually changed. Sending
    // the whole object back would clobber concurrent edits made elsewhere
    // (payment, stage) with values this modal read at open time.
    const patch: Partial<Shipment> = {};
    const orig = draftFrom(shipment);
    // Restricted to the Draft's string fields so a boolean (fragile) can never
    // be routed through .trim(), those are handled explicitly below.
    type StringDraftKey = {
      [K in keyof Draft]: Draft[K] extends string ? K : never;
    }[keyof Draft];
    const str = (k: StringDraftKey, field: keyof Shipment) => {
      if (draft[k] !== orig[k]) (patch as Record<string, unknown>)[field] = draft[k].trim() || null;
    };

    str("customer_name", "customer_name");
    str("customer_email", "customer_email");
    str("customer_phone", "customer_phone");
    str("destination_city", "destination_city");
    str("item_category", "item_category");
    str("vehicle_details", "vehicle_details");
    str("pickup_address", "pickup_address");
    str("delivery_address", "delivery_address");
    str("notes", "notes");

    if (draft.fragile !== orig.fragile) patch.fragile = draft.fragile;
    if (draft.fragile_note !== orig.fragile_note)
      patch.fragile_note = draft.fragile ? draft.fragile_note.trim() : "";
    if (draft.service_type !== orig.service_type) patch.service_type = draft.service_type;
    if (draft.destination_country !== orig.destination_country)
      patch.destination_country = draft.destination_country.trim();
    if (draft.shipping_line !== orig.shipping_line)
      patch.shipping_line = (draft.shipping_line || null) as ShippingLine | null;
    if (draft.weight !== orig.weight)
      patch.weight = draft.weight.trim() === "" ? undefined : Number(draft.weight);
    if (draft.declared_value !== orig.declared_value)
      patch.declared_value =
        draft.declared_value.trim() === "" ? undefined : Number(draft.declared_value);

    // Receiver is a nested object: send it whole when any part changed.
    if (
      draft.receiver_name !== orig.receiver_name ||
      draft.receiver_phone !== orig.receiver_phone ||
      draft.receiver_address !== orig.receiver_address
    ) {
      patch.receiver = {
        full_name: draft.receiver_name.trim(),
        phone: draft.receiver_phone.trim(),
        address: draft.receiver_address.trim() || undefined,
      };
    }

    const itemsChanged = JSON.stringify(items) !== JSON.stringify(shipment.items ?? []);
    if (itemsChanged) patch.items = items;
    if (effectiveTotal !== round2(shipment.total_price || 0)) patch.total_price = effectiveTotal;

    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }

    setSaving(true);
    try {
      await onSave(patch);
      onClose();
    } catch {
      setError("Could not save the changes. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => !saving && onClose()}
      title="Edit shipment"
      description="Correct the shipment record. Stage, payment, container and dispatcher are managed by their own controls on this page."
      size="xl"
    >
      <div className="space-y-5">
        {/* Customer */}
        <section className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Customer</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="e-cname" required>
                Name
              </Label>
              <Input
                id="e-cname"
                value={draft.customer_name}
                onChange={(e) => set("customer_name", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="e-cemail">Email</Label>
              <Input
                id="e-cemail"
                type="email"
                value={draft.customer_email}
                onChange={(e) => set("customer_email", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="e-cphone">Phone</Label>
              <Input
                id="e-cphone"
                value={draft.customer_phone}
                onChange={(e) => set("customer_phone", e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* Service & destination */}
        <section className="space-y-3 border-t border-border pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Service &amp; destination
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label htmlFor="e-service">Service</Label>
              <Select
                id="e-service"
                value={draft.service_type}
                onChange={(e) => set("service_type", e.target.value as ServiceType)}
              >
                <option value="sea">Sea Cargo</option>
                <option value="air">Air Freight</option>
                <option value="roro">RORO (vehicle)</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="e-country" required>
                Country
              </Label>
              <Select
                id="e-country"
                value={draft.destination_country}
                onChange={(e) => set("destination_country", e.target.value)}
              >
                {!DESTINATION_COUNTRIES.includes(draft.destination_country) &&
                  draft.destination_country && (
                    <option value={draft.destination_country}>{draft.destination_country}</option>
                  )}
                {DESTINATION_COUNTRIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="e-city">City</Label>
              <Input
                id="e-city"
                value={draft.destination_city}
                onChange={(e) => set("destination_city", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="e-line">Shipping line</Label>
              <Select
                id="e-line"
                value={draft.shipping_line}
                onChange={(e) => set("shipping_line", e.target.value)}
              >
                <option value="">Not set</option>
                <option value="grimaldi">Grimaldi</option>
                <option value="sallaum">Sallaum</option>
                <option value="msc">MSC</option>
              </Select>
            </div>
          </div>
          <FieldHint>
            Changing the destination country moves this shipment between destination-office
            portals.
          </FieldHint>
        </section>

        {/* Cargo */}
        <section className="space-y-3 border-t border-border pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Cargo</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label htmlFor="e-cat">Category</Label>
              <Input
                id="e-cat"
                value={draft.item_category}
                onChange={(e) => set("item_category", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="e-weight">Weight (lbs)</Label>
              <Input
                id="e-weight"
                type="number"
                min="0"
                step="0.01"
                value={draft.weight}
                onChange={(e) => set("weight", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="e-declared">Declared value</Label>
              <Input
                id="e-declared"
                type="number"
                min="0"
                step="0.01"
                value={draft.declared_value}
                onChange={(e) => set("declared_value", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="e-vehicle">Vehicle details</Label>
              <Input
                id="e-vehicle"
                value={draft.vehicle_details}
                onChange={(e) => set("vehicle_details", e.target.value)}
              />
            </div>
          </div>

          {/* Fragile flag, visible to the warehouse, office and rider. */}
          <div
            className={cn(
              "rounded-lg border-2 p-3 transition-colors",
              draft.fragile ? "border-amber-300 bg-amber-50" : "border-border"
            )}
          >
            <label className="flex cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                checked={draft.fragile}
                onChange={(e) => set("fragile", e.target.checked)}
                className="h-5 w-5 cursor-pointer accent-navy"
              />
              <span className="flex items-center gap-1.5 text-sm font-semibold text-navy">
                <AlertTriangle
                  className={cn("h-4 w-4", draft.fragile ? "text-amber-600" : "text-ink-muted")}
                />
                Fragile, handle with care
              </span>
            </label>
            {draft.fragile && (
              <div className="mt-2.5">
                <Label htmlFor="e-fragile-note">Handling note</Label>
                <Input
                  id="e-fragile-note"
                  value={draft.fragile_note}
                  onChange={(e) => set("fragile_note", e.target.value)}
                  placeholder="e.g. Glassware in box 2"
                  className="bg-white"
                />
              </div>
            )}
          </div>
        </section>

        {/* Line items */}
        <section className="space-y-3 border-t border-border pt-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Line items
            </p>
            <Button variant="outline" size="sm" onClick={addItem}>
              <Plus className="h-3.5 w-3.5" /> Add item
            </Button>
          </div>

          {items.length === 0 ? (
            <p className="text-sm text-ink-muted">
              No line items. The total below is entered directly.
            </p>
          ) : (
            <div className="space-y-2">
              {items.map((it, i) => (
                <div
                  key={i}
                  className={cn(
                    "grid gap-2 rounded-lg border p-2.5 sm:grid-cols-[1fr_110px_80px_90px_auto] sm:items-end",
                    // Highlight rows still awaiting a price so they are obvious
                    // among priced lines.
                    it.needs_quote && Number(it.unit_price) === 0
                      ? "border-amber-300 bg-amber-50/60"
                      : "border-border"
                  )}
                >
                  <div>
                    <Label htmlFor={`it-desc-${i}`}>
                      Description
                      {it.needs_quote && Number(it.unit_price) === 0 && (
                        <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                          needs quote
                        </span>
                      )}
                    </Label>
                    <Input
                      id={`it-desc-${i}`}
                      value={it.description}
                      onChange={(e) => updateItem(i, { description: e.target.value })}
                      placeholder="e.g. Large box"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`it-dim-${i}`}>Dimensions</Label>
                    <Input
                      id={`it-dim-${i}`}
                      value={it.dimensions ?? ""}
                      onChange={(e) => updateItem(i, { dimensions: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`it-qty-${i}`}>Qty</Label>
                    <Input
                      id={`it-qty-${i}`}
                      type="number"
                      min="0"
                      value={it.quantity}
                      onChange={(e) => updateItem(i, { quantity: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`it-unit-${i}`}>Unit price</Label>
                    <Input
                      id={`it-unit-${i}`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={it.unit_price}
                      onChange={(e) => updateItem(i, { unit_price: Number(e.target.value) })}
                    />
                  </div>
                  <div className="flex items-center gap-2 sm:pb-1.5">
                    <span className="min-w-[70px] font-mono text-xs font-semibold text-navy">
                      {formatCurrency(it.line_total, shipment.currency)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setItems((prev) => prev.filter((_, x) => x !== i))}
                      aria-label={`Remove item ${i + 1}`}
                      className="rounded-md p-2 text-ink-muted transition-colors hover:bg-red-50 hover:text-red-600 focus-ring"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg bg-secondary/50 p-3">
            {hasItems ? (
              <div>
                <p className="text-xs uppercase tracking-wide text-ink-muted">
                  Total (from line items)
                </p>
                <p className="font-mono text-lg font-bold text-navy">
                  {formatCurrency(itemsTotal, shipment.currency)}
                </p>
              </div>
            ) : (
              <div>
                <Label htmlFor="e-total">Total price</Label>
                <Input
                  id="e-total"
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.total_price}
                  onChange={(e) => set("total_price", e.target.value)}
                  className="font-mono"
                />
              </div>
            )}
            {effectiveTotal !== round2(shipment.total_price || 0) && (
              <p className="text-xs font-medium text-amber-600">
                Total changes from {formatCurrency(shipment.total_price, shipment.currency)} to{" "}
                {formatCurrency(effectiveTotal, shipment.currency)}. The outstanding balance is
                recalculated from the payment card.
              </p>
            )}
          </div>
        </section>

        {/* Addresses & receiver */}
        <section className="space-y-3 border-t border-border pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Addresses &amp; receiver
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="e-pickup">Pickup address</Label>
              <Textarea
                id="e-pickup"
                value={draft.pickup_address}
                onChange={(e) => set("pickup_address", e.target.value)}
                className="min-h-[60px]"
              />
            </div>
            <div>
              <Label htmlFor="e-delivery">Delivery address</Label>
              <Textarea
                id="e-delivery"
                value={draft.delivery_address}
                onChange={(e) => set("delivery_address", e.target.value)}
                className="min-h-[60px]"
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="e-rname">Receiver name</Label>
              <Input
                id="e-rname"
                value={draft.receiver_name}
                onChange={(e) => set("receiver_name", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="e-rphone">Receiver phone</Label>
              <Input
                id="e-rphone"
                value={draft.receiver_phone}
                onChange={(e) => set("receiver_phone", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="e-raddr">Receiver address</Label>
              <Input
                id="e-raddr"
                value={draft.receiver_address}
                onChange={(e) => set("receiver_address", e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="e-notes">Internal notes</Label>
            <Textarea
              id="e-notes"
              value={draft.notes}
              onChange={(e) => set("notes", e.target.value)}
              className="min-h-[60px]"
            />
          </div>
        </section>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        <div className="flex gap-2 border-t border-border pt-4">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="gold"
            className="flex-1"
            onClick={handleSave}
            loading={saving}
            disabled={saving}
          >
            <Save className="h-4 w-4" /> Save changes
          </Button>
        </div>
      </div>
    </Modal>
  );
}
