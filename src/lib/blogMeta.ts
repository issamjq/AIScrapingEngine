/**
 * Head-tag manager for the public blog.
 *
 * In an SPA the <head> is static at boot — we mutate it on mount so each
 * post has its own <title>, <meta description>, OpenGraph + Twitter cards,
 * <link rel="canonical">, and a JSON-LD BlogPosting block. On unmount we
 * restore the original snapshot so navigating back to the marketing home
 * doesn't leave stale post-specific meta around.
 *
 * Crawlers that render JS (Google, Bing) pick these up. Pure static
 * scrapers (older social previews) only see what's in index.html — we
 * keep solid defaults there too.
 */

const DEFAULT_TITLE       = "Spark AI — AI-powered price intelligence for UAE retailers"
const DEFAULT_DESCRIPTION = "Track competitor prices automatically across Amazon AE, Noon, Carrefour and 10+ UAE retailers. B2B price intelligence + B2C global product search powered by Vision AI."
const DEFAULT_OG_IMAGE    = "/spark-logo.gif"

const JSON_LD_SCRIPT_ID = "spark-jsonld"

interface BlogPostMeta {
  title:        string
  description:  string
  url:          string         // absolute URL
  imageUrl?:    string | null  // absolute or relative; resolved at render time
  publishedAt:  string         // ISO
  authorName?:  string | null
}

interface BlogIndexMeta {
  title:        string
  description:  string
  url:          string
}

// ─── low-level head helpers ──────────────────────────────────────────────────

function ensureMeta(selector: string, attr: "name" | "property", attrValue: string): HTMLMetaElement {
  let el = document.head.querySelector<HTMLMetaElement>(selector)
  if (!el) {
    el = document.createElement("meta")
    el.setAttribute(attr, attrValue)
    document.head.appendChild(el)
  }
  return el
}

function setMeta(name: string, value: string) {
  ensureMeta(`meta[name="${name}"]`, "name", name).setAttribute("content", value)
}

function setOg(property: string, value: string) {
  ensureMeta(`meta[property="${property}"]`, "property", property).setAttribute("content", value)
}

function setCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!el) {
    el = document.createElement("link")
    el.setAttribute("rel", "canonical")
    document.head.appendChild(el)
  }
  el.setAttribute("href", href)
}

function setJsonLd(payload: Record<string, unknown> | null) {
  // Remove any existing block first
  document.getElementById(JSON_LD_SCRIPT_ID)?.remove()
  if (!payload) return
  const script = document.createElement("script")
  script.id   = JSON_LD_SCRIPT_ID
  script.type = "application/ld+json"
  script.textContent = JSON.stringify(payload)
  document.head.appendChild(script)
}

function absoluteUrl(maybeRelative: string | null | undefined): string {
  if (!maybeRelative) return `${window.location.origin}${DEFAULT_OG_IMAGE}`
  if (/^https?:\/\//i.test(maybeRelative)) return maybeRelative
  return `${window.location.origin}${maybeRelative.startsWith("/") ? "" : "/"}${maybeRelative}`
}

// ─── public API ──────────────────────────────────────────────────────────────

/** Apply a single post's meta to the current page. Returns a cleanup fn. */
export function applyBlogPostMeta(post: BlogPostMeta): () => void {
  const image = absoluteUrl(post.imageUrl)
  document.title = `${post.title} — Spark AI Blog`

  setMeta("description",        post.description)
  setMeta("twitter:card",       "summary_large_image")
  setMeta("twitter:title",      post.title)
  setMeta("twitter:description",post.description)
  setMeta("twitter:image",      image)

  setOg("og:type",        "article")
  setOg("og:title",       post.title)
  setOg("og:description", post.description)
  setOg("og:url",         post.url)
  setOg("og:image",       image)
  setOg("og:site_name",   "Spark AI")

  setCanonical(post.url)

  setJsonLd({
    "@context":      "https://schema.org",
    "@type":         "BlogPosting",
    "headline":      post.title,
    "description":   post.description,
    "image":         [image],
    "datePublished": post.publishedAt,
    "dateModified":  post.publishedAt,
    "author":        { "@type": "Organization", "name": post.authorName || "Spark" },
    "publisher": {
      "@type": "Organization",
      "name":  "Spark AI",
      "logo":  { "@type": "ImageObject", "url": absoluteUrl(DEFAULT_OG_IMAGE) },
    },
    "mainEntityOfPage": { "@type": "WebPage", "@id": post.url },
  })

  return restoreDefaults
}

/** Apply meta for the /blog listing page. Returns a cleanup fn. */
export function applyBlogIndexMeta(meta: BlogIndexMeta): () => void {
  document.title = meta.title

  setMeta("description",        meta.description)
  setMeta("twitter:card",       "summary_large_image")
  setMeta("twitter:title",      meta.title)
  setMeta("twitter:description",meta.description)
  setMeta("twitter:image",      absoluteUrl(DEFAULT_OG_IMAGE))

  setOg("og:type",        "website")
  setOg("og:title",       meta.title)
  setOg("og:description", meta.description)
  setOg("og:url",         meta.url)
  setOg("og:image",       absoluteUrl(DEFAULT_OG_IMAGE))
  setOg("og:site_name",   "Spark AI")

  setCanonical(meta.url)

  setJsonLd({
    "@context": "https://schema.org",
    "@type":    "Blog",
    "name":     "Spark AI Blog",
    "url":      meta.url,
    "publisher": {
      "@type": "Organization",
      "name":  "Spark AI",
      "logo":  { "@type": "ImageObject", "url": absoluteUrl(DEFAULT_OG_IMAGE) },
    },
  })

  return restoreDefaults
}

/** Reset the head to site-wide defaults (used as the cleanup fn). */
export function restoreDefaults() {
  document.title = DEFAULT_TITLE

  setMeta("description",         DEFAULT_DESCRIPTION)
  setMeta("twitter:card",        "summary_large_image")
  setMeta("twitter:title",       DEFAULT_TITLE)
  setMeta("twitter:description", DEFAULT_DESCRIPTION)
  setMeta("twitter:image",       absoluteUrl(DEFAULT_OG_IMAGE))

  setOg("og:type",        "website")
  setOg("og:title",       DEFAULT_TITLE)
  setOg("og:description", DEFAULT_DESCRIPTION)
  setOg("og:url",         window.location.origin)
  setOg("og:image",       absoluteUrl(DEFAULT_OG_IMAGE))
  setOg("og:site_name",   "Spark AI")

  setCanonical(window.location.origin + window.location.pathname)
  setJsonLd(null)
}
