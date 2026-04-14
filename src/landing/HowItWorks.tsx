import { Upload, Cpu, TrendingDown } from "lucide-react"

const STEPS = [
  {
    icon:    Upload,
    number:  "01",
    title:   "Add Your Products",
    desc:    "Import your product catalog via CSV or add products manually. Connect your stores — Amazon AE, Noon, Carrefour, and more.",
    color:   "text-blue-500",
    bg:      "bg-blue-500/10",
  },
  {
    icon:    Cpu,
    number:  "02",
    title:   "AI Discovers Prices",
    desc:    "Spark Vision AI scrapes product pages and extracts prices, availability, and promotions — even from dynamic JavaScript sites.",
    color:   "text-amber-500",
    bg:      "bg-amber-500/10",
  },
  {
    icon:    TrendingDown,
    number:  "03",
    title:   "Track & Stay Ahead",
    desc:    "Get notified of price changes. See price history charts. Always know when a competitor drops their price before your customers do.",
    color:   "text-green-500",
    bg:      "bg-green-500/10",
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 px-4 bg-muted/20">
      <div className="max-w-7xl mx-auto">

        <div className="text-center mb-14 space-y-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-amber-500">How it works</span>
          <h2 className="text-4xl font-black tracking-tight">Up and running in minutes</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">No scraping knowledge needed. No setup complexity. Just connect, search, and watch the prices roll in.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
          {/* Connector line (desktop only) */}
          <div className="hidden md:block absolute top-10 left-[calc(16.67%+1rem)] right-[calc(16.67%+1rem)] h-px bg-gradient-to-r from-transparent via-border to-transparent" />

          {STEPS.map(({ icon: Icon, number, title, desc, color, bg }) => (
            <div key={number} className="relative flex flex-col items-center text-center gap-4 p-6 rounded-2xl bg-background border hover:shadow-md transition-shadow">
              {/* Step number */}
              <div className="relative">
                <div className={`h-16 w-16 rounded-2xl ${bg} flex items-center justify-center`}>
                  <Icon className={`h-7 w-7 ${color}`} />
                </div>
                <div className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-background border text-[10px] font-black flex items-center justify-center">
                  {number.slice(1)}
                </div>
              </div>

              <div>
                <h3 className="text-base font-bold mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
