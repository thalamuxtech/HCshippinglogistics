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

export interface PublicOrderInput {
  service_type: "sea" | "air" | "roro";
  full_name: string;
  email: string;
  phone?: string;
  dob?: string; // YYYY-MM-DD (age computed server-side)
  address?: string; // sender full address
  destination_country: string;
  destination_city?: string;
  door_to_door?: boolean; // pickup requested (+$50)
  pickup_address?: string;
  notes?: string;
  declared_value?: number;
  receiver: { full_name: string; phone: string; address?: string };
  items?: { s_n: number; quantity: number; description?: string; dimensions?: string }[];
  weight?: number;
  dimensions?: { length: number; width: number; height: number };
  shipping_line?: string;
  vehicle_class?: string;
  vehicle_details?: string;
}

export async function submitPublicOrder(
  payload: PublicOrderInput
): Promise<{ ok: boolean; customerId: string; trackingNumber: string; total: number }> {
  const fn = httpsCallable(functions, "submitPublicOrder");
  const res = await fn(payload);
  return res.data as { ok: boolean; customerId: string; trackingNumber: string; total: number };
}

export interface CustomerView {
  found: boolean;
  customer?: {
    id: string;
    full_name: string;
    email: string;
    phone?: string;
    dob?: string;
    address?: string;
  };
  shipments?: Array<{
    id: string;
    tracking_number: string;
    service_type: string;
    current_status: string;
    destination_country: string;
    destination_city?: string;
    receiver?: { full_name: string; phone: string; address?: string; city?: string } | null;
    items?: { description: string; dimensions?: string; unit_price: number; quantity: number; line_total: number }[];
    weight?: number | null;
    shipping_line?: string | null;
    vehicle_class?: string | null;
    total_price: number;
    deposit: number;
    balance: number;
    payment_status: string;
    currency: string;
    receipt_number?: string | null;
    receipt_pdf_url?: string | null;
    created_at?: number | null;
  }>;
}

export async function viewByCustomerId(customerId: string): Promise<CustomerView> {
  try {
    const fn = httpsCallable(functions, "viewByCustomerId");
    const res = await fn({ customerId });
    return (res.data as CustomerView) ?? { found: false };
  } catch {
    return { found: false };
  }
}

export interface PublicTrackResult {
  found: boolean;
  tracking_number?: string;
  current_status?: string;
  service_type?: string;
  destination_country?: string;
  payment_status?: string;
}

/** Public shipment lookup by tracking number OR customer ID (no auth, safe fields only). */
export async function publicTrack(code: string): Promise<PublicTrackResult> {
  try {
    const fn = httpsCallable(functions, "publicTrack");
    const res = await fn({ code });
    return (res.data as PublicTrackResult) ?? { found: false };
  } catch {
    return { found: false };
  }
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

// Admin: delete a shipment's invoice server-side (removes receipt records,
// the Storage PDF, and clears the shipment's receipt fields).
export async function deleteReceiptPdf(payload: {
  shipmentId: string;
}): Promise<{ ok: boolean; deleted?: number }> {
  const fn = httpsCallable(functions, "deleteReceiptPdf");
  const res = await fn(payload);
  return res.data as { ok: boolean; deleted?: number };
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
