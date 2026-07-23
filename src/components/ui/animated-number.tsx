"use client";

import * as React from "react";
import { useSpring, useTransform, motion, useReducedMotion } from "framer-motion";

// Smoothly animates a number (e.g. a running order total) when it changes.
// Formats via Intl currency by default; respects prefers-reduced-motion.
export function AnimatedNumber({
  value,
  currency = "USD",
  className,
  plain = false,
}: {
  value: number;
  currency?: string;
  className?: string;
  plain?: boolean;
}) {
  const reduce = useReducedMotion();
  const spring = useSpring(value, { stiffness: 120, damping: 20, mass: 0.6 });

  React.useEffect(() => {
    if (reduce) spring.set(value);
    else spring.set(value);
  }, [value, spring, reduce]);

  const text = useTransform(spring, (v) => {
    const n = Math.round(v * 100) / 100;
    if (plain) return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(n);
  });

  if (reduce) {
    const formatted = plain
      ? Math.round(value).toLocaleString("en-US")
      : new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value || 0);
    return <span className={className}>{formatted}</span>;
  }

  return <motion.span className={className}>{text}</motion.span>;
}
