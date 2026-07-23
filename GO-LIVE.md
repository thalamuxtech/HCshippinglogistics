# Highclass Shipping — Go-Live Runbook

Everything below runs from the `app/` directory as **thalamuxtech@gmail.com** (the project owner).
Terminal is PowerShell.

Current status: **backend is live** (Cloud Functions, Firestore rules + indexes, Storage rules).
Remaining to go fully live: push to GitHub → App Hosting → seed data → first admin → (optional) real email/SMS.

---

## Step 1 — Push the code to GitHub

The repo is already committed locally with author `thalamuxtech`. Push it:

```powershell
# from the repo root that should contain the app (one level up from app/, OR
# treat app/ as the repo — see note). Assuming app/ is the git repo:
git branch -M main
git remote add origin https://github.com/thalamuxtech/HCshippinglogistics.git
git push -u origin main
```

> NOTE: `git init` was run inside `app/`, so `app/` IS the git repo. That's fine —
> App Hosting will then use the repo root as the app root (Step 2, root = "/").
> If you'd rather the repo mirror the folder layout (app/ as a subfolder), tell me
> and I'll re-init at `HCshippinglogistics/` with `app/` as a subdirectory.

---

## Step 2 — Create the Firebase App Hosting backend (one-time, in the console)

1. Open: https://console.firebase.google.com/project/highclassshippinglogistics/apphosting
2. Click **Get started / Create backend**.
3. **Region:** `us-central1` (match the Cloud Functions).
4. **Connect GitHub:** authorize Firebase to access the `thalamuxtech` GitHub account,
   then pick the **HCshippinglogistics** repository.
5. **Live branch:** `main` (enables auto-deploy on every push).
6. **Root directory:**
   - If `app/` is the git repo (default from our setup) → root = `/`
   - If the repo is `HCshippinglogistics/` with `app/` inside → root = `/app`
7. Finish. App Hosting reads `apphosting.yaml` (already in the repo) for env vars +
   run settings, runs `npm run build`, and deploys.

First build takes ~5–10 min. When done you get a URL like
`https://highclassshippinglogistics--<hash>.web.app` (or a dedicated App Hosting domain).

---

## Step 3 — Seed the price list + counters (one-time)

Populates the 28-item Sea price list, site content, and serial counters.

1. Console → **Project settings → Service accounts → Generate new private key**.
2. Save the downloaded JSON as `serviceAccountKey.json` in the `app/` folder
   (already git-ignored — it will NOT be committed).
3. Run:
   ```powershell
   npm run seed
   ```
   Expected: "28 price items seeded", "site_content/home seeded", "counters ready".

---

## Step 4 — Create users (one-time)

### Option A (fastest) — seed all 4 demo roles at once
Requires `serviceAccountKey.json` in `app/` (from Step 3).
```powershell
npm run seed:demo
```
Creates one account per role (Plan §7). DEMO credentials (change before real launch):

| Role           | Email                                          | Password         | Portal     |
|----------------|------------------------------------------------|------------------|------------|
| admin          | admin@highclassshippinglogistics.com           | HCshipping@54321 | /admin     |
| nigeria_office | nigeria.office@highclassshippinglogistics.com  | HCshipping@54321 | /office    |
| dispatcher     | dispatcher@highclassshippinglogistics.com      | HCshipping@54321 | /dispatch  |
| customer       | customer@highclassshippinglogistics.com        | HCshipping@54321 | /portal    |

The Nigeria office account is scoped to `Nigeria`.

### Option B — promote a real signup to admin
1. Visit the deployed site's `/signup` and register once (creates a customer account).
2. Promote it:
   ```powershell
   node scripts/set-admin.mjs your-email@example.com admin
   ```
3. Log in → `/admin` → create staff via **Staff & Roles** (no scripts needed).

> Real launch: delete/disable the demo accounts (Admin → Staff & Roles → Deactivate,
> or remove them in the Firebase Auth console) and set strong passwords.

---

## Step 5 — (Optional) Turn on real email + SMS

Functions run in stub mode (logged, no real sends) until secrets are set.

```powershell
# Email (Resend) — sending domain must be verified in Resend first:
firebase functions:secrets:set RESEND_API_KEY --account thalamuxtech@gmail.com
firebase functions:secrets:set RESEND_FROM_EMAIL --account thalamuxtech@gmail.com
#   value e.g.  Highclass Shipping <noreply@highclassshippinglogistics.com>

# SMS (Twilio) — optional; email works without these:
firebase functions:secrets:set TWILIO_ACCOUNT_SID --account thalamuxtech@gmail.com
firebase functions:secrets:set TWILIO_AUTH_TOKEN --account thalamuxtech@gmail.com
firebase functions:secrets:set TWILIO_FROM_NUMBER --account thalamuxtech@gmail.com

# Redeploy functions so the secrets bind:
./deploy.ps1 -Fn
```

Setting a secret auto-enables the Secret Manager API. Verify sends with:
```powershell
firebase functions:log --account thalamuxtech@gmail.com
```

---

## Step 6 — Custom domain

Console → App Hosting → your backend → **Add custom domain** → `highclassshippinglogistics.com`.
Add the shown DNS records in Cloudflare. SSL provisions automatically.

---

## Re-deploying the backend later

```powershell
./deploy.ps1          # rules + indexes + storage + functions
./deploy.ps1 -Fn      # functions only
./deploy.ps1 -Rules   # rules + indexes + storage only
```

The website re-deploys automatically on every `git push` to `main`.
