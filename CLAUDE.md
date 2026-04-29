# CLAUDE.md — AI Scraping Engine Project Guide

> **This file is read automatically at the start of every Claude Code session.**
> Update it on every `git push` so the next session starts instantly with full context.

---

## Project Overview

A full-stack AI-powered price scraping and market discovery platform. B2B: UAE e-commerce retailers (Amazon AE, Noon, Carrefour, Talabat, Spinneys) track product prices. B2C: consumers search for the best prices globally using AI (like ChatGPT/Google). Uses Claude Vision AI to extract prices from screenshots and Claude web search to find product URLs.

**Current version:** v2.2.9 (package.json semver: v1.0.61)

---

## Blog (BUILT — Wix-style WYSIWYG)

Public blog at `#blog` with simplified Wix-clone admin. Author always shows as **"Spark"** publicly (forced in backend, not user-selectable).

### DB columns on `blog_posts`
- `view_count INTEGER DEFAULT 0` — incremented by `POST /api/blog/posts/:slug/view`
- `content_format VARCHAR(10) DEFAULT 'html'` — new posts are HTML (Tiptap), 1 legacy post still 'markdown'

### Admin editor — [src/components/BlogAdminContent.tsx](src/components/BlogAdminContent.tsx)
Stripped to: Title, Cover image URL, Excerpt, Content (Tiptap WYSIWYG), Search engine listing (slug). **No tags, no status dropdown, no author field.** Footer has two buttons: "Save as draft" and "Publish/Update". Loading a legacy markdown post auto-converts to HTML via `marked` so the rich editor displays it cleanly.

### WYSIWYG editor — [src/components/TiptapEditor.tsx](src/components/TiptapEditor.tsx)
Tiptap (`@tiptap/react` + StarterKit + Underline + Link + Image + TextAlign + Placeholder). Toolbar has: H1/H2/H3, B/I/U/S/inline-code, bullet/numbered/quote, align L/C/R, link, image, undo/redo. Outputs HTML. Used inside the editor sheet.

### Public listing — [src/landing/BlogSection.tsx](src/landing/BlogSection.tsx)
4-column responsive grid (xl:4 / lg:3 / sm:2). Each card: cover image (4:3) + Spark logo avatar + "Spark" + relative date + read time + title + excerpt + view count + share button. **No tag filter, no featured hero, no comments, no likes.**

### Single post — [src/landing/BlogPostPage.tsx](src/landing/BlogPostPage.tsx)
Renders HTML content via `DOMPurify.sanitize` (or markdown via ReactMarkdown for legacy posts). On mount: sessionStorage-deduped POST to `/view` so refresh ≠ extra view. Shows Spark avatar + author + date + read time + share button at top.

### Share popover — [src/landing/SharePopover.tsx](src/landing/SharePopover.tsx)
Radix Popover. Buttons: Facebook, X (inline SVG), LinkedIn, Copy URL. Copy shows checkmark for 1.8s. Two sizes via `large` prop (icon-only on cards, pill button on post page).

### Backend API — [backend/src/routes/blog.ts](backend/src/routes/blog.ts)
Public reads always return `author_name: "Spark"` and a derived `read_minutes` (from word count, ~200 wpm). New endpoint `POST /api/blog/posts/:slug/view` increments `view_count` (no auth, public). Create/update accept `content_format: "html" | "markdown"` (defaults to `html`).

---

## Stable Checkpoints — "go back to stable" means restore these

| Checkpoint | Git commit | What works |
|---|---|---|
| **LATEST STABLE** | `0d2d98a` (v2.2.9) | AliExpress via local home-PC scraper, original_price extraction, iHerb+Banggood hidden, eBay+Alibaba tabs live |
| **Pre-local-scraper** | `ea131e9` (v1.10.2) | Creator Intel — Kalodata UI, amazon.com scraper, real rank history, sparkline tooltips, sticky filter buttons |
| **Previous stable** | `fa1bcf0` (v1.9.10) | Kalodata-style Creator Intel full rewrite, amazon.com BSR Playwright scraper, all filters working |
| **Old stable** | `05e7938` (v1.7.4) | Landing page, subscription system v2, daily/weekly/cycle limits, new plan config, usage UI |

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

### Privileged accounts (require TOTP / Google Authenticator at login)
- `mhmdkrissaty@gmail.com` → `role = "owner"` (super-admin) — only account that can manage other users (block, promote, demote, delete)
- `issa.mjq@gmail.com` → `role = "dev"` — full dev access, also gets the Super Admin tab for testing
- Dev + owner bypass all credit deductions (backend `UNLIMITED_ROLES = ["dev", "owner"]`)
- Both see every page in the app
- `karaaliissa@gmail.com` → demoted to `role = "b2b"` (no longer privileged)
- Admin-allowlist email set lives in 5 places: `App.tsx`, `DashboardContent.tsx`, `routes/adminStats.ts`, `routes/adminUser.ts`, `routes/broadcasts.ts`. Update all together.

### Test B2B account
- `karooorak3@gmail.com` — B2B user with 14 stores seeded in Neon (with logo_url)

---

## Landing Page (BUILT — `src/landing/`)

Public marketing page. **Stays visible after sign-in** — users only enter the app when they click a specific product. This is intentional: the landing page is the home for both authenticated and unauthenticated visitors.

### Structure
```
src/landing/
  LandingPage.tsx           ← orchestrator; reads useAuth() directly; wraps everything with Geist font + overflow-x: clip; renders ScrollProgressBar at top
  LandingNav.tsx            ← sticky glass-morph nav (blur + subtle shadow on scroll); mega-menu (2 products + "See pricing" footer row)
  HeroSection.tsx           ← headline + CTAs + interactive mockup; mouse-tracked amber spotlight (--mx/--my CSS vars); grid-pattern bg w/ radial mask; triple aurora blobs + grain overlay; cycling demo queries (Sony/Dyson/AirPods) with typing animation; magnetic primary CTA; staggered entrance via .hero-item + heroIn keyframe
  StatsBar.tsx              ← infinite retailer marquee (16 UAE retailers, 4-copy render + -25% shift for ultra-wide safety) + brand-colored accent dot per name with alternating weights/opacity; 4-stat row below with AnimatedCounter on "10+"
  ShowcaseSection.tsx       ← reusable split section; accent prop ("amber" | "blue" | "green" | "purple") drives gradient bar, checkmark color, ambient glow behind visual; wraps text + each feature bullet + visual in Reveal
  ShowcaseVisuals.tsx       ← B2BVisual (price deltas w/ trend arrows), B2CVisual (phase checks + locked-result teaser), PriceChartVisual (real SVG area chart w/ gradient fill + pulsing current dot)
  BentoGrid.tsx             ← 6-col mosaic feature section; big Vision AI hero tile (4×2 with hover glow + mini-metric cards) + 5 smaller tiles (retailers count, 24/7 sync, alerts, export formats, speed) + wide SOC-ready security tile at bottom
  StickyScrollSection.tsx   ← 4-step AI pipeline (Capture → Vision AI reads → Normalize/validate → Trigger alerts) with scroll-linked cross-fade. Wrapper = STEPS.length × 65vh, inner sticky top-0 h-screen. Progress mapped to step index via getBoundingClientRect on wrapper. REQUIRES overflow-x: clip (NOT hidden) on ancestor.
  HowItWorks.tsx            ← 3-step timeline; giant ghost step numbers, gradient icon tiles, grid-pattern backdrop; staggered Reveal (140ms per card)
  TestimonialsSection.tsx   ← 3 testimonial cards (tinted gradient bgs + Quote icon) + metrics strip with AnimatedCounter (4.3% decimals=1, <3s, 10+ all count up; "24/7" stays static)
  TikTokTeaser.tsx          ← coming-soon gradient section; scroll reveals on header + 4 feature cards (100ms stagger)
  FAQSection.tsx            ← 8 Q&A addressing real objections (spreadsheets, retailer blocks, accuracy, data safety, trial, credits, team accounts); Plus icon rotates 45° on open; content expands via grid-template-rows 0fr→1fr trick
  LandingCTA.tsx            ← final CTA w/ aurora mesh + grid overlay + grain + rounded-28px card; magnetic primary CTA; 3 plan cards with "Popular" pill on Pro; trust bullets row
  LandingFooter.tsx         ← links + brand
  ScrollProgressBar.tsx     ← fixed 2px top bar, amber→orange→rose gradient, z-[60], updates width via useScrollProgress hook
  AnimatedCounter.tsx       ← counts up from 0 to value when scrolled into view; props: value, decimals, prefix, suffix, duration, className; uses useInViewOnce + useCountUp
  Reveal.tsx                ← scroll-triggered entrance wrapper; props: delay, duration, y, x, scale, as ("div"|"section"|"article"|"li"); uses cubic-bezier(0.16, 1, 0.3, 1); respects prefers-reduced-motion
  useInView.ts              ← IntersectionObserver hook (threshold 0.15, rootMargin "0px 0px -80px 0px"); disconnects after first intersection; reduced-motion = reveal immediately
  utils.ts                  ← shared hooks + constants: useMouseGlow (sets --mx/--my on ref'd el), useMagnetic (translate3d toward pointer), useScrollProgress (0..1), useCountUp (easeOutCubic raf), useInViewOnce (variant with threshold 0.3), GRAIN_SVG (data URI feTurbulence noise for mix-blend-overlay), formatCount
```

### Landing page section order (top → bottom)
1. ScrollProgressBar (fixed)
2. LandingNav (fixed)
3. HeroSection
4. StatsBar (retailer marquee + stats)
5. ShowcaseSection × 3 (B2B blue, B2C green reversed, Price History purple)
6. BentoGrid
7. StickyScrollSection
8. HowItWorks
9. TestimonialsSection
10. TikTokTeaser
11. FAQSection
12. LandingCTA
13. LandingFooter

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

### Mega-menu structure — two products (680px wide, 1.2:1 grid)
**Left card — Market Intelligence** (our price scraping engine):
- Amber gradient tint + "Live" emerald badge + dashed divider
- Sub-items: Market Discovery (`#discovering`), Price Tracking (`#price-board`), Catalog Discovery (`#discovering`)
- Each sub-item: icon tile scales on hover, arrow slides in from the right

**Right card — Creator Intelligence** (kalodata-style TikTok product):
- Pink/purple gradient tint + shimmer sweep on hover
- "Q3 2026" pill with pulsing dot
- Clicking → sign in → opens `#creator-intel` route

**Footer row** (below the two cards):
- Left: `<Zap/> Every plan includes Vision AI`
- Right: `See pricing →` link (sets `window.location.hash = "pricing"`)

**Animation — IMPORTANT structural rule:**
Positioning (`absolute left-1/2 -translate-x-1/2`) and the entrance animation MUST live on separate elements. Otherwise Tailwind's `transform: translateX(-50%)` and the keyframe's `transform` fight each other and the menu flashes off-center before settling. Pattern:
```tsx
<div className="absolute left-1/2 -translate-x-1/2 w-[680px]">  {/* positioning only */}
  <div className="origin-top animate-[megaIn_220ms_cubic-bezier(0.16,1,0.3,1)_both]">
    {/* card + footer */}
  </div>
</div>
```
`megaIn` keyframe = `opacity 0→1` + `translateY(-8px)→0` + `scale(0.97→1)`. `origin-top` so it grows downward from the Products button.

### Key behaviors
- **Light mode is the default** for visitors with no saved theme preference
- Mega-menu uses 150ms close delay + `pt-3` invisible bridge so mouse can cross the gap
- All CTAs use `onAction(target?)` — same handler for signed-in and signed-out states
- **No Claude AI branding** anywhere — all references are "Spark AI" or "Spark Vision AI"
- When logged in: "Get Started Free" → "Open Market Intelligence"; "Sign in" → removed; "Get Started Free" in CTA → "Open App"
- **Scroll animations:** every section below the hero uses `<Reveal>` from `./Reveal` with scroll-triggered fade-up + optional scale. Stagger grid items by passing `delay={i * 120}`. Do NOT put hover transforms on the Reveal itself — they'll be overridden; wrap the inner card with a plain div that owns the hover classes.
- **Hero entrance:** uses CSS animations (`.hero-item` + `heroIn` keyframe), not Reveal, because hero is always above the fold. Delays are set via inline `style={{ animationDelay: "..." }}` (0, 120, 220, 300, 320, 420ms).
- **Smooth scroll:** `html { scroll-behavior: smooth }` set globally in `src/styles/globals.css` (with reduced-motion override).
- **Retailer strip brand colors:** dots use inline `style={{ backgroundColor }}` (not Tailwind classes — colors come from `RETAILERS[].color` data). To add a retailer, add a new row with `{ name, color: "#HEX" }`.
- **Geist display font:** loaded via Google Fonts in `index.html` (weights 400/500/600/700/800). Applied ONLY to the landing page via inline `fontFamily` on the `.landing-root` div — does NOT affect the in-app UI.
- **overflow-x: clip, NOT overflow-x-hidden** on `.landing-root`. `overflow-x: hidden` creates a containing block that breaks CSS `position: sticky` on descendants (StickyScrollSection stops sticking). Always use `overflowX: "clip"` via inline style. This is a load-bearing choice.
- **Mouse-tracked glow:** `useMouseGlow()` returns a ref; set `pointermove` listener updates `--mx` / `--my` CSS vars in % of the element's bbox. Use in background: `background: "radial-gradient(600px circle at var(--mx,50%) var(--my,30%), rgba(245,158,11,0.18), transparent 60%)"`.
- **Magnetic buttons:** `useMagnetic(strength)` returns a button ref that translate3d's toward the cursor based on offset × strength, springs back on `pointerleave`. Set `transition: transform 250ms cubic-bezier(0.16,1,0.3,1)` inline on the button. Default strength 0.2 (hero) / 0.18 (CTA).
- **Grain overlay:** `GRAIN_SVG` from `./utils` is a data-URI feTurbulence noise. Apply as `backgroundImage` on a `mix-blend-overlay` layer at 8% light / 12% dark opacity.
- **Animated counters:** any value that's purely numeric counts up when scrolled in — use `<AnimatedCounter value={4.3} decimals={1} suffix="%" />`. For non-numeric labels ("24/7", "Vision"), render as plain text, don't wrap them.
- **Hero cycling demo:** `DEMOS[]` array in HeroSection drives a 5.5s rotation; each demo has `query`, `results[]`, `saves`. Typer component progressively reveals the query (45ms/char). Rows stagger in via `rowIn` keyframe on index change. Progress dots below are clickable to jump.
- **StickyScrollSection math:** wrapper height = `STEPS.length * 65vh`. Step index derived from `-r.top / (wrapper.offsetHeight - vh)` × STEPS.length. Don't go above 65vh per step or the section feels empty/slow; don't go below 50vh or it rushes.

### What NOT to do on landing page
- Do NOT mention Claude anywhere on the public-facing landing page
- Do NOT add max-width constraints to sections — they should fill full width
- Do NOT wire the TikTok/Creator notify email yet — it's coming later
- Do NOT set `showLanding = false` unless user has clicked into a specific product
- Do NOT use real retailer logos — use brand-name wordmarks with colored accent dots (legal safety: Amazon/Noon/Carrefour etc. are competitors being tracked, not partners — logos imply partnership we don't have)

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
2. **Group 2** (gap above): Creator Intel v2 (`#creator-intel`) + Creator Intel Old (`#creator-intel-backup`) — both use Sparkles icon, all roles
3. **Group 3** (gap above): Products + Stores — B2B/dev only
4. **Group 4** (gap above): Dashboard — B2B/dev only

- Dashboard is intentionally at the **bottom**, below Stores
- Default landing page = **Market Discovery** (`discovering`), not dashboard
- B2C users: see Market Discovery + Price Activity (if paid plan) + both Creator Intel entries
- Recent Searches section = hidden (`{false && isB2C && ...}`)
- No section labels (no "Catalog", no "AI", no "Monitoring" text)
- **"Creator Intel (Old)"** = `CreatorIntelContent.tsx` — keeps the original working Kalodata-style UI (Apify + web search data, blurred sections, dummy data fallback). Keep until v2 is proven.
- **"Creator Intel"** = `CreatorIntelV2Content.tsx` — the new clean dashboard. This is the active build target.

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
| `src/landing/LandingPage.tsx` | Orchestrator. Reads `user` from `useAuth()` directly. Wraps everything with Geist font + `overflowX: "clip"` (NOT hidden). Renders ScrollProgressBar + all section components in order. Accepts `onNavigateToApp` prop from App.tsx. |
| `src/landing/LandingNav.tsx` | Sticky glass-morph nav. Two-product mega-menu with "See pricing" footer row. Mega-menu animation lives on INNER div (positioning on outer). Shows avatar + "Open App" when `isLoggedIn`. |
| `src/landing/HeroSection.tsx` | Hero: headline, mockup, CTAs. Mouse-tracked glow (`useMouseGlow`), magnetic primary CTA (`useMagnetic`), grain overlay, cycling demo queries (`DEMOS` array, 5.5s), typing animation, clickable progress dots. |
| `src/landing/StatsBar.tsx` | Retailer marquee (16 names, 4 copies, -25% shift, brand-colored dots, alternating weights/opacity) + 4-stat row w/ AnimatedCounter on "10+". |
| `src/landing/ShowcaseSection.tsx` | Reusable alternating split section with `accent` prop ("amber"/"blue"/"green"/"purple") — drives gradient bar, checkmark, ambient glow. Wraps text + features + visual in Reveal. |
| `src/landing/ShowcaseVisuals.tsx` | B2BVisual (trend arrows), B2CVisual (phase checks + locked result), PriceChartVisual (SVG area chart w/ gradient fill) — UI mockup components. |
| `src/landing/BentoGrid.tsx` | 6-col mosaic. Big Vision AI hero tile (4×2) + 5 smaller tiles (retailers count animated, 24/7 sync, alerts, export formats, speed) + wide security tile. |
| `src/landing/StickyScrollSection.tsx` | 4-step AI pipeline w/ scroll-linked cross-fade. Wrapper = `STEPS.length × 65vh`. Sticky inner div (`top-0 h-screen`) — REQUIRES `overflow-x: clip` on `.landing-root`, breaks with `overflow-x: hidden`. |
| `src/landing/HowItWorks.tsx` | 3-step process with giant ghost step numbers + gradient tiles + grid backdrop. |
| `src/landing/TestimonialsSection.tsx` | 3 testimonial cards + metrics strip w/ AnimatedCounter (4.3%, <3s, 10+ count up; "24/7" static). |
| `src/landing/TikTokTeaser.tsx` | TikTok Intelligence coming-soon section. |
| `src/landing/FAQSection.tsx` | 8 Q&A accordion. Plus-icon rotates 45° on open. Content expands via grid-template-rows 0fr→1fr trick. |
| `src/landing/LandingCTA.tsx` | Final CTA w/ aurora + grid + grain. Magnetic primary CTA. 3 plan cards, "Popular" pill on Pro. |
| `src/landing/LandingFooter.tsx` | Footer with links. |
| `src/landing/ScrollProgressBar.tsx` | Fixed 2px amber→orange→rose gradient bar at top of page (z-[60]). Uses `useScrollProgress` hook. |
| `src/landing/AnimatedCounter.tsx` | Counts up from 0 to `value` when scrolled into view. Props: `value`, `decimals`, `prefix`, `suffix`, `duration`. For static labels like "24/7" render plain text, don't wrap in this. |
| `src/landing/Reveal.tsx` | Scroll-triggered entrance wrapper. Props: `delay`, `duration`, `y`, `x`, `scale`, `as`. DON'T put hover transforms on Reveal — they'll be overridden; wrap inner card in a plain div with hover classes. |
| `src/landing/useInView.ts` | IntersectionObserver hook for Reveal (threshold 0.15, rootMargin -80px bottom). |
| `src/landing/utils.ts` | Shared hooks + constants: `useMouseGlow`, `useMagnetic`, `useScrollProgress`, `useCountUp`, `useInViewOnce`, `GRAIN_SVG` data URI, `formatCount`. |
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
| `src/components/CreatorIntelContent.tsx` | **Creator Intel** (`#creator-intel`) — ACTIVE BUILD. Full Kalodata-style Amazon BSR dashboard. AI suggestion bar, search, filtering conditions strip, left filter panel (sticky Submit/Reset, hidden scrollbar), table with hover-zoom images, BS/AC/#1 badges, real sparkline (rank history from API), estimated Item Sold (rank×reviews formula), action buttons. Dev-only "Refresh Data" button. |
| `src/components/CompaniesContent.tsx` | Stores — shows `logo_url` img. Add/Edit via Sheet. B2C cannot access. |
| `src/components/ProductsContent.tsx` | Products — Add via Sheet, CSV/TSV import, Download Template button. |
| `src/components/SettingsContent.tsx` | 5 tabs. UsageTab: 3 progress bars (daily/weekly/cycle) from `GET /api/wallet/usage`. |
| `src/context/AuthContext.tsx` | Firebase auth context (`useAuth()`) |
| `src/lib/firebase.ts` | Firebase client init |
| `vite.config.ts` | Injects `__APP_VERSION__`. `assetsInclude: ["**/*.mpeg", "**/*.mp3"]` for audio. |

---

## URL Hash Navigation (BUILT)

Pages persist across refresh via `window.location.hash`:
- `#discovering` (default), `#price-board`, `#products`, `#companies`, `#plans`, `#settings`, `#dashboard`, `#creator-intel`, `#creator-intel-backup`
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

GET  /api/creator-intel/trending          ← TikTok trending products (filterable: category, sortBy, days, limit, offset)
GET  /api/creator-intel/categories        ← Category GMV breakdown from tiktok_products table
GET  /api/creator-intel/amazon-trending   ← Amazon BSR latest per ASIN (DISTINCT ON subquery); filterable: category, marketplace, limit, offset
GET  /api/creator-intel/amazon-history    ← All rank snapshots grouped by ASIN { [asin]: [{rank, date}] } — used for real sparklines
GET  /api/creator-intel/freshness         ← Last scrape timestamps + product counts for TikTok + Amazon
POST /api/creator-intel/scrape-tiktok     ← Trigger TikTok scrape (dev/owner only) — uses Apify if APIFY_API_KEY set, else Claude web_search
POST /api/creator-intel/scrape-amazon     ← Trigger Amazon BSR scrape (dev/owner only) — Playwright on amazon.com, plain INSERT (accumulates history)
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

## Creator Intelligence — What It Is & Why

**The product:** Our answer to [Kalodata.com](https://kalodata.com) — a TikTok Shop analytics SaaS that charges $50–$300/month. We're building the same thing inside Spark AI, but cross-platform (TikTok + Amazon + eventually Alibaba) and UAE/MENA focused.

**The vision — TikTok → Amazon → Alibaba pipeline:**
```
1. DISCOVER  → Find trending products on TikTok Shop (what's going viral)
2. VALIDATE  → Cross-check if the same product is selling on Amazon (proof of demand)
3. SOURCE    → Find the cheapest supplier on Alibaba/AliExpress (where to buy it)
4. TRACK     → Monitor price changes across all three platforms over time
```

---

## Creator Intelligence — Current State (as of v2.2.9)

### What is BUILT ✅

**Sidebar (DashboardLayout.tsx):**
- Single entry: "Creator Intel" → `#creator-intel` → `CreatorIntelContent.tsx`
- `CreatorIntelV2Content.tsx` was removed — merged into `CreatorIntelContent.tsx`
- `#creator-intel-backup` route removed from App.tsx and VALID_PAGES

**Backend (fully working):**
- `backend/src/scraper/tiktokScraper.ts` — Claude `web_search_20250305` searches kalodata/shoplus/pipiads for trending TikTok products, then Claude haiku extracts JSON
- `backend/src/scraper/apifyTikTokScraper.ts` — Apify `clockworks~tiktok-scraper` actor: real TikTok videos → Claude extracts products
- `backend/src/scraper/amazonBestSellers.ts` — **Real Playwright scraper** hitting amazon.com/gp/bestsellers for 10 categories. Extracts: ASIN, product_name, brand, rank, price, **original_price**, rating, review_count, image_url, product_url, badge (Best Seller / Amazon's Choice), marketplace=US
- `backend/src/scraper/alibabaBestSellers.ts` — Playwright scraper using `window.runParams` + DOM fallback. **Runs via local home-PC server** (residential IP) — Render IPs are blocked by AliExpress. Extracts price + original_price from `prices.salePrice` / `prices.originalPrice` fields
- `backend/src/scraper/banggoodBestSellers.ts` — Claude Vision scraper (screenshot → haiku). **Tab hidden** — blocked on Render datacenter IPs. To re-enable: add to local-scraper.ts + re-add tab in CreatorIntelContent.tsx
- `backend/src/scraper/iherbBestSellers.ts` — Claude Vision scraper. **Tab hidden** — Cloudflare blocks Render IPs. Same fix path as Banggood
- `backend/src/scraper/ebayBestSellers.ts` — Official eBay Finding API (no Playwright). Needs `EBAY_APP_ID` env var in Render
- `backend/local-scraper.ts` — **Local home-PC Express server** on port 3099. Exposes `POST /scrape-aliexpress`. Run with `npm run local-scraper` from backend dir. Exposed via Cloudflare Tunnel → URL set as `LOCAL_SCRAPER_URL` in Render env vars
- `backend/src/services/creatorIntelService.ts`:
  - `runAmazonScrape`: plain INSERT per scrape run — **no upsert, no dedup** — accumulates history rows
  - `getAmazonTrending`: `DISTINCT ON (COALESCE(asin, product_name))` subquery ordered by `scraped_at DESC` → returns latest per product, then sorted by rank ASC
  - `getAmazonRankHistory`: returns all historical `{ rank, date }` snapshots grouped by ASIN, only for ASINs with ≥2 data points
- `backend/src/routes/creatorIntel.ts` — all API routes, admin-only scrape triggers

**DB tables (live in Neon):**
- `tiktok_products` — product_name, category, tiktok_price, gmv_7d, units_sold_7d, growth_pct, video_count, top_creator_handle, shop_name, image_url, scraped_at
- `amazon_trending` — asin, product_name, category, rank, price, **original_price** (DECIMAL — crossed-out price when sale is active), rating, review_count, image_url, product_url, badge, brand, marketplace, scraped_at
  - **No unique constraint on asin** — multiple rows per ASIN (one per scrape run) = historical data
  - `original_price` column added via `ALTER TABLE amazon_trending ADD COLUMN IF NOT EXISTS original_price DECIMAL(10,2)`

**Frontend (`CreatorIntelContent.tsx`) — Kalodata-style:**
- AI suggestion bar (blue gradient)
- Search bar (white, gray icon, no blue background)
- Filtering conditions strip with dismissible chips
- Left filter panel (220px): Dates (L30/L60/L90), Category, Price range, Number of Ratings, Rating, Biggest Movers Rank, + coming-soon groups (Monthly BSR Growth Rate, Item Sold, Revenue, Weight, Size, FBA Fee, Gross Margin, On-shelf Time, Product Flag, Competition Info)
- **Submit/Reset buttons**: `sticky bottom-0` inside single `overflow-y-auto` container → always visible, no flex height bugs
- Filter panel scrollbar: hidden via `::-webkit-scrollbar` + `scrollbarWidth: none`
- Table columns: Product Info (image h-20 + hover zoom h-44, Amazon orange badge, name link, ASIN copy, brand, price, BS/AC/#1 badges, action buttons), BSR, Sale Trend (sparkline), Item Sold (L30D), Revenue (L30D), No. of Ratings, Rating
- **Sparkline**: real data when ≥2 scrape runs exist (from `/amazon-history`); estimated fallback otherwise. Hover tooltip shows date + Monthly Sales estimate. Vertical dashed guide on hover.
- **Item Sold estimate**: granular per-rank tiers (rank 1=44k, 2=32k, 3=24k, 4=18k, 5=14k…) scaled by review count — same-rank products show different numbers
- BSR % change column: shows "—" (no historical comparison yet; will be real once 2+ scrapes)
- Action buttons: `productLink(p)` helper routes per marketplace — "Trend Details" → correct URL per marketplace (not always amazon.com/dp/)
- Price cell: shows sale price + crossed-out `original_price` when `original_price > price`
- Dev-only: "Refresh Data" button (orange) triggers scrape for active marketplace tab
- Loads rank history in background after products load; passes `history` prop per ASIN to each sparkline

**Scrape trigger flow (dev only):**
1. Click "Refresh Data" → `POST /api/creator-intel/scrape-amazon`
2. Playwright scrapes 10 amazon.com BSR category pages (~100 products each)
3. Fresh INSERT rows added to `amazon_trending` (old rows kept — history accumulates)
4. Page reloads: table shows latest per-ASIN, sparklines show real rank trend (after ≥2 runs)
5. Each scrape run takes ~2–3 min on Render

---

### Marketplace Tab Status

| Marketplace | Status | Notes |
|-------------|--------|-------|
| **Amazon** | ✅ Live | BSR scraper on Render, sparklines, badges, rank history, original_price |
| **Alibaba** | ✅ Live | Runs via **local home-PC scraper** (residential IP). window.runParams + DOM fallback. sale + original_price |
| **eBay** | ⏳ Waiting | Official Finding API scraper built; needs `EBAY_APP_ID` env var in Render |
| **iHerb** | 🔴 Hidden | Scraper built (Claude Vision). Tab hidden — Cloudflare blocks Render IPs. Re-enable via local scraper |
| **Banggood** | 🔴 Hidden | Scraper built (Claude Vision). Tab hidden — blocked on Render IPs. Re-enable via local scraper |
| **Shein** | ❌ Blocked | `/risk/challenge` CAPTCHA on all headless browsers |
| **Etsy** | ❌ Blocked | DataDome bot protection |
| **Lazada** | ❌ Blocked | reCAPTCHA on headless browsers |
| **Tesco** | ❌ Blocked | Blocks Render datacenter IPs |
| **Walmart** | ❌ Blocked | Akamai Bot Manager |

---

### Candidate Marketplaces to Add Next

| Marketplace | Difficulty | Notes |
|-------------|------------|-------|
| **Noon.com** | 🟢 Easy | UAE/KSA marketplace — very relevant for B2B audience; public API available |
| **Shopee** | 🔴 Hard | SPA with heavy anti-bot; may need headless tricks |
| **Target** | 🔴 Hard | Similar to Walmart — Akamai protection |

---

### Local Home-PC Scraper — Architecture

Render's datacenter IPs are blocked by AliExpress, iHerb, Banggood. Solution: run Playwright on the user's home PC (residential IP) and expose it via Cloudflare Tunnel.

**Files:**
- `backend/local-scraper.ts` — Express server on port 3099
- Run: `cd backend && npm run local-scraper`
- Tunnel: `cloudflared.exe tunnel --url http://localhost:3099` (keep both terminals open while scraping)
- Render env var: `LOCAL_SCRAPER_URL = https://xxxx.trycloudflare.com`

**How it works:**
1. User clicks "Refresh Data" in app
2. Render receives request → checks `LOCAL_SCRAPER_URL` env var
3. Render calls `POST ${LOCAL_SCRAPER_URL}/scrape-aliexpress`
4. Home PC runs Playwright with residential IP → AliExpress serves real products
5. Products returned as JSON → Render saves to DB

**Current endpoints on local scraper:**
- `GET /health` — health check
- `POST /scrape-aliexpress` — scrapes all 8 AliExpress categories

**To add iHerb/Banggood to local scraper:**
1. Add `POST /scrape-iherb` and `POST /scrape-banggood` endpoints to `local-scraper.ts`
2. Add `LOCAL_SCRAPER_URL` check to `iherbBestSellers.ts` and `banggoodBestSellers.ts`
3. Re-add tabs in `CreatorIntelContent.tsx` `MARKETPLACES` array

**Cloudflare Tunnel note:** Free quick tunnels change URL on restart. Update `LOCAL_SCRAPER_URL` in Render env vars when restarting the tunnel. For permanent URL: use named tunnel with a Cloudflare domain.

---

### What is NOT YET BUILT ❌

**New features to build next (in order):**
1. **eBay tab (unblock)** — App ID pending approval; scraper already built in `ebayBestSellers.ts`, just needs `EBAY_APP_ID` env var set in Render
2. **iHerb + Banggood re-enable** — add to local-scraper.ts, re-add tabs in frontend
3. **Noon.com tab** — UAE/KSA marketplace; most relevant for B2B audience
4. **Daily auto-scrape cron** — Render cron job, scrapes Amazon every 24h automatically
5. **BSR % change column** — compute rank delta between latest and previous scrape run per ASIN
6. **Unified product modal** — click any Amazon product → see Alibaba sourcing in one modal

**Planned DB tables (not yet created):**
```sql
-- TikTok creator profiles (not yet built)
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

-- Alibaba/AliExpress sourcing (not yet built)
CREATE TABLE sourcing_products (
  id SERIAL PRIMARY KEY,
  query TEXT NOT NULL,
  platform VARCHAR(20),   -- 'alibaba', 'aliexpress'
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

---

## Creator Intelligence — Key Technical Facts

**Apify scraper field mapping (IMPORTANT — flat dot-notation, NOT nested):**
```typescript
// Apify clockworks~tiktok-scraper returns FLAT fields:
v.playCount              // views (NOT v.stats.playCount)
v.diggCount              // likes
v["authorMeta.name"]     // creator handle
v["authorMeta.avatar"]   // creator profile image URL
v.text                   // video caption
v.webVideoUrl            // video URL
// Use searchQueries input (NOT hashtags) — hashtags omit playCount
```

**Image assignment logic:**
- Claude is told `image_url: null` in prompt (doesn't try to copy URLs)
- After Claude returns products, code assigns images:
  1. Try exact handle match in `creatorImageMap` (built from `"authorMeta.avatar"`)
  2. Fallback: round-robin from `allImages[]` sorted by playCount desc → `allImages[i % allImages.length]`

**Historical data strategy:**
- INSERT without DELETE — rows accumulate over time
- `DISTINCT ON (product_name)` deduplicates on read, keeping row with highest gmv_7d
- `scraped_at >= NOW() - ($N || ' days')::INTERVAL` for date range filtering
- NEVER truncate or DELETE tiktok_products / amazon_trending — historical data is the asset

**Postgres DECIMAL → JavaScript:**
- Neon returns DECIMAL columns as strings, not numbers
- Always use `Number(p.gmv_7d)` before arithmetic — `p.gmv_7d + 0` will concatenate, not add

### Other planned items (non-Creator-Intel)
- **Stripe payment integration** — "Coming soon" in PlansModal and PlansContent
- **B2C query intelligence guard** — classify query before searching (product → proceed, unrelated → block)
- **B2C Price Activity** — save B2C search results to price activity tab
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
