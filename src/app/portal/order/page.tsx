"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Ship,
  Plane,
  Truck,
  Plus,
  Minus,
  Trash2,
  Package,
  Info,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/ui/toast";
import {
  buildSeaQuote,
  buildAirQuote,
  buildRoroQuote,
  classifyVehicle,
  type SeaSelection,
} from "@/lib/pricing";
import {
  SEA_PRICE_LIST,
  PRICE_CATEGORIES,
  RORO_LINES,
  VEHICLE_CLASSES,
  DESTINATION_COUNTRIES,
  SERVICES,
} from "@/lib/constants";
import type {
  ServiceType,
  ShippingLine,
  VehicleClass,
  ShipmentItem,
} from "@/lib/types";
import {
  createShipment,
  nextCounter,
  logNotification,
  logActivity,
} from "@/lib/db";
import { sendStageUpdateEmail } from "@/lib/notify";
import { generateTrackingNumber, formatCurrency, cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select, Label, FieldHint } from "@/components/ui/input";
import { AnimatedNumber } from "@/components/ui/animated-number";

const SERVICE_TABS: { key: ServiceType; icon: typeof Ship }[] = [
  { key: "sea", icon: Ship },
  { key: "air", icon: Plane },
  { key: "roro", icon: Truck },
];

const ALL = "All";

export default function OrderPage() {
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const [service, setService] = React.useState<ServiceType>("sea");
  const [submitting, setSubmitting] = React.useState(false);

  // ---- Sea state: s_n -> quantity ----
  const [seaQty, setSeaQty] = React.useState<Record<number, number>>({});
  const [seaCategory, setSeaCategory] = React.useState<string>(ALL);

  // ---- Air state ----
  const [airWeight, setAirWeight] = React.useState<string>("");
  const [airL, setAirL] = React.useState<string>("");
  const [airW, setAirW] = React.useState<string>("");
  const [airH, setAirH] = React.useState<string>("");

  // ---- RORO state ----
  const [roroLine, setRoroLine] = React.useState<ShippingLine>("grimaldi");
  const [roroClass, setRoroClass] = React.useState<VehicleClass>("class_a");
  const [curbWeight, setCurbWeight] = React.useState<string>("");
  const [vehicleDetails, setVehicleDetails] = React.useState<string>("");
  const [useCurbWeight, setUseCurbWeight] = React.useState(false);

  // ---- Common fields ----
  const [destCountry, setDestCountry] = React.useState<string>(DESTINATION_COUNTRIES[0]);
  const [destCity, setDestCity] = React.useState<string>("");
  const [doorToDoor, setDoorToDoor] = React.useState(false);
  const [pickupAddress, setPickupAddress] = React.useState<string>("");
  const [notes, setNotes] = React.useState<string>("");
  const [declaredValue, setDeclaredValue] = React.useState<string>("");

  // ---- Receiver / consignee (for the receipt) ----
  const [rcvName, setRcvName] = React.useState<string>("");
  const [rcvPhone, setRcvPhone] = React.useState<string>("");
  const [rcvAddress, setRcvAddress] = React.useState<string>("");

  // ---- Prefill from re-order (sessionStorage) ----
  React.useEffect(() => {
    try {
      const raw = sessionStorage.getItem("hc_reorder");
      if (!raw) return;
      const data = JSON.parse(raw) as {
        service_type?: ServiceType;
        items?: ShipmentItem[];
        destination_country?: string;
        destination_city?: string;
        weight?: number;
        dimensions?: { length?: number; width?: number; height?: number };
        shipping_line?: ShippingLine;
        vehicle_class?: VehicleClass;
        vehicle_details?: string;
      };
      if (data.service_type) setService(data.service_type);
      if (data.destination_country) setDestCountry(data.destination_country);
      if (data.destination_city) setDestCity(data.destination_city);
      if (data.items?.length) {
        const q: Record<number, number> = {};
        for (const it of data.items) {
          const sn = Number(it.price_list_id);
          if (sn) q[sn] = (q[sn] ?? 0) + it.quantity;
        }
        setSeaQty(q);
      }
      if (data.weight) setAirWeight(String(data.weight));
      if (data.dimensions) {
        if (data.dimensions.length) setAirL(String(data.dimensions.length));
        if (data.dimensions.width) setAirW(String(data.dimensions.width));
        if (data.dimensions.height) setAirH(String(data.dimensions.height));
      }
      if (data.shipping_line) setRoroLine(data.shipping_line);
      if (data.vehicle_class) setRoroClass(data.vehicle_class);
      if (data.vehicle_details) setVehicleDetails(data.vehicle_details);
      sessionStorage.removeItem("hc_reorder");
      toast.info("Order details prefilled", "Review and adjust before submitting.");
    } catch {
      /* ignore malformed reorder payload */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Live quotes ----
  const seaSelections: SeaSelection[] = React.useMemo(
    () =>
      Object.entries(seaQty)
        .map(([sn, q]) => ({ s_n: Number(sn), quantity: q }))
        .filter((s) => s.quantity > 0),
    [seaQty]
  );
  const seaQuote = React.useMemo(() => buildSeaQuote(seaSelections), [seaSelections]);

  const airDims =
    airL && airW && airH
      ? { length: Number(airL), width: Number(airW), height: Number(airH) }
      : undefined;
  const airQuote = React.useMemo(
    () => buildAirQuote(Number(airWeight) || 0, airDims),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [airWeight, airL, airW, airH]
  );

  const effectiveClass: VehicleClass = useCurbWeight
    ? classifyVehicle(Number(curbWeight) || 0)
    : roroClass;
  const roroQuote = React.useMemo(
    () => buildRoroQuote(roroLine, effectiveClass),
    [roroLine, effectiveClass]
  );

  const grandTotal =
    service === "sea" ? seaQuote.total : service === "air" ? airQuote.total : roroQuote.total;

  // ---- Sea helpers ----
  const filteredSea =
    seaCategory === ALL
      ? SEA_PRICE_LIST
      : SEA_PRICE_LIST.filter((i) => i.category === seaCategory);

  function setQty(sn: number, next: number) {
    setSeaQty((cur) => {
      const copy = { ...cur };
      if (next <= 0) delete copy[sn];
      else copy[sn] = next;
      return copy;
    });
  }

  // ---- Validation ----
  function validate(): string | null {
    if (!destCountry) return "Please select a destination country.";
    if (!rcvName.trim()) return "Please enter the receiver's full name.";
    if (!rcvPhone.trim()) return "Please enter the receiver's phone number.";
    if (doorToDoor && !pickupAddress.trim())
      return "Pickup address is required for door-to-door service.";
    if (service === "sea" && seaSelections.length === 0)
      return "Add at least one item to your sea cargo order.";
    if (service === "air" && (Number(airWeight) || 0) <= 0)
      return "Enter the shipment weight for air freight.";
    if (service === "roro") {
      if (useCurbWeight && (Number(curbWeight) || 0) <= 0)
        return "Enter the vehicle curb weight.";
      if (!vehicleDetails.trim()) return "Enter the vehicle details (make, model, year).";
    }
    return null;
  }

  async function handleSubmit() {
    if (!user) return;
    const err = validate();
    if (err) {
      toast.error("Check your order", err);
      return;
    }
    setSubmitting(true);
    try {
      const serial = await nextCounter("shipment");
      const tracking = generateTrackingNumber(service, serial);

      const base = {
        tracking_number: tracking,
        customer_id: user.id,
        customer_name: user.full_name,
        customer_email: user.email,
        customer_phone: user.phone ?? "",
        service_type: service,
        current_status: "collection" as const,
        destination_country: destCountry,
        destination_city: destCity.trim() || undefined,
        door_to_door: doorToDoor,
        pickup_address: doorToDoor ? pickupAddress.trim() : undefined,
        notes: notes.trim() || undefined,
        declared_value: declaredValue ? Number(declaredValue) : undefined,
        total_price: grandTotal,
        currency: "USD",
        // Receiver / consignee for the receipt
        receiver: {
          full_name: rcvName.trim(),
          phone: rcvPhone.trim(),
          address: rcvAddress.trim() || undefined,
          city: destCity.trim() || undefined,
        },
        // Payment: new orders start unpaid; balance = full total
        payment_status: "unpaid" as const,
        deposit: 0,
        balance: grandTotal,
      };

      let payload: Record<string, unknown> = base;

      if (service === "sea") {
        payload = { ...base, items: seaQuote.items, item_category: "mixed" };
      } else if (service === "air") {
        payload = {
          ...base,
          weight: airQuote.actualWeight,
          dimensional_weight: airQuote.dimWeight,
          dimensions: airDims
            ? { length: airDims.length, width: airDims.width, height: airDims.height }
            : undefined,
        };
      } else {
        payload = {
          ...base,
          shipping_line: roroLine,
          vehicle_class: effectiveClass,
          vehicle_details: vehicleDetails.trim(),
          curb_weight: useCurbWeight ? Number(curbWeight) || undefined : undefined,
          // Class C is quoted later by admin — store 0 for now
          total_price: roroQuote.quoted ? 0 : grandTotal,
        };
      }

      const id = await createShipment(payload);

      // Notifications + activity (non-fatal)
      await sendStageUpdateEmail({
        shipmentId: id,
        customerId: user.id,
        status: "collection",
        extraNote: "Order received — thank you for shipping with Highclass.",
      });
      await logNotification({
        customer_id: user.id,
        shipment_id: id,
        channel: "email",
        type: "order_confirmation",
        subject: `Order confirmed — ${tracking}`,
        status: "sent",
      });
      await logActivity({
        actor_id: user.id,
        actor_name: user.full_name,
        actor_role: "customer",
        action: "shipment.created",
        target: id,
        meta: { tracking_number: tracking, service_type: service, total: grandTotal },
      });

      toast.success("Order submitted", `Tracking ${tracking} created.`);
      router.push(`/portal/shipments/detail?id=${id}`);
    } catch (e) {
      console.error(e);
      toast.error("Could not submit order", "Please try again in a moment.");
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow">New Order</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-navy sm:text-3xl">
          Build your shipment
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Choose a service, add your items, and watch your quote update in real time.
        </p>
      </div>

      {/* Service tabs */}
      <div
        role="tablist"
        aria-label="Service type"
        className="grid grid-cols-3 gap-3 rounded-2xl border border-border bg-white p-2 shadow-card sm:max-w-2xl"
      >
        {SERVICE_TABS.map(({ key, icon: Icon }) => {
          const selected = service === key;
          return (
            <button
              key={key}
              role="tab"
              aria-selected={selected}
              onClick={() => setService(key)}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-xl px-3 py-4 text-sm font-semibold transition-all cursor-pointer focus-ring",
                selected
                  ? "bg-navy text-white shadow-premium"
                  : "text-ink-muted hover:bg-navy/5 hover:text-navy"
              )}
            >
              <Icon className={cn("h-6 w-6", selected ? "text-gold" : "")} />
              {SERVICES[key].label}
            </button>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* ── Left: service-specific builder ── */}
        <div className="space-y-6">
          {service === "sea" && (
            <SeaBuilder
              category={seaCategory}
              setCategory={setSeaCategory}
              items={filteredSea}
              qty={seaQty}
              setQty={setQty}
            />
          )}

          {service === "air" && (
            <AirBuilder
              weight={airWeight}
              setWeight={setAirWeight}
              l={airL}
              w={airW}
              h={airH}
              setL={setAirL}
              setW={setAirW}
              setH={setAirH}
              quote={airQuote}
            />
          )}

          {service === "roro" && (
            <RoroBuilder
              line={roroLine}
              setLine={setRoroLine}
              vehicleClass={roroClass}
              setVehicleClass={setRoroClass}
              useCurbWeight={useCurbWeight}
              setUseCurbWeight={setUseCurbWeight}
              curbWeight={curbWeight}
              setCurbWeight={setCurbWeight}
              vehicleDetails={vehicleDetails}
              setVehicleDetails={setVehicleDetails}
              effectiveClass={effectiveClass}
            />
          )}

          {/* Common fields */}
          <Card>
            <CardHeader>
              <CardTitle>Destination &amp; details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <Label htmlFor="dest-country" required>
                    Destination country
                  </Label>
                  <Select
                    id="dest-country"
                    value={destCountry}
                    onChange={(e) => setDestCountry(e.target.value)}
                  >
                    {DESTINATION_COUNTRIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="dest-city">Destination city</Label>
                  <Input
                    id="dest-city"
                    value={destCity}
                    onChange={(e) => setDestCity(e.target.value)}
                    placeholder="e.g. Lagos"
                  />
                </div>
              </div>

              {/* Receiver / consignee */}
              <div className="rounded-xl border border-border bg-surface p-4">
                <p className="text-sm font-semibold text-navy">Receiver details</p>
                <p className="text-xs text-ink-muted">Who receives this shipment at the destination.</p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="rcv-name" required>
                      Receiver full name
                    </Label>
                    <Input
                      id="rcv-name"
                      value={rcvName}
                      onChange={(e) => setRcvName(e.target.value)}
                      placeholder="e.g. Hamida Umar"
                    />
                  </div>
                  <div>
                    <Label htmlFor="rcv-phone" required>
                      Receiver phone
                    </Label>
                    <Input
                      id="rcv-phone"
                      type="tel"
                      value={rcvPhone}
                      onChange={(e) => setRcvPhone(e.target.value)}
                      placeholder="e.g. 0706 645 0595"
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <Label htmlFor="rcv-address">Receiver address (optional)</Label>
                  <Textarea
                    id="rcv-address"
                    value={rcvAddress}
                    onChange={(e) => setRcvAddress(e.target.value)}
                    placeholder="Street, area, city"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-border bg-surface p-4">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={doorToDoor}
                    onChange={(e) => setDoorToDoor(e.target.checked)}
                    className="mt-0.5 h-5 w-5 cursor-pointer rounded border-input text-navy focus-ring"
                  />
                  <span>
                    <span className="text-sm font-semibold text-navy">
                      Door-to-door pickup
                    </span>
                    <span className="block text-xs text-ink-muted">
                      We collect from your address instead of warehouse drop-off.
                    </span>
                  </span>
                </label>
                {doorToDoor && (
                  <div className="mt-4">
                    <Label htmlFor="pickup" required>
                      Pickup address
                    </Label>
                    <Textarea
                      id="pickup"
                      value={pickupAddress}
                      onChange={(e) => setPickupAddress(e.target.value)}
                      placeholder="Street, city, state, ZIP"
                    />
                  </div>
                )}
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <Label htmlFor="declared">Declared value (USD)</Label>
                  <Input
                    id="declared"
                    type="number"
                    min={0}
                    value={declaredValue}
                    onChange={(e) => setDeclaredValue(e.target.value)}
                    placeholder="0.00"
                  />
                  <FieldHint>Used for insurance &amp; customs documentation.</FieldHint>
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Notes for our team</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Anything we should know about this shipment?"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Right: sticky summary ── */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <Card className="overflow-hidden">
            <div className="bg-navy-gradient px-6 py-5 text-white">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold-200">
                <Sparkles className="h-4 w-4" /> Live Quote
              </div>
              <div className="mt-2 flex items-end justify-between">
                <span className="text-sm text-white/70">{SERVICES[service].label}</span>
                <span className="font-mono text-3xl font-bold text-gold">
                  {service === "roro" && roroQuote.quoted ? (
                    "TBQ"
                  ) : (
                    <AnimatedNumber value={grandTotal} />
                  )}
                </span>
              </div>
            </div>
            <CardContent className="space-y-4 pt-5">
              {service === "sea" && (
                <SeaSummary quote={seaQuote} onRemove={(sn) => setQty(sn, 0)} />
              )}
              {service === "air" && <AirSummary quote={airQuote} />}
              {service === "roro" && (
                <RoroSummary
                  quote={roroQuote}
                  line={roroLine}
                  vehicleClass={effectiveClass}
                />
              )}

              <div className="flex items-center justify-between border-t border-border pt-4">
                <span className="text-sm font-semibold text-navy">Estimated total</span>
                <span className="font-mono text-lg font-bold text-navy">
                  {service === "roro" && roroQuote.quoted ? (
                    "Quoted separately"
                  ) : (
                    <AnimatedNumber value={grandTotal} />
                  )}
                </span>
              </div>

              <Button
                className="w-full"
                variant="gold"
                onClick={handleSubmit}
                loading={submitting}
              >
                Submit order <ArrowRight className="h-4 w-4" />
              </Button>
              <p className="text-center text-xs text-ink-muted">
                Prices are estimates. Final invoicing confirms weights &amp; dimensions.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── Sea ─────────────────────────── */

function SeaBuilder({
  category,
  setCategory,
  items,
  qty,
  setQty,
}: {
  category: string;
  setCategory: (c: string) => void;
  items: typeof SEA_PRICE_LIST;
  qty: Record<number, number>;
  setQty: (sn: number, next: number) => void;
}) {
  const chips = [ALL, ...PRICE_CATEGORIES];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Select sea cargo items</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap gap-2">
          {chips.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer focus-ring",
                category === c
                  ? "bg-navy text-white"
                  : "bg-secondary text-secondary-foreground hover:bg-navy/10"
              )}
            >
              {c}
            </button>
          ))}
        </div>

        <ul className="divide-y divide-border">
          {items.map((item) => {
            const q = qty[item.s_n] ?? 0;
            const selected = q > 0;
            return (
              <li
                key={item.s_n}
                className={cn(
                  "-mx-3 flex items-center justify-between gap-4 rounded-lg px-3 py-3 transition-colors",
                  selected && "bg-gold/5"
                )}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-navy">
                    {item.description}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {item.dimensions} · {item.category}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-mono text-sm font-semibold text-navy">
                    {formatCurrency(item.price)}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setQty(item.s_n, q - 1)}
                      disabled={q <= 0}
                      aria-label={`Remove one ${item.description}`}
                      className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-border text-navy transition-colors hover:bg-navy/5 focus-ring disabled:opacity-40"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <motion.span
                      key={q}
                      initial={{ scale: 0.6, opacity: 0.4 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 500, damping: 22 }}
                      className={cn(
                        "w-8 text-center font-mono text-sm font-bold",
                        selected ? "text-gold-700" : "text-navy"
                      )}
                    >
                      {q}
                    </motion.span>
                    <button
                      onClick={() => setQty(item.s_n, q + 1)}
                      aria-label={`Add one ${item.description}`}
                      className={cn(
                        "inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border transition-colors focus-ring",
                        selected
                          ? "border-gold bg-gold/15 text-gold-700 hover:bg-gold/25"
                          : "border-border text-navy hover:bg-navy/5"
                      )}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

function SeaSummary({
  quote,
  onRemove,
}: {
  quote: ReturnType<typeof buildSeaQuote>;
  onRemove: (sn: number) => void;
}) {
  if (quote.items.length === 0) {
    return (
      <p className="rounded-lg bg-surface px-4 py-6 text-center text-sm text-ink-muted">
        No items selected yet. Add items from the list to build your quote.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
        {quote.itemCount} item{quote.itemCount !== 1 ? "s" : ""}
      </p>
      <ul className="space-y-2">
        <AnimatePresence initial={false}>
          {quote.items.map((it) => (
            <motion.li
              key={it.price_list_id}
              layout
              initial={{ opacity: 0, height: 0, x: -8 }}
              animate={{ opacity: 1, height: "auto", x: 0 }}
              exit={{ opacity: 0, height: 0, x: 8 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-center justify-between gap-2 overflow-hidden text-sm"
            >
              <span className="flex items-center gap-2">
                <button
                  onClick={() => onRemove(Number(it.price_list_id))}
                  aria-label={`Remove ${it.description}`}
                  className="cursor-pointer rounded text-ink-muted hover:text-destructive focus-ring"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                <span className="text-navy">
                  {it.quantity}× {it.description}
                </span>
              </span>
              <span className="font-mono font-semibold text-navy">
                {formatCurrency(it.line_total)}
              </span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}

/* ─────────────────────────── Air ─────────────────────────── */

function AirBuilder({
  weight,
  setWeight,
  l,
  w,
  h,
  setL,
  setW,
  setH,
  quote,
}: {
  weight: string;
  setWeight: (v: string) => void;
  l: string;
  w: string;
  h: string;
  setL: (v: string) => void;
  setW: (v: string) => void;
  setH: (v: string) => void;
  quote: ReturnType<typeof buildAirQuote>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Air freight details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <Label htmlFor="air-weight" required>
            Actual weight (lbs)
          </Label>
          <Input
            id="air-weight"
            type="number"
            min={0}
            step="0.1"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="e.g. 25"
          />
        </div>

        <div>
          <Label>Dimensions (inches, optional)</Label>
          <div className="grid grid-cols-3 gap-3">
            <Input
              aria-label="Length"
              type="number"
              min={0}
              value={l}
              onChange={(e) => setL(e.target.value)}
              placeholder="L"
            />
            <Input
              aria-label="Width"
              type="number"
              min={0}
              value={w}
              onChange={(e) => setW(e.target.value)}
              placeholder="W"
            />
            <Input
              aria-label="Height"
              type="number"
              min={0}
              value={h}
              onChange={(e) => setH(e.target.value)}
              placeholder="H"
            />
          </div>
          <FieldHint>
            We bill the greater of actual and dimensional weight (L×W×H ÷ 166).
          </FieldHint>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <WeightStat label="Actual" value={`${quote.actualWeight} lb`} />
          <WeightStat label="Dimensional" value={`${quote.dimWeight} lb`} />
          <WeightStat label="Billable" value={`${quote.billableWeight} lb`} highlight />
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-surface px-3 py-2 text-xs text-ink-muted">
          <Info className="h-3.5 w-3.5 shrink-0" />
          Rate: {formatCurrency(quote.ratePerLb)} / lb billable weight.
        </div>
      </CardContent>
    </Card>
  );
}

function WeightStat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3 text-center",
        highlight ? "border-gold/40 bg-gold/10" : "border-border bg-white"
      )}
    >
      <p className="text-[11px] font-medium uppercase tracking-wider text-ink-muted">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 font-mono text-sm font-bold",
          highlight ? "text-gold-700" : "text-navy"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function AirSummary({ quote }: { quote: ReturnType<typeof buildAirQuote> }) {
  return (
    <ul className="space-y-2 text-sm">
      <Row label="Actual weight" value={`${quote.actualWeight} lb`} />
      <Row label="Dimensional weight" value={`${quote.dimWeight} lb`} />
      <Row label="Billable weight" value={`${quote.billableWeight} lb`} bold />
      <Row label="Rate" value={`${formatCurrency(quote.ratePerLb)}/lb`} />
    </ul>
  );
}

/* ─────────────────────────── RORO ─────────────────────────── */

function RoroBuilder({
  line,
  setLine,
  vehicleClass,
  setVehicleClass,
  useCurbWeight,
  setUseCurbWeight,
  curbWeight,
  setCurbWeight,
  vehicleDetails,
  setVehicleDetails,
  effectiveClass,
}: {
  line: ShippingLine;
  setLine: (v: ShippingLine) => void;
  vehicleClass: VehicleClass;
  setVehicleClass: (v: VehicleClass) => void;
  useCurbWeight: boolean;
  setUseCurbWeight: (v: boolean) => void;
  curbWeight: string;
  setCurbWeight: (v: string) => void;
  vehicleDetails: string;
  setVehicleDetails: (v: string) => void;
  effectiveClass: VehicleClass;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>RORO vehicle details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <Label htmlFor="roro-line" required>
            Shipping line
          </Label>
          <Select
            id="roro-line"
            value={line}
            onChange={(e) => setLine(e.target.value as ShippingLine)}
          >
            {(Object.keys(RORO_LINES) as ShippingLine[]).map((k) => (
              <option key={k} value={k}>
                {RORO_LINES[k].label}
              </option>
            ))}
          </Select>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4">
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={useCurbWeight}
              onChange={(e) => setUseCurbWeight(e.target.checked)}
              className="h-5 w-5 cursor-pointer rounded border-input text-navy focus-ring"
            />
            <span className="text-sm font-semibold text-navy">
              Auto-classify from curb weight
            </span>
          </label>

          {useCurbWeight ? (
            <div className="mt-4">
              <Label htmlFor="curb" required>
                Curb weight (lbs)
              </Label>
              <Input
                id="curb"
                type="number"
                min={0}
                value={curbWeight}
                onChange={(e) => setCurbWeight(e.target.value)}
                placeholder="e.g. 3800"
              />
              <FieldHint>
                Detected class:{" "}
                <span className="font-semibold text-navy">
                  {VEHICLE_CLASSES[effectiveClass].label}
                </span>
              </FieldHint>
            </div>
          ) : (
            <div className="mt-4">
              <Label htmlFor="roro-class" required>
                Vehicle class
              </Label>
              <Select
                id="roro-class"
                value={vehicleClass}
                onChange={(e) => setVehicleClass(e.target.value as VehicleClass)}
              >
                {(Object.keys(VEHICLE_CLASSES) as VehicleClass[]).map((k) => (
                  <option key={k} value={k}>
                    {VEHICLE_CLASSES[k].label}
                  </option>
                ))}
              </Select>
              <FieldHint>{VEHICLE_CLASSES[vehicleClass].basis}</FieldHint>
            </div>
          )}
        </div>

        <div>
          <Label htmlFor="vehicle-details" required>
            Vehicle details
          </Label>
          <Textarea
            id="vehicle-details"
            value={vehicleDetails}
            onChange={(e) => setVehicleDetails(e.target.value)}
            placeholder="Make, model, year, VIN, condition"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function RoroSummary({
  quote,
  line,
  vehicleClass,
}: {
  quote: ReturnType<typeof buildRoroQuote>;
  line: ShippingLine;
  vehicleClass: VehicleClass;
}) {
  return (
    <ul className="space-y-2 text-sm">
      <Row label="Shipping line" value={RORO_LINES[line].label} />
      <Row label="Vehicle class" value={VEHICLE_CLASSES[vehicleClass].label} />
      {quote.quoted ? (
        <li className="flex items-start gap-2 rounded-lg bg-gold/10 px-3 py-2 text-xs text-gold-700">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {quote.label}. Our team will confirm your quote after review.
        </li>
      ) : (
        <Row label="Line rate" value={formatCurrency(quote.total)} bold />
      )}
    </ul>
  );
}

/* ─────────────────────────── shared ─────────────────────────── */

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-2">
      <span className="text-ink-muted">{label}</span>
      <span className={cn("font-mono text-navy", bold ? "font-bold" : "font-medium")}>
        {value}
      </span>
    </li>
  );
}
