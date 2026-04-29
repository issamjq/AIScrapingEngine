/**
 * BlogSection — public blog list shown on the landing page at #blog.
 * Wix-style 4-column card grid: image, author tag, date, read time, title,
 * excerpt, view count + share button.
 */

import { useEffect, useState } from "react"
import { Eye, Loader2 } from "lucide-react"
import { SharePopover } from "./SharePopover"

const API = (import.meta.env.VITE_API_URL || "http://localhost:8080").replace(/\/+$/, "")

interface Post {
  id:               number
  slug:             string
  title:            string
  excerpt:          string | null
  cover_image_url:  string | null
  author_name:      string | null     // backend forces "Spark"
  published_at:     string
  view_count:       number
  read_minutes:     number
}

function fmtRelative(iso: string): string {
  const then = new Date(iso).getTime()
  const now  = Date.now()
  const diff = Math.max(0, now - then)
  const day  = 86_400_000
  if (diff < day)        return "Today"
  if (diff < 2 * day)    return "Yesterday"
  if (diff < 7 * day)    return `${Math.floor(diff / day)} days ago`
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function fmtCount(n: number): string {
  if (n < 1000) return String(n)
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`
  return `${(n / 1_000_000).toFixed(1)}M`
}

export function BlogSection() {
  const [posts, setPosts]     = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr]         = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true); setErr(null)
    ;(async () => {
      try {
        const r = await fetch(`${API}/api/blog/posts?limit=40`)
        const j = await r.json()
        if (cancelled) return
        setPosts(j.data?.posts ?? [])
      } catch (e: any) {
        if (!cancelled) setErr(e.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  return (
    <section
      id="blog"
      className="relative py-24 sm:py-32 bg-gradient-to-b from-white to-amber-50/30"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">

        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="inline-block text-xs font-semibold tracking-widest uppercase text-amber-600 mb-3">
            From the team
          </span>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight">
            The Spark <span className="bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">Blog</span>
          </h1>
          <p className="text-base text-muted-foreground mt-3">
            Product updates, market intelligence research, and tactical guides for retailers.
          </p>
        </div>

        <div className="text-xs uppercase tracking-widest text-amber-600/80 font-semibold mb-6">All Posts</div>

        {/* States */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : err ? (
          <div className="text-center py-20 text-sm text-red-600">Could not load posts: {err}</div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20 text-sm text-muted-foreground">
            No posts published yet. Check back soon.
          </div>
        ) : (
          <div className="grid gap-6 sm:gap-8 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {posts.map(p => <BlogCard key={p.id} post={p} />)}
          </div>
        )}
      </div>
    </section>
  )
}

function BlogCard({ post }: { post: Post }) {
  const href = `#blog/${post.slug}`

  return (
    <article className="group relative bg-white rounded-xl border border-slate-200/80 overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">

      {/* Cover image (clickable) */}
      <a href={href} className="block aspect-[4/3] bg-gradient-to-br from-amber-50 to-orange-100 overflow-hidden">
        {post.cover_image_url ? (
          <img
            src={post.cover_image_url}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl opacity-30">📝</div>
        )}
      </a>

      <div className="p-5 flex flex-col gap-2.5">
        {/* Author tag row */}
        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <img src="/spark-logo.gif" alt="" className="h-5 w-5 rounded-full object-contain bg-amber-50 ring-1 ring-amber-200/60 p-0.5" />
          <span className="font-medium text-slate-700">{post.author_name || "Spark"}</span>
        </div>

        <div className="flex items-center gap-1 text-[11px] text-slate-500">
          <span>{fmtRelative(post.published_at)}</span>
          <span className="opacity-50">·</span>
          <span>{post.read_minutes} min read</span>
        </div>

        {/* Title (clickable) */}
        <a href={href}>
          <h3 className="text-base sm:text-lg font-semibold tracking-tight leading-snug line-clamp-2 group-hover:text-amber-600 transition-colors">
            {post.title}
          </h3>
        </a>

        {/* Excerpt */}
        {post.excerpt && (
          <a href={href}>
            <p className="text-sm text-slate-600 line-clamp-3 leading-relaxed">{post.excerpt}</p>
          </a>
        )}

        {/* Meta row: views + share */}
        <div className="flex items-center justify-between pt-3 mt-auto border-t border-slate-100">
          <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
            <Eye className="h-3.5 w-3.5" />
            {fmtCount(post.view_count ?? 0)}
          </span>
          <SharePopover url={href} title={post.title} />
        </div>
      </div>
    </article>
  )
}
