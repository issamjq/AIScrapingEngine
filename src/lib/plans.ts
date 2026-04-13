// ─── Frontend Plan Config — mirrors backend/src/config/plans.ts ───────────────
// Keep in sync with the backend. Do NOT add pricing logic elsewhere.

export interface PlanDefinition {
  key:         string
  audience:    "b2c" | "b2b"
  name:        string
  description: string
  recommended?: boolean
  prices: {
    weekly:  number   // USD / week  (0 = free)
    monthly: number   // USD / month
    yearly:  number   // USD / year
  }
  credits: {
    monthly: number   // credits per 30-day cycle
  }
  limits: {
    daily:  number
    weekly: number
  }
  features: string[]
  isFree: boolean
}

export type BillingInterval = "weekly" | "monthly" | "yearly"

export const PLANS: PlanDefinition[] = [
  // ── B2C ──────────────────────────────────────────────────────────────────
  {
    key:         "b2c_free",
    audience:    "b2c",
    name:        "Free",
    description: "For light testing and first-time users",
    prices:      { weekly: 0, monthly: 0, yearly: 0 },
    credits:     { monthly: 20 },
    limits:      { daily: 2, weekly: 6 },
    features: [
      "20 credits / month",
      "Quick search (1 credit)",
      "2 credits per day",
      "6 credits per week",
      "AI market search",
      "Usage dashboard",
    ],
    isFree: true,
  },
  {
    key:         "b2c_starter",
    audience:    "b2c",
    name:        "Starter",
    description: "For regular individual users",
    prices:      { weekly: 9, monthly: 29, yearly: 290 },
    credits:     { monthly: 180 },
    limits:      { daily: 12, weekly: 45 },
    features: [
      "180 credits / month",
      "Quick, Standard & Deep search",
      "12 credits per day",
      "45 credits per week",
      "All results unlocked",
      "AI market search",
      "Usage dashboard",
      "Credit history",
    ],
    isFree: false,
  },
  {
    key:         "b2c_pro",
    audience:    "b2c",
    name:        "Pro",
    description: "For heavy users and power searchers",
    recommended: true,
    prices:      { weekly: 19, monthly: 69, yearly: 690 },
    credits:     { monthly: 600 },
    limits:      { daily: 35, weekly: 140 },
    features: [
      "600 credits / month",
      "Quick, Standard & Deep search",
      "35 credits per day",
      "140 credits per week",
      "All results unlocked",
      "AI market search",
      "Usage dashboard",
      "Credit history",
      "Export / reporting",
      "Priority support",
    ],
    isFree: false,
  },

  // ── B2B ──────────────────────────────────────────────────────────────────
  {
    key:         "b2b_free",
    audience:    "b2b",
    name:        "Free",
    description: "For testing and demo only",
    prices:      { weekly: 0, monthly: 0, yearly: 0 },
    credits:     { monthly: 60 },
    limits:      { daily: 5, weekly: 18 },
    features: [
      "60 credits / month",
      "Quick search only",
      "5 credits per day",
      "18 credits per week",
      "Catalog Discovery",
      "AI market search",
      "Usage dashboard",
    ],
    isFree: true,
  },
  {
    key:         "b2b_growth",
    audience:    "b2b",
    name:        "Growth",
    description: "For growing businesses",
    recommended: true,
    prices:      { weekly: 39, monthly: 149, yearly: 1490 },
    credits:     { monthly: 1500 },
    limits:      { daily: 90, weekly: 350 },
    features: [
      "1,500 credits / month",
      "Quick, Standard & Deep search",
      "90 credits per day",
      "350 credits per week",
      "Catalog Discovery",
      "AI market search",
      "Usage dashboard",
      "Credit history",
      "Export / reporting",
    ],
    isFree: false,
  },
  {
    key:         "b2b_scale",
    audience:    "b2b",
    name:        "Scale",
    description: "For high-volume business usage",
    prices:      { weekly: 89, monthly: 349, yearly: 3490 },
    credits:     { monthly: 5000 },
    limits:      { daily: 250, weekly: 1000 },
    features: [
      "5,000 credits / month",
      "Quick, Standard & Deep search",
      "250 credits per day",
      "1,000 credits per week",
      "Catalog Discovery",
      "AI market search",
      "Usage dashboard",
      "Credit history",
      "Export / reporting",
      "Priority support",
    ],
    isFree: false,
  },
]

export function getPlansForAudience(audience: "b2c" | "b2b"): PlanDefinition[] {
  return PLANS.filter(p => p.audience === audience)
}

/** Yearly savings vs monthly × 12 as a percentage */
export function yearlySavingsPct(plan: PlanDefinition): number {
  if (plan.prices.monthly === 0) return 0
  const monthly12 = plan.prices.monthly * 12
  return Math.round((1 - plan.prices.yearly / monthly12) * 100)
}

/** Display price for a given billing interval */
export function planPrice(plan: PlanDefinition, interval: BillingInterval): number {
  return plan.prices[interval]
}
