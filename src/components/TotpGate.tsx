/**
 * TotpGate — full-page lock that admins / devs / owners must clear before they
 * can use any feature of the app.
 *
 * Two modes (decided by /api/auth/totp/status):
 * 1. Enrollment — user has totp_required but no secret yet:
 *    - Calls /enroll → backend returns QR data URL + 8 backup codes (shown once).
 *    - User scans with Google Authenticator, types the first 6-digit code.
 *    - We post to /verify-enrollment to seal it (also persists the backup hashes).
 *    - On success we receive a session token, drop it in sessionStorage,
 *      and `onPass()` fires so App.tsx can render the real app.
 *
 * 2. Verification — already enrolled, no/expired session:
 *    - User types a 6-digit code (or "Use backup code" link) → /verify or
 *      /use-backup → token + onPass().
 *
 * The component is intentionally self-contained — it doesn't know anything
 * about the rest of the app, just the auth context (for the Firebase token)
 * and the TOTP utility (for setTotpToken).
 */

import { useEffect, useState } from "react"
import { useAuth } from "@/context/AuthContext"
import { setTotpToken, writeCachedStatus, type TotpStatus } from "@/lib/totp"
import { Loader2, ShieldCheck, AlertTriangle, Copy, Check, KeyRound, LogOut } from "lucide-react"

const API = (import.meta.env.VITE_API_URL || "http://localhost:8080").replace(/\/+$/, "")

interface Props {
  status: TotpStatus
  onPass: () => void
}

export function TotpGate({ status, onPass }: Props) {
  const { user, logout } = useAuth()
  const [mode, setMode] = useState<"enroll" | "verify" | "backup">(
    status.enrolled ? "verify" : "enroll",
  )

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-emerald-50/40 p-4">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center mb-3">
            <ShieldCheck className="h-6 w-6 text-emerald-600" />
          </div>
          <h1 className="text-xl font-semibold">Two-factor authentication</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {user?.email} · Admin accounts require Google Authenticator
          </p>
        </div>

        <div className="rounded-xl border bg-white shadow-sm p-5">
          {mode === "enroll"  && <EnrollSection onDone={onPass} />}
          {mode === "verify"  && <VerifySection onDone={onPass} switchToBackup={() => setMode("backup")} />}
          {mode === "backup"  && <BackupSection onDone={onPass} switchToCode={() => setMode("verify")} />}
        </div>

        {/* Footer — escape hatch */}
        <button
          type="button"
          onClick={() => logout()}
          className="mt-4 mx-auto flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <LogOut className="h-3 w-3" />
          Sign out and use a different account
        </button>
      </div>
    </div>
  )
}

// ─── Enrollment ───────────────────────────────────────────────────────────────

function EnrollSection({ onDone }: { onDone: () => void }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [err, setErr]         = useState<string | null>(null)
  const [qr, setQr]           = useState<string | null>(null)
  const [otpauth, setOtpauth] = useState<string | null>(null)
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [backupHashes, setBackupHashes] = useState<string[]>([])
  const [code, setCode]       = useState("")
  const [verifying, setVerifying] = useState(false)
  const [acknowledged, setAck] = useState(false)
  const [step, setStep]       = useState<"setup" | "codes">("setup")
  const [copied, setCopied]   = useState(false)

  // Kick off enroll on mount
  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      try {
        const token = await user.getIdToken()
        const r = await fetch(`${API}/api/auth/totp/enroll`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        })
        const j = await r.json()
        if (!j.success) throw new Error(j.error?.message || "Enrollment failed")
        if (cancelled) return
        setQr(j.data.qr_data_url)
        setOtpauth(j.data.otpauth_url)
        setBackupCodes(j.data.backup_codes || [])
        setBackupHashes(j.data._hashes || [])
      } catch (e: any) {
        if (!cancelled) setErr(e.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [user])

  async function submit() {
    if (!/^\d{6}$/.test(code) || !user) return
    setVerifying(true); setErr(null)
    try {
      const token = await user.getIdToken()
      const r = await fetch(`${API}/api/auth/totp/verify-enrollment`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ code, backup_hashes: backupHashes }),
      })
      const j = await r.json()
      if (!j.success) throw new Error(j.error?.message || "Verification failed")
      setTotpToken(j.data.session_token)
      writeCachedStatus({ required: true, enrolled: true, enrolled_at: new Date().toISOString() })
      setStep("codes")          // show backup codes confirmation
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setVerifying(false)
    }
  }

  function copyCodes() {
    navigator.clipboard.writeText(backupCodes.join("\n")).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (loading) return <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
  if (err && !qr) return <ErrorBox msg={err} />

  if (step === "codes") {
    return (
      <div className="space-y-4">
        <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-amber-900 text-xs">
          <strong>Save these backup codes now.</strong> They're shown once and let you sign in if you lose your phone. Each code works only one time.
        </div>
        <div className="rounded-md bg-slate-50 border p-3 grid grid-cols-2 gap-2 text-center font-mono text-sm tracking-wider">
          {backupCodes.map((c, i) => <span key={i}>{c}</span>)}
        </div>
        <button
          type="button"
          onClick={copyCodes}
          className="w-full inline-flex items-center justify-center gap-2 rounded-md border bg-white hover:bg-slate-50 py-2 text-xs"
        >
          {copied ? <><Check className="h-3.5 w-3.5 text-emerald-600" />Copied</> : <><Copy className="h-3.5 w-3.5" />Copy all codes</>}
        </button>
        <label className="flex items-start gap-2 text-xs cursor-pointer">
          <input type="checkbox" checked={acknowledged} onChange={e => setAck(e.target.checked)} className="mt-0.5" />
          <span>I've saved these codes somewhere safe.</span>
        </label>
        <button
          type="button"
          disabled={!acknowledged}
          onClick={onDone}
          className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-md py-2 text-sm font-medium transition-colors"
        >
          Continue to app
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium mb-1">Step 1 — Scan this with Google Authenticator</p>
        <p className="text-xs text-muted-foreground mb-3">
          Or any TOTP app: Authy, 1Password, Bitwarden — they all work.
        </p>
        {qr && (
          <div className="flex items-center justify-center bg-slate-50 border rounded-lg p-4">
            <img src={qr} alt="Scan with Google Authenticator" className="h-48 w-48" />
          </div>
        )}
        {otpauth && (
          <details className="mt-2">
            <summary className="text-[11px] text-muted-foreground cursor-pointer hover:text-foreground">Can't scan? Show secret manually</summary>
            <code className="block mt-2 p-2 bg-slate-50 rounded text-[10px] break-all">{otpauth}</code>
          </details>
        )}
      </div>

      <div>
        <p className="text-sm font-medium mb-2">Step 2 — Enter the 6-digit code</p>
        <input
          inputMode="numeric"
          autoFocus
          value={code}
          onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          onKeyDown={e => { if (e.key === "Enter") submit() }}
          placeholder="000000"
          className="w-full text-center tracking-[0.4em] font-mono text-xl py-3 rounded-md border focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          maxLength={6}
        />
        {err && <ErrorBox msg={err} />}
      </div>

      <button
        type="button"
        disabled={!/^\d{6}$/.test(code) || verifying}
        onClick={submit}
        className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-md py-2 text-sm font-medium transition-colors"
      >
        {verifying ? "Verifying..." : "Verify and enroll"}
      </button>
    </div>
  )
}

// ─── Verification (already enrolled) ─────────────────────────────────────────

function VerifySection({ onDone, switchToBackup }: { onDone: () => void; switchToBackup: () => void }) {
  const { user } = useAuth()
  const [code, setCode] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit() {
    if (!/^\d{6}$/.test(code) || !user) return
    setSubmitting(true); setErr(null)
    try {
      const token = await user.getIdToken()
      const r = await fetch(`${API}/api/auth/totp/verify`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ code }),
      })
      const j = await r.json()
      if (!j.success) throw new Error(j.error?.message || "Invalid code")
      setTotpToken(j.data.session_token)
      onDone()
    } catch (e: any) {
      setErr(e.message)
      setCode("")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm">Open Google Authenticator and enter your 6-digit code.</p>
      <input
        inputMode="numeric"
        autoFocus
        value={code}
        onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        onKeyDown={e => { if (e.key === "Enter") submit() }}
        placeholder="000000"
        className="w-full text-center tracking-[0.4em] font-mono text-2xl py-3 rounded-md border focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
        maxLength={6}
      />
      {err && <ErrorBox msg={err} />}
      <button
        type="button"
        disabled={!/^\d{6}$/.test(code) || submitting}
        onClick={submit}
        className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-md py-2 text-sm font-medium transition-colors"
      >
        {submitting ? "Verifying..." : "Verify"}
      </button>
      <button
        type="button"
        onClick={switchToBackup}
        className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1"
      >
        <KeyRound className="h-3 w-3" />
        Lost your phone? Use a backup code
      </button>
    </div>
  )
}

// ─── Backup code recovery ─────────────────────────────────────────────────────

function BackupSection({ onDone, switchToCode }: { onDone: () => void; switchToCode: () => void }) {
  const { user } = useAuth()
  const [code, setCode] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit() {
    if (code.trim().length < 8 || !user) return
    setSubmitting(true); setErr(null)
    try {
      const token = await user.getIdToken()
      const r = await fetch(`${API}/api/auth/totp/use-backup`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ code: code.trim().toUpperCase() }),
      })
      const j = await r.json()
      if (!j.success) throw new Error(j.error?.message || "Invalid backup code")
      setTotpToken(j.data.session_token)
      onDone()
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm">Enter one of the 8 backup codes you saved during setup. <strong className="text-amber-700">Each code works only once.</strong></p>
      <input
        autoFocus
        value={code}
        onChange={e => setCode(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") submit() }}
        placeholder="XXXXXXXXXX"
        className="w-full text-center tracking-widest font-mono text-lg py-3 rounded-md border focus:outline-none focus:ring-2 focus:ring-emerald-500/30 uppercase"
      />
      {err && <ErrorBox msg={err} />}
      <button
        type="button"
        disabled={code.trim().length < 8 || submitting}
        onClick={submit}
        className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-md py-2 text-sm font-medium transition-colors"
      >
        {submitting ? "Verifying..." : "Use backup code"}
      </button>
      <button
        type="button"
        onClick={switchToCode}
        className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        ← Back to authenticator code
      </button>
    </div>
  )
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 p-2.5 text-red-900 text-xs">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
      <span>{msg}</span>
    </div>
  )
}
