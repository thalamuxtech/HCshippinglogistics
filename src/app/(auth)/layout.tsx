import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { ShieldCheck, Ship, Plane, Truck, ArrowLeft } from "lucide-react";
import { COMPANY } from "@/lib/constants";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-navy-gradient p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute inset-0 bg-hero-radial" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "34px 34px",
          }}
        />
        <div className="relative">
          <Logo variant="light" />
        </div>

        <div className="relative max-w-md">
          <h2 className="text-3xl font-extrabold leading-tight">
            Manage shipments across the USA and Africa.
          </h2>
          <p className="mt-4 text-white/70">
            Update shipment stages, issue receipts, and keep every customer informed from one place.
          </p>
          <div className="mt-8 flex gap-6 text-white/60">
            <div className="flex items-center gap-2 text-sm">
              <Ship className="h-5 w-5 text-gold" /> Sea
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Plane className="h-5 w-5 text-gold" /> Air
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Truck className="h-5 w-5 text-gold" /> RORO
            </div>
          </div>
        </div>

        <div className="relative inline-flex items-center gap-2 text-sm text-white/60">
          <ShieldCheck className="h-4 w-4 text-gold" />
          FMC Licensed since {COMPANY.fmcLicensedSince} · CAC Registered
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-col">
        <div className="flex items-center justify-between border-b border-border p-5 lg:hidden">
          <Logo />
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-navy">
            <ArrowLeft className="h-4 w-4" /> Home
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </div>
    </div>
  );
}
