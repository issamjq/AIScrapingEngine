import { Response, NextFunction } from "express"
import { query } from "../db"
import { AuthRequest } from "./auth"

/**
 * Usage limit middleware for discovery endpoints.
 *
 * Roles:
 *   001 = Dev        → unlimited always
 *   002 = Owner      → unlimited always
 *   010 = B2B client → tier limits below
 *   020 = B2C user   → tier limits below
 *
 * Subscriptions:
 *   trial → time-limited higher allowance (B2B=14 days, B2C=7 days)
 *   free  → standard free tier
 *   paid  → full paid allowance
 *
 * Daily limits (searches/day):
 *   Role  │ trial │ free │ paid
 *   ──────┼───────┼──────┼──────
 *   010   │  50   │  20  │  200
 *   020   │  20   │  10  │   50
 *
 * Counter resets daily (compares date of last_reset_at vs today UTC).
 */

const UNLIMITED_ROLES = ["001", "002"]

const LIMITS: Record<string, Record<string, number>> = {
  "010": { trial: 50,  free: 20,  paid: 200 },
  "020": { trial: 20,  free: 10,  paid: 50  },
}

const TRIAL_DAYS: Record<string, number> = {
  "010": 14,
  "020": 7,
}

// Default for unknown roles (fall back to B2C free limits)
const DEFAULT_LIMITS = { trial: 20, free: 10, paid: 50 }

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
    if (!user) return next()  // Not in allowed_users — let requireAuth handle it

    // 001 / 002 → always unlimited
    if (UNLIMITED_ROLES.includes(user.role)) return next()

    const role = user.role || "020"
    let subscription: string = user.subscription || "free"

    // If trial has expired → treat as free automatically
    if (subscription === "trial" && user.trial_ends_at) {
      const trialEnd = new Date(user.trial_ends_at)
      if (trialEnd < new Date()) {
        subscription = "free"
        // Downgrade in DB silently
        query(
          `UPDATE allowed_users SET subscription = 'free' WHERE email = $1`,
          [email]
        ).catch(() => {})
      }
    }

    const roleLimits = LIMITS[role] || DEFAULT_LIMITS
    const limit      = roleLimits[subscription] ?? roleLimits.free

    // Reset daily counter if it's a new day (UTC)
    const lastReset = user.last_reset_at ? new Date(user.last_reset_at) : null
    const today     = new Date()
    const isNewDay  = !lastReset || lastReset.toUTCString().slice(0, 16) !== today.toUTCString().slice(0, 16)

    if (isNewDay) {
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
          message:      `Daily limit reached (${used}/${limit} searches today). ${subscription === "free" ? "Upgrade to paid to continue." : "You've hit your plan limit."}`,
          code:         "USAGE_LIMIT_REACHED",
          limit,
          used,
          subscription,
          role,
          trial_ends_at: user.trial_ends_at || null,
        },
      })
    }

    // Increment and proceed
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
