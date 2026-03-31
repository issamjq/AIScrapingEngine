import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Package, Plus, Search, Upload } from "lucide-react"
import { TableSkeleton } from "./PageSkeleton"

const mockProducts = [
  { id: 1, name: "Marvis Classic Mint Toothpaste 75ml", sku: "MRV-001", brand: "Marvis", urls: 3, active: true },
  { id: 2, name: "Marvis Whitening Mint 75ml",          sku: "MRV-002", brand: "Marvis", urls: 2, active: true },
  { id: 3, name: "Marvis Amarelli Licorice 75ml",       sku: "MRV-003", brand: "Marvis", urls: 1, active: true },
  { id: 4, name: "Marvis Aquatic Mint 75ml",            sku: "MRV-004", brand: "Marvis", urls: 0, active: false },
]

export function ProductsContent() {
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 900)
    return () => clearTimeout(t)
  }, [])

  if (loading) return <TableSkeleton rows={6} />

  const filtered = mockProducts.filter(
    (p) => p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold">Products</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Internal product catalog being monitored.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" className="gap-1.5">
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Import</span>
          </Button>
          <Button size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Product</span>
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or SKU…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Summary */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
        {[
          { label: "Total Products", value: String(mockProducts.length) },
          { label: "Active",         value: String(mockProducts.filter(p => p.active).length) },
          { label: "With URLs",      value: String(mockProducts.filter(p => p.urls > 0).length) },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
              <CardTitle className="text-xs sm:text-sm font-medium">{label}</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground shrink-0" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-xl sm:text-2xl font-bold">{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Product table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Product Catalog</CardTitle>
          <CardDescription className="text-xs">{filtered.length} of {mockProducts.length} products</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden sm:table-cell">SKU</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">Brand</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">URLs</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors cursor-pointer">
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs hidden sm:table-cell">{p.sku}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{p.brand}</td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={p.urls > 0 ? "default" : "secondary"} className="text-[10px]">
                        {p.urls}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={p.active ? "default" : "secondary"} className="text-[10px]">
                        {p.active ? "Active" : "Inactive"}
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
