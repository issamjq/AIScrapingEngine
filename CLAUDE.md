# CLAUDE.md — AI Scraping Engine Project Guide

> **This file is read automatically at the start of every Claude Code session.**
> Update it on every `git push` so the next session starts instantly with full context.

---

## Project Overview

A full-stack AI-powered price scraping and market discovery platform for UAE e-commerce retailers (Amazon AE, Noon, Carrefour, Talabat, Spinneys). It tracks product prices across retailers, uses Claude Vision AI to extract prices from screenshots, and uses Claude web search to auto-discover product listing URLs.

**Current version:** v1.0.55

---

## B2B vs B2C — Role Architecture

The project is fully role-aware. Every page component receives a `role` prop (`"b2b"`, `"b2c"`, `"dev"`). All future changes must be scoped: B2B-only in `{role !== "b2c" && ...}`, B2C-only in `{role === "b2c" && ...}`.

### Role rules
| Feature | B2B | B2C | Dev |
|---|---|---|---|
| Dashboard | ✅ | ✅ | ✅ |
| Market Discovery | ✅ (see below) | ✅ (see below) | ✅ |
| Price Activity | ✅ | ✅ | ✅ |
| Products | ✅ | ❌ hidden + guarded | ✅ |
| Stores | ✅ | ❌ hidden + guarded | ✅ |
| Credits | deducted | deducted | bypassed (unlimited) |

### Dev account
- `karaaliissa@gmail.com` → `role = "dev"`, `subscription = "paid"`, unlimited credits
- Dev bypasses all credit deductions (backend `UNLIMITED_ROLES = ["dev", "owner"]`)
- Dev sees all pages

---

## Market Discovery — B2B vs B2C Vision (NOT YET BUILT — COMING NEXT)

This is the next major area of work. The discovery experience will be completely different per role.

### B2C Discovery (like Google/ChatGPT)
- User types a natural language query: e.g. "Infiniti G37 S Coupe 2010 — best 5 prices with best conditions"
- AI searches the web (Claude web_search tool) and returns the **best prices from best sources**
- No catalog required — purely AI-driven price hunting
- Results shown as: product name, price, source, condition, link
- Each search costs 1 credit
- No URL tracking, no catalog matching — just AI answers

### B2B Discovery (catalog-based + AI web search)
- **Mode 1 — Catalog-based:** User picks from their own stores + products (already uploaded). AI finds the product URL on those specific stores.
- **Mode 2 — AI web search:** Same as B2C, but user can also match results back to their catalog and track URLs.
- User chooses which mode per search
- Each search costs 1 credit regardless of mode

### Credit cost per capability (planned, user chooses at discovery time)
- AI web search: 1 credit
- Auto-match to catalog: +1 credit (optional, B2B only)
- Vision price extraction: +1 credit (optional)
- User sees the credit cost before confirming the search

### What NOT to do
- Do NOT put capability toggles in Settings — they will be inline options in the Discovery page itself
- Capabilities tab has been removed from Settings for this reason

---

## Architecture

```
/                        ← Frontend (Vite + React + TypeScript + Tailwind + shadcn/ui)
/backend/                ← Backend (Node.js + Express + TypeScript)
/backend/src/scraper/    ← Playwright scraping engine + AI extraction
/backend/src/services/   ← Business logic (discovery, sync, products, companies)
/backend/src/routes/     ← Express API routes
/backend/src/db/         ← Neon PostgreSQL via pg (not Prisma — raw SQL)
/backend/sql/schema.sql  ← DB schema (must be run manually in Neon SQL editor)
/scripts/bump-version.mjs ← Version bump script (run before every push)
```

---

## Deployments

| Layer    | Platform | URL |
|----------|----------|-----|
| Frontend | Vercel   | (auto-deploys on push to main) |
| Backend  | Render   | https://aiscrapingengine.onrender.com |
| Database | Neon     | PostgreSQL (pooled connection via DATABASE_URL) |
| Auth     | Firebase | Google Sign-In, Gmail-only (@gmail.com) |

**Frontend `.env.local`:**
```
VITE_API_URL=https://aiscrapingengine.onrender.com
VITE_FIREBASE_* = (Firebase web app config)
```

**Backend env vars (set in Render dashboard):**
```
DATABASE_URL          ← Neon pooled connection string
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
ANTHROPIC_API_KEY     ← Required for Claude Vision + AI web search
FRONTEND_URL          ← Vercel URL (for CORS)
PORT=8080
```

---

## Key Rules — ALWAYS FOLLOW

1. **Before every `git push`:** run `node scripts/bump-version.mjs` and include the version bump in the commit. Never skip this.
2. **Never commit `.github/workflows/`** — the PAT token lacks `workflow` scope. The workflow file exists locally but must never be staged/pushed.
3. **DB is raw SQL** — no Prisma, no ORM. Use `query()` from `backend/src/db/index.ts`.
4. **Auth is Firebase** — backend verifies Firebase ID tokens via `requireAuth` middleware. Frontend gets token via `user.getIdToken()`.
5. **Role prop** — every page component receives `role?: string`. Use `role !== "b2c"` for B2B/dev, `role === "b2c"` for B2C-only.

---

## Backend Key Files

| File | Purpose |
|------|---------|
| `backend/src/index.ts` | Express app entry, all routes registered here |
| `backend/src/scraper/engine.ts` | `ScraperEngine` — Playwright browser, `scrape(url)` |
| `backend/src/scraper/aiScraper.ts` | Claude Vision (`extractWithVision`) for price extraction |
| `backend/src/scraper/aiWebSearch.ts` | Claude `web_search_20250305` tool — finds product URLs by query |
| `backend/src/scraper/priceParser.ts` | Parse price strings → numbers + currency |
| `backend/src/scraper/searchConfigs.ts` | Per-retailer Playwright search page configs |
| `backend/src/scraper/companyConfigs.ts` | Per-retailer scrape selectors |
| `backend/src/services/discoveryService.ts` | `discoverProducts()` — Playwright + Claude matching |
| `backend/src/services/scrapingService.ts` | Bulk scraping jobs |
| `backend/src/services/syncService.ts` | Price sync runs |
| `backend/src/services/companyService.ts` | All functions scoped by `userEmail`. `copyGlobalStoresToUser()` seeds 8 UAE stores on signup. |
| `backend/src/services/productService.ts` | All functions scoped by `userEmail`. bulkImport uses `(internal_sku, user_email)` unique index. |
| `backend/src/services/productCompanyUrlService.ts` | `getAll()` scoped by `user_email` via joined products table. |
| `backend/src/routes/discovery.ts` | `/api/discovery/search`, `/ai-search`, `/confirm`, `/probe` — rate-limited via `checkUsageLimit` |
| `backend/src/middleware/usageLimit.ts` | Deducts 1 credit from user wallet per search. dev/owner bypass. Returns 429 `USAGE_LIMIT_REACHED` if balance=0. |
| `backend/src/services/plansService.ts` | `getAllPlans()`, `getPlanByKey()` — reads from `plans` DB table. |
| `backend/src/services/walletService.ts` | `getWallet()`, `createWallet()`, `deductCredit()`, `addCredits()`, `getTransactions()`. |
| `backend/src/routes/plans.ts` | `GET /api/plans` — returns all active plans from DB. |
| `backend/src/routes/wallet.ts` | `GET /api/wallet` (balance + transactions), `POST /api/wallet/add` (manual top-up). |
| `backend/src/routes/allowedUsers.ts` | `GET /me`, `PUT /me` (update name/company_name), `DELETE /me` (delete account + all data), `POST /signup`, CRUD for management roles. `billing_renews_at` set on pro signup. |
| `backend/src/routes/export.ts` | `GET /api/export?format=json\|csv\|pdf` — downloads user data. B2C gets tracked_urls only; B2B gets products+stores+tracked_urls. Uses pdfkit for PDF. |
| `backend/tsconfig.json` | Must include `"lib": ["ES2020", "DOM"]` — DOM needed for Playwright page.evaluate() |

---

## Frontend Key Files

| File | Purpose |
|------|---------|
| `src/App.tsx` | State machine: loading → onboarding → ready → denied. Passes `role` prop to all page components. |
| `src/context/ThemeContext.tsx` | Theme provider (light/dark/system). Applies `.dark` class to `<html>`. Persists to localStorage. |
| `src/components/OnboardingContent.tsx` | Two-card B2B vs B2C picker shown to new users before dashboard access. POSTs to `/signup`. |
| `src/components/DashboardLayout.tsx` | Sidebar: Dashboard, AI (Market Discovery), Monitoring (Price Activity), Catalog (Products, Stores — B2B only). Social section removed. |
| `src/components/TopNavigation.tsx` | Top bar — sidebar trigger + title only. |
| `src/components/UserMenuButton.tsx` | Sidebar footer: avatar+initials, name, plan label, golden credit ring. Dropdown: Settings, Upgrade plan, Log out. Fetches live balance from `/api/wallet`. |
| `src/components/DiscoveringContent.tsx` | Market Discovery — 3-step wizard (Discover → Review → Track). **Major redesign coming** — B2B/B2C split modes. |
| `src/components/PlansModal.tsx` | Plans comparison modal — shown on credit limit hit. Stripe CTA = "Coming soon". |
| `src/components/PlansContent.tsx` | Full pricing page — fetches from `/api/plans`, shows live wallet balance. |
| `src/components/PriceBoardContent.tsx` | Price activity table (mock data — real data coming) |
| `src/components/TrackedUrlsContent.tsx` | Tracked URLs — real API data from `/api/product-company-urls`. |
| `src/components/CompaniesContent.tsx` | Stores — real API data, Add/Edit Store via Sheet. B2C cannot access. |
| `src/components/ProductsContent.tsx` | Products — real data, Add Product via Sheet, CSV/TSV import. B2C cannot access. |
| `src/components/SettingsContent.tsx` | Settings — 5 tabs: General, Account, Privacy, Billing, Usage. Capabilities tab removed. Role-aware. |
| `src/components/ui/sheet.tsx` | shadcn Sheet — right side, `w-[90%] sm:w-[33vw] sm:min-w-[380px]`, overlay has `backdrop-blur-sm`. |
| `src/context/AuthContext.tsx` | Firebase auth context (`useAuth()`) |
| `src/lib/firebase.ts` | Firebase client init |
| `vite.config.ts` | Injects `__APP_VERSION__` from package.json at build time |

---

## Settings Tabs (current state)

| Tab | Status |
|-----|--------|
| General | ✅ Real — theme switcher (light/dark/system), default currency (USD/AED) stored in localStorage |
| Account | ✅ Real — edit display name (Firebase + backend), edit company name (B2B only), delete account with "DELETE MY ACCOUNT" confirm input |
| Privacy | ✅ Real — analytics/personalisation toggles (localStorage), export data as JSON/CSV/PDF |
| Billing | ✅ Real — live plan from DB, plan end date + time (trial_ends_at / billing_renews_at), "View plans" button |
| Usage | ✅ Real — live credits from `/api/wallet`, transaction history table |
| Capabilities | ❌ Removed — capability toggles will be inline options in Market Discovery page |

---

## Database Schema (Neon PostgreSQL)

Key tables:
- `companies` — retailers (id, name, slug, base_url, is_active, **user_email** — NULL=global seed, email=user-owned)
- `products` — product catalog (id, internal_name, internal_sku, brand, is_active, **user_email**)
- `product_company_urls` — maps product × company → URL (is_active, last_status, last_checked_at)
- `price_snapshots` — scraped prices (price, original_price, currency, availability, scrape_status, checked_at)
- `company_configs` — per-company scraper config (selectors, page_options)
- `sync_runs` — scraping job history
- `allowed_users` — whitelist + subscription info (role, subscription, trial_ends_at, **billing_renews_at**, **company_name**, **firebase_uid**, **signup_ip**)
- `plans` — all plan definitions (key, name, price_usd_b2b, price_usd_b2c, credits_b2b, credits_b2c, features_b2b JSONB, features_b2c JSONB, is_coming_soon, sort_order)
- `user_wallet` — one row per user (balance, total_added, total_used)
- `wallet_transactions` — immutable log of every credit change (amount, balance_after, type, description)
- `currency_rates` — USD→AED rate (seeded: 1 USD = 3.65 AED)

**Multi-tenancy:** `user_email` column on `products` and `companies`. Global seed stores have `user_email IS NULL` — these are copied to each new user on signup via `copyGlobalStoresToUser()`. Slug uniqueness is per-user: `(slug, user_email)` unique index. SKU uniqueness: `(internal_sku, user_email)`.

**Trial abuse prevention:** `firebase_uid` (one trial per Google account) + `signup_ip` (30-day IP cooldown).

---

## API Routes

All routes are protected by `requireAuth` (Firebase Bearer token). All data routes are scoped to `req.email`.

```
GET    /api/allowed-users/me       ← Access check; returns NEW_USER (403) for unknowns
PUT    /api/allowed-users/me       ← Update own name / company_name
DELETE /api/allowed-users/me       ← Delete own account + all data (FK-safe cascade)
POST   /api/allowed-users/signup   ← Self-serve signup: creates trial user, checks UID+IP, seeds stores

POST /api/discovery/ai-search    ← Claude web search → find product URLs
POST /api/discovery/ai-match     ← Claude matches discovered URLs to product catalog
POST /api/discovery/confirm      ← Save confirmed product→URL mappings
POST /api/discovery/search       ← Playwright discovery on company search page
POST /api/discovery/probe        ← Detect search URL pattern for a website

GET  /api/companies              ← List user's stores (user_email scoped)
POST /api/companies              ← Create store
PUT  /api/companies/:id          ← Edit store
GET  /api/products               ← List user's products
POST /api/products               ← Create single product
POST /api/products/import        ← Bulk CSV import
GET  /api/product-company-urls   ← Tracked URLs
POST /api/product-company-urls   ← Add tracked URL
GET  /api/price-snapshots        ← Price history
POST /api/scraper/scrape         ← Scrape a single URL
POST /api/sync-runs              ← Trigger bulk sync
GET  /api/stats                  ← Dashboard stats
GET  /api/allowed-users          ← User whitelist management (management roles only)
GET  /api/plans                  ← All active plans from DB
GET  /api/wallet                 ← Current user's balance + last 20 transactions
POST /api/wallet/add             ← Manually add credits (dev/admin use)
GET  /api/currency-rates         ← USD→AED conversion rate
GET  /api/export?format=json|csv|pdf ← Download user data export
```

---

## AI Features

### Claude Vision
- File: `backend/src/scraper/aiScraper.ts`
- Takes a screenshot → sends to Claude → extracts price, title, availability, originalPrice

### Claude Web Search
- File: `backend/src/scraper/aiWebSearch.ts`
- Uses `claude-haiku-4-5-20251001` with `web_search_20250305` tool
- Hard 30-second AbortController timeout
- Endpoint: `POST /api/discovery/ai-search`

### AI Auto-Matching
- Endpoint: `POST /api/discovery/ai-match`
- Claude haiku matches discovered URLs to product catalog with confidence 0–1
- ≥85% = pre-selected green, 60–84% = yellow unselected, <60% = no match

---

## Credit / Wallet System

**All users (b2b + b2c) use credits.** `dev`, `owner` → unlimited (bypass wallet).

| Plan       | B2B credits | B2C credits | Trial duration |
|------------|-------------|-------------|----------------|
| trial      | 20          | 30          | b2b=14d, b2c=7d |
| free       | 10          | 15          | Forever         |
| pro        | 50          | 150         | Monthly         |
| enterprise | Unlimited   | Unlimited   | Coming soon     |

- Each search deducts 1 credit (atomic SQL update)
- Balance = 0 → 429 `USAGE_LIMIT_REACHED` → frontend shows `PlansModal`
- Stripe top-up = **not yet built**

---

## Onboarding Flow

1. New Google sign-in → `/api/allowed-users/me` returns `NEW_USER` (403)
2. Frontend shows `OnboardingContent` — user picks B2B or B2C, then picks plan (trial/free/pro)
3. `POST /api/allowed-users/signup` — checks firebase_uid dupe, IP dupe (30d), creates user, sets billing_renews_at for pro
4. `copyGlobalStoresToUser()` seeds 8 UAE retailers
5. `onComplete()` → triggers role re-fetch → app transitions to `ready`

---

## UI Patterns

- **Add/Edit forms:** Use `Sheet` (right-side panel, `33vw` width, `backdrop-blur-sm` overlay) — NOT centered Dialog
- **Import dialogs:** Still use centered `Dialog` (brand filter for CSV import)
- **Pages have no max-width constraint** — they fill the full content area
- **Role-aware rendering:** `{role !== "b2c" && ...}` for B2B/dev content, `{role === "b2c" && ...}` for B2C-only

---

## Planned Features (not yet built)

- **Market Discovery redesign** — B2B/B2C split modes (see "Market Discovery Vision" section above)
- **Stripe payment integration** — "Coming soon" in PlansModal and PlansContent
- **Real data in PriceBoardContent** — still mock data
- **Edit product** — no edit form yet, only add + deactivate
- **B2C best-price search** — natural language query → AI returns best prices from web

---

## Version / Push Workflow

```bash
# Before every push:
node scripts/bump-version.mjs
git add package.json <changed files>
git commit -m "feat/fix: description

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
git push
# NEVER stage .github/workflows/ files
```
