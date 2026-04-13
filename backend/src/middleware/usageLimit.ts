import { Response, NextFunction } from "express"
import { query } from "../db"
import { AuthRequest } from "./auth"
import { checkAndDeductCredits, getWallet } from "../services/walletService"

const UNLIMITED_ROLES = ["dev", "owner"]

const TRIAL_DAYS: Record<string, number> = { b2b: 14, b2c: 7 }

export async function checkUsageLimit(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const email = req.email
    if (!email) {
      return res.status(401).json({ success: false, error: { message: "No email in token", code: "UNAUTHENTICATED" } })
    }

    const { rows } = await query(
      `SELECT role, subscription, plan_code, trial_ends_at FROM allowed_users WHERE email = $1 AND is_active = true LIMIT 1`,
      [email]
    )
    const user = rows[0]
    if (!user) return next()

    if (UNLIMITED_ROLES.includes(user.role)) return next()

    // Auto-downgrade expired trial
    let subscription: string = user.subscription || "free"
    if (subscription === "trial" && user.trial_ends_at && new Date(user.trial_ends_at) < new Date()) {
      subscription = "free"
      query(`UPDATE allowed_users SET subscription = 'free' WHERE email = $1`, [email]).catch(() => {})
    }

    // Deduct 1 credit — checks daily/weekly/balance limits
    const result = await checkAndDeductCredits(email, 1, "AI search credit used")
    if (!result.success) {
      const wallet = await getWallet(email)
      const limitMsg: Record<string, string> = {
        daily:   "Daily credit limit reached. Limit resets at midnight UTC.",
        weekly:  "Weekly credit limit reached. Limit resets next Monday.",
        balance: `Insufficient credits. Your balance is ${wallet?.balance ?? 0}.`,
      }
      return res.status(429).json({
        success: false,
        error: {
          message:   limitMsg[result.limitType ?? "balance"] ?? "Usage limit reached.",
          code:      "USAGE_LIMIT_REACHED",
          limitType: result.limitType,
          balance:   wallet?.balance ?? 0,
          subscription,
          role:      user.role,
        },
      })
    }

    next()
  } catch (err) { next(err) }
}

export function trialEndsAt(role: string): Date | null {
  const days = TRIAL_DAYS[role]
  if (!days) return null
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d
}
