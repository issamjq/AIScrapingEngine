# CLAUDE.md — AI Scraping Engine Project Guide

> **This file is read automatically at the start of every Claude Code session.**
> Update it on every `git push` so the next session starts instantly with full context.

---

## Project Overview

A full-stack AI-powered price scraping and market discovery platform for UAE e-commerce retailers (Amazon AE, Noon, Carrefour, Talabat, Spinneys). It tracks product prices across retailers, uses Claude Vision AI to extract prices from screenshots, and uses Claude web search to auto-discover product listing URLs.

**Current version:** v1.0.42

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
| `backend/src/middleware/usageLimit.ts` | B2B: `{trial:20, free:10, paid:50}` weekly. B2C: `{trial:30, free:15, paid:150}` monthly. dev/owner bypass. |
| `backend/src/routes/allowedUsers.ts` | `GET /me` (returns NEW_USER for unknowns), `POST /signup` (creates trial user, copies stores, checks UID+IP dupe), CRUD for management roles. |
| `backend/tsconfig.json` | Must include `"lib": ["ES2020", "DOM"]` — DOM needed for Playwright page.evaluate() |

---

## Frontend Key Files

| File | Purpose |
|------|---------|
| `src/App.tsx` | State machine: loading → onboarding → ready → denied. Renders OnboardingContent for new users. |
| `src/components/OnboardingContent.tsx` | Two-card B2B vs B2C picker shown to new users before dashboard access. POSTs to `/signup`. |
| `src/components/DashboardLayout.tsx` | Sidebar: Dashboard, AI (Market Discovery), Monitoring (Price Activity, Tracked Listings), Catalog (Products, Stores), Social (Meta, TikTok). System items (Plans/Settings/Users) are in the user menu footer only. |
| `src/components/TopNavigation.tsx` | Top bar — sidebar trigger + title only. Bell and avatar removed. |
| `src/components/UserMenuButton.tsx` | Sidebar footer: avatar+initials, name, plan label. Dropdown: Settings, Upgrade plan, Log out, etc. |
| `src/components/DiscoveringContent.tsx` | Market Discovery — 3-step wizard (Discover → Review → Track). Step 1: search input + collapsible marketplace multi-select dropdown. Step 2: results by retailer with blur for free users. Step 3: AI Match dialog. Usage counter is role-aware (b2c = credits/month, b2b = searches/week). |
| `src/components/PlansModal.tsx` | Plans comparison modal (Trial/Free/Pro) — shown on limit hit. Stripe CTA = "Coming soon". |
| `src/components/PlansContent.tsx` | Full pricing page — Free / Pro cards, current plan banner with usage bar, trial countdown. Full width (no max-width constraint). |
| `src/components/PriceBoardContent.tsx` | Price activity table (mock data) |
| `src/components/TrackedUrlsContent.tsx` | Tracked URLs — **real API data** from `/api/product-company-urls`. Add URL via right-side Sheet with product+store dropdowns. |
| `src/components/CompaniesContent.tsx` | Stores — real API data, Add Store + **Edit Store** via right-side Sheet (name+URL→auto-slug), activate/deactivate toggle. External link fixed to always prepend `https://` if missing. |
| `src/components/ProductsContent.tsx` | Products — real data, Add Product via right-side Sheet (Name/Brand/SKU/Barcode/RSP/Image), CSV/TSV import with brand filter dialog. |
| `src/components/ui/sheet.tsx` | shadcn Sheet — right side, `w-[90%] sm:w-[33vw] sm:min-w-[380px]`, overlay has `backdrop-blur-sm`. Used for all add/edit forms. |
| `src/context/AuthContext.tsx` | Firebase auth context (`useAuth()`) |
| `src/lib/firebase.ts` | Firebase client init |
| `vite.config.ts` | Injects `__APP_VERSION__` from package.json at build time |

---

## Database Schema (Neon PostgreSQL)

Key tables:
- `companies` — retailers (id, name, slug, base_url, is_active, **user_email** — NULL=global seed, email=user-owned)
- `products` — product catalog (id, internal_name, internal_sku, brand, is_active, **user_email**)
- `product_company_urls` — maps product × company → URL (is_active, last_status, last_checked_at)
- `price_snapshots` — scraped prices (price, original_price, currency, availability, scrape_status, checked_at)
- `company_configs` — per-company scraper config (selectors, page_options)
- `sync_runs` — scraping job history
- `allowed_users` — whitelist + subscription info (role, subscription, trial_ends_at, daily_searches_used, last_reset_at, **firebase_uid**, **signup_ip**)

**Multi-tenancy:** `user_email` column on `products` and `companies`. Global seed stores have `user_email IS NULL` — these are copied to each new user on signup via `copyGlobalStoresToUser()`. Slug uniqueness is per-user: `(slug, user_email)` unique index. SKU uniqueness: `(internal_sku, user_email)`.

**Trial abuse prevention:** `firebase_uid` (one trial per Google account) + `signup_ip` (30-day IP cooldown).

---

## API Routes

All routes are protected by `requireAuth` (Firebase Bearer token). All data routes are scoped to `req.email`.

```
GET  /api/allowed-users/me       ← Access check; returns NEW_USER (403) for unknowns
POST /api/allowed-users/signup   ← Self-serve signup: creates trial user, checks UID+IP, seeds stores

POST /api/discovery/ai-search    ← Claude web search → find product URLs
POST /api/discovery/ai-match     ← Claude matches discovered URLs to product catalog
POST /api/discovery/confirm      ← Save confirmed product→URL mappings
POST /api/discovery/search       ← Playwright discovery on company search page
POST /api/discovery/probe        ← Detect search URL pattern for a website

GET  /api/companies              ← List user's stores (user_email scoped)
POST /api/companies              ← Create store (stores user_email)
GET  /api/products               ← List user's products (user_email scoped)
POST /api/products               ← Create single product
POST /api/products/import        ← Bulk CSV import (user_email scoped)
GET  /api/product-company-urls   ← Tracked URLs (user_email scoped via JOIN on products)
POST /api/product-company-urls   ← Add tracked URL (product_id + company_id + product_url)
GET  /api/price-snapshots        ← Price history
POST /api/scraper/scrape         ← Scrape a single URL
POST /api/sync-runs              ← Trigger bulk sync
GET  /api/stats                  ← Dashboard stats (user_email scoped)
GET  /api/allowed-users          ← User whitelist management (management roles only)
```

---

## AI Features

### Claude Vision
- File: `backend/src/scraper/aiScraper.ts`
- Takes a screenshot → sends to Claude → extracts price, title, availability, originalPrice

### Claude Web Search (v1.0.5+)
- File: `backend/src/scraper/aiWebSearch.ts`
- Uses `claude-haiku-4-5-20251001` with `web_search_20250305` tool
- Hard 30-second AbortController timeout
- Endpoint: `POST /api/discovery/ai-search`

### AI Auto-Matching (v1.0.9+)
- Endpoint: `POST /api/discovery/ai-match`
- Claude haiku matches discovered URLs to product catalog with confidence 0–1
- ≥85% = pre-selected green, 60–84% = yellow unselected, <60% = no match
- Inline catalog picker to manually assign/change product

### Company Matching (`matchCompany()` in DiscoveringContent.tsx)
- **Primary:** domain from result URL matched against company `base_url`
- **Fallback:** keyword matching on name/slug/base_url

---

## Subscription / Usage Limit System (v1.0.21+)

**Roles:** `dev`, `owner` → unlimited. `b2b`, `b2c` → limits apply.

| Plan  | B2B (searches/week) | B2C (credits/month) | Results visible | Duration |
|-------|--------------------|--------------------|-----------------|----------|
| trial | 20                 | 30                 | All — no blur   | b2b=14d, b2c=7d |
| free  | 10                 | 15                 | 3 per retailer (blurred) | Forever |
| paid  | 50                 | 150                | All — no blur   | Monthly |

- New users → `trial` (full access, no blur) with `trial_ends_at` auto-set
- Trial expires → `free` (blur + lower limits) → conversion pressure
- Limit hit → 429 `USAGE_LIMIT_REACHED` → frontend shows `PlansModal`
- B2B resets every 7 days, B2C resets every 30 days (both use `last_reset_at`)
- Stripe = **not yet built** — "Coming soon" in PlansModal/PlansContent

---

## Onboarding Flow

1. New Google sign-in → `/api/allowed-users/me` returns `NEW_USER` (403)
2. Frontend shows `OnboardingContent` — user picks B2B (business) or B2C (personal)
3. `POST /api/allowed-users/signup` — checks firebase_uid dupe, IP dupe (30d), creates trial user
4. `copyGlobalStoresToUser()` seeds 8 UAE retailers for this user
5. `onComplete()` → app state transitions to `ready`

---

## Market Discovery Flow (end-to-end)

1. User types query + selects marketplaces in collapsible dropdown → `POST /api/discovery/ai-search`
2. Claude web-searches → returns `[{retailer, url, title}]`
3. Step 2 shows results grouped by retailer — user checks what to track
4. `POST /api/discovery/ai-match` → Claude matches titles to catalog → confidence scores
5. Step 3 dialog: ≥85% pre-selected (green), 60–84% yellow unselected, <60% = no match
6. User confirms → `POST /api/discovery/confirm` per company → saves to `product_company_urls`
7. On success → resets to Step 1

---

## UI Patterns

- **Add/Edit forms:** Use `Sheet` (right-side panel, `33vw` width, `backdrop-blur-sm` overlay) — NOT centered Dialog
- **Import dialogs:** Still use centered `Dialog` (brand filter for CSV import)
- **Pages have no max-width constraint** — they fill the full content area

---

## Planned Features (not yet built)

- **Stripe payment integration** — "Coming soon" buttons in PlansModal and PlansContent
- **Real data in PriceBoardContent** — still uses mock data
- **Edit product** — no edit form yet, only add + deactivate
- **Edit store** — ✅ done (v1.0.39): Edit button on each card opens pre-filled Sheet, calls `PUT /api/companies/:id`

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
