"use client";

import * as React from "react";
import { motion, useInView } from "framer-motion";
import { STAGES } from "@/lib/constants";
import type { ShipmentStatus } from "@/lib/types";

// ─────────────────────────────────────────────────────────────
// Animated 8-stage lifecycle band. Each stage has a small SVG glyph
// in its brand color, revealed in sequence on scroll, connected by a
// vertical/horizontal timeline. Replaces the flat text-only version.
// ─────────────────────────────────────────────────────────────

const easeOut = [0.22, 1, 0.36, 1] as const;

// One compact glyph per stage (24x24, stroke uses currentColor = stage color).
const GLYPHS: Record<ShipmentStatus, React.ReactNode> = {
  collection: (
    <>
      <path d="M4 8h9v8H4z" />
      <path d="M13 10h4l3 3v3h-7z" />
      <circle cx="8" cy="18" r="1.6" />
      <circle cx="17" cy="18" r="1.6" />
    </>
  ),
  inspection: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M15.5 15.5 20 20" />
    </>
  ),
  loading: (
    <>
      <path d="M4 16V7l7-3 7 3v9" />
      <path d="M4 16h16" />
      <path d="M11 4v12" />
    </>
  ),
  transit: (
    <>
      <path d="M3 15h13l4-4" />
      <path d="M6 15V9h6l3 3" />
      <path d="M2 19c2 0 2 1.5 4 1.5S9 19 11 19s2 1.5 4 1.5" />
    </>
  ),
  clearance: (
    <>
      <path d="M12 3l7 3v5c0 5-3 7.5-7 9-4-1.5-7-4-7-9V6z" />
      <path d="M9 11l2 2 4-4" />
    </>
  ),
  offloading: (
    <>
      <path d="M4 20V10l8-5 8 5v10" />
      <path d="M4 20h16" />
      <path d="M10 20v-5h4v5" />
    </>
  ),
  delivery: (
    <>
      <path d="M3 14V6h9v8" />
      <path d="M12 9h4l3 3v2h-7" />
      <circle cx="7" cy="17" r="1.8" />
      <circle cx="16" cy="17" r="1.8" />
    </>
  ),
  completed: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M8.5 12l2.5 2.5 4.5-5" />
    </>
  ),
};

export function StageJourney() {
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section className="bg-white py-20 sm:py-24">
      <div className="container-page">
        <div className="mx-auto max-w-2xl text-center">
          <span className="eyebrow">Live Tracking</span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">
            Follow your shipment through all 8 stages
          </h2>
          <p className="mt-4 text-ink-muted">
            From collection in the USA to delivery in Africa, you get an update at every step. Enter
            your Customer ID any time to see exactly where your items are.
          </p>
        </div>

        <div ref={ref} className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {STAGES.map((stage, i) => (
            <motion.div
              key={stage.key}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.45, delay: i * 0.09, ease: easeOut }}
              className="group relative flex flex-col items-center rounded-2xl border border-border bg-white p-5 text-center shadow-card transition-shadow hover:shadow-premium"
            >
              {/* number chip */}
              <span
                className="absolute right-3 top-3 font-mono text-xs font-bold"
                style={{ color: stage.color }}
              >
                {String(stage.order).padStart(2, "0")}
              </span>
              {/* glyph tile */}
              <motion.span
                className="flex h-14 w-14 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${stage.color}15`, color: stage.color }}
                initial={{ scale: 0.6 }}
                animate={inView ? { scale: 1 } : {}}
                transition={{ duration: 0.4, delay: i * 0.09 + 0.1, ease: easeOut }}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-7 w-7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  {GLYPHS[stage.key]}
                </svg>
              </motion.span>
              <p className="mt-4 text-sm font-bold text-navy">{stage.short}</p>
              <p className="mt-1 text-xs leading-snug text-ink-muted">{stage.side === "usa" ? "USA" : stage.side === "transit" ? "In transit" : "Destination"}</p>
              {/* progress dot bar */}
              <span
                className="mt-3 h-1 w-8 rounded-full"
                style={{ backgroundColor: stage.color }}
              />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
