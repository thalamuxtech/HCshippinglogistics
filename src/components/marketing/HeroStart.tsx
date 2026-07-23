"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Ship, Plane, Truck, ArrowRight, Search, PackageSearch, MapPin } from "lucide-react";
import { publicTrack } from "@/lib/notify";
import { DESTINATION_COUNTRIES, STAGES, STAGE_MAP } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { ServiceType, Shipment } from "@/lib/types";

const SERVICES: { key: ServiceType; label: string; icon: React.ElementType }[] = [
  { key: "sea", label: "Sea Cargo", icon: Ship },
  { key: "air", label: "Air Freight", icon: Plane },
  { key: "roro", label: "RORO Vehicle", icon: Truck },
];

// Two modes: "send" (start a shipment) and "track" (check by customer ID / tracking #).
export function HeroStart() {
  const router = useRouter();
  const [mode, setMode] = React.useState<"send" | "track">("send");

  // ── send flow ──
  const [dest, setDest] = React.useState("Nigeria");
  const [service, setService] = React.useState<ServiceType>("sea");

  function startShipping() {
    const params = new URLSearchParams({ dest, service });
    router.push(`/signup?${params.toString()}`);
  }

  // ── track flow ──
  const [code, setCode] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<
    | Pick<
        Shipment,
        | "tracking_number"
        | "current_status"
        | "service_type"
        | "destination_country"
        | "payment_status"
      >
    | null
  >(null);
  const [notFound, setNotFound] = React.useState(false);

  async function track(e: React.FormEvent) {
    e.preventDefault();
    const c = code.trim();
    if (!c) return;
    setLoading(true);
    setNotFound(false);
    setResult(null);
    try {
      // Public lookup by tracking number OR customer ID (safe fields only).
      const d = await publicTrack(c);
      if (!d.found) {
        setNotFound(true);
      } else {
        setResult({
          tracking_number: d.tracking_number ?? "",
          current_status: (d.current_status ?? "collection") as Shipment["current_status"],
          service_type: (d.service_type ?? "sea") as Shipment["service_type"],
          destination_country: d.destination_country ?? "",
          payment_status: d.payment_status as Shipment["payment_status"],
        });
      }
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }

  const currentOrder = result ? STAGE_MAP[result.current_status]?.order ?? 0 : 0;

  return (
    <div className="rounded-2xl bg-white/10 p-1.5 ring-1 ring-white/15 backdrop-blur-md">
      {/* Mode switch */}
      <div className="flex gap-1 p-1">
        {(["send", "track"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={cn(
              "relative flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition-colors focus-ring",
              mode === m ? "text-navy" : "text-white/70 hover:text-white"
            )}
            aria-pressed={mode === m}
          >
            {mode === m && (
              <motion.span
                layoutId="hero-mode"
                className="absolute inset-0 rounded-xl bg-white shadow-card"
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
              />
            )}
            <span className="relative">{m === "send" ? "Send a package" : "Track my package"}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {mode === "send" ? (
          <motion.div
            key="send"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="p-4"
          >
            {/* Service pills */}
            <div className="grid grid-cols-3 gap-2">
              {SERVICES.map((s) => {
                const Icon = s.icon;
                const active = service === s.key;
                return (
                  <button
                    key={s.key}
                    onClick={() => setService(s.key)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-xs font-semibold transition-all focus-ring",
                      active
                        ? "border-gold bg-gold/15 text-white"
                        : "border-white/15 bg-white/5 text-white/70 hover:bg-white/10"
                    )}
                    aria-pressed={active}
                  >
                    <Icon className={cn("h-5 w-5", active ? "text-gold" : "text-white/70")} />
                    {s.label}
                  </button>
                );
              })}
            </div>

            {/* Destination + CTA */}
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <MapPin className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-white/50" />
                <select
                  value={dest}
                  onChange={(e) => setDest(e.target.value)}
                  aria-label="Destination country"
                  className="h-12 w-full cursor-pointer appearance-none rounded-xl border border-white/15 bg-white/5 pl-11 pr-9 text-sm font-medium text-white focus-ring"
                  style={{
                    backgroundImage:
                      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%23ffffff' stroke-opacity='0.6' stroke-width='2' viewBox='0 0 24 24'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "right 0.75rem center",
                  }}
                >
                  {DESTINATION_COUNTRIES.map((c) => (
                    <option key={c} value={c} className="text-navy">
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={startShipping}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gold-gradient px-6 text-sm font-bold text-navy shadow-gold transition hover:brightness-105 focus-ring"
              >
                Start shipping <ArrowRight className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 px-1 text-xs text-white/50">
              Instant pricing · door-to-door available · free account, ready in a minute
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="track"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="p-4"
          >
            <form onSubmit={track} className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-white/50" />
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Tracking number or Customer ID"
                  aria-label="Tracking number or Customer ID"
                  className="h-12 w-full rounded-xl border border-white/15 bg-white/5 pl-11 pr-3 font-mono text-sm text-white placeholder:text-white/40 focus-ring"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gold-gradient px-6 text-sm font-bold text-navy shadow-gold transition hover:brightness-105 focus-ring disabled:opacity-60"
              >
                {loading ? "Checking…" : "Check status"}
              </button>
            </form>

            {result && (
              <div className="mt-3 rounded-xl bg-navy-950/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-sm font-bold text-white">
                    {result.tracking_number}
                  </span>
                  <span
                    className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                    style={{
                      backgroundColor: `${STAGE_MAP[result.current_status].color}22`,
                      color: STAGE_MAP[result.current_status].color,
                    }}
                  >
                    {STAGE_MAP[result.current_status].label}
                  </span>
                </div>
                <div className="mt-3 flex gap-1">
                  {STAGES.map((s) => (
                    <div
                      key={s.key}
                      className="h-1.5 flex-1 rounded-full"
                      style={{
                        backgroundColor:
                          s.order <= currentOrder ? s.color : "rgba(255,255,255,0.15)",
                      }}
                      title={s.label}
                    />
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/60">
                  <span>
                    {result.service_type.toUpperCase()} · {result.destination_country} · Stage{" "}
                    {currentOrder} of 8
                  </span>
                  {result.payment_status && (
                    <span
                      className="rounded-full px-2 py-0.5 font-semibold"
                      style={{
                        backgroundColor:
                          result.payment_status === "paid"
                            ? "#16A34A33"
                            : result.payment_status === "partial"
                            ? "#D9770633"
                            : "#DC262633",
                        color:
                          result.payment_status === "paid"
                            ? "#4ADE80"
                            : result.payment_status === "partial"
                            ? "#FBBF24"
                            : "#FCA5A5",
                      }}
                    >
                      {result.payment_status === "paid"
                        ? "PAID"
                        : result.payment_status === "partial"
                        ? "PART-PAID"
                        : "UNPAID"}
                    </span>
                  )}
                </div>
                <a
                  href="/login"
                  className="mt-2 inline-flex text-xs font-semibold text-gold-200 hover:text-gold"
                >
                  Log in to view details &amp; download your receipt →
                </a>
              </div>
            )}

            {notFound && (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-navy-950/40 p-4 text-sm text-white/70">
                <PackageSearch className="h-5 w-5 shrink-0 text-gold" />
                No record found. Check the tracking number or Customer ID from your confirmation
                email.
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
