import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog"
import { Package, Plus, Search, Upload, Loader2, CheckCircle, AlertCircle } from "lucide-react"
import { TableSkeleton } from "./PageSkeleton"
import { useAuth } from "@/context/AuthContext"

const API = import.meta.env.VITE_API_URL || "http://localhost:8080"

// ── CSV/TSV parser (handles quoted fields) ────────────────────────
function parseDelimited(text: string): string[][] {
  const sep = text.split("\n")[0].includes("\t") ? "\t" : ","
  return text
    .trim()
    .split("\n")
    .map((line) => {
      const cols: string[] = []
      let cur = "", inQ = false
      for (let i = 0; i < line.length; i++) {
        const ch = line[i]
        if (ch === '"') { inQ = !inQ }
        else if (ch === sep && !inQ) { cols.push(cur.trim()); cur = "" }
        else cur += ch
      }
      cols.push(cur.trim())
      return cols
    })
}

interface ParsedRow {
  internal_name: string
  internal_sku:  string
  barcode:       string
  brand:         string
  initial_rsp:   number | null
  image_url:     string
  is_active:     boolean
}

function mapRow(headers: string[], cols: string[]): ParsedRow | null {
  const get = (key: string) => {
    const idx = headers.findIndex((h) => h.toLowerCase().replace(/\s+/g, " ").trim() === key)
    return idx >= 0 ? (cols[idx] || "").trim() : ""
  }
  const name = get("item name")
  const sku  = get("sku")
  if (!name || !sku) return null
  const rspRaw = get("initial rsp")
  return {
    internal_name: name,
    internal_sku:  sku,
    barcode:       get("id"),          // supplier catalog ID → barcode
    brand:         get("brand"),
    initial_rsp:   rspRaw ? Number(rspRaw) || null : null,
    image_url:     get("imageurl") || get("image url") || get("image_url"),
    is_active:     true,
  }
}

export function ProductsContent() {
  const { user } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading]       = useState(true)
  const [products, setProducts]     = useState<any[]>([])
  const [total, setTotal]           = useState(0)
  const [search, setSearch]         = useState("")
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Import state
  const [parsedRows, setParsedRows]       = useState<ParsedRow[]>([])
  const [brands, setBrands]               = useState<{ name: string; count: number }[]>([])
  const [selectedBrand, setSelectedBrand] = useState<string>("")
  const [importOpen, setImportOpen]       = useState(false)
  const [importing, setImporting]         = useState(false)
  const [importResult, setImportResult]   = useState<any>(null)
  const [importError, setImportError]     = useState<string | null>(null)

  async function getToken() {
    try { return user ? await (user as any).getIdToken() : null } catch { return null }
  }

  async function fetchProducts(q = "") {
    try {
      const token = await getToken()
      const params = new URLSearchParams({ limit: "200", offset: "0" })
      if (q) params.set("search", q)
      const res = await fetch(`${API}/api/products?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message || "Failed to load")
      setProducts(json.data || [])
      setTotal(json.total || 0)
      setFetchError(null)
    } catch (err: any) {
      setFetchError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!user) return
    fetchProducts()
  }, [user])

  // Debounced search
  useEffect(() => {
    if (!user) return
    const t = setTimeout(() => fetchProducts(search), 350)
    return () => clearTimeout(t)
  }, [search])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    // reset so the same file can be re-selected
    e.target.value = ""

    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const rows = parseDelimited(text)
      if (rows.length < 2) { alert("File appears empty or invalid."); return }

      const headers = rows[0].map((h) => h.toLowerCase().replace(/\s+/g, " ").trim())
      const data: ParsedRow[] = []
      for (let i = 1; i < rows.length; i++) {
        const row = mapRow(headers, rows[i])
        if (row) data.push(row)
      }

      if (!data.length) { alert("No valid rows found. Check that your file has Item Name and SKU columns."); return }

      // Extract unique brands with counts
      const brandMap = new Map<string, number>()
      for (const r of data) {
        const b = r.brand || "Unknown"
        brandMap.set(b, (brandMap.get(b) || 0) + 1)
      }
      const brandList = [...brandMap.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => a.name.localeCompare(b.name))

      setParsedRows(data)
      setBrands(brandList)
      setSelectedBrand(brandList[0]?.name || "")
      setImportResult(null)
      setImportError(null)
      setImportOpen(true)
    }
    reader.readAsText(file)
  }

  async function handleImport() {
    if (!selectedBrand) return
    const toImport = parsedRows.filter((r) => (r.brand || "Unknown") === selectedBrand)
    if (!toImport.length) return

    setImporting(true)
    setImportError(null)
    setImportResult(null)
    try {
      const token = await getToken()
      const res = await fetch(`${API}/api/products/import`, {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ products: toImport }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error?.message || "Import failed")
      setImportResult(json.data)
      // Refresh products list
      await fetchProducts(search)
    } catch (err: any) {
      setImportError(err.message)
    } finally {
      setImporting(false)
    }
  }

  if (loading) return <TableSkeleton rows={6} />

  const activeCount  = products.filter((p) => p.is_active).length
  const withUrlCount = products.filter((p) => Number(p.url_count) > 0).length

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold">Products</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Internal product catalog being monitored.</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.tsv,.txt"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Import</span>
          </Button>
          <Button size="sm" className="gap-1.5" disabled>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Product</span>
          </Button>
        </div>
      </div>

      {fetchError && (
        <div className="rounded-md bg-destructive/10 text-destructive text-sm px-4 py-3 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {fetchError}
        </div>
      )}

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

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
        {[
          { label: "Total Products", value: String(total) },
          { label: "Active",         value: String(activeCount) },
          { label: "With URLs",      value: String(withUrlCount) },
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
          <CardDescription className="text-xs">{products.length} of {total} products</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Package className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                {search ? "No products match your search." : "No products yet. Use Import to add your catalog."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Name</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden sm:table-cell">SKU</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">Brand</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground hidden lg:table-cell">RSP</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">URLs</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium max-w-[200px] truncate">{p.internal_name}</td>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs hidden sm:table-cell">{p.internal_sku}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{p.brand || "—"}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground hidden lg:table-cell">
                        {p.initial_rsp != null ? `AED ${p.initial_rsp}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={Number(p.url_count) > 0 ? "default" : "secondary"} className="text-[10px]">
                          {p.url_count ?? 0}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={p.is_active ? "default" : "secondary"} className="text-[10px]">
                          {p.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Import Brand Dialog */}
      <Dialog open={importOpen} onOpenChange={(open) => { if (!importing) setImportOpen(open) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Select Brand to Import</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">
              {parsedRows.length} products found in file. Choose a brand to import:
            </p>

            <div className="space-y-2 max-h-56 overflow-y-auto">
              {brands.map((b) => (
                <label
                  key={b.name}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
                    selectedBrand === b.name ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <input
                      type="radio"
                      name="brand"
                      value={b.name}
                      checked={selectedBrand === b.name}
                      onChange={() => setSelectedBrand(b.name)}
                      className="accent-primary"
                    />
                    <span className="text-sm font-medium">{b.name}</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">{b.count} products</Badge>
                </label>
              ))}
            </div>

            {importResult && (
              <div className="rounded-md bg-green-500/10 text-green-700 dark:text-green-400 text-xs px-3 py-2.5 space-y-0.5">
                <div className="flex items-center gap-1.5 font-medium">
                  <CheckCircle className="h-3.5 w-3.5" /> Import complete
                </div>
                <div>Inserted: {importResult.inserted} · Updated: {importResult.updated} · Skipped: {importResult.skipped}</div>
              </div>
            )}

            {importError && (
              <div className="flex items-start gap-2 rounded-md bg-destructive/10 text-destructive text-xs px-3 py-2">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                {importError}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setImportOpen(false)}
              disabled={importing}
            >
              {importResult ? "Close" : "Cancel"}
            </Button>
            {!importResult && (
              <Button
                size="sm"
                onClick={handleImport}
                disabled={!selectedBrand || importing}
                className="gap-1.5"
              >
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {importing
                  ? "Importing…"
                  : `Import ${parsedRows.filter((r) => (r.brand || "Unknown") === selectedBrand).length} products`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
