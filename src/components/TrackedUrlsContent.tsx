import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { Link, Plus, CheckCircle, XCircle, Clock } from "lucide-react"
import { TableSkeleton } from "./PageSkeleton"

const mockUrls = [
  { product: "Marvis Classic Mint 75ml", store: "Amazon AE",     url: "amazon.ae/dp/B07…", status: "success", checked: "2 hrs ago" },
  { product: "Marvis Classic Mint 75ml", store: "Noon",          url: "noon.com/uae-en/…",  status: "success", checked: "2 hrs ago" },
  { product: "Marvis Whitening 75ml",    store: "Carrefour UAE", url: "carrefouruae.com/…", status: "timeout", checked: "3 hrs ago" },
  { product: "Marvis Whitening 75ml",    store: "Amazon AE",     url: "amazon.ae/dp/C09…", status: "error",   checked: "5 hrs ago" },
]

const statusIcon = (status: string) => {
  if (status === "success") return <CheckCircle className="h-4 w-4 text-green-500" />
  if (status === "error")   return <XCircle     className="h-4 w-4 text-red-500"   />
  return                           <Clock       className="h-4 w-4 text-yellow-500" />
}

export function TrackedUrlsContent() {
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
          <h1 className="text-xl sm:text-2xl font-semibold">Tracked Listings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            All product URLs being actively monitored.
          </p>
        </div>
        <Button size="sm" className="gap-1.5 shrink-0">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Add URL</span>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
        {[
          { label: "Total Tracked", value: String(mockUrls.length), icon: Link },
          { label: "Last Sync OK",  value: String(mockUrls.filter(u => u.status === "success").length), icon: CheckCircle },
          { label: "Errors",        value: String(mockUrls.filter(u => u.status !== "success").length), icon: XCircle },
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

      {/* URL table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active Listings</CardTitle>
          <CardDescription className="text-xs">Product pages with last scrape status</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Product</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden sm:table-cell">Store</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden lg:table-cell">URL</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">Last Check</th>
                </tr>
              </thead>
              <tbody>
                {mockUrls.map((row, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium">{row.product}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{row.store}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs font-mono hidden lg:table-cell truncate max-w-[200px]">{row.url}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center">{statusIcon(row.status)}</div>
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground hidden md:table-cell">{row.checked}</td>
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
