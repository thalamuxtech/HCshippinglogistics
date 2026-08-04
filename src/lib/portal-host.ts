"use client";

// ─────────────────────────────────────────────────────────────
// Staff-portal host restriction.
//
// Staff may only sign in on the app host (…web.app). The marketing domain
// (highclassshippinglogistics.com) serves the public site only.
//
// Why this is enforced in the app rather than in Firebase Auth: the Auth
// "authorized domains" list only gates OAuth popup/redirect flows. Email +
// password sign-in — which is what staff use — is NOT restricted by it, so a
// login form served from any origin authenticates happily. The gate therefore
// has to live where the sign-in is initiated.
//
// This is a routing/consistency control, not a security boundary: anyone can run
// their own page against the same Firebase project. The real protections remain
// the password itself and the role-based Firestore rules. Its purpose is to keep
// one canonical portal URL — so sessions, saved links and the idle-timeout
// deadline all live on a single origin instead of being split across two hosts.
// ─────────────────────────────────────────────────────────────

import { COMPANY } from "./constants";

/** Hosts where the staff portal may run. */
const ALLOWED_PORTAL_HOSTS = [
  COMPANY.webApp, // highclassshippinglogistics.web.app
  `${COMPANY.webApp.split(".")[0]}.firebaseapp.com`, // Firebase's alternate host
  "localhost",
  "127.0.0.1",
];

/** The canonical portal origin, used to redirect staff to the right host. */
export const PORTAL_ORIGIN = `https://${COMPANY.webApp}`;

/**
 * Is the current host allowed to run the staff portal?
 *
 * Returns true during server rendering / static export, where there is no
 * `window` — the check is re-evaluated on the client, and defaulting to "blocked"
 * would flash a warning into the prerendered HTML of every portal page.
 */
export function isPortalHostAllowed(): boolean {
  if (typeof window === "undefined") return true;
  const host = window.location.hostname.toLowerCase();
  return ALLOWED_PORTAL_HOSTS.some(
    (allowed) => host === allowed.toLowerCase()
  );
}

/** Same path and query on the canonical portal host. */
export function portalUrlForCurrentPath(): string {
  if (typeof window === "undefined") return PORTAL_ORIGIN;
  const { pathname, search, hash } = window.location;
  return `${PORTAL_ORIGIN}${pathname}${search}${hash}`;
}
