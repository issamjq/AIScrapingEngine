import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog"
import { Button } from "./ui/button"
import { Badge } from "./ui/badge"
import { CheckCircle, XCircle, Sparkles, Zap, type LucideIcon } from "lucide-react"

interface PlansModalProps {
  open:         boolean
  onClose:      () => void
  subscription: string           // 'trial' | 'free' | 'paid'
  role:         string           // 'b2b' | 'b2c' | other
  used:         number
  limit:        number
  trialEndsAt?: string | null
}

interface PlanDef {
  key:        string
  label:      string
  icon:       LucideIcon
  limitLine:  string
  trialDays?: number
  price:      string
  features:   { text: string; included: boolean }[]
}

function getPlans(isB2C: boolean): PlanDef[] {
  return [
    {
      key:       "trial",
      label:     "Trial",
      icon:      Zap,
      limitLine: isB2C ? "30 credits / month" : "20 searches / week",
      trialDays: isB2C ? 7 : 14,
      price:     "Free",
      features: [
        { text: isB2C ? "30 credits / month"    : "20 searches / week",    included: true  },
        { text: isB2C ? "7-day trial"           : "14-day trial",          included: true  },
        { text: "All results visible — no blur",                            included: true  },
        { text: "AI Market Discovery",                                      included: true  },
        { text: "AI Product Matching",                                      included: true  },
        { text: "Price Tracking",                                           included: true  },
        { text: "Priority Support",                                         included: false },
      ],
    },
    {
      key:      "free",
      label:    "Free",
      icon:     CheckCircle,
      limitLine: isB2C ? "15 credits / month" : "10 searches / week",
      price:    "$0 / month",
      features: [
        { text: isB2C ? "15 credits / month"    : "10 searches / week",    included: true  },
        { text: "Unlimited time",                                           included: true  },
        { text: "3 results per retailer (rest blurred)",                    included: true  },
        { text: "AI Market Discovery",                                      included: true  },
        { text: "AI Product Matching",                                      included: true  },
        { text: "Price Tracking",                                           included: true  },
        { text: "Priority Support",                                         included: false },
      ],
    },
    {
      key:      "paid",
      label:    "Pro",
      icon:     Sparkles,
      limitLine: isB2C ? "150 credits / month" : "50 searches / week",
      price:    "$20 / month",
      features: [
        { text: isB2C ? "150 credits / month"   : "50 searches / week",    included: true  },
        { text: "All results visible — no blur",                            included: true  },
        { text: "AI Market Discovery",                                      included: true  },
        { text: "AI Product Matching",                                      included: true  },
        { text: "Price Tracking",                                           included: true  },
        { text: "Price Alerts",                                             included: true  },
        { text: "Priority Support",                                         included: true  },
      ],
    },
  ]
}

function daysLeft(trialEndsAt: string | null | undefined): number | null {
  if (!trialEndsAt) return null
  const diff = new Date(trialEndsAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / 86_400_000))
}

export function PlansModal({ open, onClose, subscription, role, used, limit, trialEndsAt }: PlansModalProps) {
  const isB2C  = role === "b2c"
  const plans  = getPlans(isB2C)
  const days   = daysLeft(trialEndsAt)
  const unitLabel   = isB2C ? "credits" : "searches"
  const periodLabel = isB2C ? "this month" : "this week"

  return (
    <Dialog open={open} onOpenChange={(o: boolean) => { if (!o) onClose() }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            {used >= limit ? `Limit reached — choose your plan` : "Your Plan"}
          </DialogTitle>
        </DialogHeader>

        {/* Usage banner */}
        <div className="rounded-lg bg-muted/60 px-4 py-3 text-sm flex items-center justify-between">
          <span>
            <span className="font-semibold">{used}</span>
            <span className="text-muted-foreground"> / {limit} {unitLabel} used {periodLabel}</span>
          </span>
          <div className="flex items-center gap-2">
            <Badge variant={subscription === "paid" ? "default" : "secondary"} className="capitalize">
              {subscription === "paid" ? "Pro" : subscription}
            </Badge>
            {subscription === "trial" && days !== null && (
              <span className="text-xs text-muted-foreground">{days} day{days !== 1 ? "s" : ""} left</span>
            )}
          </div>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2">
          {plans.map((plan) => {
            const Icon      = plan.icon
            const isCurrent = plan.key === subscription
            const isExpired = plan.key === "trial" && subscription !== "trial"
            const isUpgrade = plan.key === "paid" && subscription !== "paid"

            return (
              <div
                key={plan.key}
                className={`rounded-xl border p-4 flex flex-col gap-3 transition-all ${
                  isCurrent
                    ? "border-primary bg-primary/5 shadow-sm"
                    : isExpired
                    ? "opacity-50 border-dashed"
                    : "border-border hover:border-muted-foreground/40"
                }`}
              >
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${isCurrent ? "text-primary" : "text-muted-foreground"}`} />
                    <span className="font-semibold text-sm">{plan.label}</span>
                  </div>
                  {isCurrent  && <Badge className="text-[10px] px-1.5 py-0.5">Current</Badge>}
                  {isExpired  && <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">Expired</Badge>}
                </div>

                {/* Limit line */}
                <p className="text-xs text-primary font-medium">{plan.limitLine}</p>

                {/* Price */}
                <div>
                  <span className="text-2xl font-bold">
                    {plan.price === "Free" ? "Free" : plan.price.split(" ")[0]}
                  </span>
                  {plan.price !== "Free" && (
                    <span className="text-xs text-muted-foreground ml-1">
                      {plan.price.split(" ").slice(1).join(" ")}
                    </span>
                  )}
                  {plan.price === "Free" && plan.trialDays && (
                    <span className="text-xs text-muted-foreground ml-1">
                      {plan.trialDays}-day trial
                    </span>
                  )}
                </div>

                {/* Features */}
                <ul className="space-y-1.5 flex-1">
                  {plan.features.map((f) => (
                    <li key={f.text} className="flex items-center gap-2 text-xs">
                      {f.included
                        ? <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
                        : <XCircle    className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                      }
                      <span className={f.included ? "" : "text-muted-foreground/60"}>{f.text}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <div className="mt-auto pt-1">
                  {isCurrent ? (
                    <Button variant="outline" size="sm" className="w-full" disabled>Current plan</Button>
                  ) : isExpired ? (
                    <Button variant="ghost" size="sm" className="w-full" disabled>Trial ended</Button>
                  ) : plan.key === "free" ? (
                    <Button variant="outline" size="sm" className="w-full" onClick={onClose}>
                      Continue with Free
                    </Button>
                  ) : isUpgrade ? (
                    <Button size="sm" className="w-full gap-1.5" disabled>
                      <Sparkles className="h-3.5 w-3.5" />
                      Coming soon
                    </Button>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>

        <p className="text-xs text-muted-foreground text-center pt-1">
          Paid plans coming soon via Stripe.{" "}
          {isB2C ? "Credits reset monthly." : "Searches reset weekly."}
        </p>
      </DialogContent>
    </Dialog>
  )
}
