import { useEffect, useState } from "react"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { CheckCircle2, Sparkles, Crown, Loader2, AlertCircle, Wallet, Building2, User } from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { PLANS, getPlansForAudience, yearlySavingsPct, type BillingInterval } from "@/lib/plans"

const API = import.meta.env.VITE_API_URL || "http://localhost:8080"

interface UserProfile {
  role:            string
  subscription:    string
  plan_code:       string | null
  billing_interval: string | null
  trial_ends_at:   string | null
}

interface WalletData {
  balance:     number
  total_added: number
  total_used:  number
}

function daysLeft(trialEndsAt: string | null): number | null {
  if (!trialEndsAt) return null
  const diff = new Date(trialEndsAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / 86_400_000))
}

function formatPrice(usd: number, interval: BillingInterval): string {
  if (usd === 0) return "$0"
  return `$${usd}`
}

function intervalLabel(interval: BillingInterval): string {
  return interval === "weekly" ? "week" : interval === "monthly" ? "month" : "year"
}

export function PlansContent({ role: roleProp }: { role?: string }) {
  const { user } = useAuth()
  const [profile,   setProfile]   = useState<UserProfile | null>(null)
  const [wallet,    setWallet]    = useState<WalletData | null>(null)
  const [loading,   setLoading]   = useState(true)

  // Audience toggle — default to user's own role
  const [audience,  setAudience]  = useState<"b2c" | "b2b">("b2b")
  const [interval,  setInterval]  = useState<BillingInterval>("monthly")

  useEffect(() => {
    if (!user) return
    let cancelled = false
    async function load() {
      try {
        const token = await (user as any).getIdToken()
        const headers = { Authorization: `Bearer ${token}` }
        const [meRes, walletRes] = await Promise.all([
          fetch(`${API}/api/allowed-users/me`, { headers }),
          fetch(`${API}/api/wallet`,           { headers }),
        ])
        const [meJson, walletJson] = await Promise.all([meRes.json(), walletRes.json()])
        if (!cancelled) {
          if (meJson.success) {
            setProfile(meJson.data)
            // Default audience to the user's own role
            const r = meJson.data?.role
            if (r === "b2c") setAudience("b2c")
            else              setAudience("b2b")
            // Default interval to user's saved billing interval
            const bi = meJson.data?.billing_interval
            if (bi === "weekly" || bi === "yearly") setInterval(bi)
          }
          if (walletJson.success) setWallet(walletJson.data?.wallet ?? null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [user])

  const isUnlimited = ["dev", "owner"].includes(profile?.role || "")
  const currentSub  = profile?.subscription || "free"
  const currentPlan = profile?.plan_code || null
  const days        = daysLeft(profile?.trial_ends_at ?? null)

  const audiencePlans = getPlansForAudience(audience)

  if (loading) return (
    <div className="flex items-center justify-center py-24 gap-3 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
      <span className="text-sm">Loading…</span>
    </div>
  )

  return (
    <div className="space-y-8 max-w-5xl">

      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Choose Your Plan</h1>
        <p className="text-muted-foreground text-sm">Start free, upgrade when you need more. Cancel anytime.</p>
      </div>

      {/* Unlimited banner */}
      {isUnlimited && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 px-5 py-4 flex items-center gap-3">
          <Crown className="h-5 w-5 text-primary shrink-0" />
          <span className="text-sm font-medium">
            Unlimited access as <span className="capitalize">{profile?.role}</span>. No credit limits apply.
          </span>
        </div>
      )}

      {/* Current plan + wallet */}
      {!isUnlimited && profile && (
        <div className="rounded-xl border bg-muted/40 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm capitalize">
                {currentPlan
                  ? PLANS.find(p => p.key === currentPlan)?.name ?? currentSub
                  : (currentSub === "paid" ? "Pro" : currentSub)
                } plan
              </span>
              {currentSub === "trial" && days !== null && (
                <Badge variant="secondary" className="text-[10px]">
                  {days} day{days !== 1 ? "s" : ""} left
                </Badge>
              )}
              {currentSub === "trial" && days !== null && days <= 3 && (
                <Badge variant="destructive" className="text-[10px]">Expiring soon</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {profile.role === "b2c" ? "Personal" : "Business"} account
            </p>
          </div>
          {wallet && (
            <div className="flex items-center gap-3 rounded-lg border bg-background px-4 py-2.5">
              <Wallet className="h-4 w-4 text-primary shrink-0" />
              <div>
                <p className="text-sm font-bold">{wallet.balance} credits</p>
                <p className="text-[10px] text-muted-foreground">{wallet.total_used} used · {wallet.total_added} total</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Trial expiry warning */}
      {!isUnlimited && currentSub === "trial" && days !== null && days <= 3 && (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 px-5 py-3 flex items-center gap-3">
          <AlertCircle className="h-4 w-4 text-yellow-500 shrink-0" />
          <p className="text-sm">
            <span className="text-yellow-600 font-semibold">Only {days} day{days !== 1 ? "s" : ""} left</span> in your trial. Upgrade to keep full access.
          </p>
        </div>
      )}

      {/* Controls row: Audience toggle + Billing interval toggle */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Audience toggle */}
        <div className="inline-flex items-center rounded-full border bg-muted/50 p-1 gap-1">
          <button
            onClick={() => setAudience("b2b")}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              audience === "b2b" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Building2 className="h-3.5 w-3.5" />
            Business
          </button>
          <button
            onClick={() => setAudience("b2c")}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              audience === "b2c" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <User className="h-3.5 w-3.5" />
            Personal
          </button>
        </div>

        {/* Billing interval toggle */}
        <div className="inline-flex items-center rounded-full border bg-muted/50 p-1 gap-1">
          {(["weekly", "monthly", "yearly"] as BillingInterval[]).map((iv) => (
            <button
              key={iv}
              onClick={() => setInterval(iv)}
              className={`relative px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                interval === iv ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {iv.charAt(0).toUpperCase() + iv.slice(1)}
              {iv === "yearly" && (
                <span className="absolute -top-2.5 -right-1 text-[9px] font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-400 rounded-full px-1 py-0.5 leading-none">
                  SAVE
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {audiencePlans.map((plan) => {
          const price      = plan.prices[interval]
          const savingsPct = interval === "yearly" ? yearlySavingsPct(plan) : 0
          const isCurrent  = currentPlan === plan.key || (!currentPlan && plan.isFree && (currentSub === "free" || currentSub === "trial"))
          const isRecommended = !!plan.recommended

          return (
            <div
              key={plan.key}
              className={`relative rounded-2xl border flex flex-col transition-all ${
                isRecommended ? "border-primary shadow-lg shadow-primary/10" : "border-border"
              }`}
            >
              {/* Recommended badge */}
              {isRecommended && (
                <div className="absolute -top-3.5 left-0 right-0 flex justify-center z-10">
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
                    <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${
                      isRecommended ? "bg-primary text-primary-foreground" : "bg-muted"
                    }`}>
                      {plan.isFree ? <Sparkles className="h-4 w-4" /> : isRecommended ? <Sparkles className="h-4 w-4" /> : <Crown className="h-4 w-4" />}
                    </div>
                    <span className="font-bold text-base">{plan.name}</span>
                  </div>
                  {isCurrent && !isUnlimited && (
                    <Badge variant="secondary" className="text-[10px]">Current</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mb-4">{plan.description}</p>

                {/* Price */}
                <div className="mb-4">
                  <div className="flex items-end gap-1">
                    <span className="text-4xl font-extrabold tracking-tight">
                      {formatPrice(price, interval)}
                    </span>
                    {price > 0 && (
                      <span className="text-sm text-muted-foreground mb-1.5">
                        /{intervalLabel(interval)}
                      </span>
                    )}
                    {price === 0 && (
                      <span className="text-sm text-muted-foreground mb-1.5">/forever</span>
                    )}
                  </div>
                  <p className="text-xs text-primary font-medium mt-1">
                    {plan.credits.monthly.toLocaleString()} credits / month
                  </p>
                  {savingsPct > 0 && !plan.isFree && (
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
                      Save {savingsPct}% vs monthly
                    </p>
                  )}
                </div>

                {/* CTA */}
                <div className="mb-5">
                  {isCurrent && !isUnlimited ? (
                    <Button variant="outline" className="w-full" disabled>Current plan</Button>
                  ) : plan.isFree ? (
                    <Button variant="outline" className="w-full" disabled>Always free</Button>
                  ) : (
                    <Button className={`w-full gap-2 ${!isRecommended ? "variant-outline" : ""}`} disabled>
                      <Sparkles className="h-3.5 w-3.5" />
                      Subscribe · Coming soon
                    </Button>
                  )}
                </div>

                <div className="border-t mb-4" />

                {/* Features */}
                <ul className="space-y-2.5 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 min-w-0">
                      <CheckCircle2 className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
                      <span className="text-sm">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground pb-4">
        Payment integration coming soon. Plans and credit limits are active now.
        Questions? Contact us anytime.
      </p>
    </div>
  )
}
