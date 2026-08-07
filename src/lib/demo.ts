// ─────────────────────────────────────────────────────────────
// Demo data seeding + teardown (admin testing tool).
// Every seeded document is tagged { demo: true } so "Clear demo data"
// removes ONLY seeded records and never touches real data.
//
// Coverage goal: exercise the whole app, for EVERY backend role, not just the
// admin dashboard. Shipments span all 8 stages, all three services, every
// payment state, both DNR variants (auto + manual) and a pending release
// request, backdated across ~10 months so the revenue trend, date-range
// selector, and volume charts populate.
//
// What each role sees after seeding:
//  - admin      : dashboard charts, shipments, receipts, containers, customers,
//                 submissions (all statuses), sailing notices, USA inventory
//  - office     : country-scoped shipments, destination inventory (Nigeria,
//                 Ghana, Kenya), receipts, RORO consignee documents
//  - dispatcher : arrived/delivery jobs incl. a DNR hold + a pending release
//
// DELIBERATELY NOT SEEDED, firestore.rules makes these append-only
// (`allow update, delete: if false`), so seeded rows could never be cleared and
// would permanently pollute the database:
//   shipment_status_logs, notifications, activity_log
// Destination inventory is ALSO auto-created by the arrival trigger for
// offloading+ shipments; both the seeded and triggered rows are cleaned up.
// ─────────────────────────────────────────────────────────────

import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  where,
  limit as fbLimit,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { COL } from "./db";
import { seedDemoCustomers, clearDemoCustomers } from "./notify";
import type { ShipmentStatus } from "./types";

const DEMO = { demo: true } as const;

interface DemoShipment {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  service_type: "sea" | "air" | "roro";
  destination_country: string;
  destination_city: string;
  container_number?: string;
  current_status: ShipmentStatus;
  payment_status: "paid" | "partial" | "unpaid";
  total_price: number;
  items: { description: string; quantity: number; unit_price: number; line_total: number }[];
  receiver: { full_name: string; phone: string; address: string };
  dnr_override?: boolean | null;
  dnr_release_requested?: boolean;
  monthsAgo: number; // backdate created_at this many months
}

const box = (description: string, quantity: number, unit_price: number) => ({
  description,
  quantity,
  unit_price,
  line_total: quantity * unit_price,
});

// One shipment per stage (8), plus extras for services/date spread. Backdated so
// the dashboard shows history across the year.
const DEMO_SHIPMENTS: DemoShipment[] = [
  // Stage 1, Collection
  {
    customer_name: "Samuel Adeyemi",
    customer_email: "samuel.demo@example.com",
    customer_phone: "+234 806 888 1212",
    service_type: "sea",
    destination_country: "Nigeria",
    destination_city: "Ibadan",
    current_status: "collection",
    payment_status: "unpaid",
    total_price: 90,
    items: [box("Extra Large Box", 1, 90)],
    receiver: { full_name: "Grace Adeyemi", phone: "+234 807 121 3434", address: "3 Ring Rd, Ibadan" },
    monthsAgo: 0,
  },
  // Stage 2, Inspection
  {
    customer_name: "Chinelo Obi",
    customer_email: "chinelo.demo@example.com",
    customer_phone: "+234 810 555 9090",
    service_type: "sea",
    destination_country: "Nigeria",
    destination_city: "Enugu",
    container_number: "21C",
    current_status: "inspection",
    payment_status: "partial",
    total_price: 260,
    items: [box("Dish Barrel Box", 1, 100), box("Medium Box", 2, 50), box("Suitcase", 1, 60)],
    receiver: { full_name: "Uche Obi", phone: "+234 811 222 3333", address: "10 Zik Ave, Enugu" },
    monthsAgo: 0,
  },
  // Stage 3, Loading (RORO)
  {
    customer_name: "Fatou Diallo",
    customer_email: "fatou.demo@example.com",
    customer_phone: "+221 77 123 4567",
    service_type: "roro",
    destination_country: "Senegal",
    destination_city: "Dakar",
    container_number: "RORO-03",
    current_status: "loading",
    payment_status: "paid",
    total_price: 1400,
    items: [],
    receiver: { full_name: "Moussa Diallo", phone: "+221 78 987 6543", address: "Route de Ngor, Dakar" },
    monthsAgo: 1,
  },
  // Stage 4, Transit (Air)
  {
    customer_name: "Ngozi Eze",
    customer_email: "ngozi.demo@example.com",
    customer_phone: "+234 902 444 5566",
    service_type: "air",
    destination_country: "Nigeria",
    destination_city: "Lagos",
    container_number: "AIR-07",
    current_status: "transit",
    payment_status: "partial",
    total_price: 420,
    items: [box("Air freight (32 lbs)", 1, 420)],
    receiver: { full_name: "Emeka Eze", phone: "+234 813 777 6655", address: "22 Admiralty Way, Lekki, Lagos" },
    monthsAgo: 1,
  },
  // Stage 5, Clearance
  {
    customer_name: "Yaw Boateng",
    customer_email: "yaw.demo@example.com",
    customer_phone: "+233 24 111 2222",
    service_type: "sea",
    destination_country: "Ghana",
    destination_city: "Kumasi",
    container_number: "19B",
    current_status: "clearance",
    payment_status: "paid",
    total_price: 310,
    items: [box("Large Electronic Box", 1, 150), box("Barrel (Short)", 1, 160)],
    receiver: { full_name: "Akosua Boateng", phone: "+233 20 444 5555", address: "5 Prempeh Rd, Kumasi" },
    monthsAgo: 2,
  },
  // Stage 6, Offloading (arrived) · paid · shows in inventory + dispatch
  {
    customer_name: "Adaeze Okafor",
    customer_email: "adaeze.demo@example.com",
    customer_phone: "+234 803 111 2222",
    service_type: "sea",
    destination_country: "Nigeria",
    destination_city: "Lagos",
    container_number: "19B",
    current_status: "offloading",
    payment_status: "paid",
    total_price: 330,
    items: [box("Large Box (18x18x24)", 2, 65), box("Barrel (Tall) 50 Gallon", 1, 200)],
    receiver: { full_name: "Chidi Okafor", phone: "+234 808 000 1111", address: "5 Awolowo Rd, Ikeja, Lagos" },
    monthsAgo: 2,
  },
  // Stage 6, Offloading · UNPAID → DNR (auto) with a pending release request
  {
    customer_name: "Tunde Balogun",
    customer_email: "tunde.demo@example.com",
    customer_phone: "+234 701 222 3344",
    service_type: "sea",
    destination_country: "Nigeria",
    destination_city: "Abuja",
    container_number: "20A",
    current_status: "offloading",
    payment_status: "unpaid",
    total_price: 245,
    items: [box("Wardrobe Box", 1, 220), box("White Sack (Heavy)", 1, 25)],
    receiver: { full_name: "Bola Balogun", phone: "+234 705 999 0000", address: "8 Aso Drive, Maitama, Abuja" },
    dnr_release_requested: true,
    monthsAgo: 3,
  },
  // Stage 7, Delivery (ready to hand out) · paid
  {
    customer_name: "Kwame Mensah",
    customer_email: "kwame.demo@example.com",
    customer_phone: "+233 24 555 7788",
    service_type: "sea",
    destination_country: "Ghana",
    destination_city: "Accra",
    container_number: "20A",
    current_status: "delivery",
    payment_status: "paid",
    total_price: 150,
    items: [box("Medium Electronic Box", 1, 150)],
    receiver: { full_name: "Ama Mensah", phone: "+233 20 333 4455", address: "12 Oxford St, Osu, Accra" },
    monthsAgo: 3,
  },
  // Stage 7, Delivery · MANUAL hold (paid but admin-held) to test override
  {
    customer_name: "Zainab Bello",
    customer_email: "zainab.demo@example.com",
    customer_phone: "+234 705 333 1010",
    service_type: "air",
    destination_country: "Nigeria",
    destination_city: "Kano",
    container_number: "AIR-07",
    current_status: "delivery",
    payment_status: "paid",
    total_price: 275,
    items: [box("Air freight (18 lbs)", 1, 275)],
    receiver: { full_name: "Musa Bello", phone: "+234 706 121 2121", address: "14 Bompai Rd, Kano" },
    dnr_override: true,
    monthsAgo: 4,
  },
  // Stage 8, Completed (delivered) · paid, a few, spread across months
  {
    customer_name: "Grace Mwangi",
    customer_email: "grace.demo@example.com",
    customer_phone: "+254 722 100 200",
    service_type: "sea",
    destination_country: "Kenya",
    destination_city: "Nairobi",
    container_number: "18A",
    current_status: "completed",
    payment_status: "paid",
    total_price: 520,
    items: [box("Furniture Set", 1, 400), box("Tote Ex-Large", 1, 90), box("Suitcase", 1, 30)],
    receiver: { full_name: "Peter Mwangi", phone: "+254 733 400 500", address: "22 Ngong Rd, Nairobi" },
    monthsAgo: 5,
  },
  {
    customer_name: "Kofi Asante",
    customer_email: "kofi.demo@example.com",
    customer_phone: "+233 27 808 9090",
    service_type: "roro",
    destination_country: "Ghana",
    destination_city: "Tema",
    container_number: "RORO-01",
    current_status: "completed",
    payment_status: "paid",
    total_price: 1380,
    items: [],
    receiver: { full_name: "Efua Asante", phone: "+233 26 707 8080", address: "Harbour Rd, Tema" },
    monthsAgo: 7,
  },
  {
    customer_name: "Amara Nwosu",
    customer_email: "amara.demo@example.com",
    customer_phone: "+234 809 656 4343",
    service_type: "sea",
    destination_country: "Nigeria",
    destination_city: "Port Harcourt",
    container_number: "17C",
    current_status: "completed",
    payment_status: "paid",
    total_price: 200,
    items: [box("Barrel (Short)", 1, 160), box("Ghana Must Go (Large)", 1, 40)],
    receiver: { full_name: "Ada Nwosu", phone: "+234 808 343 5656", address: "3 Aba Rd, Port Harcourt" },
    monthsAgo: 9,
  },
];

// ── USA warehouse inventory (admin-only page) ──
// Items received at the Maryland warehouse that are not yet on a shipment.
const DEMO_USA_INVENTORY: {
  item_description: string;
  location_notes: string;
  monthsAgo: number;
}[] = [
  { item_description: "2x Barrel (Tall), awaiting consolidation", location_notes: "Bay A, rack 3", monthsAgo: 0 },
  { item_description: "Toyota Corolla 2014, awaiting RORO booking", location_notes: "Outside lot, slot 7", monthsAgo: 0 },
  { item_description: "1x Wardrobe Box, customer dropping second box", location_notes: "Bay B, floor", monthsAgo: 1 },
  { item_description: "4x Ghana Must Go (Large)", location_notes: "Bay C, pallet 12", monthsAgo: 1 },
];

// ── Destination inventory ──
// Not seeded as standalone rows: both the office Warehouse view and the admin
// inventory page DERIVE destination stock from shipments (Container → Shipments
// → Items), so the demo shipments already populate them. The clear routine below
// still purges destination_inventory to remove legacy rows from earlier seeds.

// ── Sailing notices (admin: broadcast history) ──
const DEMO_SAILINGS: {
  subject: string;
  body: string;
  filters: { service_type?: "sea" | "air" | "roro"; destination?: string; container_number?: string };
  recipient_count: number;
  monthsAgo: number;
}[] = [
  {
    subject: "Vessel departing Baltimore 12th, Lagos",
    body: "Our next sea cargo vessel departs Baltimore on the 12th with an ETA of 4-6 weeks to Lagos. Drop off items at the Upper Marlboro warehouse before the 10th.",
    filters: { service_type: "sea", destination: "Nigeria" },
    recipient_count: 6,
    monthsAgo: 1,
  },
  {
    subject: "Container 19B has arrived in Lagos",
    body: "Container 19B has cleared and is now available for collection at our Yaba office. Please bring a valid ID.",
    filters: { service_type: "sea", container_number: "19B" },
    recipient_count: 3,
    monthsAgo: 2,
  },
  {
    subject: "RORO booking window, Tema, Ghana",
    body: "We have space on the next RORO sailing to Tema. Contact us to book your vehicle before the cut-off.",
    filters: { service_type: "roro", destination: "Ghana" },
    recipient_count: 2,
    monthsAgo: 3,
  },
];

// ── RORO consignee documents (office consignees page) ──
// Keyed by the demo shipment's customer_email so we can attach to the real id.
const DEMO_RORO_DOCS: {
  forCustomerEmail: string;
  shipping_line: "grimaldi" | "sallaum" | "msc";
  vehicle_class: "class_a" | "class_b" | "class_c";
  curb_weight: number;
  consignee_details: { name: string; address: string; phone: string };
  exporter_id: string;
}[] = [
  {
    forCustomerEmail: "fatou.demo@example.com",
    shipping_line: "grimaldi",
    vehicle_class: "class_a",
    curb_weight: 3200,
    consignee_details: { name: "Moussa Diallo", address: "Route de Ngor, Dakar", phone: "+221 78 987 6543" },
    exporter_id: "EX-DEMO-4471",
  },
  {
    forCustomerEmail: "kofi.demo@example.com",
    shipping_line: "sallaum",
    vehicle_class: "class_b",
    curb_weight: 4100,
    consignee_details: { name: "Efua Asante", address: "Harbour Rd, Tema", phone: "+233 26 707 8080" },
    exporter_id: "EX-DEMO-4482",
  },
];

const DEMO_INQUIRIES: {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  inquiry_type: string;
  message: string;
  status: "new" | "in_progress" | "closed";
}[] = [
  {
    name: "Ibrahim Sule",
    email: "ibrahim.demo@example.com",
    phone: "+234 809 111 0000",
    company: "Sule Trading Ltd",
    inquiry_type: "Sea Cargo",
    message: "I have 3 barrels to ship to Kano. What is the process and timeline?",
    status: "new",
  },
  {
    name: "Linda Owusu",
    email: "linda.demo@example.com",
    phone: "+233 27 555 1234",
    inquiry_type: "Air Freight",
    message: "Do you handle urgent document shipping to Accra?",
    status: "in_progress",
  },
  {
    name: "David Okon",
    email: "david.demo@example.com",
    phone: "+234 802 909 1111",
    company: "Okon Logistics",
    inquiry_type: "RORO Vehicle Shipping",
    message: "Quote to ship a Toyota Highlander from Baltimore to Lagos please.",
    status: "closed",
  },
  {
    name: "Aisha Mohammed",
    email: "aisha.demo@example.com",
    phone: "+234 803 777 2020",
    inquiry_type: "Enterprise / Bulk",
    message:
      "We move roughly 40 barrels a month for our retail branches in Kano and Kaduna. Can you quote a standing monthly arrangement with consolidated invoicing?",
    status: "new",
  },
  {
    name: "Peter Mwangi",
    email: "peter.demo@example.com",
    phone: "+254 733 400 500",
    company: "Mwangi Imports",
    inquiry_type: "Sea Cargo",
    message: "Do you ship to Mombasa as well as Nairobi? Looking at a 20ft consolidation.",
    status: "in_progress",
  },
];

function dnrFrom(s: DemoShipment): boolean {
  if (s.dnr_override === true) return true;
  if (s.dnr_override === false) return false;
  return s.payment_status !== "paid";
}

// A backdated Timestamp roughly `monthsAgo` months in the past (mid-month).
function backdated(monthsAgo: number): Timestamp {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 15, 12, 0, 0);
  return Timestamp.fromDate(d);
}

let serial = 2000;

export async function seedDemoData(actor: { id: string }): Promise<{
  shipments: number;
  inquiries: number;
  receipts: number;
  inventory: number;
  sailings: number;
  roroDocs: number;
  customers: number;
}> {
  let receipts = 0;
  let inventory = 0;
  let sailings = 0;
  let roroDocs = 0;
  let customers = 0;

  // Shipment ids keyed by customer email, so RORO documents can reference the
  // shipment that was just created.
  const shipmentIdByEmail = new Map<string, string>();

  for (const s of DEMO_SHIPMENTS) {
    const balance =
      s.payment_status === "paid" ? 0 : s.payment_status === "partial" ? Math.round(s.total_price / 2) : s.total_price;
    const deposit = s.total_price - balance;
    const createdAt = backdated(s.monthsAgo);
    const tracking = `HC-DEMO-${(serial += 1)}`;
    const paid = s.payment_status === "paid";
    const receiptNumber = paid ? `RC-DEMO-${serial}` : null;

    const shipRef = await addDoc(collection(db, COL.shipments), {
      ...DEMO,
      customer_id: `demo-${s.customer_email}`,
      customer_name: s.customer_name,
      customer_email: s.customer_email,
      customer_phone: s.customer_phone,
      service_type: s.service_type,
      destination_country: s.destination_country,
      destination_city: s.destination_city,
      container_number: s.container_number ?? null,
      current_status: s.current_status,
      items: s.items,
      total_price: s.total_price,
      currency: "USD",
      payment_status: s.payment_status,
      deposit,
      balance,
      dnr: dnrFrom(s),
      dnr_override: s.dnr_override ?? null,
      dnr_release_requested: s.dnr_release_requested ?? false,
      dnr_release_requested_by_name: s.dnr_release_requested ? "Demo Dispatcher" : null,
      dnr_release_note: s.dnr_release_requested ? "Customer is at the warehouse to collect." : null,
      dnr_release_requested_at: s.dnr_release_requested ? createdAt : null,
      receiver: s.receiver,
      tracking_number: tracking,
      receipt_number: receiptNumber,
      created_by: actor.id,
      created_at: createdAt,
      updated_at: createdAt,
    });
    shipmentIdByEmail.set(s.customer_email, shipRef.id);

    // Attach a receipt record for paid shipments (Receipts admin view + revenue).
    if (paid && receiptNumber) {
      await addDoc(collection(db, COL.receipts), {
        ...DEMO,
        shipment_id: shipRef.id,
        receipt_number: receiptNumber,
        tracking_number: tracking,
        customer_name: s.customer_name,
        amount: s.total_price,
        currency: "USD",
        payment_status: "paid",
        generated_by: actor.id,
        created_at: createdAt,
        generated_at: createdAt,
      });
      receipts += 1;
    }
  }

  for (const inq of DEMO_INQUIRIES) {
    await addDoc(collection(db, COL.contact), {
      ...DEMO,
      ...inq,
      created_at: serverTimestamp(),
    });
  }

  // ── USA warehouse inventory (admin) ──
  for (const it of DEMO_USA_INVENTORY) {
    const at = backdated(it.monthsAgo);
    await addDoc(collection(db, COL.usaInventory), {
      ...DEMO,
      shipment_id: "",
      item_description: it.item_description,
      location_notes: it.location_notes,
      received_at: at,
      dispatched_at: null,
      created_at: at,
    });
    inventory += 1;
  }

  // ── Destination inventory ──
  // Deliberately NOT seeded. The office Warehouse view derives stock from
  // shipments at destination stages (Container → Shipments → Items), so the
  // demo shipments above already populate it. Writing standalone
  // destination_inventory rows here would create records no screen reads.

  // ── Sailing notices (admin broadcast history) ──
  for (const sn of DEMO_SAILINGS) {
    const at = backdated(sn.monthsAgo);
    await addDoc(collection(db, COL.sailingNotices), {
      ...DEMO,
      sent_by: actor.id,
      subject: sn.subject,
      body: sn.body,
      filters: sn.filters,
      recipient_count: sn.recipient_count,
      recipient_ids: [],
      sent_at: at,
      created_at: at,
    });
    sailings += 1;
  }

  // ── RORO consignee documents (office consignees page) ──
  for (const rd of DEMO_RORO_DOCS) {
    const shipmentId = shipmentIdByEmail.get(rd.forCustomerEmail);
    if (!shipmentId) continue;
    await addDoc(collection(db, COL.roroDocs), {
      ...DEMO,
      shipment_id: shipmentId,
      shipping_line: rd.shipping_line,
      vehicle_class: rd.vehicle_class,
      curb_weight: rd.curb_weight,
      consignee_details: rd.consignee_details,
      exporter_id: rd.exporter_id,
      created_at: serverTimestamp(),
    });
    roroDocs += 1;
  }

  // ── Customer account records (admin Customers page) ──
  // Must go through a Cloud Function: firestore.rules only lets a signed-in user
  // create their OWN users/{uid} doc, so an admin cannot write customer docs
  // from the client. Non-fatal, the rest of the demo data is still useful.
  try {
    const res = await seedDemoCustomers();
    customers = res.created;
  } catch {
    customers = 0;
  }

  return {
    shipments: DEMO_SHIPMENTS.length,
    inquiries: DEMO_INQUIRIES.length,
    receipts,
    inventory,
    sailings,
    roroDocs,
    customers,
  };
}

// Is demo data currently present? Used by the toolbar to show a single
// Add/Clear toggle instead of two buttons. Cheap: one limit(1) read on
// shipments, which is the collection the seeder always writes to.
export async function hasDemoData(): Promise<boolean> {
  const snap = await getDocs(
    query(collection(db, COL.shipments), where("demo", "==", true), fbLimit(1))
  );
  return !snap.empty;
}

export async function clearDemoData(): Promise<number> {
  let removed = 0;
  const delWhereDemo = async (col: string) => {
    const snap = await getDocs(query(collection(db, col), where("demo", "==", true)));
    for (const d of snap.docs) {
      await deleteDoc(doc(db, col, d.id));
      removed += 1;
    }
    return snap.docs.map((d) => d.id);
  };

  // Shipments (keep ids for auto-inventory cleanup) + everything seeded above.
  // Every collection written by seedDemoData must appear here, or "Clear demo"
  // would silently leave records behind.
  const shipmentIds = await delWhereDemo(COL.shipments);
  await delWhereDemo(COL.receipts);
  await delWhereDemo(COL.contact);
  await delWhereDemo(COL.usaInventory);
  await delWhereDemo(COL.destInventory);
  await delWhereDemo(COL.sailingNotices);
  await delWhereDemo(COL.roroDocs);

  // Destination inventory auto-created for demo shipments by the arrival trigger
  // (those rows are written server-side and are NOT tagged demo:true).
  for (const sid of shipmentIds) {
    const invSnap = await getDocs(
      query(collection(db, COL.destInventory), where("shipment_id", "==", sid))
    );
    for (const d of invSnap.docs) {
      await deleteDoc(doc(db, COL.destInventory, d.id));
      removed += 1;
    }
  }

  // Demo customer docs live in `users`, which the client may not delete for
  // other users, removed server-side. Non-fatal if the callable is unavailable.
  try {
    const res = await clearDemoCustomers();
    removed += res.deleted;
  } catch {
    /* leave customer records; everything else is cleared */
  }

  return removed;
}
