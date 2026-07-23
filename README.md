# Highclass Shipping and Logistics — Platform

> **White-Glove Freight Management. Seamlessly Connecting USA to Africa.**

Enterprise freight-management platform for Highclass Shipping and Logistics Inc. — an FMC-licensed (since 2017) USA→Africa freight forwarder offering **Sea Cargo**, **Air Freight**, and **RORO** vehicle shipping. Replaces WhatsApp/paper operations with a secure, automated, role-based system.

Built by **Thalamux Tech**.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) + TypeScript |
| Styling | Tailwind CSS (custom navy/gold "High Class" design system) |
| UI | Hand-built shadcn-style primitives + lucide-react + Framer Motion |
| Charts | Recharts |
| Backend | **Firebase** — Auth, Firestore, Storage, Cloud Functions |
| Email / SMS | Resend + Twilio (via Cloud Functions; stubbed until keys are set) |
| Hosting | Firebase App Hosting / Hosting → `highclassshippinglogistics.com` |

## Roles & Portals

| Role | Route | Scope |
|---|---|---|
| `admin` | `/admin` | Full access: shipments, customers, pricing, sailing notices, analytics, content |
| `nigeria_office` | `/office` | Destination-country scoped (stages 5–8), receipts, inventory |
| `dispatcher` | `/dispatch` | Assigned last-mile jobs only (mobile PWA) |
| `customer` | `/portal` | Own shipments, ordering, tracking, receipts |

Marketing site (public) lives at `/`, `/services/*`, `/pricing`, `/about`, `/enterprise`, `/contact`, `/track`.

## Getting Started

```bash
cd app
npm install
cp .env.local.example .env.local   # Firebase web config is already filled in
npm run dev                          # http://localhost:3000
```

### Environment

Public Firebase web config lives in `NEXT_PUBLIC_FIREBASE_*` (safe to expose). Server/Cloud-Function secrets (Resend, Twilio) go in Cloud Functions config — the app runs fully in **stub mode** (notifications logged to Firestore) until those keys are added.

## Firebase Setup

```bash
# 1. Log in as the project owner (thalamuxtech@gmail.com)
firebase login

# 2. Deploy security rules + indexes
firebase deploy --only firestore:rules,firestore:indexes,storage

# 3. Seed the price list + counters (needs serviceAccountKey.json in /app, git-ignored)
npm run seed

# 4. Deploy Cloud Functions (requires Blaze plan for outbound email/SMS)
cd functions && npm install && cd ..
firebase deploy --only functions
```

### Creating the first admin

After a user signs up, promote them:

```bash
node scripts/set-admin.mjs someone@example.com admin
# Nigeria office staff (scoped to a country):
node scripts/set-admin.mjs staff@example.com nigeria_office Nigeria
```

### Wiring real email / SMS

Set Cloud Functions secrets, then redeploy functions:

```bash
firebase functions:secrets:set RESEND_API_KEY
firebase functions:secrets:set TWILIO_ACCOUNT_SID
firebase functions:secrets:set TWILIO_AUTH_TOKEN
firebase functions:secrets:set TWILIO_FROM_NUMBER
firebase deploy --only functions
```

## Branding / Logo

The logo is a placeholder wordmark in `src/components/brand/Logo.tsx` and `public/favicon.svg` / `public/brand/icon.svg`. When the official logo arrives:

1. Drop `logo.svg` into `public/brand/`.
2. Swap the `<svg>` in `LogoMark` for `<Image src="/brand/logo.svg" … />`.
3. Replace `public/favicon.svg` and `public/brand/icon.svg`.

Everything (header, footer, auth pages, emails, PWA icon) reads from those.

## Key Features

- **Customer Access Code** (§13.1): unique 10–12 char human-readable code with Damm check character, salted-hash storage, returning-customer recognition. See `src/lib/access-code.ts` + `src/lib/auth-service.ts`.
- **Live price builder**: Sea (28-item list), Air ($5.50/lb + dimensional weight), RORO (line + class). See `src/lib/pricing.ts`.
- **8-stage lifecycle** with color-coded badges + automated notifications on every transition.
- **RBAC** enforced at the Firestore security-rules layer (`firestore.rules`) — the DB won't return unauthorized data even if the client is buggy.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Local dev server |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run seed` | Seed Firestore price list + counters |
