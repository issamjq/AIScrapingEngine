import { Quote } from "lucide-react"
import { Reveal } from "./Reveal"
import { AnimatedCounter } from "./AnimatedCounter"

const TESTIMONIALS = [
  {
    quote:
      "We cut manual price checking from 4 hours a day to zero. Spark tracks 9 UAE retailers overnight and flags anything that moves — we just review and act.",
    name:    "Omar A.",
    role:    "Category Manager",
    company: "Electronics Retailer · Dubai",
    tint:    "from-amber-500/10 to-orange-500/0",
  },
  {
    quote:
      "The Vision AI nails prices on sites that break every other scraper. Dynamic JavaScript, hidden pricing, inconsistent layouts — it just works.",
    name:    "Layla R.",
    role:    "Growth Lead",
    company: "D2C Beauty Brand",
    tint:    "from-rose-500/10 to-pink-500/0",
  },
  {
    quote:
      "Before buying anything expensive online, I run it through Spark. It found the same camera $94 cheaper in UK stock than Amazon US. Paid for itself in one search.",
    name:    "Yusuf K.",
    role:    "Shopper",
    company: "Abu Dhabi",
    tint:    "from-blue-500/10 to-indigo-500/0",
  },
]

type MetricNode = { label: string; render: () => React.ReactNode }

const METRIC_CLS = "text-3xl sm:text-4xl font-semibold tracking-[-0.03em] bg-gradient-to-br from-amber-500 to-orange-500 bg-clip-text text-transparent"

const METRICS: MetricNode[] = [
  {
    label: "Avg price advantage",
    render: () => <AnimatedCounter value={4.3} decimals={1} suffix="%" className={METRIC_CLS} />,
  },
  {
    label: "Automated sync",
    render: () => <span className={METRIC_CLS}>24 / 7</span>,
  },
  {
    label: "AI extraction time",
    render: () => (
      <span className={METRIC_CLS}>
        &lt;<AnimatedCounter value={3} suffix=" s" />
      </span>
    ),
  },
  {
    label: "Retailers live",
    render: () => <AnimatedCounter value={10} suffix="+" className={METRIC_CLS} />,
  },
]

export function TestimonialsSection() {
  return (
    <section className="relative py-28 px-6 overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <Reveal className="text-center mb-14 space-y-4">
          <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.25em] text-amber-500">
            <span className="h-px w-6 bg-amber-500/50" />
            Loved by early users
            <span className="h-px w-6 bg-amber-500/50" />
          </span>
          <h2 className="text-4xl lg:text-5xl font-semibold tracking-[-0.035em]">
            Built for teams that move fast
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg leading-relaxed">
            From UAE retailers monitoring competitors to shoppers chasing the best global deal — people are saving time and money with Spark.
          </p>
        </Reveal>

        {/* Testimonial cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-16">
          {TESTIMONIALS.map((t, i) => (
            <Reveal key={i} delay={i * 120} scale>
            <figure
              className={`relative rounded-2xl border bg-card p-7 hover:shadow-xl hover:-translate-y-1 transition-all flex flex-col gap-5 overflow-hidden h-full`}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${t.tint} opacity-80 -z-10`} />

              <Quote className="h-6 w-6 text-amber-500/50" />

              <blockquote className="text-[15px] leading-[1.65] text-foreground/85 font-medium">
                "{t.quote}"
              </blockquote>

              <figcaption className="mt-auto pt-5 border-t">
                <p className="text-sm font-semibold">{t.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t.role} · {t.company}</p>
              </figcaption>
            </figure>
            </Reveal>
          ))}
        </div>

        {/* Metrics strip */}
        <Reveal className="rounded-2xl border bg-gradient-to-b from-muted/40 to-muted/10 backdrop-blur-sm px-6 sm:px-10 py-8 grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8">
          {METRICS.map((m, i) => (
            <Reveal key={m.label} delay={i * 90} y={16} className="text-center sm:text-left">
              <p className="leading-none">{m.render()}</p>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mt-2.5">
                {m.label}
              </p>
            </Reveal>
          ))}
        </Reveal>
      </div>
    </section>
  )
}
