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
import * as logger from "firebase-functions/logger";
import { defineSecret } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";
import { randomBytes, createHash } from "node:crypto";
import { renderReceiptPdf } from "./receipt.js";
// Email logo: reference the publicly-hosted PNG (Gmail/Outlook strip base64
// data-URI images, so a real https URL is required for the logo to render).
const LOGO_URL = "https://highclassshippinglogistics.web.app/brand/logo-email.png";

initializeApp();
const db = getFirestore();
setGlobalOptions({ region: "us-central1", maxInstances: 10 });

// ---- Secrets (Google Secret Manager) ----
// Set with: firebase functions:secrets:set RESEND_API_KEY  (etc.)
// Bound per-function via `secrets: [...]` so they're injected into
// process.env at runtime ONLY for functions that need them. Until they
// are set, the functions run in stub mode (log-only, still succeed).
// Brevo (primary email provider). BREVO_API_KEY is the key you generate under
// Brevo → SMTP & API. It works for both SMTP and the HTTP transactional API;
// we use the HTTP API (reliable on serverless). BREVO_FROM_EMAIL /
// BREVO_FROM_NAME set the verified sender identity.
const BREVO_API_KEY = defineSecret("BREVO_API_KEY");
const BREVO_FROM_EMAIL = defineSecret("BREVO_FROM_EMAIL");
const BREVO_FROM_NAME = defineSecret("BREVO_FROM_NAME");
// Optional reply-to (e.g. a monitored inbox); falls back to the from address.
const BREVO_REPLY_TO = defineSecret("BREVO_REPLY_TO");
// SMTP relay credentials (Brevo). Used as the primary send path when set,
// because the v3 HTTP API is refused by the account's authorised-IP restriction.
const BREVO_SMTP_PASSWORD = defineSecret("BREVO_SMTP_PASSWORD");
const BREVO_SMTP_USER = defineSecret("BREVO_SMTP_USER");

// Resend kept as an automatic fallback if Brevo is not configured.
const RESEND_API_KEY = defineSecret("RESEND_API_KEY");
const RESEND_FROM_EMAIL = defineSecret("RESEND_FROM_EMAIL");
const TWILIO_ACCOUNT_SID = defineSecret("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = defineSecret("TWILIO_AUTH_TOKEN");
const TWILIO_FROM_NUMBER = defineSecret("TWILIO_FROM_NUMBER");

// Convenience arrays for binding to functions.
const BREVO_SECRETS = [BREVO_API_KEY, BREVO_FROM_EMAIL, BREVO_FROM_NAME, BREVO_REPLY_TO, BREVO_SMTP_PASSWORD, BREVO_SMTP_USER];
const EMAIL_SECRETS = [...BREVO_SECRETS, RESEND_API_KEY, RESEND_FROM_EMAIL];
const SMS_SECRETS = [TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER];
const ALL_SECRETS = [...EMAIL_SECRETS, ...SMS_SECRETS];

// ---- Auth guard: require the caller to be an admin ----
// A deactivated admin is treated as no admin at all: `is_active === false`
// must lock the account out of every privileged callable, not just the UI.
async function assertAdmin(req) {
  if (!req.auth?.uid) throw new HttpsError("unauthenticated", "Sign in required.");
  const snap = await db.collection("users").doc(req.auth.uid).get();
  const u = snap.exists ? snap.data() : null;
  if (!u || u.role !== "admin" || u.is_active === false) {
    throw new HttpsError("permission-denied", "Admin access required.");
  }
  return u;
}

// Summarise a provider failure for the admin UI. Brevo/Resend return a JSON
// body explaining WHY (unverified sender, IP allowlist, quota); surfacing that
// verbatim is the difference between "it failed" and a fixable instruction.
function sendErrorSummary(results) {
  for (const r of results) {
    const v = r.status === "fulfilled" ? r.value : null;
    if (r.status === "rejected") return String(r.reason || "Send rejected").slice(0, 300);
    if (v && v.ok === false) {
      let msg = v.error || `HTTP ${v.status || "error"}`;
      try {
        const parsed = JSON.parse(v.error);
        if (parsed?.message) msg = parsed.message;
      } catch {
        /* error body was not JSON — use it as-is */
      }
      return String(msg).slice(0, 300);
    }
  }
  return null;
}

// Require any active staff member (admin / nigeria_office / dispatcher).
async function assertStaff(req) {
  if (!req.auth?.uid) throw new HttpsError("unauthenticated", "Sign in required.");
  const snap = await db.collection("users").doc(req.auth.uid).get();
  const u = snap.exists ? snap.data() : null;
  if (!u || !["admin", "nigeria_office", "dispatcher"].includes(u.role) || u.is_active === false) {
    throw new HttpsError("permission-denied", "Staff access required.");
  }
  return u;
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
  completed: "Delivered, Completed",
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

// A secret is "configured" only if it has a real, non-placeholder value.
// This lets you set every declared secret to "unset" so deploys never block
// on an empty prompt, while the functions stay in stub mode until real keys
// are provided.
function cfg(v) {
  const s = (v || "").trim();
  if (!s || s.toLowerCase() === "unset" || s === "-") return "";
  return s;
}

// Parse a "Name <email>" string (or a bare email) into Brevo's {name, email}.
function parseSender(str, fallbackEmail, fallbackName) {
  const s = cfg(str);
  const m = s.match(/^\s*(.*?)\s*<\s*([^>]+)\s*>\s*$/);
  if (m) return { name: m[1] || fallbackName, email: m[2] };
  if (s && s.includes("@")) return { name: fallbackName, email: s };
  return { name: fallbackName, email: fallbackEmail };
}

// Reusable SMTP transport. Created once per instance (not per send) so a batch
// of stage-update emails reuses one authenticated connection pool rather than
// re-handshaking for every recipient.
let smtpTransport;
async function getSmtpTransport() {
  const pass = cfg(process.env.BREVO_SMTP_PASSWORD);
  if (!pass) return null;
  if (smtpTransport) return smtpTransport;
  const user = cfg(process.env.BREVO_SMTP_USER);
  if (!user) return null;
  const { default: nodemailer } = await import("nodemailer");
  smtpTransport = nodemailer.createTransport({
    host: "smtp-relay.brevo.com",
    port: 587,
    secure: false,
    pool: true,
    maxConnections: 3,
    auth: { user, pass },
  });
  return smtpTransport;
}

// Send a transactional email. Provider order: Brevo SMTP relay → Brevo HTTP API
// → Resend → stub (log-only). Returns { ok, provider, stub, status?, error? }
// so callers and the admin test tool can see exactly what happened.
//
// SMTP is FIRST deliberately: this Brevo account enforces an authorised-IP
// restriction that rejects the v3 HTTP API from Cloud Functions' (rotating)
// egress IPs with a 401, while the SMTP relay authenticates by credential and
// is unaffected. The HTTP API is kept as a fallback for when that is lifted.
async function sendEmail({ to, subject, html, replyTo }) {
  const recipients = Array.isArray(to) ? to : [to];

  // ── Brevo SMTP relay (primary) ──
  try {
    const tx = await getSmtpTransport();
    if (tx) {
      const sender = parseSender(
        process.env.BREVO_FROM_EMAIL,
        "info@highclassshippinglogistics.com",
        cfg(process.env.BREVO_FROM_NAME) || "Highclass Shipping and Logistics"
      );
      const reply = cfg(replyTo) || cfg(process.env.BREVO_REPLY_TO);
      const info = await tx.sendMail({
        from: `${sender.name} <${sender.email}>`,
        to: recipients.join(", "),
        subject,
        html,
        ...(reply ? { replyTo: reply } : {}),
      });
      return { ok: true, provider: "brevo-smtp", stub: false, messageId: info.messageId || null };
    }
  } catch (e) {
    // Fall through to the HTTP API rather than failing the send outright.
    console.error("Brevo SMTP send failed, falling back to HTTP API", e);
  }

  // ── Brevo transactional HTTP API (fallback) ──
  const brevoKey = cfg(process.env.BREVO_API_KEY);
  if (brevoKey) {
    const sender = parseSender(
      process.env.BREVO_FROM_EMAIL,
      "info@highclassshippinglogistics.com",
      cfg(process.env.BREVO_FROM_NAME) || "Highclass Shipping and Logistics"
    );
    // BREVO_FROM_NAME overrides the name even when FROM_EMAIL is a bare address.
    if (cfg(process.env.BREVO_FROM_NAME)) sender.name = cfg(process.env.BREVO_FROM_NAME);
    const reply = cfg(replyTo) || cfg(process.env.BREVO_REPLY_TO);
    const payload = {
      sender,
      to: recipients.map((email) => ({ email })),
      subject,
      htmlContent: html,
    };
    if (reply) payload.replyTo = { email: reply };
    try {
      const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": brevoKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) return { ok: true, provider: "brevo", stub: false, status: res.status };
      const errText = await res.text().catch(() => "");
      console.error("Brevo send failed", res.status, errText);
      return { ok: false, provider: "brevo", stub: false, status: res.status, error: errText };
    } catch (e) {
      console.error("Brevo send error", e);
      return { ok: false, provider: "brevo", stub: false, error: String(e) };
    }
  }

  // ── Resend (fallback) ──
  const resendKey = cfg(process.env.RESEND_API_KEY);
  if (resendKey) {
    const from = cfg(process.env.RESEND_FROM_EMAIL) || DEFAULT_FROM;
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: recipients, subject, html, reply_to: cfg(replyTo) || undefined }),
      });
      return { ok: res.ok, provider: "resend", stub: false, status: res.status };
    } catch (e) {
      console.error("Resend send error", e);
      return { ok: false, provider: "resend", stub: false, error: String(e) };
    }
  }

  // ── Stub (no provider configured) ──
  console.log(`[STUB EMAIL] to=${recipients.join(", ")} subject="${subject}"`);
  return { ok: true, provider: "stub", stub: true };
}

async function sendSms({ to, body }) {
  const sid = cfg(process.env.TWILIO_ACCOUNT_SID);
  const token = cfg(process.env.TWILIO_AUTH_TOKEN);
  const fromNumber = cfg(process.env.TWILIO_FROM_NUMBER);
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

// ---- Branded email template (table-based, email-client safe, no external deps) ----
// Backwards-compatible signature: heading, body (HTML allowed), trackingNumber,
// ctaUrl. Optional: ctaLabel, preheader, footerNote.
function emailShell({ heading, body, trackingNumber, ctaUrl, ctaLabel, preheader, footerNote }) {
  const NAVY = "#0B1E3A";
  const BLUE = "#0A5BE0";
  const BLUE_LT = "#5E97F3";
  // `body` is intentionally raw HTML (callers must escape their own content).
  // Everything else is escaped here so headings/labels/URLs are injection-safe.
  const safeHeading = escapeHtml(heading);
  const safeCtaLabel = escapeHtml(ctaLabel || "Track your shipment");
  const safeCtaUrl = encodeURI(String(ctaUrl || "")).replace(/"/g, "%22");
  const safeTracking = escapeHtml(trackingNumber);
  const safeFooterNote = escapeHtml(footerNote || "");
  const preheaderText = escapeHtml(
    preheader || (typeof body === "string" ? body.replace(/<[^>]+>/g, "").slice(0, 120) : "")
  );
  const cta = ctaUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 4px">
         <tr><td align="center" bgcolor="${BLUE}" style="border-radius:10px">
           <a href="${safeCtaUrl}" target="_blank"
              style="display:inline-block;padding:13px 30px;font-family:Segoe UI,Arial,sans-serif;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px">
             ${safeCtaLabel}
           </a>
         </td></tr>
       </table>`
    : "";
  const tracking = trackingNumber
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 4px">
         <tr><td style="background:#F1F5FA;border:1px solid #E2E8F0;border-radius:12px;padding:14px 18px">
           <div style="font-size:10.5px;letter-spacing:1.5px;text-transform:uppercase;color:#8A98A6;font-weight:700;font-family:Segoe UI,Arial,sans-serif">Tracking number</div>
           <div style="margin-top:4px;font-family:Consolas,'Courier New',monospace;font-size:17px;font-weight:700;color:${NAVY};letter-spacing:.5px">${safeTracking}</div>
         </td></tr>
       </table>`
    : "";

  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="x-apple-disable-message-reformatting"/>
<title>${safeHeading}</title>
</head>
<body style="margin:0;padding:0;background:#EEF2F7;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px">${preheaderText}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#EEF2F7;padding:28px 12px">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 40px -18px rgba(11,30,58,.35);font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif">

        <!-- Header -->
        <tr>
          <td align="center" style="background:${NAVY};background:linear-gradient(135deg,#0B1E3A,#071427);padding:28px 32px 24px">
            <img src="${LOGO_URL}" width="200" alt="Highclass Shipping & Logistics Inc." style="display:block;margin:0 auto;width:200px;max-width:70%;height:auto;background:#ffffff;border-radius:12px;padding:10px 14px" />
            <div style="margin-top:14px;font-size:10.5px;letter-spacing:2.4px;text-transform:uppercase;color:${BLUE_LT};font-weight:700">Excellence in handling your valuables</div>
          </td>
        </tr>
        <tr><td style="height:4px;background:${BLUE};line-height:4px;font-size:0">&nbsp;</td></tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px">
            <h1 style="margin:0 0 12px;font-size:21px;line-height:1.3;color:${NAVY};font-weight:750">${safeHeading}</h1>
            <div style="font-size:14.5px;line-height:1.7;color:#3A4A5E">${body}</div>
            ${tracking}
            ${cta}
          </td>
        </tr>

        <!-- Office footer -->
        <tr>
          <td style="padding:0 32px 8px">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #E9EEF4">
              <tr>
                <td width="50%" valign="top" style="padding:18px 12px 6px 0">
                  <div style="font-size:10px;letter-spacing:1.4px;text-transform:uppercase;color:${BLUE};font-weight:700">USA Office</div>
                  <div style="margin-top:5px;font-size:12px;line-height:1.6;color:#5B6B7D">8611 Westphalia Road<br/>Upper Marlboro, Maryland 20774, USA<br/>+1 (240) 374-8394</div>
                </td>
                <td width="50%" valign="top" style="padding:18px 0 6px 12px">
                  <div style="font-size:10px;letter-spacing:1.4px;text-transform:uppercase;color:${BLUE};font-weight:700">Nigeria Office</div>
                  <div style="margin-top:5px;font-size:12px;line-height:1.6;color:#5B6B7D">28 Moleye Street, Alagomeji<br/>Yaba, Lagos<br/>+234 808 029 1754</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Legal footer -->
        <tr>
          <td style="padding:14px 32px 26px;border-top:1px solid #E9EEF4">
            <div style="font-size:11.5px;line-height:1.6;color:#8A98A6">
              FMC Licensed since 2017 · Registered in Maryland, USA &amp; Nigeria (CAC)<br/>
              ${safeFooterNote || "This is an automated message from Highclass Shipping &amp; Logistics Inc."}
            </div>
            <div style="margin-top:8px;font-size:11.5px"><a href="${SITE}" style="color:${BLUE};text-decoration:none;font-weight:600">highclassshippinglogistics.com</a></div>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body></html>`;
}

const SITE = process.env.SITE_URL || "https://highclassshippinglogistics.com";

// ---- Premium container-availability broadcast email ----
// The admin-authored `body` (plain text, newlines) is placed inside a branded,
// professionally laid-out shell with the office address, delivery contact, and
// next-loading reminder rendered as structured blocks. Every value is optional
// so the template degrades gracefully.
function escapeHtml(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function containerNoticeEmail({
  heading,
  body,
  containerLabel,
  officeName,
  officeAddress,
  officePhone,
  deliveryContactName,
  deliveryContactPhone,
  nextLoadingDate,
  nextLoadingNote,
  usPhones,
  ctaUrl,
}) {
  const bodyHtml = escapeHtml(body).replace(/\n/g, "<br/>");
  const row = (label, value) =>
    value
      ? `<tr><td style="padding:2px 0;color:#718096;font-size:12px;width:120px;vertical-align:top">${escapeHtml(
          label
        )}</td><td style="padding:2px 0;color:#1A202C;font-size:13px;font-weight:600">${escapeHtml(
          value
        )}</td></tr>`
      : "";
  return `<!doctype html><html><body style="margin:0;background:#F1F5F9;font-family:Inter,Segoe UI,Arial,sans-serif;color:#1A202C">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#0B1E3A,#071427);border-radius:16px 16px 0 0;padding:30px 30px 24px;text-align:center">
      <img src="${LOGO_URL}" width="200" alt="Highclass Shipping &amp; Logistics Inc." style="display:block;margin:0 auto;width:200px;max-width:70%;height:auto;background:#ffffff;border-radius:12px;padding:10px 14px" />
      <div style="font-size:10.5px;letter-spacing:2px;text-transform:uppercase;color:#5E97F3;margin-top:14px">Excellence in handling your valuables</div>
    </div>
    <div style="height:4px;background:#0A5BE0"></div>

    <!-- Body card -->
    <div style="background:#fff;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 16px 16px;padding:30px">
      ${
        containerLabel
          ? `<div style="display:inline-block;background:#0B1E3A;color:#5E97F3;font-weight:700;font-size:13px;letter-spacing:1px;padding:7px 14px;border-radius:999px;margin-bottom:18px">${escapeHtml(
              containerLabel
            )}</div>`
          : ""
      }
      <h1 style="font-size:21px;line-height:1.3;margin:0 0 14px;color:#0B1E3A">${escapeHtml(
        heading
      )}</h1>
      <p style="font-size:14.5px;line-height:1.7;color:#334155;margin:0 0 22px">${bodyHtml}</p>

      ${
        officeAddress || officePhone
          ? `<div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:16px 18px;margin:0 0 16px">
        <div style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#0848B4;font-weight:700;margin-bottom:8px">Pickup Location</div>
        ${
          officeName
            ? `<div style="font-size:14px;font-weight:700;color:#0B1E3A;margin-bottom:4px">${escapeHtml(
                officeName
              )}</div>`
            : ""
        }
        ${
          officeAddress
            ? `<div style="font-size:13px;line-height:1.6;color:#334155">${escapeHtml(
                officeAddress
              ).replace(/\n/g, "<br/>")}</div>`
            : ""
        }
        ${
          officePhone
            ? `<div style="font-size:13px;color:#0B1E3A;font-weight:600;margin-top:6px">${escapeHtml(
                officePhone
              )}</div>`
            : ""
        }
      </div>`
          : ""
      }

      ${
        deliveryContactName || deliveryContactPhone
          ? `<div style="border-left:3px solid #0A5BE0;padding:4px 0 4px 14px;margin:0 0 16px">
        <div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#718096;font-weight:700;margin-bottom:3px">Need delivery?</div>
        <div style="font-size:13.5px;color:#334155">Call our Logistics Manager ${
          deliveryContactName ? `<strong>${escapeHtml(deliveryContactName)}</strong>` : ""
        }${deliveryContactPhone ? ` on <strong>${escapeHtml(deliveryContactPhone)}</strong>` : ""}.</div>
      </div>`
          : ""
      }

      ${
        nextLoadingDate || nextLoadingNote
          ? `<div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:12px;padding:16px 18px;margin:0 0 16px">
        <div style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#B45309;font-weight:700;margin-bottom:6px">Reminder</div>
        ${
          nextLoadingDate
            ? `<div style="font-size:14px;font-weight:700;color:#78350F;margin-bottom:4px">Next loading date: ${escapeHtml(
                nextLoadingDate
              )}</div>`
            : ""
        }
        ${
          nextLoadingNote
            ? `<div style="font-size:13px;line-height:1.6;color:#92400E">${escapeHtml(
                nextLoadingNote
              )}</div>`
            : ""
        }
      </div>`
          : ""
      }

      ${
        usPhones
          ? `<p style="font-size:13px;color:#475569;margin:18px 0 0">For more information please call <strong style="color:#0B1E3A">${escapeHtml(
              usPhones
            )}</strong>.</p>`
          : ""
      }

      ${
        ctaUrl
          ? `<a href="${ctaUrl}" style="display:inline-block;margin-top:20px;background:#0A5BE0;color:#FFFFFF;font-weight:700;font-size:14px;text-decoration:none;padding:13px 26px;border-radius:10px">View my shipment</a>`
          : ""
      }

      <p style="font-size:11.5px;color:#94A3B8;margin-top:26px;border-top:1px solid #E2E8F0;padding-top:16px;line-height:1.6">
        FMC Licensed since 2017 · Registered in Maryland, USA &amp; Nigeria (CAC)<br/>
        Highclass Shipping &amp; Logistics Inc. This message was sent to customers with cargo on this container.
      </p>
    </div>
  </div></body></html>`;
}

// ═══════════════════════════════════════════════════════════════
// Callable: send a stage-update email (+ SMS) for one shipment
// ═══════════════════════════════════════════════════════════════
export const sendStageUpdateEmail = onCall({ secrets: ALL_SECRETS }, async (req) => {
  await assertStaff(req);
  const { shipmentId, customerId, status, extraNote } = req.data || {};
  if (!shipmentId || !status) throw new HttpsError("invalid-argument", "shipmentId and status required");

  const shipSnap = await db.collection("shipments").doc(shipmentId).get();
  if (!shipSnap.exists) throw new HttpsError("not-found", "Shipment not found");
  const ship = shipSnap.data();

  const custId = customerId || ship.customer_id;
  const custSnap = custId ? await db.collection("users").doc(custId).get() : null;
  const cust = custSnap && custSnap.exists ? custSnap.data() : {};

  const heading = STAGE_LABEL[status] || "Shipment update";
  const msg = `${stageMessage(status, ship.destination_country)}${extraNote ? `<br/><br/>${escapeHtml(extraNote)}` : ""}`;
  const trackUrl = `${SITE}/track?tn=${encodeURIComponent(ship.tracking_number || "")}`;

  const emailRes = cust.email && cust.notify_email !== false
    ? await sendEmail({
        to: cust.email,
        subject: `${heading}: ${ship.tracking_number || "Highclass Shipping"}`,
        html: emailShell({ heading, body: msg, trackingNumber: ship.tracking_number, ctaUrl: trackUrl }),
      })
    : { ok: false, skipped: true };

  const smsRes = cust.phone && cust.notify_sms !== false
    ? await sendSms({
        to: cust.phone,
        body: `Highclass Shipping: ${ship.tracking_number}. ${stageMessage(status, ship.destination_country)}`,
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
// System backup / restore (admin only).
//
// Runs server-side on the Admin SDK deliberately: Firestore rules stop a client
// reading users/counters wholesale, and a browser-side export would silently
// return partial data — the worst possible failure for a backup.
//
// Format is JSON, not CSV. CSV cannot represent the nested objects (receiver,
// items[], dimensions) or distinguish a Timestamp from a string that looks like a
// date, so a CSV round-trip would quietly corrupt exactly the fields that matter.
// Timestamps are encoded as {__ts__: millis} so they restore as real Timestamps
// rather than strings, and document IDs are preserved so relationships between
// collections (shipment_id, customer_id) survive intact.
// ═══════════════════════════════════════════════════════════════
const BACKUP_COLLECTIONS = [
  "users",
  "shipments",
  "shipment_status_logs",
  "price_list",
  "digital_receipts",
  "roro_documents",
  "sailing_notices",
  "notifications",
  "usa_inventory",
  "destination_inventory",
  "contact_inquiries",
  "activity_log",
  "site_content",
  "counters",
];

const BACKUP_FORMAT = 2;

/** Encode Firestore values into JSON that can be decoded back to the same types. */
function encodeValue(v) {
  if (v === null || v === undefined) return null;
  if (v instanceof Timestamp) return { __ts__: v.toMillis() };
  if (Array.isArray(v)) return v.map(encodeValue);
  if (typeof v === "object") {
    // GeoPoint / DocumentReference are not used in this schema; a plain object
    // walk is therefore sufficient and keeps the format readable.
    const out = {};
    for (const [k, val] of Object.entries(v)) out[k] = encodeValue(val);
    return out;
  }
  return v;
}

function decodeValue(v) {
  if (v === null || v === undefined) return null;
  if (Array.isArray(v)) return v.map(decodeValue);
  if (typeof v === "object") {
    if (typeof v.__ts__ === "number") return Timestamp.fromMillis(v.__ts__);
    const out = {};
    for (const [k, val] of Object.entries(v)) out[k] = decodeValue(val);
    return out;
  }
  return v;
}

export const exportBackup = onCall({ timeoutSeconds: 540, memory: "1GiB" }, async (req) => {
  await assertAdmin(req);
  const data = {};
  const counts = {};
  for (const name of BACKUP_COLLECTIONS) {
    const snap = await db.collection(name).get();
    data[name] = snap.docs.map((d) => ({ id: d.id, data: encodeValue(d.data()) }));
    counts[name] = snap.size;
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  await db.collection("activity_log").doc().set({
    actor_id: req.auth.uid,
    action: "exported system backup",
    meta: { documents: total, collections: Object.keys(counts).length },
    created_at: FieldValue.serverTimestamp(),
  });

  return {
    ok: true,
    format: BACKUP_FORMAT,
    project: "highclassshippinglogistics",
    exported_at: new Date().toISOString(),
    counts,
    total,
    data,
  };
});

export const restoreBackup = onCall({ timeoutSeconds: 540, memory: "1GiB" }, async (req) => {
  await assertAdmin(req);
  const { backup, mode } = req.data || {};
  if (!backup || typeof backup !== "object" || !backup.data) {
    throw new HttpsError("invalid-argument", "That file is not a Highclass backup.");
  }
  if (Number(backup.format) !== BACKUP_FORMAT) {
    throw new HttpsError(
      "invalid-argument",
      `Unsupported backup format (${backup.format}). This app writes and reads format ${BACKUP_FORMAT}.`
    );
  }
  // "merge" writes the backup over what is there, leaving newer unrelated docs
  // alone. "replace" additionally deletes documents absent from the backup, so
  // the database ends up exactly as the file describes.
  const replace = mode === "replace";

  const restored = {};
  const skipped = [];
  let writes = 0;

  for (const name of BACKUP_COLLECTIONS) {
    const rows = Array.isArray(backup.data[name]) ? backup.data[name] : null;
    if (!rows) {
      // A collection missing from the file is left untouched rather than wiped —
      // an older backup should not destroy data it never knew about.
      skipped.push(name);
      continue;
    }

    const keep = new Set(rows.map((r) => r.id));
    if (replace) {
      const existing = await db.collection(name).get();
      let delBatch = db.batch();
      let n = 0;
      for (const doc of existing.docs) {
        if (keep.has(doc.id)) continue;
        delBatch.delete(doc.ref);
        if (++n >= 400) {
          await delBatch.commit();
          delBatch = db.batch();
          n = 0;
        }
      }
      if (n > 0) await delBatch.commit();
    }

    let batch = db.batch();
    let n = 0;
    for (const row of rows) {
      if (!row?.id) continue;
      batch.set(db.collection(name).doc(row.id), decodeValue(row.data || {}));
      writes += 1;
      if (++n >= 400) {
        await batch.commit();
        batch = db.batch();
        n = 0;
      }
    }
    if (n > 0) await batch.commit();
    restored[name] = rows.length;
  }

  await db.collection("activity_log").doc().set({
    actor_id: req.auth.uid,
    action: `restored system backup (${replace ? "replace" : "merge"})`,
    meta: { documents: writes, exported_at: backup.exported_at || null, skipped },
    created_at: FieldValue.serverTimestamp(),
  });

  return { ok: true, restored, writes, skipped, mode: replace ? "replace" : "merge" };
});

// ═══════════════════════════════════════════════════════════════
// Quote ready: tell the customer their off-list item has been priced.
//
// Off-list items arrive at 0 with needs_quote:true. Once staff set a price the
// customer needs to know the total changed BEFORE they are asked to pay, which is
// the whole point of the quote-on-request flow — otherwise the amount silently
// grows between ordering and invoicing.
// ═══════════════════════════════════════════════════════════════
export const sendQuoteReadyEmail = onCall({ secrets: ALL_SECRETS }, async (req) => {
  await assertStaff(req);
  const { shipmentId, note } = req.data || {};
  if (!shipmentId) throw new HttpsError("invalid-argument", "shipmentId required");

  const shipSnap = await db.collection("shipments").doc(shipmentId).get();
  if (!shipSnap.exists) throw new HttpsError("not-found", "Shipment not found");
  const ship = shipSnap.data();

  const custId = ship.customer_id;
  const custSnap = custId ? await db.collection("users").doc(custId).get() : null;
  const cust = custSnap && custSnap.exists ? custSnap.data() : {};
  // Prefer the account address; fall back to the copy on the shipment so a
  // customer whose user doc is missing still gets told.
  const to = cust.email || ship.customer_email || "";
  if (!to) throw new HttpsError("failed-precondition", "No email on file for this customer.");

  const currency = ship.currency || "USD";
  const fmt = (n) =>
    `${currency === "USD" ? "$" : `${currency} `}${Number(n || 0).toFixed(2)}`;

  const items = Array.isArray(ship.items) ? ship.items : [];
  const rows = items
    .map((it) => {
      const priced = Number(it.line_total) || 0;
      return `<tr>
        <td style="padding:6px 0;color:#0B1E3A">${it.quantity || 1}× ${it.description || "Item"}</td>
        <td style="padding:6px 0;text-align:right;font-family:monospace;color:#0B1E3A">${
          it.needs_quote && priced === 0 ? "pending" : fmt(priced)
        }</td>
      </tr>`;
    })
    .join("");

  const balance =
    typeof ship.balance === "number" ? ship.balance : Number(ship.total_price) || 0;

  const body = `
    Good news — we have priced the item you asked us to quote on shipment
    <strong>${ship.tracking_number || ""}</strong>.
    ${note ? `<br/><br/>${String(note).slice(0, 800)}` : ""}
    <br/><br/>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="font-size:14px;border-top:1px solid #E9EEF4;border-bottom:1px solid #E9EEF4;margin:8px 0">
      ${rows}
    </table>
    <p style="font-size:15px;color:#0B1E3A">
      <strong>Order total: ${fmt(ship.total_price)}</strong><br/>
      ${balance > 0 ? `Balance due: <strong>${fmt(balance)}</strong>` : "Fully paid — nothing further to pay."}
    </p>
    ${balance > 0 ? "You can now go ahead and pay for your shipment." : ""}
  `;

  const emailRes =
    cust.notify_email !== false
      ? await sendEmail({
          to,
          subject: `Your quote is ready — ${ship.tracking_number || "your shipment"}`,
          html: emailShell({
            heading: "Your quote is ready",
            body,
            trackingNumber: ship.tracking_number,
            ctaUrl: `${SITE}/track`,
            ctaLabel: "View your shipment",
          }),
        })
      : { skipped: true };

  if (!emailRes.skipped) {
    await db.collection("notifications").doc().set({
      customer_id: custId || null,
      shipment_id: shipmentId,
      channel: "email",
      type: "quote_ready",
      subject: `Quote ready — ${ship.tracking_number || ""}`,
      status: emailRes.ok ? "sent" : "failed",
      stub: !!emailRes.stub,
      created_at: FieldValue.serverTimestamp(),
    });
  }

  await db.collection("activity_log").doc().set({
    actor_id: req.auth.uid,
    action: "sent quote-ready email",
    target: ship.tracking_number || shipmentId,
    meta: { shipment_id: shipmentId, total: ship.total_price ?? null, emailed: !emailRes.skipped && !!emailRes.ok },
    created_at: FieldValue.serverTimestamp(),
  });

  return { ok: !!emailRes.ok, skipped: !!emailRes.skipped, to };
});

// ═══════════════════════════════════════════════════════════════
// Callable (admin): send a branded TEST email to verify the provider
// (Brevo) is configured and delivering. Returns the provider + status so
// you can confirm setup from the admin UI before going live.
// ═══════════════════════════════════════════════════════════════
export const sendTestEmail = onCall({ secrets: EMAIL_SECRETS }, async (req) => {
  await assertAdmin(req);
  const to = (req.data?.to || "").trim();
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    throw new HttpsError("invalid-argument", "A valid destination email is required.");
  }
  const provider = cfg(process.env.BREVO_API_KEY)
    ? "Brevo"
    : cfg(process.env.RESEND_API_KEY)
    ? "Resend"
    : "stub (no provider configured)";

  const html = emailShell({
    heading: "Your email setup is working",
    preheader: "Test email from the Highclass Shipping admin portal.",
    body:
      `<p style="margin:0 0 12px">This is a test message sent from the Highclass Shipping admin portal to confirm that transactional email is configured and delivering correctly.</p>` +
      `<p style="margin:0">If you received this in your inbox (not spam), you are ready to send customer notifications, invoices, and broadcasts.</p>`,
    trackingNumber: "HC-TEST-0001",
    ctaUrl: `${SITE}/track`,
    ctaLabel: "Open My Shipments",
    footerNote: "Test message. No action required.",
  });

  const res = await sendEmail({ to, subject: "Highclass Shipping email test", html });
  return {
    ok: res.ok,
    provider: res.provider || provider,
    stub: !!res.stub,
    status: res.status || null,
    error: res.error || null,
  };
});

// ═══════════════════════════════════════════════════════════════
// Callable (admin): reply to a contact-form submission with a branded
// email to an (editable) recipient. Logs the reply on the inquiry and
// moves it to "in_progress" if it was still new.
// ═══════════════════════════════════════════════════════════════
export const sendInquiryReply = onCall({ secrets: EMAIL_SECRETS }, async (req) => {
  await assertAdmin(req);
  const d = req.data || {};
  const to = (d.to || "").trim();
  const subject = (d.subject || "").trim();
  const message = (d.message || "").trim();
  const inquiryId = (d.inquiryId || "").trim();
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    throw new HttpsError("invalid-argument", "A valid recipient email is required.");
  }
  if (!subject || !message) {
    throw new HttpsError("invalid-argument", "Subject and message are required.");
  }

  const bodyHtml = escapeHtml(message).replace(/\n/g, "<br/>");
  const html = emailShell({
    heading: subject,
    preheader: message.slice(0, 120),
    body: `<div>${bodyHtml}</div>`,
    ctaUrl: `${SITE}/contact`,
    ctaLabel: "Contact us",
    footerNote: "You are receiving this because you contacted Highclass Shipping.",
  });

  // Replies should come back to the office inbox.
  const replyTo = cfg(process.env.BREVO_REPLY_TO) || cfg(process.env.BREVO_FROM_EMAIL) || undefined;
  const res = await sendEmail({ to, subject, html, replyTo });

  // Log the reply + advance status (best-effort; never fail the send on these).
  if (res.ok && inquiryId) {
    try {
      const ref = db.collection("contact_inquiries").doc(inquiryId);
      const snap = await ref.get();
      const patch = {
        last_reply_at: FieldValue.serverTimestamp(),
        last_reply_by: req.auth?.uid || "admin",
        reply_count: FieldValue.increment(1),
      };
      if (snap.exists && snap.data().status === "new") patch.status = "in_progress";
      await ref.set(patch, { merge: true });
    } catch (e) {
      logger.warn("sendInquiryReply: could not update inquiry", e);
    }
  }

  return {
    ok: res.ok,
    provider: res.provider || null,
    stub: !!res.stub,
    status: res.status || null,
    error: res.error || null,
  };
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
function sha256Hex(input) {
  return createHash("sha256").update(input).digest("hex");
}

// ── Brute-force throttle for the PUBLIC credential endpoints ──
// A Customer ID / access code is the only credential a customer has, so the
// unauthenticated lookups must not be freely guessable at machine speed. We
// bucket failed attempts per caller IP in Firestore and refuse once a caller
// exceeds MAX_FAILS inside WINDOW_MS. Successful lookups clear the bucket, so
// real customers are never affected.
const RL_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const RL_MAX_FAILS = 12;

function callerKey(req) {
  const ip = req.rawRequest?.ip || req.rawRequest?.headers?.["x-forwarded-for"] || "unknown";
  // x-forwarded-for may be a list; the first entry is the origin client.
  const first = String(ip).split(",")[0].trim();
  return sha256Hex(first).slice(0, 32);
}

// `subject` (the attempted code) is mixed into the bucket key so that a shared
// IP — office NAT, mobile carrier, a whole household — cannot lock a real
// customer out of their OWN id just because someone else on that IP was
// guessing. An attacker sweeping many ids gets a fresh bucket per id, but each
// id still only tolerates MAX_FAILS guesses per window, which is what actually
// protects the credential. Successful lookups clear the bucket immediately.
async function throttleGuard(req, bucket, subject) {
  const key = subject
    ? `${bucket}_${callerKey(req)}_${sha256Hex(String(subject)).slice(0, 16)}`
    : `${bucket}_${callerKey(req)}`;
  const ref = db.collection("rate_limits").doc(key);
  try {
    const snap = await ref.get();
    if (snap.exists) {
      const d = snap.data();
      const startedAt = d.started_at?.toMillis ? d.started_at.toMillis() : 0;
      const fresh = Date.now() - startedAt < RL_WINDOW_MS;
      if (fresh && (d.fails || 0) >= RL_MAX_FAILS) {
        throw new HttpsError(
          "resource-exhausted",
          "Too many attempts. Please wait a few minutes and try again."
        );
      }
    }
  } catch (e) {
    if (e instanceof HttpsError) throw e;
    logger.warn(`throttleGuard(${bucket}): read failed, allowing request`, e);
  }
  return ref;
}

// Record the outcome of a throttled lookup. Failures increment (and start) the
// window; a success clears it. Never let bookkeeping break the response.
async function throttleRecord(ref, ok) {
  if (!ref) return;
  try {
    if (ok) {
      await ref.delete();
      return;
    }
    const snap = await ref.get();
    const startedAt = snap.exists && snap.data().started_at?.toMillis
      ? snap.data().started_at.toMillis()
      : 0;
    if (!snap.exists || Date.now() - startedAt >= RL_WINDOW_MS) {
      await ref.set({ fails: 1, started_at: FieldValue.serverTimestamp() });
    } else {
      await ref.set({ fails: FieldValue.increment(1) }, { merge: true });
    }
  } catch (e) {
    logger.warn("throttleRecord: write failed", e);
  }
}

export const publicTrack = onCall(async (req) => {
  const raw = String(req.data?.code || "").trim();
  if (!raw) return { found: false };
  const code = raw.toUpperCase();
  const rl = await throttleGuard(req, "track", code);

  // Match by tracking number, then fall back to customer ID.
  let snap = await db.collection("shipments").where("tracking_number", "==", code).limit(1).get();
  if (snap.empty) {
    snap = await db.collection("shipments").where("customer_id", "==", code).limit(1).get();
  }
  if (snap.empty) {
    await throttleRecord(rl, false);
    return { found: false };
  }
  await throttleRecord(rl, true);

  const d = snap.docs[0].data();
  // Return ONLY non-sensitive fields — never customer PII or the PDF URL.
  return {
    found: true,
    tracking_number: d.tracking_number || "",
    current_status: d.current_status || "collection",
    service_type: d.service_type || "sea",
    destination_country: d.destination_country || "",
    payment_status: d.payment_status || "unpaid",
  };
});

// ─── Customer ID generator (no password; the ID is the lookup credential) ───
// Format: HC + 2 name initials + 6 base-32 chars, e.g. HCJD7F3K9Q. Unambiguous
// alphabet, includes a check char. Non-guessable enough for status lookup.
const ID_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
function randomIdChars(n) {
  // Deterministic-free randomness is fine here (runs server-side per order).
  let out = "";
  const bytes = randomBytes(n);
  for (let i = 0; i < n; i++) out += ID_ALPHABET[bytes[i] % ID_ALPHABET.length];
  return out;
}
function makeCustomerId(fullName) {
  const parts = String(fullName || "").trim().split(/\s+/).filter(Boolean);
  const ini = ((parts[0]?.[0] || "X") + (parts[1]?.[0] || parts[0]?.[1] || "X"))
    .toUpperCase()
    .replace(/[^A-Z]/g, "X");
  const body = `HC${ini}${randomIdChars(6)}`;
  const check = dammCheck(body);
  return `${body}${check}`;
}

// ═══════════════════════════════════════════════════════════════
// Callable (PUBLIC): submit an order with no account. Creates a
// lightweight customer record + shipment via Admin SDK and returns
// the Customer ID + tracking number. Server recomputes the total from
// the price list so the client can't tamper with pricing.
// ═══════════════════════════════════════════════════════════════
const SEA_PRICES = {
  1:35,2:50,3:65,4:90,5:100,6:110,7:150,8:160,9:220,10:220,11:200,12:100,13:130,14:80,
  15:70,16:90,17:200,18:60,19:100,20:60,21:80,22:120,23:120,24:250,25:300,26:400,27:650,28:1400,
};
const AIR_RATE = 5.5, DIM_DIV = 166;
const RORO_RATE = { grimaldi: 1400, sallaum: 1380, msc: 1400 };

export const submitPublicOrder = onCall({ secrets: EMAIL_SECRETS }, async (req) => {
  const d = req.data || {};
  const svc = d.service_type;
  if (!["sea", "air", "roro"].includes(svc))
    throw new HttpsError("invalid-argument", "Invalid service type.");
  if (!d.full_name || !d.email) throw new HttpsError("invalid-argument", "Name and email required.");
  // The sender's USA address is required: it appears on the invoice and is what
  // a door-to-door pickup falls back to (see pickup_address below), so a blank
  // one would leave the driver with nowhere to collect from.
  if (!String(d.address || "").trim()) {
    throw new HttpsError("invalid-argument", "Your USA address is required.");
  }
  if (!d.destination_country) throw new HttpsError("invalid-argument", "Destination required.");
  if (!d.receiver?.full_name || !d.receiver?.phone)
    throw new HttpsError("invalid-argument", "Receiver name and phone required.");

  // Recompute total server-side (never trust client price).
  let total = 0;
  let items = [];
  if (svc === "sea") {
    const sel = Array.isArray(d.items) ? d.items : [];
    for (const it of sel) {
      const qty = Math.max(0, Math.min(999, parseInt(it.quantity, 10) || 0));
      if (qty <= 0) continue;

      // s_n 0 marks an item the customer described that is not on the price
      // list. It cannot be priced here — size and handling decide the rate — so
      // it is recorded at 0 and the office quotes it before invoicing. Without
      // this branch the item was silently dropped and the customer's order
      // arrived missing exactly the thing they could not find in the list.
      if (!it.s_n) {
        const desc = String(it.description || "").trim().slice(0, 200);
        if (!desc) continue;
        items.push({
          price_list_id: "custom",
          description: desc,
          dimensions: "",
          unit_price: 0,
          quantity: qty,
          line_total: 0,
          needs_quote: true,
        });
        continue;
      }

      const price = SEA_PRICES[it.s_n];
      if (!price) continue;
      total += price * qty;
      items.push({
        price_list_id: String(it.s_n),
        description: it.description || `Item ${it.s_n}`,
        dimensions: it.dimensions || "",
        unit_price: price,
        quantity: qty,
        line_total: price * qty,
      });
    }
    if (items.length === 0) throw new HttpsError("invalid-argument", "Select at least one item.");
  } else if (svc === "air") {
    const w = Math.max(0, Number(d.weight) || 0);
    const dims = d.dimensions;
    let dim = 0;
    if (dims && dims.length && dims.width && dims.height)
      dim = (dims.length * dims.width * dims.height) / DIM_DIV;
    const billable = Math.max(w, dim);
    total = Math.round(billable * AIR_RATE * 100) / 100;
    if (total <= 0) throw new HttpsError("invalid-argument", "Enter a valid weight.");
  } else {
    const line = d.shipping_line;
    if (!RORO_RATE[line]) throw new HttpsError("invalid-argument", "Choose a shipping line.");
    total = d.vehicle_class === "class_c" ? 0 : RORO_RATE[line];
  }

  // Door-to-door pickup is QUOTED, not a fixed fee: the cost depends on distance
  // and volume, so a flat figure was wrong as often as it was right. The request
  // is recorded with pickup_fee_pending so staff price it from the backend, and
  // the customer is told at checkout that the final price will be higher.
  const wantsPickup = !!d.door_to_door;

  // Compute age from date of birth (YYYY-MM-DD) for the backend record.
  let age = null;
  if (d.dob) {
    const dobDate = new Date(d.dob);
    if (!isNaN(dobDate.getTime())) {
      const now = new Date();
      age = now.getFullYear() - dobDate.getFullYear();
      const m = now.getMonth() - dobDate.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < dobDate.getDate())) age -= 1;
      if (age < 0 || age > 130) age = null;
    }
  }

  // Create (or reuse) a lightweight customer record keyed by email.
  // Query by email only (single-field, no composite index needed) then filter
  // for role === "customer" in memory.
  const email = String(d.email).trim().toLowerCase();
  let customerId;
  const emailMatches = await db
    .collection("users")
    .where("email", "==", email)
    .limit(5)
    .get();
  const existingDoc = emailMatches.docs.find((doc) => doc.data().role === "customer");
  const existing = { empty: !existingDoc, docs: existingDoc ? [existingDoc] : [] };
  const profileExtra = {
    full_name: d.full_name,
    phone: d.phone || "",
    address: d.address || "",
    dob: d.dob || "",
    age: age,
    updated_at: FieldValue.serverTimestamp(),
  };
  // A returning customer supplies their Customer ID. Verify it and reuse the
  // account so their history stays in one place.
  const claimedId = String(d.customer_id || "").trim().toUpperCase();
  if (claimedId) {
    const claimed = await db.collection("users").doc(claimedId).get();
    if (!claimed.exists || claimed.data().role !== "customer") {
      throw new HttpsError(
        "not-found",
        "We could not find that Customer ID. Check it and try again, or continue as a new customer."
      );
    }
    const owner = claimed.data();
    // The ID alone is the credential, so it must match the email on file —
    // otherwise anyone holding an ID could attach orders to that account.
    if ((owner.email || "").toLowerCase() !== email) {
      throw new HttpsError(
        "permission-denied",
        "That Customer ID belongs to a different email address. Use the email you registered with."
      );
    }
    customerId = claimed.id;
    await claimed.ref.set(profileExtra, { merge: true });
  } else if (!existing.empty) {
    // Signing up again with an address already on file: tell them, and send the
    // ID so they can proceed, rather than silently creating a second identity for
    // the same person (which is what splits an order history in two).
    const found = existing.docs[0];
    try {
      await sendEmail({
        to: email,
        subject: "Your Highclass Shipping Customer ID",
        html: emailShell({
          heading: "Here is your Customer ID",
          body: `You already have an account with us, so there is no need to register again.<br/><br/>
                 Your Customer ID is <strong style="font-family:monospace;font-size:18px;letter-spacing:1px">${found.id}</strong><br/><br/>
                 Enter it on the order form as a returning customer, or use it to track your shipments.`,
          ctaUrl: `${SITE}/track`,
          ctaLabel: "Track your shipments",
        }),
      });
    } catch {
      // Never let a failed email hide the real reason the order was rejected.
    }
    throw new HttpsError(
      "already-exists",
      `An account already exists for ${email}. We have emailed your Customer ID — enter it as a returning customer to add this shipment to your account.`
    );
  } else {
    customerId = makeCustomerId(d.full_name);
    await db.collection("users").doc(customerId).set({
      customer_code: customerId,
      email,
      role: "customer",
      is_active: true,
      notify_email: true,
      created_at: FieldValue.serverTimestamp(),
      ...profileExtra,
    });
  }

  // Tracking number.
  const serial = await db.runTransaction(async (tx) => {
    const ref = db.collection("counters").doc("shipment");
    const c = await tx.get(ref);
    const val = (c.exists ? c.data().value : 1000) + 1;
    tx.set(ref, { value: val }, { merge: true });
    return val;
  });
  const prefix = { sea: "SEA", air: "AIR", roro: "RRO" }[svc];
  const yr = new Date().getFullYear();
  const tracking = `HC-${prefix}-${yr}-${String(serial).padStart(5, "0")}`;

  const shipment = {
    tracking_number: tracking,
    customer_id: customerId,
    customer_name: d.full_name,
    customer_email: email,
    customer_phone: d.phone || "",
    service_type: svc,
    current_status: "collection",
    sender_address: d.address || "",
    destination_country: d.destination_country,
    destination_city: d.destination_city || "",
    door_to_door: wantsPickup,
    pickup_fee: 0,
    pickup_fee_pending: wantsPickup,
    subtotal: total,
    pickup_address: wantsPickup ? d.pickup_address || d.address || "" : "",
    receiver: {
      full_name: d.receiver.full_name,
      phone: d.receiver.phone,
      address: d.receiver.address || "",
      city: d.destination_city || "",
    },
    notes: d.notes || "",
    // Customer-declared fragile cargo — carried through to the warehouse,
    // destination office and rider so handling instructions are not lost.
    fragile: !!d.fragile,
    fragile_note: d.fragile ? String(d.fragile_note || "").slice(0, 300) : "",
    declared_value: Number(d.declared_value) || 0,
    total_price: total,
    currency: "USD",
    payment_status: "unpaid",
    deposit: 0,
    balance: total,
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  };
  if (svc === "sea") shipment.items = items;
  if (svc === "air") {
    shipment.weight = Number(d.weight) || 0;
    if (d.dimensions) shipment.dimensions = d.dimensions;
  }
  if (svc === "roro") {
    shipment.shipping_line = d.shipping_line;
    shipment.vehicle_class = d.vehicle_class || "class_a";
    shipment.vehicle_details = d.vehicle_details || "";
  }
  const shipRef = await db.collection("shipments").add(shipment);

  // Confirmation email carrying the Customer ID — the customer's ONLY
  // credential, so whether it actually sent must be recorded truthfully (it was
  // previously logged as "sent" unconditionally) and returned to the client.
  // Customer-supplied fields are escaped: they are rendered into HTML here.
  const safeName = escapeHtml(d.full_name);
  const safeDest = escapeHtml(d.destination_country);
  const emailRes = await sendEmail({
    to: email,
    subject: `Order received: ${tracking}`,
    html: emailShell({
      heading: "We've received your order",
      body: `Thank you, ${safeName}. Your shipment to ${safeDest} has been logged.<br/><br/>Your Customer ID is <strong style="font-family:monospace;font-size:16px">${escapeHtml(
        customerId
      )}</strong>. Keep it safe. Use it on our website to check your status and download your receipt at any time.`,
      trackingNumber: tracking,
      ctaUrl: `${SITE}/track?id=${encodeURIComponent(customerId)}`,
    }),
  });
  await db.collection("notifications").doc().set({
    customer_id: customerId, shipment_id: shipRef.id, channel: "email",
    type: "order_confirmation", subject: `Order received: ${tracking}`,
    status: emailRes.ok === false ? "failed" : "sent",
    stub: !!emailRes.stub,
    created_at: FieldValue.serverTimestamp(),
  });

  // emailSent lets the UI tell the customer to save their ID from the screen
  // when the email could not be delivered.
  return {
    ok: true,
    customerId,
    trackingNumber: tracking,
    total,
    emailSent: emailRes.ok !== false,
  };
});

// ═══════════════════════════════════════════════════════════════
// Callable (PUBLIC): view all shipments for a Customer ID. The ID is
// the credential, so this returns full details + receipt links for the
// customer's own shipments only.
// ═══════════════════════════════════════════════════════════════
export const viewByCustomerId = onCall(async (req) => {
  const id = String(req.data?.customerId || "").trim().toUpperCase();
  // The Customer ID IS the credential here (it returns full shipment detail and
  // receipt links), so keep the shape check strict: HC + 2 initials + 6 chars +
  // check char. Anything else is rejected without touching Firestore.
  if (!/^HC[A-Z0-9]{9}$/.test(id)) return { found: false };
  const rl = await throttleGuard(req, "viewid", id);

  const userSnap = await db.collection("users").doc(id).get();
  const snap = await db
    .collection("shipments")
    .where("customer_id", "==", id)
    .get();
  if (snap.empty && !userSnap.exists) {
    await throttleRecord(rl, false);
    return { found: false };
  }
  await throttleRecord(rl, true);

  const shipments = snap.docs
    .map((doc) => {
      const s = doc.data();
      return {
        id: doc.id,
        tracking_number: s.tracking_number || "",
        service_type: s.service_type || "sea",
        current_status: s.current_status || "collection",
        destination_country: s.destination_country || "",
        destination_city: s.destination_city || "",
        receiver: s.receiver || null,
        items: s.items || [],
        weight: s.weight || null,
        shipping_line: s.shipping_line || null,
        vehicle_class: s.vehicle_class || null,
        total_price: s.total_price || 0,
        deposit: s.deposit || 0,
        balance: s.balance != null ? s.balance : s.total_price || 0,
        payment_status: s.payment_status || "unpaid",
        currency: s.currency || "USD",
        // Pricing breakdown, so the portal can show the same figures as the
        // invoice rather than a bare total the customer cannot reconcile.
        subtotal: s.subtotal != null ? s.subtotal : null,
        pickup_fee: s.pickup_fee || 0,
        pickup_fee_pending: !!s.pickup_fee_pending,
        door_to_door: !!s.door_to_door,
        discount_type: s.discount_type || null,
        discount_value: s.discount_value || 0,
        discount_amount: s.discount_amount || 0,
        discount_reason: s.discount_reason || null,
        // Proof of delivery — the customer is entitled to see the evidence that
        // their goods were handed over, and who released them.
        proof_photos: Array.isArray(s.proof_photos) ? s.proof_photos : [],
        handover_method: s.handover_method || null,
        delivered_by_name: s.delivered_by_name || null,
        received_by_name: s.received_by_name || null,
        delivered_at: s.delivered_at ? s.delivered_at.toMillis() : null,
        container_number: s.container_number || null,
        container_shipped_on: s.container_shipped_on || null,
        dnr:
          s.dnr_override === true
            ? true
            : s.dnr_override === false
            ? false
            : typeof s.dnr === "boolean"
            ? s.dnr
            : (s.payment_status || "unpaid") !== "paid",
        receipt_number: s.receipt_number || null,
        receipt_pdf_url: s.receipt_pdf_url || null,
        created_at: s.created_at ? s.created_at.toMillis() : null,
      };
    })
    .sort((a, b) => (b.created_at || 0) - (a.created_at || 0));

  const u = userSnap.exists ? userSnap.data() : {};
  return {
    found: true,
    customer: {
      id,
      full_name: u.full_name || "",
      email: u.email || "",
      phone: u.phone || "",
      dob: u.dob || "",
      address: u.address || "",
    },
    shipments,
  };
});

export const resolveAccessCode = onCall(async (req) => {
  const clean = normalizeCode(req.data?.code);
  if (clean.length < 10 || clean.length > 12) return { found: false };
  const body = clean.slice(0, -1);
  if (dammCheck(body) !== clean.slice(-1)) return { found: false };
  const rl = await throttleGuard(req, "accesscode", clean);

  const prefix = clean.slice(0, 4);
  // Single-field query (no composite index); role filtered in memory.
  const snap = await db
    .collection("users")
    .where("access_code_prefix", "==", prefix)
    .limit(30)
    .get();

  for (const d of snap.docs) {
    const u = d.data();
    if (u.role !== "customer" || u.is_active === false || u.deleted === true) continue;
    if (!u.access_code_salt || !u.access_code_hash) continue;
    const h = sha256Hex(`${u.access_code_salt}:${clean}`);
    if (h === u.access_code_hash) {
      await throttleRecord(rl, true);
      return { found: true, email: u.email || "", fullName: u.full_name || "" };
    }
  }
  await throttleRecord(rl, false);
  return { found: false };
});

// ═══════════════════════════════════════════════════════════════
// Callable: send access-code email
// ═══════════════════════════════════════════════════════════════
export const sendAccessCodeEmail = onCall({ secrets: EMAIL_SECRETS }, async (req) => {
  await assertAdmin(req);
  const { email, fullName, code } = req.data || {};
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email))) {
    throw new HttpsError("invalid-argument", "A valid email is required.");
  }
  const name = escapeHtml(fullName || "there");
  const safeCode = escapeHtml(code || "");
  const heading = "Your Highclass Access Code";
  const body = code
    ? `Hi ${name}, keep this access code safe. It lets you return to your account and full shipment history at any time:<br/><br/><span style="font-family:monospace;font-size:22px;letter-spacing:3px;color:#0B1E3A"><strong>${safeCode}</strong></span>`
    : `Hi ${name}, we received a request for your account. Use the return page and your access code to sign back in. If you didn't request this, you can ignore this email.`;
  const res = await sendEmail({
    to: email, subject: heading,
    html: emailShell({ heading, body, ctaUrl: `${SITE}/return` }),
  });
  await db.collection("notifications").doc().set({
    customer_id: "", channel: "email", type: "access_code",
    subject: heading, status: res.ok ? "sent" : "failed",
    stub: !!res.stub, created_at: FieldValue.serverTimestamp(),
  });
  return {
    ok: res.ok !== false,
    stub: !!res.stub,
    error: sendErrorSummary([{ status: "fulfilled", value: res }]),
  };
});

// ═══════════════════════════════════════════════════════════════
// Callable: sailing broadcast to active customers with active shipments
// ═══════════════════════════════════════════════════════════════
export const sendSailingBroadcast = onCall({ secrets: EMAIL_SECRETS }, async (req) => {
  await assertAdmin(req);
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

  const safeBody = escapeHtml(body).replace(/\n/g, "<br/>");
  const recipientIds = [];
  const sends = [];
  for (const cid of activeCustomerIds) {
    const uSnap = await db.collection("users").doc(cid).get();
    if (!uSnap.exists) continue;
    const u = uSnap.data();
    if (u.is_active === false || u.deleted === true || u.role !== "customer" || !u.email) continue;
    if (u.notify_email === false) continue;
    recipientIds.push(cid);
    sends.push(
      sendEmail({
        to: u.email,
        subject,
        html: emailShell({ heading: subject, body: safeBody, ctaUrl: `${SITE}/track` }),
      })
    );
  }
  const results = await Promise.allSettled(sends);
  const failed = results.filter((r) => r.status === "rejected" || r.value?.ok === false).length;

  return {
    ok: failed === 0,
    recipientCount: recipientIds.length,
    failedCount: failed,
    recipientIds,
    error: sendErrorSummary(results),
  };
});

// ═══════════════════════════════════════════════════════════════
// Callable (admin): broadcast a premium container-availability notice to
// every customer who has a shipment on a given container (CNT). Supports a
// test send (testEmail) that delivers only to that address for preview.
// ═══════════════════════════════════════════════════════════════
export const sendContainerBroadcast = onCall({ secrets: EMAIL_SECRETS }, async (req) => {
  await assertAdmin(req);
  const d = req.data || {};
  const containerNumber = (d.containerNumber || "").trim();
  const subject = (d.subject || "").trim();
  const body = (d.body || "").trim();
  const testEmail = (d.testEmail || "").trim();
  if (!containerNumber) throw new HttpsError("invalid-argument", "containerNumber required");
  if (!subject || !body) throw new HttpsError("invalid-argument", "subject and body required");

  const cntLabel = `CNT #${containerNumber}`;
  const html = containerNoticeEmail({
    heading: subject,
    body,
    containerLabel: cntLabel,
    officeName: d.officeName || "",
    officeAddress: d.officeAddress || "",
    officePhone: d.officePhone || "",
    deliveryContactName: d.deliveryContactName || "",
    deliveryContactPhone: d.deliveryContactPhone || "",
    nextLoadingDate: d.nextLoadingDate || "",
    nextLoadingNote: d.nextLoadingNote || "",
    usPhones: d.usPhones || "",
    ctaUrl: `${SITE}/track`,
  });

  // Test send: deliver only to the given address, do not touch customers.
  if (testEmail) {
    const res = await sendEmail({ to: testEmail, subject: `[TEST] ${subject}`, html });
    return {
      ok: res.ok !== false,
      test: true,
      recipientCount: 1,
      recipientIds: [],
      error: sendErrorSummary([{ status: "fulfilled", value: res }]),
      stub: !!res.stub,
    };
  }

  const emailRe = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

  // If the admin supplied an explicit, edited recipient list, send to exactly
  // those addresses (validated + de-duplicated, case-insensitive). This backs
  // the editable recipient list in the admin UI.
  const explicit = Array.isArray(d.emails) ? d.emails : null;
  if (explicit) {
    const seen = new Set();
    const targets = [];
    for (const raw of explicit) {
      const e = String(raw || "").trim();
      const key = e.toLowerCase();
      if (emailRe.test(e) && !seen.has(key)) {
        seen.add(key);
        targets.push(e);
      }
    }
    if (targets.length === 0) {
      throw new HttpsError("invalid-argument", "No valid recipient emails were provided.");
    }
    const sends = targets.map((email) => sendEmail({ to: email, subject, html }));
    const results = await Promise.allSettled(sends);
    const failed = results.filter((r) => r.status === "rejected" || r.value?.ok === false).length;
    return {
      ok: failed === 0,
      recipientCount: targets.length,
      failedCount: failed,
      recipientEmails: targets,
      error: sendErrorSummary(results),
    };
  }

  // Otherwise, derive recipients from the container's shipments (legacy path).
  const shipSnap = await db
    .collection("shipments")
    .where("container_number", "==", containerNumber)
    .get();
  const customerIds = new Set();
  shipSnap.forEach((doc) => {
    const s = doc.data();
    if (s.customer_id) customerIds.add(s.customer_id);
  });

  const recipientIds = [];
  const sends = [];
  for (const cid of customerIds) {
    const uSnap = await db.collection("users").doc(cid).get();
    if (!uSnap.exists) continue;
    const u = uSnap.data();
    if (u.is_active === false || u.deleted === true || u.role !== "customer" || !u.email) continue;
    if (u.notify_email === false) continue;
    recipientIds.push(cid);
    sends.push(sendEmail({ to: u.email, subject, html }));
  }
  const results = await Promise.allSettled(sends);
  const failed = results.filter((r) => r.status === "rejected" || r.value?.ok === false).length;

  return {
    ok: failed === 0,
    recipientCount: recipientIds.length,
    failedCount: failed,
    recipientIds,
    error: sendErrorSummary(results),
  };
});

// ═══════════════════════════════════════════════════════════════
// Callable: generate a digital receipt (stub returns a data ref;
// real PDF rendering can be added with a PDF lib later)
// ═══════════════════════════════════════════════════════════════
export const generateReceiptPdf = onCall({ secrets: EMAIL_SECRETS }, async (req) => {
  // Auth guard: only admin or the destination-office staff for this shipment's
  // country may generate a receipt (prevents IDOR against other customers' PII).
  if (!req.auth?.uid) throw new HttpsError("unauthenticated", "Sign in required.");
  const actorSnap = await db.collection("users").doc(req.auth.uid).get();
  const actor = actorSnap.exists ? actorSnap.data() : null;
  if (!actor || !["admin", "nigeria_office"].includes(actor.role)) {
    throw new HttpsError("permission-denied", "Staff access required.");
  }

  const { shipmentId } = req.data || {};
  if (!shipmentId) throw new HttpsError("invalid-argument", "shipmentId required");
  const shipRef = db.collection("shipments").doc(shipmentId);
  const shipSnap = await shipRef.get();
  if (!shipSnap.exists) throw new HttpsError("not-found", "Shipment not found");
  const ship = { id: shipSnap.id, ...shipSnap.data() };

  // Office staff may only receipt shipments for their assigned country.
  if (actor.role === "nigeria_office" && ship.destination_country !== actor.assigned_country) {
    throw new HttpsError("permission-denied", "Shipment is outside your assigned country.");
  }

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

  // Render the branded PDF (with QR) and upload to Storage with a download token.
  // Using a Firebase download token (not getSignedUrl) avoids requiring the
  // iam.serviceAccountTokenCreator role on the runtime service account.
  const pdf = await renderReceiptPdf({ shipment: ship, receiptNumber, siteUrl: SITE });
  // Explicit bucket name (project uses the .firebasestorage.app bucket, which
  // is NOT the legacy .appspot.com default that getStorage().bucket() assumes).
  const bucket = getStorage().bucket("highclassshippinglogistics.firebasestorage.app");
  const path = `receipts/${shipmentId}/${receiptNumber}.pdf`;
  const file = bucket.file(path);
  // Random, unguessable download token so an invoice URL can't be reconstructed
  // from a (sequential) receipt number + shipment id.
  const downloadToken = randomBytes(16).toString("hex");
  await file.save(pdf, {
    contentType: "application/pdf",
    resumable: false,
    metadata: {
      cacheControl: "private, max-age=0",
      metadata: { firebaseStorageDownloadTokens: downloadToken },
    },
  });
  const pdfUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(
    path
  )}?alt=media&token=${downloadToken}`;

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
// Callable (admin): delete a shipment's invoice.
// Removes the digital_receipts records, deletes the Storage PDF object,
// and clears the receipt fields on the shipment. Runs with the Admin SDK
// so it works regardless of client-side security rules and leaves no
// orphaned (still-downloadable) PDF behind.
// ═══════════════════════════════════════════════════════════════
export const deleteReceiptPdf = onCall(async (req) => {
  if (!req.auth?.uid) throw new HttpsError("unauthenticated", "Sign in required.");
  const actorSnap = await db.collection("users").doc(req.auth.uid).get();
  const actor = actorSnap.exists ? actorSnap.data() : null;
  if (!actor || actor.role !== "admin") {
    throw new HttpsError("permission-denied", "Admin access required.");
  }

  const { shipmentId } = req.data || {};
  if (!shipmentId) throw new HttpsError("invalid-argument", "shipmentId required");

  const shipRef = db.collection("shipments").doc(shipmentId);
  const shipSnap = await shipRef.get();
  if (!shipSnap.exists) throw new HttpsError("not-found", "Shipment not found");

  // Delete every digital_receipts record for this shipment.
  const recSnap = await db
    .collection("digital_receipts")
    .where("shipment_id", "==", shipmentId)
    .get();
  await Promise.all(recSnap.docs.map((d) => d.ref.delete()));

  // Delete the Storage PDF(s) for this shipment (whole receipts/{shipmentId}/ prefix).
  const bucket = getStorage().bucket("highclassshippinglogistics.firebasestorage.app");
  try {
    await bucket.deleteFiles({ prefix: `receipts/${shipmentId}/` });
  } catch (err) {
    logger.warn("deleteReceiptPdf: storage cleanup failed", err);
  }

  // Clear the receipt fields on the shipment.
  await shipRef.set(
    {
      receipt_number: FieldValue.delete(),
      receipt_pdf_url: FieldValue.delete(),
      updated_at: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return { ok: true, deleted: recSnap.size };
});

// ═══════════════════════════════════════════════════════════════
// Callable (admin): create a staff account (nigeria_office/dispatcher/admin)
// Creates the Firebase Auth user + Firestore profile WITHOUT signing the
// admin out (the client SDK can't do this). Emails a temp password.
// ═══════════════════════════════════════════════════════════════
export const createStaffUser = onCall({ secrets: EMAIL_SECRETS }, async (req) => {
  await assertAdmin(req);
  const { email, fullName, role, phone, assignedCountry, password, allowedFeatures } =
    req.data || {};
  if (!email || !fullName || !role) {
    throw new HttpsError("invalid-argument", "email, fullName, and role are required.");
  }
  if (!["admin", "nigeria_office", "dispatcher"].includes(role)) {
    throw new HttpsError("invalid-argument", "Invalid staff role.");
  }

  // Randomly generated, never derived. The previous version hashed
  // email + fullName, so anyone who knew a colleague's name and address could
  // reconstruct their temporary password before they first signed in.
  const tempPassword = password || generateTempPassword();

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
  // Optional per-user menu/feature override (array of feature keys). Absent/null
  // means the account uses its role defaults.
  if (Array.isArray(allowedFeatures)) {
    profile.allowed_features = allowedFeatures.filter((k) => typeof k === "string");
  }

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


/**
 * Cryptographically random temporary password.
 *
 * Alphabets deliberately exclude look-alike characters (O/0, I/l/1) because
 * these get read aloud over the phone and typed by hand; a mistyped temp
 * password is indistinguishable from a wrong one to the person receiving it.
 * Shape is fixed at 4-4-4 with a digit and a symbol so it always satisfies
 * Firebase's minimum strength requirements.
 */
function generateTempPassword() {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%&*";
  const pick = (set, n) => {
    const bytes = randomBytes(n);
    let out = "";
    for (let i = 0; i < n; i++) out += set[bytes[i] % set.length];
    return out;
  };
  return `${pick(upper, 2)}${pick(lower, 3)}-${pick(digits, 3)}-${pick(lower, 3)}${pick(symbols, 1)}`;
}

// ═══════════════════════════════════════════════════════════════
// Admin: issue a NEW temporary password for an existing staff account.
// Needed when someone forgets their password and cannot receive the reset email
// (wrong address on file, mailbox not set up yet), which is the common case for
// warehouse and rider accounts.
// ═══════════════════════════════════════════════════════════════
export const resetStaffPassword = onCall({ secrets: EMAIL_SECRETS }, async (req) => {
  await assertAdmin(req);
  const { uid, password } = req.data || {};
  if (!uid) throw new HttpsError("invalid-argument", "uid required.");

  const snap = await db.collection("users").doc(uid).get();
  if (!snap.exists) throw new HttpsError("not-found", "Staff account not found.");
  const target = snap.data();
  if (target.role === "customer") {
    // Customers authenticate with an access code, not a password — issuing one
    // here would create a login path that does not exist for them.
    throw new HttpsError("failed-precondition", "Customers do not have passwords.");
  }

  const tempPassword = password || generateTempPassword();
  if (String(tempPassword).length < 8) {
    throw new HttpsError("invalid-argument", "Password must be at least 8 characters.");
  }

  try {
    await getAuth().updateUser(uid, { password: String(tempPassword) });
  } catch (e) {
    throw new HttpsError("internal", e?.message || "Could not set the password.");
  }

  // Best-effort notification; the admin also sees the password on screen so a
  // failed send never blocks handing it over in person.
  let emailed = false;
  try {
    const res = await sendEmail({
      to: target.email,
      subject: "Your Highclass Shipping password has been reset",
      html: emailShell({
        heading: "Your password was reset",
        body: `An administrator has issued a new temporary password for your staff account.<br/><br/>
               <strong style="font-family:monospace;font-size:18px;letter-spacing:1px">${tempPassword}</strong><br/><br/>
               Sign in with it, then change it immediately from your account settings.`,
        ctaUrl: `${SITE}/login`,
        ctaLabel: "Sign in",
      }),
    });
    emailed = !!res?.ok;
  } catch {
    emailed = false;
  }

  await db.collection("activity_log").doc().set({
    actor_id: req.auth.uid,
    action: "staff_password_reset",
    target: uid,
    // Never log the password itself — activity_log is readable by every admin.
    meta: { email: target.email || null, emailed },
    created_at: FieldValue.serverTimestamp(),
  });

  return { ok: true, tempPassword, emailed };
});

// ═══════════════════════════════════════════════════════════════
// Callable (admin): update a staff member's role / country / active
// ═══════════════════════════════════════════════════════════════
const STAFF_ROLE_KEYS = ["admin", "nigeria_office", "dispatcher"];

export const updateStaffUser = onCall(async (req) => {
  await assertAdmin(req);
  const { uid, role, assignedCountry, isActive, allowedFeatures, fullName, email, phone } =
    req.data || {};
  if (!uid) throw new HttpsError("invalid-argument", "uid required.");
  const patch = {};

  if (role !== undefined) {
    // Whitelist: an arbitrary string here would create a role no rule or menu
    // recognises, locking the user out of every portal.
    if (!STAFF_ROLE_KEYS.includes(role)) {
      throw new HttpsError("invalid-argument", "Unknown staff role.");
    }
    patch.role = role;
  }
  if (fullName !== undefined) {
    const name = String(fullName).trim();
    if (name.length < 2) throw new HttpsError("invalid-argument", "Name is too short.");
    patch.full_name = name;
  }
  if (phone !== undefined) patch.phone = String(phone).trim();
  if (assignedCountry !== undefined) patch.assigned_country = assignedCountry;
  if (isActive !== undefined) patch.is_active = isActive;
  // allowedFeatures: array => set exact override; null => clear (back to role defaults).
  if (allowedFeatures === null) {
    patch.allowed_features = FieldValue.delete();
  } else if (Array.isArray(allowedFeatures)) {
    patch.allowed_features = allowedFeatures.filter((k) => typeof k === "string");
  }

  // Email is the staff member's SIGN-IN identity, so it lives in Firebase Auth as
  // well as Firestore. Auth is updated FIRST: if it rejects (bad format, or the
  // address already belongs to another account) we must not leave Firestore
  // showing an address the user cannot actually log in with.
  if (email !== undefined) {
    const next = String(email).trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(next)) {
      throw new HttpsError("invalid-argument", "Enter a valid email address.");
    }
    try {
      await getAuth().updateUser(uid, { email: next });
    } catch (e) {
      if (e?.code === "auth/email-already-exists") {
        throw new HttpsError("already-exists", "Another account already uses that email.");
      }
      throw new HttpsError("internal", e?.message || "Could not update the sign-in email.");
    }
    patch.email = next;
  }

  // Guard against removing the last administrator: demoting or disabling the
  // only admin would leave nobody able to manage staff at all.
  const demoting = (role !== undefined && role !== "admin") || isActive === false;
  if (demoting) {
    const target = await db.collection("users").doc(uid).get();
    if (target.exists && target.data().role === "admin") {
      const admins = await db.collection("users").where("role", "==", "admin").get();
      const otherActive = admins.docs.filter(
        (d) => d.id !== uid && d.data().is_active !== false && !d.data().deleted
      );
      if (otherActive.length === 0) {
        throw new HttpsError(
          "failed-precondition",
          "This is the last active administrator. Promote another admin first."
        );
      }
    }
  }

  await db.collection("users").doc(uid).set(patch, { merge: true });
  // Build a serializable meta (never log the FieldValue.delete sentinel).
  const logMeta = { ...patch };
  if (allowedFeatures === null) logMeta.allowed_features = "cleared";
  await db.collection("activity_log").doc().set({
    actor_id: req.auth.uid, action: "staff_updated", target: uid, meta: logMeta,
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

  // ── Auto-add to destination inventory when the shipment reaches the
  // destination warehouse (offloading). Idempotent via a deterministic doc id
  // (one per shipment): create() throws on a duplicate, which we ignore, so
  // concurrent/duplicate trigger firings cannot create two records. ──
  if (after.current_status === "offloading") {
    try {
      const items = Array.isArray(after.items) ? after.items : [];
      const desc =
        items.length > 0
          ? items
              .map((it) => `${it.quantity && it.quantity > 1 ? `${it.quantity}x ` : ""}${it.description || "Item"}`)
              .join(", ")
          : after.service_type === "air"
          ? "Air freight shipment"
          : after.service_type === "roro"
          ? `Vehicle (RORO)${after.vehicle_details ? ` (${after.vehicle_details})` : ""}`
          : "Shipment";
      await db
        .collection("destination_inventory")
        .doc(event.params.shipmentId)
        .create({
          shipment_id: event.params.shipmentId,
          tracking_number: after.tracking_number || "",
          item_description: desc.slice(0, 500),
          destination_country: after.destination_country || "",
          location_notes: "Auto-added on arrival at destination warehouse",
          received_at: FieldValue.serverTimestamp(),
          dispatched_at: null,
        });
    } catch (e) {
      // ALREADY_EXISTS (code 6) is expected on repeat firings; anything else logs.
      if (!(e && (e.code === 6 || String(e).includes("ALREADY_EXISTS")))) {
        logger.warn("onShipmentStatusChange: inventory auto-add failed", e);
      }
    }
  }

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
      subject: `${heading}: ${after.tracking_number}`,
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
      body: `Highclass Shipping: ${after.tracking_number}. ${stageMessage(status, after.destination_country)}`,
    });
    await db.collection("notifications").doc().set({
      customer_id: custId, shipment_id: event.params.shipmentId, channel: "sms",
      type: `auto_stage_${status}`, status: res.ok ? "sent" : "failed",
      stub: !!res.stub, created_at: FieldValue.serverTimestamp(),
    });
  }
  }
);

// ═══════════════════════════════════════════════════════════════
// Callables (admin): seed / clear DEMO CUSTOMER records.
// firestore.rules only lets a signed-in user create their OWN users/{uid} doc,
// so an admin cannot write customer records from the client. These run with the
// Admin SDK. Every doc is tagged { demo: true } and given a HCDEMO* id so the
// clear step can only ever touch seeded rows, never a real customer.
// ═══════════════════════════════════════════════════════════════
const DEMO_CUSTOMERS = [
  { id: "HCDEMO00001", full_name: "Samuel Adeyemi",  email: "samuel.demo@example.com",  phone: "+234 806 888 1212", address: "3 Ring Rd, Ibadan",                 dob: "1988-04-12" },
  { id: "HCDEMO00002", full_name: "Chinelo Obi",     email: "chinelo.demo@example.com", phone: "+234 810 555 9090", address: "10 Zik Ave, Enugu",                 dob: "1992-09-30" },
  { id: "HCDEMO00003", full_name: "Fatou Diallo",    email: "fatou.demo@example.com",   phone: "+221 77 123 4567",  address: "Route de Ngor, Dakar",              dob: "1985-01-22" },
  { id: "HCDEMO00004", full_name: "Ngozi Eze",       email: "ngozi.demo@example.com",   phone: "+234 902 444 5566", address: "22 Admiralty Way, Lekki, Lagos",    dob: "1990-07-08" },
  { id: "HCDEMO00005", full_name: "Yaw Boateng",     email: "yaw.demo@example.com",     phone: "+233 24 111 2222",  address: "5 Prempeh Rd, Kumasi",              dob: "1979-11-03" },
  { id: "HCDEMO00006", full_name: "Adaeze Okafor",   email: "adaeze.demo@example.com",  phone: "+234 803 111 2222", address: "5 Awolowo Rd, Ikeja, Lagos",        dob: "1994-02-17" },
  { id: "HCDEMO00007", full_name: "Tunde Balogun",   email: "tunde.demo@example.com",   phone: "+234 701 222 3344", address: "8 Aso Drive, Maitama, Abuja",       dob: "1983-06-25" },
  { id: "HCDEMO00008", full_name: "Kwame Mensah",    email: "kwame.demo@example.com",   phone: "+233 24 555 7788",  address: "12 Oxford St, Osu, Accra",          dob: "1991-12-05" },
  { id: "HCDEMO00009", full_name: "Zainab Bello",    email: "zainab.demo@example.com",  phone: "+234 705 333 1010", address: "14 Bompai Rd, Kano",                dob: "1996-03-19" },
  { id: "HCDEMO00010", full_name: "Grace Mwangi",    email: "grace.demo@example.com",   phone: "+254 722 100 200",  address: "22 Ngong Rd, Nairobi",              dob: "1987-08-14" },
  { id: "HCDEMO00011", full_name: "Kofi Asante",     email: "kofi.demo@example.com",    phone: "+233 27 808 9090",  address: "Harbour Rd, Tema",                  dob: "1981-05-27" },
  { id: "HCDEMO00012", full_name: "Amara Nwosu",     email: "amara.demo@example.com",   phone: "+234 809 656 4343", address: "3 Aba Rd, Port Harcourt",           dob: "1993-10-11" },
];

export const seedDemoCustomers = onCall(async (req) => {
  await assertAdmin(req);
  let created = 0;
  for (const c of DEMO_CUSTOMERS) {
    await db.collection("users").doc(c.id).set(
      {
        demo: true,
        customer_code: c.id,
        full_name: c.full_name,
        email: c.email,
        phone: c.phone,
        address: c.address,
        dob: c.dob,
        role: "customer",
        is_active: true,
        notify_email: true,
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    created += 1;
  }
  return { ok: true, created };
});

export const clearDemoCustomers = onCall(async (req) => {
  await assertAdmin(req);
  // Guarded twice: the doc must be demo-tagged AND carry a demo id, so a real
  // customer can never be removed by this path.
  const snap = await db.collection("users").where("demo", "==", true).get();
  let deleted = 0;
  for (const d of snap.docs) {
    if (!d.id.startsWith("HCDEMO")) continue;
    await d.ref.delete();
    deleted += 1;
  }
  return { ok: true, deleted };
});
