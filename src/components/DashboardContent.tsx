/**
 * Admin Dashboard — restricted to mhmdkrissaty@gmail.com + karaaliissa@gmail.com.
 * Shows real platform metrics: users, searches, scrapes, credits, charts.
 */

import { useState, useEffect, lazy, Suspense } from "react"

// Lazy: three.js + react-globe.gl only pulled in for the 2 admins who see this dashboard.
const LiveGlobe = lazy(() => import("./LiveGlobe"))
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card"
import { Badge } from "./ui/badge"
import {
  Users, Search, Database, Zap, TrendingUp, ShoppingBag,
  Globe, Activity, Clock, RefreshCw, Radio, MapPin,
  DollarSign, Trophy, ShieldAlert, Repeat, Filter,
  CheckCircle2, AlertTriangle, XCircle,
} from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { PageSkeleton } from "./PageSkeleton"
import {
  AreaChart, Area,
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts"

const API = import.meta.env.VITE_API_URL || "http://localhost:8080"

const ADMIN_EMAILS = new Set(["mhmdkrissaty@gmail.com", "karaaliissa@gmail.com"])

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdminStats {
  users: {
    total: number; b2b: number; b2c: number; dev: number
    new_7d: number; new_30d: number; paid: number
    last_signup_at: string | null
  }
  searches:  { total: number; last_24h: number; last_7d: number }
  scrapes:   { total: number; last_24h: number }
  creator_intel: {
    total_products: number; last_24h: number
    by_marketplace: { marketplace: string; count: number; last_scraped: string }[]
  }
  catalog:  { products: number; stores: number }
  credits:  { total_used: number; total_balance: number }
  charts: {
    users_by_day:    { date: string; count: number }[]
    searches_by_day: { date: string; count: number }[]
    scrapes_by_day:  { date: string; count: number }[]
    credits_by_day:  { date: string; credits: number }[]
  }
  top_queries:    { query: string; count: number }[]
  users_by_plan:  { plan: string; count: number }[]
  recent_signups: { email: string; role: string; plan_code: string; created_at: string }[]
  activity_feed:  { id: number; user_email: string; role: string; action: string; details: any; ip: string; created_at: string }[]
  action_counts:  { action: string; count: number }[]
  live_users: {
    live_5m:    number
    live_30m:   number
    active_24h: number
    online: { email: string; role: string; plan_code: string | null; signup_country: string | null; signup_country_code: string | null; last_seen_at: string }[]
    points: { email: string; role: string; country: string | null; country_code: string | null; city: string | null; lat: number; lng: number; last_seen_at: string; status: "live" | "recent" }[]
  }
  users_by_country: { country: string; code: string | null; count: number }[]
  geo_summary: { known: number; unknown: number }
  revenue: {
    mrr:            number
    arr:            number
    weekly_revenue: number
    breakdown: { plan: string; interval: string; count: number; mrr: number }[]
  }
  power_users: { email: string; role: string | null; plan_code: string | null; country_code: string | null; country: string | null; credits_used: number; tx_count: number }[]
  scrape_health: { retailer: string; total: number; success: number; failed: number; last_scrape: string | null }[]
  retention: {
    dau: number
    wau: number
    mau: number
    dau_by_day: { date: string; dau: number }[]
  }
  funnel: { signups: number; activated: number; paid: number }
}

// Defaults used when the backend hasn't deployed yet (Vercel is faster than
// Render) — keeps the dashboard from crashing during the deploy window.
const EMPTY_STATS_DEFAULTS = {
  live_users:       { live_5m: 0, live_30m: 0, active_24h: 0, online: [], points: [] },
  users_by_country: [],
  geo_summary:      { known: 0, unknown: 0 },
  revenue:          { mrr: 0, arr: 0, weekly_revenue: 0, breakdown: [] },
  power_users:      [],
  scrape_health:    [],
  retention:        { dau: 0, wau: 0, mau: 0, dau_by_day: [] },
  funnel:           { signups: 0, activated: 0, paid: 0 },
  activity_feed:    [],
  action_counts:    [],
  top_queries:      [],
  users_by_plan:    [],
  recent_signups:   [],
  creator_intel:    { total_products: 0, last_24h: 0, by_marketplace: [] },
  charts:           { users_by_day: [], searches_by_day: [], scrapes_by_day: [], credits_by_day: [] },
}

function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000)    return `$${Math.round(n / 1_000)}k`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}k`
  return `$${Math.round(n).toLocaleString()}`
}

// Emoji flag from ISO-3166-1 alpha-2 country code (e.g. "AE" → 🇦🇪)
function flagOf(code: string | null | undefined): string {
  if (!code || code.length !== 2) return "🌐"
  const A = 0x1F1E6
  const base = "A".charCodeAt(0)
  return String.fromCodePoint(
    A + code.toUpperCase().charCodeAt(0) - base,
    A + code.toUpperCase().charCodeAt(1) - base,
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1)   return "just now"
  if (m < 60)  return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

// Merge two day-series arrays by date
function mergeDays(
  a: { date: string; count: number }[],
  b: { date: string; count: number }[],
  keyA: string,
  keyB: string,
): any[] {
  const map: Record<string, any> = {}
  a.forEach(r => { map[r.date] = { date: r.date, [keyA]: r.count, [keyB]: 0 } })
  b.forEach(r => {
    if (map[r.date]) map[r.date][keyB] = r.count
    else map[r.date] = { date: r.date, [keyA]: 0, [keyB]: r.count }
  })
  return Object.values(map).sort((x, y) => x.date.localeCompare(y.date))
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  b2c_search:           { label: "B2C Search",         color: "bg-violet-500" },
  b2c_unlock:           { label: "Unlock",              color: "bg-violet-300" },
  b2b_ai_search:        { label: "B2B AI Search",       color: "bg-blue-500"  },
  b2b_catalog_discovery:{ label: "Catalog Discovery",   color: "bg-blue-400"  },
  b2b_confirm_mappings: { label: "Confirm Mappings",    color: "bg-blue-300"  },
  product_add:          { label: "Product Added",       color: "bg-emerald-500"},
  product_import:       { label: "Product Import",      color: "bg-emerald-400"},
  product_delete:       { label: "Product Deleted",     color: "bg-red-400"   },
  store_add:            { label: "Store Added",         color: "bg-teal-500"  },
  store_edit:           { label: "Store Edited",        color: "bg-teal-400"  },
  store_delete:         { label: "Store Deleted",       color: "bg-red-300"   },
  scrape_amazon:        { label: "Amazon Scrape",       color: "bg-orange-500"},
  scrape_aliexpress:    { label: "AliExpress Scrape",   color: "bg-orange-400"},
  scrape_tiktok:        { label: "TikTok Scrape",       color: "bg-pink-500"  },
  scrape_ebay:          { label: "eBay Scrape",         color: "bg-yellow-500"},
  signup:               { label: "New Signup",          color: "bg-green-500" },
  account_update:       { label: "Account Updated",     color: "bg-slate-400" },
  account_delete:       { label: "Account Deleted",     color: "bg-red-500"   },
  credits_deducted:     { label: "Credits Deducted",    color: "bg-amber-500" },
  price_sync:           { label: "Price Sync",          color: "bg-indigo-400"},
}

function actionInfo(action: string) {
  return ACTION_LABELS[action] ?? { label: action, color: "bg-slate-400" }
}

function detailSummary(action: string, details: any): string {
  if (!details) return ""
  switch (action) {
    case "b2c_search":            return details.query ? `"${String(details.query).slice(0, 40)}"` : ""
    case "b2b_ai_search":         return details.query ? `"${String(details.query).slice(0, 40)}"` : ""
    case "b2b_catalog_discovery": return details.query ? `"${String(details.query).slice(0, 30)}"` : ""
    case "product_import":        return details.count ? `${details.count} products` : ""
    case "product_add":           return details.name  ? String(details.name).slice(0, 40) : ""
    case "store_add":             return details.name  ? String(details.name).slice(0, 40) : ""
    case "scrape_amazon":         return details.marketplace ? details.marketplace : ""
    case "scrape_aliexpress":     return details.category ?? ""
    case "signup":                return details.plan ? details.plan : ""
    case "b2c_unlock":            return details.count ? `${details.count} results` : ""
    default:                      return ""
  }
}

// ─── Funnel step ──────────────────────────────────────────────────────────────

function FunnelStep({
  label, value, barPct, color, subtitle,
}: {
  label: string; value: number; barPct: number; color: string; subtitle: string
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium">{label}</span>
        <span className="text-sm font-bold">{fmt(value)}</span>
      </div>
      <div className="relative h-6 bg-muted/40 rounded overflow-hidden">
        <div
          className={`absolute left-0 top-0 bottom-0 ${color} rounded transition-all duration-500`}
          style={{ width: `${Math.max(4, Math.min(100, barPct))}%` }}
        />
      </div>
      <p className="text-[10px] text-muted-foreground mt-1">{subtitle}</p>
    </div>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  title, value, sub, icon: Icon, accent,
}: {
  title: string; value: string; sub: string
  icon: React.ElementType; accent?: string
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
        <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={`h-4 w-4 shrink-0 ${accent ?? "text-muted-foreground"}`} />
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
      </CardContent>
    </Card>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DashboardContent(_: { role?: string }) {
  const { user } = useAuth()
  const [stats,   setStats]   = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const isAdmin = ADMIN_EMAILS.has(user?.email ?? "")

  async function loadStats() {
    try {
      const token = await user!.getIdToken()
      const resp  = await fetch(`${API}/api/admin/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!resp.ok) throw new Error(`${resp.status}`)
      const json = await resp.json()
      // Deep-merge defaults for any field the current backend build hasn't
      // shipped yet (Vercel deploys before Render — avoid crash during window).
      const data = json.data ?? {}
      const merged: AdminStats = {
        ...EMPTY_STATS_DEFAULTS,
        ...data,
        live_users: { ...EMPTY_STATS_DEFAULTS.live_users, ...(data.live_users ?? {}) },
        geo_summary: { ...EMPTY_STATS_DEFAULTS.geo_summary, ...(data.geo_summary ?? {}) },
        revenue: { ...EMPTY_STATS_DEFAULTS.revenue, ...(data.revenue ?? {}) },
        retention: { ...EMPTY_STATS_DEFAULTS.retention, ...(data.retention ?? {}) },
        funnel: { ...EMPTY_STATS_DEFAULTS.funnel, ...(data.funnel ?? {}) },
        charts: { ...EMPTY_STATS_DEFAULTS.charts, ...(data.charts ?? {}) },
        creator_intel: { ...EMPTY_STATS_DEFAULTS.creator_intel, ...(data.creator_intel ?? {}) },
      } as AdminStats
      setStats(merged)
      setError(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (isAdmin && user) loadStats()
    else setLoading(false)
  }, [isAdmin, user])

  function refresh() {
    setRefreshing(true)
    loadStats()
  }

  if (loading) return <PageSkeleton cards={4} rows={3} />

  // Not an admin — show access denied
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-3 text-center">
        <div className="h-14 w-14 rounded-full bg-destructive/10 flex items-center justify-center">
          <Activity className="h-7 w-7 text-destructive" />
        </div>
        <h2 className="text-lg font-semibold">Access Restricted</h2>
        <p className="text-sm text-muted-foreground max-w-xs">
          This dashboard is only available to platform administrators.
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-3 text-center">
        <p className="text-sm text-destructive">Failed to load stats: {error}</p>
        <button onClick={refresh} className="text-xs underline text-muted-foreground">Retry</button>
      </div>
    )
  }

  if (!stats) return null

  const { users, searches, scrapes, creator_intel, catalog, credits, charts, top_queries, users_by_plan, recent_signups, activity_feed, action_counts, live_users, users_by_country, geo_summary, revenue, power_users, scrape_health, retention, funnel } = stats
  const maxCountryCount = Math.max(1, ...users_by_country.map(c => c.count))
  const maxPowerCredits = Math.max(1, ...power_users.map(u => u.credits_used))
  const activationRate = funnel.signups > 0 ? (funnel.activated / funnel.signups) * 100 : 0
  const conversionRate = funnel.activated > 0 ? (funnel.paid / funnel.activated) * 100 : 0
  const overallConv    = funnel.signups > 0 ? (funnel.paid / funnel.signups) * 100 : 0

  // Merge searches + scrapes into one activity chart
  const activityData = mergeDays(charts.searches_by_day, charts.scrapes_by_day, "searches", "scrapes")
    .map(r => ({ ...r, date: formatDate(r.date) }))

  const userGrowthData = charts.users_by_day.map(r => ({
    date:  formatDate(r.date),
    users: r.count,
  }))

  const creditData = charts.credits_by_day.map(r => ({
    date:    formatDate(r.date),
    credits: r.credits,
  }))

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold">Platform Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Real-time metrics across all users and services
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Live Now + Revenue — hero row */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">

        {/* Live Now */}
        <Card className="relative overflow-hidden border-emerald-200 dark:border-emerald-900/50 bg-gradient-to-br from-emerald-50/60 to-transparent dark:from-emerald-950/30">
          <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-emerald-400/10 blur-3xl" />
          <CardContent className="relative p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                  </span>
                  <span className="text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Live Now</span>
                </div>
                <div className="mt-1.5 flex items-baseline gap-2">
                  <span className="text-3xl font-bold">{fmt(live_users.live_5m)}</span>
                  <span className="text-xs text-muted-foreground">online in last 5m</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {live_users.live_30m} active in 30m · {live_users.active_24h} today
                </p>
              </div>
              {live_users.online.length > 0 && (
                <div className="flex -space-x-2">
                  {live_users.online.slice(0, 6).map((u, i) => (
                    <div
                      key={i}
                      title={`${u.email} · ${u.signup_country ?? "Unknown"} · ${timeAgo(u.last_seen_at)}`}
                      className="h-8 w-8 rounded-full bg-white dark:bg-slate-900 border-2 border-emerald-400 shadow-sm flex items-center justify-center text-xs font-semibold text-slate-600 dark:text-slate-200"
                    >
                      {u.email.slice(0, 1).toUpperCase()}
                    </div>
                  ))}
                  {live_users.online.length > 6 && (
                    <div className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-white dark:border-slate-900 flex items-center justify-center text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                      +{live_users.online.length - 6}
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Revenue / MRR */}
        <Card className="relative overflow-hidden border-amber-200 dark:border-amber-900/50 bg-gradient-to-br from-amber-50/60 to-transparent dark:from-amber-950/30">
          <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-amber-400/10 blur-3xl" />
          <CardContent className="relative p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                  <span className="text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">Recurring Revenue</span>
                </div>
                <div className="mt-1.5 flex items-baseline gap-2">
                  <span className="text-3xl font-bold">{fmtMoney(revenue.mrr)}</span>
                  <span className="text-xs text-muted-foreground">MRR</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {fmtMoney(revenue.arr)} ARR · {fmtMoney(revenue.weekly_revenue)}/wk from weekly plans
                </p>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Paid users</div>
                <div className="text-2xl font-bold mt-0.5">{fmt(users.paid)}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {users.total > 0 ? ((users.paid / users.total) * 100).toFixed(1) : "0"}% of total
                </div>
              </div>
            </div>
            {revenue.breakdown.length > 0 && (
              <div className="flex gap-1.5 mt-3 pt-3 border-t border-amber-200/50 dark:border-amber-900/30 flex-wrap">
                {revenue.breakdown.map((b, i) => (
                  <Badge key={i} variant="outline" className="text-[10px]">
                    {b.plan} · {b.interval} · {b.count} · {fmtMoney(b.mrr)}/mo
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      {/* Live Globe — 3D world view of user presence */}
      <Card className="relative overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border-slate-800">
        {/* Ambient aurora backdrop */}
        <div className="pointer-events-none absolute inset-0 opacity-60">
          <div className="absolute top-1/4 left-1/4 h-[420px] w-[420px] rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-[320px] w-[320px] rounded-full bg-violet-500/10 blur-3xl" />
        </div>

        <CardHeader className="relative flex flex-row items-start justify-between gap-4 pb-2">
          <div>
            <CardTitle className="text-base text-white flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              Live World
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">
              {live_users.live_5m} live now · {live_users.live_30m - live_users.live_5m} recent · auto-rotating
            </CardDescription>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-300">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.9)]" />
              Live (≤5m)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.9)]" />
              Recent (5–30m)
            </span>
          </div>
        </CardHeader>

        <CardContent className="relative p-0">
          {live_users.points.length === 0 ? (
            <div className="h-[480px] flex flex-col items-center justify-center text-slate-500 gap-2">
              <Globe className="h-10 w-10 opacity-30" />
              <p className="text-xs">No users online right now</p>
              <p className="text-[10px] text-slate-600">Dots will appear here the moment someone opens the app</p>
            </div>
          ) : (
            <Suspense
              fallback={
                <div className="h-[480px] flex items-center justify-center">
                  <div className="h-8 w-8 rounded-full border-2 border-emerald-500/30 border-t-emerald-400 animate-spin" />
                </div>
              }
            >
              <LiveGlobe points={live_users.points} dark />
            </Suspense>
          )}
        </CardContent>
      </Card>

      {/* Top metric cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Users"
          value={fmt(users.total)}
          sub={`+${users.new_7d} this week · ${users.paid} paid`}
          icon={Users}
          accent="text-blue-500"
        />
        <StatCard
          title="Searches (24h)"
          value={fmt(searches.last_24h)}
          sub={`${fmt(searches.total)} all time · ${fmt(searches.last_7d)} this week`}
          icon={Search}
          accent="text-violet-500"
        />
        <StatCard
          title="Price Scrapes (24h)"
          value={fmt(scrapes.last_24h)}
          sub={`${fmt(scrapes.total)} total snapshots`}
          icon={Database}
          accent="text-emerald-500"
        />
        <StatCard
          title="Credits Used"
          value={fmt(credits.total_used)}
          sub={`${fmt(credits.total_balance)} remaining across all wallets`}
          icon={Zap}
          accent="text-amber-500"
        />
      </div>

      {/* Secondary metric cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="B2B Users"
          value={fmt(users.b2b)}
          sub={`${users.b2c} B2C · ${users.dev} dev`}
          icon={Globe}
          accent="text-blue-400"
        />
        <StatCard
          title="Creator Intel Products"
          value={fmt(creator_intel.total_products)}
          sub={`${creator_intel.last_24h} scraped in last 24h`}
          icon={TrendingUp}
          accent="text-pink-500"
        />
        <StatCard
          title="Catalog Products"
          value={fmt(catalog.products)}
          sub={`across ${catalog.stores} active stores`}
          icon={ShoppingBag}
          accent="text-indigo-500"
        />
        <StatCard
          title="New Users (30d)"
          value={fmt(users.new_30d)}
          sub={users.last_signup_at ? `Last signup ${timeAgo(users.last_signup_at)}` : "No signups yet"}
          icon={Activity}
          accent="text-teal-500"
        />
      </div>

      {/* Charts row 1: Activity + User Growth */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Search & Scrape Activity (30d)</CardTitle>
            <CardDescription className="text-xs">Daily searches vs price scrapes</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={activityData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradSearch" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#7c3aed" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#7c3aed" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gradScrape" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip labelStyle={{ fontSize: 11 }} contentStyle={{ fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="searches" stroke="#7c3aed" strokeWidth={2} fill="url(#gradSearch)" name="Searches" />
                <Area type="monotone" dataKey="scrapes"  stroke="#10b981" strokeWidth={2} fill="url(#gradScrape)" name="Scrapes" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">User Growth (30d)</CardTitle>
            <CardDescription className="text-xs">New signups per day</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={userGrowthData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip labelStyle={{ fontSize: 11 }} contentStyle={{ fontSize: 11 }} cursor={{ fill: "transparent" }} />
                <Bar dataKey="users" fill="#7c3aed" radius={[4, 4, 0, 0]} name="New users" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts row 2: Credits + Users by plan */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Credits Consumed (30d)</CardTitle>
            <CardDescription className="text-xs">Daily credit deductions across all users</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={creditData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradCredits" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip labelStyle={{ fontSize: 11 }} contentStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="credits" stroke="#f59e0b" strokeWidth={2} fill="url(#gradCredits)" name="Credits used" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Users by Plan</CardTitle>
            <CardDescription className="text-xs">Distribution across all plan tiers</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={users_by_plan} layout="vertical" margin={{ top: 4, right: 16, left: 60, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="plan" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={56} />
                <Tooltip labelStyle={{ fontSize: 11 }} contentStyle={{ fontSize: 11 }} cursor={{ fill: "transparent" }} />
                <Bar dataKey="count" fill="#7c3aed" radius={[0, 4, 4, 0]} name="Users" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Geo row: Users by Country + Active right now */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">

        {/* Users by Country — spans 2 cols */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4 text-blue-500" />
              Users by Country
            </CardTitle>
            <CardDescription className="text-xs">
              {geo_summary.known} located · {geo_summary.unknown} unknown
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {users_by_country.length === 0 ? (
              <p className="text-xs text-muted-foreground">No location data yet</p>
            ) : users_by_country.slice(0, 12).map((c, i) => {
              const pct = (c.count / maxCountryCount) * 100
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-lg shrink-0 w-6 text-center">{flagOf(c.code)}</span>
                  <span className="text-xs w-28 truncate shrink-0">{c.country}</span>
                  <div className="flex-1 relative h-5 bg-muted/40 rounded overflow-hidden">
                    <div
                      className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-blue-500 to-violet-500 rounded"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <Badge variant="secondary" className="text-[10px] shrink-0 min-w-[32px] justify-center">{c.count}</Badge>
                </div>
              )
            })}
          </CardContent>
        </Card>

        {/* Active Right Now */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Radio className="h-4 w-4 text-emerald-500" />
              Active Right Now
            </CardTitle>
            <CardDescription className="text-xs">Users online in last 5 minutes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {live_users.online.length === 0 ? (
              <p className="text-xs text-muted-foreground">No one online right now</p>
            ) : live_users.online.slice(0, 10).map((u, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs truncate font-medium">{u.email}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Badge variant="outline" className="text-[10px] px-1 py-0">{u.role}</Badge>
                      {u.signup_country_code && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <span>{flagOf(u.signup_country_code)}</span>
                          {u.signup_country}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(u.last_seen_at)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Bottom row: Top queries + Marketplace breakdown + Recent signups */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">

        {/* Top search queries */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Searches (7d)</CardTitle>
            <CardDescription className="text-xs">Most popular B2C queries</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {top_queries.length === 0 ? (
              <p className="text-xs text-muted-foreground">No searches yet</p>
            ) : top_queries.slice(0, 8).map((q, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <span className="text-xs truncate flex-1">{q.query}</span>
                <Badge variant="secondary" className="text-[10px] shrink-0">{q.count}×</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Creator Intel by marketplace */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Creator Intel Coverage</CardTitle>
            <CardDescription className="text-xs">Products scraped per marketplace (30d)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {creator_intel.by_marketplace.length === 0 ? (
              <p className="text-xs text-muted-foreground">No scrapes yet</p>
            ) : creator_intel.by_marketplace.map((m, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-violet-500 shrink-0" />
                  <span className="text-sm font-medium">{m.marketplace}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{fmt(m.count)} products</Badge>
                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                    <Clock className="h-2.5 w-2.5" />
                    {timeAgo(m.last_scraped)}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Recent signups */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Signups</CardTitle>
            <CardDescription className="text-xs">Latest 10 registered users</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {recent_signups.length === 0 ? (
              <p className="text-xs text-muted-foreground">No users yet</p>
            ) : recent_signups.map((u, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs truncate font-medium">{u.email}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Badge variant="outline" className="text-[10px] px-1 py-0">{u.role}</Badge>
                    {u.plan_code && (
                      <span className="text-[10px] text-muted-foreground">{u.plan_code}</span>
                    )}
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {timeAgo(u.created_at)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Retention + Funnel row */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">

        {/* Retention DAU / WAU / MAU */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Repeat className="h-4 w-4 text-indigo-500" />
              Retention
            </CardTitle>
            <CardDescription className="text-xs">Unique active users over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="text-center p-3 rounded-md bg-indigo-50 dark:bg-indigo-950/30">
                <div className="text-xs text-muted-foreground">DAU</div>
                <div className="text-xl font-bold mt-0.5">{fmt(retention.dau)}</div>
                <div className="text-[10px] text-muted-foreground">last 24h</div>
              </div>
              <div className="text-center p-3 rounded-md bg-violet-50 dark:bg-violet-950/30">
                <div className="text-xs text-muted-foreground">WAU</div>
                <div className="text-xl font-bold mt-0.5">{fmt(retention.wau)}</div>
                <div className="text-[10px] text-muted-foreground">last 7d</div>
              </div>
              <div className="text-center p-3 rounded-md bg-pink-50 dark:bg-pink-950/30">
                <div className="text-xs text-muted-foreground">MAU</div>
                <div className="text-xl font-bold mt-0.5">{fmt(retention.mau)}</div>
                <div className="text-[10px] text-muted-foreground">last 30d</div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart
                data={retention.dau_by_day.map(r => ({ date: formatDate(r.date), dau: r.dau }))}
                margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="gradRet" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip labelStyle={{ fontSize: 11 }} contentStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="dau" stroke="#6366f1" strokeWidth={2} fill="url(#gradRet)" name="Daily active" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Funnel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4 text-rose-500" />
              Conversion Funnel
            </CardTitle>
            <CardDescription className="text-xs">Signup → first search → paid</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <FunnelStep
              label="Signups"
              value={funnel.signups}
              barPct={100}
              color="bg-slate-500"
              subtitle="all-time"
            />
            <FunnelStep
              label="Activated"
              value={funnel.activated}
              barPct={activationRate}
              color="bg-blue-500"
              subtitle={`${activationRate.toFixed(1)}% of signups`}
            />
            <FunnelStep
              label="Paid"
              value={funnel.paid}
              barPct={overallConv}
              color="bg-emerald-500"
              subtitle={`${conversionRate.toFixed(1)}% of activated · ${overallConv.toFixed(1)}% overall`}
            />
          </CardContent>
        </Card>
      </div>

      {/* Power Users + Scrape Health row */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">

        {/* Power Users Leaderboard */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" />
              Power Users (7d)
            </CardTitle>
            <CardDescription className="text-xs">Top credit burners</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {power_users.length === 0 ? (
              <p className="text-xs text-muted-foreground">No activity yet</p>
            ) : power_users.map((u, i) => {
              const pct = (u.credits_used / maxPowerCredits) * 100
              return (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className={`text-[10px] font-bold w-5 text-center shrink-0 ${i === 0 ? "text-amber-500" : i < 3 ? "text-slate-500" : "text-muted-foreground"}`}>
                        {i + 1}
                      </span>
                      <span className="text-xs truncate font-medium">{u.email}</span>
                      {u.country_code && (
                        <span className="text-xs shrink-0">{flagOf(u.country_code)}</span>
                      )}
                      <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0">{u.role ?? "—"}</Badge>
                    </div>
                    <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 shrink-0">{fmt(u.credits_used)}</span>
                  </div>
                  <div className="relative h-1 bg-muted/40 rounded overflow-hidden ml-7">
                    <div className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-amber-400 to-orange-500 rounded" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        {/* Scrape Health Matrix */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-cyan-500" />
              Scrape Health (24h)
            </CardTitle>
            <CardDescription className="text-xs">Success rate per retailer · red if stale or failing</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {scrape_health.length === 0 ? (
              <p className="text-xs text-muted-foreground">No scrapes in the last 24h</p>
            ) : scrape_health.map((s, i) => {
              const successRate = s.total > 0 ? (s.success / s.total) * 100 : 0
              const stale = s.last_scrape ? (Date.now() - new Date(s.last_scrape).getTime()) > 24 * 3600_000 : true
              const isHealthy  = successRate >= 90 && !stale
              const isWarning  = (successRate >= 60 && successRate < 90) || (!stale && s.failed > 0)
              const isCritical = successRate < 60 || stale
              const Icon = isCritical ? XCircle : isWarning ? AlertTriangle : CheckCircle2
              const iconColor = isCritical ? "text-red-500" : isWarning ? "text-amber-500" : "text-emerald-500"
              return (
                <div key={i} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Icon className={`h-3.5 w-3.5 shrink-0 ${iconColor}`} />
                    <span className="text-xs font-medium truncate">{s.retailer}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs font-semibold ${isCritical ? "text-red-600" : isWarning ? "text-amber-600" : "text-emerald-600"}`}>
                      {successRate.toFixed(0)}%
                    </span>
                    <Badge variant="outline" className="text-[10px]">{s.success}/{s.total}</Badge>
                    {s.last_scrape && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 whitespace-nowrap">
                        <Clock className="h-2.5 w-2.5" />
                        {timeAgo(s.last_scrape)}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>

      {/* Activity Monitoring — full width */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">

        {/* Action breakdown (7d) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Actions Breakdown (7d)</CardTitle>
            <CardDescription className="text-xs">What users are doing most</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {action_counts.length === 0 ? (
              <p className="text-xs text-muted-foreground">No activity yet</p>
            ) : action_counts.map((a, i) => {
              const info = actionInfo(a.action)
              return (
                <div key={i} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full shrink-0 ${info.color}`} />
                    <span className="text-xs">{info.label}</span>
                  </div>
                  <Badge variant="secondary" className="text-[10px] shrink-0">{a.count}×</Badge>
                </div>
              )
            })}
          </CardContent>
        </Card>

        {/* Live activity feed — spans 2 cols */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Live Activity Feed</CardTitle>
            <CardDescription className="text-xs">Last 100 events across all users</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y max-h-96 overflow-y-auto">
              {activity_feed.length === 0 ? (
                <p className="text-xs text-muted-foreground p-4">No activity logged yet</p>
              ) : activity_feed.map((ev) => {
                const info    = actionInfo(ev.action)
                const summary = detailSummary(ev.action, ev.details)
                return (
                  <div key={ev.id} className="flex items-start gap-3 px-4 py-2.5 hover:bg-muted/40 transition-colors">
                    <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${info.color}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium truncate max-w-[180px]">{ev.user_email}</span>
                        <Badge variant="outline" className="text-[10px] px-1 py-0 shrink-0">{ev.role ?? "—"}</Badge>
                        <span className="text-xs text-foreground shrink-0">{info.label}</span>
                        {summary && <span className="text-xs text-muted-foreground truncate">{summary}</span>}
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">{timeAgo(ev.created_at)}</span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

      </div>

    </div>
  )
}
