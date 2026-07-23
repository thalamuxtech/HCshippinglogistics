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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = React.useState<FirebaseUser | null>(null);
  const [user, setUser] = React.useState<AppUser | null>(null);
  const [loading, setLoading] = React.useState(true);

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
        // Live-subscribe to the profile so role/active changes propagate.
        unsubProfile = onSnapshot(
          doc(db, "users", fbUser.uid),
          (snap) => {
            if (snap.exists()) setUser({ id: snap.id, ...(snap.data() as Omit<AppUser, "id">) });
            else setUser(null);
            setLoading(false);
          },
          () => setLoading(false)
        );
      } else {
        setUser(null);
        setLoading(false);
      }
    });
    return () => {
      unsub();
      unsubProfile?.();
    };
  }, []);

  const signOut = React.useCallback(async () => {
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
