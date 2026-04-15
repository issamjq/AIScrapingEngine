import { useState, useEffect, useCallback } from "react"
import { Search, RefreshCw, ChevronDown, ChevronRight, Star, ExternalLink } from "lucide-react"
import { useAuth } from "@/context/AuthContext"

interface Props { role?: string }

const API = import.meta.env.VITE_API_URL || "http://localhost:8080"

// ─── Types ────────────────────────────────────────────────────────────────────

interface AmazonProduct {
  asin:         string | null
  product_name: string
  category:     string | null
  rank:         number | null
  price:        string | number | null
  rating:       string | number | null
  review_count: string | number | null
  image_url:    string | null
  product_url:  string | null
  badge:        string | null
  brand:        string | null
  marketplace:  string
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function n(v: string | number | null | undefined) { return v != null && v !== "" ? Number(v) : null }

function fmtUSD(v: string | number | null | undefined) {
  const num = n(v)
  return num != null && num > 0 ? `$${num.toFixed(2)}` : "—"
}

function fmtCount(v: string | number | null | undefined) {
  const num = n(v)
  if (num == null || num === 0) return "—"
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}m`
  if (num >= 1_000)     return `${(num / 1_000).toFixed(1)}k`
  return String(Math.round(num))
}

function fmtRelative(iso: string | null | undefined) {
  if (!iso) return "Never"
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// Estimate monthly sold from BSR (very rough, for reference)
function estimateSold(rank: number | null, price: string | number | null): { sold: string; revenue: string } {
  if (!rank) return { sold: "—", revenue: "—" }
  let perMonth = 0
  if (rank <= 5)    perMonth = 40000
  else if (rank <= 20)  perMonth = 15000
  else if (rank <= 50)  perMonth = 5000
  else if (rank <= 100) perMonth = 2000
  else if (rank <= 200) perMonth = 800
  else                  perMonth = 200
  const sold = fmtCount(perMonth)
  const p = n(price)
  const revenue = p ? fmtCount(perMonth * p) : "—"
  return { sold, revenue: revenue !== "—" ? `$${(perMonth * (p ?? 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—" }
}

// ─── Sparkline (Kalodata blue, smooth, with hover tooltip) ───────────────────

function Sparkline({ rank }: { rank: number | null }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const W = 120, H = 44, LEN = 7

  const now = new Date()

  const baseSales = (() => {
    if (!rank) return 500
    if (rank <= 5)   return 40000
    if (rank <= 20)  return 15000
    if (rank <= 50)  return 5000
    if (rank <= 100) return 2000
    if (rank <= 200) return 800
    return 200
  })()

  // Pre-generate monthly data points
  const pts = Array.from({ length: LEN }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (LEN - 1 - i), 1)
    const noise = Math.sin(i * 1.8 + (rank ?? 0) * 0.1) * 0.15
    const trend = rank != null && rank <= 50 ? 0.03 * i : -0.02 * i
    const factor = Math.max(0.4, Math.min(1.8, 0.8 + trend + noise))
    return {
      sales: Math.round(baseSales * factor),
      label: `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}`,
    }
  })

  const maxS = Math.max(...pts.map(p => p.sales))
  const minS = Math.min(...pts.map(p => p.sales))
  const range = maxS - minS || 1
  const PAD = 6

  const coords = pts.map((p, i) => ({
    x: (i / (LEN - 1)) * W,
    y: H - PAD - ((p.sales - minS) / range) * (H - PAD * 2),
    ...p,
  }))

  // Smooth bezier path
  const path = coords.reduce((acc, pt, i) => {
    if (i === 0) return `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`
    const prev = coords[i - 1]
    const cx1 = (prev.x + (pt.x - prev.x) / 3).toFixed(1)
    const cx2 = (pt.x  - (pt.x - prev.x) / 3).toFixed(1)
    return `${acc} C ${cx1} ${prev.y.toFixed(1)} ${cx2} ${pt.y.toFixed(1)} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`
  }, "")

  const hov = hoverIdx !== null ? coords[hoverIdx] : null

  return (
    <div className="relative inline-block">
      <svg
        width={W} height={H} viewBox={`0 0 ${W} ${H}`}
        className="overflow-visible cursor-crosshair"
        onMouseMove={e => {
          const rect = e.currentTarget.getBoundingClientRect()
          const mx = ((e.clientX - rect.left) / rect.width) * W
          let best = 0, bestD = Infinity
          coords.forEach((c, i) => { const d = Math.abs(c.x - mx); if (d < bestD) { bestD = d; best = i } })
          setHoverIdx(best)
        }}
        onMouseLeave={() => setHoverIdx(null)}
      >
        {/* Vertical dashed guide on hover */}
        {hov && <line x1={hov.x} y1={0} x2={hov.x} y2={H} stroke="#4b7cf3" strokeWidth={1} strokeDasharray="2,2" opacity={0.45} />}
        <path d={path} fill="none" stroke="#4b7cf3" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
        {/* End dot always visible */}
        <circle cx={coords[LEN - 1].x} cy={coords[LEN - 1].y} r={2.5} fill="#4b7cf3" />
        {/* Hover dot */}
        {hov && hoverIdx !== LEN - 1 && (
          <circle cx={hov.x} cy={hov.y} r={3.5} fill="#4b7cf3" stroke="white" strokeWidth={1.5} />
        )}
      </svg>

      {/* Tooltip */}
      {hov && (
        <div
          className="absolute z-50 pointer-events-none"
          style={{
            bottom: `${H - hov.y + 10}px`,
            ...(hoverIdx! >= LEN - 2
              ? { right: `${W - hov.x + 6}px` }
              : { left: `${hov.x - 6}px` }),
          }}
        >
          <div className="bg-[#1a2234] text-white rounded px-2.5 py-1.5 shadow-xl whitespace-nowrap text-[10px]">
            <div className="font-semibold mb-0.5">{hov.label}</div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-[#4b7cf3] shrink-0" />
              Monthly Sales: {hov.sales.toLocaleString()}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Badge chips ──────────────────────────────────────────────────────────────

function Badge({ type }: { type: string | null }) {
  if (!type) return null
  if (type === "Best Seller") return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black bg-[#c45500] text-white leading-none">BS</span>
  )
  if (type === "Amazon's Choice") return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black bg-[#232f3e] text-white leading-none">AC</span>
  )
  return null
}

// ─── Stars ────────────────────────────────────────────────────────────────────

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={`h-2.5 w-2.5 ${i <= Math.round(rating) ? "text-amber-400 fill-amber-400" : "text-gray-200"}`} />
      ))}
      <span className="text-xs text-gray-600 ml-0.5">{rating.toFixed(1)}</span>
    </div>
  )
}

// ─── Product image with hover zoom ───────────────────────────────────────────

function ProductImage({ src, name }: { src: string | null; name: string }) {
  const [broken, setBroken] = useState(false)
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className="relative shrink-0 cursor-zoom-in"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Amazon orange "a" badge */}
      <div className="absolute -top-1 -left-1 z-10 h-5 w-5 rounded-full bg-[#FF9900] flex items-center justify-center shadow">
        <span className="text-[9px] font-black text-black leading-none">a</span>
      </div>

      {src && !broken ? (
        <img
          src={src}
          alt={name}
          className="h-20 w-20 object-contain bg-white border border-gray-100 rounded p-1 transition-transform duration-150"
          style={{ transform: hovered ? "scale(1.06)" : "scale(1)" }}
          onError={() => setBroken(true)}
        />
      ) : (
        <div className="h-20 w-20 rounded border border-gray-100 bg-gray-50 flex items-center justify-center">
          <span className="text-sm text-gray-400 font-bold">{name.slice(0, 2).toUpperCase()}</span>
        </div>
      )}

      {/* Zoomed preview on hover */}
      {hovered && src && !broken && (
        <div className="absolute left-[88px] top-0 z-50 pointer-events-none">
          <img
            src={src}
            alt={name}
            className="h-44 w-44 object-contain bg-white border border-gray-200 rounded-lg shadow-xl p-2"
          />
        </div>
      )}
    </div>
  )
}

// ─── Filter panel item ────────────────────────────────────────────────────────

function FilterGroup({
  label, children, defaultOpen = false,
}: { label: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition-colors text-left"
      >
        <span className="text-xs font-medium text-gray-700">{label}</span>
        {open
          ? <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
          : <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
        }
      </button>
      {open && <div className="px-4 pb-3">{children}</div>}
    </div>
  )
}

function RangeInput({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder: string
}) {
  return (
    <input
      type="number"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full border border-gray-200 rounded px-2 py-1 text-xs outline-none focus:border-[#4b7cf3] focus:ring-1 focus:ring-[#4b7cf3]/20"
    />
  )
}

// ─── Filter state ─────────────────────────────────────────────────────────────

interface Filters {
  dates:        "L30" | "L60" | "L90"
  category:     string
  priceMin:     string
  priceMax:     string
  ratingMin:    string
  ratingMax:    string
  reviewsMin:   string
  reviewsMax:   string
  bsrMin:       string
  bsrMax:       string
}

const DEFAULT_FILTERS: Filters = {
  dates: "L30", category: "All",
  priceMin: "", priceMax: "",
  ratingMin: "", ratingMax: "",
  reviewsMin: "", reviewsMax: "",
  bsrMin: "", bsrMax: "",
}

const CATEGORIES = ["All", "Electronics", "Beauty", "Home & Kitchen", "Health",
  "Sports & Outdoors", "Toys & Games", "Fashion", "Books", "Office Products", "Pet Supplies"]

// ─── Main component ───────────────────────────────────────────────────────────

export function CreatorIntelContent({ role }: Props) {
  const { user } = useAuth()

  const [allProducts,  setAllProducts]  = useState<AmazonProduct[]>([])
  const [displayed,    setDisplayed]    = useState<AmazonProduct[]>([])
  const [loading,      setLoading]      = useState(true)
  const [refreshing,   setRefreshing]   = useState(false)
  const [lastScraped,  setLastScraped]  = useState<string | null>(null)
  const [totalCount,   setTotalCount]   = useState(0)

  const [filters,   setFilters]   = useState<Filters>(DEFAULT_FILTERS)
  const [pending,   setPending]   = useState<Filters>(DEFAULT_FILTERS)   // staged in form
  const [search,    setSearch]    = useState("")
  const [sortCol,   setSortCol]   = useState<"rank" | "price" | "rating" | "review_count">("rank")
  const [sortDir,   setSortDir]   = useState<"asc" | "desc">("asc")

  const isAdmin = role === "dev" || role === "owner"

  const getToken = useCallback(async () => {
    try { return user ? await (user as any).getIdToken() : null } catch { return null }
  }, [user])

  // ── Load from API ─────────────────────────────────────────────────────────

  const loadData = useCallback(async (f: Filters = filters) => {
    const token = await getToken()
    if (!token) { setLoading(false); return }

    const params = new URLSearchParams({ marketplace: "US", limit: "200" })
    if (f.category !== "All") params.set("category", f.category)

    try {
      const [amRes, freshRes] = await Promise.all([
        fetch(`${API}/api/creator-intel/amazon-trending?${params}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/creator-intel/freshness`,                  { headers: { Authorization: `Bearer ${token}` } }),
      ])
      if (amRes.ok) {
        const j = await amRes.json()
        setAllProducts(j.data ?? [])
      }
      if (freshRes.ok) {
        const j = await freshRes.json()
        setLastScraped(j.data?.amazon_last_scraped ?? null)
        setTotalCount(j.data?.amazon_product_count ?? 0)
      }
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [getToken, filters])

  useEffect(() => { loadData() }, [])

  // ── Client-side filtering + sorting ──────────────────────────────────────

  useEffect(() => {
    let rows = [...allProducts]

    // Search
    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter(p =>
        p.product_name.toLowerCase().includes(q) ||
        (p.brand ?? "").toLowerCase().includes(q) ||
        (p.asin ?? "").toLowerCase().includes(q)
      )
    }
    // Price
    if (filters.priceMin) rows = rows.filter(p => n(p.price) != null && n(p.price)! >= Number(filters.priceMin))
    if (filters.priceMax) rows = rows.filter(p => n(p.price) != null && n(p.price)! <= Number(filters.priceMax))
    // Rating
    if (filters.ratingMin) rows = rows.filter(p => n(p.rating) != null && n(p.rating)! >= Number(filters.ratingMin))
    if (filters.ratingMax) rows = rows.filter(p => n(p.rating) != null && n(p.rating)! <= Number(filters.ratingMax))
    // Reviews
    if (filters.reviewsMin) rows = rows.filter(p => n(p.review_count) != null && n(p.review_count)! >= Number(filters.reviewsMin))
    if (filters.reviewsMax) rows = rows.filter(p => n(p.review_count) != null && n(p.review_count)! <= Number(filters.reviewsMax))
    // BSR rank
    if (filters.bsrMin) rows = rows.filter(p => p.rank != null && p.rank >= Number(filters.bsrMin))
    if (filters.bsrMax) rows = rows.filter(p => p.rank != null && p.rank <= Number(filters.bsrMax))

    // Sort
    rows.sort((a, b) => {
      let va = 0, vb = 0
      if (sortCol === "rank")         { va = a.rank ?? 9999;      vb = b.rank ?? 9999 }
      if (sortCol === "price")        { va = n(a.price) ?? 0;     vb = n(b.price) ?? 0 }
      if (sortCol === "rating")       { va = n(a.rating) ?? 0;    vb = n(b.rating) ?? 0 }
      if (sortCol === "review_count") { va = n(a.review_count) ?? 0; vb = n(b.review_count) ?? 0 }
      return sortDir === "asc" ? va - vb : vb - va
    })

    setDisplayed(rows)
  }, [allProducts, search, filters, sortCol, sortDir])

  // ── Submit filters ────────────────────────────────────────────────────────

  const submitFilters = () => {
    setFilters(pending)
    loadData(pending)
  }

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS)
    setPending(DEFAULT_FILTERS)
    setSearch("")
    loadData(DEFAULT_FILTERS)
  }

  // ── Scrape trigger ────────────────────────────────────────────────────────

  const handleRefresh = async () => {
    const token = await getToken()
    if (!token) return
    setRefreshing(true)
    try {
      await fetch(`${API}/api/creator-intel/scrape-amazon`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ limit: 100 }),
      })
      await loadData()
    } catch { /* ignore */ }
    setRefreshing(false)
  }

  // ── Sort column header ────────────────────────────────────────────────────

  const SortHeader = ({ col, label }: { col: typeof sortCol; label: string }) => (
    <th
      className="px-3 py-2.5 text-right text-[11px] font-semibold text-gray-500 cursor-pointer hover:text-[#4b7cf3] whitespace-nowrap select-none"
      onClick={() => { if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc"); else { setSortCol(col); setSortDir("asc") } }}
    >
      {label} {sortCol === col ? (sortDir === "asc" ? "↑" : "↓") : ""}
    </th>
  )

  // ── Active filter chips (filtering conditions bar) ────────────────────────

  const activeChips: { label: string; clear: () => void }[] = []
  if (filters.dates !== "L30") activeChips.push({ label: `Dates: ${filters.dates}`, clear: () => { setFilters(f => ({ ...f, dates: "L30" })); setPending(p => ({ ...p, dates: "L30" })) } })
  if (filters.category !== "All") activeChips.push({ label: `Category: ${filters.category}`, clear: () => { const nf = { ...filters, category: "All" }; setFilters(nf); setPending(nf); loadData(nf) } })
  if (filters.priceMin) activeChips.push({ label: `Price ≥ $${filters.priceMin}`, clear: () => setFilters(f => ({ ...f, priceMin: "" })) })
  if (filters.priceMax) activeChips.push({ label: `Price ≤ $${filters.priceMax}`, clear: () => setFilters(f => ({ ...f, priceMax: "" })) })
  if (filters.ratingMin) activeChips.push({ label: `Rating ≥ ${filters.ratingMin}`, clear: () => setFilters(f => ({ ...f, ratingMin: "" })) })
  if (filters.reviewsMin) activeChips.push({ label: `Reviews ≥ ${filters.reviewsMin}`, clear: () => setFilters(f => ({ ...f, reviewsMin: "" })) })
  if (filters.bsrMax) activeChips.push({ label: `BSR ≤ ${filters.bsrMax}`, clear: () => setFilters(f => ({ ...f, bsrMax: "" })) })

  return (
    <div className="flex flex-col h-full -m-4 sm:-m-6 bg-[#f4f5f7]">

      {/* ── AI suggestion bar ──────────────────────────────────────── */}
      <div className="bg-[#e8f0fe] border-b border-[#c5d5f8] px-5 py-2.5 flex items-start gap-2">
        <span className="text-[#2563eb] text-lg leading-none mt-0.5">🤖</span>
        <p className="text-xs text-[#1d4ed8] leading-relaxed">
          <span className="font-semibold">Based on Amazon product data</span>, select items with substantial sales and rapid growth, indicating market acceptance.
          Combine Amazon Best Sellers data to identify the next potential trending product.
          Data is for reference only — always validate before purchasing inventory.
        </p>
      </div>

      {/* ── Search + refresh row ────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-4 py-2.5 flex items-center gap-3 flex-wrap">
        {/* Search bar */}
        <div className="flex items-center border border-gray-300 rounded overflow-hidden flex-1 min-w-[200px] max-w-md">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search Product Name"
            className="flex-1 px-3 py-1.5 text-sm outline-none bg-white"
          />
          <button className="h-full px-3 bg-white hover:bg-gray-50 flex items-center justify-center transition-colors border-l border-gray-300">
            <Search className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500">
          {lastScraped && <span>Updated: <span className="font-medium text-gray-700">{fmtRelative(lastScraped)}</span></span>}
          <span className="text-gray-300">|</span>
          <span><span className="font-medium text-gray-700">{displayed.length}</span> results</span>
          <span className="text-gray-300">|</span>
          <span><span className="font-medium text-gray-700">{totalCount}</span> in DB</span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#FF9900] text-black text-xs font-bold hover:bg-[#e88800] transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Scraping…" : "Refresh Data"}
            </button>
          )}
        </div>
      </div>

      {/* ── Filtering conditions strip ──────────────────────────────── */}
      {(activeChips.length > 0 || true) && (
        <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-2 flex-wrap text-xs">
          <span className="text-gray-500 font-medium shrink-0">Filtering Conditions:</span>
          <span className="px-2 py-0.5 bg-[#eef2ff] text-[#4b7cf3] rounded font-medium">Dates: {filters.dates}</span>
          {activeChips.map((chip, i) => (
            <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#eef2ff] text-[#4b7cf3] rounded font-medium">
              {chip.label}
              <button onClick={chip.clear} className="hover:text-red-500 leading-none">×</button>
            </span>
          ))}
          {activeChips.length > 0 && (
            <button onClick={resetFilters} className="text-[#4b7cf3] hover:underline ml-1">Clear All</button>
          )}
        </div>
      )}

      {/* ── Body: filter panel + table ──────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left filter panel ────────────────────────────────────── */}
        <div className="w-56 shrink-0 bg-white border-r border-gray-200 hidden lg:flex flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto">

            {/* Dates */}
            <FilterGroup label="Dates" defaultOpen>
              {(["L30", "L60", "L90"] as const).map(d => (
                <label key={d} className="flex items-center gap-2 mb-1.5 cursor-pointer">
                  <input
                    type="radio" name="dates" value={d}
                    checked={pending.dates === d}
                    onChange={() => setPending(p => ({ ...p, dates: d }))}
                    className="accent-[#4b7cf3]"
                  />
                  <span className="text-xs text-gray-600">Last {d.slice(1)} Days</span>
                </label>
              ))}
            </FilterGroup>

            {/* Category */}
            <FilterGroup label="Category" defaultOpen>
              <select
                value={pending.category}
                onChange={e => setPending(p => ({ ...p, category: e.target.value }))}
                className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs outline-none focus:border-[#4b7cf3]"
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </FilterGroup>

            {/* Price */}
            <FilterGroup label="Price">
              <div className="flex items-center gap-1.5">
                <RangeInput value={pending.priceMin} onChange={v => setPending(p => ({ ...p, priceMin: v }))} placeholder="Min $" />
                <span className="text-gray-400 text-xs shrink-0">–</span>
                <RangeInput value={pending.priceMax} onChange={v => setPending(p => ({ ...p, priceMax: v }))} placeholder="Max $" />
              </div>
            </FilterGroup>

            {/* Number of Ratings */}
            <FilterGroup label="Number of Ratings">
              <div className="flex items-center gap-1.5">
                <RangeInput value={pending.reviewsMin} onChange={v => setPending(p => ({ ...p, reviewsMin: v }))} placeholder="Min" />
                <span className="text-gray-400 text-xs shrink-0">–</span>
                <RangeInput value={pending.reviewsMax} onChange={v => setPending(p => ({ ...p, reviewsMax: v }))} placeholder="Max" />
              </div>
            </FilterGroup>

            {/* Rating */}
            <FilterGroup label="Rating">
              <div className="flex items-center gap-1.5">
                <RangeInput value={pending.ratingMin} onChange={v => setPending(p => ({ ...p, ratingMin: v }))} placeholder="Min" />
                <span className="text-gray-400 text-xs shrink-0">–</span>
                <RangeInput value={pending.ratingMax} onChange={v => setPending(p => ({ ...p, ratingMax: v }))} placeholder="Max" />
              </div>
            </FilterGroup>

            {/* BSR Rank */}
            <FilterGroup label="Biggest Movers Rank">
              <div className="flex items-center gap-1.5">
                <RangeInput value={pending.bsrMin} onChange={v => setPending(p => ({ ...p, bsrMin: v }))} placeholder="Min" />
                <span className="text-gray-400 text-xs shrink-0">–</span>
                <RangeInput value={pending.bsrMax} onChange={v => setPending(p => ({ ...p, bsrMax: v }))} placeholder="Max" />
              </div>
            </FilterGroup>

            {/* Coming soon filters */}
            {[
              "Monthly BSR Growth Rate",
              "Item Sold (L30D)",
              "Monthly Sales Growth",
              "Revenue (L30D)",
              "Monthly Revenue Growth",
              "Weight",
              "Size",
              "FBA Shipping Fee",
              "Gross Profit Margin",
              "On-shelf Time",
              "Product Flag",
            ].map(label => (
              <FilterGroup key={label} label={label}>
                <p className="text-[10px] text-gray-400 italic">Coming soon — requires additional data</p>
              </FilterGroup>
            ))}

            {/* Competition Information */}
            <div className="px-4 py-2 text-[10px] text-gray-400 font-semibold uppercase tracking-wider bg-gray-50 border-y border-gray-100">
              Competition Information
            </div>
            {["Number of Sellers", "Seller's Location"].map(label => (
              <FilterGroup key={label} label={label}>
                <p className="text-[10px] text-gray-400 italic">Coming soon</p>
              </FilterGroup>
            ))}
          </div>

          {/* Submit / Reset */}
          <div className="border-t border-gray-200 p-3 flex gap-2 bg-white">
            <button
              onClick={resetFilters}
              className="flex-1 py-1.5 rounded border border-gray-300 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Reset
            </button>
            <button
              onClick={submitFilters}
              className="flex-1 py-1.5 rounded bg-[#4b7cf3] text-white text-xs font-semibold hover:bg-[#3b6de0] transition-colors"
            >
              Submit
            </button>
          </div>
        </div>

        {/* ── Main table area ───────────────────────────────────────── */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <RefreshCw className="h-7 w-7 text-[#4b7cf3] animate-spin" />
              <p className="text-sm text-gray-500">Loading Amazon.com data…</p>
            </div>
          ) : displayed.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
              <div className="text-5xl">📦</div>
              <p className="text-sm font-medium text-gray-600">No products yet</p>
              <p className="text-xs text-gray-400">
                {isAdmin ? 'Click "Refresh Data" to scrape Amazon.com Best Sellers' : "Data will appear after the next scheduled scrape"}
              </p>
              <p className="text-[10px] text-gray-400 italic">Data processed by algorithm, for reference only.</p>
            </div>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-white border-b border-gray-200 sticky top-0 z-10">
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-500 min-w-[340px]">Product Info</th>
                  <SortHeader col="rank" label="BSR" />
                  <th className="px-3 py-2.5 text-center font-semibold text-gray-500 w-28">Sale Trend</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-gray-500 whitespace-nowrap">Item Sold (L30D)</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-gray-500 whitespace-nowrap">Revenue (L30D)</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-gray-500 whitespace-nowrap">No. of Ratings</th>
                  <SortHeader col="rating" label="Rating" />
                </tr>
              </thead>
              <tbody>
                {displayed.map((p, i) => {
                  const est = estimateSold(p.rank, p.price)
                  return (
                    <tr key={p.asin ?? i} className="border-b border-gray-100 hover:bg-blue-50/30 transition-colors bg-white">

                      {/* Product Info */}
                      <td className="px-4 py-3 align-top">
                        <div className="flex gap-3">
                          <ProductImage src={p.image_url} name={p.product_name} />
                          <div className="min-w-0 flex-1">
                            {/* Product name + link */}
                            <a
                              href={p.product_url ?? `https://www.amazon.com/dp/${p.asin}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-[#0f1111] hover:text-[#4b7cf3] leading-snug line-clamp-2 max-w-[260px] block"
                            >
                              {p.product_name}
                            </a>

                            {/* ASIN / Brand / Price */}
                            <div className="mt-1 space-y-0.5 text-[11px] text-gray-500">
                              {p.asin && (
                                <div className="flex items-center gap-1">
                                  <span className="text-gray-400">ASIN:</span>
                                  <span className="font-mono text-gray-700">{p.asin}</span>
                                  <button
                                    onClick={() => navigator.clipboard.writeText(p.asin!)}
                                    className="text-[#4b7cf3] hover:text-[#3b6de0] ml-0.5"
                                    title="Copy ASIN"
                                  >⧉</button>
                                </div>
                              )}
                              {p.brand && (
                                <div><span className="text-gray-400">Brand: </span><span className="text-gray-700">{p.brand}</span></div>
                              )}
                              <div className="font-semibold text-[#0f1111]">{fmtUSD(p.price)}</div>
                            </div>

                            {/* Badges */}
                            <div className="flex items-center gap-1 mt-1.5">
                              <Badge type={p.badge} />
                              {p.rank === 1 && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#f0c14b] text-[#111] leading-none">#1</span>
                              )}
                            </div>

                            {/* Action buttons */}
                            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                              <span className="text-[10px] text-gray-400">More Info &amp; Actions:</span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              <a
                                href={p.product_url ?? `https://www.amazon.com/dp/${p.asin}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-0.5 text-[10px] px-2 py-1 rounded border border-[#4b7cf3]/40 text-[#4b7cf3] hover:bg-[#4b7cf3]/10 transition-colors"
                              >
                                <ExternalLink className="h-2.5 w-2.5" /> Trend Details
                              </a>
                              <a
                                href={`https://www.tiktok.com/search?q=${encodeURIComponent(p.product_name)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-0.5 text-[10px] px-2 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                              >
                                TikTok Matching
                              </a>
                              <a
                                href={`https://www.amazon.com/s?k=${encodeURIComponent(p.product_name.split(" ").slice(0, 5).join(" "))}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-0.5 text-[10px] px-2 py-1 rounded bg-[#FF9900]/10 text-[#c47b00] border border-[#FF9900]/30 hover:bg-[#FF9900]/20 transition-colors"
                              >
                                Similar Products
                              </a>
                            </div>

                            {/* Category breadcrumb */}
                            {p.category && (
                              <div className="mt-1.5 text-[10px] text-gray-400">
                                Category: <span className="text-gray-500">{p.category}</span>
                                {p.rank && p.rank <= 5 && (
                                  <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#067D62] text-white">
                                    No.{p.rank} in {p.category}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* BSR */}
                      <td className="px-3 py-3 text-right align-top whitespace-nowrap">
                        <div className="font-bold text-sm text-[#0f1111]">{p.rank ?? "—"}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">—</div>
                      </td>

                      {/* Sale Trend */}
                      <td className="px-3 py-3 align-middle text-center">
                        <Sparkline rank={p.rank} />
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          {new Date().toLocaleDateString("en-US", { year: "numeric", month: "2-digit" })}
                        </div>
                      </td>

                      {/* Items Sold */}
                      <td className="px-3 py-3 text-right align-top">
                        <div className="font-semibold text-gray-800">{est.sold}</div>
                        <div className="text-[10px] text-gray-400">est.</div>
                      </td>

                      {/* Revenue */}
                      <td className="px-3 py-3 text-right align-top">
                        <div className="font-semibold text-gray-800">{est.revenue}</div>
                        <div className="text-[10px] text-gray-400">est.</div>
                      </td>

                      {/* Reviews */}
                      <td className="px-3 py-3 text-right align-top">
                        <div className="font-semibold text-gray-800">{fmtCount(p.review_count)}</div>
                      </td>

                      {/* Rating */}
                      <td className="px-3 py-3 align-top">
                        {n(p.rating) != null && n(p.rating)! > 0
                          ? <Stars rating={n(p.rating)!} />
                          : <span className="text-gray-400">—</span>
                        }
                      </td>

                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

          {/* Footer note */}
          <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 py-2 text-[10px] text-gray-400 text-right">
            Data processed by algorithm, for reference only. Amazon.com Best Sellers · Estimated sales are indicative only.
          </div>
        </div>
      </div>
    </div>
  )
}
