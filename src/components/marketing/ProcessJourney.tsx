"use client";

import * as React from "react";
import { motion, useInView } from "framer-motion";
import { cn } from "@/lib/utils";
import type { ServiceType } from "@/lib/types";

// ─────────────────────────────────────────────────────────────
// Premium animated "How it works" journey — bespoke SVG per step,
// a connecting path that draws in on scroll, and Sea/Air/RORO tabs.
// (Original, on-brand equivalent of the sample site's process section.)
// ─────────────────────────────────────────────────────────────

type Step = {
  title: string;
  desc: string;
  Illo: React.FC<{ className?: string }>;
};

const easeOut = [0.22, 1, 0.36, 1] as const;

// ── Bespoke line-art illustrations (navy stroke, gold accents) ──
const Ill = {
  Pickup: ({ className }: { className?: string }) => (
    <svg viewBox="0 0 96 96" className={className} fill="none" aria-hidden>
      <rect x="10" y="40" width="46" height="34" rx="4" stroke="currentColor" strokeWidth="3.5" />
      <path d="M56 52h16l10 12v10H56z" stroke="currentColor" strokeWidth="3.5" strokeLinejoin="round" />
      <circle cx="26" cy="78" r="7" fill="#fff" stroke="currentColor" strokeWidth="3.5" />
      <circle cx="68" cy="78" r="7" fill="#fff" stroke="currentColor" strokeWidth="3.5" />
      <path d="M20 30l8-8 8 8" stroke="#D4A017" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M28 22v18" stroke="#D4A017" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  ),
  Warehouse: ({ className }: { className?: string }) => (
    <svg viewBox="0 0 96 96" className={className} fill="none" aria-hidden>
      <path d="M14 44 48 24l34 20v30H14z" stroke="currentColor" strokeWidth="3.5" strokeLinejoin="round" />
      <rect x="30" y="54" width="16" height="20" stroke="currentColor" strokeWidth="3.5" />
      <rect x="54" y="54" width="12" height="10" stroke="#D4A017" strokeWidth="3.5" />
      <path d="M22 44h52" stroke="currentColor" strokeWidth="3.5" />
    </svg>
  ),
  Sea: ({ className }: { className?: string }) => (
    <svg viewBox="0 0 96 96" className={className} fill="none" aria-hidden>
      <path d="M16 58h58l-8 16H24z" stroke="currentColor" strokeWidth="3.5" strokeLinejoin="round" />
      <rect x="30" y="42" width="12" height="16" stroke="#D4A017" strokeWidth="3.5" />
      <rect x="44" y="46" width="12" height="12" stroke="currentColor" strokeWidth="3.5" />
      <path d="M10 80c6 0 6 4 12 4s6-4 12-4 6 4 12 4 6-4 12-4 6 4 12 4 6-4 12-4" stroke="#D4A017" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  ),
  Air: ({ className }: { className?: string }) => (
    <svg viewBox="0 0 96 96" className={className} fill="none" aria-hidden>
      <path d="M18 54l60-20-8 16 8 8-14 4-8 12-6-16-32-4z" stroke="currentColor" strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M20 70c8-2 16-2 24 0" stroke="#D4A017" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  ),
  Roro: ({ className }: { className?: string }) => (
    <svg viewBox="0 0 96 96" className={className} fill="none" aria-hidden>
      <path d="M14 62h44V46h14l8 10v6" stroke="currentColor" strokeWidth="3.5" strokeLinejoin="round" />
      <circle cx="30" cy="66" r="6" fill="#fff" stroke="currentColor" strokeWidth="3.5" />
      <circle cx="64" cy="66" r="6" fill="#fff" stroke="currentColor" strokeWidth="3.5" />
      <path d="M12 78h72" stroke="#D4A017" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  ),
  Customs: ({ className }: { className?: string }) => (
    <svg viewBox="0 0 96 96" className={className} fill="none" aria-hidden>
      <path d="M48 16l26 10v18c0 18-12 28-26 34-14-6-26-16-26-34V26z" stroke="currentColor" strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M38 48l7 8 14-16" stroke="#D4A017" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Delivery: ({ className }: { className?: string }) => (
    <svg viewBox="0 0 96 96" className={className} fill="none" aria-hidden>
      <rect x="16" y="34" width="40" height="30" rx="3" stroke="currentColor" strokeWidth="3.5" />
      <path d="M56 44h14l10 10v10H56z" stroke="currentColor" strokeWidth="3.5" strokeLinejoin="round" />
      <circle cx="30" cy="68" r="7" fill="#fff" stroke="currentColor" strokeWidth="3.5" />
      <circle cx="68" cy="68" r="7" fill="#fff" stroke="currentColor" strokeWidth="3.5" />
      <path d="M40 22l4 6 8-10" stroke="#D4A017" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

const COMMON_START: Step[] = [
  { title: "Book online", desc: "Pick your destination and items, get an instant price, and schedule a pickup or drop-off.", Illo: Ill.Pickup },
  { title: "USA warehouse", desc: "We inspect, weigh, dimension, and issue a digital receipt at our US facility.", Illo: Ill.Warehouse },
];
const COMMON_END: Step[] = [
  { title: "Customs cleared", desc: "We clear your shipment through destination customs and log every step.", Illo: Ill.Customs },
  { title: "Delivered", desc: "Last-mile delivery to your recipient — or ready for pickup, with proof of delivery.", Illo: Ill.Delivery },
];

const MIDDLE: Record<ServiceType, Step> = {
  sea: { title: "Ocean freight", desc: "Consolidated into containers and shipped by vessel across the Atlantic.", Illo: Ill.Sea },
  air: { title: "Air freight", desc: "Loaded onto the next available flight for expedited 7–10 day delivery.", Illo: Ill.Air },
  roro: { title: "RORO vessel", desc: "Your vehicle is driven aboard and shipped roll-on / roll-off to port.", Illo: Ill.Roro },
};

const TABS: { key: ServiceType; label: string }[] = [
  { key: "sea", label: "Sea Cargo" },
  { key: "air", label: "Air Freight" },
  { key: "roro", label: "RORO" },
];

export function ProcessJourney() {
  const [service, setService] = React.useState<ServiceType>("sea");
  const steps = [...COMMON_START, MIDDLE[service], ...COMMON_END];
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section className="bg-white py-20 sm:py-28">
      <div className="container-page">
        <div className="mx-auto max-w-2xl text-center">
          <span className="eyebrow">How It Works</span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">
            Effortless shipping with Highclass
          </h2>
          <p className="mt-4 text-ink-muted">
            From your door in the USA to your recipient in Africa — one seamless, tracked journey.
          </p>
        </div>

        {/* Service tabs */}
        <div className="mt-8 flex justify-center">
          <div
            className="inline-flex rounded-full bg-secondary p-1"
            role="tablist"
            aria-label="Service type"
          >
            {TABS.map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={service === t.key}
                onClick={() => setService(t.key)}
                className={cn(
                  "relative rounded-full px-5 py-2 text-sm font-semibold transition-colors focus-ring",
                  service === t.key ? "text-navy" : "text-ink-muted hover:text-navy"
                )}
              >
                {service === t.key && (
                  <motion.span
                    layoutId="journey-tab"
                    className="absolute inset-0 rounded-full bg-white shadow-card"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <span className="relative">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Journey */}
        <div ref={ref} className="relative mt-16">
          {/* Connecting line (desktop) that draws in on scroll */}
          <svg
            className="pointer-events-none absolute left-0 right-0 top-[52px] hidden h-2 w-full lg:block"
            preserveAspectRatio="none"
            viewBox="0 0 1000 8"
            aria-hidden
          >
            <motion.line
              x1="60"
              y1="4"
              x2="940"
              y2="4"
              stroke="#D4A017"
              strokeWidth="2.5"
              strokeDasharray="2 8"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={inView ? { pathLength: 1 } : {}}
              transition={{ duration: 1.4, ease: "easeInOut" }}
            />
          </svg>

          <ol className="grid grid-cols-1 gap-y-12 sm:grid-cols-2 lg:grid-cols-5 lg:gap-x-4">
            {steps.map((step, i) => {
              const Illo = step.Illo;
              return (
                <motion.li
                  key={`${service}-${i}`}
                  className="relative flex flex-col items-center text-center"
                  initial={{ opacity: 0, y: 24 }}
                  animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.55, delay: i * 0.12, ease: easeOut }}
                >
                  {/* Number badge */}
                  <span className="absolute -top-3 right-1/2 z-10 translate-x-[46px] flex h-7 w-7 items-center justify-center rounded-full bg-navy text-xs font-bold text-gold shadow-premium">
                    {i + 1}
                  </span>
                  {/* Illustration disc */}
                  <div className="relative flex h-28 w-28 items-center justify-center rounded-2xl bg-surface text-navy shadow-card ring-1 ring-border">
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={inView ? { scale: 1, opacity: 1 } : {}}
                      transition={{ duration: 0.5, delay: i * 0.12 + 0.15, ease: easeOut }}
                    >
                      <Illo className="h-16 w-16" />
                    </motion.div>
                  </div>
                  <h3 className="mt-5 text-base font-bold text-navy">{step.title}</h3>
                  <p className="mt-1.5 max-w-[15rem] text-sm leading-relaxed text-ink-muted">
                    {step.desc}
                  </p>
                </motion.li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
