import { useEffect, useRef, useState } from "react"
import { Camera, Eye, Database, TrendingDown, CheckCircle2, type LucideIcon } from "lucide-react"
import { Reveal } from "./Reveal"

interface Step {
  icon:  LucideIcon
  label: string
  title: string
  desc:  string
  color: string
}

const STEPS: Step[] = [
  {
    icon:  Camera,
    label: "Step 01",
    title: "Capture the product page",
    desc:  "A headless browser loads the retailer's product page just like a real shopper would — waiting for dynamic JavaScript, handling cookie banners, executing client-side rendering — then captures a full-resolution screenshot.",
    color: "from-blue-500 to-indigo-500",
  },
  {
    icon:  Eye,
    label: "Step 02",
    title: "Vision AI reads the pixels",
    desc:  "Spark Vision AI examines the screenshot the same way your eyes would. It finds the price, the crossed-out original, stock availability, and promotional badges — even on retailers with obfuscated markup or lazy-loaded content.",
    color: "from-amber-500 to-orange-500",
  },
  {
    icon:  Database,
    label: "Step 03",
    title: "Normalize, validate, store",
    desc:  "Currency conversion, price sanity checks (is $0.01 plausible for a laptop?), deduplication against historical records, then atomic write to your account's isolated row in Postgres. Audit-logged.",
    color: "from-emerald-500 to-green-500",
  },
  {
    icon:  TrendingDown,
    label: "Step 04",
    title: "Trigger alerts and analytics",
    desc:  "Your dashboard refreshes with the new price. Sparklines update. If a competitor dropped price below your threshold, you get an alert before your customers notice. All in under 3 seconds per retailer.",
    color: "from-rose-500 to-pink-500",
  },
]

function StepVisual({ step, active }: { step: Step; active: boolean }) {
  const Icon = step.icon
  return (
    <div
      className={`absolute inset-0 transition-all duration-700 ${
        active ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8 pointer-events-none"
      }`}
    >
      <div className="relative h-full w-full rounded-[22px] border bg-card shadow-[0_25px_60px_-15px_rgba(0,0,0,0.25)] dark:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] overflow-hidden ring-1 ring-black/5 dark:ring-white/10 flex flex-col">
        {/* Browser chrome */}
        <div className="bg-gradient-to-b from-muted/70 to-muted/30 px-4 py-3 flex items-center gap-2.5 border-b shrink-0">
          <div className="flex gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-red-400/90" />
            <div className="h-2.5 w-2.5 rounded-full bg-yellow-400/90" />
            <div className="h-2.5 w-2.5 rounded-full bg-green-400/90" />
          </div>
          <div className="flex-1 bg-background/80 rounded-md px-3 py-1 text-[11px] text-muted-foreground border flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            spark-ai.com/pipeline
          </div>
        </div>

        {/* Big glyph */}
        <div className="flex-1 relative flex items-center justify-center p-10">
          <div className={`absolute inset-10 rounded-2xl bg-gradient-to-br ${step.color} opacity-10 blur-3xl`} />
          <div className={`relative h-32 w-32 rounded-3xl bg-gradient-to-br ${step.color} flex items-center justify-center shadow-2xl shadow-black/30`}>
            <Icon className="h-14 w-14 text-white drop-shadow" />
          </div>
        </div>

        {/* Step meta */}
        <div className="px-6 py-5 border-t bg-muted/20 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{step.label}</p>
            <p className="text-sm font-semibold mt-1 tracking-tight">{step.title}</p>
          </div>
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
        </div>
      </div>
    </div>
  )
}

export function StickyScrollSection() {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)

  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return

    const onScroll = () => {
      const r = wrapper.getBoundingClientRect()
      const vh = window.innerHeight
      // Progress across the entire scroll wrapper (0 when entering, 1 when exiting)
      const total = wrapper.offsetHeight - vh
      const scrolled = Math.max(0, -r.top)
      const progress = total > 0 ? Math.min(1, scrolled / total) : 0
      // Map progress to step index
      const idx = Math.min(STEPS.length - 1, Math.floor(progress * STEPS.length))
      setActive(idx)
    }

    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <section className="relative">
      {/* Section intro */}
      <div className="relative py-20 px-6">
        <Reveal className="max-w-3xl mx-auto text-center space-y-4">
          <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.25em] text-amber-500">
            <span className="h-px w-6 bg-amber-500/50" />
            The pipeline
            <span className="h-px w-6 bg-amber-500/50" />
          </span>
          <h2 className="text-4xl lg:text-5xl font-semibold tracking-[-0.035em]">
            What actually happens when you click "Scan"
          </h2>
          <p className="text-muted-foreground text-lg leading-relaxed">
            Four stages. Three seconds. Zero manual work.
          </p>
        </Reveal>
      </div>

      {/* Sticky scroll wrapper — 65vh per step keeps the section tight */}
      <div ref={wrapperRef} style={{ height: `${STEPS.length * 65}vh` }} className="relative">
        <div className="sticky top-0 h-screen flex items-center px-6 overflow-hidden">
          <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">

            {/* Left — text stack, only active one visible */}
            <div className="relative min-h-[320px]">
              {STEPS.map((step, i) => (
                <div
                  key={i}
                  className={`absolute inset-0 transition-all duration-700 flex flex-col justify-center ${
                    i === active
                      ? "opacity-100 translate-y-0"
                      : i < active
                      ? "opacity-0 -translate-y-8 pointer-events-none"
                      : "opacity-0 translate-y-8 pointer-events-none"
                  }`}
                >
                  <div className={`h-1 w-12 rounded-full bg-gradient-to-r ${step.color} mb-5`} />
                  <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-muted-foreground mb-3">
                    {step.label} of {STEPS.length.toString().padStart(2, "0")}
                  </p>
                  <h3 className="text-3xl lg:text-[2.5rem] font-semibold tracking-[-0.035em] leading-[1.1] mb-4">
                    {step.title}
                  </h3>
                  <p className="text-base lg:text-lg text-muted-foreground leading-[1.7] max-w-lg">
                    {step.desc}
                  </p>

                  {/* Step progress dots */}
                  <div className="mt-8 flex items-center gap-2">
                    {STEPS.map((_, j) => (
                      <div
                        key={j}
                        className={`h-1 rounded-full transition-all duration-500 ${
                          j === active
                            ? "w-10 bg-foreground"
                            : j < active
                            ? "w-4 bg-foreground/40"
                            : "w-4 bg-muted-foreground/20"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Right — visual stack */}
            <div className="relative aspect-[4/5] sm:aspect-[4/3] lg:aspect-[5/6]">
              {STEPS.map((step, i) => (
                <StepVisual key={i} step={step} active={i === active} />
              ))}
            </div>

          </div>
        </div>
      </div>
    </section>
  )
}
