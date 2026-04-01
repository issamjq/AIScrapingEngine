import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Badge } from "./ui/badge"
import { Checkbox } from "./ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog"
import {
  Compass, Search, CheckCircle, ExternalLink,
  Loader2, Plus, AlertCircle, Lock, Sparkles, Bot,
} from "lucide-react"
import { PageSkeleton } from "./PageSkeleton"
import { useAuth } from "@/context/AuthContext"

const API = import.meta.env.VITE_API_URL || "http://localhost:8080"
const FREE_LIMIT = Infinity  // blur temporarily disabled — re-enable by setting to 3

const DEFAULT_RETAILERS = [
  { label: "Amazon AE",     value: "Amazon AE (amazon.ae)" },
  { label: "Noon",          value: "Noon (noon.com)" },
  { label: "Carrefour UAE", value: "Carrefour UAE (carrefouruae.com)" },
  { label: "Talabat",       value: "Talabat Grocery (talabat.com)" },
  { label: "Spinneys",      value: "Spinneys UAE (spinneys.com)" },
]

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

function groupByRetailer(results: SearchResult[]): RetailerGroup[] {
  const map = new Map<string, SearchResult[]>()
  for (const r of results) {
    if (!map.has(r.retailer)) map.set(r.retailer, [])
    map.get(r.retailer)!.push(r)
  }
  return [...map.entries()].map(([retailer, items]) => ({
    retailer,
    visible: items.slice(0, FREE_LIMIT),
    blurred: items.slice(FREE_LIMIT),
  }))
}

// Match retailer string + result URL to a company in DB
// Primary: domain from URL matches company base_url
// Fallback: keyword matching on name/slug
function matchCompany(retailerStr: string, companies: any[], url?: string): any | null {
  // 1. Domain-based match (most reliable)
  if (url) {
    try {
      const domain = new URL(url).hostname.replace(/^www\./, "")
      const byDomain = companies.find((c) => {
        const base = (c.base_url || "").replace(/https?:\/\/(www\.)?/, "").split("/")[0].toLowerCase()
        return base === domain || domain.endsWith(base) || base.endsWith(domain)
      })
      if (byDomain) return byDomain
    } catch { /* invalid URL, fall through */ }
  }

  // 2. Name/keyword matching
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

export function DiscoveringContent() {
  const { user } = useAuth()

  const [loading, setLoading]                     = useState(true)
  const [companies, setCompanies]                 = useState<any[]>([])

  const [query, setQuery]                         = useState("")
  const [selectedRetailers, setSelectedRetailers] = useState<string[]>(
    DEFAULT_RETAILERS.slice(0, 3).map((r) => r.value)
  )
  const [searching, setSearching]                 = useState(false)
  const [groups, setGroups]                       = useState<RetailerGroup[]>([])
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

  // Catalog picker (for manual product assignment in match dialog)
  const [catalog, setCatalog]   = useState<{id:number; name:string; brand:string}[]>([])
  const [pickerUrl, setPickerUrl]     = useState<string | null>(null)
  const [pickerSearch, setPickerSearch] = useState("")
  const [overrides, setOverrides] = useState<Map<string, {id:number; name:string; brand:string}>>(new Map())

  async function getToken() {
    try { return user ? await (user as any).getIdToken() : null } catch { return null }
  }

  useEffect(() => {
    if (!user) return
    let cancelled = false
    async function load() {
      try {
        const token = await (user as any).getIdToken()
        const res = await fetch(`${API}/api/companies`, { headers: { Authorization: `Bearer ${token}` } })
        const json = await res.json()
        if (!cancelled && json.success) setCompanies(json.data || [])
      } catch { /* silent */ }
      if (!cancelled) setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [user])

  async function handleSearch() {
    if (!query.trim() || searching) return
    setSearching(true)
    setSearchError(null)
    setGroups([])
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
      if (!res.ok || !json.success) throw new Error(json.error?.message || "Search failed")
      const results: SearchResult[] = json.data.results || []
      setGroups(groupByRetailer(results))
      setAllResults(results)
      setTotalFound(results.length)
      setSearched(true)
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
    // Get the visible checked results
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
    setMatching(true)

    try {
      const token = await getToken()

      // Fetch catalog for manual product picker
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
      if (!res.ok || !json.success) throw new Error(json.error?.message || "Matching failed")
      const results: AiMatchResult[] = json.data
      setMatchResults(results)
      // Pre-select only high-confidence matches (>= 85%)
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

  function selectAll() {
    setSelected(new Set(matchResults.filter((r) => overrides.has(r.url) || r.match).map((r) => r.url)))
  }

  function deselectAll() {
    setSelected(new Set())
  }

  async function handleSave() {
    const toSave = matchResults.filter((r) => selected.has(r.url))
    if (!toSave.length) return

    setSaving(true)
    setSaveError(null)

    // Group by company
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
      setSaveError(`Could not match retailers to companies: ${[...new Set(unmatched)].join(", ")}`)
      setSaving(false)
      return
    }

    try {
      const token = await getToken()
      const h = { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      let totalAdded = 0

      for (const [companyId, mappings] of companyGroups) {
        const res = await fetch(`${API}/api/discovery/confirm`, {
          method: "POST",
          headers: h,
          body: JSON.stringify({ company_id: companyId, mappings }),
        })
        const json = await res.json()
        if (json.success) totalAdded += json.data?.added || 0
      }

      const unmatchedNote = unmatched.length ? ` (${[...new Set(unmatched)].join(", ")} not matched to companies)` : ""
      setConfirmSuccess(`Added ${totalAdded} URL${totalAdded !== 1 ? "s" : ""} to tracked listings.${unmatchedNote}`)
      setShowMatch(false)
      setConfirmed(new Set())
    } catch (err: any) {
      setSaveError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const totalBlurred = groups.reduce((s, g) => s + g.blurred.length, 0)

  if (loading) return <PageSkeleton cards={2} rows={4} />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold">Market Discovery</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Auto-discover product listings across retailers using AI web search.
        </p>
      </div>

      {/* Search card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Compass className="h-4 w-4" />
            Discover Products
          </CardTitle>
          <CardDescription className="text-xs">
            AI searches up to 10 listings per retailer — results in under 30 seconds.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            {DEFAULT_RETAILERS.map((r) => (
              <label key={r.value} className="flex items-center gap-1.5 cursor-pointer select-none">
                <Checkbox
                  checked={selectedRetailers.includes(r.value)}
                  onCheckedChange={() => toggleRetailer(r.value)}
                />
                <span className="text-sm">{r.label}</span>
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="e.g. Marvis Classic Mint Toothpaste 75ml"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="flex-1"
            />
            <Button
              onClick={handleSearch}
              disabled={!query.trim() || searching || selectedRetailers.length === 0}
              className="gap-1.5 shrink-0"
            >
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              <span className="hidden sm:inline">{searching ? "Searching…" : "Search"}</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Discovery Results</CardTitle>
          <CardDescription className="text-xs">
            {searched && !searchError
              ? `Found ${totalFound} listing${totalFound !== 1 ? "s" : ""} for "${query}" — showing ${FREE_LIMIT} per retailer`
              : "AI-matched product listings from retailer pages"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {confirmSuccess && (
            <div className="rounded-md bg-green-500/10 text-green-700 dark:text-green-400 text-sm px-4 py-3 mb-4 flex items-center gap-2">
              <CheckCircle className="h-4 w-4 shrink-0" />
              {confirmSuccess}
            </div>
          )}

          {!searched && !searching && (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
              <Compass className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Run a discovery search to see results here.</p>
            </div>
          )}

          {searching && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/60" />
              <p className="text-sm text-muted-foreground">Claude is searching across retailers…</p>
              <p className="text-xs text-muted-foreground/60">Up to 30 seconds</p>
            </div>
          )}

          {searchError && (
            <div className="rounded-md bg-destructive/10 text-destructive text-sm px-4 py-3">{searchError}</div>
          )}

          {searched && !searchError && groups.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Compass className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No listings found. Try a more specific product name.</p>
            </div>
          )}

          {groups.length > 0 && (
            <div className="space-y-6">
              {groups.map((group) => (
                <div key={group.retailer}>
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="outline" className="text-xs font-medium">{group.retailer}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {group.visible.length + group.blurred.length} listing{group.visible.length + group.blurred.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Visible (first 3) */}
                  <div className="space-y-2 mb-2">
                    {group.visible.map((r) => (
                      <div key={r.url} className="flex items-start gap-3 rounded-lg border p-3">
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

                  {/* Blurred (4+) */}
                  {group.blurred.length > 0 && (
                    <div className="relative rounded-lg overflow-hidden">
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
                          <Button size="sm" className="w-full gap-1.5">
                            <Sparkles className="h-3.5 w-3.5" />
                            Upgrade to Pro
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2 opacity-40 pointer-events-none select-none">
                        {group.blurred.map((r) => (
                          <div key={r.url} className="flex items-start gap-3 rounded-lg border p-3">
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
                <div className="pt-2 flex items-center justify-between border-t">
                  <span className="text-xs text-muted-foreground">{confirmed.size} listing{confirmed.size !== 1 ? "s" : ""} selected</span>
                  <Button size="sm" className="gap-1.5" onClick={openMatchDialog}>
                    <Bot className="h-4 w-4" />
                    AI Match &amp; Add to Tracked
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
        {[
          { label: "Listings Found",     value: searched ? String(totalFound) : "—",     icon: Compass },
          { label: "Retailers Searched", value: searched ? String(groups.length) : "—",  icon: Search },
          { label: "Locked Results",     value: searched ? String(totalBlurred) : "—",   icon: Lock },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
              <CardTitle className="text-xs sm:text-sm font-medium">{label}</CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-xl sm:text-2xl font-bold">{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* AI Match Dialog */}
      <Dialog open={showMatch} onOpenChange={(open) => { if (!saving) setShowMatch(open) }}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              AI Product Matching
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">
            {/* Matching loading */}
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

            {/* Select all / none controls */}
            {matchResults.length > 0 && !matching && (
              <>
                <div className="flex items-center justify-between pb-1 border-b">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      {selected.size} of {matchResults.length} selected
                    </span>
                    <div className="flex gap-2">
                      <button onClick={selectAll} className="text-xs text-primary hover:underline">Select all</button>
                      <span className="text-xs text-muted-foreground">·</span>
                      <button onClick={deselectAll} className="text-xs text-muted-foreground hover:underline">Deselect all</button>
                    </div>
                  </div>
                </div>

                {/* Match rows */}
                <div className="space-y-2">
                  {matchResults.map((r) => {
                    const effectiveMatch = overrides.get(r.url) ?? r.match
                    const effectiveConfidence = overrides.has(r.url) ? 1.0 : r.confidence
                    const isHighConfidence = effectiveConfidence >= 0.85
                    return (
                    <div
                      key={r.url}
                      className={`rounded-lg border p-3 transition-colors cursor-pointer ${
                        selected.has(r.url) ? "border-primary/40 bg-primary/5" : "hover:bg-muted/30"
                      }`}
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
                          {/* Retailer listing */}
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

                          {/* Match / no-match display */}
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
                                  {effectiveMatch.brand && (
                                    <span className="text-[10px] text-muted-foreground">{effectiveMatch.brand}</span>
                                  )}
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

                          {/* Inline product picker */}
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
            <Button variant="outline" size="sm" onClick={() => setShowMatch(false)} disabled={saving}>
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
