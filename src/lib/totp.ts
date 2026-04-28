/**
 * TOTP client utilities — sessionStorage-backed token + fetch interception.
 *
 * Architecture:
 * - On app mount we monkey-patch window.fetch ONCE so every request to the
 *   Spark API automatically carries an X-Totp-Session header (when we have
 *   a token). This avoids threading the header through every fetch call.
 * - The session token lives in sessionStorage so it dies when the tab
 *   closes — admins re-verify on next launch. (Don't move to localStorage:
 *   we *want* the gate to bite again on a fresh tab.)
 * - On 403 TOTP_REQUIRED / TOTP_NOT_ENROLLED responses we clear the token
 *   so App.tsx will re-render the TotpGate.
 */

const API_BASE   = (import.meta.env.VITE_API_URL || "http://localhost:8080").replace(/\/+$/, "")
const TOKEN_KEY  = "spark_totp_session"
const STATUS_KEY = "spark_totp_status_v1"

export interface TotpStatus {
  required:            boolean
  enrolled:            boolean
  enrolled_at:         string | null
  server_configured?:  boolean
  server_config_error?: string | null
}

export const TOTP_DEFAULTS: TotpStatus = {
  required: false, enrolled: false, enrolled_at: null,
  server_configured: true, server_config_error: null,
}

// ── token store ──────────────────────────────────────────────────────────────
export function getTotpToken(): string | null {
  try { return sessionStorage.getItem(TOKEN_KEY) } catch { return null }
}
export function setTotpToken(t: string | null) {
  try {
    if (t) sessionStorage.setItem(TOKEN_KEY, t)
    else   sessionStorage.removeItem(TOKEN_KEY)
  } catch { /* private mode etc. */ }
}

// ── status cache (avoids flicker between renders) ─────────────────────────────
export function readCachedStatus(): TotpStatus {
  try {
    const raw = sessionStorage.getItem(STATUS_KEY)
    if (!raw) return TOTP_DEFAULTS
    return { ...TOTP_DEFAULTS, ...JSON.parse(raw) }
  } catch { return TOTP_DEFAULTS }
}
export function writeCachedStatus(s: TotpStatus) {
  try { sessionStorage.setItem(STATUS_KEY, JSON.stringify(s)) }
  catch { /* ignore */ }
}
export function clearCachedStatus() {
  try { sessionStorage.removeItem(STATUS_KEY) } catch { /* ignore */ }
}

// ── fetch monkey-patch (runs once on app boot) ────────────────────────────────
let installed = false
export function installTotpFetchInterceptor(onTotpFailure: () => void) {
  if (installed) return
  installed = true

  const orig = window.fetch.bind(window)

  window.fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url

    // Only attach to our own API. CORS headers won't be sent to other origins anyway.
    if (typeof url === "string" && url.startsWith(API_BASE)) {
      const token = getTotpToken()
      if (token) {
        const h = new Headers(init.headers || {})
        if (!h.has("x-totp-session")) h.set("X-Totp-Session", token)
        init = { ...init, headers: h }
      }
    }

    const resp = await orig(input, init)

    // 403 with TOTP code → drop token + ask App.tsx to re-show the gate.
    // EXCEPTION: skip-list endpoints (/me, /heartbeat, /broadcasts/active,
    // /signup, /auth/totp/*) should never legitimately return a TOTP error.
    // If they do, it's a server bug — don't punish the user by clearing
    // their session and bouncing them back to the gate on every refresh.
    if (resp.status === 403 && typeof url === "string" && url.startsWith(API_BASE)) {
      const isSkipListPath =
        url.includes("/api/allowed-users/me")     ||
        url.includes("/api/allowed-users/signup") ||
        url.includes("/api/auth/totp")            ||
        url.includes("/api/heartbeat")            ||
        url.includes("/api/broadcasts/active")
      if (!isSkipListPath) {
        try {
          const clone = resp.clone()
          const j: any = await clone.json().catch(() => null)
          const code = j?.error?.code
          if (code === "TOTP_REQUIRED" || code === "TOTP_NOT_ENROLLED") {
            setTotpToken(null)
            onTotpFailure()
          }
        } catch { /* ignore body-parse errors */ }
      }
    }

    return resp
  }
}
