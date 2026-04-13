import { Router, Response, NextFunction } from "express"
import { AuthRequest } from "../middleware/auth"
import { getWallet, getTransactions, addCredits, deductCredits, getUsageSummary } from "../services/walletService"
import { createError } from "../middleware/validate"
import { query as dbQuery } from "../db"
import { walletAddLimiter } from "../middleware/rateLimit"

const ADMIN_ROLES = ["dev", "owner", "admin"]

export const walletRouter = Router()

// GET /api/wallet — balance + recent transactions
walletRouter.get("/", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const email = req.email!
    const [wallet, transactions] = await Promise.all([
      getWallet(email),
      getTransactions(email, 20),
    ])
    if (!wallet) return next(createError("Wallet not found", 404, "NOT_FOUND"))
    res.json({ success: true, data: { wallet, transactions } })
  } catch (err) { next(err) }
})

// GET /api/wallet/usage — daily / weekly / cycle usage summary
walletRouter.get("/usage", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const email = req.email!
    const summary = await getUsageSummary(email)
    if (!summary) return next(createError("Wallet not found", 404, "NOT_FOUND"))
    res.json({ success: true, data: summary })
  } catch (err) { next(err) }
})

// POST /api/wallet/deduct — deduct N credits (used for unlock; dev/owner skip)
walletRouter.post("/deduct", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const email  = req.email!
    const amount = parseInt(req.body.amount) || 1
    const desc   = req.body.description || "Credit deduction"
    if (amount <= 0 || amount > 20) return next(createError("invalid amount", 400, "VALIDATION"))

    const UNLIMITED_ROLES = ["dev", "owner"]
    const { rows } = await dbQuery(
      `SELECT role FROM allowed_users WHERE email = $1 LIMIT 1`, [email]
    )
    if (rows[0] && UNLIMITED_ROLES.includes(rows[0].role)) {
      const wallet = await getWallet(email)
      return res.json({ success: true, data: { balance: wallet?.balance ?? 0 } })
    }

    const result = await deductCredits(email, amount, desc)
    if (!result.success) {
      return res.status(429).json({
        success: false,
        error: { message: "Insufficient credits", code: "USAGE_LIMIT_REACHED", balance: result.balance },
      })
    }
    res.json({ success: true, data: { balance: result.balance } })
  } catch (err) { next(err) }
})

// POST /api/wallet/add — admin/dev only: manually add credits
walletRouter.post("/add", walletAddLimiter as any, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const callerEmail = req.email!
    const { rows } = await dbQuery(
      `SELECT role FROM allowed_users WHERE email = $1 AND is_active = true LIMIT 1`, [callerEmail]
    )
    if (!rows[0] || !ADMIN_ROLES.includes(rows[0].role)) {
      return res.status(403).json({ success: false, error: { message: "Forbidden", code: "FORBIDDEN" } })
    }
    const { amount, description, target_email } = req.body
    const recipientEmail = target_email ?? callerEmail
    if (!amount || amount <= 0 || amount > 10000) return next(createError("amount must be 1–10000", 400, "VALIDATION"))
    const newBalance = await addCredits(recipientEmail, amount, "adjustment", (description || "Manual credit addition").slice(0, 200))
    res.json({ success: true, data: { balance: newBalance } })
  } catch (err) { next(err) }
})
