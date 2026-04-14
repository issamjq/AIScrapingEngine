import { TrendingUp, Users, ShoppingBag, Bell } from "lucide-react"

const FEATURES = [
  { icon: TrendingUp,  title: "Trending Products",   desc: "Discover which products are going viral on TikTok Shop right now — before everyone else." },
  { icon: Users,       title: "Creator Analytics",   desc: "Find the best affiliate creators for your products by niche, engagement, and GMV performance." },
  { icon: ShoppingBag, title: "Shop Intelligence",   desc: "See your competitors' TikTok Shop data — bestsellers, pricing, and sales velocity." },
  { icon: Bell,        title: "Trend Alerts",        desc: "Get notified the moment a product starts trending so you can move first." },
]

export function TikTokTeaser() {
  return (
    <section className="py-20 px-4 relative overflow-hidden">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-pink-500/8 via-purple-500/8 to-background dark:from-pink-500/15 dark:via-purple-500/15 dark:to-background -z-10" />
      <div className="absolute top-0 left-1/4 h-64 w-64 bg-pink-500/10 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-0 right-1/4 h-48 w-48 bg-purple-500/10 rounded-full blur-3xl -z-10" />

      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12 space-y-4">
          <span className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full bg-pink-500/10 text-pink-500 border border-pink-500/20">
            Coming Soon
          </span>
          <h2 className="text-4xl font-black tracking-tight">
            TikTok Intelligence
            <span className="block text-2xl font-bold text-muted-foreground mt-1">Market analytics for TikTok Shop sellers</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Like Kalodata, but smarter. Built directly into Spark AI — track trending products, analyze creator performance, and spy on competitor shops — all from one place.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="p-5 rounded-2xl border bg-background/60 backdrop-blur-sm hover:bg-background/80 transition-colors group">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-pink-500/20 to-purple-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Icon className="h-5 w-5 text-pink-500" />
              </div>
              <h3 className="text-sm font-bold mb-2">{title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        {/* Notify CTA */}
        <div className="mt-10 flex flex-col items-center gap-3">
          <p className="text-sm text-muted-foreground">Be the first to know when it launches</p>
          <div className="flex gap-2 w-full max-w-sm">
            <input
              type="email"
              placeholder="your@email.com"
              className="flex-1 px-4 py-2.5 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/30"
              disabled
            />
            <button disabled className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 text-white text-sm font-semibold opacity-60 cursor-not-allowed">
              Notify me
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground">Early access coming Q3 2026</p>
        </div>
      </div>
    </section>
  )
}
