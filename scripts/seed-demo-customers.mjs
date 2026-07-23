// ─────────────────────────────────────────────────────────────
// Seed 2 realistic TEST customers (no auth accounts) + shipments,
// matching the public-order data shape so their Customer IDs work
// on the /track "My Shipments" lookup.
//
// Requires serviceAccountKey.json in app/. Usage: node scripts/seed-demo-customers.mjs
// Safe to re-run (fixed IDs; upserts).
// ─────────────────────────────────────────────────────────────

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const __dirname = dirname(fileURLToPath(import.meta.url));
const keyPath = join(__dirname, "..", "serviceAccountKey.json");
const app = existsSync(keyPath)
  ? initializeApp({ credential: cert(JSON.parse(readFileSync(keyPath, "utf8"))) })
  : initializeApp({ credential: applicationDefault() });
const db = getFirestore();

function age(dob) {
  const d = new Date(dob), n = new Date();
  let a = n.getFullYear() - d.getFullYear();
  if (n.getMonth() < d.getMonth() || (n.getMonth() === d.getMonth() && n.getDate() < d.getDate())) a -= 1;
  return a;
}

const CUSTOMERS = [
  {
    id: "HCAA7K3M9Q2",
    full_name: "Adaeze Adeyemi",
    email: "adaeze.test@example.com",
    phone: "+1 240 555 0142",
    dob: "1990-06-14",
    address: "812 Maple Ave, Hyattsville, MD 20782",
    shipments: [
      {
        tracking_number: "HC-SEA-2026-02001",
        service_type: "sea",
        current_status: "transit",
        destination_country: "Nigeria",
        destination_city: "Lagos",
        receiver: { full_name: "Chinwe Okafor", phone: "0803 111 2222", address: "14 Allen Avenue, Ikeja, Lagos", city: "Lagos" },
        items: [
          { price_list_id: "4", description: "Extra Large Box", dimensions: "24×18×24", unit_price: 90, quantity: 2, line_total: 180 },
          { price_list_id: "10", description: "Barrel (Tall)", dimensions: "50 Gallon / 4ft", unit_price: 220, quantity: 1, line_total: 220 },
        ],
        total_price: 400, deposit: 200, balance: 200, payment_status: "partial",
      },
      {
        tracking_number: "HC-AIR-2026-02002",
        service_type: "air",
        current_status: "completed",
        destination_country: "Nigeria",
        destination_city: "Abuja",
        receiver: { full_name: "Musa Bello", phone: "0805 333 4444", address: "House 5, Wuse 2, Abuja", city: "Abuja" },
        weight: 18,
        total_price: 99, deposit: 99, balance: 0, payment_status: "paid",
      },
    ],
  },
  {
    id: "HCJT5N8P4R7",
    full_name: "James Thompson",
    email: "james.test@example.com",
    phone: "+1 301 555 0199",
    dob: "1985-11-03",
    address: "27 Oak Street, Silver Spring, MD 20910",
    shipments: [
      {
        tracking_number: "HC-RRO-2026-02003",
        service_type: "roro",
        current_status: "clearance",
        destination_country: "Ghana",
        destination_city: "Tema",
        receiver: { full_name: "Kofi Mensah", phone: "024 555 7788", address: "12 Liberation Rd, Accra", city: "Accra" },
        shipping_line: "sallaum",
        vehicle_class: "class_a",
        vehicle_details: "2018 Toyota RAV4, silver, VIN on title",
        total_price: 1380, deposit: 1380, balance: 0, payment_status: "paid",
      },
    ],
  },
];

async function run() {
  console.log("Seeding 2 test customers + shipments…\n");
  for (const c of CUSTOMERS) {
    await db.collection("users").doc(c.id).set(
      {
        customer_code: c.id,
        full_name: c.full_name,
        email: c.email.toLowerCase(),
        phone: c.phone,
        dob: c.dob,
        age: age(c.dob),
        address: c.address,
        role: "customer",
        is_active: true,
        notify_email: true,
        created_at: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    for (const s of c.shipments) {
      // Use tracking number as a stable doc id so re-runs upsert instead of duplicate.
      await db.collection("shipments").doc(s.tracking_number).set(
        {
          ...s,
          customer_id: c.id,
          customer_name: c.full_name,
          customer_email: c.email.toLowerCase(),
          customer_phone: c.phone,
          currency: "USD",
          door_to_door: false,
          created_at: FieldValue.serverTimestamp(),
          updated_at: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }
    console.log(`  ✓ ${c.full_name}  →  Customer ID: ${c.id}  (${c.shipments.length} shipment(s))`);
  }
  console.log("\nTest these Customer IDs on the /track page:");
  CUSTOMERS.forEach((c) => console.log(`   ${c.id}   (${c.full_name})`));
  console.log("");
}

run().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
