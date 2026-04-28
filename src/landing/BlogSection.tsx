/**
 * BlogSection — public blog list shown on the landing page at #blog.
 * Renders a header + a responsive 3-column card grid of published posts.
 * Tags act as filters (one tag at a time).
 */

import { useEffect, useMemo, useState } from "react"
import { Calendar, Tag as TagIcon, ArrowUpRight, Loader2 } from "lucide-react"

const API = (import.meta.env.VITE_API_URL || "http://localhost:8080").replace(/\/+$/, "")

interface Post {
  id:               number
  slug:             string
  title:            string
  excerpt:          string | null
  cover_image_url:  string | null
  tags:             string[]
  author_email:     string
  author_name:      string | null
  published_at:     string
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export function BlogSection() {
  const [posts, setPosts] = useState<Post[]>([])
  const [tags, setTags]   = useState<{ tag: string; count: number }[]>([])
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr]     = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true); setErr(null)
    ;(async () => {
      try {
        const params = new URLSearchParams({ limit: "30" })
        if (activeTag) params.set("tag", activeTag)
        const [pr, tr] = await Promise.all([
          fetch(`${API}/api/blog/posts?${params}`),
          fetch(`${API}/api/blog/tags`),
        ])
        const pj = await pr.json()
        const tj = await tr.json()
        if (cancelled) return
        setPosts(pj.data?.posts ?? [])
        setTags(tj.data ?? [])
      } catch (e: any) {
        if (!cancelled) setErr(e.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [activeTag])

  const featured = useMemo(() => posts[0], [posts])
  const rest     = useMemo(() => posts.slice(1), [posts])

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

        {/* Tag filter */}
        {tags.length > 0 && (
          <div className="flex items-center justify-center gap-2 flex-wrap mb-10">
            <button
              type="button"
              onClick={() => setActiveTag(null)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                !activeTag
                  ? "bg-foreground text-background border-foreground"
                  : "bg-white text-muted-foreground border-border hover:border-foreground/40"
              }`}
            >All</button>
            {tags.slice(0, 10).map(t => (
              <button
                key={t.tag}
                type="button"
                onClick={() => setActiveTag(t.tag)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  activeTag === t.tag
                    ? "bg-foreground text-background border-foreground"
                    : "bg-white text-muted-foreground border-border hover:border-foreground/40"
                }`}
              >
                {t.tag} <span className="opacity-60">{t.count}</span>
              </button>
            ))}
          </div>
        )}

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
          <>
            {/* Featured (first post) */}
            {featured && (
              <a
                href={`#blog/${featured.slug}`}
                className="group block rounded-2xl overflow-hidden border bg-white shadow-sm hover:shadow-lg transition-shadow mb-10"
              >
                <div className="grid md:grid-cols-2 gap-0">
                  <div className="aspect-[16/10] md:aspect-auto bg-gradient-to-br from-amber-50 to-orange-100 overflow-hidden">
                    {featured.cover_image_url ? (
                      <img src={featured.cover_image_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-6xl opacity-30">📝</div>
                    )}
                  </div>
                  <div className="p-6 sm:p-8 flex flex-col">
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium uppercase tracking-wide">Featured</span>
                      <Calendar className="h-3 w-3 ml-1" />
                      <span>{fmtDate(featured.published_at)}</span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2 group-hover:text-amber-600 transition-colors">
                      {featured.title}
                    </h2>
                    {featured.excerpt && (
                      <p className="text-sm text-muted-foreground line-clamp-3 mb-4">{featured.excerpt}</p>
                    )}
                    <div className="flex items-center gap-1.5 mb-4 flex-wrap">
                      {featured.tags.slice(0, 3).map(t => (
                        <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                          <TagIcon className="h-2.5 w-2.5 inline mr-0.5" />{t}
                        </span>
                      ))}
                    </div>
                    <div className="mt-auto inline-flex items-center text-sm font-medium text-amber-600 gap-1">
                      Read article
                      <ArrowUpRight className="h-4 w-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </div>
                  </div>
                </div>
              </a>
            )}

            {/* Rest of posts — 3-col grid */}
            <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map(p => (
                <a
                  key={p.id}
                  href={`#blog/${p.slug}`}
                  className="group block rounded-xl overflow-hidden border bg-white shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all"
                >
                  <div className="aspect-[16/9] bg-gradient-to-br from-amber-50 to-orange-100 overflow-hidden">
                    {p.cover_image_url ? (
                      <img src={p.cover_image_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl opacity-30">📝</div>
                    )}
                  </div>
                  <div className="p-5">
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-2">
                      <Calendar className="h-2.5 w-2.5" />
                      {fmtDate(p.published_at)}
                    </div>
                    <h3 className="text-base font-semibold tracking-tight leading-snug mb-2 line-clamp-2 group-hover:text-amber-600 transition-colors">
                      {p.title}
                    </h3>
                    {p.excerpt && <p className="text-xs text-muted-foreground line-clamp-3 mb-3">{p.excerpt}</p>}
                    <div className="flex items-center gap-1 flex-wrap">
                      {p.tags.slice(0, 2).map(t => (
                        <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">{t}</span>
                      ))}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  )
}
