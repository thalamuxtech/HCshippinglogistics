"use client";

import * as React from "react";
import { getSiteContent } from "@/lib/db";

// Renders a single admin-managed copy field from site_content/home, with an
// instant fallback (the default is in the SSR HTML, so it's SEO-safe and has
// no flash). The admin Content editor writes these same keys.
//
// A tiny module-level cache means multiple <ManagedText> on the same page
// only fetch the document once.
let cache: Record<string, unknown> | null | undefined;
const listeners = new Set<() => void>();
let inflight: Promise<void> | null = null;

function ensureLoaded() {
  if (cache !== undefined) return;
  if (!inflight) {
    inflight = getSiteContent("home")
      .then((d) => {
        cache = d;
      })
      .catch(() => {
        cache = null;
      })
      .finally(() => {
        listeners.forEach((l) => l());
      });
  }
}

export function ManagedText({
  field,
  fallback,
  className,
}: {
  field: string;
  fallback: string;
  className?: string;
}) {
  const [, force] = React.useReducer((x) => x + 1, 0);

  React.useEffect(() => {
    listeners.add(force);
    ensureLoaded();
    return () => {
      listeners.delete(force);
    };
  }, []);

  const managed =
    cache && typeof cache[field] === "string" && (cache[field] as string).trim()
      ? (cache[field] as string)
      : fallback;

  return <span className={className}>{managed}</span>;
}
