# Highclass Shipping — Go-Live Runbook

The site is a **static export** (Next.js `output: export`) deployed to **classic Firebase
Hosting** → `highclassshippinglogistics.web.app`. The whole app runs client-side on the
Firebase Web SDK, so no server / App Hosting is needed.

Run everything from `app/` as **thalamuxtech@gmail.com**. Terminal is PowerShell.

Backend already live: Cloud Functions, Firestore rules + indexes, Storage rules.

---

## Step 1 — GitHub  ✅ DONE
Code is pushed to https://github.com/thalamuxtech/HCshippinglogistics (branch `main`).
Future pushes: `git push origin main`.

---

## Step 2 — Deploy the website (Firebase Hosting)

One command builds the static site and deploys it:

```powershell
./deploy.ps1 -Site
```

That runs `npm run build` (creates `out/`) then `firebase deploy --only hosting`.
When it finishes: **https://highclassshippinglogistics.web.app** is live.

> First time only: if the CLI says Hosting isn't initialized, it will offer to set it up —
> accept the existing `firebase.json` (public dir = `out`). No other prompts.

---

## Step 3 — Seed the price list + counters (one-time)

1. Console → **Project settings → Service accounts → Generate new private key**.
2. Save the JSON as `serviceAccountKey.json` in `app/` (git-ignored — never committed).
3. Run:
   ```powershell
   npm run seed
   ```
   Populates the 28-item Sea price list, site content, and serial counters.

---

## Step 4 — Create users (one-time)

### Option A (fastest) — seed all 4 demo roles
Needs `serviceAccountKey.json` from Step 3.
```powershell
npm run seed:demo
```
DEMO credentials (change before real launch):

| Role           | Email                                          | Password         | Portal     |
|----------------|------------------------------------------------|------------------|------------|
| admin          | admin@highclassshippinglogistics.com           | HCshipping@54321 | /admin     |
| nigeria_office | nigeria.office@highclassshippinglogistics.com  | HCshipping@54321 | /office    |
| dispatcher     | dispatcher@highclassshippinglogistics.com      | HCshipping@54321 | /dispatch  |
| customer       | customer@highclassshippinglogistics.com        | HCshipping@54321 | /portal    |

### Option B — promote a real signup
```powershell
node scripts/set-admin.mjs your-email@example.com admin
```

> Before real launch: deactivate/remove the demo accounts and set strong passwords.

---

## Step 5 — (Later) Real email + SMS
Functions run in stub mode until secrets are set:
```powershell
firebase functions:secrets:set RESEND_API_KEY --account thalamuxtech@gmail.com
firebase functions:secrets:set RESEND_FROM_EMAIL --account thalamuxtech@gmail.com
firebase functions:secrets:set TWILIO_ACCOUNT_SID --account thalamuxtech@gmail.com
firebase functions:secrets:set TWILIO_AUTH_TOKEN --account thalamuxtech@gmail.com
firebase functions:secrets:set TWILIO_FROM_NUMBER --account thalamuxtech@gmail.com
./deploy.ps1 -Fn
```

## Step 6 — (Later) Custom domain
Console → Hosting → Add custom domain → `highclassshippinglogistics.com` →
add the shown records in Cloudflare. SSL auto-provisions.

---

## Everyday deploys

```powershell
./deploy.ps1          # build site + deploy everything
./deploy.ps1 -Site    # website only (after UI changes)
./deploy.ps1 -Fn      # functions only
./deploy.ps1 -Rules   # rules + indexes + storage only
```
