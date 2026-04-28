/**
 * admin/user — detail endpoint for a single user.
 * Returns everything the admin needs to triage / debug them without opening
 * the DB: profile, wallet, credit transactions, activity feed, search history,
 * rate-limit hits, and actions targeting this user in the audit log.
 *
 * Admin-only (mhmdkrissaty@gmail.com / issa.mjq@gmail.com).
 */

import { Router } from "express"
import { query } from "../db"
import { AuthRequest } from "../middleware/auth"

export const adminUserRouter = Router()

const ADMIN_EMAILS = new Set([
  "mhmdkrissaty@gmail.com",
  "issa.mjq@gmail.com",
])

adminUserRouter.get("/:email", async (req, res, next) => {
  try {
    const caller = (req as AuthRequest).email!
    if (!ADMIN_EMAILS.has(caller)) return res.status(403).json({ error: "Forbidden" })

    const target = String(req.params.email ?? "").toLowerCase().trim()
    if (!target) return res.status(400).json({ error: "email required" })

    // Profile
    const { rows: profRows } = await query(
      `SELECT id, email, name, role, company_name, is_active, subscription, plan_code,
              billing_interval, trial_ends_at, billing_renews_at, firebase_uid,
              signup_ip, signup_country, signup_country_code, signup_city, signup_region,
              signup_lat, signup_lon, last_seen_at, last_seen_ip,
              utm_source, utm_medium, utm_campaign, referrer,
              created_at, updated_at
         FROM allowed_users
        WHERE email = $1
        LIMIT 1`,
      [target],
    )
    if (profRows.length === 0) return res.status(404).json({ error: "user not found" })
    const profile = profRows[0]

    // Wallet
    const { rows: walletRows } = await query(
      `SELECT balance, total_added, total_used,
              credits_used_today, credits_used_this_week, credits_used_this_cycle,
              daily_limit, weekly_limit, monthly_limit,
              last_daily_reset_at, last_weekly_reset_at, last_cycle_reset_at,
              updated_at
         FROM user_wallet
        WHERE user_email = $1
        LIMIT 1`,
      [target],
    )
    const wallet = walletRows[0] || null

    // Credit transactions (last 30)
    const { rows: txRows } = await query(
      `SELECT id, amount, balance_after, type, description, created_at
         FROM wallet_transactions
        WHERE user_email = $1
        ORDER BY created_at DESC
        LIMIT 30`,
      [target],
    )

    // Activity feed for this user (last 50)
    const { rows: activity } = await query(
      `SELECT id, action, details, ip, created_at
         FROM activity_log
        WHERE user_email = $1
        ORDER BY created_at DESC
        LIMIT 50`,
      [target],
    )

    // B2C search history (last 20)
    const { rows: searches } = await query(
      `SELECT id, query, batch, searched_at, results
         FROM b2c_search_history
        WHERE user_email = $1
        ORDER BY searched_at DESC
        LIMIT 20`,
      [target],
    )

    // Rate-limit hits (last 20)
    const { rows: rlHits } = await query(
      `SELECT id, limit_type, route, ip, created_at
         FROM rate_limit_hits
        WHERE user_email = $1
        ORDER BY created_at DESC
        LIMIT 20`,
      [target],
    )

    // Audit events targeting this user
    const { rows: audit } = await query(
      `SELECT id, actor_email, action, details, created_at
         FROM admin_audit_log
        WHERE target_email = $1
        ORDER BY created_at DESC
        LIMIT 20`,
      [target],
    )

    // Errors (from this user)
    const { rows: errors } = await query(
      `SELECT id, level, source, message, path, status, created_at
         FROM error_log
        WHERE user_email = $1
        ORDER BY created_at DESC
        LIMIT 20`,
      [target],
    )

    // Summary counters
    const { rows: summaryRows } = await query(
      `SELECT
         (SELECT COUNT(*)::int FROM b2c_search_history WHERE user_email = $1)     AS total_searches,
         (SELECT COUNT(*)::int FROM activity_log       WHERE user_email = $1)     AS total_actions,
         (SELECT COALESCE(SUM(ABS(amount)), 0)::int FROM wallet_transactions
            WHERE user_email = $1 AND type = 'debit')                             AS total_credits_used,
         (SELECT COUNT(*)::int FROM activity_log
            WHERE user_email = $1 AND created_at >= NOW() - INTERVAL '7 days')    AS actions_7d`,
      [target],
    )
    const summary = summaryRows[0] || {}

    res.json({
      success: true,
      data: {
        profile,
        wallet,
        summary: {
          total_searches:     Number(summary.total_searches)     || 0,
          total_actions:      Number(summary.total_actions)      || 0,
          total_credits_used: Number(summary.total_credits_used) || 0,
          actions_7d:         Number(summary.actions_7d)         || 0,
        },
        transactions: txRows,
        activity,
        searches,
        rate_limit_hits: rlHits,
        audit_events:    audit,
        errors,
      },
    })
  } catch (err) { next(err) }
})
