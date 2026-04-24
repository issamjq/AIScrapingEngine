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

    // ── At-risk users ────────────────────────────────────────────────────────
    // silent_paid: paid users with no activity in 7+ days → churn risk.
    const { rows: silentPaid } = await query(`
      SELECT email,
             plan_code,
             role,
             signup_country_code                                  AS country_code,
             last_seen_at,
             GREATEST(
               EXTRACT(EPOCH FROM (NOW() - COALESCE(last_seen_at, created_at)))/86400,
               0
             )::int                                               AS days_silent
        FROM allowed_users
       WHERE subscription = 'paid'
         AND (last_seen_at IS NULL OR last_seen_at < NOW() - INTERVAL '7 days')
       ORDER BY last_seen_at ASC NULLS FIRST
       LIMIT 15
    `)

    // ending_trials: trials ending in ≤3 days → convert or lose.
    const { rows: endingTrials } = await query(`
      SELECT email,
             plan_code,
             role,
             signup_country_code                                  AS country_code,
             trial_ends_at,
             GREATEST(
               EXTRACT(EPOCH FROM (trial_ends_at - NOW()))/86400,
               0
             )::int                                               AS days_left
        FROM allowed_users
       WHERE subscription = 'trial'
         AND trial_ends_at IS NOT NULL
         AND trial_ends_at BETWEEN NOW() AND NOW() + INTERVAL '3 days'
       ORDER BY trial_ends_at ASC
       LIMIT 15
    `)

    // credit_exhaustion: users > 80% of monthly quota used → upgrade candidates.
    const { rows: creditExhaustion } = await query(`
      SELECT uw.user_email                                        AS email,
             au.role,
             au.plan_code,
             au.signup_country_code                               AS country_code,
             uw.monthly_limit,
             uw.credits_used_this_cycle                           AS used,
             CASE WHEN uw.monthly_limit > 0
                  THEN ROUND(uw.credits_used_this_cycle::numeric / uw.monthly_limit * 100)::int
                  ELSE 0 END                                      AS pct_used
        FROM user_wallet uw
        JOIN allowed_users au ON au.email = uw.user_email
       WHERE uw.monthly_limit > 0
         AND uw.credits_used_this_cycle::numeric / uw.monthly_limit > 0.80
         AND au.role <> 'dev'
       ORDER BY pct_used DESC
       LIMIT 15
    `)

    // ── Activation latency: median hours signup → first search ───────────────
    const { rows: activationRows } = await query(`
      WITH first_action AS (
        SELECT au.email,
               au.created_at                                      AS signup_at,
               MIN(al.created_at)                                 AS first_at
          FROM allowed_users au
          JOIN activity_log al ON al.user_email = au.email
         WHERE al.action IN ('b2c_search','b2b_ai_search','b2b_catalog_discovery')
           AND au.created_at >= NOW() - INTERVAL '90 days'
         GROUP BY au.email, au.created_at
      )
      SELECT COUNT(*)::int                                                        AS activated,
             COALESCE(
               PERCENTILE_CONT(0.5) WITHIN GROUP (
                 ORDER BY EXTRACT(EPOCH FROM (first_at - signup_at))/3600
               ), 0
             )::numeric(10,2)                                                      AS median_hours
        FROM first_action
    `)
    const act = activationRows[0] || { activated: 0, median_hours: 0 }

    // Time-to-first-value histogram
    const { rows: ttfvBuckets } = await query(`
      WITH ttfv AS (
        SELECT EXTRACT(EPOCH FROM (MIN(al.created_at) - au.created_at))/3600 AS hrs
          FROM allowed_users au
          JOIN activity_log al ON al.user_email = au.email
         WHERE al.action IN ('b2c_search','b2b_ai_search','b2b_catalog_discovery')
           AND au.created_at >= NOW() - INTERVAL '90 days'
         GROUP BY au.email, au.created_at
      )
      SELECT bucket, COUNT(*)::int AS count FROM (
        SELECT CASE
          WHEN hrs <= 1   THEN '≤1h'
          WHEN hrs <= 6   THEN '1–6h'
          WHEN hrs <= 24  THEN '6–24h'
          WHEN hrs <= 72  THEN '1–3d'
          WHEN hrs <= 168 THEN '3–7d'
          ELSE '7d+'
        END AS bucket FROM ttfv
      ) q
      GROUP BY bucket
    `)
    const TTFV_ORDER = ["≤1h","1–6h","6–24h","1–3d","3–7d","7d+"]
    const ttfvHistogram = TTFV_ORDER.map(b => ({
      bucket: b,
      count:  Number(ttfvBuckets.find((r: any) => r.bucket === b)?.count ?? 0),
    }))

    // ── Stickiness: DAU/MAU and WAU/MAU ──────────────────────────────────────
    const stickinessDauMau = Number(rs.mau) > 0 ? (Number(rs.dau) / Number(rs.mau)) * 100 : 0
    const stickinessWauMau = Number(rs.mau) > 0 ? (Number(rs.wau) / Number(rs.mau)) * 100 : 0

    // ── Feature adoption: % of 30d active users who used each action ─────────
    const { rows: featureAdoption } = await query(`
      WITH au30 AS (
        SELECT DISTINCT user_email
          FROM activity_log
         WHERE created_at >= NOW() - INTERVAL '30 days'
      )
      SELECT action,
             COUNT(DISTINCT user_email)::int AS users,
             ROUND(100.0 * COUNT(DISTINCT user_email) / NULLIF((SELECT COUNT(*) FROM au30), 0), 1)::numeric(5,1) AS pct
        FROM activity_log
       WHERE created_at >= NOW() - INTERVAL '30 days'
         AND user_email IN (SELECT user_email FROM au30)
       GROUP BY action
       ORDER BY users DESC
       LIMIT 15
    `)

    // ── Cohort retention: weeks 0–3 by signup week ───────────────────────────
    const { rows: cohortRows } = await query(`
      WITH cohorts AS (
        SELECT DATE_TRUNC('week', created_at)::date AS cohort_week, email, created_at
          FROM allowed_users
         WHERE created_at >= NOW() - INTERVAL '8 weeks'
      ),
      acts AS (
        SELECT c.cohort_week,
               c.email,
               FLOOR(EXTRACT(EPOCH FROM (al.created_at - c.created_at)) / (7*86400))::int AS week_n
          FROM cohorts c
          JOIN activity_log al ON al.user_email = c.email
      )
      SELECT c.cohort_week                                                              AS week,
             COUNT(DISTINCT c.email)::int                                                AS size,
             COUNT(DISTINCT a.email) FILTER (WHERE a.week_n = 0)::int                   AS w0,
             COUNT(DISTINCT a.email) FILTER (WHERE a.week_n = 1)::int                   AS w1,
             COUNT(DISTINCT a.email) FILTER (WHERE a.week_n = 2)::int                   AS w2,
             COUNT(DISTINCT a.email) FILTER (WHERE a.week_n = 3)::int                   AS w3
        FROM cohorts c
   LEFT JOIN acts a ON a.cohort_week = c.cohort_week AND a.email = c.email
       GROUP BY c.cohort_week
       ORDER BY c.cohort_week DESC
       LIMIT 8
    `)

    // ── Trial abuse: same IP / same Firebase UID across multiple signups ─────
    const { rows: abuseByIp } = await query(`
      SELECT signup_ip                    AS ip,
             signup_country_code          AS country_code,
             COUNT(*)::int                AS accounts,
             ARRAY_AGG(email ORDER BY created_at DESC) AS emails,
             MAX(created_at)              AS last_signup
        FROM allowed_users
       WHERE signup_ip IS NOT NULL
         AND signup_ip <> 'unknown'
         AND created_at >= NOW() - INTERVAL '60 days'
       GROUP BY signup_ip, signup_country_code
      HAVING COUNT(*) > 1
       ORDER BY COUNT(*) DESC, MAX(created_at) DESC
       LIMIT 10
    `)

    // ── Biggest price moves last 7 days (across all tracked products) ────────
    const { rows: priceMoves } = await query(`
      WITH deltas AS (
        SELECT p.internal_name                           AS product,
               p.brand                                    AS brand,
               c.name                                     AS retailer,
               MIN(ps.price)                              AS low,
               MAX(ps.price)                              AS high,
               MAX(ps.currency)                           AS currency,
               (MAX(ps.price) - MIN(ps.price))            AS delta,
               COUNT(*)                                   AS samples
          FROM price_snapshots ps
          JOIN products  p ON p.id = ps.product_id
          JOIN companies c ON c.id = ps.company_id
         WHERE ps.checked_at >= NOW() - INTERVAL '7 days'
           AND ps.scrape_status = 'success'
           AND ps.price IS NOT NULL AND ps.price > 0
         GROUP BY p.internal_name, p.brand, c.name
        HAVING COUNT(*) >= 2 AND MAX(ps.price) > MIN(ps.price)
      )
      SELECT product, brand, retailer, currency,
             low::numeric(12,2)   AS low,
             high::numeric(12,2)  AS high,
             delta::numeric(12,2) AS delta,
             ROUND((delta / NULLIF(high, 0) * 100)::numeric, 1)::numeric(5,1) AS delta_pct,
             samples::int         AS samples
        FROM deltas
       ORDER BY delta_pct DESC
       LIMIT 10
    `)

    // ── Anthropic API spend estimate (derived from activity_log counts) ──────
    // Rough USD estimate per call. Dial these in as you get real invoices.
    const COST_PER_CALL: Record<string, number> = {
      b2c_search:            0.025,   // Haiku web search + Vision on 3–6 pages
      b2c_unlock:            0.006,   // Vision on a single page per unlock
      b2b_ai_search:         0.015,
      b2b_catalog_discovery: 0.010,   // Claude matching per result page
      scrape_tiktok:         0.050,   // one big web_search + extraction
      scrape_iherb:          0.030,   // Vision screenshot
      scrape_banggood:       0.030,
    }
    const actionKeys = Object.keys(COST_PER_CALL)
    const { rows: spendRows } = await query(
      `SELECT action, COUNT(*)::int AS count, DATE(created_at) AS date
         FROM activity_log
        WHERE created_at >= NOW() - INTERVAL '30 days'
          AND action = ANY($1)
        GROUP BY action, DATE(created_at)
        ORDER BY date ASC`,
      [actionKeys],
    )
    let spend7 = 0, spend30 = 0
    const spendByDay: Record<string, number> = {}
    const spendByAction: Record<string, { calls: number; cost: number }> = {}
    const sevenDaysAgo = Date.now() - 7 * 86400_000
    for (const row of spendRows) {
      const cost = Number(row.count) * (COST_PER_CALL[row.action] ?? 0)
      spend30 += cost
      if (new Date(row.date).getTime() >= sevenDaysAgo) spend7 += cost
      const d = row.date instanceof Date ? row.date.toISOString().slice(0, 10) : String(row.date).slice(0, 10)
      spendByDay[d] = (spendByDay[d] ?? 0) + cost
      spendByAction[row.action] = spendByAction[row.action]
        ? { calls: spendByAction[row.action].calls + Number(row.count), cost: spendByAction[row.action].cost + cost }
        : { calls: Number(row.count), cost }
    }
    const anthropicSpend = {
      last_7d:  Math.round(spend7  * 100) / 100,
      last_30d: Math.round(spend30 * 100) / 100,
      by_day:   Object.entries(spendByDay)
        .map(([date, cost]) => ({ date, cost: Math.round(cost * 100) / 100 }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      by_action: Object.entries(spendByAction)
        .map(([action, v]) => ({ action, calls: v.calls, cost: Math.round(v.cost * 100) / 100 }))
        .sort((a, b) => b.cost - a.cost),
    }

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

        at_risk: {
          silent_paid:       silentPaid,
          ending_trials:     endingTrials,
          credit_exhaustion: creditExhaustion,
        },
        activation: {
          activated:     Number(act.activated)     || 0,
          median_hours:  Number(act.median_hours)  || 0,
          histogram:     ttfvHistogram,
        },
        stickiness: {
          dau_over_mau_pct: Math.round(stickinessDauMau * 10) / 10,
          wau_over_mau_pct: Math.round(stickinessWauMau * 10) / 10,
        },
        feature_adoption: featureAdoption.map((r: any) => ({
          action: r.action,
          users:  Number(r.users) || 0,
          pct:    Number(r.pct)   || 0,
        })),
        cohort_retention: cohortRows.map((r: any) => ({
          week:      r.week,
          size:      Number(r.size) || 0,
          w0:        Number(r.w0)   || 0,
          w1:        Number(r.w1)   || 0,
          w2:        Number(r.w2)   || 0,
          w3:        Number(r.w3)   || 0,
        })),
        trial_abuse: abuseByIp.map((r: any) => ({
          ip:           r.ip,
          country_code: r.country_code,
          accounts:     Number(r.accounts) || 0,
          emails:       Array.isArray(r.emails) ? r.emails : [],
          last_signup:  r.last_signup,
        })),
        price_moves: priceMoves.map((r: any) => ({
          product:   r.product,
          brand:     r.brand,
          retailer:  r.retailer,
          currency:  r.currency,
          low:       Number(r.low)      || 0,
          high:      Number(r.high)     || 0,
          delta:     Number(r.delta)    || 0,
          delta_pct: Number(r.delta_pct)|| 0,
          samples:   Number(r.samples)  || 0,
        })),
        anthropic_spend: anthropicSpend,
      },
    })
  } catch (err) { next(err) }
})
