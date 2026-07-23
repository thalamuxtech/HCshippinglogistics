import Link from "next/link";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────
// Brand Logo — placeholder wordmark + monogram.
// When the client supplies the official logo, drop it into
// /public/brand/logo.svg (and logo-mark.svg) and swap the JSX in
// <LogoMark /> for an <Image src="/brand/logo.svg" ... />.
// Everything else (header, footer, favicon references) reads from here.
// ─────────────────────────────────────────────────────────────

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative inline-flex h-9 w-9 items-center justify-center rounded-lg bg-navy-gradient shadow-premium",
        className
      )}
      aria-hidden="true"
    >
      {/* Gold "H" monogram with a subtle vessel line */}
      <svg viewBox="0 0 32 32" className="h-6 w-6" fill="none">
        <path
          d="M9 7v18M23 7v18M9 16h14"
          stroke="#D4A017"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        <path d="M6 26h20" stroke="#D4A017" strokeWidth="1.6" strokeLinecap="round" opacity="0.5" />
      </svg>
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
    <span className={cn("group inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      {showText && (
        <span className="flex flex-col leading-none">
          <span
            className={cn(
              "text-[15px] font-extrabold tracking-tight",
              variant === "light" ? "text-white" : "text-navy"
            )}
          >
            Highclass
          </span>
          <span
            className={cn(
              "text-[10px] font-semibold uppercase tracking-[0.22em]",
              variant === "light" ? "text-gold-200" : "text-gold-600"
            )}
          >
            Shipping &amp; Logistics
          </span>
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
