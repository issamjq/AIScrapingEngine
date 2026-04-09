import { Router, Response, NextFunction } from "express"
import { AuthRequest } from "../middleware/auth"
import { getWallet, getTransactions, addCredits, deductCredits } from "../services/walletService"
import { createError } from "../middleware/validate"

export const walletRouter = Router()

// GET /api/wallet — get current user's wallet balance + recent transactions
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

// POST /api/wallet/deduct — deduct credits for unlocking blurred results (1 per card)
walletRouter.post("/deduct", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const email  = req.email!
    const amount = parseInt(req.body.amount) || 1
    const desc   = req.body.description || "Unlocked search result"
    if (amount <= 0 || amount > 20) return next(createError("invalid amount", 400, "VALIDATION"))
    const UNLIMITED_ROLES = ["dev", "owner"]
    const wallet = await getWallet(email)
    if (!wallet) return next(createError("Wallet not found", 404, "NOT_FOUND"))
    // Check role — unlimited users skip deduction
    const { rows } = await (await import("../db/index.js")).query(
      `SELECT role FROM allowed_users WHERE email = $1 LIMIT 1`, [email]
    )
    if (rows[0] && UNLIMITED_ROLES.includes(rows[0].role)) {
      return res.json({ success: true, data: { balance: wallet.balance } })
    }
    const result = await deductCredits(email, amount, desc)
    if (!result.success) {
      return res.status(429).json({ success: false, error: { message: "Insufficient credits", code: "USAGE_LIMIT_REACHED", balance: result.balance } })
    }
    res.json({ success: true, data: { balance: result.balance } })
  } catch (err) { next(err) }
})

// POST /api/wallet/add — admin/dev only: manually add credits
walletRouter.post("/add", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { amount, description } = req.body
    if (!amount || amount <= 0) return next(createError("amount must be positive", 400, "VALIDATION"))
    const email = req.email!
    const newBalance = await addCredits(email, amount, "adjustment", description || "Manual credit addition")
    res.json({ success: true, data: { balance: newBalance } })
  } catch (err) { next(err) }
})
