import type { Metadata } from "next";
import { Mail, MapPin, Phone, Warehouse, Clock, Building2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Reveal } from "@/components/marketing/Reveal";
import { BrandPattern } from "@/components/marketing/BrandPattern";
import { ContactForm } from "@/components/marketing/ContactForm";
import { OfficeCards } from "@/components/marketing/OfficeCards";
import { COMPANY } from "@/lib/constants";

export const metadata: Metadata = {
  // Canonical: the site is reachable on two hosts, so tell search engines
  // which one to index and consolidate ranking signals onto.
  alternates: { canonical: "/contact" },
  title: "Contact Highclass Shipping: USA Warehouse & Nigeria Office",
  description:
    "Get in touch with Highclass Shipping and Logistics. Send an inquiry for quotes, enterprise programs, or support, or reach our USA warehouse and Lagos office directly.",
};



export default function ContactPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-navy-gradient text-white">
        <div className="pointer-events-none absolute inset-0 bg-hero-radial" />
        <BrandPattern variant="compact" />
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
        {/* grid-cols-1 is explicit: without a declared single-column track the
            implicit track is sized to content, so the form card pushed past the
            viewport on 320px phones. min-w-0 on the item lets it shrink. */}
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-5">
          {/* Form */}
          <Reveal className="min-w-0 lg:col-span-3">
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
                    {/* min-w-0 + break-all: the company address is 36 chars and
                        has no break opportunity, so it overflowed 320px phones. */}
                    <div className="min-w-0">
                      <p className="font-medium text-navy">Email</p>
                      <a
                        href={`mailto:${COMPANY.email}`}
                        className="break-all text-ink-muted hover:text-gold-700 focus-ring rounded"
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

            {/* Live company details, see OfficeCards. */}
            <OfficeCards />
          </div>
        </div>
      </section>
    </>
  );
}
