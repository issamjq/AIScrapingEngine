import { Router } from "express"
import { Request, Response, NextFunction } from "express"
import { query } from "../db"
import { createError } from "../middleware/validate"
import { AuthRequest } from "../middleware/auth"
import { trialEndsAt } from "../middleware/usageLimit"

export const allowedUsersRouter = Router()

const MANAGEMENT_ROLES = ["dev", "owner", "admin"]

async function getCallerUser(email: string) {
  const { rows } = await query(
    "SELECT * FROM allowed_users WHERE email = $1 AND is_active = true LIMIT 1",
    [email]
  )
  return rows[0] || null
}

// GET /api/allowed-users/me — access check after login
allowedUsersRouter.get("/me", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const email = req.email
    if (!email) return next(createError("No email in token", 401, "UNAUTHENTICATED"))

    const user = await getCallerUser(email)
    if (user) return res.json({ success: true, data: user })

    // Bootstrap mode: first user gets Super Admin
    const { rows: countRows } = await query("SELECT COUNT(*) FROM allowed_users")
    if (parseInt(countRows[0].count, 10) === 0) {
      return res.json({
        success: true,
        data: { id: 0, email, name: email, role: "003", is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      })
    }

    return res.status(403).json({
      success: false,
      error: { message: "Access denied. Your account is not authorised to use this application.", code: "FORBIDDEN" },
    })
  } catch (err) { next(err) }
})

// Management middleware
async function requireManagement(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const email = req.email
    if (!email) return next(createError("No email in token", 401, "UNAUTHENTICATED"))
    const caller = await getCallerUser(email)
    if (!caller || !MANAGEMENT_ROLES.includes(caller.role)) {
      return res.status(403).json({ success: false, error: { message: "Insufficient permissions", code: "FORBIDDEN" } })
    }
    ;(req as any).callerUser = caller
    next()
  } catch (err) { next(err) }
}

// GET /api/allowed-users
allowedUsersRouter.get("/", requireManagement as any, async (_req, res, next) => {
  try {
    const { rows } = await query("SELECT * FROM allowed_users ORDER BY created_at ASC")
    res.json({ success: true, data: rows })
  } catch (err) { next(err) }
})

// POST /api/allowed-users
allowedUsersRouter.post("/", requireManagement as any, async (req, res, next) => {
  try {
    const { email, name, role = "b2c", is_active = true, subscription } = req.body
    if (!email) return next(createError("email is required", 400, "VALIDATION"))

    // Auto-start trial for B2B/B2C roles unless subscription is explicitly provided
    const effectiveSub    = subscription || "trial"
    const effectiveTrial  = trialEndsAt(role)  // null for 001/002 roles

    const { rows } = await query(
      `INSERT INTO allowed_users (email, name, role, is_active, subscription, trial_ends_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (email) DO UPDATE
         SET name=$2, role=$3, is_active=$4, subscription=$5, trial_ends_at=$6, updated_at=NOW()
       RETURNING *`,
      [email.toLowerCase().trim(), name || null, role, is_active, effectiveSub, effectiveTrial]
    )
    res.status(201).json({ success: true, data: rows[0] })
  } catch (err) { next(err) }
})

// PUT /api/allowed-users/:id
allowedUsersRouter.put("/:id", requireManagement as any, async (req, res, next) => {
  try {
    const { name, role, is_active } = req.body
    const { rows } = await query(
      `UPDATE allowed_users SET
         name       = COALESCE($2, name),
         role       = COALESCE($3, role),
         is_active  = COALESCE($4, is_active),
         updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [req.params.id, name ?? null, role ?? null, is_active ?? null]
    )
    if (!rows.length) return next(createError("User not found", 404, "NOT_FOUND"))
    res.json({ success: true, data: rows[0] })
  } catch (err) { next(err) }
})

// DELETE /api/allowed-users/:id
allowedUsersRouter.delete("/:id", requireManagement as any, async (req, res, next) => {
  try {
    const { rowCount } = await query("DELETE FROM allowed_users WHERE id = $1", [req.params.id])
    if (!rowCount) return next(createError("User not found", 404, "NOT_FOUND"))
    res.json({ success: true })
  } catch (err) { next(err) }
})
