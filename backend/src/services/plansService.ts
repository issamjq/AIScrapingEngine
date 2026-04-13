// Plans are now served from the central config — not from the DB plans table.
// The DB plans table is legacy and may contain outdated records.
import { PLANS, getPlanByKey as configGetPlanByKey, getPlansForAudience } from "../config/plans"

export async function getAllPlans() {
  return PLANS
}

export async function getPlanByKey(key: string) {
  // Support legacy keys (trial, free, pro) → map to initial credits for wallet creation
  const LEGACY: Record<string, { credits_b2b: number; credits_b2c: number }> = {
    trial: { credits_b2b: 60,  credits_b2c: 30  },
    free:  { credits_b2b: 60,  credits_b2c: 20  },
    pro:   { credits_b2b: 150, credits_b2c: 180 },
  }
  if (LEGACY[key]) return LEGACY[key]
  const plan = configGetPlanByKey(key)
  if (!plan) return null
  return { credits_b2b: plan.credits.monthly, credits_b2c: plan.credits.monthly }
}
