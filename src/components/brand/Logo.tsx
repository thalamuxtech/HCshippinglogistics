import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────
// Brand Logo — official Highclass Shipping & Logistics mark.
// File: /public/brand/logo.png (ship + plane oval crest).
// The crest has a white background, so on dark surfaces (footer/hero)
// pass variant="light" to wrap it in a white rounded plate.
// ─────────────────────────────────────────────────────────────

const LOGO_SRC = "/brand/logo.png";
const LOGO_W = 768;
const LOGO_H = 512;

// Compact square mark (staff sidebar, small placements). Uses the clean
// square brand icon so it stays crisp at any size.
export function LogoMark({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/icon.svg"
      alt=""
      width={40}
      height={40}
      className={cn("rounded-lg", className)}
      aria-hidden="true"
    />
  );
}

export function Logo({
  className,
  variant = "dark",
  href = "/",
  size = "md",
}: {
  className?: string;
  variant?: "dark" | "light";
  href?: string | null;
  size?: "md" | "lg" | "xl";
}) {
  const imgH =
    size === "xl" ? "h-14 sm:h-16" : size === "lg" ? "h-12 sm:h-14" : "h-11 sm:h-12";
  const content = (
    <span className={cn("group inline-flex items-center", className)}>
      <span
        className={cn(
          "inline-flex items-center rounded-xl transition-transform duration-300 group-hover:scale-[1.02]",
          variant === "light" ? "bg-white p-2 shadow-sm" : ""
        )}
      >
        <Image
          src={LOGO_SRC}
          alt="Highclass Shipping and Logistics Inc."
          width={LOGO_W}
          height={LOGO_H}
          className={cn(imgH, "w-auto")}
          priority
        />
      </span>
    </span>
  );

  if (href === null) return content;
  return (
    <Link href={href} className="focus-ring rounded-xl" aria-label="Highclass Shipping, home">
      {content}
    </Link>
  );
}
