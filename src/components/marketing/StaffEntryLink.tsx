"use client";

// Discreet staff entry point in the footer.
//
// Shown ONLY on the portal host. On the public domain /login renders a 404, so a
// padlock there would advertise a portal and then lead somewhere dead. On the
// portal host it is a genuine convenience for staff.
//
// Split into its own client component because SiteFooter is a server component
// and the host is only knowable in the browser.

import Link from "next/link";
import * as React from "react";
import { Lock } from "lucide-react";
import { isPortalHostAllowed } from "@/lib/portal-host";

export function StaffEntryLink() {
  // Starts hidden: the static export prerenders this markup, and rendering the
  // padlock by default would ship it into the public domain's HTML before the
  // host check could remove it.
  const [show, setShow] = React.useState(false);
  React.useEffect(() => {
    setShow(isPortalHostAllowed());
  }, []);

  if (!show) return null;

  return (
    <Link
      href="/login"
      className="inline-flex items-center text-white/25 transition-colors hover:text-gold-200 focus-ring rounded"
      aria-label="Staff sign in"
      title="Staff sign in"
    >
      <Lock className="h-3.5 w-3.5" />
    </Link>
  );
}
