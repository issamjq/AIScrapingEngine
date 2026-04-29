/**
 * /api/blog/* — public reads + admin writes for the blog.
 *
 * Public (no auth required, mounted before requireAuth):
 *   GET /posts                 list published posts (cards)
 *   GET /posts/:slug           single published post (full content)
 *   GET /tags                  unique tag list across all published posts
 *
 * Admin (auth + TOTP + blog role required):
 *   GET    /admin/posts        list ALL posts incl. drafts
 *   GET    /admin/posts/:id    single post by id (any status)
 *   POST   /admin/posts        create draft (author+)
 *   PATCH  /admin/posts/:id    update (author owns OR editor)
 *   POST   /admin/posts/:id/publish    transition draft → published (author owns OR editor)
 *   POST   /admin/posts/:id/unpublish  back to draft (author owns OR editor)
 *   DELETE /admin/posts/:id    delete (editor only — see middleware)
 */

import { Router } from "express"
import { query } from "../db"
import { AuthRequest } from "../middleware/auth"
import { requireBlogRole } from "../middleware/requireBlogRole"
import { logAdminAction } from "../services/adminAuditLogger"
import { getClientIp } from "../services/activityLogger"

export const blogPublicRouter = Router()
export const blogAdminRouter  = Router()

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(s: string): string {
  return String(s)
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")  // strip diacritics
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 160) || `post-${Date.now()}`
}

async function generateUniqueSlug(base: string, ignoreId: number | null = null): Promise<string> {
  let slug = slugify(base)
  let n = 1
  while (true) {
    const { rows } = await query(
      `SELECT 1 FROM blog_posts WHERE slug = $1 ${ignoreId ? "AND id <> $2" : ""} LIMIT 1`,
      ignoreId ? [slug, ignoreId] : [slug],
    )
    if (rows.length === 0) return slug
    n += 1
    slug = `${slugify(base)}-${n}`
  }
}

function sanitizeTags(input: any): string[] {
  if (!Array.isArray(input)) return []
  return input
    .map((t: any) => String(t ?? "").trim().slice(0, 40))
    .filter((t: string) => t.length > 0)
    .slice(0, 12)
}

// ─── Public reads ─────────────────────────────────────────────────────────────

// Derived read_minutes (~200 wpm). Strips HTML tags before counting whitespace-split tokens.
const READ_MINUTES_SQL = `
  GREATEST(1, CEIL(
    COALESCE(
      array_length(
        regexp_split_to_array(
          regexp_replace(COALESCE(p.content, ''), '<[^>]+>', ' ', 'g'),
          '\\s+'
        ),
        1
      ),
      1
    ) / 200.0
  ))::int
`

blogPublicRouter.get("/posts", async (req, res, next) => {
  try {
    const limit  = Math.min(Number(req.query.limit) || 20, 50)
    const offset = Number(req.query.offset) || 0
    const tag    = req.query.tag ? String(req.query.tag).trim() : null

    const where: string[] = ["status = 'published'", "published_at IS NOT NULL"]
    const params: any[]   = []
    if (tag) {
      params.push(tag)
      where.push(`$${params.length} = ANY(tags)`)
    }

    const sql = `
      SELECT p.id, p.slug, p.title, p.excerpt, p.cover_image_url, p.tags,
             p.author_email, p.published_at, p.view_count,
             'Spark' AS author_name,
             ${READ_MINUTES_SQL} AS read_minutes
        FROM blog_posts p
       WHERE ${where.join(" AND ")}
       ORDER BY p.published_at DESC
       LIMIT ${limit} OFFSET ${offset}
    `
    const { rows } = await query(sql, params)
    const { rows: countRows } = await query(
      `SELECT COUNT(*)::int AS total FROM blog_posts WHERE ${where.join(" AND ")}`,
      params,
    )
    res.json({ success: true, data: { posts: rows, total: countRows[0]?.total ?? 0 } })
  } catch (err) { next(err) }
})

blogPublicRouter.get("/posts/:slug", async (req, res, next) => {
  try {
    const slug = String(req.params.slug ?? "").toLowerCase().trim()
    if (!slug) return res.status(400).json({ error: "slug required" })
    const { rows } = await query(
      `SELECT p.id, p.slug, p.title, p.excerpt, p.content, p.content_format,
              p.cover_image_url, p.tags, p.view_count,
              p.author_email, p.published_at, p.created_at, p.updated_at,
              'Spark' AS author_name,
              ${READ_MINUTES_SQL} AS read_minutes
         FROM blog_posts p
        WHERE p.slug = $1
          AND p.status = 'published'
          AND p.published_at IS NOT NULL
        LIMIT 1`,
      [slug],
    )
    if (rows.length === 0) return res.status(404).json({ success: false, error: { message: "Post not found" } })
    res.json({ success: true, data: rows[0] })
  } catch (err) { next(err) }
})

// Increment view count. No auth — public endpoint. Client dedupes per-session via sessionStorage.
blogPublicRouter.post("/posts/:slug/view", async (req, res, next) => {
  try {
    const slug = String(req.params.slug ?? "").toLowerCase().trim()
    if (!slug) return res.status(400).json({ error: "slug required" })
    const { rows } = await query(
      `UPDATE blog_posts
          SET view_count = view_count + 1
        WHERE slug = $1
          AND status = 'published'
          AND published_at IS NOT NULL
       RETURNING view_count`,
      [slug],
    )
    if (rows.length === 0) return res.status(404).json({ success: false, error: { message: "Post not found" } })
    res.json({ success: true, data: { view_count: rows[0].view_count } })
  } catch (err) { next(err) }
})

blogPublicRouter.get("/tags", async (_req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT UNNEST(tags) AS tag, COUNT(*)::int AS count
        FROM blog_posts
       WHERE status = 'published'
       GROUP BY tag
       ORDER BY count DESC, tag ASC
       LIMIT 50
    `)
    res.json({ success: true, data: rows })
  } catch (err) { next(err) }
})

// ─── Admin writes ─────────────────────────────────────────────────────────────

// List all posts (incl. drafts) — visible to anyone with author+ role
blogAdminRouter.get("/posts", requireBlogRole("author"), async (req, res, next) => {
  try {
    const email     = (req as AuthRequest).email!
    const onlyMine  = req.query.mine === "true"
    const status    = req.query.status ? String(req.query.status) : null
    const search    = req.query.q ? String(req.query.q).trim().toLowerCase() : null

    const where: string[] = []
    const params: any[]   = []
    if (onlyMine) { params.push(email); where.push(`author_email = $${params.length}`) }
    if (status && ["draft","published","archived"].includes(status)) {
      params.push(status); where.push(`status = $${params.length}`)
    }
    if (search) {
      params.push(`%${search}%`)
      where.push(`(LOWER(title) LIKE $${params.length} OR LOWER(slug) LIKE $${params.length})`)
    }

    const sql = `
      SELECT p.id, p.slug, p.title, p.excerpt, p.cover_image_url, p.tags,
             p.author_email, p.status, p.published_at, p.updated_at, p.created_at,
             u.name AS author_name
        FROM blog_posts p
        LEFT JOIN allowed_users u ON u.email = p.author_email
        ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        ORDER BY p.updated_at DESC
        LIMIT 200
    `
    const { rows } = await query(sql, params)
    res.json({ success: true, data: rows })
  } catch (err) { next(err) }
})

blogAdminRouter.get("/posts/:id", requireBlogRole("author"), async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) return res.status(400).json({ error: "bad id" })
    const { rows } = await query(`SELECT * FROM blog_posts WHERE id = $1 LIMIT 1`, [id])
    if (rows.length === 0) return res.status(404).json({ error: "not found" })
    res.json({ success: true, data: rows[0] })
  } catch (err) { next(err) }
})

// Create
blogAdminRouter.post("/posts", requireBlogRole("author"), async (req, res, next) => {
  try {
    const email = (req as AuthRequest).email!
    const title = String(req.body?.title ?? "").trim().slice(0, 220)
    if (!title) return res.status(400).json({ error: "title required" })

    const slug    = await generateUniqueSlug(req.body?.slug || title)
    const excerpt = String(req.body?.excerpt ?? "").slice(0, 800)
    const content = String(req.body?.content ?? "")
    const cover   = req.body?.cover_image_url ? String(req.body.cover_image_url).slice(0, 500) : null
    const tags    = sanitizeTags(req.body?.tags)
    const status  = ["draft","published"].includes(req.body?.status) ? req.body.status : "draft"
    const format  = ["html","markdown"].includes(req.body?.content_format) ? req.body.content_format : "html"
    const publishedAt = status === "published" ? new Date() : null

    const { rows } = await query(
      `INSERT INTO blog_posts (slug, title, excerpt, content, content_format, cover_image_url, tags, status, author_email, published_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [slug, title, excerpt, content, format, cover, tags, status, email, publishedAt],
    )

    logAdminAction({
      actor_email: email, action: "broadcast_create",  /* reusing audit verb closest in intent */
      details: { kind: "blog_post_create", id: rows[0].id, slug, status },
      ip: getClientIp(req),
    }).catch(() => {})

    res.status(201).json({ success: true, data: rows[0] })
  } catch (err) { next(err) }
})

// Update — author can edit OWN, editor can edit ANY
blogAdminRouter.patch("/posts/:id", requireBlogRole("author"), async (req, res, next) => {
  try {
    const email     = (req as AuthRequest).email!
    const role      = (req as any).blogRole as "author" | "editor"
    const id        = Number(req.params.id)
    if (!Number.isFinite(id)) return res.status(400).json({ error: "bad id" })

    const { rows: tRows } = await query(`SELECT * FROM blog_posts WHERE id = $1 LIMIT 1`, [id])
    const post = tRows[0]
    if (!post) return res.status(404).json({ error: "not found" })

    if (role !== "editor" && post.author_email !== email) {
      return res.status(403).json({ success: false, error: { message: "You can only edit your own posts.", code: "BLOG_NOT_OWNER" } })
    }

    const updates: string[] = []
    const params:  any[]    = [id]

    if (typeof req.body?.title === "string" && req.body.title.trim()) {
      params.push(req.body.title.trim().slice(0, 220)); updates.push(`title = $${params.length}`)
    }
    if (typeof req.body?.slug === "string" && req.body.slug.trim() && req.body.slug !== post.slug) {
      const newSlug = await generateUniqueSlug(req.body.slug, id)
      params.push(newSlug); updates.push(`slug = $${params.length}`)
    }
    if (typeof req.body?.excerpt === "string") {
      params.push(req.body.excerpt.slice(0, 800)); updates.push(`excerpt = $${params.length}`)
    }
    if (typeof req.body?.content === "string") {
      params.push(req.body.content); updates.push(`content = $${params.length}`)
    }
    if (typeof req.body?.content_format === "string" && ["html","markdown"].includes(req.body.content_format)) {
      params.push(req.body.content_format); updates.push(`content_format = $${params.length}`)
    }
    if (req.body?.cover_image_url !== undefined) {
      const v = req.body.cover_image_url ? String(req.body.cover_image_url).slice(0, 500) : null
      params.push(v); updates.push(`cover_image_url = $${params.length}`)
    }
    if (req.body?.tags !== undefined) {
      params.push(sanitizeTags(req.body.tags)); updates.push(`tags = $${params.length}`)
    }
    if (typeof req.body?.status === "string" && ["draft","published","archived"].includes(req.body.status)) {
      params.push(req.body.status); updates.push(`status = $${params.length}`)
      if (req.body.status === "published" && !post.published_at) {
        updates.push(`published_at = NOW()`)
      }
    }

    if (updates.length === 0) return res.status(400).json({ error: "no valid updates" })

    const { rows } = await query(
      `UPDATE blog_posts SET ${updates.join(", ")} WHERE id = $1 RETURNING *`,
      params,
    )

    logAdminAction({
      actor_email: email, action: "broadcast_create",
      details: { kind: "blog_post_update", id, slug: rows[0].slug, fields: updates.length },
      ip: getClientIp(req),
    }).catch(() => {})

    res.json({ success: true, data: rows[0] })
  } catch (err) { next(err) }
})

// Publish / unpublish convenience
blogAdminRouter.post("/posts/:id/publish", requireBlogRole("author"), async (req, res, next) => {
  try {
    const email = (req as AuthRequest).email!
    const role  = (req as any).blogRole as "author" | "editor"
    const id    = Number(req.params.id)
    const { rows: t } = await query(`SELECT author_email, published_at FROM blog_posts WHERE id = $1 LIMIT 1`, [id])
    if (t.length === 0) return res.status(404).json({ error: "not found" })
    if (role !== "editor" && t[0].author_email !== email) {
      return res.status(403).json({ error: "You can only publish your own posts." })
    }
    const { rows } = await query(
      `UPDATE blog_posts
          SET status = 'published',
              published_at = COALESCE(published_at, NOW())
        WHERE id = $1 RETURNING *`,
      [id],
    )
    res.json({ success: true, data: rows[0] })
  } catch (err) { next(err) }
})

blogAdminRouter.post("/posts/:id/unpublish", requireBlogRole("author"), async (req, res, next) => {
  try {
    const email = (req as AuthRequest).email!
    const role  = (req as any).blogRole as "author" | "editor"
    const id    = Number(req.params.id)
    const { rows: t } = await query(`SELECT author_email FROM blog_posts WHERE id = $1 LIMIT 1`, [id])
    if (t.length === 0) return res.status(404).json({ error: "not found" })
    if (role !== "editor" && t[0].author_email !== email) {
      return res.status(403).json({ error: "You can only unpublish your own posts." })
    }
    const { rows } = await query(
      `UPDATE blog_posts SET status = 'draft' WHERE id = $1 RETURNING *`,
      [id],
    )
    res.json({ success: true, data: rows[0] })
  } catch (err) { next(err) }
})

// Delete — editor only
blogAdminRouter.delete("/posts/:id", requireBlogRole("editor"), async (req, res, next) => {
  try {
    const email = (req as AuthRequest).email!
    const id    = Number(req.params.id)
    const { rows: t } = await query(`SELECT slug FROM blog_posts WHERE id = $1 LIMIT 1`, [id])
    if (t.length === 0) return res.status(404).json({ error: "not found" })
    await query(`DELETE FROM blog_posts WHERE id = $1`, [id])

    logAdminAction({
      actor_email: email, action: "broadcast_deactivate",
      details: { kind: "blog_post_delete", id, slug: t[0].slug },
      ip: getClientIp(req),
    }).catch(() => {})

    res.json({ success: true })
  } catch (err) { next(err) }
})
