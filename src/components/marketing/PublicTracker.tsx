"use client";

import * as React from "react";
import { Search, PackageSearch } from "lucide-react";
import { collection, getDocs, query, where, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { STAGES, STAGE_MAP } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Shipment } from "@/lib/types";

// Public, no-auth tracker. Looks up a shipment by tracking number and
// shows ONLY non-sensitive stage info (no customer PII).
export function PublicTracker({ variant = "page" }: { variant?: "hero" | "page" }) {
  const [tn, setTn] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<Pick<
    Shipment,
    "tracking_number" | "current_status" | "service_type" | "destination_country"
  > | null>(null);
  const [notFound, setNotFound] = React.useState(false);

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const code = tn.trim().toUpperCase();
    if (!code) return;
    setLoading(true);
    setNotFound(false);
    setResult(null);
    try {
      const snap = await getDocs(
        query(collection(db, "shipments"), where("tracking_number", "==", code), limit(1))
      );
      if (snap.empty) {
        setNotFound(true);
      } else {
        const d = snap.docs[0].data() as Shipment;
        setResult({
          tracking_number: d.tracking_number,
          current_status: d.current_status,
          service_type: d.service_type,
          destination_country: d.destination_country,
        });
      }
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }

  const isHero = variant === "hero";
  const currentOrder = result ? STAGE_MAP[result.current_status]?.order ?? 0 : 0;

  return (
    <div
      className={cn(
        "rounded-2xl p-1.5",
        isHero ? "bg-white/10 ring-1 ring-white/15 backdrop-blur" : "bg-white shadow-card ring-1 ring-border"
      )}
    >
      <form onSubmit={onSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search
            className={cn(
              "pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2",
              isHero ? "text-white/50" : "text-ink-muted"
            )}
          />
          <input
            value={tn}
            onChange={(e) => setTn(e.target.value)}
            placeholder="Enter tracking number (e.g. HC-SEA-2026-01001)"
            aria-label="Tracking number"
            className={cn(
              "h-12 w-full rounded-xl border-0 bg-transparent pl-11 pr-3 font-mono text-sm focus-ring",
              isHero
                ? "text-white placeholder:text-white/70"
                : "text-navy placeholder:text-ink-muted/70"
            )}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gold-gradient px-5 text-sm font-semibold text-navy shadow-gold transition hover:brightness-105 focus-ring disabled:opacity-60"
        >
          {loading ? "Tracking…" : "Track"}
        </button>
      </form>

      {result && (
        <div className={cn("mt-2 rounded-xl p-4", isHero ? "bg-navy-950/40" : "bg-surface")}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className={cn("font-mono text-sm font-bold", isHero ? "text-white" : "text-navy")}>
              {result.tracking_number}
            </span>
            <span
              className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
              style={{
                backgroundColor: `${STAGE_MAP[result.current_status].color}22`,
                color: isHero ? STAGE_MAP[result.current_status].color : STAGE_MAP[result.current_status].color,
              }}
            >
              {STAGE_MAP[result.current_status].label}
            </span>
          </div>
          {/* progress bar */}
          <div className="mt-3 flex gap-1">
            {STAGES.map((s) => (
              <div
                key={s.key}
                className="h-1.5 flex-1 rounded-full transition-all"
                style={{
                  backgroundColor:
                    s.order <= currentOrder ? s.color : isHero ? "rgba(255,255,255,0.15)" : "#E2E8F0",
                }}
                title={s.label}
              />
            ))}
          </div>
          <p className={cn("mt-3 text-xs", isHero ? "text-white/60" : "text-ink-muted")}>
            {result.service_type.toUpperCase()} · Destination: {result.destination_country} · Stage{" "}
            {currentOrder} of 8
          </p>
        </div>
      )}

      {notFound && (
        <div
          className={cn(
            "mt-2 flex items-center gap-2 rounded-xl p-4 text-sm",
            isHero ? "bg-navy-950/40 text-white/70" : "bg-surface text-ink-muted"
          )}
        >
          <PackageSearch className="h-5 w-5 shrink-0 text-gold" />
          No shipment found for that tracking number. Double-check the code from your confirmation
          email.
        </div>
      )}
    </div>
  );
}
