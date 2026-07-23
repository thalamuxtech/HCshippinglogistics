import type { Metadata } from "next";
import { Plane, Clock, Zap, Scale, ShieldCheck, ArrowRight, Timer } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Reveal } from "@/components/marketing/Reveal";
import { AirCalculator } from "@/components/marketing/AirCalculator";
import { AIR_RATE_PER_LB, SERVICES } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Air Freight: Expedited Shipping to Africa at $5.50/lb",
  description:
    "Fast air freight from the USA to Nigeria and Africa in 7–10 business days at $5.50/lb. Instant online calculator with dimensional-weight pricing for time-sensitive cargo.",
};

const highlights = [
  {
    icon: Zap,
    title: "7–10 business days",
    desc: "The fastest way to move time-sensitive cargo. Documents, samples, electronics, and medical supplies arrive in days, not weeks.",
  },
  {
    icon: Scale,
    title: "Simple, flat rate",
    desc: `A single ${formatCurrency(AIR_RATE_PER_LB)} per pound on billable weight, with no fuel surcharges or hidden line items on the base freight.`,
  },
  {
    icon: ShieldCheck,
    title: "Inspected & documented",
    desc: "Every parcel is weighed, measured, and receipted at our USA warehouse with a full chain-of-custody record.",
  },
];

export default function AirFreightPage() {
  const meta = SERVICES.air;
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-navy-gradient text-white">
        <div className="pointer-events-none absolute inset-0 bg-hero-radial" />
        <div className="container-page relative py-20 sm:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <Reveal>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-gold-200 ring-1 ring-white/15 backdrop-blur">
                <Plane className="h-4 w-4" /> Air Freight
              </span>
            </Reveal>
            <Reveal delay={0.08}>
              <h1 className="mt-6 text-balance text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl">
                When it has to be there fast,
                <span className="mt-2 block bg-gold-gradient bg-clip-text text-transparent">
                  ship it by air.
                </span>
              </h1>
            </Reveal>
            <Reveal delay={0.16}>
              <p className="mx-auto mt-6 max-w-2xl text-balance text-lg leading-relaxed text-white/75">
                {meta.tagline} A flat {formatCurrency(AIR_RATE_PER_LB)}/lb, delivered to Nigeria and
                across Africa in {meta.leadTime}.
              </p>
            </Reveal>
            <Reveal delay={0.22}>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <ButtonLink href="/order" variant="gold" size="lg">
                  Start an air shipment <ArrowRight className="h-4 w-4" />
                </ButtonLink>
                <ButtonLink
                  href="#calculator"
                  size="lg"
                  className="border border-white/20 bg-white/5 text-white hover:bg-white/10"
                >
                  Estimate my cost
                </ButtonLink>
              </div>
            </Reveal>
            <Reveal delay={0.28}>
              <div className="mt-8 inline-flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-sm text-white/70 ring-1 ring-white/10">
                <Timer className="h-4 w-4 text-gold" /> {meta.leadTime}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Highlights */}
      <section className="container-page py-20 sm:py-24">
        <div className="grid gap-6 md:grid-cols-3">
          {highlights.map((h, i) => {
            const Icon = h.icon;
            return (
              <Reveal key={h.title} delay={i * 0.06}>
                <Card className="h-full p-6">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-navy text-gold-300 shadow-premium">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-5 font-bold text-navy">{h.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{h.desc}</p>
                </Card>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* Calculator */}
      <section id="calculator" className="scroll-mt-24 bg-white py-20 sm:py-24">
        <div className="container-page">
          <Reveal className="mx-auto max-w-2xl text-center">
            <span className="eyebrow">Instant estimate</span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">
              Air freight calculator
            </h2>
            <p className="mt-4 text-ink-muted">
              Enter your weight and dimensions to see actual weight, dimensional weight, and your
              billable cost live. Air freight is billed on whichever is greater.
            </p>
          </Reveal>
          <Reveal delay={0.1} className="mx-auto mt-12 max-w-4xl">
            <AirCalculator />
          </Reveal>
        </div>
      </section>

      {/* Explainer */}
      <section className="container-page py-20 sm:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <span className="eyebrow">How billing works</span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">
              Understanding dimensional weight
            </h2>
            <p className="mt-4 text-ink-muted">
              Aircraft are constrained by space as much as by weight. For light but bulky cargo,
              carriers bill on <strong className="text-navy">dimensional weight</strong>, a volume
              equivalent, instead of the scale reading.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-ink">
              <li className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-navy/5 font-mono text-xs font-bold text-navy">
                  1
                </span>
                We record your parcel&apos;s actual weight on the scale.
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-navy/5 font-mono text-xs font-bold text-navy">
                  2
                </span>
                We compute dimensional weight as (L × W × H) ÷ 166.
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-navy/5 font-mono text-xs font-bold text-navy">
                  3
                </span>
                You are billed on the greater of the two, at {formatCurrency(AIR_RATE_PER_LB)}/lb.
              </li>
            </ul>
          </Reveal>
          <Reveal delay={0.08}>
            <Card className="bg-surface p-8">
              <div className="flex items-center gap-2 text-navy">
                <Clock className="h-5 w-5 text-gold" />
                <span className="font-semibold">Good candidates for air</span>
              </div>
              <ul className="mt-4 space-y-2.5 text-sm text-ink-muted">
                {[
                  "Medical supplies & pharmaceuticals",
                  "Legal & business documents",
                  "Electronics and high-value goods",
                  "Product samples & prototypes",
                  "Anything with a hard deadline",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-gold" />
                    {item}
                  </li>
                ))}
              </ul>
            </Card>
          </Reveal>
        </div>
      </section>

      {/* CTA */}
      <section className="container-page pb-8">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-navy-gradient px-8 py-14 text-center text-white sm:px-16 sm:py-16">
            <div className="pointer-events-none absolute inset-0 bg-hero-radial" />
            <div className="relative mx-auto max-w-2xl">
              <Plane className="mx-auto h-10 w-10 text-gold" />
              <h2 className="mt-5 text-3xl font-extrabold tracking-tight sm:text-4xl">
                Need it there in days?
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-white/75">
                Start your air shipment today and get a digital receipt and
                real-time tracking included.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <ButtonLink href="/order" variant="gold" size="lg">
                  Ship by air <ArrowRight className="h-4 w-4" />
                </ButtonLink>
                <ButtonLink
                  href="/pricing"
                  size="lg"
                  className="border border-white/20 bg-white/5 text-white hover:bg-white/10"
                >
                  See all rates
                </ButtonLink>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
