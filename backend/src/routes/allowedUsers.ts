import { Router } from "express"
import { Response, NextFunction } from "express"
import { query } from "../db"
import { createError } from "../middleware/validate"
import { AuthRequest } from "../middleware/auth"
import { trialEndsAt } from "../middleware/usageLimit"
import { copyGlobalStoresToUser } from "../services/companyService"
import { createWallet } from "../services/walletService"
import { getPlanByKey } from "../services/plansService"
import { signupLimiter } from "../middleware/rateLimit"
import { logActivity } from "../services/activityLogger"
import { lookupIp } from "../services/geoService"

export const allowedUsersRouter = Router()

const MANAGEMENT_ROLES = ["dev", "owner", "admin"]

/** Extract real client IP — checks X-Forwarded-For first (set by Render proxy) */
function getClientIp(req: AuthRequest): string {
  const forwarded = req.headers["x-forwarded-for"]
  if (forwarded) {
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(",")[0]
    return first.trim()
  }
  return req.ip ?? "unknown"
}

async function getCallerUser(email: string) {
  const { rows } = await query(
    `SELECT id, email, name, role, company_name, is_active, subscription,
            trial_ends_at, billing_renews_at, created_at, updated_at
     FROM allowed_users WHERE email = $1 AND is_active = true LIMIT 1`,
    [email]
  )
  return rows[0] || null
}

async function getUserByUid(uid: string) {
  const { rows } = await query(
    "SELECT * FROM allowed_users WHERE firebase_uid = $1 AND is_active = true LIMIT 1",
    [uid]
  )
  return rows[0] || null
}

// GET /api/allowed-users/me — access check after login
allowedUsersRouter.get("/me", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const email = req.email
    const uid   = req.uid
    if (!email) return next(createError("No email in token", 401, "UNAUTHENTICATED"))

    // Primary lookup: by email
    const user = await getCallerUser(email)
    if (user) {
      // Backfill firebase_uid if missing (existing users pre-v1.0.28)
      if (uid && !user.firebase_uid) {
        await query("UPDATE allowed_users SET firebase_uid = $1 WHERE id = $2", [uid, user.id])
      }
      return res.json({ success: true, data: user })
    }

    // Secondary: same Google account but different email (edge case)
    if (uid) {
      const byUid = await getUserByUid(uid)
      if (byUid) return res.json({ success: true, data: byUid })
    }

    // Bootstrap mode: first user gets Super Admin
    const { rows: countRows } = await query("SELECT COUNT(*) FROM allowed_users")
    if (parseInt(countRows[0].count, 10) === 0) {
      return res.json({
        success: true,
        data: { id: 0, email, name: email, role: "003", is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      })
    }

    // Unknown user — prompt frontend to run onboarding
    return res.status(403).json({
      success: false,
      error: { message: "New user — onboarding required.", code: "NEW_USER" },
    })
  } catch (err) { next(err) }
})

// POST /api/allowed-users/signup — called from onboarding screen for new users
allowedUsersRouter.post("/signup", signupLimiter as any, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const email = req.email
    const uid   = req.uid
    if (!email) return next(createError("No email in token", 401, "UNAUTHENTICATED"))

    // Already exists by email — just return existing record
    const existing = await getCallerUser(email)
    if (existing) return res.json({ success: true, data: existing })

    // Same Google account (uid) already registered under a different email
    if (uid) {
      const byUid = await getUserByUid(uid)
      if (byUid) {
        return res.status(409).json({
          success: false,
          error: { message: "A trial account already exists for this Google account.", code: "DUPLICATE_ACCOUNT" },
        })
      }
    }

    // IP-based check: block if same IP already has a trial signup in last 30 days
    const clientIp = getClientIp(req)
    if (clientIp !== "unknown") {
      const { rows: ipRows } = await query(
        `SELECT id FROM allowed_users
         WHERE signup_ip = $1
           AND subscription = 'trial'
           AND created_at > NOW() - INTERVAL '30 days'
         LIMIT 1`,
        [clientIp]
      )
      if (ipRows.length > 0) {
        return res.status(409).json({
          success: false,
          error: { message: "A trial account was recently created from this device. Please use your existing account or upgrade.", code: "IP_TRIAL_LIMIT" },
        })
      }
    }

    const { role, plan: planKey = "trial", billing_interval: billingInterval = "monthly" } = req.body
    const planCode = req.body.plan_code ? String(req.body.plan_code).trim() : null
    const name = req.body.name ? String(req.body.name).trim().slice(0, 100) : null
    if (!role || !["b2b", "b2c"].includes(role)) {
      return next(createError("role must be b2b or b2c", 400, "VALIDATION"))
    }
    const VALID_LEGACY = ["trial", "free", "pro"]
    const VALID_NEW    = ["b2c_free", "b2c_starter", "b2c_pro", "b2b_free", "b2b_growth", "b2b_scale"]
    if (!VALID_LEGACY.includes(planKey) && !VALID_NEW.includes(planKey)) {
      return next(createError("invalid plan key", 400, "VALIDATION"))
    }
    if (!["weekly", "monthly", "yearly"].includes(billingInterval)) {
      return next(createError("billing_interval must be weekly, monthly, or yearly", 400, "VALIDATION"))
    }

    // Map plan key → subscription value
    const subscriptionMap: Record<string, string> = {
      trial: "trial", free: "free", pro: "paid",
      b2c_free: "free", b2c_starter: "paid", b2c_pro: "paid",
      b2b_free: "free", b2b_growth: "paid", b2b_scale: "paid",
    }
    const subscription   = subscriptionMap[planKey] ?? "free"
    const effectiveTrial = subscription === "trial" ? trialEndsAt(role) : null

    const billingRenewsAt = subscription === "paid" ? (() => {
      const d = new Date()
      if (billingInterval === "weekly")  d.setDate(d.getDate() + 7)
      else if (billingInterval === "yearly") d.setFullYear(d.getFullYear() + 1)
      else d.setMonth(d.getMonth() + 1)
      return d
    })() : null

    // Effective plan code to store (prefer new plan_code if provided, else derive from legacy key)
    const effectivePlanCode = planCode || (VALID_NEW.includes(planKey) ? planKey : null)

    // Resolve country/city for the signup IP (best-effort — never blocks signup)
    const geo = await lookupIp(clientIp)

    const { rows } = await query(
      `INSERT INTO allowed_users
         (email, name, role, is_active, subscription, plan_code, billing_interval, trial_ends_at, billing_renews_at, firebase_uid, signup_ip, signup_country, signup_country_code, signup_city, signup_region, signup_lat, signup_lon, last_seen_at, last_seen_ip)
       VALUES ($1, $2, $3, true, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), $10)
       RETURNING *`,
      [email.toLowerCase().trim(), name || null, role, subscription, effectivePlanCode, billingInterval,
       effectiveTrial, billingRenewsAt, uid || null, clientIp,
       geo?.country ?? null, geo?.countryCode ?? null, geo?.city ?? null,
       geo?.region ?? null, geo?.lat ?? null, geo?.lon ?? null]
    )

    // Seed the 8 default UAE stores for this new user
    await copyGlobalStoresToUser(email.toLowerCase().trim())

    // Create wallet and seed credits from the chosen plan
    const chosenPlan = await getPlanByKey(planKey)
    const initialCredits = role === "b2b"
      ? (chosenPlan?.credits_b2b ?? 20)
      : (chosenPlan?.credits_b2c ?? 30)
    await createWallet(email.toLowerCase().trim(), initialCredits)

    logActivity({ user_email: email.toLowerCase().trim(), role, action: "signup", details: { plan: effectivePlanCode, billing_interval: billingInterval, initial_credits: initialCredits } })

    res.status(201).json({ success: true, data: rows[0] })
  } catch (err) { next(err) }
})

// PUT /api/allowed-users/me — update own name / company_name
allowedUsersRouter.put("/me", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const email = req.email
    if (!email) return next(createError("No email in token", 401, "UNAUTHENTICATED"))
    const name         = req.body.name         ? String(req.body.name).trim().slice(0, 100)         : null
    const company_name = req.body.company_name ? String(req.body.company_name).trim().slice(0, 150) : null
    const { rows } = await query(
      `UPDATE allowed_users SET
         name         = COALESCE($2, name),
         company_name = COALESCE($3, company_name),
         updated_at   = NOW()
       WHERE email = $1 RETURNING *`,
      [email, name ?? null, company_name ?? null]
    )
    if (!rows.length) return next(createError("User not found", 404, "NOT_FOUND"))
    res.json({ success: true, data: rows[0] })
  } catch (err) { next(err) }
})

// DELETE /api/allowed-users/me — permanently delete account + all user data
allowedUsersRouter.delete("/me", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const email = req.email
    if (!email) return next(createError("No email in token", 401, "UNAUTHENTICATED"))

    // Delete in FK-safe order
    await query(`
      DELETE FROM price_snapshots
      WHERE url_id IN (
        SELECT pcu.id FROM product_company_urls pcu
        JOIN products p ON p.id = pcu.product_id
        WHERE p.user_email = $1
      )`, [email])
    await query(`
      DELETE FROM product_company_urls
      WHERE product_id IN (SELECT id FROM products WHERE user_email = $1)`, [email])
    await query(`DELETE FROM products       WHERE user_email = $1`, [email])
    await query(`DELETE FROM companies      WHERE user_email = $1`, [email])
    await query(`DELETE FROM wallet_transactions WHERE user_email = $1`, [email])
    await query(`DELETE FROM user_wallet    WHERE user_email = $1`, [email])
    await query(`DELETE FROM allowed_users  WHERE email = $1`, [email])

    res.json({ success: true })
  } catch (err) { next(err) }
})

// Management middleware
async function requireManagement(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const email = req.email
    if (!email) return next(createError("No email in token", 401, "UNAUTHENTICATED"))
    const caller = await getCallerUser(email)
    if (!caller || !MANAGEMENT_ROLES.includes(caller.role)) {
      return res.status(403).json({ success: false, error: { message: "Insufficient permissions", code: "FORBIDDEN" } })
    }
    ;(req as any).callerUser = caller
    next()
  } catch (err) { next(err) }
}

// GET /api/allowed-users
allowedUsersRouter.get("/", requireManagement as any, async (_req, res, next) => {
  try {
    const { rows } = await query("SELECT * FROM allowed_users ORDER BY created_at ASC")
    res.json({ success: true, data: rows })
  } catch (err) { next(err) }
})

// POST /api/allowed-users
allowedUsersRouter.post("/", requireManagement as any, async (req, res, next) => {
  try {
    const { email, name, role = "b2c", is_active = true, subscription } = req.body
    if (!email) return next(createError("email is required", 400, "VALIDATION"))

    // Auto-start trial for B2B/B2C roles unless subscription is explicitly provided
    const effectiveSub    = subscription || "trial"
    const effectiveTrial  = trialEndsAt(role)  // null for 001/002 roles

    const { rows } = await query(
      `INSERT INTO allowed_users (email, name, role, is_active, subscription, trial_ends_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (email) DO UPDATE
         SET name=$2, role=$3, is_active=$4, subscription=$5, trial_ends_at=$6, updated_at=NOW()
       RETURNING *`,
      [email.toLowerCase().trim(), name || null, role, is_active, effectiveSub, effectiveTrial]
    )
    res.status(201).json({ success: true, data: rows[0] })
  } catch (err) { next(err) }
})

// PUT /api/allowed-users/:id
allowedUsersRouter.put("/:id", requireManagement as any, async (req, res, next) => {
  try {
    const { name, role, is_active } = req.body
    const { rows } = await query(
      `UPDATE allowed_users SET
         name       = COALESCE($2, name),
         role       = COALESCE($3, role),
         is_active  = COALESCE($4, is_active),
         updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [req.params.id, name ?? null, role ?? null, is_active ?? null]
    )
    if (!rows.length) return next(createError("User not found", 404, "NOT_FOUND"))
    res.json({ success: true, data: rows[0] })
  } catch (err) { next(err) }
})

// DELETE /api/allowed-users/:id
allowedUsersRouter.delete("/:id", requireManagement as any, async (req, res, next) => {
  try {
    const { rowCount } = await query("DELETE FROM allowed_users WHERE id = $1", [req.params.id])
    if (!rowCount) return next(createError("User not found", 404, "NOT_FOUND"))
    res.json({ success: true })
  } catch (err) { next(err) }
})
