import type { Metadata } from "next";
import {
  ShieldCheck,
  BadgeCheck,
  Landmark,
  Stethoscope,
  Building2,
  Globe2,
  ArrowRight,
  Award,
  FileCheck2,
} from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Reveal } from "@/components/marketing/Reveal";
import { COMPANY, DESTINATION_COUNTRIES } from "@/lib/constants";

export const metadata: Metadata = {
  title: "About Highclass Shipping — FMC-Licensed Since 2017",
  description:
    "Highclass Shipping and Logistics Inc. is an FMC-licensed, CAC-registered freight forwarder specializing in the USA–Nigeria corridor, serving government, hospital, and embassy clients since 2017.",
};

const trustBadges = [
  { icon: ShieldCheck, title: "FMC Licensed", desc: `Federal Maritime Commission licensed since ${COMPANY.fmcLicensedSince}.` },
  { icon: FileCheck2, title: "CAC Registered", desc: "Corporate Affairs Commission registered for operations in Nigeria." },
  { icon: Award, title: "60+ Container Projects", desc: "Proven delivery on large-scale, multi-container programs." },
  { icon: Globe2, title: "6 African Corridors", desc: "Established lanes across West, East, and Southern Africa." },
];

const capabilities = [
  {
    icon: Landmark,
    title: "Government agencies",
    desc: "Tender-ready documentation, formal digital receipts, and complete audit trails that satisfy procurement and compliance requirements.",
  },
  {
    icon: Stethoscope,
    title: "Hospitals & medical",
    desc: "Careful handling of medical equipment and supplies with full chain-of-custody tracking from pickup to delivery.",
  },
  {
    icon: Building2,
    title: "Embassies & corporates",
    desc: "Secure, role-isolated portal access, enterprise SLAs, and a public credibility footprint that supports high-trust contracts.",
  },
];

export default function AboutPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-navy-gradient text-white">
        <div className="pointer-events-none absolute inset-0 bg-hero-radial" />
        <div className="container-page relative py-20 sm:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <Reveal>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-gold-200 ring-1 ring-white/15 backdrop-blur">
                <ShieldCheck className="h-4 w-4" /> Our Story
              </span>
            </Reveal>
            <Reveal delay={0.08}>
              <h1 className="mt-6 text-balance text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl">
                Built on trust,
                <span className="mt-2 block bg-gold-gradient bg-clip-text text-transparent">
                  proven across the corridor.
                </span>
              </h1>
            </Reveal>
            <Reveal delay={0.16}>
              <p className="mx-auto mt-6 max-w-2xl text-balance text-lg leading-relaxed text-white/75">
                {COMPANY.tagline}
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Story */}
      <section className="container-page py-20 sm:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <span className="eyebrow">Who we are</span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">
              A decade of moving what matters
            </h2>
            <div className="mt-5 space-y-4 text-ink-muted">
              <p>
                {COMPANY.name} has connected families, businesses, and institutions across the
                USA–Nigeria corridor since {COMPANY.fmcLicensedSince}. As a licensed freight
                forwarder, we handle everything from a single suitcase to multi-container medical
                and infrastructure projects.
              </p>
              <p>
                We built our reputation on radical transparency — formal digital receipts, an 8-stage
                tracking lifecycle, and automated updates that replace WhatsApp guesswork with an
                audit-ready record. That infrastructure is exactly what government, hospital, and
                embassy clients require, and it is what makes us bid-eligible from day one.
              </p>
              <p>
                Today we operate established lanes to Nigeria, Ghana, Kenya, South Africa, Cameroon,
                and Senegal, backed by a USA warehouse and a Lagos office working in lockstep.
              </p>
            </div>
            <div className="mt-8">
              <ButtonLink href="/enterprise" variant="primary">
                Explore enterprise capability <ArrowRight className="h-4 w-4" />
              </ButtonLink>
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <Card className="bg-surface p-8">
              <h3 className="font-bold text-navy">Corridor expertise</h3>
              <p className="mt-1 text-sm text-ink-muted">
                Deep specialization on the routes that matter most to our clients.
              </p>
              <ul className="mt-5 grid grid-cols-2 gap-3">
                {DESTINATION_COUNTRIES.map((c) => (
                  <li
                    key={c}
                    className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2.5 text-sm font-medium text-navy"
                  >
                    <Globe2 className="h-4 w-4 text-gold" /> {c}
                  </li>
                ))}
              </ul>
              <p className="mt-5 flex items-center gap-2 text-xs text-ink-muted">
                <BadgeCheck className="h-4 w-4 text-gold" /> Primary focus: the USA–Nigeria lane.
              </p>
            </Card>
          </Reveal>
        </div>
      </section>

      {/* Trust badges */}
      <section className="bg-white py-20 sm:py-24">
        <div className="container-page">
          <Reveal className="mx-auto max-w-2xl text-center">
            <span className="eyebrow">Credentials</span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">
              Licensed, registered, and proven
            </h2>
          </Reveal>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {trustBadges.map((b, i) => {
              const Icon = b.icon;
              return (
                <Reveal key={b.title} delay={i * 0.06}>
                  <Card className="h-full p-6 text-center">
                    <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-xl bg-navy text-gold shadow-premium">
                      <Icon className="h-6 w-6" />
                    </span>
                    <h3 className="mt-4 font-bold text-navy">{b.title}</h3>
                    <p className="mt-1.5 text-sm text-ink-muted">{b.desc}</p>
                  </Card>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* Capability */}
      <section className="container-page py-20 sm:py-24">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="eyebrow">Who we serve</span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">
            Institutional-grade capability
          </h2>
          <p className="mt-4 text-ink-muted">
            The documentation, security, and reliability that high-trust organizations demand.
          </p>
        </Reveal>
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {capabilities.map((c, i) => {
            const Icon = c.icon;
            return (
              <Reveal key={c.title} delay={i * 0.06}>
                <Card className="h-full p-6">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-navy/5 text-navy">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-5 font-bold text-navy">{c.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{c.desc}</p>
                </Card>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="container-page pb-8">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-navy-gradient px-8 py-14 text-center text-white sm:px-16 sm:py-16">
            <div className="pointer-events-none absolute inset-0 bg-hero-radial" />
            <div className="relative mx-auto max-w-2xl">
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                Ship with a partner you can trust
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-white/75">
                Join the families, businesses, and institutions who move with confidence across the
                USA–Africa corridor.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <ButtonLink href="/signup" variant="gold" size="lg">
                  Create your account <ArrowRight className="h-4 w-4" />
                </ButtonLink>
                <ButtonLink
                  href="/contact"
                  size="lg"
                  className="border border-white/20 bg-white/5 text-white hover:bg-white/10"
                >
                  Contact us
                </ButtonLink>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
