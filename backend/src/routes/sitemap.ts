/**
 * /sitemap.xml — public sitemap for Google Search Console.
 *
 * Lists:
 *  - The marketing home (/)
 *  - The blog index (/blog)
 *  - Every published blog post (/blog/:slug)
 *
 * The frontend domain is read from FRONTEND_URL (set in Render env), which
 * is the same env var used for CORS. Falls back to the current Vercel URL
 * if not set, so local dev still produces something sensible.
 *
 * Vercel rewrites /sitemap.xml on the static site to this backend endpoint
 * (see vercel.json), so the sitemap lives at the same origin as the site.
 */

import { Router } from "express"
import { query } from "../db"

export const sitemapRouter = Router()

function escapeXml(s: string): string {
  return s
    .replace(/&/g,  "&amp;")
    .replace(/</g,  "&lt;")
    .replace(/>/g,  "&gt;")
    .replace(/"/g,  "&quot;")
    .replace(/'/g,  "&apos;")
}

function frontendBase(): string {
  const raw = process.env.FRONTEND_URL || "https://ai-scraping-engine.vercel.app"
  // FRONTEND_URL may contain a comma-separated list (CORS_ORIGIN style) — take the first.
  return raw.split(",")[0].trim().replace(/\/+$/, "")
}

sitemapRouter.get("/sitemap.xml", async (_req, res, next) => {
  try {
    const base = frontendBase()
    const { rows } = await query(
      `SELECT slug, updated_at, published_at
         FROM blog_posts
        WHERE status = 'published'
          AND published_at IS NOT NULL
        ORDER BY published_at DESC
        LIMIT 5000`,
    ) as { rows: Array<{ slug: string; updated_at: string | Date; published_at: string | Date }> }

    const staticUrls = [
      { loc: `${base}/`,     changefreq: "weekly",  priority: "1.0" },
      { loc: `${base}/blog`, changefreq: "daily",   priority: "0.8" },
    ]

    const postUrls = rows.map(p => ({
      loc:        `${base}/blog/${p.slug}`,
      lastmod:    new Date(p.updated_at as any).toISOString(),
      changefreq: "weekly",
      priority:   "0.7",
    }))

    const items = [
      ...staticUrls.map(u => `<url><loc>${escapeXml(u.loc)}</loc><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`),
      ...postUrls.map(u => `<url><loc>${escapeXml(u.loc)}</loc><lastmod>${u.lastmod}</lastmod><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`),
    ].join("")

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${items}
</urlset>`

    res.setHeader("Content-Type", "application/xml; charset=utf-8")
    res.setHeader("Cache-Control", "public, max-age=600, s-maxage=600")
    res.status(200).send(xml)
  } catch (err) {
    next(err)
  }
})
