"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Search, PackagePlus, Phone, Mail } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { COMPANY } from "@/lib/constants";

const NAV = [
  { href: "/services/sea", label: "Sea Cargo" },
  { href: "/services/air", label: "Air Freight" },
  { href: "/services/roro", label: "RORO" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  React.useEffect(() => setOpen(false), [pathname]);

  return (
    <header className="sticky top-0 z-40 w-full">
      {/* Top utility bar (desktop) */}
      <div className="hidden bg-navy text-white lg:block">
        <div className="container-page flex h-9 items-center justify-between text-xs">
          <div className="flex items-center gap-5">
            <a
              href={`tel:${COMPANY.usa.phones[0].replace(/[^\d+]/g, "")}`}
              className="inline-flex items-center gap-1.5 text-white transition-colors hover:text-gold-200"
            >
              <Phone className="h-3.5 w-3.5 text-gold-300" /> {COMPANY.usa.phones[0]}
            </a>
            <a
              href={`mailto:${COMPANY.email}`}
              className="inline-flex items-center gap-1.5 text-white transition-colors hover:text-gold-200"
            >
              <Mail className="h-3.5 w-3.5 text-gold-300" /> {COMPANY.email}
            </a>
          </div>
          <div className="flex items-center gap-2 font-medium text-white">
            <span className="h-1.5 w-1.5 rounded-full bg-gold-300" />
            FMC Licensed since {COMPANY.fmcLicensedSince} · USA to Africa
          </div>
        </div>
      </div>

      {/* Main bar */}
      <div
        className={cn(
          "w-full border-b transition-all duration-300",
          scrolled
            ? "border-border bg-white/95 shadow-card backdrop-blur-md"
            : "border-border/60 bg-white/85 backdrop-blur"
        )}
      >
        <div className="container-page flex h-[104px] items-center justify-between gap-4">
          <Logo size="2xl" />

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
            {NAV.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group relative rounded-lg px-3.5 py-2 text-[15px] font-medium transition-all duration-300 focus-ring",
                    "hover:-translate-y-0.5 hover:bg-gold/5",
                    active ? "text-navy" : "text-ink/70 hover:text-gold-700"
                  )}
                >
                  {item.label}
                  {/* Animated underline: grows from the center on hover; pinned when active. */}
                  <span
                    className={cn(
                      "pointer-events-none absolute -bottom-[3px] left-1/2 h-[2px] -translate-x-1/2 rounded-full bg-gold-gradient transition-all duration-300 ease-out",
                      active ? "w-[calc(100%-1.75rem)]" : "w-0 group-hover:w-[calc(100%-1.75rem)]"
                    )}
                  />
                </Link>
              );
            })}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            <ButtonLink href="/track" variant="outline" size="sm">
              <Search className="h-4 w-4" /> My Shipments
            </ButtonLink>
            <ButtonLink href="/order" variant="gold" size="sm">
              <PackagePlus className="h-4 w-4" /> Start an order
            </ButtonLink>
          </div>

          <button
            className="rounded-lg p-2 text-navy hover:bg-navy/5 focus-ring lg:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="border-b border-border bg-white shadow-premium lg:hidden">
          <nav className="container-page flex flex-col py-2" aria-label="Mobile">
            {NAV.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-lg px-3 py-3.5 text-base font-medium transition-colors",
                    active ? "bg-navy/5 text-navy" : "text-ink/80 hover:bg-navy/5"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
            <div className="mt-2 grid grid-cols-2 gap-2 border-t border-border pt-3">
              <ButtonLink href="/track" variant="outline" size="md" className="w-full">
                <Search className="h-4 w-4" /> My Shipments
              </ButtonLink>
              <ButtonLink href="/order" variant="gold" size="md" className="w-full">
                <PackagePlus className="h-4 w-4" /> Start an order
              </ButtonLink>
            </div>
            <a
              href={`tel:${COMPANY.usa.phones[0].replace(/[^\d+]/g, "")}`}
              className="mt-2 flex items-center gap-2 px-3 py-2 text-sm text-ink-muted"
            >
              <Phone className="h-4 w-4 text-gold" /> {COMPANY.usa.phones[0]}
            </a>
          </nav>
        </div>
      )}
    </header>
  );
}
