# Paint Dealer ERP & Smart Invoice — Phase 1 (Foundation)

Next.js 14 (App Router) + TypeScript + Tailwind CSS + Firebase (Auth, Firestore, Storage).

## What's included in this phase

- **Authentication**: email/password login shared by Admin/Manager/Staff (role is looked
  up from Firestore, never chosen by the user), Forgot Password (Firebase reset email),
  Change Password (re-authenticates before updating), disabled-account handling.
- **Dashboard**: Today's Sales, Monthly Sales, Outstanding Amount, Total Customers,
  Recent Invoices, Recent Payments — live Firestore queries with graceful empty states.
- **Shop Settings** (admin-only): logo upload to Firebase Storage, name, address, phone,
  email, NTN/STRN, invoice prefix, currency.
- **Role-based access**: a single permission matrix (`src/types/index.ts`) drives both the
  UI (sidebar, buttons) and is mirrored in `firestore.rules` so restrictions are enforced
  server-side, not just hidden in the client. Staff cannot reach Settings; Customers is
  admin/manager only; profit/cost fields are intentionally not surfaced anywhere in Phase 1.
- **Customer Management**: auto-generated Customer ID (`CUST-0001…`), name, phone, address,
  city, credit limit, outstanding, notes, and live search.
- **Dark / light mode** with system-preference detection and persistence.
- Fully responsive down to mobile (sidebar collapses; all forms/tables adapt).

## Deploying to Netlify

1. Push this project to a Git repo and connect it in Netlify (`netlify.toml` is already
   configured with `@netlify/plugin-nextjs`).
2. **Required**: Site configuration → Environment variables → add all six
   `NEXT_PUBLIC_FIREBASE_*` values from your `.env.local` (Netlify never reads `.env.local` —
   it isn't committed, and even if it were, Netlify's build environment doesn't source it).
   The app will build without them (see note below) but **won't be able to sign anyone in**
   until they're set, since Firebase Auth needs a real API key at runtime.
3. Trigger a deploy.

Note on why a missing/placeholder key used to fail the *build itself*: every page here is
`"use client"` — auth, dashboard data, products, everything loads after mount, in the browser.
But `next build` still executes each route's full module graph during its static-generation
pass, and Firebase's `getAuth()` validates the API key's format synchronously the moment it
runs. `src/lib/firebase.ts` now guards all initialization behind `typeof window !== "undefined"`,
so that build-time pass never touches the Firebase SDK — the build succeeds regardless of
whether env vars are present, and the real initialization happens client-side on first load.
This doesn't remove the need for step 2 above; it just means a missing key now correctly
surfaces as "can't sign in" in the browser instead of failing the deploy outright.

## 1. Create the Firebase project

1. In the [Firebase console](https://console.firebase.google.com), create a project.
2. Enable **Authentication → Email/Password**.
3. Create a **Firestore Database** (production mode).
4. Enable **Storage**.
5. In Project Settings → General, add a Web App and copy the config values into `.env.local`
   (copy `.env.local.example` first).
6. Deploy the security rules included here:
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase init firestore storage   # point at this project, keep the existing rules files
   firebase deploy --only firestore:rules,storage:rules
   ```

## 2. Install and run

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## 3. Bootstrap your first Admin user

The app deliberately does **not** ship a public sign-up page (staff/manager accounts should
only be provisioned by an admin). To create the first Admin:

1. Firebase console → Authentication → Add user → enter email/password.
2. Firebase console → Firestore → create a `users` collection → document ID = the new user's
   **UID** (copy it from the Authentication tab) → fields:
   ```
   email: "admin@yourshop.com"
   name: "Shop Admin"
   role: "admin"
   active: true
   createdAt: (timestamp, any value)
   ```
3. Log in at `/login` with that email/password.

From here, an in-app "Manage Users" screen (Phase 2) will let admins create Manager/Staff
accounts without touching the console. Until then, repeat step 1–2 with `role: "manager"` or
`role: "staff"` for additional accounts.

## 4. Data model (Phase 1)

- `users/{uid}` — `{ email, name, role: admin|manager|staff, active, createdAt }`
- `settings/shop` — single document, shop profile fields
- `customers/{id}` — `{ customerCode, name, phone, address, city, creditLimit, outstanding, notes, createdAt, updatedAt }`
- `invoices/{id}` *(read by dashboard; created starting Phase 2)* — `{ invoiceNumber, customerName, total, status, createdAt }`
- `payments/{id}` *(read by dashboard; created starting Phase 2)* — `{ customerName, amount, method, createdAt }`

The dashboard queries `invoices`/`payments` defensively — it will show an informational
banner (not an error) until those collections exist, which happens naturally once Phase 2
(Invoicing) is built.

## 5. Roles at a glance

| Capability            | Admin | Manager | Staff |
|------------------------|:---:|:---:|:---:|
| Dashboard               | ✅ | ✅ | ✅ |
| Profit / Cost Price      | ✅ | ❌ | ❌ |
| Create Invoice           | ✅ | ✅ | ✅ |
| Receive Payment          | ✅ | ✅ | ✅ |
| Customer Management      | ✅ | ✅ | ❌ |
| Product & Price List Management | ✅ | ✅ | ❌ |
| Product Search (read-only) | ✅ | ✅ | ✅ |
| Reports                  | ✅ | ✅ | ❌ |
| Shop Settings            | ✅ | ❌ | ❌ |
| User Management          | ✅ | ❌ | ❌ |

## Phase 2 — Product & Price Management

- **Price List Upload** (`/products/price-list`, admin/manager only): upload `.xlsx` / `.xls`
  / `.csv` (parsed with SheetJS, fully reliable) or `.pdf` (parsed with pdf.js using
  text-position clustering — PDF table layouts vary a lot, so this is best-effort and always
  routes through the review screen below rather than writing straight to the database).
  Columns are auto-mapped by header name (Company, Category, Series, Product, Product Code,
  Packing, RP, GST, MRP) with a manual override dropdown per field. Every row is then shown in
  an editable preview grid — rows missing a name/code are flagged and must be fixed or removed
  before you can commit.
- **Price List Version History**: committing a preview writes two things: (1) an immutable
  snapshot under `priceListVersions/{id}/items` that is never edited or deleted again, and
  (2) an upsert into the live `products` collection (matched by Product Code) so the catalog
  reflects the newest prices. Because the snapshot is immutable, once Phase 3 invoicing stores
  `priceListVersionId` on each invoice line, an old invoice can always be traced back to the
  exact price that was active when it was created — later price changes never retroactively
  alter it.
- **Product Module** (`/products`): full field set (Company, Category, Series, Product Name,
  Product Code, Packing, Color Name, Shade Code, Retail Price, GST, MRP, Unit, Status). The 18
  categories from the spec are baked into a constant (`PRODUCT_CATEGORIES` in `src/types`).
- **Manual Product Add**: the same form used for editing — for accessories that never come
  through a price list (brushes, rollers, trays, tape, sandpaper, putty knife, scrapers, mixing
  sticks, gloves, goggles, extension rods, etc). These are tagged `source: "manual"`.
- **Smart Search**: type-ahead dropdown (`ProductSearchDropdown`, backed by
  `useProductSearch`) that matches Product Name, Code, Category, Series, or Company as you
  type, and returns full product details on selection. Since Firestore has no native
  full-text search, each product stores a precomputed `searchTokens` array (prefixes of every
  word in its searchable fields); the dropdown queries `array-contains` on that array. This
  component is intentionally generic — Phase 3's invoice line-item picker reuses it as-is.
  Barcode/QR search are flagged in the spec as future work and aren't wired up yet.

### Phase 2 data model additions

- `products/{id}` — live catalog, see fields above, plus `source`, `currentPriceListVersionId`,
  `searchTokens`.
- `priceListVersions/{id}` — `{ versionNumber, fileName, fileType, effectiveDate, uploadedBy, uploadedAt, itemCount }`
- `priceListVersions/{id}/items/{itemId}` — immutable snapshot rows, write-once (rules block
  update/delete entirely).

## Roadmap (Phases 3–5, not built yet)

- **Phase 3**: Invoicing engine (line items via the smart search picker, tax, discounts,
  PDF/print — each line stores the `priceListVersionId` it was priced from), Payments (receive,
  allocate against invoices/opening balance), Ledger.
- **Phase 4**: Reports (sales, profit, outstanding aging), multi-branch, customer portal.
- **Phase 5**: Inventory/stock, purchase orders, supplier ledger, analytics.

Each phase will build on this foundation without altering the auth, roles, settings, or
product/price-list functionality already in place, per the "don't change existing
functionality" requirement.
