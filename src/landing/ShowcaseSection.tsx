import { CheckCircle2, type LucideIcon } from "lucide-react"

interface Feature {
  text: string
}

interface Props {
  badge:     string
  badgeColor: string
  title:     string
  subtitle:  string
  features:  Feature[]
  visual:    React.ReactNode
  reversed?: boolean
  id?:       string
}

export function ShowcaseSection({ badge, badgeColor, title, subtitle, features, visual, reversed, id }: Props) {
  return (
    <section id={id} className="py-24 px-6">
      <div className="max-w-7xl mx-auto">
        <div className={`grid grid-cols-1 lg:grid-cols-2 gap-16 items-center ${reversed ? "lg:flex lg:flex-row-reverse" : ""}`}>

          {/* Text */}
          <div className="space-y-6">
            <span className={`inline-block text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full ${badgeColor}`}>
              {badge}
            </span>
            <h2 className="text-4xl lg:text-5xl font-black tracking-tight leading-tight">{title}</h2>
            <p className="text-lg text-muted-foreground leading-relaxed">{subtitle}</p>
            <ul className="space-y-3">
              {features.map(({ text }) => (
                <li key={text} className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                  <span className="text-base text-muted-foreground">{text}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Visual */}
          <div className={`flex ${reversed ? "justify-start" : "justify-end"}`}>
            {visual}
          </div>

        </div>
      </div>
    </section>
  )
}
