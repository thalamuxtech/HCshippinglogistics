"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

type Variant = "primary" | "gold" | "outline" | "ghost" | "subtle" | "destructive" | "link";
type Size = "sm" | "md" | "lg" | "icon";

const variants: Record<Variant, string> = {
  primary:
    "bg-navy text-white hover:bg-navy-700 shadow-card",
  gold: "bg-gold-gradient text-navy font-semibold hover:brightness-105 shadow-gold",
  outline:
    "border border-navy/20 bg-white text-navy hover:bg-navy/5",
  ghost: "text-navy hover:bg-navy/5",
  subtle: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  link: "text-navy underline-offset-4 hover:underline hover:text-gold-600",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm rounded-md gap-1.5",
  md: "h-11 px-5 text-sm rounded-lg gap-2",
  lg: "h-12 px-7 text-base rounded-lg gap-2",
  icon: "h-10 w-10 rounded-lg",
};

const base =
  "inline-flex items-center justify-center whitespace-nowrap font-medium transition-all duration-200 focus-ring disabled:pointer-events-none disabled:opacity-50 cursor-pointer select-none";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  )
);
Button.displayName = "Button";

export function ButtonLink({
  className,
  variant = "primary",
  size = "md",
  href,
  children,
  external,
  ...props
}: {
  className?: string;
  variant?: Variant;
  size?: Size;
  href: string;
  children: React.ReactNode;
  external?: boolean;
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  const cls = cn(base, variants[variant], sizes[size], className);
  if (external) {
    return (
      <a href={href} className={cls} target="_blank" rel="noreferrer" {...props}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={cls} {...props}>
      {children}
    </Link>
  );
}
