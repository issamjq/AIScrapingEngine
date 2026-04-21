/**
 * Admin Dashboard — restricted to mhmdkrissaty@gmail.com + karaaliissa@gmail.com.
 * Shows real platform metrics: users, searches, scrapes, credits, charts.
 */

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card"
import { Badge } from "./ui/badge"
import {
  Users, Search, Database, Zap, TrendingUp, ShoppingBag,
  Globe, Activity, Clock, RefreshCw,
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
      setStats(json.data)
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

  const { users, searches, scrapes, creator_intel, catalog, credits, charts, top_queries, users_by_plan, recent_signups } = stats

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
                <Tooltip labelStyle={{ fontSize: 11 }} contentStyle={{ fontSize: 11 }} />
                <Bar dataKey="users" fill="#3b82f6" radius={[4, 4, 0, 0]} name="New users" />
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
                <Tooltip labelStyle={{ fontSize: 11 }} contentStyle={{ fontSize: 11 }} />
                <Bar dataKey="count" fill="#818cf8" radius={[0, 4, 4, 0]} name="Users" />
              </BarChart>
            </ResponsiveContainer>
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

    </div>
  )
}
