/**
 * Creator Intelligence v2 — real Kalodata-style dashboard.
 * Pulls live data from /api/creator-intel/* endpoints.
 * Dev role gets admin scrape buttons to trigger fresh data.
 */

import { useState, useEffect, useCallback } from "react"
import {
  RefreshCw, TrendingUp, ShoppingBag, Star, Package,
  ArrowUpRight, ArrowDownRight, ChevronDown, ChevronRight,
  Search, SlidersHorizontal, BarChart2, Zap,
} from "lucide-react"
import { useAuth } from "@/context/AuthContext"

interface Props { role?: string }

const API = import.meta.env.VITE_API_URL || "http://localhost:8080"

// ─── API types ────────────────────────────────────────────────────────────────

interface TikTokProduct {
  product_name:       string
  category:           string | null
  tiktok_price:       string | number | null
  gmv_7d:             string | number | null
  units_sold_7d:      string | number | null
  growth_pct:         string | number | null
  video_count:        string | number | null
  top_creator_handle: string | null
  shop_name:          string | null
  image_url:          string | null
  scraped_at?:        string
}

interface AmazonProduct {
  asin:         string | null
  product_name: string
  category:     string | null
  rank:         number | null
  price:        string | number | null
  rating:       string | number | null
  review_count: string | number | null
  marketplace:  string
}

interface Freshness {
  tiktok_last_scraped:  string | null
  amazon_last_scraped:  string | null
  tiktok_product_count: number
  amazon_product_count: number
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtGMV(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—"
  const n = Number(v)
  if (!isFinite(n) || n === 0) return "—"
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}m`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}k`
  return `$${n.toFixed(0)}`
}

function fmtCount(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—"
  const n = Number(v)
  if (!isFinite(n) || n === 0) return "—"
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`
  return String(Math.round(n))
}

function fmtPrice(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—"
  const n = Number(v)
  return isFinite(n) && n > 0 ? `$${n.toFixed(2)}` : "—"
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" })
}

function fmtRelative(iso: string | null | undefined): string {
  if (!iso) return "Never"
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ growth, positive }: { growth: number; positive: boolean }) {
  const len = 12
  const arr: number[] = []
  let v = 50
  for (let i = 0; i < len; i++) {
    v += (growth / len) + (Math.sin(i * 1.3) * 4)
    arr.push(Math.max(10, Math.min(90, v)))
  }
  const min = Math.min(...arr), max = Math.max(...arr)
  const range = max - min || 1
  const W = 64, H = 24
  const pts = arr.map((p, i) => `${(i / (len - 1)) * W},${H - ((p - min) / range) * (H - 4) - 2}`).join(" ")
  return (
    <svg width={W} height={H} className="overflow-visible shrink-0">
      <polyline
        points={pts}
        fill="none"
        stroke={positive ? "#22c55e" : "#ef4444"}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "bg-pink-400","bg-amber-400","bg-blue-400","bg-green-400",
  "bg-purple-400","bg-red-400","bg-teal-400","bg-rose-400",
  "bg-orange-400","bg-cyan-400","bg-indigo-400","bg-lime-500",
]

function ProductAvatar({ imageUrl, name, idx }: { imageUrl: string | null; name: string; idx: number }) {
  const [broken, setBroken] = useState(false)
  if (imageUrl && !broken) {
    return (
      <img
        src={imageUrl}
        alt={name}
        className="h-9 w-9 rounded-lg object-cover shrink-0"
        onError={() => setBroken(true)}
      />
    )
  }
  return (
    <div className={`h-9 w-9 rounded-lg ${AVATAR_COLORS[idx % AVATAR_COLORS.length]} flex items-center justify-center shrink-0`}>
      <span className="text-white text-[10px] font-bold">{name.slice(0, 2).toUpperCase()}</span>
    </div>
  )
}

// ─── Stars ────────────────────────────────────────────────────────────────────

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} className={`h-2.5 w-2.5 ${i <= Math.round(rating) ? "text-amber-400 fill-amber-400" : "text-muted-foreground/25"}`} />
      ))}
      <span className="text-[11px] text-muted-foreground ml-1">{rating.toFixed(1)}</span>
    </div>
  )
}

// ─── TikTok products table ────────────────────────────────────────────────────

function TikTokTable({ products, loading }: { products: TikTokProduct[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="divide-y">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
            <div className="h-9 w-9 rounded-lg bg-muted shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 bg-muted rounded w-3/4" />
              <div className="h-2.5 bg-muted rounded w-1/3" />
            </div>
            <div className="h-3 bg-muted rounded w-16 hidden sm:block" />
            <div className="h-3 bg-muted rounded w-12 hidden md:block" />
          </div>
        ))}
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
        <ShoppingBag className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm font-medium text-muted-foreground">No products yet</p>
        <p className="text-xs text-muted-foreground/70">Run a TikTok scrape to populate data</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-[11px] text-muted-foreground uppercase tracking-wider">
            <th className="text-left px-4 py-2.5 font-medium w-8">#</th>
            <th className="text-left px-2 py-2.5 font-medium">Product</th>
            <th className="text-right px-3 py-2.5 font-medium hidden sm:table-cell">GMV 7d</th>
            <th className="text-right px-3 py-2.5 font-medium hidden md:table-cell">Units Sold</th>
            <th className="text-right px-3 py-2.5 font-medium hidden lg:table-cell">Price</th>
            <th className="text-right px-3 py-2.5 font-medium hidden xl:table-cell">Creators</th>
            <th className="text-center px-3 py-2.5 font-medium hidden md:table-cell">Trend</th>
            <th className="text-right px-3 py-2.5 font-medium hidden lg:table-cell">Growth</th>
            <th className="text-right px-3 py-2.5 font-medium hidden xl:table-cell">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {products.map((p, i) => {
            const growth  = p.growth_pct != null ? Number(p.growth_pct) : null
            const isUp    = growth != null && growth > 0
            return (
              <tr key={i} className="hover:bg-muted/30 transition-colors group">
                <td className="px-4 py-3 text-muted-foreground text-xs">{i + 1}</td>
                <td className="px-2 py-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <ProductAvatar imageUrl={p.image_url} name={p.product_name} idx={i} />
                    <div className="min-w-0">
                      <p className="text-xs font-medium leading-tight line-clamp-2 max-w-[260px]">{p.product_name}</p>
                      {p.category && (
                        <span className="mt-0.5 inline-block text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {p.category}
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 text-right hidden sm:table-cell">
                  <span className="text-xs font-semibold tabular-nums">{fmtGMV(p.gmv_7d)}</span>
                </td>
                <td className="px-3 py-3 text-right hidden md:table-cell">
                  <span className="text-xs tabular-nums text-muted-foreground">{fmtCount(p.units_sold_7d)}</span>
                </td>
                <td className="px-3 py-3 text-right hidden lg:table-cell">
                  <span className="text-xs tabular-nums">{fmtPrice(p.tiktok_price)}</span>
                </td>
                <td className="px-3 py-3 text-right hidden xl:table-cell">
                  <span className="text-xs tabular-nums text-muted-foreground">{fmtCount(p.video_count)}</span>
                </td>
                <td className="px-3 py-3 text-center hidden md:table-cell">
                  {growth != null
                    ? <Sparkline growth={growth} positive={isUp} />
                    : <span className="text-muted-foreground/40 text-xs">—</span>
                  }
                </td>
                <td className="px-3 py-3 text-right hidden lg:table-cell">
                  {growth != null ? (
                    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${isUp ? "text-green-500" : "text-red-500"}`}>
                      {isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                      {Math.abs(growth).toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-muted-foreground/40 text-xs">—</span>
                  )}
                </td>
                <td className="px-3 py-3 text-right hidden xl:table-cell">
                  <span className="text-[11px] text-muted-foreground">{fmtDate(p.scraped_at)}</span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Amazon table ─────────────────────────────────────────────────────────────

function AmazonTable({ products, loading }: { products: AmazonProduct[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="divide-y">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
            <div className="h-9 w-9 rounded-lg bg-muted shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 bg-muted rounded w-3/4" />
              <div className="h-2.5 bg-muted rounded w-1/4" />
            </div>
            <div className="h-3 bg-muted rounded w-12 hidden sm:block" />
          </div>
        ))}
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
        <Package className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm font-medium text-muted-foreground">No Amazon data yet</p>
        <p className="text-xs text-muted-foreground/70">Run an Amazon scrape to populate data</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-[11px] text-muted-foreground uppercase tracking-wider">
            <th className="text-left px-4 py-2.5 font-medium w-8">BSR</th>
            <th className="text-left px-2 py-2.5 font-medium">Product</th>
            <th className="text-right px-3 py-2.5 font-medium hidden sm:table-cell">Price</th>
            <th className="text-right px-3 py-2.5 font-medium hidden md:table-cell">Rating</th>
            <th className="text-right px-3 py-2.5 font-medium hidden lg:table-cell">Reviews</th>
            <th className="text-right px-3 py-2.5 font-medium hidden xl:table-cell">Market</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {products.map((p, i) => (
            <tr key={i} className="hover:bg-muted/30 transition-colors">
              <td className="px-4 py-3">
                <span className="text-xs font-mono font-medium text-muted-foreground">#{p.rank ?? i + 1}</span>
              </td>
              <td className="px-2 py-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`h-9 w-9 rounded-lg ${AVATAR_COLORS[i % AVATAR_COLORS.length]} flex items-center justify-center shrink-0`}>
                    <span className="text-white text-[10px] font-bold">{p.product_name.slice(0, 2).toUpperCase()}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium leading-tight line-clamp-2 max-w-[260px]">{p.product_name}</p>
                    {p.category && (
                      <span className="mt-0.5 inline-block text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                        {p.category}
                      </span>
                    )}
                    {p.asin && (
                      <span className="ml-1 text-[10px] text-muted-foreground/50 font-mono">{p.asin}</span>
                    )}
                  </div>
                </div>
              </td>
              <td className="px-3 py-3 text-right hidden sm:table-cell">
                <span className="text-xs font-semibold">{fmtPrice(p.price)}</span>
              </td>
              <td className="px-3 py-3 text-right hidden md:table-cell">
                {p.rating != null && Number(p.rating) > 0
                  ? <Stars rating={Number(p.rating)} />
                  : <span className="text-muted-foreground/40 text-xs">—</span>
                }
              </td>
              <td className="px-3 py-3 text-right hidden lg:table-cell">
                <span className="text-xs tabular-nums text-muted-foreground">{fmtCount(p.review_count)}</span>
              </td>
              <td className="px-3 py-3 text-right hidden xl:table-cell">
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#FF9900]/15 text-[#b86e00] dark:text-[#FF9900] font-medium">
                  {p.marketplace}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Filter sidebar ───────────────────────────────────────────────────────────

function FilterGroup({
  label, items, activeItem, onSelect,
}: {
  label:      string
  items:      string[]
  activeItem?: string
  onSelect?:  (item: string) => void
}) {
  const [open, setOpen] = useState(true)
  return (
    <div className="border-b last:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/40 transition-colors"
      >
        <span className="text-xs font-semibold">{label}</span>
        {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>
      {open && (
        <div className="px-4 pb-3 space-y-0.5">
          {items.map(item => {
            const isActive = item === activeItem
            return (
              <button
                key={item}
                onClick={() => onSelect?.(item)}
                className={`w-full text-left text-xs px-2 py-1.5 rounded-md transition-colors flex items-center gap-2 ${
                  isActive ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <div className={`h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0 ${isActive ? "border-primary bg-primary" : "border-muted-foreground/40"}`}>
                  {isActive && <div className="h-1.5 w-1.5 bg-white rounded-sm" />}
                </div>
                {item}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

type Tab = "tiktok" | "amazon"

export function CreatorIntelV2Content({ role }: Props) {
  const { user } = useAuth()
  const isDev = role === "dev"

  const [tab, setTab]                 = useState<Tab>("tiktok")
  const [showFilters, setShowFilters] = useState(false)

  // TikTok filter state
  const [dateRange, setDateRange]     = useState<7 | 30 | 90>(30)
  const [category, setCategory]       = useState("All")
  const [sortBy, setSortBy]           = useState<"gmv_7d" | "units_sold_7d" | "growth_pct">("gmv_7d")

  // Amazon filter state
  const [amzMarket, setAmzMarket]     = useState("US")
  const [amzCategory, setAmzCategory] = useState("All")

  // Data
  const [tikTokProducts, setTikTokProducts]   = useState<TikTokProduct[]>([])
  const [amazonProducts, setAmazonProducts]   = useState<AmazonProduct[]>([])
  const [freshness, setFreshness]             = useState<Freshness | null>(null)
  const [tikTokLoading, setTikTokLoading]     = useState(true)
  const [amazonLoading, setAmazonLoading]     = useState(true)

  // Scrape state (admin)
  const [scrapingTikTok, setScrapingTikTok]   = useState(false)
  const [scrapingAmazon, setScrapingAmazon]   = useState(false)
  const [scrapeMsg, setScrapeMsg]             = useState("")

  // Search filter
  const [searchQuery, setSearchQuery] = useState("")

  const getToken = useCallback(async () => {
    if (!user) throw new Error("Not authenticated")
    return (user as any).getIdToken() as Promise<string>
  }, [user])

  const loadTikTok = useCallback(async (opts?: { days?: number; cat?: string; sort?: string }) => {
    setTikTokLoading(true)
    try {
      const token = await getToken()
      const days  = opts?.days ?? dateRange
      const cat   = opts?.cat  ?? category
      const sort  = opts?.sort ?? sortBy

      const params = new URLSearchParams({ limit: "50", sortBy: sort, days: String(days) })
      if (cat && cat !== "All") params.set("category", cat)

      const r = await fetch(`${API}/api/creator-intel/trending?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const j = await r.json()
      if (j.success) setTikTokProducts(j.data ?? [])
    } catch { /* silent */ }
    finally { setTikTokLoading(false) }
  }, [getToken, dateRange, category, sortBy])

  const loadAmazon = useCallback(async (opts?: { market?: string; cat?: string }) => {
    setAmazonLoading(true)
    try {
      const token      = await getToken()
      const marketplace = opts?.market ?? amzMarket
      const cat        = opts?.cat    ?? amzCategory

      const params = new URLSearchParams({ marketplace, limit: "50" })
      if (cat && cat !== "All") params.set("category", cat)

      const r = await fetch(`${API}/api/creator-intel/amazon-trending?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const j = await r.json()
      if (j.success) setAmazonProducts(j.data ?? [])
    } catch { /* silent */ }
    finally { setAmazonLoading(false) }
  }, [getToken, amzMarket, amzCategory])

  const loadFreshness = useCallback(async () => {
    try {
      const token = await getToken()
      const r = await fetch(`${API}/api/creator-intel/freshness`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const j = await r.json()
      if (j.success) setFreshness(j.data)
    } catch { /* silent */ }
  }, [getToken])

  useEffect(() => { loadTikTok() }, [])
  useEffect(() => { loadAmazon() }, [])
  useEffect(() => { loadFreshness() }, [])

  // ── Date range filter
  function handleDateRange(days: 7 | 30 | 90) {
    setDateRange(days)
    loadTikTok({ days })
  }

  // ── Category filter (TikTok)
  const CATEGORY_MAP: Record<string, string> = {
    "Womenswear & Underwear":    "Womenswear",
    "Beauty & Personal Care":    "Beauty",
    "Home & Kitchen":            "Home & Kitchen",
    "Electronics":               "Electronics",
    "Fitness & Sports":          "Sports & Outdoors",
    "Health & Wellness":         "Health",
    "Food & Beverage":           "Food & Beverage",
    "Baby & Kids":               "Baby & Kids",
    "Pets":                      "Pets",
  }

  function handleCategory(label: string) {
    const dbVal = CATEGORY_MAP[label] ?? label
    const next  = dbVal === category ? "All" : dbVal
    setCategory(next)
    loadTikTok({ cat: next })
  }

  // ── Sort
  function handleSort(label: string) {
    const map: Record<string, "gmv_7d" | "units_sold_7d" | "growth_pct"> = {
      "Revenue (GMV)": "gmv_7d",
      "Units Sold":    "units_sold_7d",
      "Growth Rate":   "growth_pct",
    }
    const sort = map[label] ?? "gmv_7d"
    setSortBy(sort)
    loadTikTok({ sort })
  }

  // ── Amazon marketplace
  function handleMarket(label: string) {
    const map: Record<string, string> = { "US": "US", "UAE (AE)": "AE", "UK": "UK" }
    const m = map[label] ?? "US"
    setAmzMarket(m)
    loadAmazon({ market: m })
  }

  // ── Scrape triggers (dev only)
  async function triggerTikTokScrape() {
    setScrapingTikTok(true)
    setScrapeMsg("")
    try {
      const token = await getToken()
      const r = await fetch(`${API}/api/creator-intel/scrape-tiktok`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 20 }),
      })
      const j = await r.json()
      setScrapeMsg(j.success ? `TikTok: inserted ${j.inserted} products (${j.source})` : `Error: ${j.error}`)
      if (j.success) { await loadTikTok(); await loadFreshness() }
    } catch (e: any) {
      setScrapeMsg(`Error: ${e.message}`)
    }
    setScrapingTikTok(false)
  }

  async function triggerAmazonScrape() {
    setScrapingAmazon(true)
    setScrapeMsg("")
    try {
      const token = await getToken()
      const r = await fetch(`${API}/api/creator-intel/scrape-amazon`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ marketplace: amzMarket, limit: 20 }),
      })
      const j = await r.json()
      setScrapeMsg(j.success ? `Amazon: inserted ${j.inserted} products` : `Error: ${j.error}`)
      if (j.success) { await loadAmazon(); await loadFreshness() }
    } catch (e: any) {
      setScrapeMsg(`Error: ${e.message}`)
    }
    setScrapingAmazon(false)
  }

  // ── Filtered display rows
  const filteredTikTok = searchQuery.trim()
    ? tikTokProducts.filter(p => p.product_name.toLowerCase().includes(searchQuery.toLowerCase()))
    : tikTokProducts

  const filteredAmazon = searchQuery.trim()
    ? amazonProducts.filter(p => p.product_name.toLowerCase().includes(searchQuery.toLowerCase()))
    : amazonProducts

  // ── Stats row
  const tikTokGMV = tikTokProducts.reduce((sum, p) => sum + (Number(p.gmv_7d) || 0), 0)

  const sortLabel = sortBy === "gmv_7d" ? "Revenue (GMV)" : sortBy === "units_sold_7d" ? "Units Sold" : "Growth Rate"
  const activeCategory = Object.entries(CATEGORY_MAP).find(([, v]) => v === category)?.[0] ?? (category !== "All" ? category : undefined)

  return (
    <div className="flex flex-col h-full min-h-0">

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 px-0 pb-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Creator Intelligence</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            TikTok Shop + Amazon trending product data
            {freshness && (
              <span className="ml-2 text-muted-foreground/60">
                · TikTok updated {fmtRelative(freshness.tiktok_last_scraped)}
                · Amazon updated {fmtRelative(freshness.amazon_last_scraped)}
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Dev scrape buttons */}
          {isDev && (
            <>
              <button
                onClick={triggerTikTokScrape}
                disabled={scrapingTikTok}
                className="inline-flex items-center gap-1.5 px-3 h-8 rounded-md bg-black text-white text-xs font-medium disabled:opacity-50 hover:bg-black/80 transition-colors"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${scrapingTikTok ? "animate-spin" : ""}`} />
                {scrapingTikTok ? "Scraping…" : "Scrape TikTok"}
              </button>
              <button
                onClick={triggerAmazonScrape}
                disabled={scrapingAmazon}
                className="inline-flex items-center gap-1.5 px-3 h-8 rounded-md bg-[#FF9900] text-black text-xs font-medium disabled:opacity-50 hover:bg-[#FF9900]/80 transition-colors"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${scrapingAmazon ? "animate-spin" : ""}`} />
                {scrapingAmazon ? "Scraping…" : "Scrape Amazon"}
              </button>
            </>
          )}

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(f => !f)}
            className={`inline-flex items-center gap-1.5 px-3 h-8 rounded-md border text-xs font-medium transition-colors ${showFilters ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted/50"}`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filters
          </button>
        </div>
      </div>

      {/* ── Scrape message ─────────────────────────────────────────────── */}
      {scrapeMsg && (
        <div className={`mb-3 px-3 py-2 rounded-lg text-xs font-medium ${scrapeMsg.startsWith("Error") ? "bg-destructive/10 text-destructive" : "bg-green-500/10 text-green-600 dark:text-green-400"}`}>
          {scrapeMsg}
        </div>
      )}

      {/* ── Stats row ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {[
          { icon: TrendingUp, label: "TikTok Products",    value: freshness ? String(freshness.tiktok_product_count) : "—",  sub: "in database"           },
          { icon: BarChart2,  label: "Total GMV (7d)",     value: fmtGMV(tikTokGMV),                                          sub: "estimated"             },
          { icon: Package,    label: "Amazon Products",    value: freshness ? String(freshness.amazon_product_count) : "—",  sub: "in database"           },
          { icon: Zap,        label: "Showing",            value: String(tab === "tiktok" ? filteredTikTok.length : filteredAmazon.length), sub: "filtered results" },
        ].map(({ icon: Icon, label, value, sub }) => (
          <div key={label} className="flex items-center gap-3 p-3 rounded-xl border bg-card">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-base font-bold tabular-nums truncate">{value}</p>
              <p className="text-[10px] text-muted-foreground truncate">{label} · {sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Main area: filters + table ─────────────────────────────────── */}
      <div className="flex gap-4 flex-1 min-h-0">

        {/* Filter panel */}
        {showFilters && (
          <div className="w-52 shrink-0 rounded-xl border bg-card overflow-y-auto self-start">
            {tab === "tiktok" ? (
              <>
                <FilterGroup
                  label="Date Range"
                  items={["Last 7 Days", "Last 30 Days", "Last 90 Days"]}
                  activeItem={dateRange === 7 ? "Last 7 Days" : dateRange === 30 ? "Last 30 Days" : "Last 90 Days"}
                  onSelect={item => handleDateRange(item === "Last 7 Days" ? 7 : item === "Last 30 Days" ? 30 : 90)}
                />
                <FilterGroup
                  label="Category"
                  items={Object.keys(CATEGORY_MAP)}
                  activeItem={activeCategory}
                  onSelect={handleCategory}
                />
                <FilterGroup
                  label="Sort By"
                  items={["Revenue (GMV)", "Units Sold", "Growth Rate"]}
                  activeItem={sortLabel}
                  onSelect={handleSort}
                />
              </>
            ) : (
              <>
                <FilterGroup
                  label="Marketplace"
                  items={["US", "UAE (AE)", "UK"]}
                  activeItem={amzMarket === "AE" ? "UAE (AE)" : amzMarket}
                  onSelect={handleMarket}
                />
                <FilterGroup
                  label="Category"
                  items={["All", "Electronics", "Beauty", "Health & Household", "Kitchen & Dining", "Sports & Outdoors", "Clothing"]}
                  activeItem={amzCategory === "All" ? "All" : amzCategory}
                  onSelect={cat => { setAmzCategory(cat === "All" ? "All" : cat); loadAmazon({ cat: cat === "All" ? "All" : cat }) }}
                />
              </>
            )}
          </div>
        )}

        {/* Right: tabs + search + table */}
        <div className="flex-1 rounded-xl border bg-card flex flex-col min-w-0 overflow-hidden">

          {/* Tab bar + search */}
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b flex-wrap">
            <div className="flex items-center gap-1">
              {(["tiktok", "amazon"] as Tab[]).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    tab === t ? "bg-primary text-primary-foreground" : "hover:bg-muted/50 text-muted-foreground"
                  }`}
                >
                  {t === "tiktok" ? "TikTok Shop" : "Amazon BSR"}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="Search products…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 h-8 text-xs rounded-md border bg-background outline-none focus:ring-1 focus:ring-primary w-48"
              />
            </div>
          </div>

          {/* Active filters chips */}
          {tab === "tiktok" && (
            <div className="flex items-center gap-2 px-4 py-2 border-b flex-wrap">
              {/* Date chip */}
              <button
                onClick={() => handleDateRange(7)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${dateRange === 7 ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted/50 text-muted-foreground"}`}
              >7d</button>
              <button
                onClick={() => handleDateRange(30)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${dateRange === 30 ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted/50 text-muted-foreground"}`}
              >30d</button>
              <button
                onClick={() => handleDateRange(90)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${dateRange === 90 ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted/50 text-muted-foreground"}`}
              >90d</button>

              {/* Active category chip */}
              {activeCategory && (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-primary/10 text-primary border border-primary/20">
                  {activeCategory}
                  <button onClick={() => { setCategory("All"); loadTikTok({ cat: "All" }) }} className="ml-0.5 hover:text-primary/70">×</button>
                </span>
              )}

              {/* Sort chip */}
              <span className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground">
                Sort: <span className="font-medium text-foreground">{sortLabel}</span>
              </span>
            </div>
          )}

          {/* Table */}
          <div className="flex-1 overflow-auto">
            {tab === "tiktok"
              ? <TikTokTable products={filteredTikTok} loading={tikTokLoading} />
              : <AmazonTable products={filteredAmazon} loading={amazonLoading} />
            }
          </div>

        </div>
      </div>

    </div>
  )
}
