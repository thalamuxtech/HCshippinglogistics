// ─────────────────────────────────────────────────────────────
// Customer Access Code (CAC) — Implementation Plan §13.1
// A 10–12 char human-readable, non-guessable identifier.
//
// Layout (example, 12 chars):
//   [NameInitials:2][BirthYYMM:4][ZIP frag:2][LogicalSerial:3][Check:1]
//   e.g. JD 9806 10 A4F K  ->  JD980610A4FK
//
// Uniqueness is carried by the logical serial (base-34 of a monotonic
// counter). A Damm-style check character detects typos before any DB
// lookup. The plaintext is shown to the customer once; only a salted
// hash is stored server-side.
// ─────────────────────────────────────────────────────────────

// Unambiguous alphabet — excludes 0/O and 1/I/L to reduce transcription errors.
export const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // 31 chars, but we use base-34 subset below
// For the logical-serial base-34 encoding we use a stable 34-char set (no 0,O,1,I,L).
const B34 = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // 31 safe chars

function encodeSerial(n: number, minLen = 3): string {
  const base = B34.length;
  let out = "";
  let x = Math.max(0, Math.floor(n));
  if (x === 0) out = B34[0];
  while (x > 0) {
    out = B34[x % base] + out;
    x = Math.floor(x / base);
  }
  return out.padStart(minLen, B34[0]).slice(-minLen);
}

// Damm algorithm check digit over a numeric projection of the code.
// We map each char to its index and run the Damm quasigroup mod 10.
const DAMM_TABLE = [
  [0, 3, 1, 7, 5, 9, 8, 6, 4, 2],
  [7, 0, 9, 2, 1, 5, 4, 8, 6, 3],
  [4, 2, 0, 6, 8, 7, 1, 3, 5, 9],
  [1, 7, 5, 0, 9, 8, 3, 4, 2, 6],
  [6, 1, 2, 3, 0, 4, 5, 9, 7, 8],
  [3, 6, 7, 4, 2, 0, 9, 5, 8, 1],
  [5, 8, 6, 9, 7, 2, 0, 1, 3, 4],
  [8, 9, 4, 5, 3, 6, 2, 0, 1, 7],
  [9, 4, 3, 8, 6, 1, 7, 2, 0, 5],
  [2, 5, 8, 1, 4, 3, 6, 7, 9, 0],
];

function dammDigit(body: string): number {
  let interim = 0;
  for (const ch of body) {
    const digit = (ch.charCodeAt(0) * 7 + interim) % 10; // stable projection
    interim = DAMM_TABLE[interim][digit];
  }
  return interim;
}

function checkChar(body: string): string {
  return String(dammDigit(body)); // 0–9, always unambiguous
}

export interface AccessCodeInputs {
  fullName: string;
  birthYearMonth: string; // YYMM
  zip: string;
  serial: number; // monotonic counter
}

function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "X";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : parts[0]?.[1] ?? "X";
  return (first + last).toUpperCase().replace(/[^A-Z]/g, "X");
}

function normalizeYYMM(v: string): string {
  const digits = (v || "").replace(/\D/g, "");
  return digits.slice(0, 4).padEnd(4, "0");
}

function zipFragment(zip: string): string {
  const digits = (zip || "").replace(/\D/g, "");
  return (digits.slice(0, 2) || "00").padEnd(2, "0");
}

/** Build the plaintext access code from its components. */
export function buildAccessCode(input: AccessCodeInputs): string {
  const seg1 = initials(input.fullName); // 2
  const seg2 = normalizeYYMM(input.birthYearMonth); // 4
  const seg3 = zipFragment(input.zip); // 2
  const seg4 = encodeSerial(input.serial, 3); // 3
  const body = `${seg1}${seg2}${seg3}${seg4}`;
  return `${body}${checkChar(body)}`; // 12 chars total
}

/**
 * Non-secret lookup prefix stored in clear, used to narrow admin/return
 * searches before the salted-hash match. It is defined as the FIRST 4
 * CHARACTERS OF THE ASSEMBLED CODE (initials + first 2 birth digits) so
 * that storage and every lookup (`code.slice(0,4)`) always agree.
 * Pass the full plaintext code.
 */
export function accessCodePrefix(code: string): string {
  return normalizeCode(code).slice(0, 4);
}

/** Validate the check character locally, before any DB lookup. */
export function validateCheckChar(code: string): boolean {
  const clean = code.trim().toUpperCase().replace(/\s+/g, "");
  if (clean.length < 10 || clean.length > 12) return false;
  const body = clean.slice(0, -1);
  const check = clean.slice(-1);
  return checkChar(body) === check;
}

export function normalizeCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

// ── Hashing (SHA-256 with per-user salt) ──
// Uses Web Crypto (available in browser + edge + Node 18+).
export async function hashAccessCode(code: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${normalizeCode(code)}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function generateSalt(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
