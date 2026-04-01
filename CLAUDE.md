# CLAUDE.md — AI Scraping Engine Project Guide

> **This file is read automatically at the start of every Claude Code session.**
> Update it on every `git push` so the next session starts instantly with full context.

---

## Project Overview

A full-stack AI-powered price scraping and market discovery platform for UAE e-commerce retailers (Amazon AE, Noon, Carrefour, Talabat, Spinneys). It tracks product prices across retailers, uses Claude Vision AI to extract prices from screenshots, and uses Claude web search to auto-discover product listing URLs.

**Current version:** v1.0.13

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
| `backend/src/routes/discovery.ts` | `/api/discovery/search`, `/ai-search`, `/confirm`, `/probe` |
| `backend/tsconfig.json` | Must include `"lib": ["ES2020", "DOM"]` — DOM needed for Playwright page.evaluate() |

---

## Frontend Key Files

| File | Purpose |
|------|---------|
| `src/App.tsx` | Router, sidebar nav |
| `src/components/DashboardLayout.tsx` | Shell with sidebar |
| `src/components/DiscoveringContent.tsx` | Market Discovery — AI web search, confirm dialog links results to products via `/api/discovery/confirm` |
| `src/components/PriceBoardContent.tsx` | Price activity table (mock data) |
| `src/components/TrackedUrlsContent.tsx` | Tracked product URLs (mock data) |
| `src/components/CompaniesContent.tsx` | Retailers/companies (mock data) |
| `src/components/ProductsContent.tsx` | Product catalog — real data from API + CSV/TSV import with brand filter dialog |
| `src/context/AuthContext.tsx` | Firebase auth context (`useAuth()`) |
| `src/lib/firebase.ts` | Firebase client init |
| `vite.config.ts` | Injects `__APP_VERSION__` from package.json at build time |

---

## Database Schema (Neon PostgreSQL)

Key tables:
- `companies` — retailers (id, name, slug, base_url, is_active)
- `products` — product catalog (id, internal_name, internal_sku, brand, is_active)
- `product_company_urls` — maps product × company → URL (is_active, image_url)
- `price_snapshots` — scraped prices (price, original_price, currency, availability, scrape_status, checked_at)
- `company_configs` — per-company scraper config (selectors, page_options)
- `sync_runs` — scraping job history
- `allowed_users` — whitelist of Firebase UIDs allowed to access the app

> **Pending:** Schema SQL still needs to be pasted into Neon SQL editor if DB was reset.

---

## API Routes

All RSP routes are protected by `requireAuth` (Firebase Bearer token).

```
POST /api/discovery/ai-search    ← NEW: Claude web search → find product URLs
POST /api/discovery/search       ← Playwright discovery on company search page
POST /api/discovery/confirm      ← Save confirmed product→URL mappings
POST /api/discovery/probe        ← Detect search URL pattern for a website

GET  /api/companies              ← List retailers
GET  /api/products               ← List product catalog
GET  /api/product-company-urls   ← Tracked URLs
GET  /api/price-snapshots        ← Price history
POST /api/scraper/scrape         ← Scrape a single URL
POST /api/sync-runs              ← Trigger bulk sync
GET  /api/stats                  ← Dashboard stats
GET  /api/allowed-users          ← User whitelist management
```

---

## AI Features

### Claude Vision (existing)
- File: `backend/src/scraper/aiScraper.ts`
- Takes a screenshot of the product page → sends to Claude → extracts price, title, availability, originalPrice
- Used in `ScraperEngine.scrape()` when `ANTHROPIC_API_KEY` is set

### Claude Web Search (v1.0.5+)
- File: `backend/src/scraper/aiWebSearch.ts`
- Uses `claude-haiku-4-5-20251001` with `web_search_20250305` tool + `anthropic-beta: web-search-2025-03-05` header
- Hard 30-second AbortController timeout
- Input: product query + list of retailers → Output: `[{retailer, url, title}]`
- Prompt enforces: exact size match, exact flavor/variant match, no bundle packs, direct product pages only
- Endpoint: `POST /api/discovery/ai-search`
- Frontend: `DiscoveringContent.tsx` — retailer checkboxes, search, results, confirm-to-track

### AI Auto-Matching (v1.0.9+)
- Endpoint: `POST /api/discovery/ai-match` (inline in `backend/src/routes/discovery.ts`)
- Takes discovered `[{retailer, url, title}]` → fetches product catalog from DB → calls Claude haiku (no web search) → returns each item with `match: {id, name, brand}` and `confidence: 0–1`
- Frontend match dialog:
  - Pre-selects only confidence ≥ 85% (green)
  - 60–84% shown as "possible match" (yellow), not pre-selected
  - <60% / no match shown as "No match found"
  - "Change" button on every matched item → inline catalog search picker
  - "Assign product" button on unmatched items → same inline picker
  - Select All / Deselect All controls
  - Saves via `POST /api/discovery/confirm` grouped by company_id

### Company Matching (DiscoveringContent.tsx — `matchCompany()`)
- When saving confirmed URLs, maps retailer string → company in DB
- **Primary:** domain from result URL matched against company `base_url` (most reliable)
- **Fallback:** keyword matching on company name/slug/base_url (skips generic words: ae, uae, grocery, etc.)

---

## Planned Features (not yet built)

- **Blur on discovery results is temporarily OFF** — `FREE_LIMIT = Infinity` in `DiscoveringContent.tsx`. To re-enable change it back to `3`. The blur/upgrade-CTA code is fully built and works — just the constant controls it.
- **SQL schema on Neon** — user still needs to paste `backend/sql/schema.sql` into Neon SQL editor
- **Real data in frontend pages** — PriceBoardContent, TrackedUrlsContent, CompaniesContent still use mock data
- **Add Product button** in ProductsContent is disabled (placeholder) — not yet implemented

## Discovery Flow (end-to-end)

1. User types product query + selects retailers → `POST /api/discovery/ai-search`
2. Claude web-searches → returns `[{retailer, url, title}]` (strict exact-match prompt)
3. User checks the results they want → clicks "AI Match & Add to Tracked"
4. `POST /api/discovery/ai-match` → Claude matches titles to catalog → returns confidence scores
5. Dialog shows: ≥85% pre-selected (green "matched to"), <85% unselected (yellow "possible match"), 0% = "No match"
6. User can click "Change" / "Assign product" on any row → inline catalog picker opens
7. User confirms selection → `POST /api/discovery/confirm` per company → saves to `product_company_urls`

---

## Version / Push Workflow

```bash
# Before every push:
node scripts/bump-version.mjs
git add package.json <changed files>
git commit -m "feat/fix: description\n\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
git push
# NEVER stage .github/workflows/ files
```
