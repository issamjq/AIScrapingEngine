/**
 * SuperAdminTab — user management for the owner (mhmdkrissaty) and the dev
 * (issa.mjq). Sits inside the User Portal.
 *
 * Shows every allowed_user with email, name, role, country, last seen, etc.
 * Per-row actions: block / unblock, change role, change subscription, reset
 * TOTP, delete. Every action goes through /api/admin/super/* which logs to
 * admin_audit_log on the backend.
 */

import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@/context/AuthContext"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card"
import { Badge } from "./ui/badge"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "./ui/dialog"
import {
  Loader2, Search, ShieldOff, ShieldCheck, RefreshCw,
  Trash2, KeyRound, AlertTriangle, Crown, Wrench, User as UserIcon,
} from "lucide-react"

const API = (import.meta.env.VITE_API_URL || "http://localhost:8080").replace(/\/+$/, "")

interface SuperUser {
  email:               string
  name:                string | null
  company_name:        string | null
  role:                string
  subscription:        string
  plan_code:           string | null
  billing_interval:    string | null
  is_active:           boolean
  signup_country:      string | null
  signup_country_code: string | null
  signup_city:         string | null
  trial_ends_at:       string | null
  billing_renews_at:   string | null
  last_seen_at:        string | null
  totp_required:       boolean
  totp_enrolled:       boolean
  firebase_uid:        string | null
  signup_ip:           string | null
  created_at:          string
}

const ROLE_OPTIONS = ["b2b", "b2c", "admin", "dev", "owner"] as const
const SUB_OPTIONS  = ["free", "trial", "paid"] as const

function flagOf(code: string | null | undefined): string {
  if (!code || code.length !== 2) return ""
  const A = 0x1F1E6
  const base = "A".charCodeAt(0)
  return String.fromCodePoint(
    A + code.toUpperCase().charCodeAt(0) - base,
    A + code.toUpperCase().charCodeAt(1) - base,
  )
}

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—"
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1)  return "just now"
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function roleBadge(role: string) {
  switch (role) {
    case "owner": return { Icon: Crown,    cls: "bg-amber-100 text-amber-800 border-amber-300" }
    case "dev":   return { Icon: Wrench,   cls: "bg-purple-100 text-purple-800 border-purple-300" }
    case "admin": return { Icon: ShieldCheck, cls: "bg-blue-100 text-blue-800 border-blue-300" }
    default:      return { Icon: UserIcon, cls: "bg-slate-100 text-slate-700 border-slate-300" }
  }
}

export function SuperAdminTab() {
  const { user } = useAuth()
  const [users, setUsers]     = useState<SuperUser[]>([])
  const [total, setTotal]     = useState(0)
  const [loading, setLoading] = useState(true)
  const [err, setErr]         = useState<string | null>(null)
  const [search, setSearch]   = useState("")
  const [roleFilter, setRoleFilter] = useState<string>("")
  const [subFilter,  setSubFilter]  = useState<string>("")
  const [activeFilter, setActiveFilter] = useState<"" | "true" | "false">("")
  const [busyEmail, setBusyEmail] = useState<string | null>(null)

  // Confirm-delete modal state
  const [confirm, setConfirm] = useState<{ email: string; action: "delete" | "reset_totp" } | null>(null)

  // Whoami — needed so we can disable self-modification UI
  const myEmail = user?.email ?? ""

  async function load() {
    if (!user) return
    setLoading(true); setErr(null)
    try {
      const token = await user.getIdToken()
      const params = new URLSearchParams()
      if (search.trim()) params.set("q", search.trim())
      if (roleFilter)    params.set("role", roleFilter)
      if (subFilter)     params.set("subscription", subFilter)
      if (activeFilter)  params.set("active", activeFilter)
      const r = await fetch(`${API}/api/admin/super/users?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const j = await r.json()
      setUsers(j.data?.users ?? [])
      setTotal(j.data?.total ?? 0)
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [user, roleFilter, subFilter, activeFilter])

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => load(), 350)
    return () => clearTimeout(t)
  }, [search])

  async function patch(email: string, body: any) {
    if (!user) return
    setBusyEmail(email)
    try {
      const token = await user.getIdToken()
      const r = await fetch(`${API}/api/admin/super/users/${encodeURIComponent(email)}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify(body),
      })
      const j = await r.json()
      if (!r.ok || !j.success) throw new Error(j.error || `HTTP ${r.status}`)
      await load()
    } catch (e: any) {
      alert(`Failed: ${e.message}`)
    } finally { setBusyEmail(null) }
  }

  async function destroy(email: string) {
    if (!user) return
    setBusyEmail(email)
    try {
      const token = await user.getIdToken()
      const r = await fetch(`${API}/api/admin/super/users/${encodeURIComponent(email)}`, {
        method:  "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
      const j = await r.json()
      if (!r.ok || !j.success) throw new Error(j.error || `HTTP ${r.status}`)
      await load()
    } catch (e: any) {
      alert(`Failed: ${e.message}`)
    } finally { setBusyEmail(null); setConfirm(null) }
  }

  async function resetTotp(email: string) {
    if (!user) return
    setBusyEmail(email)
    try {
      const token = await user.getIdToken()
      const r = await fetch(`${API}/api/admin/super/users/${encodeURIComponent(email)}/reset-totp`, {
        method:  "POST",
        headers: { Authorization: `Bearer ${token}` },
      })
      const j = await r.json()
      if (!r.ok || !j.success) throw new Error(j.error || `HTTP ${r.status}`)
      await load()
    } catch (e: any) {
      alert(`Failed: ${e.message}`)
    } finally { setBusyEmail(null); setConfirm(null) }
  }

  const summary = useMemo(() => {
    const counts: Record<string, number> = { owner: 0, dev: 0, admin: 0, b2b: 0, b2c: 0, blocked: 0 }
    for (const u of users) {
      counts[u.role] = (counts[u.role] || 0) + 1
      if (!u.is_active) counts.blocked++
    }
    return counts
  }, [users])

  return (
    <div className="space-y-4">

      {/* Header + filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Crown className="h-4 w-4 text-amber-500" />
            Super Admin · User Management
          </CardTitle>
          <CardDescription className="text-xs">
            {total} users · {summary.owner ?? 0} owner · {summary.dev ?? 0} dev · {summary.admin ?? 0} admin · {summary.b2b ?? 0} b2b · {summary.b2c ?? 0} b2c · {summary.blocked ?? 0} blocked
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                placeholder="Search email, name, company..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-md border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>
            <select
              value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
              className="text-xs rounded-md border bg-background px-2 py-1.5"
            >
              <option value="">All roles</option>
              {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <select
              value={subFilter} onChange={e => setSubFilter(e.target.value)}
              className="text-xs rounded-md border bg-background px-2 py-1.5"
            >
              <option value="">All subs</option>
              {SUB_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select
              value={activeFilter} onChange={e => setActiveFilter(e.target.value as any)}
              className="text-xs rounded-md border bg-background px-2 py-1.5"
            >
              <option value="">All</option>
              <option value="true">Active only</option>
              <option value="false">Blocked only</option>
            </select>
            <button
              onClick={load}
              disabled={loading}
              className="text-xs inline-flex items-center gap-1 rounded-md border bg-background px-2.5 py-1.5 hover:bg-muted/50"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </CardContent>
      </Card>

      {err && (
        <div className="rounded-md bg-red-50 border border-red-200 p-2.5 text-red-900 text-xs flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          {err}
        </div>
      )}

      {/* Users table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[920px]">
              <thead>
                <tr className="bg-muted/40 border-b">
                  <th className="text-left  px-3 py-2 font-semibold">User</th>
                  <th className="text-left  px-3 py-2 font-semibold">Role</th>
                  <th className="text-left  px-3 py-2 font-semibold">Plan</th>
                  <th className="text-left  px-3 py-2 font-semibold">Country</th>
                  <th className="text-left  px-3 py-2 font-semibold">Last seen</th>
                  <th className="text-left  px-3 py-2 font-semibold">Status</th>
                  <th className="text-right px-3 py-2 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-10 text-muted-foreground"><Loader2 className="h-4 w-4 mx-auto animate-spin" /></td></tr>
                ) : users.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">No users found</td></tr>
                ) : users.map(u => {
                  const { Icon, cls } = roleBadge(u.role)
                  const isMe = u.email.toLowerCase() === myEmail.toLowerCase()
                  const busy = busyEmail === u.email
                  return (
                    <tr key={u.email} className={`border-b hover:bg-muted/30 transition-colors ${!u.is_active ? "opacity-60" : ""}`}>
                      <td className="px-3 py-2">
                        <div className="flex flex-col">
                          <span className="font-medium truncate max-w-[200px]">{u.email}{isMe && <span className="text-[10px] text-emerald-600 ml-1">(you)</span>}</span>
                          <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">
                            {u.name ?? "—"}{u.company_name ? ` · ${u.company_name}` : ""}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={u.role}
                          disabled={isMe || busy || u.role === "owner"}
                          onChange={e => patch(u.email, { role: e.target.value })}
                          className={`text-[11px] rounded border px-1.5 py-0.5 ${cls}`}
                        >
                          {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        {!u.is_active && <span className="block text-[9px] text-red-600 mt-0.5">blocked</span>}
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={u.subscription}
                          disabled={isMe || busy}
                          onChange={e => patch(u.email, { subscription: e.target.value })}
                          className="text-[11px] rounded border px-1.5 py-0.5 bg-background"
                        >
                          {SUB_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        {u.plan_code && <span className="block text-[9px] text-muted-foreground mt-0.5">{u.plan_code}</span>}
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-[11px] inline-flex items-center gap-1">
                          {u.signup_country_code && <span>{flagOf(u.signup_country_code)}</span>}
                          <span className="truncate max-w-[120px]">{u.signup_country ?? "—"}</span>
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-[11px] text-muted-foreground">{timeAgo(u.last_seen_at)}</span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <Icon className={`h-3.5 w-3.5`} />
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{u.role}</Badge>
                          {u.totp_required && (
                            <span className={`text-[9px] ${u.totp_enrolled ? "text-emerald-600" : "text-amber-600"}`} title={u.totp_enrolled ? "TOTP enrolled" : "TOTP required, not enrolled"}>
                              {u.totp_enrolled ? "🔒" : "⚠️"}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="inline-flex items-center gap-1">
                          {u.is_active ? (
                            <button
                              type="button"
                              onClick={() => patch(u.email, { is_active: false })}
                              disabled={isMe || busy || u.role === "owner"}
                              className="p-1.5 rounded hover:bg-amber-100 text-amber-600 disabled:opacity-30 disabled:cursor-not-allowed"
                              title="Block user"
                            >
                              <ShieldOff className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => patch(u.email, { is_active: true })}
                              disabled={busy}
                              className="p-1.5 rounded hover:bg-emerald-100 text-emerald-600"
                              title="Unblock user"
                            >
                              <ShieldCheck className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {u.totp_enrolled && (
                            <button
                              type="button"
                              onClick={() => setConfirm({ email: u.email, action: "reset_totp" })}
                              disabled={isMe || busy}
                              className="p-1.5 rounded hover:bg-purple-100 text-purple-600 disabled:opacity-30"
                              title="Reset TOTP enrollment"
                            >
                              <KeyRound className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setConfirm({ email: u.email, action: "delete" })}
                            disabled={isMe || busy || u.role === "owner"}
                            className="p-1.5 rounded hover:bg-red-100 text-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Delete user"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Confirm modal — destructive actions */}
      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            {confirm?.action === "delete" ? "Delete user?" : "Reset TOTP enrollment?"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {confirm?.action === "delete"
              ? "This permanently deletes the account, wallet, products, stores, and all activity. Cannot be undone."
              : "The user will need to re-scan a new QR code in Google Authenticator on next sign-in. All backup codes are invalidated."}
          </DialogDescription>
          <code className="block bg-slate-50 border rounded p-2 text-xs">{confirm?.email}</code>
          <div className="flex justify-end gap-2 mt-2">
            <button
              type="button"
              onClick={() => setConfirm(null)}
              className="text-xs px-3 py-1.5 rounded-md border hover:bg-muted/50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (!confirm) return
                if (confirm.action === "delete") destroy(confirm.email)
                else resetTotp(confirm.email)
              }}
              disabled={busyEmail === confirm?.email}
              className={`text-xs px-3 py-1.5 rounded-md text-white ${confirm?.action === "delete" ? "bg-red-600 hover:bg-red-700" : "bg-purple-600 hover:bg-purple-700"} disabled:opacity-50`}
            >
              {busyEmail === confirm?.email
                ? "Working..."
                : confirm?.action === "delete" ? "Delete account" : "Reset TOTP"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
