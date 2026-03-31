import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { Building2, Plus, CheckCircle } from "lucide-react"
import { CardGridSkeleton } from "./PageSkeleton"

const mockStores = [
  { name: "Amazon AE",     slug: "amazon-ae",     baseUrl: "amazon.ae",          active: true,  products: 12 },
  { name: "Noon",          slug: "noon",           baseUrl: "noon.com",           active: true,  products: 8  },
  { name: "Carrefour UAE", slug: "carrefour-uae",  baseUrl: "carrefouruae.com",   active: true,  products: 6  },
  { name: "Spinneys",      slug: "spinneys",       baseUrl: "spinneys.com",       active: false, products: 0  },
]

export function CompaniesContent() {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 900)
    return () => clearTimeout(t)
  }, [])

  if (loading) return <CardGridSkeleton count={4} />

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold">Stores</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Retailers and marketplaces being monitored.
          </p>
        </div>
        <Button size="sm" className="gap-1.5 shrink-0">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Add Store</span>
        </Button>
      </div>

      {/* Summary */}
      <div className="grid gap-4 grid-cols-2">
        {[
          { label: "Total Stores",  value: String(mockStores.length) },
          { label: "Active Stores", value: String(mockStores.filter(s => s.active).length) },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
              <CardTitle className="text-xs sm:text-sm font-medium">{label}</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-xl sm:text-2xl font-bold">{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Store cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {mockStores.map((store) => (
          <Card key={store.slug} className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                </div>
                <Badge
                  variant={store.active ? "default" : "secondary"}
                  className="text-[10px]"
                >
                  {store.active ? "Active" : "Inactive"}
                </Badge>
              </div>
              <CardTitle className="text-base mt-3">{store.name}</CardTitle>
              <CardDescription className="text-xs">{store.baseUrl}</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                  {store.products} products tracked
                </span>
                <Button variant="ghost" size="sm" className="h-7 text-xs px-2">
                  Configure
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
