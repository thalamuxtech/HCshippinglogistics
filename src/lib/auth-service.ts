// ─────────────────────────────────────────────────────────────
// Auth service — signup, access-code issuance, and return.
// Ties Firebase Auth + Firestore user doc + Customer Access Code
// (Implementation Plan §13.1) together.
// ─────────────────────────────────────────────────────────────

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
} from "firebase/auth";
import { httpsCallable, getFunctions } from "firebase/functions";
import { auth } from "./firebase";
import fbApp from "./firebase";
import { createUserDoc, updateUserDoc, nextCounter, getUser, logActivity } from "./db";
import {
  buildAccessCode,
  accessCodePrefix,
  hashAccessCode,
  generateSalt,
  validateCheckChar,
  normalizeCode,
} from "./access-code";
import type { AppUser } from "./types";

const functions = getFunctions(fbApp);

export interface SignupInput {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
  birthYearMonth: string; // YYMM
  zip: string;
}

export interface SignupResult {
  uid: string;
  accessCode: string; // plaintext — show ONCE
}

/**
 * Create a customer account:
 *  1. Firebase Auth user (email/password)
 *  2. Generate the unique Customer Access Code (serial-backed, check char)
 *  3. Store salted hash + non-secret prefix + inputs on the Firestore user doc
 * Returns the plaintext access code to display once + email.
 */
export async function signupCustomer(input: SignupInput): Promise<SignupResult> {
  const cred = await createUserWithEmailAndPassword(
    auth,
    input.email.trim().toLowerCase(),
    input.password
  );
  const uid = cred.user.uid;

  try {
    await updateProfile(cred.user, { displayName: input.fullName });
  } catch {
    /* non-fatal */
  }

  // Serial guarantees uniqueness of the logical-serial segment.
  const serial = await nextCounter("customer");
  const accessCode = buildAccessCode({
    fullName: input.fullName,
    birthYearMonth: input.birthYearMonth,
    zip: input.zip,
    serial,
  });

  const salt = generateSalt();
  const hash = await hashAccessCode(accessCode, salt);

  const userDoc: Partial<AppUser> & { access_code_salt?: string } = {
    email: input.email.trim().toLowerCase(),
    full_name: input.fullName,
    phone: input.phone || "",
    role: "customer",
    access_code_hash: hash,
    access_code_salt: salt,
    access_code_prefix: accessCodePrefix(accessCode),
    access_code_version: 1,
    birth_year_month: input.birthYearMonth,
    zip_code: input.zip,
    is_active: true,
    notify_email: true,
    notify_sms: true,
  };

  await createUserDoc(uid, userDoc);
  await logActivity({
    actor_id: uid,
    actor_name: input.fullName,
    actor_role: "customer",
    action: "signup",
    target: uid,
  });

  return { uid, accessCode };
}

export async function login(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
}

export async function resetPassword(email: string) {
  return sendPasswordResetEmail(auth, email.trim().toLowerCase());
}

/**
 * Resolve a customer by access code WITHOUT signing them in.
 * Used on the "Return with access code" screen to recognize a returning
 * customer. The check character is validated locally first (rejects typos
 * before any network call), then a Cloud Function (resolveAccessCode) does
 * the salted-hash match with Admin privileges — so the public `users`
 * collection is NEVER exposed to unauthenticated reads.
 *
 * NOTE: full account access still requires the email/password login
 * (Firebase Auth). The access code is the human-friendly recognition key.
 */
export async function lookupByAccessCode(
  code: string
): Promise<{ found: boolean; hint?: string }> {
  const clean = normalizeCode(code);
  if (!validateCheckChar(clean)) {
    return { found: false, hint: "That code looks mistyped — please re-check it." };
  }
  try {
    const fn = httpsCallable(functions, "resolveAccessCode");
    const res = await fn({ code: clean });
    const data = res.data as { found: boolean; email?: string };
    if (data.found) return { found: true, hint: data.email };
    return { found: false, hint: "No matching account. Try logging in with your email." };
  } catch {
    return { found: false, hint: "Could not verify the code right now. Try logging in with your email." };
  }
}

/** Regenerate a customer's access code (admin action). Returns plaintext once. */
export async function regenerateAccessCode(
  uid: string
): Promise<{ accessCode: string } | null> {
  const user = await getUser(uid);
  if (!user) return null;
  const serial = await nextCounter("customer");
  const accessCode = buildAccessCode({
    fullName: user.full_name,
    birthYearMonth: user.birth_year_month || "0000",
    zip: user.zip_code || "00",
    serial,
  });
  const salt = generateSalt();
  const hash = await hashAccessCode(accessCode, salt);
  await updateUserDoc(uid, {
    access_code_hash: hash,
    access_code_version: (user.access_code_version || 1) + 1,
    access_code_prefix: accessCodePrefix(accessCode),
    // @ts-expect-error salt is an internal field not in AppUser public type
    access_code_salt: salt,
  });
  // Callers log this action with their own actor_id (admin or the customer
  // themselves) so the audit trail is correctly attributed.
  return { accessCode };
}
