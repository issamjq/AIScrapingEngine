import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Badge } from "./ui/badge"
import { Compass, Search, CheckCircle, Plus } from "lucide-react"
import { PageSkeleton } from "./PageSkeleton"

export function DiscoveringContent() {
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 900)
    return () => clearTimeout(t)
  }, [])

  if (loading) return <PageSkeleton cards={2} rows={4} />

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold">Market Discovery</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Auto-discover product listings across retailers using AI.
          </p>
        </div>
      </div>

      {/* Search bar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Compass className="h-4 w-4" />
            Discover Products
          </CardTitle>
          <CardDescription className="text-xs">
            Enter a search query and select a store to find matching products.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="e.g. Marvis Classic Mint Toothpaste"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1"
            />
            <Button className="gap-1.5" disabled={!query.trim()}>
              <Search className="h-4 w-4" />
              <span className="hidden sm:inline">Search</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Discovery Results</CardTitle>
          <CardDescription className="text-xs">AI-matched products from retailer pages</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
            <Compass className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Run a discovery search to see matched products here.</p>
            <div className="flex gap-2 flex-wrap justify-center mt-2">
              {["Amazon AE", "Noon", "Carrefour UAE"].map((store) => (
                <Badge key={store} variant="outline" className="text-xs cursor-pointer hover:bg-accent">
                  {store}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
        {[
          { label: "Products Discovered",  value: "—", icon: Compass },
          { label: "Matches Confirmed",     value: "—", icon: CheckCircle },
          { label: "Stores Probed",         value: "—", icon: Plus },
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
