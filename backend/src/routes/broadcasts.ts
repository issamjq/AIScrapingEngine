/**
 * broadcasts — admin-controlled banners shown to all logged-in users.
 * - GET  /api/broadcasts/active — public to logged-in users; returns the currently active banner
 * - POST /api/broadcasts         — admin only; create
 * - POST /api/broadcasts/:id/deactivate — admin only; turn off
 * - GET  /api/broadcasts         — admin only; list recent
 */

import { Router } from "express"
import { query } from "../db"
import { AuthRequest, requireAuth } from "../middleware/auth"
import { logAdminAction } from "../services/adminAuditLogger"
import { getClientIp } from "../services/activityLogger"

export const broadcastsRouter = Router()

const ADMIN_EMAILS = new Set(["mhmdkrissaty@gmail.com", "issa.mjq@gmail.com"])

function isAdmin(email?: string | null): boolean {
  return !!email && ADMIN_EMAILS.has(email)
}

// ── Active banner — PUBLIC (no auth required) ────────────────────────────────
// Landing-page visitors and signed-in users both fetch this. We return the
// minimum payload (no created_by, no created_at) and skip the timing log.
broadcastsRouter.get("/active", async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, message, variant, starts_at, ends_at
         FROM broadcasts
        WHERE active = TRUE
          AND starts_at <= NOW()
          AND (ends_at IS NULL OR ends_at > NOW())
        ORDER BY starts_at DESC
        LIMIT 1`,
    )
    res.json({ success: true, data: rows[0] ?? null })
  } catch (err) { next(err) }
})

// All routes below require auth — applied as middleware, so anything that
// follows this line gets requireAuth automatically.
broadcastsRouter.use(requireAuth)

// ── Admin-only routes ────────────────────────────────────────────────────────
broadcastsRouter.get("/", async (req, res, next) => {
  try {
    const email = (req as AuthRequest).email
    if (!isAdmin(email)) return res.status(403).json({ error: "Forbidden" })
    const { rows } = await query(
      `SELECT id, message, variant, active, starts_at, ends_at, created_by, created_at
         FROM broadcasts
        ORDER BY created_at DESC
        LIMIT 50`,
    )
    res.json({ success: true, data: rows })
  } catch (err) { next(err) }
})

broadcastsRouter.post("/", async (req, res, next) => {
  try {
    const email = (req as AuthRequest).email
    if (!isAdmin(email)) return res.status(403).json({ error: "Forbidden" })

    const message = String(req.body?.message ?? "").trim()
    if (!message || message.length > 500) {
      return res.status(400).json({ error: "message required (1–500 chars)" })
    }
    const variant: "info" | "warn" | "success" | "danger" =
      ["info", "warn", "success", "danger"].includes(req.body?.variant) ? req.body.variant : "info"
    const endsAt = req.body?.ends_at ? new Date(req.body.ends_at) : null

    const { rows } = await query(
      `INSERT INTO broadcasts (message, variant, active, ends_at, created_by)
       VALUES ($1, $2, TRUE, $3, $4)
       RETURNING *`,
      [message, variant, endsAt, email],
    )

    logAdminAction({
      actor_email: email!,
      action:      "broadcast_create",
      details:     { id: rows[0].id, variant, has_end: !!endsAt },
      ip:          getClientIp(req),
    })

    res.status(201).json({ success: true, data: rows[0] })
  } catch (err) { next(err) }
})

broadcastsRouter.post("/:id/deactivate", async (req, res, next) => {
  try {
    const email = (req as AuthRequest).email
    if (!isAdmin(email)) return res.status(403).json({ error: "Forbidden" })

    const id = parseInt(req.params.id, 10)
    if (!Number.isFinite(id)) return res.status(400).json({ error: "bad id" })

    const { rows } = await query(
      `UPDATE broadcasts SET active = FALSE WHERE id = $1 RETURNING id, message`,
      [id],
    )
    if (rows.length === 0) return res.status(404).json({ error: "not found" })

    logAdminAction({
      actor_email: email!,
      action:      "broadcast_deactivate",
      details:     { id },
      ip:          getClientIp(req),
    })

    res.json({ success: true })
  } catch (err) { next(err) }
})
