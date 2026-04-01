import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog"
import { Button } from "./ui/button"
import { Badge } from "./ui/badge"
import { CheckCircle, XCircle, Sparkles, Zap, Crown, type LucideIcon } from "lucide-react"

interface PlansModalProps {
  open:         boolean
  onClose:      () => void
  subscription: string   // 'trial' | 'free' | 'paid'
  role:         string   // '010' B2B | '020' B2C | other
  used:         number
  limit:        number
  trialEndsAt?: string | null
}

const IS_B2B = (role: string) => role === "b2b"

interface PlanDef {
  key:         string
  label:       string
  icon:        LucideIcon
  searches:    number
  trialDays?:  number
  price:       string
  features:    { text: string; included: boolean }[]
}

function getPlans(isB2B: boolean): PlanDef[] {
  return [
    {
      key:       "trial",
      label:     "Trial",
      icon:      Zap,
      searches:  20,
      trialDays: isB2B ? 14 : 7,
      price:     "Free",
      features: [
        { text: "20 searches/week",                     included: true  },
        { text: `${isB2B ? 14 : 7}-day trial`,          included: true  },
        { text: "All results visible — no blur",         included: true  },
        { text: "AI Discovery",                          included: true  },
        { text: "AI Product Matching",                   included: true  },
        { text: "Price Tracking",                        included: true  },
        { text: "Export Data",                           included: false },
        { text: "Priority Support",                      included: false },
      ],
    },
    {
      key:      "free",
      label:    "Free",
      icon:     CheckCircle,
      searches: 10,
      price:    "$0 / month",
      features: [
        { text: "10 searches/week",                     included: true  },
        { text: "Unlimited time",                       included: true  },
        { text: "3 results per retailer (rest blurred)", included: true  },
        { text: "AI Discovery",                          included: true  },
        { text: "AI Product Matching",                   included: true  },
        { text: "Price Tracking",                        included: true  },
        { text: "Export Data",                           included: false },
        { text: "Priority Support",                      included: false },
      ],
    },
    {
      key:      "paid",
      label:    "Paid",
      icon:     Crown,
      searches: 50,
      price:    "$20 / month",
      features: [
        { text: "50 searches/week",                     included: true  },
        { text: "Unlimited time",                       included: true  },
        { text: "All results visible — no blur",         included: true  },
        { text: "AI Discovery",                          included: true  },
        { text: "AI Product Matching",                   included: true  },
        { text: "Price Tracking",                        included: true  },
        { text: "Export Data",                           included: true  },
        { text: "Priority Support",                      included: true  },
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
  const isB2B = IS_B2B(role)
  const plans = getPlans(isB2B)
  const days  = daysLeft(trialEndsAt)

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            {used >= limit ? "Daily limit reached — choose your plan" : "Your Plan"}
          </DialogTitle>
        </DialogHeader>

        {/* Usage banner */}
        <div className="rounded-lg bg-muted/60 px-4 py-3 text-sm flex items-center justify-between">
          <span>
            <span className="font-semibold">{used}</span>
            <span className="text-muted-foreground"> / {limit} searches used today</span>
          </span>
          <div className="flex items-center gap-2">
            <Badge variant={subscription === "paid" ? "default" : "secondary"} className="capitalize">
              {subscription}
            </Badge>
            {subscription === "trial" && days !== null && (
              <span className="text-xs text-muted-foreground">{days} day{days !== 1 ? "s" : ""} left</span>
            )}
          </div>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2">
          {plans.map((plan) => {
            const Icon       = plan.icon
            const isCurrent  = plan.key === subscription
            const isExpired  = plan.key === "trial" && subscription !== "trial"
            const isUpgrade  = plan.key === "paid" && subscription !== "paid"

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
                  {isCurrent && <Badge className="text-[10px] px-1.5 py-0.5">Current</Badge>}
                  {isExpired  && <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">Expired</Badge>}
                </div>

                {/* Price */}
                <div>
                  <span className="text-2xl font-bold">
                    {plan.price === "Contact us" ? "" : plan.price.split(" ")[0]}
                  </span>
                  {plan.price !== "Contact us" && plan.price !== "Free" && (
                    <span className="text-xs text-muted-foreground ml-1">
                      {plan.price.split(" ").slice(1).join(" ")}
                    </span>
                  )}
                  {plan.price === "Contact us" && (
                    <span className="text-sm font-medium text-primary">Contact us</span>
                  )}
                  {plan.price === "Free" && (
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
                  ) : plan.key === "paid" ? (
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
          Paid plans coming soon. Limits reset daily at midnight UTC.
        </p>
      </DialogContent>
    </Dialog>
  )
}
