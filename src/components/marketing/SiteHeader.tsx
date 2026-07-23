"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Package } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/AuthProvider";
import { ROLE_HOME } from "@/components/providers/RequireRole";

const NAV = [
  { href: "/services/sea", label: "Sea Cargo" },
  { href: "/services/air", label: "Air Freight" },
  { href: "/services/roro", label: "RORO" },
  { href: "/pricing", label: "Pricing" },
  { href: "/track", label: "Track" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);
  const { user, role } = useAuth();

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  React.useEffect(() => setOpen(false), [pathname]);

  const portalHref = user && role ? ROLE_HOME[role] : "/login";

  return (
    <header
      className={cn(
        "sticky top-0 z-40 w-full border-b transition-all duration-300",
        scrolled
          ? "border-border bg-white/90 backdrop-blur-md shadow-card"
          : "border-transparent bg-white/70 backdrop-blur"
      )}
    >
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Logo />

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors focus-ring",
                  active ? "text-gold-700" : "text-navy/80 hover:text-navy hover:bg-navy/5"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          {user ? (
            <ButtonLink href={portalHref} variant="gold" size="sm">
              <Package className="h-4 w-4" /> My Portal
            </ButtonLink>
          ) : (
            <>
              <ButtonLink href="/login" variant="ghost" size="sm">
                Log in
              </ButtonLink>
              <ButtonLink href="/signup" variant="gold" size="sm">
                Get started
              </ButtonLink>
            </>
          )}
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

      {open && (
        <div className="border-t border-border bg-white lg:hidden">
          <nav className="container-page flex flex-col py-3" aria-label="Mobile">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-3 text-sm font-medium text-navy hover:bg-navy/5"
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-2 flex gap-2 border-t border-border pt-3">
              {user ? (
                <ButtonLink href={portalHref} variant="gold" size="sm" className="flex-1">
                  My Portal
                </ButtonLink>
              ) : (
                <>
                  <ButtonLink href="/login" variant="outline" size="sm" className="flex-1">
                    Log in
                  </ButtonLink>
                  <ButtonLink href="/signup" variant="gold" size="sm" className="flex-1">
                    Get started
                  </ButtonLink>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
