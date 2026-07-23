import type { Metadata } from "next";
import {
  Truck,
  Anchor,
  FileText,
  IdCard,
  UserCheck,
  ArrowRight,
  Car,
} from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Reveal } from "@/components/marketing/Reveal";
import { RoroEstimator } from "@/components/marketing/RoroEstimator";
import { RORO_LINES, VEHICLE_CLASSES } from "@/lib/constants";
import type { ShippingLine, VehicleClass } from "@/lib/types";

export const metadata: Metadata = {
  title: "RORO Vehicle Shipping: Cars & SUVs to Africa",
  description:
    "Roll-on, roll-off vehicle shipping from the USA to African ports via Grimaldi, Sallaum, and MSC. Class-based rates plus a live curb-weight estimator.",
};

const lineKeys = Object.keys(RORO_LINES) as ShippingLine[];
const classKeys = Object.keys(VEHICLE_CLASSES) as VehicleClass[];

const documents = [
  {
    icon: FileText,
    title: "Vehicle Title",
    desc: "Original certificate of title (front and back) establishing ownership and clear for export.",
  },
  {
    icon: IdCard,
    title: "US Exporter ID",
    desc: "Your EIN or SSN used to file the electronic export information (EEI) through AES.",
  },
  {
    icon: UserCheck,
    title: "Consignee details",
    desc: "Full name, address, and contact for the receiving party at the destination port.",
  },
];

export default function RoroPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-navy-gradient text-white">
        <div className="pointer-events-none absolute inset-0 bg-hero-radial" />
        <div className="container-page relative py-20 sm:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <Reveal>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-gold-200 ring-1 ring-white/15 backdrop-blur">
                <Truck className="h-4 w-4" /> RORO Vehicle Shipping
              </span>
            </Reveal>
            <Reveal delay={0.08}>
              <h1 className="mt-6 text-balance text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl">
                Roll-on, roll-off vehicle transport
                <span className="mt-2 block bg-gold-gradient bg-clip-text text-transparent">
                  to African ports.
                </span>
              </h1>
            </Reveal>
            <Reveal delay={0.16}>
              <p className="mx-auto mt-6 max-w-2xl text-balance text-lg leading-relaxed text-white/75">
                Ship cars, SUVs, and trucks on Grimaldi, Sallaum, and MSC. Class-based rates, clear
                documentation, and full tracking to the destination port.
              </p>
            </Reveal>
            <Reveal delay={0.22}>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <ButtonLink href="/order" variant="gold" size="lg">
                  Ship a vehicle <ArrowRight className="h-4 w-4" />
                </ButtonLink>
                <ButtonLink
                  href="#estimator"
                  size="lg"
                  className="border border-white/20 bg-white/5 text-white hover:bg-white/10"
                >
                  Estimate my rate
                </ButtonLink>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Shipping lines */}
      <section className="container-page py-20 sm:py-24">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="eyebrow">Carriers we book</span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">
            Grimaldi, Sallaum, and MSC
          </h2>
          <p className="mt-4 text-ink-muted">
            We compare sailings across all three carriers to find the best rate and schedule for
            your route. Base ocean rates below (Class A & B).
          </p>
        </Reveal>
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {lineKeys.map((key, i) => {
            const line = RORO_LINES[key];
            return (
              <Reveal key={key} delay={i * 0.06}>
                <Card className="flex h-full flex-col p-6">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-navy text-gold shadow-premium">
                    <Anchor className="h-5 w-5" />
                  </span>
                  <h3 className="mt-5 font-bold text-navy">{line.label}</h3>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="font-mono text-3xl font-bold text-navy">
                      ${line.classA.toLocaleString()}
                    </span>
                    <span className="text-sm text-ink-muted">base</span>
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">Class A & Class B ocean rate</p>
                  <p className="mt-4 border-t border-border pt-4 text-sm text-ink-muted">
                    Class C (trucks & trailers): {line.classC}
                  </p>
                </Card>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* Vehicle classes */}
      <section className="bg-white py-20 sm:py-24">
        <div className="container-page">
          <Reveal className="mx-auto max-w-2xl text-center">
            <span className="eyebrow">Rate classes</span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">
              How vehicles are classified
            </h2>
            <p className="mt-4 text-ink-muted">
              Your rate is determined by curb weight and dimensions. Classes A and B use a flat line
              rate; Class C is quoted individually.
            </p>
          </Reveal>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {classKeys.map((key, i) => {
              const cls = VEHICLE_CLASSES[key];
              return (
                <Reveal key={key} delay={i * 0.06}>
                  <Card className="h-full p-6">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-navy/5 text-navy">
                        <Car className="h-5 w-5" />
                      </span>
                      <Badge variant="gold">{key.replace("_", " ").toUpperCase()}</Badge>
                    </div>
                    <h3 className="mt-4 font-bold text-navy">{cls.label}</h3>
                    <p className="mt-1.5 text-sm text-ink-muted">{cls.basis}</p>
                  </Card>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* Estimator */}
      <section id="estimator" className="container-page scroll-mt-24 py-20 sm:py-24">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="eyebrow">Instant estimate</span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">
            RORO rate estimator
          </h2>
          <p className="mt-4 text-ink-muted">
            Choose a shipping line and enter your vehicle&apos;s curb weight. We&apos;ll classify it
            and show the base ocean rate instantly.
          </p>
        </Reveal>
        <Reveal delay={0.1} className="mx-auto mt-12 max-w-4xl">
          <RoroEstimator />
        </Reveal>
      </section>

      {/* Documents */}
      <section className="bg-white py-20 sm:py-24">
        <div className="container-page">
          <Reveal className="mx-auto max-w-2xl text-center">
            <span className="eyebrow">Before you ship</span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">
              Required documentation
            </h2>
            <p className="mt-4 text-ink-muted">
              US Customs requires these documents to clear a vehicle for export. Have them ready to
              avoid delays at the port.
            </p>
          </Reveal>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {documents.map((d, i) => {
              const Icon = d.icon;
              return (
                <Reveal key={d.title} delay={i * 0.06}>
                  <Card className="h-full p-6">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-navy text-gold shadow-premium">
                      <Icon className="h-5 w-5" />
                    </span>
                    <h3 className="mt-5 font-bold text-navy">{d.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{d.desc}</p>
                  </Card>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container-page py-20 sm:py-24">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-navy-gradient px-8 py-14 text-center text-white sm:px-16 sm:py-16">
            <div className="pointer-events-none absolute inset-0 bg-hero-radial" />
            <div className="relative mx-auto max-w-2xl">
              <Truck className="mx-auto h-10 w-10 text-gold" />
              <h2 className="mt-5 text-3xl font-extrabold tracking-tight sm:text-4xl">
                Ready to ship your vehicle?
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-white/75">
                Create your account to book a RORO sailing, upload your documents, and track your
                vehicle to the destination port.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <ButtonLink href="/order" variant="gold" size="lg">
                  Get started <ArrowRight className="h-4 w-4" />
                </ButtonLink>
                <ButtonLink
                  href="/contact"
                  size="lg"
                  className="border border-white/20 bg-white/5 text-white hover:bg-white/10"
                >
                  Ask about Class C
                </ButtonLink>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
