// ─────────────────────────────────────────────────────────────
// Seed DEMO users for all 4 roles (Implementation Plan §7).
// Creates Firebase Auth users + their Firestore profiles with the
// correct role/scope. Safe to re-run (updates existing by email).
//
// Requires serviceAccountKey.json in app/ (git-ignored).
// Usage:  node scripts/seed-demo-users.mjs
//
// ⚠️  DEMO CREDENTIALS — change or remove before real launch.
// ─────────────────────────────────────────────────────────────

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

const __dirname = dirname(fileURLToPath(import.meta.url));
const keyPath = join(__dirname, "..", "serviceAccountKey.json");
const app = existsSync(keyPath)
  ? initializeApp({ credential: cert(JSON.parse(readFileSync(keyPath, "utf8"))) })
  : initializeApp({ credential: applicationDefault() });

const db = getFirestore(app);
const auth = getAuth(app);

// ── Demo accounts — one per role (plan §7) ──
const DEMO_USERS = [
  {
    email: "admin@highclassshippinglogistics.com",
    password: "HCshipping@54321",
    full_name: "Highclass Admin",
    role: "admin",
    phone: "+15550000001",
  },
  {
    email: "nigeria.office@highclassshippinglogistics.com",
    password: "HCshipping@54321",
    full_name: "Lagos Office Coordinator",
    role: "nigeria_office",
    assigned_country: "Nigeria",
    phone: "+2348000000002",
  },
  {
    email: "dispatcher@highclassshippinglogistics.com",
    password: "HCshipping@54321",
    full_name: "Lagos Dispatch Rider",
    role: "dispatcher",
    phone: "+2348000000003",
  },
  {
    email: "customer@highclassshippinglogistics.com",
    password: "HCshipping@54321",
    full_name: "Demo Customer",
    role: "customer",
    phone: "+15550000004",
    birth_year_month: "9006",
    zip_code: "10001",
  },
];

async function upsertUser(u) {
  // Create or fetch the auth user.
  let record = await auth.getUserByEmail(u.email).catch(() => null);
  if (!record) {
    record = await auth.createUser({
      email: u.email,
      password: u.password,
      displayName: u.full_name,
    });
    console.log(`  + created auth user ${u.email}`);
  } else {
    await auth.updateUser(record.uid, { password: u.password, displayName: u.full_name });
    console.log(`  ~ updated auth user ${u.email}`);
  }

  const profile = {
    email: u.email,
    full_name: u.full_name,
    phone: u.phone || "",
    role: u.role,
    is_active: true,
    notify_email: true,
    notify_sms: false,
    created_at: FieldValue.serverTimestamp(),
  };
  if (u.assigned_country) profile.assigned_country = u.assigned_country;
  if (u.birth_year_month) profile.birth_year_month = u.birth_year_month;
  if (u.zip_code) profile.zip_code = u.zip_code;

  await db.collection("users").doc(record.uid).set(profile, { merge: true });
  console.log(`    profile set: role=${u.role}${u.assigned_country ? ` country=${u.assigned_country}` : ""}`);
}

async function main() {
  console.log("Seeding demo users (Plan §7 roles)…\n");
  for (const u of DEMO_USERS) {
    await upsertUser(u);
  }
  console.log("\n✓ Demo users ready. Credentials:\n");
  console.log("  ┌─────────────────┬───────────────────────────────────────────────┬──────────────────┐");
  console.log("  │ Role            │ Email                                         │ Password         │");
  console.log("  ├─────────────────┼───────────────────────────────────────────────┼──────────────────┤");
  for (const u of DEMO_USERS) {
    console.log(`  │ ${u.role.padEnd(15)} │ ${u.email.padEnd(45)} │ ${u.password.padEnd(16)} │`);
  }
  console.log("  └─────────────────┴───────────────────────────────────────────────┴──────────────────┘");
  console.log("\n  Portals:  admin → /admin   office → /office   dispatcher → /dispatch   customer → /portal");
  console.log("\n  ⚠️  These are DEMO credentials — change/remove before real launch.\n");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
