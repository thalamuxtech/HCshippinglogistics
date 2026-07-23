import type { Metadata } from "next";
import Link from "next/link";
import {
  Ship,
  Plane,
  Truck,
  ShieldCheck,
  BadgeCheck,
  Boxes,
  Clock,
  MapPin,
  ArrowRight,
  Building2,
  Stethoscope,
  Landmark,
  Container,
} from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Reveal } from "@/components/marketing/Reveal";
import { PublicTracker } from "@/components/marketing/PublicTracker";
import { ManagedText } from "@/components/marketing/ManagedText";
import { COMPANY, SERVICES, STAGES } from "@/lib/constants";

export const metadata: Metadata = {
  title: "White-Glove Freight — USA to Africa",
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
  { icon: Landmark, title: "Government Agencies", desc: "Formal digital receipts, audit trails, and tender-ready documentation." },
  { icon: Stethoscope, title: "Hospitals & Medical", desc: "Medical equipment shipping with full chain-of-custody tracking." },
  { icon: Building2, title: "Embassies & Corporates", desc: "Secure, role-isolated portal access with enterprise SLAs." },
];

export default function HomePage() {
  return (
    <>
      {/* ─── Hero ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-navy-gradient text-white">
        <div className="pointer-events-none absolute inset-0 bg-hero-radial" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "36px 36px",
          }}
        />
        <div className="container-page relative py-20 sm:py-28 lg:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <Reveal>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-gold-200 ring-1 ring-white/15 backdrop-blur">
                <ShieldCheck className="h-4 w-4" /> FMC Licensed · CAC Registered
              </span>
            </Reveal>
            <Reveal delay={0.08}>
              <h1 className="mt-6 text-balance text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
                White-Glove Freight Management.
                <span className="mt-2 block bg-gold-gradient bg-clip-text text-transparent">
                  Seamlessly Connecting USA to Africa.
                </span>
              </h1>
            </Reveal>
            <Reveal delay={0.16}>
              <p className="mx-auto mt-6 max-w-2xl text-balance text-lg leading-relaxed text-white/75">
                <ManagedText
                  field="hero_subtitle"
                  fallback="Sea Cargo, Air Freight, and RORO vehicle shipping to Nigeria and across Africa — with real-time tracking, digital receipts, and the security enterprise contracts demand."
                />
              </p>
            </Reveal>
            <Reveal delay={0.24}>
              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <ButtonLink href="/signup" variant="gold" size="lg" className="w-full sm:w-auto">
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

          {/* Public tracker */}
          <Reveal delay={0.3}>
            <div className="mx-auto mt-14 max-w-xl">
              <PublicTracker variant="hero" />
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

      {/* ─── Services ─────────────────────────────────────── */}
      <section className="container-page py-20 sm:py-24">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="eyebrow">What We Move</span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">
            <ManagedText
              field="services_heading"
              fallback="Three service lines. One trusted corridor."
            />
          </h2>
          <p className="mt-4 text-ink-muted">
            <ManagedText
              field="services_subheading"
              fallback="From a single suitcase to a 60-container medical project — priced transparently and tracked end-to-end."
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
                  className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-white p-7 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-premium focus-ring"
                >
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${svc.accent} opacity-0 transition-opacity duration-300 group-hover:opacity-100`}
                  />
                  <div className="relative">
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-navy text-gold shadow-premium">
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

      {/* ─── 8-Stage lifecycle ────────────────────────────── */}
      <section className="bg-white py-20 sm:py-24">
        <div className="container-page">
          <Reveal className="mx-auto max-w-2xl text-center">
            <span className="eyebrow">Radical Transparency</span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">
              Every shipment, tracked through 8 stages
            </h2>
            <p className="mt-4 text-ink-muted">
              No more WhatsApp guesswork. Automated email &amp; SMS updates at every transition.
            </p>
          </Reveal>

          <div className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8">
            {STAGES.map((stage, i) => (
              <Reveal key={stage.key} delay={i * 0.04}>
                <div className="flex flex-col items-center rounded-xl border border-border bg-surface p-4 text-center">
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-full font-mono text-sm font-bold text-white"
                    style={{ backgroundColor: stage.color }}
                  >
                    {stage.order}
                  </span>
                  <p className="mt-3 text-xs font-semibold leading-tight text-navy">
                    {stage.short}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Enterprise ───────────────────────────────────── */}
      <section className="container-page py-20 sm:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <span className="eyebrow">Built for Enterprise</span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">
              The infrastructure government &amp; hospital tenders require.
            </h2>
            <p className="mt-4 text-ink-muted">
              Agencies, hospitals, and embassies don&apos;t award contracts over WhatsApp. Highclass
              delivers a customer portal, formal digital receipts, audit trails, and a public
              credibility footprint — making us bid-eligible from day one.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                "Encrypted, role-isolated portal with full audit logging",
                "Digital receipts archived permanently and downloadable anytime",
                "Medical equipment & 60+ container project experience",
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
                Ready to ship with confidence?
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-white/75">
                Create your free account, get an instant quote, and track every barrel, box, and
                vehicle from pickup to delivery.
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
                  Talk to sales
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
