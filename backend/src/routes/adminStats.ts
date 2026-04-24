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
import { PLANS, legacyPlanKey } from "../config/plans"

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
          AND (signup_country IS NULL OR signup_lat IS NULL)
        LIMIT 50`,
    )
    const ips = rows.map(r => r.signup_ip).filter(Boolean) as string[]
    if (ips.length === 0) return

    const geo = await lookupBatch(ips)
    for (const [ip, g] of geo) {
      if (!g.country && !g.countryCode && !g.city && g.lat == null) continue
      await query(
        `UPDATE allowed_users
            SET signup_country      = COALESCE(signup_country, $2),
                signup_country_code = COALESCE(signup_country_code, $3),
                signup_city         = COALESCE(signup_city, $4),
                signup_region       = COALESCE(signup_region, $5),
                signup_lat          = COALESCE(signup_lat, $6),
                signup_lon          = COALESCE(signup_lon, $7)
          WHERE signup_ip = $1`,
        [ip, g.country, g.countryCode, g.city, g.region, g.lat, g.lon],
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

    // Return presence points for the globe — covers last 30 minutes.
    // Frontend colors by status: "live" (≤5m) vs "recent" (5–30m).
    const { rows: liveList } = await query(`
      SELECT email,
             role,
             plan_code,
             signup_country,
             signup_country_code,
             signup_city,
             signup_lat,
             signup_lon,
             last_seen_at,
             CASE
               WHEN last_seen_at >= NOW() - INTERVAL '5 minutes'  THEN 'live'
               ELSE 'recent'
             END AS status
        FROM allowed_users
       WHERE last_seen_at >= NOW() - INTERVAL '30 minutes'
       ORDER BY last_seen_at DESC
       LIMIT 100
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

    // ── Revenue / MRR ────────────────────────────────────────────────────────
    // Group paid users by plan + billing_interval, multiply by price, normalize
    // weekly→monthly (×4.333), yearly→monthly (÷12). ARR = MRR × 12.
    const { rows: paidByPlan } = await query(`
      SELECT
        COALESCE(plan_code, subscription)      AS plan_key,
        COALESCE(billing_interval, 'monthly')  AS interval,
        role,
        subscription,
        COUNT(*)::int                          AS count
      FROM allowed_users
      WHERE subscription = 'paid'
      GROUP BY plan_code, billing_interval, role, subscription
    `)
    let mrr = 0
    let weeklyRevenue = 0
    const revenueBreakdown: { plan: string; interval: string; count: number; mrr: number }[] = []
    for (const row of paidByPlan) {
      const key  = row.plan_key && PLANS.some(p => p.key === row.plan_key)
        ? row.plan_key
        : legacyPlanKey(row.role ?? "b2c", row.subscription ?? "paid")
      const plan = PLANS.find(p => p.key === key)
      if (!plan) continue
      const count = Number(row.count) || 0
      let perUserMonthly = 0
      if (row.interval === "weekly")  perUserMonthly = plan.prices.weekly * 4.333
      else if (row.interval === "yearly") perUserMonthly = plan.prices.yearly / 12
      else perUserMonthly = plan.prices.monthly
      const bucketMrr = perUserMonthly * count
      mrr += bucketMrr
      if (row.interval === "weekly") weeklyRevenue += plan.prices.weekly * count
      revenueBreakdown.push({
        plan:     plan.name,
        interval: row.interval,
        count,
        mrr:      Math.round(bucketMrr),
      })
    }

    // ── Power users leaderboard (credits burned last 7d) ─────────────────────
    const { rows: powerUsers } = await query(`
      SELECT
        wt.user_email                                   AS email,
        au.role,
        au.plan_code,
        au.signup_country_code                          AS country_code,
        au.signup_country                               AS country,
        COALESCE(SUM(ABS(wt.amount)), 0)::int           AS credits_used,
        COUNT(*)::int                                   AS tx_count
      FROM wallet_transactions wt
      LEFT JOIN allowed_users au ON au.email = wt.user_email
      WHERE wt.type = 'debit'
        AND wt.created_at >= NOW() - INTERVAL '7 days'
      GROUP BY wt.user_email, au.role, au.plan_code, au.signup_country_code, au.signup_country
      ORDER BY credits_used DESC
      LIMIT 10
    `)

    // ── Scrape health (per retailer, last 24h) ───────────────────────────────
    const { rows: scrapeHealth } = await query(`
      SELECT
        COALESCE(c.name, 'Unknown')                                 AS retailer,
        COUNT(*)::int                                               AS total,
        COUNT(*) FILTER (WHERE ps.scrape_status = 'success')::int   AS success,
        COUNT(*) FILTER (WHERE ps.scrape_status <> 'success')::int  AS failed,
        MAX(ps.checked_at)                                          AS last_scrape
      FROM price_snapshots ps
      LEFT JOIN companies c ON c.id = ps.company_id
      WHERE ps.checked_at >= NOW() - INTERVAL '24 hours'
      GROUP BY c.name
      ORDER BY total DESC
      LIMIT 15
    `)

    // ── Retention: DAU / WAU / MAU ───────────────────────────────────────────
    const { rows: retentionSummary } = await query(`
      SELECT
        COUNT(DISTINCT user_email) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours')::int AS dau,
        COUNT(DISTINCT user_email) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int   AS wau,
        COUNT(DISTINCT user_email) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::int  AS mau
      FROM activity_log
    `)
    const rs = retentionSummary[0] || {}

    const { rows: dauByDay } = await query(`
      SELECT
        DATE(created_at)                   AS date,
        COUNT(DISTINCT user_email)::int    AS dau
      FROM activity_log
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `)

    // ── Funnel: signups → activated (first search) → paid ────────────────────
    const { rows: funnelRow } = await query(`
      WITH first_search AS (
        SELECT DISTINCT user_email FROM b2c_search_history
      )
      SELECT
        (SELECT COUNT(*)::int FROM allowed_users)                                            AS signups,
        (SELECT COUNT(*)::int FROM allowed_users au
            WHERE au.email IN (SELECT user_email FROM first_search)
               OR au.email IN (SELECT DISTINCT user_email FROM activity_log
                                WHERE action IN ('b2c_search','b2b_ai_search','b2b_catalog_discovery'))) AS activated,
        (SELECT COUNT(*)::int FROM allowed_users WHERE subscription = 'paid')                AS paid
    `)
    const funnel = funnelRow[0] || { signups: 0, activated: 0, paid: 0 }

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
          // "online" = the 5-minute window (used by the Active Right Now list)
          online: liveList.filter((u: any) => u.status === "live"),
          // "points" = the full 30-minute window with status flag + numeric lat/lon,
          // rendered as green (live) / blue (recent) dots on the globe.
          points: liveList.map((u: any) => ({
            email:               u.email,
            role:                u.role,
            country:             u.signup_country,
            country_code:        u.signup_country_code,
            city:                u.signup_city,
            lat:                 u.signup_lat != null ? Number(u.signup_lat) : null,
            lng:                 u.signup_lon != null ? Number(u.signup_lon) : null,
            last_seen_at:        u.last_seen_at,
            status:              u.status,
          })).filter((p: any) => p.lat != null && p.lng != null),
        },
        users_by_country: byCountry,
        geo_summary: {
          known:   geoKnown,
          unknown: geoUnknown < 0 ? 0 : geoUnknown,
        },

        revenue: {
          mrr:            Math.round(mrr),
          arr:            Math.round(mrr * 12),
          weekly_revenue: Math.round(weeklyRevenue),
          breakdown:      revenueBreakdown,
        },
        power_users: powerUsers,
        scrape_health: scrapeHealth,
        retention: {
          dau: Number(rs.dau) || 0,
          wau: Number(rs.wau) || 0,
          mau: Number(rs.mau) || 0,
          dau_by_day: dauByDay,
        },
        funnel: {
          signups:   Number(funnel.signups)   || 0,
          activated: Number(funnel.activated) || 0,
          paid:      Number(funnel.paid)      || 0,
        },
      },
    })
  } catch (err) { next(err) }
})
