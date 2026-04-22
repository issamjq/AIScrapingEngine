import { useEffect, useRef, useState, useCallback, type RefObject } from "react"

// ── Mouse-tracked spotlight glow ───────────────────────────────────────────
// Sets --mx / --my CSS variables on the ref'd element, values in % of its bbox.
export function useMouseGlow<T extends HTMLElement = HTMLDivElement>(): RefObject<T> {
  const ref = useRef<T>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return

    let raf = 0
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect()
      const x = ((e.clientX - r.left) / r.width) * 100
      const y = ((e.clientY - r.top) / r.height) * 100
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        el.style.setProperty("--mx", `${x}%`)
        el.style.setProperty("--my", `${y}%`)
      })
    }
    el.addEventListener("pointermove", onMove)
    return () => {
      el.removeEventListener("pointermove", onMove)
      cancelAnimationFrame(raf)
    }
  }, [])

  return ref
}

// ── Magnetic button hover ──────────────────────────────────────────────────
// Small 3D translate toward the pointer, springs back on leave.
export function useMagnetic<T extends HTMLElement = HTMLButtonElement>(strength = 0.25): RefObject<T> {
  const ref = useRef<T>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      const x = e.clientX - (r.left + r.width / 2)
      const y = e.clientY - (r.top + r.height / 2)
      el.style.transform = `translate3d(${x * strength}px, ${y * strength}px, 0)`
    }
    const onLeave = () => {
      el.style.transform = "translate3d(0,0,0)"
    }
    el.addEventListener("pointermove", onMove)
    el.addEventListener("pointerleave", onLeave)
    return () => {
      el.removeEventListener("pointermove", onMove)
      el.removeEventListener("pointerleave", onLeave)
    }
  }, [strength])

  return ref
}

// ── Scroll progress (0..1) ─────────────────────────────────────────────────
export function useScrollProgress() {
  const [p, setP] = useState(0)
  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement
      const total = doc.scrollHeight - doc.clientHeight
      setP(total > 0 ? Math.min(1, Math.max(0, window.scrollY / total)) : 0)
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])
  return p
}

// ── Count-up when in view ──────────────────────────────────────────────────
export function useCountUp(to: number, duration = 1600, start = false) {
  const [value, setValue] = useState(0)
  const started = useRef(false)

  useEffect(() => {
    if (!start || started.current) return
    started.current = true
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setValue(to)
      return
    }
    const t0 = performance.now()
    let raf = 0
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration)
      // easeOutCubic
      const eased = 1 - Math.pow(1 - p, 3)
      setValue(to * eased)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [start, to, duration])

  return value
}

// ── IntersectionObserver — "in view" flag ──────────────────────────────────
export function useInViewOnce<T extends HTMLElement = HTMLDivElement>(
  options?: IntersectionObserverInit,
): [RefObject<T>, boolean] {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          obs.disconnect()
        }
      },
      { threshold: 0.3, rootMargin: "0px 0px -60px 0px", ...options },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return [ref, inView]
}

// ── Grain noise as inline SVG data URI (use as bg-image) ───────────────────
export const GRAIN_SVG =
  "url(\"data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'>
      <filter id='n'>
        <feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/>
        <feColorMatrix type='matrix' values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.8 0'/>
      </filter>
      <rect width='100%' height='100%' filter='url(%23n)' opacity='0.6'/>
    </svg>`.replace(/\s+/g, " "),
  ) +
  "\")"

// Used with inline style — combined mouse glow + grain
export const grainStyle = (opacity = 0.06): React.CSSProperties => ({
  backgroundImage: GRAIN_SVG,
  opacity,
  mixBlendMode: "overlay",
})

// Utility: format count value with optional decimals
export function formatCount(v: number, decimals = 0) {
  if (decimals === 0) return Math.round(v).toString()
  return v.toFixed(decimals)
}

// Re-export useCallback to satisfy some call sites; actually unused external API
export { useCallback }
