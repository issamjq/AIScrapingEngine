import { Router } from "express"
import { PLANS } from "../config/plans"

export const plansRouter = Router()

// GET /api/plans — returns all plan definitions from config (not DB)
plansRouter.get("/", (_req, res) => {
  res.json({ success: true, data: PLANS })
})
