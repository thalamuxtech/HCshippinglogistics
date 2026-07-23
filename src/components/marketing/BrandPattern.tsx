// ─────────────────────────────────────────────────────────────
// BrandPattern — animated, premium decorative backdrop for navy/blue
// surfaces (marketing heroes, subpage bands, auth panel, footer).
//
// Layers: a slowly panning blueprint grid, brighter parallax accent dots,
// drifting diagonal "shipping route" sweeps, a travelling light beam, a
// breathing glow, and a few floating cargo dots. All motion uses transform/
// opacity/background-position only (compositor-friendly) and is disabled for
// users with prefers-reduced-motion (handled globally in globals.css).
//
// Purely decorative: pointer-events-none + aria-hidden.
// ─────────────────────────────────────────────────────────────

import { cn } from "@/lib/utils";

type Variant = "hero" | "compact" | "panel" | "footer";

interface VariantCfg {
  gridOpacity: number;
  dotOpacity: number;
  routeOpacity: number;
  beam: boolean;
  floats: boolean;
  glow: boolean;
  // vertical anchor of the mask/glow (heroes glow near the top, footer near the top too)
  maskY: string;
}

const CFG: Record<Variant, VariantCfg> = {
  hero: { gridOpacity: 0.08, dotOpacity: 0.11, routeOpacity: 0.6, beam: true, floats: true, glow: true, maskY: "22%" },
  compact: { gridOpacity: 0.07, dotOpacity: 0.09, routeOpacity: 0.5, beam: true, floats: false, glow: true, maskY: "35%" },
  panel: { gridOpacity: 0.06, dotOpacity: 0.09, routeOpacity: 0.45, beam: false, floats: true, glow: true, maskY: "20%" },
  footer: { gridOpacity: 0.05, dotOpacity: 0.07, routeOpacity: 0.4, beam: false, floats: false, glow: true, maskY: "30%" },
};

export function BrandPattern({
  className,
  variant = "hero",
}: {
  className?: string;
  variant?: Variant;
}) {
  const c = CFG[variant];
  const mask = `radial-gradient(ellipse 95% 85% at 50% ${c.maskY}, black 52%, transparent 100%)`;

  return (
    <div
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
      aria-hidden="true"
    >
      {/* Panning blueprint line grid */}
      <div
        className="absolute inset-[-56px] animate-grid-pan"
        style={{
          opacity: c.gridOpacity,
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.9) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.9) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: mask,
          WebkitMaskImage: mask,
        }}
      />

      {/* Parallax accent dots, offset from the grid lines */}
      <div
        className="absolute inset-[-56px] animate-grid-pan"
        style={{
          opacity: c.dotOpacity,
          animationDirection: "reverse",
          animationDuration: "36s",
          backgroundImage:
            "radial-gradient(circle at 1.5px 1.5px, rgba(120,170,255,0.95) 1.6px, transparent 0)",
          backgroundSize: "56px 56px",
          backgroundPosition: "28px 28px",
          maskImage: mask,
          WebkitMaskImage: mask,
        }}
      />

      {/* Drifting diagonal "route" sweeps */}
      <div
        className="absolute -inset-x-24 -inset-y-24 animate-route-drift"
        style={{
          opacity: c.routeOpacity,
          backgroundImage:
            "repeating-linear-gradient(-24deg, transparent 0, transparent 118px, rgba(120,170,255,0.07) 118px, rgba(120,170,255,0.07) 120px)",
          maskImage: "linear-gradient(105deg, black 0%, transparent 68%)",
          WebkitMaskImage: "linear-gradient(105deg, black 0%, transparent 68%)",
        }}
      />

      {/* Breathing glow */}
      {c.glow && (
        <div
          className="absolute left-1/2 top-[-20%] h-[540px] w-[860px] animate-glow-pulse rounded-full"
          style={{
            background:
              "radial-gradient(closest-side, rgba(46,116,236,0.24), transparent 72%)",
          }}
        />
      )}

      {/* Travelling light beam */}
      {c.beam && (
        <div className="absolute inset-0">
          <div
            className="absolute inset-y-[-40%] left-0 w-1/3 animate-beam-sweep"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(150,190,255,0.10), transparent)",
            }}
          />
        </div>
      )}

      {/* Floating cargo dots for subtle depth */}
      {c.floats && (
        <>
          <span
            className="absolute left-[12%] top-[30%] h-2 w-2 animate-float-slow rounded-full bg-gold-300/40 blur-[1px]"
          />
          <span
            className="absolute right-[16%] top-[24%] h-1.5 w-1.5 animate-float-slower rounded-full bg-white/40 blur-[1px]"
          />
          <span
            className="absolute left-[68%] top-[58%] h-2.5 w-2.5 animate-float-slow rounded-full bg-gold-300/30 blur-[1px]"
            style={{ animationDelay: "1.5s" }}
          />
          <span
            className="absolute left-[30%] top-[64%] h-1.5 w-1.5 animate-float-slower rounded-full bg-white/30 blur-[1px]"
            style={{ animationDelay: "0.8s" }}
          />
        </>
      )}
    </div>
  );
}
