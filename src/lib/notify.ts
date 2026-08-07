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

/**
 * Tell the customer their off-list item has been priced, so they know the total
 * changed before being asked to pay.
 */
export async function sendQuoteReadyEmail(payload: {
  shipmentId: string;
  note?: string;
}): Promise<{ ok: boolean; skipped?: boolean; to?: string }> {
  try {
    const fn = httpsCallable(functions, "sendQuoteReadyEmail");
    const res = await fn(payload);
    return (res.data as { ok: boolean; skipped?: boolean; to?: string }) ?? { ok: true };
  } catch (e) {
    console.warn("sendQuoteReadyEmail failed", e);
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
): Promise<{ ok: boolean; recipientCount: number; recipientIds: string[]; failedCount?: number; error?: string | null }> {
  const fn = httpsCallable(functions, "sendSailingBroadcast");
  const res = await fn(payload);
  return res.data as { ok: boolean; recipientCount: number; recipientIds: string[]; failedCount?: number; error?: string | null };
}

export interface PublicOrderInput {
  service_type: "sea" | "air" | "roro";
  full_name: string;
  email: string;
  phone: string;
  dob?: string; // YYYY-MM-DD (age computed server-side)
  address: string; // sender's USA address — required (on the invoice, and the
  // fallback collection point for a door-to-door pickup)
  fragile?: boolean;
  fragile_note?: string;
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
): Promise<{
  ok: boolean;
  customerId: string;
  trackingNumber: string;
  total: number;
  /** False when the confirmation email (which carries the Customer ID) failed. */
  emailSent?: boolean;
}> {
  const fn = httpsCallable(functions, "submitPublicOrder");
  const res = await fn(payload);
  return res.data as {
    ok: boolean;
    customerId: string;
    trackingNumber: string;
    total: number;
    emailSent?: boolean;
  };
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
    container_number?: string | null;
    container_shipped_on?: string | null;
    dnr?: boolean;
    dnr_override?: boolean | null;
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

// Admin: send a branded test email to verify the email provider (Brevo).
export async function sendTestEmail(payload: {
  to: string;
}): Promise<{ ok: boolean; provider?: string; stub?: boolean; status?: number | null; error?: string | null }> {
  const fn = httpsCallable(functions, "sendTestEmail");
  const res = await fn(payload);
  return res.data as {
    ok: boolean;
    provider?: string;
    stub?: boolean;
    status?: number | null;
    error?: string | null;
  };
}

// Admin: reply to a contact submission with a branded email (editable recipient).
export async function sendInquiryReply(payload: {
  to: string;
  subject: string;
  message: string;
  inquiryId?: string;
}): Promise<{ ok: boolean; provider?: string; stub?: boolean; status?: number | null; error?: string | null }> {
  const fn = httpsCallable(functions, "sendInquiryReply");
  const res = await fn(payload);
  return res.data as {
    ok: boolean;
    provider?: string;
    stub?: boolean;
    status?: number | null;
    error?: string | null;
  };
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

// Admin: broadcast a premium container-availability notice to all customers on a
// container. Pass testEmail to deliver a single preview to that address instead.
export interface ContainerBroadcastInput {
  containerNumber: string;
  subject: string;
  body: string;
  officeName?: string;
  officeAddress?: string;
  officePhone?: string;
  deliveryContactName?: string;
  deliveryContactPhone?: string;
  nextLoadingDate?: string;
  nextLoadingNote?: string;
  usPhones?: string;
  testEmail?: string;
  /** Explicit, edited recipient list. When set, the broadcast goes to exactly
   *  these addresses instead of being re-derived from the container. */
  emails?: string[];
}

export async function sendContainerBroadcast(
  payload: ContainerBroadcastInput
): Promise<{
  ok: boolean;
  test?: boolean;
  recipientCount: number;
  failedCount?: number;
  recipientIds?: string[];
  recipientEmails?: string[];
  /** Provider rejection reason (e.g. Brevo IP allowlist) when a send failed. */
  error?: string | null;
  stub?: boolean;
}> {
  const fn = httpsCallable(functions, "sendContainerBroadcast");
  const res = await fn(payload);
  return res.data as {
    ok: boolean;
    test?: boolean;
    recipientCount: number;
    failedCount?: number;
    recipientIds?: string[];
    recipientEmails?: string[];
    /** Provider rejection reason (e.g. Brevo IP allowlist) when a send failed. */
    error?: string | null;
    stub?: boolean;
  };
}

// ── Admin: staff management (server-side, admin-guarded) ──
export async function createStaffUser(payload: {
  email: string;
  fullName: string;
  role: "admin" | "nigeria_office" | "dispatcher";
  phone?: string;
  assignedCountry?: string;
  allowedFeatures?: string[] | null;
}): Promise<{ ok: boolean; uid: string; tempPassword: string }> {
  const fn = httpsCallable(functions, "createStaffUser");
  const res = await fn(payload);
  return res.data as { ok: boolean; uid: string; tempPassword: string };
}

export async function updateStaffUser(payload: {
  uid: string;
  role?: "admin" | "nigeria_office" | "dispatcher";
  assignedCountry?: string;
  isActive?: boolean;
  // null clears the override (back to role defaults); an array sets exact access.
  allowedFeatures?: string[] | null;
  fullName?: string;
  /** Also updates the Firebase Auth sign-in email, not just the profile. */
  email?: string;
  phone?: string;
}): Promise<{ ok: boolean }> {
  const fn = httpsCallable(functions, "updateStaffUser");
  const res = await fn(payload);
  return res.data as { ok: boolean };
}

/**
 * Admin: issue a new temporary password for an existing staff account.
 * Returns the plaintext once so the admin can hand it over directly — useful
 * when the staff member cannot receive the reset email.
 */
export async function resetStaffPassword(payload: {
  uid: string;
  /** Omit to have the server generate a random one. */
  password?: string;
}): Promise<{ ok: boolean; tempPassword: string; emailed: boolean }> {
  const fn = httpsCallable(functions, "resetStaffPassword");
  const res = await fn(payload);
  return res.data as { ok: boolean; tempPassword: string; emailed: boolean };
}

// ── Admin: system backup / restore ──

export interface BackupFile {
  ok?: boolean;
  format: number;
  project?: string;
  exported_at: string;
  counts: Record<string, number>;
  total: number;
  data: Record<string, { id: string; data: Record<string, unknown> }[]>;
}

/** Full database export. Runs on the Admin SDK so nothing is missed. */
export async function exportBackup(): Promise<BackupFile> {
  const fn = httpsCallable(functions, "exportBackup");
  const res = await fn({});
  return res.data as BackupFile;
}

/**
 * Restore from a previously exported file.
 * - "merge" writes the backup over current data, leaving unrelated docs alone.
 * - "replace" also deletes documents absent from the backup.
 */
export async function restoreBackup(payload: {
  backup: BackupFile;
  mode: "merge" | "replace";
}): Promise<{
  ok: boolean;
  restored: Record<string, number>;
  writes: number;
  skipped: string[];
  mode: string;
}> {
  const fn = httpsCallable(functions, "restoreBackup");
  const res = await fn(payload);
  return res.data as {
    ok: boolean;
    restored: Record<string, number>;
    writes: number;
    skipped: string[];
    mode: string;
  };
}

// ── Admin: demo customer records (Admin SDK; rules block client writes) ──
export async function seedDemoCustomers(): Promise<{ ok: boolean; created: number }> {
  const fn = httpsCallable(functions, "seedDemoCustomers");
  const res = await fn({});
  return res.data as { ok: boolean; created: number };
}

export async function clearDemoCustomers(): Promise<{ ok: boolean; deleted: number }> {
  const fn = httpsCallable(functions, "clearDemoCustomers");
  const res = await fn({});
  return res.data as { ok: boolean; deleted: number };
}
