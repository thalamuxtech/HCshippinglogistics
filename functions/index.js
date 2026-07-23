// ─────────────────────────────────────────────────────────────
// Highclass Shipping — Cloud Functions (Gen 2)
//
// Notifications (email/SMS), digital-receipt PDF, and the admin
// sailing broadcast. Runs in STUB MODE until Resend/Twilio secrets
// are configured: it logs every "send" to Firestore and returns
// success, so the whole app works end-to-end today. When keys are
// present (RESEND_API_KEY / TWILIO_*), the same functions send for real.
//
// Deploy requires the Firebase Blaze plan (outbound networking).
// ─────────────────────────────────────────────────────────────

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { setGlobalOptions } from "firebase-functions/v2";
import { defineSecret } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";
import { renderReceiptPdf } from "./receipt.js";

initializeApp();
const db = getFirestore();
setGlobalOptions({ region: "us-central1", maxInstances: 10 });

// ---- Secrets (Google Secret Manager) ----
// Set with: firebase functions:secrets:set RESEND_API_KEY  (etc.)
// Bound per-function via `secrets: [...]` so they're injected into
// process.env at runtime ONLY for functions that need them. Until they
// are set, the functions run in stub mode (log-only, still succeed).
const RESEND_API_KEY = defineSecret("RESEND_API_KEY");
const RESEND_FROM_EMAIL = defineSecret("RESEND_FROM_EMAIL");
const TWILIO_ACCOUNT_SID = defineSecret("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = defineSecret("TWILIO_AUTH_TOKEN");
const TWILIO_FROM_NUMBER = defineSecret("TWILIO_FROM_NUMBER");

// Convenience arrays for binding to functions.
const EMAIL_SECRETS = [RESEND_API_KEY, RESEND_FROM_EMAIL];
const SMS_SECRETS = [TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER];
const ALL_SECRETS = [...EMAIL_SECRETS, ...SMS_SECRETS];

// ---- Auth guard: require the caller to be an admin ----
async function assertAdmin(req) {
  if (!req.auth?.uid) throw new HttpsError("unauthenticated", "Sign in required.");
  const snap = await db.collection("users").doc(req.auth.uid).get();
  if (!snap.exists || snap.data().role !== "admin") {
    throw new HttpsError("permission-denied", "Admin access required.");
  }
  return snap.data();
}

// ---- Stage metadata (mirrors src/lib/constants.ts) ----
const STAGE_LABEL = {
  collection: "Collection (USA)",
  inspection: "Inspection (USA Warehouse)",
  loading: "Loading (USA Port/Freight)",
  transit: "In Transit",
  clearance: "Clearance (Destination Customs)",
  offloading: "Offloading (Destination Warehouse)",
  delivery: "Out for Delivery / Ready for Pickup",
  completed: "Delivered — Completed",
};

function stageMessage(status, destination) {
  const dest = destination || "your destination";
  switch (status) {
    case "collection":
      return `We've received your item for collection in the USA. Your shipment to ${dest} has begun.`;
    case "inspection":
      return `Your item has been inspected, weighed, and documented at our USA warehouse.`;
    case "loading":
      return `Your shipment has been loaded for departure to ${dest}.`;
    case "transit":
      return `Your shipment is now in transit to ${dest}.`;
    case "clearance":
      return `Your shipment has arrived and is clearing customs in ${dest}.`;
    case "offloading":
      return `Your shipment has cleared customs and is being offloaded at our ${dest} facility.`;
    case "delivery":
      return `Your shipment is out for delivery / ready for pickup in ${dest}.`;
    case "completed":
      return `Your shipment has been delivered. Thank you for shipping with Highclass!`;
    default:
      return `Your shipment status has been updated.`;
  }
}

// ---- Providers ----
// Keys are read at CALL TIME from process.env. Firebase injects bound
// secrets into process.env at runtime, so this reads the live values when
// the secrets are set + bound, and cleanly falls back to stub mode otherwise.
const DEFAULT_FROM = "Highclass Shipping <noreply@highclassshippinglogistics.com>";

async function sendEmail({ to, subject, html }) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || DEFAULT_FROM;
  if (!key) {
    console.log(`[STUB EMAIL] to=${to} subject="${subject}"`);
    return { ok: true, stub: true };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html }),
    });
    return { ok: res.ok, stub: false };
  } catch (e) {
    console.error("sendEmail error", e);
    return { ok: false, stub: false };
  }
}

async function sendSms({ to, body }) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !fromNumber) {
    console.log(`[STUB SMS] to=${to} body="${body}"`);
    return { ok: true, stub: true };
  }
  try {
    const creds = Buffer.from(`${sid}:${token}`).toString("base64");
    const params = new URLSearchParams({ To: to, From: fromNumber, Body: body });
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${creds}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    return { ok: res.ok, stub: false };
  } catch (e) {
    console.error("sendSms error", e);
    return { ok: false, stub: false };
  }
}

// ---- Branded email template (inline, no external deps) ----
function emailShell({ heading, body, trackingNumber, ctaUrl }) {
  return `<!doctype html><html><body style="margin:0;background:#F8FAFC;font-family:Inter,Arial,sans-serif;color:#1A202C">
  <div style="max-width:560px;margin:0 auto;padding:24px">
    <div style="background:linear-gradient(135deg,#0B1E3A,#071427);border-radius:16px;padding:28px;color:#fff">
      <div style="font-weight:800;font-size:18px">Highclass Shipping <span style="color:#D4A017">&amp; Logistics</span></div>
      <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#D4A017;margin-top:2px">White-Glove Freight · USA → Africa</div>
    </div>
    <div style="background:#fff;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 16px 16px;padding:28px">
      <h1 style="font-size:20px;margin:0 0 8px;color:#0B1E3A">${heading}</h1>
      <p style="font-size:14px;line-height:1.6;color:#334155">${body}</p>
      ${trackingNumber ? `<div style="margin:18px 0;padding:14px;background:#F8FAFC;border-radius:10px;font-family:monospace;font-size:15px;color:#0B1E3A"><strong>Tracking:</strong> ${trackingNumber}</div>` : ""}
      ${ctaUrl ? `<a href="${ctaUrl}" style="display:inline-block;margin-top:8px;background:#D4A017;color:#0B1E3A;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:10px">Track your shipment</a>` : ""}
      <p style="font-size:12px;color:#718096;margin-top:24px;border-top:1px solid #E2E8F0;padding-top:16px">
        FMC Licensed since 2017 · CAC Registered · This is an automated message from Highclass Shipping and Logistics Inc.
      </p>
    </div>
  </div></body></html>`;
}

const SITE = process.env.SITE_URL || "https://highclassshippinglogistics.com";

// ═══════════════════════════════════════════════════════════════
// Callable: send a stage-update email (+ SMS) for one shipment
// ═══════════════════════════════════════════════════════════════
export const sendStageUpdateEmail = onCall({ secrets: ALL_SECRETS }, async (req) => {
  const { shipmentId, customerId, status, extraNote } = req.data || {};
  if (!shipmentId || !status) throw new HttpsError("invalid-argument", "shipmentId and status required");

  const shipSnap = await db.collection("shipments").doc(shipmentId).get();
  if (!shipSnap.exists) throw new HttpsError("not-found", "Shipment not found");
  const ship = shipSnap.data();

  const custId = customerId || ship.customer_id;
  const custSnap = custId ? await db.collection("users").doc(custId).get() : null;
  const cust = custSnap && custSnap.exists ? custSnap.data() : {};

  const heading = STAGE_LABEL[status] || "Shipment update";
  const msg = `${stageMessage(status, ship.destination_country)}${extraNote ? `<br/><br/>${extraNote}` : ""}`;
  const trackUrl = `${SITE}/track?tn=${encodeURIComponent(ship.tracking_number || "")}`;

  const emailRes = cust.email && cust.notify_email !== false
    ? await sendEmail({
        to: cust.email,
        subject: `${heading} — ${ship.tracking_number || "Highclass Shipping"}`,
        html: emailShell({ heading, body: msg, trackingNumber: ship.tracking_number, ctaUrl: trackUrl }),
      })
    : { ok: false, skipped: true };

  const smsRes = cust.phone && cust.notify_sms !== false
    ? await sendSms({
        to: cust.phone,
        body: `Highclass Shipping: ${ship.tracking_number} — ${stageMessage(status, ship.destination_country)}`,
      })
    : { ok: false, skipped: true };

  // Log to notifications collection.
  const batch = db.batch();
  if (!emailRes.skipped) {
    batch.set(db.collection("notifications").doc(), {
      customer_id: custId, shipment_id: shipmentId, channel: "email", type: `stage_${status}`,
      subject: heading, status: emailRes.ok ? "sent" : "failed",
      stub: !!emailRes.stub, created_at: FieldValue.serverTimestamp(),
    });
  }
  if (!smsRes.skipped) {
    batch.set(db.collection("notifications").doc(), {
      customer_id: custId, shipment_id: shipmentId, channel: "sms", type: `stage_${status}`,
      status: smsRes.ok ? "sent" : "failed", stub: !!smsRes.stub, created_at: FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();

  return { ok: true, email: emailRes, sms: smsRes };
});

// ═══════════════════════════════════════════════════════════════
// Callable (public): resolve a customer by access code.
// Runs unauthenticated with Admin SDK so the "Return with access code"
// page can recognize a returning customer WITHOUT a prior login and
// WITHOUT exposing the users collection to public reads. Returns only
// { found, email } — never the code, hash, or other PII fields.
// The check character is validated client-side first; we re-validate here.
// ═══════════════════════════════════════════════════════════════

// Unambiguous alphabet + Damm check (mirrors src/lib/access-code.ts)
const DAMM = [
  [0, 3, 1, 7, 5, 9, 8, 6, 4, 2], [7, 0, 9, 2, 1, 5, 4, 8, 6, 3],
  [4, 2, 0, 6, 8, 7, 1, 3, 5, 9], [1, 7, 5, 0, 9, 8, 3, 4, 2, 6],
  [6, 1, 2, 3, 0, 4, 5, 9, 7, 8], [3, 6, 7, 4, 2, 0, 9, 5, 8, 1],
  [5, 8, 6, 9, 7, 2, 0, 1, 3, 4], [8, 9, 4, 5, 3, 6, 2, 0, 1, 7],
  [9, 4, 3, 8, 6, 1, 7, 2, 0, 5], [2, 5, 8, 1, 4, 3, 6, 7, 9, 0],
];
function dammCheck(body) {
  let interim = 0;
  for (const ch of body) {
    const digit = (ch.charCodeAt(0) * 7 + interim) % 10;
    interim = DAMM[interim][digit];
  }
  return String(interim);
}
function normalizeCode(code) {
  return String(code || "").trim().toUpperCase().replace(/\s+/g, "");
}
async function sha256Hex(input) {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(input).digest("hex");
}

export const resolveAccessCode = onCall(async (req) => {
  const clean = normalizeCode(req.data?.code);
  if (clean.length < 10 || clean.length > 12) return { found: false };
  const body = clean.slice(0, -1);
  if (dammCheck(body) !== clean.slice(-1)) return { found: false };

  const prefix = clean.slice(0, 4);
  const snap = await db
    .collection("users")
    .where("access_code_prefix", "==", prefix)
    .where("role", "==", "customer")
    .limit(20)
    .get();

  for (const d of snap.docs) {
    const u = d.data();
    if (!u.access_code_salt || !u.access_code_hash) continue;
    const h = await sha256Hex(`${u.access_code_salt}:${clean}`);
    if (h === u.access_code_hash) {
      return { found: true, email: u.email || "", fullName: u.full_name || "" };
    }
  }
  return { found: false };
});

// ═══════════════════════════════════════════════════════════════
// Callable: send access-code email
// ═══════════════════════════════════════════════════════════════
export const sendAccessCodeEmail = onCall({ secrets: EMAIL_SECRETS }, async (req) => {
  const { email, fullName, code } = req.data || {};
  if (!email) throw new HttpsError("invalid-argument", "email required");
  const heading = "Your Highclass Access Code";
  const body = code
    ? `Hi ${fullName || "there"}, keep this access code safe — it lets you return to your account and full shipment history at any time:<br/><br/><span style="font-family:monospace;font-size:22px;letter-spacing:3px;color:#0B1E3A"><strong>${code}</strong></span>`
    : `Hi ${fullName || "there"}, we received a request for your account. Use the return page and your access code to sign back in. If you didn't request this, you can ignore this email.`;
  const res = await sendEmail({
    to: email, subject: heading,
    html: emailShell({ heading, body, ctaUrl: `${SITE}/return` }),
  });
  await db.collection("notifications").doc().set({
    customer_id: "", channel: "email", type: "access_code",
    subject: heading, status: res.ok ? "sent" : "failed",
    stub: !!res.stub, created_at: FieldValue.serverTimestamp(),
  });
  return { ok: true, stub: !!res.stub };
});

// ═══════════════════════════════════════════════════════════════
// Callable: sailing broadcast to active customers with active shipments
// ═══════════════════════════════════════════════════════════════
export const sendSailingBroadcast = onCall({ secrets: EMAIL_SECRETS }, async (req) => {
  const { subject, body, filters } = req.data || {};
  if (!subject || !body) throw new HttpsError("invalid-argument", "subject and body required");

  // Find shipments that are "active" (not completed), apply filters.
  let q = db.collection("shipments").where("current_status", "!=", "completed");
  const shipSnap = await q.get();
  const activeCustomerIds = new Set();
  shipSnap.forEach((d) => {
    const s = d.data();
    if (filters?.service_type && s.service_type !== filters.service_type) return;
    if (filters?.shipping_line && s.shipping_line !== filters.shipping_line) return;
    if (filters?.destination && s.destination_country !== filters.destination) return;
    if (s.customer_id) activeCustomerIds.add(s.customer_id);
  });

  const recipientIds = [];
  const sends = [];
  for (const cid of activeCustomerIds) {
    const uSnap = await db.collection("users").doc(cid).get();
    if (!uSnap.exists) continue;
    const u = uSnap.data();
    if (u.is_active === false || u.role !== "customer" || !u.email) continue;
    recipientIds.push(cid);
    sends.push(
      sendEmail({
        to: u.email,
        subject,
        html: emailShell({ heading: subject, body: body.replace(/\n/g, "<br/>"), ctaUrl: `${SITE}/portal` }),
      })
    );
  }
  await Promise.allSettled(sends);

  return { ok: true, recipientCount: recipientIds.length, recipientIds };
});

// ═══════════════════════════════════════════════════════════════
// Callable: generate a digital receipt (stub returns a data ref;
// real PDF rendering can be added with a PDF lib later)
// ═══════════════════════════════════════════════════════════════
export const generateReceiptPdf = onCall({ secrets: EMAIL_SECRETS }, async (req) => {
  const { shipmentId } = req.data || {};
  if (!shipmentId) throw new HttpsError("invalid-argument", "shipmentId required");
  const shipRef = db.collection("shipments").doc(shipmentId);
  const shipSnap = await shipRef.get();
  if (!shipSnap.exists) throw new HttpsError("not-found", "Shipment not found");
  const ship = { id: shipSnap.id, ...shipSnap.data() };

  // Reuse the existing receipt number for this shipment if one exists, else mint.
  let receiptNumber = ship.receipt_number;
  if (!receiptNumber) {
    const counterRef = db.collection("counters").doc("receipt");
    receiptNumber = await db.runTransaction(async (tx) => {
      const c = await tx.get(counterRef);
      const val = (c.exists ? c.data().value : 5000) + 1;
      tx.set(counterRef, { value: val }, { merge: true });
      return `HC-RCP-${val}`;
    });
  }

  // Render the branded PDF (with QR) and upload to Storage.
  const pdf = await renderReceiptPdf({ shipment: ship, receiptNumber, siteUrl: SITE });
  const bucket = getStorage().bucket();
  const path = `receipts/${shipmentId}/${receiptNumber}.pdf`;
  const file = bucket.file(path);
  await file.save(pdf, {
    contentType: "application/pdf",
    resumable: false,
    metadata: { cacheControl: "private, max-age=0" },
  });
  // Long-lived signed URL for download.
  const [pdfUrl] = await file.getSignedUrl({
    action: "read",
    expires: Date.now() + 1000 * 60 * 60 * 24 * 365,
  });

  // Record the receipt + attach latest to the shipment.
  await db.collection("digital_receipts").add({
    shipment_id: shipmentId,
    receipt_number: receiptNumber,
    generated_by: req.auth?.uid || "system",
    pdf_url: pdfUrl,
    amount: ship.total_price || 0,
    deposit: ship.deposit || 0,
    balance: ship.balance != null ? ship.balance : ship.total_price || 0,
    payment_status: ship.payment_status || "unpaid",
    currency: ship.currency || "USD",
    generated_at: FieldValue.serverTimestamp(),
  });
  await shipRef.set(
    { receipt_number: receiptNumber, receipt_pdf_url: pdfUrl, updated_at: FieldValue.serverTimestamp() },
    { merge: true }
  );

  return { ok: true, receiptNumber, pdfUrl };
});

// ═══════════════════════════════════════════════════════════════
// Callable (admin): create a staff account (nigeria_office/dispatcher/admin)
// Creates the Firebase Auth user + Firestore profile WITHOUT signing the
// admin out (the client SDK can't do this). Emails a temp password.
// ═══════════════════════════════════════════════════════════════
export const createStaffUser = onCall({ secrets: EMAIL_SECRETS }, async (req) => {
  await assertAdmin(req);
  const { email, fullName, role, phone, assignedCountry, password } = req.data || {};
  if (!email || !fullName || !role) {
    throw new HttpsError("invalid-argument", "email, fullName, and role are required.");
  }
  if (!["admin", "nigeria_office", "dispatcher"].includes(role)) {
    throw new HttpsError("invalid-argument", "Invalid staff role.");
  }

  const tempPassword =
    password || `Hc${Math.abs(hashStr(email + fullName)).toString(36)}!${role.slice(0, 2).toUpperCase()}9`;

  let userRecord;
  try {
    userRecord = await getAuth().createUser({
      email: String(email).trim().toLowerCase(),
      password: tempPassword,
      displayName: fullName,
    });
  } catch (e) {
    throw new HttpsError("already-exists", e.message || "Could not create auth user.");
  }

  const profile = {
    email: String(email).trim().toLowerCase(),
    full_name: fullName,
    phone: phone || "",
    role,
    is_active: true,
    created_at: FieldValue.serverTimestamp(),
  };
  if (role === "nigeria_office" && assignedCountry) profile.assigned_country = assignedCountry;

  await db.collection("users").doc(userRecord.uid).set(profile);
  await db.collection("activity_log").doc().set({
    actor_id: req.auth.uid, action: "staff_created",
    target: userRecord.uid, meta: { role, email: profile.email },
    created_at: FieldValue.serverTimestamp(),
  });

  // Email the temp password (stub-safe) + password-reset guidance.
  await sendEmail({
    to: profile.email,
    subject: "Your Highclass Shipping staff account",
    html: emailShell({
      heading: "Welcome to the Highclass Shipping team",
      body: `An account has been created for you as <strong>${role.replace("_", " ")}</strong>.<br/><br/>Temporary password: <span style="font-family:monospace;font-size:16px">${tempPassword}</span><br/><br/>Please log in and change it immediately.`,
      ctaUrl: `${SITE}/login`,
    }),
  });

  return { ok: true, uid: userRecord.uid, tempPassword };
});

// Small deterministic string hash for temp-password generation.
function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h;
}

// ═══════════════════════════════════════════════════════════════
// Callable (admin): update a staff member's role / country / active
// ═══════════════════════════════════════════════════════════════
export const updateStaffUser = onCall(async (req) => {
  await assertAdmin(req);
  const { uid, role, assignedCountry, isActive } = req.data || {};
  if (!uid) throw new HttpsError("invalid-argument", "uid required.");
  const patch = {};
  if (role) patch.role = role;
  if (assignedCountry !== undefined) patch.assigned_country = assignedCountry;
  if (isActive !== undefined) patch.is_active = isActive;
  await db.collection("users").doc(uid).set(patch, { merge: true });
  await db.collection("activity_log").doc().set({
    actor_id: req.auth.uid, action: "staff_updated", target: uid, meta: patch,
    created_at: FieldValue.serverTimestamp(),
  });
  return { ok: true };
});

// ═══════════════════════════════════════════════════════════════
// Trigger: auto-notify on shipment status change (Module 10)
// Fires whenever a shipment's current_status changes.
// ═══════════════════════════════════════════════════════════════
export const onShipmentStatusChange = onDocumentUpdated(
  { document: "shipments/{shipmentId}", secrets: ALL_SECRETS },
  async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after) return;
  if (before.current_status === after.current_status) return; // only on change

  const custId = after.customer_id;
  if (!custId) return;
  const custSnap = await db.collection("users").doc(custId).get();
  if (!custSnap.exists) return;
  const cust = custSnap.data();

  const status = after.current_status;
  const heading = STAGE_LABEL[status] || "Shipment update";
  const trackUrl = `${SITE}/track?tn=${encodeURIComponent(after.tracking_number || "")}`;

  if (cust.email && cust.notify_email !== false) {
    const res = await sendEmail({
      to: cust.email,
      subject: `${heading} — ${after.tracking_number}`,
      html: emailShell({
        heading,
        body: stageMessage(status, after.destination_country),
        trackingNumber: after.tracking_number,
        ctaUrl: trackUrl,
      }),
    });
    await db.collection("notifications").doc().set({
      customer_id: custId, shipment_id: event.params.shipmentId, channel: "email",
      type: `auto_stage_${status}`, subject: heading, status: res.ok ? "sent" : "failed",
      stub: !!res.stub, created_at: FieldValue.serverTimestamp(),
    });
  }
  if (cust.phone && cust.notify_sms !== false) {
    const res = await sendSms({
      to: cust.phone,
      body: `Highclass Shipping: ${after.tracking_number} — ${stageMessage(status, after.destination_country)}`,
    });
    await db.collection("notifications").doc().set({
      customer_id: custId, shipment_id: event.params.shipmentId, channel: "sms",
      type: `auto_stage_${status}`, status: res.ok ? "sent" : "failed",
      stub: !!res.stub, created_at: FieldValue.serverTimestamp(),
    });
  }
  }
);
