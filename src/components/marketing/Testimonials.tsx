"use client";

import * as React from "react";
import { Star, Quote } from "lucide-react";
import { cn, initialsOf } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────
// Testimonials: auto-scrolling marquee of review cards. Pauses on
// hover, respects reduced motion, and loops seamlessly by duplicating
// the track. Reviews are representative examples for a USA to Africa
// shipping company (edit copy freely).
// ─────────────────────────────────────────────────────────────

type Review = {
  name: string;
  location: string;
  service: string;
  rating: number;
  text: string;
};

const REVIEWS: Review[] = [
  {
    name: "Adaeze Okoro",
    location: "Houston, TX",
    service: "Sea Cargo",
    rating: 5,
    text: "I have sent barrels to Lagos three times now. Everything arrived exactly as I packed it, and I could see each stage without calling anyone. This is how shipping should work.",
  },
  {
    name: "Dr. Emeka Nwosu",
    location: "Baltimore, MD",
    service: "Air Freight",
    rating: 5,
    text: "We shipped medical equipment for our clinic in Enugu. The documentation was thorough and the receipt came the same day they collected it. Very professional team.",
  },
  {
    name: "Fatima Bello",
    location: "Bronx, NY",
    service: "Sea Cargo",
    rating: 5,
    text: "They weighed and photographed every box at the warehouse. Nothing went missing and the price was exactly what they quoted me. I recommend them to my whole family.",
  },
  {
    name: "Kwame Mensah",
    location: "Newark, NJ",
    service: "RORO",
    rating: 5,
    text: "Shipped my SUV to Tema. Clear pricing on the Sallaum line, and they handled the title and consignee paperwork properly. Car arrived in good condition.",
  },
  {
    name: "Chioma Eze",
    location: "Atlanta, GA",
    service: "Sea Cargo",
    rating: 5,
    text: "The tracking with my Customer ID is so easy. My mother in Owerri knew the day it cleared customs. No more guessing where the shipment is.",
  },
  {
    name: "Ibrahim Sani",
    location: "Silver Spring, MD",
    service: "Air Freight",
    rating: 5,
    text: "Fast, and the staff actually answer their phone. My documents reached Abuja in a week and the digital receipt made my records simple.",
  },
  {
    name: "Grace Adeyemi",
    location: "Washington, DC",
    service: "Sea Cargo",
    rating: 5,
    text: "I run a small store and import goods regularly. Their rates are published up front, so I can plan my costs. Reliable every single shipment.",
  },
  {
    name: "Tunde Alabi",
    location: "Philadelphia, PA",
    service: "RORO",
    rating: 5,
    text: "Requested a pickup for a few large items and it was worth it. Everything was collected on time and delivered to my brother in Lagos without stress.",
  },
];

function ReviewCard({ r }: { r: Review }) {
  return (
    <figure className="flex h-full w-[300px] shrink-0 flex-col rounded-2xl border border-border bg-white p-6 shadow-card sm:w-[360px]">
      <div className="flex items-center justify-between">
        <div className="flex" aria-label={`${r.rating} out of 5 stars`}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={cn(
                "h-4 w-4",
                i < r.rating ? "fill-gold text-gold" : "text-border"
              )}
            />
          ))}
        </div>
        <Quote className="h-6 w-6 text-navy/10" aria-hidden />
      </div>
      <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-ink">{r.text}</blockquote>
      <figcaption className="mt-5 flex items-center gap-3 border-t border-border pt-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-navy text-xs font-bold text-gold">
          {initialsOf(r.name)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-navy">{r.name}</p>
          <p className="truncate text-xs text-ink-muted">
            {r.location} · {r.service}
          </p>
        </div>
      </figcaption>
    </figure>
  );
}

function Row({ reviews, reverse = false }: { reviews: Review[]; reverse?: boolean }) {
  // Duplicate the list so the CSS marquee loops seamlessly (-50% = one set).
  const doubled = [...reviews, ...reviews];
  return (
    <div className="relative overflow-hidden">
      {/* edge fades */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-surface to-transparent sm:w-24" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-surface to-transparent sm:w-24" />
      <div
        className={cn(
          "flex w-max gap-5 py-1",
          reverse ? "animate-marquee-reverse" : "animate-marquee"
        )}
      >
        {doubled.map((r, i) => (
          <ReviewCard key={`${r.name}-${i}`} r={r} />
        ))}
      </div>
    </div>
  );
}

export function Testimonials() {
  const half = Math.ceil(REVIEWS.length / 2);
  const rowA = REVIEWS.slice(0, half);
  const rowB = REVIEWS.slice(half);

  return (
    <section className="overflow-hidden bg-surface py-20 sm:py-24">
      <div className="container-page">
        <div className="mx-auto max-w-2xl text-center">
          <span className="eyebrow">Customer Reviews</span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">
            Trusted by families and businesses across America
          </h2>
          <p className="mt-4 text-ink-muted">
            Delivered to Nigeria and across Africa, shipment after shipment, since 2017.
          </p>
        </div>
      </div>

      {/* Two marquee rows, opposite directions. Pause on hover (see globals.css). */}
      <div className="marquee mt-12 space-y-5">
        <Row reviews={rowA} />
        <Row reviews={rowB} reverse />
      </div>
    </section>
  );
}
