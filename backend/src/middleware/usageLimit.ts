import { Response, NextFunction } from "express"
import { query } from "../db"
import { AuthRequest } from "./auth"

/**
 * Usage limit middleware — role-aware counters.
 *
 * B2B (businesses) → searches per week, resets every 7 days
 *   trial → 20 searches/week  (14-day trial)
 *   free  → 10 searches/week
 *   paid  → 50 searches/week
 *
 * B2C (consumers) → credits per month, resets every 30 days
 *   trial → 30 credits/month  (7-day trial)
 *   free  → 15 credits/month
 *   paid  → 150 credits/month
 *
 * dev / owner → always unlimited
 */

const UNLIMITED_ROLES = ["dev", "owner"]

const B2B_LIMITS: Record<string, number> = {
  trial: 20,
  free:  10,
  paid:  50,
}

const B2C_LIMITS: Record<string, number> = {
  trial: 30,
  free:  15,
  paid:  150,
}

const TRIAL_DAYS: Record<string, number> = {
  b2b: 14,
  b2c: 7,
}

const RESET_MS: Record<string, number> = {
  b2b: 7  * 24 * 60 * 60 * 1000,   //  7 days
  b2c: 30 * 24 * 60 * 60 * 1000,   // 30 days
}

export async function checkUsageLimit(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const email = req.email
    if (!email) {
      return res.status(401).json({ success: false, error: { message: "No email in token", code: "UNAUTHENTICATED" } })
    }

    const { rows } = await query(
      `SELECT role, subscription, trial_ends_at, daily_searches_used, last_reset_at
       FROM allowed_users WHERE email = $1 AND is_active = true LIMIT 1`,
      [email]
    )
    const user = rows[0]
    if (!user) return next()

    // dev / owner → always unlimited
    if (UNLIMITED_ROLES.includes(user.role)) return next()

    const isB2C = user.role === "b2c"
    const limits = isB2C ? B2C_LIMITS : B2B_LIMITS
    const resetMs = isB2C ? RESET_MS.b2c : RESET_MS.b2b
    const periodLabel = isB2C ? "month" : "week"
    const unitLabel   = isB2C ? "credits" : "searches"

    let subscription: string = user.subscription || "free"

    // If trial has expired → auto-downgrade to free
    if (subscription === "trial" && user.trial_ends_at) {
      if (new Date(user.trial_ends_at) < new Date()) {
        subscription = "free"
        query(`UPDATE allowed_users SET subscription = 'free' WHERE email = $1`, [email]).catch(() => {})
      }
    }

    const limit = limits[subscription] ?? limits.free

    // Reset counter if the reset period has passed
    const lastReset  = user.last_reset_at ? new Date(user.last_reset_at) : null
    const isNewPeriod = !lastReset || (Date.now() - lastReset.getTime()) >= resetMs

    if (isNewPeriod) {
      await query(
        `UPDATE allowed_users SET daily_searches_used = 1, last_reset_at = NOW() WHERE email = $1`,
        [email]
      )
      return next()
    }

    const used = user.daily_searches_used || 0
    if (used >= limit) {
      return res.status(429).json({
        success: false,
        error: {
          message:      `${isB2C ? "Monthly" : "Weekly"} limit reached (${used}/${limit} ${unitLabel} this ${periodLabel} on ${subscription} plan).`,
          code:         "USAGE_LIMIT_REACHED",
          limit,
          used,
          subscription,
          role:          user.role,
          trial_ends_at: user.trial_ends_at || null,
        },
      })
    }

    await query(
      `UPDATE allowed_users SET daily_searches_used = daily_searches_used + 1 WHERE email = $1`,
      [email]
    )
    next()
  } catch (err) { next(err) }
}

/** Returns the trial end date for a newly created user of a given role */
export function trialEndsAt(role: string): Date | null {
  const days = TRIAL_DAYS[role]
  if (!days) return null
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d
}
