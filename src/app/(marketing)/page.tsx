import type { Metadata } from "next";
import Link from "next/link";
import {
  Ship,
  Plane,
  Truck,
  ShieldCheck,
  BadgeCheck,
  Clock,
  MapPin,
  ArrowRight,
  Building2,
  Stethoscope,
  Landmark,
  Container,
  Scale,
  Camera,
  Receipt,
  Warehouse,
} from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Reveal } from "@/components/marketing/Reveal";
import { HeroStart } from "@/components/marketing/HeroStart";
import { BrandPattern } from "@/components/marketing/BrandPattern";
import { ProcessJourney } from "@/components/marketing/ProcessJourney";
import { StageJourney } from "@/components/marketing/StageJourney";
import { Testimonials } from "@/components/marketing/Testimonials";
import { ManagedText } from "@/components/marketing/ManagedText";
import { COMPANY, SERVICES } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Shipping from the USA to Nigeria & across Africa",
  description:
    "FMC-licensed freight forwarder connecting the USA to Nigeria and Africa. Sea Cargo, Air Freight, and RORO vehicle shipping with real-time tracking and digital receipts.",
};

const services = [
  {
    key: "sea",
    icon: Ship,
    href: "/services/sea",
    accent: "from-blue-500/10 to-cyan-500/10",
  },
  {
    key: "air",
    icon: Plane,
    href: "/services/air",
    accent: "from-purple-500/10 to-indigo-500/10",
  },
  {
    key: "roro",
    icon: Truck,
    href: "/services/roro",
    accent: "from-amber-500/10 to-orange-500/10",
  },
] as const;

const trustStats = [
  { value: "2017", label: "FMC Licensed Since" },
  { value: "60+", label: "Container Projects" },
  { value: "6", label: "African Corridors" },
  { value: "3", label: "Service Lines" },
];

const enterprise = [
  { icon: Landmark, title: "Government Agencies", desc: "Formal digital receipts, audit trails, and the tender-ready paperwork procurement teams ask for." },
  { icon: Stethoscope, title: "Hospitals & Medical", desc: "Medical and diagnostic equipment moved carefully, with a documented chain of custody at every stage." },
  { icon: Building2, title: "Embassies & Corporates", desc: "Secure portal access with defined roles and service terms for long-running contracts." },
];

const careSteps = [
  {
    icon: Scale,
    title: "Weighed and measured",
    desc: "Every box, barrel, and bag is weighed and measured at our Maryland warehouse, so the rate you pay matches what you actually ship.",
  },
  {
    icon: Camera,
    title: "Photographed before it sails",
    desc: "We photograph your items on arrival at the warehouse. What you drop off is exactly what your family or team receives in Africa.",
  },
  {
    icon: Receipt,
    title: "Receipted the same day",
    desc: "You get a formal receipt the moment we log your shipment, not a screenshot and not a promise to send one later.",
  },
  {
    icon: Warehouse,
    title: "Consolidated with care",
    desc: "Small shipments share container space to keep costs down, and we pack them so nothing shifts on the crossing to Lagos.",
  },
];

export default function HomePage() {
  return (
    <>
      {/* ─── Hero ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-navy-gradient text-white">
        <div className="pointer-events-none absolute inset-0 bg-hero-radial" />
        {/* Premium brand backdrop: blueprint grid + accent dots + route sweeps */}
        <BrandPattern variant="hero" />
        {/* subtle gradient fade into the next section */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-navy-950/30" />
        <div className="container-page relative py-20 sm:py-28 lg:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <Reveal>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-gold-200 ring-1 ring-white/15 backdrop-blur">
                <ShieldCheck className="h-4 w-4" /> FMC Licensed · CAC Registered
              </span>
            </Reveal>
            <Reveal delay={0.08}>
              <h1 className="mt-6 text-balance text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
                Ship from the USA to
                <span className="mt-2 block bg-gold-gradient bg-clip-text text-transparent">
                  Nigeria &amp; across Africa
                </span>
              </h1>
            </Reveal>
            <Reveal delay={0.12}>
              <p className="mt-4 text-base font-semibold uppercase tracking-[0.14em] text-gold-200">
                {COMPANY.slogan}
              </p>
            </Reveal>
            <Reveal delay={0.16}>
              <p className="mx-auto mt-6 max-w-2xl text-balance text-lg leading-relaxed text-white/75">
                <ManagedText
                  field="hero_subtitle"
                  fallback="We have shipped the USA-to-Africa corridor since 2017. Send a box, a barrel, or a vehicle, follow it through all 8 stages, and download your receipt with the Customer ID we give you."
                />
              </p>
            </Reveal>
            <Reveal delay={0.24}>
              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <ButtonLink href="/order" variant="gold" size="lg" className="w-full sm:w-auto">
                  Ship with Highclass <ArrowRight className="h-4 w-4" />
                </ButtonLink>
                <ButtonLink
                  href="/pricing"
                  size="lg"
                  className="w-full border border-white/20 bg-white/5 text-white hover:bg-white/10 sm:w-auto"
                >
                  View Price List
                </ButtonLink>
              </div>
            </Reveal>
          </div>

          {/* Send / track widget */}
          <Reveal delay={0.3}>
            <div className="mx-auto mt-14 max-w-2xl">
              <HeroStart />
            </div>
          </Reveal>
        </div>

        {/* Trust stats bar */}
        <div className="relative border-t border-white/10 bg-navy-950/40 backdrop-blur">
          <div className="container-page grid grid-cols-2 gap-6 py-8 sm:grid-cols-4">
            {trustStats.map((s) => (
              <div key={s.label} className="text-center">
                <div className="font-mono text-2xl font-bold text-gold sm:text-3xl">{s.value}</div>
                <div className="mt-1 text-xs uppercase tracking-wider text-white/60">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Trust / credentials strip ────────────────────── */}
      <section className="border-b border-border bg-white">
        <div className="container-page py-8">
          <p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">
            The freight partner government, hospital &amp; embassy teams keep coming back to
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-navy/70">
            {[
              { icon: ShieldCheck, label: "FMC Licensed" },
              { icon: BadgeCheck, label: "CAC Registered" },
              { icon: Stethoscope, label: "Medical Equipment" },
              { icon: Container, label: "60+ Container Projects" },
              { icon: Landmark, label: "Tender-Ready Docs" },
            ].map((c) => {
              const Icon = c.icon;
              return (
                <div key={c.label} className="inline-flex items-center gap-2">
                  <Icon className="h-5 w-5 text-gold-600" />
                  <span className="text-sm font-semibold">{c.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Services ─────────────────────────────────────── */}
      <section className="container-page py-20 sm:py-24">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="eyebrow">What We Move</span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">
            <ManagedText
              field="services_heading"
              fallback="Three ways to ship from the USA to Africa"
            />
          </h2>
          <p className="mt-4 text-ink-muted">
            <ManagedText
              field="services_subheading"
              fallback="We have moved everything from a single suitcase to a 60-container medical program. Our rates are published up front, and we track every shipment to your door."
            />
          </p>
        </Reveal>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {services.map((svc, i) => {
            const meta = SERVICES[svc.key];
            const Icon = svc.icon;
            return (
              <Reveal key={svc.key} delay={i * 0.08}>
                <Link
                  href={svc.href}
                  className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-white p-7 shadow-card transition-all duration-300 hover:-translate-y-1.5 hover:border-gold/40 hover:shadow-premium focus-ring"
                >
                  {/* gold top accent on hover */}
                  <span className="absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-gold-gradient transition-transform duration-300 group-hover:scale-x-100" />
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${svc.accent} opacity-0 transition-opacity duration-300 group-hover:opacity-100`}
                  />
                  <div className="relative">
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-navy text-gold-300 shadow-premium">
                      <Icon className="h-6 w-6" />
                    </span>
                    <h3 className="mt-5 text-xl font-bold text-navy">{meta.label}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-ink-muted">{meta.tagline}</p>
                    <div className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted">
                      <Clock className="h-3.5 w-3.5" /> {meta.leadTime}
                    </div>
                    <div className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-gold-700">
                      Explore {meta.label}
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                </Link>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* ─── How we handle your cargo ─────────────────────── */}
      <section className="bg-white py-20 sm:py-24">
        <div className="container-page">
          <Reveal className="mx-auto max-w-2xl text-center">
            <span className="eyebrow">How we handle your cargo</span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">
              What you ship is what arrives
            </h2>
            <p className="mt-4 text-ink-muted">
              Most shipping goes wrong before the container ever leaves port. Here is what we do at
              our Maryland warehouse so nothing about your shipment is a surprise later.
            </p>
          </Reveal>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {careSteps.map((step, i) => {
              const Icon = step.icon;
              return (
                <Reveal key={step.title} delay={i * 0.06}>
                  <div className="flex h-full flex-col rounded-2xl border border-border bg-surface p-6 shadow-card">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-navy text-gold-300 shadow-premium">
                      <Icon className="h-5 w-5" />
                    </span>
                    <h3 className="mt-5 font-bold text-navy">{step.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-ink-muted">{step.desc}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── How it works — animated journey ──────────────── */}
      <ProcessJourney />

      {/* ─── 8-Stage lifecycle (animated) ─────────────────── */}
      <StageJourney />

      {/* ─── Customer reviews (auto-slider) ───────────────── */}
      <Testimonials />

      {/* ─── Enterprise ───────────────────────────────────── */}
      <section className="container-page py-20 sm:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <span className="eyebrow">Built for Enterprise</span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">
              Paperwork that clears government and hospital tenders.
            </h2>
            <p className="mt-4 text-ink-muted">
              Highclass gives you a portal, formal digital receipts, and a full record of every stage.
              That is the documentation agencies, hospitals, and embassies review before they can
              award a contract, and we have handled it since our first government job. We are
              FMC-licensed since 2017 and registered in Maryland, USA and in Nigeria (CAC).
            </p>
            <ul className="mt-6 space-y-3">
              {[
                "A portal with defined roles and a log of every action taken",
                "Digital receipts kept on file and downloadable whenever finance asks",
                "Medical equipment and 60+ container projects already on our record",
              ].map((point) => (
                <li key={point} className="flex items-start gap-3 text-sm text-ink">
                  <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
                  {point}
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <ButtonLink href="/enterprise" variant="primary">
                Enterprise &amp; B2B <ArrowRight className="h-4 w-4" />
              </ButtonLink>
            </div>
          </Reveal>

          <div className="grid gap-4">
            {enterprise.map((e, i) => {
              const Icon = e.icon;
              return (
                <Reveal key={e.title} delay={i * 0.08}>
                  <div className="flex items-start gap-4 rounded-2xl border border-border bg-white p-6 shadow-card">
                    <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-navy/5 text-navy">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="font-bold text-navy">{e.title}</h3>
                      <p className="mt-1 text-sm text-ink-muted">{e.desc}</p>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── CTA ──────────────────────────────────────────── */}
      <section className="container-page pb-8">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-navy-gradient px-8 py-14 text-center text-white sm:px-16 sm:py-20">
            <div className="pointer-events-none absolute inset-0 bg-hero-radial" />
            <div className="relative mx-auto max-w-2xl">
              <Container className="mx-auto h-10 w-10 text-gold" />
              <h2 className="mt-5 text-3xl font-extrabold tracking-tight sm:text-4xl">
                Ready to send your first shipment?
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-white/75">
                Tell us what you are shipping and where it is going. You will get a quote, a receipt,
                and a Customer ID to follow it from our warehouse to delivery.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <ButtonLink href="/order" variant="gold" size="lg" className="w-full sm:w-auto">
                  Start a shipment <ArrowRight className="h-4 w-4" />
                </ButtonLink>
                <ButtonLink
                  href="/contact"
                  size="lg"
                  className="w-full border border-white/20 bg-white/5 text-white hover:bg-white/10 sm:w-auto"
                >
                  Talk to our team
                </ButtonLink>
              </div>
              <p className="mt-6 inline-flex items-center gap-2 text-xs text-white/70">
                <MapPin className="h-3.5 w-3.5" /> Serving Nigeria, Ghana, Kenya, South Africa,
                Cameroon &amp; Senegal
              </p>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
