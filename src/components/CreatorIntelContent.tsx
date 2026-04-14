import { TrendingUp, Users, ShoppingBag, BarChart2, Sparkles } from "lucide-react"

interface Props {
  role?: string
}

const FEATURES = [
  { icon: TrendingUp,  title: "Trending Products",   desc: "Discover which products are going viral on TikTok Shop before your competitors catch on." },
  { icon: Users,       title: "Creator Analytics",   desc: "Identify top-performing creators by niche, engagement rate, and GMV — ready to collaborate." },
  { icon: ShoppingBag, title: "Shop Intelligence",   desc: "Full TikTok Shop market data: top sellers, pricing, and category-level revenue estimates." },
  { icon: BarChart2,   title: "Trend Forecasting",   desc: "AI-powered signals that predict which products are about to spike — act before the wave." },
]

export function CreatorIntelContent({ role: _role }: Props) {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-6 py-20 text-center">

      {/* Badge */}
      <div className="inline-flex items-center gap-2 rounded-full border border-pink-500/30 bg-pink-500/10 px-3 py-1.5 text-xs font-semibold text-pink-500 mb-6">
        <Sparkles className="h-3.5 w-3.5" />
        Creator Intelligence — Coming Q3 2026
      </div>

      {/* Headline */}
      <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-4 max-w-2xl">
        The TikTok Shop Intelligence Platform
      </h1>
      <p className="text-muted-foreground text-lg max-w-xl mb-14 leading-relaxed">
        Track trending products, top creators, and shop performance across TikTok — the same data that powers 8-figure TikTok sellers.
      </p>

      {/* Feature cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-3xl mb-14">
        {FEATURES.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="flex items-start gap-4 p-5 rounded-2xl border bg-card text-left hover:shadow-md transition-shadow">
            <div className="h-10 w-10 rounded-xl bg-pink-500/10 flex items-center justify-center shrink-0">
              <Icon className="h-5 w-5 text-pink-500" />
            </div>
            <div>
              <p className="text-sm font-semibold mb-1">{title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Notify CTA */}
      <div className="flex flex-col sm:flex-row gap-3 items-center">
        <input
          disabled
          placeholder="Enter your email for early access"
          className="w-72 px-4 py-3 rounded-xl border bg-muted/40 text-sm text-muted-foreground placeholder:text-muted-foreground/60 cursor-not-allowed"
        />
        <button
          disabled
          className="px-6 py-3 rounded-xl bg-pink-500/80 text-white text-sm font-semibold opacity-60 cursor-not-allowed"
        >
          Notify Me
        </button>
      </div>
      <p className="text-xs text-muted-foreground mt-3">Early access opens Q3 2026 — be first in line.</p>

    </div>
  )
}
