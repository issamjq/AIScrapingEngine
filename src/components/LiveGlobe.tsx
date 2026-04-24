/**
 * LiveGlobe — Shopify-style 3D globe showing user presence.
 * - Green point + pulsing ring  = user active in last 5 minutes (LIVE)
 * - Blue point (no ring)        = user active 5–30 minutes ago (recent)
 * - Auto-rotates, drag to orbit, scroll disabled so page scroll still works.
 *
 * Loaded lazily from DashboardContent so react-globe.gl + three don't bloat
 * the main bundle for non-admin users.
 */

import { useEffect, useMemo, useRef, useState } from "react"
import Globe from "react-globe.gl"

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
  points: LivePoint[]
  dark?:  boolean
}

export default function LiveGlobe({ points, dark = false }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const globeRef     = useRef<any>(null)
  const [width, setWidth] = useState(800)

  // Resize-aware width
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width ?? 800
      setWidth(Math.max(280, Math.floor(w)))
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  // Auto-rotate + camera framing
  useEffect(() => {
    const g = globeRef.current
    if (!g) return
    const controls = g.controls()
    controls.autoRotate       = true
    controls.autoRotateSpeed  = 0.4
    controls.enableZoom       = false   // keep page scroll intact
    controls.enablePan        = false
    g.pointOfView({ lat: 25, lng: 40, altitude: 2.4 }, 800)
  }, [])

  const liveOnly = useMemo(
    () => points.filter(p => p.status === "live"),
    [points],
  )

  const atmosphereColor = "#10b981"       // emerald — matches the live dots
  const globeImage = dark
    ? "//unpkg.com/three-globe/example/img/earth-night.jpg"
    : "//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"

  return (
    <div
      ref={containerRef}
      className="relative w-full"
      style={{ height: 480, cursor: "grab" }}
    >
      <Globe
        ref={globeRef}
        width={width}
        height={480}
        backgroundColor="rgba(0,0,0,0)"
        globeImageUrl={globeImage}
        atmosphereColor={atmosphereColor}
        atmosphereAltitude={0.22}
        showGraticules={false}

        // Points — green for live, blue for recent
        pointsData={points}
        pointLat={(d: any) => d.lat}
        pointLng={(d: any) => d.lng}
        pointAltitude={(d: any) => d.status === "live" ? 0.08 : 0.03}
        pointRadius={(d: any) => d.status === "live" ? 0.55 : 0.38}
        pointColor={(d: any) => d.status === "live" ? "#10b981" : "#3b82f6"}
        pointResolution={12}
        pointLabel={(d: any) => `
          <div style="background:rgba(15,23,42,0.94);backdrop-filter:blur(4px);border:1px solid rgba(255,255,255,0.1);padding:8px 12px;border-radius:8px;font-size:11px;color:white;box-shadow:0 10px 40px rgba(0,0,0,0.5);font-family:system-ui">
            <div style="font-weight:600;display:flex;align-items:center;gap:6px">
              <span style="display:inline-block;width:6px;height:6px;border-radius:999px;background:${d.status === "live" ? "#10b981" : "#3b82f6"};box-shadow:0 0 8px ${d.status === "live" ? "#10b981" : "#3b82f6"}"></span>
              ${escapeHtml(d.email)}
            </div>
            <div style="opacity:0.7;margin-top:3px">${escapeHtml(d.city ?? "")}${d.country ? " · " + escapeHtml(d.country) : ""}</div>
            <div style="opacity:0.5;margin-top:2px;font-size:10px">${d.status === "live" ? "Live now" : "Active 5–30 min ago"}</div>
          </div>
        `}

        // Pulsing rings only on LIVE users
        ringsData={liveOnly}
        ringLat={(d: any) => d.lat}
        ringLng={(d: any) => d.lng}
        ringColor={() => (t: number) => `rgba(16, 185, 129, ${1 - t})`}
        ringMaxRadius={4}
        ringPropagationSpeed={1.6}
        ringRepeatPeriod={1400}
        ringAltitude={0.01}
        ringResolution={64}
      />
    </div>
  )
}

// Very small HTML-escape — labels receive email/city/country from the DB so
// we sanitize before embedding them in the tooltip HTML string.
function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
