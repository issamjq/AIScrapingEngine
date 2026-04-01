import { useEffect, useState } from "react"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { CheckCircle, XCircle, Sparkles, Zap, Crown, BarChart3, AlertCircle } from "lucide-react"
import { useAuth } from "@/context/AuthContext"

const API = import.meta.env.VITE_API_URL || "http://localhost:8080"

interface UserProfile {
  role:                 string
  subscription:        string
  trial_ends_at:       string | null
  daily_searches_used: number
}

interface PlanFeature { text: string; included: boolean }

interface Plan {
  key:       string
  name:      string
  tagline:   string
  price:     string
  priceNote: string
  icon:      React.ElementType
  popular:   boolean
  limitLine: string   // role-specific, set at render time
  features:  PlanFeature[]
}

function getPlans(isB2C: boolean): Plan[] {
  return [
    {
      key:       "free",
      name:      "Free",
      tagline:   "Try it out, no commitment",
      price:     "$0",
      priceNote: "forever",
      icon:      Zap,
      popular:   false,
      limitLine: isB2C ? "15 credits / month" : "10 searches / week",
      features: isB2C ? [
        { text: "15 credits per month",                  included: true  },
        { text: "3 results per retailer (rest blurred)", included: true  },
        { text: "AI Market Discovery",                   included: true  },
        { text: "AI Product Matching",                   included: true  },
        { text: "Price Tracking",                        included: true  },
        { text: "All results unlocked",                  included: false },
        { text: "Price Alerts",                          included: false },
        { text: "Priority Support",                      included: false },
      ] : [
        { text: "10 searches per week",                  included: true  },
        { text: "3 results per retailer (rest blurred)", included: true  },
        { text: "AI Market Discovery",                   included: true  },
        { text: "AI Product Matching",                   included: true  },
        { text: "Price Tracking",                        included: true  },
        { text: "All results unlocked",                  included: false },
        { text: "Export data (CSV)",                     included: false },
        { text: "Price Alerts",                          included: false },
        { text: "Priority Support",                      included: false },
      ],
    },
    {
      key:       "paid",
      name:      "Pro",
      tagline:   isB2C ? "For serious shoppers & deal hunters" : "For professionals & growing teams",
      price:     "$20",
      priceNote: "per month",
      icon:      Sparkles,
      popular:   true,
      limitLine: isB2C ? "150 credits / month" : "50 searches / week",
      features: isB2C ? [
        { text: "150 credits per month",                 included: true  },
        { text: "All results unlocked — no blur",        included: true  },
        { text: "AI Market Discovery",                   included: true  },
        { text: "AI Product Matching",                   included: true  },
        { text: "Price Tracking",                        included: true  },
        { text: "Price Alerts",                          included: true  },
        { text: "Priority Support",                      included: true  },
        { text: "Export data (CSV)",                     included: false },
      ] : [
        { text: "50 searches per week",                  included: true  },
        { text: "All results unlocked — no blur",        included: true  },
        { text: "AI Market Discovery",                   included: true  },
        { text: "AI Product Matching",                   included: true  },
        { text: "Price Tracking",                        included: true  },
        { text: "Export data (CSV)",                     included: true  },
        { text: "Price Alerts",                          included: true  },
        { text: "Priority Support",                      included: true  },
      ],
    },
  ]
}

function daysLeft(trialEndsAt: string | null): number | null {
  if (!trialEndsAt) return null
  const diff = new Date(trialEndsAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / 86_400_000))
}

export function PlansContent() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    async function load() {
      try {
        const token = await (user as any).getIdToken()
        const res   = await fetch(`${API}/api/allowed-users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const json  = await res.json()
        if (!cancelled && json.success) setProfile(json.data)
      } catch {
        if (!cancelled) setError("Could not load your plan info.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [user])

  const currentSub = profile?.subscription || "free"
  const isOwnerDev = ["dev", "owner"].includes(profile?.role || "")
  const isB2C      = profile?.role === "b2c"
  const days       = daysLeft(profile?.trial_ends_at || null)
  const used       = profile?.daily_searches_used || 0
  const plans      = getPlans(isB2C)

  // Limits per role type
  const LIMITS: Record<string, number> = isB2C
    ? { trial: 30, free: 15, paid: 150 }
    : { trial: 20, free: 10, paid: 50  }
  const limit       = LIMITS[currentSub] ?? LIMITS.free
  const periodLabel = isB2C ? "this month" : "this week"
  const unitLabel   = isB2C ? "credits" : "searches"

  return (
    <div className="space-y-8 max-w-4xl mx-auto">

      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Choose Your Plan</h1>
        <p className="text-muted-foreground">
          Start free, upgrade when you need more. Cancel anytime.
        </p>
      </div>

      {/* Current plan banner */}
      {!loading && profile && !isOwnerDev && (
        <div className="rounded-xl border bg-muted/40 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <BarChart3 className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm capitalize">
                  {currentSub === "paid" ? "Pro" : currentSub} plan
                </span>
                {currentSub === "trial" && days !== null && (
                  <Badge variant="secondary" className="text-[10px]">
                    {days} day{days !== 1 ? "s" : ""} left in trial
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {used} / {limit} {unitLabel} used {periodLabel}
              </p>
            </div>
          </div>
          {/* Usage bar */}
          <div className="sm:w-48 w-full">
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${used / limit > 0.8 ? "bg-red-500" : "bg-primary"}`}
                style={{ width: `${Math.min(100, (used / limit) * 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 text-right">
              {Math.round((used / limit) * 100)}% used
            </p>
          </div>
        </div>
      )}

      {isOwnerDev && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 px-5 py-4 flex items-center gap-3">
          <Crown className="h-5 w-5 text-primary shrink-0" />
          <span className="text-sm font-medium">
            You have unlimited access as a <span className="capitalize">{profile?.role}</span>.
          </span>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-destructive/10 text-destructive px-4 py-3 flex items-center gap-2 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Trial banner */}
      {currentSub === "trial" && !isOwnerDev && (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 px-5 py-3 flex items-center gap-3">
          <Zap className="h-4 w-4 text-yellow-500 shrink-0" />
          <p className="text-sm">
            You're on a <strong>free trial</strong> — enjoy full access with no blur.{" "}
            {days !== null && days <= 3
              ? <span className="text-yellow-600 font-semibold">Only {days} day{days !== 1 ? "s" : ""} left!</span>
              : <span className="text-muted-foreground">Upgrade before it ends to keep full access.</span>
            }
          </p>
        </div>
      )}

      {/* Plan cards — 2 plans only */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
        {plans.map((plan) => {
          const Icon      = plan.icon
          const isCurrent = (plan.key === "paid" && currentSub === "paid") ||
                            (plan.key === "free" && (currentSub === "free" || currentSub === "trial"))

          return (
            <div
              key={plan.key}
              className={`relative rounded-2xl border flex flex-col transition-all duration-200 ${
                plan.popular
                  ? "border-primary shadow-lg shadow-primary/10 scale-[1.02]"
                  : "border-border hover:border-muted-foreground/40 hover:shadow-md"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3.5 left-0 right-0 flex justify-center">
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground shadow">
                    <Sparkles className="h-3 w-3" />
                    Most Popular
                  </span>
                </div>
              )}

              <div className="p-6 flex flex-col flex-1">
                {/* Plan header */}
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${plan.popular ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="font-bold text-base">{plan.name}</span>
                  </div>
                  {isCurrent && !isOwnerDev && (
                    <Badge variant="secondary" className="text-[10px]">Current</Badge>
                  )}
                </div>

                <p className="text-xs text-muted-foreground mb-5">{plan.tagline}</p>

                {/* Price */}
                <div className="mb-5">
                  <div className="flex items-end gap-1">
                    <span className="text-4xl font-extrabold tracking-tight">{plan.price}</span>
                    <span className="text-sm text-muted-foreground mb-1.5">/{plan.priceNote}</span>
                  </div>
                  <p className="text-xs text-primary font-medium mt-1">{plan.limitLine}</p>
                </div>

                {/* CTA */}
                <div className="mb-6">
                  {isCurrent && !isOwnerDev ? (
                    <Button variant="outline" className="w-full" disabled>Current plan</Button>
                  ) : plan.key === "free" ? (
                    <Button variant="outline" className="w-full" disabled={isCurrent}>
                      {isCurrent ? "Current plan" : "Downgrade to Free"}
                    </Button>
                  ) : (
                    <Button className="w-full gap-2" disabled>
                      <Sparkles className="h-3.5 w-3.5" />
                      Coming soon
                    </Button>
                  )}
                </div>

                <div className="border-t mb-5" />

                {/* Features */}
                <ul className="space-y-2.5 flex-1">
                  {plan.features.map((f) => (
                    <li key={f.text} className="flex items-start gap-2.5 text-sm">
                      {f.included
                        ? <CheckCircle className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                        : <XCircle    className="h-4 w-4 text-muted-foreground/30 shrink-0 mt-0.5" />
                      }
                      <span className={f.included ? "" : "text-muted-foreground/50"}>{f.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer note */}
      <p className="text-center text-xs text-muted-foreground pb-4">
        All plans include a free trial. Paid plans coming soon via Stripe. Questions? Contact us anytime.
      </p>

    </div>
  )
}
