# MuneemX — Liquor Retail OS

White-label web app for liquor shops and liquor contractors: scan-locked billing (barcode / photo / AI label scan), Cash + UPI QR, live sales by hour and minute, stock, expenses, staff salary, day close, profit and loss, and a tamper-evident bill ledger. One platform serves many client businesses, each with its own brand.

- **Web app:** plain HTML/CSS/JS in `web/`. No build step and no framework, so it deploys to Netlify as-is.
- **Backend:** Supabase (Postgres with row-level security, Auth, Realtime, Edge Functions).
- **Android / iOS:** the same `web/` folder wrapped with Capacitor.
- **Demo mode:** if Supabase isn't connected, the app runs on sample data stored in the browser. Every demo PIN is `1234`.

---

## 1. Project structure

```
MuneemX/
├─ web/                      ← the app (Netlify publishes this folder)
│  ├─ index.html
│  ├─ css/app.css
│  ├─ js/config.js           ← Supabase URL + anon key (written by Netlify at build time)
│  ├─ js/core.js             ← state, helpers, dialogs, barcode + AI helpers
│  ├─ js/backend-demo.js     ← demo data in the browser
│  ├─ js/backend-cloud.js    ← Supabase: auth, queries, RPCs, realtime, AI
│  ├─ js/views-sell.js       ← Dashboard, Scan & Sell, receipts, Bills
│  ├─ js/views-manage.js     ← Inventory, Expenses, Staff & Salary, Reports, Settings
│  ├─ js/views-admin.js      ← Platform admin: clients, plans, roadmap
│  ├─ js/app.js              ← boot, sign-in, navigation
│  ├─ manifest.webmanifest, sw.js, icons/   ← installable PWA
├─ supabase/
│  ├─ migrations/            ← schema, security, functions, master catalog (run in order)
│  ├─ setup/all-in-one.sql   ← the same migrations in one file for the SQL Editor
│  ├─ setup/make-me-platform-admin.sql
│  └─ functions/ai-scan/     ← Edge Function: AI label scan (Claude vision)
├─ scripts/write-config.mjs  ← Netlify build step
├─ netlify.toml
├─ capacitor.config.json     ← Android / iOS wrapper
└─ package.json
```

## 2. Try it locally (demo mode)

Open `web/index.html` in a browser, or run a local server:

```bash
npm run dev            # serves web/ on http://localhost:5173
```

Pick a workspace and a person, then enter PIN `1234`. Add `?demo=1` to any URL to force demo mode, even after Supabase is connected.

## 3. GitHub

```bash
cd MuneemX
git init && git add . && git commit -m "MuneemX v0.1"
git branch -M main
git remote add origin https://github.com/<you>/MuneemX.git
git push -u origin main
```

## 4. Supabase (database, logins, live updates)

1. **Create a project** named `MuneemX`. Choose the **Mumbai (ap-south-1)** region for speed in India.
2. **SQL Editor → New query →** paste all of `supabase/setup/all-in-one.sql` and click **Run**. This creates every table, the security rules, the billing functions and the 68-product master catalog.
3. **Authentication → Sign In / Providers → Email:**
   - **Turn OFF "Confirm email".** This is required. Staff log in with a username and PIN, which become an internal address like `ravi.royal-spirits@staff.muneemx.app`. Those addresses can't receive e-mail, so confirmations would fail and bounce.
   - Minimum password length: keep it at **6**. Staff PINs are 6 digits.
4. **Authentication → URL Configuration:** set **Site URL** to your Netlify address (for example `https://muneemx.netlify.app`).
5. **Make yourself platform admin:**
   - Create your own login in Supabase → **Authentication → Users → Add user → Create new user**: your e-mail, a password, and tick **Auto Confirm User**. Keep this login only for the platform. Don't use it to create a shop workspace.
   - Run `supabase/setup/make-me-platform-admin.sql` with your e-mail in it.
6. **Project Settings → API:** copy the **Project URL** and the **anon public** key. You need both for Netlify.
7. **AI label scan (optional, can be done later)** with the Supabase CLI:
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase functions deploy ai-scan
   npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   ```
   The key comes from https://console.anthropic.com. Each scan is one paid API call. Barcode scanning works without it.

## 5. Netlify (hosting)

1. **Add new site → Import from Git →** choose the `MuneemX` GitHub repo. The build settings are read from `netlify.toml`: publish `web`, command `node scripts/write-config.mjs`.
2. **Site configuration → Environment variables →** add:
   - `SUPABASE_URL` = your Project URL
   - `SUPABASE_ANON_KEY` = your anon public key
3. **Deploys → Trigger deploy.** The build log should say `MuneemX: cloud mode → https://…supabase.co`.
4. Optional: rename the site to `muneemx` and add a custom domain.

Every `git push` to `main` redeploys automatically.

## 6. First run in cloud mode

| Who | How they get in |
|---|---|
| **You (platform admin)** | **Owner / Admin** tab → your e-mail and password → **Clients** screen |
| **New client (created by you)** | **Clients → New client** → enter business details, owner e-mail, temporary password and approval PIN. The owner then signs in on the **Owner / Admin** tab. |
| **New client (self sign-up)** | **New business** tab → e-mail and password → set-up form (name, workspace code, first shop, approval PIN) |
| **Managers & salesmen** | The owner adds them in **Staff & Salary → Add staff** (username + 6-digit PIN). They sign in on the **Staff PIN** tab with the workspace code, username and PIN. |

Then follow the owner's first-day checklist: branding → shops and UPI IDs → sale-lock policies → staff → catalog → **Stock inward** for opening stock → a test bill.

Counter devices remember the workspace code. You can also share a link like `https://muneemx.netlify.app/?w=royal-spirits`, which opens straight to that client's branded sign-in.

## 7. Android and iOS (Capacitor)

The app is ready to wrap. On your computer (Node 20+, Android Studio and/or Xcode):

```bash
npm install
npm run build          # writes web/js/config.js (set SUPABASE_URL / SUPABASE_ANON_KEY in your shell first)
npm run android        # creates android/ and opens Android Studio → Run / Build APK
npm run ios            # macOS only: creates ios/ and opens Xcode
```

After any change in `web/`, run `npx cap sync`. Suggested native upgrades for v2:
- `@capacitor-mlkit/barcode-scanning` for live camera scanning;
- a Bluetooth ESC/POS printer plugin for 3-inch receipts;
- `@capacitor/preferences` to remember the counter's workspace.

## 8. Scanning, language and theme

- **USB / Bluetooth scanners** act like a keyboard. On Scan & Sell they work anywhere on the screen, even if the scan box lost focus.
- **Camera**: the **Camera** button on Scan & Sell, Stock inward, Transfer and Link barcodes scans live with a phone or webcam. It uses the browser's built-in barcode reader (Chrome / Android), falling back to ZXing on other browsers such as iPhone Safari. The site must be opened over https, which Netlify does.
- **Real bottle barcodes**: the master catalog ships with sample barcodes. The first time a real bottle is scanned, tap **Link to a product**, or use **Inventory → Link barcodes** to teach a whole carton quickly. Salesmen need a manager PIN to link. Links are per workspace (table `product_barcodes`).
- **English / हिन्दी**: the **हिं / EN** button in the top bar and on the sign-in page. Translations live in `web/js/i18n.js` (`HI` dictionary + `HI_RX` patterns). Add a line there to translate new text. Product names, shop data and numbers stay as entered.
- **Light / dark**: the sun/moon button. It follows the phone's setting until changed, and the choice is remembered per device.

## 8a. Cartons, transfers and reports

- **Carton barcodes**: in **Link barcodes** (or the first time an unknown code is scanned on Stock inward / Transfer) choose **A carton / case** and enter the bottles per carton (defaults: Full 12, Half 24, Quarter 48, Pint 12, Can 24). After that one scan of that carton adds the whole carton; a bottle barcode still adds one bottle.
- **Stock inward**: scan cartons or bottles, edit cartons + loose bottles per line, then **Receive into stock**. Tick **Instant mode** to put each scan straight into stock.
- **Main store**: Settings → Shops → pick the ★ main store / godown. Transfers start from it by default.
- **Transfer**: owner (any shop) or a shop's manager (from their own shop) moves cartons/bottles to another shop. Stock leaves the sending shop and lands in the receiving shop in one step, with a `TRF-…` ref, an audit entry, and *Transfer in / Transfer out* columns in the Daily register.
- **Reports → Sales report**: Today / Yesterday / This week / Last 7 days / This month / Last month / Custom, any shop or all. One-click **PDF**, **Excel** (8 sheets: summary, daily, shops, products, salesmen, every bill, expenses, stock moves), **Print**, and **WhatsApp to owner** (shares the PDF on phones that allow it; otherwise downloads it and opens WhatsApp with the summary to the number in Settings → Owner WhatsApp number).
- **Reports → Stock movements**: every receipt, transfer and adjustment by date, with a drill-down per ref.

## 9. How security works

- **Data isolation:** every table has row-level security. A client can only read its own workspace. A salesman sees only his own bills, and a manager only his own shop.
- **Protected operations:** bills, voids, stock changes, transfers, counts and salary run only through database functions. These check the role, the shop, stock, MRP, scan-lock policy and the manager's approval PIN on the server, so the browser can't bypass them.
- **Approval PINs** are bcrypt-hashed in `member_secrets`. That table has no read access from the app at all.
- **Tamper-evident bills:** each bill's SHA-256 lock code chains to the previous bill. **Bills → Verify ledger** recomputes the chain on the server.
- **Owner limits:** owners can rebrand, but only the platform admin can change a client's plan, status or workspace code.

## 10. Known limits of v0.1

- Platform admin's **Open workspace** is read-only in cloud mode. Writes require being a member.
- The dashboard loads the last 40 days. Older bills load on demand when you pick an older date.
- The master catalog MRPs are **samples**, and MRPs differ by state. Edit them, or add your own products, before going live.
- Plan prices in **Clients → Plans** are suggestions only.
- No offline billing yet. Planned: queue bills on the device and sync them later.
