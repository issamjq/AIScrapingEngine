import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Badge } from "./ui/badge"
import { Checkbox } from "./ui/checkbox"
import { Compass, Search, CheckCircle, ExternalLink, Loader2, Plus } from "lucide-react"
import { PageSkeleton } from "./PageSkeleton"
import { useAuth } from "@/context/AuthContext"

const API = import.meta.env.VITE_API_URL || "http://localhost:8080"

const DEFAULT_RETAILERS = [
  { label: "Amazon AE",      value: "Amazon AE (amazon.ae)" },
  { label: "Noon",           value: "Noon (noon.com)" },
  { label: "Carrefour UAE",  value: "Carrefour UAE (carrefouruae.com)" },
  { label: "Talabat",        value: "Talabat Grocery (talabat.com)" },
  { label: "Spinneys",       value: "Spinneys UAE (spinneys.com)" },
]

interface SearchResult {
  retailer: string
  url:      string
  title:    string
}

export function DiscoveringContent() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [selectedRetailers, setSelectedRetailers] = useState<string[]>(
    DEFAULT_RETAILERS.slice(0, 3).map((r) => r.value)
  )
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set())

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 600)
    return () => clearTimeout(t)
  }, [])

  async function getToken() {
    if (!user) return null
    try { return await (user as any).getIdToken() } catch { return null }
  }

  async function handleSearch() {
    if (!query.trim() || searching) return
    setSearching(true)
    setError(null)
    setResults([])
    setSearched(false)
    setConfirmed(new Set())

    try {
      const token = await getToken()
      const res = await fetch(`${API}/api/discovery/ai-search`, {
        method:  "POST",
        headers: {
          "Content-Type":  "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ query: query.trim(), retailers: selectedRetailers }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error?.message || "Search failed")
      setResults(json.data.results || [])
      setSearched(true)
    } catch (err: any) {
      setError(err.message)
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

  if (loading) return <PageSkeleton cards={2} rows={4} />

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold">Market Discovery</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Auto-discover product listings across retailers using AI web search.
          </p>
        </div>
      </div>

      {/* Search card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Compass className="h-4 w-4" />
            Discover Products
          </CardTitle>
          <CardDescription className="text-xs">
            Enter a product name — AI will search and find the exact listing on each selected retailer.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Retailer checkboxes */}
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

          {/* Search input */}
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
              {searching
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Search className="h-4 w-4" />}
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
            {searched && !error
              ? `Found ${results.length} listing${results.length !== 1 ? "s" : ""} for "${query}"`
              : "AI-matched product listings from retailer pages"}
          </CardDescription>
        </CardHeader>
        <CardContent>
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
            </div>
          )}

          {error && (
            <div className="rounded-md bg-destructive/10 text-destructive text-sm px-4 py-3">
              {error}
            </div>
          )}

          {searched && !error && results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Compass className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No listings found. Try a more specific product name.</p>
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-3">
              {results.map((r) => (
                <div key={r.url} className="flex items-start gap-3 rounded-lg border p-3">
                  <Checkbox
                    checked={confirmed.has(r.url)}
                    onCheckedChange={() => toggleConfirm(r.url)}
                    className="mt-0.5 shrink-0"
                  />
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" className="text-xs shrink-0">{r.retailer}</Badge>
                      <span className="text-sm font-medium truncate">{r.title}</span>
                    </div>
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

              {confirmed.size > 0 && (
                <div className="pt-2 flex justify-end">
                  <Button size="sm" className="gap-1.5">
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
          { label: "Products Found",    value: searched ? String(results.length) : "—", icon: Compass },
          { label: "Retailers Searched", value: searched ? String(selectedRetailers.length) : "—", icon: Search },
          { label: "Ready to Track",    value: searched ? String(confirmed.size) : "—", icon: CheckCircle },
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
    </div>
  )
}
