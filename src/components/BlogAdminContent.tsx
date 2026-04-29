/**
 * BlogAdminContent — list / create / edit blog posts.
 *
 * Visible to anyone whose blog_role is 'author' or 'editor', plus owner / dev
 * accounts (App.tsx gates the sidebar item, but this component double-checks
 * via the API so direct hash navigation still works).
 *
 * - Author can create posts and edit their OWN posts.
 * - Editor (or dev / owner) can edit / delete any.
 * - DELETE button is hidden for authors.
 */

import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@/context/AuthContext"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card"
import { Badge } from "./ui/badge"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "./ui/sheet"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "./ui/dialog"
import {
  Plus, Pencil, Trash2, Eye, Search, Loader2, Calendar,
  Save, X, AlertTriangle, Send,
} from "lucide-react"
import { TiptapEditor } from "./TiptapEditor"
import { marked } from "marked"

const API = (import.meta.env.VITE_API_URL || "http://localhost:8080").replace(/\/+$/, "")

interface Post {
  id:               number
  slug:             string
  title:            string
  excerpt:          string | null
  content?:         string
  content_format?:  "html" | "markdown"
  cover_image_url:  string | null
  tags:             string[]
  status:           "draft" | "published" | "archived"
  author_email:     string
  author_name?:     string | null
  published_at:     string | null
  updated_at:       string
  created_at:       string
}

interface Props {
  role:      string                          // account role (b2b/b2c/dev/owner/admin)
  blogRole:  "none" | "author" | "editor"
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export function BlogAdminContent({ role, blogRole }: Props) {
  const { user } = useAuth()
  const isEditor = blogRole === "editor" || role === "dev" || role === "owner"

  const [posts, setPosts]       = useState<Post[]>([])
  const [loading, setLoading]   = useState(true)
  const [err, setErr]           = useState<string | null>(null)
  const [search, setSearch]     = useState("")
  const [statusFilter, setStatusFilter] = useState<"" | "draft" | "published" | "archived">("")
  const [mineOnly, setMineOnly] = useState(false)

  const [editing, setEditing]   = useState<Post | null>(null)
  const [creating, setCreating] = useState(false)
  const [confirmDel, setConfirmDel] = useState<Post | null>(null)

  async function load() {
    if (!user) return
    setLoading(true); setErr(null)
    try {
      const token = await user.getIdToken()
      const params = new URLSearchParams()
      if (search.trim())  params.set("q", search.trim())
      if (statusFilter)   params.set("status", statusFilter)
      if (mineOnly)       params.set("mine", "true")
      const r = await fetch(`${API}/api/blog/admin/posts?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const j = await r.json()
      setPosts(j.data ?? [])
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [user, statusFilter, mineOnly])
  useEffect(() => {
    const t = setTimeout(() => load(), 350)
    return () => clearTimeout(t)
  }, [search])

  async function deletePost(id: number) {
    if (!user) return
    try {
      const token = await user.getIdToken()
      const r = await fetch(`${API}/api/blog/admin/posts/${id}`, {
        method:  "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
      const j = await r.json()
      if (!r.ok || !j.success) throw new Error(j.error?.message || `HTTP ${r.status}`)
      setConfirmDel(null)
      load()
    } catch (e: any) { alert(`Failed: ${e.message}`) }
  }

  async function publishToggle(p: Post) {
    if (!user) return
    try {
      const token = await user.getIdToken()
      const url = p.status === "published"
        ? `${API}/api/blog/admin/posts/${p.id}/unpublish`
        : `${API}/api/blog/admin/posts/${p.id}/publish`
      const r = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${token}` } })
      const j = await r.json()
      if (!r.ok || !j.success) throw new Error(j.error?.message || `HTTP ${r.status}`)
      load()
    } catch (e: any) { alert(`Failed: ${e.message}`) }
  }

  const counts = useMemo(() => ({
    all:       posts.length,
    draft:     posts.filter(p => p.status === "draft").length,
    published: posts.filter(p => p.status === "published").length,
    archived:  posts.filter(p => p.status === "archived").length,
  }), [posts])

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold">Blog</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Write and manage public blog posts ·
            <Badge variant="outline" className="ml-2 text-[10px]">{isEditor ? "Editor" : "Author"}</Badge>
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
        >
          <Plus className="h-4 w-4" />
          New post
        </button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-3 px-3 sm:px-4">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                placeholder="Search title or slug..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-md border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              />
            </div>
            <select
              value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}
              className="text-xs rounded-md border bg-background px-2 py-1.5"
            >
              <option value="">All statuses ({counts.all})</option>
              <option value="draft">Draft ({counts.draft})</option>
              <option value="published">Published ({counts.published})</option>
              <option value="archived">Archived ({counts.archived})</option>
            </select>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="checkbox" checked={mineOnly} onChange={e => setMineOnly(e.target.checked)} />
              My posts only
            </label>
          </div>
        </CardContent>
      </Card>

      {err && (
        <div className="rounded-md bg-red-50 border border-red-200 p-2.5 text-red-900 text-xs flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />{err}
        </div>
      )}

      {/* Posts grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : posts.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">
          No posts yet. Click "New post" to write your first one.
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map(p => {
            const canEdit   = isEditor || p.author_email === user?.email
            const canDelete = isEditor
            return (
              <Card key={p.id} className="overflow-hidden flex flex-col">
                {p.cover_image_url ? (
                  <div className="aspect-[16/9] bg-muted overflow-hidden">
                    <img src={p.cover_image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                  </div>
                ) : (
                  <div className="aspect-[16/9] bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center">
                    <span className="text-3xl opacity-40">📝</span>
                  </div>
                )}
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Badge variant={p.status === "published" ? "default" : p.status === "archived" ? "outline" : "secondary"} className="text-[10px]">
                      {p.status}
                    </Badge>
                  </div>
                  <CardTitle className="text-base leading-snug line-clamp-2">{p.title}</CardTitle>
                  <CardDescription className="text-xs line-clamp-2 mt-1">{p.excerpt || "—"}</CardDescription>
                </CardHeader>
                <CardContent className="mt-auto pt-0 pb-3">
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-3">
                    <Calendar className="h-3 w-3" />
                    {p.published_at ? fmtDate(p.published_at) : `draft · updated ${fmtDate(p.updated_at)}`}
                    <span className="ml-auto truncate max-w-[120px]">{p.author_email}</span>
                  </div>
                  <div className="flex items-center gap-1 flex-wrap">
                    {p.status === "published" && (
                      <a
                        href={`#blog/${p.slug}`}
                        target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-emerald-600 hover:text-emerald-700"
                      >
                        <Eye className="h-3 w-3" /> View
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => publishToggle(p)}
                      disabled={!canEdit}
                      className="text-[11px] px-2 py-1 rounded border hover:bg-muted/40 disabled:opacity-30 disabled:cursor-not-allowed ml-auto"
                    >
                      {p.status === "published" ? "Unpublish" : "Publish"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(p)}
                      disabled={!canEdit}
                      className="p-1.5 rounded hover:bg-blue-100 text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => setConfirmDel(p)}
                        className="p-1.5 rounded hover:bg-red-100 text-red-600"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Editor sheet — both create + edit modes */}
      <PostEditor
        open={creating || !!editing}
        post={editing}
        onClose={() => { setEditing(null); setCreating(false) }}
        onSaved={() => { setEditing(null); setCreating(false); load() }}
      />

      {/* Delete confirm */}
      <Dialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            Delete post?
          </DialogTitle>
          <DialogDescription className="text-xs">
            This permanently removes the post. Cannot be undone.
          </DialogDescription>
          <code className="block bg-slate-50 border rounded p-2 text-xs">{confirmDel?.title}</code>
          <div className="flex justify-end gap-2 mt-2">
            <button
              type="button"
              onClick={() => setConfirmDel(null)}
              className="text-xs px-3 py-1.5 rounded-md border hover:bg-muted/50"
            >Cancel</button>
            <button
              type="button"
              onClick={() => confirmDel && deletePost(confirmDel.id)}
              className="text-xs px-3 py-1.5 rounded-md text-white bg-red-600 hover:bg-red-700"
            >Delete</button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  )
}

// ─── Editor sheet ─────────────────────────────────────────────────────────────

function PostEditor({
  open, post, onClose, onSaved,
}: {
  open: boolean; post: Post | null; onClose: () => void; onSaved: () => void
}) {
  const { user } = useAuth()
  const isEdit = !!post

  const [title, setTitle]     = useState("")
  const [slug, setSlug]       = useState("")
  const [excerpt, setExcerpt] = useState("")
  const [content, setContent] = useState("")           // HTML output from Tiptap
  const [coverUrl, setCoverUrl] = useState("")
  const [currentStatus, setCurrentStatus] = useState<"draft" | "published" | "archived">("draft")
  const [saving, setSaving]   = useState<null | "draft" | "published">(null)
  const [err, setErr]         = useState<string | null>(null)
  const [fullPost, setFullPost] = useState<Post | null>(null)

  // Load full post (with content) when editing
  useEffect(() => {
    if (!open) {
      setTitle(""); setSlug(""); setExcerpt(""); setContent("")
      setCoverUrl(""); setCurrentStatus("draft"); setErr(null); setFullPost(null)
      return
    }
    if (!post || !user) return
    ;(async () => {
      try {
        const token = await user.getIdToken()
        const r = await fetch(`${API}/api/blog/admin/posts/${post.id}`, { headers: { Authorization: `Bearer ${token}` } })
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const j = await r.json()
        const p = j.data
        setFullPost(p)
        setTitle(p.title)
        setSlug(p.slug)
        setExcerpt(p.excerpt ?? "")
        // Convert legacy markdown → HTML so the rich editor can show it cleanly.
        const raw  = p.content ?? ""
        const html = p.content_format === "markdown" ? marked.parse(raw, { async: false }) as string : raw
        setContent(html)
        setCoverUrl(p.cover_image_url ?? "")
        setCurrentStatus(p.status === "archived" ? "draft" : p.status)
      } catch (e: any) { setErr(e.message) }
    })()
  }, [open, post, user])

  async function save(targetStatus: "draft" | "published") {
    if (!user) return
    if (!title.trim()) { setErr("Title is required."); return }
    setSaving(targetStatus); setErr(null)
    try {
      const token = await user.getIdToken()
      const body = {
        title:           title.trim(),
        slug:            slug.trim() || undefined,
        excerpt:         excerpt.trim(),
        content,
        content_format:  "html",
        cover_image_url: coverUrl.trim() || null,
        status:          targetStatus,
      }
      const url    = isEdit ? `${API}/api/blog/admin/posts/${post!.id}` : `${API}/api/blog/admin/posts`
      const method = isEdit ? "PATCH" : "POST"
      const r = await fetch(url, {
        method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      const j = await r.json()
      if (!r.ok || !j.success) throw new Error(j.error?.message || `HTTP ${r.status}`)
      onSaved()
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setSaving(null)
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-3xl p-0 flex flex-col">
        <SheetHeader className="border-b px-5 py-3">
          <div className="min-w-0">
            <SheetTitle className="text-base">
              {isEdit ? "Edit post" : "New post"}
            </SheetTitle>
            <SheetDescription className="text-xs">
              {isEdit
                ? `Editing #${fullPost?.id ?? "..."} · current status: ${currentStatus}`
                : "Draft a new blog post — rich text editor with formatting toolbar"}
            </SheetDescription>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          <Field label="Title" required>
            <input
              value={title} onChange={e => setTitle(e.target.value)}
              placeholder="A great title"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30"
            />
          </Field>

          <Field label="Cover image URL" hint="Paste a Cloudinary / Imgur link. Used as the post header + OG image.">
            <input
              value={coverUrl} onChange={e => setCoverUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30"
            />
            {coverUrl.trim() && (
              <img src={coverUrl} alt="" className="mt-2 max-h-32 rounded border object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
            )}
          </Field>

          <Field label="Excerpt" hint="Shown on the blog list and in social previews. Plain text, ~200 chars.">
            <textarea
              value={excerpt} onChange={e => setExcerpt(e.target.value)}
              rows={2} maxLength={800}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30"
            />
          </Field>

          <Field label="Content" hint="Use the toolbar to format — headings, bold, lists, links, images.">
            <TiptapEditor value={content} onChange={setContent} placeholder="Start writing..." />
          </Field>

          <Field label="Search engine listing" hint="The URL slug. Auto-generated from title if left empty.">
            <input
              value={slug} onChange={e => setSlug(e.target.value)}
              placeholder="auto-from-title"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/30"
            />
          </Field>
        </div>

        <div className="border-t px-5 py-3 flex items-center justify-between gap-2 bg-background">
          {err
            ? <span className="text-xs text-red-600 flex items-center gap-1"><AlertTriangle className="h-3 w-3" />{err}</span>
            : <span />}
          <div className="flex items-center gap-2">
            <button
              type="button" onClick={onClose}
              className="text-xs px-3 py-1.5 rounded-md border hover:bg-muted/50"
            >
              <X className="h-3 w-3 inline mr-1" />
              Cancel
            </button>
            <button
              type="button"
              onClick={() => save("draft")}
              disabled={saving !== null}
              className="text-xs px-3 py-1.5 rounded-md border hover:bg-muted/50 disabled:opacity-50"
            >
              <Save className="h-3 w-3 inline mr-1" />
              {saving === "draft" ? "Saving..." : "Save as draft"}
            </button>
            <button
              type="button"
              onClick={() => save("published")}
              disabled={saving !== null}
              className="text-xs px-3 py-1.5 rounded-md text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50"
            >
              <Send className="h-3 w-3 inline mr-1" />
              {saving === "published"
                ? "Publishing..."
                : (isEdit && currentStatus === "published" ? "Update" : "Publish")}
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium block mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-[10px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  )
}
