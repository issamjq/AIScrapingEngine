/**
 * Admin Dashboard — restricted to mhmdkrissaty@gmail.com + karaaliissa@gmail.com.
 * Shows real platform metrics: users, searches, scrapes, credits, charts.
 */

import { useState, useEffect, lazy, Suspense } from "react"

// Lazy: three.js + react-globe.gl only pulled in for the 2 admins who see this dashboard.
const LiveGlobe = lazy(() => import("./LiveGlobe"))

import { UserDetailSheet } from "./UserDetailSheet"
import { LiveViewDialog }  from "./LiveViewDialog"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card"
import { Badge } from "./ui/badge"
import {
  Users, Search, Database, Zap, TrendingUp, ShoppingBag,
  Globe, Activity, Clock, RefreshCw, Radio, MapPin,
  DollarSign, Trophy, ShieldAlert, Repeat, Filter,
  CheckCircle2, AlertTriangle, XCircle, Hourglass,
  Flame, Layers, UserX, Fingerprint, ArrowUpRight, ArrowDownRight, Brain,
  Bug, ScrollText, GaugeCircle, Siren, Megaphone, Plus, Link2,
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
  at_risk: {
    silent_paid:       { email: string; plan_code: string | null; role: string; country_code: string | null; last_seen_at: string | null; days_silent: number }[]
    ending_trials:     { email: string; plan_code: string | null; role: string; country_code: string | null; trial_ends_at: string; days_left: number }[]
    credit_exhaustion: { email: string; role: string; plan_code: string | null; country_code: string | null; monthly_limit: number; used: number; pct_used: number }[]
  }
  activation: {
    activated:    number
    median_hours: number
    histogram:    { bucket: string; count: number }[]
  }
  stickiness: { dau_over_mau_pct: number; wau_over_mau_pct: number }
  feature_adoption: { action: string; users: number; pct: number }[]
  cohort_retention: { week: string; size: number; w0: number; w1: number; w2: number; w3: number }[]
  trial_abuse: { ip: string; country_code: string | null; accounts: number; emails: string[]; last_signup: string }[]
  price_moves: { product: string; brand: string | null; retailer: string; currency: string; low: number; high: number; delta: number; delta_pct: number; samples: number }[]
  anthropic_spend: {
    last_7d:  number
    last_30d: number
    by_day:    { date: string; cost: number }[]
    by_action: { action: string; calls: number; cost: number }[]
  }
  error_feed:     { id: number; level: string; source: string | null; message: string; path: string | null; status: number | null; user_email: string | null; created_at: string }[]
  error_counts:   { last_24h: number; last_7d: number }
  admin_audit:    { id: number; actor_email: string; action: string; target_email: string | null; details: any; ip: string | null; created_at: string }[]
  rate_limit_hits:{ user_email: string; limit_type: string; hits: number; last_hit: string }[]
  slow_endpoints: { route: string; method: string; calls: number; avg_ms: number; p50: number; p95: number; p99: number; err_5xx: number }[]
  broadcasts:     { id: number; message: string; variant: string; active: boolean; starts_at: string; ends_at: string | null; created_by: string | null; created_at: string }[]
  utm_breakdown:  { source: string; signups: number; paid: number; conversion_pct: number }[]
  alerts: { severity: "critical" | "warning" | "info"; message: string; hint?: string }[]
  system_health: {
    db_latency_ms:  number
    db_ok:          boolean
    last_price_scrape:   string | null
    last_amazon_scrape:  string | null
    last_tiktok_scrape:  string | null
    last_anthropic_call: string | null
    last_price_scrape_age_sec:   number | null
    last_amazon_scrape_age_sec:  number | null
    last_tiktok_scrape_age_sec:  number | null
    last_anthropic_call_age_sec: number | null
    errors_24h:        number
    scrapes_24h:       number
    scrape_success_24h:number
    scrape_fail_rate:  number
  }
  search_depth: {
    searches: number; unlocks: number; avg_results: number; avg_duration_s: number
    unlocks_per_search: number
  }
  scrape_status_dist: { status: string; count: number }[]
  price_source_dist:  { source: string; count: number }[]
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
  at_risk:          { silent_paid: [], ending_trials: [], credit_exhaustion: [] },
  activation:       { activated: 0, median_hours: 0, histogram: [] },
  stickiness:       { dau_over_mau_pct: 0, wau_over_mau_pct: 0 },
  feature_adoption: [],
  cohort_retention: [],
  trial_abuse:      [],
  price_moves:      [],
  anthropic_spend:  { last_7d: 0, last_30d: 0, by_day: [], by_action: [] },
  error_feed:       [],
  error_counts:     { last_24h: 0, last_7d: 0 },
  admin_audit:      [],
  rate_limit_hits:  [],
  slow_endpoints:   [],
  broadcasts:       [],
  utm_breakdown:    [],
  alerts:           [],
  system_health:    {
    db_latency_ms: 0, db_ok: true,
    last_price_scrape: null, last_amazon_scrape: null, last_tiktok_scrape: null, last_anthropic_call: null,
    last_price_scrape_age_sec: null, last_amazon_scrape_age_sec: null, last_tiktok_scrape_age_sec: null, last_anthropic_call_age_sec: null,
    errors_24h: 0, scrapes_24h: 0, scrape_success_24h: 0, scrape_fail_rate: 0,
  },
  search_depth:      { searches: 0, unlocks: 0, avg_results: 0, avg_duration_s: 0, unlocks_per_search: 0 },
  scrape_status_dist: [],
  price_source_dist:  [],
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

// ─── Health pill (system health strip) ────────────────────────────────────────

function HealthPill({ label, ok, warn, value }: { label: string; ok: boolean; warn?: boolean; value: string }) {
  const tone = ok
    ? "bg-emerald-500"
    : warn
      ? "bg-amber-500"
      : "bg-red-500"
  return (
    <div className="flex items-center gap-2">
      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${tone}`} />
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  )
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
  const [broadcastDraft, setBroadcastDraft] = useState("")
  const [broadcastVariant, setBroadcastVariant] = useState<"info" | "warn" | "success" | "danger">("info")
  const [broadcastSaving, setBroadcastSaving] = useState(false)
  const [selectedUser, setSelectedUser] = useState<string | null>(null)
  const [liveOpen, setLiveOpen] = useState(false)

  const isAdmin = ADMIN_EMAILS.has(user?.email ?? "")

  async function createBroadcast() {
    if (!broadcastDraft.trim()) return
    setBroadcastSaving(true)
    try {
      const token = await user!.getIdToken()
      await fetch(`${API}/api/broadcasts`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ message: broadcastDraft.trim(), variant: broadcastVariant }),
      })
      setBroadcastDraft("")
      await loadStats()
    } catch { /* silent */ }
    finally { setBroadcastSaving(false) }
  }

  async function deactivateBroadcast(id: number) {
    try {
      const token = await user!.getIdToken()
      await fetch(`${API}/api/broadcasts/${id}/deactivate`, {
        method:  "POST",
        headers: { Authorization: `Bearer ${token}` },
      })
      await loadStats()
    } catch { /* silent */ }
  }

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
        at_risk: { ...EMPTY_STATS_DEFAULTS.at_risk, ...(data.at_risk ?? {}) },
        activation: { ...EMPTY_STATS_DEFAULTS.activation, ...(data.activation ?? {}) },
        stickiness: { ...EMPTY_STATS_DEFAULTS.stickiness, ...(data.stickiness ?? {}) },
        anthropic_spend: { ...EMPTY_STATS_DEFAULTS.anthropic_spend, ...(data.anthropic_spend ?? {}) },
        error_counts: { ...EMPTY_STATS_DEFAULTS.error_counts, ...(data.error_counts ?? {}) },
        system_health: { ...EMPTY_STATS_DEFAULTS.system_health, ...(data.system_health ?? {}) },
        search_depth:  { ...EMPTY_STATS_DEFAULTS.search_depth,  ...(data.search_depth  ?? {}) },
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

  const { users, searches, scrapes, creator_intel, catalog, credits, charts, top_queries, users_by_plan, recent_signups, activity_feed, action_counts, live_users, users_by_country, geo_summary, revenue, power_users, scrape_health, retention, funnel, at_risk, activation, stickiness, feature_adoption, cohort_retention, trial_abuse, price_moves, anthropic_spend, error_feed, error_counts, admin_audit, rate_limit_hits, slow_endpoints, broadcasts, utm_breakdown, alerts, system_health, search_depth, scrape_status_dist, price_source_dist } = stats
  const totalScrapeStatus = scrape_status_dist.reduce((a, b) => a + b.count, 0)
  const totalPriceSource  = price_source_dist.reduce((a, b) => a + b.count, 0)
  const maxCountryCount = Math.max(1, ...users_by_country.map(c => c.count))
  const maxPowerCredits = Math.max(1, ...power_users.map(u => u.credits_used))
  const activationRate = funnel.signups > 0 ? (funnel.activated / funnel.signups) * 100 : 0
  const conversionRate = funnel.activated > 0 ? (funnel.paid / funnel.activated) * 100 : 0
  const overallConv    = funnel.signups > 0 ? (funnel.paid / funnel.signups) * 100 : 0
  const atRiskTotal    = at_risk.silent_paid.length + at_risk.ending_trials.length + at_risk.credit_exhaustion.length
  const maxTtfv        = Math.max(1, ...activation.histogram.map(b => b.count))
  const maxAdoptionPct = Math.max(1, ...feature_adoption.map(f => f.pct))
  const maxPriceMove   = Math.max(1, ...price_moves.map(p => p.delta_pct))

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
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold">Platform Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Real-time metrics across all users and services
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Shopify-style live visitor pill */}
          <button
            type="button"
            onClick={() => setLiveOpen(true)}
            className="group inline-flex items-center gap-1.5 pl-2.5 pr-3 py-1.5 rounded-full border bg-background hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors shadow-sm"
          >
            <span className="relative flex h-2 w-2">
              {live_users.live_5m > 0 && (
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
              )}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${live_users.live_5m > 0 ? "bg-emerald-500" : "bg-slate-400"}`} />
            </span>
            <span className="text-xs font-medium">
              {live_users.live_5m} live visitor{live_users.live_5m === 1 ? "" : "s"}
            </span>
          </button>
          <button
            onClick={refresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
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

      {/* Alerts — anomaly detection strip */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a, i) => {
            const style = a.severity === "critical"
              ? "bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-900/60 text-red-900 dark:text-red-200"
              : a.severity === "warning"
                ? "bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-900/60 text-amber-900 dark:text-amber-200"
                : "bg-sky-50 dark:bg-sky-950/30 border-sky-300 dark:border-sky-900/60 text-sky-900 dark:text-sky-200"
            const Icon = a.severity === "critical" ? XCircle : a.severity === "warning" ? AlertTriangle : Activity
            return (
              <div key={i} className={`border rounded-md px-3 py-2 flex items-start gap-2.5 text-sm ${style}`}>
                <Icon className="h-4 w-4 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{a.message}</div>
                  {a.hint && <div className="text-xs opacity-80 mt-0.5">{a.hint}</div>}
                </div>
                <Badge variant="outline" className="text-[10px] uppercase">{a.severity}</Badge>
              </div>
            )
          })}
        </div>
      )}

      {/* System Health Strip — at-a-glance green/amber/red */}
      <Card>
        <CardContent className="py-3 px-4">
          <div className="flex items-center gap-6 flex-wrap text-xs">
            <HealthPill
              label="Database"
              ok={system_health.db_ok}
              value={`${system_health.db_latency_ms}ms`}
            />
            <HealthPill
              label="Errors 24h"
              ok={system_health.errors_24h < 3}
              warn={system_health.errors_24h >= 3 && system_health.errors_24h < 10}
              value={`${system_health.errors_24h}`}
            />
            <HealthPill
              label="Scrape success"
              ok={system_health.scrape_fail_rate < 0.15 || system_health.scrapes_24h < 10}
              warn={system_health.scrape_fail_rate >= 0.15 && system_health.scrape_fail_rate < 0.30}
              value={system_health.scrapes_24h > 0
                ? `${Math.round((1 - system_health.scrape_fail_rate) * 100)}%`
                : "idle"}
            />
            <HealthPill
              label="Last price scrape"
              ok={(system_health.last_price_scrape_age_sec ?? Infinity) < 6 * 3600}
              warn={(system_health.last_price_scrape_age_sec ?? 0) >= 6 * 3600 && (system_health.last_price_scrape_age_sec ?? 0) < 24 * 3600}
              value={system_health.last_price_scrape ? timeAgo(system_health.last_price_scrape) : "never"}
            />
            <HealthPill
              label="Last Amazon scrape"
              ok={(system_health.last_amazon_scrape_age_sec ?? Infinity) < 24 * 3600}
              warn={(system_health.last_amazon_scrape_age_sec ?? 0) >= 24 * 3600 && (system_health.last_amazon_scrape_age_sec ?? 0) < 72 * 3600}
              value={system_health.last_amazon_scrape ? timeAgo(system_health.last_amazon_scrape) : "never"}
            />
            <HealthPill
              label="Last Claude call"
              ok={(system_health.last_anthropic_call_age_sec ?? Infinity) < 6 * 3600}
              warn={(system_health.last_anthropic_call_age_sec ?? 0) >= 6 * 3600 && (system_health.last_anthropic_call_age_sec ?? 0) < 24 * 3600}
              value={system_health.last_anthropic_call ? timeAgo(system_health.last_anthropic_call) : "never"}
            />
          </div>
        </CardContent>
      </Card>

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
            <button
              type="button"
              onClick={() => setLiveOpen(true)}
              className="ml-2 inline-flex items-center gap-1 px-2 py-1 rounded-md border border-white/15 bg-white/5 hover:bg-white/10 text-[11px] transition-colors"
            >
              Open Live View →
            </button>
          </div>
        </CardHeader>

        <CardContent className="relative p-0">
          {live_users.points.length === 0 ? (
            <div className="h-[560px] flex flex-col items-center justify-center text-slate-500 gap-2">
              <Globe className="h-10 w-10 opacity-30" />
              <p className="text-xs">No users online right now</p>
              <p className="text-[10px] text-slate-600">Dots will appear here the moment someone opens the app</p>
            </div>
          ) : (
            <Suspense
              fallback={
                <div className="h-[560px] flex items-center justify-center">
                  <div className="h-8 w-8 rounded-full border-2 border-emerald-500/30 border-t-emerald-400 animate-spin" />
                </div>
              }
            >
              <LiveGlobe points={live_users.points} dark heightPx={560} />
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
              <button
                key={i}
                type="button"
                onClick={() => setSelectedUser(u.email)}
                className="w-full flex items-center justify-between gap-2 text-left hover:bg-muted/50 rounded-md -mx-2 px-2 py-1 transition-colors"
              >
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
              </button>
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
              <button
                key={i}
                type="button"
                onClick={() => setSelectedUser(u.email)}
                className="w-full flex items-center justify-between gap-2 text-left hover:bg-muted/50 rounded-md -mx-2 px-2 py-1 transition-colors"
              >
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
              </button>
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
            <CardDescription className="text-xs">
              Unique active users · stickiness {stickiness.dau_over_mau_pct.toFixed(1)}% (DAU/MAU)
              {stickiness.dau_over_mau_pct >= 20 ? " — great" : stickiness.dau_over_mau_pct >= 10 ? " — healthy" : stickiness.dau_over_mau_pct > 0 ? " — growing" : ""}
            </CardDescription>
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
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelectedUser(u.email)}
                  className="w-full text-left space-y-1 hover:bg-muted/50 rounded-md -mx-2 px-2 py-1 transition-colors"
                >
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
                </button>
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

      {/* At-Risk Users — 3-column triage panel */}
      <Card className="relative overflow-hidden border-rose-200 dark:border-rose-900/40">
        <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-rose-400/10 blur-3xl" />
        <CardHeader className="relative">
          <CardTitle className="text-base flex items-center gap-2">
            <UserX className="h-4 w-4 text-rose-500" />
            At-Risk Users
            {atRiskTotal > 0 && (
              <Badge variant="destructive" className="text-[10px] ml-1">{atRiskTotal}</Badge>
            )}
          </CardTitle>
          <CardDescription className="text-xs">Actionable — silent paid · ending trials · credit exhaustion</CardDescription>
        </CardHeader>
        <CardContent className="relative">
          <div className="grid gap-5 grid-cols-1 md:grid-cols-3">

            {/* Silent paid */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wide">Silent Paid (7d+)</span>
                <Badge variant="outline" className="text-[10px]">{at_risk.silent_paid.length}</Badge>
              </div>
              {at_risk.silent_paid.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">All paid users active — good.</p>
              ) : (
                <div className="space-y-1.5">
                  {at_risk.silent_paid.slice(0, 8).map((u, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setSelectedUser(u.email)}
                      className="w-full flex items-center justify-between gap-2 text-xs text-left hover:bg-muted/50 rounded px-1 py-0.5 transition-colors"
                    >
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        {u.country_code && <span>{flagOf(u.country_code)}</span>}
                        <span className="truncate">{u.email}</span>
                      </div>
                      <Badge variant="secondary" className="text-[10px] shrink-0">{u.days_silent}d</Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Ending trials */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">Trials Ending (≤3d)</span>
                <Badge variant="outline" className="text-[10px]">{at_risk.ending_trials.length}</Badge>
              </div>
              {at_risk.ending_trials.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No trials ending soon.</p>
              ) : (
                <div className="space-y-1.5">
                  {at_risk.ending_trials.slice(0, 8).map((u, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setSelectedUser(u.email)}
                      className="w-full flex items-center justify-between gap-2 text-xs text-left hover:bg-muted/50 rounded px-1 py-0.5 transition-colors"
                    >
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        {u.country_code && <span>{flagOf(u.country_code)}</span>}
                        <span className="truncate">{u.email}</span>
                      </div>
                      <Badge variant="secondary" className="text-[10px] shrink-0">{u.days_left}d</Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Credit exhaustion */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wide">Over 80% Credits</span>
                <Badge variant="outline" className="text-[10px]">{at_risk.credit_exhaustion.length}</Badge>
              </div>
              {at_risk.credit_exhaustion.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No one near their limit.</p>
              ) : (
                <div className="space-y-1.5">
                  {at_risk.credit_exhaustion.slice(0, 8).map((u, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setSelectedUser(u.email)}
                      className="w-full flex items-center justify-between gap-2 text-xs text-left hover:bg-muted/50 rounded px-1 py-0.5 transition-colors"
                    >
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        {u.country_code && <span>{flagOf(u.country_code)}</span>}
                        <span className="truncate">{u.email}</span>
                      </div>
                      <Badge variant="secondary" className="text-[10px] shrink-0">{u.pct_used}%</Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>

          </div>
        </CardContent>
      </Card>

      {/* Activation + Anthropic Spend */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">

        {/* Activation latency + TTFV histogram */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Hourglass className="h-4 w-4 text-cyan-500" />
              Activation
            </CardTitle>
            <CardDescription className="text-xs">Signup → first search · 90-day cohort</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 rounded-md bg-cyan-50 dark:bg-cyan-950/30">
                <div className="text-xs text-muted-foreground">Median time</div>
                <div className="text-xl font-bold mt-0.5">
                  {activation.median_hours < 1
                    ? `${Math.round(activation.median_hours * 60)}m`
                    : activation.median_hours < 48
                      ? `${activation.median_hours.toFixed(1)}h`
                      : `${(activation.median_hours / 24).toFixed(1)}d`}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {activation.median_hours === 0 ? "No data yet" :
                   activation.median_hours <= 1 ? "excellent" :
                   activation.median_hours <= 24 ? "healthy" :
                   "onboarding needs work"}
                </div>
              </div>
              <div className="p-3 rounded-md bg-cyan-50 dark:bg-cyan-950/30">
                <div className="text-xs text-muted-foreground">Activated</div>
                <div className="text-xl font-bold mt-0.5">{fmt(activation.activated)}</div>
                <div className="text-[10px] text-muted-foreground">users in window</div>
              </div>
            </div>
            <div className="text-[10px] text-muted-foreground mb-1">Time-to-first-value</div>
            <div className="space-y-1.5">
              {activation.histogram.map((b, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground w-12 shrink-0">{b.bucket}</span>
                  <div className="flex-1 relative h-4 bg-muted/40 rounded overflow-hidden">
                    <div
                      className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-cyan-400 to-teal-500 rounded"
                      style={{ width: `${(b.count / maxTtfv) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground w-8 text-right shrink-0">{b.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Anthropic API Spend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="h-4 w-4 text-purple-500" />
              Anthropic API Spend <span className="text-[10px] text-muted-foreground font-normal">(estimated)</span>
            </CardTitle>
            <CardDescription className="text-xs">Cost derived from call counts × avg per-call cost</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 rounded-md bg-purple-50 dark:bg-purple-950/30">
                <div className="text-xs text-muted-foreground">Last 7 days</div>
                <div className="text-xl font-bold mt-0.5">${anthropic_spend.last_7d.toFixed(2)}</div>
              </div>
              <div className="p-3 rounded-md bg-purple-50 dark:bg-purple-950/30">
                <div className="text-xs text-muted-foreground">Last 30 days</div>
                <div className="text-xl font-bold mt-0.5">${anthropic_spend.last_30d.toFixed(2)}</div>
              </div>
            </div>
            {anthropic_spend.by_action.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No billable calls yet.</p>
            ) : (
              <div className="space-y-1.5">
                <div className="text-[10px] text-muted-foreground">By action (30d)</div>
                {anthropic_spend.by_action.map((a, i) => {
                  const info = actionInfo(a.action)
                  return (
                    <div key={i} className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <span className={`h-2 w-2 rounded-full shrink-0 ${info.color}`} />
                        <span className="truncate">{info.label}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-muted-foreground">{fmt(a.calls)} calls</span>
                        <span className="font-semibold text-purple-600 dark:text-purple-400 min-w-[48px] text-right">${a.cost.toFixed(2)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      {/* Feature Adoption + Cohort Retention */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">

        {/* Feature Adoption */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="h-4 w-4 text-teal-500" />
              Feature Adoption (30d)
            </CardTitle>
            <CardDescription className="text-xs">% of monthly active users who touched each feature</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {feature_adoption.length === 0 ? (
              <p className="text-xs text-muted-foreground">No activity yet</p>
            ) : feature_adoption.map((f, i) => {
              const info = actionInfo(f.action)
              const widthPct = (f.pct / maxAdoptionPct) * 100
              return (
                <div key={i} className="space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <span className={`h-2 w-2 rounded-full shrink-0 ${info.color}`} />
                      <span className="text-xs truncate">{info.label}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-muted-foreground">{f.users}u</span>
                      <span className="text-xs font-semibold text-teal-600 dark:text-teal-400 min-w-[44px] text-right">{f.pct.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="relative h-1.5 bg-muted/40 rounded overflow-hidden ml-3.5">
                    <div className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-teal-400 to-emerald-500 rounded" style={{ width: `${widthPct}%` }} />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        {/* Cohort Retention */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Repeat className="h-4 w-4 text-violet-500" />
              Cohort Retention
            </CardTitle>
            <CardDescription className="text-xs">% of each signup week still active by week N</CardDescription>
          </CardHeader>
          <CardContent>
            {cohort_retention.length === 0 ? (
              <p className="text-xs text-muted-foreground">No cohorts yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="text-muted-foreground">
                      <th className="text-left font-medium py-1 pr-2">Cohort</th>
                      <th className="text-right font-medium py-1 px-1.5">Size</th>
                      <th className="text-right font-medium py-1 px-1.5">W0</th>
                      <th className="text-right font-medium py-1 px-1.5">W1</th>
                      <th className="text-right font-medium py-1 px-1.5">W2</th>
                      <th className="text-right font-medium py-1 pl-1.5">W3</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cohort_retention.map((r, i) => {
                      const pct = (v: number) => r.size > 0 ? Math.round((v / r.size) * 100) : 0
                      const cell = (v: number) => {
                        const p = pct(v)
                        const bg = p >= 75 ? "bg-violet-500/60 text-white" :
                                   p >= 50 ? "bg-violet-500/40 text-white" :
                                   p >= 25 ? "bg-violet-500/25" :
                                   p > 0   ? "bg-violet-500/10" :
                                             "bg-muted/20 text-muted-foreground"
                        return (
                          <td className={`text-right px-1.5 py-1 rounded ${bg}`}>
                            {v > 0 ? `${p}%` : "—"}
                          </td>
                        )
                      }
                      return (
                        <tr key={i} className="border-t">
                          <td className="py-1 pr-2 font-medium">{formatDate(r.week)}</td>
                          <td className="text-right py-1 px-1.5 text-muted-foreground">{r.size}</td>
                          {cell(r.w0)}
                          {cell(r.w1)}
                          {cell(r.w2)}
                          {cell(r.w3)}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Biggest Price Moves + Trial Abuse */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">

        {/* Biggest Price Moves */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Flame className="h-4 w-4 text-orange-500" />
              Biggest Price Moves (7d)
            </CardTitle>
            <CardDescription className="text-xs">Products with the largest high-to-low delta this week</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {price_moves.length === 0 ? (
              <p className="text-xs text-muted-foreground">No price movement detected yet</p>
            ) : price_moves.map((p, i) => (
              <div key={i} className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <ArrowDownRight className="h-3 w-3 text-emerald-500 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium truncate">{p.product}</div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {p.brand ? `${p.brand} · ` : ""}{p.retailer} · {p.currency} {p.low.toFixed(2)} – {p.high.toFixed(2)}
                      </div>
                    </div>
                  </div>
                  <Badge
                    variant="secondary"
                    className="text-[10px] shrink-0 bg-orange-100 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400"
                  >
                    −{p.delta_pct.toFixed(1)}%
                  </Badge>
                </div>
                <div className="relative h-1 bg-muted/40 rounded overflow-hidden ml-5">
                  <div className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-orange-400 to-red-500 rounded" style={{ width: `${(p.delta_pct / maxPriceMove) * 100}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Trial Abuse Clusters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Fingerprint className="h-4 w-4 text-red-500" />
              Trial Abuse Clusters (60d)
            </CardTitle>
            <CardDescription className="text-xs">IPs with multiple signups — potential multi-accounting</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {trial_abuse.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No suspicious clusters — clean signups.</p>
            ) : trial_abuse.map((c, i) => (
              <div key={i} className="border rounded-md p-2 bg-red-50/40 dark:bg-red-950/10">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    {c.country_code && <span>{flagOf(c.country_code)}</span>}
                    <code className="text-[10px] text-muted-foreground">{c.ip}</code>
                  </div>
                  <Badge variant="destructive" className="text-[10px] shrink-0">{c.accounts} accounts</Badge>
                </div>
                <div className="mt-1 text-[10px] text-muted-foreground">
                  {c.emails.slice(0, 4).join(" · ")}
                  {c.emails.length > 4 && ` · +${c.emails.length - 4} more`}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Broadcast Composer + UTM Attribution */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">

        {/* Broadcast Composer */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-sky-500" />
              Broadcast Banner
            </CardTitle>
            <CardDescription className="text-xs">Push a dismissible message to every signed-in user</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <textarea
              value={broadcastDraft}
              onChange={e => setBroadcastDraft(e.target.value.slice(0, 500))}
              placeholder="e.g. Maintenance 8pm UTC — expect 5 min downtime"
              className="w-full min-h-[60px] rounded-md border bg-background text-xs px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500/30 resize-y"
            />
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap">
                {(["info","success","warn","danger"] as const).map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setBroadcastVariant(v)}
                    className={`text-[10px] px-2 py-1 rounded-md border transition-colors ${
                      broadcastVariant === v
                        ? v === "danger"  ? "bg-red-600 text-white border-red-600"
                        : v === "warn"    ? "bg-amber-500 text-white border-amber-500"
                        : v === "success" ? "bg-emerald-600 text-white border-emerald-600"
                        : "bg-slate-900 text-white border-slate-900"
                        : "bg-transparent"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <span className="text-[10px] text-muted-foreground">{broadcastDraft.length}/500</span>
              <button
                type="button"
                onClick={createBroadcast}
                disabled={!broadcastDraft.trim() || broadcastSaving}
                className="text-xs inline-flex items-center gap-1 bg-sky-600 hover:bg-sky-700 disabled:opacity-40 text-white px-3 py-1.5 rounded-md transition-colors"
              >
                <Plus className="h-3 w-3" />
                {broadcastSaving ? "Publishing..." : "Publish"}
              </button>
            </div>
            {broadcasts.length > 0 && (
              <div className="pt-2 border-t space-y-1.5 max-h-40 overflow-y-auto">
                {broadcasts.slice(0, 10).map(b => (
                  <div key={b.id} className="flex items-center justify-between gap-2 text-[11px]">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${b.active ? "bg-emerald-500" : "bg-slate-400"}`} />
                      <span className="truncate">{b.message}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(b.created_at)}</span>
                    {b.active && (
                      <button
                        type="button"
                        onClick={() => deactivateBroadcast(b.id)}
                        className="text-[10px] text-red-500 hover:text-red-600 shrink-0"
                      >Stop</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* UTM Attribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Link2 className="h-4 w-4 text-fuchsia-500" />
              Signup Source (90d)
            </CardTitle>
            <CardDescription className="text-xs">UTM / referrer attribution · paid conversion per channel</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {utm_breakdown.length === 0 ? (
              <p className="text-xs text-muted-foreground">No signups in the last 90 days</p>
            ) : utm_breakdown.map((u, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <span className="text-xs truncate flex-1 font-medium">{u.source}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className="text-[10px]">{u.signups} signups</Badge>
                  <Badge variant="secondary" className="text-[10px]">{u.paid} paid</Badge>
                  <span className="text-xs font-semibold text-fuchsia-600 dark:text-fuchsia-400 min-w-[44px] text-right">{u.conversion_pct}%</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Error Feed + Slow Endpoints */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">

        {/* Error Feed */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Bug className="h-4 w-4 text-red-500" />
              Errors
              {error_counts.last_24h > 0 && (
                <Badge variant="destructive" className="text-[10px] ml-1">{error_counts.last_24h} in 24h</Badge>
              )}
            </CardTitle>
            <CardDescription className="text-xs">Last 50 backend 5xx + uncaught exceptions · {error_counts.last_7d} in 7d</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y max-h-80 overflow-y-auto">
              {error_feed.length === 0 ? (
                <p className="text-xs text-muted-foreground italic p-4">No errors logged — system healthy.</p>
              ) : error_feed.map((e) => (
                <div key={e.id} className="px-4 py-2 text-xs hover:bg-muted/30 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                          e.level === "fatal" ? "bg-red-600" :
                          e.level === "error" ? "bg-red-500" : "bg-amber-500"
                        }`} />
                        {e.status && <Badge variant="outline" className="text-[10px] px-1 py-0">{e.status}</Badge>}
                        {e.source && <span className="text-[10px] text-muted-foreground">{e.source}</span>}
                        {e.path && <code className="text-[10px] text-muted-foreground truncate">{e.path}</code>}
                      </div>
                      <div className="font-medium text-xs truncate">{e.message}</div>
                      {e.user_email && (
                        <div className="text-[10px] text-muted-foreground mt-0.5">{e.user_email}</div>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(e.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Slow Endpoints */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <GaugeCircle className="h-4 w-4 text-yellow-500" />
              Slow Endpoints (24h)
            </CardTitle>
            <CardDescription className="text-xs">Top routes by p95 latency</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y max-h-80 overflow-y-auto">
              {slow_endpoints.length === 0 ? (
                <p className="text-xs text-muted-foreground italic p-4">No traffic yet — come back once requests roll in.</p>
              ) : slow_endpoints.map((s, i) => (
                <div key={i} className="px-4 py-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0">{s.method}</Badge>
                      <code className="text-[11px] truncate">{s.route}</code>
                      {s.err_5xx > 0 && (
                        <Badge variant="destructive" className="text-[9px] shrink-0">{s.err_5xx} err</Badge>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">{s.calls} calls</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                    <span>avg <span className="text-foreground font-medium">{s.avg_ms}ms</span></span>
                    <span>p50 <span className="text-foreground font-medium">{s.p50}</span></span>
                    <span>p95 <span className={`font-medium ${s.p95 > 2000 ? "text-red-500" : s.p95 > 1000 ? "text-amber-500" : "text-foreground"}`}>{s.p95}</span></span>
                    <span>p99 <span className="text-foreground font-medium">{s.p99}</span></span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Admin Audit Log + Rate-Limit Hits */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">

        {/* Admin Audit Log */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ScrollText className="h-4 w-4 text-slate-500" />
              Admin Audit Log
            </CardTitle>
            <CardDescription className="text-xs">Privileged actions taken by admins (last 30)</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y max-h-80 overflow-y-auto">
              {admin_audit.length === 0 ? (
                <p className="text-xs text-muted-foreground italic p-4">No admin actions yet.</p>
              ) : admin_audit.map(a => (
                <div key={a.id} className="px-4 py-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                        <span className="font-medium text-xs truncate">{a.actor_email}</span>
                        <Badge variant="outline" className="text-[10px] px-1 py-0">{a.action}</Badge>
                        {a.target_email && (
                          <span className="text-[10px] text-muted-foreground">→ {a.target_email}</span>
                        )}
                      </div>
                      {a.details && Object.keys(a.details).length > 0 && (
                        <code className="text-[10px] text-muted-foreground truncate block">
                          {JSON.stringify(a.details).slice(0, 120)}
                        </code>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(a.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Rate-Limit Hits */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Siren className="h-4 w-4 text-orange-500" />
              Rate-Limit Hits (7d)
            </CardTitle>
            <CardDescription className="text-xs">Users hitting daily / weekly caps · conversion + abuse signal</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {rate_limit_hits.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No one hitting limits right now.</p>
            ) : rate_limit_hits.map((r, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <span className="text-xs truncate font-medium">{r.user_email}</span>
                </div>
                <Badge variant="outline" className="text-[10px] shrink-0">{r.limit_type}</Badge>
                <Badge variant="secondary" className="text-[10px] shrink-0">{r.hits}×</Badge>
                <span className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap">{timeAgo(r.last_hit)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Search Depth + Scrape Confidence */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">

        {/* Search Depth */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Search className="h-4 w-4 text-emerald-500" />
              Search Depth (30d)
            </CardTitle>
            <CardDescription className="text-xs">How deep users go — unlocks per search · avg results · duration</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="p-3 rounded-md bg-emerald-50 dark:bg-emerald-950/30">
                <div className="text-xs text-muted-foreground">Unlocks / search</div>
                <div className="text-xl font-bold mt-0.5">{search_depth.unlocks_per_search.toFixed(2)}</div>
                <div className="text-[10px] text-muted-foreground">
                  {search_depth.unlocks_per_search >= 1.5 ? "deep engagement" :
                   search_depth.unlocks_per_search >= 0.5 ? "healthy" : "mostly browsing"}
                </div>
              </div>
              <div className="p-3 rounded-md bg-emerald-50 dark:bg-emerald-950/30">
                <div className="text-xs text-muted-foreground">Avg results / search</div>
                <div className="text-xl font-bold mt-0.5">{search_depth.avg_results.toFixed(1)}</div>
                <div className="text-[10px] text-muted-foreground">per query</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-2 rounded-md border text-center">
                <div className="text-[10px] text-muted-foreground">Searches</div>
                <div className="text-base font-bold">{fmt(search_depth.searches)}</div>
              </div>
              <div className="p-2 rounded-md border text-center">
                <div className="text-[10px] text-muted-foreground">Avg duration</div>
                <div className="text-base font-bold">
                  {search_depth.avg_duration_s > 0 ? `${search_depth.avg_duration_s}s` : "—"}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Scrape Confidence Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="h-4 w-4 text-lime-500" />
              Scrape Quality (30d)
            </CardTitle>
            <CardDescription className="text-xs">
              Price-source + scrape-status distribution · quality drift detector
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-[11px] text-muted-foreground mb-1.5">Scrape status</div>
              {scrape_status_dist.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No snapshots in the last 30 days.</p>
              ) : (
                <div className="space-y-1.5">
                  {scrape_status_dist.map((s, i) => {
                    const pct = totalScrapeStatus > 0 ? (s.count / totalScrapeStatus) * 100 : 0
                    const color = s.status === "success" ? "bg-emerald-500"
                                : s.status === "failed"  ? "bg-red-500"
                                : s.status === "blocked" ? "bg-amber-500"
                                                         : "bg-slate-400"
                    return (
                      <div key={i}>
                        <div className="flex items-center justify-between text-xs mb-0.5">
                          <span>{s.status}</span>
                          <span className="font-semibold">{pct.toFixed(1)}% · {fmt(s.count)}</span>
                        </div>
                        <div className="relative h-1.5 bg-muted/40 rounded overflow-hidden">
                          <div className={`absolute left-0 top-0 bottom-0 ${color} rounded`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div>
              <div className="text-[11px] text-muted-foreground mb-1.5">B2C price source mix</div>
              {price_source_dist.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No B2C searches yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {price_source_dist.map((p, i) => {
                    const pct = totalPriceSource > 0 ? (p.count / totalPriceSource) * 100 : 0
                    return (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-xs w-24 truncate shrink-0">{p.source || "unknown"}</span>
                        <div className="flex-1 relative h-1.5 bg-muted/40 rounded overflow-hidden">
                          <div className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-lime-400 to-emerald-500 rounded" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[11px] font-semibold shrink-0 min-w-[40px] text-right">{pct.toFixed(0)}%</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
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

      {/* User drill-down — opens when any user row is clicked */}
      <UserDetailSheet
        email={selectedUser}
        open={!!selectedUser}
        onOpenChange={(v) => { if (!v) setSelectedUser(null) }}
      />

      {/* Live View fullscreen — opens from the pill or "Open Live View" button */}
      <LiveViewDialog
        open={liveOpen}
        onOpenChange={setLiveOpen}
        points={live_users.points}
        liveCount={live_users.live_5m}
        recentCount={Math.max(0, live_users.live_30m - live_users.live_5m)}
        activeToday={live_users.active_24h}
        searches24h={searches.last_24h}
        totalSearches={searches.total}
      />

    </div>
  )
}
