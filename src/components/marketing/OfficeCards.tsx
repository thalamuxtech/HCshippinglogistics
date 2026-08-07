"use client";

// Office address cards, reading the live admin-editable company details.
//
// Split out of the (server) contact page so that page keeps its exported
// Metadata for SEO while these cards can use the client-side hook. The hook
// returns the built-in constants synchronously, so first paint is identical to
// the old static render — no flash — and edits made in Settings appear without a
// deploy.

import * as React from "react";
import { MapPin, Phone, Warehouse, Clock, Building2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Reveal } from "@/components/marketing/Reveal";
import { useCompanyInfo } from "@/lib/company-info";
import { COMPANY } from "@/lib/constants";

export function OfficeCards() {
  const company = useCompanyInfo();

  const offices = [
    {
      icon: Warehouse,
      label: COMPANY.usa.label,
      subtitle: "Collection, inspection & receipting hub",
      lines: company.usaLines,
      phones: company.usaPhones,
      hours: "Mon–Fri, 9:00 AM – 6:00 PM ET",
    },
    {
      icon: Building2,
      label: COMPANY.nigeria.label,
      subtitle: "Destination clearance & delivery",
      lines: company.nigeriaLines,
      phones: company.nigeriaPhones,
      hours: "Mon–Sat, 9:00 AM – 5:00 PM WAT",
    },
  ];

  return (
    <>
      {offices.map((o, i) => {
        const Icon = o.icon;
        return (
          <Reveal key={o.label} delay={0.12 + i * 0.06}>
            <Card className="p-6">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-navy text-gold-300">
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
    </>
  );
}
