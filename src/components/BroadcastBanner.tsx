/**
 * BroadcastBanner — global admin-set message shown EVERYWHERE: landing page
 * (anonymous visitors), and every in-app page (signed-in users).
 *
 * The /active endpoint is public, so we don't need a token. We still attach
 * one when available, in case future variants of this banner gate content
 * by user role.
 *
 * Fetches /api/broadcasts/active on mount (+ refreshes every 5 min). Skips
 * banners the user has dismissed in this session (per broadcast id).
 */

import { useEffect, useState } from "react"
import { useAuth } from "@/context/AuthContext"
import { X } from "lucide-react"

const API = import.meta.env.VITE_API_URL || "http://localhost:8080"
const STORAGE_KEY = "spark_dismissed_broadcasts"

interface Broadcast {
  id:        number
  message:   string
  variant:   "info" | "warn" | "success" | "danger"
  starts_at: string
  ends_at:   string | null
}

function getDismissed(): number[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function dismiss(id: number) {
  try {
    const arr = getDismissed()
    if (!arr.includes(id)) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...arr, id]))
    }
  } catch { /* session storage blocked */ }
}

export function BroadcastBanner() {
  const { user } = useAuth()
  const [bc, setBc]         = useState<Broadcast | null>(null)
  const [dismissed, setDis] = useState<number[]>(getDismissed())

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        // Auth is optional — /active is public. Attach a token when we have
        // one so any per-user variants of the endpoint still work.
        const headers: Record<string, string> = {}
        if (user) {
          try { headers.Authorization = `Bearer ${await user.getIdToken()}` }
          catch { /* user may have just signed out */ }
        }
        const r = await fetch(`${API}/api/broadcasts/active`, { headers })
        if (!r.ok) return
        const j = await r.json()
        if (!cancelled) setBc(j.data ?? null)
      } catch { /* silent — banner is best-effort */ }
    }

    load()
    const t = window.setInterval(load, 5 * 60 * 1000)
    return () => { cancelled = true; window.clearInterval(t) }
  }, [user])

  // Set a CSS variable for banner height so the LandingNav (fixed top-0) and
  // DashboardLayout's main content can offset themselves by the right amount.
  // 0px when no banner, 40px when one is shown — animations still feel snappy.
  const visible = !!bc && !dismissed.includes(bc.id)
  useEffect(() => {
    document.documentElement.style.setProperty("--banner-h", visible ? "40px" : "0px")
    return () => { document.documentElement.style.setProperty("--banner-h", "0px") }
  }, [visible])

  if (!visible) return null

  const variantClass =
    bc!.variant === "danger"  ? "bg-red-600 text-white" :
    bc!.variant === "warn"    ? "bg-amber-500 text-white" :
    bc!.variant === "success" ? "bg-emerald-600 text-white" :
                                "bg-slate-900 text-white"

  return (
    <div
      className={`${variantClass} fixed top-0 left-0 right-0 z-[55] h-10 px-4 flex items-center justify-center gap-3 text-xs sm:text-sm shadow-md`}
      role="status"
    >
      <span className="font-medium text-center truncate max-w-[80vw]">{bc!.message}</span>
      <button
        type="button"
        onClick={() => { dismiss(bc!.id); setDis([...dismissed, bc!.id]) }}
        className="absolute right-3 top-1/2 -translate-y-1/2 opacity-80 hover:opacity-100 transition-opacity"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
