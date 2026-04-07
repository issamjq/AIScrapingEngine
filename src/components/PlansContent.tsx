import { useEffect, useState } from "react"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { CheckCircle2, XCircle, Sparkles, Crown, Loader2, AlertCircle, Wallet, BarChart3 } from "lucide-react"
import { useAuth } from "@/context/AuthContext"

type Currency = "USD" | "AED"

const API = import.meta.env.VITE_API_URL || "http://localhost:8080"

interface PlanRow {
  id: number
  key: string
  name: string
  tagline: string
  price_usd_b2b: number
  price_usd_b2c: number
  price_aed_b2c: number | null
  billing_period: string | null
  price_note_b2b: string | null
  price_note_b2c: string | null
  credits_b2b: number | null
  credits_b2c: number | null
  features_b2b: { text: string; included: boolean }[]
  features_b2c: { text: string; included: boolean }[]
  is_coming_soon: boolean
  sort_order: number
}

interface CurrencyRate {
  from_currency: string
  to_currency: string
  rate: number
}

interface UserProfile {
  role:           string
  subscription:   string
  trial_ends_at:  string | null
}

interface WalletData {
  balance:     number
  total_added: number
  total_used:  number
}

const PLAN_ICONS: Record<string, React.ElementType> = {
  trial:      BarChart3,
  free:       Sparkles,
  pro:        Sparkles,
  enterprise: Crown,
}

function daysLeft(trialEndsAt: string | null): number | null {
  if (!trialEndsAt) return null
  const diff = new Date(trialEndsAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / 86_400_000))
}

export function PlansContent(_: { role?: string }) {
  const { user } = useAuth()
  const [plans, setPlans]           = useState<PlanRow[]>([])
  const [profile, setProfile]       = useState<UserProfile | null>(null)
  const [wallet, setWallet]         = useState<WalletData | null>(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [currency, setCurrency]     = useState<Currency>("USD")
  const [aedRate, setAedRate]       = useState<number>(3.65)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    async function load() {
      try {
        const token = await (user as any).getIdToken()
        const headers = { Authorization: `Bearer ${token}` }
        const [plansRes, meRes, walletRes, ratesRes] = await Promise.all([
          fetch(`${API}/api/plans`,             { headers }),
          fetch(`${API}/api/allowed-users/me`,  { headers }),
          fetch(`${API}/api/wallet`,            { headers }),
          fetch(`${API}/api/currency-rates`,    { headers }),
        ])
        const [plansJson, meJson, walletJson, ratesJson] = await Promise.all([
          plansRes.json(), meRes.json(), walletRes.json(), ratesRes.json(),
        ])
        if (!cancelled) {
          if (plansJson.success)  setPlans(plansJson.data)
          if (meJson.success)     setProfile(meJson.data)
          if (walletJson.success) setWallet(walletJson.data?.wallet ?? null)
          if (ratesJson.success) {
            const usdAed = (ratesJson.data as CurrencyRate[]).find(r => r.from_currency === "USD" && r.to_currency === "AED")
            if (usdAed) setAedRate(Number(usdAed.rate))
          }
        }
      } catch {
        if (!cancelled) setError("Could not load plan information.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [user])

  function formatPrice(usdPrice: number): string {
    if (usdPrice === 0) return currency === "USD" ? "$0" : "AED 0"
    if (currency === "AED") return `AED ${Math.round(usdPrice * aedRate)}`
    return `$${usdPrice}`
  }

  const isUnlimited = ["dev", "owner"].includes(profile?.role || "")
  const isB2C       = profile?.role === "b2c"
  const currentSub  = profile?.subscription || "free"
  const days        = daysLeft(profile?.trial_ends_at ?? null)

  if (loading) return (
    <div className="flex items-center justify-center py-24 gap-3 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
      <span className="text-sm">Loading plans…</span>
    </div>
  )

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-bold tracking-tight">Choose Your Plan</h1>
        <p className="text-muted-foreground">Start free, upgrade when you need more. Cancel anytime.</p>
        {/* Currency toggle */}
        <div className="inline-flex items-center rounded-full border bg-muted/50 p-1 gap-1">
          <button
            onClick={() => setCurrency("USD")}
            className={`px-4 py-1 rounded-full text-sm font-medium transition-colors ${currency === "USD" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            $ USD
          </button>
          <button
            onClick={() => setCurrency("AED")}
            className={`px-4 py-1 rounded-full text-sm font-medium transition-colors ${currency === "AED" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            AED
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 text-destructive px-4 py-3 flex items-center gap-2 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Wallet + current plan banner */}
      {!isUnlimited && profile && (
        <div className="rounded-xl border bg-muted/40 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
                {isB2C ? "Personal" : "Business"} account
              </p>
            </div>
          </div>

          {/* Wallet balance */}
          {wallet && (
            <div className="flex items-center gap-3 rounded-lg border bg-background px-4 py-2.5">
              <Wallet className="h-4 w-4 text-primary shrink-0" />
              <div>
                <p className="text-sm font-bold">{wallet.balance} credits</p>
                <p className="text-[10px] text-muted-foreground">{wallet.total_used} used · {wallet.total_added} total added</p>
              </div>
            </div>
          )}
        </div>
      )}

      {isUnlimited && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 px-5 py-4 flex items-center gap-3">
          <Crown className="h-5 w-5 text-primary shrink-0" />
          <span className="text-sm font-medium">
            You have unlimited access as a <span className="capitalize">{profile?.role}</span>.
          </span>
        </div>
      )}

      {/* Trial expiry warning */}
      {currentSub === "trial" && !isUnlimited && days !== null && days <= 3 && (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 px-5 py-3 flex items-center gap-3">
          <AlertCircle className="h-4 w-4 text-yellow-500 shrink-0" />
          <p className="text-sm">
            <span className="text-yellow-600 font-semibold">Only {days} day{days !== 1 ? "s" : ""} left</span> in your trial. Upgrade to keep full access.
          </p>
        </div>
      )}

      {/* ── B2C plan cards ── */}
      {isB2C ? (
        <div className="space-y-6">
          {/* Weekly + Monthly side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto w-full">
            {plans.filter(p => p.key === "weekly" || p.key === "monthly").map((plan) => {
              const features  = plan.features_b2c
              const credits   = plan.credits_b2c
              const aedPrice  = plan.price_aed_b2c
              const isCurrent = plan.key === currentSub
              const isMonthly = plan.key === "monthly"

              return (
                <div
                  key={plan.key}
                  className={`relative rounded-2xl border flex flex-col transition-all ${
                    isMonthly ? "border-primary shadow-lg shadow-primary/10" : "border-border"
                  }`}
                >
                  {isMonthly && (
                    <div className="absolute -top-3.5 left-0 right-0 flex justify-center z-10">
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground shadow">
                        <Sparkles className="h-3 w-3" />
                        Best Value
                      </span>
                    </div>
                  )}
                  <div className="p-6 flex flex-col flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${isMonthly ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                          <Sparkles className="h-4 w-4" />
                        </div>
                        <span className="font-bold text-base">{plan.name}</span>
                      </div>
                      {isCurrent && !isUnlimited && <Badge variant="secondary" className="text-[10px]">Current</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mb-4">{plan.tagline}</p>
                    <div className="mb-4">
                      <div className="flex items-end gap-1">
                        <span className="text-4xl font-extrabold tracking-tight">
                          {currency === "AED"
                            ? (aedPrice ? `AED ${aedPrice}` : "—")
                            : formatPrice(plan.price_usd_b2c)
                          }
                        </span>
                        <span className="text-sm text-muted-foreground mb-1.5">
                          /{plan.billing_period === "weekly" ? "week" : "month"}
                        </span>
                      </div>
                      {credits != null && (
                        <p className="text-xs text-primary font-medium mt-1">{credits} credits included</p>
                      )}
                      {plan.billing_period === "monthly" && (
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
                          Save ~40% vs weekly
                        </p>
                      )}
                    </div>
                    <div className="mb-5">
                      {isCurrent && !isUnlimited ? (
                        <Button variant="outline" className="w-full" disabled>Current plan</Button>
                      ) : (
                        <Button className={`w-full gap-2 ${!isMonthly ? "variant-outline" : ""}`} disabled>
                          <Sparkles className="h-3.5 w-3.5" />
                          Subscribe · Coming soon
                        </Button>
                      )}
                    </div>
                    <div className="border-t mb-4" />
                    <ul className="space-y-2.5 flex-1">
                      {(features || []).map((f) => (
                        <li key={f.text} className="flex items-start gap-2.5 min-w-0">
                          {f.included
                            ? <CheckCircle2 className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
                            : <XCircle     className="h-4 w-4 text-muted-foreground/30 shrink-0 mt-0.5" />
                          }
                          <span className={`text-sm ${f.included ? "" : "text-muted-foreground/50"}`}>{f.text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Free plan — smaller */}
          {plans.filter(p => p.key === "free").map((plan) => (
            <div key={plan.key} className="rounded-2xl border bg-muted/30 px-6 py-5 max-w-2xl mx-auto w-full flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-sm">Free plan — always available</p>
                <p className="text-xs text-muted-foreground mt-0.5">15 credits · 3 results visible · No credit card required</p>
              </div>
              {currentSub === "free" && !isUnlimited
                ? <Button variant="outline" size="sm" disabled>Current plan</Button>
                : <Button variant="outline" size="sm" disabled>Downgrade to Free</Button>
              }
            </div>
          ))}
        </div>
      ) : (
        /* ── B2B plan cards (unchanged) ── */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {plans.filter(p => !["weekly","monthly"].includes(p.key)).map((plan) => {
            const Icon      = PLAN_ICONS[plan.key] ?? Sparkles
            const features  = plan.features_b2b
            const credits   = plan.credits_b2b
            const priceUsd  = plan.price_usd_b2b
            const priceNote = plan.price_note_b2b
            const isCurrent = plan.key === currentSub || (plan.key === "pro" && currentSub === "paid")
            const isEnterprise = plan.key === "enterprise"

            return (
              <div
                key={plan.key}
                className={`relative rounded-2xl border flex flex-col transition-all select-none ${
                  plan.key === "pro" ? "border-primary shadow-lg shadow-primary/10"
                  : isEnterprise    ? "border-dashed border-muted-foreground/30"
                  : "border-border"
                }`}
              >
                {plan.key === "pro" && (
                  <div className="absolute -top-3.5 left-0 right-0 flex justify-center z-10">
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground shadow">
                      <Sparkles className="h-3 w-3" />Most Popular
                    </span>
                  </div>
                )}
                {isEnterprise && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-background/60 backdrop-blur-sm rounded-2xl">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-3 py-1.5 text-xs font-semibold text-primary">
                      <Crown className="h-3.5 w-3.5" />Coming Soon
                    </span>
                    <p className="text-xs text-muted-foreground px-6 text-center">Enterprise plan is under construction</p>
                  </div>
                )}
                <div className="p-6 flex flex-col flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${plan.key === "pro" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="font-bold text-base">{plan.name}</span>
                    </div>
                    {isCurrent && !isUnlimited && <Badge variant="secondary" className="text-[10px]">Current</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">{plan.tagline}</p>
                  <div className="mb-4">
                    <div className="flex items-end gap-1">
                      <span className="text-4xl font-extrabold tracking-tight">{formatPrice(priceUsd)}</span>
                      {priceNote && <span className="text-sm text-muted-foreground mb-1.5">/{priceNote}</span>}
                    </div>
                    {credits != null && <p className="text-xs text-primary font-medium mt-1">{credits} credits / cycle</p>}
                  </div>
                  <div className="mb-5">
                    {isCurrent && !isUnlimited
                      ? <Button variant="outline" className="w-full" disabled>Current plan</Button>
                      : plan.is_coming_soon
                      ? <Button className="w-full gap-2" disabled><Sparkles className="h-3.5 w-3.5" />Coming soon</Button>
                      : <Button variant="outline" className="w-full" disabled>Select Plan</Button>
                    }
                  </div>
                  <div className="border-t mb-4" />
                  <ul className="space-y-2.5 flex-1">
                    {(features || []).map((f) => (
                      <li key={f.text} className="flex items-start gap-2.5 min-w-0">
                        {f.included
                          ? <CheckCircle2 className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
                          : <XCircle     className="h-4 w-4 text-muted-foreground/30 shrink-0 mt-0.5" />
                        }
                        <span className={`text-sm whitespace-nowrap ${f.included ? "" : "text-muted-foreground/50"}`}>{f.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground pb-4">
        {isB2C
          ? "Payment integration coming soon. Plans and credits are ready — subscribe when Stripe launches."
          : "All plans include a free trial. Paid plans coming soon. Questions? Contact us anytime."
        }
      </p>
    </div>
  )
}
