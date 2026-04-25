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
import * as THREE from "three"

// Country outlines vendored at /public/world-110m.geojson so we don't depend
// on a CDN that might rename or 404. Loaded once per session and cached.
let countriesPromise: Promise<any[]> | null = null
function loadCountries(): Promise<any[]> {
  if (!countriesPromise) {
    countriesPromise = fetch("/world-110m.geojson")
      .then(r => r.json())
      .then(j => Array.isArray(j?.features) ? j.features : [])
      .catch(() => [])
  }
  return countriesPromise
}

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
  tall?:  boolean   // fill the full container height (for fullscreen Live View)
  heightPx?: number // explicit pixel height override (default 560 for inline card)
}

export default function LiveGlobe({ points, dark = false, tall = false, heightPx }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const globeRef     = useRef<any>(null)
  const [dims, setDims] = useState<{ w: number; h: number }>({ w: 800, h: heightPx ?? (tall ? 720 : 560) })
  const [countries, setCountries] = useState<any[]>([])

  // Fetch country outlines once for the dot-matrix rendering.
  useEffect(() => {
    let cancelled = false
    loadCountries().then(c => { if (!cancelled) setCountries(c) })
    return () => { cancelled = true }
  }, [])

  // Resize-aware width + height (height matters in `tall` mode so the globe
  // fills the fullscreen dialog).
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(entries => {
      const r = entries[0]?.contentRect
      if (!r) return
      setDims({
        w: Math.max(280, Math.floor(r.width)),
        h: tall ? Math.max(360, Math.floor(r.height)) : (heightPx ?? 560),
      })
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [tall, heightPx])

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

  // Shopify Live View aesthetic: pale globe + teal dot continents.
  // `dark` flips the palette so it sits well on either a light or dark card.
  const sphereColor     = dark ? "#0f172a" : "#e6f8f1"  // base ball — slate / mint
  const dotColor        = dark ? "#5eead4" : "#10b981"  // continent dots
  const atmosphereColor = dark ? "#34d399" : "#10b981"

  // Tinted base sphere — three.js material so the ball isn't raw gray.
  const sphereMaterial = useMemo(() => {
    const m = new THREE.MeshPhongMaterial({
      color:       new THREE.Color(sphereColor),
      transparent: false,
      opacity:     1,
      shininess:   12,
      specular:    new THREE.Color(dark ? "#1e293b" : "#ffffff"),
    })
    return m
  }, [sphereColor, dark])

  return (
    <div
      ref={containerRef}
      className="relative w-full"
      style={{ height: tall ? "100%" : (heightPx ?? 560), cursor: "grab" }}
    >
      <Globe
        ref={globeRef}
        width={dims.w}
        height={dims.h}
        backgroundColor="rgba(0,0,0,0)"

        // No photo texture — we paint the surface ourselves and put dots on top.
        globeImageUrl={null}
        globeMaterial={sphereMaterial}
        showGlobe={true}
        showAtmosphere={true}
        atmosphereColor={atmosphereColor}
        atmosphereAltitude={0.18}
        showGraticules={false}

        // Shopify-style dot-matrix continents
        hexPolygonsData={countries}
        hexPolygonGeoJsonGeometry={(d: any) => d.geometry}
        hexPolygonResolution={3}
        hexPolygonMargin={0.55}
        hexPolygonUseDots={true}
        hexPolygonDotResolution={2}
        hexPolygonColor={() => dotColor}
        hexPolygonAltitude={0.005}

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
