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
// Phase timings (seconds from start) — match actual backend pipeline
const PHASES = [
  { key: "web-search", icon: Search,   label: "Web Search",    detail: "Searching marketplaces and classifieds globally…", startAt: 0,   doneAt: 20  },
  { key: "scraping",   icon: Globe,    label: "Scraping Pages", detail: "Opening listing pages and extracting data…",       startAt: 20,  doneAt: 90  },
  { key: "vision",     icon: Eye,      label: "Vision AI",      detail: "AI reading screenshots to extract prices…",        startAt: 90,  doneAt: 150 },
  { key: "sorting",    icon: Sparkles, label: "Finalizing",     detail: "Ranking results by best price…",                   startAt: 150, doneAt: 999 },
] as const

// Format elapsed seconds → "42s" or "1 min 22s"
function formatElapsed(s: number) {
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  return rem > 0 ? `${m} min ${rem}s` : `${m} min`
}

function SearchingState({ query }: { query: string }) {
  const [elapsed, setElapsed]               = useState(0)
  // Track when each phase started (to show per-phase time)
  const [phaseStart, setPhaseStart]         = useState<Record<number, number>>({ 0: 0 })
  const prevActiveIdx                       = useState(-1)

  useEffect(() => {
    const start = Date.now()
    const t = setInterval(() => {
      const secs = Math.floor((Date.now() - start) / 1000)
      setElapsed(secs)
    }, 500)
    return () => clearInterval(t)
  }, [])

  const reversedIdx = [...PHASES].reverse().findIndex((p: typeof PHASES[number]) => elapsed >= p.startAt)
  const activeIdx   = reversedIdx === -1 ? 0 : PHASES.length - 1 - reversedIdx
  const activePhase = PHASES[activeIdx] ?? PHASES[0]

  // Record when each phase becomes active
  useEffect(() => {
    if (activeIdx >= 0 && !(activeIdx in phaseStart)) {
      setPhaseStart(prev => ({ ...prev, [activeIdx]: elapsed }))
    }
  }, [activeIdx])

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
          const Icon      = phase.icon
          const isDone    = elapsed >= phase.doneAt
          const isActive  = idx === activeIdx
          const isPending = idx > activeIdx
          // Time spent in this phase
          const phaseElapsed = isActive
            ? elapsed - (phaseStart[idx] ?? elapsed)
            : isDone
            ? (phaseStart[idx + 1] ?? elapsed) - (phaseStart[idx] ?? 0)
            : 0

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
                    {activePhase.detail}
                  </p>
                )}
              </div>

              {/* Timer — show for active and done phases */}
              {(isActive || isDone) && phaseElapsed > 0 && (
                <span className={`text-[11px] font-mono shrink-0 tabular-nums ${
                  isDone ? "text-emerald-600 dark:text-emerald-400" : "text-primary"
                }`}>
                  {formatElapsed(phaseElapsed)}
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
export function B2CDiscoveryContent({ onNavigate, selectedHistoryEntry, onClearHistory }: { onNavigate?: (page: string) => void; selectedHistoryEntry?: any; onClearHistory?: () => void }) {
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
  const [history, setHistory]                 = useState<any[]>([])
  const [openHistoryId, setOpenHistoryId]     = useState<number | null>(null)
  const [isHistoryView, setIsHistoryView]     = useState(false)

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
        const [walletRes, meRes, histRes] = await Promise.all([
          fetch(`${API}/api/wallet`,                  { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API}/api/allowed-users/me`,        { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API}/api/discovery/b2c-history`,   { headers: { Authorization: `Bearer ${token}` } }),
        ])
        const [walletJson, meJson, histJson] = await Promise.all([walletRes.json(), meRes.json(), histRes.json()])
        if (!cancelled) {
          if (walletJson.success) setBalance(walletJson.data?.wallet?.balance ?? 0)
          if (meJson.success && meJson.data) setUserProfile(meJson.data)
          if (histJson.success) {
            const parsed = (histJson.data || []).map((e: any) => ({
              ...e,
              results: typeof e.results === "string" ? JSON.parse(e.results) : e.results,
            }))
            setHistory(parsed)
            if (parsed.length > 0) setOpenHistoryId(parsed[0].id)
          }
        }
      } catch { /* silent */ }
      if (!cancelled) setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [user])

  // When a history entry is selected from the sidebar, load it directly as results
  useEffect(() => {
    if (!selectedHistoryEntry) return
    const entry = selectedHistoryEntry
    setResults(entry.results || [])
    setLastQuery(entry.query || "")
    setCorrectedQuery(null)
    setSearchError(null)
    setQuery(entry.query || "")
    setVisibleLimit(20)
    setIsHistoryView(true)
    setPhase("results")
    onClearHistory?.()
  }, [selectedHistoryEntry])

  async function handleSearch() {
    const q = query.trim()
    if (!q || phase === "searching") return

    setPhase("searching")
    setIsHistoryView(false)
    setSearchError(null)
    setResults([])
    setCorrectedQuery(null)
    setLastQuery(q)

    const controller = new AbortController()
    const timeoutId  = setTimeout(() => controller.abort(), 240_000)  // 4 min — backend can take 3min for 10 sites

    try {
      const token = await getToken()
      const res = await fetch(`${API}/api/discovery/b2c-search`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body:    JSON.stringify({ query: q, batch }),
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
      setCorrectedQuery(data.correctedQuery ?? null)
      setLastQuery(data.query || q)
      setBalance((prev) => prev !== null ? Math.max(0, prev - (data.credits ?? batch)) : null)
      setPhase("results")
      // Refresh history so the new search appears in the list
      try {
        const t2 = await getToken()
        const hr = await fetch(`${API}/api/discovery/b2c-history`, { headers: { Authorization: `Bearer ${t2}` } })
        const hj = await hr.json()
        if (hj.success) {
          const ph = (hj.data || []).map((e: any) => ({ ...e, results: typeof e.results === "string" ? JSON.parse(e.results) : e.results }))
          setHistory(ph)
          if (ph.length > 0) setOpenHistoryId(ph[0].id)
        }
      } catch { /* best-effort */ }
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
    <div className="flex flex-col min-h-[calc(100vh-80px)]">

      {/* ── IDLE: centered like Claude / ChatGPT ── */}
      {phase === "idle" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-2 py-12">

          {/* Hero — left-aligned like image 2 */}
          <div className="w-full max-w-2xl">
            <div className="flex items-center gap-4 mb-4">
              <img src="/spark-logo.gif" alt="Spark AI" className="h-14 w-14 object-contain drop-shadow-md shrink-0" />
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

          {/* ── History on idle screen ── */}
          {history.length > 0 && (
            <div className="w-full max-w-2xl pt-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2 px-1">
                Recent searches
              </p>
              <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-lg divide-y divide-border">
                {history.slice(0, 3).map((entry) => {
                  const isOpen   = openHistoryId === entry.id
                  const cheapest = entry.results.reduce((best: any, r: any) =>
                    r.price !== null && (best === null || r.price < best.price) ? r : best, null)
                  const fmtTime  = (() => {
                    const d = new Date(entry.searched_at)
                    const now = new Date()
                    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000)
                    const h = d.getHours(), min = String(d.getMinutes()).padStart(2, "0")
                    const ampm = h >= 12 ? "pm" : "am", h12 = h % 12 || 12
                    if (diffDays === 0 && now.getDate() === d.getDate()) return `${h12}:${min} ${ampm}`
                    if (diffDays < 2) return `Yesterday ${h12}:${min} ${ampm}`
                    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
                  })()

                  return (
                    <div key={entry.id}>
                      <button
                        onClick={() => setOpenHistoryId(isOpen ? null : entry.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30 ${isOpen ? "bg-muted/20" : ""}`}
                      >
                        <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${isOpen ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                          <Search className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{entry.query}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] text-muted-foreground">{entry.result_count} result{entry.result_count !== 1 ? "s" : ""}</span>
                            {cheapest && <span className="text-[11px] font-semibold text-primary">Best: {cheapest.currency} {cheapest.price?.toLocaleString()}</span>}
                          </div>
                        </div>
                        <span className="text-[11px] text-muted-foreground shrink-0">{fmtTime}</span>
                        <span className="text-muted-foreground/40 text-xs">{isOpen ? "▲" : "▼"}</span>
                      </button>

                      {isOpen && (
                        <div className="bg-muted/10 border-t divide-y">
                          {entry.results.slice(0, 5).map((r: any, i: number) => {
                            const isBest = r === cheapest
                            return (
                              <div key={r.url} className={`flex items-center gap-3 px-5 py-3 ${isBest ? "bg-primary/5" : ""}`}>
                                <span className="text-xs font-bold text-muted-foreground/40 w-5 shrink-0 text-center">#{i + 1}</span>
                                {r.imageUrl ? (
                                  <img src={r.imageUrl} alt={r.title} className="w-9 h-9 rounded-lg object-contain bg-muted/30 border shrink-0"
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
                                ) : (
                                  <div className="w-9 h-9 rounded-lg bg-muted/40 border flex items-center justify-center shrink-0">
                                    <span className="text-xs font-bold text-muted-foreground/40">{r.retailer?.charAt(0)}</span>
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold text-muted-foreground">{r.retailer}</p>
                                  <p className="text-xs text-muted-foreground truncate">{r.title}</p>
                                </div>
                                <span className={`text-sm font-bold shrink-0 mr-1 ${isBest ? "text-primary" : ""}`}>
                                  {r.currency} {r.price?.toLocaleString()}
                                </span>
                                <a href={r.url} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                                </a>
                              </div>
                            )
                          })}
                          {entry.results.length > 5 && (
                            <p className="text-[11px] text-muted-foreground px-5 py-2">+{entry.results.length - 5} more in Price Activity</p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── SEARCHING: centered ── */}
      {phase === "searching" && (
        <div className="flex-1 flex items-center justify-center">
          <SearchingState query={lastQuery} />
        </div>
      )}

      {/* ── RESULTS ── */}
      {phase === "results" && (
        <div className="space-y-4 py-2">
          {correctedQuery && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-sm">
              <span className="text-amber-600 dark:text-amber-400">✦</span>
              <span className="text-amber-800 dark:text-amber-300">
                Searched for <span className="font-semibold">"{correctedQuery}"</span> — we fixed your query automatically.
              </span>
            </div>
          )}

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

          {retailerGroups.map((group, groupIdx) => {
            let globalRank = 0
            for (let i = 0; i < groupIdx; i++) globalRank += retailerGroups[i].items.length
            return (
              <div key={group.retailer} className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{group.retailer}</span>
                  <span className="text-xs text-muted-foreground">{group.items.length} listing{group.items.length !== 1 ? "s" : ""}</span>
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs font-semibold text-primary">
                    from {group.items[0].currency} {group.lowestPrice.toLocaleString("en-AE", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                  </span>
                </div>
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

          {/* Bottom search bar — hidden when viewing a history entry from sidebar */}
          {!isHistoryView && (
            <div className="pt-4 pb-2 max-w-2xl mx-auto w-full">
              {renderSearchBox(true)}
            </div>
          )}

          {/* ── Recent searches history — hidden when viewing a history entry from sidebar ── */}
          {!isHistoryView && history.length > 0 && (
            <div className="pt-2 pb-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 px-1">
                Recent searches
              </p>
              <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-lg divide-y divide-border">
                {history.slice(0, 3).map((entry) => {
                  const isOpen   = openHistoryId === entry.id
                  const cheapest = entry.results.reduce((best: any, r: any) =>
                    r.price !== null && (best === null || r.price < best.price) ? r : best, null)
                  const fmtTime  = (() => {
                    const d = new Date(entry.searched_at)
                    const now = new Date()
                    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000)
                    const h = d.getHours(), min = String(d.getMinutes()).padStart(2, "0")
                    const ampm = h >= 12 ? "pm" : "am", h12 = h % 12 || 12
                    if (diffDays === 0 && now.getDate() === d.getDate()) return `${h12}:${min} ${ampm}`
                    if (diffDays < 2) return `Yesterday ${h12}:${min} ${ampm}`
                    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
                  })()

                  return (
                    <div key={entry.id}>
                      {/* Row */}
                      <button
                        onClick={() => setOpenHistoryId(isOpen ? null : entry.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30 ${isOpen ? "bg-muted/20" : ""}`}
                      >
                        <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${isOpen ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                          <Search className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{entry.query}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] text-muted-foreground">{entry.result_count} result{entry.result_count !== 1 ? "s" : ""}</span>
                            {cheapest && <span className="text-[11px] font-semibold text-primary">Best: {cheapest.currency} {cheapest.price?.toLocaleString()}</span>}
                          </div>
                        </div>
                        <span className="text-[11px] text-muted-foreground shrink-0">{fmtTime}</span>
                        <span className="text-muted-foreground/40 text-xs">{isOpen ? "▲" : "▼"}</span>
                      </button>

                      {/* Expanded results */}
                      {isOpen && (
                        <div className="bg-muted/10 border-t divide-y">
                          {entry.results.slice(0, 5).map((r: any, i: number) => {
                            const isBest = r === cheapest
                            return (
                              <div key={r.url} className={`flex items-center gap-3 px-5 py-3 ${isBest ? "bg-primary/5" : ""}`}>
                                <span className="text-xs font-bold text-muted-foreground/40 w-5 shrink-0 text-center">#{i + 1}</span>
                                {r.imageUrl ? (
                                  <img src={r.imageUrl} alt={r.title} className="w-9 h-9 rounded-lg object-contain bg-muted/30 border shrink-0"
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
                                ) : (
                                  <div className="w-9 h-9 rounded-lg bg-muted/40 border flex items-center justify-center shrink-0">
                                    <span className="text-xs font-bold text-muted-foreground/40">{r.retailer?.charAt(0)}</span>
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold text-muted-foreground">{r.retailer}</p>
                                  <p className="text-xs text-muted-foreground truncate">{r.title}</p>
                                </div>
                                <div className="text-right shrink-0 mr-1">
                                  <span className={`text-sm font-bold ${isBest ? "text-primary" : ""}`}>
                                    {r.currency} {r.price?.toLocaleString()}
                                  </span>
                                </div>
                                <a href={r.url} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                                </a>
                              </div>
                            )
                          })}
                          {entry.results.length > 5 && (
                            <p className="text-[11px] text-muted-foreground px-5 py-2">
                              +{entry.results.length - 5} more results in Price Activity
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  )
}
