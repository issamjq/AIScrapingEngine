import { useState } from "react"
import { TrendingUp, ShoppingBag, Star, RefreshCw } from "lucide-react"

interface Props { role?: string }

export function CreatorIntelV2Content({ role: _role }: Props) {
  const [comingSoon] = useState(true)

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 text-center p-8">
      <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-primary/10">
        <TrendingUp className="h-8 w-8 text-primary" />
      </div>

      <div className="space-y-2 max-w-md">
        <h1 className="text-2xl font-black tracking-tight">Creator Intelligence v2</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Real TikTok Shop product data — prices, sold counts, commission rates, product images —
          scraped directly from TikTok Shop and Amazon Best Sellers. UAE/MENA focused.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4 w-full max-w-sm">
        {[
          { icon: ShoppingBag, label: "TikTok Shop Products", sub: "Real prices + sold count" },
          { icon: Star,        label: "Amazon Best Sellers",  sub: "US + UAE markets"         },
          { icon: RefreshCw,   label: "Daily Auto-Scrape",    sub: "Data accumulates over time" },
        ].map(({ icon: Icon, label, sub }) => (
          <div key={label} className="flex flex-col items-center gap-2 p-4 rounded-xl border bg-card text-center">
            <Icon className="h-5 w-5 text-primary" />
            <p className="text-[11px] font-semibold leading-tight">{label}</p>
            <p className="text-[10px] text-muted-foreground">{sub}</p>
          </div>
        ))}
      </div>

      {comingSoon && (
        <span className="text-xs px-3 py-1.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-medium border border-amber-200 dark:border-amber-800">
          Building now — scraper in progress
        </span>
      )}
    </div>
  )
}
