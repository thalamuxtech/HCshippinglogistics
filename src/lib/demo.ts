// ─────────────────────────────────────────────────────────────
// Demo data seeding + teardown (admin testing tool).
// Every seeded document is tagged { demo: true } so "Clear demo data"
// removes ONLY seeded records and never touches real data.
// ─────────────────────────────────────────────────────────────

import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { COL } from "./db";
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
}

// A spread of shipments across the lifecycle, including arrived + DNR cases so
// the office inventory and dispatch hand-out flows are immediately testable.
const DEMO_SHIPMENTS: DemoShipment[] = [
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
    items: [
      { description: "Large Box (18x18x24)", quantity: 2, unit_price: 65, line_total: 130 },
      { description: "Barrel (Tall) 50 Gallon", quantity: 1, unit_price: 200, line_total: 200 },
    ],
    receiver: { full_name: "Chidi Okafor", phone: "+234 808 000 1111", address: "5 Awolowo Rd, Ikeja, Lagos" },
  },
  {
    customer_name: "Kwame Mensah",
    customer_email: "kwame.demo@example.com",
    customer_phone: "+233 24 555 7788",
    service_type: "sea",
    destination_country: "Ghana",
    destination_city: "Accra",
    container_number: "19B",
    current_status: "delivery",
    payment_status: "paid",
    total_price: 150,
    items: [{ description: "Medium Electronic Box", quantity: 1, unit_price: 150, line_total: 150 }],
    receiver: { full_name: "Ama Mensah", phone: "+233 20 333 4455", address: "12 Oxford St, Osu, Accra" },
  },
  {
    // Unpaid + arrived: should show DNR in dispatch, admin can lift on request.
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
    items: [{ description: "Wardrobe Box", quantity: 1, unit_price: 220, line_total: 220 }],
    receiver: { full_name: "Bola Balogun", phone: "+234 705 999 0000", address: "8 Aso Drive, Maitama, Abuja" },
  },
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
    items: [{ description: "Air freight (32 lbs)", quantity: 1, unit_price: 420, line_total: 420 }],
    receiver: { full_name: "Emeka Eze", phone: "+234 813 777 6655", address: "22 Admiralty Way, Lekki, Lagos" },
  },
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
  },
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
    items: [{ description: "Extra Large Box", quantity: 1, unit_price: 90, line_total: 90 }],
    receiver: { full_name: "Grace Adeyemi", phone: "+234 807 121 3434", address: "3 Ring Rd, Ibadan" },
  },
];

const DEMO_INQUIRIES = [
  {
    name: "Ibrahim Sule",
    email: "ibrahim.demo@example.com",
    phone: "+234 809 111 0000",
    company: "Sule Trading Ltd",
    inquiry_type: "Sea Cargo",
    message: "I have 3 barrels to ship to Kano. What is the process and timeline?",
    status: "new" as const,
  },
  {
    name: "Linda Owusu",
    email: "linda.demo@example.com",
    phone: "+233 27 555 1234",
    inquiry_type: "Air Freight",
    message: "Do you handle urgent document shipping to Accra?",
    status: "new" as const,
  },
];

function dnrFrom(s: DemoShipment): boolean {
  if (s.dnr_override === true) return true;
  if (s.dnr_override === false) return false;
  return s.payment_status !== "paid";
}

export async function seedDemoData(actor: { id: string }): Promise<{ shipments: number; inquiries: number }> {
  // Shipments (+ their materialized dnr flag).
  for (const s of DEMO_SHIPMENTS) {
    const balance =
      s.payment_status === "paid" ? 0 : s.payment_status === "partial" ? Math.round(s.total_price / 2) : s.total_price;
    const deposit = s.total_price - balance;
    await addDoc(collection(db, COL.shipments), {
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
      receiver: s.receiver,
      tracking_number: `HC-DEMO-${Math.floor(1000 + Math.random() * 9000)}`,
      created_by: actor.id,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });
  }

  // Contact submissions.
  for (const inq of DEMO_INQUIRIES) {
    await addDoc(collection(db, COL.contact), {
      ...DEMO,
      ...inq,
      created_at: serverTimestamp(),
    });
  }

  return { shipments: DEMO_SHIPMENTS.length, inquiries: DEMO_INQUIRIES.length };
}

export async function clearDemoData(): Promise<number> {
  let removed = 0;

  // Demo shipments (collect ids so we can also clean up their auto-inventory).
  const shipSnap = await getDocs(query(collection(db, COL.shipments), where("demo", "==", true)));
  const shipmentIds = shipSnap.docs.map((d) => d.id);
  for (const d of shipSnap.docs) {
    await deleteDoc(doc(db, COL.shipments, d.id));
    removed += 1;
  }

  // Demo contact submissions.
  const inqSnap = await getDocs(query(collection(db, COL.contact), where("demo", "==", true)));
  for (const d of inqSnap.docs) {
    await deleteDoc(doc(db, COL.contact, d.id));
    removed += 1;
  }

  // Destination inventory auto-created for demo shipments (admin-deletable).
  // Fetched per shipment id to match what the arrival trigger wrote.
  for (const sid of shipmentIds) {
    const invSnap = await getDocs(
      query(collection(db, COL.destInventory), where("shipment_id", "==", sid))
    );
    for (const d of invSnap.docs) {
      await deleteDoc(doc(db, COL.destInventory, d.id));
      removed += 1;
    }
  }

  return removed;
}
