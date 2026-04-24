/**
 * UserDetailSheet — click any user row in the admin dashboard → slides in a
 * right-side sheet with that user's full profile, credits, activity, searches,
 * rate-limit hits, audit trail, and errors. Removes the need to SQL into Neon.
 */

import { useEffect, useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "./ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs"
import { Badge } from "./ui/badge"
import { useAuth } from "@/context/AuthContext"
import { Loader2, User, Wallet, Activity, Search as SearchIcon, Siren, ScrollText, Bug, MapPin, Calendar, Clock } from "lucide-react"

const API = import.meta.env.VITE_API_URL || "http://localhost:8080"

interface Props {
  email: string | null
  open:  boolean
  onOpenChange: (v: boolean) => void
}

interface Detail {
  profile: any
  wallet:  any
  summary: {
    total_searches: number; total_actions: number; total_credits_used: number; actions_7d: number
  }
  transactions:    any[]
  activity:        any[]
  searches:        any[]
  rate_limit_hits: any[]
  audit_events:    any[]
  errors:          any[]
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
}
function flagOf(code: string | null | undefined): string {
  if (!code || code.length !== 2) return ""
  const A = 0x1F1E6
  const base = "A".charCodeAt(0)
  return String.fromCodePoint(
    A + code.toUpperCase().charCodeAt(0) - base,
    A + code.toUpperCase().charCodeAt(1) - base,
  )
}

export function UserDetailSheet({ email, open, onOpenChange }: Props) {
  const { user } = useAuth()
  const [data, setData] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !email || !user) { setData(null); return }
    let cancelled = false
    setLoading(true); setErr(null)
    ;(async () => {
      try {
        const token = await user.getIdToken()
        const r = await fetch(`${API}/api/admin/user/${encodeURIComponent(email)}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!r.ok) throw new Error(`${r.status}`)
        const j = await r.json()
        if (!cancelled) setData(j.data)
      } catch (e: any) {
        if (!cancelled) setErr(e.message || "Failed to load")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [open, email, user])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto p-0">
        <SheetHeader className="border-b px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-base truncate">{email}</SheetTitle>
              <SheetDescription className="text-xs">
                {loading ? "Loading..." : err ? <span className="text-destructive">Failed: {err}</span> : "Full user profile"}
              </SheetDescription>
            </div>
            {data?.profile && (
              <div className="flex items-center gap-1.5 shrink-0 text-[11px]">
                <Badge variant="outline">{data.profile.role ?? "—"}</Badge>
                {data.profile.plan_code && <Badge variant="secondary">{data.profile.plan_code}</Badge>}
                <Badge
                  variant={data.profile.subscription === "paid" ? "default" : data.profile.subscription === "trial" ? "secondary" : "outline"}
                >
                  {data.profile.subscription}
                </Badge>
              </div>
            )}
          </div>
        </SheetHeader>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {data && (
          <div className="px-5 py-4">
            {/* Summary strip */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              <SummaryCell icon={SearchIcon}  label="Searches" value={fmt(data.summary.total_searches)} />
              <SummaryCell icon={Activity}    label="Actions"  value={fmt(data.summary.total_actions)} sub={`${data.summary.actions_7d} in 7d`} />
              <SummaryCell icon={Wallet}      label="Credits used" value={fmt(data.summary.total_credits_used)} />
              <SummaryCell icon={Clock}       label="Last seen" value={data.profile.last_seen_at ? fmtDate(data.profile.last_seen_at) : "—"} small />
            </div>

            <Tabs defaultValue="profile" className="w-full">
              <TabsList className="w-full grid grid-cols-6 h-9">
                <TabsTrigger value="profile"  className="text-xs"><User className="h-3 w-3 mr-1" />Profile</TabsTrigger>
                <TabsTrigger value="wallet"   className="text-xs"><Wallet className="h-3 w-3 mr-1" />Wallet</TabsTrigger>
                <TabsTrigger value="activity" className="text-xs"><Activity className="h-3 w-3 mr-1" />Activity</TabsTrigger>
                <TabsTrigger value="searches" className="text-xs"><SearchIcon className="h-3 w-3 mr-1" />Searches</TabsTrigger>
                <TabsTrigger value="limits"   className="text-xs"><Siren className="h-3 w-3 mr-1" />Limits</TabsTrigger>
                <TabsTrigger value="audit"    className="text-xs"><ScrollText className="h-3 w-3 mr-1" />Audit</TabsTrigger>
              </TabsList>

              {/* Profile */}
              <TabsContent value="profile" className="mt-4 space-y-3">
                <Row label="Name"      value={data.profile.name ?? "—"} />
                <Row label="Company"   value={data.profile.company_name ?? "—"} />
                <Row label="Role"      value={data.profile.role ?? "—"} />
                <Row label="Plan"      value={`${data.profile.plan_code ?? "—"} · ${data.profile.billing_interval ?? "—"}`} />
                <Row label="Signed up" value={fmtDate(data.profile.created_at)} />
                {data.profile.trial_ends_at && <Row label="Trial ends" value={fmtDate(data.profile.trial_ends_at)} />}
                {data.profile.billing_renews_at && <Row label="Renews" value={fmtDate(data.profile.billing_renews_at)} />}
                <Row
                  label="Location"
                  value={(
                    <span className="flex items-center gap-1.5">
                      {data.profile.signup_country_code && <span>{flagOf(data.profile.signup_country_code)}</span>}
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      {[data.profile.signup_city, data.profile.signup_region, data.profile.signup_country].filter(Boolean).join(", ") || "Unknown"}
                    </span>
                  )}
                />
                <Row label="Signup IP"  value={<code className="text-[10px]">{data.profile.signup_ip ?? "—"}</code>} />
                <Row label="Last IP"    value={<code className="text-[10px]">{data.profile.last_seen_ip ?? "—"}</code>} />
                <Row label="Firebase UID" value={<code className="text-[10px] break-all">{data.profile.firebase_uid ?? "—"}</code>} />
                {(data.profile.utm_source || data.profile.utm_medium || data.profile.utm_campaign) && (
                  <Row label="Attribution" value={`${data.profile.utm_source ?? ""}${data.profile.utm_medium ? " · " + data.profile.utm_medium : ""}${data.profile.utm_campaign ? " · " + data.profile.utm_campaign : ""}`} />
                )}
                {data.profile.referrer && <Row label="Referrer" value={<code className="text-[10px] truncate">{data.profile.referrer}</code>} />}
              </TabsContent>

              {/* Wallet */}
              <TabsContent value="wallet" className="mt-4 space-y-3">
                {!data.wallet ? (
                  <p className="text-xs text-muted-foreground">No wallet record.</p>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      <Stat label="Balance"     value={fmt(data.wallet.balance)} />
                      <Stat label="Used (cycle)" value={`${fmt(data.wallet.credits_used_this_cycle)} / ${fmt(data.wallet.monthly_limit ?? 0)}`} />
                      <Stat label="Lifetime used" value={fmt(data.wallet.total_used)} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Stat label="Today"   value={`${fmt(data.wallet.credits_used_today)} / ${fmt(data.wallet.daily_limit ?? 0)}`} small />
                      <Stat label="Week"    value={`${fmt(data.wallet.credits_used_this_week)} / ${fmt(data.wallet.weekly_limit ?? 0)}`} small />
                    </div>
                    <div className="text-[11px] font-medium mt-4">Transactions (last 30)</div>
                    <div className="divide-y border rounded-md max-h-64 overflow-y-auto">
                      {data.transactions.length === 0 ? (
                        <p className="text-xs text-muted-foreground p-3">No transactions.</p>
                      ) : data.transactions.map(t => (
                        <div key={t.id} className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs">
                          <span className={`font-bold ${t.amount > 0 ? "text-emerald-600" : "text-red-500"}`}>
                            {t.amount > 0 ? "+" : ""}{t.amount}
                          </span>
                          <span className="flex-1 truncate text-muted-foreground">{t.description ?? t.type}</span>
                          <span className="text-[10px] text-muted-foreground shrink-0">{fmtDate(t.created_at)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </TabsContent>

              {/* Activity */}
              <TabsContent value="activity" className="mt-4">
                <div className="divide-y border rounded-md max-h-96 overflow-y-auto">
                  {data.activity.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-3">No activity yet.</p>
                  ) : data.activity.map(a => (
                    <div key={a.id} className="px-3 py-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="outline" className="text-[10px] px-1 py-0">{a.action}</Badge>
                        <span className="text-[10px] text-muted-foreground">{fmtDate(a.created_at)}</span>
                      </div>
                      {a.details && Object.keys(a.details).length > 0 && (
                        <code className="text-[10px] text-muted-foreground block mt-1 truncate">
                          {JSON.stringify(a.details).slice(0, 140)}
                        </code>
                      )}
                    </div>
                  ))}
                </div>
              </TabsContent>

              {/* Searches */}
              <TabsContent value="searches" className="mt-4">
                <div className="divide-y border rounded-md max-h-96 overflow-y-auto">
                  {data.searches.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-3">No searches.</p>
                  ) : data.searches.map(s => {
                    const results = typeof s.results === "string"
                      ? (() => { try { return JSON.parse(s.results) } catch { return [] } })()
                      : (s.results ?? [])
                    return (
                      <div key={s.id} className="px-3 py-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium truncate flex-1">{s.query}</span>
                          <Badge variant="outline" className="text-[10px] shrink-0">{s.batch ?? "quick"}</Badge>
                          <span className="text-[10px] text-muted-foreground shrink-0">{fmtDate(s.searched_at)}</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {Array.isArray(results) ? `${results.length} results` : "—"}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </TabsContent>

              {/* Rate-limit hits */}
              <TabsContent value="limits" className="mt-4">
                <div className="divide-y border rounded-md max-h-96 overflow-y-auto">
                  {data.rate_limit_hits.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-3">No limit hits — clean record.</p>
                  ) : data.rate_limit_hits.map(r => (
                    <div key={r.id} className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs">
                      <Badge variant="destructive" className="text-[10px]">{r.limit_type}</Badge>
                      <code className="text-[10px] text-muted-foreground truncate flex-1">{r.route}</code>
                      <span className="text-[10px] text-muted-foreground shrink-0">{fmtDate(r.created_at)}</span>
                    </div>
                  ))}
                </div>
              </TabsContent>

              {/* Audit + errors */}
              <TabsContent value="audit" className="mt-4 space-y-4">
                <div>
                  <div className="text-[11px] font-medium mb-1.5">Admin actions on this user</div>
                  <div className="divide-y border rounded-md">
                    {data.audit_events.length === 0 ? (
                      <p className="text-xs text-muted-foreground p-3">None.</p>
                    ) : data.audit_events.map(a => (
                      <div key={a.id} className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs">
                        <Badge variant="outline" className="text-[10px]">{a.action}</Badge>
                        <span className="truncate text-muted-foreground flex-1">by {a.actor_email}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">{fmtDate(a.created_at)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-medium mb-1.5 flex items-center gap-1">
                    <Bug className="h-3 w-3" /> Errors for this user
                  </div>
                  <div className="divide-y border rounded-md">
                    {data.errors.length === 0 ? (
                      <p className="text-xs text-muted-foreground p-3">No errors — clean.</p>
                    ) : data.errors.map(e => (
                      <div key={e.id} className="px-3 py-1.5 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="destructive" className="text-[10px]">{e.status ?? e.level}</Badge>
                          <code className="text-[10px] text-muted-foreground truncate flex-1">{e.path}</code>
                          <span className="text-[10px] text-muted-foreground shrink-0">{fmtDate(e.created_at)}</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{e.message}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>

            </Tabs>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function SummaryCell({ icon: Icon, label, value, sub, small }: { icon: any; label: string; value: string; sub?: string; small?: boolean }) {
  return (
    <div className="p-2.5 rounded-md bg-muted/40 border">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className={`font-bold mt-0.5 ${small ? "text-xs" : "text-lg"}`}>{value}</div>
      {sub && <div className="text-[9px] text-muted-foreground">{sub}</div>}
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-xs py-1 border-b last:border-0">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-right min-w-0">{value}</span>
    </div>
  )
}

function Stat({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="p-2 rounded-md bg-muted/40 border text-center">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={`font-bold ${small ? "text-sm" : "text-base"} mt-0.5`}>{value}</div>
    </div>
  )
}
