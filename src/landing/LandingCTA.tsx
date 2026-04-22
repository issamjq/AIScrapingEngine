import { ArrowRight, Sparkles, Check } from "lucide-react"
import { Reveal } from "./Reveal"
import { useMagnetic, GRAIN_SVG } from "./utils"

interface Props {
  onAction:    (target?: string) => void
  isLoggedIn?: boolean
}

const PLANS = [
  { name: "Free",    credits: "20–60 credits",  price: "$0",   highlight: false, desc: "Try it, no card required" },
  { name: "Starter", credits: "180 credits/mo", price: "$29",  highlight: false, desc: "For growing teams"        },
  { name: "Pro",     credits: "600 credits/mo", price: "$69",  highlight: true,  desc: "Most popular — save 30%"  },
]

export function LandingCTA({ onAction, isLoggedIn }: Props) {
  const primaryRef = useMagnetic<HTMLButtonElement>(0.18)
  return (
    <section id="pricing" className="py-28 px-6">
      <Reveal scale className="max-w-5xl mx-auto">
        <div className="relative rounded-[28px] overflow-hidden border bg-background shadow-[0_30px_80px_-20px_rgba(0,0,0,0.25)] dark:shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)]">
          {/* Aurora mesh bg */}
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-amber-500/10 via-rose-500/5 to-background dark:from-amber-500/15 dark:via-rose-500/10 dark:to-background" />
          <div className="absolute top-0 left-1/4 h-72 w-72 bg-amber-400/25 dark:bg-amber-500/20 rounded-full blur-3xl -z-10" />
          <div className="absolute bottom-0 right-1/4 h-72 w-72 bg-rose-400/20 dark:bg-rose-500/15 rounded-full blur-3xl -z-10" />

          {/* Grid overlay */}
          <div
            className="absolute inset-0 -z-10 opacity-[0.2] dark:opacity-[0.1]"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgb(0 0 0 / 0.06) 1px, transparent 1px), linear-gradient(to bottom, rgb(0 0 0 / 0.06) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
              maskImage: "radial-gradient(ellipse 70% 60% at 50% 40%, black 40%, transparent 100%)",
              WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 40%, black 40%, transparent 100%)",
            }}
          />

          {/* Grain */}
          <div
            className="absolute inset-0 -z-10 pointer-events-none opacity-[0.08] dark:opacity-[0.12] mix-blend-overlay"
            style={{ backgroundImage: GRAIN_SVG, backgroundSize: "200px 200px" }}
          />

          <div className="px-6 sm:px-12 py-14 sm:py-16 text-center">
            <div className="space-y-5 mb-10">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-background/60 backdrop-blur-sm px-3.5 py-1.5 text-xs font-semibold">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                <span className="bg-gradient-to-r from-amber-600 to-orange-600 dark:from-amber-400 dark:to-orange-400 bg-clip-text text-transparent">
                  No credit card required
                </span>
              </div>

              <h2 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-semibold tracking-[-0.035em] leading-[1.05] max-w-3xl mx-auto">
                Ready to dominate{" "}
                <span className="bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">your market?</span>
              </h2>

              <p className="text-muted-foreground text-lg max-w-xl mx-auto leading-relaxed">
                Start for free. Get up to 60 credits on signup. Upgrade only when you need more — cancel anytime.
              </p>
            </div>

            {/* Plan cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-10 max-w-3xl mx-auto">
              {PLANS.map((p, i) => (
                <Reveal key={p.name} delay={200 + i * 100} y={16}>
                <div
                  className={`relative rounded-2xl border p-5 text-left transition-all hover:-translate-y-0.5 h-full ${
                    p.highlight
                      ? "border-amber-500/60 bg-gradient-to-b from-amber-500/15 to-amber-500/5 shadow-lg shadow-amber-500/10"
                      : "bg-background/60 backdrop-blur-sm hover:border-foreground/15"
                  }`}
                >
                  {p.highlight && (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-bold uppercase tracking-[0.15em] px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md">
                      Popular
                    </span>
                  )}
                  <p className={`text-sm font-bold mb-1 ${p.highlight ? "text-amber-600 dark:text-amber-400" : ""}`}>{p.name}</p>
                  <p className="text-2xl font-semibold tracking-tight">
                    {p.price}
                    <span className="text-xs font-medium text-muted-foreground">/mo</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1.5">{p.credits}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{p.desc}</p>
                </div>
                </Reveal>
              ))}
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                ref={primaryRef}
                onClick={() => onAction("discovering")}
                className="group relative flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-foreground text-background text-sm font-semibold shadow-[0_12px_32px_-6px_rgba(0,0,0,0.35)] hover:shadow-[0_16px_40px_-6px_rgba(0,0,0,0.45)] overflow-hidden"
                style={{ transition: "transform 250ms cubic-bezier(0.16,1,0.3,1), box-shadow 250ms" }}
              >
                <span className="absolute inset-0 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="relative flex items-center gap-2">
                  {isLoggedIn ? "Open App" : "Get started free"}
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </button>
              <a
                href="#how-it-works"
                className="flex items-center justify-center gap-2 px-8 py-4 rounded-xl border bg-background/60 backdrop-blur-sm text-sm font-medium hover:bg-muted/60 transition-colors"
              >
                See how it works
              </a>
            </div>

            {/* Fine print bullets */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
              {["Cancel anytime", "Free credits on signup", "Secure OAuth sign-in"].map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  )
}
