import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "./ui/sheet"
import { Link, Plus, CheckCircle, XCircle, Clock, AlertCircle, Loader2, ExternalLink } from "lucide-react"
import { TableSkeleton } from "./PageSkeleton"
import { useAuth } from "@/context/AuthContext"

const API = import.meta.env.VITE_API_URL || "http://localhost:8080"

const statusIcon = (status: string) => {
  if (status === "success") return <CheckCircle className="h-4 w-4 text-green-500" />
  if (status === "error")   return <XCircle     className="h-4 w-4 text-red-500"   />
  return                           <Clock       className="h-4 w-4 text-yellow-500" />
}

export function TrackedUrlsContent() {
  const { user } = useAuth()
  const [loading, setLoading]     = useState(true)
  const [urls, setUrls]           = useState<any[]>([])
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Add URL sheet
  const [open, setOpen]             = useState(false)
  const [products, setProducts]     = useState<any[]>([])
  const [companies, setCompanies]   = useState<any[]>([])
  const [productId, setProductId]   = useState("")
  const [companyId, setCompanyId]   = useState("")
  const [productUrl, setProductUrl] = useState("")
  const [saving, setSaving]         = useState(false)
  const [saveError, setSaveError]   = useState<string | null>(null)

  async function getToken() {
    try { return user ? await (user as any).getIdToken() : null } catch { return null }
  }

  async function fetchAll() {
    try {
      const token = await getToken()
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const [urlsRes, prodsRes, compsRes] = await Promise.all([
        fetch(`${API}/api/product-company-urls?limit=200`, { headers }),
        fetch(`${API}/api/products?limit=500`, { headers }),
        fetch(`${API}/api/companies`, { headers }),
      ])
      const [urlsJson, prodsJson, compsJson] = await Promise.all([
        urlsRes.json(), prodsRes.json(), compsRes.json(),
      ])
      if (!urlsJson.success)  throw new Error(urlsJson.error?.message  || "Failed to load URLs")
      if (!prodsJson.success) throw new Error(prodsJson.error?.message || "Failed to load products")
      if (!compsJson.success) throw new Error(compsJson.error?.message || "Failed to load stores")
      setUrls(urlsJson.data || [])
      setProducts(prodsJson.data || [])
      setCompanies((compsJson.data || []).filter((c: any) => c.is_active))
      setFetchError(null)
    } catch (err: any) {
      setFetchError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!user) return
    fetchAll()
  }, [user])

  function resetForm() {
    setProductId(""); setCompanyId(""); setProductUrl(""); setSaveError(null)
  }

  async function handleAdd() {
    if (!productId || !companyId || !productUrl.trim()) return
    setSaving(true)
    setSaveError(null)
    try {
      const token = await getToken()
      const res = await fetch(`${API}/api/product-company-urls`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          product_id:  Number(productId),
          company_id:  Number(companyId),
          product_url: productUrl.trim(),
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error?.message || "Failed to add URL")
      setOpen(false)
      resetForm()
      await fetchAll()
    } catch (err: any) {
      setSaveError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <TableSkeleton rows={6} />

  const successCount = urls.filter((u) => u.last_status === "success").length
  const errorCount   = urls.filter((u) => u.last_status && u.last_status !== "success").length

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold">Tracked Listings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            All product URLs being actively monitored.
          </p>
        </div>
        <Button size="sm" className="gap-1.5 shrink-0" onClick={() => { resetForm(); setOpen(true) }}>
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Add URL</span>
        </Button>
      </div>

      {fetchError && (
        <div className="rounded-md bg-destructive/10 text-destructive text-sm px-4 py-3 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {fetchError}
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
        {[
          { label: "Total Tracked", value: String(urls.length),   icon: Link },
          { label: "Last Sync OK",  value: String(successCount),  icon: CheckCircle },
          { label: "Errors",        value: String(errorCount),    icon: XCircle },
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
          {urls.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Link className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No tracked URLs yet. Add your first URL above.</p>
            </div>
          ) : (
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
                  {urls.map((row) => (
                    <tr key={row.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium max-w-[180px] truncate">{row.internal_name || `Product #${row.product_id}`}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{row.company_name || `Store #${row.company_id}`}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs hidden lg:table-cell">
                        <a
                          href={row.product_url} target="_blank" rel="noopener noreferrer"
                          className="hover:underline flex items-center gap-1 max-w-[220px] truncate"
                        >
                          <span className="truncate font-mono">{row.product_url}</span>
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center">
                          {row.last_status ? statusIcon(row.last_status) : <Clock className="h-4 w-4 text-muted-foreground/40" />}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground hidden md:table-cell">
                        {row.last_checked_at
                          ? new Date(row.last_checked_at).toLocaleDateString()
                          : "Never"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add URL Sheet */}
      <Sheet open={open} onOpenChange={(v) => { if (!saving) setOpen(v) }}>
        <SheetContent side="right" className="flex flex-col">
          <SheetHeader className="border-b pb-4">
            <SheetTitle>Add Tracked URL</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Product *</label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
              >
                <option value="">Select a product…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.internal_name}{p.internal_sku ? ` (${p.internal_sku})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Store *</label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
              >
                <option value="">Select a store…</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Product URL *</label>
              <Input
                placeholder="https://www.amazon.ae/dp/…"
                value={productUrl}
                onChange={(e) => setProductUrl(e.target.value)}
              />
            </div>

            {saveError && (
              <div className="flex items-start gap-2 rounded-md bg-destructive/10 text-destructive text-xs px-3 py-2">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                {saveError}
              </div>
            )}
          </div>

          <SheetFooter className="border-t pt-4 flex-row gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              className="flex-1 gap-1.5"
              onClick={handleAdd}
              disabled={!productId || !companyId || !productUrl.trim() || saving}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {saving ? "Adding…" : "Add URL"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
