import type { Metadata } from "next";
import { PackageSearch, MapPin } from "lucide-react";
import { Reveal } from "@/components/marketing/Reveal";
import { PublicTracker } from "@/components/marketing/PublicTracker";
import { STAGES } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Track Your Shipment — Highclass Shipping",
  description:
    "Track your Highclass Shipping cargo in real time. Enter your tracking number to see live status across all 8 stages, from USA collection to destination delivery.",
};

export default function TrackPage() {
  return (
    <>
      {/* Hero + tracker */}
      <section className="relative overflow-hidden bg-navy-gradient text-white">
        <div className="pointer-events-none absolute inset-0 bg-hero-radial" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "36px 36px",
          }}
        />
        <div className="container-page relative py-20 sm:py-28">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-gold-200 ring-1 ring-white/15 backdrop-blur">
                <PackageSearch className="h-4 w-4" /> Live Tracking
              </span>
            </Reveal>
            <Reveal delay={0.08}>
              <h1 className="mt-6 text-balance text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl">
                Where&apos;s my shipment?
              </h1>
            </Reveal>
            <Reveal delay={0.16}>
              <p className="mx-auto mt-5 max-w-xl text-balance text-lg leading-relaxed text-white/75">
                Enter your tracking number to see live status. No account required — just the code
                from your confirmation email.
              </p>
            </Reveal>
          </div>

          <Reveal delay={0.24}>
            <div className="mx-auto mt-12 max-w-xl">
              <PublicTracker variant="page" />
            </div>
          </Reveal>
        </div>
      </section>

      {/* Stage explanation */}
      <section className="container-page py-20 sm:py-24">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="eyebrow">The journey</span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">
            Understanding the 8 stages
          </h2>
          <p className="mt-4 text-ink-muted">
            Every shipment moves through eight tracked stages. You receive an automated email and
            SMS update at each transition — no guesswork.
          </p>
        </Reveal>

        <div className="mt-14 space-y-3">
          {STAGES.map((stage, i) => (
            <Reveal key={stage.key} delay={i * 0.04}>
              <div className="flex items-start gap-4 rounded-2xl border border-border bg-white p-5 shadow-card transition-shadow hover:shadow-premium">
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-mono text-sm font-bold text-white"
                  style={{ backgroundColor: stage.color }}
                >
                  {stage.order}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <h3 className="font-bold text-navy">{stage.label}</h3>
                    <span
                      className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                      style={{ backgroundColor: `${stage.color}18`, color: stage.color }}
                    >
                      {stage.colorName}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{stage.description}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.1}>
          <p className="mt-8 flex items-center justify-center gap-2 text-center text-xs text-ink-muted">
            <MapPin className="h-3.5 w-3.5" /> Stages 1–3 happen in the USA, stage 4 in transit, and
            stages 5–8 at the destination country.
          </p>
        </Reveal>
      </section>
    </>
  );
}
