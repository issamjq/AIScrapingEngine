// Beautiful app UI mockups used in the showcase sections

import { Globe, Zap, Package, BarChart3, Store, TrendingUp, TrendingDown } from "lucide-react"

const cardShadow = "shadow-[0_25px_60px_-15px_rgba(0,0,0,0.25)] dark:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] ring-1 ring-black/5 dark:ring-white/10"

// B2B — Catalog + stores visual
export function B2BVisual() {
  const products = [
    { name: "Sony WH-1000XM5",   sku: "SON-WH5", stores: 4, status: "tracked", price: "AED 899",   delta: "-6%", down: true  },
    { name: "Apple AirPods Pro",  sku: "APP-AP2", stores: 6, status: "tracked", price: "AED 749",   delta: "-3%", down: true  },
    { name: "Samsung Galaxy S25", sku: "SAM-S25", stores: 3, status: "pending", price: "AED 3,499", delta: "—",   down: false },
    { name: "Dyson V15 Detect",   sku: "DYS-V15", stores: 5, status: "tracked", price: "AED 2,199", delta: "+2%", down: false },
  ]

  return (
    <div className="relative w-full max-w-xl mx-auto select-none">
      <div className={`relative rounded-[22px] border bg-card overflow-hidden ${cardShadow}`}>
        {/* Header */}
        <div className="px-5 py-4 border-b flex items-center justify-between bg-gradient-to-b from-muted/40 to-transparent">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-blue-500/15 flex items-center justify-center">
              <Package className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-none">Product Catalog</p>
              <p className="text-[10px] text-muted-foreground mt-1">4 products · 18 stores tracked</p>
            </div>
          </div>
          <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
            Auto-sync ON
          </span>
        </div>

        {/* Table */}
        <div className="divide-y">
          {products.map((p, i) => (
            <div key={i} className="px-5 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/10 flex items-center justify-center border border-blue-500/10">
                  <Store className="h-4 w-4 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs font-semibold leading-none">{p.name}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{p.sku} · {p.stores} stores</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-xs font-bold">{p.price}</p>
                  <div className="flex items-center gap-0.5 justify-end mt-0.5">
                    {p.delta !== "—" && (p.down
                      ? <TrendingDown className="h-3 w-3 text-emerald-500" />
                      : <TrendingUp   className="h-3 w-3 text-rose-500" />
                    )}
                    <span className={`text-[10px] font-semibold ${p.delta === "—" ? "text-muted-foreground" : p.down ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                      {p.delta}
                    </span>
                  </div>
                </div>
                <span className={`text-[9px] font-semibold px-2 py-1 rounded-full ${
                  p.status === "tracked"
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                }`}>
                  {p.status}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Footer bar */}
        <div className="px-5 py-3 bg-muted/30 border-t flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[10px] text-muted-foreground">Last synced <span className="font-semibold text-foreground">2 minutes ago</span> · Next sync in 58 min</span>
        </div>
      </div>

      {/* Floating chip */}
      <div className="hidden lg:flex absolute -top-4 -right-4 items-center gap-2 rounded-2xl bg-background border shadow-lg px-3 py-2 animate-[float_6s_ease-in-out_infinite]">
        <div className="h-6 w-6 rounded-lg bg-emerald-500/15 flex items-center justify-center">
          <TrendingDown className="h-3.5 w-3.5 text-emerald-500" />
        </div>
        <div>
          <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">Beat avg</p>
          <p className="text-xs font-bold">-4.3%</p>
        </div>
      </div>
    </div>
  )
}

// B2C — AI global search results visual
export function B2CVisual() {
  const phases = [
    { label: "Detecting your location…",    done: true },
    { label: "Searching globally (6 sites)", done: true },
    { label: "Extracting with Vision AI…",  done: true },
  ]
  const results = [
    { flag: "🇦🇪", store: "Amazon AE",  price: "$81",  tag: "Cheapest",    save: "$13" },
    { flag: "🇬🇧", store: "Amazon UK",  price: "$87",  tag: null,           save: null  },
    { flag: "🇺🇸", store: "B&H Photo",  price: "$94",  tag: null,           save: null  },
  ]

  return (
    <div className="relative w-full max-w-xl mx-auto select-none">
      <div className={`relative rounded-[22px] border bg-card overflow-hidden ${cardShadow}`}>
        <div className="px-5 py-4 border-b flex items-center gap-2 bg-gradient-to-b from-muted/40 to-transparent">
          <div className="h-7 w-7 rounded-lg bg-emerald-500/15 flex items-center justify-center">
            <Globe className="h-4 w-4 text-emerald-500" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-none">AI Market Discovery</p>
            <p className="text-[10px] text-muted-foreground mt-1">"Sony WH-1000XM5"</p>
          </div>
          <span className="ml-auto text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-1 rounded-full font-semibold">
            Standard · 2 credits
          </span>
        </div>

        {/* Phases */}
        <div className="px-5 py-3 border-b bg-muted/20 space-y-1.5">
          {phases.map((ph) => (
            <div key={ph.label} className="flex items-center gap-2">
              <div className="h-3.5 w-3.5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0 shadow-sm shadow-emerald-500/30">
                <span className="text-[7px] text-white font-bold">✓</span>
              </div>
              <span className="text-[10px] text-muted-foreground">{ph.label}</span>
            </div>
          ))}
        </div>

        {/* Results */}
        <div className="p-4 space-y-2">
          {results.map((r, i) => (
            <div
              key={i}
              className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
                i === 0
                  ? "border-amber-500/40 bg-gradient-to-r from-amber-500/10 to-transparent"
                  : "bg-background hover:bg-muted/30"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-lg">{r.flag}</span>
                <div>
                  <p className="text-xs font-semibold">{r.store}</p>
                  {r.tag ? (
                    <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">{r.tag}</span>
                  ) : (
                    <span className="text-[9px] text-muted-foreground">Ships worldwide</span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold">{r.price}</p>
                {r.save && (
                  <p className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold">Save {r.save}</p>
                )}
              </div>
            </div>
          ))}
          <div className="relative">
            <div className="flex items-center justify-between p-3 rounded-xl border bg-muted/30 blur-[2px] opacity-60">
              <span className="text-xs font-semibold">Locked result</span>
              <span className="text-sm font-bold">$—</span>
            </div>
            <p className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold text-muted-foreground">
              +3 more results — upgrade to unlock
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// Price history chart visual
export function PriceChartVisual() {
  const points = [65, 72, 68, 80, 75, 72, 60, 55, 58, 52, 48, 50, 45, 42, 48]
  const max = Math.max(...points)
  const min = Math.min(...points)
  const width = 300
  const height = 90
  const path = points
    .map((p, i) => `${(i / (points.length - 1)) * width},${height - ((p - 0) / 100) * height}`)
    .join(" L")

  return (
    <div className="relative w-full max-w-xl mx-auto select-none">
      <div className={`relative rounded-[22px] border bg-card overflow-hidden ${cardShadow}`}>
        <div className="px-5 py-4 border-b flex items-center gap-2 bg-gradient-to-b from-muted/40 to-transparent">
          <div className="h-7 w-7 rounded-lg bg-purple-500/15 flex items-center justify-center">
            <BarChart3 className="h-4 w-4 text-purple-500" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-none">Price Activity</p>
            <p className="text-[10px] text-muted-foreground mt-1">Last 30 days · Sony WH-1000XM5</p>
          </div>
          <span className="ml-auto flex items-center gap-1.5 text-[10px]">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-muted-foreground font-medium">Live</span>
          </span>
        </div>

        <div className="p-5 space-y-5">
          {/* Chart */}
          <div className="relative">
            <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full h-28">
              <defs>
                <linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%"   stopColor="#A855F7" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#A855F7" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={`M0,${height} L${path} L${width},${height} Z`} fill="url(#chartFill)" />
              <path d={`M${path}`} fill="none" stroke="#A855F7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              {/* current dot */}
              <circle cx={width} cy={height - ((points[points.length - 1]) / 100) * height} r="3.5" fill="#A855F7" />
              <circle cx={width} cy={height - ((points[points.length - 1]) / 100) * height} r="7" fill="#A855F7" opacity="0.25" />
            </svg>
            {/* min marker */}
            <div className="absolute top-1/2 -translate-y-1/2 left-[55%] -translate-x-1/2">
              <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-md shadow-emerald-500/40" />
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>30 days ago</span>
            <span>Today</span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Current",      value: "AED 299", trend: "↓", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10" },
              { label: "30-day low",   value: "AED 269", trend: "★", color: "text-amber-600 dark:text-amber-400",     bg: "bg-amber-500/10" },
              { label: "30-day high",  value: "AED 499", trend: "↑", color: "text-rose-600 dark:text-rose-400",       bg: "bg-rose-500/10" },
            ].map(({ label, value, trend, color, bg }) => (
              <div key={label} className={`rounded-xl p-3 text-center border ${bg}`}>
                <p className={`text-sm font-bold ${color}`}>{trend} {value}</p>
                <p className="text-[9px] text-muted-foreground mt-1 uppercase tracking-wider font-medium">{label}</p>
              </div>
            ))}
          </div>

          {/* Min/max hint */}
          <p className="text-[10px] text-center text-muted-foreground">
            <span className="font-semibold text-foreground">46%</span> below 30-day high · price dropped <span className="font-semibold text-emerald-600 dark:text-emerald-400">AED 200</span>
          </p>
        </div>
      </div>

      {/* Floating chip */}
      <div className="hidden lg:flex absolute -top-4 -right-4 items-center gap-2 rounded-2xl bg-background border shadow-lg px-3 py-2 animate-[float_7s_ease-in-out_infinite_reverse]">
        <Zap className="h-3.5 w-3.5 text-purple-500" />
        <p className="text-xs font-semibold">Real-time</p>
      </div>

      {/* Use same keyframes */}
      <span className="sr-only" aria-hidden="true">{min}{max}</span>
    </div>
  )
}
