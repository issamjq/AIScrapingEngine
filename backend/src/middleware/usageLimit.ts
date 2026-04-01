import { Response, NextFunction } from "express"
import { query } from "../db"
import { AuthRequest } from "./auth"

/**
 * Usage limit middleware — weekly search counter.
 *
 * Roles:
 *   dev   → unlimited always
 *   owner → unlimited always
 *   b2b   → weekly limits below
 *   b2c   → weekly limits below
 *
 * Subscriptions + weekly limits (searches per week):
 *   trial → 20/week  (full experience: no blur — handled frontend)
 *   free  → 10/week  (limited experience: 3 results visible per retailer, rest blurred)
 *   paid  → 50/week  (full experience: no blur)
 *
 * Trial duration: b2b=14 days, b2c=7 days
 * Counter resets every 7 days from last reset.
 */

const UNLIMITED_ROLES = ["dev", "owner"]

// Weekly limits — same for b2b and b2c
const WEEKLY_LIMITS: Record<string, number> = {
  trial: 20,
  free:  10,
  paid:  50,
}

const TRIAL_DAYS: Record<string, number> = {
  b2b: 14,
  b2c: 7,
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

    let subscription: string = user.subscription || "free"

    // If trial has expired → auto-downgrade to free
    if (subscription === "trial" && user.trial_ends_at) {
      if (new Date(user.trial_ends_at) < new Date()) {
        subscription = "free"
        query(`UPDATE allowed_users SET subscription = 'free' WHERE email = $1`, [email]).catch(() => {})
      }
    }

    const limit = WEEKLY_LIMITS[subscription] ?? WEEKLY_LIMITS.free

    // Reset counter if 7+ days have passed since last reset
    const lastReset = user.last_reset_at ? new Date(user.last_reset_at) : null
    const isNewWeek = !lastReset || (Date.now() - lastReset.getTime()) >= 7 * 24 * 60 * 60 * 1000

    if (isNewWeek) {
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
          message:      `Weekly limit reached (${used}/${limit} searches this week on ${subscription} plan).`,
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
