import { useState } from "react"
import { useAuth } from "@/context/AuthContext"
import { Building2, User, ArrowRight, CheckCircle2, Sparkles, Crown, Loader2, AlertCircle } from "lucide-react"
import { Button } from "./ui/button"
import { getPlansForAudience, yearlySavingsPct, type BillingInterval, type PlanDefinition } from "@/lib/plans"

const API = import.meta.env.VITE_API_URL || "http://localhost:8080"

interface Props {
  onComplete: () => void
}

type Role = "b2b" | "b2c"

// ─── Step 1: Role picker ───────────────────────────────────────────────────

function RolePicker({ onNext }: { onNext: (role: Role) => void }) {
  const [selected, setSelected] = useState<Role | null>(null)

  const options: { role: Role; icon: typeof Building2; title: string; desc: string; bullets: string[] }[] = [
    {
      role:    "b2b",
      icon:    Building2,
      title:   "For My Business",
      desc:    "I represent a company tracking competitor prices",
      bullets: [
        "Search web + your product catalog",
        "Track multiple product categories",
        "14-day full trial",
      ],
    },
    {
      role:    "b2c",
      icon:    User,
      title:   "For Personal Use",
      desc:    "I want to find the best prices on products I buy",
      bullets: [
        "Search any product across the web",
        "AI-powered price discovery",
        "7-day full trial",
      ],
    },
  ]

  return (
    <>
      <div className="text-center mb-8 max-w-md">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">How will you use it?</h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Choose your account type to get started. You can always upgrade later.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl mb-8">
        {options.map(({ role, icon: Icon, title, desc, bullets }) => {
          const isSelected = selected === role
          return (
            <button
              key={role}
              onClick={() => setSelected(role)}
              className={[
                "relative text-left rounded-xl border-2 p-6 transition-all focus:outline-none",
                isSelected
                  ? "border-primary bg-primary/5 shadow-md"
                  : "border-border hover:border-primary/50 hover:bg-muted/30",
              ].join(" ")}
            >
              {isSelected && (
                <CheckCircle2 className="absolute top-4 right-4 h-5 w-5 text-primary" />
              )}
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <h2 className="font-semibold text-base mb-1">{title}</h2>
              <p className="text-muted-foreground text-sm mb-4">{desc}</p>
              <ul className="space-y-1.5">
                {bullets.map((b) => (
                  <li key={b} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                    {b}
                  </li>
                ))}
              </ul>
            </button>
          )
        })}
      </div>

      <Button
        onClick={() => selected && onNext(selected)}
        disabled={!selected}
        className="w-full max-w-xs h-12 text-sm font-medium gap-2"
      >
        Continue
        <ArrowRight className="h-4 w-4" />
      </Button>
    </>
  )
}

// ─── Step 2: Plan picker ───────────────────────────────────────────────────

function PlanPicker({
  role,
  onBack,
  onComplete,
}: {
  role: Role
  onBack: () => void
  onComplete: () => void
}) {
  const { user } = useAuth()
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [interval, setInterval] = useState<BillingInterval>("monthly")

  const plans = getPlansForAudience(role)
  const trialDays = role === "b2b" ? 14 : 7

  async function signup(plan: PlanDefinition) {
    if (!user) return
    setSaving(true)
    setError(null)
    try {
      const token = await user.getIdToken()
      // Map plan key to legacy plan value for backend compat
      const legacyPlan = plan.isFree ? "free" : "trial"
      // Pull any UTM / referrer the landing page stashed at first visit
      const utm = (() => {
        try { return JSON.parse(sessionStorage.getItem("spark_utm") ?? "{}") ?? {} }
        catch { return {} }
      })()
      const res = await fetch(`${API}/api/allowed-users/signup`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({
          role,
          plan:             legacyPlan,
          plan_code:        plan.key,
          billing_interval: interval,
          name:             user.displayName || user.email,
          utm_source:       utm.source   ?? null,
          utm_medium:       utm.medium   ?? null,
          utm_campaign:     utm.campaign ?? null,
          referrer:         utm.referrer ?? null,
        }),
      })
      const data = await res.json()
      if (!data.success) {
        const code = data.error?.code
        if (code === "DUPLICATE_ACCOUNT" || code === "IP_TRIAL_LIMIT") {
          setError(data.error.message)
        } else {
          throw new Error(data.error?.message || "Signup failed")
        }
        return
      }
      onComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="text-center mb-6 max-w-2xl">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Choose Your Plan</h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Start with a trial on any paid plan, or stay free forever.
        </p>

        {/* Role pill */}
        <div className="mt-3 inline-flex items-center gap-2 rounded-full border bg-muted/50 px-4 py-1.5">
          {role === "b2b"
            ? <Building2 className="h-3.5 w-3.5 text-primary" />
            : <User className="h-3.5 w-3.5 text-primary" />
          }
          <span className="text-xs font-medium">
            {role === "b2b" ? "Business account" : "Personal account"}
          </span>
        </div>

        {/* Billing interval toggle */}
        <div className="mt-4 inline-flex items-center rounded-full border bg-muted/50 p-1 gap-1">
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-4xl mb-6">
        {plans.map((plan) => {
          const price      = plan.prices[interval]
          const savingsPct = interval === "yearly" ? yearlySavingsPct(plan) : 0
          const isRecommended = !!plan.recommended
          const intervalLabel = interval === "weekly" ? "week" : interval === "monthly" ? "month" : "year"

          // Paid plans: show trial CTA (Stripe not built yet → "Coming soon")
          // Free plan: immediate signup
          const isPaid = !plan.isFree

          return (
            <div
              key={plan.key}
              className={`relative rounded-2xl border flex flex-col transition-all ${
                isRecommended ? "border-primary shadow-lg shadow-primary/10" : "border-border"
              }`}
            >
              {isRecommended && (
                <div className="absolute -top-3.5 left-0 right-0 flex justify-center z-10">
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground shadow">
                    <Sparkles className="h-3 w-3" />
                    Most Popular
                  </span>
                </div>
              )}

              <div className="p-5 flex flex-col flex-1">
                {/* Header */}
                <div className="flex items-center gap-2 mb-1">
                  <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${
                    isRecommended ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}>
                    {plan.isFree
                      ? <Sparkles className="h-4 w-4" />
                      : isRecommended
                      ? <Sparkles className="h-4 w-4" />
                      : <Crown className="h-4 w-4" />
                    }
                  </div>
                  <span className="font-bold text-base">{plan.name}</span>
                </div>
                <p className="text-xs text-muted-foreground mb-4">{plan.description}</p>

                {/* Price */}
                <div className="mb-4">
                  <div className="flex items-end gap-1">
                    <span className="text-3xl font-extrabold tracking-tight">
                      {price === 0 ? "$0" : `$${price}`}
                    </span>
                    <span className="text-sm text-muted-foreground mb-1">
                      /{price === 0 ? "forever" : intervalLabel}
                    </span>
                  </div>
                  <p className="text-xs text-primary font-medium mt-1">
                    {plan.credits.monthly.toLocaleString()} credits / month
                  </p>
                  {savingsPct > 0 && !plan.isFree && (
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
                      Save {savingsPct}% vs monthly
                    </p>
                  )}
                  {isPaid && !plan.isFree && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {trialDays}-day free trial included
                    </p>
                  )}
                </div>

                {/* CTA */}
                {plan.isFree ? (
                  <Button
                    variant="outline"
                    className="w-full mb-4 gap-1.5"
                    disabled={saving}
                    onClick={() => signup(plan)}
                  >
                    {saving ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" />Setting up…</>
                    ) : (
                      <><ArrowRight className="h-3.5 w-3.5" />Start for Free</>
                    )}
                  </Button>
                ) : (
                  <Button
                    className={`w-full mb-4 gap-1.5 ${!isRecommended ? "bg-foreground text-background hover:bg-foreground/90" : ""}`}
                    disabled={saving}
                    onClick={() => signup(plan)}
                  >
                    {saving ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" />Setting up…</>
                    ) : (
                      <><ArrowRight className="h-3.5 w-3.5" />Start {trialDays}-Day Trial</>
                    )}
                  </Button>
                )}

                <div className="border-t mb-4" />

                {/* Features */}
                <ul className="space-y-2 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 min-w-0">
                      <CheckCircle2 className="h-3.5 w-3.5 text-yellow-500 shrink-0 mt-0.5" />
                      <span className="text-xs">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )
        })}
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive flex items-start gap-2 max-w-2xl w-full">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <button
        onClick={onBack}
        className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-2"
      >
        ← Back
      </button>
    </>
  )
}

// ─── Main component ────────────────────────────────────────────────────────

export function OnboardingContent({ onComplete }: Props) {
  const [step, setStep] = useState<1 | 2>(1)
  const [role, setRole] = useState<Role | null>(null)

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-12">
      {/* Logo */}
      <div className="flex items-center gap-2 mb-10">
        <img src="/spark-logo.gif" alt="Spark" className="h-10 w-10 object-contain" />
        <span className="text-xl font-bold">Spark AI</span>
      </div>

      {step === 1 && (
        <RolePicker onNext={(r) => { setRole(r); setStep(2) }} />
      )}

      {step === 2 && role && (
        <PlanPicker
          role={role}
          onBack={() => setStep(1)}
          onComplete={onComplete}
        />
      )}
    </div>
  )
}
