import { useState } from "react"
import { useAuth } from "@/context/AuthContext"
import { Switch } from "./ui/switch"
import { Button } from "./ui/button"
import { Badge } from "./ui/badge"
import {
  Settings, User, Shield, CreditCard, BarChart3, Zap,
} from "lucide-react"

type Tab = "general" | "account" | "privacy" | "billing" | "usage" | "capabilities"

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "general",      label: "General",      icon: Settings   },
  { id: "account",      label: "Account",      icon: User       },
  { id: "privacy",      label: "Privacy",      icon: Shield     },
  { id: "billing",      label: "Billing",      icon: CreditCard },
  { id: "usage",        label: "Usage",        icon: BarChart3  },
  { id: "capabilities", label: "Capabilities", icon: Zap        },
]

function Row({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-4 border-b last:border-0">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {desc && <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>}
      </div>
      <div className="shrink-0 ml-8">{children}</div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="text-base font-semibold mb-1">{title}</h2>
      <div className="rounded-xl border bg-card divide-y overflow-hidden px-4">
        {children}
      </div>
    </div>
  )
}

function GeneralTab() {
  const [theme, setTheme]       = useState<"system" | "light" | "dark">("system")
  const [language, setLanguage] = useState("English")

  return (
    <>
      <Section title="Appearance">
        <Row label="Theme" desc="Choose how the interface looks">
          <div className="flex rounded-lg border overflow-hidden text-xs">
            {(["system","light","dark"] as const).map(t => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`px-3 py-1.5 capitalize transition-colors ${theme === t ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              >{t}</button>
            ))}
          </div>
        </Row>
        <Row label="Language" desc="Interface display language">
          <select
            value={language}
            onChange={e => setLanguage(e.target.value)}
            className="text-sm border rounded-md px-2 py-1.5 bg-background"
          >
            <option>English</option>
            <option>Arabic</option>
            <option>French</option>
          </select>
        </Row>
      </Section>

      <Section title="Notifications">
        <Row label="Email summaries" desc="Receive a weekly summary of activity">
          <Switch />
        </Row>
        <Row label="Product updates" desc="News and feature announcements">
          <Switch defaultChecked />
        </Row>
      </Section>
    </>
  )
}

function AccountTab() {
  const { user } = useAuth()
  return (
    <>
      <Section title="Profile">
        <Row label="Display name" desc={user?.displayName || "Not set"}>
          <Button variant="outline" size="sm" disabled>Edit</Button>
        </Row>
        <Row label="Email address" desc={user?.email || ""}>
          <Badge variant="secondary">Verified</Badge>
        </Row>
        <Row label="Sign-in method" desc="Google OAuth">
          <Badge variant="outline">Google</Badge>
        </Row>
      </Section>

      <Section title="Danger zone">
        <Row label="Delete account" desc="Permanently delete your account and all data">
          <Button variant="destructive" size="sm" disabled>Delete account</Button>
        </Row>
      </Section>
    </>
  )
}

function PrivacyTab() {
  return (
    <>
      <Section title="Data & Privacy">
        <Row label="Analytics" desc="Help us improve by sharing anonymous usage data">
          <Switch defaultChecked />
        </Row>
        <Row label="Personalisation" desc="Allow the app to remember your preferences">
          <Switch defaultChecked />
        </Row>
        <Row label="Marketing cookies" desc="Used for targeted promotions">
          <Switch />
        </Row>
      </Section>

      <Section title="Data export">
        <Row label="Export your data" desc="Download a copy of all your data">
          <Button variant="outline" size="sm" disabled>Request export</Button>
        </Row>
      </Section>
    </>
  )
}

function BillingTab() {
  return (
    <>
      <Section title="Current plan">
        <Row label="Plan" desc="Your active subscription">
          <Badge>Pro</Badge>
        </Row>
        <Row label="Next billing date" desc="Your plan renews automatically">
          <span className="text-sm text-muted-foreground">Coming soon</span>
        </Row>
        <Row label="Payment method" desc="Manage your payment details">
          <Button variant="outline" size="sm" disabled>Add card</Button>
        </Row>
      </Section>

      <Section title="Invoices">
        <div className="py-8 text-center text-sm text-muted-foreground">
          No invoices yet. Paid billing coming soon.
        </div>
      </Section>
    </>
  )
}

function UsageTab() {
  const balance    = 50
  const totalAdded = 150
  const used       = totalAdded - balance
  const pct        = Math.round((balance / totalAdded) * 100)
  const r          = 20
  const circ       = 2 * Math.PI * r
  const offset     = circ * (1 - pct / 100)

  return (
    <>
      <Section title="Credits">
        <div className="py-5 flex items-center gap-6">
          {/* Ring */}
          <div className="relative shrink-0" style={{ width: 56, height: 56 }}>
            <svg width="56" height="56" style={{ display: "block", transform: "rotate(-90deg)" }}>
              <circle cx="28" cy="28" r={r} fill="none" stroke="#e5e7eb" strokeWidth="3" />
              <circle
                cx="28" cy="28" r={r} fill="none"
                stroke="#EAB308" strokeWidth="3" strokeLinecap="round"
                strokeDasharray={circ} strokeDashoffset={offset}
                style={{ transition: "stroke-dashoffset 0.5s ease" }}
              />
            </svg>
            <span
              style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}
              className="text-[11px] font-bold text-yellow-500 leading-none"
            >{pct}%</span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">{balance} credits remaining</p>
            <p className="text-xs text-muted-foreground mt-0.5">{used} used of {totalAdded} total</p>
            {/* Bar */}
            <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-yellow-500 transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <Button variant="outline" size="sm" disabled>Top up</Button>
        </div>
      </Section>

      <Section title="Recent transactions">
        <div className="py-8 text-center text-sm text-muted-foreground">
          Transaction history coming soon.
        </div>
      </Section>
    </>
  )
}

function CapabilitiesTab() {
  return (
    <>
      <Section title="AI Features">
        <Row label="AI Market Discovery" desc="Use Claude web search to find product URLs">
          <Switch defaultChecked />
        </Row>
        <Row label="Auto-match results" desc="Automatically match discovered URLs to your catalog">
          <Switch defaultChecked />
        </Row>
        <Row label="Vision price extraction" desc="Use AI to extract prices from screenshots">
          <Switch defaultChecked />
        </Row>
      </Section>

      <Section title="Search">
        <Row label="Blur free-plan results" desc="Show blurred results beyond your plan limit">
          <Switch defaultChecked />
        </Row>
        <Row label="Save search history" desc="Remember recent queries for quick access">
          <Switch />
        </Row>
      </Section>
    </>
  )
}

const TAB_CONTENT: Record<Tab, React.ReactNode> = {
  general:      <GeneralTab />,
  account:      <AccountTab />,
  privacy:      <PrivacyTab />,
  billing:      <BillingTab />,
  usage:        <UsageTab />,
  capabilities: <CapabilitiesTab />,
}

export function SettingsContent() {
  const [active, setActive] = useState<Tab>("general")

  return (
    <div className="flex min-h-full">
      {/* Left nav */}
      <aside className="w-52 shrink-0 border-r pr-2 pt-8 pl-4">
        <p className="text-xl font-bold mb-6 px-2">Settings</p>
        <nav className="space-y-0.5">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActive(id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                active === id
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Content */}
      <main className="flex-1 px-10 py-8 max-w-2xl">
        <h1 className="text-xl font-semibold mb-6 capitalize">{active}</h1>
        {TAB_CONTENT[active]}
      </main>
    </div>
  )
}
