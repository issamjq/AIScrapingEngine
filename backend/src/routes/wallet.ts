import { Router, Response, NextFunction } from "express"
import { AuthRequest } from "../middleware/auth"
import { getWallet, getTransactions, addCredits } from "../services/walletService"
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
