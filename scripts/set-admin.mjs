// Promote a user to a role. Usage: node scripts/set-admin.mjs <email> [role]
// role defaults to "admin". Requires serviceAccountKey.json (git-ignored).
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

const __dirname = dirname(fileURLToPath(import.meta.url));
const keyPath = join(__dirname, "..", "serviceAccountKey.json");
const app = existsSync(keyPath)
  ? initializeApp({ credential: cert(JSON.parse(readFileSync(keyPath, "utf8"))) })
  : initializeApp({ credential: applicationDefault() });

const db = getFirestore(app);
const email = process.argv[2];
const role = process.argv[3] || "admin";
const country = process.argv[4]; // optional for nigeria_office

if (!email) {
  console.error("Usage: node scripts/set-admin.mjs <email> [role] [assigned_country]");
  process.exit(1);
}

const auth = getAuth(app);
const userRecord = await auth.getUserByEmail(email).catch(() => null);
if (!userRecord) {
  console.error(`No auth user with email ${email}. Have them sign up first.`);
  process.exit(1);
}

const data = { role };
if (role === "nigeria_office" && country) data.assigned_country = country;
await db.collection("users").doc(userRecord.uid).set(data, { merge: true });
console.log(`✓ ${email} is now ${role}${country ? ` (${country})` : ""}`);
process.exit(0);
