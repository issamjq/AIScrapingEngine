/**
 * BroadcastBanner — global admin-set message shown to every signed-in user.
 * Fetches /api/broadcasts/active on mount (+ refreshes every 5 min), skips
 * banners the user has already dismissed in this session (per broadcast id).
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
    if (!user) return
    let cancelled = false

    async function load() {
      try {
        const token = await user!.getIdToken()
        const r = await fetch(`${API}/api/broadcasts/active`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!r.ok) return
        const j = await r.json()
        if (!cancelled) setBc(j.data ?? null)
      } catch { /* silent */ }
    }

    load()
    const t = window.setInterval(load, 5 * 60 * 1000)
    return () => { cancelled = true; window.clearInterval(t) }
  }, [user])

  if (!bc || dismissed.includes(bc.id)) return null

  const variantClass =
    bc.variant === "danger"  ? "bg-red-600 text-white" :
    bc.variant === "warn"    ? "bg-amber-500 text-white" :
    bc.variant === "success" ? "bg-emerald-600 text-white" :
                               "bg-slate-900 text-white"

  return (
    <div className={`${variantClass} w-full py-2 px-4 flex items-center justify-center gap-3 text-xs sm:text-sm relative shadow-sm`}>
      <span className="font-medium text-center">{bc.message}</span>
      <button
        type="button"
        onClick={() => { dismiss(bc.id); setDis([...dismissed, bc.id]) }}
        className="absolute right-3 top-1/2 -translate-y-1/2 opacity-80 hover:opacity-100 transition-opacity"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
