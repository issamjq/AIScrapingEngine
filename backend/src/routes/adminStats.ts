/**
 * Admin Stats — owner-only endpoint.
 * Returns full platform metrics: users, scrapes, searches, revenue signals, daily activity.
 * Only accessible to mhmdkrissaty@gmail.com and karaaliissa@gmail.com.
 */

import { Router } from "express"
import { query }  from "../db"
import { AuthRequest } from "../middleware/auth"
import { lookupBatch } from "../services/geoService"
import { logger } from "../utils/logger"

export const adminStatsRouter = Router()

const ADMIN_EMAILS = new Set([
  "mhmdkrissaty@gmail.com",
  "karaaliissa@gmail.com",
])

/**
 * Lazily resolve country for any existing users that have signup_ip but no
 * signup_country (one-shot backfill on first admin-dashboard loads after
 * deploy). Limited to 50 IPs per call so we stay well under ip-api rate limits.
 */
async function backfillMissingGeo(): Promise<void> {
  try {
    const { rows } = await query(
      `SELECT DISTINCT signup_ip
         FROM allowed_users
        WHERE signup_ip IS NOT NULL
          AND signup_ip <> 'unknown'
          AND signup_country IS NULL
        LIMIT 50`,
    )
    const ips = rows.map(r => r.signup_ip).filter(Boolean) as string[]
    if (ips.length === 0) return

    const geo = await lookupBatch(ips)
    for (const [ip, g] of geo) {
      if (!g.country && !g.countryCode && !g.city) continue
      await query(
        `UPDATE allowed_users
            SET signup_country = COALESCE(signup_country, $2),
                signup_country_code = COALESCE(signup_country_code, $3),
                signup_city = COALESCE(signup_city, $4)
          WHERE signup_ip = $1`,
        [ip, g.country, g.countryCode, g.city],
      )
    }
  } catch (err: any) {
    logger.warn("[AdminStats] geo backfill failed", { error: err.message })
  }
}

adminStatsRouter.get("/", async (req, res, next) => {
  try {
    const email = (req as AuthRequest).email!

    if (!ADMIN_EMAILS.has(email)) {
      return res.status(403).json({ error: "Forbidden" })
    }

    // Fire-and-forget backfill — resolves country for any older users whose
    // signup_ip was captured before geo tracking was added.
    backfillMissingGeo().catch(() => {})

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

    // ── Activity log feed (last 100 events) ──────────────────────────────────
    const { rows: activityFeed } = await query(`
      SELECT id, user_email, role, action, details, ip, created_at
      FROM activity_log
      ORDER BY created_at DESC
      LIMIT 100
    `)

    // ── Activity counts by action type (last 7 days) ──────────────────────────
    const { rows: actionCounts } = await query(`
      SELECT action, COUNT(*)::int AS count
      FROM activity_log
      WHERE created_at >= NOW() - INTERVAL '7 days'
      GROUP BY action
      ORDER BY count DESC
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

    // ── Live users (heartbeat based) ─────────────────────────────────────────
    // A user is "live" if their last_seen_at is within N minutes. The frontend
    // pings /api/heartbeat every 60s while the app is open, so a 5-minute
    // window catches everyone currently using the product.
    const { rows: liveCounts } = await query(`
      SELECT
        COUNT(*) FILTER (WHERE last_seen_at >= NOW() - INTERVAL '5 minutes')::int   AS live_5m,
        COUNT(*) FILTER (WHERE last_seen_at >= NOW() - INTERVAL '30 minutes')::int  AS live_30m,
        COUNT(*) FILTER (WHERE last_seen_at >= NOW() - INTERVAL '24 hours')::int    AS active_24h
      FROM allowed_users
    `)
    const lc = liveCounts[0] || {}

    const { rows: liveList } = await query(`
      SELECT email, role, plan_code, signup_country, signup_country_code, last_seen_at
        FROM allowed_users
       WHERE last_seen_at >= NOW() - INTERVAL '5 minutes'
       ORDER BY last_seen_at DESC
       LIMIT 20
    `)

    // ── Users by country ─────────────────────────────────────────────────────
    const { rows: byCountry } = await query(`
      SELECT
        COALESCE(signup_country, 'Unknown')       AS country,
        signup_country_code                       AS code,
        COUNT(*)::int                             AS count
      FROM allowed_users
      GROUP BY signup_country, signup_country_code
      ORDER BY count DESC
      LIMIT 25
    `)

    const geoKnown = byCountry
      .filter((r: any) => r.country && r.country !== "Unknown")
      .reduce((sum: number, r: any) => sum + Number(r.count), 0)
    const geoUnknown = Number(c.total_users) - geoKnown

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
        // Activity monitoring
        activity_feed:   activityFeed,
        action_counts:   actionCounts,
        // Live presence + geo
        live_users: {
          live_5m:    Number(lc.live_5m)    || 0,
          live_30m:   Number(lc.live_30m)   || 0,
          active_24h: Number(lc.active_24h) || 0,
          online: liveList,
        },
        users_by_country: byCountry,
        geo_summary: {
          known:   geoKnown,
          unknown: geoUnknown < 0 ? 0 : geoUnknown,
        },
      },
    })
  } catch (err) { next(err) }
})
