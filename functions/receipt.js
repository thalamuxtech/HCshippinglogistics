// ─────────────────────────────────────────────────────────────
// Branded PDF receipt renderer (pdfkit + qrcode).
// Produces a professional receipt with logo mark, QR code (website +
// tracking/client code), sender & receiver, itemized charges, and a
// UNPAID / PARTIAL / PAID status badge. Returns a Buffer.
// ─────────────────────────────────────────────────────────────

import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
let LOGO_BUFFER = null;
try {
  LOGO_BUFFER = readFileSync(join(__dirname, "assets", "logo.png"));
} catch {
  LOGO_BUFFER = null; // fall back to text mark if asset missing
}

const NAVY = "#0B1E3A";
const GOLD = "#D4A017";
const INK = "#1A202C";
const MUTED = "#718096";
const LINE = "#E2E8F0";

const COMPANY = {
  name: "HIGHCLASS SHIPPING AND LOGISTICS INC.",
  tagline: "White-Glove Freight Management  ·  USA to Africa",
  email: "shipthroughhighclass@gmail.com",
  site: "highclassshippinglogistics.com",
  usa: ["6600 Foxley Road, Gate C", "Upper Marlboro, Maryland 20772", "+1 (240) 374-8394"],
  nigeria: ["28 Moleye Street, Alagomeji", "Yaba, Lagos", "0808 029 1754 · 0704 393 7111"],
  terms: [
    "Shipment to Nigeria is solely at the shipper's risk.",
    "The company disclaims responsibility for damage or loss during shipment.",
    "Free storage for 7 days after arrival; N7,000 daily storage applies thereafter.",
  ],
};

function money(n, currency = "USD") {
  const v = Number(n || 0);
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(v);
}

const STATUS_STYLE = {
  paid: { label: "PAID", color: "#16A34A" },
  partial: { label: "PART-PAID", color: "#D97706" },
  unpaid: { label: "UNPAID", color: "#DC2626" },
};

/**
 * @returns {Promise<Buffer>}
 */
export async function renderReceiptPdf({ shipment, receiptNumber, siteUrl }) {
  const currency = shipment.currency || "USD";
  const status = shipment.payment_status || "unpaid";
  const badge = STATUS_STYLE[status] || STATUS_STYLE.unpaid;

  // QR encodes a public tracking link with the tracking number (client code).
  const qrTarget = `${siteUrl}/track?tn=${encodeURIComponent(shipment.tracking_number || "")}`;
  const qrDataUrl = await QRCode.toDataURL(qrTarget, { margin: 1, width: 220, color: { dark: NAVY, light: "#FFFFFF" } });
  const qrBuffer = Buffer.from(qrDataUrl.split(",")[1], "base64");

  const doc = new PDFDocument({ size: "A4", margin: 40 });
  const chunks = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  const W = doc.page.width;
  const M = 40;
  const contentW = W - M * 2;

  // ── Header band ──
  doc.rect(0, 0, W, 96).fill(NAVY);
  let textX = M;
  if (LOGO_BUFFER) {
    // White plate behind the crest (logo art is dark-on-white).
    doc.save();
    doc.roundedRect(M, 20, 84, 56, 8).fill("#FFFFFF");
    doc.image(LOGO_BUFFER, M + 6, 26, { fit: [72, 44] });
    doc.restore();
    textX = M + 98;
  } else {
    doc.save();
    doc.roundedRect(M, 26, 44, 44, 8).fill(GOLD);
    doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(26).text("H", M + 13, 33);
    doc.restore();
    textX = M + 58;
  }
  doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(14).text(COMPANY.name, textX, 28, { width: 300 });
  doc.fillColor(GOLD).font("Helvetica").fontSize(8.5).text(COMPANY.tagline, textX, 48, { width: 300 });
  doc.fillColor("#FFFFFF").fontSize(8).text(`${COMPANY.site}  ·  ${COMPANY.email}`, textX, 64, { width: 300 });

  // Title: INVOICE when payment is still due, RECEIPT once fully paid.
  const docTitle = status === "paid" ? "RECEIPT" : "INVOICE";
  const issued = new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(16).text(docTitle, W - M - 180, 26, { width: 180, align: "right" });
  doc.fillColor(GOLD).font("Helvetica").fontSize(9).text(`No. ${receiptNumber}`, W - M - 180, 48, { width: 180, align: "right" });
  doc.fillColor("#FFFFFF").fontSize(8).text(`Issued ${issued}`, W - M - 180, 62, { width: 180, align: "right" });

  let y = 118;

  // ── Status badge + tracking ──
  doc.save();
  doc.roundedRect(M, y, 120, 26, 6).fill(badge.color);
  doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(12).text(badge.label, M, y + 7, { width: 120, align: "center" });
  doc.restore();

  doc.fillColor(MUTED).font("Helvetica").fontSize(8).text("TRACKING / CLIENT CODE", M + 140, y + 2);
  doc.fillColor(NAVY).font("Courier-Bold").fontSize(13).text(shipment.tracking_number || "—", M + 140, y + 12);

  // QR (top-right)
  doc.image(qrBuffer, W - M - 74, y - 2, { width: 74, height: 74 });
  doc.fillColor(MUTED).font("Helvetica").fontSize(6.5).text("Scan to track", W - M - 74, y + 74, { width: 74, align: "center" });

  y += 92;

  // ── Sender / Receiver ──
  const colW = (contentW - 20) / 2;
  const boxTop = y;
  doc.roundedRect(M, boxTop, colW, 92, 6).stroke(LINE);
  doc.roundedRect(M + colW + 20, boxTop, colW, 92, 6).stroke(LINE);

  doc.fillColor(GOLD).font("Helvetica-Bold").fontSize(8).text("SENDER", M + 12, boxTop + 10);
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(11).text(shipment.customer_name || "—", M + 12, boxTop + 24, { width: colW - 24 });
  doc.fillColor(MUTED).font("Helvetica").fontSize(9);
  doc.text(shipment.customer_email || "", M + 12, boxTop + 42, { width: colW - 24 });
  doc.text(shipment.customer_phone || "", M + 12, boxTop + 56, { width: colW - 24 });

  const rx = M + colW + 32;
  const rcv = shipment.receiver || {};
  doc.fillColor(GOLD).font("Helvetica-Bold").fontSize(8).text("RECEIVER", rx, boxTop + 10);
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(11).text(rcv.full_name || "—", rx, boxTop + 24, { width: colW - 24 });
  doc.fillColor(MUTED).font("Helvetica").fontSize(9);
  doc.text(rcv.phone || "", rx, boxTop + 42, { width: colW - 24 });
  doc.text(
    [rcv.address, shipment.destination_city, shipment.destination_country].filter(Boolean).join(", "),
    rx,
    boxTop + 56,
    { width: colW - 24 }
  );

  y = boxTop + 108;

  // ── Shipment meta row ──
  const svc = (shipment.service_type || "").toUpperCase();
  doc.fillColor(MUTED).font("Helvetica").fontSize(8);
  doc.text(`SERVICE: ${svc}`, M, y);
  doc.text(`DESTINATION: ${shipment.destination_country || "—"}`, M + 150, y);
  if (shipment.weight) doc.text(`WEIGHT: ${shipment.weight} lbs`, M + 320, y);
  y += 18;

  // ── Itemized table ──
  doc.moveTo(M, y).lineTo(W - M, y).stroke(LINE);
  y += 8;
  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(8.5);
  doc.text("DESCRIPTION", M, y);
  doc.text("QTY", W - M - 190, y, { width: 40, align: "right" });
  doc.text("UNIT", W - M - 130, y, { width: 60, align: "right" });
  doc.text("AMOUNT", W - M - 60, y, { width: 60, align: "right" });
  y += 14;
  doc.moveTo(M, y).lineTo(W - M, y).stroke(LINE);
  y += 6;

  const items =
    shipment.items && shipment.items.length
      ? shipment.items
      : [
          {
            description:
              svc === "AIR"
                ? `Air freight${shipment.weight ? ` — ${shipment.weight} lbs` : ""}`
                : svc === "RORO"
                ? `RORO vehicle${shipment.shipping_line ? ` — ${shipment.shipping_line}` : ""}`
                : "Shipment",
            quantity: 1,
            unit_price: shipment.total_price || 0,
            line_total: shipment.total_price || 0,
          },
        ];

  doc.font("Helvetica").fontSize(9.5).fillColor(INK);
  for (const it of items) {
    doc.fillColor(INK).text(it.description || "Item", M, y, { width: W - M - 210 });
    doc.text(String(it.quantity ?? 1), W - M - 190, y, { width: 40, align: "right" });
    doc.text(money(it.unit_price, currency), W - M - 130, y, { width: 60, align: "right" });
    doc.font("Helvetica-Bold").text(money(it.line_total, currency), W - M - 60, y, { width: 60, align: "right" });
    doc.font("Helvetica");
    y += 18;
  }

  y += 4;
  doc.moveTo(W - M - 220, y).lineTo(W - M, y).stroke(LINE);
  y += 8;

  // ── Totals ──
  const total = shipment.total_price || 0;
  const deposit = shipment.deposit || 0;
  const balance = shipment.balance != null ? shipment.balance : total - deposit;
  const rowT = (label, val, bold) => {
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 12 : 9.5);
    doc.fillColor(bold ? NAVY : MUTED).text(label, W - M - 220, y, { width: 120, align: "right" });
    doc.fillColor(bold ? NAVY : INK).text(val, W - M - 90, y, { width: 90, align: "right" });
    y += bold ? 20 : 16;
  };
  rowT("Subtotal", money(total, currency));
  rowT("Deposit paid", money(deposit, currency));
  rowT("Balance due", money(balance, currency));
  y += 2;
  doc.moveTo(W - M - 220, y).lineTo(W - M, y).stroke(NAVY);
  y += 8;
  rowT("TOTAL", money(total, currency), true);

  // ── Terms ──
  y += 10;
  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(8).text("TERMS & CONDITIONS", M, y);
  y += 12;
  doc.fillColor(MUTED).font("Helvetica").fontSize(7.5);
  for (const t of COMPANY.terms) {
    doc.text(`•  ${t}`, M, y, { width: contentW });
    y += 11;
  }

  // ── Footer offices ──
  const fY = doc.page.height - 74;
  doc.moveTo(M, fY - 8).lineTo(W - M, fY - 8).stroke(LINE);
  doc.fillColor(GOLD).font("Helvetica-Bold").fontSize(7.5).text("USA OFFICE", M, fY);
  doc.fillColor(MUTED).font("Helvetica").fontSize(7.5).text(COMPANY.usa.join("  ·  "), M, fY + 10, { width: colW });
  doc.fillColor(GOLD).font("Helvetica-Bold").fontSize(7.5).text("NIGERIA OFFICE", M + colW + 20, fY);
  doc.fillColor(MUTED).font("Helvetica").fontSize(7.5).text(COMPANY.nigeria.join("  ·  "), M + colW + 20, fY + 10, { width: colW });

  doc.end();
  return done;
}
