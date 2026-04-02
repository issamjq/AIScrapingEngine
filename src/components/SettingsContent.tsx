import { useState, useEffect } from "react"
import { updateProfile } from "firebase/auth"
import { useAuth } from "@/context/AuthContext"
import { useTheme } from "@/context/ThemeContext"
import { Switch } from "./ui/switch"
import { Button } from "./ui/button"
import { Badge } from "./ui/badge"
import {
  Settings, User, Shield, CreditCard, BarChart3, Zap,
} from "lucide-react"

const API = import.meta.env.VITE_API_URL || "http://localhost:8080"

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

// ── General ───────────────────────────────────────────────────────
function GeneralTab() {
  const { theme, setTheme } = useTheme()
  const [currency, setCurrency] = useState<"usd" | "aed">(() =>
    (localStorage.getItem("currency") as "usd" | "aed" | null) ?? "usd"
  )

  function handleCurrency(c: "usd" | "aed") {
    localStorage.setItem("currency", c)
    setCurrency(c)
  }

  return (
    <>
      <Section title="Appearance">
        <Row label="Theme" desc="Choose how the interface looks">
          <div className="flex rounded-lg border overflow-hidden text-xs">
            {(["system", "light", "dark"] as const).map(t => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`px-3 py-1.5 capitalize transition-colors ${theme === t ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              >{t}</button>
            ))}
          </div>
        </Row>
      </Section>

      <Section title="Display">
        <Row label="Default currency" desc="Prices will be shown in this currency across the app">
          <div className="flex rounded-lg border overflow-hidden text-xs">
            {(["usd", "aed"] as const).map(c => (
              <button
                key={c}
                onClick={() => handleCurrency(c)}
                className={`px-3 py-1.5 uppercase transition-colors ${currency === c ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              >{c}</button>
            ))}
          </div>
        </Row>
      </Section>
    </>
  )
}

// ── Account ───────────────────────────────────────────────────────
const CONFIRM_PHRASE = "DELETE MY ACCOUNT"

function AccountTab({ role }: { role: string }) {
  const { user, logout } = useAuth()
  const isB2B = role !== "b2c"

  const [nameEdit, setNameEdit]     = useState(false)
  const [nameValue, setNameValue]   = useState(user?.displayName || "")
  const [nameSaving, setNameSaving] = useState(false)
  const [nameError, setNameError]   = useState("")

  const [companyValue, setCompanyValue]   = useState("")
  const [companyEdit, setCompanyEdit]     = useState(false)
  const [companySaving, setCompanySaving] = useState(false)

  const [showDelete, setShowDelete]   = useState(false)
  const [deleteInput, setDeleteInput] = useState("")
  const [deleting, setDeleting]       = useState(false)

  useEffect(() => {
    if (!user || !isB2B) return
    user.getIdToken().then(token =>
      fetch(`${API}/api/allowed-users/me`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(data => { if (data.success) setCompanyValue(data.data?.company_name || "") })
    )
  }, [user, isB2B])

  async function saveName() {
    if (!user) return
    const trimmed = nameValue.trim()
    if (!trimmed) { setNameError("Name cannot be empty"); return }
    setNameSaving(true); setNameError("")
    try {
      await updateProfile(user, { displayName: trimmed })
      const token = await user.getIdToken()
      await fetch(`${API}/api/allowed-users/me`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: trimmed }),
      })
      setNameEdit(false)
    } catch { setNameError("Failed to save. Please try again.") }
    finally { setNameSaving(false) }
  }

  async function saveCompany() {
    if (!user) return
    setCompanySaving(true)
    try {
      const token = await user.getIdToken()
      await fetch(`${API}/api/allowed-users/me`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ company_name: companyValue.trim() }),
      })
      setCompanyEdit(false)
    } finally { setCompanySaving(false) }
  }

  async function deleteAccount() {
    if (!user || deleteInput !== CONFIRM_PHRASE) return
    setDeleting(true)
    try {
      const token = await user.getIdToken()
      await fetch(`${API}/api/allowed-users/me`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } })
      await logout()
    } finally { setDeleting(false) }
  }

  return (
    <>
      <Section title="Profile">
        {/* Display name */}
        <div className="flex items-center justify-between py-4 border-b">
          <div>
            <p className="text-sm font-medium">Display name</p>
            {!nameEdit && <p className="text-xs text-muted-foreground mt-0.5">{user?.displayName || "Not set"}</p>}
            {nameError && <p className="text-xs text-destructive mt-0.5">{nameError}</p>}
          </div>
          <div className="shrink-0 ml-8">
            {nameEdit ? (
              <div className="flex items-center gap-2">
                <input value={nameValue} onChange={e => setNameValue(e.target.value)}
                  className="text-sm border rounded-md px-2 py-1.5 bg-background w-44 focus:outline-none focus:ring-1 focus:ring-ring"
                  autoFocus onKeyDown={e => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setNameEdit(false) }} />
                <Button size="sm" onClick={saveName} disabled={nameSaving}>{nameSaving ? "Saving…" : "Save"}</Button>
                <Button size="sm" variant="ghost" onClick={() => { setNameEdit(false); setNameError("") }}>Cancel</Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => { setNameValue(user?.displayName || ""); setNameEdit(true) }}>Edit</Button>
            )}
          </div>
        </div>

        {/* Company name — B2B only */}
        {isB2B && (
          <div className="flex items-center justify-between py-4 border-b">
            <div>
              <p className="text-sm font-medium">Company name</p>
              {!companyEdit && <p className="text-xs text-muted-foreground mt-0.5">{companyValue || "Not set"}</p>}
            </div>
            <div className="shrink-0 ml-8">
              {companyEdit ? (
                <div className="flex items-center gap-2">
                  <input value={companyValue} onChange={e => setCompanyValue(e.target.value)}
                    className="text-sm border rounded-md px-2 py-1.5 bg-background w-44 focus:outline-none focus:ring-1 focus:ring-ring"
                    autoFocus placeholder="Your company name"
                    onKeyDown={e => { if (e.key === "Enter") saveCompany(); if (e.key === "Escape") setCompanyEdit(false) }} />
                  <Button size="sm" onClick={saveCompany} disabled={companySaving}>{companySaving ? "Saving…" : "Save"}</Button>
                  <Button size="sm" variant="ghost" onClick={() => setCompanyEdit(false)}>Cancel</Button>
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setCompanyEdit(true)}>Edit</Button>
              )}
            </div>
          </div>
        )}

        <Row label="Email address" desc={user?.email || ""}>
          <Badge variant="secondary">Verified</Badge>
        </Row>
        <Row label="Sign-in method" desc="Google OAuth">
          <Badge variant="outline">Google</Badge>
        </Row>
      </Section>

      <Section title="Danger zone">
        <Row label="Delete account" desc="Permanently delete your account and all associated data">
          <Button variant="destructive" size="sm" onClick={() => setShowDelete(true)}>Delete account</Button>
        </Row>
      </Section>

      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-background rounded-xl border shadow-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-semibold text-destructive mb-1">Delete your account</h2>
            <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
              This action is <span className="font-semibold text-foreground">permanent and irreversible</span>. All your data — products, stores, tracked URLs, and activity history — will be permanently erased.
            </p>
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Type the following to confirm:</p>
            <p className="text-sm font-mono font-semibold text-destructive mb-3 select-none">{CONFIRM_PHRASE}</p>
            <input value={deleteInput} onChange={e => setDeleteInput(e.target.value)}
              className="w-full text-sm border rounded-md px-3 py-2 bg-background mb-5 focus:outline-none focus:ring-1 focus:ring-destructive"
              placeholder={CONFIRM_PHRASE} autoFocus />
            <div className="flex gap-3 justify-end">
              <Button variant="outline" size="sm" onClick={() => { setShowDelete(false); setDeleteInput("") }}>Cancel</Button>
              <Button variant="destructive" size="sm" disabled={deleteInput !== CONFIRM_PHRASE || deleting} onClick={deleteAccount}>
                {deleting ? "Deleting…" : "Permanently delete"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── Privacy ───────────────────────────────────────────────────────
function PrivacyTab({ role }: { role: string }) {
  const { user } = useAuth()
  const isB2C = role === "b2c"

  const [analytics,       setAnalytics]       = useState(() => localStorage.getItem("pref_analytics")       !== "false")
  const [personalisation, setPersonalisation] = useState(() => localStorage.getItem("pref_personalisation") !== "false")
  const [exporting, setExporting] = useState(false)

  function toggle(key: string, val: boolean, setter: (v: boolean) => void) {
    localStorage.setItem(key, String(val))
    setter(val)
  }

  async function exportData() {
    if (!user) return
    setExporting(true)
    try {
      const token = await user.getIdToken()
      const res   = await fetch(`${API}/api/export`, { headers: { Authorization: `Bearer ${token}` } })
      const blob  = await res.blob()
      const url   = URL.createObjectURL(blob)
      const a     = document.createElement("a")
      a.href      = url
      a.download  = `aise-export-${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)
    } finally { setExporting(false) }
  }

  return (
    <>
      <Section title="Data & Privacy">
        <Row label="Analytics" desc="Help us improve by sharing anonymous usage data">
          <Switch checked={analytics} onCheckedChange={v => toggle("pref_analytics", v, setAnalytics)} />
        </Row>
        <Row label="Personalisation" desc="Allow the app to remember your preferences">
          <Switch checked={personalisation} onCheckedChange={v => toggle("pref_personalisation", v, setPersonalisation)} />
        </Row>
      </Section>

      <Section title="Data export">
        <Row
          label="Export your data"
          desc={isB2C
            ? "Download a copy of your tracked URLs"
            : "Download a copy of your products, stores, and tracked URLs"}
        >
          <Button variant="outline" size="sm" onClick={exportData} disabled={exporting}>
            {exporting ? "Exporting…" : "Export as JSON"}
          </Button>
        </Row>
      </Section>
    </>
  )
}

// ── Billing ───────────────────────────────────────────────────────
function BillingTab({ role: _role, onNavigate }: { role: string; onNavigate?: (page: string) => void }) {
  const { user } = useAuth()
  const [subscription,    setSubscription]    = useState<string | null>(null)
  const [trialEndsAt,     setTrialEndsAt]     = useState<string | null>(null)
  const [billingRenewsAt, setBillingRenewsAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    user.getIdToken().then(token =>
      fetch(`${API}/api/allowed-users/me`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(data => {
          if (data.success) {
            setSubscription(data.data?.subscription || "free")
            setTrialEndsAt(data.data?.trial_ends_at || null)
            setBillingRenewsAt(data.data?.billing_renews_at || null)
          }
        })
        .finally(() => setLoading(false))
    )
  }, [user])

  const PLAN_LABELS: Record<string, string> = {
    trial: "Trial",
    free:  "Free",
    paid:  "Pro",
    pro:   "Pro",
    dev:   "Developer",
    owner: "Owner",
  }

  function formatDateTime(iso: string) {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    })
  }

  function planEndLabel() {
    if (!subscription) return "—"
    if (subscription === "trial") {
      return trialEndsAt
        ? `Expires ${formatDateTime(trialEndsAt)}`
        : "Trial — no expiry set"
    }
    if (subscription === "free") return "No expiry — free forever"
    if (subscription === "paid" || subscription === "pro") {
      return billingRenewsAt
        ? `Renews ${formatDateTime(billingRenewsAt)}`
        : "Monthly renewal — billing date coming soon"
    }
    return "—"
  }

  const planLabel = PLAN_LABELS[subscription ?? "free"] ?? "Free"
  const isExpired = subscription === "trial" && trialEndsAt && new Date(trialEndsAt) < new Date()

  return (
    <>
      <Section title="Current plan">
        <Row label="Plan" desc="Your active subscription">
          {loading ? (
            <span className="text-sm text-muted-foreground">Loading…</span>
          ) : (
            <div className="flex items-center gap-2">
              <Badge variant={isExpired ? "destructive" : "default"}>{planLabel}</Badge>
              {isExpired && <span className="text-xs text-destructive">Expired</span>}
            </div>
          )}
        </Row>
        <Row label="Plan end date" desc="When your current plan period ends">
          <span className={`text-sm ${isExpired ? "text-destructive font-medium" : "text-muted-foreground"}`}>
            {loading ? "Loading…" : planEndLabel()}
          </span>
        </Row>
        <Row label="Payment method" desc="Manage your payment details">
          <Button variant="outline" size="sm" disabled>Add card</Button>
        </Row>
        {onNavigate && (
          <Row label="Change plan" desc="View available plans and upgrade">
            <Button variant="outline" size="sm" onClick={() => onNavigate("plans")}>View plans</Button>
          </Row>
        )}
      </Section>

      <Section title="Invoices">
        <div className="py-8 text-center text-sm text-muted-foreground">
          No invoices yet. Paid billing coming soon.
        </div>
      </Section>
    </>
  )
}

// ── Usage ─────────────────────────────────────────────────────────
function UsageTab({ role }: { role: string }) {
  const { user } = useAuth()
  const isUnlimited = ["dev", "owner"].includes(role)

  const [balance,    setBalance]    = useState(0)
  const [totalAdded, setTotalAdded] = useState(0)
  const [totalUsed,  setTotalUsed]  = useState(0)
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || isUnlimited) { setLoading(false); return }
    user.getIdToken().then(token =>
      fetch(`${API}/api/wallet`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(data => {
          if (data.success) {
            setBalance(data.data.wallet.balance)
            setTotalAdded(data.data.wallet.total_added)
            setTotalUsed(data.data.wallet.total_used)
            setTransactions(data.data.transactions || [])
          }
        })
        .finally(() => setLoading(false))
    )
  }, [user, isUnlimited])

  const pct    = totalAdded > 0 ? Math.round((balance / totalAdded) * 100) : 0
  const r      = 20
  const circ   = 2 * Math.PI * r
  const offset = circ * (1 - pct / 100)

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString(undefined, {
      month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    })
  }

  return (
    <>
      <Section title="Credits">
        {isUnlimited ? (
          <div className="py-5 flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">Unlimited credits</p>
              <p className="text-xs text-muted-foreground mt-0.5">Your account has no usage limits</p>
            </div>
          </div>
        ) : loading ? (
          <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>
        ) : (
          <div className="py-5 flex items-center gap-6">
            <div className="relative shrink-0" style={{ width: 56, height: 56 }}>
              <svg width="56" height="56" style={{ display: "block", transform: "rotate(-90deg)" }}>
                <circle cx="28" cy="28" r={r} fill="none" stroke="#e5e7eb" strokeWidth="3" />
                <circle cx="28" cy="28" r={r} fill="none" stroke="#EAB308" strokeWidth="3"
                  strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
                  style={{ transition: "stroke-dashoffset 0.5s ease" }} />
              </svg>
              <span style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}
                className="text-[11px] font-bold text-yellow-500 leading-none">{pct}%</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">{balance} credits remaining</p>
              <p className="text-xs text-muted-foreground mt-0.5">{totalUsed} used of {totalAdded} total</p>
              <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-yellow-500 transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <Button variant="outline" size="sm" disabled>Top up</Button>
          </div>
        )}
      </Section>

      <Section title="Recent transactions">
        {loading ? (
          <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>
        ) : isUnlimited ? (
          <div className="py-6 text-center text-sm text-muted-foreground">No transaction history for unlimited accounts.</div>
        ) : transactions.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">No transactions yet.</div>
        ) : (
          <div className="divide-y">
            {transactions.map((tx, i) => (
              <div key={i} className="flex items-center justify-between py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{tx.description || tx.type}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{formatDate(tx.created_at)}</p>
                </div>
                <div className="flex items-center gap-4 shrink-0 ml-4">
                  <span className={`text-sm font-semibold ${tx.amount > 0 ? "text-green-600" : "text-destructive"}`}>
                    {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                  </span>
                  <span className="text-xs text-muted-foreground w-20 text-right">bal: {tx.balance_after}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </>
  )
}

// ── Capabilities ──────────────────────────────────────────────────
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

// ── Main ──────────────────────────────────────────────────────────
export function SettingsContent({ role = "b2b", onNavigate }: { role?: string; onNavigate?: (page: string) => void }) {
  const [active, setActive] = useState<Tab>("general")

  function renderTab() {
    switch (active) {
      case "general":      return <GeneralTab />
      case "account":      return <AccountTab role={role} />
      case "privacy":      return <PrivacyTab role={role} />
      case "billing":      return <BillingTab role={role} onNavigate={onNavigate} />
      case "usage":        return <UsageTab role={role} />
      case "capabilities": return <CapabilitiesTab />
    }
  }

  return (
    <div className="flex -m-4 sm:-m-6 min-h-[calc(100vh-56px)]">
      <aside className="w-60 shrink-0 border-r pt-10 pl-8 pr-4 bg-background">
        <p className="text-2xl font-bold mb-8 px-2">Settings</p>
        <nav className="space-y-0.5">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActive(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-left ${
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

      <main className="flex-1 px-12 py-10 overflow-y-auto">
        <h1 className="text-2xl font-semibold mb-8 capitalize">{active}</h1>
        {renderTab()}
      </main>
    </div>
  )
}
