# CLAUDE.md — AI Scraping Engine Project Guide

> **This file is read automatically at the start of every Claude Code session.**
> Update it on every `git push` so the next session starts instantly with full context.

---

## Project Overview

A full-stack AI-powered price scraping and market discovery platform. B2B: UAE e-commerce retailers (Amazon AE, Noon, Carrefour, Talabat, Spinneys) track product prices. B2C: consumers search for the best prices globally using AI (like ChatGPT/Google). Uses Claude Vision AI to extract prices from screenshots and Claude web search to find product URLs.

**Current version:** v1.7.9

---

## Stable Checkpoints — "go back to stable" means restore these

| Checkpoint | Git commit | What works |
|---|---|---|
| **LATEST STABLE** | `405709e` (v1.7.7) | Landing page persistent after sign-in, two-product mega-menu, Creator Intelligence dummy dashboard, deep-link nav |
| **Previous stable** | `05e7938` (v1.7.4) | Landing page, subscription system v2, daily/weekly/cycle limits, new plan config, usage UI |
| **Old stable** | `af4b507` (v1.6.7) | B2B dual-mode discovery, notification sound, sidebar restructure, company logos, template download, per-store credits |

---

## B2B vs B2C — Role Architecture

The project is fully role-aware. Every page component receives a `role` prop (`"b2b"`, `"b2c"`, `"dev"`). All future changes must be scoped: B2B-only in `{role !== "b2c" && ...}`, B2C-only in `{role === "b2c" && ...}`.

### Role rules
| Feature | B2B | B2C | Dev |
|---|---|---|---|
| Dashboard | ✅ | ❌ redirected to discovering | ✅ |
| Market Discovery | ✅ dual-mode (AI Price Search + Catalog Discovery) | ✅ B2C price search only | ✅ |
| Price Activity | ✅ | ✅ paid plans only | ✅ |
| Products | ✅ | ❌ hidden + guarded | ✅ |
| Stores | ✅ | ❌ hidden + guarded | ✅ |
| Credits | deducted | deducted (1–3/search) | bypassed (unlimited) |

### Dev account
- `karaaliissa@gmail.com` → `role = "dev"`, `subscription = "paid"`, unlimited credits
- Dev bypasses all credit deductions (backend `UNLIMITED_ROLES = ["dev", "owner"]`)
- Dev sees all pages including B2B-only ones

### Test B2B account
- `karooorak3@gmail.com` — B2B user with 14 stores seeded in Neon (with logo_url)

---

## Landing Page (BUILT — `src/landing/`)

Public marketing page. **Stays visible after sign-in** — users only enter the app when they click a specific product. This is intentional: the landing page is the home for both authenticated and unauthenticated visitors.

### Structure
```
src/landing/
  LandingPage.tsx       ← orchestrator; reads useAuth() directly; handles both signed-in + signed-out
  LandingNav.tsx        ← sticky nav; mega-menu with two products; shows avatar when signed in
  HeroSection.tsx       ← headline + CTAs + live B2C search mockup
  StatsBar.tsx          ← 10+ retailers · Spark Vision AI · 3 search depths
  ShowcaseSection.tsx   ← reusable left/right split section
  ShowcaseVisuals.tsx   ← B2BVisual, B2CVisual, PriceChartVisual (UI mockups)
  HowItWorks.tsx        ← 3-step process section
  TikTokTeaser.tsx      ← coming soon gradient section for TikTok Intelligence
  LandingCTA.tsx        ← final CTA with plan tier preview
  LandingFooter.tsx     ← links + brand
```

### Sign-in flow (IMPORTANT — different from before)
1. User clicks "Sign in" or "Get Started Free" (no product target) → Google popup → stays on landing page
   - Nav switches: "Sign in" / "Get Started Free" → user avatar + first name + "Open App" button
2. User clicks a product in the mega-menu → Google popup → lands directly on that product's page in the app
   - Target stored in `sessionStorage("spark_nav_target")` before popup, read after profile fetch
3. Already signed-in user clicks a product → navigates directly (no popup)
4. `onNavigateToApp` prop passed from App.tsx → sets `showLanding = false` → enters app

### App.tsx `showLanding` state
- Starts `true`. Set to `false` only when user clicks a product (with nav target) or completes onboarding.
- Reset to `true` on sign-out so next sign-in starts on landing again.
- Render order: `loading → LandingPage (if !user or showLanding+ready) → AppLoader → onboarding/denied/app`

### Mega-menu structure — two products
**Left card — Market Intelligence** (our price scraping engine):
- Sub-items: Market Discovery (`#discovering`), Price Tracking (`#price-board`), Catalog Discovery (`#discovering`)
- Each item deep-links to its specific app page after sign-in

**Right card — Creator Intelligence** (kalodata-style TikTok product):
- Single card, no sub-items yet
- Clicking → sign in → opens `#creator-intel` route
- Badge shows "Coming Q3 2026"

### Key behaviors
- **Light mode is the default** for visitors with no saved theme preference
- Mega-menu uses 150ms close delay + `pt-2` invisible bridge so mouse can cross the gap
- All CTAs use `onAction(target?)` — same handler for signed-in and signed-out states
- **No Claude AI branding** anywhere — all references are "Spark AI" or "Spark Vision AI"
- When logged in: "Get Started Free" → "Open Market Intelligence"; "Sign in" → removed; "Get Started Free" in CTA → "Open App"

### What NOT to do on landing page
- Do NOT mention Claude anywhere on the public-facing landing page
- Do NOT add max-width constraints to sections — they should fill full width
- Do NOT wire the TikTok/Creator notify email yet — it's coming later
- Do NOT set `showLanding = false` unless user has clicked into a specific product

---

## Market Discovery — B2B vs B2C (BUILT)

`DiscoveringContent` routes by role: B2C → `B2CDiscoveryContent`, B2B/dev → `B2BDiscoveryContent` (internal component inside `DiscoveringContent.tsx`).

### B2C Discovery (`B2CDiscoveryContent.tsx`)
- User types any natural language product query (textarea, no format required)
- Costs **1–3 credits** per search depending on batch (Quick=1, Standard=2, Deep=3)
- Backend detects user IP → geo-lookup (ip-api.com) → country → searches that country first, then globally
- Results: horizontal scrollable price cards sorted cheapest first, `line-clamp-3` title, condition badges, Deal Score stars, discount %, image
- Visible results by plan: free=3, trial=8, pro=20 (rest blurred with upgrade overlay)
- Upgrade buttons navigate to `/plans` page (NOT modal)
- **Notification sound** plays on search complete (`src/assets/notification.mpeg`)
- `embedded` prop: when `true`, hides hero section + category chips — used inside B2B AI Price Search mode

### B2B Discovery — Dual Mode (`DiscoveringContent.tsx` → `B2BDiscoveryContent`)
Two modes toggled by pill tabs:

**AI Price Search** (mode = `"ai"`):
- Renders `<B2CDiscoveryContent embedded />` — same pipeline as B2C

**Catalog Discovery** (mode = `"catalog"`):
- 3-step wizard: Discover → Review → Track
- Step 1: **ProductDropdown** (search bar, single-select, auto-fills query) + **MarketplaceDropdown** (search bar, checkboxes, Select All)
  - Live credit hint: `N stores · N credits will be deducted`
- Step 2: AI ThinkingLog per-store scan progress; Review matched products with checkboxes
- Step 3: Save + track confirmed mappings
- **Credit model: 1 credit per store searched** (via `checkUsageLimit` on `POST /api/discovery/search`)

### Credit cost summary
| Action | Credits |
|---|---|
| B2C Quick search (3 sites) | 1 credit |
| B2C Standard search (6 sites) | 2 credits |
| B2C Deep search (10 sites) | 3 credits |
| B2B AI Price Search | same as B2C above |
| B2B Catalog Discovery | 1 credit × number of stores selected |
| `dev` / `owner` | 0 always |

---

## Subscription System v2 (BUILT)

### Central Plan Config (single source of truth)
- **Backend:** `backend/src/config/plans.ts` — do NOT put plan data anywhere else
- **Frontend:** `src/lib/plans.ts` — mirrors backend config exactly

### Plans
| Key | Audience | Credits/mo | Daily | Weekly | Price |
|---|---|---|---|---|---|
| `b2c_free` | B2C | 20 | 2 | 6 | Free |
| `b2c_starter` | B2C | 180 | 12 | 45 | $9/wk · $29/mo · $290/yr |
| `b2c_pro` | B2C | 600 | 35 | 140 | $19/wk · $69/mo · $690/yr |
| `b2b_free` | B2B | 60 | 5 | 18 | Free |
| `b2b_growth` | B2B | 1500 | 90 | 350 | $39/wk · $149/mo · $1490/yr |
| `b2b_scale` | B2B | 5000 | 250 | 1000 | $89/wk · $349/mo · $3490/yr |

### Credit limit enforcement (backend)
- `checkAndDeductCredits(email, amount, description)` in `walletService.ts` — use this everywhere
- Checks daily (UTC calendar day) + weekly (ISO Mon–Sun) + balance limits before deducting
- Returns `{ success, balance, limitType?: "daily" | "weekly" | "balance" }`
- On failure → 429 with `limitType` + human-readable message
- Counters reset atomically in the same UPDATE (CASE WHEN pattern with COALESCE)
- `deductCredit()` and `deductCredits()` are wrappers that delegate to `checkAndDeductCredits`

### Billing intervals
- `billing_interval`: `"weekly" | "monthly" | "yearly"` — stored on `allowed_users`
- Onboarding lets user pick interval; sent as `billing_interval` in signup POST body
- `billing_renews_at` calculated from interval on signup

### New DB columns (already migrated in Neon)
**`allowed_users`:** `plan_code VARCHAR(30)`, `billing_interval VARCHAR(10)`, `billing_renews_at TIMESTAMPTZ`, `company_name VARCHAR(150)`
**`user_wallet`:** `credits_used_today`, `credits_used_this_week`, `credits_used_this_cycle` (INTEGER), `last_daily_reset_at`, `last_weekly_reset_at`, `last_cycle_reset_at` (TIMESTAMPTZ), `daily_limit`, `weekly_limit`, `monthly_limit` (INTEGER)

---

## Sidebar Structure (BUILT — `DashboardLayout.tsx`)

Four separate `<SidebarGroup>` elements to control gaps:
1. **Group 1**: Market Discovery + Price Activity (all roles)
2. **Group 2** (gap above): Creator Intel — `#creator-intel` (all roles, Sparkles icon)
3. **Group 3** (gap above): Products + Stores — B2B/dev only
4. **Group 4** (gap above): Dashboard — B2B/dev only

- Dashboard is intentionally at the **bottom**, below Stores
- Default landing page = **Market Discovery** (`discovering`), not dashboard
- B2C users: see Market Discovery + Price Activity (if paid plan) + Creator Intel
- Recent Searches section = hidden (`{false && isB2C && ...}`)
- No section labels (no "Catalog", no "AI", no "Monitoring" text)

---

## Stores Page (`CompaniesContent.tsx`)

- Shows company **logo image** when `logo_url` is set in DB — falls back to `Building2` icon on error
- Add/Edit Store via Sheet (right-side panel)
- `karooorak3@gmail.com` has 14 stores with logo_url seeded directly in Neon

---

## Products Page (`ProductsContent.tsx`)

- **Download Template** button (Download icon) next to Import — downloads `products_template.csv`
  - Columns: `Item Name`, `SKU`, `Brand`, `ID`, `Initial RSP`, `ImageUrl`
  - Uses generic placeholders: `Product 1`, `Brand 1` (NOT company-specific names — Marvis is a private client)
- CSV/TSV import with brand filter dialog
- Add Product via Sheet

---

## Notification Sound

- File: `src/assets/notification.mpeg`
- Declared in `src/assets.d.ts`: `declare module "*.mpeg" { const src: string; export default src }`
- `vite.config.ts` has `assetsInclude: ["**/*.mpeg", "**/*.mp3"]` — required so Vite treats it as static asset, not JS
- Plays at volume 0.6 when B2C search completes (before `toast.success()`)
- Works on desktop (Mac + Windows). iOS Safari blocks programmatic audio — `.play().catch(() => {})` silences the error

---

## Architecture

```
/                        ← Frontend (Vite + React + TypeScript + Tailwind + shadcn/ui)
/src/landing/            ← Public marketing landing page (shown to unauthenticated users)
/backend/                ← Backend (Node.js + Express + TypeScript)
/backend/src/config/     ← Central plan config (plans.ts) — single source of truth
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
6. **Template CSV** — always use generic placeholder names (Product 1, Brand 1). Never hardcode client names (Marvis is private).
7. **Plan data lives in `backend/src/config/plans.ts` and `src/lib/plans.ts`** — never hardcode credits/limits elsewhere.
8. **No Claude branding on landing page** — use "Spark AI" or "Spark Vision AI" only.
9. **Landing page sections have no max-width** — they fill full width just like app pages.

---

## Backend Key Files

| File | Purpose |
|------|---------|
| `backend/src/index.ts` | Express app entry, all routes registered here |
| `backend/src/config/plans.ts` | **Central plan config** — all plans, limits, prices. Single source of truth. |
| `backend/src/scraper/engine.ts` | `ScraperEngine` — Playwright browser, `scrape(url)` |
| `backend/src/scraper/aiScraper.ts` | Claude Vision (`extractWithVision`) for price extraction |
| `backend/src/scraper/aiWebSearch.ts` | Claude `web_search_20250305` tool — finds product URLs by query (B2B) |
| `backend/src/scraper/priceParser.ts` | Parse price strings → numbers + currency |
| `backend/src/scraper/searchConfigs.ts` | Per-retailer Playwright search page configs |
| `backend/src/scraper/companyConfigs.ts` | Per-retailer scrape selectors |
| `backend/src/services/b2cSearchService.ts` | **B2C pipeline**: geo-aware web search → parallel scrape → Vision AI → sorted results |
| `backend/src/services/discoveryService.ts` | `discoverProducts()` — Playwright + Claude matching (B2B Catalog Discovery) |
| `backend/src/services/scrapingService.ts` | Bulk scraping jobs |
| `backend/src/services/syncService.ts` | Price sync runs |
| `backend/src/services/companyService.ts` | All functions scoped by `userEmail`. `copyGlobalStoresToUser()` seeds 8 UAE stores on signup. |
| `backend/src/services/productService.ts` | All functions scoped by `userEmail`. bulkImport uses `(internal_sku, user_email)` unique index. |
| `backend/src/services/productCompanyUrlService.ts` | `getAll()` scoped by `user_email` via joined products table. |
| `backend/src/services/walletService.ts` | `checkAndDeductCredits()` (main — use this), `getWallet()`, `createWallet()`, `addCredits()`, `getTransactions()`, `getUsageSummary()` |
| `backend/src/routes/discovery.ts` | `/search` (1 credit/store via `checkUsageLimit`), `/ai-search`, `/ai-match`, `/confirm`, `/probe`, `/b2c-search` (SSE streaming) |
| `backend/src/middleware/usageLimit.ts` | Deducts 1 credit per call via `checkAndDeductCredits`. dev/owner bypass. Returns 429 with `limitType`. |
| `backend/src/services/plansService.ts` | `getAllPlans()`, `getPlanByKey()` — reads from central config (NOT DB). |
| `backend/src/routes/plans.ts` | `GET /api/plans` — returns PLANS from config directly. |
| `backend/src/routes/wallet.ts` | `GET /api/wallet`, `GET /api/wallet/usage` (daily/weekly/cycle summary), `POST /api/wallet/deduct`, `POST /api/wallet/add` |
| `backend/src/routes/allowedUsers.ts` | `GET /me`, `PUT /me`, `DELETE /me`, `POST /signup` (accepts `plan_code` + `billing_interval`), CRUD for management roles. |
| `backend/src/routes/export.ts` | `GET /api/export?format=json\|csv\|pdf` — downloads user data. Uses pdfkit for PDF. |
| `backend/tsconfig.json` | Must include `"lib": ["ES2020", "DOM"]` — DOM needed for Playwright page.evaluate() |

---

## Frontend Key Files

| File | Purpose |
|------|---------|
| `src/App.tsx` | State machine + hash nav. `showLanding` state keeps landing visible after sign-in until user picks a product. |
| `src/landing/LandingPage.tsx` | Orchestrator. Reads `user` from `useAuth()` directly. `onAction(target?)` handles both states. Accepts `onNavigateToApp` prop from App.tsx. |
| `src/landing/LandingNav.tsx` | Sticky nav. Two-product mega-menu. Shows avatar + "Open App" when `isLoggedIn`. Props: `onAction`, `isLoggedIn`, `userName`, `userPhotoURL`. |
| `src/landing/HeroSection.tsx` | Hero: headline (text-7xl), mockup, CTAs. Props: `onAction`, `isLoggedIn`. CTA text changes when signed in. |
| `src/landing/ShowcaseSection.tsx` | Reusable alternating left/right split section |
| `src/landing/ShowcaseVisuals.tsx` | B2BVisual, B2CVisual, PriceChartVisual — UI mockup components |
| `src/landing/HowItWorks.tsx` | 3-step process |
| `src/landing/TikTokTeaser.tsx` | TikTok Intelligence coming soon section |
| `src/landing/LandingCTA.tsx` | Final CTA with 3-plan tier preview. Props: `onAction`, `isLoggedIn`. Button text changes when signed in. |
| `src/landing/LandingFooter.tsx` | Footer with links |
| `src/lib/plans.ts` | Frontend plan config mirror — `PLANS[]`, `getPlansForAudience()`, `yearlySavingsPct()`, `planPrice()` |
| `src/assets.d.ts` | TypeScript module declarations for `.mpeg` and `.mp3` audio assets |
| `src/assets/notification.mpeg` | Notification sound played on B2C search complete |
| `src/context/ThemeContext.tsx` | Theme provider (light/dark/system). Light = default for new visitors. |
| `src/components/OnboardingContent.tsx` | Step 1: B2B/B2C role picker. Step 2: 3-plan picker (from `src/lib/plans.ts`) with billing interval toggle (Weekly/Monthly/Yearly). POSTs `role`, `plan_code`, `billing_interval` to `/signup`. |
| `src/components/DashboardLayout.tsx` | Sidebar: 4 SidebarGroups. No section labels. |
| `src/components/TopNavigation.tsx` | Top bar — sidebar trigger + title only. |
| `src/components/UserMenuButton.tsx` | Sidebar footer: avatar, name, plan label, golden credit ring. |
| `src/components/DiscoveringContent.tsx` | Routes by role. B2B has ProductDropdown + MarketplaceDropdown + ThinkingLog. |
| `src/components/B2CDiscoveryContent.tsx` | B2C Market Discovery UI. `embedded` prop. Notification sound on complete. |
| `src/components/PlansContent.tsx` | Plans page: B2B/B2C audience toggle + Weekly/Monthly/Yearly interval toggle + 3 plan cards. No max-width. |
| `src/components/PlansModal.tsx` | Plans comparison modal — shown on credit limit hit for B2B. Stripe CTA = "Coming soon". |
| `src/components/PriceBoardContent.tsx` | Price activity table (mock data — real data coming) |
| `src/components/CreatorIntelContent.tsx` | Creator Intelligence page (`#creator-intel`). Full dummy dashboard: stats row, trending products table, category GMV bars, top creators grid, early access banner. All data sections blurred with "Coming Q3 2026" lock overlay. Real build starts next. |
| `src/components/CompaniesContent.tsx` | Stores — shows `logo_url` img. Add/Edit via Sheet. B2C cannot access. |
| `src/components/ProductsContent.tsx` | Products — Add via Sheet, CSV/TSV import, Download Template button. |
| `src/components/SettingsContent.tsx` | 5 tabs. UsageTab: 3 progress bars (daily/weekly/cycle) from `GET /api/wallet/usage`. |
| `src/context/AuthContext.tsx` | Firebase auth context (`useAuth()`) |
| `src/lib/firebase.ts` | Firebase client init |
| `vite.config.ts` | Injects `__APP_VERSION__`. `assetsInclude: ["**/*.mpeg", "**/*.mp3"]` for audio. |

---

## URL Hash Navigation (BUILT)

Pages persist across refresh via `window.location.hash`:
- `#discovering` (default), `#price-board`, `#products`, `#companies`, `#plans`, `#settings`, `#dashboard`, `#creator-intel`
- Settings sub-tabs: `#settings:general`, `#settings:billing`, `#settings:usage`, etc.
- B2C users who land on blocked hashes → redirected to `#discovering`
- Browser back/forward works via `hashchange` listener

---

## Settings Tabs (current state)

| Tab | Status |
|-----|--------|
| General | ✅ Real — theme switcher (light/dark/system), default currency (USD/AED) |
| Account | ✅ Real — edit display name, edit company name (B2B only), delete account |
| Privacy | ✅ Real — analytics/personalisation toggles, export data as JSON/CSV/PDF |
| Billing | ✅ Real — live plan, plan end date + time, "View plans" button |
| Usage | ✅ Real — 3 progress bars (Daily/Weekly/Monthly cycle) from `/api/wallet/usage` + transaction history |
| Capabilities | ❌ Removed — inline options in Market Discovery page |

---

## Database Schema (Neon PostgreSQL)

Key tables:
- `companies` — retailers (id, name, slug, base_url, logo_url, is_active, **user_email**)
- `products` — product catalog (id, internal_name, internal_sku, brand, is_active, **user_email**)
- `product_company_urls` — maps product × company → URL
- `price_snapshots` — scraped prices (price, original_price, currency, availability, scrape_status, checked_at)
- `company_configs` — per-company scraper config
- `sync_runs` — scraping job history
- `allowed_users` — whitelist + subscription info (role, subscription, **plan_code**, **billing_interval**, trial_ends_at, **billing_renews_at**, **company_name**, firebase_uid, signup_ip)
- `plans` — legacy DB table (no longer used for logic — config lives in `plans.ts`)
- `user_wallet` — one row per user (balance, total_added, total_used, **credits_used_today**, **credits_used_this_week**, **credits_used_this_cycle**, **last_daily/weekly/cycle_reset_at**, **daily/weekly/monthly_limit**)
- `wallet_transactions` — immutable log (amount, balance_after, type, description)
- `currency_rates` — USD→AED rate (seeded: 1 USD = 3.65 AED)
- `b2c_search_history` — B2C search results (user_email, query, results JSONB, batch)

**Multi-tenancy:** `user_email` on `products` and `companies`. Global seed stores have `user_email IS NULL`.
**Trial abuse prevention:** `firebase_uid` (one trial per Google account) + `signup_ip` (30-day IP cooldown).

---

## API Routes

All routes protected by `requireAuth` (Firebase Bearer token). All data routes scoped to `req.email`.

```
GET    /api/allowed-users/me       ← Access check; returns NEW_USER (403) for unknowns
PUT    /api/allowed-users/me       ← Update own name / company_name
DELETE /api/allowed-users/me       ← Delete own account + all data (FK-safe cascade)
POST   /api/allowed-users/signup   ← Self-serve signup: accepts role, plan_code, billing_interval

POST /api/discovery/ai-search    ← B2B: web search → find product URLs (1 credit)
POST /api/discovery/ai-match     ← B2B: matches discovered URLs to product catalog (1 credit)
POST /api/discovery/confirm      ← B2B: Save confirmed product→URL mappings (no credit)
POST /api/discovery/search       ← B2B Catalog Discovery: Playwright scrape per store (1 credit per call)
POST /api/discovery/probe        ← Detect search URL pattern for a website
POST /api/discovery/b2c-search   ← B2C: SSE stream — web search + scrape + Vision AI (1–3 credits)
GET  /api/discovery/b2c-history  ← Last 20 B2C searches for this user
POST /api/discovery/b2c-unlock   ← Unlock blurred results (1 credit per result)

GET  /api/companies              ← List user's stores
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
GET  /api/plans                  ← All plans from config (not DB)
GET  /api/wallet                 ← { wallet: { balance, ... }, transactions: [...] }
GET  /api/wallet/usage           ← Daily/weekly/cycle usage summary with resets_at timestamps
POST /api/wallet/deduct          ← Deduct N credits (used for unlock; dev/owner skip)
POST /api/wallet/add             ← Manually add credits (admin only)
GET  /api/currency-rates         ← USD→AED conversion rate
GET  /api/export?format=json|csv|pdf ← Download user data export
```

---

## AI Features

### Claude Vision
- File: `backend/src/scraper/aiScraper.ts`
- Takes a screenshot → sends to Claude → extracts price, title, availability, originalPrice

### Claude Web Search (B2B)
- File: `backend/src/scraper/aiWebSearch.ts`
- Uses `claude-haiku-4-5-20251001` with `web_search_20250305` tool
- Endpoint: `POST /api/discovery/ai-search`

### B2C Search Pipeline (SSE streaming)
- File: `backend/src/services/b2cSearchService.ts`
- Route streams SSE events: `{ type: "phase", ... }` during search, `{ type: "done", data: {...} }` at end
- Step 1: IP geo-detection (ip-api.com, 3s timeout, best-effort) → country hint
- Step 2: Claude web search with geo-aware prompt
- Step 3: Parallel Playwright scrape with Vision AI auto-fallback
- Step 4: Sort results by price ascending, save to `b2c_search_history`
- Returns: `B2CResult[]` with `{ retailer, url, title, condition, price, originalPrice, currency, availability, imageUrl, priceSource }`

### AI Auto-Matching (B2B)
- Endpoint: `POST /api/discovery/ai-match`
- Claude haiku matches discovered URLs to product catalog with confidence 0–1
- ≥85% = pre-selected green, 60–84% = yellow unselected, <60% = no match

---

## Onboarding Flow

1. New Google sign-in → `/api/allowed-users/me` returns `NEW_USER` (403)
2. Frontend shows `OnboardingContent`:
   - **Step 1:** B2B vs B2C role picker
   - **Step 2:** 3-plan picker (Free / middle / top) with billing interval toggle (Weekly/Monthly/Yearly)
3. `POST /api/allowed-users/signup` — checks firebase_uid dupe, IP dupe (30d), creates user with `plan_code` + `billing_interval`
4. `copyGlobalStoresToUser()` seeds 8 UAE retailers
5. Wallet created with initial credits from chosen plan
6. `onComplete()` → triggers role re-fetch → app transitions to `ready`

---

## UI Patterns

- **Add/Edit forms:** Use `Sheet` (right-side panel, `33vw` width, `backdrop-blur-sm` overlay) — NOT centered Dialog
- **Import dialogs:** Still use centered `Dialog` (brand filter for CSV import)
- **Pages have no max-width constraint** — they fill the full content area
- **Landing page sections:** also no max-width, use `max-w-7xl mx-auto` only for inner content
- **Role-aware rendering:** `{role !== "b2c" && ...}` for B2B/dev content, `{role === "b2c" && ...}` for B2C-only
- **Upgrade actions for B2C:** always `onNavigate("plans")` — never PlansModal popup
- **Price card titles:** `line-clamp-3` (not 2) — product names can be long

---

## Creator Intelligence — Why It Exists & What It Is

### The problem we're solving
TikTok Shop is exploding — billions of dollars of products are being sold through short videos and live streams. Sellers, brands, and affiliates need to know: **what products are trending, which creators drive the most sales, and which shops are winning** — before everyone else catches on. This is exactly what [Kalodata.com](https://kalodata.com) does, and it charges $50–$300/month for it. We are building our own version of this, better and cheaper, inside Spark AI as a second product.

### Inspiration: Kalodata
Kalodata is a TikTok Shop analytics SaaS. It tracks:
- Trending products on TikTok Shop by GMV, units sold, growth rate
- Top creator affiliates — who is promoting what, what's converting
- Shop revenue estimates — which brands are winning on TikTok Shop
- Category-level breakdowns — where the money is flowing

Our **Creator Intelligence** product is Spark AI's answer to Kalodata. Same concept, but:
- Integrated with our existing Market Intelligence product (one platform)
- Cross-platform: not just TikTok — also Amazon trending + Alibaba/AliExpress sourcing
- More affordable, UAE/MENA market focus alongside global data
- AI-powered trend prediction, not just raw data display

### The full vision: TikTok → Amazon → Alibaba pipeline
This is the core insight behind Creator Intelligence. The workflow a serious dropshipper or brand follows is:

```
1. DISCOVER  → Find trending products on TikTok Shop (what's going viral)
2. VALIDATE  → Cross-check if the same product is selling on Amazon (proof of demand)
3. SOURCE    → Find the cheapest supplier on Alibaba/AliExpress (where to buy it)
4. TRACK     → Monitor price changes across all three platforms over time
```

Creator Intelligence supports all 4 steps in one place. This is what makes it different from Kalodata (TikTok only) and from our Market Intelligence product (price scraping only).

---

## Creator Intelligence — Data Sources & Import Strategy

### Source 1: TikTok Shop

**What we need:**
- Trending products (by GMV, units, growth rate, category)
- Creator profiles (followers, niche, GMV generated, video count)
- Shop performance (revenue estimates, top products, brand)
- Live stream data (peak viewers, conversion rate)

**How we get it:**
TikTok does not offer a public API for shop/creator data. Options in order of preference:

| Method | Description | Status |
|---|---|---|
| **Playwright scraper** | Scrape `tiktok.com/shop`, `affiliate.tiktok.com`, product pages. Use our existing Playwright engine + Claude Vision for data extraction. | **Preferred — build this first** |
| **TikTok Research API** | Official API, requires approval, limited to US market, mostly for academic research. Not useful for commercial GMV data. | ❌ Not viable |
| **Third-party data provider** | Buy data from a TikTok data reseller (e.g., Datamam, Apify TikTok scrapers). Pay per dataset. | Fallback if scraping is blocked |
| **Partner/affiliate network data** | If we register as a TikTok Shop affiliate, we get access to the affiliate dashboard which shows product performance data. | Explore later |

**Key TikTok pages to scrape:**
- `https://shop.tiktok.com/` — trending products feed
- `https://www.tiktok.com/@{creator}/` — creator profile + pinned shop videos
- TikTok search: `tiktok.com/search?q={product}` — product mentions + views
- Affiliate portal (requires login): best GMV data lives here

**Data to extract per product (Claude Vision on screenshot):**
`product_name, category, price, units_sold_7d, gmv_7d, growth_pct, top_creator, shop_name, video_count, avg_views`

---

### Source 2: Amazon (Global + AE)

**What we need:**
- Best Sellers lists by category (`amazon.com/best-sellers`, `amazon.ae/best-sellers`)
- Movers & Shakers (fastest rising products in last 24h)
- Product detail: price, reviews, rating, rank, FBA status
- Cross-reference: is this TikTok-trending product also on Amazon?

**How we get it:**
Amazon data is already partially supported in our Market Intelligence scraper (price tracking). For Creator Intelligence we extend it:

| Method | Description |
|---|---|
| **Playwright scraper (existing engine)** | Extend `companyConfigs.ts` with Amazon Best Sellers + Movers & Shakers pages. Claude Vision extracts rank, product name, price, rating. |
| **Amazon Product Advertising API (PAAPI)** | Official API for product data. Requires Amazon Associates account. Free with 1 request/sec limit. Returns price, reviews, rank, images. **Best for validation step.** |
| **Keepa API** | Amazon price history + rank history data. Paid ($20/mo developer plan). Excellent for trend validation. Consider as optional add-on. |

**Key Amazon pages:**
- `amazon.com/best-sellers/{category}` — top 100 per category
- `amazon.com/gp/movers-and-shakers/{category}` — fastest rising (hourly update)
- `amazon.ae/best-sellers` — UAE-specific demand signals

---

### Source 3: Alibaba / AliExpress (Sourcing)

**What we need:**
- Supplier listings for a product (price per unit, MOQ, shipping)
- Product quality signals (order count, supplier rating, years active)
- Price comparison across suppliers for the same product
- Cross-border shipping estimates to UAE/US

**How we get it:**

| Method | Description |
|---|---|
| **AliExpress Affiliate API** | Official API (requires registration). Returns product listings, prices, ratings, affiliate links. **Best option — apply for access.** |
| **Alibaba.com scraper** | Playwright scrape of `alibaba.com/trade/search?q={product}`. Claude Vision extracts supplier name, MOQ, price range, rating, order count. Works but rate-limited. |
| **AliExpress scraper** | `aliexpress.com/wholesale?SearchText={product}`. Simpler than Alibaba, more consumer-oriented, good for single-unit sourcing. |
| **1688.com** | Chinese domestic sourcing platform (cheaper than Alibaba). Requires Chinese IP or proxy. Future consideration. |

**Data to extract per supplier:**
`supplier_name, product_title, unit_price, moq, shipping_to_uae, rating, orders_count, response_rate, years_on_platform`

---

### The unified pipeline (how all 3 connect)

```
User searches: "Stanley Tumbler"
                    │
         ┌──────────┼──────────┐
         ▼          ▼          ▼
    TikTok Shop   Amazon     Alibaba
    ─────────     ──────     ───────
    GMV: $2.4M   Rank: #3   Price: $4.20/unit
    Growth: +312% Reviews: 4.8★  MOQ: 50 units
    Top creator  ASIN: B0...  Supplier: ⭐⭐⭐⭐⭐
         │          │          │
         └──────────┼──────────┘
                    ▼
         Unified product card:
         "This product is trending on TikTok (+312% GMV),
          validated on Amazon (#3 Best Seller),
          sourceable from Alibaba at $4.20/unit.
          Potential margin: 89% at $39.99 retail."
```

This unified view is the killer feature. No other tool connects all three.

---

### Creator Intelligence — Backend Build Plan

**New DB tables needed (add to `backend/sql/schema.sql`):**
```sql
-- Products trending on TikTok Shop
CREATE TABLE tiktok_products (
  id SERIAL PRIMARY KEY,
  product_name TEXT NOT NULL,
  category VARCHAR(100),
  tiktok_price DECIMAL(10,2),
  gmv_7d DECIMAL(15,2),         -- estimated 7-day GMV in USD
  units_sold_7d INTEGER,
  growth_pct DECIMAL(6,2),      -- % growth vs prior 7 days
  video_count INTEGER,
  top_creator_handle VARCHAR(100),
  shop_name VARCHAR(150),
  image_url TEXT,
  scraped_at TIMESTAMPTZ DEFAULT NOW()
);

-- TikTok creators / affiliates
CREATE TABLE tiktok_creators (
  id SERIAL PRIMARY KEY,
  handle VARCHAR(100) UNIQUE NOT NULL,
  display_name VARCHAR(150),
  followers INTEGER,
  niche VARCHAR(100),
  gmv_30d DECIMAL(15,2),
  avg_views INTEGER,
  engagement_rate DECIMAL(5,2),
  profile_image_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Amazon cross-reference
CREATE TABLE amazon_trending (
  id SERIAL PRIMARY KEY,
  asin VARCHAR(20) UNIQUE,
  product_name TEXT,
  category VARCHAR(100),
  rank INTEGER,
  price DECIMAL(10,2),
  rating DECIMAL(3,2),
  review_count INTEGER,
  marketplace VARCHAR(10) DEFAULT 'US', -- US, AE, UK, etc.
  scraped_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alibaba/AliExpress sourcing data
CREATE TABLE sourcing_products (
  id SERIAL PRIMARY KEY,
  query TEXT NOT NULL,
  platform VARCHAR(20),          -- 'alibaba', 'aliexpress', '1688'
  supplier_name VARCHAR(200),
  product_title TEXT,
  unit_price DECIMAL(10,2),
  moq INTEGER,
  currency VARCHAR(5) DEFAULT 'USD',
  rating DECIMAL(3,2),
  orders_count INTEGER,
  scraped_at TIMESTAMPTZ DEFAULT NOW()
);
```

**New backend routes (add to `backend/src/routes/creatorIntel.ts`):**
```
GET /api/creator-intel/trending          ← TikTok trending products (paginated, filterable)
GET /api/creator-intel/creators          ← Top creators by GMV
GET /api/creator-intel/categories        ← Category GMV breakdown
GET /api/creator-intel/amazon-trending   ← Amazon movers & shakers
GET /api/creator-intel/source?q={}       ← Alibaba/AliExpress sourcing for a product
GET /api/creator-intel/unified?q={}      ← Combined TikTok + Amazon + Alibaba for one product
POST /api/creator-intel/scrape-tiktok    ← Trigger a fresh TikTok scrape run (admin/cron)
POST /api/creator-intel/scrape-amazon    ← Trigger fresh Amazon best-sellers scrape
```

**New scraper files needed:**
- `backend/src/scraper/tiktokScraper.ts` — Playwright scrape of TikTok Shop pages
- `backend/src/scraper/amazonBestSellers.ts` — Playwright scrape of Amazon Best Sellers / Movers & Shakers
- `backend/src/scraper/aliexpressScraper.ts` — Playwright scrape of AliExpress product listings
- `backend/src/services/creatorIntelService.ts` — orchestrates all three scrapers, deduplication, DB upsert

---

### Creator Intelligence — Frontend Build Plan

Replace dummy data in `CreatorIntelContent.tsx` with:

1. **Stats row** — live counts from DB (trending products count, total GMV tracked, creator count, shops count)
2. **Trending products table** — real data, filters: category, date range (7d/30d/90d), country (US/UAE/UK/Global), sort by GMV or growth
3. **Top creators grid** — real profiles, GMV, niche filter, "View videos" link to TikTok
4. **Category GMV chart** — real numbers, click a category to filter the products table
5. **Shop Intelligence tab** — top TikTok shops by revenue, brand profile cards
6. **Amazon Movers tab** — fastest rising Amazon products (cross-reference signal)
7. **Sourcing tab** — search any product → see Alibaba/AliExpress supplier cards with price + MOQ
8. **Unified product card** — click any trending product → see TikTok + Amazon + Alibaba data in one modal
9. **Search bar** — search by product name, creator handle, or keyword across all three sources
10. **Date range picker** — 7d / 30d / 90d toggle (affects all charts and tables)
11. **Trend alerts** — "Notify me when [product] spikes" — stored in DB, email/in-app notification

### Other planned items
- **Stripe payment integration** — "Coming soon" in PlansModal and PlansContent
- **B2C query intelligence guard** — classify query before searching (product → proceed, unrelated → block)
- **B2C Price Activity** — save B2C search results to price activity tab
- **Real data in PriceBoardContent** — still mock data
- **Edit product** — no edit form yet, only add + deactivate
- **Wire up waitlist emails** — `TikTokTeaser.tsx` and `CreatorIntelContent.tsx` notify inputs to a DB waitlist table

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
