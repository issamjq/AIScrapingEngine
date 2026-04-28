/**
 * /api/admin/super/* — super-admin user management.
 *
 * Allowed callers: role = 'owner' (mhmdkrissaty@gmail.com) or 'dev'
 * (issa.mjq@gmail.com). Anyone else gets 403.
 *
 * Routes:
 *   GET    /users               list every allowed_user (search + filter)
 *   PATCH  /users/:email        change role / subscription / is_active / plan_code
 *   DELETE /users/:email        full cascade delete
 *   POST   /users/:email/reset-totp   wipe TOTP enrollment so they can re-pair
 *
 * Every write logs to admin_audit_log via logAdminAction.
 */

import { Router } from "express"
import { query } from "../db"
import { AuthRequest } from "../middleware/auth"
import { logAdminAction } from "../services/adminAuditLogger"
import { getClientIp } from "../services/activityLogger"

export const superAdminRouter = Router()

// Roles allowed to perform super-admin actions
const SUPER_ROLES = new Set(["owner", "dev"])

// Allowed values for role / subscription mutation
const ROLE_OPTIONS         = ["b2b", "b2c", "admin", "dev", "owner"] as const
const SUBSCRIPTION_OPTIONS = ["free", "trial", "paid"] as const

async function getCallerRole(email: string): Promise<string | null> {
  const { rows } = await query(`SELECT role FROM allowed_users WHERE email = $1 LIMIT 1`, [email])
  return rows[0]?.role ?? null
}

// ── Guard middleware: caller must have a super role ──────────────────────────
superAdminRouter.use(async (req, res, next) => {
  try {
    const email = (req as AuthRequest).email
    if (!email) return res.status(401).json({ error: "Unauthenticated" })
    const role = await getCallerRole(email)
    if (!role || !SUPER_ROLES.has(role)) {
      return res.status(403).json({ error: "Forbidden — super admin only" })
    }
    ;(req as any).callerRole  = role
    ;(req as any).callerEmail = email
    next()
  } catch (err) { next(err) }
})

// ── List all users ───────────────────────────────────────────────────────────
superAdminRouter.get("/users", async (req, res, next) => {
  try {
    const search   = String(req.query.q ?? "").trim().toLowerCase()
    const roleF    = String(req.query.role ?? "").trim()
    const subF     = String(req.query.subscription ?? "").trim()
    const activeF  = req.query.active === "true" ? true : req.query.active === "false" ? false : null
    const limit    = Math.min(Number(req.query.limit) || 200, 500)
    const offset   = Number(req.query.offset) || 0

    const where: string[] = []
    const params: any[]   = []

    if (search) {
      params.push(`%${search}%`)
      where.push(`(LOWER(email) LIKE $${params.length} OR LOWER(COALESCE(name,'')) LIKE $${params.length} OR LOWER(COALESCE(company_name,'')) LIKE $${params.length})`)
    }
    if (roleF && ROLE_OPTIONS.includes(roleF as any)) {
      params.push(roleF); where.push(`role = $${params.length}`)
    }
    if (subF && SUBSCRIPTION_OPTIONS.includes(subF as any)) {
      params.push(subF); where.push(`subscription = $${params.length}`)
    }
    if (activeF !== null) {
      params.push(activeF); where.push(`is_active = $${params.length}`)
    }

    const sql = `
      SELECT email, name, company_name, role, subscription, plan_code, billing_interval,
             is_active, signup_country, signup_country_code, signup_city,
             trial_ends_at, billing_renews_at, last_seen_at, totp_required,
             totp_enrolled_at IS NOT NULL AS totp_enrolled,
             firebase_uid, signup_ip, created_at
        FROM allowed_users
        ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
    `
    const { rows } = await query(sql, params)
    const { rows: countRows } = await query(
      `SELECT COUNT(*)::int AS total FROM allowed_users ${where.length ? `WHERE ${where.join(" AND ")}` : ""}`,
      params,
    )
    res.json({ success: true, data: { users: rows, total: countRows[0]?.total ?? 0 } })
  } catch (err) { next(err) }
})

// ── Patch a user (block/unblock, role, subscription, plan_code) ──────────────
superAdminRouter.patch("/users/:email", async (req, res, next) => {
  try {
    const callerEmail: string = (req as any).callerEmail
    const callerRole:  string = (req as any).callerRole
    const target = String(req.params.email ?? "").toLowerCase().trim()
    if (!target) return res.status(400).json({ error: "email required" })

    // Self-modification guard — keep the system rescuable
    if (target === callerEmail.toLowerCase()) {
      return res.status(400).json({
        error: "You can't modify your own account here. Use Settings.",
      })
    }

    // Fetch current state of target so we can decide what's allowed + audit deltas
    const { rows: tRows } = await query(`SELECT email, role, subscription, plan_code, is_active FROM allowed_users WHERE email = $1 LIMIT 1`, [target])
    const t = tRows[0]
    if (!t) return res.status(404).json({ error: "user not found" })

    // Role hierarchy: only the owner (super admin) can mutate the owner role
    // or another caller's role to/from owner. dev can manage admin/b2b/b2c
    // but cannot promote anyone to owner.
    const updates: string[] = []
    const params:  any[]    = [target]

    if (typeof req.body?.is_active === "boolean") {
      params.push(req.body.is_active)
      updates.push(`is_active = $${params.length}`)
    }
    if (req.body?.role && ROLE_OPTIONS.includes(req.body.role)) {
      // Block dev from creating new owners
      if (req.body.role === "owner" && callerRole !== "owner") {
        return res.status(403).json({ error: "Only the owner can grant owner role" })
      }
      // Block anyone from demoting an owner (would orphan the system)
      if (t.role === "owner" && req.body.role !== "owner") {
        return res.status(403).json({ error: "Cannot demote the owner" })
      }
      params.push(req.body.role)
      updates.push(`role = $${params.length}`)
      // If role is privileged, force totp_required = true
      if (["dev", "owner", "admin"].includes(req.body.role)) {
        updates.push(`totp_required = TRUE`)
      } else {
        updates.push(`totp_required = FALSE`)
      }
    }
    if (req.body?.subscription && SUBSCRIPTION_OPTIONS.includes(req.body.subscription)) {
      params.push(req.body.subscription)
      updates.push(`subscription = $${params.length}`)
    }
    if (typeof req.body?.plan_code === "string" && req.body.plan_code.length <= 30) {
      params.push(req.body.plan_code || null)
      updates.push(`plan_code = $${params.length}`)
    }

    if (updates.length === 0) return res.status(400).json({ error: "no valid updates" })

    const { rows } = await query(
      `UPDATE allowed_users SET ${updates.join(", ")}, updated_at = NOW() WHERE email = $1 RETURNING email, role, subscription, plan_code, is_active, totp_required`,
      params,
    )

    logAdminAction({
      actor_email:  callerEmail,
      action:       req.body.role ? "user_role_change"
                    : (typeof req.body.is_active === "boolean") ? "user_ban"
                    : "user_subscription_change",
      target_email: target,
      details:      {
        before: { role: t.role, subscription: t.subscription, plan_code: t.plan_code, is_active: t.is_active },
        after:  rows[0],
      },
      ip: getClientIp(req),
    }).catch(() => {})

    res.json({ success: true, data: rows[0] })
  } catch (err) { next(err) }
})

// ── Reset TOTP enrollment (e.g. user lost phone + ran out of backup codes) ──
superAdminRouter.post("/users/:email/reset-totp", async (req, res, next) => {
  try {
    const callerEmail: string = (req as any).callerEmail
    const target = String(req.params.email ?? "").toLowerCase().trim()
    if (!target) return res.status(400).json({ error: "email required" })

    if (target === callerEmail.toLowerCase()) {
      return res.status(400).json({ error: "Use the regular settings flow for your own account" })
    }

    await query(
      `UPDATE allowed_users
          SET totp_secret = NULL,
              totp_enrolled_at = NULL,
              totp_last_verified_at = NULL
        WHERE email = $1`,
      [target],
    )
    await query(`DELETE FROM totp_backup_codes WHERE user_email = $1`, [target])

    logAdminAction({
      actor_email:  callerEmail,
      action:       "user_role_change",
      target_email: target,
      details:      { totp: "reset" },
      ip:           getClientIp(req),
    }).catch(() => {})

    res.json({ success: true })
  } catch (err) { next(err) }
})

// ── Delete a user (cascades via FK ON DELETE CASCADE) ────────────────────────
superAdminRouter.delete("/users/:email", async (req, res, next) => {
  try {
    const callerEmail: string = (req as any).callerEmail
    const callerRole:  string = (req as any).callerRole
    const target = String(req.params.email ?? "").toLowerCase().trim()
    if (!target) return res.status(400).json({ error: "email required" })

    if (target === callerEmail.toLowerCase()) {
      return res.status(400).json({ error: "Cannot delete your own account here" })
    }

    const { rows: tRows } = await query(`SELECT role FROM allowed_users WHERE email = $1 LIMIT 1`, [target])
    if (tRows.length === 0) return res.status(404).json({ error: "user not found" })
    if (tRows[0].role === "owner") {
      return res.status(403).json({ error: "Cannot delete the owner account" })
    }
    // Only owner can delete a dev (extra safety)
    if (tRows[0].role === "dev" && callerRole !== "owner") {
      return res.status(403).json({ error: "Only the owner can delete a dev account" })
    }

    await query(`DELETE FROM allowed_users WHERE email = $1`, [target])

    logAdminAction({
      actor_email:  callerEmail,
      action:       "user_delete",
      target_email: target,
      details:      { role_before: tRows[0].role },
      ip:           getClientIp(req),
    }).catch(() => {})

    res.json({ success: true })
  } catch (err) { next(err) }
})
