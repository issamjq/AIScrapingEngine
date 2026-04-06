import { useState, useEffect, useRef } from "react"
import { Button } from "./ui/button"
import { Textarea } from "./ui/textarea"
import {
  Compass, Sparkles, Loader2, ExternalLink, Lock,
  TrendingDown, AlertCircle, Search, Globe, Eye, CheckCircle2,
} from "lucide-react"
import { PageSkeleton } from "./PageSkeleton"
import { useAuth } from "@/context/AuthContext"

const API = import.meta.env.VITE_API_URL || "http://localhost:8080"

const UNLIMITED_ROLES = ["dev", "owner"]

const RESULT_LIMIT: Record<string, number> = {
  free:       3,
  trial:      8,
  pro:        20,
  enterprise: 20,
}

// ── Condition badge ───────────────────────────────────────────────
const CONDITION_STYLES: Record<string, string> = {
  "New":          "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  "Refurbished":  "bg-violet-100  text-violet-700  dark:bg-violet-900/30  dark:text-violet-400",
  "Used - Good":  "bg-blue-100    text-blue-700    dark:bg-blue-900/30    dark:text-blue-400",
  "Used - Fair":  "bg-amber-100   text-amber-700   dark:bg-amber-900/30   dark:text-amber-400",
  "Used - Poor":  "bg-orange-100  text-orange-700  dark:bg-orange-900/30  dark:text-orange-400",
  "Unknown":      "bg-muted       text-muted-foreground",
}

function ConditionBadge({ condition }: { condition: string }) {
  const style = CONDITION_STYLES[condition] ?? CONDITION_STYLES["Unknown"]
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${style}`}>
      {condition}
    </span>
  )
}

// ── Price card ────────────────────────────────────────────────────
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
  priceSource:   "scraped" | "not_found"
}

function formatPrice(price: number, currency: string) {
  return `${currency} ${price.toLocaleString("en-AE", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function PriceCard({
  result,
  isBest,
  rank,
}: {
  result:  B2CResult
  isBest:  boolean
  rank:    number
}) {
  const hasPrice    = result.price !== null
  const hasDiscount = result.originalPrice !== null && result.originalPrice > (result.price ?? 0)
  const discount    = hasDiscount
    ? Math.round(((result.originalPrice! - result.price!) / result.originalPrice!) * 100)
    : 0

  return (
    <div className={`relative rounded-2xl border bg-card overflow-hidden transition-shadow hover:shadow-md ${
      isBest ? "border-primary/40 shadow-sm" : ""
    }`}>
      {/* Best price banner */}
      {isBest && (
        <div className="flex items-center gap-1.5 bg-primary px-4 py-1.5">
          <TrendingDown className="h-3.5 w-3.5 text-primary-foreground" />
          <span className="text-xs font-bold text-primary-foreground tracking-wide uppercase">Best Price</span>
        </div>
      )}

      <div className="flex items-start gap-4 p-4">
        {/* Rank + image */}
        <div className="flex flex-col items-center gap-2 shrink-0">
          <span className="text-xs font-bold text-muted-foreground/50 w-6 text-center">#{rank}</span>
          {result.imageUrl ? (
            <img
              src={result.imageUrl}
              alt={result.title}
              className="w-14 h-14 rounded-lg object-contain bg-muted/30 border"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
            />
          ) : (
            <div className="w-14 h-14 rounded-lg bg-muted/40 border flex items-center justify-center">
              <span className="text-lg font-bold text-muted-foreground/40 select-none">
                {result.retailer.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground">{result.retailer}</span>
            <ConditionBadge condition={result.condition} />
            {result.availability === "Out of Stock" && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive">
                Out of Stock
              </span>
            )}
          </div>

          <p className="text-sm font-medium leading-snug line-clamp-2">{result.title}</p>

          {/* Price row */}
          {hasPrice ? (
            <div className="flex items-baseline gap-2 mt-1">
              <span className={`text-xl font-bold ${isBest ? "text-primary" : "text-foreground"}`}>
                {formatPrice(result.price!, result.currency)}
              </span>
              {hasDiscount && (
                <>
                  <span className="text-sm text-muted-foreground line-through">
                    {formatPrice(result.originalPrice!, result.currency)}
                  </span>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    -{discount}%
                  </span>
                </>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>Price not available — visit listing</span>
            </div>
          )}
        </div>

        {/* CTA */}
        <a
          href={result.url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 mt-1"
        >
          <Button
            size="sm"
            variant={isBest ? "default" : "outline"}
            className="gap-1.5 text-xs rounded-xl"
          >
            View deal
            <ExternalLink className="h-3 w-3" />
          </Button>
        </a>
      </div>
    </div>
  )
}

// ── Loading animation ─────────────────────────────────────────────
// Phase timings (seconds from start) — roughly match backend pipeline
const PHASES = [
  {
    key:     "web-search",
    icon:    Search,
    label:   "Web Search",
    detail:  "Searching marketplaces and classifieds globally…",
    startAt: 0,
    doneAt:  18,
  },
  {
    key:     "scraping",
    icon:    Globe,
    label:   "Scraping Pages",
    detail:  "Opening listing pages and extracting data…",
    startAt: 18,
    doneAt:  50,
  },
  {
    key:     "vision",
    icon:    Eye,
    label:   "Vision AI",
    detail:  "AI reading screenshots to extract prices…",
    startAt: 50,
    doneAt:  80,
  },
  {
    key:     "sorting",
    icon:    Sparkles,
    label:   "Finalizing",
    detail:  "Ranking results by best price…",
    startAt: 80,
    doneAt:  999,
  },
] as const

function SearchingState({ query }: { query: string }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const start = Date.now()
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 500)
    return () => clearInterval(t)
  }, [])

  const activeIdx = PHASES.findLastIndex((p) => elapsed >= p.startAt)
  const activePhase = PHASES[activeIdx] ?? PHASES[0]

  return (
    <div className="flex flex-col items-center justify-center py-16 gap-8 text-center">
      {/* Animated icon */}
      <div className="relative">
        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
          <Sparkles className="h-8 w-8 text-primary" />
        </div>
        <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary/20 animate-ping" />
      </div>

      <div className="space-y-1.5">
        <p className="text-base font-semibold">Finding best prices for</p>
        <p className="text-lg font-bold text-primary line-clamp-2 max-w-sm">"{query}"</p>
      </div>

      {/* Pipeline steps */}
      <div className="w-full max-w-xs space-y-2">
        {PHASES.map((phase, idx) => {
          const Icon = phase.icon
          const isDone    = elapsed >= phase.doneAt
          const isActive  = idx === activeIdx
          const isPending = idx > activeIdx

          return (
            <div
              key={phase.key}
              className={`flex items-center gap-3 rounded-xl px-4 py-2.5 border transition-all ${
                isActive
                  ? "border-primary/40 bg-primary/5 text-foreground"
                  : isDone
                  ? "border-emerald-500/20 bg-emerald-500/5 text-muted-foreground"
                  : "border-border/40 bg-muted/20 text-muted-foreground/40"
              }`}
            >
              {/* Icon */}
              <div className="shrink-0">
                {isDone ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : isActive ? (
                  <Loader2 className="h-4 w-4 text-primary animate-spin" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </div>

              {/* Label + detail */}
              <div className="flex-1 text-left min-w-0">
                <p className={`text-xs font-semibold ${isPending ? "opacity-40" : ""}`}>
                  {phase.label}
                </p>
                {isActive && (
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                    {activePhase.detail}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-xs text-muted-foreground/50">
        This takes up to 90 seconds — running the full AI pipeline
      </p>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────
export function B2CDiscoveryContent({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const { user }                              = useAuth()

  const [loading, setLoading]                 = useState(true)
  const [balance, setBalance]                 = useState<number | null>(null)
  const [userProfile, setUserProfile]         = useState<{
    subscription: string; role: string; trialEndsAt?: string | null
  } | null>(null)

  const [query, setQuery]                     = useState("")
  const [phase, setPhase]                     = useState<"idle" | "searching" | "results">("idle")
  const [results, setResults]                 = useState<B2CResult[]>([])
  const [visibleLimit, setVisibleLimit]       = useState(3)
  const [lastQuery, setLastQuery]             = useState("")
  const [searchError, setSearchError]         = useState<string | null>(null)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  async function getToken() {
    try { return user ? await (user as any).getIdToken() : null } catch { return null }
  }

  // Load wallet + profile on mount
  useEffect(() => {
    if (!user) return
    let cancelled = false
    async function load() {
      try {
        const token = await (user as any).getIdToken()
        const [walletRes, meRes] = await Promise.all([
          fetch(`${API}/api/wallet`,            { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API}/api/allowed-users/me`,  { headers: { Authorization: `Bearer ${token}` } }),
        ])
        const [walletJson, meJson] = await Promise.all([walletRes.json(), meRes.json()])
        if (!cancelled) {
          if (walletJson.success) setBalance(walletJson.data?.wallet?.balance ?? 0)
          if (meJson.success && meJson.data) setUserProfile(meJson.data)
        }
      } catch { /* silent */ }
      if (!cancelled) setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [user])

  async function handleSearch() {
    const q = query.trim()
    if (!q || phase === "searching") return

    setPhase("searching")
    setSearchError(null)
    setResults([])
    setLastQuery(q)

    const controller = new AbortController()
    const timeoutId  = setTimeout(() => controller.abort(), 110_000)

    try {
      const token = await getToken()
      const res = await fetch(`${API}/api/discovery/b2c-search`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body:    JSON.stringify({ query: q }),
        signal:  controller.signal,
      })
      clearTimeout(timeoutId)
      const json = await res.json()

      if (!res.ok || !json.success) {
        if (json.error?.code === "USAGE_LIMIT_REACHED") {
          onNavigate?.("plans")
          setPhase("idle")
          return
        }
        throw new Error(json.error?.message || "Search failed")
      }

      const data = json.data
      setResults(data.results || [])
      setVisibleLimit(data.limit ?? 3)
      setBalance((prev) => prev !== null ? Math.max(0, prev - 3) : null)
      setPhase("results")
    } catch (err: any) {
      clearTimeout(timeoutId)
      if (err.name === "AbortError") {
        setSearchError("Search timed out — the AI pipeline is taking too long. Please try again.")
      } else {
        setSearchError(err.message || "Search failed")
      }
      setPhase("idle")
    }
  }

  function handleNewSearch() {
    setPhase("idle")
    setResults([])
    setSearchError(null)
    setQuery("")
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  if (loading) return <PageSkeleton cards={1} rows={4} />

  const isUnlimited   = UNLIMITED_ROLES.includes(userProfile?.role ?? "")
  const subscription  = userProfile?.subscription ?? "free"
  const planLimit     = isUnlimited ? 20 : (RESULT_LIMIT[subscription] ?? 3)

  const canSearch     = isUnlimited || (balance !== null && balance >= 3)
  const visibleCards  = results.slice(0, visibleLimit)
  const blurredCards  = results.slice(visibleLimit)

  // Group results by retailer. Within each group: sorted by price asc.
  // Groups ordered by their lowest price (cheapest retailer first).
  const allVisible = [...visibleCards, ...blurredCards]
  const grouped = allVisible.reduce<Record<string, B2CResult[]>>((acc, r) => {
    if (!acc[r.retailer]) acc[r.retailer] = []
    acc[r.retailer].push(r)
    return acc
  }, {})
  const retailerGroups = Object.entries(grouped)
    .map(([retailer, items]) => ({
      retailer,
      items: items.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity)),
      lowestPrice: Math.min(...items.map(r => r.price ?? Infinity)),
    }))
    .sort((a, b) => a.lowestPrice - b.lowestPrice)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
          <Compass className="h-5 w-5" />
          Market Discovery
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Ask for anything — AI searches the web, scrapes prices, and ranks the best deals
        </p>
      </div>

      {/* ── Idle / Search input ── */}
      {phase === "idle" && (
        <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
          {/* Input area */}
          <div className="p-5 pb-3">
            <Textarea
              ref={textareaRef}
              autoFocus
              rows={3}
              className="resize-none text-base border-0 shadow-none focus-visible:ring-0 bg-transparent p-0 placeholder:text-muted-foreground/50"
              placeholder={`e.g. Infiniti G37 S Coupe 2010 — best price UAE\ne.g. iPhone 16 Pro 256GB new\ne.g. Marvis Classic Whitening Toothpaste 75ml`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSearch()
              }}
            />
          </div>

          {/* Bottom bar — like Midjourney */}
          <div className="flex items-center justify-between gap-3 px-5 py-3 border-t bg-muted/20">
            {/* Left: credit info */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground min-w-0">
              {!isUnlimited && (
                <span className={`font-medium ${!canSearch ? "text-destructive" : ""}`}>
                  {balance !== null ? (
                    canSearch
                      ? `${balance} credits remaining`
                      : `${balance} credits — need 3`
                  ) : "Loading…"}
                </span>
              )}
              {isUnlimited && (
                <span className="font-medium text-primary">Unlimited credits</span>
              )}
              <span className="hidden sm:flex items-center gap-1 opacity-60">
                Web · Scrape · Vision AI
              </span>
            </div>

            {/* Right: Search button (Midjourney-style with credit cost) */}
            <Button
              onClick={handleSearch}
              disabled={!query.trim() || !canSearch}
              className="gap-2 rounded-xl shrink-0 font-semibold"
            >
              <Sparkles className="h-4 w-4" />
              {canSearch ? (
                <>Search <span className="opacity-60 font-normal">· {isUnlimited ? "∞" : "3"} credits</span></>
              ) : (
                "No credits · Upgrade"
              )}
            </Button>
          </div>

          {/* Error */}
          {searchError && (
            <div className="mx-5 mb-4 rounded-xl bg-destructive/10 text-destructive text-sm px-4 py-3 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              {searchError}
            </div>
          )}

          {!canSearch && !isUnlimited && (
            <div className="mx-5 mb-4 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400 text-sm px-4 py-3 flex items-center justify-between gap-3">
              <span>You need 3 credits per search.</span>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0"
                onClick={() => onNavigate?.("plans")}
              >
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                Upgrade
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── Searching ── */}
      {phase === "searching" && <SearchingState query={lastQuery} />}

      {/* ── Results ── */}
      {phase === "results" && (
        <div className="space-y-4">
          {/* Results header */}
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">
                {results.length === 0
                  ? `No results found for "${lastQuery}"`
                  : `${results.length} result${results.length !== 1 ? "s" : ""} for "${lastQuery}"`
                }
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {results.length} price{results.length !== 1 ? "s" : ""} found across {retailerGroups.length} retailer{retailerGroups.length !== 1 ? "s" : ""} · Grouped by store, sorted cheapest first
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleNewSearch} className="shrink-0">
              New search
            </Button>
          </div>

          {results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 rounded-2xl border bg-card">
              <Compass className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground text-center max-w-xs">
                No listings found. Try a more specific query — include model, year, size, or variant.
              </p>
              <Button variant="outline" size="sm" onClick={handleNewSearch}>Try again</Button>
            </div>
          )}

          {/* Results grouped by retailer */}
          {retailerGroups.map((group, groupIdx) => {
            let globalRank = 0
            for (let i = 0; i < groupIdx; i++) globalRank += retailerGroups[i].items.length
            return (
              <div key={group.retailer} className="space-y-2">
                {/* Retailer header */}
                <div className="flex items-center gap-2 px-1">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    {group.retailer}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {group.items.length} listing{group.items.length !== 1 ? "s" : ""}
                  </span>
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs font-semibold text-primary">
                    from {group.items[0].currency} {group.lowestPrice.toLocaleString("en-AE", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                  </span>
                </div>
                {/* Cards */}
                <div className="space-y-2">
                  {group.items.map((result, itemIdx) => (
                    <PriceCard
                      key={result.url}
                      result={result}
                      isBest={groupIdx === 0 && itemIdx === 0}
                      rank={globalRank + itemIdx + 1}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

    </div>
  )
}
