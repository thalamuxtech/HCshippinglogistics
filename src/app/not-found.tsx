import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Logo } from "@/components/brand/Logo";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-navy-gradient px-6 text-center text-white">
      <div className="pointer-events-none absolute inset-0 bg-hero-radial" />
      <div className="relative">
        <Logo variant="light" href="/" />
        <div className="mt-10">
          <Compass className="mx-auto h-12 w-12 text-gold" />
          <p className="mt-6 font-mono text-6xl font-bold text-gold">404</p>
          <h1 className="mt-3 text-2xl font-extrabold">This route is off the map</h1>
          <p className="mt-2 max-w-md text-white/70">
            The page you&apos;re looking for has sailed. Let&apos;s get you back on course.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <ButtonLink href="/" variant="gold">
              Back to home
            </ButtonLink>
            <ButtonLink
              href="/track"
              className="border border-white/20 bg-white/5 text-white hover:bg-white/10"
            >
              Track a shipment
            </ButtonLink>
          </div>
        </div>
      </div>
    </div>
  );
}
