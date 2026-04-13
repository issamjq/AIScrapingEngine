import { query } from "../db"
import { getEffectiveLimits, isoWeek } from "../config/plans"

/** Get wallet for a user. Returns null if not found. */
export async function getWallet(userEmail: string) {
  const { rows } = await query(
    `SELECT * FROM user_wallet WHERE user_email = $1 LIMIT 1`,
    [userEmail]
  )
  return rows[0] || null
}

/** Create wallet with an initial balance and log a signup_bonus transaction. */
export async function createWallet(userEmail: string, initialCredits: number) {
  const { rows } = await query(
    `INSERT INTO user_wallet (user_email, balance, total_added)
     VALUES ($1, $2, $2)
     ON CONFLICT (user_email) DO NOTHING
     RETURNING *`,
    [userEmail, initialCredits]
  )
  const wallet = rows[0]
  if (wallet && initialCredits > 0) {
    await query(
      `INSERT INTO wallet_transactions (user_email, amount, balance_after, type, description)
       VALUES ($1, $2, $2, 'signup_bonus', 'Credits on signup')`,
      [userEmail, initialCredits]
    )
  }
  return wallet
}

/**
 * Check daily/weekly/balance limits and deduct N credits atomically.
 * Returns { success, balance, limitType? } — limitType is why it failed.
 */
export async function checkAndDeductCredits(
  userEmail:   string,
  amount:      number,
  description: string
): Promise<{ success: boolean; balance: number; limitType?: "daily" | "weekly" | "balance" }> {

  // 1 — User info for plan limits
  const { rows: uRows } = await query(
    `SELECT role, subscription, plan_code FROM allowed_users WHERE email = $1 LIMIT 1`,
    [userEmail]
  )
  const user = uRows[0]
  const limits = getEffectiveLimits(
    user?.plan_code    ?? null,
    user?.role         ?? "b2b",
    user?.subscription ?? "free"
  )

  // 2 — Wallet with counters (COALESCE handles columns not yet added via migration)
  const { rows: wRows } = await query(
    `SELECT balance,
            COALESCE(credits_used_today,      0) AS credits_used_today,
            COALESCE(credits_used_this_week,  0) AS credits_used_this_week,
            COALESCE(credits_used_this_cycle, 0) AS credits_used_this_cycle,
            last_daily_reset_at,
            last_weekly_reset_at,
            last_cycle_reset_at
     FROM user_wallet WHERE user_email = $1 LIMIT 1`,
    [userEmail]
  )
  if (!wRows.length) return { success: false, balance: 0, limitType: "balance" }
  const w = wRows[0]

  const now = new Date()

  // 3 — Detect period changes (drives counter resets in UPDATE)
  const lastDailyReset  = w.last_daily_reset_at  ? new Date(w.last_daily_reset_at)  : new Date(0)
  const lastWeeklyReset = w.last_weekly_reset_at ? new Date(w.last_weekly_reset_at) : new Date(0)
  const lastCycleReset  = w.last_cycle_reset_at  ? new Date(w.last_cycle_reset_at)  : new Date(0)

  const dailyChanged  = now.toISOString().slice(0, 10) !== lastDailyReset.toISOString().slice(0, 10)
  const weeklyChanged = isoWeek(now) !== isoWeek(lastWeeklyReset)
  const cycleChanged  = (now.getTime() - lastCycleReset.getTime()) / 86400000 >= 30

  // 4 — Effective counters after virtual reset
  const usedToday    = dailyChanged  ? 0 : Number(w.credits_used_today)
  const usedThisWeek = weeklyChanged ? 0 : Number(w.credits_used_this_week)

  // 5 — Limit checks (fail fast, no side effects)
  if (usedToday    + amount > limits.daily)  return { success: false, balance: w.balance, limitType: "daily" }
  if (usedThisWeek + amount > limits.weekly) return { success: false, balance: w.balance, limitType: "weekly" }
  if (w.balance < amount)                    return { success: false, balance: w.balance, limitType: "balance" }

  // 6 — Atomic deduction with reset baked in
  const { rows: updated } = await query(
    `UPDATE user_wallet
     SET balance                 = balance - $2,
         total_used              = total_used + $2,
         credits_used_today      = CASE WHEN $3 THEN $2::int ELSE COALESCE(credits_used_today,     0) + $2 END,
         credits_used_this_week  = CASE WHEN $4 THEN $2::int ELSE COALESCE(credits_used_this_week, 0) + $2 END,
         credits_used_this_cycle = CASE WHEN $5 THEN $2::int ELSE COALESCE(credits_used_this_cycle,0) + $2 END,
         last_daily_reset_at     = CASE WHEN $3 THEN NOW() ELSE COALESCE(last_daily_reset_at,  NOW()) END,
         last_weekly_reset_at    = CASE WHEN $4 THEN NOW() ELSE COALESCE(last_weekly_reset_at, NOW()) END,
         last_cycle_reset_at     = CASE WHEN $5 THEN NOW() ELSE COALESCE(last_cycle_reset_at,  NOW()) END,
         daily_limit             = $6,
         weekly_limit            = $7,
         monthly_limit           = $8,
         updated_at              = NOW()
     WHERE user_email = $1 AND balance >= $2
     RETURNING balance`,
    [userEmail, amount, dailyChanged, weeklyChanged, cycleChanged, limits.daily, limits.weekly, limits.monthly]
  )

  if (!updated.length) {
    const fallback = await getWallet(userEmail)
    return { success: false, balance: fallback?.balance ?? 0, limitType: "balance" }
  }

  const newBalance = updated[0].balance
  await query(
    `INSERT INTO wallet_transactions (user_email, amount, balance_after, type, description)
     VALUES ($1, $2, $3, 'usage', $4)`,
    [userEmail, -amount, newBalance, description]
  )
  return { success: true, balance: newBalance }
}

/** Deduct exactly 1 credit — delegates to checkAndDeductCredits. */
export async function deductCredit(userEmail: string): Promise<{ success: boolean; balance: number }> {
  const r = await checkAndDeductCredits(userEmail, 1, "AI search credit used")
  return { success: r.success, balance: r.balance }
}

/** Deduct N credits — kept for backwards compat, now goes through limit checks. */
export async function deductCredits(
  userEmail:   string,
  amount:      number,
  description: string
): Promise<{ success: boolean; balance: number }> {
  const r = await checkAndDeductCredits(userEmail, amount, description)
  return { success: r.success, balance: r.balance }
}

/** Add credits to wallet (top-up / adjustment). */
export async function addCredits(userEmail: string, amount: number, type: string, description: string) {
  const { rows } = await query(
    `UPDATE user_wallet
     SET balance     = balance + $2,
         total_added = total_added + $2,
         updated_at  = NOW()
     WHERE user_email = $1
     RETURNING balance`,
    [userEmail, amount]
  )
  if (!rows.length) throw new Error("Wallet not found for " + userEmail)
  const newBalance = rows[0].balance
  await query(
    `INSERT INTO wallet_transactions (user_email, amount, balance_after, type, description)
     VALUES ($1, $2, $3, $4, $5)`,
    [userEmail, amount, newBalance, type, description]
  )
  return newBalance
}

/** Get recent transaction history. */
export async function getTransactions(userEmail: string, limit = 20) {
  const { rows } = await query(
    `SELECT * FROM wallet_transactions WHERE user_email = $1 ORDER BY created_at DESC LIMIT $2`,
    [userEmail, limit]
  )
  return rows
}

/** Returns daily / weekly / cycle usage summary for the Usage page. */
export async function getUsageSummary(userEmail: string) {
  const { rows: wRows } = await query(
    `SELECT balance, total_added, total_used,
            COALESCE(credits_used_today,      0) AS credits_used_today,
            COALESCE(credits_used_this_week,  0) AS credits_used_this_week,
            COALESCE(credits_used_this_cycle, 0) AS credits_used_this_cycle,
            daily_limit, weekly_limit, monthly_limit,
            last_daily_reset_at, last_weekly_reset_at, last_cycle_reset_at
     FROM user_wallet WHERE user_email = $1 LIMIT 1`,
    [userEmail]
  )
  if (!wRows.length) return null
  const w = wRows[0]

  const { rows: uRows } = await query(
    `SELECT role, subscription, plan_code, billing_interval FROM allowed_users WHERE email = $1 LIMIT 1`,
    [userEmail]
  )
  const user = uRows[0]

  const limits = getEffectiveLimits(
    user?.plan_code    ?? null,
    user?.role         ?? "b2b",
    user?.subscription ?? "free"
  )

  const now = new Date()

  // Daily
  const lastDailyReset = w.last_daily_reset_at ? new Date(w.last_daily_reset_at) : new Date(0)
  const dailyChanged   = now.toISOString().slice(0, 10) !== lastDailyReset.toISOString().slice(0, 10)
  const usedToday      = dailyChanged ? 0 : Number(w.credits_used_today)
  const nextDayReset   = new Date(now); nextDayReset.setUTCHours(24, 0, 0, 0)

  // Weekly
  const lastWeeklyReset = w.last_weekly_reset_at ? new Date(w.last_weekly_reset_at) : new Date(0)
  const weeklyChanged   = isoWeek(now) !== isoWeek(lastWeeklyReset)
  const usedThisWeek    = weeklyChanged ? 0 : Number(w.credits_used_this_week)
  const nextWeekReset   = new Date(now)
  nextWeekReset.setDate(now.getDate() + ((8 - now.getDay()) % 7 || 7))
  nextWeekReset.setUTCHours(0, 0, 0, 0)

  // Cycle (30-day rolling)
  const lastCycleReset  = w.last_cycle_reset_at ? new Date(w.last_cycle_reset_at) : new Date(0)
  const cycleElapsed    = (now.getTime() - lastCycleReset.getTime()) / 86400000
  const usedThisCycle   = cycleElapsed >= 30 ? 0 : Number(w.credits_used_this_cycle)
  const nextCycleReset  = new Date(lastCycleReset)
  nextCycleReset.setDate(nextCycleReset.getDate() + 30)
  if (cycleElapsed >= 30) nextCycleReset.setTime(now.getTime() + 30 * 86400000)

  const dailyLim   = w.daily_limit   ?? limits.daily
  const weeklyLim  = w.weekly_limit  ?? limits.weekly
  const monthlyLim = w.monthly_limit ?? limits.monthly

  return {
    balance:          w.balance,
    total_added:      w.total_added,
    total_used:       w.total_used,
    plan_code:        user?.plan_code        ?? null,
    billing_interval: user?.billing_interval ?? "monthly",
    daily: {
      used:      usedToday,
      limit:     dailyLim,
      remaining: Math.max(0, dailyLim - usedToday),
      resets_at: nextDayReset.toISOString(),
    },
    weekly: {
      used:      usedThisWeek,
      limit:     weeklyLim,
      remaining: Math.max(0, weeklyLim - usedThisWeek),
      resets_at: nextWeekReset.toISOString(),
    },
    cycle: {
      used:      usedThisCycle,
      limit:     monthlyLim,
      remaining: Math.max(0, monthlyLim - usedThisCycle),
      resets_at: nextCycleReset.toISOString(),
    },
  }
}
