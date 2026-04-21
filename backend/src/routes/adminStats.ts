/**
 * Admin Stats — owner-only endpoint.
 * Returns full platform metrics: users, scrapes, searches, revenue signals, daily activity.
 * Only accessible to mhmdkrissaty@gmail.com and karaaliissa@gmail.com.
 */

import { Router } from "express"
import { query }  from "../db"
import { AuthRequest } from "../middleware/auth"

export const adminStatsRouter = Router()

const ADMIN_EMAILS = new Set([
  "mhmdkrissaty@gmail.com",
  "karaaliissa@gmail.com",
])

adminStatsRouter.get("/", async (req, res, next) => {
  try {
    const email = (req as AuthRequest).email!

    if (!ADMIN_EMAILS.has(email)) {
      return res.status(403).json({ error: "Forbidden" })
    }

    // ── Core counts ──────────────────────────────────────────────────────────
    const { rows: counts } = await query(`
      SELECT
        (SELECT COUNT(*)::int FROM allowed_users)                             AS total_users,
        (SELECT COUNT(*)::int FROM allowed_users WHERE role = 'b2b')          AS b2b_users,
        (SELECT COUNT(*)::int FROM allowed_users WHERE role = 'b2c')          AS b2c_users,
        (SELECT COUNT(*)::int FROM allowed_users WHERE role = 'dev')          AS dev_users,
        (SELECT COUNT(*)::int FROM allowed_users
          WHERE created_at >= NOW() - INTERVAL '7 days')                      AS new_users_7d,
        (SELECT COUNT(*)::int FROM allowed_users
          WHERE created_at >= NOW() - INTERVAL '30 days')                     AS new_users_30d,
        (SELECT COUNT(*)::int FROM allowed_users
          WHERE subscription = 'paid')                                        AS paid_users,
        (SELECT COUNT(*)::int FROM b2c_search_history)                        AS total_b2c_searches,
        (SELECT COUNT(*)::int FROM b2c_search_history
          WHERE searched_at >= NOW() - INTERVAL '24 hours')                   AS b2c_searches_24h,
        (SELECT COUNT(*)::int FROM b2c_search_history
          WHERE searched_at >= NOW() - INTERVAL '7 days')                     AS b2c_searches_7d,
        (SELECT COUNT(*)::int FROM price_snapshots)                           AS total_scrapes,
        (SELECT COUNT(*)::int FROM price_snapshots
          WHERE checked_at >= NOW() - INTERVAL '24 hours')                    AS scrapes_24h,
        (SELECT COUNT(*)::int FROM amazon_trending)                           AS creator_intel_products,
        (SELECT COUNT(*)::int FROM amazon_trending
          WHERE scraped_at >= NOW() - INTERVAL '24 hours')                    AS creator_intel_24h,
        (SELECT COUNT(*)::int FROM products WHERE is_active = true)           AS total_products,
        (SELECT COUNT(*)::int FROM companies WHERE is_active = true)          AS total_stores,
        (SELECT COALESCE(SUM(total_used), 0)::int FROM user_wallet)           AS total_credits_used,
        (SELECT COALESCE(SUM(balance), 0)::int FROM user_wallet)              AS total_credits_balance,
        (SELECT MAX(created_at) FROM allowed_users)                           AS last_signup_at
    `)

    const c = counts[0] || {}

    // ── New users per day (last 30 days) ─────────────────────────────────────
    const { rows: usersByDay } = await query(`
      SELECT
        DATE(created_at) AS date,
        COUNT(*)::int    AS count
      FROM allowed_users
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `)

    // ── B2C searches per day (last 30 days) ───────────────────────────────────
    const { rows: searchesByDay } = await query(`
      SELECT
        DATE(searched_at) AS date,
        COUNT(*)::int     AS count
      FROM b2c_search_history
      WHERE searched_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(searched_at)
      ORDER BY date ASC
    `)

    // ── Scrapes per day (last 30 days) ────────────────────────────────────────
    const { rows: scrapesByDay } = await query(`
      SELECT
        DATE(checked_at) AS date,
        COUNT(*)::int    AS count
      FROM price_snapshots
      WHERE checked_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(checked_at)
      ORDER BY date ASC
    `)

    // ── Credits used per day (last 30 days) ───────────────────────────────────
    const { rows: creditsByDay } = await query(`
      SELECT
        DATE(created_at) AS date,
        ABS(SUM(amount))::int AS credits
      FROM wallet_transactions
      WHERE type = 'debit'
        AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `)

    // ── Top search queries (last 7 days) ──────────────────────────────────────
    const { rows: topQueries } = await query(`
      SELECT
        query,
        COUNT(*)::int AS count
      FROM b2c_search_history
      WHERE searched_at >= NOW() - INTERVAL '7 days'
      GROUP BY query
      ORDER BY count DESC
      LIMIT 10
    `)

    // ── Users by plan ─────────────────────────────────────────────────────────
    const { rows: byPlan } = await query(`
      SELECT
        COALESCE(plan_code, 'unknown') AS plan,
        COUNT(*)::int AS count
      FROM allowed_users
      GROUP BY plan_code
      ORDER BY count DESC
    `)

    // ── Recent signups ────────────────────────────────────────────────────────
    const { rows: recentSignups } = await query(`
      SELECT email, role, plan_code, created_at
      FROM allowed_users
      ORDER BY created_at DESC
      LIMIT 10
    `)

    // ── Creator Intel scrapes by marketplace (last 30 days) ──────────────────
    const { rows: byMarketplace } = await query(`
      SELECT
        marketplace,
        COUNT(*)::int AS count,
        MAX(scraped_at) AS last_scraped
      FROM amazon_trending
      WHERE scraped_at >= NOW() - INTERVAL '30 days'
      GROUP BY marketplace
      ORDER BY count DESC
    `)

    return res.json({
      success: true,
      data: {
        // Core metrics
        users: {
          total:      Number(c.total_users)    || 0,
          b2b:        Number(c.b2b_users)      || 0,
          b2c:        Number(c.b2c_users)      || 0,
          dev:        Number(c.dev_users)       || 0,
          new_7d:     Number(c.new_users_7d)   || 0,
          new_30d:    Number(c.new_users_30d)  || 0,
          paid:       Number(c.paid_users)     || 0,
          last_signup_at: c.last_signup_at ?? null,
        },
        searches: {
          total:   Number(c.total_b2c_searches) || 0,
          last_24h: Number(c.b2c_searches_24h)  || 0,
          last_7d:  Number(c.b2c_searches_7d)   || 0,
        },
        scrapes: {
          total:    Number(c.total_scrapes) || 0,
          last_24h: Number(c.scrapes_24h)  || 0,
        },
        creator_intel: {
          total_products: Number(c.creator_intel_products) || 0,
          last_24h:       Number(c.creator_intel_24h)      || 0,
          by_marketplace: byMarketplace,
        },
        catalog: {
          products: Number(c.total_products) || 0,
          stores:   Number(c.total_stores)   || 0,
        },
        credits: {
          total_used:    Number(c.total_credits_used)    || 0,
          total_balance: Number(c.total_credits_balance) || 0,
        },
        // Time series (last 30 days)
        charts: {
          users_by_day:    usersByDay,
          searches_by_day: searchesByDay,
          scrapes_by_day:  scrapesByDay,
          credits_by_day:  creditsByDay,
        },
        // Lists
        top_queries:    topQueries,
        users_by_plan:  byPlan,
        recent_signups: recentSignups,
      },
    })
  } catch (err) { next(err) }
})
