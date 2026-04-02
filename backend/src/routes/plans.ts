import { Router } from "express"
import { getAllPlans } from "../services/plansService"

export const plansRouter = Router()

// GET /api/plans — public list of all active plans (auth still required)
plansRouter.get("/", async (_req, res, next) => {
  try {
    const plans = await getAllPlans()
    res.json({ success: true, data: plans })
  } catch (err) { next(err) }
})
