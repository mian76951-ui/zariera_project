# ZARIERA — AI Handoff Book

> A complete context handoff for any AI assistant or developer picking up this project.
> Last updated: 2026-10-26 — dev machine moved to Ubuntu (§3); session log in §14.
> Full audit: §13 (all findings fixed, §13.7).
>
> **Rule for every AI session:** record everything you do (audits, fixes, decisions, commands
> run against the DB, open questions) in §14 *Session log* of this file before finishing.

---

## 1. What this is

**ZARIERA** is a premium **stainless-steel / artificial jewelry** e-commerce store (necklaces,
rings, earrings, bracelets/bangles) for a Pakistani client, selling in PKR (Rs). It is **not** real
gold. Storefront + a full admin dashboard.

- **Project root:** `/home/ahmad/zariera_project` (Ubuntu, since 2026-10-26; was `C:\Users\Gigalabs\Downloads\zariera` on Windows)
- **Live site:** <https://zariera-project.vercel.app/> — **Vercel**, auto-deploys every push to GitHub `main`
  (repo `mian76951-ui/zariera_project`). Netlify is not used for the live site.
- **Branches:** since 2026-10-26 (later the same day) all work is done **directly on `main`** and every push
  goes live (owner's choice). The old `dev` branch is fully merged and no longer used.
- **Owner/developer:** Muhammad Ahmad Waseem (communicates in Roman Urdu)
- **Audience:** Pakistan; COD + online payment (PayFast / Safepay); dropshipping via Leopards / TCS.

---

## 2. Tech stack

| Area | Choice |
|------|--------|
| Framework | **Next.js 16.3.5** (App Router, Turbopack, React 19) |
| Language | TypeScript |
| Styling | **Tailwind CSS v4** (CSS tokens in `globals.css`, `@custom-variant dark`) |
| DB / ORM | **PostgreSQL** + **Prisma 6.19.3** |
| Charts | **lightweight-charts 4.2.3** (TradingView) for the zoomable sales graph; custom SVG for rings/donut |
| Email | nodemailer 10 |
| Validation | zod 4 |
| Auth | Custom (HMAC-signed cookie + scrypt password hashing) — no external auth lib |

---

## 3. Run it

```bash
cd /home/ahmad/zariera_project
npm install
npm run dev          # http://localhost:3000
```

Other scripts:
- `npm run build` / `npm run start` — production
- `npm run db:migrate` — apply Prisma migrations (dev)
- `npm run db:push` — push schema without migration
- `npm run db:studio` — Prisma Studio (browse DB)
- `npm run db:seed` — seed categories + sample products (upsert, deletes nothing)
- `npm run db:create-admin` — create/update the admin user from `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env`
- `npm run db:copy` — copy all data between two DBs (`SOURCE_DATABASE_URL` / `TARGET_DATABASE_URL`)

The `prisma/*.ts` scripts run through **`tsx`** (dev dependency) — not `node --experimental-strip-types`,
which fails on Ubuntu's `nodejs` package (built without TypeScript support → `ERR_NO_TYPESCRIPT`).

### Ubuntu dev machine (since 2026-10-26)
- Ubuntu 26.04, Node 22 + npm 9.2 from apt, VS Code, Git (SSH key works for `mian76951-ui`).
- Local DB: PostgreSQL 18 on **`localhost:5433`**, db `zariera`, user `postgres`. `.env` points
  `DATABASE_URL` and `DIRECT_URL` there (never at Neon for day-to-day work — that is the live data).
- Fresh-machine setup: `sudo apt install postgresql` → set the `postgres` password to match `.env` →
  `createdb zariera` → `npm install` → `npx prisma migrate dev` → `npm run db:seed` → `npm run db:create-admin`.
  To get the **real store data** instead of the seed, copy it from Neon (see the 2026-10-26 log in §14).
- `.env` also holds **`NEON_DIRECT_URL`** (live Neon, non-pooled) — only for copying live → local. Never use it
  as `DATABASE_URL`. It has no port and keeps `channel_binding=require`: Ubuntu's `psql` then defaults to the
  local cluster's port 5433 (→ timeout), and Prisma rejects `channel_binding` — so add `:5432` and drop that
  param when using it (both done on the fly in the commands below).

### ⚠️ Windows dev-server gotchas (IMPORTANT)
- **Prisma `generate` EPERM:** if `prisma generate`/migrate fails with EPERM, a stray `next` process
  is holding the query engine. Kill it first:
  `Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'next dev' } | Stop-Process -Force`
- **Turbopack worker crash after heavy editing:** if pages start returning **500** with
  `Jest worker encountered … exceeding retry limit` or stale `X is not defined` errors in the dev log,
  the HMR/compiler state is corrupted. Fix: kill the `next dev` process, `rm -rf .next`, then
  `npm run dev` again. This is a dev-only artifact, **not** a code bug (verify with `npx tsc --noEmit`).

---

## 4. Environment variables (`.env`)

Copy `.env.example` → `.env`. Currently set: `DATABASE_URL`, `AUTH_SECRET`, `ADMIN_EMAIL`,
`ADMIN_PASSWORD`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_INSTAGRAM_URL`,
`NEXT_PUBLIC_FACEBOOK_URL`, `NEXT_PUBLIC_TIKTOK_URL` (socials added 2026-10-02 — **copy these to the production env too**).

| Var | Purpose |
|-----|---------|
| `DATABASE_URL` | Postgres connection string |
| `AUTH_SECRET` | HMAC secret for admin/customer sessions + reset links. **Required (16+ chars) in production** — app throws without it |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Seed the admin login (`db:create-admin`) |
| `NEXT_PUBLIC_SITE_URL` | Absolute site URL (metadata, payment return URLs) |
| `SMTP_HOST/PORT/USER/PASS/SECURE`, `MAIL_FROM`, `ADMIN_NOTIFY_EMAIL` | Order emails (best-effort) |
| `PAYFAST_*`, `SAFEPAY_*` | Online payment gateways (sandbox flags supported). Options are **hidden at checkout until set**; Safepay needs `SAFEPAY_WEBHOOK_SECRET` too |
| `NEXT_PUBLIC_WHATSAPP_NUMBER`, `NEXT_PUBLIC_CONTACT_PHONE/EMAIL/CITY/HOURS`, `NEXT_PUBLIC_INSTAGRAM_URL/FACEBOOK_URL/TIKTOK_URL` | Store contact + socials (`src/lib/contact.ts`). Blank = hidden (no placeholders) |
| `NEXT_PUBLIC_FREE_SHIPPING_THRESHOLD`, `NEXT_PUBLIC_FLAT_SHIPPING` | Shipping policy (defaults 50000 / 500) — `src/lib/shipping.ts` |
| `COURIER_SIMULATION` | `"true"` allows fake courier bookings in production (demo only). Otherwise prod requires real keys |
| `UPLOAD_DIR` | Where admin-uploaded images are stored (default `./uploads`, served at `/uploads/products/…`) |
| `CONFIRM_WIPE` | Must be `yes` for `prisma/import-products.ts` (it deletes ALL orders/products; refuses in production) |
| Courier (in `src/lib/couriers.ts`, add to `.env` to go live): `LEOPARDS_API_KEY`, `LEOPARDS_API_PASSWORD`, `TCS_USERNAME`, `TCS_PASSWORD`, `TCS_CLIENT_ID`, `TCS_COST_CENTER` | Leopards / TCS booking (+ `TCS_CLIENT_SECRET`, `*_ORIGIN_CITY`). Without them: **simulation** (fake tracking) in dev only; refused in production unless `COURIER_SIMULATION=true`. |

Client must provide the real payment + courier credentials before go-live.

---

## 5. Routes map

### Storefront — `src/app/(store)/`
- `/` home (hero slider, categories, featured, **Signature-Edit sliding gallery**, testimonials, newsletter)
- `/shop`, `/shop/[category]`, `/product/[slug]` (Amazon-style detail: 2 buttons, specs, accordions, hover-zoom)
- `/cart`, `/checkout`, `/checkout/success`
- `/login`, `/register`, `/account` (customer accounts; checkout needs a signed-in customer since 2026-10-28; `?next=` return-to)
- `/forgot-password`, `/reset-password?token=` — password reset by email (stateless signed 1-hour, single-use link)
- `/account/orders` — guest order tracking (POST server action; email never in URL)
- `/contact` (`?topic=custom` from the Custom page) — real form, saved to DB + emailed to owner
- `/checkout?buy=<slug>&qty=n` — "Buy it now" single-item checkout

### Admin — `src/app/admin/`
- `/admin/login` (outside dashboard layout)
- `/admin/(dashboard)/` layout = **collapsible sidebar** + top bar (via `AdminShell`)

**Sidebar menu (9 items)** — defined in `src/components/admin/admin-nav.tsx` (`ADMIN_LINKS`):
| Menu | Route | Content |
|------|-------|---------|
| Dashboard | `/admin` | KPI cards (8), Recent orders, Quick actions, Low-stock alert |
| **Analytics** | `/admin/analytics` | Zoomable sales graph (`SalesChartPro`) |
| **Insights** | `/admin/insights` | Top products, Sales by category, New customers |
| **Performance** | `/admin/performance` | Store-health rings, Order-pipeline donut |
| Orders | `/admin/orders` + `/[id]` | Orders table (tabs/search), detail: status/payment/shipment |
| Products | `/admin/products` + `/new` + `/[id]` | CRUD, image upload, per-product specs |
| Categories | `/admin/categories` | Add/delete categories |
| Customers | `/admin/customers` | Registered shoppers |
| **Messages** | `/admin/messages` | Contact-form inbox (mark handled) + newsletter / notify-me subscribers |

### API — `src/app/api/`
- `POST /api/orders` — create order (re-prices, validates stock, decrements in a transaction; guest signup on first order; payment redirect for PAYFAST/SAFEPAY)
- `POST /api/admin/upload` — product image upload (admin-guarded, 5 MB, jpg/png/webp/avif)
- `GET /api/admin/orders/stream` — **SSE** real-time new-order notifications (admin-guarded)
- `POST /api/cart/refresh` — current price/stock for cart items (cart self-heals stale snapshots)
- `GET|POST /api/payments/payfast/callback` — PayFast return + IPN, verified by `validation_hash`
- `POST /api/payments/safepay/webhook` — verified by `X-SFPY-SIGNATURE` (HMAC-SHA512)
- `GET /api/payments/cancel?order=` — gateway cancel: releases stock of the unpaid order
- `GET /uploads/products/[file]` — serves admin-uploaded images from `UPLOAD_DIR`

---

## 6. Key components (admin dashboard)

| File | Role |
|------|------|
| `components/admin/admin-shell.tsx` | Full app frame: collapsible sidebar (inline `width` + `100dvh`, independent scroll), header with collapse toggle + notification bell |
| `components/admin/admin-nav.tsx` | `ADMIN_LINKS` + nav (collapsed = icon-only + `title` tooltips, fading labels) |
| `components/admin/sales-chart-pro.tsx` | lightweight-charts area chart: wheel-zoom, drag-pan, crosshair, range presets (1W…All), zoom ±/reset, live insight tiles that recompute for the visible window |
| `components/admin/performance-rings.tsx` | 3 animated radial gauges (fulfilment / payments / stock) |
| `components/admin/order-pipeline-donut.tsx` | Shopify-style donut: colored segments per status, hover → segment pops + others dim + center shows label/count/% + tooltip |
| `components/admin/dashboard-insights.tsx` | `TopProductsPanel`, `CategorySalesPanel`, `RecentCustomersPanel` (server components). *(The unused `OrderPipelinePanel` bar version was removed on 2026-10-02.)* |
| `components/admin/order-notifications.tsx` | Bell + toast + sound + browser notification, driven by the SSE stream |
| `components/admin/status-update-form.tsx` | Client wrapper for order/payment status (toast on save) |
| `components/ui/toast.tsx` | Global toast system (`ToastProvider` + `useToast`), mounted in root layout |
| `components/ui/flash-toast.tsx` | Shows a toast after a server-action redirect via `?flash=<key>` |

Data layer: **`src/lib/admin-data.ts`** — all admin aggregations
(`getAdminStats`, `getSalesDaily`, `getSalesInsights`, `getStorePerformance`,
`getSalesBreakdown`, `getOrderStatusBreakdown`, `getRecentCustomers`, orders/products/customers/categories getters).

---

## 7. Data model (Prisma — `prisma/schema.prisma`)

- **Category** (name, slug, description, products[])
- **Product** (name, slug, price, compareAtPrice, sku, stock, material, **specs**, images[], featured, active, category)
- **Order** (orderNumber, status, paymentMethod, paymentStatus, **paymentRef** (gateway tracker), customer fields, subtotal/shipping/total, **courier/trackingNumber/shippedAt**, items[])
- **OrderItem** (product, name+price snapshots, quantity)
- **Customer** (name, email, passwordHash, phone, orders[]) — storefront accounts
- **User** (email, passwordHash, role) — admin accounts
- **ContactMessage** (name, email, phone, subject, message, topic, handled) — contact form inbox *(new 2026-10-02)*
- **Subscriber** (email unique, source) — newsletter + "notify me" sign-ups *(new 2026-10-02)*
- **EmailVerification** (email+purpose unique, codeHash = HMAC, payload JSON, attempts, sendCount, lastSentAt, expiresAt) — sign-up / verify-email OTP codes *(new 2026-10-20)*; **Customer.emailVerifiedAt** (null = not verified)
- Status rules live in `src/lib/order-status.ts` (`ORDER_TRANSITIONS`, `PAYMENT_TRANSITIONS`). DELIVERED/CANCELLED are final; cancelling restocks once (`cancelOrderAndRestock` in `lib/orders.ts`).
- Enums: `OrderStatus` (PENDING, CONFIRMED, PROCESSING, SHIPPED, DELIVERED, CANCELLED), `PaymentMethod` (COD, PAYFAST, SAFEPAY), `PaymentStatus`, `Role`

---

## 8. Notable features already built

- **Order flow fixed** — no fake-success; real errors surfaced; stock decremented atomically.
- **Checkout requires a customer account** (guests are sent to `/login?next=/checkout…` and come back; the old guest checkout + "create an account" box was removed 2026-10-28).
- **Email OTP at sign-up** — 6-digit code emailed before the account is created (see §14, 2026-10-20).
- **Dark / light mode** (token flip, no-flash script) — brand-safe colors.
- **Fully responsive** (mobile + tablet), no horizontal overflow.
- **Toasts everywhere** — add-to-cart, buy-now, quick-add, cart remove, newsletter, checkout,
  login/register/logout, admin product/category/shipment/status actions (see `useToast` + flash-toast).
- **Real-time order notifications** (SSE) with sound + browser notification.
- **Shipping backend** — Leopards / TCS adapter (`src/lib/couriers.ts`), simulation fallback.
- **Admin dashboard** — KPIs, zoomable sales graph, radial gauges, order-pipeline donut,
  top products, category mix, new customers, low-stock alerts.
- **Favicon** = ZARIERA lotus emblem (`src/app/icon.svg`, `favicon.ico`, `apple-icon.png`).

---

## 9. ⚠️ Demo / test data currently in the DB

To make the dashboard charts look populated, **16 demo orders** were seeded with
`orderNumber` starting `QATEST-`, spread across statuses, with line-items. They also inflate the
KPI cards, orders list, and analytics.

**Remove all demo data (orders + items cascade) when done:**
```bash
cd C:\Users\Gigalabs\Downloads\zariera
node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.order.deleteMany({where:{orderNumber:{startsWith:'QATEST-'}}}).then(r=>{console.log('removed',r.count);return p.$disconnect()})"
```
There is also one real earlier test order **`ZR-G2MACF-8SX`** ("hamza") — the client's, leave or remove as they wish.

> Note: temporary QA admin accounts (`qa-toast-admin@zariera.com`) were used during testing and
> deleted. Only the real admin (`ADMIN_EMAIL`) should exist.

---

## 10. Testing status (last full pass)

- `npx tsc --noEmit` → **clean (EXIT 0)** (re-verified 2026-10-02)
- ~~`npx eslint src` → 12 errors, 3 warnings~~ → **0 problems** after fixes (2026-10-02)
- `npx next build` → **success, no warnings** (2026-10-02)
- **End-to-end run against the production build (2026-10-02): 45/45 + 9/9 admin checks passed** — pages,
  canonical/robots/sitemap, forged-cookie rejection, payment-callback forgery rejection, upload hardening,
  server re-pricing, atomic stock (2 concurrent orders for the last unit → exactly 1 succeeds), success page
  from DB, contact form saved to DB. All QA test data was deleted and stock restored afterwards.
- All 8 admin menu items navigate to the correct page; content renders.
- Store: home / shop / product = 200; add-to-cart toast works.
- Sidebar collapse (76px), independent scroll, mobile nav all verified.
- Sales graph zoom/pan/presets, donut hover-targeting, rings animation verified.

---

## 11. Suggested next steps / TODO

- Get **real payment + courier credentials** from the client; test live checkout + booking.
- Remove demo data before go-live (section 9).
- Optional dashboard extras: today's snapshot, payment-method split (COD vs online),
  repeat-vs-new customers, low-stock auto-reorder hints.
- Consider real analytics (traffic/sessions/device) — currently sales-only (no visitor tracking yet).
- Deployment: needs a **long-running Node host / VPS** (SSE notifications + in-memory event bus are
  process-local; serverless/Vercel would need Redis pub-sub for cross-instance delivery).
- Add product photography from the client (placeholders/stock used for lifestyle imagery).

---

## 12. House rules observed with this client

- Speaks Roman Urdu; wants **premium / international** look and **smooth** interactions.
- Do the work in one pass; verify (screenshots / real tests) before saying "done".
- Never fabricate authentic product photos; never log into the client's personal accounts.
- Keep colors on-brand (maroon `#5b1a2b`, gold `#c39a4e`, cream `#f4e8d5`); dark mode must not clash.
- **Every action an AI takes on this project must be logged in §14 (Session log) of this file** (user request, 2026-10-02).
- **Work directly on `main`; every push goes live** (Vercel Production) — owner's decision, 2026-10-26, replacing
  the short-lived `dev`-branch plan. So: test locally (tsc, eslint, browser) *before* every push, and tell the
  owner each push is going live.

---

## 13. Full audit — 2026-10-02

Complete read-through of every source file (`src/**`, `prisma/**`, config, docs) and the three PDFs
(`ZARIERA-Proposal.pdf`, `ZARIERA-Requirements.pdf`, `ZARIERA-Project-Handbook.pdf`).
**No code was changed during the audit.** Items marked ✅ *verified* were confirmed by reading the code
directly; the rest come from static review and have not been reproduced in a running app.

### 13.1 Repo state at audit time
- Only 2 commits (`6186fb7` initial, `77a13ec` "full build + QA polish").
- **87 uncommitted changes**, incl. whole untracked features: admin analytics / insights / performance /
  categories / customers pages, `api/admin/*` (upload + SSE), `lib/couriers.ts`, `lib/order-events.ts`,
  `components/ui/*` (toasts), promo slider, support chat, theme toggle, 2 migrations
  (`shipping_fields`, `product_specs`), the PDFs and `docs/`. → **Commit soon** to avoid losing work.
- `.env` has DATABASE_URL, NEXT_PUBLIC_SITE_URL, AUTH_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD only.

### 13.2 PDFs summary
- **Proposal (5 pp):** dev Rs 15,000 one-time; hosting/yr — Starter Rs 40k (1 vCPU/2 GB, monthly backup),
  **Standard Rs 55k (recommended)** (2 vCPU/4 GB, weekly backup, WhatsApp support, basic SEO),
  Premium Rs 90k (4 vCPU/8 GB, daily backup, uptime monitor, online payment setup, CDN).
  Gateways ~2%/order; changes Rs 1,000–5,000 each.
- **Requirements (3 pp):** what the client must supply — products (PKR prices, 2–3 photos each,
  Necklaces & Earrings items), business info (WhatsApp, email, address, socials, logo), courier
  (Leopards/TCS creds, origin city, shipping policy), payments (PayFast/Safepay keys, optional bank
  transfer), domain + hosting plan, SMTP, admin login, policies (returns/privacy/terms).
  Store can launch on COD with essentials only.
- **Handbook (7 pp, v1.0, 29 Sep 2026):** technical handoff for client "Saad"; mirrors this file.
  Minor: its TOC lists 15 sections but body has 16.

### 13.3 🔴 Critical security issues (fix before go-live)
1. ✅ *verified* **Customer cookie works as admin cookie (privilege escalation).**
   `lib/auth.ts` and `lib/customer-auth.ts` sign with the same `AUTH_SECRET` and the same
   `payload.sig` format; `readToken` (`auth.ts:29`) only checks signature + `exp`, and
   `requireAdmin` (`lib/admin.ts:27`) never checks `role`. Copying a `zariera_customer` value into
   `zariera_admin` grants `/admin`. Fix: domain-separate the HMAC (e.g. sign `"admin:"+payload`),
   require `role` in the admin payload, and/or re-check the `User` row.
2. ✅ *verified* **Hardcoded fallback secret** `"dev-secret-change-me"` (`auth.ts:13`, `customer-auth.ts:12`)
   when `AUTH_SECRET` is unset → forgeable sessions. Fix: throw in production if unset.
3. ✅ *verified* **Payment callbacks unauthenticated.** `api/payments/payfast/callback/route.ts` trusts
   `basket_id` + `err_code=000`; Safepay webhook likewise (treats `payment:created` as paid). No
   signature/amount check. Order numbers (`lib/orders.ts:39-43`) use `Math.random()` with 3 chars → guessable.
4. ✅ *verified* **Upload trusts client MIME and keeps client extension** (`api/admin/upload/route.ts:29,43`)
   → `x.html` sent as `image/png` is saved as `.html` in `public/` (stored XSS). Fix: derive extension from
   an allow-listed type and check magic bytes. Also: runtime writes to `public/` aren't served by
   `next start` / standalone — use object storage or a served uploads dir.
5. **Guest orders exposed by email.** `/account` (`(store)/account/page.tsx:30`) lists guest orders matching
   the account email; registration doesn't verify email → register a victim's email to see their orders.

### 13.4 🟠 Functional / logic bugs
- **Overselling race:** stock checked outside the transaction (`lib/orders.ts:71`) and decremented without a
  `stock >= qty` guard (`:113-118`). No stock restore on cancel / failed payment.
- **`markOrderPayment` has no state guard** (`lib/order-payment.ts:10`): can flip CANCELLED/DELIVERED back to
  CONFIRMED, or PAID → FAILED; not idempotent. Admin status changes are free-form (any → any), no audit log
  (`admin/(dashboard)/orders/actions.ts:85,103`).
- **Gateways not wired correctly:** PayFast `SIGNATURE` = order number (`lib/payments.ts:80`); success URL
  bypasses the callback route; Safepay init doesn't send order reference / webhook URL (`:116-124`), so the
  webhook lookup likely never matches.
- **Checkout UX for online payments:** gateway unconfigured → silently COD-style success
  (`api/orders/route.ts:85-87`); `/checkout/success` clears the cart regardless of payment result, shows
  `?total=` from the URL, and shows COD wording for card orders; cancelled payment + retry = duplicate order.
- `returnUrl` built from `request.url` (Host header controls gateway redirect, `api/orders/route.ts:65`).
- **Email case mismatch:** stored as typed (`lib/orders.ts:99`), looked up lowercased (`lib/order-lookup.ts:31`).
- **Courier double-booking race** (`orders/actions.ts:35-64`); missing creds silently simulate and mark SHIPPED.
- **Canonical URL bug:** root `alternates.canonical: "/"` (`app/layout.tsx:44`) is inherited by every page.
- Literal `&amp;` rendered on `/shop` (`(store)/shop/page.tsx:23`).
- Product thumbnails don't switch the main image (`product/[slug]/page.tsx:144-151`).
- Price filter inputs uncontrolled — don't clear; min>max not validated (`shop/shop-filters.tsx:107,116`).
- Cart clamp `Math.max(1, stock)` allows qty 1 of sold-out items; stock snapshot never refreshed
  (`cart/cart-provider.tsx:64`).
- "Buy it now" checks out the whole cart, not just the item (`cart/add-to-cart.tsx:23-27`).
- Toasts and chat launcher both fixed bottom-right → overlap.
- No rate limiting on admin/customer login; 6-char min password; register reveals existing emails;
  no password reset; login has no return-to URL; `/account/orders` puts email in the query string.
- Deletes swallow FK errors silently (`products/actions.ts:106`, `categories/actions.ts:57`).
- ⚠️ `prisma/import-products.ts` runs `deleteMany()` on **all orders**, items and products — never run on prod.
- SSE notifications are process-local (`lib/order-events.ts`) — single-instance host only.

### 13.5 🟡 Placeholders / content issues
- Contact form and newsletter send nothing (`(store)/contact/page.tsx:29-33`, `components/newsletter.tsx:58-69`);
  "Start Your Design" and "Notify me" both route to that dead form.
- Placeholder phone `+92 300 0000000`, WhatsApp fallback `923000000000`, generic instagram.com / facebook.com
  links (`site-footer.tsx`, `support-chat.tsx`, `(store)/page.tsx:300`). Set `NEXT_PUBLIC_WHATSAPP_NUMBER`.
- Fabricated social proof: "Verified buyer" reviews, "4.9/5 from 500+" (`testimonials.tsx:64,109`), 5 stars on every
  product (`product/[slug]/page.tsx:169-176`), chat "replies in minutes". Legal/trust risk — replace with real reviews.
- "Best sellers" is actually newest; "Bestseller" badge = `featured` flag.
- Delivery time inconsistent: 2–4 days (product page, chat) vs 3–5 (FAQ, shipping page).
- Free-shipping "Rs 50,000" hardcoded in `marquee.tsx:4`, `(store)/page.tsx:42` instead of
  `FREE_SHIPPING_THRESHOLD`; value looks implausibly high (maybe meant 5,000) — confirm with client.
- Every product claims "gold-plated over surgical-grade steel" / nickel-free, incl. silver pieces.
- Chat "Track my order" sends to WhatsApp instead of `/account/orders`.
- `robots.ts` doesn't disallow `/account`, `/login`, `/register`; sitemap uses `new Date()` for all entries.
- Storefront imports `components/admin/status-badge`; "jewellery" vs "jewelry" spelling mix.
- Unused `OrderPipelinePanel` in `dashboard-insights.tsx` (noted in §6).

### 13.6 Recommended fix order
1. Admin/customer token separation + role check (§13.3 #1) and fail-closed `AUTH_SECRET` (#2).
2. Upload hardening (#4).
3. Payment callback verification + `markOrderPayment` state guard — before enabling any gateway.
4. Atomic stock decrement (`updateMany where stock >= qty`) + restore on cancel.
5. Email lowercase normalisation; guest-order exposure (verify email, or match by `customerId` only).
6. Canonical URL, `&amp;`, thumbnails, filters, lint errors.
7. Content: real contact details, remove fake reviews, fix delivery-time / material copy.

### 13.7 ✅ Fix status (2026-10-02) — everything in §13.3–13.5 addressed

| # | Finding | Fix | Where |
|---|---------|-----|-------|
| C1 | Customer cookie = admin cookie | Per-kind derived HMAC keys + `kind` in payload; admin role checked; **every admin request re-checks the `User` row** (`getVerifiedAdmin`) | `lib/session-token.ts`, `lib/auth.ts`, `lib/customer-auth.ts`, `lib/admin.ts` |
| C2 | Default secret | Throws in production if `AUTH_SECRET` missing/short | `lib/session-token.ts` |
| C3 | Unverified payment callbacks | PayFast `validation_hash` + amount check; Safepay HMAC-SHA512 signature + tracker match (`Order.paymentRef`); idempotent, state-guarded `markOrderPayment`; crypto-random order numbers (8 chars) | `lib/payments.ts`, `lib/order-payment.ts`, `api/payments/*`, `lib/orders.ts` |
| C4 | Upload XSS | Magic-byte sniffing, extension derived from content; stored in `UPLOAD_DIR` (not `public/`) and served with `nosniff` | `lib/uploads.ts`, `api/admin/upload`, `app/uploads/products/[file]` |
| C5 | Guest orders exposed by email | `/account` lists only `customerId`-linked orders; guests use `/account/orders` (POST) | `(store)/account/page.tsx`, `account/orders/*` |
| — | Overselling race | Conditional `updateMany(stock >= qty)` inside interactive transaction; duplicate cart lines merged | `lib/orders.ts` |
| — | No restock / free-form status | Transition tables; cancel restocks exactly once; conditional updates (no lost updates); status dropdown shows only allowed moves | `lib/order-status.ts`, `admin/(dashboard)/orders/*`, `status-update-form.tsx` |
| — | Gateway wiring | Callback URLs from `NEXT_PUBLIC_SITE_URL` (not Host header); PayFast `CHECKOUT_URL` = IPN; random `SIGNATURE`; cancel route releases stock; gateway init failure cancels + restocks | `api/orders/route.ts`, `api/payments/cancel` |
| — | Unconfigured gateway → fake success | Online options hidden + API rejects them | `checkout/page.tsx`, `checkout-form.tsx`, `api/orders/route.ts` |
| — | Success page trusted URL / cleared cart | Reads order from DB; failed payment → back to checkout; removes only ordered items from cart; online wording | `checkout/success/page.tsx`, `cart/clear-cart.tsx` |
| — | Email case mismatch | Lowercased on save; case-insensitive lookup for old rows | `lib/orders.ts`, `lib/order-lookup.ts` |
| — | Courier double-booking / fake SHIPPED | Atomic claim before booking (released on failure); no simulation in prod unless `COURIER_SIMULATION=true`; won't ship cancelled/unpaid-online orders | `orders/actions.ts`, `lib/couriers.ts` |
| — | No rate limits / weak passwords / no reset / no return-to | In-memory limiter on admin+customer login, register, reset, orders, tracking, contact, newsletter; min password 8; forgot/reset flow; `?next=` with open-redirect guard; signed-in users skip login/register | `lib/rate-limit.ts`, `(store)/auth-actions.ts`, login/register/forgot/reset pages |
| — | Canonical / robots / sitemap | Root canonical removed; per-page canonicals; robots disallow account/auth/search; sitemap without `/search` and fake `lastModified`; `/search` noindex | `app/layout.tsx`, pages, `robots.ts`, `sitemap.ts`, `lib/site.ts` |
| — | `&amp;` on /shop, thumbnails, filters, cart clamp, Buy now, toast overlap, cart flash | Fixed; `ProductGallery` with clickable thumbs; filter form re-mounts + min/max swap; sold-out clamps to 0; cart synced across tabs + refreshed from server; single-item Buy now; toasts above chat; loading skeletons | various components |
| — | Inactive products reachable by URL | `getProductBySlug` filters `active: true` *(found while fixing)* | `lib/catalog.ts` |
| — | `.env.example` git-ignored | `!.env.example` added to `.gitignore` *(found while fixing)* | `.gitignore` |
| — | Silent delete failures | Flash toasts: deleted / in use / failed | products & categories `actions.ts`, `flash-toast.tsx` |
| — | `import-products.ts` wipes orders | Refuses unless `CONFIRM_WIPE=yes`, never in production | `prisma/import-products.ts` |
| — | Dead contact form / newsletter / notify-me | Real server actions → `ContactMessage` / `Subscriber` tables (honeypot + rate limit) + owner email; admin **Messages** page | `(store)/inbound-actions.ts`, `contact-form.tsx`, `newsletter.tsx`, `notify-form.tsx`, `admin/(dashboard)/messages` |
| — | Placeholder phone/WhatsApp/socials | Env-driven `CONTACT`; blank values hidden; chat falls back to contact page | `lib/contact.ts`, footer, contact page, support chat, home |
| — | Fake reviews / 5 stars / "500+" / "replies in minutes" | Testimonials hidden until real reviews are added (avg computed from real list; "Verified" only if flagged); product-page stars removed; chat status honest | `testimonials.tsx`, product page, support chat |
| — | Misleading copy | "Best sellers" → "New arrivals"; "Bestseller" badge → "Featured"; delivery time unified (`DELIVERY_TIME` = 3–5 working days); material claims depend on product material (no "18K", no blanket gold-plated/nickel-free); chat "Track order" → Order Status page | home, product, FAQ, shipping, about, chat, `lib/shipping.ts` |
| — | Lint errors (12) | `useSyncExternalStore` / `useMounted` instead of setState-in-effect; prefix sums in donut; tooltip width measured at event time | cart provider, theme toggle, toast, admin shell, mobile menu, donut, sales chart |
| — | Misc | Unused `OrderPipelinePanel` removed; `StatusBadge` moved to `components/status-badge.tsx`; email escape covers quotes; "jewelry" spelling unified; uploads tracing warning silenced | — |

**Still open (need the client / a decision — not code bugs):**
- Real PayFast/Safepay keys → **sandbox-test both callbacks**; confirm the signature formulas in §13.7 C3 against the merchant docs (they follow public docs, unverified against a live account).
- Courier API keys; SMTP (reset emails + order emails + contact alerts are skipped without it — contact messages are still saved in Admin → Messages).
- Confirm free-shipping threshold (Rs 50,000 looks high — maybe 5,000) → set `NEXT_PUBLIC_FREE_SHIPPING_THRESHOLD`.
- Fill remaining contact env vars: `NEXT_PUBLIC_WHATSAPP_NUMBER`, `NEXT_PUBLIC_CONTACT_PHONE` (socials + email are done).
- **⚠️ GO-LIVE: replace the sample testimonials** in `src/components/testimonials.tsx` (restored on request for pre-launch; names, "Verified buyer" and "4.9/5 from 500+" are placeholders).
- Delete `QATEST-` demo orders before go-live (§9) — **not deleted** (client decision).
- Register still says "email already exists" (normal UX; rate-limited). True fix = email verification (not built).
- Rate limiter trusts `X-Forwarded-For` — deploy behind a proxy that sets it (nginx/Caddy), single instance.
- Customer emails for online orders are sent at order creation (before payment confirmation).

---

## 14. Session log

Append one entry per AI/dev session: date, what was done, files changed, DB commands, open questions.

### 2026-10-02 — Full audit (Claude)
- Read every file in the project (excluding `node_modules`, `.next`) + all 3 PDFs.
- Ran `npx tsc --noEmit` (pass) and `npx eslint src` (12 errors / 3 warnings).
- Verified the critical auth / payment / upload issues by reading the code directly.
- Wrote §13 (audit findings) and this §14 log; updated the header, §10 testing status and §12 house rules.
- **Files changed:** `docs/AI-HANDOFF.md` only. **No code changes, no DB changes.**
- **Open question to user:** fix the critical items now, or log them as Jira tickets in project KAN?
  → User answered: **"fix everything you find"** (see next entry).

### 2026-10-02 — Fixed every audit finding (Claude)
- **Backup before changes:** copy of `src/`, `prisma/`, `docs/` taken in the session scratchpad (temporary).
- **What changed:** see §13.7 table (security, payments, stock, checkout, auth, admin, SEO, UI, content, lint).
- **New files:** `src/lib/{session-token,site,rate-limit,contact,uploads,use-mounted}.ts`,
  `src/app/api/{cart/refresh,payments/cancel}/route.ts`, `src/app/uploads/products/[file]/route.ts`,
  `src/app/(store)/{forgot-password,reset-password}/page.tsx`, `src/app/(store)/inbound-actions.ts`,
  `src/app/(store)/account/orders/actions.ts`, `src/app/admin/(dashboard)/messages/{page,actions}.ts(x)`,
  `src/components/{product-gallery,order-lookup,contact-form,notify-form,status-badge}.tsx`,
  `src/components/auth/{login-form,register-form,password-reset-forms}.tsx`.
- **Moved:** `components/admin/status-badge.tsx` → `components/status-badge.tsx` (imports updated);
  login/register page bodies → `components/auth/*-form.tsx` (pages are now server components).
- **Removed:** fabricated testimonials list, product-page 5-star line, `OrderPipelinePanel`.
- **DB (local dev `localhost:5432/zariera`) — migrations applied with `prisma migrate deploy`:**
  - `20261002120000_payment_ref` → `Order.paymentRef` + index
  - `20261002130000_contact_newsletter` → `ContactMessage`, `Subscriber` tables
  - Verified: `prisma migrate diff` DB ↔ schema = *No difference*.
  - QA rows created during testing (3 orders, 1 contact message, product stock change) were **deleted / restored**.
- **⚠️ Restart the dev server** (`next dev`, it was running as PID 13292 during this session): `prisma generate`
  hit the known Windows EPERM because the dev server locks the query engine. Types/client were regenerated,
  but the running process still has the old client in memory — Contact/Messages need a restart. If generate
  fails again: stop `next dev`, run `npx prisma generate`, start again.
- **All existing sessions were invalidated** (new token format) — admin and customers simply sign in again.
- **Verification:** `tsc` 0 errors · `eslint` 0 problems · `next build` OK (no warnings) · e2e 45/45 + admin 9/9 (see §10).
- **Not committed to git** (user didn't ask). 142 changed/untracked paths — commit soon.
- **Docs updated:** this file (§4, §5, §7, §10, §13.7, §14), `README.md` (auth, payments, Docker volume, checklist),
  `.env.example` (all new vars), `Dockerfile` (`/app/uploads` volume), `.gitignore`, `.dockerignore`.

### 2026-10-02 — Mobile slider controls placement (Claude)
- **Issue (client screenshot, mobile):** "Signature Edit" promo slider arrows sat on top of the photo in the
  bottom-right corner, overlapping the image and the gold frame line; the chat button covered heading text.
- **Fix — `src/components/promo-slider.tsx`:** arrows removed from the image. New single control row under
  "Shop the Collection": `‹  01 / 16 + gold progress bar  ›` on mobile/tablet (16 dots don't fit), and
  `‹  dots  ›` on desktop (`lg+`). Added touch **swipe** left/right on the photo. `ArrowButton` helper added.
- **Fix — `src/components/support-chat.tsx`:** launcher is smaller on phones (48px, `sm:` 56px), sits
  `right-4` and respects the iOS safe-area; chat panel offset adjusted to match.
- **Verified** in the browser at 375×812 (mobile), 768×1024 (tablet) and 1366×800 (desktop): photo clean,
  controls centred inside the gold frame, nothing overlapping. `tsc` 0 errors, `eslint` 0 problems.
- Note: the black round **"N"** button bottom-left is the Next.js **dev-only** indicator — it does not
  appear on the live site.

### 2026-10-02 — Testimonials restored (Claude)
- **Request:** user asked to bring back the original reviews section exactly as before ("a to z"), since the
  store isn't live yet and real customer reviews will be added at launch.
- **Done:** `src/components/testimonials.tsx` restored byte-for-byte from the pre-fix backup (6 reviews, two
  sliding rows, "4.9/5 from 500+ happy clients", "Verified buyer"). Only a top-of-file reminder comment was
  added (no UI change). Shows on the home page again — verified in the browser, no console errors.
- **Go-live TODO (added to §13.7 "Still open"):** replace these sample reviews with real ones before launch —
  invented names/ratings/"Verified buyer" on a live store mislead shoppers.

### 2026-10-02 — Social links + email wired (Claude)
- **Client-provided links** added to `.env` (all icons read them via `src/lib/contact.ts`):
  - Email: `zariera.jewelry@gmail.com`
  - Instagram: `https://www.instagram.com/zariera_realm`
  - Facebook: `https://www.facebook.com/share/1BNJEB67dh/` (redirects to the "Zariera Jewellery" page)
  - TikTok: `https://www.tiktok.com/@zariera_realm`
  - Tracking params (`utm_*`, `share_id`, `user_id`, `sec_uid`…) were stripped from the shared TikTok /
    Instagram URLs — same profile, clean link, no personal share identifiers.
- **Where they appear:** footer social icons (Instagram, Facebook, TikTok, Email) + "Get in touch" email,
  home "Follow us on Instagram" button, contact page sidebar.
- **Fix:** footer `Social` links only use `target="_blank"` for web URLs — `mailto:` now opens the mail app
  without an empty extra tab (`src/components/site-footer.tsx`).
- **Tested:** each URL resolves HTTP 200 to the right profile; rendered hrefs checked on `/` and `/contact`;
  icons visible in the footer; clicking the Instagram icon triggers the new-tab open. `tsc`/`eslint` clean.
- **Not yet set:** WhatsApp number and phone (WhatsApp icon + chat WhatsApp button stay hidden until set).
- **Deploy note:** `NEXT_PUBLIC_*` values are baked in at build time — add them to the production env
  before `npm run build`.

### 2026-10-02 — Email icon "does nothing" fix (Claude)
- **Report:** clicking the footer Email icon did nothing. Cause: `mailto:` needs a default mail app; the user's
  Windows (like many shoppers on web Gmail) has none, so the browser silently ignores it. Not a code bug.
- **Fix:** new client component `src/components/email-link.tsx` — on click it copies the address to the
  clipboard and shows a toast ("Email copied" / fallback "Our email" if the clipboard is blocked), then still
  follows `mailto:` so a mail app opens when one is installed.
- **Used in:** footer Email icon, footer "Get in touch" email, contact page sidebar email.
- **Tested** in the browser: click → toast with the address appears; `tsc`/`eslint` clean.
  (In the automated test pane the clipboard is blocked, so the fallback toast showed; real user clicks copy.)
- Option if the client prefers: open Gmail web compose instead
  (`https://mail.google.com/mail/?view=cm&to=zariera.jewelry@gmail.com`) — not done, awaiting preference.

### 2026-10-03 — Dev crash fix, image optimisation, full QA pass, Netlify-ready (Claude)
**1. "Jest worker encountered 2 child process exceptions" (dev only)**
- Known Turbopack dev-cache corruption (see §3). Fixed by stopping all `next` processes (incl. a
  leftover `next start -p 3100` test server from the previous session), deleting `.next` (883 MB) and
  re-running `prisma generate` (finally succeeded — no process holding the engine). Not a code bug.
- If it ever returns: stop `next dev`, `rm -rf .next`, `npx next typegen`, `npm run dev`.

**2. Speed**
- Images re-encoded (originals backed up in the session scratchpad): **10.8 MB → 4.9 MB**, max 1600 px
  wide, mozjpeg q80, same filenames. Two product PNGs (~1 MB each, opaque) → JPG (~30 KB):
  `astra-pave-bangle.jpg`, `papillon-butterfly-bangle.jpg` — DB rows + `prisma/import-products.ts` updated.
- Hero + promo sliders now only download the visible slide and its neighbours (were all 5 / all 16 at once).
- Measured: DB queries 2–13 ms; dev mode ~1 s/page (on-demand compile), **production build 50–250 ms/page**.
  User decided further speed work waits for the paid server.

**3. Full QA pass (production build on :3100)**
- Crawl: 43/43 routes OK (every product + category, filters, search, 404, robots, sitemap).
- Suite: 44/45 — the one "fail" is the restored sample reviews (expected, by request).
- Browser flows ✅: add to cart, quick add, cart, checkout COD (Rs 6,300 + 500 shipping = 6,800), success
  page, order tracking (case-insensitive), register (8-char min enforced), sign out, guarded /account →
  login?next, wrong password, sign in; admin login, dashboard, order status change, courier booking
  (correctly refused without keys in prod), cancel → **stock restored**, product create / edit (price
  shows on storefront) / delete, delete of product with orders blocked with message, category add/delete,
  all 10 admin pages 200.
- **Bugs found & fixed in this pass:**
  - Forms wiped all fields after an error (React 19 form-action reset) → actions echo `values`, inputs use
    them as `defaultValue` (login, register, forgot password, admin login, contact, order tracking).
  - Home page didn't show admin product/category changes for up to 5 min → `revalidatePath("/", "layout")`.
  - Category Delete had no confirmation (one click deleted Necklaces/Earrings) → `DeleteButton` confirm.
  - Cart page + all admin pages had the generic site title → `cart/layout.tsx` metadata; admin titles
    "<Page> · ZARIERA Admin" + admin `noindex`.
  - Checkout labels not linked to inputs (screen readers) → `id`/`htmlFor` pairs.
- QA data cleaned up afterwards (see below).

**4. Netlify deploy readiness** — guide: **`docs/DEPLOY-NETLIFY.md`**
- `next.config.ts`: `output: "standalone"` only when NOT on Netlify (`NETLIFY=true` at build);
  `outputFileTracingIncludes` ships the Prisma engine.
- `prisma/schema.prisma`: `binaryTargets = ["native", "rhel-openssl-3.0.x"]` (Netlify/AWS Lambda) and
  `directUrl = env("DIRECT_URL")` (Neon pooled URL for the app, direct URL for migrations).
  **`DIRECT_URL` added to local `.env`** (= DATABASE_URL) and `.env.example`.
- `netlify.toml`: build = `npx prisma migrate deploy && npm run build`, Node 22.
- `netlify.env.example`: every env var to import into Netlify (socials pre-filled, `COURIER_SIMULATION=true`
  for the demo).
- Uploads: `src/lib/uploads.ts` `saveUpload/readUpload` → disk on VPS, **Netlify Blobs** on Netlify
  (store `product-uploads`, new dep `@netlify/blobs` 10.7). Upload + `/uploads/products/[file]` routes use it.
- Live order bell works on serverless: SSE route now also polls the DB every 5 s from a `since` cursor;
  client reconnects with the last seen `createdAt`, de-duplicates by id.
- New `npm run db:copy` (`prisma/copy-data.ts`): copies all data local → cloud DB, idempotent
  (tested into a temp DB `zariera_copytest`: 4 categories, 15 products, 1 admin, 4 customers, 18 orders,
  37 items; re-run skipped all; temp DB dropped).
- `NETLIFY=true next build` → success, no standalone folder (correct).
- ⚠️ Local admin password is weak (`.env`) — the guide sets a strong one on the cloud DB via
  `db:create-admin` before the demo URL is shared.
- **Netlify build verified locally** with `netlify-cli build --offline`: "Netlify Build Complete";
  server function `___netlify-server-handler` contains `libquery_engine-rhel-openssl-3.0.x.so.node`.
  `/.netlify/` added to `.gitignore`.
- **Final regression on the latest build:** e2e 44/45 (only the expected sample-reviews check), admin
  titles ("Orders · ZARIERA Admin"), cart title ("Shopping Bag · ZARIERA"), upload + serve OK, and live
  order alert **delivered via DB polling** (order inserted straight into the DB → `event: order` on the
  admin stream within 5 s — this is the Netlify path). Stream poll errors are now logged.
  (A first "fail" here was a bug in the test script's stream reader, not the app.)
- `README.md` → Netlify section + `DIRECT_URL` note.
- All local test servers stopped; QA data removed (DB back to 17 orders / 15 products / 3 customers /
  4 categories). **Dev server is NOT running** — start it with `npm run dev`.
- **Not committed/pushed yet** (~86 changed paths). Next step for the user: `git add -A && git commit && git push`,
  then follow `docs/DEPLOY-NETLIFY.md`.

### 2026-10-03 — Commit + push attempt, dev server restarted (Claude)
- Committed everything locally on `main`: **`8e35c02`** "Netlify-ready demo: QA fixes, socials, optimized
  images, deploy setup" (86 files). Secrets scan before commit: `.env`, uploads, `.netlify/` not included.
- **Push FAILED:** `Permission to mian76951-ui/zariera_project.git denied to nabeel-warraich` — the SSH key
  on this PC belongs to GitHub user `nabeel-warraich`, who has no write access to the repo.
  Fix (user): add `nabeel-warraich` as a collaborator on the repo (GitHub → repo → Settings →
  Collaborators → Add people → accept the invite), **or** push from the `mian76951-ui` account
  (e.g. GitHub Desktop signed in as that account, or HTTPS remote + that account's token). Then `git push origin main`.
- Dev server restarted in the background (hidden window, no terminal tab — user preference):
  `npm run dev` → http://localhost:3000, log in the session scratchpad. Stop it with:
  `Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'next dev' } | Stop-Process -Force`

### 2026-10-03 — Dark band above footer fixed (Claude)
- **Report (screenshot, dark mode):** a dark empty band between the last section and the footer on every page.
- **Cause:** `SiteFooter` had `mt-24` (96 px margin) since the original commit. The margin shows the body
  background; in light mode it matches the cream page (invisible), in dark mode it's a visibly darker strip.
  Missed in earlier QA because the visual checks were done in light mode.
- **Fix:** removed `mt-24` from `src/components/site-footer.tsx`; pages keep their own bottom padding
  (measured content→footer: shop 56, care/faq/shipping/contact/orders/search 64, cart 116, checkout 167 px;
  home/about/custom end in a full-width coloured section that now meets the footer directly). Product page
  bottom padding raised 40 → 80 px (`pb-20`).
- **Verified** in dark + light, desktop + mobile (main→footer gap 0 px). `tsc`/`eslint` clean.
- Deploy target confirmed by user: **Netlify** (not Vercel) — config already in place (netlify.toml etc.).

### 2026-10-03 — Admin login hang fixed, Admin Settings, invoice, CSV export (Claude)
**Login "takes long / only opens after hard refresh"**
- Measured: the login action itself is ~90 ms; a clean login → dashboard takes 0.5–2.7 s.
- Two causes: (1) dev mode compiles each admin page on first visit after a restart (not on Netlify);
  (2) **real bug** — the admin bell kept a permanent SSE connection open per admin tab. Browsers allow
  ~6 connections per site on HTTP/1.1, so with several tabs new requests (e.g. the post-login redirect)
  queued until a hard refresh freed one.
- Fix: SSE removed (`api/admin/orders/stream` + `lib/order-events.ts` deleted, `emitNewOrder` call removed).
  New `GET /api/admin/orders/latest?since=` (finishes in ~30 ms); `order-notifications.tsx` polls it every
  10 s (30 s when the tab is in the background so sound/OS notification still arrive), de-dupes by id.
  Verified: order inserted in the DB → bell alert after 16 s with the tab hidden. Works the same on Netlify.

**Admin → Settings (`/admin/settings`, new menu item)** — model `Setting` (key/value JSON, key `store`),
migration `20261003100000_store_settings`; `src/lib/settings.ts` (`getStoreSettings` cached per request,
falls back to env defaults, `saveStoreSettings`, `renderAnnouncements`), `src/lib/settings-shared.ts`
(type + client-safe helpers `shippingFor`, `whatsappUrl`, `phoneHref`).
- Sections: Store contact (email, phone, WhatsApp — normalised to digits, city, hours), Social links
  (https only), Shipping (fee, free-over amount, delivery time), Announcement bar (≤10 lines,
  `{freeThreshold}`/`{flatFee}` placeholders, empty = hidden), Inventory & notifications (low-stock
  threshold, order-alert email), My account (change password, min 10 chars, current password required),
  Team (list, add Admin/Staff with temp password, remove — not yourself, never the last admin).
- **Roles:** STAFF can use orders/products/categories etc. but sees settings read-only; only ADMIN edits
  settings/team (`requireOwner` in `settings/actions.ts`).
- Saving revalidates the whole storefront (`revalidatePath("/", "layout")`) — changes show immediately.
- Wired everywhere: store layout passes settings to header (marquee), footer, support chat; contact, home,
  product, FAQ, shipping pages; checkout form + **server-side order total** (`lib/orders.ts`); email alert
  address (`lib/email.ts`); low-stock count on dashboard/admin-data + product "only N left".
- Verified: contact change → home + contact page show new phone/WhatsApp at once; shipping fee 300 → real
  order charged 300; negative fee rejected; announcement line + placeholder rendered; wrong current
  password / mismatch rejected; staff added, staff sees read-only notice and no team form, staff removed;
  own account has no Remove button. Test settings reset afterwards (Setting row deleted → defaults).

**Orders extras**
- **Print invoice / packing slip:** `/admin/invoice/[id]` (outside the dashboard frame, A4-friendly; shows
  "Cash to collect" for unpaid COD; dashed cut-off packing slip). Button on the order detail page.
- **Export to Excel (CSV):** `GET /api/admin/orders/export[?status=]` (UTF-8 BOM, formula-injection safe,
  all fields + items). Button on the Orders page. Verified: 18 orders exported.

**Ops notes**
- Never run `next build` / `next typegen` while `next dev` is running — they share `.next` and the dev
  server starts returning 404s for existing routes. Fix: stop dev, delete `.next`, start dev.
- Dev server running hidden in the background (`npm run dev`, http://localhost:3000).
- `NETLIFY=true next build` ✓ (new routes included). `tsc` + `eslint` clean.
- `docs/DEPLOY-NETLIFY.md` updated (Settings section + demo checklist).

### 2026-10-05 — Local app switched to the Neon cloud DB (Claude)
- User-provided Neon project (region **ap-southeast-1 / Singapore**, PostgreSQL 18.6, db `neondb`).
- `.env` (git-ignored; previous copy backed up in the session scratchpad):
  - `DATABASE_URL` = Neon **pooled** host (`…-pooler…`) + `sslmode=require&pgbouncer=true&connection_limit=5`
  - `DIRECT_URL`   = Neon **direct** host (same URL without `-pooler`) — used by `prisma migrate`
  - `LOCAL_DATABASE_URL` = old local Postgres (for `db:copy` / switching back)
  - `channel_binding=require` from Neon's copy-paste string was dropped — Prisma's driver doesn't support
    it; `sslmode=require` keeps TLS.
- `npx prisma migrate deploy` → all 8 migrations applied on Neon; status "up to date".
- `npm run db:copy` local → Neon: 4 categories, 15 products, 1 admin (same login as local), 4 customers,
  18 orders, 36 items. (Includes the 16 `QATEST-` demo orders — delete before go-live, see §9.)
- Dev server restarted on Neon. Proof: a test order placed through the website appeared in Neon and NOT
  in the local DB (then deleted, stock restored). /shop lists all 15 products.
- **For Netlify:** use the same two URLs in the Netlify env vars, but with `connection_limit=1` on
  `DATABASE_URL` (serverless). Migrations already applied — the build's `prisma migrate deploy` will be a no-op.
- To switch back to local: set `DATABASE_URL` and `DIRECT_URL` to `LOCAL_DATABASE_URL`, restart `npm run dev`.
- Security note: the Neon password was shared in chat — consider resetting it in Neon (Roles → Reset
  password) after the demo and updating `.env` + Netlify.

### 2026-10-05 — Reverted local app to the local DB; Vercel question (Claude)
- On request, `.env` restored from the pre-Neon backup → `DATABASE_URL`/`DIRECT_URL` = local Postgres again
  (Neon version of `.env` saved in the session scratchpad). Dev server restarted; /shop shows 15 products,
  `migrate status` (localhost) up to date. **Neon data was left in place** (schema + copied data) for deploy.
- User asked whether the project works on **Vercel** now. Assessment (no code changed yet):
  works — storefront, checkout, accounts, admin, settings, bell polling, invoice/CSV, Prisma
  (`rhel-openssl-3.0.x` target + `postinstall: prisma generate`), Neon.
  Does NOT work yet — **admin image upload** (Vercel filesystem is read-only; Netlify Blobs is Netlify-only →
  needs Vercel Blob). Should change — `next.config.ts` should also skip `output: "standalone"` when
  `VERCEL=1`; migrations aren't run by Vercel's default build (Neon is already migrated; future schema changes
  need `prisma migrate deploy` or a build command). Vercel Hobby plan is non-commercial → Pro for a live store.

### 2026-10-05 — Vercel deployment: register failing, diagnostics + Vercel support (Claude)
- User deployed via Vercel (repo is connected; GitHub `main` = `5ba9aa7`, so Vercel runs the current code).
  Live URL is behind Vercel Deployment Protection, so it couldn't be probed from here.
- "Could not create your account" = the generic branch: the DB call failed with an error the old regex
  didn't classify, and **nothing was logged**. Most likely cause: Vercel `DATABASE_URL` wrong (localhost from
  a copied `.env`, or Neon pooled URL without `pgbouncer=true` / with `channel_binding=require`).
- Added `src/lib/db-errors.ts` (`dbErrorKind`, `logDbError`) — register/login now log the real error and map
  unavailable / duplicate / not-migrated / engine; admin login logs DB errors; catalog's silent sample-data
  fallback now logs `[catalog] DATABASE UNAVAILABLE` on every hit in production.
- New **`GET /api/health`**: DB URL sanity (host only, pooled/pgbouncer/channel_binding flags), DIRECT_URL,
  AUTH_SECRET, site URL, DB connect, required tables, counts, upload backend + `warnings` list. No secrets.
  (localhost only flagged on Vercel/Netlify.)
- **Vercel support:** `next.config.ts` skips `output: "standalone"` when `VERCEL` is set (`VERCEL=1 next build`
  ✓, no standalone dir); uploads use **Vercel Blob** when `BLOB_READ_WRITE_TOKEN` exists (new dep
  `@vercel/blob` 2.8, public URL stored on the product), clear error on Vercel without a Blob store.
- New guide **`docs/DEPLOY-VERCEL.md`** (env vars, Neon, Blob store, /api/health, Deployment Protection).
- Mistake noted: ran `next typegen` while `next dev` was running → corrupted `.next/dev/types`; fixed by
  stopping dev and deleting `.next`. Rule stands: never build/typegen while dev runs.
- tsc/eslint clean. Dev server restarted (local DB).

### 2026-10-20 — Client-reported mistakes + self-QA pass (Claude)
**Reported by user**
1. Admin login: "Authorised personnel only" (British spelling on an American-English site) and the email
   box placeholder showed the real admin email `admin@zariera.com` (tells attackers which account to target).
   → now "Authorized staff only · ZARIERA", placeholder `you@example.com`.
2. Custom page "Start Your Design" jumped to the generic Contact page. → Custom page now has its own
   **design request form** (`src/components/custom-design-form.tsx`, section `#design-request`); the button
   scrolls to it. Fields: name, email, phone/WhatsApp, piece type, finish, budget (options in
   `src/lib/custom-request.ts`), needed-by, description; honeypot + rate limit. Server action
   `sendCustomRequest` saves a ContactMessage (topic `custom`, subject "Custom design: <piece>") → shows in
   Admin → Messages with the CUSTOM tag; owner email alert if SMTP is set. Success state + WhatsApp hint for
   reference photos.

**Found in my own QA pass**
- British spellings → American: "favourite" (shop + sample data), "Organise your catalogue" (admin
  categories), "centre" in 3 product descriptions (local DB, **live Neon DB** and `import-products.ts`).
- `<select>` values were lost after a validation error (select reads defaultValue only on mount) → keyed
  selects in custom form + admin team role.
- **Admin product form lost everything typed after a failed save** (e.g. duplicate slug) → actions return
  `values`, form refills all fields, category select and checkboxes.
- Shop price filter button "Go" → "Apply". 404 page title "Page not found"; search title "Search: <q>";
  admin dashboard title "Dashboard · ZARIERA Admin" (layout template doesn't apply to the segment's own page).
- `.playwright-mcp/` added to `.gitignore`.
- Link/button audit (all storefront pages): every internal link 200/expected redirect, every #anchor exists,
  no placeholder/test words in visible text, all pages titled. Custom form verified desktop + mobile (no
  horizontal overflow), error keeps all values, valid submit → Messages. Test data deleted.

### 2026-10-20 — Custom page button wording (Claude)
- User: "Start Your Design" sounds like a design tool opens, but it leads to a form. Changed to
  **"Request a Custom Piece"** with a hint below: "Fill a short form — takes 2 minutes, no payment needed."
  (`src/app/(store)/custom/page.tsx`). Verified in the browser; tsc/eslint clean.

### 2026-10-20 — AI support chat (Claude) (Claude)
- **Request:** the chat bubble gave the same answer to everything (it was a fixed keyword FAQ). User wants a
  real assistant that answers any customer question when the owner isn't available.
- **Server:** `src/lib/ai-assistant.ts` + `POST /api/chat` (`GET /api/chat` → `{ai: true|false}`).
  - **AI mode** (when `ANTHROPIC_API_KEY` is set): official `@anthropic-ai/sdk` (0.135), model
    `claude-opus-5-5` (override with `CHAT_MODEL`), `output_config.effort: "low"` (chat), server-side refusal
    fallbacks (`betas: ["server-side-fallback-2026-07-01"]`, `fallbacks: "default"`), `stop_reason: "refusal"`
    handled. System prompt = fixed instructions + live store knowledge (all active products with price / sale /
    stock / material / link, categories incl. "coming soon", shipping fee + free threshold + delivery time from
    Settings, COD, 7-day returns, care, custom orders, contact) with a cache breakpoint.
    Tool `track_order` (strict schema; needs order number AND checkout email — same rule as /account/orders).
    Manual tool loop (≤3 rounds) appends `response.content` unchanged; earlier turns come from the browser as
    plain text only (no thinking blocks replayed, so preserved-thinking checks don't apply).
    Guardrails in the prompt: answer only from store data, reply in the customer's language (English / Urdu /
    Roman Urdu), never invent prices/discounts/dates, never take card/OTP/passwords, ignore prompt-injection,
    hand off to WhatsApp / contact page when unsure. Typed SDK errors → falls back to basic mode.
  - **Basic mode** (no key, or API error): rewritten keyword intents (tracking, payment/COD before shipping,
    returns, custom, shipping, care, size, contact, sale items) + **real product search** (best-score matches,
    "under Rs X" price filter, single-match answer with price/stock/link) + "coming soon" for empty categories.
  - Rate limit 20 messages / 10 min per IP; ≤12 turns, ≤600 chars per message; `maxDuration = 30`.
- **UI (`src/components/support-chat.tsx`):** typed questions go to /api/chat with a typing indicator; product
  and page paths in replies become links (`/product/...`, `/shop/...`, full URLs); conversation kept in
  sessionStorage (`zariera-chat-v1`, restored when the chat is opened); quick-reply chips stay instant; local
  fallback if the request fails.
- **Bugs found while testing & fixed:** "cash on delivery" answered as shipping (check order); product question
  listed 4 items instead of the match; Python edit wrote literal backspace chars instead of `\b` in regexes
  (greeting never matched) → function rewritten, file checked for `\x08`; "earrings?" now says coming soon.
- **Verified:** 12 + 9 question API runs (basic mode — no API key on this PC), browser: ask → answer with link →
  click → product page, chat still open; reload → conversation restored. `VERCEL=1 next build` ✓, tsc/eslint clean.
- **To activate AI mode:** add `ANTHROPIC_API_KEY` (Secret) in Vercel/Netlify env + local `.env`, redeploy.
  **Not yet tested against the live API** (no key available here). Cost: per message, Claude Opus 5.5 rates
  ($4 / $20 per MTok, cached prompt reads $0.20); switch with `CHAT_MODEL` if needed.
- Env templates updated: `.env.example`, `netlify.env.example`, `docs/DEPLOY-VERCEL.md`.

### 2026-10-20 — Email OTP verification at registration

**Request:** "register karta hai to … sath otp verification hona chahiye … professional working".

**Flow:** `/register` (name, email, password → **Continue**) → server validates, rejects existing email, emails a
6-digit code, redirects to **`/register/verify`** ("Step 2 of 2 · Verify your email") → correct code →
account is created **already verified** → logged in → `next` page with the "Welcome" toast. The account is
**not** created until the code is confirmed (nobody can register an email they don't own).

**Security / rules (`src/lib/otp.ts`):**
- Code from `crypto.randomInt`, stored only as HMAC-SHA256 (key derived from AUTH_SECRET via
  `derivedKey("otp")` in `session-token.ts`); timing-safe compare.
- Expires in **10 min**; **5 wrong attempts** burn the code ("Incorrect code. 4 attempts left." …).
- Resend: **60 s cooldown** (live countdown on the page), max **5 codes / hour** per email; rate limits per IP
  (`otp:` 25/10 min, `otp-resend:` 10/h, register 8/h).
- The pending sign-up lives in a signed httpOnly cookie `zariera_verify` (30 min, token kind `verify`) — the
  email never goes in the URL. Name + password **hash** wait in `EmailVerification.payload` until verified.
- Code is deleted after use (can't be reused).

**Existing customers** (made at checkout / before OTP): account page shows a gold **"Please verify your email"**
banner → **Verify email** → `/account/verify-email` → code → "✓ Verified" badge on the profile. If the session
cookie belongs to an account that no longer exists, the action ends the session and sends the user to /login.

**UI (`src/components/auth/otp-form.tsx`):** 6 digit boxes — auto-advance, backspace/arrow keys, paste a whole
code (spaces ignored), `autocomplete="one-time-code"` (phones suggest the code), auto-submit on the 6th digit,
error under the boxes + toast, boxes clear and refocus on a wrong code, "Wrong email? Change it" link. Header and
footer are hidden on both verify pages (like login/register). Email template: branded code box (`sendOtpEmail`).

**Without SMTP:** dev prints `[email] SMTP not configured — DEV ONLY verification code for … : 123456` in the
terminal; **production refuses** ("We can't send verification emails right now") → **SMTP env vars are now
required on Vercel/Netlify** for sign-up. `/api/health` warns when SMTP is missing. Docs: `DEPLOY-VERCEL.md`,
`.env.example`, `netlify.env.example`.

**Files:** `prisma/schema.prisma`, migration `20261020100000_email_otp` (applied to **local + Neon**),
`src/lib/otp.ts` (new), `src/lib/session-token.ts` (`verify` kind, `derivedKey`), `src/lib/email.ts`
(`sendOtpEmail`), `src/app/(store)/auth-actions.ts` (register step 1 + `verifyRegistrationAction`,
`resendRegistrationCode`, `startEmailVerification`, `verifyEmailAction`, `resendEmailVerification`),
`src/app/(store)/register/verify/page.tsx`, `src/app/(store)/account/verify-email/page.tsx`,
`src/app/(store)/account/page.tsx` (banner + badge), `register-form.tsx` (copy, "Continue"),
`flash-toast.tsx` (`email-verified`, `verify-send-failed`), `conditional-header/footer.tsx`, `api/health`.

**Tested (browser, local):** register → verify page (desktop + mobile 375px) → wrong code (error + 4 left,
boxes cleared) → right code → account created + "✓ Verified"; used code deleted; existing-account banner →
code by **paste** → verified; duplicate email (different capitals) blocked; `/register/verify` without a
pending sign-up → redirects to /register; stale session for deleted account → /login (bug found & fixed).
eslint + tsc clean (fixed `set-state-in-effect` with the adjust-state-during-render pattern). Test accounts
removed afterwards.

**⚠️ To do on live:** add SMTP env vars in Vercel (Gmail App Password for the store Gmail) → Redeploy. Until
then new sign-ups on the live site can't get a code.


**2026-10-20 (follow-up):** User tested sign-up locally with a real Gmail, no email arrived. Cause: the local
`.env` had **no SMTP settings**, so the code was only printed in the dev terminal ("DEV ONLY verification code").
Added empty SMTP placeholders to the local `.env` (`SMTP_HOST=smtp.gmail.com`, port 587, `SMTP_USER`,
`SMTP_PASS`, `MAIL_FROM` blank). User must fill in the store Gmail and its App Password, then restart dev.
Same values are needed on Vercel. Not pushed yet (commit `fec3707` is local only).

**2026-10-21 — Store Gmail changed to `jewelryzariera@gmail.com`** (old: zariera.jewelry@gmail.com).
- Saved as `contact.email` in the `Setting "store"` row on **local + Neon** (live site shows it immediately;
  Neon socials kept). Local `.env`: `NEXT_PUBLIC_CONTACT_EMAIL`, `SMTP_USER`, `MAIL_FROM` set to it;
  `netlify.env.example` updated.
- `SMTP_PASS` (Gmail App Password) is **left blank on purpose**: the AI doesn't write real account passwords.
  The owner pastes it into local `.env` and into Vercel env vars. The App Password was posted in chat once,
  so the owner was advised to delete it in Google → App passwords and make a new one.
- Vercel still needs: `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`,
  and optionally `NEXT_PUBLIC_CONTACT_EMAIL` → Redeploy. OTP commit `fec3707` still not pushed.

**2026-10-21 — SMTP live test:** owner added the Gmail App Password (new one) to local `.env` and Vercel
(Production). `nodemailer.verify()` → login OK for jewelryzariera@gmail.com; local sign-up sent a real code email
(no "DEV ONLY" log line). `src/lib/email.ts` now strips spaces from `SMTP_PASS` when the host is Gmail (Google
displays App Passwords as "abcd efgh ijkl mnop"; Vercel value was pasted with spaces). Vercel has a key
`CONTACT_EMAIL` (owner dropped the `NEXT_PUBLIC_` prefix because of a Sensitive warning) — unused by the code;
the contact email comes from the DB setting saved earlier, so it can be deleted. Pushed OTP + this fix → Vercel
auto-deploys with the new env vars.
- After push (`1ccbac9`), ~8 min later the live site still served the old build (`/register/verify` → 404,
  health without the SMTP check). GitHub status not readable (private repo, `gh` not logged in) → owner asked
  to check Vercel → Deployments (building / error / not triggered) and Redeploy the latest commit.
- Owner redeployed → live now on the OTP build (`/register/verify` → 307 redirect, `/api/health` has no SMTP
  warning; only the Blob-store warning remains). Live sign-up test is left to the owner (the AI doesn't enter
  passwords / create accounts on the production site); steps sent: register with a real Gmail → code from
  jewelryzariera@gmail.com → verify → "✓ Verified". If it fails: screenshot + Vercel Logs search `[email]`.

### 2026-10-22 — Product details: only one section open at a time

**Request:** on the product page, "Product details" sections (Highlights & specifications, About this item,
Size & fit, Care & cleaning, Shipping & returns) could all be open together → make it one-at-a-time, on every
product.

**Fix:** `src/app/(store)/product/[slug]/page.tsx` → `Accordion` now renders `<details name="product-details">`.
Native HTML *exclusive accordion*: `<details>` elements sharing a `name` close each other, no client JS
(page stays a server component). "Highlights & specifications" still opens by default; clicking the open one
closes it. One component is used for all products, so it applies site-wide.

**Tested (local):** clicked sections 2 → 3 → 5 → 5 again: only the clicked one open each time, then all closed;
`name="product-details"` present (5 sections) on 3 other products; screenshot OK; fresh page load has no
console/hydration errors (an earlier hydration warning came from my test script clicking before hydration).
eslint + tsc clean. Browser support: Chrome/Edge 120+, Safari 17.2+, Firefox 130+ (older browsers just allow
several open, as before). FAQ page accordion left unchanged (not requested).

**2026-10-22 — FAQ: one answer open at a time.** Owner asked to apply the same behaviour on the FAQ page.
`src/app/(store)/faq/page.tsx` → each `<details>` now has `name="faq"` (native exclusive accordion, no JS).
Tested locally: 7 questions; click 1st → 3rd → 4th → 4th again = only the clicked one open, then none; no
console errors; eslint + tsc clean. Pushed → live.

### 2026-10-22 — Smooth (premium) open/close animation for Product details + FAQ

**Request:** sections opened/closed with a snap; owner wanted a smooth, professional ("premium") feel on
both the FAQ and every product's details.

**Fix:** new client component `src/components/ui/accordion-item.tsx` (`AccordionItem`) used by the product
page `Accordion` and the FAQ list (the native `name=` exclusive attribute was removed in favour of this).
- Opening animates height 0 → content height + fade in (420 ms); closing animates to 0 + fade out (320 ms);
  easing `cubic-bezier(0.22, 1, 0.36, 1)`; the chevron / "+" icon rotates with the same timing.
- Items with the same `group` ("product-details", "faq") stay exclusive: opening one smoothly closes the
  others. Re-clicking mid-animation reverses from the current height.
- Web Animations API (works in Chrome/Edge/Firefox/iPhone Safari). `prefers-reduced-motion` → instant.
- State lives in `data-state` (icon uses `group-data-[state=open]:`); `aria-expanded` on the summary;
  keyboard Enter/Space work (handled via the summary click); without JS it's still a plain `<details>`.
- Robustness: uses `anim.finished` (resolves even without painted frames) + a timeout that calls
  `anim.finish()`, so a section can never get stuck "closing" in a background tab (found while testing —
  the preview pane paused animations).

**Tested (local):** FAQ and product page — open/close/switch/rapid triple-click end in the right state;
inspected running animations (close 57.5px→0 / 320 ms, open 0→58px / 420 ms, correct easing); screenshots;
no console errors; eslint + tsc clean. Pushed → live.

**2026-10-22 — Admin password forgotten (owner).** Passwords are stored as scrypt hashes, so they can't be
recovered, only reset. Checked without printing: local admin `admin@zariera.com` matches `.env`
`ADMIN_PASSWORD` (line 10); the **live (Neon)** admin hash does NOT match (it was set to something else).
Reset process: owner writes a new strong password in `.env` `ADMIN_PASSWORD` → run `npm run db:create-admin`
(upsert, re-hashes) against local and against Neon with `DATABASE_URL=<Neon direct URL>`. The AI runs the
script but never reads/prints the password.
- Owner set a new `ADMIN_PASSWORD` in `.env`; `db:create-admin` run on local + Neon; verified both admin hashes
  match the new `.env` value. Owner advised to pick a stronger password later (the new one is short/common
  and was typed in chat).
- Owner reported local not working: dev server had simply stopped (previous session closed; no error in log,
  Postgres on 5432 up). Restarted hidden (`npm run dev`); home, shop, faq, admin/login, register → 200.
  Note: the local dev server stops whenever the AI session/PC restarts → run `npm run dev` in the project folder.

### 2026-10-26 — Moved to Ubuntu: local setup, db scripts fixed (Claude)

**Context:** owner replaced Windows with Ubuntu 26.04 on the laptop and asked what is needed to keep
working locally. The repo was already cloned at `/home/ahmad/zariera_project` (`main` = `0574c95`).

- **Checked the machine:** Git, Node 22, VS Code, GitHub SSH access were already OK. Missing: PostgreSQL
  server (only the `psql` client was installed) and `.env` (stayed on Windows). Owner installed Postgres 18
  and wrote a new `.env` (local DB on port 5433).
- **DB login failed** at first (`P1000` / `password authentication failed`): the `postgres` user's password
  didn't match `.env`. Owner fixed it; `prisma migrate status` → all 9 migrations applied, schema up to date.
- **`npm run db:seed` / `db:create-admin` failed** with `ERR_NO_TYPESCRIPT`: Ubuntu's `nodejs` package is
  built without Node's TypeScript support (`process.features.typescript === false`), so
  `node --experimental-strip-types` can't run `prisma/*.ts`.
  **Fix (commit `58b5515`):** added `tsx` ^4.23.15 as a devDependency; `db:seed`, `db:create-admin`,
  `db:copy` and the `prisma.seed` hook now run through `tsx`. README scripts table updated.
- **Tested on Ubuntu:** `npm run db:seed` (4 categories, 6 products), `npx prisma db seed`,
  `npm run db:create-admin` (admin ready), `npm run db:copy` (stops with "Set SOURCE_DATABASE_URL and
  TARGET_DATABASE_URL." when not given — nothing copied). Local site on :3000 serves the seeded products
  from the DB; `/admin/login` → 200. **Local DB only — Neon was not touched.**
- **Pushed `58b5515` to `main` → Vercel deployed it to Production** (GitHub deployment status "success";
  live site → 200). Only dev scripts/README changed, so the live store is unaffected. Mistake: I told the
  owner Netlify would deploy it — the live site is on **Vercel** (<https://zariera-project.vercel.app/>).
- **Owner's decision:** finish the whole project first, go live at the end → new house rule in §12
  (no push to `main` without the owner's go-ahead). This handoff updated: §1 root + live URL, §3 Ubuntu setup.
- Prisma warns that `package.json#prisma` is deprecated (removed in Prisma 7) — harmless on Prisma 6; move
  to `prisma.config.ts` when upgrading.
- **Branch workflow set up:** created branch **`dev`** from `main` (`58b5515`) and pushed it to GitHub.
  From now on all work is committed + pushed on `dev`; `main` (= live) only gets `dev` merged in at the end,
  on the owner's word.

### 2026-10-26 — Live (Neon) data copied to the local DB (Claude)

**Problem:** on the new Ubuntu machine the local store showed only the 6 seed products — owner feared the
products were lost. They weren't: GitHub holds code, not DB rows. The Windows local DB is gone, but the live
Neon DB had everything (15 products, 4 categories, 22 orders, 7 customers, 2 admins, 1 settings row), and all
15 product images are in git (`public/images/products/`).

**What was done (owner approved: "local DB khaali karke Neon ka saara data local par copy kar do"):**
1. Owner put the Neon **direct** URL in local `.env` as `NEON_DIRECT_URL` (first added it to Vercel by
   mistake — told to undo that; live `/api/health` still showed the pooled `DATABASE_URL`, DB ok).
   Read-only test (`default_transaction_read_only=on`) → Neon PostgreSQL 18.6, 9 migrations (= local).
2. Backed up the local DB (`pg_dump --data-only -Fc`, PG 18 client) to the session scratchpad
   (`local-before-copy.dump` — seed data only; temporary, deleted with the session).
3. Emptied every local table except `_prisma_migrations` (`TRUNCATE … RESTART IDENTITY CASCADE`; checked the
   URL was `localhost` first). Removed: 6 seed products, 4 categories, 1 admin, 2 local test customers.
4. `SOURCE_DATABASE_URL=<Neon :5432, no channel_binding> TARGET_DATABASE_URL=<local> npm run db:copy` →
   4 categories, 15 products, 2 admins, 7 customers, 22 orders, 41 items, 4 messages, 2 subscribers.
5. `Setting` isn't copied by `copy-data.ts` → piped with `psql \copy` (Neon read-only → local): 1 row.
6. `npm run db:create-admin` → the `.env` admin's **local** password reset to `.env` `ADMIN_PASSWORD`
   (it came over with the live hash). Neon untouched.

**Verified:** Neon vs local identical (15 products / 15 active / stock 282 / 4 cats / 22 orders / 41 items /
7 customers / 2 admins / 1 setting); local `/shop` lists 15 products, all 15 image files exist; `/admin/login`
200. **Nothing was written to Neon; live site unchanged.**

**Note:** the local DB now contains real customer data (names, emails, phones, addresses) — keep the laptop
secure. The `QATEST-` demo orders came along too (§9).

### 2026-10-26 — Premium sale / discount display (Claude)

**Request (from the client, via owner):** discounts looked plain ("−15%" pill + small struck price) — customers
didn't feel they were saving. Wanted a heavy, premium look that makes the saving obvious.

**What changed** (new `src/components/ui/sale-badge.tsx` holds all sale UI):
- **Product cards** (`product-card.tsx` — shop, category, search, home featured, related): hanging **maroon
  ribbon with gold edge** pinned top-left ("15% OFF", V-notch tail, gold sheen sweep). Maroon, not gold, so it
  stands out on gold jewelry photos (gold version was tried first and blended in). Sale cards get a gold border;
  price shows sale price in maroon (gold in dark mode) + struck regular price + "🏷 SAVE RS 700".
- **Product page** (`product/[slug]/page.tsx`): `DealPanel` replaces the plain price row on sale items —
  "✦ Special offer price", big price, "Regular price ~~Rs 4,600~~", rotated gold-foil "15% OFF" seal with sheen,
  maroon strip "You save **Rs 700** on this piece". Non-sale items unchanged.
- **Cart + checkout**: `CartItem` now carries optional `compareAtPrice`; `useCart()` exposes `savings`.
  Cart lines show struck regular total + "SAVE RS X" (`LinePrice`); cart and checkout summaries show a maroon
  strip "You're saving **Rs 1,100** on this order" (`SavingsStrip`). Works for "Buy it now" checkout too
  (`checkout/page.tsx` passes `compareAtPrice`).
  `/api/cart/refresh` now also returns `compareAtPrice`, so carts saved before this change pick it up on the
  next page load (tested by deleting the field from localStorage → restored).
- `lib/format.ts`: `savingsOf(price, compareAt)`. `globals.css`: `.sale-shine` (sheen, off under
  `prefers-reduced-motion`, colour via `--sale-shine`) and `.sale-ribbon` (clip-path notch).
- No fake urgency (no countdowns / "only today") — the offer copy is factual.
- Prices charged are unchanged: orders still use `price`; `compareAtPrice` is display-only.

**Tested (local, real DB data — 7 of 15 products are on sale):** shop desktop + mobile 375px (no horizontal
scroll), product page desktop + mobile, dark mode (cards + deal panel), cart with 2 sale items (Rs 700 + 400 =
"saving Rs 1,100"), checkout summary (same), buy-now ×2 ("saving Rs 1,400"); no console errors; tsc + eslint clean.
Test cart cleared afterwards. On `dev` only — not live.

### 2026-10-26 — Back to working on `main`; dev merged and pushed live (Claude)
- Owner asked whether the local site was connected to the live Neon DB. It isn't: `DATABASE_URL`/`DIRECT_URL`
  = `localhost:5433` (Prisma + `inet_server_addr()` confirmed); `NEON_DIRECT_URL` is read by no code — it was
  only used for the one-time copy. Owner may delete that line from `.env` (then re-add it for a future copy).
- Owner then chose: **"dev ka kaam main mein merge karo aur aage se seedha main par kaam aur push karo, har push
  live jaye."** → checked `dev`'s Preview build (`7ac6bf6`) had succeeded, `git merge --ff-only origin/dev` on
  `main` (feb25f6, ea587ea, 7ac6bf6 — handoff notes + the premium sale display), §1/§12 updated, pushed `main`
  → Vercel Production. Local checkout is now on `main`; `dev` left on GitHub (fully merged, unused).

### 2026-10-26 — Vercel Blob store connected; uploads accept OIDC (Claude)
- Live `/api/health` said `uploads: NOT CONFIGURED` → live admin image upload would fail. Guided the owner:
  Vercel → Storage → Create → **Blob** `zariera-uploads` (**Public**, region SIN1) → connected to
  `zariera-project` (All Environments, "read-write token" box ticked).
- Vercel now connects Blob stores with **OIDC**: the connection lists `BLOB_STORE_ID` +
  `BLOB_WEBHOOK_PUBLIC_KEY`, and a banner suggests revoking the read-write token. Our code only looked for
  `BLOB_READ_WRITE_TOKEN`, so uploads could still have failed.
- **Fix:** `vercelBlobConfigured()` in `src/lib/uploads.ts` (true for `BLOB_STORE_ID` **or**
  `BLOB_READ_WRITE_TOKEN`); `saveUpload` and `/api/health` use it. `@vercel/blob` 2.8 authenticates with
  OIDC when `BLOB_STORE_ID` is set (documented in its types), else the token. Health now reports
  `vercel-blob (oidc)` / `vercel-blob (token)`. `docs/DEPLOY-VERCEL.md` updated.
- Local unchanged (`uploads: "disk"`); tsc + eslint clean. Pushed to `main` (live) — this deploy also picks up
  the new Blob env vars, so no manual Redeploy needed.
- **Don't press "Revoke Token"** until a live upload is confirmed working via OIDC.
- **Owner confirmed (2026-10-26):** "Maine live admin mein photo upload karke dekha, upload ho gaya." → live
  admin image upload works through Vercel Blob. Revoking the read-write token is optional (the SDK uses OIDC
  when `BLOB_STORE_ID` is set); if revoked, upload one photo again to re-check. A test upload that wasn't saved
  leaves an unused file in the store (Storage → zariera-uploads → Manage Blobs) — harmless, can be deleted.

### 2026-10-26 — Premium shop sidebar: price slider, categories, offers, mobile drawer (Claude)
**Request:** the price filter (two number boxes with spinner arrows + "Apply") looked "beginner"; owner wanted a
premium, professional sidebar with whatever a good shop sidebar should have.

**What changed**
- **Sidebar** (`components/shop/shop-filters.tsx`, desktop ≥ lg, in a "Refine" card):
  - **Categories** with counts (whole store); empty ones say "Soon" (link still opens the Coming-soon page).
    Links keep the current filters; active one has a gold bar.
  - **Price** (`components/shop/price-range.tsx`): dual-thumb gold slider (Rs 100 steps, bounds = cheapest /
    dearest piece in scope, rounded to 100), two "Rs" text fields (no spinners; Enter/blur applies, swaps if
    reversed), and 3 quick chips built from the real spread rounded to Rs 500 (e.g. "Under Rs 2,500",
    "Rs 2,500 – 3,000", "Rs 3,000 & above"). Applies on release — no Apply button.
  - **Offers & availability** switches: **On sale** (`?sale=1`, compareAtPrice > price via Prisma field
    reference) and **In stock only** (`?stock=1`), each with a count.
  - **Material** as custom radios with counts.
- **Results bar** (`components/shop/shop-toolbar.tsx`): piece count, **Sort by** moved here (pill select),
  removable active-filter chips + "Clear all" (keeps sort). **Mobile:** "Filters (n)" button opens a left drawer
  (same filters, "Clear" + "Show N pieces", Esc/overlay closes, page scroll locked, z-80 so it sits above the
  chat launcher).
- **Data:** `getShopFacets(categorySlug?)` in `lib/catalog.ts` (replaces `getMaterials`) — counts + bounds in
  one query, sample-data fallback kept. `ProductFilters` gained `onSale` / `inStock` (`lib/filters.ts` parses
  `sale=1` / `stock=1`); category "Coming soon" check counts them too. `.range-dual` slider CSS in `globals.css`.

**Tested (local, real data):** On sale → 7; + "Under Rs 2,500" → 3; typed min 2,400 → 10 (slider followed);
dragged max to 3,300 → 6; Bracelets link keeps filters, bounds re-scope to 2,400–3,900 → 4; sort low→high;
removing a chip / Clear all; DB counts match (6 / 3 / 10 / 4). Mobile 375px (no horizontal scroll, drawer,
footer button), dark mode (sidebar + drawer + chips). tsc + eslint (whole `src`) clean. Note: Browser-pane
screenshots lag while the pane is hidden — verify with DOM checks or show the pane first.

### 2026-10-26 — Custom page: real reference-photo upload (Claude)
**Request:** the custom-design form only had a line "Have a reference photo? Reply to our email…". Owner wanted a
premium picker: tap → phone gallery, laptop → file/folder dialog.

**What changed**
- New `src/components/reference-photos.tsx` on the custom form (replaces that line): gold dashed drop-zone
  ("Add reference photos", "Tap to choose from your gallery" on phones / "Click to browse — or drag & drop" on
  desktop, "Choose photos"), then 3-up thumbnails with number badge, × remove and an "Add more" tile, "2 of 3
  photos added". `accept="image/*"` without `capture` → phones offer Photo Library / Camera / Files.
  Up to **3** photos. The browser re-encodes each to JPEG ≤ 1600 px (fixes EXIF rotation, strips location
  metadata; e.g. 956 KB → 148 KB, 1.7 MB PNG → 259 KB) and puts them in a hidden `<input name="photos">` via
  `DataTransfer`; re-synced after React resets the form, so photos survive a validation error.
  WhatsApp link kept as "Prefer WhatsApp? Send photos there instead" (only when a number is set).
- `sendCustomRequest` (`app/(store)/inbound-actions.ts`): after field validation — max 3 files, ≤ 3 MB each,
  type from magic bytes (`sniffImage`); saved with `saveUpload(…, "references")` as
  `ref-<random>-<ts>.<ext>`; URLs appended to the saved message under "Reference photos:" (also in the
  owner's email). **No DB schema change.**
- `lib/uploads.ts`: `UploadFolder` ("products" | "references") for Vercel Blob path / disk dir / Netlify key
  (product keys unchanged); shared `uploadResponse()`; new route `/uploads/references/[file]`.
- `lib/custom-request.ts`: limits + `splitReferencePhotos()` — only our own `/uploads/references/…` or
  `*.public.blob.vercel-storage.com/references/…` URLs count. Admin → **Messages** shows them as clickable
  thumbnails.
- `next.config.ts`: `experimental.serverActions.bodySizeLimit = "4mb"` (default 1 MB; Vercel max 4.5 MB).

**Tested (local):** picker → 2 photos shrunk + previews + hidden field; server rejects 4 files (1.8 MB body
accepted → new limit works), a fake .jpg (HTML bytes) and a 3.2 MB file, each with the form values and photos
kept; nothing saved on those (0 DB rows, no files). Save/serve path via a tsx script: saved to
`uploads/references`, GET 200 image/jpeg, bad name 404, parser accepts own/Blob URLs and ignores others; test
file removed. Mobile 375px no overflow. tsc + eslint clean.
**Not tested end-to-end:** a successful submit — local SMTP is configured, so it would email the store inbox.
Owner should send one real request on the live site (with a photo) and check Admin → Messages.
- **Owner confirmed (2026-10-27):** "Maine live par photo ke saath custom request bheji, Admin Messages mein photo
  dikh rahi hai." → full live flow works (picker → upload to Vercel Blob `references/` → Admin → Messages
  thumbnails). The owner's test request can be marked handled / ignored.

### 2026-10-27 — Premium sign-in / sign-up cards with live validation (Claude)
**Request:** login/register looked plain and gave weak feedback; owner wanted regex validation, a "zig-zag"
shake on wrong entries, red fields on errors, green on correct input, and a more premium look.

**What changed**
- `src/lib/auth-rules.ts` (new, dependency-free, used by browser **and** server): `EMAIL_RE`, `NAME_RE`
  (letters in any script incl. Urdu + space . ' -), `emailError`, `nameError`, `newPasswordError`,
  `passwordRules` (8+ chars, a letter, a number) and `passwordStrength` (0–4). `MIN_PASSWORD` now lives here
  (`lib/password.ts` re-exports it).
- `src/components/auth/auth-field.tsx` (new kit): `AuthField` (icon input — mail / user / lock — gold focus
  ring; **green border + ✓** when valid, **red border + ⓘ + message** when invalid; show/hide password),
  `PasswordStrength` (4-bar meter Weak/Fair/Good/Strong + live checklist), `AuthAlert`, `AuthSubmit`
  (maroon gradient pill, gold sheen on hover, spinner while pending), `SecureNote`, `useShake`, and
  `useAuthForm` (values, touched, client check on submit → shake + focus first bad field; server
  `fields` → those inputs turn red until edited; optional clear-on-error). Forms keep `action={formAction}`
  as the no-JS fallback; with JS, `onSubmit` validates and dispatches in a transition (no React form reset).
- `globals.css`: `--color-ok` (#2f7d5c / dark #6cc59a) and `--color-bad` (#b3261e / dark #f08a80) tokens,
  `.animate-shake` ("no" shake) and `.animate-auth-in` (card rise-in on `AuthShell`), both off for reduced motion.
- Rewritten on the kit: `login-form.tsx` (Forgot password? in the label row, "New to ZARIERA?" divider +
  outlined "Create an account"), `register-form.tsx` (name/email/password + strength meter),
  `password-reset-forms.tsx` (forgot + reset; "Check your inbox" success card). Toasts for these errors were
  dropped (the in-card alert + red fields + shake replace them). Admin login untouched (still `PasswordInput`).
- `auth-actions.ts`: `AuthState.fields`; register/login/forgot/reset use the shared rules (zod removed there).
  Login failure → "Incorrect email or password. Please try again." with **both** fields red (never says which);
  duplicate email on register → email red. **New accounts / password resets now need a letter and a number**
  (existing passwords still sign in). Checkout's optional account creation still only checks 8+ chars.

**Tested (local):** empty sign-in → both red + messages + shake + focus; `ahmad@gmail` → red on blur, `.com`
→ green ✓; wrong credentials (non-existent email) → alert, both red, password cleared, shake; correct
credentials of a temporary local test customer → redirected to `/account` ("Hello, QA"), signed out, test
customer deleted (local DB back to 7 customers); register: "Ahmad123" → letters-only error, password meter
Weak → Strong with checklist, duplicate email → only email red (no OTP email sent); forgot: invalid email →
error, unknown email → "Check your inbox" (no mail sent). Mobile 375px + dark mode. tsc + eslint clean.

### 2026-10-27 — Autofill colour fix + gem "Show / Hide" password toggle (Claude)
- **Bug (owner screenshot, live register page, dark mode):** fields filled by Chrome's autofill turned
  slate/sky-blue. Cause: the browser's `:-webkit-autofill` background. **Fix (site-wide, `globals.css`):**
  `input/textarea/select:-webkit-autofill` (+ `:hover`, `:focus`) and `input:autofill` get a
  `0 0 0 1000px var(--color-surface) inset` shadow + `-webkit-text-fill-color: var(--color-ink)`, so autofilled
  fields keep the theme colours in light and dark mode (checkout, contact, admin forms too). Verified the rules
  load; real autofill can't be triggered by automation — owner to confirm in Chrome.
- **Owner wanted something other than the usual eye icon.** New `RevealToggle` (`components/auth/password-input.tsx`):
  a small pill — hidden: gold outline, gem outline + "SHOW"; revealed: gold gradient fill, filled gem with
  sparkles (spins in) + "HIDE"; `aria-pressed` + label. Used by `AuthField` (sign-in / sign-up / reset) and
  `PasswordInput` (admin sign-in; input padding widened to `pr-24`).
- Tested: register + admin login, both states, light + dark; tsc + eslint clean.

### 2026-10-27 — Premium look for regular (non-sale) product cards (Claude)
- **Owner:** sale cards look fine, but regular cards look plain, with empty space between the name and the
  price. **Change (`components/product-card.tsx`, used on home, shop, carousel and related products):**
  - Every card shows the **material** under the name (small gold gem icon, one line), and a thin gold **ornament
    divider** (line, diamond, line) above the price. The fixed 2-line name height was dropped; the price block stays pinned to the bottom.
  - **Regular cards only:** the photo gets a hairline gold "display-case" frame with diamond corners, which tightens
    on hover. The body has a soft surface-to-cream gradient. The price is `text-lg` semibold, and under it is an
    availability line that mirrors the sale card's "Save Rs …" line: "In stock · Won't tarnish" (the second part is
    hidden on phones so it stays on one line), "Only N left" in red with a pulsing dot when stock ≤ 5
    (`LOW_STOCK`), or "Out of stock".
  - Sale cards are unchanged apart from the shared material line and divider.
- Tested: desktop 4-col + mobile 2-col, light + dark; the availability line stays on one line at 375px; tsc + eslint clean.

### 2026-10-27 — Smart search: typo-tolerant engine, instant suggestions, new /search page (Claude)
- **Owner screenshot:** live `/search?q=necklecs` showed "0 results" with a plain box. Searching "rings" found
  nothing either. Cause: the old search was a Prisma `contains` on the name and description, so "rings" never matched "… Ring",
  typos failed, and category, material, Urdu words and price phrases were ignored.
- **New `lib/search-engine.ts` (pure, in-memory ranking):**
  - Folds accents (Trèfle → trefle), singularises (rings → ring), and drops stop words.
  - Corrects typos with Damerau-Levenshtein distance (1 edit for 3–6 letters, 2 edits for 7+), towards words in names,
    categories and materials. Typo fixes are returned as `corrections` for "Showing results for …".
  - Maps Urdu and everyday words (`ALIASES`: angoothi/challa → ring, haar/pendant/locket → necklace,
    jhumka/bali/tops → earring, kangan/kara/churi → bangle, sona → gold …). `CATEGORY_HINTS` maps bangle → Bracelets.
  - Reads price phrases ("under 3000", "below 3k", "2000-3000", "above 2500", "3000 tak / se kam") and sale words
    (sale, discount, offer, deal).
  - Weights fields: name 5, category 6, material 3, description and specs 1. A category word gives every piece in that
    category a score, and pieces whose name also says it rank first ("bangles" lists the Bangles before the chain bracelets).
  - Results must match every word. If nothing does, it falls back to the closest pieces (`partial`). Ties go to
    in-stock pieces first, then featured.
- **`catalog.ts`:** the shop's `?q=` filter (`getProducts`, including the sample-data fallback) now uses the engine through
  `applyQuery`; the Prisma `contains` OR was removed. New `searchStore(q)` returns the ranked result, all categories with live
  counts (so empty ones can say "coming soon") and the full product list.
- **New `GET /api/search?q=`:** returns the top 6 pieces (photo, price, % off, sold out), total, category and correction.
- **New `components/search/search-box.tsx`:**
  - Pill input with a rotating "Try 'rings' / 'under 3000' …" placeholder, a spinner, a clear button and a gold submit.
  - A 180ms debounced suggestion panel shows "Showing results for", "All Rings · 7 pieces →" (or "Necklaces are coming soon"
    linking to the notify page), product rows and "See all N results".
  - ↑/↓/Enter/Esc work and the highlighted row scrolls into view. Browser autocomplete is off; without JS it is a plain GET form.
- **`/search` page redesigned:**
  - The hero has the box plus "Popular" chips (categories with counts, On sale, and "Under Rs X", which is the cheapest price
    + 600 rounded to 500).
  - The results header shows the count, the correction, and tags for the category, sale and price range, plus "Shop all {category} →".
  - With no results there is a premium card ("Our necklaces are coming soon" with a notify button, or "Nothing matches"
    with search tips) and a custom-design link.
  - "You may love" / "Trending now" picks (featured, in stock) appear when nothing matched or nothing was typed.
  - The hero has no `overflow-hidden` and is `z-30`, so the suggestion panel hangs over the sale ribbons.
- Tested on the local data:
  - necklecs → Necklaces coming soon, rngs/rings/angoothi → 7 rings, braclet/kangan/bangles → 8 bracelets with bangles first.
  - butterfy → 1, "rings under 2300" → 5, "ring on sale" → 3, "2000-3000 bracelet" → 3, xyzabc → no-results card.
  - Keyboard nav works, mobile 375px has no horizontal overflow, light and dark checked; tsc and eslint are clean.
- If the catalog grows past a few thousand pieces, move the ranking to Postgres (`pg_trgm`) instead of loading every product.

### 2026-10-28 — One admin session per account, sign-in required to order, speed fixes (Claude)
**1. Admin: a new sign-in signs out the older one** (owner: when the admin is signed in somewhere and someone
signs in elsewhere, the first one must be logged out; the old flow was confusing, and a sign-in while the DB was down
still worked).
- **How it works (no schema change / no Neon migration):** a successful sign-in stamps the account's
  `User.updatedAt` (`verifyCredentials`), and the cookie carries that stamp as `ver` (`AdminSession.ver`).
  `checkAdmin()` (`lib/admin.ts`) accepts a cookie only if `ver` equals the row's current `updatedAt`. Otherwise it
  returns `reason: "replaced"`.
- **Rule: one live session per admin account.** Two different admin accounts can still work at the same time.
  Anything that rewrites the admin row (`db:create-admin`, a password change) also signs out other devices. The
  password change re-issues the caller's own cookie (`refreshAdminSession`).
- **How the old device leaves:**
  - Every admin page now calls `requireAdmin()` itself. Before, only the dashboard layout did, and layouts don't re-run
    on client-side navigation.
  - The order-bell poll (`/api/admin/orders/latest`, every 10s) gets `401 {reason}` and sends the tab to
    `/admin/login?signed_out=replaced`, which shows "You were signed out because this admin account was signed in on
    another device".
- **Fails closed:** if the DB can't be reached, the session is rejected (`signed_out=db`), and the login form says "Can't
  reach the database right now".
- **Old cookies:** cookies made before this change have no `ver`, so every admin signs in once more after the deploy.
- `settings/actions.ts`: the `requireOwner()` try/catch blocks now `unstable_rethrow(e)`, so a sign-out redirect isn't
  turned into an error string.
- Tested locally (minted sessions against the local DB only): device A gets 200, device B signs in, then A's API call
  gets 401 replaced and A's page gets a 307 to the login notice. An open dashboard redirected itself within 10s.

**2. Orders need a signed-in customer.**
- `/checkout` calls `requireCustomer()` and sends guests to `/login?next=/checkout?buy=…&qty=…`. The login and register
  cards show "sign in / create a free account to place your order — your cart is saved" (the cart is in localStorage).
- `POST /api/orders` returns 401 `{signIn: true}` with no session, or for a deleted account. The order email is forced to the
  account email (the field is read-only on the form).
- The guest "Create an account for faster checkout" box and `maybeCreateGuestAccount` were removed, and so was the
  `?account=1` success notice. The success page now always links to "View my orders".
- The checkout page loads the product, phone and settings in parallel, after the sign-in check.

**3. Speed** (owner: "website bahut slow hai, users chale jaate hain"). Live before: `/shop` 8.5s, product 6.5s,
`/search` 4.3s to first byte.
- **Root cause:** Vercel ran the functions in `iad1` (Washington, `x-vercel-id: sin1::iad1`) while Neon is in
  `ap-southeast-1` (Singapore). Every query crossed the globe (~250ms), and pages made several queries in a row.
  - **Fix:** a new `vercel.json` with `"regions": ["sin1"]`, so functions run next to the DB (also closer to Pakistan).
- **Catalog cache (`lib/catalog.ts` rewritten, ~100 lines shorter):**
  - The whole active catalog (products + categories) is one `unstable_cache` snapshot, tag `catalog` (`lib/cache-tags.ts`),
    with a 5-minute safety revalidate. `getProducts`, `getProductBySlug`, facets, related, featured and `searchStore` all
    work in memory from it.
  - The Prisma `contains` query and the duplicate `filterSample` were removed; the sample data is now only the no-DB fallback.
  - `getFeaturedProducts` falls back to the newest real pieces, not the sample ones.
- **Refreshed immediately (`refreshCatalog()` → `revalidateTag("catalog", { expire: 0 })`)** by product
  create/update/delete, category create/delete, `createOrder` (stock), and `cancelOrderAndRestock`.
- **Settings:** `getStoreSettings` is cached across requests (tag `store-settings`, 10 min) and refreshed by
  `saveStoreSettings`. Every store page read it in the layout, which was one DB round-trip per page.
- **Product pages are ISR** (`revalidate = 300`, `generateStaticParams() → []`), so each is cached on its first visit
  and purged by the catalog tag / `revalidatePath("/", "layout")`.
- **Images:** the hero and promo slides moved from JPG to WebP (promo resized to 1200px wide). 4.4 MB became 1.9 MB:
  `girl-2` 583K→146K, `promo-04` 525K→288K. The first hero photo is preloaded with high priority (`react-dom` `preload`).
  The unused `promo-bangles.jpg` was deleted.
- **Local `next start` after the change:** `/shop` 0.27s cold / 0.07s warm, product 0.09s / 0.006s, search 0.03s.
  `next build` passes; tsc and eslint are clean.
- **Owner to-do:** if the Vercel project settings pin a different Function Region, set it to Singapore (sin1) there too.

### 2026-10-28 — Auth-page flash, Show/Hide alignment, strict email rules, photo-less product, shop spacing (Claude)
- **Flash before the sign-in page (owner report).** Clicking the account icon (or Checkout) while signed out
  rendered `/account` first, so the header and footer showed around an empty page for ~200ms. Only then did the
  server-side `requireCustomer` redirect to `/login`.
  - **Fix: new `src/proxy.ts` (Next 16's renamed middleware).** It redirects before anything renders when the cookie
    is missing: `/account/*` and `/checkout` without `zariera_customer` go to `/login?next=…`, and `/admin/*` (except
    `/admin/login`) without `zariera_admin` goes to `/admin/login`.
  - The matcher uses `missing: [{type:"cookie"}]`. Values must be literals, because Next reads the config statically.
    The pages still verify the session itself, so a stale cookie gets the in-page redirect with no loop.
  - Verified with a DOM mutation log: the click now goes from the shop straight to the sign-in card in one commit.
- **Show/Hide gem pill (`RevealToggle`).** The label had a fixed `w-7`, but "SHOW" is wider, so it was clipped at the
  right edge and off-centre.
  - Now both words share one CSS grid cell (the pill is always as wide as the longer word and doesn't jump), with
    `leading-none`, `justify-center` and the trailing letter-spacing trimmed.
  - Measured: the gem has 10.8px on the left and the text ~10.8px on the right, vertically centred, in both states.
- **Email format (`lib/auth-rules.ts`).** The owner said the green tick appeared for bad addresses.
  - `EMAIL_RE` now rejects leading, trailing and doubled dots and labels that start or end with "-".
  - The ending must be a 2-letter country code or a known generic TLD (`GENERIC_TLDS`).
  - `emailSuggestion()` catches provider typos (gmial / gmai / gamil / yahooo / hotmial / outlok → "Did you mean …?") and
    wrong endings on known providers (gmail.co / .con / .comm / .cm). Real mailbox domains like mail.com and email.com
    are left alone, and company domains such as `mail.pk` are not "corrected".
  - Errors are specific: missing @, two @, spaces, nothing before or after the @, no ending, fake ending.
  - Used by sign-in, sign-up, forgot password, contact, custom design and newsletter (`inbound-actions.ts`).
  - All 31 existing customer, admin and order emails in the DB still pass. Browser check: `ahmad@gmail.co` gets no tick
    and shows "Did you mean ahmad@gmail.com?" on blur; `…gmail.com` gets the green tick.
- **Product without a photo.** Live has a 16th product, "Wilma Forbes" (`/product/wilma-forbes`, Bracelets), saved in
  the admin with **no images**. The upload flow itself works.
  - The admin product actions now refuse an **active** product with no photo ("Add at least one photo — or untick
    'Active' to save it as a hidden draft"). Tested locally: the form showed the error and nothing was saved.
  - `ProductImage`'s placeholder now reads "Photo coming soon" (container query: shown only when the tile is big enough).
  - **Owner to-do:** add a photo to Wilma Forbes in the live admin, or delete it if it was a test.
- **Collection page spacing.** Beside the 250px sidebar the shop squeezed 4 cards into ~820px (~190px each), so names,
  prices and the stock line wrapped and looked broken.
  - `ProductGrid` gets `layout="sidebar"`: 2 across on phones and 3 from `md` up (~300px cards at 1366px).
  - Gaps are now `gap-x-3 gap-y-6`, and `sm:gap-x-5 sm:gap-y-8` from `sm` up. The shop container is `max-w-7xl`, and card
    padding is `p-3 sm:p-4`. Home and search keep 4 across.
- **Test pass:** tsc and eslint are clean and `next build` passes (proxy registered). Every store route returns
  200/307/404 as expected; the stale-cookie path has no loop; phone 375px has no horizontal scroll.

### 2026-10-29 — DRY pass: shared helpers instead of copy-pasted code (Claude)
Owner asked to stop writing the same code in many places. No behaviour or look changes; 31 files, ~110 lines net removed.
- **`formatDate()`** (`lib/format.ts`, options `year` / `time`) replaces 4 local `fmtDate`s + inline copies (admin
  dashboard, customers, messages, orders table, insights, sales chart, account orders). The invoice (long month) is left as is.
- **`PAYMENT_METHOD_LABEL`** (`lib/order-status.ts`) replaces the copies in the invoice and order lookup.
- **`toCartLine(product)`** (new `lib/cart.ts`, plain module so server pages can call it) replaces the product → cart-item
  mapping copied in the product page, checkout "Buy it now" and quick-add.
- **`useIsAuthScreen()`** (`conditional-header.tsx`): one list of auth screens for both header and footer.
- **`refreshStorefront()`** (`lib/cache-tags.ts` = `refreshCatalog()` + `revalidatePath("/", "layout")`) replaces the 5
  copies in product/category actions. The extra `revalidatePath("/admin/…")` / `("/shop")` calls were dropped (the
  layout-level call already covers every route).
- **`dbErrorKind()`** gained an `"in-use"` kind (P2003 foreign key). Product, category and team-member actions now use it
  instead of their own Prisma-code regexes.
- **Auth forms:** `useAuthForm` has `f.bind(name)` → `{value, onChange, onBlur}`; 7 fields no longer repeat those 3 props.
- **Shared icons** (`components/icons.tsx`): `InstagramIcon` (home + footer), admin `TagIcon` (dashboard + nav).
- **Dead code removed:** the unused `shippingFor` / `FREE_SHIPPING_TEXT` in `lib/shipping.ts` (live rules are in
  `settings-shared.ts`) and the unused `freeShippingText`.
- **Left on purpose:** the per-form Tailwind class strings (they differ slightly, so merging them would change the look),
  and the `try { … } catch { dbConnected: false }` shape in `admin-data.ts` (each getter has its own fallback).
- **Tested:** tsc + eslint clean, `next build` passes. With `next start`, every store route returns 200/307 as expected, and the
  header is hidden on `/login`. All 12 admin pages + order detail + invoice return 200 (session minted locally from the
  admin's current `ver`, so no device was signed out). Dates and payment labels render as before.
- Not committed / pushed yet (a push goes live).
