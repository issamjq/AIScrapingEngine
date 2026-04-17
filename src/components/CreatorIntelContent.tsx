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

// Estimate monthly sold from BSR rank + review count proxy
function estimateSold(
  rank: number | null,
  price: string | number | null,
  reviewCount: string | number | null,
): { sold: string; revenue: string } {
  if (!rank) return { sold: "—", revenue: "—" }

  // Granular base by exact rank position
  let base = 0
  if      (rank === 1)  base = 44000
  else if (rank === 2)  base = 32000
  else if (rank === 3)  base = 24000
  else if (rank === 4)  base = 18000
  else if (rank === 5)  base = 14000
  else if (rank <= 10)  base = 9000
  else if (rank <= 20)  base = 5500
  else if (rank <= 50)  base = 2200
  else if (rank <= 100) base = 800
  else                  base = 250

  // Scale by review count — a strong proxy for sales volume
  const rv = n(reviewCount) ?? 0
  const factor =
    rv >= 500_000 ? 1.45 :
    rv >= 100_000 ? 1.25 :
    rv >= 50_000  ? 1.10 :
    rv >= 10_000  ? 1.00 :
    rv >= 1_000   ? 0.85 :
    rv >  0       ? 0.70 : 1.00

  const perMonth = Math.round(base * factor)
  const p = n(price)
  return {
    sold:    fmtCount(perMonth),
    revenue: p ? `$${(perMonth * p).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—",
  }
}

// ─── Sparkline (real history when available, estimated fallback) ──────────────

type HistoryPoint = { rank: number; date: string }

function salesFromRank(rank: number, reviewCount?: number | null): number {
  // Same granular tiers as estimateSold
  let base = 0
  if      (rank === 1)  base = 44000
  else if (rank === 2)  base = 32000
  else if (rank === 3)  base = 24000
  else if (rank === 4)  base = 18000
  else if (rank === 5)  base = 14000
  else if (rank <= 10)  base = 9000
  else if (rank <= 20)  base = 5500
  else if (rank <= 50)  base = 2200
  else if (rank <= 100) base = 800
  else if (rank <= 200) base = 400
  else                  base = 200

  const rv = reviewCount ?? 0
  const factor =
    rv >= 500_000 ? 1.45 :
    rv >= 100_000 ? 1.25 :
    rv >= 50_000  ? 1.10 :
    rv >= 10_000  ? 1.00 :
    rv >= 1_000   ? 0.85 :
    rv >  0       ? 0.70 : 1.00

  return Math.round(base * factor)
}

function Sparkline({ rank, reviewCount, history }: { rank: number | null; reviewCount?: number | null; history?: HistoryPoint[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  // Stable unique gradient ID per instance (avoids SVG id conflicts across rows)
  const [gradId] = useState(() => `sg${Math.random().toString(36).slice(2, 8)}`)
  const W = 130, H = 48, PAD = 5

  const hasReal = history && history.length >= 2

  const pts: { label: string; sales: number }[] = hasReal
    ? history!.map(h => ({
        label: new Date(h.date).toLocaleDateString("en-US", { year: "numeric", month: "2-digit" }).slice(0, 7),
        sales: salesFromRank(h.rank, reviewCount),
      }))
    : (() => {
        const now = new Date()
        const base = rank ? salesFromRank(rank, reviewCount) : 500
        return Array.from({ length: 8 }, (_, i) => {
          const d = new Date(now.getFullYear(), now.getMonth() - (7 - i), 1)
          const noise = Math.sin(i * 1.8 + (rank ?? 0) * 0.1) * 0.15
          const trend = rank != null && rank <= 50 ? 0.03 * i : -0.02 * i
          return {
            label: `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}`,
            sales: Math.round(base * Math.max(0.4, Math.min(1.8, 0.8 + trend + noise))),
          }
        })
      })()

  const LEN = pts.length
  const maxS = Math.max(...pts.map(p => p.sales))
  const minS = Math.min(...pts.map(p => p.sales))
  const range = maxS - minS || 1

  const coords = pts.map((p, i) => ({
    x: (i / (LEN - 1)) * W,
    y: H - PAD - ((p.sales - minS) / range) * (H - PAD * 2),
    label: p.label,
    sales: p.sales,
  }))

  // Smooth bezier line path
  const linePath = coords.reduce((acc, pt, i) => {
    if (i === 0) return `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`
    const prev = coords[i - 1]
    const cx1 = (prev.x + (pt.x - prev.x) / 3).toFixed(1)
    const cx2 = (pt.x  - (pt.x - prev.x) / 3).toFixed(1)
    return `${acc} C ${cx1} ${prev.y.toFixed(1)} ${cx2} ${pt.y.toFixed(1)} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`
  }, "")

  // Closed area path for gradient fill
  const areaPath = `${linePath} L ${coords[LEN - 1].x.toFixed(1)} ${H} L ${coords[0].x.toFixed(1)} ${H} Z`

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
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#4b7cf3" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#4b7cf3" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {/* Gradient area fill */}
        <path d={areaPath} fill={`url(#${gradId})`} stroke="none" />

        {/* Vertical hover guide */}
        {hov && <line x1={hov.x} y1={0} x2={hov.x} y2={H} stroke="#4b7cf3" strokeWidth={1} strokeDasharray="2,2" opacity={0.4} />}

        {/* Line */}
        <path d={linePath} fill="none" stroke="#4b7cf3" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />

        {/* Endpoint dot (only when not hovering) */}
        {hoverIdx === null && (
          <circle cx={coords[LEN - 1].x} cy={coords[LEN - 1].y} r={3} fill="#4b7cf3" stroke="white" strokeWidth={1.5} />
        )}
        {/* Hover dot */}
        {hov && (
          <circle cx={hov.x} cy={hov.y} r={3.5} fill="#4b7cf3" stroke="white" strokeWidth={1.5} />
        )}
      </svg>

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
            {!hasReal && <div className="text-[#8ba3d4] mt-0.5">est. — scrape more for real data</div>}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Badge chips ──────────────────────────────────────────────────────────────

function BadgeChip({ label }: { label: string }) {
  if (label === "Best Seller") return (
    <span title="This listing is a Best Seller in a specific category."
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black bg-[#c45500] text-white leading-none">
      BS
    </span>
  )
  if (label === "Amazon's Choice") return (
    <span title="This listing has the Amazon's Choice badge."
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black bg-[#232f3e] text-white leading-none">
      AC
    </span>
  )
  if (label === "A+") return (
    <span title="This listing includes A+ Content (Enhanced Brand Content)."
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black bg-[#0066c0] text-white leading-none">
      A+
    </span>
  )
  return null
}

function Badge({ type }: { type: string | null }) {
  if (!type) return null
  const labels = type.split(",").map(s => s.trim()).filter(Boolean)
  return (
    <span className="inline-flex items-center gap-0.5">
      {labels.map(l => <BadgeChip key={l} label={l} />)}
    </span>
  )
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

// ─── Product image with hover zoom (fixed-position popup — bypasses table clip) ─

function ProductImage({ src, name }: { src: string | null; name: string }) {
  const [broken, setBroken] = useState(false)
  const [popup,  setPopup]  = useState<{ x: number; y: number } | null>(null)

  const handleMouseEnter = (e: React.MouseEvent<HTMLImageElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    // Place popup to the right of the thumbnail; flip left if too close to right edge
    const x = rect.right + 10 + 176 > window.innerWidth ? rect.left - 176 - 10 : rect.right + 10
    const y = Math.min(rect.top, window.innerHeight - 176 - 8)
    setPopup({ x, y })
  }

  return (
    <div className="relative shrink-0">
      {src && !broken ? (
        <img
          src={src}
          alt={name}
          className="h-20 w-20 object-contain bg-white border border-gray-100 rounded p-1 cursor-zoom-in"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={() => setPopup(null)}
          onError={() => setBroken(true)}
        />
      ) : (
        <div className="h-20 w-20 rounded border border-gray-100 bg-gray-50 flex items-center justify-center">
          <span className="text-sm text-gray-400 font-bold">{name.slice(0, 2).toUpperCase()}</span>
        </div>
      )}

      {/* Zoom popup — fixed to viewport, no table clipping */}
      {popup && src && !broken && (
        <div
          className="pointer-events-none"
          style={{ position: "fixed", left: popup.x, top: popup.y, zIndex: 9999 }}
        >
          <img
            src={src}
            alt={name}
            className="h-44 w-44 object-contain bg-white border border-gray-200 rounded-lg shadow-2xl p-2"
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

// Numeric-only sold estimate — used for sorting
function soldNum(rank: number | null, reviewCount: string | number | null): number {
  if (!rank) return 0
  let base = rank === 1 ? 44000 : rank === 2 ? 32000 : rank === 3 ? 24000 : rank === 4 ? 18000 : rank === 5 ? 14000
    : rank <= 10 ? 9000 : rank <= 20 ? 5500 : rank <= 50 ? 2200 : rank <= 100 ? 800 : 250
  const rv = n(reviewCount) ?? 0
  const f = rv >= 500_000 ? 1.45 : rv >= 100_000 ? 1.25 : rv >= 50_000 ? 1.10 : rv >= 10_000 ? 1.00 : rv >= 1_000 ? 0.85 : rv > 0 ? 0.70 : 1.00
  return Math.round(base * f)
}

const DEFAULT_FILTERS: Filters = {
  dates: "L30", category: "All",
  priceMin: "", priceMax: "",
  ratingMin: "", ratingMax: "",
  reviewsMin: "", reviewsMax: "",
  bsrMin: "", bsrMax: "",
}

// ─── Marketplace tab config ───────────────────────────────────────────────────

type MarketplaceId = "Amazon" | "eBay" | "iHerb" | "Alibaba" | "Tesco"

/** true = has a best-sellers table; false = custom UI (e.g. Alibaba sourcing search) */
type MarketplaceKind = "bestsellers" | "sourcing"

const MARKETPLACES: {
  id:    MarketplaceId
  kind:  MarketplaceKind
  flag?: string
  logo:  React.ReactNode
}[] = [
  {
    id: "Amazon", kind: "bestsellers", flag: "🇺🇸",
    logo: (
      <span className="flex flex-col items-start leading-none">
        <span className="font-black text-[14px] tracking-[-0.5px] text-[#232f3e]">amazon</span>
        <svg width="44" height="6" viewBox="0 0 44 6" className="-mt-0.5">
          <path d="M2 3.5 Q22 7 42 3.5" stroke="#FF9900" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        </svg>
      </span>
    ),
  },
  {
    id: "eBay", kind: "bestsellers", flag: "🇺🇸",
    logo: (
      <span className="flex items-center leading-none font-black text-[15px] tracking-[-1px]">
        <span style={{ color: "#e53238" }}>e</span>
        <span style={{ color: "#0064d2" }}>B</span>
        <span style={{ color: "#f5af02" }}>a</span>
        <span style={{ color: "#86b817" }}>y</span>
      </span>
    ),
  },
  {
    id: "iHerb", kind: "bestsellers", flag: "🌍",
    logo: (
      <span className="font-black text-[14px] tracking-[-0.3px]">
        <span style={{ color: "#1B7340" }}>i</span><span style={{ color: "#66A830" }}>Herb</span>
      </span>
    ),
  },
  {
    id: "Tesco", kind: "bestsellers", flag: "🇬🇧",
    logo: (
      <span className="flex items-center gap-0.5 font-black text-[14px] tracking-[-0.3px]">
        <span style={{ color: "#00539F" }}>Tesc</span><span style={{ color: "#EE1C25" }}>o</span>
      </span>
    ),
  },
  {
    id: "Alibaba", kind: "sourcing", flag: "🇨🇳",
    logo: (
      <span className="font-black text-[14px] tracking-[-0.3px]" style={{ color: "#FF6A00" }}>alibaba</span>
    ),
  },
]

// ─── Per-marketplace category lists ──────────────────────────────────────────

const MARKETPLACE_CATEGORIES: Record<MarketplaceId, string[]> = {
  Amazon:  ["All", "Electronics", "Beauty", "Home & Kitchen", "Health", "Sports & Outdoors", "Toys & Games", "Fashion", "Books", "Office Products", "Pet Supplies"],
  eBay:    ["All", "Electronics", "Health & Beauty", "Home & Garden", "Sporting Goods", "Toys & Hobbies", "Fashion", "Books", "Baby", "Pet Supplies", "Collectibles"],
  iHerb:   ["All", "Vitamins", "Sports Nutrition", "Beauty", "Grocery", "Baby & Kids", "Pets", "Health", "Herbs"],
  Tesco:   ["All", "Food Cupboard", "Drinks", "Dairy & Eggs", "Frozen", "Fresh Food", "Health & Beauty", "Baby & Toddler"],
  Alibaba: ["All"],
}

// ─── Alibaba sourcing types ───────────────────────────────────────────────────

interface AlibabaProduct {
  title:       string
  image_url:   string | null
  price_min:   number | null
  price_max:   number | null
  currency:    string
  orders:      number | null
  seller:      string | null
  product_url: string
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CreatorIntelContent({ role }: Props) {
  const { user } = useAuth()

  const [activeMarket, setActiveMarket] = useState<MarketplaceId>("Amazon")
  const [allProducts,  setAllProducts]  = useState<AmazonProduct[]>([])
  const [displayed,    setDisplayed]    = useState<AmazonProduct[]>([])
  const [loading,      setLoading]      = useState(true)
  const [refreshing,   setRefreshing]   = useState(false)
  const [lastScraped,  setLastScraped]  = useState<string | null>(null)
  const [totalCount,   setTotalCount]   = useState(0)
  const [rankHistory,  setRankHistory]  = useState<Record<string, HistoryPoint[]>>({})

  const [filters,   setFilters]   = useState<Filters>(DEFAULT_FILTERS)
  const [pending,   setPending]   = useState<Filters>(DEFAULT_FILTERS)   // staged in form
  const [search,    setSearch]    = useState("")
  const [sortCol,   setSortCol]   = useState<"product_name" | "rank" | "price" | "rating" | "review_count" | "items_sold" | "revenue">("rank")
  const [sortDir,   setSortDir]   = useState<"asc" | "desc">("asc")

  // ── Alibaba sourcing state ────────────────────────────────────────────────
  const [aliQuery,   setAliQuery]   = useState("")
  const [aliLoading, setAliLoading] = useState(false)
  const [aliResults, setAliResults] = useState<AlibabaProduct[]>([])
  const [aliSearched, setAliSearched] = useState(false)
  const [aliError,   setAliError]   = useState<string | null>(null)

  const isAdmin = role === "dev" || role === "owner"

  const getToken = useCallback(async () => {
    try { return user ? await (user as any).getIdToken() : null } catch { return null }
  }, [user])

  // ── Load from API (marketplace-aware) ────────────────────────────────────

  const loadData = useCallback(async (f: Filters = filters, market: MarketplaceId = activeMarket) => {
    const token = await getToken()
    if (!token) { setLoading(false); return }

    setLoading(true)
    setAllProducts([])
    setRankHistory({})

    const params = new URLSearchParams({ limit: "200" })
    if (f.category !== "All") params.set("category", f.category)

    try {
      if (market === "Amazon") {
        params.set("marketplace", "US")
        const [amRes, freshRes] = await Promise.all([
          fetch(`${API}/api/creator-intel/amazon-trending?${params}`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API}/api/creator-intel/freshness`,                  { headers: { Authorization: `Bearer ${token}` } }),
        ])
        if (amRes.ok)    { const j = await amRes.json();    setAllProducts(j.data ?? []) }
        if (freshRes.ok) { const j = await freshRes.json(); setLastScraped(j.data?.amazon_last_scraped ?? null); setTotalCount(j.data?.amazon_product_count ?? 0) }
      } else if (market === "eBay") {
        const [ebRes, histRes] = await Promise.all([
          fetch(`${API}/api/creator-intel/ebay-trending?${params}`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API}/api/creator-intel/ebay-history`,             { headers: { Authorization: `Bearer ${token}` } }),
        ])
        if (ebRes.ok)   { const j = await ebRes.json();   setAllProducts(j.data ?? []); setTotalCount(j.count ?? 0) }
        if (histRes.ok) { const j = await histRes.json(); setRankHistory(j.data ?? {}) }
        setLastScraped(null)
      } else if (market === "iHerb") {
        const [ihRes, histRes] = await Promise.all([
          fetch(`${API}/api/creator-intel/iherb-trending?${params}`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API}/api/creator-intel/iherb-history`,             { headers: { Authorization: `Bearer ${token}` } }),
        ])
        if (ihRes.ok)   { const j = await ihRes.json();   setAllProducts(j.data ?? []); setTotalCount(j.count ?? 0) }
        if (histRes.ok) { const j = await histRes.json(); setRankHistory(j.data ?? {}) }
        setLastScraped(null)
      } else if (market === "Tesco") {
        const [tcRes, histRes] = await Promise.all([
          fetch(`${API}/api/creator-intel/tesco-trending?${params}`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API}/api/creator-intel/tesco-history`,             { headers: { Authorization: `Bearer ${token}` } }),
        ])
        if (tcRes.ok)   { const j = await tcRes.json();   setAllProducts(j.data ?? []); setTotalCount(j.count ?? 0) }
        if (histRes.ok) { const j = await histRes.json(); setRankHistory(j.data ?? {}) }
        setLastScraped(null)
      }
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [getToken, filters, activeMarket])

  // Reload when marketplace tab changes
  useEffect(() => { loadData(filters, activeMarket) }, [activeMarket])
  useEffect(() => { loadData() }, [])

  // ── Load rank history after Amazon products arrive ────────────────────────
  useEffect(() => {
    if (activeMarket !== "Amazon" || allProducts.length === 0) return
    getToken().then(token => {
      if (!token) return
      fetch(`${API}/api/creator-intel/amazon-history?marketplace=US`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.ok ? r.json() : null)
        .then(j => { if (j?.data) setRankHistory(j.data) })
        .catch(() => {})
    })
  }, [allProducts, activeMarket, getToken])

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
      if (sortCol === "product_name") {
        const cmp = a.product_name.localeCompare(b.product_name)
        return sortDir === "asc" ? cmp : -cmp
      }
      let va = 0, vb = 0
      if (sortCol === "rank")         { va = a.rank ?? 9999;         vb = b.rank ?? 9999 }
      if (sortCol === "price")        { va = n(a.price) ?? 0;        vb = n(b.price) ?? 0 }
      if (sortCol === "rating")       { va = n(a.rating) ?? 0;       vb = n(b.rating) ?? 0 }
      if (sortCol === "review_count") { va = n(a.review_count) ?? 0; vb = n(b.review_count) ?? 0 }
      if (sortCol === "items_sold")   { va = soldNum(a.rank, a.review_count); vb = soldNum(b.rank, b.review_count) }
      if (sortCol === "revenue")      { va = soldNum(a.rank, a.review_count) * (n(a.price) ?? 0); vb = soldNum(b.rank, b.review_count) * (n(b.price) ?? 0) }
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

  // ── Scrape trigger (marketplace-aware) ───────────────────────────────────

  const handleRefresh = async () => {
    const token = await getToken()
    if (!token) return
    setRefreshing(true)
    try {
      const endpoint =
        activeMarket === "eBay"   ? `${API}/api/creator-intel/scrape-ebay`   :
        activeMarket === "iHerb"  ? `${API}/api/creator-intel/scrape-iherb`  :
        activeMarket === "Tesco"  ? `${API}/api/creator-intel/scrape-tesco`  :
                                    `${API}/api/creator-intel/scrape-amazon`
      await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ limit: 100 }),
      })
      await loadData(filters, activeMarket)
    } catch { /* ignore */ }
    setRefreshing(false)
  }

  // ── Sort column header ────────────────────────────────────────────────────

  const SortHeader = ({ col, label, align = "right" }: { col: typeof sortCol; label: string; align?: "left" | "right" }) => (
    <th
      className={`px-3 py-2.5 text-[11px] font-semibold text-gray-500 cursor-pointer hover:text-[#4b7cf3] whitespace-nowrap select-none ${align === "left" ? "text-left" : "text-right"}`}
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
    <div className="flex flex-col -m-4 sm:-m-6 bg-[#f4f5f7]">

      {/* ── AI suggestion bar — hidden on Alibaba (sourcing tool, not best sellers) */}
      {activeMarket !== "Alibaba" && (
        <div className="bg-[#e8f0fe] border-b border-[#c5d5f8] px-5 py-2.5 flex items-start gap-2">
          <span className="text-[#2563eb] text-lg leading-none mt-0.5">🤖</span>
          <p className="text-xs text-[#1d4ed8] leading-relaxed">
            <span className="font-semibold">Based on {activeMarket} product data</span>, select items with substantial sales and rapid growth, indicating market acceptance.
            Combine Best Sellers data to identify the next potential trending product.
            Data is for reference only — always validate before purchasing inventory.
          </p>
        </div>
      )}

      {/* ── Search + refresh row — hidden on Alibaba ────────────────── */}
      {activeMarket !== "Alibaba" && (
        <div className="bg-white border-b border-gray-200 px-4 py-2.5 flex items-center gap-3 flex-wrap">
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
      )}

      {/* ── Filtering conditions strip — hidden on Alibaba ──────────── */}
      {activeMarket !== "Alibaba" && (
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

      {/* ── Marketplace tab bar ─────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-4 flex items-end gap-1 overflow-x-auto">
        {MARKETPLACES.map(m => {
          const isActive = activeMarket === m.id
          return (
            <button
              key={m.id}
              onClick={() => setActiveMarket(m.id)}
              className={`relative flex items-center gap-1.5 px-4 py-2.5 text-sm whitespace-nowrap transition-colors border-b-2 ${
                isActive
                  ? "border-[#FF9900] bg-white"
                  : "border-transparent hover:bg-gray-50 text-gray-400"
              }`}
            >
              {m.logo}
              {m.flag && <span className="text-[11px] leading-none">{m.flag}</span>}
            </button>
          )
        })}
      </div>

      {/* ── Alibaba sourcing UI ─────────────────────────────────────── */}
      {activeMarket === "Alibaba" && (
        <div className="flex-1 px-6 py-8 bg-[#f4f5f7]">
          {/* Header */}
          <div className="max-w-2xl mx-auto mb-8 text-center">
            <div className="text-3xl mb-2">🏭</div>
            <h2 className="text-xl font-bold text-gray-800 mb-1">Find Suppliers on Alibaba</h2>
            <p className="text-sm text-gray-500">Type any product to find cheap suppliers — results from AliExpress sorted by total orders</p>
          </div>
          {/* Search box */}
          <div className="max-w-xl mx-auto flex gap-2 mb-8">
            <input
              type="text"
              value={aliQuery}
              onChange={e => setAliQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && aliQuery.trim()) {
                  setAliLoading(true); setAliSearched(true); setAliError(null); setAliResults([])
                  getToken().then(token => {
                    fetch(`${API}/api/creator-intel/source-alibaba`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
                      body: JSON.stringify({ query: aliQuery.trim() }),
                    })
                      .then(r => r.json())
                      .then(j => { if (j.success) setAliResults(j.data ?? []); else setAliError(j.error ?? "Search failed") })
                      .catch(() => setAliError("Network error — please try again"))
                      .finally(() => setAliLoading(false))
                  })
                }
              }}
              placeholder="e.g. LED ring light, yoga mat, phone case..."
              className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[#FF6A00] focus:ring-1 focus:ring-[#FF6A00]/20 bg-white"
            />
            <button
              disabled={!aliQuery.trim() || aliLoading}
              onClick={() => {
                if (!aliQuery.trim()) return
                setAliLoading(true); setAliSearched(true); setAliError(null); setAliResults([])
                getToken().then(token => {
                  fetch(`${API}/api/creator-intel/source-alibaba`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
                    body: JSON.stringify({ query: aliQuery.trim() }),
                  })
                    .then(r => r.json())
                    .then(j => { if (j.success) setAliResults(j.data ?? []); else setAliError(j.error ?? "Search failed") })
                    .catch(() => setAliError("Network error — please try again"))
                    .finally(() => setAliLoading(false))
                })
              }}
              className="px-5 py-2.5 rounded-lg text-white text-sm font-bold transition-colors disabled:opacity-40"
              style={{ background: aliLoading || !aliQuery.trim() ? undefined : "#FF6A00", backgroundColor: aliLoading || !aliQuery.trim() ? "#aaa" : "#FF6A00" }}
            >
              {aliLoading ? "Searching…" : "Find Suppliers"}
            </button>
          </div>

          {/* Results */}
          {aliLoading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <RefreshCw className="h-7 w-7 text-[#FF6A00] animate-spin" />
              <p className="text-sm text-gray-400">Searching AliExpress…</p>
            </div>
          )}
          {!aliLoading && aliError && (
            <div className="max-w-lg mx-auto text-center py-12">
              <div className="text-3xl mb-3">⚠️</div>
              <p className="text-sm font-medium text-gray-700 mb-1">Search unavailable</p>
              <p className="text-xs text-gray-400">{aliError}</p>
              <a
                href={`https://www.aliexpress.com/wholesale?SearchText=${encodeURIComponent(aliQuery)}&SortType=total_tranRanking_desc`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-4 px-4 py-2 rounded text-sm font-semibold text-white"
                style={{ background: "#FF6A00" }}
              >
                Search directly on AliExpress →
              </a>
            </div>
          )}
          {!aliLoading && !aliError && aliSearched && aliResults.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-12">No suppliers found — try a different search term.</p>
          )}
          {!aliLoading && aliResults.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {aliResults.map((r, i) => (
                <a
                  key={i}
                  href={r.product_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-white rounded-xl border border-gray-200 hover:shadow-md transition-shadow overflow-hidden flex flex-col"
                >
                  <div className="aspect-square bg-gray-50 overflow-hidden">
                    {r.image_url
                      ? <img src={r.image_url} alt={r.title} className="w-full h-full object-contain p-2" />
                      : <div className="w-full h-full flex items-center justify-center text-4xl text-gray-200">📦</div>
                    }
                  </div>
                  <div className="p-2.5 flex flex-col gap-0.5">
                    <p className="text-xs font-medium text-gray-800 line-clamp-2">{r.title}</p>
                    <p className="text-sm font-bold mt-1" style={{ color: "#FF6A00" }}>
                      {r.price_min != null
                        ? r.price_min === r.price_max || r.price_max == null
                          ? `$${r.price_min.toFixed(2)}`
                          : `$${r.price_min.toFixed(2)} – $${r.price_max!.toFixed(2)}`
                        : "—"}
                    </p>
                    {r.orders != null && (
                      <p className="text-[10px] text-gray-400">{r.orders.toLocaleString()}+ orders</p>
                    )}
                    {r.seller && (
                      <p className="text-[10px] text-gray-500 truncate">{r.seller}</p>
                    )}
                  </div>
                </a>
              ))}
            </div>
          )}
          {!aliSearched && (
            <p className="text-center text-xs text-gray-400 mt-4">Results sourced from AliExpress · sorted by total orders · powered by Alibaba Group</p>
          )}
        </div>
      )}

      {/* ── Body: filter panel + table (all best-sellers marketplaces) ── */}
      {activeMarket !== "Alibaba" && <div className="flex">

        {/* ── Left filter panel ────────────────────────────────────── */}
        {/* Single overflow-y-auto container; scrollbar hidden; sticky buttons at bottom */}
        <div className="w-56 shrink-0 bg-white border-r border-gray-200 hidden lg:block overflow-y-auto [&::-webkit-scrollbar]:w-0 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: "none" }}>
          <div>

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
                {(MARKETPLACE_CATEGORIES[activeMarket] ?? MARKETPLACE_CATEGORIES.Amazon).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
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

            {/* Submit / Reset — sticky at bottom of scroll area */}
            <div className="sticky bottom-0 border-t border-gray-200 p-3 flex gap-2 bg-white shadow-[0_-2px_6px_rgba(0,0,0,0.05)]">
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
        </div>

        {/* ── Main table area ───────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <RefreshCw className="h-7 w-7 text-[#4b7cf3] animate-spin" />
              <p className="text-sm text-gray-500">Loading {activeMarket} data…</p>
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
                  <SortHeader col="product_name" label="Product Info" align="left" />
                  <SortHeader col="rank" label="BSR" />
                  <th className="px-3 py-2.5 text-center font-semibold text-gray-500 w-28 text-[11px]">Sale Trend</th>
                  <SortHeader col="items_sold" label="Item Sold (L30D)" />
                  <SortHeader col="revenue" label="Revenue (L30D)" />
                  <SortHeader col="review_count" label="No. of Ratings" />
                  <SortHeader col="rating" label="Rating" align="left" />
                </tr>
              </thead>
              <tbody>
                {displayed.map((p, i) => {
                  const est = estimateSold(p.rank, p.price, p.review_count)
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

                            {/* Badges — use scraped badge; fall back to rank-1=Best Seller while awaiting rescrape */}
                            <div className="flex items-center gap-1 mt-1.5">
                              <Badge type={p.badge ?? (p.rank === 1 ? "Best Seller" : null)} />
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
                        <Sparkline rank={p.rank} reviewCount={n(p.review_count)} history={p.asin ? rankHistory[p.asin] : undefined} />
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
                      <td className="px-3 py-3 align-top text-left">
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
          <div className="bg-white border-t border-gray-200 px-4 py-2 text-[10px] text-gray-400 text-right">
            Data processed by algorithm, for reference only. {activeMarket} Best Sellers · Estimated sales are indicative only.
          </div>
        </div>
      </div>}

    </div>
  )
}
