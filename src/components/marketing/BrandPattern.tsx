// ─────────────────────────────────────────────────────────────
// BrandPattern — premium decorative backdrop for navy/blue surfaces
// (marketing hero, auth brand panel). Layers a fine blueprint grid,
// brighter accent dots, and soft diagonal "shipping route" lines with
// a masked fade so it stays visible without competing with the copy.
// Purely decorative: pointer-events-none + aria-hidden.
// ─────────────────────────────────────────────────────────────

import { cn } from "@/lib/utils";

export function BrandPattern({
  className,
  intensity = "hero",
}: {
  className?: string;
  // "hero" is a touch stronger for the big marketing band; "panel" for the
  // narrower auth column.
  intensity?: "hero" | "panel";
}) {
  const dotOpacity = intensity === "hero" ? 0.10 : 0.09;
  const gridOpacity = intensity === "hero" ? 0.07 : 0.06;

  return (
    <div
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
      aria-hidden="true"
    >
      {/* Fine blueprint line grid */}
      <div
        className="absolute inset-0"
        style={{
          opacity: gridOpacity,
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.9) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.9) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage:
            "radial-gradient(ellipse 90% 80% at 50% 25%, black 55%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 90% 80% at 50% 25%, black 55%, transparent 100%)",
        }}
      />

      {/* Brighter accent dots, offset from the grid lines for a layered feel */}
      <div
        className="absolute inset-0"
        style={{
          opacity: dotOpacity,
          backgroundImage:
            "radial-gradient(circle at 1.5px 1.5px, rgba(120,170,255,0.95) 1.6px, transparent 0)",
          backgroundSize: "56px 56px",
          backgroundPosition: "28px 28px",
          maskImage:
            "radial-gradient(ellipse 95% 85% at 50% 20%, black 50%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 95% 85% at 50% 20%, black 50%, transparent 100%)",
        }}
      />

      {/* Soft diagonal "route" sweeps for movement */}
      <div
        className="absolute -inset-x-10 inset-y-0"
        style={{
          opacity: 0.5,
          backgroundImage:
            "repeating-linear-gradient(-24deg, transparent 0, transparent 118px, rgba(120,170,255,0.06) 118px, rgba(120,170,255,0.06) 120px)",
          maskImage: "linear-gradient(105deg, black 0%, transparent 62%)",
          WebkitMaskImage: "linear-gradient(105deg, black 0%, transparent 62%)",
        }}
      />

      {/* Gentle glow that lifts the pattern near the top-center */}
      <div
        className="absolute left-1/2 top-[-18%] h-[520px] w-[820px] -translate-x-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(closest-side, rgba(46,116,236,0.22), transparent 72%)",
        }}
      />
    </div>
  );
}
