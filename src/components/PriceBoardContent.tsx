import { useState, useEffect, useCallback } from "react"
import { Button } from "./ui/button"
import { Badge } from "./ui/badge"
import { TrendingUp, TrendingDown, Minus, RefreshCw, Filter,
         ExternalLink, Search, Clock, MapPin, Sparkles, Compass } from "lucide-react"
import { TableSkeleton, PageSkeleton } from "./PageSkeleton"
import { useAuth } from "@/context/AuthContext"

const API = import.meta.env.VITE_API_URL || "http://localhost:8080"

// ── B2B mock data (unchanged) ─────────────────────────────────────────────────
const mockPrices = [
  { product: "Marvis Classic Mint 75ml", store: "Amazon AE",     price: "AED 49.50", change: "+2.5%", trend: "up",   status: "in_stock" },
  { product: "Marvis Classic Mint 75ml", store: "Noon",          price: "AED 47.00", change: "—",     trend: "flat", status: "in_stock" },
  { product: "Marvis Whitening 75ml",    store: "Carrefour UAE", price: "AED 52.00", change: "-3.0%", trend: "down", status: "in_stock" },
  { product: "Marvis Whitening 75ml",    store: "Amazon AE",     price: "AED 55.00", change: "+1.0%", trend: "up",   status: "out_of_stock" },
]

// ── Types ─────────────────────────────────────────────────────────────────────
interface B2CResult {
  retailer:      string
  url:           string
  title:         string
  condition:     string
  price:         number | null
  originalPrice: number | null
  currency:      string
  availability:  string
  imageUrl:      string | null
}

interface HistoryEntry {
  id:               number
  query:            string
  country_hint:     string
  results:          B2CResult[]
  result_count:     number
  searched_at:      string
  duration_seconds: number | null
  batch:            number | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatPrice(price: number, currency: string) {
  return `${currency} ${price.toLocaleString("en-AE", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function formatDuration(seconds: number | null): string | null {
  if (seconds === null || seconds === undefined) return null
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

function batchLabel(batch: number | null): string | null {
  if (!batch) return null
  return batch === 1 ? "Quick" : batch === 2 ? "Standard" : "Deep"
}

function formatSearchedAt(iso: string) {
  const d = new Date(iso)
  const h     = d.getHours()
  const min   = String(d.getMinutes()).padStart(2, "0")
  const ampm  = h >= 12 ? "pm" : "am"
  const h12   = h % 12 || 12
  return `${h12}:${min} ${ampm}`
}

function dateGroupLabel(iso: string): string {
  const d    = new Date(iso)
  const now  = new Date()
  const diff = (now.getTime() - d.getTime()) / 86_400_000 // days
  if (diff < 1 && now.getDate() === d.getDate()) return "Today"
  if (diff < 2 && now.getDate() - d.getDate() === 1) return "Yesterday"
  if (diff < 7)  return "Previous 7 days"
  if (diff < 30) return "This month"
  return d.toLocaleString("en-US", { month: "long", year: "numeric" })
}

// ── B2C history view — chat-style ─────────────────────────────────────────────
function B2CPriceHistory({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const { user }              = useAuth()
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId]   = useState<number | null>(null)  // one open at a time

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const token = await user.getIdToken()
      const res   = await fetch(`${API}/api/discovery/b2c-history`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      if (json.success) {
        const parsed = (json.data || []).map((e: any) => ({
          ...e,
          results: typeof e.results === "string" ? JSON.parse(e.results) : e.results,
        }))
        setHistory(parsed)
        if (parsed.length > 0) setOpenId(parsed[0].id)  // open most recent by default
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [user])

  useEffect(() => { load() }, [load])

  if (loading) return (
    <div className="space-y-6 animate-pulse">
      {/* New search button */}
      <div className="flex justify-end">
        <div className="h-8 w-28 rounded-lg bg-muted" />
      </div>
      {/* Date group label */}
      <div className="h-3 w-16 rounded bg-muted" />
      {/* History rows */}
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="rounded-2xl border bg-card px-4 py-3 flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-muted shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-48 rounded bg-muted" />
            <div className="h-3 w-32 rounded bg-muted" />
          </div>
          <div className="h-3 w-16 rounded bg-muted shrink-0" />
        </div>
      ))}
    </div>
  )

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 rounded-2xl border bg-card">
        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Compass className="h-8 w-8 text-primary/60" />
        </div>
        <div className="text-center">
          <p className="font-semibold">No searches yet</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            Your price searches will appear here so you can revisit results without spending credits again.
          </p>
        </div>
        <Button onClick={() => onNavigate?.("discovering")} className="gap-1.5 mt-1">
          <Search className="h-4 w-4" />
          Start searching
        </Button>
      </div>
    )
  }

  // Group by date label
  const groups: { label: string; entries: HistoryEntry[] }[] = []
  for (const entry of history) {
    const label = dateGroupLabel(entry.searched_at)
    const last  = groups[groups.length - 1]
    if (last && last.label === label) last.entries.push(entry)
    else groups.push({ label, entries: [entry] })
  }

  return (
    <div className="space-y-6">
      {/* New search button */}
      <div className="flex justify-end">
        <Button onClick={() => onNavigate?.("discovering")} size="sm" className="gap-1.5">
          <Sparkles className="h-3.5 w-3.5" />
          New search
        </Button>
      </div>

      {groups.map((group) => (
        <div key={group.label}>
          {/* Date group label */}
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
            {group.label}
          </p>

          <div className="rounded-2xl border bg-card overflow-hidden shadow-sm divide-y">
            {group.entries.map((entry) => {
              const isOpen   = openId === entry.id
              const cheapest = entry.results.reduce<B2CResult | null>((best, r) =>
                r.price !== null && (best === null || r.price < best.price!) ? r : best, null)

              return (
                <div key={entry.id}>
                  {/* Chat row — clickable */}
                  <button
                    onClick={() => setOpenId(isOpen ? null : entry.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30 ${
                      isOpen ? "bg-muted/20" : ""
                    }`}
                  >
                    {/* Icon */}
                    <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${
                      isOpen ? "bg-primary text-primary-foreground" : "bg-muted"
                    }`}>
                      <Search className="h-3.5 w-3.5" />
                    </div>

                    {/* Query + meta */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{entry.query}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {entry.country_hint && (
                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            {entry.country_hint}
                          </span>
                        )}
                        <span className="text-[11px] text-muted-foreground">
                          {entry.result_count} result{entry.result_count !== 1 ? "s" : ""}
                        </span>
                        {cheapest && (
                          <span className="text-[11px] font-semibold text-primary">
                            Best: {formatPrice(cheapest.price!, cheapest.currency)}
                          </span>
                        )}
                        {formatDuration(entry.duration_seconds) && (
                          <span className="text-[11px] text-muted-foreground">⏱ {formatDuration(entry.duration_seconds)}</span>
                        )}
                        {batchLabel(entry.batch) && (
                          <span className="text-[11px] px-1.5 py-0.5 rounded-full border border-border text-muted-foreground">
                            {batchLabel(entry.batch)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Time + chevron */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] text-muted-foreground hidden sm:block">
                        {formatSearchedAt(entry.searched_at)}
                      </span>
                      <span className="text-muted-foreground/50 text-xs">{isOpen ? "▲" : "▼"}</span>
                    </div>
                  </button>

                  {/* Expanded results — like a chat reply */}
                  {isOpen && (
                    <div className="bg-muted/10 border-t">
                      <div className="divide-y">
                        {entry.results.map((r, i) => {
                          const isBest      = r === cheapest
                          const hasDiscount = r.originalPrice !== null && r.originalPrice > (r.price ?? 0)
                          const discount    = hasDiscount
                            ? Math.round(((r.originalPrice! - r.price!) / r.originalPrice!) * 100)
                            : 0
                          return (
                            <div
                              key={r.url}
                              className={`flex items-center gap-3 px-5 py-3 hover:bg-muted/20 transition-colors ${isBest ? "bg-primary/5" : ""}`}
                            >
                              <span className="text-xs font-bold text-muted-foreground/40 w-5 shrink-0 text-center">#{i + 1}</span>
                              {r.imageUrl ? (
                                <img src={r.imageUrl} alt={r.title} className="w-10 h-10 rounded-lg object-contain bg-muted/30 border shrink-0"
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-muted/40 border flex items-center justify-center shrink-0">
                                  <span className="text-sm font-bold text-muted-foreground/40">{r.retailer.charAt(0)}</span>
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs font-semibold text-muted-foreground">{r.retailer}</span>
                                  {r.condition !== "Unknown" && (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">{r.condition}</Badge>
                                  )}
                                  {isBest && (
                                    <Badge className="text-[10px] px-1.5 py-0 gap-1 bg-primary/90">
                                      <Sparkles className="h-2.5 w-2.5" />Best price
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground truncate mt-0.5">{r.title}</p>
                              </div>
                              <div className="text-right shrink-0">
                                {r.price !== null ? (
                                  <div className="flex flex-col items-end">
                                    <span className={`text-sm font-bold ${isBest ? "text-primary" : ""}`}>
                                      {formatPrice(r.price, r.currency)}
                                    </span>
                                    {hasDiscount && <span className="text-[10px] text-emerald-600 font-semibold">-{discount}%</span>}
                                  </div>
                                ) : <span className="text-xs text-muted-foreground">—</span>}
                              </div>
                              <a href={r.url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-lg">
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </Button>
                              </a>
                            </div>
                          )
                        })}
                      </div>
                      {/* Re-search footer */}
                      <div className="px-5 py-3 border-t flex items-center justify-between gap-3">
                        <span className="text-xs text-muted-foreground">Want fresh prices?</span>
                        <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7"
                          onClick={() => onNavigate?.("discovering")}>
                          <Search className="h-3 w-3" />
                          Re-search · {batchLabel(entry.batch) === "Quick" ? 1 : batchLabel(entry.batch) === "Standard" ? 2 : 3} credits
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── B2B price board (unchanged) ───────────────────────────────────────────────
function B2BPriceBoard() {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 900)
    return () => clearTimeout(t)
  }, [])

  if (loading) return <TableSkeleton rows={6} />

  return (
    <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
      <div className="px-5 py-4 border-b">
        <p className="text-sm font-semibold">Current Prices</p>
        <p className="text-xs text-muted-foreground mt-0.5">Latest successful scrape per product × store</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Product</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Store</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Price</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground hidden sm:table-cell">Change</th>
              <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">Status</th>
            </tr>
          </thead>
          <tbody>
            {mockPrices.map((row, i) => (
              <tr key={i} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 font-medium">{row.product}</td>
                <td className="px-4 py-3 text-muted-foreground">{row.store}</td>
                <td className="px-4 py-3 text-right font-mono font-medium">{row.price}</td>
                <td className="px-4 py-3 text-right hidden sm:table-cell">
                  <span className={`flex items-center justify-end gap-1 text-xs font-medium ${
                    row.trend === "up" ? "text-red-500" :
                    row.trend === "down" ? "text-green-500" : "text-muted-foreground"
                  }`}>
                    {row.trend === "up"   && <TrendingUp   className="h-3.5 w-3.5" />}
                    {row.trend === "down" && <TrendingDown className="h-3.5 w-3.5" />}
                    {row.trend === "flat" && <Minus        className="h-3.5 w-3.5" />}
                    {row.change}
                  </span>
                </td>
                <td className="px-4 py-3 text-center hidden md:table-cell">
                  <Badge
                    variant={row.status === "in_stock" ? "default" : "destructive"}
                    className="text-[10px]"
                  >
                    {row.status === "in_stock" ? "In Stock" : "Out of Stock"}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
export function PriceBoardContent({ role, onNavigate }: { role?: string; onNavigate?: (page: string) => void }) {
  const isB2C = role === "b2c"

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold">Price Activity</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isB2C
              ? "Your recent AI price searches — revisit results without spending credits."
              : "Latest scraped prices across all monitored products and stores."}
          </p>
        </div>
        {!isB2C && (
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Filter className="h-4 w-4" />
              <span className="hidden sm:inline">Filter</span>
            </Button>
            <Button size="sm" className="gap-1.5">
              <RefreshCw className="h-4 w-4" />
              <span className="hidden sm:inline">Sync All</span>
            </Button>
          </div>
        )}
      </div>

      {isB2C ? <B2CPriceHistory onNavigate={onNavigate} /> : <B2BPriceBoard />}
    </div>
  )
}
