import { useState } from "react"
import { useAuth } from "@/context/AuthContext"
import { Building2, User, BarChart3, ArrowRight, CheckCircle2 } from "lucide-react"
import { Button } from "./ui/button"

const API = import.meta.env.VITE_API_URL || "http://localhost:8080"

interface Props {
  onComplete: () => void
}

type Role = "b2b" | "b2c"

export function OnboardingContent({ onComplete }: Props) {
  const { user } = useAuth()
  const [selected, setSelected] = useState<Role | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleContinue = async () => {
    if (!selected || !user) return
    setSaving(true)
    setError(null)
    try {
      const token = await user.getIdToken()
      const res = await fetch(`${API}/api/allowed-users/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          role: selected,
          name: user.displayName || user.email,
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

  const options: { role: Role; icon: typeof Building2; title: string; desc: string; bullets: string[] }[] = [
    {
      role: "b2b",
      icon: Building2,
      title: "For My Business",
      desc: "I represent a company tracking competitor prices",
      bullets: [
        "Monitor prices across UAE retailers",
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
        "Get alerts when prices drop",
        "Compare prices across stores",
        "7-day full trial",
      ],
    },
  ]

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      {/* Logo */}
      <div className="flex items-center gap-2 mb-10">
        <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
          <BarChart3 className="h-5 w-5 text-primary-foreground" />
        </div>
        <span className="text-xl font-bold">AI Scraping Engine</span>
      </div>

      {/* Heading */}
      <div className="text-center mb-8 max-w-md">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">How will you use it?</h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Choose your account type to get started. You can always upgrade later.
        </p>
      </div>

      {/* Cards */}
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

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive text-center max-w-md w-full">
          {error}
        </div>
      )}

      {/* CTA */}
      <Button
        onClick={handleContinue}
        disabled={!selected || saving}
        className="w-full max-w-xs h-12 text-sm font-medium gap-2"
      >
        {saving ? (
          <>
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Setting up your account…
          </>
        ) : (
          <>
            Start Free Trial
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </Button>

      <p className="mt-4 text-xs text-muted-foreground text-center max-w-xs leading-relaxed">
        No credit card required. Your trial includes full access with no restrictions.
      </p>
    </div>
  )
}
