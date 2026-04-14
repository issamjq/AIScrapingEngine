import { Store, Cpu, Layers, ShieldCheck } from "lucide-react"

const STATS = [
  { icon: Store,       value: "10+",    label: "UAE Retailers" },
  { icon: Cpu,         value: "Claude", label: "Vision AI" },
  { icon: Layers,      value: "3",      label: "Search Depths" },
  { icon: ShieldCheck, value: "100%",   label: "Secure & Private" },
]

export function StatsBar() {
  return (
    <section className="border-y bg-muted/30">
      <div className="max-w-7xl mx-auto px-6 py-14 grid grid-cols-2 sm:grid-cols-4 gap-8">
        {STATS.map(({ icon: Icon, value, label }) => (
          <div key={label} className="flex flex-col items-center text-center gap-2">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Icon className="h-5 w-5 text-amber-500" />
            </div>
            <p className="text-3xl font-black tracking-tight">{value}</p>
            <p className="text-sm text-muted-foreground font-medium">{label}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
