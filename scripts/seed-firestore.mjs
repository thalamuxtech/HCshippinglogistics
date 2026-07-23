// ─────────────────────────────────────────────────────────────
// Seed the Firestore price_list + baseline site_content.
// Usage:
//   1) Download a service-account key from Firebase console and save
//      as serviceAccountKey.json in /app (git-ignored), OR set
//      GOOGLE_APPLICATION_CREDENTIALS.
//   2) npm run seed
//
// This uses firebase-admin so it bypasses client security rules.
// Safe to re-run — it upserts by S/N.
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

const db = getFirestore(app);

const SEA_PRICE_LIST = [
  { s_n: 1, dimensions: "16×12×12", description: "Small Box", price: 35, category: "Box" },
  { s_n: 2, dimensions: "18×18×16", description: "Medium Box", price: 50, category: "Box" },
  { s_n: 3, dimensions: "18×18×24", description: "Large Box", price: 65, category: "Box" },
  { s_n: 4, dimensions: "24×18×24", description: "Extra Large Box", price: 90, category: "Box" },
  { s_n: 5, dimensions: "18×18×28", description: "Dish Barrel Box", price: 100, category: "Box" },
  { s_n: 6, dimensions: "24×24×24", description: "Medium Electronic Box", price: 110, category: "Box" },
  { s_n: 7, dimensions: "24×24×27", description: "Large Electronic Box", price: 150, category: "Box" },
  { s_n: 8, dimensions: "24×20×34", description: "Shorty Wardrobe Box", price: 160, category: "Box" },
  { s_n: 9, dimensions: "24×21×46", description: "Wardrobe Box", price: 220, category: "Box" },
  { s_n: 10, dimensions: "50 Gallon / 4ft", description: "Barrel (Tall)", price: 220, category: "Barrel" },
  { s_n: 11, dimensions: "30 Gallon / 3ft", description: "Barrel (Short)", price: 200, category: "Barrel" },
  { s_n: 12, dimensions: "30 Inch Bag", description: "Black Bag (Large)", price: 100, category: "Bag" },
  { s_n: 13, dimensions: "36 Inch Bag", description: "Black Bag (Ex-Large)", price: 130, category: "Bag" },
  { s_n: 14, dimensions: "21×13×9 – 28 inch", description: "Suitcase", price: 80, category: "Suitcase" },
  { s_n: 15, dimensions: "27 Gallon", description: "Tote Large", price: 70, category: "Tote" },
  { s_n: 16, dimensions: "29 Gallon", description: "Tote Ex-Large", price: 90, category: "Tote" },
  { s_n: 17, dimensions: "40 Gallon", description: "Tote Biggest", price: 200, category: "Tote" },
  { s_n: 18, dimensions: "18×18×24", description: "Large Ghana Must Go", price: 60, category: "Bag" },
  { s_n: 19, dimensions: "24×18×24", description: "Ex-Large Ghana Must Go", price: 100, category: "Bag" },
  { s_n: 20, dimensions: "Light Weight", description: "White Sack", price: 60, category: "Sack" },
  { s_n: 21, dimensions: "Heavy Weight", description: "White Sack", price: 80, category: "Sack" },
  { s_n: 22, dimensions: "Light Weight", description: "Grey Sack", price: 120, category: "Sack" },
  { s_n: 23, dimensions: '35"–42"', description: "TV", price: 120, category: "TV" },
  { s_n: 24, dimensions: '50"–60"', description: "TV", price: 250, category: "TV" },
  { s_n: 25, dimensions: '65"–70"', description: "TV", price: 300, category: "TV" },
  { s_n: 26, dimensions: '75"', description: "TV", price: 400, category: "TV" },
  { s_n: 27, dimensions: '80"', description: "TV", price: 650, category: "TV" },
  { s_n: 28, dimensions: "—", description: "Furniture Set", price: 1400, category: "Furniture" },
];

async function seed() {
  console.log("Seeding price_list…");
  const batch = db.batch();
  for (const item of SEA_PRICE_LIST) {
    const ref = db.collection("price_list").doc(String(item.s_n));
    batch.set(ref, { ...item, effective_date: "2024-01-01" }, { merge: true });
  }
  await batch.commit();
  console.log(`  ✓ ${SEA_PRICE_LIST.length} price items seeded`);

  console.log("Seeding site_content…");
  await db.collection("site_content").doc("home").set(
    {
      hero_title: "White-Glove Freight Management.",
      hero_subtitle: "Seamlessly Connecting USA to Africa.",
      fmc_licensed_since: "2017",
      updated_at: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  console.log("  ✓ site_content/home seeded");

  console.log("Initializing counters…");
  await db.collection("counters").doc("shipment").set({ value: 1000 }, { merge: true });
  await db.collection("counters").doc("customer").set({ value: 100 }, { merge: true });
  await db.collection("counters").doc("receipt").set({ value: 5000 }, { merge: true });
  console.log("  ✓ counters ready");

  console.log("\nDone. To create the first admin, set a user's role to 'admin' in the console\n(or use scripts/set-admin.mjs once a user has signed up).");
}

seed()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
