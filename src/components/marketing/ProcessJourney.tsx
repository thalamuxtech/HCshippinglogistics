"use client";

import * as React from "react";
import { motion, useInView } from "framer-motion";
import { cn } from "@/lib/utils";
import type { ServiceType } from "@/lib/types";

// ─────────────────────────────────────────────────────────────
// "How it works" journey. Bespoke, geometrically clean line-art SVGs
// (64x64 viewBox, 3px round strokes, navy + gold accent), revealed on
// scroll with a drawing connector line, and Sea/Air/RORO tabs.
// ─────────────────────────────────────────────────────────────

type IconProps = { className?: string };
type Step = { title: string; desc: string; Icon: React.FC<IconProps> };

const easeOut = [0.22, 1, 0.36, 1] as const;
const S = { stroke: "currentColor", strokeWidth: 3, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
const G = { stroke: "#0A5BE0", strokeWidth: 3, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
// White-filled variants (fill AFTER spread so it wins over fill:"none")

// ── Illustrations (all 64x64, consistent weight & padding) ──
const IcBook: React.FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 64 64" className={className} aria-hidden>
    <rect x="14" y="10" width="30" height="40" rx="3" {...S} />
    <path d="M20 20h18M20 28h18M20 36h11" {...S} />
    <circle cx="44" cy="44" r="11" {...G} fill="#fff" />
    <path d="M39.5 44l3 3 6-6.5" {...G} />
  </svg>
);
const IcWarehouse: React.FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 64 64" className={className} aria-hidden>
    <path d="M10 28 32 14l22 14v24H10z" {...S} />
    <path d="M10 28h44" {...S} />
    <rect x="27" y="36" width="10" height="16" {...S} />
    <path d="M18 36h5M41 36h5" {...G} />
  </svg>
);
const IcSea: React.FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 64 64" className={className} aria-hidden>
    <path d="M12 40h34l-5 11H17z" {...S} />
    <rect x="20" y="30" width="9" height="10" {...G} />
    <rect x="31" y="33" width="9" height="7" {...S} />
    <path d="M8 55c4 0 4 3 8 3s4-3 8-3 4 3 8 3 4-3 8-3 4 3 8 3" {...G} />
  </svg>
);
const IcAir: React.FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 64 64" className={className} aria-hidden>
    <path d="M8 36 54 22l-6 10 6 6-9 3-5 8-4-11z" {...S} />
    <path d="M14 48c6-1.5 12-1.5 18 0" {...G} />
  </svg>
);
const IcRoro: React.FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 64 64" className={className} aria-hidden>
    <path d="M8 42h28V30h10l6 8v4" {...S} />
    <circle cx="20" cy="45" r="4.5" {...S} fill="#fff" />
    <circle cx="44" cy="45" r="4.5" {...S} fill="#fff" />
    <path d="M6 52h52" {...G} />
  </svg>
);
const IcCustoms: React.FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 64 64" className={className} aria-hidden>
    <path d="M32 8l18 7v13c0 12-8 19-18 24-10-5-18-12-18-24V15z" {...S} />
    <path d="M25 32l5 5 9-11" {...G} />
  </svg>
);
const IcDelivery: React.FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 64 64" className={className} aria-hidden>
    <rect x="10" y="24" width="26" height="18" rx="2" {...S} />
    <path d="M36 30h9l7 7v5H36z" {...S} />
    <circle cx="20" cy="45" r="4.5" {...S} fill="#fff" />
    <circle cx="44" cy="45" r="4.5" {...S} fill="#fff" />
    <path d="M16 18l3 4 6-7" {...G} />
  </svg>
);

const COMMON_START: Step[] = [
  { title: "Book online", desc: "Choose your destination and items, get your price, then drop off or request a pickup.", Icon: IcBook },
  { title: "USA warehouse", desc: "We weigh, measure, photograph, and issue your receipt at our Maryland facility.", Icon: IcWarehouse },
];
const COMMON_END: Step[] = [
  { title: "Customs cleared", desc: "We clear your shipment through customs in the destination country.", Icon: IcCustoms },
  { title: "Delivered", desc: "Doorstep delivery or ready for pickup, with proof of delivery.", Icon: IcDelivery },
];
const MIDDLE: Record<ServiceType, Step> = {
  sea: { title: "Ocean freight", desc: "Packed into a container and shipped by vessel across the Atlantic.", Icon: IcSea },
  air: { title: "Air freight", desc: "Flown on the next available flight for delivery in 7 to 10 days.", Icon: IcAir },
  roro: { title: "RORO vessel", desc: "Your vehicle is driven aboard and shipped by roll-on, roll-off vessel.", Icon: IcRoro },
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
            Shipping with Highclass, step by step
          </h2>
          <p className="mt-4 text-ink-muted">
            We pick up in the USA and deliver to your recipient in Africa. Follow every step online.
          </p>
        </div>

        {/* Service tabs */}
        <div className="mt-8 flex justify-center">
          <div className="inline-flex rounded-full bg-secondary p-1" role="tablist" aria-label="Service type">
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
        <div ref={ref} className="relative mt-14">
          {/* Connecting line (desktop) that draws in on scroll */}
          <svg
            className="pointer-events-none absolute left-0 right-0 top-10 hidden w-full lg:block"
            height="4"
            preserveAspectRatio="none"
            viewBox="0 0 1000 4"
            aria-hidden
          >
            <line x1="100" y1="2" x2="900" y2="2" stroke="#E2E8F0" strokeWidth="3" strokeLinecap="round" />
            <motion.line
              x1="100"
              y1="2"
              x2="900"
              y2="2"
              stroke="#0A5BE0"
              strokeWidth="3"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={inView ? { pathLength: 1 } : {}}
              transition={{ duration: 1.6, ease: "easeInOut" }}
            />
          </svg>

          <ol className="grid grid-cols-1 gap-y-10 sm:grid-cols-2 lg:grid-cols-5 lg:gap-x-4">
            {steps.map((step, i) => {
              const Icon = step.Icon;
              return (
                <motion.li
                  key={`${service}-${i}`}
                  className="relative flex flex-col items-center px-2 text-center"
                  initial={{ opacity: 0, y: 22 }}
                  animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.5, delay: i * 0.12, ease: easeOut }}
                >
                  {/* Illustration tile */}
                  <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-surface text-navy shadow-card ring-1 ring-border">
                    <motion.span
                      initial={{ scale: 0.7, opacity: 0 }}
                      animate={inView ? { scale: 1, opacity: 1 } : {}}
                      transition={{ duration: 0.45, delay: i * 0.12 + 0.15, ease: easeOut }}
                    >
                      <Icon className="h-11 w-11" />
                    </motion.span>
                    {/* Step number */}
                    <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-navy text-xs font-bold text-gold ring-4 ring-white">
                      {i + 1}
                    </span>
                  </div>
                  <h3 className="mt-5 text-base font-bold text-navy">{step.title}</h3>
                  <p className="mt-1.5 max-w-[16rem] text-sm leading-relaxed text-ink-muted">
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
