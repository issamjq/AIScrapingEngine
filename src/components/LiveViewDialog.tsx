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
import { Activity, MapPin, Search as SearchIcon, Users, X } from "lucide-react"

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
        className="p-0 border-0 overflow-hidden bg-gradient-to-br from-white via-emerald-50/40 to-white text-slate-900"
        style={{
          width:    "96vw",
          maxWidth: "96vw",
          height:   "92vh",
          maxHeight: "92vh",
        }}
      >
        <DialogTitle className="sr-only">Live View</DialogTitle>

        {/* On mobile: stack vertically (stats above globe). On md+: side-by-side. */}
        <div className="flex flex-col md:flex-row h-full">

          {/* ── Left panel — stats ─────────────────────────────── */}
          <div className="md:w-[340px] md:shrink-0 md:border-r md:border-b-0 border-b border-slate-200 overflow-y-auto bg-white/50 backdrop-blur-sm max-h-[40vh] md:max-h-none">

            {/* Header */}
            <div className="px-5 pt-5 pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
                <h2 className="text-base font-semibold">Live View</h2>
                <Badge className="ml-auto text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
                  Just now
                </Badge>
              </div>
            </div>

            {/* Visitors right now */}
            <section className="px-5 py-4 border-b border-slate-200">
              <div className="text-[11px] text-slate-500 uppercase tracking-wide font-medium">Visitors right now</div>
              <div className="text-4xl font-bold mt-1 flex items-baseline gap-2">
                <span>{liveCount}</span>
                {liveCount > 0 && (
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {recentCount} active in last 30m · {activeToday} today
              </div>
            </section>

            {/* Sessions / searches */}
            <section className="px-5 py-4 border-b border-slate-200 grid grid-cols-2 gap-3">
              <div>
                <div className="text-[11px] text-slate-500 uppercase tracking-wide font-medium flex items-center gap-1">
                  <Activity className="h-3 w-3" /> Sessions
                </div>
                <div className="text-2xl font-bold mt-0.5">{activeToday}</div>
                <div className="text-[10px] text-slate-500">today</div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500 uppercase tracking-wide font-medium flex items-center gap-1">
                  <SearchIcon className="h-3 w-3" /> Searches
                </div>
                <div className="text-2xl font-bold mt-0.5">{searches24h}</div>
                <div className="text-[10px] text-slate-500">{totalSearches.toLocaleString()} all time</div>
              </div>
            </section>

            {/* Customer behavior — what are live users doing */}
            <section className="px-5 py-4 border-b border-slate-200">
              <div className="text-[11px] text-slate-500 uppercase tracking-wide font-medium">Customer behavior</div>
              <div className="grid grid-cols-3 gap-3 mt-2">
                <div>
                  <div className="text-xl font-bold">{liveCount}</div>
                  <div className="text-[10px] text-slate-500">Live</div>
                </div>
                <div>
                  <div className="text-xl font-bold">{recentCount}</div>
                  <div className="text-[10px] text-slate-500">Recent</div>
                </div>
                <div>
                  <div className="text-xl font-bold">{activeToday}</div>
                  <div className="text-[10px] text-slate-500">Today</div>
                </div>
              </div>
            </section>

            {/* Sessions by location */}
            <section className="px-5 py-4">
              <div className="text-[11px] text-slate-500 uppercase tracking-wide font-medium flex items-center gap-1 mb-2">
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
                        <span className="text-slate-700 font-semibold shrink-0">{c.count}</span>
                      </div>
                      <div className="relative h-1.5 bg-slate-100 rounded overflow-hidden mt-1">
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
            <section className="px-5 py-4 border-t border-slate-200">
              <div className="text-[11px] text-slate-500 uppercase tracking-wide font-medium flex items-center gap-1 mb-2">
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
            {/* Ambient soft glow */}
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute top-1/4 left-1/3 h-[600px] w-[600px] rounded-full bg-emerald-300/15 blur-3xl" />
              <div className="absolute bottom-0 right-10 h-[420px] w-[420px] rounded-full bg-cyan-300/15 blur-3xl" />
            </div>

            {/* Explicit, visible close button — sits in the globe pane so the
                left-panel doesn't get covered, and it's obviously clickable. */}
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Close Live View"
              className="absolute top-4 right-5 z-20 h-9 w-9 rounded-full bg-white shadow-md border border-slate-200 hover:bg-slate-50 hover:border-slate-300 flex items-center justify-center transition-colors"
            >
              <X className="h-4 w-4 text-slate-700" />
            </button>

            {/* Legend — moved to bottom-right so it doesn't fight the close X */}
            <div className="absolute bottom-5 right-5 z-10 flex items-center gap-3 text-[11px] text-slate-600 bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-slate-200 shadow-sm">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                Live (≤5m)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
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
// default 480px the inline card uses. Light theme to match the dialog.
function LiveGlobeBig({ points }: { points: LivePoint[] }) {
  return (
    <div
      className="h-full w-full [&>div]:h-full [&>div]:min-h-0"
      style={{ minHeight: 0 }}
    >
      <LiveGlobe points={points as any} tall />
    </div>
  )
}
