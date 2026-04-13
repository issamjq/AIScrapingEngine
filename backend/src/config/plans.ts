// ─── Central Plan Config — single source of truth for both frontend + backend ───
// Do NOT add pricing / credit logic anywhere else. Reference this file.

export interface PlanDefinition {
  key:         string          // e.g. 'b2c_free', 'b2b_growth'
  audience:    "b2c" | "b2b"
  name:        string
  description: string
  recommended?: boolean
  prices: {
    weekly:  number            // USD / week  (0 = free)
    monthly: number            // USD / month
    yearly:  number            // USD / year  (yearly = ~10 months)
  }
  credits: {
    monthly: number            // credits refreshed every 30 days regardless of billing interval
  }
  limits: {
    daily:  number             // hard cap per calendar day (UTC)
    weekly: number             // hard cap per ISO week (Mon–Sun)
  }
  features: string[]
  isFree: boolean
}

export const PLANS: PlanDefinition[] = [
  // ─────────────────────────────────────────────
  // B2C
  // ─────────────────────────────────────────────
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
    description: "For heavy individual users and power users",
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

  // ─────────────────────────────────────────────
  // B2B
  // ─────────────────────────────────────────────
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

export function getPlanByKey(key: string): PlanDefinition | undefined {
  return PLANS.find(p => p.key === key)
}

export function getPlansForAudience(audience: "b2c" | "b2b"): PlanDefinition[] {
  return PLANS.filter(p => p.audience === audience)
}

/**
 * Map legacy subscription values to the new plan key.
 * Used for existing users who don't have plan_code set yet.
 */
export function legacyPlanKey(role: string, subscription: string): string {
  const aud = role === "b2c" ? "b2c" : "b2b"
  if (["paid", "pro", "weekly", "monthly"].includes(subscription)) {
    return aud === "b2c" ? "b2c_pro"    : "b2b_growth"
  }
  if (subscription === "trial") {
    return aud === "b2c" ? "b2c_starter" : "b2b_growth"
  }
  return `${aud}_free`
}

/**
 * Get effective daily/weekly/monthly limits for a user.
 * Falls back to legacy mapping when plan_code is not set.
 */
export function getEffectiveLimits(
  planCode:     string | null,
  role:         string,
  subscription: string
): { daily: number; weekly: number; monthly: number } {
  const key  = planCode || legacyPlanKey(role, subscription)
  const plan = getPlanByKey(key)
  if (!plan) return { daily: 2, weekly: 6, monthly: 20 }
  return {
    daily:   plan.limits.daily,
    weekly:  plan.limits.weekly,
    monthly: plan.credits.monthly,
  }
}

/** ISO week string — e.g. "2026-W15" */
export function isoWeek(d: Date): string {
  const date = new Date(d)
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7)
  const jan4   = new Date(date.getFullYear(), 0, 4)
  const weekNo = 1 + Math.round(((date.getTime() - jan4.getTime()) / 86400000 - 3 + (jan4.getDay() + 6) % 7) / 7)
  return `${date.getFullYear()}-W${weekNo}`
}
