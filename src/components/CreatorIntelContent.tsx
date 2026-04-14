import { TrendingUp, Users, ShoppingBag, BarChart2, Flame, Star, Lock, ArrowUpRight, Search } from "lucide-react"

interface Props {
  role?: string
}

// ─── Dummy Data ───────────────────────────────────────────────────────────────

const TRENDING_PRODUCTS = [
  { rank: 1,  name: "Stanley Quencher 40oz Tumbler",       category: "Kitchen",     gmv: "$2.4M",  growth: "+312%", price: "$45",  img: "bg-blue-400" },
  { rank: 2,  name: "Argan Oil Hair Serum 100ml",          category: "Beauty",      gmv: "$1.8M",  growth: "+248%", price: "$18",  img: "bg-amber-400" },
  { rank: 3,  name: "Magnetic Phone Wallet Case",          category: "Accessories", gmv: "$1.2M",  growth: "+189%", price: "$22",  img: "bg-green-400" },
  { rank: 4,  name: "LED Acne Light Therapy Mask",         category: "Skincare",    gmv: "$980K",  growth: "+167%", price: "$79",  img: "bg-purple-400" },
  { rank: 5,  name: "Portable Blender Bottle 500ml",       category: "Fitness",     gmv: "$870K",  growth: "+143%", price: "$35",  img: "bg-red-400" },
]

const TOP_CREATORS = [
  { name: "Sarah M.",     handle: "@sarahbeautylab",   niche: "Skincare",   followers: "4.2M",  gmv: "$320K",  score: 98, color: "bg-pink-400" },
  { name: "James K.",     handle: "@jamesfitlife",     niche: "Fitness",    followers: "2.8M",  gmv: "$218K",  score: 95, color: "bg-blue-400" },
  { name: "Priya S.",     handle: "@priyahomecooks",   niche: "Kitchen",    followers: "1.9M",  gmv: "$187K",  score: 93, color: "bg-amber-400" },
  { name: "Leo C.",       handle: "@leotechreviews",   niche: "Tech",       followers: "3.1M",  gmv: "$164K",  score: 90, color: "bg-green-400" },
]

const CATEGORIES = [
  { name: "Beauty & Skincare", share: 34, gmv: "$8.2M",  color: "bg-pink-500" },
  { name: "Kitchen & Home",    share: 22, gmv: "$5.3M",  color: "bg-amber-500" },
  { name: "Fitness",           share: 18, gmv: "$4.3M",  color: "bg-blue-500" },
  { name: "Fashion",           share: 14, gmv: "$3.4M",  color: "bg-purple-500" },
  { name: "Electronics",       share: 12, gmv: "$2.9M",  color: "bg-green-500" },
]

const STATS = [
  { icon: Flame,      label: "Trending Now",     value: "2,847",   sub: "+312 this week",  color: "text-orange-500",  bg: "bg-orange-500/10" },
  { icon: BarChart2,  label: "Total GMV Tracked", value: "$24.1M",  sub: "7-day period",    color: "text-amber-500",   bg: "bg-amber-500/10" },
  { icon: Users,      label: "Active Creators",   value: "18,420",  sub: "in database",     color: "text-blue-500",    bg: "bg-blue-500/10" },
  { icon: ShoppingBag,label: "TikTok Shops",      value: "3,291",   sub: "monitored daily", color: "text-pink-500",    bg: "bg-pink-500/10" },
]

// ─── Coming Soon Overlay ──────────────────────────────────────────────────────

function ComingSoonOverlay({ label = "Coming Q3 2026" }: { label?: string }) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-xl bg-background/60 backdrop-blur-[3px]">
      <div className="flex flex-col items-center gap-2 px-4 text-center">
        <div className="h-10 w-10 rounded-full bg-pink-500/10 flex items-center justify-center">
          <Lock className="h-5 w-5 text-pink-500" />
        </div>
        <p className="text-sm font-bold">{label}</p>
        <p className="text-xs text-muted-foreground">Join the waitlist for early access</p>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CreatorIntelContent({ role: _role }: Props) {
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-black tracking-tight">Creator Intelligence</h1>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-pink-500/10 text-pink-500 border border-pink-500/20">
              Coming Q3 2026
            </span>
          </div>
          <p className="text-sm text-muted-foreground">TikTok shop analytics, trending products & creator performance — all in one place.</p>
        </div>
        <button disabled className="flex items-center gap-2 px-4 py-2 rounded-xl bg-pink-500/80 text-white text-sm font-semibold opacity-60 cursor-not-allowed shrink-0">
          Get Early Access
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS.map(({ icon: Icon, label, value, sub, color, bg }) => (
          <div key={label} className="rounded-xl border bg-card p-4">
            <div className={`h-9 w-9 rounded-lg ${bg} flex items-center justify-center mb-3`}>
              <Icon className={`h-5 w-5 ${color}`} />
            </div>
            <p className="text-2xl font-black tracking-tight">{value}</p>
            <p className="text-xs font-medium mt-0.5">{label}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* ── Trending Products table (2/3 width) ── */}
        <div className="xl:col-span-2 rounded-xl border bg-card overflow-hidden relative">
          <ComingSoonOverlay />

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-bold">Trending Products</span>
              <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">7-day GMV</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 border rounded-lg px-3 py-1.5 text-xs text-muted-foreground bg-background">
                <Search className="h-3 w-3" />
                Filter by category…
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="divide-y">
            {TRENDING_PRODUCTS.map((p) => (
              <div key={p.rank} className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/30 transition-colors">
                <span className="text-sm font-black text-muted-foreground w-5 shrink-0">#{p.rank}</span>
                <div className={`h-9 w-9 rounded-lg ${p.img} shrink-0`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{p.name}</p>
                  <p className="text-[11px] text-muted-foreground">{p.category}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold">{p.gmv}</p>
                  <p className="text-[11px] text-muted-foreground">{p.price} avg</p>
                </div>
                <div className="shrink-0">
                  <span className="text-xs font-bold text-green-600 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
                    {p.growth}
                  </span>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t bg-muted/20 text-center">
            <p className="text-xs text-muted-foreground">Showing top 5 of <span className="font-semibold text-foreground">2,847</span> trending products</p>
          </div>
        </div>

        {/* ── Category Breakdown (1/3 width) ── */}
        <div className="rounded-xl border bg-card overflow-hidden relative">
          <ComingSoonOverlay />

          <div className="px-5 py-4 border-b flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-bold">Category GMV</span>
            <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full ml-auto">This week</span>
          </div>

          <div className="p-5 space-y-4">
            {CATEGORIES.map(({ name, share, gmv, color }) => (
              <div key={name}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium">{name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{gmv}</span>
                    <span className="text-[10px] font-bold text-muted-foreground">{share}%</span>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full rounded-full ${color}`} style={{ width: `${share}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Top Creators grid ── */}
      <div className="rounded-xl border bg-card overflow-hidden relative">
        <ComingSoonOverlay />

        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-bold">Top Creators by GMV</span>
          </div>
          <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">18,420 creators in DB</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x">
          {TOP_CREATORS.map((c) => (
            <div key={c.handle} className="p-5 hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-3 mb-3">
                <div className={`h-10 w-10 rounded-full ${c.color} flex items-center justify-center shrink-0`}>
                  <span className="text-sm font-black text-white">{c.name[0]}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold truncate">{c.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{c.handle}</p>
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">Niche</span>
                  <span className="text-[11px] font-medium">{c.niche}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">Followers</span>
                  <span className="text-[11px] font-medium">{c.followers}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">Est. GMV</span>
                  <span className="text-[11px] font-bold text-green-600">{c.gmv}</span>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1">
                {[1,2,3,4,5].map(i => (
                  <Star key={i} className={`h-3 w-3 ${i <= Math.round(c.score / 20) ? "text-amber-500 fill-amber-500" : "text-muted"}`} />
                ))}
                <span className="text-[10px] text-muted-foreground ml-1">Score {c.score}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Early access banner */}
      <div className="rounded-xl border border-pink-500/20 bg-gradient-to-br from-pink-500/10 via-purple-500/5 to-background p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <p className="font-bold text-base mb-1">Be first when Creator Intelligence launches</p>
          <p className="text-sm text-muted-foreground">Join the waitlist — early access opens Q3 2026 with exclusive pricing.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <input disabled placeholder="your@email.com"
            className="w-52 px-3 py-2.5 rounded-xl border bg-background text-sm text-muted-foreground placeholder:text-muted-foreground/50 cursor-not-allowed" />
          <button disabled className="px-4 py-2.5 rounded-xl bg-pink-500 text-white text-sm font-semibold opacity-60 cursor-not-allowed whitespace-nowrap">
            Notify Me
          </button>
        </div>
      </div>

    </div>
  )
}
