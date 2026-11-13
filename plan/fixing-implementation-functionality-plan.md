# MezFlow — Functional SaaS MVP Fixing & Implementation Plan

- **Target Path:** `plan/fixing-implementation-functionality-plan.md`
- **Project:** MezFlow — Real-Time Restaurant Dining and Kitchen Operations Management System
- **Goal:** Upgrade MezFlow from a single-restaurant demo into a genuine, multi-tenant, real-time SaaS MVP verified **100% locally** before committing to GitHub and deploying under Khizar's own cloud accounts.

---

## 1. Audited Gaps (Why It Currently Feels Like a Demo)

| Area | Current State in Code | Target SaaS Behavior |
| :--- | :--- | :--- |
| **Real-Time Sync on Cloud** | `useTableSession.ts`, `useKDSSocket.ts`, and `useMenuRealtime.ts` hardcode `:8000` WebSockets (`wss://.../ws/...`) with **no HTTP polling fallback**. Fails silently on Vercel serverless. | Full WebSocket sync when connected to dedicated FastAPI host + automatic **3-second REST polling fallback** so multi-phone carts & KDS update live everywhere. |
| **Auth, OTP & Multi-Tenancy** | `OTPService` uses in-memory dict + `print()`; `/login` shows demo quick-login pills for one seeded restaurant (`MezFlow Bistro`) with no restaurant registration. | Real Google OAuth, real Email OTP verification, and isolated multi-restaurant workspaces powered by **Clerk + Clerk Organizations**, synced to PostgreSQL. |
| **5 Role Portals** | Only 3 portals exist (`/r/...`, `/kds`, `/admin`). `handleRoleRedirect` sends `service_staff` and `cashier` to `/r/demo-bistro/t/table-4`. No Staff creation UI in `/admin`. | All 5 roles active with dedicated UIs: Customer PWA, Kitchen KDS (`/kds`), Waiter View (`/waiter`), Cashier View (`/cashier`), and Manager Console (`/admin`). |
| **Admin Menu Management** | `/admin` only toggles dish `is_available` (86'ing). Backend CRUD (`POST`/`PATCH`/`DELETE` categories & dishes) has no frontend UI. | Full Menu Builder UI in `/admin` to create categories, add dishes (English + Urdu names, prices, stations, modifiers, images), edit, and delete. |
| **Urdu Switch (`اردو`)** | Only translates the Customer Menu & Cart Drawer. Landing Page (`page.tsx` declares unused `isUrdu`), Login, KDS, and Admin stay English. | Complete platform-wide English / Urdu translation dictionary (`frontend/src/lib/i18n.ts`) with clean RTL layout across every screen. |
| **Backend Hosting** | Production API runs on a team member's Vercel account (`mezflow.vercel.app`), blocking independent updates and persistent WebSockets. | FastAPI + PostgreSQL + Redis deployed under Khizar's own account (Render / Railway for native WebSockets + managed DB, or own Vercel + Neon). |

---

## 2. Implementation Phases (Local First)

### Phase 1 — Live Real-Time Sync & Serverless Fallback
**Files to Modify:**
- `frontend/src/hooks/useTableSession.ts`
- `frontend/src/hooks/useKDSSocket.ts`
- `frontend/src/hooks/useMenuRealtime.ts`

**Tasks:**
1. Update `wsBase` resolution in all 3 socket hooks so it does not blindly append `:8000` on HTTPS production origins; prioritize `NEXT_PUBLIC_WS_URL` or derive clean `ws://` / `wss://` host.
2. Add a resilient **REST Polling Fallback**:
   - Track `isConnected` state on the WebSocket.
   - Whenever `isConnected === false` (e.g., Vercel serverless 404 or dropped Wi-Fi), start a lightweight `setInterval` every **3000ms** calling `fetchCart()`, `fetchActiveOrders()`, or `fetchMenu()`.
   - Automatically clear the polling interval the moment the WebSocket reconnects.
3. **Local Verification:** Simulate a closed WebSocket and verify two side-by-side browser windows at Table 4 still sync cart items and KDS receives submitted orders automatically within 3 seconds.

---

### Phase 2 — Clerk Authentication, Multi-Tenant Organizations & Database Sync
**Dependencies:**
- Frontend: `npm install @clerk/nextjs` inside `frontend/`
- Backend: `PyJWT[crypto]` + `httpx` in `backend/requirements.txt`

**Database Schema & Migration (`005_clerk_multitenancy`):**
- Add `clerk_user_id` (`String(128)`, unique, nullable, indexed) to `users` (`backend/app/models/user.py`).
- Add `clerk_org_id` (`String(128)`, unique, nullable, indexed) to `restaurants` (`backend/app/models/restaurant.py`).
- Make `hashed_password` nullable on `users` for OAuth/Clerk-managed accounts.

**Backend Auth Upgrade:**
1. Update `backend/app/core/config.py` to accept optional `CLERK_JWKS_URL`, `CLERK_ISSUER`, and `CLERK_SECRET_KEY`.
2. Update `get_current_user()` in `backend/app/api/deps.py`:
   - First check if incoming Bearer token is a Clerk RS256 JWT (fetch & cache JWKS keys from `CLERK_JWKS_URL` using `PyJWT` `PyJWKClient`).
   - Extract `sub` (`clerk_user_id`), `org_id` (`clerk_org_id`), `org_role` (map `org:manager` ➔ `MANAGER`, `org:kitchen_staff` ➔ `KITCHEN_STAFF`, `org:service_staff` ➔ `SERVICE_STAFF`, `org:cashier` ➔ `CASHIER`), and email/name claims.
   - Auto-provision/sync the `Restaurant` (creating 10 starter tables + sample categories if brand-new `clerk_org_id`) and `User` row in PostgreSQL if not yet present.
   - Keep existing `HS256` local JWT verification as fallback (used when `ENVIRONMENT=test` so the **40/40 pytest suite remains 100% passing**).
3. Add `POST /api/v1/auth/onboarding` endpoint to let a newly signed-up Manager customize their restaurant name, currency (`PKR`/`USD`), and address on first login.

**Frontend Clerk Integration:**
1. Wrap `frontend/src/app/layout.tsx` in `<ClerkProvider>`.
2. Replace demo login/OTP tabs in `frontend/src/app/login/page.tsx` with Clerk's `<SignIn />` and add `/signup` (`<SignUp />`) + `/onboarding` (`<CreateOrganization />` + restaurant setup form).
3. Update `frontend/src/lib/api.ts` so authenticated requests retrieve a fresh token via Clerk (`window.Clerk?.session?.getToken()`), while anonymous diners on `/r/[restaurantId]/t/[tableId]` continue using `X-Diner-ID` with **zero login friction**.
4. Update role routing after sign-in:
   - `manager` ➔ `/admin`
   - `kitchen_staff` ➔ `/kds`
   - `service_staff` ➔ `/waiter`
   - `cashier` ➔ `/cashier`
   - `customer` ➔ `/r/...`

---

### Phase 3 — Complete All 5 Role Portals & Full Admin CRUD
**Backend Additions (`backend/app/api/v1/endpoints/`):**
1. **Table Cleanup & Waiter Endpoints (`tables.py` & `kds.py`):**
   - `PATCH /api/v1/tables/{table_id}/status`: Role-restricted (`service_staff`, `manager`) transition enforcing `AWAITING_CLEANUP ➔ AVAILABLE` (and floor tracking).
   - Allow `service_staff` to view `READY` orders and bump `READY ➔ DISPATCHED` ("Delivered to Table").
2. **Cashier Billing & Payment Flow (`orders.py` / `sessions.py`):**
   - `GET /api/v1/sessions/unpaid`: Lists active/occupied tables with server-calculated bill summaries.
   - `POST /api/v1/sessions/{session_id}/pay`: Role-restricted (`cashier`, `manager`) payment recording (`cash` / `card`), closes digital table session, sets table status to `AWAITING_CLEANUP`, writes immutable `AuditLog`, and broadcasts table update.

**Frontend New Portals & Upgrades:**
1. **Waiter Portal (`frontend/src/app/(waiter)/waiter/page.tsx`):**
   - Real-time "Ready for Pickup" tray alerts (one-tap **"Mark Delivered"**).
   - Live Floor Status cards highlighting `AWAITING_CLEANUP` tables in amber/red with one-tap **"Confirm Table Cleaned"** button.
2. **Cashier Portal (`frontend/src/app/(cashier)/cashier/page.tsx`):**
   - Live active table tabs showing itemized orders, modifiers, subtotal, tax, and grand total.
   - Payment modal (`Cash` / `Card`) that closes the session and triggers `AWAITING_CLEANUP` on `/waiter` & `/admin`.
3. **Full Menu Builder CRUD (`frontend/src/app/(admin)/admin/page.tsx`):**
   - Add **"New Category"** modal (`POST /api/v1/restaurants/{id}/categories`).
   - Add **"Add / Edit Dish"** modal (`POST`/`PATCH /api/v1/menu/items...`) supporting English + Urdu names, descriptions, price, prep time, kitchen station (`grill`, `fry`, `hot_kitchen`, `beverage`, `dessert`), image URL, and modifier groups.
   - Add **"Delete Dish"** confirmation (`DELETE /api/v1/menu/items/{id}`).
4. **Staff & Organization Management (`frontend/src/app/(admin)/admin/staff/page.tsx`):**
   - Embed Clerk `<OrganizationProfile />` (or custom invite + role manager) so Managers can invite Chefs, Waiters, and Cashiers directly to their own restaurant with zero leakage to other restaurants.

---

### Phase 4 — Complete Global English / Urdu (`i18n`) Support
**Files to Create / Update:**
- Create `frontend/src/lib/i18n.ts` with typed `en` and `ur` dictionaries covering:
  - Navbar & Footer
  - 5-Section Landing Page (`frontend/src/app/page.tsx`)
  - Auth / Onboarding headers
  - KDS labels (`All Stations`, `Grill`, `Start Prep`, `Mark Ready`, `Recall`)
  - Admin, Waiter, & Cashier portals
- Connect every component cleanly to `const { language } = useAuthStore()` so toggling `اردو (Urdu)` switches text content + `dir="rtl"` seamlessly across the entire platform.

---

### Phase 5 — Local Testing, GitHub Push & New Cloud Deployment
1. **Automated Tests:** Run full backend `pytest` suite (`>= 45` tests including Clerk auth fallback, payment/cleanup lifecycle, and multi-tenant isolation) and `npm run build` with 0 errors.
2. **Manual End-to-End Local Walkthrough:**
   - Sign up as a new restaurant Manager via Clerk (Google/Email OTP) ➔ Onboard restaurant ➔ Add a custom Urdu/English dish ➔ Generate Table 1 QR.
   - Open two Customer browser tabs on Table 1 ➔ Add items from both tabs ➔ Confirm live cart sync ➔ Fire order.
   - Verify ticket appears live on `/kds` ➔ Bump `PREPARING` ➔ `READY`.
   - Verify delivery alert appears live on `/waiter` ➔ Mark `DISPATCHED`.
   - Open `/cashier` ➔ Record Cash payment ➔ Confirm table moves to `AWAITING_CLEANUP` on `/waiter` & `/admin` ➔ Confirm clean ➔ Table returns to `AVAILABLE`.
3. **Cloud Migration (Under Khizar's Accounts):**
   - Deploy FastAPI backend + PostgreSQL + Redis on **Render** or **Railway** (supports native WebSockets + persistent DB).
   - Set environment variables on Khizar's Vercel project (`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`).
   - Push verified commits to GitHub `main` and confirm green CI + live production test.

---

## 3. Immediate Next Step (When Ready to Build)
Execute **Phase 1 (Live Polling Fallback)** and **Phase 2 (Clerk Auth + Multi-Tenant DB Migration)** locally first so you can test the upgraded auth and live table/kitchen sync on `http://localhost:3001`.

