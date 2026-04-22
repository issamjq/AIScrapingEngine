import { Store, Cpu, Layers, ShieldCheck } from "lucide-react"
import { AnimatedCounter } from "./AnimatedCounter"

const RETAILERS = [
  { name: "Amazon AE",         color: "#FF9900" },
  { name: "Noon",              color: "#FEEE00" },
  { name: "Carrefour",         color: "#004E9F" },
  { name: "Talabat",           color: "#FF5A00" },
  { name: "Spinneys",          color: "#DA291C" },
  { name: "LuLu Hypermarket",  color: "#E60020" },
  { name: "Sharaf DG",         color: "#005AAB" },
  { name: "Virgin Megastore",  color: "#E10A0A" },
  { name: "Jumbo Electronics", color: "#005AA7" },
  { name: "ACE Hardware",      color: "#EE3124" },
  { name: "IKEA",              color: "#0058A3" },
  { name: "Namshi",            color: "#4A4A4A" },
  { name: "Dragon Mart",       color: "#D4AF37" },
  { name: "Mumzworld",         color: "#FF6B9D" },
  { name: "Centrepoint",       color: "#C8102E" },
  { name: "Ounass",            color: "#B68841" },
]

// Rhythm patterns — alternated by index for visual variety
const WEIGHTS = ["font-semibold", "font-medium", "font-bold", "font-medium", "font-semibold", "font-medium"]
const OPACITY = ["text-foreground/70", "text-foreground/50", "text-foreground/65", "text-foreground/55", "text-foreground/75", "text-foreground/50"]

const STATS: { icon: typeof Store; render: () => React.ReactNode; label: string }[] = [
  { icon: Store,       render: () => <><AnimatedCounter value={10} />+</>, label: "UAE retailers"     },
  { icon: Cpu,         render: () => "Vision",                              label: "AI extraction"     },
  { icon: Layers,      render: () => "24/7",                                label: "Auto sync"         },
  { icon: ShieldCheck, render: () => "SOC-ready",                           label: "Secure & private"  },
]

export function StatsBar() {
  return (
    <section className="relative border-y bg-gradient-to-b from-muted/40 via-background to-muted/30 overflow-hidden">
      {/* Retailer marquee */}
      <div className="py-10 px-6 relative">
        <p className="text-center text-[11px] font-bold uppercase tracking-[0.25em] text-muted-foreground mb-7">
          Tracking live across UAE's top marketplaces
        </p>

        <div className="relative [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)] [webkit-mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
          <div className="flex gap-14 animate-[marquee_55s_linear_infinite] w-max">
            {[...RETAILERS, ...RETAILERS, ...RETAILERS, ...RETAILERS].map((r, i) => {
              const baseIdx = i % RETAILERS.length
              const weight  = WEIGHTS[baseIdx % WEIGHTS.length]
              const opacity = OPACITY[baseIdx % OPACITY.length]
              return (
                <span
                  key={`${r.name}-${i}`}
                  className={`group inline-flex items-center gap-2.5 text-xl sm:text-2xl tracking-[-0.02em] whitespace-nowrap select-none transition-all hover:text-foreground hover:scale-[1.03] ${weight} ${opacity}`}
                >
                  <span
                    className="inline-block h-2 w-2 rounded-full shadow-sm transition-transform group-hover:scale-150"
                    style={{ backgroundColor: r.color, boxShadow: `0 0 10px ${r.color}55` }}
                  />
                  {r.name}
                </span>
              )
            })}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="max-w-7xl mx-auto px-6 pb-12 pt-10 grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-4 border-t">
        {STATS.map(({ icon: Icon, render, label }) => (
          <div key={label} className="flex flex-col sm:flex-row items-center sm:items-start gap-3 text-center sm:text-left">
            <div className="h-11 w-11 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/10 shrink-0">
              <Icon className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-semibold tracking-tight leading-none">{render()}</p>
              <p className="text-[11px] sm:text-xs text-muted-foreground font-medium mt-1.5 uppercase tracking-wider">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes marquee {
          0%   { transform: translateX(0) }
          100% { transform: translateX(-25%) }
        }
      `}</style>
    </section>
  )
}
