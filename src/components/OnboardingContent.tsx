import { useState, useEffect } from "react"
import { useAuth } from "@/context/AuthContext"
import { Building2, User, BarChart3, ArrowRight, CheckCircle2, XCircle, Sparkles, Crown, Loader2 } from "lucide-react"
import { Button } from "./ui/button"

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
      role: "b2b",
      icon: Building2,
      title: "For My Business",
      desc: "I represent a company tracking competitor prices",
      bullets: [
        "Search web + your product catalog",
        "Track multiple product categories",
        "14-day full trial",
      ],
    },
    {
      role: "b2c",
      icon: User,
      title: "For Personal Use",
      desc: "I want to track prices on products I buy",
      bullets: [
        "Search any product across the web",
        "Track price history over time",
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

interface PlanRow {
  id: number
  key: string
  name: string
  tagline: string
  price_usd_b2b: number
  price_usd_b2c: number
  price_note_b2b: string | null
  price_note_b2c: string | null
  trial_days_b2b: number | null
  trial_days_b2c: number | null
  credits_b2b: number | null
  credits_b2c: number | null
  features_b2b: { text: string; included: boolean }[]
  features_b2c: { text: string; included: boolean }[]
  is_coming_soon: boolean
  sort_order: number
}


const PLAN_ICONS: Record<string, React.ElementType> = {
  trial:      BarChart3,
  free:       ArrowRight,
  pro:        Sparkles,
  enterprise: Crown,
}

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
  const [plans, setPlans]       = useState<PlanRow[]>([])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [currency, setCurrency] = useState<"USD" | "AED">("USD")
  const [aedRate, setAedRate]   = useState<number>(3.65)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    async function fetchPlans() {
      try {
        const token = await (user as any).getIdToken()
        const headers = { Authorization: `Bearer ${token}` }
        const [plansRes, ratesRes] = await Promise.all([
          fetch(`${API}/api/plans`,          { headers }),
          fetch(`${API}/api/currency-rates`, { headers }),
        ])
        const [plansData, ratesData] = await Promise.all([plansRes.json(), ratesRes.json()])
        if (!cancelled) {
          if (plansData.success) setPlans(plansData.data)
          if (ratesData.success) {
            const usdAed = ratesData.data.find((r: any) => r.from_currency === "USD" && r.to_currency === "AED")
            if (usdAed) setAedRate(Number(usdAed.rate))
          }
        }
      } catch {
        if (!cancelled) setError("Could not load plans. Please try again.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchPlans()
    return () => { cancelled = true }
  }, [user])

  function formatPrice(usdPrice: number): string {
    if (usdPrice === 0) return currency === "USD" ? "$0" : "AED 0"
    if (currency === "AED") return `AED ${Math.round(usdPrice * aedRate)}`
    return `$${usdPrice}`
  }

  async function signup(planKey: string) {
    if (!user) return
    setSaving(true)
    setError(null)
    try {
      const token = await user.getIdToken()
      const res = await fetch(`${API}/api/allowed-users/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ role, plan: planKey, name: user.displayName || user.email }),
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

  const isB2C = role === "b2c"

  return (
    <>
      <div className="text-center mb-8 max-w-lg">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Choose Your Plan</h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Start with a trial or free plan. Upgrade anytime — no credit card required.
        </p>
        {/* Currency toggle */}
        <div className="mt-3 inline-flex items-center rounded-full border bg-muted/50 p-1 gap-1">
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
        <div className="mt-3 inline-flex items-center gap-2 rounded-full border bg-muted/50 px-4 py-1.5">
          {role === "b2b"
            ? <Building2 className="h-3.5 w-3.5 text-primary" />
            : <User className="h-3.5 w-3.5 text-primary" />
          }
          <span className="text-xs font-medium">
            {role === "b2b" ? "For My Business" : "For Personal Use"}
          </span>
          <span className="text-[10px] text-muted-foreground border-l pl-2">
            {role === "b2b" ? "Business account" : "Personal account"}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 text-muted-foreground py-16">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading plans…</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 w-full max-w-7xl mb-6 mt-6">
          {plans.map((plan) => {
            const Icon     = PLAN_ICONS[plan.key] ?? Sparkles
            const features  = isB2C ? plan.features_b2c : plan.features_b2b
            const credits   = isB2C ? plan.credits_b2c : plan.credits_b2b
            const priceUsd  = isB2C ? plan.price_usd_b2c : plan.price_usd_b2b
            const trialDays  = isB2C ? plan.trial_days_b2c : plan.trial_days_b2b
            const baseNote   = isB2C ? plan.price_note_b2c : plan.price_note_b2b
            const priceNote  = trialDays ? `for ${trialDays} days` : (baseNote ?? "forever")
            const isEnterprise = plan.key === "enterprise"

            return (
              <div
                key={plan.key}
                className={`relative rounded-2xl border flex flex-col transition-all select-none ${
                  plan.key === "pro"
                    ? "border-primary shadow-lg shadow-primary/10"
                    : isEnterprise
                    ? "border-dashed border-muted-foreground/30"
                    : "border-border"
                }`}
              >
                {/* Most Popular badge */}
                {plan.key === "pro" && (
                  <div className="absolute -top-3.5 left-0 right-0 flex justify-center z-10">
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground shadow">
                      <Sparkles className="h-3 w-3" />
                      Most Popular
                    </span>
                  </div>
                )}

                {/* Enterprise blur overlay */}
                {isEnterprise && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-background/60 backdrop-blur-sm rounded-2xl">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-3 py-1.5 text-xs font-semibold text-primary">
                      <Crown className="h-3.5 w-3.5" />
                      Coming Soon
                    </span>
                    <p className="text-xs text-muted-foreground px-6 text-center">Enterprise plan is under construction</p>
                  </div>
                )}

                <div className="p-5 flex flex-col flex-1">
                  {/* Header */}
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${plan.key === "pro" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="font-bold text-lg">{plan.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">{plan.tagline}</p>

                  {/* Price */}
                  <div className="mb-4">
                    <div className="flex items-end gap-1">
                      <span className="text-4xl font-extrabold tracking-tight">
                        {formatPrice(priceUsd)}
                      </span>
                      <span className="text-sm text-muted-foreground mb-1.5">/{priceNote}</span>
                    </div>
                    {credits != null && (
                      <p className="text-xs text-primary font-medium mt-1">{credits} credits included</p>
                    )}
                  </div>

                  {/* CTA */}
                  <Button
                    className="w-full mb-4 gap-1.5"
                    variant={plan.key === "pro" ? "default" : "outline"}
                    disabled={plan.is_coming_soon || saving}
                    onClick={plan.is_coming_soon ? undefined : () => signup(plan.key)}
                  >
                    {saving ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Setting up…</>
                    ) : plan.is_coming_soon ? (
                      "Coming Soon"
                    ) : plan.key === "trial" ? (
                      <><ArrowRight className="h-3.5 w-3.5" /> Start Free Trial</>
                    ) : (
                      <><ArrowRight className="h-3.5 w-3.5" /> Choose This Plan</>
                    )}
                  </Button>

                  <div className="border-t mb-4" />

                  {/* Features */}
                  <ul className="space-y-2 flex-1">
                    {features.map((f) => (
                      <li key={f.text} className="flex items-start gap-2 min-w-0">
                        {f.included
                          ? <CheckCircle2 className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
                          : <XCircle     className="h-4 w-4 text-muted-foreground/30 shrink-0 mt-0.5" />
                        }
                        <span className={`text-sm whitespace-nowrap ${f.included ? "" : "text-muted-foreground/40"}`}>{f.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive text-center max-w-xl w-full">
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
        <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
          <BarChart3 className="h-5 w-5 text-primary-foreground" />
        </div>
        <span className="text-xl font-bold">AI Scraping Engine</span>
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
