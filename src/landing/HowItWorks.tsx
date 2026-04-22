import { Upload, Cpu, TrendingDown } from "lucide-react"
import { Reveal } from "./Reveal"

const STEPS = [
  {
    icon:    Upload,
    number:  "01",
    title:   "Add your products",
    desc:    "Import your catalog via CSV or add products manually. Connect Amazon AE, Noon, Carrefour, and more.",
    tint:    "from-blue-500/20 to-indigo-500/5",
    ring:    "ring-blue-500/20",
    color:   "text-blue-500",
  },
  {
    icon:    Cpu,
    number:  "02",
    title:   "AI reads every page",
    desc:    "Spark Vision AI scrapes product pages and extracts prices, availability, and promotions — even from dynamic JavaScript sites.",
    tint:    "from-amber-500/25 to-orange-500/5",
    ring:    "ring-amber-500/30",
    color:   "text-amber-500",
  },
  {
    icon:    TrendingDown,
    number:  "03",
    title:   "Track & stay ahead",
    desc:    "Get notified of price changes. See 30-day history. Always know when a competitor drops price — before your customers do.",
    tint:    "from-emerald-500/20 to-green-500/5",
    ring:    "ring-emerald-500/20",
    color:   "text-emerald-500",
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative py-28 px-6 overflow-hidden">
      {/* background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-muted/20 to-background -z-10" />
      <div
        className="absolute inset-0 -z-10 opacity-[0.2] dark:opacity-[0.12]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgb(0 0 0 / 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgb(0 0 0 / 0.05) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse 60% 50% at 50% 50%, black 40%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 60% 50% at 50% 50%, black 40%, transparent 100%)",
        }}
      />

      <div className="max-w-7xl mx-auto">
        <Reveal className="text-center mb-16 space-y-4">
          <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.25em] text-amber-500">
            <span className="h-px w-6 bg-amber-500/50" />
            How it works
            <span className="h-px w-6 bg-amber-500/50" />
          </span>
          <h2 className="text-4xl lg:text-5xl font-semibold tracking-[-0.035em]">Up and running in minutes</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg leading-relaxed">
            No scraping knowledge needed. No setup complexity. Just connect, search, and watch the prices roll in.
          </p>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 relative">
          {/* Connector line (desktop only) */}
          <div className="hidden md:block absolute top-[72px] left-[16%] right-[16%] h-px bg-gradient-to-r from-transparent via-border to-transparent" />

          {STEPS.map(({ icon: Icon, number, title, desc, tint, ring, color }, i) => (
            <Reveal key={number} delay={i * 140} scale>
            <div
              className="group relative flex flex-col items-start gap-5 p-7 rounded-2xl bg-background/60 backdrop-blur-sm border hover:border-foreground/15 hover:shadow-xl hover:-translate-y-1 transition-all h-full"
            >
              {/* top accent line */}
              <div className={`absolute inset-x-7 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent`} />

              {/* Step number (huge, muted) */}
              <span className="absolute top-4 right-5 text-5xl font-bold tracking-tighter text-muted-foreground/10 group-hover:text-muted-foreground/20 transition-colors leading-none select-none">
                {number}
              </span>

              {/* Icon */}
              <div className={`relative h-14 w-14 rounded-2xl bg-gradient-to-br ${tint} ring-1 ${ring} flex items-center justify-center shadow-inner`}>
                <Icon className={`h-6 w-6 ${color}`} />
              </div>

              <div>
                <h3 className="text-lg font-semibold tracking-tight mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>

              {/* hairline bottom accent */}
              <div className={`h-0.5 w-10 rounded-full bg-gradient-to-r ${tint.replace("/20", "/60").replace("/5", "/30")}`} />

              {/* Step number chip (bottom left) */}
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                Step {i + 1}
              </span>
            </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
