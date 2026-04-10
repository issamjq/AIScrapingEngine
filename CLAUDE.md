# CLAUDE.md — AI Scraping Engine Project Guide

> **This file is read automatically at the start of every Claude Code session.**
> Update it on every `git push` so the next session starts instantly with full context.

---

## Project Overview

A full-stack AI-powered price scraping and market discovery platform. B2B: UAE e-commerce retailers (Amazon AE, Noon, Carrefour, Talabat, Spinneys) track product prices. B2C: consumers search for the best prices globally using AI (like ChatGPT/Google). Uses Claude Vision AI to extract prices from screenshots and Claude web search to find product URLs.

**Current version:** v1.6.8

---

## Stable Checkpoints — "go back to stable" means restore these

| Checkpoint | Git commit | What works |
|---|---|---|
| **LATEST STABLE** | `af4b507` (v1.6.7) | B2B dual-mode discovery, notification sound, sidebar restructure, company logos, template download, per-store credits |
| **Previous stable** | `cf8f3b3` (v1.3.7) | Sidebar cleanup (no AI/Monitoring labels, no gap), Recent Searches hidden, proper skeletons for all pages, bigger mascot, top nav cleaned, model number filter removed, sidebar history scrollable. |
| **B2C old stable** | `f20dff8` (v1.0.105) | Fully AI-powered B2C: JSON-LD → Vision AI (no CSS). Overlays dismissed, scroll retry, networkidle wait, strict keyword matching, no-price results hidden, 10 sites, 4 concurrent scrapers. |

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

## Market Discovery — B2B vs B2C (BUILT)

`DiscoveringContent` routes by role: B2C → `B2CDiscoveryContent`, B2B/dev → `B2BDiscoveryContent` (internal component inside `DiscoveringContent.tsx`).

### B2C Discovery (`B2CDiscoveryContent.tsx`)
- User types any natural language product query (textarea, no format required)
- Costs **1–3 credits** per search depending on batch (Quick=1, Standard=2, Deep=3)
- Backend detects user IP → geo-lookup (ip-api.com) → country → Claude searches that country first, then globally
- Results: horizontal scrollable price cards sorted cheapest first, `line-clamp-3` title (full name visible), condition badges, Deal Score stars, discount %, image
- Visible results by plan: free=3, trial=8, pro=20 (rest blurred with upgrade overlay)
- Upgrade buttons navigate to `/plans` page (NOT modal)
- **Notification sound** plays on search complete (`src/assets/notification.mpeg`) — works on desktop (Mac + Windows), not on mobile (iOS Safari blocks async audio)
- `embedded` prop: when `true`, hides hero section + category chips — used when B2C search is embedded inside B2B AI Price Search mode

### B2B Discovery — Dual Mode (`DiscoveringContent.tsx` → `B2BDiscoveryContent`)
Two modes toggled by pill tabs:

**AI Price Search** (mode = `"ai"`):
- Renders `<B2CDiscoveryContent embedded />` — same pipeline as B2C, reuses the component
- User gets global AI price search, B2C-style results

**Catalog Discovery** (mode = `"catalog"`):
- 3-step wizard: Discover → Review → Track
- Step 1: User types product name + selects stores via **MarketplaceDropdown** (has search bar, checkboxes, Select All)
  - Live credit hint below button: `N stores · N credits will be deducted` (updates as user selects/deselects)
  - 0 stores selected → `Select at least 1 store to discover`
- Step 2: AI ThinkingLog shows per-store scan progress; Review matched products with checkboxes
- Step 3: Save + track confirmed mappings
- **Credit model: 1 credit per store searched** (via `checkUsageLimit` on `POST /api/discovery/search`)
- `handleCatalogDiscover()` fires parallel fetch to `/api/discovery/search` per store — each deducts 1 credit independently

### Credit cost summary
| Action | Credits |
|---|---|
| B2C Quick search (3 sites) | 1 credit |
| B2C Standard search (6 sites) | 2 credits |
| B2C Deep search (10 sites) | 3 credits |
| B2B AI Price Search | same as B2C above |
| B2B Catalog Discovery | 1 credit × number of stores selected |
| `dev` / `owner` | 0 always |

### What NOT to do
- Do NOT put capability toggles in Settings — they are inline in the Discovery page
- Capabilities tab has been removed from Settings
- Do NOT make Catalog Discovery a flat fee — it's intentionally per-store so users choose carefully

---

## Sidebar Structure (BUILT — `DashboardLayout.tsx`)

Three separate `<SidebarGroup>` elements to control gaps:
1. **Group 1** (no gap between items): Market Discovery + Price Activity
2. **Group 2** (gap above): Products + Stores — B2B/dev only
3. **Group 3** (gap above): Dashboard — B2B/dev only

- Dashboard is intentionally at the **bottom**, below Stores
- Default landing page = **Market Discovery** (`discovering`), not dashboard
- B2C users: only see Market Discovery + Price Activity (if on paid plan)
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
6. **Template CSV** — always use generic placeholder names (Product 1, Brand 1). Never hardcode client names (Marvis is private).

---

## Backend Key Files

| File | Purpose |
|------|---------|
| `backend/src/index.ts` | Express app entry, all routes registered here |
| `backend/src/scraper/engine.ts` | `ScraperEngine` — Playwright browser, `scrape(url)` |
| `backend/src/scraper/aiScraper.ts` | Claude Vision (`extractWithVision`) for price extraction |
| `backend/src/scraper/aiWebSearch.ts` | Claude `web_search_20250305` tool — finds product URLs by query (B2B) |
| `backend/src/scraper/priceParser.ts` | Parse price strings → numbers + currency |
| `backend/src/scraper/searchConfigs.ts` | Per-retailer Playwright search page configs |
| `backend/src/scraper/companyConfigs.ts` | Per-retailer scrape selectors |
| `backend/src/services/b2cSearchService.ts` | **B2C pipeline**: geo-aware Claude web search → parallel scrape → Vision AI → sorted results |
| `backend/src/services/discoveryService.ts` | `discoverProducts()` — Playwright + Claude matching (B2B Catalog Discovery) |
| `backend/src/services/scrapingService.ts` | Bulk scraping jobs |
| `backend/src/services/syncService.ts` | Price sync runs |
| `backend/src/services/companyService.ts` | All functions scoped by `userEmail`. `copyGlobalStoresToUser()` seeds 8 UAE stores on signup. |
| `backend/src/services/productService.ts` | All functions scoped by `userEmail`. bulkImport uses `(internal_sku, user_email)` unique index. |
| `backend/src/services/productCompanyUrlService.ts` | `getAll()` scoped by `user_email` via joined products table. |
| `backend/src/routes/discovery.ts` | `/search` (1 credit/store via `checkUsageLimit`), `/ai-search`, `/ai-match`, `/confirm`, `/probe`, `/b2c-search` (SSE streaming) |
| `backend/src/middleware/usageLimit.ts` | Deducts 1 credit per call (B2B). dev/owner bypass. Returns 429 `USAGE_LIMIT_REACHED` if balance=0. |
| `backend/src/services/plansService.ts` | `getAllPlans()`, `getPlanByKey()` — reads from `plans` DB table. |
| `backend/src/services/walletService.ts` | `getWallet()`, `createWallet()`, `deductCredit()`, **`deductCredits(n)`**, `addCredits()`, `getTransactions()`. |
| `backend/src/routes/plans.ts` | `GET /api/plans` — returns all active plans from DB. |
| `backend/src/routes/wallet.ts` | `GET /api/wallet` → `{ wallet, transactions }` (balance at `data.wallet.balance`). `POST /api/wallet/deduct` — deduct N credits (used by unlock). `POST /api/wallet/add` — admin only. |
| `backend/src/routes/allowedUsers.ts` | `GET /me`, `PUT /me`, `DELETE /me`, `POST /signup`, CRUD for management roles. `billing_renews_at` set on pro signup. |
| `backend/src/routes/export.ts` | `GET /api/export?format=json\|csv\|pdf` — downloads user data. Uses pdfkit for PDF. |
| `backend/tsconfig.json` | Must include `"lib": ["ES2020", "DOM"]` — DOM needed for Playwright page.evaluate() |

---

## Frontend Key Files

| File | Purpose |
|------|---------|
| `src/App.tsx` | State machine + **URL hash navigation**. Default page = `discovering`. Passes `role` + `onNavigate` to all pages. |
| `src/assets.d.ts` | TypeScript module declarations for `.mpeg` and `.mp3` audio assets |
| `src/assets/notification.mpeg` | Notification sound played on B2C search complete |
| `src/context/ThemeContext.tsx` | Theme provider (light/dark/system). Applies `.dark` class to `<html>`. Persists to localStorage. |
| `src/components/OnboardingContent.tsx` | Two-card B2B vs B2C picker shown to new users before dashboard access. POSTs to `/signup`. |
| `src/components/DashboardLayout.tsx` | Sidebar: 3 SidebarGroups — (1) Market Discovery+Price Activity, (2) Products+Stores B2B only, (3) Dashboard B2B only. No section labels. |
| `src/components/TopNavigation.tsx` | Top bar — sidebar trigger + title only. |
| `src/components/UserMenuButton.tsx` | Sidebar footer: avatar+initials, name, plan label, golden credit ring. Dropdown: Settings, Upgrade plan, Log out only. |
| `src/components/DiscoveringContent.tsx` | Routes by role: B2C → `B2CDiscoveryContent`. B2B/dev → `B2BDiscoveryContent` (inline) with pill toggle: AI Price Search \| Catalog Discovery. Contains `MarketplaceDropdown` (search bar + checkboxes) and `ThinkingLog`. |
| `src/components/B2CDiscoveryContent.tsx` | B2C Market Discovery UI. `embedded` prop hides hero+categories. Plays notification sound on complete. Title cards use `line-clamp-3`. |
| `src/components/PlansModal.tsx` | Plans comparison modal — shown on credit limit hit for B2B. Stripe CTA = "Coming soon". |
| `src/components/PlansContent.tsx` | Full pricing page — fetches from `/api/plans`, shows live wallet balance. |
| `src/components/PriceBoardContent.tsx` | Price activity table (mock data — real data coming) |
| `src/components/TrackedUrlsContent.tsx` | Tracked URLs — real API data from `/api/product-company-urls`. |
| `src/components/CompaniesContent.tsx` | Stores — shows `logo_url` img (falls back to Building2 icon). Add/Edit via Sheet. B2C cannot access. |
| `src/components/ProductsContent.tsx` | Products — Add via Sheet, CSV/TSV import, **Download Template** button (generic Product 1/Brand 1 placeholders). |
| `src/components/SettingsContent.tsx` | Settings — 5 tabs. Tab persisted in URL hash (`#settings:billing`). Accepts `initialTab` prop. |
| `src/components/ui/sheet.tsx` | shadcn Sheet — right side, `w-[90%] sm:w-[33vw] sm:min-w-[380px]`, overlay has `backdrop-blur-sm`. |
| `src/components/ui/textarea.tsx` | Uses `React.forwardRef` — required for ref access. |
| `src/context/AuthContext.tsx` | Firebase auth context (`useAuth()`) |
| `src/lib/firebase.ts` | Firebase client init |
| `vite.config.ts` | Injects `__APP_VERSION__` from package.json at build time. `assetsInclude: ["**/*.mpeg", "**/*.mp3"]` for audio files. |

---

## URL Hash Navigation (BUILT)

Pages persist across refresh via `window.location.hash`:
- `#discovering` (default), `#price-board`, `#products`, `#companies`, `#plans`, `#settings`, `#dashboard`
- Settings sub-tabs: `#settings:general`, `#settings:billing`, `#settings:usage`, etc.
- B2C users who land on blocked hashes (`#products`, `#companies`, `#dashboard`) → redirected to `#discovering`
- Browser back/forward works via `hashchange` listener

---

## Settings Tabs (current state)

| Tab | Status |
|-----|--------|
| General | ✅ Real — theme switcher (light/dark/system), default currency (USD/AED) stored in localStorage |
| Account | ✅ Real — edit display name (Firebase + backend), edit company name (B2B only), delete account with "DELETE MY ACCOUNT" confirm input |
| Privacy | ✅ Real — analytics/personalisation toggles (localStorage), export data as JSON/CSV/PDF |
| Billing | ✅ Real — live plan from DB, plan end date + time (trial_ends_at / billing_renews_at), "View plans" button |
| Usage | ✅ Real — live credits from `/api/wallet`, transaction history table |
| Capabilities | ❌ Removed — capability toggles are inline options in Market Discovery page |

---

## Database Schema (Neon PostgreSQL)

Key tables:
- `companies` — retailers (id, name, slug, base_url, logo_url, is_active, **user_email** — NULL=global seed, email=user-owned)
- `products` — product catalog (id, internal_name, internal_sku, brand, is_active, **user_email**)
- `product_company_urls` — maps product × company → URL (is_active, last_status, last_checked_at)
- `price_snapshots` — scraped prices (price, original_price, currency, availability, scrape_status, checked_at)
- `company_configs` — per-company scraper config (selectors, page_options)
- `sync_runs` — scraping job history
- `allowed_users` — whitelist + subscription info (role, subscription, trial_ends_at, **billing_renews_at**, **company_name**, **firebase_uid**, **signup_ip**)
- `plans` — all plan definitions (key, name, credits_b2b, credits_b2c, features_b2b JSONB, features_b2c JSONB, is_coming_soon, sort_order)
- `user_wallet` — one row per user (balance, total_added, total_used)
- `wallet_transactions` — immutable log of every credit change (amount, balance_after, type, description)
- `currency_rates` — USD→AED rate (seeded: 1 USD = 3.65 AED)
- `b2c_search_history` — B2C search results saved for unlock feature (user_email, query, results JSONB, batch)

**Multi-tenancy:** `user_email` column on `products` and `companies`. Global seed stores have `user_email IS NULL`. Slug uniqueness is per-user: `(slug, user_email)`. SKU uniqueness: `(internal_sku, user_email)`.

**Trial abuse prevention:** `firebase_uid` (one trial per Google account) + `signup_ip` (30-day IP cooldown).

---

## API Routes

All routes are protected by `requireAuth` (Firebase Bearer token). All data routes are scoped to `req.email`.

```
GET    /api/allowed-users/me       ← Access check; returns NEW_USER (403) for unknowns
PUT    /api/allowed-users/me       ← Update own name / company_name
DELETE /api/allowed-users/me       ← Delete own account + all data (FK-safe cascade)
POST   /api/allowed-users/signup   ← Self-serve signup: creates trial user, checks UID+IP, seeds stores

POST /api/discovery/ai-search    ← B2B: Claude web search → find product URLs (1 credit)
POST /api/discovery/ai-match     ← B2B: Claude matches discovered URLs to product catalog (1 credit)
POST /api/discovery/confirm      ← B2B: Save confirmed product→URL mappings (no credit)
POST /api/discovery/search       ← B2B Catalog Discovery: Playwright scrape per store (1 credit per call via checkUsageLimit)
POST /api/discovery/probe        ← Detect search URL pattern for a website
POST /api/discovery/b2c-search   ← B2C: SSE stream — web search + scrape + Vision AI (1–3 credits by batch)
GET  /api/discovery/b2c-history  ← Last 20 B2C searches for this user
POST /api/discovery/b2c-unlock   ← Unlock blurred results (1 credit per result)

GET  /api/companies              ← List user's stores (user_email scoped)
POST /api/companies              ← Create store
PUT  /api/companies/:id          ← Edit store (name, base_url, is_active, logo_url)
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
GET  /api/wallet                 ← Current user's wallet: { wallet: { balance, ... }, transactions: [...] }
POST /api/wallet/deduct          ← Deduct N credits (used for unlock; dev/owner skip deduction)
POST /api/wallet/add             ← Manually add credits (dev/admin use)
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
- Step 2: Claude web search with geo-aware prompt (searches user's country first, then global)
- Step 3: Parallel Playwright scrape with Vision AI auto-fallback
- Step 4: Sort results by price ascending, save to `b2c_search_history`
- Returns: `B2CResult[]` with `{ retailer, url, title, condition, price, originalPrice, currency, availability, imageUrl, priceSource }`
- Per-retailer locking: first result per retailer = full data, rest = locked stubs (no price/title sent to browser)

### AI Auto-Matching (B2B)
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

- B2B Catalog Discovery: 1 credit per store (via `checkUsageLimit` on each `/api/discovery/search` call)
- B2C search: 1–3 credits by batch via `deductCredits(email, credits, description)`
- Balance = 0 → 429 `USAGE_LIMIT_REACHED` → B2B shows PlansModal, B2C navigates to plans page
- Stripe top-up = **not yet built**
- Wallet response format: `data.wallet.balance` (NOT `data.balance`)

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
- **Upgrade actions for B2C:** always `onNavigate("plans")` — never PlansModal popup
- **Price card titles:** `line-clamp-3` (not 2) — product names can be long

---

## Planned / Coming Next

- **B2C query intelligence guard** — classify query before searching: product → proceed, how-to → suggest product terms, unrelated → block (no credit deduction)
- **B2C Price Activity** — save B2C search results to price activity tab (design TBD)
- **Stripe payment integration** — "Coming soon" in PlansModal and PlansContent
- **Real data in PriceBoardContent** — still mock data
- **Edit product** — no edit form yet, only add + deactivate

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
