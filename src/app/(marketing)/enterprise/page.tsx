import type { Metadata } from "next";
import {
  Landmark,
  Stethoscope,
  Building2,
  ShieldCheck,
  FileCheck2,
  Boxes,
  Lock,
  ClipboardCheck,
  ArrowRight,
  Container,
} from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Reveal } from "@/components/marketing/Reveal";
import { BrandPattern } from "@/components/marketing/BrandPattern";

export const metadata: Metadata = {
  title: "Enterprise & B2B Freight: Government, Hospitals & Embassies",
  description:
    "Tender-ready freight forwarding for government agencies, hospitals, and embassies. FMC-licensed since 2017, registered in Maryland, USA and in Nigeria (CAC). Medical equipment logistics and 60+ container project experience with full audit trails.",
};

const segments = [
  {
    icon: Landmark,
    title: "Government agencies",
    desc: "Procurement-compliant documentation, formal digital receipts, and a full record of every stage, ready for tenders and public accountability.",
  },
  {
    icon: Stethoscope,
    title: "Hospitals & health systems",
    desc: "Careful handling of medical equipment, diagnostic devices, and supplies, with a documented chain of custody from our warehouse to the ward.",
  },
  {
    icon: Building2,
    title: "Embassies & corporates",
    desc: "Portal access with defined roles, clear service terms, and a documented record built to carry a long-term contract.",
  },
];

const capabilities = [
  { icon: Boxes, title: "60+ container projects", desc: "We have run programs past 60 containers, staging inventory and sequencing deliveries so they land in the right order." },
  { icon: Stethoscope, title: "Medical equipment", desc: "Medical, diagnostic, and lab equipment moved carefully and documented at each step, work we have done for hospital clients." },
  { icon: Lock, title: "Access by role", desc: "A portal where each person sees only what their role allows, with every action logged." },
  { icon: ClipboardCheck, title: "A record you can pull up", desc: "Every stage change and receipt kept on file and ready to export when someone asks." },
  { icon: FileCheck2, title: "Formal digital receipts", desc: "Receipts issued at inspection for tender and finance use, downloadable whenever you need them." },
  { icon: ShieldCheck, title: "Licensed and registered", desc: "FMC-licensed since 2017 and registered in Maryland, USA and in Nigeria (CAC), so we can bid the day you open the tender." },
];

export default function EnterprisePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-navy-gradient text-white">
        <div className="pointer-events-none absolute inset-0 bg-hero-radial" />
        <BrandPattern variant="compact" />
        <div className="container-page relative py-20 sm:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <Reveal>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-gold-200 ring-1 ring-white/15 backdrop-blur">
                <Building2 className="h-4 w-4" /> Enterprise & B2B
              </span>
            </Reveal>
            <Reveal delay={0.08}>
              <h1 className="mt-6 text-balance text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl">
                Freight your procurement
                <span className="mt-2 block bg-gold-gradient bg-clip-text text-transparent">
                  team can approve.
                </span>
              </h1>
            </Reveal>
            <Reveal delay={0.16}>
              <p className="mx-auto mt-6 max-w-2xl text-balance text-lg leading-relaxed text-white/75">
                Highclass gives you a documented record of every stage, formal receipts, and portal
                access with defined roles. FMC-licensed since 2017 and registered in Maryland, USA and
                in Nigeria (CAC), we bring the paperwork procurement teams at government agencies,
                hospitals, and embassies review before they can sign.
              </p>
            </Reveal>
            <Reveal delay={0.22}>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <ButtonLink href="/contact" variant="gold" size="lg">
                  Talk to our enterprise team <ArrowRight className="h-4 w-4" />
                </ButtonLink>
                <ButtonLink
                  href="/about"
                  size="lg"
                  className="border border-white/20 bg-white/5 text-white hover:bg-white/10"
                >
                  About Highclass
                </ButtonLink>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Segments */}
      <section className="container-page py-20 sm:py-24">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="eyebrow">Who we serve</span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">
            Built for institutional clients
          </h2>
        </Reveal>
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {segments.map((s, i) => {
            const Icon = s.icon;
            return (
              <Reveal key={s.title} delay={i * 0.06}>
                <Card className="h-full p-7">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-navy text-gold-300 shadow-premium">
                    <Icon className="h-6 w-6" />
                  </span>
                  <h3 className="mt-5 text-lg font-bold text-navy">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-muted">{s.desc}</p>
                </Card>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* Capability grid */}
      <section className="bg-white py-20 sm:py-24">
        <div className="container-page">
          <Reveal className="mx-auto max-w-2xl text-center">
            <span className="eyebrow">Capabilities</span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">
              Everything a tender asks for
            </h2>
            <p className="mt-4 text-ink-muted">
              From medical equipment to 60+ container programs, with the licensing, documentation,
              and stage-by-stage record a large contract asks for.
            </p>
          </Reveal>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {capabilities.map((c, i) => {
              const Icon = c.icon;
              return (
                <Reveal key={c.title} delay={i * 0.05}>
                  <Card className="flex h-full items-start gap-4 p-6">
                    <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-navy/5 text-navy">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="font-bold text-navy">{c.title}</h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{c.desc}</p>
                    </div>
                  </Card>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* Project highlight */}
      <section className="container-page py-20 sm:py-24">
        <Reveal>
          <Card className="overflow-hidden">
            <div className="grid items-center gap-0 md:grid-cols-2">
              <div className="p-8 sm:p-10">
                <span className="eyebrow">Track record</span>
                <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-navy sm:text-3xl">
                  Handling large, multi-container projects
                </h2>
                <p className="mt-4 text-ink-muted">
                  We have coordinated programs of more than 60 containers, staging inventory,
                  sequencing sailings, and clearing customs across several destination ports. Our
                  Maryland warehouse and our Lagos office work the same program together, so every
                  stakeholder is looking at the same documented record from origin to delivery.
                </p>
                <div className="mt-6 grid grid-cols-3 gap-4">
                  {[
                    { v: "60+", l: "Container projects" },
                    { v: "2017", l: "Licensed since" },
                    { v: "6", l: "African corridors" },
                  ].map((stat) => (
                    <div key={stat.l}>
                      <div className="font-mono text-2xl font-bold text-navy">{stat.v}</div>
                      <div className="mt-1 text-xs uppercase tracking-wider text-ink-muted">
                        {stat.l}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="relative flex h-full min-h-[220px] items-center justify-center overflow-hidden bg-navy-gradient p-10">
                <div className="pointer-events-none absolute inset-0 bg-hero-radial" />
                <BrandPattern variant="compact" />
                <Container className="relative h-24 w-24 text-gold" />
              </div>
            </div>
          </Card>
        </Reveal>
      </section>

      {/* CTA */}
      <section className="container-page pb-8">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-navy-gradient px-8 py-14 text-center text-white sm:px-16 sm:py-20">
            <div className="pointer-events-none absolute inset-0 bg-hero-radial" />
            <BrandPattern variant="compact" />
            <div className="relative mx-auto max-w-2xl">
              <Building2 className="mx-auto h-10 w-10 text-gold" />
              <h2 className="mt-5 text-3xl font-extrabold tracking-tight sm:text-4xl">
                Let&apos;s scope your program
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-white/75">
                Share your requirements and our enterprise team will prepare a tailored proposal,
                documentation package, and timeline.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <ButtonLink href="/contact" variant="gold" size="lg">
                  Contact enterprise sales <ArrowRight className="h-4 w-4" />
                </ButtonLink>
                <ButtonLink
                  href="/pricing"
                  size="lg"
                  className="border border-white/20 bg-white/5 text-white hover:bg-white/10"
                >
                  Review pricing
                </ButtonLink>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
