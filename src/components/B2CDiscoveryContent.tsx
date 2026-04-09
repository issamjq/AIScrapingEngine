import { useState, useEffect, useRef } from "react"
import { Button } from "./ui/button"
import { Textarea } from "./ui/textarea"
import {
  Compass, Sparkles, Loader2, ExternalLink,
  AlertCircle, Search, Globe, Eye, CheckCircle2, Star, Lock, Plus, X,
} from "lucide-react"
import { useAuth } from "@/context/AuthContext"

const API = import.meta.env.VITE_API_URL || "http://localhost:8080"

const UNLIMITED_ROLES = ["dev", "owner"]


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

// ── Spark Deal Score calculation ──────────────────────────────────
// Rates each result 1–5 based on: price competitiveness + condition + availability
function calcSparkScore(result: B2CResult, allResults: B2CResult[]): number {
  const priced = allResults.filter(r => r.price !== null).sort((a, b) => a.price! - b.price!)
  const rank   = priced.findIndex(r => r.url === result.url)
  const total  = priced.length

  // Price: cheapest = 5 stars, most expensive = 2 stars
  const priceScore = total <= 1 ? 5 : 5 - (rank / (total - 1)) * 3

  // Condition penalty
  const condPenalty: Record<string, number> = {
    "New": 0, "Refurbished": 0.25,
    "Used - Good": 0.3, "Used - Fair": 0.6, "Used - Poor": 1, "Unknown": 0.2,
  }
  const cond = condPenalty[result.condition] ?? 0.2

  // Availability penalty
  const avail = result.availability === "In Stock" ? 0 : result.availability === "Out of Stock" ? 0.7 : 0.2

  const raw = priceScore - cond - avail
  // Round to nearest 0.5, clamp to 1–5
  return Math.max(1, Math.min(5, Math.round(raw * 2) / 2))
}

function SparkScoreStars({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-3 h-3 ${
              star <= Math.floor(score)
                ? "fill-yellow-400 text-yellow-400"
                : star - 0.5 <= score
                ? "fill-yellow-400/50 text-yellow-400"
                : "fill-gray-200 text-gray-200 dark:fill-muted dark:text-muted"
            }`}
          />
        ))}
      </div>
      <span className="text-[11px] text-muted-foreground font-medium tabular-nums">
        {score.toFixed(1)} · Deal Score
      </span>
    </div>
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
  rating:        number | null
  reviewCount:   number | null
  description:   string | null
  priceSource:   "scraped" | "not_found"
}

function formatPrice(price: number, currency: string) {
  return `${currency} ${price.toLocaleString("en-AE", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function PriceCard({
  result,
  isBest,
  allResults,
  isLocked,
  onLockedClick,
}: {
  result:         B2CResult
  isBest:         boolean
  allResults:     B2CResult[]
  isLocked?:      boolean
  onLockedClick?: () => void
}) {
  const hasDiscount = result.originalPrice !== null && result.originalPrice > (result.price ?? 0)
  const discount    = hasDiscount
    ? Math.round(((result.originalPrice! - result.price!) / result.originalPrice!) * 100)
    : 0
  const score = calcSparkScore(result, allResults)

  return (
    <div
      className={`relative flex-shrink-0 w-72 snap-start rounded-2xl border bg-white dark:bg-card shadow-sm transition-all duration-200 overflow-hidden flex flex-col
        ${isBest ? "border-primary/40 ring-1 ring-primary/20" : "border-gray-200/80 dark:border-border"}
        ${isLocked ? "cursor-pointer hover:shadow-md" : "hover:shadow-md hover:-translate-y-0.5"}
      `}
      onClick={() => isLocked && onLockedClick?.()}
    >
      {/* Lock overlay — transparent click target + lock icon only */}
      {isLocked && (
        <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-gray-900/90 dark:bg-gray-100/90 flex items-center justify-center shadow-md z-20">
          <Lock className="w-4 h-4 text-white dark:text-gray-900" />
        </div>
      )}

      {/* Best price banner — always reserves space so all cards align */}
      <div className={`flex items-center gap-1.5 px-4 py-1.5 ${isBest ? "bg-primary" : "invisible"}`}>
        <span className="text-xs font-bold text-primary-foreground tracking-wide uppercase">✓ Best Price</span>
      </div>

      {/* Card body — blurred when locked */}
      <div className={`p-5 flex flex-col h-full select-none ${isLocked ? "blur-sm pointer-events-none" : ""}`}>
        {/* Image — centered, no rank number */}
        <div className="flex justify-center mb-4">
          {result.imageUrl ? (
            <img
              src={result.imageUrl}
              alt={result.title}
              className="w-20 h-20 object-contain rounded-xl bg-muted/20"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
            />
          ) : (
            <div className="w-20 h-20 rounded-xl bg-muted/40 border flex items-center justify-center">
              <span className="text-2xl font-bold text-muted-foreground/30 select-none">
                {result.retailer.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>

        {/* Middle content — grows to fill space */}
        <div className="flex-1 flex flex-col gap-2">
          {/* Badges */}
          <div className="flex flex-wrap items-center gap-1.5 min-h-[20px]">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{result.retailer}</span>
            <ConditionBadge condition={result.condition} />
            {result.availability === "Out of Stock" && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-destructive/10 text-destructive border border-destructive/20">
                Out of Stock
              </span>
            )}
          </div>

          {/* Title — always 2 lines */}
          <p className="text-sm font-semibold leading-snug line-clamp-2 min-h-[40px] text-foreground">{result.title}</p>

          {/* Deal Score — fixed height */}
          <div className="h-5">
            <SparkScoreStars score={score} />
          </div>

          {/* Description — 3 lines max, no clipping words mid-sentence */}
          <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-3 min-h-[48px]">
            {result.description ?? ""}
          </p>
        </div>

        {/* Price — fixed position above button */}
        <div className="mt-4">
          {result.price !== null ? (
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-2xl font-semibold text-foreground">
                {formatPrice(result.price, result.currency)}
              </span>
              {hasDiscount && (
                <>
                  <span className="text-sm text-muted-foreground line-through">
                    {formatPrice(result.originalPrice!, result.currency)}
                  </span>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">-{discount}%</span>
                </>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>Price not available</span>
            </div>
          )}

          {/* CTA — always at bottom */}
          {!isLocked && (
            <a href={result.url} target="_blank" rel="noopener noreferrer" className="block">
              <button className="w-full px-4 py-2.5 bg-foreground text-background rounded-xl text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity">
                View deal
                <ExternalLink className="w-4 h-4" />
              </button>
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Loading animation ─────────────────────────────────────────────
type LivePhase = { phase: string; status: string; done?: number; total?: number } | null

const PHASE_DEFS = [
  { key: "web-search", icon: Search,   label: "Web Search" },
  { key: "scraping",   icon: Globe,    label: "Scraping Pages" },
  { key: "vision",     icon: Eye,      label: "Vision AI" },
  { key: "finalizing", icon: Sparkles, label: "Finalizing" },
] as const

// Map a live SSE phase event → which visual phase index is active
function liveToActiveIdx(lp: LivePhase): number {
  if (!lp) return 0
  if (lp.phase === "web-search") return 0
  if (lp.phase === "scraping") {
    const pct = (lp.done ?? 0) / Math.max(lp.total ?? 1, 1)
    return pct >= 0.55 ? 2 : 1   // switch to "Vision AI" row when >55% sites scraped
  }
  if (lp.phase === "finalizing") return 3
  return 0
}

// Format elapsed seconds → "42s" or "1 min 22s"
function formatElapsed(s: number) {
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  return rem > 0 ? `${m} min ${rem}s` : `${m} min`
}

function SearchingState({ query, livePhase }: { query: string; livePhase: LivePhase }) {
  const [elapsed, setElapsed] = useState(0)
  // Wall-clock timestamps for when each phase became active
  const phaseStartedAt = useRef<Record<number, number>>({})

  useEffect(() => {
    const start = Date.now()
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 500)
    return () => clearInterval(t)
  }, [])

  const activeIdx = liveToActiveIdx(livePhase)

  // Record wall-clock start of each phase (once, on first activation)
  useEffect(() => {
    if (!(activeIdx in phaseStartedAt.current)) {
      phaseStartedAt.current[activeIdx] = Date.now()
    }
  }, [activeIdx])

  // Detail text shown under the active phase row
  function getDetail(idx: number): string {
    if (idx === 0) return "Searching marketplaces and classifieds globally…"
    if (idx === 1) {
      if (livePhase?.phase === "scraping" && livePhase.total) {
        return `Scraping site ${livePhase.done ?? 0} of ${livePhase.total}…`
      }
      return "Opening listing pages and extracting data…"
    }
    if (idx === 2) return "AI reading screenshots to extract prices…"
    return "Ranking results by best price…"
  }

  // Per-phase elapsed (seconds since that phase started)
  function phaseElapsed(idx: number): number {
    const startedAt = phaseStartedAt.current[idx]
    if (!startedAt) return 0
    const endedAt = phaseStartedAt.current[idx + 1] ?? Date.now()
    return Math.floor((endedAt - startedAt) / 1000)
  }

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
        {PHASE_DEFS.map((phase, idx) => {
          const Icon      = phase.icon
          const isDone    = idx < activeIdx
          const isActive  = idx === activeIdx
          const isPending = idx > activeIdx
          const secs      = phaseElapsed(idx)

          return (
            <div
              key={phase.key}
              className={`flex items-center gap-3 rounded-xl px-4 py-2.5 border transition-all ${
                isActive  ? "border-primary/40 bg-primary/5 text-foreground"
                : isDone  ? "border-emerald-500/20 bg-emerald-500/5 text-muted-foreground"
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
                    {getDetail(idx)}
                  </p>
                )}
              </div>

              {/* Per-phase timer */}
              {(isActive || isDone) && secs > 0 && (
                <span className={`text-[11px] font-mono shrink-0 tabular-nums ${
                  isDone ? "text-emerald-600 dark:text-emerald-400" : "text-primary"
                }`}>
                  {formatElapsed(secs)}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Total elapsed */}
      <p className="text-xs text-muted-foreground/60 font-mono tabular-nums">
        {formatElapsed(elapsed)} elapsed · up to 4 min for full results
      </p>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────
export function B2CDiscoveryContent({ onNavigate, selectedHistoryEntry, onClearHistory, onSearchComplete }: { onNavigate?: (page: string) => void; selectedHistoryEntry?: any; onClearHistory?: () => void; onSearchComplete?: () => void }) {
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
  const [correctedQuery, setCorrectedQuery]   = useState<string | null>(null)
  const [searchError, setSearchError]         = useState<string | null>(null)
  const [batch, setBatch]                     = useState(3)  // 1=Quick, 2=Standard, 3=Deep
  const [activeCategory, setActiveCategory]   = useState<string | null>(null)
  const [shownSuggestions, setShownSuggestions] = useState<string[]>([])
  const [isHistoryView, setIsHistoryView]     = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [livePhase, setLivePhase]             = useState<LivePhase>(null)
  const [unlockModalResult, setUnlockModalResult] = useState<B2CResult | null>(null)
  const [revealedUrls, setRevealedUrls]       = useState<Set<string>>(new Set())
  const [unlocking, setUnlocking]             = useState<"single" | "all" | null>(null)
  const [collapsedStores, setCollapsedStores] = useState<Set<string>>(new Set())

  const BATCH_OPTIONS = [
    { value: 1, label: "Quick",    sites: "3 sites",  time: "~30s",   credits: 1 },
    { value: 2, label: "Standard", sites: "6 sites",  time: "~1 min", credits: 2 },
    { value: 3, label: "Deep",     sites: "10 sites", time: "~3 min", credits: 3 },
  ]

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
          fetch(`${API}/api/wallet`,           { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API}/api/allowed-users/me`, { headers: { Authorization: `Bearer ${token}` } }),
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

  // When a history entry is selected from the sidebar, briefly show skeleton then load results
  useEffect(() => {
    if (!selectedHistoryEntry) return
    const entry = selectedHistoryEntry
    setIsLoadingHistory(true)
    setPhase("results")
    const t = setTimeout(() => {
      setResults(entry.results || [])
      setLastQuery(entry.query || "")
      setCorrectedQuery(null)
      setSearchError(null)
      setQuery(entry.query || "")
      setVisibleLimit(20)
      setIsHistoryView(true)
      setIsLoadingHistory(false)
      onClearHistory?.()
    }, 400)
    return () => clearTimeout(t)
  }, [selectedHistoryEntry])

  async function handleSearch() {
    const q = query.trim()
    if (!q || phase === "searching") return

    setPhase("searching")
    setLivePhase(null)
    setIsHistoryView(false)
    setSearchError(null)
    setResults([])
    setRevealedUrls(new Set())
    setCorrectedQuery(null)
    setLastQuery(q)

    const controller = new AbortController()
    const timeoutId  = setTimeout(() => controller.abort(), 240_000)

    try {
      const token = await getToken()
      const res = await fetch(`${API}/api/discovery/b2c-search`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body:    JSON.stringify({ query: q, batch }),
        signal:  controller.signal,
      })
      clearTimeout(timeoutId)

      // Pre-flight errors (auth, credits) come back as regular JSON before SSE starts
      if (!res.ok) {
        const json = await res.json()
        if (json.error?.code === "USAGE_LIMIT_REACHED") {
          onNavigate?.("plans")
          setPhase("idle")
          return
        }
        throw new Error(json.error?.message || "Search failed")
      }

      // Stream SSE events
      const reader  = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer    = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          try {
            const event = JSON.parse(line.slice(6))
            if (event.type === "phase") {
              setLivePhase({ phase: event.phase, status: event.status, done: event.done, total: event.total })
            } else if (event.type === "done") {
              const data = event.data
              setResults(data.results || [])
              setVisibleLimit(data.limit ?? 3)
              setCorrectedQuery(data.correctedQuery ?? null)
              setLastQuery(data.query || q)
              setBalance((prev) => prev !== null ? Math.max(0, prev - (data.credits ?? batch)) : null)
              setPhase("results")
              onSearchComplete?.()
            } else if (event.type === "error") {
              throw new Error(event.error?.message || "Search failed")
            }
          } catch (parseErr: any) {
            if (parseErr.message && !parseErr.message.includes("JSON")) throw parseErr
          }
        }
      }
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

  if (loading) return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 px-2 py-12 animate-pulse">
      {/* Hero: mascot + title */}
      <div className="w-full max-w-2xl">
        <div className="flex items-center gap-4 mb-4">
          <div className="h-24 w-24 rounded-full bg-muted shrink-0" />
          <div className="space-y-2">
            <div className="h-3 w-28 rounded bg-muted" />
            <div className="h-9 w-36 rounded bg-muted" />
          </div>
        </div>
        <div className="h-4 w-96 rounded bg-muted" />
      </div>

      {/* Search box */}
      <div className="w-full max-w-2xl bg-card rounded-2xl shadow-lg border overflow-hidden">
        {/* Textarea area */}
        <div className="flex items-start gap-3 px-6 pt-6 pb-4">
          <div className="h-5 w-5 rounded bg-muted mt-1 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-full rounded bg-muted" />
            <div className="h-4 w-3/4 rounded bg-muted" />
            <div className="h-4 w-1/2 rounded bg-muted" />
          </div>
        </div>
        {/* Depth selector */}
        <div className="mx-6 mb-4 border border-border rounded-xl overflow-hidden">
          <div className="grid grid-cols-3 divide-x divide-border">
            {["Quick", "Standard", "Deep"].map((_, i) => (
              <div key={i} className={`py-3 flex flex-col items-center gap-1 ${i === 2 ? "bg-muted" : ""}`}>
                <div className="h-3 w-12 rounded bg-muted" />
                <div className="h-2.5 w-20 rounded bg-muted/60" />
              </div>
            ))}
          </div>
        </div>
        {/* Bottom bar */}
        <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-4">
          <div className="h-4 w-36 rounded bg-muted" />
          <div className="h-10 w-28 rounded-xl bg-muted" />
        </div>
      </div>

      {/* Category chips */}
      <div className="flex flex-wrap gap-2 justify-center w-full max-w-2xl">
        {[96, 64, 80, 64, 112].map((w, i) => (
          <div key={i} className="h-9 rounded-full bg-muted" style={{ width: w }} />
        ))}
      </div>
    </div>
  )

  const isUnlimited   = UNLIMITED_ROLES.includes(userProfile?.role ?? "")

  const canSearch     = isUnlimited || (balance !== null && balance >= batch)
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

  // ── Category suggestion pools ─────────────────────────────────
  const CATEGORIES = [
    {
      id: "electronics",
      label: "Electronics",
      emoji: "📱",
      pool: [
        "iPhone 16 Pro Max 256GB", "Samsung Galaxy S25 Ultra", "Sony WH-1000XM5",
        "MacBook Air M3 15 inch", "iPad Pro M4", "AirPods Pro 2nd gen",
        "DJI Mini 4 Pro drone", "PS5 console", "Xbox Series X",
        "Canon EOS R50 camera", "Apple Watch Series 10", "Dyson V15 vacuum",
        "Samsung 65 inch OLED TV", "Bose QuietComfort 45", "GoPro Hero 13",
      ],
    },
    {
      id: "cars",
      label: "Cars",
      emoji: "🚗",
      pool: [
        "Infiniti G37 S Coupe 2010", "Toyota Camry 2022", "BMW 3 Series 2021",
        "Mercedes C200 2020", "Honda Civic 2023", "Nissan Patrol 2022",
        "Ford Mustang GT 2021", "Audi A4 2021", "Kia Sportage 2023",
        "Hyundai Tucson 2022", "Range Rover Sport 2020", "Porsche Cayenne 2021",
        "Toyota Land Cruiser 2022", "Lexus ES 350 2022", "Volkswagen Golf GTI 2022",
      ],
    },
    {
      id: "fashion",
      label: "Fashion",
      emoji: "👟",
      pool: [
        "Nike Air Force 1 white", "Adidas Ultraboost 22", "New Balance 990v5",
        "Zara puffer jacket", "Levi's 501 jeans", "Ray-Ban Aviator sunglasses",
        "Louis Vuitton Neverfull MM", "Gucci Marmont bag", "Nike Dunk Low",
        "Jordan 1 Retro High OG", "Rolex Submariner", "Omega Seamaster",
        "Canada Goose jacket", "Moncler vest", "Balenciaga Triple S",
      ],
    },
    {
      id: "home",
      label: "Home",
      emoji: "🏠",
      pool: [
        "IKEA MALM bed frame", "Philips Hue smart bulbs", "Nespresso Vertuo",
        "KitchenAid stand mixer", "Dyson Airwrap", "Instant Pot 7-in-1",
        "Weber BBQ grill", "Roomba i7 robot vacuum", "LG French door fridge",
        "Bosch dishwasher", "Samsung washing machine", "Vitamix blender",
        "Breville espresso machine", "Air purifier HEPA", "Nest thermostat",
      ],
    },
    {
      id: "food",
      label: "Food & Health",
      emoji: "🛒",
      pool: [
        "Marvis Classic Whitening Toothpaste 75ml", "Optimum Nutrition whey protein",
        "Manuka honey UMF 20", "Nescafe Gold 200g", "Lipton green tea",
        "Centrum multivitamin", "Omega 3 fish oil capsules", "Collagen powder",
        "Protein bars variety pack", "Medjool dates 1kg",
        "Lavazza espresso beans", "Himalayan pink salt", "Chia seeds organic",
      ],
    },
  ]

  function pickSuggestions(categoryId: string) {
    const cat = CATEGORIES.find(c => c.id === categoryId)
    if (!cat) return
    const shuffled = [...cat.pool].sort(() => Math.random() - 0.5)
    setShownSuggestions(shuffled.slice(0, 4))
    setActiveCategory(prev => prev === categoryId ? null : categoryId)
  }

  const renderSearchBox = (compact: boolean = false) => (
      <div className={`bg-card rounded-2xl shadow-lg border border-border overflow-hidden ${compact ? "p-0" : ""}`}>
        {/* Input area */}
        <div className={compact ? "flex items-center gap-2 px-4 py-3" : "flex items-start gap-3 px-6 pt-6 pb-4"}>
          <Sparkles className={`text-muted-foreground/50 shrink-0 ${compact ? "h-4 w-4 mt-0.5" : "h-5 w-5 mt-1"}`} />
          <Textarea
            ref={compact ? undefined : textareaRef}
            autoFocus={!compact}
            rows={compact ? 1 : 3}
            className={`resize-none border-0 shadow-none focus-visible:ring-0 bg-transparent p-0 placeholder:text-muted-foreground/40 ${compact ? "text-sm" : "text-base"}`}
            placeholder={compact ? "Search again…" : "Ask away, I'm all ears..."}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSearch() }}
          />
        </div>

        {/* Batch selector */}
        {!compact && (
          <div className={`mx-6 mb-4 border border-border rounded-xl overflow-hidden`}>
            <div className="grid grid-cols-3 divide-x divide-border">
              {BATCH_OPTIONS.map((opt) => {
                const active = batch === opt.value
                return (
                  <button
                    key={opt.value}
                    onClick={() => setBatch(opt.value)}
                    className={`relative flex flex-col items-center justify-center gap-0.5 py-3 transition-all ${
                      active
                        ? "bg-foreground text-background"
                        : "bg-transparent text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                    }`}
                  >
                    <span className={`text-[13px] font-bold tracking-tight`}>{opt.label}</span>
                    <span className={`text-[10px] ${active ? "opacity-60" : "opacity-50"}`}>
                      {opt.sites} · {opt.time} · {opt.credits} cr
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Bottom bar */}
        <div className={`flex items-center justify-between gap-3 border-t border-border ${compact ? "px-4 py-2.5" : "px-6 py-4"}`}>
          <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
            {!isUnlimited && (
              <span className={`font-medium ${!canSearch ? "text-destructive" : "text-foreground"}`}>
                {balance !== null
                  ? canSearch ? `${balance} credits remaining` : `${balance} credits — need ${batch}`
                  : "Loading…"}
              </span>
            )}
            {isUnlimited && <span className="font-medium text-primary">Unlimited credits</span>}
            {!compact && <span className="hidden sm:inline opacity-50">Web · Scrape · Vision AI</span>}
          </div>
          <button
            onClick={handleSearch}
            disabled={!query.trim() || !canSearch}
            className={`flex items-center gap-2 font-medium rounded-xl shrink-0 transition-colors
              ${compact ? "text-sm px-4 py-1.5" : "px-5 py-2.5"}
              ${!query.trim() || !canSearch
                ? "bg-muted text-muted-foreground cursor-not-allowed"
                : "bg-foreground text-background hover:opacity-90"
              }`}
          >
            <Sparkles className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
            {canSearch
              ? <>{compact ? "Search" : "Search"} <span className="opacity-50 font-normal">· {isUnlimited ? "∞" : batch} cr</span></>
              : "No credits · Upgrade"
            }
          </button>
        </div>
        {searchError && (
          <div className="border-t bg-destructive/5 text-destructive text-sm px-5 py-3 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />{searchError}
          </div>
        )}
        {!canSearch && !isUnlimited && (
          <div className="border-t bg-amber-500/5 text-amber-700 dark:text-amber-400 text-sm px-5 py-3 flex items-center justify-between gap-3">
            <span>You need 3 credits per search.</span>
            <Button size="sm" variant="outline" className="shrink-0" onClick={() => onNavigate?.("plans")}>
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />Upgrade
            </Button>
          </div>
        )}
      </div>
  )

  return (
    <div className="flex flex-col">

      {/* ── IDLE: centered like Claude / ChatGPT ── */}
      {phase === "idle" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-2 py-12">

          {/* Hero — left-aligned like image 2 */}
          <div className="w-full max-w-2xl">
            <div className="flex items-center gap-4 mb-4">
              <img src="/spark-logo.gif" alt="Spark AI" className="h-24 w-24 object-contain drop-shadow-md shrink-0" />
              <div>
                <p className="text-xs font-semibold text-primary tracking-widest uppercase mb-0.5">Price Discovery</p>
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight">Spark AI</h1>
              </div>
            </div>
            <p className="text-muted-foreground text-base">
              Search any product — AI finds the best prices across every marketplace worldwide
            </p>
          </div>

          <div className="w-full max-w-2xl">
            {renderSearchBox()}
          </div>

          {/* Category chips + dropdown suggestions */}
          <div className="flex flex-col items-center gap-3 w-full max-w-2xl">
            {/* Category row */}
            <div className="flex flex-wrap gap-2 justify-center">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => pickSuggestions(cat.id)}
                  className={`px-6 py-2.5 rounded-full border text-sm font-medium shadow-sm transition-all ${
                    activeCategory === cat.id
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-card text-muted-foreground hover:border-foreground/40 hover:text-foreground hover:bg-muted/30"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Dropdown panel — Claude.ai style */}
            {activeCategory && shownSuggestions.length > 0 && (
              <div className="w-full rounded-2xl border bg-card shadow-lg overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {CATEGORIES.find(c => c.id === activeCategory)?.label}
                  </span>
                  <button
                    onClick={() => { setActiveCategory(null); setShownSuggestions([]) }}
                    className="p-1 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>

                {/* Vertical list — Claude.ai style */}
                <div className="divide-y divide-border">
                  {shownSuggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => { setQuery(s); setActiveCategory(null); setShownSuggestions([]) }}
                      className="w-full text-left px-4 py-3 bg-card hover:bg-muted/50 transition-colors text-sm text-foreground"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>
      )}

      {/* ── SEARCHING: centered ── */}
      {phase === "searching" && (
        <div className="flex-1 flex items-center justify-center">
          <SearchingState query={lastQuery} livePhase={livePhase} />
        </div>
      )}

      {/* ── RESULTS ── */}
      {phase === "results" && isLoadingHistory && (
        <div className="space-y-4 py-2 animate-pulse">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1.5">
              <div className="h-4 w-56 rounded bg-muted" />
              <div className="h-3 w-40 rounded bg-muted" />
            </div>
            <div className="h-8 w-24 rounded-lg bg-muted shrink-0" />
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl border bg-card p-4 flex items-start gap-4">
              <div className="flex flex-col items-center gap-2 shrink-0">
                <div className="h-4 w-6 rounded bg-muted" />
                <div className="h-14 w-14 rounded-lg bg-muted" />
              </div>
              <div className="flex-1 space-y-2">
                <div className="h-3 w-24 rounded bg-muted" />
                <div className="h-4 w-full rounded bg-muted" />
                <div className="h-4 w-3/4 rounded bg-muted" />
                <div className="h-6 w-28 rounded bg-muted" />
              </div>
              <div className="h-8 w-20 rounded-xl bg-muted shrink-0" />
            </div>
          ))}
        </div>
      )}

      {phase === "results" && !isLoadingHistory && (
        <div className="space-y-4 py-2">
          {correctedQuery && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-sm">
              <span className="text-amber-600 dark:text-amber-400">✦</span>
              <span className="text-amber-800 dark:text-amber-300">
                Searched for <span className="font-semibold">"{correctedQuery}"</span> — we fixed your query automatically.
              </span>
            </div>
          )}

          {/* Header */}
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">
                {results.length === 0
                  ? `No results found for "${lastQuery}"`
                  : `${results.length} result${results.length !== 1 ? "s" : ""} for "${lastQuery}"`}
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

          {/* Retailer groups — horizontal scroll cards */}
          {retailerGroups.map((group, groupIdx) => {
            const isCollapsed = collapsedStores.has(group.retailer)

            return (
              <section
                key={group.retailer}
                className="rounded-2xl border border-gray-200/70 dark:border-border bg-card shadow-sm overflow-hidden"
              >
                {/* Group header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200/60 dark:border-border bg-muted/30">
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm font-semibold tracking-tight">{group.retailer}</span>
                    <span className="text-xs text-muted-foreground">{group.items.length} listing{group.items.length !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-muted-foreground">
                      from {group.items[0].currency} {group.lowestPrice.toLocaleString("en-AE", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </span>
                    <button
                      onClick={() => setCollapsedStores(prev => {
                        const next = new Set(prev)
                        next.has(group.retailer) ? next.delete(group.retailer) : next.add(group.retailer)
                        return next
                      })}
                      className="w-7 h-7 rounded-lg border border-border bg-background flex items-center justify-center hover:bg-muted transition-colors"
                    >
                      {isCollapsed
                        ? <Plus className="w-4 h-4" />
                        : <X className="w-4 h-4" />
                      }
                    </button>
                  </div>
                </div>

                {/* Horizontal scroll row */}
                {!isCollapsed && (
                  <div className="relative">
                    {/* Right fade gradient */}
                    <div className="absolute top-0 right-0 bottom-0 w-20 bg-gradient-to-l from-card via-card/70 to-transparent pointer-events-none z-10" />
                    <div className="overflow-x-auto scrollbar-hide">
                      <div className="flex items-stretch gap-4 p-5" style={{ paddingRight: "80px" }}>
                        {group.items.map((result, itemIdx) => {
                          const isLocked = itemIdx > 0 && !revealedUrls.has(result.url)
                          return (
                            <PriceCard
                              key={result.url}
                              result={result}
                              isBest={groupIdx === 0 && itemIdx === 0}
                              allResults={results}
                              isLocked={isLocked}
                              onLockedClick={() => setUnlockModalResult(result)}
                            />
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </section>
            )
          })}

          {/* Bottom search bar */}
          {!isHistoryView && (
            <div className="pt-4 pb-2 max-w-2xl mx-auto w-full">
              {renderSearchBox(true)}
            </div>
          )}
        </div>
      )}

      {/* Unlock modal */}
      {unlockModalResult && (() => {
        const storeItems   = retailerGroups.find(g => g.retailer === unlockModalResult.retailer)?.items ?? []
        const lockedInStore = storeItems.filter((r, i) => i > 0 && !revealedUrls.has(r.url))
        const isUnlimitedUser = UNLIMITED_ROLES.includes(userProfile?.role ?? "")

        async function doUnlock(urls: string[], creditCost: number, which: "single" | "all") {
          setUnlocking(which)
          try {
            const token = await getToken()
            if (!isUnlimitedUser && creditCost > 0) {
              const res  = await fetch(`${API}/api/wallet/deduct`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify({ amount: creditCost, description: `Unlocked ${creditCost} search result${creditCost > 1 ? "s" : ""}` }),
              })
              const json = await res.json()
              if (!json.success) { onNavigate?.("plans"); setUnlockModalResult(null); setUnlocking(null); return }
              setBalance(json.data.balance)
            }
            setRevealedUrls(prev => { const next = new Set(prev); urls.forEach(u => next.add(u)); return next })
            setUnlockModalResult(null)
          } catch { /* silent */ }
          finally { setUnlocking(null) }
        }

        return (
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setUnlockModalResult(null)}
          >
            <div
              className="bg-card rounded-2xl shadow-2xl max-w-sm w-full p-8 relative"
              onClick={e => e.stopPropagation()}
            >
              <button onClick={() => setUnlockModalResult(null)} className="absolute top-5 right-5 text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-5 h-5" />
              </button>

              {/* Header */}
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-5">
                  <Lock className="w-7 h-7 text-foreground" />
                </div>
                <h3 className="text-2xl font-semibold mb-1">Unlock Offer</h3>
                <p className="text-sm text-muted-foreground">Use 1 credit to reveal this offer</p>
                <p className="text-sm text-muted-foreground mt-1">This offer may have better pricing or availability</p>
                {lockedInStore.length > 1 && (
                  <p className="text-sm font-semibold mt-2">
                    {lockedInStore.length - 1} more {lockedInStore.length - 1 === 1 ? "offer" : "offers"} available from {unlockModalResult.retailer}
                  </p>
                )}
              </div>

              {/* Product preview — intentionally redacted (locked content) */}
              <div className="bg-muted/40 rounded-xl p-4 mb-6 flex items-center gap-4 border border-border/50">
                <div className="w-16 h-16 rounded-lg bg-muted shrink-0 flex items-center justify-center overflow-hidden">
                  {unlockModalResult.imageUrl
                    ? <img src={unlockModalResult.imageUrl} alt="" className="w-full h-full object-contain blur-md scale-110" />
                    : <span className="text-xl font-bold text-muted-foreground/40">{unlockModalResult.retailer[0]}</span>
                  }
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="h-3 rounded-full bg-muted-foreground/20 w-full" />
                  <div className="h-3 rounded-full bg-muted-foreground/20 w-3/4" />
                  <div className="h-4 rounded-full bg-muted-foreground/15 w-1/2 mt-1" />
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2.5">
                <button
                  onClick={() => doUnlock([unlockModalResult.url], 1, "single")}
                  disabled={!!unlocking || (!isUnlimitedUser && (balance ?? 0) < 1)}
                  className="w-full py-3.5 bg-foreground text-background rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {unlocking === "single" ? (
                    <><span className="w-4 h-4 border-2 border-background/40 border-t-background rounded-full animate-spin" />Unlocking…</>
                  ) : "Unlock with 1 Credit"}
                </button>

                {lockedInStore.length > 1 && (
                  <button
                    onClick={() => doUnlock(lockedInStore.map(r => r.url), lockedInStore.length, "all")}
                    disabled={!!unlocking || (!isUnlimitedUser && (balance ?? 0) < lockedInStore.length)}
                    className="w-full py-3.5 border-2 border-foreground text-foreground rounded-xl font-semibold text-sm hover:bg-muted/50 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {unlocking === "all" ? (
                      <><span className="w-4 h-4 border-2 border-foreground/40 border-t-foreground rounded-full animate-spin" />Unlocking…</>
                    ) : `Unlock all ${lockedInStore.length} offers (${lockedInStore.length} Credits)`}
                  </button>
                )}

                <button onClick={() => setUnlockModalResult(null)} className="w-full py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Cancel
                </button>
              </div>

              <p className="text-center text-sm text-muted-foreground mt-5">
                You have {balance ?? 0} {(balance ?? 0) === 1 ? "credit" : "credits"} available
              </p>
            </div>
          </div>
        )
      })()}

    </div>
  )
}
