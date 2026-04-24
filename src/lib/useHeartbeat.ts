/**
 * useHeartbeat — pings /api/heartbeat every 60s while the tab is visible so
 * the admin dashboard can show an accurate "live now" count.
 * - Pauses when the tab is backgrounded (no point pinging).
 * - Re-pings immediately when the tab becomes visible again.
 * - Silently swallows all errors — heartbeat must never disrupt the UI.
 */

import { useEffect, useRef } from "react"
import { useAuth } from "@/context/AuthContext"

const API = import.meta.env.VITE_API_URL || "http://localhost:8080"
const INTERVAL_MS = 60_000

export function useHeartbeat() {
  const { user } = useAuth()
  const timerRef = useRef<number | null>(null)
  const sendingRef = useRef(false)

  useEffect(() => {
    if (!user) return

    async function ping() {
      if (sendingRef.current || document.hidden) return
      sendingRef.current = true
      try {
        const token = await user!.getIdToken()
        await fetch(`${API}/api/heartbeat`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        })
      } catch {
        // swallowed — heartbeat is best-effort
      } finally {
        sendingRef.current = false
      }
    }

    // Fire immediately on mount, then every INTERVAL_MS
    ping()
    timerRef.current = window.setInterval(ping, INTERVAL_MS)

    // Re-ping on tab becoming visible again
    function onVis() {
      if (!document.hidden) ping()
    }
    document.addEventListener("visibilitychange", onVis)

    return () => {
      if (timerRef.current != null) window.clearInterval(timerRef.current)
      document.removeEventListener("visibilitychange", onVis)
    }
  }, [user])
}
