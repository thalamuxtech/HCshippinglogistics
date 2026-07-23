import type { Metadata } from "next";
import {
  Ship,
  Clock,
  Home,
  Boxes,
  ShieldCheck,
  ArrowRight,
  PackageCheck,
  Anchor,
} from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Reveal } from "@/components/marketing/Reveal";
import { SEA_PRICE_LIST, SERVICES } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Sea Cargo: Containerized Ocean Freight to Africa",
  description:
    "Containerized ocean freight from the USA to Nigeria and across Africa. Door-to-door pickup, transparent per-item pricing on boxes, barrels, bags, and furniture.",
};

const highlights = [
  {
    icon: Boxes,
    title: "Containerized ocean freight",
    desc: "Boxes, barrels, bags, totes, TVs, and full furniture sets, consolidated into secure shared containers for the best per-item rates.",
  },
  {
    icon: Home,
    title: "Door-to-door pickup",
    desc: "We collect from your home or business anywhere in the USA, inspect and receipt at our warehouse, then handle everything to the destination port.",
  },
  {
    icon: Clock,
    title: "Predictable lead times",
    desc: "Typical transit runs 21 to 30 business weeks after departure, with an automated stage update at every step so you always know where your cargo is.",
  },
  {
    icon: ShieldCheck,
    title: "Documented & receipted",
    desc: "Every item is weighed, dimensioned, photographed, and issued a formal digital receipt, giving you a full audit trail.",
  },
];

const process = [
  { step: "01", title: "Book & schedule", desc: "Start your order and request a pickup or drop off at our USA warehouse." },
  { step: "02", title: "Inspect & receipt", desc: "We weigh, measure, and document each piece, then issue a digital receipt." },
  { step: "03", title: "Load & sail", desc: "Your cargo is consolidated, loaded, and sails to the destination port." },
  { step: "04", title: "Clear & deliver", desc: "We manage destination customs clearance and last-mile delivery or pickup." },
];

export default function SeaCargoPage() {
  const meta = SERVICES.sea;
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-navy-gradient text-white">
        <div className="pointer-events-none absolute inset-0 bg-hero-radial" />
        <div className="container-page relative py-20 sm:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <Reveal>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-gold-200 ring-1 ring-white/15 backdrop-blur">
                <Ship className="h-4 w-4" /> Sea Cargo
              </span>
            </Reveal>
            <Reveal delay={0.08}>
              <h1 className="mt-6 text-balance text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl">
                Containerized ocean freight,
                <span className="mt-2 block bg-gold-gradient bg-clip-text text-transparent">
                  priced by the piece.
                </span>
              </h1>
            </Reveal>
            <Reveal delay={0.16}>
              <p className="mx-auto mt-6 max-w-2xl text-balance text-lg leading-relaxed text-white/75">
                {meta.tagline} Door-to-door pickup across the USA, transparent per-item pricing, and
                tracking all the way to Nigeria and across Africa.
              </p>
            </Reveal>
            <Reveal delay={0.22}>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <ButtonLink href="/order" variant="gold" size="lg">
                  Start a sea shipment <ArrowRight className="h-4 w-4" />
                </ButtonLink>
                <ButtonLink
                  href="/pricing"
                  size="lg"
                  className="border border-white/20 bg-white/5 text-white hover:bg-white/10"
                >
                  View full price list
                </ButtonLink>
              </div>
            </Reveal>
            <Reveal delay={0.28}>
              <div className="mt-8 inline-flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-sm text-white/70 ring-1 ring-white/10">
                <Clock className="h-4 w-4 text-gold" /> {meta.leadTime}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Highlights */}
      <section className="container-page py-20 sm:py-24">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="eyebrow">Why ship by sea</span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">
            The most economical way to move volume
          </h2>
          <p className="mt-4 text-ink-muted">
            When timing is flexible and volume is high, sea cargo gives you the lowest cost per
            pound, and you still get full tracking and documentation.
          </p>
        </Reveal>
        <div className="mt-14 grid gap-6 sm:grid-cols-2">
          {highlights.map((h, i) => {
            const Icon = h.icon;
            return (
              <Reveal key={h.title} delay={i * 0.06}>
                <Card className="flex h-full items-start gap-4 p-6">
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-navy/5 text-navy">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="font-bold text-navy">{h.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{h.desc}</p>
                  </div>
                </Card>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* Process */}
      <section className="bg-white py-20 sm:py-24">
        <div className="container-page">
          <Reveal className="mx-auto max-w-2xl text-center">
            <span className="eyebrow">How it works</span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">
              From your door to their door
            </h2>
          </Reveal>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {process.map((p, i) => (
              <Reveal key={p.step} delay={i * 0.06}>
                <Card className="h-full p-6">
                  <span className="font-mono text-2xl font-bold text-gold">{p.step}</span>
                  <h3 className="mt-3 font-bold text-navy">{p.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{p.desc}</p>
                </Card>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Price table */}
      <section className="container-page py-20 sm:py-24">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="eyebrow">Transparent pricing</span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">
            Sea Cargo price list
          </h2>
          <p className="mt-4 text-ink-muted">
            All 28 standard items, priced per piece. Rates effective January 1, 2024. Oversized or
            custom items are quoted individually.
          </p>
        </Reveal>

        <Reveal delay={0.1}>
          <Card className="mt-12 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface text-left">
                    <th className="px-5 py-3.5 font-mono text-xs font-semibold uppercase tracking-wider text-ink-muted">
                      S/N
                    </th>
                    <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                      Description
                    </th>
                    <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                      Category
                    </th>
                    <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                      Dimensions
                    </th>
                    <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-ink-muted">
                      Price
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {SEA_PRICE_LIST.map((item) => (
                    <tr
                      key={item.s_n}
                      className="border-b border-border/60 transition-colors last:border-0 hover:bg-surface/60"
                    >
                      <td className="px-5 py-3.5 font-mono text-ink-muted">
                        {String(item.s_n).padStart(2, "0")}
                      </td>
                      <td className="px-5 py-3.5 font-medium text-navy">{item.description}</td>
                      <td className="px-5 py-3.5">
                        <Badge variant="muted">{item.category}</Badge>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-ink-muted">
                        {item.dimensions}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono font-semibold text-navy">
                        {formatCurrency(item.price)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </Reveal>

        <Reveal delay={0.14}>
          <p className="mt-4 flex items-center justify-center gap-2 text-center text-xs text-ink-muted">
            <Anchor className="h-3.5 w-3.5" /> Prices cover ocean freight and handling. Destination
            customs and last-mile delivery may vary by country.
          </p>
        </Reveal>
      </section>

      {/* CTA */}
      <section className="container-page pb-8">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-navy-gradient px-8 py-14 text-center text-white sm:px-16 sm:py-16">
            <div className="pointer-events-none absolute inset-0 bg-hero-radial" />
            <div className="relative mx-auto max-w-2xl">
              <PackageCheck className="mx-auto h-10 w-10 text-gold" />
              <h2 className="mt-5 text-3xl font-extrabold tracking-tight sm:text-4xl">
                Ready to ship by sea?
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-white/75">
                Start your order to request a pickup, get a digital receipt, and track your
                container every step of the way.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <ButtonLink href="/order" variant="gold" size="lg">
                  Get started <ArrowRight className="h-4 w-4" />
                </ButtonLink>
                <ButtonLink
                  href="/pricing"
                  size="lg"
                  className="border border-white/20 bg-white/5 text-white hover:bg-white/10"
                >
                  Compare all pricing
                </ButtonLink>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
