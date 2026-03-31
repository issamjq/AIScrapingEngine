import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { TrendingUp, TrendingDown, Minus, RefreshCw, Filter } from "lucide-react"
import { TableSkeleton } from "./PageSkeleton"

const mockPrices = [
  { product: "Marvis Classic Mint 75ml", store: "Amazon AE",    price: "AED 49.50", change: "+2.5%",   trend: "up",   status: "in_stock" },
  { product: "Marvis Classic Mint 75ml", store: "Noon",         price: "AED 47.00", change: "—",        trend: "flat", status: "in_stock" },
  { product: "Marvis Whitening 75ml",    store: "Carrefour UAE", price: "AED 52.00", change: "-3.0%",   trend: "down", status: "in_stock" },
  { product: "Marvis Whitening 75ml",    store: "Amazon AE",    price: "AED 55.00", change: "+1.0%",   trend: "up",   status: "out_of_stock" },
]

export function PriceBoardContent() {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 900)
    return () => clearTimeout(t)
  }, [])

  if (loading) return <TableSkeleton rows={6} />

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold">Price Activity</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Latest scraped prices across all monitored products and stores.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" className="gap-1.5">
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">Filter</span>
          </Button>
          <Button size="sm" className="gap-1.5">
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">Sync All</span>
          </Button>
        </div>
      </div>

      {/* Price table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Current Prices</CardTitle>
          <CardDescription className="text-xs">Latest successful scrape per product × store</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Product</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Store</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Price</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground hidden sm:table-cell">Change</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">Status</th>
                </tr>
              </thead>
              <tbody>
                {mockPrices.map((row, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium">{row.product}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.store}</td>
                    <td className="px-4 py-3 text-right font-mono font-medium">{row.price}</td>
                    <td className="px-4 py-3 text-right hidden sm:table-cell">
                      <span className={`flex items-center justify-end gap-1 text-xs font-medium ${
                        row.trend === "up" ? "text-red-500" :
                        row.trend === "down" ? "text-green-500" : "text-muted-foreground"
                      }`}>
                        {row.trend === "up"   && <TrendingUp   className="h-3.5 w-3.5" />}
                        {row.trend === "down" && <TrendingDown className="h-3.5 w-3.5" />}
                        {row.trend === "flat" && <Minus        className="h-3.5 w-3.5" />}
                        {row.change}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center hidden md:table-cell">
                      <Badge
                        variant={row.status === "in_stock" ? "default" : "destructive"}
                        className="text-[10px]"
                      >
                        {row.status === "in_stock" ? "In Stock" : "Out of Stock"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
