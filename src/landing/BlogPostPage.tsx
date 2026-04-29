/**
 * BlogPostPage — public single-post view at #blog/:slug.
 * Fetches /api/blog/posts/:slug, renders the (HTML or markdown) content,
 * triggers a once-per-session view increment, and exposes a share button.
 */

import { useEffect, useMemo, useState } from "react"
import { Calendar, ArrowLeft, Loader2, Eye, Clock } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import DOMPurify from "dompurify"
import { SharePopover } from "./SharePopover"

const API = (import.meta.env.VITE_API_URL || "http://localhost:8080").replace(/\/+$/, "")

interface Post {
  id:               number
  slug:             string
  title:            string
  excerpt:          string | null
  content:          string
  content_format:   "html" | "markdown"
  cover_image_url:  string | null
  author_name:      string | null     // backend forces "Spark"
  published_at:     string
  view_count:       number
  read_minutes:     number
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
}

interface Props {
  slug: string
  onBack: () => void
}

export function BlogPostPage({ slug, onBack }: Props) {
  const [post, setPost]   = useState<Post | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr]     = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true); setErr(null); setPost(null)
    ;(async () => {
      try {
        const r = await fetch(`${API}/api/blog/posts/${encodeURIComponent(slug)}`)
        if (!r.ok) throw new Error(r.status === 404 ? "Post not found" : `HTTP ${r.status}`)
        const j = await r.json()
        if (!cancelled) setPost(j.data)
      } catch (e: any) {
        if (!cancelled) setErr(e.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    try { window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior }) } catch { /* ignore */ }
    return () => { cancelled = true }
  }, [slug])

  // Once-per-session view increment.
  useEffect(() => {
    if (!post) return
    const key = `blog_viewed_${post.slug}`
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, "1")
    fetch(`${API}/api/blog/posts/${encodeURIComponent(post.slug)}/view`, { method: "POST" })
      .catch(() => {})
  }, [post])

  // Sanitize HTML once per content change.
  const safeHtml = useMemo(() => {
    if (!post || post.content_format !== "html") return ""
    return DOMPurify.sanitize(post.content, {
      ADD_ATTR: ["target", "rel"],
    })
  }, [post])

  const shareUrl = post ? `#blog/${post.slug}` : ""

  return (
    <section className="min-h-screen pt-24 pb-24 bg-background">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">

        {/* Back button */}
        <button
          type="button"
          onClick={onBack}
          className="group inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground bg-card hover:bg-muted/60 border border-border hover:border-border/80 rounded-full pl-3 pr-4 py-2 mb-8 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
          Back to blog
        </button>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {err && !loading && (
          <div className="text-center py-20">
            <p className="text-lg font-semibold mb-2">😕 {err}</p>
            <p className="text-sm text-muted-foreground">
              The post might have been moved or unpublished.
            </p>
          </div>
        )}

        {post && !loading && (
          <article>
            {/* Header */}
            <header className="mb-8">
              {/* Author + meta strip */}
              <div className="flex items-center gap-3 mb-4">
                <img src="/spark-logo.gif" alt="" className="h-9 w-9 rounded-full object-contain bg-amber-50 ring-1 ring-amber-200/60 dark:bg-amber-950/30 dark:ring-amber-800/50 p-1" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground">{post.author_name || "Spark"}</div>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                    <Calendar className="h-3 w-3" />
                    <time dateTime={post.published_at}>{fmtDate(post.published_at)}</time>
                    <span className="opacity-40">·</span>
                    <Clock className="h-3 w-3" />
                    <span>{post.read_minutes} min read</span>
                  </div>
                </div>
                <SharePopover url={shareUrl} title={post.title} large />
              </div>

              <h1 className="text-3xl sm:text-5xl font-bold tracking-tight leading-tight mb-4">
                {post.title}
              </h1>
              {post.excerpt && (
                <p className="text-lg text-muted-foreground leading-relaxed">
                  {post.excerpt}
                </p>
              )}
            </header>

            {/* Cover */}
            {post.cover_image_url && (
              <img
                src={post.cover_image_url}
                alt=""
                className="w-full rounded-2xl mb-10 aspect-[16/9] object-cover"
              />
            )}

            {/* Body */}
            <div className="prose prose-slate dark:prose-invert max-w-none prose-headings:tracking-tight prose-headings:font-bold prose-a:text-amber-600 dark:prose-a:text-amber-400 prose-a:no-underline hover:prose-a:underline prose-img:rounded-lg prose-pre:bg-slate-900 prose-pre:text-slate-100">
              {post.content_format === "html"
                ? <div dangerouslySetInnerHTML={{ __html: safeHtml }} />
                : <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.content}</ReactMarkdown>}
            </div>

            {/* Footer: views + share */}
            <div className="mt-12 pt-6 border-t border-border flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <Eye className="h-4 w-4" />
                {post.view_count} views
              </span>
              <SharePopover url={shareUrl} title={post.title} large />
            </div>

            {/* Footer CTA */}
            <div className="mt-12">
              <div className="rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 p-8 sm:p-10 text-white text-center">
                <h2 className="text-2xl sm:text-3xl font-bold mb-2">Ready to try Spark AI?</h2>
                <p className="text-amber-50 mb-6 max-w-md mx-auto">
                  Start tracking prices and discovering new products in minutes.
                </p>
                <a
                  href="#"
                  className="inline-flex items-center gap-2 bg-white text-amber-700 hover:bg-amber-50 font-semibold px-6 py-3 rounded-full transition-colors"
                >
                  Get Started Free
                </a>
              </div>
            </div>
          </article>
        )}
      </div>
    </section>
  )
}
