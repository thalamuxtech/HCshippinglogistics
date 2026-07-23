import type { Metadata } from "next";
import { Reveal } from "@/components/marketing/Reveal";
import { COMPANY } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Highclass Shipping and Logistics Inc. collects, uses, and protects your information.",
};

const SECTIONS: { h: string; p: string[] }[] = [
  {
    h: "Information we collect",
    p: [
      "When you place an order or contact us, we collect the details you provide: your name, email, phone number, date of birth, address, and the details of your shipment and its receiver.",
      "We generate a Customer ID and tracking number for each order so you can check status and download your invoice without creating a password.",
    ],
  },
  {
    h: "How we use your information",
    p: [
      "We use your information to process and deliver your shipment, issue invoices and receipts, send status updates by email and SMS, and provide customer support.",
      "Staff access is limited by role. Office and dispatch staff only see the shipments relevant to their work.",
    ],
  },
  {
    h: "Sharing",
    p: [
      "We share information only as needed to move your shipment, for example with shipping lines, customs, and last-mile delivery agents. We do not sell your personal information.",
    ],
  },
  {
    h: "Data retention",
    p: [
      "We keep shipment and financial records for as long as needed to run our business and meet legal and regulatory requirements. You can request a copy of your data or its deletion by contacting us.",
    ],
  },
  {
    h: "Security",
    p: [
      "Your data is stored on secured infrastructure with access controls. Invoices are shared through private, tokenized links rather than public files.",
    ],
  },
  {
    h: "Contact",
    p: [
      `Questions about your data or this policy? Email ${COMPANY.email} or call our offices listed on the Contact page.`,
    ],
  },
];

export default function PrivacyPage() {
  return (
    <>
      <section className="relative overflow-hidden bg-navy-gradient text-white">
        <div className="pointer-events-none absolute inset-0 bg-hero-radial" />
        <div className="container-page relative py-16 sm:py-20">
          <Reveal>
            <span className="eyebrow text-gold-200">Legal</span>
            <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">
              Privacy Policy
            </h1>
            <p className="mt-4 max-w-2xl text-white/75">
              How {COMPANY.name} collects, uses, and protects your information.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="container-page py-16 sm:py-20">
        <div className="mx-auto max-w-3xl space-y-10">
          {SECTIONS.map((s, i) => (
            <Reveal key={s.h} delay={i * 0.04}>
              <h2 className="text-xl font-bold text-navy">{s.h}</h2>
              {s.p.map((para, j) => (
                <p key={j} className="mt-3 leading-relaxed text-ink-muted">
                  {para}
                </p>
              ))}
            </Reveal>
          ))}
          <p className="border-t border-border pt-6 text-sm text-ink-muted">
            {COMPANY.registration}
          </p>
        </div>
      </section>
    </>
  );
}
