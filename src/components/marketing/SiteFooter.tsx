import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { COMPANY } from "@/lib/constants";
import { ShieldCheck, Ship, Lock } from "lucide-react";

const cols = [
  {
    title: "Services",
    links: [
      { href: "/services/sea", label: "Sea Cargo" },
      { href: "/services/air", label: "Air Freight" },
      { href: "/services/roro", label: "RORO Vehicle Shipping" },
      { href: "/pricing", label: "Full Price List" },
    ],
  },
  {
    title: "Customers",
    links: [
      { href: "/order", label: "Start an Order" },
      { href: "/track", label: "My Shipments" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About & Licensing" },
      { href: "/enterprise", label: "Enterprise & B2B" },
      { href: "/contact", label: "Contact" },
    ],
  },
];

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-24 bg-navy-gradient text-white">
      <div className="container-page py-16">
        <div className="grid gap-12 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <Logo variant="light" size="lg" />
            <p className="mt-4 font-semibold text-gold-200">{COMPANY.slogan}</p>
            <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-white/70">
              {COMPANY.tagline}
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-gold/15 px-3 py-1.5 text-xs font-semibold text-gold-200 ring-1 ring-gold/30">
              <ShieldCheck className="h-4 w-4" />
              FMC Licensed since {COMPANY.fmcLicensedSince} · Registered in Maryland &amp; Nigeria
            </div>

            <a
              href={`mailto:${COMPANY.email}`}
              className="mt-5 inline-flex items-center gap-2 text-sm text-white/70 hover:text-gold-200"
            >
              <Ship className="h-4 w-4" /> {COMPANY.email}
            </a>
          </div>

          {cols.map((col) => (
            <div key={col.title}>
              <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-200">
                {col.title}
              </h3>
              <ul className="mt-4 space-y-3">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-sm text-white/70 transition-colors hover:text-gold-200 focus-ring rounded"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-start justify-between gap-4 border-t border-white/10 pt-8 text-sm text-white/70 sm:flex-row sm:items-center">
          <p>
            © {year} {COMPANY.name}. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/privacy"
              className="text-xs text-white/70 transition-colors hover:text-gold-200 focus-ring rounded"
            >
              Privacy Policy
            </Link>
            <a
              href="https://thalamux-tech.web.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-white/50 transition-colors hover:text-gold-200 focus-ring rounded"
            >
              Powered by ThalamuxTech
            </a>
            {/* Discreet staff entry point */}
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-xs text-white/40 transition-colors hover:text-gold-200 focus-ring rounded"
              aria-label="Staff sign in"
            >
              <Lock className="h-3.5 w-3.5" /> Staff
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
