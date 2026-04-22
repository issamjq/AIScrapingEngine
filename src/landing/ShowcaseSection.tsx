import { CheckCircle2 } from "lucide-react"
import { Reveal } from "./Reveal"

interface Props {
  badge:      string
  badgeColor: string
  title:      string
  subtitle:   string
  features:   string[]
  visual:     React.ReactNode
  reversed?:  boolean
  id?:        string
  step?:      string
  accent?:    "amber" | "blue" | "green" | "purple"
}

const ACCENT = {
  amber:  { bar: "from-amber-500 to-orange-500",   check: "text-amber-500",   glow: "bg-amber-400/15" },
  blue:   { bar: "from-blue-500 to-indigo-500",    check: "text-blue-500",    glow: "bg-blue-400/15" },
  green:  { bar: "from-emerald-500 to-green-500",  check: "text-emerald-500", glow: "bg-emerald-400/15" },
  purple: { bar: "from-purple-500 to-fuchsia-500", check: "text-purple-500",  glow: "bg-purple-400/15" },
}

export function ShowcaseSection({
  badge, badgeColor, title, subtitle, features, visual, reversed, id, step, accent = "amber",
}: Props) {
  const a = ACCENT[accent]

  return (
    <section id={id} className="relative py-28 px-6 overflow-hidden">
      {/* subtle bg glow behind the visual */}
      <div className={`pointer-events-none absolute top-1/2 -translate-y-1/2 ${reversed ? "left-[-10%]" : "right-[-10%]"} h-[460px] w-[460px] rounded-full blur-3xl -z-10 ${a.glow}`} />

      <div className="max-w-7xl mx-auto">
        <div className={`grid grid-cols-1 lg:grid-cols-2 gap-14 lg:gap-20 items-center ${reversed ? "lg:[&>*:first-child]:order-2" : ""}`}>

          {/* Text */}
          <Reveal className="space-y-6 relative" x={reversed ? 40 : -40} y={0}>
            {/* accent bar */}
            <div className={`h-1 w-12 rounded-full bg-gradient-to-r ${a.bar}`} />

            <div className="flex items-center gap-3 flex-wrap">
              <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-[0.18em] px-3 py-1.5 rounded-full ${badgeColor}`}>
                {badge}
              </span>
              {step && (
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  {step}
                </span>
              )}
            </div>

            <h2 className="text-4xl lg:text-5xl xl:text-[3.5rem] font-semibold tracking-[-0.035em] leading-[1.05]">
              {title}
            </h2>

            <p className="text-lg text-muted-foreground leading-[1.7] max-w-xl">
              {subtitle}
            </p>

            <ul className="space-y-3.5 pt-2">
              {features.map((text, i) => (
                <Reveal key={i} as="li" delay={150 + i * 80} y={16} className="flex items-start gap-3 group">
                  <div className={`mt-0.5 h-5 w-5 rounded-full bg-muted flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                    <CheckCircle2 className={`h-5 w-5 ${a.check}`} />
                  </div>
                  <span className="text-base text-foreground/80 leading-relaxed">{text}</span>
                </Reveal>
              ))}
            </ul>
          </Reveal>

          {/* Visual */}
          <Reveal className={`flex ${reversed ? "justify-start" : "justify-end"}`} x={reversed ? -40 : 40} y={0} delay={150} scale>
            {visual}
          </Reveal>

        </div>
      </div>
    </section>
  )
}
