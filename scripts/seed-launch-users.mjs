// ─────────────────────────────────────────────────────────────
// Provision the REAL launch staff accounts.
//
// Separate from seed-demo-users.mjs on purpose: that script is a throwaway
// fixture with one shared password across every role, and re-running it would
// reset these live accounts back to demo credentials.
//
// Safe to re-run: creates the auth user if missing, otherwise updates the
// password and profile in place (the uid, and therefore any audit history
// attributed to it, is preserved).
//
// Requires serviceAccountKey.json in app/ (git-ignored).
// Usage:  node scripts/seed-launch-users.mjs
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

// The `dispatcher` ROLE KEY is unchanged — Firestore rules and the feature
// registry match on it. Only the address and display name say "Logistics".
const LAUNCH_USERS = [
  {
    email: "admin@highclassshippinglogistics.com",
    password: "HCshipping@54321Admin@",
    full_name: "Highclass Admin",
    role: "admin",
  },
  {
    email: "nigeria.office@highclassshippinglogistics.com",
    password: "HCshipping@321Sec",
    full_name: "Lagos Office Coordinator",
    role: "nigeria_office",
    assigned_country: "Nigeria",
  },
  {
    email: "logistics@highclassshippinglogistics.com",
    password: "HCshipping@321Logistics",
    full_name: "Logistics Team",
    role: "dispatcher",
  },
];

async function upsert(u) {
  let record = await auth.getUserByEmail(u.email).catch(() => null);
  if (!record) {
    record = await auth.createUser({
      email: u.email,
      password: u.password,
      displayName: u.full_name,
      emailVerified: true,
    });
    console.log(`  + created  ${u.email}`);
  } else {
    await auth.updateUser(record.uid, {
      password: u.password,
      displayName: u.full_name,
    });
    console.log(`  ~ updated  ${u.email}`);
  }

  // merge:true so re-running never clears fields set later from the admin UI
  // (allowed_features, phone corrections, etc).
  const profile = {
    email: u.email,
    full_name: u.full_name,
    role: u.role,
    is_active: true,
    notify_email: true,
    notify_sms: false,
  };
  if (u.assigned_country) profile.assigned_country = u.assigned_country;

  const existing = await db.collection("users").doc(record.uid).get();
  // Only stamp created_at on first write, so an existing account keeps its real
  // join date instead of appearing to have been created today.
  if (!existing.exists) profile.created_at = FieldValue.serverTimestamp();

  await db.collection("users").doc(record.uid).set(profile, { merge: true });
  console.log(`    profile: role=${u.role}${u.assigned_country ? ` country=${u.assigned_country}` : ""} uid=${record.uid}`);
  return record.uid;
}

async function main() {
  console.log("Provisioning launch staff accounts…\n");
  for (const u of LAUNCH_USERS) await upsert(u);

  // Remove the legacy demo accounts. These share one well-known password and
  // dispatcher@ can read every customer's address and phone, so they must not
  // survive launch. Deleting the Auth user revokes the login; the Firestore
  // profile goes too so the account stops appearing in staff lists.
  console.log("\nRemoving legacy demo accounts…");
  const legacy = [
    "dispatcher@highclassshippinglogistics.com",
    "customer@highclassshippinglogistics.com",
  ];
  for (const email of legacy) {
    const rec = await auth.getUserByEmail(email).catch(() => null);
    if (!rec) {
      console.log(`  ✓ already absent: ${email}`);
      continue;
    }
    // Guard: never delete an account we just provisioned (in case a launch
    // address ever overlaps a legacy one).
    if (LAUNCH_USERS.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      console.log(`  · skipped (is a launch account): ${email}`);
      continue;
    }
    await db.collection("users").doc(rec.uid).delete().catch(() => {});
    await auth.deleteUser(rec.uid);
    console.log(`  - deleted: ${email} (uid ${rec.uid})`);
  }

  console.log("\n✓ Done. Staff sign in at /login with the addresses above.\n");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
