// ─────────────────────────────────────────────────────────────
// Client-side notification helper.
// Calls Firebase Cloud Function callables (email / SMS / sailing
// broadcast / receipt PDF). Until Resend/Twilio keys are wired,
// the functions run in "stub" mode: they LOG to Firestore and
// return success, so the whole flow works end-to-end now.
// ─────────────────────────────────────────────────────────────

import { getFunctions, httpsCallable } from "firebase/functions";
import app from "./firebase";
import type { ShipmentStatus } from "./types";

const functions = getFunctions(app);

export interface StageEmailPayload {
  shipmentId: string;
  customerId: string;
  status: ShipmentStatus;
  extraNote?: string;
}

export async function sendStageUpdateEmail(payload: StageEmailPayload): Promise<{ ok: boolean }> {
  try {
    const fn = httpsCallable(functions, "sendStageUpdateEmail");
    const res = await fn(payload);
    return (res.data as { ok: boolean }) ?? { ok: true };
  } catch (e) {
    // Non-fatal in stub mode / offline; surface but don't crash the UI.
    console.warn("sendStageUpdateEmail failed", e);
    return { ok: false };
  }
}

export interface SailingBroadcastPayload {
  subject: string;
  body: string;
  filters: { service_type?: string; shipping_line?: string; destination?: string };
}

export async function sendSailingBroadcast(
  payload: SailingBroadcastPayload
): Promise<{ ok: boolean; recipientCount: number; recipientIds: string[] }> {
  const fn = httpsCallable(functions, "sendSailingBroadcast");
  const res = await fn(payload);
  return res.data as { ok: boolean; recipientCount: number; recipientIds: string[] };
}

export async function sendAccessCodeEmail(payload: {
  email: string;
  fullName: string;
  code?: string;
}): Promise<{ ok: boolean }> {
  try {
    const fn = httpsCallable(functions, "sendAccessCodeEmail");
    const res = await fn(payload);
    return (res.data as { ok: boolean }) ?? { ok: true };
  } catch (e) {
    console.warn("sendAccessCodeEmail failed", e);
    return { ok: false };
  }
}

export async function generateReceiptPdf(payload: {
  shipmentId: string;
}): Promise<{ ok: boolean; pdfUrl?: string; receiptNumber?: string }> {
  const fn = httpsCallable(functions, "generateReceiptPdf");
  const res = await fn(payload);
  return res.data as { ok: boolean; pdfUrl?: string; receiptNumber?: string };
}

// ── Admin: staff management (server-side, admin-guarded) ──
export async function createStaffUser(payload: {
  email: string;
  fullName: string;
  role: "admin" | "nigeria_office" | "dispatcher";
  phone?: string;
  assignedCountry?: string;
}): Promise<{ ok: boolean; uid: string; tempPassword: string }> {
  const fn = httpsCallable(functions, "createStaffUser");
  const res = await fn(payload);
  return res.data as { ok: boolean; uid: string; tempPassword: string };
}

export async function updateStaffUser(payload: {
  uid: string;
  role?: "admin" | "nigeria_office" | "dispatcher" | "customer";
  assignedCountry?: string;
  isActive?: boolean;
}): Promise<{ ok: boolean }> {
  const fn = httpsCallable(functions, "updateStaffUser");
  const res = await fn(payload);
  return res.data as { ok: boolean };
}
