import { useState, useEffect, useRef, useMemo } from "react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Badge } from "./ui/badge"
import { Checkbox } from "./ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog"
import {
  Compass, Search, CheckCircle, ExternalLink,
  Loader2, Plus, AlertCircle, Lock, Sparkles, Bot,
  ChevronDown, ChevronUp, X, Globe, Database,
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

// ── AI Thinking Log ───────────────────────────────────────────────
interface LogStep {
  id: string
  text: string
  status: "pending" | "running" | "done" | "error"
  detail?: string
  startedAt?: number
  endedAt?: number
}

function formatMs(ms: number) {
  if (ms < 1000) return `${ms}ms`
  const s = Math.floor(ms / 1000)
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`
}

function ThinkingLog({ steps, startedAt, onDismiss }: { steps: LogStep[]; startedAt: number; onDismiss: () => void }) {
  const isDone = steps.length > 0 && steps.every(s => s.status === "done" || s.status === "error")
  const [, setTick] = useState(0)
  useEffect(() => {
    if (isDone) return
    const t = setInterval(() => setTick(n => n + 1), 1000)
    return () => clearInterval(t)
  }, [isDone])
  const elapsed = !isDone && startedAt ? Date.now() - startedAt : null
  const totalTook = isDone && steps.some(s => s.endedAt)
    ? Math.max(...steps.filter(s => s.endedAt).map(s => s.endedAt!)) - startedAt : null

  return (
    <div className="rounded-2xl border bg-card p-5 font-mono text-sm shadow-sm">
      <div className="flex items-center justify-between mb-4 text-xs">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5" />
          <span className="font-semibold">AI Discovery Agent</span>
          {!isDone && <span className="text-amber-500">— running</span>}
          {isDone  && <span className="text-green-500">— complete</span>}
        </div>
        <div className="flex items-center gap-3">
          {!isDone && elapsed !== null && <span className="text-amber-500 tabular-nums">{formatMs(elapsed)}</span>}
          {isDone && totalTook !== null && <span className="text-green-500 tabular-nums">finished in {formatMs(totalTook)}</span>}
          {isDone && <button onClick={onDismiss} className="p-1 rounded hover:bg-muted transition-colors"><X className="h-3.5 w-3.5 text-muted-foreground" /></button>}
        </div>
      </div>
      <div className="space-y-2">
        {steps.map(step => {
          const took = step.startedAt && step.endedAt ? step.endedAt - step.startedAt : null
          return (
            <div key={step.id} className="flex items-start gap-2.5">
              {step.status === "running" && <div className="w-3.5 h-3.5 rounded-full border-2 border-amber-200 border-t-amber-500 animate-spin mt-0.5 shrink-0" />}
              {step.status === "done"    && <CheckCircle className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />}
              {step.status === "error"   && <AlertCircle className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />}
              {step.status === "pending" && <div className="h-3.5 w-3.5 rounded-full border-2 border-muted mt-0.5 shrink-0" />}
              <div className="flex items-baseline gap-2 flex-wrap flex-1">
                <span className={step.status === "done" ? "text-green-600 dark:text-green-400" : step.status === "error" ? "text-destructive" : "text-amber-600 dark:text-amber-400"}>{step.text}</span>
                {step.detail && <span className="text-xs text-muted-foreground">{step.detail}</span>}
              </div>
              {took !== null && <span className="text-xs text-muted-foreground tabular-nums shrink-0 ml-2">{formatMs(took)}</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── B2B inner component ───────────────────────────────────────────
function B2BDiscoveryContent({ onNavigate, onSearchComplete }: { onNavigate?: (page: string) => void; onSearchComplete?: () => void }) {
  const { user } = useAuth()

  // ── Mode toggle: "ai" = same as B2C price search, "catalog" = 3-step wizard
  const [mode, setMode] = useState<"ai" | "catalog">("ai")

  // ── Shared state ──────────────────────────────────────────────────
  const [loading, setLoading]                     = useState(true)
  const [companies, setCompanies]                 = useState<any[]>([])
  const [query, setQuery]                         = useState("")
  const [userProfile, setUserProfile]             = useState<{ subscription: string; role: string } | null>(null)

  // ── Catalog mode state ────────────────────────────────────────────
  const [currentStep, setCurrentStep]             = useState<1 | 2 | 3>(1)
  const [selectedRetailers, setSelectedRetailers] = useState<string[]>([])
  const [searching, setSearching]                 = useState(false)
  const [searchingLabel, setSearchingLabel]       = useState<string>("")
  const [allResults, setAllResults]               = useState<SearchResult[]>([])
  const [totalFound, setTotalFound]               = useState(0)
  const [searched, setSearched]                   = useState(false)
  const [searchError, setSearchError]             = useState<string | null>(null)
  const [confirmed, setConfirmed]                 = useState<Set<string>>(new Set())
  const [confirmSuccess, setConfirmSuccess]       = useState<string | null>(null)

  // Catalog mode — AI Thinking Log
  const [logSteps, setLogSteps]                   = useState<LogStep[]>([])
  const [logStartedAt, setLogStartedAt]           = useState(0)
  const [showLog, setShowLog]                     = useState(true)
  const [catalogPhase, setCatalogPhase]           = useState<"search" | "processing" | "review" | "results">("search")
  const [catalogResults, setCatalogResults]       = useState<Array<{ company: any; matches: any[] }>>([])
  const [catalogSelected, setCatalogSelected]     = useState<Set<string>>(new Set())
  const [catalogSaving, setCatalogSaving]         = useState(false)

  // AI Match dialog (old flow — kept for compatibility)
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
  const [plansData, setPlansData]     = useState<{ used: number; limit: number; subscription: string; role: string; trial_ends_at?: string | null }>({ used: 0, limit: 10, subscription: "free", role: "b2b" })

  const visiblePerRetailer = userProfile?.subscription === "free" ? 3 : Infinity
  const groups = useMemo(() => groupByRetailer(allResults, visiblePerRetailer), [allResults, visiblePerRetailer])
  const totalBlurred = groups.reduce((s, g) => s + g.blurred.length, 0)

  async function getToken() {
    try { return user ? await (user as any).getIdToken() : null } catch { return null }
  }

  // Log helpers for catalog mode
  function addLog(id: string, text: string, status: LogStep["status"], detail?: string) {
    const now = Date.now()
    setLogSteps(prev => {
      if (prev.find(s => s.id === id)) {
        return prev.map(s => s.id === id ? {
          ...s, text, status, detail,
          ...(status === "running" && !s.startedAt ? { startedAt: now } : {}),
          ...(status === "done" || status === "error" ? { endedAt: now } : {}),
        } : s)
      }
      return [...prev, { id, text, status, detail, startedAt: status === "running" ? now : undefined, endedAt: (status === "done" || status === "error") ? now : undefined }]
    })
  }
  function updateLog(id: string, status: LogStep["status"], text?: string, detail?: string) {
    const now = Date.now()
    setLogSteps(prev => prev.map(s => s.id === id ? {
      ...s, status,
      ...(text !== undefined ? { text } : {}),
      ...(detail !== undefined ? { detail } : {}),
      ...(status === "running" && !s.startedAt ? { startedAt: now } : {}),
      ...(status === "done" || status === "error" ? { endedAt: now } : {}),
    } : s))
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

  // ── Catalog discovery handler (3-step wizard) ────────────────────
  async function handleCatalogDiscover() {
    if (!query.trim() || selectedRetailers.length === 0) return

    setCatalogPhase("processing")
    setCatalogResults([])
    setCatalogSelected(new Set())
    setLogSteps([])
    setShowLog(true)
    setLogStartedAt(Date.now())

    const targetCompanies = companies.filter(c => selectedRetailers.includes(retailerValue(c)))
    addLog("init", `Starting discovery for "${query}"`, "running")
    targetCompanies.forEach(c => addLog(`scan-${c.id}`, `Scanning ${c.name}…`, "running"))

    const allGroups: Array<{ company: any; matches: any[] }> = []

    await Promise.all(targetCompanies.map(async company => {
      const t1 = setTimeout(() => updateLog(`scan-${company.id}`, "running", `Scanning ${company.name}…`, "still working…"), 30000)
      const t2 = setTimeout(() => updateLog(`scan-${company.id}`, "running", `Scanning ${company.name}…`, "taking longer than usual…"), 60000)
      try {
        const token = await getToken()
        const res = await fetch(`${API}/api/discovery/search`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ company_id: company.id, query: query.trim() }),
        })
        const json = await res.json()
        clearTimeout(t1); clearTimeout(t2)
        if (json.success) {
          const matches = json.data?.results || []
          allGroups.push({ company, matches })
          updateLog(`scan-${company.id}`, "done", `Scanned ${company.name}`, `→ ${matches.length} product${matches.length !== 1 ? "s" : ""} found`)
        } else {
          updateLog(`scan-${company.id}`, "error", `Scanned ${company.name}`, "→ failed")
        }
      } catch {
        clearTimeout(t1); clearTimeout(t2)
        updateLog(`scan-${company.id}`, "error", `Scanned ${company.name}`, "→ failed")
      }
    }))

    const validGroups = allGroups.filter(g => g.matches.length > 0).sort((a, b) => b.matches.length - a.matches.length)
    const totalFound = validGroups.reduce((s, g) => s + g.matches.length, 0)
    updateLog("init", "done", "Search complete", `${totalFound} products across ${validGroups.length} marketplace${validGroups.length !== 1 ? "s" : ""}`)

    if (validGroups.length === 0) {
      addLog("done", "No products found. Try a different query.", "error")
      setCatalogPhase("search")
      return
    }

    // Auto-select new products that matched with no size mismatch
    const autoSelected = new Set<string>()
    validGroups.forEach(({ company, matches }) => {
      matches.forEach((m: any, i: number) => {
        if (!m.already_tracked && m.match) autoSelected.add(`${company.id}-${i}`)
      })
    })

    addLog("review", `Ready — ${autoSelected.size} new product${autoSelected.size !== 1 ? "s" : ""} to add`, "done")
    setCatalogSelected(autoSelected)
    setCatalogResults(validGroups)
    setCatalogPhase("review")
  }

  async function handleCatalogSave() {
    const toSave: Array<{ companyId: number; product_id: number; url: string; image_url?: string | null; price?: number | null; original_price?: number | null; currency?: string; availability?: string }> = []
    catalogResults.forEach(({ company, matches }) => {
      matches.forEach((m: any, i: number) => {
        const key = `${company.id}-${i}`
        if (catalogSelected.has(key) && m.match && !m.already_tracked) {
          toSave.push({ companyId: company.id, product_id: m.match.product.id, url: m.found.url, image_url: m.found.imageUrl, price: m.found.price, original_price: m.found.original_price, currency: m.found.currency, availability: m.found.availability })
        }
      })
    })
    if (toSave.length === 0) return
    setCatalogSaving(true)
    addLog("save", `Saving ${toSave.length} URL${toSave.length !== 1 ? "s" : ""}…`, "running")
    try {
      const token = await getToken()
      const h = { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      const grouped: Record<number, any[]> = {}
      toSave.forEach(({ companyId, ...rest }) => { if (!grouped[companyId]) grouped[companyId] = []; grouped[companyId].push(rest) })
      let added = 0
      for (const [cId, mappings] of Object.entries(grouped)) {
        const res = await fetch(`${API}/api/discovery/confirm`, { method: "POST", headers: h, body: JSON.stringify({ company_id: Number(cId), mappings }) })
        const json = await res.json()
        if (json.success) added += json.data?.added || 0
      }
      updateLog("save", "done", `Saved ${added} URL${added !== 1 ? "s" : ""}`, "")
      addLog("alldone", `Done! ${added} product${added !== 1 ? "s" : ""} added to monitoring.`, "done")
      setCatalogPhase("results")
    } catch {
      updateLog("save", "error", "Failed to save URLs", "")
    } finally {
      setCatalogSaving(false)
    }
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
          AI-powered product discovery — find prices globally or match to your catalog
        </p>
      </div>

      {/* ── Mode toggle ── */}
      <div className="inline-flex rounded-xl border bg-muted/40 p-1 gap-1">
        <button
          onClick={() => setMode("ai")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${mode === "ai" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Globe className="h-4 w-4" />
          AI Price Search
        </button>
        <button
          onClick={() => setMode("catalog")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${mode === "catalog" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Database className="h-4 w-4" />
          Catalog Discovery
        </button>
      </div>

      {/* ── AI Price Search mode: reuse the B2C component embedded ── */}
      {mode === "ai" && (
        <B2CDiscoveryContent embedded onSearchComplete={onSearchComplete} onNavigate={onNavigate} />
      )}

      {/* ── Catalog Discovery mode ── */}
      {mode === "catalog" && (
        <div className="space-y-5">
          {/* Step indicator */}
          <StepBar current={catalogPhase === "search" || catalogPhase === "processing" ? 1 : catalogPhase === "review" ? 2 : 3} />

          {/* Success banner */}
          {confirmSuccess && (
            <div className="rounded-xl bg-green-500/10 text-green-700 dark:text-green-400 text-sm px-4 py-3 flex items-center gap-2">
              <CheckCircle className="h-4 w-4 shrink-0" />
              {confirmSuccess}
              <button className="ml-auto text-xs underline" onClick={() => setConfirmSuccess(null)}>Dismiss</button>
            </div>
          )}

          {/* ── Step 1: Search form ── */}
          {(catalogPhase === "search" || catalogPhase === "processing") && (
            <div className="rounded-2xl border bg-card p-6 space-y-5 shadow-sm">
              {catalogPhase === "processing" ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium"><span className="text-amber-500 mr-2">●</span>"{query}"</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{companies.filter(c => selectedRetailers.includes(retailerValue(c))).map(c => c.name).join(", ")}</p>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <h2 className="text-lg font-semibold">Search your catalog</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Enter a product name — we'll find it on your stores, match to your catalog, and save prices automatically.
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
                      onKeyDown={(e) => e.key === "Enter" && handleCatalogDiscover()}
                    />
                  </div>

                  {/* Marketplace dropdown */}
                  {companies.length === 0 ? (
                    <div className="rounded-xl border border-input px-4 py-3 text-sm text-muted-foreground">Loading stores…</div>
                  ) : (
                    <MarketplaceDropdown
                      companies={companies}
                      selected={selectedRetailers}
                      onToggle={toggleRetailer}
                      onSelectAll={() => setSelectedRetailers(companies.map(retailerValue))}
                      onDeselectAll={() => setSelectedRetailers([])}
                    />
                  )}

                  <Button
                    className="w-full rounded-xl py-3 gap-2 text-sm font-medium"
                    onClick={handleCatalogDiscover}
                    disabled={!query.trim() || selectedRetailers.length === 0}
                  >
                    <Database className="h-4 w-4" />
                    Discover &amp; Match Catalog
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    {selectedRetailers.length === 0
                      ? "Select at least 1 store to discover"
                      : <><span className="font-medium text-foreground">{selectedRetailers.length} store{selectedRetailers.length !== 1 ? "s" : ""}</span> · <span className="font-medium text-foreground">{selectedRetailers.length} credit{selectedRetailers.length !== 1 ? "s" : ""}</span> will be deducted</>
                    }
                  </p>
                </>
              )}
            </div>
          )}

          {/* ── AI Thinking Log ── */}
          {logSteps.length > 0 && catalogPhase !== "search" && showLog && (
            <ThinkingLog steps={logSteps} startedAt={logStartedAt} onDismiss={() => setShowLog(false)} />
          )}

          {/* ── Step 2: Review results ── */}
          {(catalogPhase === "review" || catalogPhase === "results") && (
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

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">
                  {catalogResults.reduce((s, g) => s + g.matches.length, 0)} products found for "{query}"
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Review matches and select what to track.</p>
              </div>
              <div className="flex items-center gap-2">
                {catalogPhase === "review" && (
                  <Button size="sm" className="gap-1.5" onClick={handleCatalogSave} disabled={catalogSelected.size === 0 || catalogSaving}>
                    {catalogSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    {catalogSaving ? "Saving…" : `Track ${catalogSelected.size} Product${catalogSelected.size !== 1 ? "s" : ""}`}
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => { setCatalogPhase("search"); setCatalogResults([]); setLogSteps([]) }}>
                  New Search
                </Button>
              </div>
            </div>

            {catalogResults.map(({ company, matches }) => {
              const selectableKeys = matches.map((_, i) => `${company.id}-${i}`).filter((_, i) => !matches[i].already_tracked && matches[i].match)
              const allChecked = selectableKeys.length > 0 && selectableKeys.every(k => catalogSelected.has(k))
              return (
                <div key={company.id} className="rounded-2xl border bg-card overflow-hidden">
                  <div className="px-5 py-3 bg-muted/40 border-b flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{company.name}</span>
                      <span className="text-xs text-muted-foreground">{matches.length} result{matches.length !== 1 ? "s" : ""}</span>
                    </div>
                    {catalogPhase === "review" && selectableKeys.length > 0 && (
                      <button onClick={() => {
                        if (allChecked) setCatalogSelected(prev => { const n = new Set(prev); selectableKeys.forEach(k => n.delete(k)); return n })
                        else setCatalogSelected(prev => new Set([...prev, ...selectableKeys]))
                      }} className="text-xs text-muted-foreground hover:text-foreground">
                        {allChecked ? "Deselect all" : "Select all"}
                      </button>
                    )}
                  </div>
                  <div className="divide-y">
                    {matches.map((m: any, i: number) => {
                      const key = `${company.id}-${i}`
                      const isTracked = m.already_tracked
                      const resolvedImage = m.found?.imageUrl ?? null
                      return (
                        <div key={key} className={`p-4 flex items-center gap-3 sm:gap-4 transition-colors ${isTracked ? "opacity-55" : ""}`}>
                          {resolvedImage ? (
                            <img src={resolvedImage} alt={m.found?.name} className="w-12 h-12 rounded-xl object-cover shrink-0 bg-muted" onError={e => { (e.target as HTMLImageElement).style.display = "none" }} />
                          ) : <div className="w-12 h-12 shrink-0" />}
                          <div className="shrink-0">
                            {catalogPhase === "review" && !isTracked && m.match ? (
                              <button onClick={() => setCatalogSelected(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })}
                                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${catalogSelected.has(key) ? "bg-foreground border-foreground" : "border-muted-foreground/30 hover:border-muted-foreground"}`}>
                                {catalogSelected.has(key) && <CheckCircle className="w-3 h-3 text-background" />}
                              </button>
                            ) : isTracked ? <CheckCircle className="w-4 h-4 text-green-500" /> : <div className="w-4 h-4 rounded-full border-2 border-muted" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold mb-0.5 leading-snug line-clamp-1">{m.found?.name}</p>
                            {m.match ? (
                              <p className="text-xs text-muted-foreground mb-1">
                                Matched: <span className="text-foreground">{m.match.product.internal_name}</span>
                                <span className="ml-1.5 px-1.5 py-0.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded text-[10px] font-medium">
                                  {Math.round(m.match.confidence * 100)}%
                                </span>
                              </p>
                            ) : <p className="text-xs text-amber-600 mb-1">No match in catalog</p>}
                            {m.found?.url && (
                              <a href={m.found.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-500 hover:underline">
                                View on {company.name} <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                          <div className="shrink-0 text-right">
                            {isTracked ? <span className="text-xs text-green-600 font-medium">Already tracked</span> :
                              m.found?.price != null ? (
                                <div className="px-3 py-1.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-sm font-semibold text-green-700 dark:text-green-400">
                                  {m.found.currency || "AED"} {m.found.price.toFixed(2)}
                                </div>
                              ) : null}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}

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

      {/* AI Match Dialog — kept for old flow compatibility, not shown in new catalog mode */}
      <Dialog open={showMatch} onOpenChange={(open) => { if (!saving) { setShowMatch(open) } }}>
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
export function DiscoveringContent({ role, onNavigate, selectedHistoryEntry, onClearHistory, onSearchComplete }: { role?: string; onNavigate?: (page: string) => void; selectedHistoryEntry?: any; onClearHistory?: () => void; onSearchComplete?: () => void }) {
  if (role === "b2c") return <B2CDiscoveryContent onNavigate={onNavigate} selectedHistoryEntry={selectedHistoryEntry} onClearHistory={onClearHistory} onSearchComplete={onSearchComplete} />
  return <B2BDiscoveryContent onNavigate={onNavigate} onSearchComplete={onSearchComplete} />
}
