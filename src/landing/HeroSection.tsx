import { Search, Sparkles, ArrowRight, Star } from "lucide-react"

interface Props {
  onSignIn: () => void
}

const DEMO_RESULTS = [
  { store: "Amazon AE",    price: "AED 299", original: "AED 499", off: "-40%", color: "bg-orange-500", tag: "#1" },
  { store: "Noon",         price: "AED 319", original: "AED 499", off: "-36%", color: "bg-yellow-400", tag: "#2" },
  { store: "Carrefour",    price: "AED 389", original: null,       off: null,   color: "bg-blue-500",   tag: "#3" },
]

function AppMockup() {
  return (
    <div className="relative w-full max-w-lg mx-auto select-none">
      {/* Glow effect */}
      <div className="absolute inset-0 bg-amber-400/20 dark:bg-amber-400/10 blur-3xl rounded-3xl -z-10 scale-110" />

      {/* Browser card */}
      <div className="rounded-2xl border bg-card shadow-2xl overflow-hidden">
        {/* Browser chrome */}
        <div className="bg-muted/60 px-4 py-2.5 flex items-center gap-2.5 border-b">
          <div className="flex gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
            <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
            <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
          </div>
          <div className="flex-1 bg-background rounded-md px-3 py-1 text-[11px] text-muted-foreground border">
            spark-ai.com/discover
          </div>
        </div>

        {/* App UI */}
        <div className="p-4 space-y-3">
          {/* Search bar */}
          <div className="flex gap-2">
            <div className="flex-1 border rounded-xl px-3 py-2.5 flex items-center gap-2 bg-background">
              <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs text-foreground">Sony WH-1000XM5 headphones</span>
            </div>
            <button className="px-3 py-2.5 rounded-xl bg-amber-500 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0">
              <Sparkles className="h-3 w-3" />
              Search
            </button>
          </div>

          {/* Phase indicator */}
          <div className="flex items-center gap-2 px-1">
            <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] text-muted-foreground">Found 3 results — sorted cheapest first</span>
          </div>

          {/* Results */}
          <div className="space-y-2">
            {DEMO_RESULTS.map((r, i) => (
              <div
                key={r.store}
                className={`flex items-center justify-between border rounded-xl p-2.5 bg-background hover:bg-muted/40 transition-colors ${i === 0 ? "border-amber-500/40 bg-amber-500/5" : ""}`}
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`h-7 w-7 rounded-lg ${r.color} flex items-center justify-center`}>
                    <span className="text-[9px] font-bold text-white">{r.tag}</span>
                  </div>
                  <div>
                    <p className="text-xs font-semibold leading-none">{r.store}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">In stock · Free delivery</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-amber-500">{r.price}</p>
                  {r.original && (
                    <div className="flex items-center gap-1 justify-end">
                      <p className="text-[10px] text-muted-foreground line-through">{r.original}</p>
                      <span className="text-[9px] font-bold text-green-600 bg-green-100 dark:bg-green-900/30 px-1 rounded">{r.off}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Bottom stats */}
          <div className="flex items-center justify-between pt-1 border-t">
            <div className="flex items-center gap-1">
              <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
              <span className="text-[10px] text-muted-foreground">Best deal: Amazon AE saves you AED 200</span>
            </div>
            <span className="text-[10px] text-amber-500 font-medium">1 credit used</span>
          </div>
        </div>
      </div>

      {/* Floating badge */}
      <div className="absolute -top-3 -right-3 bg-green-500 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-full shadow-lg">
        AI-Powered
      </div>
    </div>
  )
}

export function HeroSection({ onSignIn }: Props) {
  return (
    <section className="relative pt-32 pb-20 px-4 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-white via-amber-50/40 to-blue-50/30 dark:from-background dark:via-amber-950/10 dark:to-background -z-10" />
      <div className="absolute top-20 left-1/4 h-64 w-64 bg-amber-400/10 rounded-full blur-3xl -z-10" />
      <div className="absolute top-40 right-1/4 h-48 w-48 bg-blue-400/10 rounded-full blur-3xl -z-10" />

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

        {/* Left — text */}
        <div className="space-y-6">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-xs font-medium shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
            Powered by Claude Vision AI
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-6xl font-black tracking-tight leading-[1.05]">
            Know Every Price.{" "}
            <span className="bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
              Beat Every
            </span>{" "}
            Competitor.
          </h1>

          {/* Sub */}
          <p className="text-lg text-muted-foreground leading-relaxed max-w-lg">
            Spark AI discovers, tracks, and monitors prices across the web in real time — using Claude Vision AI. Built for UAE retailers and global buyers alike.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={onSignIn}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-foreground text-background text-sm font-semibold hover:bg-foreground/90 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
            >
              Get Started Free
              <ArrowRight className="h-4 w-4" />
            </button>
            <a
              href="#how-it-works"
              className="flex items-center gap-2 px-6 py-3 rounded-xl border text-sm font-medium hover:bg-muted/60 transition-colors"
            >
              How it works
            </a>
          </div>

          {/* Trust */}
          <div className="flex items-center gap-6 pt-2">
            <div className="flex items-center gap-1.5">
              <div className="flex -space-x-2">
                {["bg-amber-400", "bg-blue-400", "bg-green-400", "bg-pink-400"].map((c, i) => (
                  <div key={i} className={`h-7 w-7 rounded-full ${c} border-2 border-background`} />
                ))}
              </div>
              <span className="text-xs text-muted-foreground ml-1">500+ businesses</span>
            </div>
            <div className="flex items-center gap-1">
              {[1,2,3,4,5].map(i => (
                <Star key={i} className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
              ))}
              <span className="text-xs text-muted-foreground ml-1">5.0 rating</span>
            </div>
          </div>
        </div>

        {/* Right — mockup */}
        <div className="flex justify-center lg:justify-end">
          <AppMockup />
        </div>

      </div>
    </section>
  )
}
