import { useState, useEffect, useRef, useMemo } from "react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Badge } from "./ui/badge"
import { Checkbox } from "./ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog"
import {
  Compass, Search, CheckCircle, ExternalLink,
  Loader2, Plus, AlertCircle, Lock, Sparkles, Bot,
  ChevronDown, ChevronUp,
} from "lucide-react"
import { PageSkeleton } from "./PageSkeleton"
import { PlansModal } from "./PlansModal"
import { useAuth } from "@/context/AuthContext"
import { B2CDiscoveryContent } from "./B2CDiscoveryContent"

const API = import.meta.env.VITE_API_URL || "http://localhost:8080"

function retailerValue(c: any) {
  try {
    const domain = new URL(c.base_url).hostname.replace(/^www\./, "")
    return `${c.name} (${domain})`
  } catch {
    return c.name
  }
}

interface SearchResult {
  retailer: string
  url:      string
  title:    string
}

interface AiMatchResult extends SearchResult {
  match:      { id: number; name: string; brand: string } | null
  confidence: number
}

interface RetailerGroup {
  retailer: string
  visible:  SearchResult[]
  blurred:  SearchResult[]
}

function groupByRetailer(results: SearchResult[], visibleLimit: number): RetailerGroup[] {
  const map = new Map<string, SearchResult[]>()
  for (const r of results) {
    if (!map.has(r.retailer)) map.set(r.retailer, [])
    map.get(r.retailer)!.push(r)
  }
  return [...map.entries()].map(([retailer, items]) => ({
    retailer,
    visible: items.slice(0, visibleLimit),
    blurred: items.slice(visibleLimit),
  }))
}

function matchCompany(retailerStr: string, companies: any[], url?: string): any | null {
  if (url) {
    try {
      const domain = new URL(url).hostname.replace(/^www\./, "")
      const byDomain = companies.find((c) => {
        const base = (c.base_url || "").replace(/https?:\/\/(www\.)?/, "").split("/")[0].toLowerCase()
        return base === domain || domain.endsWith(base) || base.endsWith(domain)
      })
      if (byDomain) return byDomain
    } catch { /* invalid URL */ }
  }
  const name = retailerStr.replace(/\s*\([^)]*\)/, "").trim().toLowerCase()
  const skipWords = new Set(["ae", "uae", "the", "grocery", "market", "store", "online", "shop"])
  const keywords = name.split(/\s+/).filter((w) => w.length > 2 && !skipWords.has(w))
  return (
    companies.find((c) => c.name.toLowerCase() === name) ||
    companies.find((c) => c.name.toLowerCase().includes(name) || name.includes(c.name.toLowerCase())) ||
    companies.find((c) => keywords.some((w) => c.name.toLowerCase().includes(w))) ||
    companies.find((c) => keywords.some((w) => c.slug?.toLowerCase().includes(w))) ||
    companies.find((c) => keywords.some((w) => (c.base_url || "").toLowerCase().includes(w))) ||
    null
  )
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100)
  const color =
    pct >= 85 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
    pct >= 60 ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" :
                "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${color}`}>
      {pct}%
    </span>
  )
}

// ── Step indicator ────────────────────────────────────────────────
function StepBar({ current }: { current: 1 | 2 | 3 }) {
  const steps = [
    { n: 1, label: "Discover",  sub: "Search & AI match" },
    { n: 2, label: "Review",    sub: "Select products" },
    { n: 3, label: "Track",     sub: "Save & get prices" },
  ]
  return (
    <div className="flex items-center w-full gap-0">
      {steps.map((s, i) => {
        const done    = current > s.n
        const active  = current === s.n
        return (
          <div key={s.n} className="flex items-center flex-1 min-w-0">
            <div className="flex items-center gap-2 shrink-0">
              <div className={`h-7 w-7 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                active ? "bg-foreground text-background" :
                done   ? "bg-foreground/20 text-foreground" :
                         "border-2 border-muted-foreground/30 text-muted-foreground/50"
              }`}>
                {done ? <CheckCircle className="h-4 w-4" /> : s.n}
              </div>
              <div className="leading-tight">
                <div className={`text-sm font-medium ${active ? "text-foreground" : "text-muted-foreground/60"}`}>{s.label}</div>
                <div className="text-[11px] text-muted-foreground/50">{s.sub}</div>
              </div>
            </div>
            {i < steps.length - 1 && (
              <div className="flex-1 mx-3 h-px bg-muted-foreground/20 min-w-4" />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Marketplace dropdown ──────────────────────────────────────────
function MarketplaceDropdown({
  companies,
  selected,
  onToggle,
  onSelectAll,
  onDeselectAll,
}: {
  companies: any[]
  selected: string[]
  onToggle: (v: string) => void
  onSelectAll: () => void
  onDeselectAll: () => void
}) {
  const [open, setOpen]       = useState(false)
  const [search, setSearch]   = useState("")
  const ref                   = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  const filtered = companies.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )
  const label = selected.length === 0
    ? "Select marketplaces…"
    : selected.length === companies.length
      ? `All ${companies.length} marketplaces selected`
      : `${selected.length} marketplace${selected.length !== 1 ? "s" : ""} selected`

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between rounded-xl border border-input bg-background px-4 py-3 text-sm text-left transition-colors hover:bg-muted/30 focus:outline-none"
      >
        <span className={selected.length === 0 ? "text-muted-foreground" : "text-foreground"}>{label}</span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-xl border bg-background shadow-lg">
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                autoFocus
                className="w-full rounded-lg border border-input bg-muted/30 pl-8 pr-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="Search marketplaces…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="px-3 py-2 flex items-center justify-between border-b">
            <span className="text-xs text-muted-foreground">{filtered.length} stores</span>
            <button
              type="button"
              className="text-xs font-medium text-foreground hover:underline"
              onClick={() => selected.length === companies.length ? onDeselectAll() : onSelectAll()}
            >
              {selected.length === companies.length ? "Deselect all" : "Select all"}
            </button>
          </div>

          <div className="max-h-52 overflow-y-auto p-2 space-y-0.5">
            {filtered.map((c) => {
              const value = retailerValue(c)
              const checked = selected.includes(value)
              return (
                <label
                  key={c.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-muted/40 transition-colors"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => onToggle(value)}
                  />
                  <span className="text-sm">{c.name}</span>
                </label>
              )
            })}
            {filtered.length === 0 && (
              <p className="text-xs text-muted-foreground px-3 py-2">No stores found</p>
            )}
          </div>

          <div className="p-3 border-t">
            <Button
              size="sm"
              className="w-full rounded-full"
              onClick={() => setOpen(false)}
            >
              Done
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── B2B inner component (all hooks live here) ─────────────────────
function B2BDiscoveryContent() {
  const { user } = useAuth()

  const [loading, setLoading]                     = useState(true)
  const [companies, setCompanies]                 = useState<any[]>([])
  const [currentStep, setCurrentStep]             = useState<1 | 2 | 3>(1)

  const [query, setQuery]                         = useState("")
  const [selectedRetailers, setSelectedRetailers] = useState<string[]>([])
  const [searching, setSearching]                 = useState(false)
  const [searchingLabel, setSearchingLabel]       = useState<string>("")
  const [allResults, setAllResults]               = useState<SearchResult[]>([])
  const [totalFound, setTotalFound]               = useState(0)
  const [searched, setSearched]                   = useState(false)
  const [searchError, setSearchError]             = useState<string | null>(null)
  const [confirmed, setConfirmed]                 = useState<Set<string>>(new Set())
  const [confirmSuccess, setConfirmSuccess]       = useState<string | null>(null)

  // AI Match dialog
  const [showMatch, setShowMatch]                 = useState(false)
  const [matching, setMatching]                   = useState(false)
  const [matchError, setMatchError]               = useState<string | null>(null)
  const [matchResults, setMatchResults]           = useState<AiMatchResult[]>([])
  const [selected, setSelected]                   = useState<Set<string>>(new Set())
  const [saving, setSaving]                       = useState(false)
  const [saveError, setSaveError]                 = useState<string | null>(null)

  // Catalog picker
  const [catalog, setCatalog]         = useState<{id:number; name:string; brand:string}[]>([])
  const [pickerUrl, setPickerUrl]     = useState<string | null>(null)
  const [pickerSearch, setPickerSearch] = useState("")
  const [overrides, setOverrides]     = useState<Map<string, {id:number; name:string; brand:string}>>(new Map())

  // Plans modal
  const [showPlans, setShowPlans]     = useState(false)
  const [plansData, setPlansData]     = useState<{ used: number; limit: number; subscription: string; role: string; trial_ends_at?: string | null }>({ used: 0, limit: 10, subscription: "free", role: "b2c" })
  const [userProfile, setUserProfile] = useState<{ subscription: string; role: string; daily_searches_used: number; trial_ends_at?: string | null } | null>(null)

  const visiblePerRetailer = userProfile?.subscription === "free" ? 3 : Infinity
  const groups = useMemo(() => groupByRetailer(allResults, visiblePerRetailer), [allResults, visiblePerRetailer])
  const totalBlurred = groups.reduce((s, g) => s + g.blurred.length, 0)

  async function getToken() {
    try { return user ? await (user as any).getIdToken() : null } catch { return null }
  }

  useEffect(() => {
    if (!user) return
    let cancelled = false
    async function load() {
      try {
        const token = await (user as any).getIdToken()
        const [companiesRes, meRes] = await Promise.all([
          fetch(`${API}/api/companies`,        { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API}/api/allowed-users/me`, { headers: { Authorization: `Bearer ${token}` } }),
        ])
        const [companiesJson, meJson] = await Promise.all([companiesRes.json(), meRes.json()])
        if (!cancelled && companiesJson.success) {
          const active = (companiesJson.data || []).filter((c: any) => c.is_active)
          setCompanies(active)
          setSelectedRetailers(active.map(retailerValue))
        }
        if (!cancelled && meJson.success && meJson.data) {
          setUserProfile(meJson.data)
        }
      } catch { /* silent */ }
      if (!cancelled) setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [user])

  useEffect(() => {
    if (!searching) { setSearchingLabel(""); return }
    const domains = selectedRetailers.map((r) => {
      const m = r.match(/\(([^)]+)\)/)
      return m ? m[1] : r
    })
    let i = 0
    setSearchingLabel(domains[0] ?? "")
    const interval = setInterval(() => {
      i = (i + 1) % domains.length
      setSearchingLabel(domains[i])
    }, 4000)
    return () => clearInterval(interval)
  }, [searching])

  async function handleSearch() {
    if (!query.trim() || searching) return
    setSearching(true)
    setSearchError(null)
    setAllResults([])
    setTotalFound(0)
    setSearched(false)
    setConfirmed(new Set())
    setConfirmSuccess(null)
    try {
      const token = await getToken()
      const res = await fetch(`${API}/api/discovery/ai-search`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ query: query.trim(), retailers: selectedRetailers }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        if (json.error?.code === "USAGE_LIMIT_REACHED") {
          setPlansData({ used: json.error.used, limit: json.error.limit, subscription: json.error.subscription, role: json.error.role, trial_ends_at: json.error.trial_ends_at })
          setShowPlans(true)
          setSearched(true)
          return
        }
        throw new Error(json.error?.message || "Search failed")
      }
      const results: SearchResult[] = json.data.results || []
      setAllResults(results)
      setTotalFound(results.length)
      setSearched(true)
      setCurrentStep(2)
      if (userProfile) setUserProfile((p) => p ? { ...p, daily_searches_used: p.daily_searches_used + 1 } : p)
    } catch (err: any) {
      setSearchError(err.message)
      setSearched(true)
    } finally {
      setSearching(false)
    }
  }

  function toggleRetailer(value: string) {
    setSelectedRetailers((prev) =>
      prev.includes(value) ? prev.filter((r) => r !== value) : [...prev, value]
    )
  }

  function toggleConfirm(url: string) {
    setConfirmed((prev) => {
      const next = new Set(prev)
      next.has(url) ? next.delete(url) : next.add(url)
      return next
    })
  }

  async function openMatchDialog() {
    const visibleResults = groups.flatMap((g) => g.visible)
    const toMatch = visibleResults.filter((r) => confirmed.has(r.url))
    if (!toMatch.length) return
    setMatchResults([])
    setMatchError(null)
    setSaveError(null)
    setSelected(new Set())
    setOverrides(new Map())
    setPickerUrl(null)
    setPickerSearch("")
    setShowMatch(true)
    setCurrentStep(3)
    setMatching(true)
    try {
      const token = await getToken()
      fetch(`${API}/api/products?limit=500`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
        .then((r) => r.json())
        .then((j) => { if (j.success) setCatalog(j.data || []) })
        .catch(() => {})
      const res = await fetch(`${API}/api/discovery/ai-match`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ items: toMatch }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        if (json.error?.code === "USAGE_LIMIT_REACHED") {
          setShowMatch(false)
          setCurrentStep(2)
          setPlansData({ used: json.error.used, limit: json.error.limit, subscription: json.error.subscription, role: json.error.role, trial_ends_at: json.error.trial_ends_at })
          setShowPlans(true)
          return
        }
        throw new Error(json.error?.message || "Matching failed")
      }
      const results: AiMatchResult[] = json.data
      setMatchResults(results)
      setSelected(new Set(results.filter((r) => r.match && r.confidence >= 0.85).map((r) => r.url)))
    } catch (err: any) {
      setMatchError(err.message)
    } finally {
      setMatching(false)
    }
  }

  function toggleSelected(url: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(url) ? next.delete(url) : next.add(url)
      return next
    })
  }

  async function handleSave() {
    const toSave = matchResults.filter((r) => selected.has(r.url))
    if (!toSave.length) return
    setSaving(true)
    setSaveError(null)
    const companyGroups = new Map<number, { product_id: number; url: string }[]>()
    const unmatched: string[] = []
    for (const r of toSave) {
      const effectiveMatch = overrides.get(r.url) ?? r.match
      if (!effectiveMatch) continue
      const company = matchCompany(r.retailer, companies, r.url)
      if (!company) { unmatched.push(r.retailer); continue }
      if (!companyGroups.has(company.id)) companyGroups.set(company.id, [])
      companyGroups.get(company.id)!.push({ product_id: effectiveMatch.id, url: r.url })
    }
    if (companyGroups.size === 0) {
      setSaveError(`Could not match retailers: ${[...new Set(unmatched)].join(", ")}`)
      setSaving(false)
      return
    }
    try {
      const token = await getToken()
      const h = { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      let totalAdded = 0
      for (const [companyId, mappings] of companyGroups) {
        const res = await fetch(`${API}/api/discovery/confirm`, {
          method: "POST", headers: h,
          body: JSON.stringify({ company_id: companyId, mappings }),
        })
        const json = await res.json()
        if (json.success) totalAdded += json.data?.added || 0
      }
      const unmatchedNote = unmatched.length ? ` (${[...new Set(unmatched)].join(", ")} not matched)` : ""
      setConfirmSuccess(`Added ${totalAdded} URL${totalAdded !== 1 ? "s" : ""} to tracked listings.${unmatchedNote}`)
      setShowMatch(false)
      setCurrentStep(1)
      setConfirmed(new Set())
      setAllResults([])
      setSearched(false)
      setQuery("")
    } catch (err: any) {
      setSaveError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <PageSkeleton cards={2} rows={4} />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
          <Compass className="h-5 w-5" />
          Market Discovery
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          AI-powered product discovery — finds, matches, saves, and prices everything in one click
        </p>
      </div>

      {/* Step indicator */}
      <StepBar current={currentStep} />

      {/* Success banner */}
      {confirmSuccess && (
        <div className="rounded-xl bg-green-500/10 text-green-700 dark:text-green-400 text-sm px-4 py-3 flex items-center gap-2">
          <CheckCircle className="h-4 w-4 shrink-0" />
          {confirmSuccess}
          <button className="ml-auto text-xs underline" onClick={() => setConfirmSuccess(null)}>Dismiss</button>
        </div>
      )}

      {/* ── Step 1: Search form ── */}
      {currentStep === 1 && (
        <div className="rounded-2xl border bg-card p-6 space-y-5 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold">Search for products</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Enter a product name — we'll find it, match it to your catalog, save it, and fetch prices. All automatically.
            </p>
          </div>

          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              className="w-full rounded-xl border border-input bg-background pl-10 pr-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="e.g. Marvis Classic Whitening Toothpaste"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
          </div>

          {/* Marketplace dropdown */}
          {companies.length === 0 ? (
            <div className="rounded-xl border border-input px-4 py-3 text-sm text-muted-foreground">
              Loading stores…
            </div>
          ) : (
            <MarketplaceDropdown
              companies={companies}
              selected={selectedRetailers}
              onToggle={toggleRetailer}
              onSelectAll={() => setSelectedRetailers(companies.map(retailerValue))}
              onDeselectAll={() => setSelectedRetailers([])}
            />
          )}

          {/* Usage counter */}
          {userProfile && !["dev","owner"].includes(userProfile.role) && (() => {
            const isB2C   = userProfile.role === "b2c"
            const LIMITS  = isB2C ? { trial: 30, free: 15, paid: 150 } : { trial: 20, free: 10, paid: 50 }
            const limit   = LIMITS[userProfile.subscription as keyof typeof LIMITS] ?? LIMITS.free
            const unit    = isB2C ? "credits" : "searches"
            const period  = isB2C ? "this month" : "this week"
            return (
              <div className="text-xs text-muted-foreground">
                {userProfile.daily_searches_used} / {limit} {unit} {period}
                {" · "}
                <button className="underline hover:text-foreground" onClick={() => { setPlansData({ used: userProfile.daily_searches_used, limit, subscription: userProfile.subscription, role: userProfile.role, trial_ends_at: userProfile.trial_ends_at }); setShowPlans(true) }}>
                  {userProfile.subscription} plan
                </button>
              </div>
            )
          })()}

          {searchError && (
            <div className="rounded-lg bg-destructive/10 text-destructive text-sm px-4 py-3">{searchError}</div>
          )}

          {/* CTA button */}
          <Button
            className="w-full rounded-xl py-3 gap-2 text-sm font-medium"
            onClick={handleSearch}
            disabled={!query.trim() || searching || selectedRetailers.length === 0}
          >
            {searching
              ? <><Loader2 className="h-4 w-4 animate-spin" /> {searchingLabel ? `Searching ${searchingLabel}…` : "Starting search…"}</>
              : <><Sparkles className="h-4 w-4" /> Discover &amp; Get Prices</>
            }
          </Button>
          {searching && (
            <p className="text-center text-xs text-muted-foreground">Up to 60 seconds — retries automatically if rate limited</p>
          )}
        </div>
      )}

      {/* ── Step 2: Review results ── */}
      {currentStep === 2 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">
                Found {totalFound} listing{totalFound !== 1 ? "s" : ""} for "{query}"
                {visiblePerRetailer < Infinity ? ` — free plan shows ${visiblePerRetailer} per retailer` : ""}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Select the listings you want to track, then run AI Match.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => { setCurrentStep(1); setSearched(false); setAllResults([]) }}>
              New search
            </Button>
          </div>

          {searched && !searchError && groups.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Compass className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No listings found. Try a more specific product name.</p>
              <Button variant="outline" size="sm" onClick={() => setCurrentStep(1)}>Try again</Button>
            </div>
          )}

          {groups.map((group) => (
            <div key={group.retailer} className="rounded-2xl border bg-card p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs font-medium">{group.retailer}</Badge>
                <span className="text-xs text-muted-foreground">
                  {group.visible.length + group.blurred.length} listing{group.visible.length + group.blurred.length !== 1 ? "s" : ""}
                </span>
              </div>

              <div className="space-y-2">
                {group.visible.map((r) => (
                  <div key={r.url} className="flex items-start gap-3 rounded-xl border p-3">
                    <Checkbox
                      checked={confirmed.has(r.url)}
                      onCheckedChange={() => toggleConfirm(r.url)}
                      className="mt-0.5 shrink-0"
                    />
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <span className="text-sm font-medium line-clamp-1">{r.title}</span>
                      <a
                        href={r.url} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 truncate"
                      >
                        <ExternalLink className="h-3 w-3 shrink-0" />
                        <span className="truncate">{r.url}</span>
                      </a>
                    </div>
                    {confirmed.has(r.url) && <CheckCircle className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />}
                  </div>
                ))}
              </div>

              {group.blurred.length > 0 && (
                <div className="relative rounded-xl overflow-hidden">
                  <div className="absolute inset-0 backdrop-blur-sm bg-background/60 z-10 flex items-center justify-center">
                    <div className="text-center bg-card border shadow-lg rounded-xl px-6 py-5 max-w-xs mx-4">
                      <div className="flex justify-center mb-2">
                        <div className="rounded-full bg-primary/10 p-2">
                          <Lock className="h-5 w-5 text-primary" />
                        </div>
                      </div>
                      <p className="text-sm font-semibold mb-1">
                        {group.blurred.length} more listing{group.blurred.length !== 1 ? "s" : ""} hidden
                      </p>
                      <p className="text-xs text-muted-foreground mb-3">Upgrade to Pro to unlock all results</p>
                      <Button size="sm" className="w-full gap-1.5" onClick={() => { setPlansData({ used: userProfile?.daily_searches_used || 0, limit: 999, subscription: userProfile?.subscription || "free", role: userProfile?.role || "b2c", trial_ends_at: userProfile?.trial_ends_at }); setShowPlans(true) }}>
                        <Sparkles className="h-3.5 w-3.5" />
                        Upgrade to Pro
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2 opacity-30 pointer-events-none select-none">
                    {group.blurred.map((r) => (
                      <div key={r.url} className="flex items-start gap-3 rounded-xl border p-3">
                        <div className="h-4 w-4 rounded border mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <span className="text-sm font-medium line-clamp-1">{r.title}</span>
                          <span className="text-xs text-muted-foreground truncate block">{r.url}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {confirmed.size > 0 && (
            <div className="rounded-2xl border bg-card p-4 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{confirmed.size} listing{confirmed.size !== 1 ? "s" : ""} selected</span>
              <Button size="sm" className="gap-1.5" onClick={openMatchDialog}>
                <Bot className="h-4 w-4" />
                AI Match &amp; Add to Tracked
              </Button>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Listings Found",     value: String(totalFound)     },
              { label: "Retailers Searched", value: String(groups.length)  },
              { label: "Locked Results",     value: String(totalBlurred)   },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-2xl border bg-card p-4 text-center">
                <div className="text-2xl font-bold">{value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Plans modal */}
      <PlansModal
        open={showPlans}
        onClose={() => setShowPlans(false)}
        subscription={plansData.subscription}
        role={plansData.role}
        used={plansData.used}
        limit={plansData.limit}
        trialEndsAt={plansData.trial_ends_at}
      />

      {/* AI Match Dialog (Step 3) */}
      <Dialog open={showMatch} onOpenChange={(open) => { if (!saving) { setShowMatch(open); if (!open) setCurrentStep(2) } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              AI Product Matching
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">
            {matching && (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <Loader2 className="h-7 w-7 animate-spin text-muted-foreground/60" />
                <p className="text-sm text-muted-foreground">Claude is matching listings to your catalog…</p>
              </div>
            )}

            {matchError && (
              <div className="flex items-start gap-2 rounded-md bg-destructive/10 text-destructive text-sm px-4 py-3">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                {matchError}
              </div>
            )}

            {matchResults.length > 0 && !matching && (
              <>
                <div className="flex items-center justify-between pb-1 border-b">
                  <span className="text-xs text-muted-foreground">{selected.size} of {matchResults.length} selected</span>
                  <div className="flex gap-2">
                    <button onClick={() => setSelected(new Set(matchResults.filter((r) => overrides.has(r.url) || r.match).map((r) => r.url)))} className="text-xs text-primary hover:underline">Select all</button>
                    <span className="text-xs text-muted-foreground">·</span>
                    <button onClick={() => setSelected(new Set())} className="text-xs text-muted-foreground hover:underline">Deselect all</button>
                  </div>
                </div>

                <div className="space-y-2">
                  {matchResults.map((r) => {
                    const effectiveMatch = overrides.get(r.url) ?? r.match
                    const effectiveConfidence = overrides.has(r.url) ? 1.0 : r.confidence
                    const isHighConfidence = effectiveConfidence >= 0.85
                    return (
                      <div
                        key={r.url}
                        className={`rounded-lg border p-3 transition-colors cursor-pointer ${selected.has(r.url) ? "border-primary/40 bg-primary/5" : "hover:bg-muted/30"}`}
                        onClick={() => { if (pickerUrl !== r.url) toggleSelected(r.url) }}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={selected.has(r.url)}
                            onCheckedChange={() => toggleSelected(r.url)}
                            onClick={(e) => e.stopPropagation()}
                            className="mt-0.5 shrink-0"
                          />
                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="secondary" className="text-[10px] shrink-0">{r.retailer}</Badge>
                                <span className="text-sm font-medium line-clamp-1">{r.title}</span>
                              </div>
                              <a
                                href={r.url} target="_blank" rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 truncate"
                              >
                                <ExternalLink className="h-3 w-3 shrink-0" />
                                <span className="truncate">{r.url}</span>
                              </a>
                            </div>

                            {effectiveMatch ? (
                              <div className="flex items-center gap-2 pt-1 flex-wrap">
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                                  <div className="h-px w-4 bg-muted-foreground/30" />
                                  <Bot className="h-3 w-3" />
                                  {isHighConfidence ? "matched to" : "possible match"}
                                </div>
                                <div className="flex items-center gap-2 rounded-md bg-muted/60 px-2.5 py-1.5 flex-1 min-w-0">
                                  <div className="flex-1 min-w-0">
                                    <span className="text-xs font-medium truncate block">{effectiveMatch.name}</span>
                                    {effectiveMatch.brand && <span className="text-[10px] text-muted-foreground">{effectiveMatch.brand}</span>}
                                  </div>
                                  <ConfidenceBadge confidence={effectiveConfidence} />
                                </div>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setPickerUrl(pickerUrl === r.url ? null : r.url); setPickerSearch("") }}
                                  className="text-xs text-muted-foreground hover:text-foreground hover:underline shrink-0"
                                >
                                  Change
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 pt-1">
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <AlertCircle className="h-3 w-3" />
                                  No match found in catalog
                                </div>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setPickerUrl(pickerUrl === r.url ? null : r.url); setPickerSearch("") }}
                                  className="text-xs text-primary hover:underline ml-auto shrink-0"
                                >
                                  Assign product
                                </button>
                              </div>
                            )}

                            {pickerUrl === r.url && (
                              <div className="mt-1 border rounded-lg p-2 bg-background" onClick={(e) => e.stopPropagation()}>
                                <Input
                                  placeholder="Search catalog…"
                                  value={pickerSearch}
                                  onChange={(e) => setPickerSearch(e.target.value)}
                                  className="h-7 text-xs mb-1.5"
                                  autoFocus
                                />
                                <div className="max-h-36 overflow-y-auto space-y-0.5">
                                  {catalog
                                    .filter((p) => `${p.name} ${p.brand}`.toLowerCase().includes(pickerSearch.toLowerCase()))
                                    .slice(0, 20)
                                    .map((p) => (
                                      <button
                                        key={p.id}
                                        className="w-full text-left px-2 py-1.5 rounded hover:bg-muted text-xs flex items-center gap-2"
                                        onClick={() => {
                                          const m = new Map(overrides)
                                          m.set(r.url, p)
                                          setOverrides(m)
                                          setPickerUrl(null)
                                          setPickerSearch("")
                                          setSelected((prev) => { const s = new Set(prev); s.add(r.url); return s })
                                        }}
                                      >
                                        <span className="font-medium truncate flex-1">{p.name}</span>
                                        {p.brand && <span className="text-muted-foreground shrink-0">{p.brand}</span>}
                                      </button>
                                    ))}
                                  {catalog.filter((p) => `${p.name} ${p.brand}`.toLowerCase().includes(pickerSearch.toLowerCase())).length === 0 && (
                                    <p className="text-xs text-muted-foreground px-2 py-1">No products found</p>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {saveError && (
              <div className="flex items-start gap-2 rounded-md bg-destructive/10 text-destructive text-xs px-3 py-2">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                {saveError}
              </div>
            )}
          </div>

          <DialogFooter className="border-t pt-4 shrink-0">
            <Button variant="outline" size="sm" onClick={() => { setShowMatch(false); setCurrentStep(2) }} disabled={saving}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={selected.size === 0 || saving || matching}
              className="gap-1.5"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {saving ? "Adding…" : `Add ${selected.size} to Tracked URLs`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Public export: routes by role ─────────────────────────────────
export function DiscoveringContent({ role, onNavigate, selectedHistoryEntry, onClearHistory }: { role?: string; onNavigate?: (page: string) => void; selectedHistoryEntry?: any; onClearHistory?: () => void }) {
  if (role === "b2c") return <B2CDiscoveryContent onNavigate={onNavigate} selectedHistoryEntry={selectedHistoryEntry} onClearHistory={onClearHistory} />
  return <B2BDiscoveryContent />
}
