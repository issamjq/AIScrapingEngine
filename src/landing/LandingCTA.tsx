import { ArrowRight, Sparkles } from "lucide-react"

interface Props {
  onSignIn: () => void
}

export function LandingCTA({ onSignIn }: Props) {
  return (
    <section id="pricing" className="py-20 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="relative rounded-3xl overflow-hidden border bg-gradient-to-br from-amber-500/10 via-background to-background p-12 text-center">
          {/* Background glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 h-32 w-64 bg-amber-400/20 blur-3xl -z-10" />

          <div className="space-y-4 mb-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-500">
              <Sparkles className="h-3.5 w-3.5" />
              No credit card required
            </div>
            <h2 className="text-4xl sm:text-5xl font-black tracking-tight">
              Ready to dominate<br />your market?
            </h2>
            <p className="text-muted-foreground text-base max-w-xl mx-auto">
              Start for free. Get 20–60 credits on signup. Upgrade when you need more. Cancel anytime.
            </p>
          </div>

          {/* Plan teaser */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 max-w-2xl mx-auto">
            {[
              { name: "Free",   credits: "20–60 credits", price: "$0",  highlight: false },
              { name: "Starter", credits: "180 credits",  price: "$29", highlight: false },
              { name: "Pro",    credits: "600 credits",   price: "$69", highlight: true  },
            ].map(({ name, credits, price, highlight }) => (
              <div key={name} className={`rounded-2xl border p-4 ${highlight ? "border-amber-500 bg-amber-500/10" : "bg-muted/40"}`}>
                <p className={`text-sm font-bold mb-1 ${highlight ? "text-amber-500" : ""}`}>{name}</p>
                <p className="text-xl font-black">{price}<span className="text-xs font-medium text-muted-foreground">/mo</span></p>
                <p className="text-[10px] text-muted-foreground mt-1">{credits}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={onSignIn}
              className="flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-foreground text-background text-sm font-bold hover:bg-foreground/90 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
            >
              Get Started Free
              <ArrowRight className="h-4 w-4" />
            </button>
            <a href="#how-it-works" className="flex items-center justify-center gap-2 px-8 py-4 rounded-xl border text-sm font-medium hover:bg-muted/60 transition-colors">
              See how it works
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
