import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Badge } from "./ui/badge"
import { Checkbox } from "./ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog"
import {
  Compass, Search, CheckCircle, ExternalLink,
  Loader2, Plus, AlertCircle, Lock, Sparkles,
} from "lucide-react"
import { PageSkeleton } from "./PageSkeleton"
import { useAuth } from "@/context/AuthContext"

const API = import.meta.env.VITE_API_URL || "http://localhost:8080"

const FREE_LIMIT = 3   // visible per retailer group

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

function matchCompany(retailerStr: string, companies: any[]): any | null {
  const name = retailerStr.replace(/\s*\([^)]*\)/, "").trim().toLowerCase()
  return (
    companies.find((c) => c.name.toLowerCase() === name) ||
    companies.find((c) => c.name.toLowerCase().includes(name) || name.includes(c.name.toLowerCase())) ||
    companies.find((c) => name.split(" ").some((w) => c.slug?.toLowerCase().includes(w))) ||
    null
  )
}

export function DiscoveringContent() {
  const { user } = useAuth()

  const [loading, setLoading]                     = useState(true)
  const [companies, setCompanies]                 = useState<any[]>([])
  const [products, setProducts]                   = useState<any[]>([])

  const [query, setQuery]                         = useState("")
  const [selectedRetailers, setSelectedRetailers] = useState<string[]>(
    DEFAULT_RETAILERS.slice(0, 3).map((r) => r.value)
  )
  const [searching, setSearching]                 = useState(false)
  const [groups, setGroups]                       = useState<RetailerGroup[]>([])
  const [totalFound, setTotalFound]               = useState(0)
  const [searched, setSearched]                   = useState(false)
  const [searchError, setSearchError]             = useState<string | null>(null)
  const [confirmed, setConfirmed]                 = useState<Set<string>>(new Set())

  // Confirm dialog
  const [showConfirm, setShowConfirm]             = useState(false)
  const [productSearch, setProductSearch]         = useState("")
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null)
  const [confirming, setConfirming]               = useState(false)
  const [confirmError, setConfirmError]           = useState<string | null>(null)
  const [confirmSuccess, setConfirmSuccess]       = useState<string | null>(null)

  async function getToken() {
    try { return user ? await (user as any).getIdToken() : null } catch { return null }
  }

  useEffect(() => {
    if (!user) return
    let cancelled = false
    async function load() {
      try {
        const token = await (user as any).getIdToken()
        const h = { Authorization: `Bearer ${token}` }
        const [cr, pr] = await Promise.all([
          fetch(`${API}/api/companies`, { headers: h }),
          fetch(`${API}/api/products?limit=500`, { headers: h }),
        ])
        if (cancelled) return
        const [cj, pj] = await Promise.all([cr.json(), pr.json()])
        if (cj.success) setCompanies(cj.data || [])
        if (pj.success) setProducts(pj.data || [])
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
    setTotalFound(0)
    setSearched(false)
    setConfirmed(new Set())
    setConfirmSuccess(null)
    try {
      const token = await getToken()
      const res = await fetch(`${API}/api/discovery/ai-search`, {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ query: query.trim(), retailers: selectedRetailers }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error?.message || "Search failed")
      const results: SearchResult[] = json.data.results || []
      setGroups(groupByRetailer(results))
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

  function openConfirmDialog() {
    setSelectedProductId(null)
    setProductSearch("")
    setConfirmError(null)
    setShowConfirm(true)
  }

  async function handleAddToTracked() {
    if (!selectedProductId) { setConfirmError("Please select a product."); return }

    // Collect all visible confirmed results
    const allVisible = groups.flatMap((g) => g.visible)
    const selectedResults = allVisible.filter((r) => confirmed.has(r.url))
    if (!selectedResults.length) return

    const groupsMap = new Map<number, { url: string }[]>()
    const unmatched: string[] = []

    for (const r of selectedResults) {
      const company = matchCompany(r.retailer, companies)
      if (!company) { unmatched.push(r.retailer); continue }
      if (!groupsMap.has(company.id)) groupsMap.set(company.id, [])
      groupsMap.get(company.id)!.push({ url: r.url })
    }

    if (groupsMap.size === 0) {
      setConfirmError(
        `Could not match any retailer to a company in your database. ` +
        `Make sure these retailers are added: ${[...new Set(unmatched)].join(", ")}`
      )
      return
    }

    setConfirming(true)
    setConfirmError(null)
    try {
      const token = await getToken()
      const h = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      }
      let totalAdded = 0
      for (const [companyId, mappings] of groupsMap) {
        const res = await fetch(`${API}/api/discovery/confirm`, {
          method:  "POST",
          headers: h,
          body: JSON.stringify({
            company_id: companyId,
            mappings: mappings.map((m) => ({ product_id: selectedProductId, url: m.url })),
          }),
        })
        const json = await res.json()
        if (json.success) totalAdded += json.data?.added || 0
      }
      if (unmatched.length) {
        setConfirmError(`Added ${totalAdded} URL(s). Could not match: ${[...new Set(unmatched)].join(", ")}`)
      } else {
        setConfirmSuccess(`Successfully added ${totalAdded} URL(s) to tracked listings.`)
      }
      setShowConfirm(false)
      setConfirmed(new Set())
    } catch (err: any) {
      setConfirmError(err.message)
    } finally {
      setConfirming(false)
    }
  }

  const filteredProducts = products.filter((p) =>
    !productSearch.trim() ||
    p.internal_name?.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.internal_sku?.toLowerCase().includes(productSearch.toLowerCase())
  )

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
            AI searches up to 10 listings across selected retailers — results in under 30 seconds.
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
          {/* Success banner */}
          {confirmSuccess && (
            <div className="rounded-md bg-green-500/10 text-green-700 dark:text-green-400 text-sm px-4 py-3 mb-4 flex items-center gap-2">
              <CheckCircle className="h-4 w-4 shrink-0" />
              {confirmSuccess}
            </div>
          )}

          {/* Empty state */}
          {!searched && !searching && (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
              <Compass className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Run a discovery search to see results here.</p>
            </div>
          )}

          {/* Loading */}
          {searching && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/60" />
              <p className="text-sm text-muted-foreground">Claude is searching across retailers…</p>
              <p className="text-xs text-muted-foreground/60">Up to 30 seconds</p>
            </div>
          )}

          {/* Error */}
          {searchError && (
            <div className="rounded-md bg-destructive/10 text-destructive text-sm px-4 py-3">
              {searchError}
            </div>
          )}

          {/* No results */}
          {searched && !searchError && groups.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Compass className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No listings found. Try a more specific product name.</p>
            </div>
          )}

          {/* Results grouped by retailer */}
          {groups.length > 0 && (
            <div className="space-y-6">
              {groups.map((group) => (
                <div key={group.retailer}>
                  {/* Retailer header */}
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="outline" className="text-xs font-medium">{group.retailer}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {group.visible.length + group.blurred.length} listing{group.visible.length + group.blurred.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Visible results (first 3) */}
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
                            href={r.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 truncate"
                          >
                            <ExternalLink className="h-3 w-3 shrink-0" />
                            <span className="truncate">{r.url}</span>
                          </a>
                        </div>
                        {confirmed.has(r.url) && (
                          <CheckCircle className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Blurred results (4+) */}
                  {group.blurred.length > 0 && (
                    <div className="relative rounded-lg overflow-hidden">
                      {/* Blur overlay */}
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
                          <p className="text-xs text-muted-foreground mb-3">
                            Upgrade to Pro to unlock all results
                          </p>
                          <Button size="sm" className="w-full gap-1.5">
                            <Sparkles className="h-3.5 w-3.5" />
                            Upgrade to Pro
                          </Button>
                        </div>
                      </div>
                      {/* Blurred content underneath */}
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

              {/* Confirm button */}
              {confirmed.size > 0 && (
                <div className="pt-2 flex justify-end border-t">
                  <Button size="sm" className="gap-1.5" onClick={openConfirmDialog}>
                    <Plus className="h-4 w-4" />
                    Add {confirmed.size} to Tracked URLs
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
          { label: "Listings Found",    value: searched ? String(totalFound) : "—",         icon: Compass },
          { label: "Retailers Searched", value: searched ? String(groups.length) : "—",     icon: Search },
          { label: "Locked Results",    value: searched ? String(totalBlurred) : "—",       icon: Lock },
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

      {/* Confirm Dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add to Tracked URLs</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">URLs to add ({confirmed.size})</p>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {groups.flatMap((g) => g.visible).filter((r) => confirmed.has(r.url)).map((r) => (
                  <div key={r.url} className="flex items-center gap-2 text-xs">
                    <Badge variant="outline" className="text-[10px] shrink-0">{r.retailer}</Badge>
                    <span className="truncate text-muted-foreground">{r.title}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t pt-4 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Link to product</p>
              <Input
                placeholder="Search product catalog…"
                value={productSearch}
                onChange={(e) => { setProductSearch(e.target.value); setSelectedProductId(null) }}
                className="text-sm"
              />
              <div className="border rounded-md max-h-40 overflow-y-auto divide-y">
                {filteredProducts.length === 0 && (
                  <p className="text-xs text-muted-foreground px-3 py-4 text-center">
                    {products.length === 0 ? "No products in catalog yet." : "No products match."}
                  </p>
                )}
                {filteredProducts.slice(0, 30).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => { setSelectedProductId(p.id); setProductSearch(p.internal_name) }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors flex items-center gap-2 ${
                      selectedProductId === p.id ? "bg-muted" : ""
                    }`}
                  >
                    {selectedProductId === p.id && <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />}
                    <span className="truncate">{p.internal_name}</span>
                    {p.brand && <span className="text-xs text-muted-foreground shrink-0">{p.brand}</span>}
                  </button>
                ))}
              </div>
            </div>

            {confirmError && (
              <div className="flex items-start gap-2 rounded-md bg-destructive/10 text-destructive text-xs px-3 py-2">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                {confirmError}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowConfirm(false)} disabled={confirming}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleAddToTracked} disabled={!selectedProductId || confirming} className="gap-1.5">
              {confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {confirming ? "Adding…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
