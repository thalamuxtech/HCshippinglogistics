"use client";

// ─────────────────────────────────────────────────────────────
// Staff-portal host restriction.
//
// Staff sign in ONLY on the app host. The marketing domain serves the public
// site, and must never reveal that a portal exists on a different address.
//
// Two rules follow from that:
//  1. The portal host is NEVER rendered into public markup. No notice, no link,
//     no "use this address instead" hint — publishing the URL would defeat the
//     point of keeping it off the marketing site.
//  2. On the wrong host the login form stays fully functional-looking and simply
//     never succeeds, returning the same "Incorrect email or password" a genuine
//     typo produces. A visitor cannot distinguish a blocked host from bad
//     credentials, so there is nothing to probe for.
//
// Why this is enforced in the app rather than in Firebase Auth: the Auth
// "authorized domains" list only gates OAuth popup/redirect flows. Email +
// password sign-in — which is what staff use — is NOT restricted by it, so a
// login form served from any origin authenticates happily. The gate therefore
// has to live where the sign-in is initiated.
//
// This is obscurity, not a security boundary: the bundle is public, so a
// determined reader can find the host. The real protections remain the password
// and the role-based Firestore rules. Its value is keeping the portal out of
// casual reach and off search engines.
// ─────────────────────────────────────────────────────────────

import { COMPANY } from "./constants";

/** Hosts where the staff portal may run. */
const ALLOWED_PORTAL_HOSTS = [
  COMPANY.webApp, // highclassshippinglogistics.web.app
  `${COMPANY.webApp.split(".")[0]}.firebaseapp.com`, // Firebase's alternate host
  "localhost",
  "127.0.0.1",
];

/**
 * Is the current host allowed to run the staff portal?
 *
 * Returns true during server rendering / static export, where there is no
 * `window` — the check is re-evaluated on the client, and defaulting to
 * "blocked" would bake a blocked state into the prerendered HTML.
 *
 * Deliberately the ONLY export: a helper that returned the portal URL would
 * inevitably get rendered into a page somewhere, which is exactly the leak this
 * module exists to prevent.
 */
export function isPortalHostAllowed(): boolean {
  if (typeof window === "undefined") return true;
  const host = window.location.hostname.toLowerCase();
  return ALLOWED_PORTAL_HOSTS.some((allowed) => host === allowed.toLowerCase());
}
