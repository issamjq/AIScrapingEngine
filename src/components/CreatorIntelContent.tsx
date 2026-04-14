import { useState, useEffect, useCallback } from "react"
import { Search, ChevronDown, ChevronRight, Star, Download, SlidersHorizontal, ArrowUpRight, ArrowDownRight, BadgeCheck, ExternalLink, RefreshCw } from "lucide-react"
import { useAuth } from "@/context/AuthContext"

interface Props { role?: string }

const API = import.meta.env.VITE_API_URL || "http://localhost:8080"

// ─── API types ────────────────────────────────────────────────────────────────

interface ApiTikTokProduct {
  product_name:       string
  category:           string | null
  tiktok_price:       number | null
  gmv_7d:             number | null
  units_sold_7d:      number | null
  growth_pct:         number | null
  video_count:        number | null
  top_creator_handle: string | null
  shop_name:          string | null
  image_url:          string | null
  scraped_at?:        string
}

interface ApiAmazonProduct {
  asin:         string | null
  product_name: string
  category:     string | null
  rank:         number | null
  price:        number | null
  rating:       number | null
  review_count: number | null
  marketplace:  string
}

// ─── Adapters (API → display row format) ─────────────────────────────────────

const AVATAR_COLORS = [
  "bg-pink-400","bg-amber-400","bg-blue-400","bg-green-400",
  "bg-purple-400","bg-red-400","bg-teal-400","bg-rose-400",
]

function formatGMV(v: number | string | null | undefined): string {
  if (v === null || v === undefined) return "—"
  const n = Number(v)
  if (!isFinite(n) || n === 0) return "—"
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}m`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}k`
  return `$${n.toFixed(0)}`
}

function formatCount(v: number | string | null | undefined): string {
  if (v === null || v === undefined) return "—"
  const n = Number(v)
  if (!isFinite(n) || n === 0) return "—"
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(2)}k`
  return String(n)
}

function pseudoTrend(growth: number | string | null | undefined, len = 12): number[] {
  growth = Number(growth ?? 0) || 0
  // Generate a plausible sparkline shape from the growth %
  const arr: number[] = []
  let v = 50
  for (let i = 0; i < len; i++) {
    v += (growth / len) + (Math.sin(i * 1.3) * 5)
    arr.push(Math.max(10, Math.min(90, v)))
  }
  return arr
}

function formatPrice(v: number | string | null | undefined): string {
  if (v === null || v === undefined) return "—"
  const n = Number(v)
  return isFinite(n) && n > 0 ? `$${n.toFixed(2)}` : "—"
}

function adaptTikTok(products: ApiTikTokProduct[]) {
  return products.map((p, i) => ({
    rank:      i + 1,
    name:      p.product_name,
    price:     formatPrice(p.tiktok_price),
    color:     AVATAR_COLORS[i % AVATAR_COLORS.length],
    imageUrl:  p.image_url ?? null,
    revenue:   formatGMV(p.gmv_7d),
    trend:     pseudoTrend(p.growth_pct),
    growth:    p.growth_pct != null ? (Number(p.growth_pct) || 0) : null,
    itemsSold: formatCount(p.units_sold_7d),
    avgPrice:  formatPrice(p.tiktok_price),
    commission:"—",
    creators:  formatCount(p.video_count),
    launch:    p.scraped_at ? new Date(p.scraped_at).toLocaleDateString("en-US", { month:"2-digit", day:"2-digit", year:"numeric" }) : "—",
  }))
}

function adaptAmazon(products: ApiAmazonProduct[]): typeof AMAZON_PRODUCTS {
  return products.map((p, i) => ({
    rank:      p.rank ?? i + 1,
    name:      p.product_name,
    asin:      p.asin ?? "—",
    brand:     p.category ?? "—",
    price:     p.price != null ? `$${p.price.toFixed(2)}` : "—",
    color:     AVATAR_COLORS[i % AVATAR_COLORS.length],
    bsr:       p.rank ?? 0,
    bsrDelta:  0,
    trend:     pseudoTrend(0),
    itemsSold: "—",
    revenue:   "—",
    revGrowth: 0,
    ratings:   p.review_count != null ? p.review_count.toLocaleString() : "—",
    rating:    p.rating ?? 0,
    shelf:     "—",
    sellers:   1,
  }))
}

type Platform = "tiktok" | "amazon" | "alibaba"

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
  const min = Math.min(...data), max = Math.max(...data)
  const range = max - min || 1
  const W = 80, H = 28
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * W},${H - ((v - min) / range) * (H - 4) - 2}`).join(" ")
  return (
    <svg width={W} height={H} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={positive ? "#22c55e" : "#ef4444"} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} className={`h-3 w-3 ${i <= Math.round(rating) ? "text-amber-400 fill-amber-400" : "text-muted-foreground/30"}`} />
      ))}
      <span className="text-xs text-muted-foreground ml-1">{rating}</span>
    </div>
  )
}

// ─── Dummy Data ───────────────────────────────────────────────────────────────

const TIKTOK_PRODUCTS = [
  { rank:1, name:"Women's YIANNA Fajas Colombianas Shapewear Waist Trainer", price:"$45.99", color:"bg-pink-400",    revenue:"$1.45m", trend:[40,55,42,60,58,45,62,50,48,55,60,58], growth:-18.4, itemsSold:"37.23k", avgPrice:"$38.84", commission:"15%", creators:"1.62k", launch:"10/30/2024" },
  { rank:2, name:"OEAK Women Jelly Bras Wirefree Full Coverage No Underwire",  price:"$19.99", color:"bg-amber-400",  revenue:"$1.38m", trend:[55,48,60,45,50,55,42,48,52,45,50,48], growth:-19.5, itemsSold:"83.44k", avgPrice:"$16.53", commission:"10%", creators:"911",   launch:"07/11/2025" },
  { rank:3, name:"SHAPERX Shapewear for Women Tummy Control Body Shaper",     price:"$39.99", color:"bg-blue-400",   revenue:"$1.19m", trend:[30,35,40,38,45,50,48,55,52,58,60,62], growth:+48.0, itemsSold:"41.02k", avgPrice:"$29.08", commission:"15%", creators:"826",   launch:"08/13/2025" },
  { rank:4, name:"YIANNA Fajas Colombianas Shapewear for Women Butt Lifter",  price:"$39.99", color:"bg-green-400",  revenue:"$1.19m", trend:[60,55,58,50,45,48,42,45,40,38,42,40], growth:-23.7, itemsSold:"30.61k", avgPrice:"$38.84", commission:"15%", creators:"1.38k", launch:"06/21/2024" },
  { rank:5, name:"OEAK Womens Jelly Bras Full Coverage Wireless Push Up",      price:"$19.99", color:"bg-purple-400", revenue:"$876k",  trend:[50,48,45,42,40,38,42,40,38,35,38,36], growth:-20.7, itemsSold:"52.91k", avgPrice:"$16.56", commission:"10%", creators:"451",   launch:"07/04/2024" },
  { rank:6, name:"BOOMBA Invisible Lift Adhesive Bra Backless Strapless",     price:"$28.00", color:"bg-red-400",    revenue:"$742k",  trend:[20,28,35,42,50,55,58,62,65,68,72,75], growth:+82.3, itemsSold:"26.50k", avgPrice:"$28.00", commission:"12%", creators:"2.1k",  launch:"03/15/2025" },
  { rank:7, name:"Sunzel Flare Leggings with Crossover High Waist",           price:"$34.99", color:"bg-teal-400",   revenue:"$698k",  trend:[45,48,52,55,58,55,52,50,55,58,60,62], growth:+12.5, itemsSold:"19.97k", avgPrice:"$34.99", commission:"8%",  creators:"738",   launch:"01/20/2025" },
  { rank:8, name:"Laneige Lip Sleeping Mask Berry 20ml Overnight Treatment",  price:"$24.00", color:"bg-rose-400",   revenue:"$612k",  trend:[35,40,42,48,52,55,60,62,65,68,70,72], growth:+34.6, itemsSold:"25.50k", avgPrice:"$24.00", commission:"18%", creators:"3.4k",  launch:"05/10/2025" },
]

const AMAZON_PRODUCTS = [
  { rank:1, name:"Amazon Basics Multipurpose Copy Paper, 8.5x11",   asin:"B01FV0F8H8", brand:"Amazon Basics", price:"$6.97",  color:"bg-gray-400",   bsr:1,  bsrDelta:0,  trend:[20,22,21,23,22,24,23,25,24,26,25,27], itemsSold:"350k",  revenue:"$10.80m", revGrowth:+6.53,  ratings:"217,172", rating:4.8, shelf:"9 yrs 4 mo",  sellers:1 },
  { rank:2, name:"Miss Mouth's Messy Eater Stain Treater Spray",    asin:"B01EIG6A4Q", brand:"Miss Mouth's",  price:"$7.97",  color:"bg-yellow-400", bsr:10, bsrDelta:+1, trend:[30,35,38,45,50,55,58,62,65,70,72,75], itemsSold:"309k",  revenue:"$6.18m",  revGrowth:+54.24, ratings:"89,592",  rating:4.4, shelf:"10 yrs 13 d", sellers:1 },
  { rank:3, name:"Angel Soft Toilet Paper, 18 Mega Rolls",          asin:"B0FN4NH4K8", brand:"Angel Soft",   price:"$12.66", color:"bg-blue-300",   bsr:6,  bsrDelta:-3, trend:[55,52,50,48,45,42,40,38,36,35,33,32], itemsSold:"290.5k",revenue:"$3.84m",  revGrowth:-5.63,  ratings:"98,919",  rating:4.7, shelf:"8 mo 13 d",   sellers:1 },
  { rank:4, name:"Stanley Quencher H2.0 FlowState Tumbler 40 oz",   asin:"B09QBKDQCV", brand:"Stanley",      price:"$45.00", color:"bg-green-400",  bsr:3,  bsrDelta:+2, trend:[40,48,55,62,70,75,78,80,82,85,88,90], itemsSold:"180.2k",revenue:"$8.10m",  revGrowth:+41.20, ratings:"142,381", rating:4.8, shelf:"2 yrs 6 mo",  sellers:3 },
  { rank:5, name:"Liquid I.V. Hydration Multiplier, 30 Stick Packs", asin:"B01IT9NLGY", brand:"Liquid I.V.",  price:"$24.97", color:"bg-orange-400", bsr:15, bsrDelta:+4, trend:[35,38,42,45,50,52,55,58,60,62,65,68], itemsSold:"215.8k",revenue:"$5.39m",  revGrowth:+28.70, ratings:"76,234",  rating:4.6, shelf:"7 yrs 2 mo",  sellers:2 },
  { rank:6, name:"COSRX Snail Mucin 96% Power Repairing Essence",   asin:"B09B3B5BTX", brand:"COSRX",        price:"$21.90", color:"bg-emerald-400",bsr:22, bsrDelta:+8, trend:[25,30,35,40,48,52,58,62,65,70,74,78], itemsSold:"148.3k",revenue:"$3.24m",  revGrowth:+62.10, ratings:"53,841",  rating:4.7, shelf:"3 yrs 1 mo",  sellers:2 },
]

const ALIBABA_PRODUCTS = [
  { rank:1, name:"Custom Logo Shapewear Women Butt Lifter Body Shaper Colombiana",    color:"bg-pink-400",    supplier:"Guangzhou Fashion International Co., Ltd", platform:"Alibaba",    unitPrice:"$4.20–$8.50",  moq:50,  orders:"15.6k", rating:4.9, years:8,  response:"97.2%", shipping:"~12 days to UAE", verified:true  },
  { rank:2, name:"Wholesale Wireless Seamless Jelly Bra Push Up No-Wire Women",       color:"bg-amber-400",   supplier:"Yiwu Lingerie & Apparel Factory",           platform:"AliExpress", unitPrice:"$2.80–$5.40",  moq:100, orders:"8.2k",  rating:4.7, years:5,  response:"93.5%", shipping:"~15 days to UAE", verified:true  },
  { rank:3, name:"OEM 40oz Stainless Steel Insulated Tumbler Custom Color Logo",      color:"bg-green-400",   supplier:"Shenzhen Elite Drinkware Co., Ltd",          platform:"Alibaba",    unitPrice:"$5.50–$9.20",  moq:200, orders:"22.4k", rating:4.8, years:11, response:"98.1%", shipping:"~10 days to UAE", verified:true  },
  { rank:4, name:"Private Label Electrolyte Hydration Powder Sticks OEM",            color:"bg-orange-400",  supplier:"Guangdong Nutrition Lab Technology Ltd",      platform:"Alibaba",    unitPrice:"$0.85–$2.10",  moq:500, orders:"4.1k",  rating:4.6, years:6,  response:"89.7%", shipping:"~14 days to UAE", verified:false },
  { rank:5, name:"High Waist Crossover Flare Yoga Pants Women Activewear OEM",       color:"bg-teal-400",    supplier:"Hangzhou Active Sports Apparel Co.",          platform:"AliExpress", unitPrice:"$7.30–$12.50", moq:30,  orders:"11.8k", rating:4.8, years:7,  response:"95.3%", shipping:"~13 days to UAE", verified:true  },
  { rank:6, name:"Snail Mucin Essence Serum 96% Korean Skincare OEM Private Label",  color:"bg-emerald-400", supplier:"Guangzhou K-Beauty Cosmetics Factory",        platform:"Alibaba",    unitPrice:"$1.20–$3.80",  moq:200, orders:"6.7k",  rating:4.7, years:9,  response:"96.4%", shipping:"~11 days to UAE", verified:true  },
]

// ─── Filter config ────────────────────────────────────────────────────────────

const FILTERS: Record<Platform, { label: string; items: string[] }[]> = {
  tiktok: [
    { label: "Dates",           items: ["Last 7 Days", "Last 30 Days", "Last 90 Days", "Custom Range"] },
    { label: "Category",        items: ["Womenswear & Underwear", "Beauty & Personal Care", "Home & Kitchen", "Electronics", "Fitness & Sports"] },
    { label: "Revenue Filters", items: ["Revenue ($)", "Item Sold", "Revenue Source (Content)", "Revenue Source (Channel)", "Revenue Growth Rate"] },
    { label: "Advanced",        items: ["Avg. Unit Price ($)", "Is Affiliate Product", "Creator Number", "Creator Conversion Ratio", "Shipping Option", "Launch Date", "Commission Rate"] },
  ],
  amazon: [
    { label: "Dates",             items: ["Last 30 Days", "Last 60 Days", "Last 90 Days"] },
    { label: "Category",          items: ["Office Products", "Health & Household", "Kitchen & Dining", "Sports & Outdoors", "Beauty"] },
    { label: "Sales Performance", items: ["Item Sold (L30D)", "Monthly Sales Growth", "Revenue (L30D)", "Monthly Revenue Growth"] },
    { label: "BSR",               items: ["BSR Rank", "Monthly BSR Growth Rate", "Leaf Category BSR"] },
    { label: "Product Info",      items: ["Number of Ratings", "Rating", "On-shelf Time", "Number of Sellers"] },
  ],
  alibaba: [
    { label: "Platform",  items: ["Alibaba", "AliExpress", "1688 (China)"] },
    { label: "Category",  items: ["Clothing & Apparel", "Health & Beauty", "Kitchen & Home", "Electronics", "Sports"] },
    { label: "Price & MOQ", items: ["Unit Price ($)", "Min. Order Qty", "Bulk Discount"] },
    { label: "Supplier",  items: ["Supplier Rating", "Years Active", "Response Rate", "Verified Only"] },
    { label: "Shipping",  items: ["Ships to UAE", "Ships to US", "Estimated Days", "DDP Available"] },
  ],
}

const TABS: Record<Platform, string[]> = {
  tiktok:  ["All Products", "Top New Products", "High Potential Affiliate", "Sales Grow Rapidly", "Top Video Products"],
  amazon:  ["All Products", "Best Sellers", "Movers & Shakers", "Rising Stars", "TikTok Matching"],
  alibaba: ["All Suppliers", "Top Rated", "Fast Shipping", "Low MOQ", "Verified Only"],
}

const PLATFORM_COLORS: Record<Platform, string> = {
  tiktok:  "bg-black text-white",
  amazon:  "bg-[#FF9900] text-black",
  alibaba: "bg-orange-600 text-white",
}

const PLATFORM_LABELS: Record<Platform, string> = {
  tiktok:  "TikTok",
  amazon:  "Amazon",
  alibaba: "Alibaba",
}

// ─── Filter Panel ─────────────────────────────────────────────────────────────

function FilterSection({
  label, items, activeItem, onSelect,
}: {
  label:      string
  items:      string[]
  activeItem?: string
  onSelect?:  (item: string) => void
}) {
  const [open, setOpen] = useState(label === "Dates" || label === "Category" || label === "Platform" || label === "Revenue Filters" || label === "Sales Performance")
  return (
    <div className="border-b last:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/40 transition-colors text-left"
      >
        <span className="text-xs font-semibold text-foreground">{label}</span>
        {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>
      {open && (
        <div className="px-4 pb-3 space-y-1">
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
                <div className={`h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0 ${
                  isActive ? "border-primary bg-primary" : "border-muted-foreground/40"
                }`}>
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

// ─── Tables ───────────────────────────────────────────────────────────────────

function TikTokTable({ products }: { products: typeof TIKTOK_PRODUCTS }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b bg-muted/30">
            <th className="text-left px-3 py-3 font-semibold text-muted-foreground w-8">#</th>
            <th className="text-left px-3 py-3 font-semibold text-muted-foreground min-w-[260px]">Product Info</th>
            <th className="text-right px-3 py-3 font-semibold text-muted-foreground">Revenue</th>
            <th className="text-center px-3 py-3 font-semibold text-muted-foreground">Revenue Trend</th>
            <th className="text-right px-3 py-3 font-semibold text-muted-foreground">Growth Rate</th>
            <th className="text-right px-3 py-3 font-semibold text-muted-foreground">Item Sold</th>
            <th className="text-right px-3 py-3 font-semibold text-muted-foreground">Avg. Price</th>
            <th className="text-right px-3 py-3 font-semibold text-muted-foreground">Commission</th>
            <th className="text-right px-3 py-3 font-semibold text-muted-foreground">Creators</th>
            <th className="text-right px-3 py-3 font-semibold text-muted-foreground">Launch Date</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {products.map(p => (
            <tr key={p.rank} className="hover:bg-muted/20 transition-colors group">
              <td className="px-3 py-3 font-bold text-muted-foreground">{p.rank}</td>
              <td className="px-3 py-3">
                <div className="flex items-center gap-3">
                  {(p as any).imageUrl ? (
                    <img
                      src={(p as any).imageUrl}
                      alt={p.name}
                      className="h-11 w-11 rounded-lg object-cover shrink-0"
                      onError={e => { (e.target as HTMLImageElement).style.display = "none" }}
                    />
                  ) : (
                    <div className={`h-11 w-11 rounded-lg ${p.color} shrink-0 flex items-center justify-center text-white text-[10px] font-bold`}>IMG</div>
                  )}
                  <div className="min-w-0">
                    <p className="font-medium text-foreground leading-snug line-clamp-2 max-w-[220px]">{p.name}</p>
                    <p className="text-muted-foreground mt-0.5">{p.price}</p>
                  </div>
                </div>
              </td>
              <td className="px-3 py-3 text-right">
                <span className="font-bold text-primary">{p.revenue}</span>
              </td>
              <td className="px-3 py-3 flex justify-center items-center h-[60px]">
                <Sparkline data={p.trend} positive={(p.growth ?? 0) >= 0} />
              </td>
              <td className="px-3 py-3 text-right">
                {(p as any).growth == null ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  <span className={`font-semibold flex items-center justify-end gap-0.5 ${(p as any).growth >= 0 ? "text-green-600" : "text-red-500"}`}>
                    {(p as any).growth >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {Math.abs((p as any).growth)}%
                  </span>
                )}
              </td>
              <td className="px-3 py-3 text-right text-muted-foreground">{p.itemsSold}</td>
              <td className="px-3 py-3 text-right text-muted-foreground">{p.avgPrice}</td>
              <td className="px-3 py-3 text-right text-muted-foreground">{p.commission}</td>
              <td className="px-3 py-3 text-right font-medium">{p.creators}</td>
              <td className="px-3 py-3 text-right text-muted-foreground">{p.launch}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AmazonTable({ products }: { products: typeof AMAZON_PRODUCTS }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b bg-muted/30">
            <th className="text-left px-3 py-3 font-semibold text-muted-foreground w-8">#</th>
            <th className="text-left px-3 py-3 font-semibold text-muted-foreground min-w-[280px]">Product Info</th>
            <th className="text-right px-3 py-3 font-semibold text-muted-foreground">BSR</th>
            <th className="text-center px-3 py-3 font-semibold text-muted-foreground">Sales Trend</th>
            <th className="text-right px-3 py-3 font-semibold text-muted-foreground">Item Sold (L30D)</th>
            <th className="text-right px-3 py-3 font-semibold text-muted-foreground">Revenue (L30D)</th>
            <th className="text-right px-3 py-3 font-semibold text-muted-foreground">Ratings</th>
            <th className="text-center px-3 py-3 font-semibold text-muted-foreground">Rating</th>
            <th className="text-right px-3 py-3 font-semibold text-muted-foreground">On-shelf</th>
            <th className="text-right px-3 py-3 font-semibold text-muted-foreground">Sellers</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {products.map(p => (
            <tr key={p.rank} className="hover:bg-muted/20 transition-colors group">
              <td className="px-3 py-3 font-bold text-muted-foreground">{p.rank}</td>
              <td className="px-3 py-3">
                <div className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    <div className={`h-11 w-11 rounded-lg ${p.color} flex items-center justify-center text-white text-[10px] font-bold`}>IMG</div>
                    <div className="absolute -top-1 -left-1 h-5 w-5 rounded-full bg-[#FF9900] flex items-center justify-center">
                      <span className="text-[9px] font-black text-black">a</span>
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-foreground leading-snug line-clamp-2 max-w-[230px]">{p.name}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-muted-foreground">
                      <span>ASIN: {p.asin}</span>
                      <span>·</span>
                      <span>{p.brand}</span>
                      <span>·</span>
                      <span className="font-medium">{p.price}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <button className="text-[10px] px-1.5 py-0.5 rounded border border-primary/30 text-primary hover:bg-primary/5 transition-colors">Trend Details</button>
                      <button className="text-[10px] px-1.5 py-0.5 rounded border border-black/20 dark:border-white/20 hover:bg-muted/50 transition-colors">TikTok Matching</button>
                      <button className="text-[10px] px-1.5 py-0.5 rounded bg-[#FF9900]/10 text-[#c47b00] dark:text-[#FF9900] border border-[#FF9900]/30 hover:bg-[#FF9900]/20 transition-colors">Similar Products</button>
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-3 py-3 text-right">
                <div className="font-bold">{p.bsr}</div>
                <div className={`text-[10px] flex items-center justify-end gap-0.5 ${p.bsrDelta > 0 ? "text-green-600" : p.bsrDelta < 0 ? "text-red-500" : "text-muted-foreground"}`}>
                  {p.bsrDelta > 0 ? <ArrowUpRight className="h-2.5 w-2.5" /> : p.bsrDelta < 0 ? <ArrowDownRight className="h-2.5 w-2.5" /> : null}
                  {p.bsrDelta !== 0 ? Math.abs(p.bsrDelta) : "—"}
                </div>
              </td>
              <td className="px-3 py-3 flex justify-center items-center h-[72px]">
                <Sparkline data={p.trend} positive={p.revGrowth >= 0} />
              </td>
              <td className="px-3 py-3 text-right text-muted-foreground">{p.itemsSold}</td>
              <td className="px-3 py-3 text-right">
                <div className="font-bold text-primary">{p.revenue}</div>
                <div className={`text-[10px] flex items-center justify-end gap-0.5 ${p.revGrowth >= 0 ? "text-green-600" : "text-red-500"}`}>
                  {p.revGrowth >= 0 ? "+" : ""}{p.revGrowth}%
                </div>
              </td>
              <td className="px-3 py-3 text-right text-muted-foreground">{p.ratings}</td>
              <td className="px-3 py-3"><Stars rating={p.rating} /></td>
              <td className="px-3 py-3 text-right text-muted-foreground">{p.shelf}</td>
              <td className="px-3 py-3 text-right font-medium">{p.sellers}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AlibabaTable({ products }: { products: typeof ALIBABA_PRODUCTS }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b bg-muted/30">
            <th className="text-left px-3 py-3 font-semibold text-muted-foreground w-8">#</th>
            <th className="text-left px-3 py-3 font-semibold text-muted-foreground min-w-[280px]">Product & Supplier</th>
            <th className="text-right px-3 py-3 font-semibold text-muted-foreground">Platform</th>
            <th className="text-right px-3 py-3 font-semibold text-muted-foreground">Unit Price</th>
            <th className="text-right px-3 py-3 font-semibold text-muted-foreground">MOQ</th>
            <th className="text-right px-3 py-3 font-semibold text-muted-foreground">Orders</th>
            <th className="text-center px-3 py-3 font-semibold text-muted-foreground">Rating</th>
            <th className="text-right px-3 py-3 font-semibold text-muted-foreground">Yrs Active</th>
            <th className="text-right px-3 py-3 font-semibold text-muted-foreground">Response</th>
            <th className="text-right px-3 py-3 font-semibold text-muted-foreground">Shipping to UAE</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {products.map(p => (
            <tr key={p.rank} className="hover:bg-muted/20 transition-colors group">
              <td className="px-3 py-3 font-bold text-muted-foreground">{p.rank}</td>
              <td className="px-3 py-3">
                <div className="flex items-center gap-3">
                  <div className={`h-11 w-11 rounded-lg ${p.color} shrink-0 flex items-center justify-center text-white text-[10px] font-bold`}>IMG</div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {p.verified && <BadgeCheck className="h-3.5 w-3.5 text-blue-500 shrink-0" />}
                      <p className="font-medium text-foreground leading-snug line-clamp-2 max-w-[220px]">{p.name}</p>
                    </div>
                    <p className="text-muted-foreground truncate max-w-[220px]">{p.supplier}</p>
                    <button className="mt-1 text-[10px] px-1.5 py-0.5 rounded border border-orange-500/30 text-orange-600 dark:text-orange-400 hover:bg-orange-500/10 transition-colors flex items-center gap-1">
                      <ExternalLink className="h-2.5 w-2.5" /> View Supplier
                    </button>
                  </div>
                </div>
              </td>
              <td className="px-3 py-3 text-right">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${p.platform === "Alibaba" ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
                  {p.platform}
                </span>
              </td>
              <td className="px-3 py-3 text-right font-bold text-green-600">{p.unitPrice}</td>
              <td className="px-3 py-3 text-right text-muted-foreground">{p.moq} units</td>
              <td className="px-3 py-3 text-right font-medium">{p.orders}</td>
              <td className="px-3 py-3"><Stars rating={p.rating} /></td>
              <td className="px-3 py-3 text-right text-muted-foreground">{p.years} yrs</td>
              <td className="px-3 py-3 text-right text-muted-foreground">{p.response}</td>
              <td className="px-3 py-3 text-right text-muted-foreground">{p.shipping}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CreatorIntelContent({ role }: Props) {
  const { user } = useAuth()
  const [platform, setPlatform]         = useState<Platform>("tiktok")
  const [platformOpen, setPlatformOpen] = useState(false)
  const [activeTab, setActiveTab]       = useState(0)
  const [search, setSearch]             = useState("")

  // Live data state
  const [tiktokLive,    setTiktokLive]    = useState<typeof TIKTOK_PRODUCTS | null>(null)
  const [amazonLive,    setAmazonLive]    = useState<typeof AMAZON_PRODUCTS | null>(null)
  const [loading,       setLoading]       = useState(true)
  const [refreshing,    setRefreshing]    = useState(false)
  const [lastScraped,   setLastScraped]   = useState<string | null>(null)
  const [dateRange,     setDateRange]     = useState<7 | 30 | 90>(30)
  const [category,     setCategory]      = useState<string>("All")
  const [sortBy,       setSortBy]        = useState<"gmv_7d" | "units_sold_7d" | "growth_pct">("gmv_7d")

  const isAdmin = role === "dev" || role === "owner"

  const getToken = useCallback(async () => {
    try { return user ? await (user as any).getIdToken() : null } catch { return null }
  }, [user])

  const loadData = useCallback(async (opts?: { days?: number; cat?: string; sort?: string }) => {
    const days = opts?.days ?? dateRange
    const cat  = opts?.cat  ?? category
    const sort = opts?.sort ?? sortBy
    const token = await getToken()
    if (!token) { setLoading(false); return }

    const tkParams = new URLSearchParams({ limit: "50", days: String(days), sortBy: sort })
    if (cat && cat !== "All") tkParams.set("category", cat)

    const amParams = new URLSearchParams({ limit: "50", days: String(days) })

    try {
      const [tkRes, amRes, freshRes] = await Promise.all([
        fetch(`${API}/api/creator-intel/trending?${tkParams}`,       { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/creator-intel/amazon-trending?${amParams}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/creator-intel/freshness`,                   { headers: { Authorization: `Bearer ${token}` } }),
      ])

      if (tkRes.ok) {
        const json = await tkRes.json()
        setTiktokLive(json.data?.length ? adaptTikTok(json.data) : null)
      }
      if (amRes.ok) {
        const json = await amRes.json()
        setAmazonLive(json.data?.length ? adaptAmazon(json.data) : null)
      }
      if (freshRes.ok) {
        const json = await freshRes.json()
        setLastScraped(json.data?.tiktok_last_scraped ?? null)
      }
    } catch (err) { console.error("[CreatorIntel] loadData error:", err) }
    setLoading(false)
  }, [getToken, dateRange, category, sortBy])

  useEffect(() => { loadData() }, [loadData])

  const handleDateRange = (days: 7 | 30 | 90) => {
    setDateRange(days)
    loadData({ days })
  }

  const handleCategory = (cat: string) => {
    // Map display label → DB value
    const CAT_MAP: Record<string, string> = {
      "Womenswear & Underwear": "Womenswear",
      "Beauty & Personal Care": "Beauty",
      "Home & Kitchen":         "Home & Kitchen",
      "Electronics":            "Electronics",
      "Fitness & Sports":       "Sports & Outdoors",
      "All":                    "All",
    }
    const mapped = CAT_MAP[cat] ?? cat
    setCategory(mapped)
    loadData({ cat: mapped })
  }

  const handleSort = (item: string) => {
    const SORT_MAP: Record<string, "gmv_7d" | "units_sold_7d" | "growth_pct"> = {
      "Revenue ($)":          "gmv_7d",
      "Revenue (L30D)":       "gmv_7d",
      "Item Sold":            "units_sold_7d",
      "Item Sold (L30D)":     "units_sold_7d",
      "Revenue Growth Rate":  "growth_pct",
      "Monthly Sales Growth": "growth_pct",
      "Monthly Revenue Growth": "growth_pct",
    }
    const mapped = SORT_MAP[item]
    if (!mapped) return
    setSortBy(mapped)
    loadData({ sort: mapped })
  }

  const handleReset = () => {
    setDateRange(30)
    setCategory("All")
    setSortBy("gmv_7d")
    loadData({ days: 30, cat: "All", sort: "gmv_7d" })
  }

  const handleRefresh = async () => {
    const token = await getToken()
    if (!token) return
    setRefreshing(true)
    try {
      const endpoint = platform === "amazon" ? "scrape-amazon" : "scrape-tiktok"
      await fetch(`${API}/api/creator-intel/${endpoint}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ limit: 20 }),
      })
      await loadData()
    } catch { /* ignore */ }
    setRefreshing(false)
  }

  // Display data — real if loaded, fallback to dummy
  const tiktokProducts = tiktokLive ?? TIKTOK_PRODUCTS
  const amazonProducts  = amazonLive  ?? AMAZON_PRODUCTS
  const isLive          = platform === "tiktok" ? !!tiktokLive : platform === "amazon" ? !!amazonLive : false

  const filters = FILTERS[platform]
  const tabs    = TABS[platform]

  return (
    <div className="flex flex-col h-full -m-4 sm:-m-6">

      {/* ── Top bar: title + platform switcher + sub-tabs ── */}
      <div className="border-b bg-card px-4 sm:px-6 pt-4">

        {/* Row 1: title + platform switcher + actions */}
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-black tracking-tight">Creator Intelligence</h1>
            {loading ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border">Loading…</span>
            ) : isLive ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 border border-green-500/20">
                Live Data{lastScraped ? ` · ${new Date(lastScraped).toLocaleDateString()}` : ""}
              </span>
            ) : (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-500 border border-pink-500/20">Demo Data</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-muted/60 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
                {refreshing ? "Scraping…" : "Refresh Data"}
              </button>
            )}
            {/* Platform switcher */}
            <div className="relative">
              <button
                onClick={() => setPlatformOpen(o => !o)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${PLATFORM_COLORS[platform]}`}
              >
                {platform === "tiktok" && <span className="text-[10px]">TikTok</span>}
                {platform === "amazon" && <span className="text-[10px]">a</span>}
                {platform === "alibaba" && <span className="text-[10px]">阿</span>}
                {PLATFORM_LABELS[platform]}
                <ChevronDown className="h-3 w-3" />
              </button>
              {platformOpen && (
                <div className="absolute top-full left-0 mt-1 w-36 bg-background border rounded-xl shadow-xl z-20 overflow-hidden">
                  {(["tiktok", "amazon", "alibaba"] as Platform[]).map(p => (
                    <button key={p} onClick={() => { setPlatform(p); setPlatformOpen(false); setActiveTab(0) }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold hover:bg-muted/60 transition-colors ${platform === p ? "bg-muted" : ""}`}>
                      {PLATFORM_LABELS[p]}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-muted/60 transition-colors">
              <Download className="h-3.5 w-3.5" /> Export
            </button>
          </div>
        </div>

        {/* Row 2: sub-tabs */}
        <div className="flex items-center gap-0">
          {tabs.map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveTab(i)}
              className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
                activeTab === i
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* ── Body: left filters + right table ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left filter panel */}
        <div className="w-52 shrink-0 border-r bg-card overflow-y-auto hidden lg:block">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div className="flex items-center gap-1.5">
              <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-bold">Filters</span>
            </div>
            <button onClick={handleReset} className="text-[10px] text-primary hover:underline">Reset</button>
          </div>
          {filters.map(f => {
            // Determine active item per filter group
            let activeItem: string | undefined
            if (f.label === "Dates") {
              activeItem = `Last ${dateRange} Days`
            } else if (f.label === "Category") {
              const REV_CAT: Record<string, string> = {
                "Womenswear": "Womenswear & Underwear",
                "Beauty":     "Beauty & Personal Care",
                "Home & Kitchen": "Home & Kitchen",
                "Electronics": "Electronics",
                "Sports & Outdoors": "Fitness & Sports",
              }
              activeItem = category === "All" ? undefined : (REV_CAT[category] ?? category)
            } else if (f.label === "Revenue Filters" || f.label === "Sales Performance") {
              const REV_SORT: Record<string, string> = {
                gmv_7d:        "Revenue ($)",
                units_sold_7d: "Item Sold",
                growth_pct:    "Revenue Growth Rate",
              }
              activeItem = REV_SORT[sortBy]
            }

            const handleSelect = (item: string) => {
              if (f.label === "Dates") {
                const d = item === "Last 7 Days" ? 7 : item === "Last 90 Days" ? 90 : 30
                handleDateRange(d as 7 | 30 | 90)
              } else if (f.label === "Category") {
                handleCategory(item)
              } else if (f.label === "Revenue Filters" || f.label === "Sales Performance") {
                handleSort(item)
              }
            }

            return (
              <FilterSection
                key={f.label}
                label={f.label}
                items={f.items}
                activeItem={activeItem}
                onSelect={handleSelect}
              />
            )
          })}
        </div>

        {/* Right: search + table */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Search + filter chips */}
          <div className="px-4 py-3 border-b bg-card flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5 bg-background flex-1 min-w-[200px] max-w-sm">
              <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={`Search ${PLATFORM_LABELS[platform]} products…`}
                className="text-xs bg-transparent outline-none flex-1 placeholder:text-muted-foreground"
              />
            </div>

            {/* Active filter chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-medium text-muted-foreground">Dates:</span>
              {([7, 30, 90] as const).map(d => (
                <button
                  key={d}
                  onClick={() => handleDateRange(d)}
                  className={`inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border font-medium transition-colors ${
                    dateRange === d
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted text-muted-foreground hover:bg-muted/70"
                  }`}
                >
                  Last {d} Days
                </button>
              ))}
              {category !== "All" && (
                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/30 font-medium">
                  {category}
                  <button onClick={() => handleCategory("All")} className="ml-0.5 hover:text-primary/70">×</button>
                </span>
              )}
            </div>

            <div className="ml-auto flex items-center gap-2 text-[10px] text-muted-foreground shrink-0">
              Data processed by algorithm, for reference only.
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto">
            {platform === "tiktok"  && <TikTokTable  products={tiktokProducts}  />}
            {platform === "amazon"  && <AmazonTable  products={amazonProducts}  />}
            {platform === "alibaba" && <AlibabaTable products={ALIBABA_PRODUCTS} />}
          </div>

          {/* Footer */}
          <div className="border-t px-4 py-2.5 bg-card flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              Showing {platform === "tiktok" ? tiktokProducts.length : platform === "amazon" ? amazonProducts.length : ALIBABA_PRODUCTS.length} results
              {platform === "alibaba" && " · Demo data — Alibaba scraper coming soon"}
            </span>
            <div className="flex items-center gap-3">
              {!isLive && platform !== "alibaba" && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-pink-500/10 text-pink-500 font-semibold border border-pink-500/20">
                  No scraped data yet — click Refresh Data to load
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
