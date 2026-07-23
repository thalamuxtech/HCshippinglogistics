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
  tagline: "Excellence in handling your valuables.",
  email: "info@highclassshippinglogistics.com",
  site: "highclassshippinglogistics.com",
  usa: ["6600 Foxley Road, Gate C", "Upper Marlboro, Maryland 20772", "+1 (240) 374-8394"],
  nigeria: ["28 Moleye Street, Alagomeji", "Yaba, Lagos", "+234 808 029 1754 · +234 704 393 7111"],
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

  // QR encodes a single clean tracking URL: domain + tracking number.
  // e.g. https://highclassshippinglogistics.web.app/HC-AIR-2026-02002
  // (Hosting redirects /{tracking} -> /track?id={tracking}.)
  const qrBase = "https://highclassshippinglogistics.web.app";
  const qrTarget = `${qrBase}/${encodeURIComponent(shipment.tracking_number || "")}`;
  const qrDataUrl = await QRCode.toDataURL(qrTarget, { margin: 1, width: 220, color: { dark: NAVY, light: "#FFFFFF" } });
  const qrBuffer = Buffer.from(qrDataUrl.split(",")[1], "base64");

  // bufferPages lets us stamp "Page X of Y" once the final page count is known.
  // bottomMargin:0 disables pdfkit's automatic page breaks so pages are only ever
  // created by our explicit doc.addPage() calls; this keeps bufferedPageRange()
  // accurate and prevents stray blank pages when text nears the bottom edge.
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 40, left: 40, right: 40, bottom: 0 },
    bufferPages: true,
  });
  const chunks = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  const W = doc.page.width;
  const M = 40;
  const contentW = W - M * 2;

  // ── Header band ──
  doc.rect(0, 0, W, 100).fill(NAVY);
  // Premium gold accent rule under the header.
  doc.rect(0, 100, W, 3).fill(GOLD);
  let textX = M;
  if (LOGO_BUFFER) {
    // White plate behind the crest (logo art is dark-on-white).
    doc.save();
    doc.roundedRect(M, 20, 84, 56, 8).fill("#FFFFFF");
    doc.image(LOGO_BUFFER, M + 6, 26, { fit: [72, 44] });
    doc.restore();
    textX = M + 98;
  } else {
    // Package-icon mark (matches the site favicon) on a navy tile.
    doc.save();
    doc.roundedRect(M, 24, 48, 48, 10).fill(NAVY).stroke(GOLD);
    const cx = M + 24, cy = 48;
    doc.lineWidth(2.4).strokeColor(GOLD);
    // cube outline
    doc.moveTo(cx, cy - 15).lineTo(cx + 13, cy - 7).lineTo(cx + 13, cy + 8).lineTo(cx, cy + 16)
      .lineTo(cx - 13, cy + 8).lineTo(cx - 13, cy - 7).closePath().stroke();
    // top seam + vertical
    doc.moveTo(cx - 13, cy - 7).lineTo(cx, cy + 1).lineTo(cx + 13, cy - 7).stroke();
    doc.moveTo(cx, cy + 1).lineTo(cx, cy + 16).stroke();
    doc.restore();
    textX = M + 62;
  }
  // Company block (left) constrained so it never collides with the title.
  const nameW = 250;
  doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(12.5).text(COMPANY.name, textX, 26, { width: nameW });
  doc.fillColor(GOLD).font("Helvetica").fontSize(8).text(COMPANY.tagline, textX, 58, { width: nameW });
  doc.fillColor("#FFFFFF").fontSize(7.5).text(`${COMPANY.site}   ${COMPANY.email}`, textX, 72, { width: nameW });

  // Everything is called an "Invoice"; the PAID / UNPAID badge conveys status.
  const docTitle = "INVOICE";
  const issued = new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  doc.fillColor(GOLD).font("Helvetica-Bold").fontSize(24).text(docTitle, W - M - 170, 30, { width: 170, align: "right", characterSpacing: 3 });
  doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(9).text(receiptNumber, W - M - 170, 60, { width: 170, align: "right" });
  doc.fillColor("#C9D8EC").font("Helvetica").fontSize(8).text(`Issued ${issued}`, W - M - 170, 73, { width: 170, align: "right" });

  // Subtle diagonal status watermark behind the content (premium touch).
  doc.save();
  doc.rotate(-32, { origin: [W / 2, 430] });
  doc.fillColor(badge.color).opacity(0.06);
  doc.font("Helvetica-Bold").fontSize(96).text(badge.label, W / 2 - 240, 390, { width: 480, align: "center" });
  doc.opacity(1);
  doc.restore();

  const svc = (shipment.service_type || "").toUpperCase();
  const rcv = shipment.receiver || {};
  let y = 122;

  // ── BILL TO (left)  +  Invoice meta (right) ──
  const metaX = W - M - 210;
  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(9).text("BILL TO", M, y);
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(11).text(shipment.customer_name || "Customer", M, y + 14, { width: 300 });
  doc.fillColor(MUTED).font("Helvetica").fontSize(9);
  let by = y + 30;
  if (shipment.customer_email) { doc.text(shipment.customer_email, M, by, { width: 300 }); by += 13; }
  if (shipment.customer_phone) { doc.text(shipment.customer_phone, M, by, { width: 300 }); by += 13; }
  if (shipment.sender_address) { doc.text(shipment.sender_address, M, by, { width: 300 }); by += 13; }

  // Invoice meta (labels left, values right-aligned)
  const metaRow = (label, val, yy) => {
    doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(9).text(label, metaX, yy, { width: 100 });
    doc.fillColor(INK).font("Helvetica").fontSize(9).text(val, metaX + 100, yy, { width: 110, align: "right" });
  };
  const due = new Date(Date.now() + 7 * 864e5).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  metaRow(`${docTitle} #`, receiptNumber, y);
  metaRow("DATE", issued, y + 15);
  metaRow("DUE DATE", status === "paid" ? "Paid" : due, y + 30);
  const container = (shipment.container_number || "").trim();
  let metaBottom = y + 45;
  if (container) {
    metaRow("CONTAINER", `CNT #${container}`, y + 45);
    metaBottom = y + 60;
  }
  // Status badge under the meta
  doc.save();
  doc.roundedRect(metaX + 110, metaBottom + 1, 100, 22, 5).fill(badge.color);
  doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(11).text(badge.label, metaX + 110, metaBottom + 6, { width: 100, align: "center" });
  doc.restore();

  // QR + tracking (left, below bill-to). Clear the status badge / meta block too.
  y = Math.max(by, metaBottom + 30) + 6;
  doc.image(qrBuffer, M, y, { width: 66, height: 66 });
  doc.fillColor(MUTED).font("Helvetica").fontSize(8).text("SHIP TO", M + 78, y + 2);
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(10).text(rcv.full_name || "Receiver", M + 78, y + 14, { width: 240 });
  doc.fillColor(MUTED).font("Helvetica").fontSize(8.5);
  doc.text(
    [rcv.phone, rcv.address, shipment.destination_city, shipment.destination_country].filter(Boolean).join(", "),
    M + 78, y + 28, { width: W - M - (M + 78) }
  );
  doc.fillColor(NAVY).font("Courier-Bold").fontSize(9).text(`Tracking: ${shipment.tracking_number || "-"}`, M + 78, y + 52);
  y += 80;

  // ── Do-Not-Release banner ──
  // DNR follows payment (held until fully paid; covers pay-on-delivery) unless an
  // admin set a manual override (dnr_override true/false), mirrored to `dnr`.
  const dnr =
    shipment.dnr_override === true
      ? true
      : shipment.dnr_override === false
      ? false
      : typeof shipment.dnr === "boolean"
      ? shipment.dnr
      : status !== "paid";
  if (dnr) {
    const bh = 30;
    doc.save();
    doc.roundedRect(M, y, contentW, bh, 6).fill("#FEF2F2").stroke("#DC2626");
    doc.fillColor("#DC2626").font("Helvetica-Bold").fontSize(10).text(
      "DO NOT RELEASE (DNR)",
      M + 12,
      y + 6,
      { width: 180 }
    );
    doc.fillColor("#7F1D1D").font("Helvetica").fontSize(8).text(
      "Packages must not be released until the outstanding balance is settled.",
      M + 180,
      y + 8,
      { width: contentW - 192 }
    );
    doc.restore();
    y += bh + 12;
  }

  // ── Item table (Description / QTY / Price / Amount) ──
  const cQty = W - M - 210, cPrice = W - M - 150, cAmt = W - M - 70;
  const headH = 24;
  // Bottom limit for table rows so we never draw over the footer/page numbers.
  const tableBottom = doc.page.height - 90;

  const drawTableHead = () => {
    doc.rect(M, y, contentW, headH).fill(NAVY);
    doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(9);
    doc.text("DESCRIPTION", M + 10, y + 8);
    doc.text("QTY", cQty, y + 8, { width: 50, align: "right" });
    doc.text("PRICE", cPrice, y + 8, { width: 70, align: "right" });
    doc.text("AMOUNT", cAmt, y + 8, { width: 60, align: "right" });
    y += headH;
  };
  drawTableHead();

  const items =
    shipment.items && shipment.items.length
      ? shipment.items
      : [
          {
            description:
              svc === "AIR"
                ? `Air freight${shipment.weight ? ` (${shipment.weight} lbs)` : ""}`
                : svc === "RORO"
                ? `RORO vehicle${shipment.shipping_line ? ` (${shipment.shipping_line})` : ""}`
                : "Shipment",
            quantity: 1,
            unit_price: shipment.baseAmount != null ? shipment.baseAmount : shipment.total_price || 0,
            line_total: shipment.baseAmount != null ? shipment.baseAmount : shipment.total_price || 0,
          },
        ];

  // Optional pickup-fee line
  const rowsToRender = items.slice();
  if (shipment.pickup_fee) {
    rowsToRender.push({
      description: "Door-to-door pickup fee",
      quantity: 1,
      unit_price: shipment.pickup_fee,
      line_total: shipment.pickup_fee,
    });
  }

  const rowH = 22;
  doc.font("Helvetica").fontSize(9.5);
  rowsToRender.forEach((it, i) => {
    // Break to a fresh page (with a repeated table header) before overflowing.
    if (y + rowH > tableBottom) {
      doc.addPage();
      y = M;
      drawTableHead();
    }
    if (i % 2 === 1) doc.rect(M, y, contentW, rowH).fill("#F4F7FB");
    doc.fillColor(INK).font("Helvetica").fontSize(9.5).text(it.description || "Item", M + 10, y + 6, { width: cQty - M - 20 });
    doc.text(String(it.quantity ?? 1), cQty, y + 6, { width: 50, align: "right" });
    doc.text(money(it.unit_price, currency), cPrice, y + 6, { width: 70, align: "right" });
    doc.font("Helvetica-Bold").fillColor(NAVY).text(money(it.line_total, currency), cAmt, y + 6, { width: 60, align: "right" });
    y += rowH;
  });
  doc.moveTo(M, y).lineTo(W - M, y).stroke(LINE);
  y += 10;

  // Keep the totals + terms block together; move to a new page if it won't fit
  // above the footer (matters for long, multi-page item lists).
  const totalsBlockH = 150;
  if (y + totalsBlockH > doc.page.height - 90) {
    doc.addPage();
    y = M;
  }

  // ── Totals ──
  const total = shipment.total_price || 0;
  const deposit = shipment.deposit || 0;
  const balance = shipment.balance != null ? shipment.balance : total - deposit;
  const rowT = (label, val, muted) => {
    doc.font("Helvetica").fontSize(9.5).fillColor(muted ? MUTED : INK).text(label, cPrice - 60, y, { width: 120, align: "right" });
    doc.font("Helvetica").fontSize(9.5).fillColor(INK).text(val, cAmt, y, { width: 60, align: "right" });
    y += 16;
  };
  const subtotal = total - (shipment.pickup_fee || 0);
  const totalsX = cPrice - 60;
  const totalsTop = y - 4;
  rowT("Subtotal", money(subtotal, currency), true);
  if (shipment.pickup_fee) rowT("Pickup fee", money(shipment.pickup_fee, currency), true);
  if (deposit > 0) rowT("Deposit paid", money(deposit, currency), true);
  if (balance > 0) rowT("Balance due", money(balance, currency), true);

  // Navy TOTAL bar with rounded corners + gold amount.
  y += 6;
  const barW = W - M - totalsX;
  doc.roundedRect(totalsX, y, barW, 34, 6).fill(NAVY);
  doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(11).text("TOTAL", totalsX + 16, y + 11);
  doc.fillColor(GOLD).font("Helvetica-Bold").fontSize(15).text(money(total, currency), cAmt - 20, y + 9, { width: 80, align: "right" });
  y += 46;

  // Amount-billed line + thank-you (left side, aligned with terms).
  doc.fillColor(status === "paid" ? "#16A34A" : INK).font("Helvetica-Bold").fontSize(9).text(
    status === "paid"
      ? `Paid in full: ${money(total, currency)}`
      : `Amount billed to ${shipment.customer_name || "the customer"}: ${money(total, currency)}`,
    M, totalsTop
  );
  doc.fillColor(MUTED).font("Helvetica-Oblique").fontSize(9).text(
    "Thank you for shipping with Highclass.",
    M, totalsTop + 16, { width: 260 }
  );
  y = Math.max(y, totalsTop + 44);

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
  const footColW = (contentW - 20) / 2;
  const fY = doc.page.height - 74;
  doc.moveTo(M, fY - 8).lineTo(W - M, fY - 8).stroke(LINE);
  doc.fillColor(GOLD).font("Helvetica-Bold").fontSize(7.5).text("USA OFFICE", M, fY);
  doc.fillColor(MUTED).font("Helvetica").fontSize(7.5).text(COMPANY.usa.join("  ·  "), M, fY + 10, { width: footColW });
  doc.fillColor(GOLD).font("Helvetica-Bold").fontSize(7.5).text("NIGERIA OFFICE", M + footColW + 20, fY);
  doc.fillColor(MUTED).font("Helvetica").fontSize(7.5).text(COMPANY.nigeria.join("  ·  "), M + footColW + 20, fY + 10, { width: footColW });

  // ── Page numbering: "Page X of Y" stamped on every page (handles multi-page
  // invoices with many line items). Done in a final pass once the count is known.
  const range = doc.bufferedPageRange(); // { start, count }
  const totalPages = range.count;
  for (let i = 0; i < totalPages; i++) {
    doc.switchToPage(range.start + i);
    // y must stay above the bottom margin, otherwise pdfkit auto-adds a page
    // during stamping (which throws off the count). lineBreak:false is a guard.
    doc
      .fillColor(MUTED)
      .font("Helvetica")
      .fontSize(7.5)
      .text(
        `Page ${i + 1} of ${totalPages}`,
        M,
        doc.page.height - 26,
        { width: contentW, align: "center", lineBreak: false }
      );
  }
  doc.flushPages();

  doc.end();
  return done;
}
