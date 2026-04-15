import { useState, useEffect, useCallback } from "react"
import { Search, ChevronDown, ChevronRight, Star, SlidersHorizontal, RefreshCw, Package } from "lucide-react"
import { useAuth } from "@/context/AuthContext"

interface Props { role?: string }

const API = import.meta.env.VITE_API_URL || "http://localhost:8080"

// ─── API type ─────────────────────────────────────────────────────────────────

interface ApiAmazonProduct {
  asin:         string | null
  product_name: string
  category:     string | null
  rank:         number | null
  price:        string | number | null   // AED — Neon returns DECIMAL as string
  rating:       string | number | null
  review_count: string | number | null
  image_url:    string | null
  marketplace:  string
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtAED(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—"
  const n = Number(v)
  return isFinite(n) && n > 0 ? `AED ${n.toFixed(2)}` : "—"
}

function fmtCount(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—"
  const n = Number(v)
  if (!isFinite(n) || n === 0) return "—"
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`
  return String(Math.round(n))
}

function fmtRelative(iso: string | null | undefined): string {
  if (!iso) return "Never"
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60)  return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ─── Stars ────────────────────────────────────────────────────────────────────

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={`h-3 w-3 ${i <= Math.round(rating) ? "text-amber-400 fill-amber-400" : "text-muted-foreground/25"}`} />
      ))}
      <span className="text-xs text-muted-foreground ml-1">{Number(rating).toFixed(1)}</span>
    </div>
  )
}

// ─── Product image with avatar fallback ──────────────────────────────────────

const AVATAR_COLORS = [
  "bg-pink-400","bg-amber-400","bg-blue-400","bg-green-400",
  "bg-purple-400","bg-red-400","bg-teal-400","bg-rose-400",
  "bg-orange-400","bg-cyan-400","bg-indigo-400","bg-lime-500",
]

function ProductImg({ imageUrl, name, idx }: { imageUrl: string | null; name: string; idx: number }) {
  const [broken, setBroken] = useState(false)
  if (imageUrl && !broken) {
    return (
      <div className="relative shrink-0">
        <img
          src={imageUrl}
          alt={name}
          className="h-12 w-12 rounded-lg object-contain bg-white border p-0.5 shrink-0"
          onError={() => setBroken(true)}
        />
        {/* Amazon badge */}
        <div className="absolute -top-1 -left-1 h-5 w-5 rounded-full bg-[#FF9900] flex items-center justify-center">
          <span className="text-[9px] font-black text-black">a</span>
        </div>
      </div>
    )
  }
  return (
    <div className="relative shrink-0">
      <div className={`h-12 w-12 rounded-lg ${AVATAR_COLORS[idx % AVATAR_COLORS.length]} flex items-center justify-center`}>
        <span className="text-white text-[10px] font-bold">{name.slice(0, 2).toUpperCase()}</span>
      </div>
      <div className="absolute -top-1 -left-1 h-5 w-5 rounded-full bg-[#FF9900] flex items-center justify-center">
        <span className="text-[9px] font-black text-black">a</span>
      </div>
    </div>
  )
}

// ─── Filter section ───────────────────────────────────────────────────────────

function FilterSection({
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

// ─── Amazon table ─────────────────────────────────────────────────────────────

function AmazonTable({ products, loading }: { products: ApiAmazonProduct[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="divide-y">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
            <div className="h-12 w-12 rounded-lg bg-muted shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-muted rounded w-3/4" />
              <div className="h-2.5 bg-muted rounded w-1/3" />
            </div>
            <div className="h-3 bg-muted rounded w-20 hidden sm:block" />
            <div className="h-3 bg-muted rounded w-16 hidden md:block" />
          </div>
        ))}
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
        <Package className="h-9 w-9 text-muted-foreground/40" />
        <p className="text-sm font-medium text-muted-foreground">No Amazon.ae data yet</p>
        <p className="text-xs text-muted-foreground/70 max-w-xs">
          Click "Refresh Data" to scrape live Amazon.ae Best Sellers
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b bg-muted/30">
            <th className="text-left px-3 py-3 font-semibold text-muted-foreground w-10">BSR</th>
            <th className="text-left px-3 py-3 font-semibold text-muted-foreground min-w-[280px]">Product</th>
            <th className="text-right px-3 py-3 font-semibold text-muted-foreground">Price (AED)</th>
            <th className="text-center px-3 py-3 font-semibold text-muted-foreground">Rating</th>
            <th className="text-right px-3 py-3 font-semibold text-muted-foreground">Reviews</th>
            <th className="text-left px-3 py-3 font-semibold text-muted-foreground hidden lg:table-cell">Category</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {products.map((p, i) => (
            <tr key={p.asin ?? i} className="hover:bg-muted/20 transition-colors">
              <td className="px-3 py-3 font-bold text-muted-foreground">#{p.rank ?? i + 1}</td>
              <td className="px-3 py-3">
                <div className="flex items-center gap-3">
                  <ProductImg imageUrl={p.image_url} name={p.product_name} idx={i} />
                  <div className="min-w-0">
                    <p className="font-medium text-foreground leading-snug line-clamp-2 max-w-[280px]">{p.product_name}</p>
                    {p.asin && (
                      <p className="text-muted-foreground mt-0.5 font-mono text-[10px]">ASIN: {p.asin}</p>
                    )}
                  </div>
                </div>
              </td>
              <td className="px-3 py-3 text-right font-bold tabular-nums">
                {fmtAED(p.price)}
              </td>
              <td className="px-3 py-3">
                {p.rating != null && Number(p.rating) > 0
                  ? <Stars rating={Number(p.rating)} />
                  : <span className="text-muted-foreground">—</span>
                }
              </td>
              <td className="px-3 py-3 text-right text-muted-foreground tabular-nums">
                {fmtCount(p.review_count)}
              </td>
              <td className="px-3 py-3 hidden lg:table-cell">
                {p.category && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {p.category}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

const CATEGORIES = [
  "All", "Electronics", "Beauty", "Home & Kitchen",
  "Health", "Sports & Outdoors", "Toys & Games", "Fashion", "Books",
]

export function CreatorIntelContent({ role }: Props) {
  const { user } = useAuth()

  const [products,   setProducts]   = useState<ApiAmazonProduct[]>([])
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastScraped, setLastScraped] = useState<string | null>(null)
  const [totalCount,  setTotalCount]  = useState<number>(0)

  const [category,  setCategory]  = useState("All")
  const [search,    setSearch]    = useState("")

  const isAdmin = role === "dev" || role === "owner"

  const getToken = useCallback(async () => {
    try { return user ? await (user as any).getIdToken() : null } catch { return null }
  }, [user])

  const loadData = useCallback(async (cat?: string) => {
    const token = await getToken()
    if (!token) { setLoading(false); return }

    const params = new URLSearchParams({ marketplace: "AE", limit: "100" })
    const activeCat = cat ?? category
    if (activeCat && activeCat !== "All") params.set("category", activeCat)

    try {
      const [amRes, freshRes] = await Promise.all([
        fetch(`${API}/api/creator-intel/amazon-trending?${params}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/creator-intel/freshness`,                  { headers: { Authorization: `Bearer ${token}` } }),
      ])
      if (amRes.ok) {
        const j = await amRes.json()
        setProducts(j.data ?? [])
      }
      if (freshRes.ok) {
        const j = await freshRes.json()
        setLastScraped(j.data?.amazon_last_scraped ?? null)
        setTotalCount(j.data?.amazon_product_count ?? 0)
      }
    } catch (err) {
      console.error("[CreatorIntel] loadData error:", err)
    }
    setLoading(false)
  }, [getToken, category])

  useEffect(() => { loadData() }, [loadData])

  const handleRefresh = async () => {
    const token = await getToken()
    if (!token) return
    setRefreshing(true)
    try {
      await fetch(`${API}/api/creator-intel/scrape-amazon`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ limit: 100 }),
      })
      await loadData()
    } catch { /* ignore */ }
    setRefreshing(false)
  }

  const handleCategory = (cat: string) => {
    setCategory(cat)
    loadData(cat)
  }

  // Client-side search
  const filtered = search.trim()
    ? products.filter(p => p.product_name.toLowerCase().includes(search.toLowerCase()))
    : products

  const isLive = products.length > 0

  return (
    <div className="flex flex-col h-full -m-4 sm:-m-6">

      {/* ── Top bar ────────────────────────────────────────────────── */}
      <div className="border-b bg-card px-4 sm:px-6 pt-4 pb-0">
        <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-black tracking-tight">Creator Intelligence</h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FF9900]/15 text-[#c47b00] dark:text-[#FF9900] border border-[#FF9900]/30">
              Amazon.ae
            </span>
            {loading ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground border">Loading…</span>
            ) : isLive ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 border border-green-500/20">
                Live · {fmtRelative(lastScraped)}
              </span>
            ) : (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">
                No data yet
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FF9900] text-black text-xs font-bold hover:bg-[#FF9900]/80 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
                {refreshing ? "Scraping Amazon.ae…" : "Refresh Data"}
              </button>
            )}
          </div>
        </div>

        {/* Stats strip */}
        <div className="flex items-center gap-6 pb-3 text-xs text-muted-foreground">
          <span><span className="font-bold text-foreground">{totalCount}</span> products in DB</span>
          <span><span className="font-bold text-foreground">{filtered.length}</span> shown</span>
          {lastScraped && (
            <span>Last scraped: <span className="font-medium text-foreground">{new Date(lastScraped).toLocaleString()}</span></span>
          )}
        </div>
      </div>

      {/* ── Body: filter panel + table ─────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left filter panel */}
        <div className="w-52 shrink-0 border-r bg-card overflow-y-auto hidden lg:block">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div className="flex items-center gap-1.5">
              <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-bold">Filters</span>
            </div>
            <button onClick={() => handleCategory("All")} className="text-[10px] text-primary hover:underline">Reset</button>
          </div>

          <FilterSection
            label="Category"
            items={CATEGORIES}
            activeItem={category}
            onSelect={handleCategory}
          />
        </div>

        {/* Right: search + table */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Search + active category chip */}
          <div className="px-4 py-3 border-b bg-card flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5 bg-background flex-1 min-w-[200px] max-w-sm">
              <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search Amazon.ae products…"
                className="text-xs bg-transparent outline-none flex-1 placeholder:text-muted-foreground"
              />
            </div>

            {/* Mobile category chips */}
            <div className="flex items-center gap-1 flex-wrap lg:hidden">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => handleCategory(cat)}
                  className={`text-[10px] px-2 py-1 rounded-full border font-medium transition-colors ${
                    category === cat ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {category !== "All" && (
              <span className="hidden lg:inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/30 font-medium">
                {category}
                <button onClick={() => handleCategory("All")} className="ml-0.5 hover:text-primary/70">×</button>
              </span>
            )}

            <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
              Data from amazon.ae/bestsellers · for reference only
            </span>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto">
            <AmazonTable products={filtered} loading={loading} />
          </div>

          {/* Footer */}
          <div className="border-t px-4 py-2.5 bg-card flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Showing {filtered.length} of {products.length} products · Amazon.ae Best Sellers</span>
            {!isLive && !loading && (
              <span className="text-amber-600 font-medium">
                No data — {isAdmin ? 'click "Refresh Data" to scrape Amazon.ae' : "data will appear after next scrape"}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
