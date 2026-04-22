import { useEffect, useState } from "react"
import { Search, Sparkles, ArrowRight, Star, TrendingDown, CheckCircle2 } from "lucide-react"
import { useMouseGlow, useMagnetic, GRAIN_SVG } from "./utils"

interface Props {
  onAction:    (target?: string) => void
  isLoggedIn?: boolean
}

// Cycling demo queries + their pre-computed results
const DEMOS = [
  {
    query: "Sony WH-1000XM5 headphones",
    results: [
      { store: "Amazon AE",  price: "AED 299", original: "AED 499", off: "-40%", initials: "A", tint: "from-orange-500 to-amber-500", pill: "Best price" },
      { store: "Noon",       price: "AED 319", original: "AED 499", off: "-36%", initials: "N", tint: "from-yellow-400 to-orange-400", pill: null },
      { store: "Carrefour",  price: "AED 389", original: null,      off: null,   initials: "C", tint: "from-blue-500 to-indigo-500",   pill: null },
    ],
    saves: "AED 200",
  },
  {
    query: "Dyson V15 Detect vacuum",
    results: [
      { store: "Sharaf DG",   price: "AED 2,199", original: "AED 2,599", off: "-15%", initials: "S", tint: "from-blue-500 to-sky-500",       pill: "Best price" },
      { store: "Amazon AE",   price: "AED 2,249", original: "AED 2,599", off: "-13%", initials: "A", tint: "from-orange-500 to-amber-500",  pill: null },
      { store: "Noon",        price: "AED 2,349", original: null,        off: null,   initials: "N", tint: "from-yellow-400 to-orange-400", pill: null },
    ],
    saves: "AED 400",
  },
  {
    query: "Apple AirPods Pro 2",
    results: [
      { store: "Virgin",     price: "AED 749", original: "AED 899", off: "-17%", initials: "V", tint: "from-rose-500 to-red-500",       pill: "Best price" },
      { store: "Amazon AE",  price: "AED 769", original: "AED 899", off: "-14%", initials: "A", tint: "from-orange-500 to-amber-500",   pill: null },
      { store: "Jumbo",      price: "AED 799", original: null,      off: null,   initials: "J", tint: "from-indigo-500 to-blue-500",    pill: null },
    ],
    saves: "AED 150",
  },
]

function Typer({ text }: { text: string }) {
  // Progressive reveal — fixed width so layout doesn't jump
  const [n, setN] = useState(0)

  useEffect(() => {
    setN(0)
    let i = 0
    const t = setInterval(() => {
      i += 1
      setN(i)
      if (i >= text.length) clearInterval(t)
    }, 45)
    return () => clearInterval(t)
  }, [text])

  return (
    <span className="text-xs text-foreground">
      {text.slice(0, n)}
      <span className="inline-block w-[1px] h-3 bg-foreground/70 align-middle ml-px animate-pulse" />
    </span>
  )
}

function AppMockup() {
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % DEMOS.length), 5500)
    return () => clearInterval(t)
  }, [])

  const demo = DEMOS[idx]

  return (
    <div className="relative w-full max-w-xl mx-auto select-none">
      {/* Ambient orbs */}
      <div className="pointer-events-none absolute -inset-10 -z-10">
        <div className="absolute top-0 right-0 h-56 w-56 bg-amber-400/25 dark:bg-amber-400/15 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 h-56 w-56 bg-orange-400/20 dark:bg-orange-500/10 rounded-full blur-3xl" />
      </div>

      {/* Floating side cards */}
      <div className="hidden lg:flex absolute -left-10 top-16 z-10 items-center gap-2.5 rounded-2xl bg-background/90 backdrop-blur-md border shadow-xl px-3.5 py-2.5 animate-[float_6s_ease-in-out_infinite]">
        <div className="h-8 w-8 rounded-xl bg-green-500/15 flex items-center justify-center">
          <TrendingDown className="h-4 w-4 text-green-500" />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">You save</p>
          <p key={demo.saves} className="text-sm font-bold animate-[pulseFade_600ms_ease-out]">{demo.saves}</p>
        </div>
      </div>

      <div className="hidden lg:flex absolute -right-8 bottom-20 z-10 items-center gap-2.5 rounded-2xl bg-background/90 backdrop-blur-md border shadow-xl px-3.5 py-2.5 animate-[float_7s_ease-in-out_infinite_reverse]">
        <div className="h-8 w-8 rounded-xl bg-amber-500/15 flex items-center justify-center">
          <Sparkles className="h-4 w-4 text-amber-500" />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Vision AI</p>
          <p className="text-sm font-bold">Scanned in 2.4s</p>
        </div>
      </div>

      {/* Browser card */}
      <div className="relative rounded-[22px] border bg-card shadow-[0_30px_80px_-20px_rgba(0,0,0,0.3)] dark:shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] overflow-hidden ring-1 ring-black/5 dark:ring-white/10">
        <div className="bg-gradient-to-b from-muted/70 to-muted/30 px-4 py-3 flex items-center gap-2.5 border-b">
          <div className="flex gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-red-400/90" />
            <div className="h-2.5 w-2.5 rounded-full bg-yellow-400/90" />
            <div className="h-2.5 w-2.5 rounded-full bg-green-400/90" />
          </div>
          <div className="flex-1 bg-background/80 rounded-md px-3 py-1 text-[11px] text-muted-foreground border flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            spark-ai.com/discover
          </div>
        </div>

        <div className="p-4 space-y-3">
          {/* Search bar — typing animation */}
          <div className="flex gap-2">
            <div className="flex-1 border rounded-xl px-3 py-2.5 flex items-center gap-2 bg-background">
              <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <Typer text={demo.query} />
            </div>
            <button className="px-3 py-2.5 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0 shadow-md shadow-amber-500/30">
              <Sparkles className="h-3 w-3" />
              Search
            </button>
          </div>

          {/* Phase indicator */}
          <div className="flex items-center gap-2 px-1">
            <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] text-muted-foreground">Scanned 6 retailers · 3 results · Cheapest first</span>
            <span className="ml-auto text-[9px] font-semibold text-green-600 dark:text-green-400">LIVE</span>
          </div>

          {/* Results */}
          <div key={idx} className="space-y-2">
            {demo.results.map((r, i) => (
              <div
                key={`${idx}-${r.store}`}
                className={`relative flex items-center justify-between border rounded-xl p-2.5 transition-all animate-[rowIn_500ms_ease-out_both] ${
                  i === 0
                    ? "border-amber-500/50 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent shadow-sm"
                    : "bg-background"
                }`}
                style={{ animationDelay: `${i * 120}ms` }}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`h-9 w-9 rounded-xl bg-gradient-to-br ${r.tint} flex items-center justify-center shadow-sm`}>
                    <span className="text-xs font-black text-white">{r.initials}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-semibold leading-none">{r.store}</p>
                      {r.pill && (
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">{r.pill}</span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">In stock · Free delivery</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">{r.price}</p>
                  {r.original && (
                    <div className="flex items-center gap-1 justify-end">
                      <p className="text-[10px] text-muted-foreground line-through">{r.original}</p>
                      <span className="text-[9px] font-bold text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-1.5 rounded">{r.off}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              <span className="text-[10px] text-muted-foreground">Best deal saves you <span className="font-bold text-foreground">{demo.saves}</span></span>
            </div>
            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">1 credit</span>
          </div>

          {/* Progress dots */}
          <div className="flex items-center justify-center gap-1.5 pt-1">
            {DEMOS.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className={`h-1 rounded-full transition-all ${i === idx ? "w-6 bg-amber-500" : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50"}`}
                aria-label={`Show demo ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function HeroSection({ onAction, isLoggedIn }: Props) {
  const glowRef    = useMouseGlow<HTMLElement>()
  const primaryRef = useMagnetic<HTMLButtonElement>(0.2)

  return (
    <section ref={glowRef} className="hero-glow relative pt-32 pb-28 px-6 overflow-hidden min-h-[94vh] flex items-center">
      {/* Background base */}
      <div className="absolute inset-0 bg-gradient-to-b from-white via-amber-50/30 to-white dark:from-background dark:via-amber-950/5 dark:to-background -z-20" />

      {/* Grid pattern with radial mask */}
      <div
        className="absolute inset-0 -z-10 opacity-[0.25] dark:opacity-[0.18]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgb(0 0 0 / 0.06) 1px, transparent 1px), linear-gradient(to bottom, rgb(0 0 0 / 0.06) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse 75% 60% at 50% 40%, black 40%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 75% 60% at 50% 40%, black 40%, transparent 100%)",
        }}
      />

      {/* Mouse-tracked glow */}
      <div
        className="absolute inset-0 -z-10 pointer-events-none transition-opacity"
        style={{
          background: "radial-gradient(600px circle at var(--mx,50%) var(--my,30%), rgba(245, 158, 11, 0.18), transparent 60%)",
        }}
      />

      {/* Aurora blobs */}
      <div className="absolute top-10 left-[15%] h-80 w-80 bg-amber-400/25 dark:bg-amber-500/15 rounded-full blur-3xl -z-10 animate-[pulse_8s_ease-in-out_infinite]" />
      <div className="absolute top-40 right-[12%] h-72 w-72 bg-orange-400/20 dark:bg-orange-500/10 rounded-full blur-3xl -z-10 animate-[pulse_10s_ease-in-out_infinite]" />
      <div className="absolute bottom-10 left-[35%] h-56 w-56 bg-rose-400/15 dark:bg-rose-500/10 rounded-full blur-3xl -z-10" />

      {/* Grain overlay */}
      <div
        className="absolute inset-0 -z-10 pointer-events-none opacity-[0.08] dark:opacity-[0.12] mix-blend-overlay"
        style={{ backgroundImage: GRAIN_SVG, backgroundSize: "200px 200px" }}
      />

      <div className="w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] gap-16 lg:gap-20 items-center relative">

        {/* Left — text */}
        <div className="space-y-7 relative">
          <div className="hero-item inline-flex items-center gap-2 rounded-full border border-amber-500/25 bg-amber-500/5 backdrop-blur-sm px-3.5 py-1.5 text-xs font-semibold shadow-sm" style={{ animationDelay: "0ms" }}>
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75 animate-ping" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
            </span>
            <span className="bg-gradient-to-r from-amber-600 to-orange-600 dark:from-amber-400 dark:to-orange-400 bg-clip-text text-transparent">
              Powered by Spark Vision AI
            </span>
          </div>

          <h1 className="hero-item text-[2.75rem] sm:text-6xl lg:text-[5rem] font-semibold tracking-[-0.04em] leading-[1.02]" style={{ animationDelay: "120ms" }}>
            Know every price.
            <br />
            <span className="relative inline-block">
              <span className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 bg-clip-text text-transparent">
                Beat every
              </span>
              <svg className="absolute -bottom-1 left-0 w-full" viewBox="0 0 300 8" preserveAspectRatio="none" aria-hidden="true">
                <path d="M2,5 C80,0 180,0 298,4" stroke="url(#heroStroke)" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                <defs>
                  <linearGradient id="heroStroke" x1="0" x2="1">
                    <stop offset="0%"   stopColor="#F59E0B" />
                    <stop offset="50%"  stopColor="#F97316" />
                    <stop offset="100%" stopColor="#F43F5E" />
                  </linearGradient>
                </defs>
              </svg>
            </span>{" "}
            competitor.
          </h1>

          <p className="hero-item text-lg sm:text-xl text-muted-foreground leading-[1.65] max-w-xl" style={{ animationDelay: "220ms" }}>
            Spark AI discovers, tracks, and monitors prices across the web in real time — using Vision AI to read every product page like a human. Built for UAE retailers and global buyers alike.
          </p>

          <div className="hero-item flex flex-wrap gap-3 pt-2" style={{ animationDelay: "320ms" }}>
            <button
              ref={primaryRef}
              onClick={() => onAction("discovering")}
              className="group relative flex items-center gap-2 px-6 py-3.5 rounded-xl bg-foreground text-background text-sm font-semibold shadow-[0_8px_24px_-6px_rgba(0,0,0,0.3)] hover:shadow-[0_12px_32px_-6px_rgba(0,0,0,0.4)] transition-[box-shadow,transform] duration-200 overflow-hidden"
              style={{ transition: "transform 250ms cubic-bezier(0.16,1,0.3,1), box-shadow 250ms" }}
            >
              <span className="absolute inset-0 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="relative flex items-center gap-2">
                {isLoggedIn ? "Open Market Intelligence" : "Get started free"}
                <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </button>
            <a
              href="#how-it-works"
              className="flex items-center gap-2 px-6 py-3.5 rounded-xl border text-sm font-medium bg-background/60 backdrop-blur-sm hover:bg-muted/60 transition-colors"
            >
              See how it works
            </a>
          </div>

          <div className="hero-item flex flex-wrap items-center gap-x-6 gap-y-3 pt-3" style={{ animationDelay: "420ms" }}>
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {["from-amber-400 to-orange-500", "from-blue-400 to-indigo-500", "from-green-400 to-emerald-500", "from-pink-400 to-rose-500"].map((c, i) => (
                  <div key={i} className={`h-7 w-7 rounded-full bg-gradient-to-br ${c} border-2 border-background shadow-sm`} />
                ))}
              </div>
              <span className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">500+ retailers</span> tracking live
              </span>
            </div>
            <div className="h-4 w-px bg-border hidden sm:block" />
            <div className="flex items-center gap-1.5">
              {[1,2,3,4,5].map(i => (
                <Star key={i} className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
              ))}
              <span className="text-xs text-muted-foreground ml-1"><span className="font-semibold text-foreground">5.0</span> from early users</span>
            </div>
          </div>
        </div>

        <div className="hero-item flex justify-center lg:justify-end" style={{ animationDelay: "300ms" }}>
          <AppMockup />
        </div>

      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) }
          50%      { transform: translateY(-10px) }
        }
        @keyframes heroIn {
          from { opacity: 0; transform: translateY(24px) }
          to   { opacity: 1; transform: translateY(0) }
        }
        @keyframes rowIn {
          from { opacity: 0; transform: translateY(8px) }
          to   { opacity: 1; transform: translateY(0) }
        }
        @keyframes pulseFade {
          0%   { opacity: 0.3; transform: scale(0.95) }
          100% { opacity: 1;   transform: scale(1) }
        }
        .hero-item {
          opacity: 0;
          animation: heroIn 900ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @media (prefers-reduced-motion: reduce) {
          .hero-item { animation: none; opacity: 1; }
        }
      `}</style>
    </section>
  )
}
