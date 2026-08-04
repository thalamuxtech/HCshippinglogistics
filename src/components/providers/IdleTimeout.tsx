"use client";

// ─────────────────────────────────────────────────────────────
// Inactivity auto-logout for signed-in staff.
//
// Staff portals show customer addresses, phone numbers and invoice totals, and
// warehouse/office machines are shared. An unattended session is the realistic
// exposure, so idle sessions end themselves.
//
// Design notes:
//  - The timer is driven by a DEADLINE TIMESTAMP, not a countdown that decrements.
//    A setInterval-based counter drifts and, more importantly, stops running when
//    a phone backgrounds the tab — the session would then outlive the timeout.
//    Comparing against a stored deadline is correct even after the tab is frozen,
//    suspended, or the machine sleeps ("restart if there is interruption").
//  - The deadline lives in localStorage, so ACTIVITY IN ANY TAB counts for all of
//    them. Otherwise a second tab left open on a dashboard would log the user out
//    while they were actively working in the first.
//  - The warning is a modal with a live countdown; any real interaction dismisses
//    it and resets the clock.
// ─────────────────────────────────────────────────────────────

import * as React from "react";
import { usePathname } from "next/navigation";
import { Clock, LogOut } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { Button } from "@/components/ui/button";

/** Total idle time before sign-out. */
const IDLE_MS = 20 * 60 * 1000; // 20 minutes
/** How long the countdown warning is visible before sign-out. */
const WARN_MS = 60 * 1000; // last 60 seconds
/** Deadline shared across tabs for the same browser profile. */
const DEADLINE_KEY = "hc_idle_deadline";

// Passive so scrolling stays smooth; these are the signals that mean "a human is
// here". `scroll` is included because reading a long shipment list is real use.
const ACTIVITY_EVENTS = [
  "pointerdown",
  "keydown",
  "wheel",
  "touchstart",
  "scroll",
  "focus",
] as const;

function readDeadline(): number | null {
  try {
    const raw = localStorage.getItem(DEADLINE_KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function writeDeadline(at: number) {
  try {
    localStorage.setItem(DEADLINE_KEY, String(at));
  } catch {
    /* private mode / quota — the in-memory ref still drives this tab */
  }
}

export function IdleTimeout() {
  const { firebaseUser, user, signOut } = useAuth();
  const pathname = usePathname();
  const signedIn = !!firebaseUser;

  // Seconds left once the warning is showing; null means "not warning".
  const [secondsLeft, setSecondsLeft] = React.useState<number | null>(null);
  // Ref mirror so event handlers do not need to re-bind on every tick.
  const deadlineRef = React.useRef<number>(0);
  const signingOutRef = React.useRef(false);

  // Throttle only the RATE of activity handling, not the write itself: because
  // the tick takes the earlier of (in-memory, stored), an unwritten extension
  // would be pulled straight back to the stale stored value. So when we do
  // extend, memory and storage must move together.
  const lastResetRef = React.useRef(0);

  const reset = React.useCallback((force = false) => {
    const now = Date.now();
    // Coalesce bursts (scroll fires continuously) to at most one reset/second.
    if (!force && now - lastResetRef.current < 1000) return;
    lastResetRef.current = now;
    const next = now + IDLE_MS;
    deadlineRef.current = next;
    writeDeadline(next);
    setSecondsLeft(null);
  }, []);

  // Start (and restart on navigation) whenever a session is active.
  React.useEffect(() => {
    if (!signedIn) {
      setSecondsLeft(null);
      return;
    }
    // Adopt an existing deadline from another tab rather than extending it, so
    // opening a new tab cannot be used to keep an idle session alive forever.
    const existing = readDeadline();
    if (existing && existing > Date.now()) {
      deadlineRef.current = existing;
    } else {
      // force: first deadline of the session must be visible to other tabs.
      reset(true);
    }
  }, [signedIn, pathname, reset]);

  // Mirror of `secondsLeft` for the activity handler. Reading it from a ref keeps
  // the listener effect from re-binding every second while the countdown ticks.
  const warningRef = React.useRef(false);
  warningRef.current = secondsLeft !== null;

  // Activity listeners. Bound once per session, not per tick.
  React.useEffect(() => {
    if (!signedIn) return;
    const onActivity = () => {
      // While the warning is up, only an explicit button press should count —
      // otherwise an accidental scroll silently cancels a logout the user never
      // saw. Everything else resets normally.
      if (warningRef.current) return;
      reset();
    };
    ACTIVITY_EVENTS.forEach((e) =>
      window.addEventListener(e, onActivity, { passive: true })
    );
    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
    };
  }, [signedIn, reset]);

  // Cross-tab sync: another tab resetting the deadline clears our warning too.
  React.useEffect(() => {
    if (!signedIn) return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== DEADLINE_KEY || !e.newValue) return;
      const next = Number(e.newValue);
      if (Number.isFinite(next) && next > deadlineRef.current) {
        deadlineRef.current = next;
        setSecondsLeft(null);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [signedIn]);

  // The clock. One interval that compares against the deadline, so a frozen or
  // suspended tab is handled correctly the moment it resumes.
  React.useEffect(() => {
    if (!signedIn) return;
    const tick = async () => {
      // Re-read the shared deadline each tick and take the EARLIER of the two.
      // localStorage is the cross-tab source of truth, and the `storage` event
      // never fires in the tab that wrote it — so polling here is what makes a
      // deadline set elsewhere (or cleared by a sign-out) take effect. Taking
      // the earlier value means a session can never be silently extended.
      const shared = readDeadline();
      if (shared !== null && shared < deadlineRef.current) {
        deadlineRef.current = shared;
      }
      const remaining = deadlineRef.current - Date.now();
      if (remaining <= 0) {
        if (signingOutRef.current) return;
        signingOutRef.current = true;
        try {
          localStorage.removeItem(DEADLINE_KEY);
        } catch {
          /* ignore */
        }
        // ?timeout=1 lets the login page explain why they were signed out.
        try {
          await signOut();
        } finally {
          window.location.href = "/login?timeout=1";
        }
        return;
      }
      setSecondsLeft(remaining <= WARN_MS ? Math.ceil(remaining / 1000) : null);
    };
    void tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [signedIn, signOut]);

  if (!signedIn || secondsLeft === null) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="idle-title"
      aria-describedby="idle-desc"
    >
      <div className="absolute inset-0 bg-navy-950/60 backdrop-blur-sm" aria-hidden />
      <div className="animate-fade-up relative z-10 w-full max-w-sm rounded-2xl border border-border bg-white p-6 text-center shadow-premium">
        <span className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-600">
          <Clock className="h-7 w-7" />
        </span>
        <h2 id="idle-title" className="text-lg font-bold text-navy">
          Still there?
        </h2>
        <p id="idle-desc" className="mt-2 text-sm text-ink-muted">
          {user?.full_name ? `${user.full_name.split(" ")[0]}, you` : "You"} will be signed out in
        </p>

        <p
          className="mt-3 font-mono text-5xl font-bold tabular-nums text-navy"
          aria-live="polite"
          aria-atomic="true"
        >
          {secondsLeft}
        </p>
        <p className="mt-1 text-xs text-ink-muted">
          second{secondsLeft === 1 ? "" : "s"} — for your security after 20 minutes of inactivity
        </p>

        <div className="mt-6 flex flex-col gap-2">
          {/* force: persist immediately so other tabs cancel their warning too */}
          <Button
            variant="gold"
            size="lg"
            className="w-full"
            onClick={() => reset(true)}
            autoFocus
          >
            Stay signed in
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => {
              try {
                localStorage.removeItem(DEADLINE_KEY);
              } catch {
                /* ignore */
              }
              void signOut();
            }}
          >
            <LogOut className="h-4 w-4" /> Sign out now
          </Button>
        </div>
      </div>
    </div>
  );
}
