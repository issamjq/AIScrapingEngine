import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "./ui/sheet"
import { Building2, Plus, CheckCircle, Loader2, AlertCircle, ExternalLink, Pencil } from "lucide-react"
import { CardGridSkeleton } from "./PageSkeleton"
import { useAuth } from "@/context/AuthContext"

const API = import.meta.env.VITE_API_URL || "http://localhost:8080"

function slugify(name: string) {
  return name.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
}

function domainFromUrl(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, "") } catch { return url }
}

export function CompaniesContent(_: { role?: string }) {
  const { user } = useAuth()
  const [loading, setLoading]     = useState(true)
  const [companies, setCompanies] = useState<any[]>([])
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Add / Edit Store sheet
  const [open, setOpen]         = useState(false)
  const [editTarget, setEditTarget] = useState<any | null>(null)
  const [name, setName]         = useState("")
  const [baseUrl, setBaseUrl]   = useState("")
  const [saving, setSaving]     = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  function openAdd() {
    setEditTarget(null)
    setName("")
    setBaseUrl("")
    setSaveError(null)
    setOpen(true)
  }

  function openEdit(c: any) {
    setEditTarget(c)
    setName(c.name)
    setBaseUrl(c.base_url || "")
    setSaveError(null)
    setOpen(true)
  }

  async function getToken() {
    try { return user ? await (user as any).getIdToken() : null } catch { return null }
  }

  async function fetchCompanies() {
    try {
      const token = await getToken()
      const res = await fetch(`${API}/api/companies?include_inactive=true`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message || "Failed to load")
      setCompanies(json.data || [])
      setFetchError(null)
    } catch (err: any) {
      setFetchError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!user) return
    fetchCompanies()
  }, [user])

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    setSaveError(null)
    try {
      const token = await getToken()
      const isEdit = !!editTarget
      const url  = isEdit ? `${API}/api/companies/${editTarget.id}` : `${API}/api/companies`
      const body = isEdit
        ? { name: name.trim(), base_url: baseUrl.trim() || null }
        : { name: name.trim(), slug: slugify(name), base_url: baseUrl.trim() || null }
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error?.message || `Failed to ${isEdit ? "update" : "add"} store`)
      setOpen(false)
      setName("")
      setBaseUrl("")
      await fetchCompanies()
    } catch (err: any) {
      setSaveError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(c: any) {
    try {
      const token = await getToken()
      await fetch(`${API}/api/companies/${c.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ is_active: !c.is_active }),
      })
      await fetchCompanies()
    } catch { /* silent */ }
  }

  if (loading) return <CardGridSkeleton count={5} />

  const activeCount = companies.filter((c) => c.is_active).length

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold">Stores</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Retailers and marketplaces being monitored.</p>
        </div>
        <Button size="sm" className="gap-1.5 shrink-0" onClick={openAdd}>
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Add Store</span>
        </Button>
      </div>

      {fetchError && (
        <div className="rounded-md bg-destructive/10 text-destructive text-sm px-4 py-3 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {fetchError}
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2">
        {[
          { label: "Total Stores",  value: String(companies.length) },
          { label: "Active Stores", value: String(activeCount) },
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
      {companies.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Building2 className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No stores yet. Add your first store above.</p>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {companies.map((c) => (
            <Card key={c.id} className={`transition-shadow ${c.is_active ? "hover:shadow-md" : "opacity-60"}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <Badge variant={c.is_active ? "default" : "secondary"} className="text-[10px]">
                    {c.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <CardTitle className="text-base mt-3">{c.name}</CardTitle>
                <CardDescription className="text-xs flex items-center gap-1">
                  {c.base_url ? (
                    <a
                      href={/^https?:\/\//i.test(c.base_url) ? c.base_url : `https://${c.base_url}`}
                      target="_blank" rel="noopener noreferrer"
                      className="hover:underline flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {domainFromUrl(c.base_url)}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <span className="text-muted-foreground/50">No URL set</span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                    {Number(c.url_count) || 0} products tracked
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost" size="sm" className="h-7 text-xs px-2 gap-1"
                      onClick={() => openEdit(c)}
                    >
                      <Pencil className="h-3 w-3" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost" size="sm" className="h-7 text-xs px-2"
                      onClick={() => toggleActive(c)}
                    >
                      {c.is_active ? "Deactivate" : "Activate"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add / Edit Store Sheet */}
      <Sheet open={open} onOpenChange={(v) => { if (!saving) setOpen(v) }}>
        <SheetContent side="right" className="flex flex-col">
          <SheetHeader className="border-b pb-4">
            <SheetTitle>{editTarget ? "Edit Store" : "Add Store"}</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Store Name *</label>
              <Input
                placeholder="e.g. Amazon AE"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
              />
              {name && !editTarget && (
                <p className="text-[11px] text-muted-foreground">Slug: {slugify(name)}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Website URL</label>
              <Input
                placeholder="e.g. https://www.amazon.ae"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
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
            <Button className="flex-1 gap-1.5" onClick={handleSave} disabled={!name.trim() || saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editTarget ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {saving ? (editTarget ? "Saving…" : "Adding…") : editTarget ? "Save Changes" : "Add Store"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
