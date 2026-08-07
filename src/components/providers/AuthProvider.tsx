"use client";

import * as React from "react";
import {
  onAuthStateChanged,
  signOut as fbSignOut,
  type User as FirebaseUser,
} from "firebase/auth";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import type { AppUser, Role } from "@/lib/types";

interface AuthState {
  firebaseUser: FirebaseUser | null;
  user: AppUser | null;
  role: Role | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = React.createContext<AuthState | null>(null);

export function useAuth() {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

// ─── Profile cache ───────────────────────────────────────────
// Every navigation used to block on two sequential round trips: Firebase Auth
// restoring the session, then a Firestore read of the user doc. That is where the
// 500-700ms of "Verifying access…" on each page change came from.
//
// The profile is cached in sessionStorage so a navigation renders immediately from
// the last known role, while the live onSnapshot subscription still runs and
// corrects it a moment later. sessionStorage (not localStorage) because it dies
// with the tab, so a shared machine never leaks the previous user's role into a
// new session.
//
// This is a rendering optimisation, not a security decision: Firestore rules and
// the server callables remain the only real gate, so a tampered cache buys
// nothing beyond briefly seeing a menu whose data will not load.
const CACHE_KEY = "hc_profile";

function readCachedProfile(): AppUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppUser;
    return parsed?.id && parsed?.role ? parsed : null;
  } catch {
    return null;
  }
}

function writeCachedProfile(u: AppUser | null) {
  try {
    if (u) sessionStorage.setItem(CACHE_KEY, JSON.stringify(u));
    else sessionStorage.removeItem(CACHE_KEY);
  } catch {
    /* private mode / quota: the app still works, just without the fast path */
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = React.useState<FirebaseUser | null>(null);
  // Seed from cache so the first paint of a navigation already knows the role.
  const [user, setUser] = React.useState<AppUser | null>(() => readCachedProfile());
  // Only block the UI when there is nothing cached to render from.
  const [loading, setLoading] = React.useState(() => readCachedProfile() === null);

  const loadProfile = React.useCallback(async (uid: string) => {
    const snap = await getDoc(doc(db, "users", uid));
    if (snap.exists()) setUser({ id: snap.id, ...(snap.data() as Omit<AppUser, "id">) });
    else setUser(null);
  }, []);

  React.useEffect(() => {
    let unsubProfile: (() => void) | undefined;
    const unsub = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser);
      unsubProfile?.();
      if (fbUser) {
        // Live-subscribe to the profile so role/active changes propagate. The
        // cached copy is written on every snapshot, so it never goes stale for
        // longer than one navigation.
        unsubProfile = onSnapshot(
          doc(db, "users", fbUser.uid),
          (snap) => {
            const next = snap.exists()
              ? ({ id: snap.id, ...(snap.data() as Omit<AppUser, "id">) } as AppUser)
              : null;
            setUser(next);
            writeCachedProfile(next);
            setLoading(false);
          },
          () => setLoading(false)
        );
      } else {
        // Signed out, or the session expired: the cache must go with it, or the
        // next page load would render a menu for a user who is no longer here.
        setUser(null);
        writeCachedProfile(null);
        setLoading(false);
      }
    });
    return () => {
      unsub();
      unsubProfile?.();
    };
  }, []);

  const signOut = React.useCallback(async () => {
    // Clear the cache BEFORE the async sign-out: if the network call is slow or
    // fails, the cached role must already be gone.
    writeCachedProfile(null);
    await fbSignOut(auth);
    setUser(null);
  }, []);

  const refresh = React.useCallback(async () => {
    if (firebaseUser) await loadProfile(firebaseUser.uid);
  }, [firebaseUser, loadProfile]);

  const value: AuthState = {
    firebaseUser,
    user,
    role: user?.role ?? null,
    loading,
    signOut,
    refresh,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
