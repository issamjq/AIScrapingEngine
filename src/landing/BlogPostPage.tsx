/**
 * BlogPostPage — public single-post view at #blog/:slug.
 * Fetches /api/blog/posts/:slug, renders the markdown content, and provides
 * an "Open app" / "Sign in" CTA at the bottom.
 */

import { useEffect, useState } from "react"
import { Calendar, ArrowLeft, Loader2 } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

const API = (import.meta.env.VITE_API_URL || "http://localhost:8080").replace(/\/+$/, "")

interface Post {
  id:               number
  slug:             string
  title:            string
  excerpt:          string | null
  content:          string
  cover_image_url:  string | null
  tags:             string[]
  author_email:     string
  author_name:      string | null
  published_at:     string
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
}

interface Props {
  slug: string
  onBack: () => void
}

export function BlogPostPage({ slug, onBack }: Props) {
  const [post, setPost] = useState<Post | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr]   = useState<string | null>(null)

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
    // Scroll to top on slug change
    try { window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior }) } catch { /* ignore */ }
    return () => { cancelled = true }
  }, [slug])

  return (
    <section className="min-h-screen pt-24 pb-24 bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">

        {/* Back button */}
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
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
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                <Calendar className="h-3 w-3" />
                <time dateTime={post.published_at}>{fmtDate(post.published_at)}</time>
                {post.author_name && (
                  <>
                    <span>·</span>
                    <span>by {post.author_name}</span>
                  </>
                )}
              </div>
              <h1 className="text-3xl sm:text-5xl font-bold tracking-tight leading-tight mb-4">
                {post.title}
              </h1>
              {post.excerpt && (
                <p className="text-lg text-muted-foreground leading-relaxed">
                  {post.excerpt}
                </p>
              )}
              {post.tags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 mt-6">
                  {post.tags.map(t => (
                    <span key={t} className="text-[11px] px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                      {t}
                    </span>
                  ))}
                </div>
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
            <div className="prose prose-slate max-w-none prose-headings:tracking-tight prose-headings:font-bold prose-a:text-amber-600 prose-a:no-underline hover:prose-a:underline prose-img:rounded-lg prose-pre:bg-slate-900 prose-pre:text-slate-100">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.content}</ReactMarkdown>
            </div>

            {/* Footer CTA */}
            <div className="mt-16 pt-8 border-t">
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
