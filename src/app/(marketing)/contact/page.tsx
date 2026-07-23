import type { Metadata } from "next";
import { Mail, MapPin, Phone, Warehouse, Clock, Building2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Reveal } from "@/components/marketing/Reveal";
import { ContactForm } from "@/components/marketing/ContactForm";
import { COMPANY } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Contact Highclass Shipping: USA Warehouse & Nigeria Office",
  description:
    "Get in touch with Highclass Shipping and Logistics. Send an inquiry for quotes, enterprise programs, or support, or reach our USA warehouse and Lagos office directly.",
};

const offices = [
  {
    icon: Warehouse,
    label: COMPANY.usa.label,
    subtitle: "Collection, inspection & receipting hub",
    lines: COMPANY.usa.lines,
    phones: COMPANY.usa.phones,
    hours: "Mon–Fri, 9:00 AM – 6:00 PM ET",
  },
  {
    icon: Building2,
    label: COMPANY.nigeria.label,
    subtitle: "Destination clearance & delivery",
    lines: COMPANY.nigeria.lines,
    phones: COMPANY.nigeria.phones,
    hours: "Mon–Sat, 9:00 AM – 5:00 PM WAT",
  },
];

export default function ContactPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-navy-gradient text-white">
        <div className="pointer-events-none absolute inset-0 bg-hero-radial" />
        <div className="container-page relative py-20 sm:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <Reveal>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-gold-200 ring-1 ring-white/15 backdrop-blur">
                <Mail className="h-4 w-4" /> Contact Us
              </span>
            </Reveal>
            <Reveal delay={0.08}>
              <h1 className="mt-6 text-balance text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl">
                Let&apos;s move it together.
              </h1>
            </Reveal>
            <Reveal delay={0.16}>
              <p className="mx-auto mt-6 max-w-2xl text-balance text-lg leading-relaxed text-white/75">
                Request a quote, ask about an enterprise program, or get support. Our team responds
                within one business day.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Form + contact info */}
      <section className="container-page py-20 sm:py-24">
        <div className="grid gap-10 lg:grid-cols-5">
          {/* Form */}
          <Reveal className="lg:col-span-3">
            <Card className="p-6 sm:p-8">
              <h2 className="text-2xl font-bold text-navy">Send us a message</h2>
              <p className="mt-1.5 text-sm text-ink-muted">
                Fill out the form and we&apos;ll get back to you shortly.
              </p>
              <div className="mt-8">
                <ContactForm />
              </div>
            </Card>
          </Reveal>

          {/* Contact info */}
          <div className="space-y-6 lg:col-span-2">
            <Reveal delay={0.06}>
              <Card className="p-6">
                <h3 className="font-bold text-navy">Reach us directly</h3>
                <ul className="mt-4 space-y-4 text-sm">
                  <li className="flex items-start gap-3">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-navy/5 text-navy">
                      <Mail className="h-4.5 w-4.5" />
                    </span>
                    <div>
                      <p className="font-medium text-navy">Email</p>
                      <a
                        href={`mailto:${COMPANY.email}`}
                        className="text-ink-muted hover:text-gold-700 focus-ring rounded"
                      >
                        {COMPANY.email}
                      </a>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-navy/5 text-navy">
                      <Phone className="h-4.5 w-4.5" />
                    </span>
                    <div>
                      <p className="font-medium text-navy">Phone</p>
                      <p className="text-ink-muted">Available on request via the form</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-navy/5 text-navy">
                      <Clock className="h-4.5 w-4.5" />
                    </span>
                    <div>
                      <p className="font-medium text-navy">Response time</p>
                      <p className="text-ink-muted">Within one business day</p>
                    </div>
                  </li>
                </ul>
              </Card>
            </Reveal>

            {offices.map((o, i) => {
              const Icon = o.icon;
              return (
                <Reveal key={o.label} delay={0.12 + i * 0.06}>
                  <Card className="p-6">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-navy text-gold">
                        <Icon className="h-5 w-5" />
                      </span>
                      <div>
                        <h3 className="font-bold text-navy">{o.label}</h3>
                        <p className="text-xs text-ink-muted">{o.subtitle}</p>
                      </div>
                    </div>
                    <ul className="mt-4 space-y-2 text-sm text-ink-muted">
                      <li className="flex items-start gap-2">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                        <span>{o.lines.join(", ")}</span>
                      </li>
                      {o.phones.map((p) => (
                        <li key={p} className="flex items-center gap-2">
                          <Phone className="h-4 w-4 shrink-0 text-gold" />
                          <a href={`tel:${p.replace(/[^\d+]/g, "")}`} className="hover:text-navy">
                            {p}
                          </a>
                        </li>
                      ))}
                      <li className="flex items-center gap-2">
                        <Clock className="h-4 w-4 shrink-0 text-gold" />
                        {o.hours}
                      </li>
                    </ul>
                  </Card>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
