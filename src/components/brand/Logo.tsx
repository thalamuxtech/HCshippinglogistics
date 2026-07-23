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

export function LogoMark({ className, size = 40 }: { className?: string; size?: number }) {
  return (
    <span
      className={cn("relative inline-flex items-center justify-center overflow-hidden", className)}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {/* Crop to the crest area for a compact square mark */}
      <Image
        src={LOGO_SRC}
        alt=""
        width={LOGO_W}
        height={LOGO_H}
        className="max-w-none object-cover"
        style={{ width: size * 1.5, height: "auto" }}
        priority
      />
    </span>
  );
}

export function Logo({
  className,
  variant = "dark",
  href = "/",
  showText = true,
}: {
  className?: string;
  variant?: "dark" | "light";
  href?: string | null;
  showText?: boolean;
}) {
  const content = (
    <span className={cn("group inline-flex items-center", className)}>
      <span
        className={cn(
          "inline-flex items-center rounded-lg",
          variant === "light" ? "bg-white p-1.5 shadow-sm" : ""
        )}
      >
        <Image
          src={LOGO_SRC}
          alt="Highclass Shipping and Logistics Inc."
          width={LOGO_W}
          height={LOGO_H}
          className="h-9 w-auto sm:h-10"
          priority
        />
      </span>
      {/* The wordmark is inside the crest already; keep text off by default to avoid duplication */}
      {showText && false && (
        <span className="ml-2 flex flex-col leading-none">
          <span className="text-[15px] font-extrabold tracking-tight text-navy">Highclass</span>
        </span>
      )}
    </span>
  );

  if (href === null) return content;
  return (
    <Link href={href} className="focus-ring rounded-lg" aria-label="Highclass Shipping — home">
      {content}
    </Link>
  );
}
