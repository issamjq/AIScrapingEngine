/**
 * LiveViewDialog — Shopify-style fullscreen "Live View" with a huge globe.
 * Left: stats panel (visitors now, sessions, customer behavior, sessions by
 * location bars). Right: the globe, filling the remaining space.
 *
 * Accepts live points from the already-fetched admin stats so it opens instantly
 * — no extra request.
 */

import { lazy, Suspense, useMemo } from "react"
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog"
import { Badge } from "./ui/badge"
import { Activity, MapPin, Search as SearchIcon, Users } from "lucide-react"

const LiveGlobe = lazy(() => import("./LiveGlobe"))

export interface LivePoint {
  email:        string
  role:         string
  country:      string | null
  country_code: string | null
  city:         string | null
  lat:          number
  lng:          number
  last_seen_at: string
  status:       "live" | "recent"
}

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  points:      LivePoint[]
  liveCount:   number
  recentCount: number
  activeToday: number
  searches24h: number
  totalSearches: number
}

function flagOf(code: string | null | undefined): string {
  if (!code || code.length !== 2) return "🌐"
  const A = 0x1F1E6
  const base = "A".charCodeAt(0)
  return String.fromCodePoint(
    A + code.toUpperCase().charCodeAt(0) - base,
    A + code.toUpperCase().charCodeAt(1) - base,
  )
}

export function LiveViewDialog({
  open, onOpenChange, points, liveCount, recentCount, activeToday, searches24h, totalSearches,
}: Props) {

  // Group live points by country for the "Sessions by location" bars
  const byCountry = useMemo(() => {
    const map = new Map<string, { country: string; code: string | null; city: string | null; count: number }>()
    for (const p of points) {
      const key = p.country ?? "Unknown"
      const cur = map.get(key)
      if (cur) cur.count++
      else map.set(key, { country: key, code: p.country_code, city: p.city, count: 1 })
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count)
  }, [points])
  const maxCount = Math.max(1, ...byCountry.map(c => c.count))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-0 border-0 overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-black text-white"
        style={{
          width:    "96vw",
          maxWidth: "96vw",
          height:   "92vh",
          maxHeight: "92vh",
        }}
      >
        <DialogTitle className="sr-only">Live View</DialogTitle>

        <div className="flex h-full">

          {/* ── Left panel — stats ─────────────────────────────── */}
          <div className="w-[340px] shrink-0 border-r border-white/10 overflow-y-auto">

            {/* Header */}
            <div className="px-5 pt-5 pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
                <h2 className="text-base font-semibold">Live View</h2>
                <Badge className="ml-auto text-[10px] bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/20">
                  Just now
                </Badge>
              </div>
            </div>

            {/* Visitors right now */}
            <section className="px-5 py-4 border-b border-white/10">
              <div className="text-[11px] text-slate-400 uppercase tracking-wide">Visitors right now</div>
              <div className="text-4xl font-bold mt-1 flex items-baseline gap-2">
                <span>{liveCount}</span>
                {liveCount > 0 && (
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {recentCount} active in last 30m · {activeToday} today
              </div>
            </section>

            {/* Sessions / searches */}
            <section className="px-5 py-4 border-b border-white/10 grid grid-cols-2 gap-3">
              <div>
                <div className="text-[11px] text-slate-400 uppercase tracking-wide flex items-center gap-1">
                  <Activity className="h-3 w-3" /> Sessions
                </div>
                <div className="text-2xl font-bold mt-0.5">{activeToday}</div>
                <div className="text-[10px] text-slate-500">today</div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400 uppercase tracking-wide flex items-center gap-1">
                  <SearchIcon className="h-3 w-3" /> Searches
                </div>
                <div className="text-2xl font-bold mt-0.5">{searches24h}</div>
                <div className="text-[10px] text-slate-500">{totalSearches.toLocaleString()} all time</div>
              </div>
            </section>

            {/* Customer behavior — what are live users doing */}
            <section className="px-5 py-4 border-b border-white/10">
              <div className="text-[11px] text-slate-400 uppercase tracking-wide">Customer behavior</div>
              <div className="grid grid-cols-3 gap-3 mt-2">
                <div>
                  <div className="text-xl font-bold">{liveCount}</div>
                  <div className="text-[10px] text-slate-400">Live</div>
                </div>
                <div>
                  <div className="text-xl font-bold">{recentCount}</div>
                  <div className="text-[10px] text-slate-400">Recent</div>
                </div>
                <div>
                  <div className="text-xl font-bold">{activeToday}</div>
                  <div className="text-[10px] text-slate-400">Today</div>
                </div>
              </div>
            </section>

            {/* Sessions by location */}
            <section className="px-5 py-4">
              <div className="text-[11px] text-slate-400 uppercase tracking-wide flex items-center gap-1 mb-2">
                <MapPin className="h-3 w-3" /> Sessions by location
              </div>
              {byCountry.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No live visitors right now.</p>
              ) : (
                <div className="space-y-2.5">
                  {byCountry.map((c, i) => (
                    <div key={i}>
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <span>{flagOf(c.code)}</span>
                          <span className="truncate">
                            {c.country}
                            {c.city && <span className="text-slate-500"> · {c.city}</span>}
                          </span>
                        </div>
                        <span className="text-slate-300 font-semibold shrink-0">{c.count}</span>
                      </div>
                      <div className="relative h-1.5 bg-white/5 rounded overflow-hidden mt-1">
                        <div
                          className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-emerald-500 to-cyan-400 rounded"
                          style={{ width: `${(c.count / maxCount) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Visitors list */}
            <section className="px-5 py-4 border-t border-white/10">
              <div className="text-[11px] text-slate-400 uppercase tracking-wide flex items-center gap-1 mb-2">
                <Users className="h-3 w-3" /> Who's here
              </div>
              {points.length === 0 ? (
                <p className="text-xs text-slate-500 italic">Nobody active in the last 30 min.</p>
              ) : (
                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  {points.slice(0, 30).map((p, i) => (
                    <div key={i} className="flex items-center gap-2 text-[11px]">
                      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${p.status === "live" ? "bg-emerald-400" : "bg-blue-400"}`} />
                      <span className="truncate flex-1">{p.email}</span>
                      {p.country_code && <span className="shrink-0">{flagOf(p.country_code)}</span>}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* ── Right side — BIG globe ────────────────────────── */}
          <div className="flex-1 relative overflow-hidden">
            {/* Ambient glow */}
            <div className="pointer-events-none absolute inset-0 opacity-60">
              <div className="absolute top-1/4 left-1/3 h-[600px] w-[600px] rounded-full bg-emerald-500/10 blur-3xl" />
              <div className="absolute bottom-0 right-10 h-[420px] w-[420px] rounded-full bg-violet-500/10 blur-3xl" />
            </div>

            {/* Legend */}
            <div className="absolute top-4 right-5 z-10 flex items-center gap-3 text-[11px] text-slate-300">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.9)]" />
                Live (≤5m)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.9)]" />
                Recent (5–30m)
              </span>
            </div>

            {points.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2">
                <MapPin className="h-12 w-12 opacity-20" />
                <p className="text-sm">No visitors right now</p>
                <p className="text-[11px] text-slate-600">The globe will light up the moment someone opens the app</p>
              </div>
            ) : (
              <Suspense
                fallback={
                  <div className="h-full flex items-center justify-center">
                    <div className="h-10 w-10 rounded-full border-2 border-emerald-500/30 border-t-emerald-400 animate-spin" />
                  </div>
                }
              >
                {/* The globe auto-resizes its width via ResizeObserver inside the component. */}
                <div className="h-full w-full flex items-center justify-center">
                  <div className="h-full w-full">
                    <LiveGlobeBig points={points} />
                  </div>
                </div>
              </Suspense>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Wrapper that sizes the globe to the available height (~80vh) rather than the
// default 480px the inline card uses.
function LiveGlobeBig({ points }: { points: LivePoint[] }) {
  return (
    <div
      className="h-full w-full [&>div]:h-full [&>div]:min-h-0"
      style={{ minHeight: 0 }}
    >
      <LiveGlobe points={points as any} dark tall />
    </div>
  )
}
