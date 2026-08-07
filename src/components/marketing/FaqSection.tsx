// ─────────────────────────────────────────────────────────────
// Homepage FAQ.
//
// Two purposes, both deliberate:
//  - Answers the questions customers actually ask before ordering, which is
//    ordinary good copy.
//  - Feeds FAQPage schema. A question-and-answer pair is precisely the shape AI
//    answer engines (AI Overviews, ChatGPT, Perplexity) quote, so this is the
//    single most citable part of the site, and Google can render it as an
//    expandable rich result.
//
// Answers are specific: prices, lead times, city and licence names. Vague
// marketing copy gives an answer engine nothing to quote, so it cites a
// competitor who was concrete instead.
// ─────────────────────────────────────────────────────────────

import { HelpCircle } from "lucide-react";
import { Reveal } from "@/components/marketing/Reveal";
import { FaqSchema } from "@/components/marketing/StructuredData";
import { COMPANY } from "@/lib/constants";

export const FAQS: { question: string; answer: string }[] = [
  {
    question: "How long does shipping from the USA to Nigeria take?",
    answer:
      "Sea cargo typically takes 21 to 30 business weeks after the vessel departs. Air freight is the fastest option at roughly one to two weeks. Vehicle (RORO) shipping depends on the sailing schedule of the line used. You are emailed an update at each of the 8 tracking stages, so you always know where your cargo is.",
  },
  {
    question: "How much does it cost to ship a barrel to Nigeria?",
    answer:
      "Sea cargo is priced per item rather than by weight, so the cost is known before you ship. Barrels, boxes, bags and furniture each have a published rate on our pricing page, starting from $35 for a small box. Air freight is charged per pound on the greater of actual or dimensional weight.",
  },
  {
    question: "Do you collect from my address, or do I drop off?",
    answer:
      "Both. You can drop off free of charge at our USA warehouse at 8611 Westphalia Road, Upper Marlboro, Maryland 20774. We also collect door-to-door anywhere in the USA; that fee depends on distance and volume, so we confirm it after you order and before you pay.",
  },
  {
    question: "What can I ship, and what is not allowed?",
    answer:
      "We ship boxes, barrels, Ghana-must-go bags, plastic totes, drums, furniture, televisions, electronics and personal effects by sea, and vehicles by RORO. Fragile items can be flagged at order time so they are handled and crated accordingly. We cannot carry hazardous goods, flammable liquids, firearms or perishable food.",
  },
  {
    question: "How do I track my shipment?",
    answer:
      "Enter your Customer ID or tracking number on our tracking page. Your Customer ID is emailed when you first order and printed on every invoice; it shows all of your shipments, the current stage, the amount due and your downloadable invoices.",
  },
  {
    question: "Are you a licensed freight forwarder?",
    answer:
      "Yes. Highclass Shipping and Logistics Inc. has been licensed by the Federal Maritime Commission (FMC) since 2017 and is registered in Maryland, USA and in Nigeria with the CAC. That documentation is what government, hospital and embassy tenders require.",
  },
  {
    question: "Which countries do you ship to?",
    answer:
      "Nigeria is our main corridor, with delivery and clearance handled by our own Lagos office. We also ship to Ghana, Kenya, South Africa, Cameroon and Senegal.",
  },
  {
    question: "When do I pay, and how is the final amount confirmed?",
    answer:
      "Nothing is charged when you place an order. If anything still needs pricing, such as a door-to-door pickup or an item that is not on our price list, we price it and the full amount appears against your Customer ID. You can check it any time before paying.",
  },
];

export function FaqSection() {
  return (
    <section className="border-t border-border bg-surface py-20 sm:py-24">
      {/* The schema mirrors the visible copy exactly. Marking up answers that are
          not on the page is a structured-data violation and risks a penalty. */}
      <FaqSchema faqs={FAQS} />
      <div className="container-page">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="eyebrow">
            <HelpCircle className="mr-1.5 inline h-4 w-4" /> Common questions
          </span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">
            Shipping from the USA to Africa, answered
          </h2>
          <p className="mt-4 text-ink-muted">
            Costs, timings and paperwork. If your question is not here,{" "}
            <a href="/contact" className="font-semibold text-gold-700 hover:underline">
              ask our team
            </a>
            .
          </p>
        </Reveal>

        {/* Native <details> so every answer is in the HTML and readable by a
            crawler that does not run JavaScript, while staying collapsed for
            humans. A JS accordion would hide the text from exactly the engines
            this section exists to reach. */}
        <div className="mx-auto mt-12 max-w-3xl divide-y divide-border overflow-hidden rounded-2xl border border-border bg-white">
          {FAQS.map((f, i) => (
            <details key={f.question} className="group" open={i === 0}>
              <summary className="flex cursor-pointer items-start justify-between gap-4 p-5 text-left font-semibold text-navy transition-colors hover:bg-secondary/40 focus-ring">
                <h3 className="text-base">{f.question}</h3>
                <span
                  className="mt-0.5 shrink-0 text-xl leading-none text-gold transition-transform group-open:rotate-45"
                  aria-hidden
                >
                  +
                </span>
              </summary>
              <p className="px-5 pb-5 text-sm leading-relaxed text-ink-muted">{f.answer}</p>
            </details>
          ))}
        </div>

        <p className="mx-auto mt-6 max-w-3xl text-center text-xs text-ink-muted">
          USA warehouse: {COMPANY.usa.lines.join(", ")} · Lagos office:{" "}
          {COMPANY.nigeria.lines[0]}, Yaba, Lagos
        </p>
      </div>
    </section>
  );
}
