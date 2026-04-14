// Beautiful app UI mockups used in the showcase sections

import { Globe, Zap, Package, BarChart3, Store } from "lucide-react"

// B2B — Catalog + stores visual
export function B2BVisual() {
  const products = [
    { name: "Sony WH-1000XM5",  sku: "SON-WH5", stores: 4, status: "tracked",  price: "AED 899" },
    { name: "Apple AirPods Pro", sku: "APP-AP2", stores: 6, status: "tracked",  price: "AED 749" },
    { name: "Samsung Galaxy S25",sku: "SAM-S25", stores: 3, status: "pending",  price: "AED 3,499" },
    { name: "Dyson V15 Detect",  sku: "DYS-V15", stores: 5, status: "tracked",  price: "AED 2,199" },
  ]

  return (
    <div className="relative w-full max-w-xl mx-auto select-none">
      <div className="absolute inset-0 bg-blue-400/15 dark:bg-blue-400/8 blur-3xl rounded-3xl -z-10 scale-110" />
      <div className="rounded-2xl border bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-semibold">Product Catalog</span>
          </div>
          <span className="text-[10px] text-muted-foreground">4 products · 18 stores tracked</span>
        </div>
        {/* Table */}
        <div className="divide-y">
          {products.map((p, i) => (
            <div key={i} className="px-5 py-3 flex items-center justify-between hover:bg-muted/40 transition-colors">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-500/5 flex items-center justify-center">
                  <Store className="h-4 w-4 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs font-semibold leading-none">{p.name}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{p.sku} · {p.stores} stores</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-amber-500">{p.price}</span>
                <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                  p.status === "tracked"
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
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
          <span className="text-[10px] text-muted-foreground">Last synced 2 minutes ago · Next sync in 58 min</span>
        </div>
      </div>
    </div>
  )
}

// B2C — AI global search results visual
export function B2CVisual() {
  const phases = [
    { label: "Searching globally…",   done: true },
    { label: "Scraping 6 retailers…", done: true },
    { label: "Extracting prices…",    done: true },
  ]
  const results = [
    { flag: "🇦🇪", store: "Amazon AE",    price: "$81",  tag: "Cheapest" },
    { flag: "🇬🇧", store: "Amazon UK",    price: "$87",  tag: null },
    { flag: "🇺🇸", store: "B&H Photo",    price: "$94",  tag: null },
  ]

  return (
    <div className="relative w-full max-w-xl mx-auto select-none">
      <div className="absolute inset-0 bg-green-400/15 dark:bg-green-400/8 blur-3xl rounded-3xl -z-10 scale-110" />
      <div className="rounded-2xl border bg-card shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center gap-2">
          <Globe className="h-4 w-4 text-green-500" />
          <span className="text-sm font-semibold">AI Market Discovery</span>
          <span className="ml-auto text-[10px] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full font-semibold">Standard · 2 credits</span>
        </div>
        {/* Phases */}
        <div className="px-5 py-3 border-b bg-muted/20 space-y-1.5">
          {phases.map((ph) => (
            <div key={ph.label} className="flex items-center gap-2">
              <div className="h-3.5 w-3.5 rounded-full bg-green-500 flex items-center justify-center shrink-0">
                <span className="text-[7px] text-white font-bold">✓</span>
              </div>
              <span className="text-[10px] text-muted-foreground">{ph.label}</span>
            </div>
          ))}
        </div>
        {/* Results */}
        <div className="p-4 space-y-2">
          {results.map((r, i) => (
            <div key={i} className={`flex items-center justify-between p-3 rounded-xl border ${i === 0 ? "border-amber-500/40 bg-amber-500/5" : "bg-background"}`}>
              <div className="flex items-center gap-2.5">
                <span className="text-lg">{r.flag}</span>
                <div>
                  <p className="text-xs font-semibold">{r.store}</p>
                  {r.tag && <span className="text-[9px] font-bold text-amber-500 uppercase">{r.tag}</span>}
                </div>
              </div>
              <p className="text-sm font-bold text-amber-500">{r.price}</p>
            </div>
          ))}
          <p className="text-center text-[10px] text-muted-foreground pt-1">+3 more results blurred — upgrade to unlock</p>
        </div>
      </div>
    </div>
  )
}

// Price history chart visual
export function PriceChartVisual() {
  const bars = [65, 72, 68, 80, 75, 60, 55, 70, 65, 58, 50, 62]

  return (
    <div className="relative w-full max-w-xl mx-auto select-none">
      <div className="absolute inset-0 bg-purple-400/15 dark:bg-purple-400/8 blur-3xl rounded-3xl -z-10 scale-110" />
      <div className="rounded-2xl border bg-card shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-purple-500" />
          <span className="text-sm font-semibold">Price Activity</span>
          <span className="ml-auto flex items-center gap-1.5 text-[10px]">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            <span className="text-muted-foreground">Live tracking</span>
          </span>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-end gap-1 h-24">
            {bars.map((h, i) => (
              <div
                key={i}
                className={`flex-1 rounded-sm transition-all ${i === bars.indexOf(Math.min(...bars)) ? "bg-amber-500" : "bg-muted"}`}
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>30 days ago</span>
            <span>Today</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Current", value: "AED 299", trend: "↓", color: "text-green-600" },
              { label: "30-day low", value: "AED 269", trend: "★", color: "text-amber-500" },
              { label: "30-day high", value: "AED 499", trend: "↑", color: "text-red-500" },
            ].map(({ label, value, trend, color }) => (
              <div key={label} className="bg-muted/40 rounded-xl p-2.5 text-center">
                <p className={`text-sm font-bold ${color}`}>{trend} {value}</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="absolute -top-3 -right-3 bg-purple-500 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-full shadow-lg">
        <Zap className="h-3 w-3 inline mr-1" />
        Real-time
      </div>
    </div>
  )
}
