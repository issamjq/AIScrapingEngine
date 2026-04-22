import { Eye, Globe2, Clock, Bell, Download, Zap, ShieldCheck } from "lucide-react"
import { Reveal } from "./Reveal"
import { AnimatedCounter } from "./AnimatedCounter"

export function BentoGrid() {
  return (
    <section className="relative py-28 px-6">
      <div className="max-w-7xl mx-auto">
        <Reveal className="text-center mb-14 space-y-4">
          <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.25em] text-amber-500">
            <span className="h-px w-6 bg-amber-500/50" />
            Everything in one place
            <span className="h-px w-6 bg-amber-500/50" />
          </span>
          <h2 className="text-4xl lg:text-5xl font-semibold tracking-[-0.035em]">
            One platform. Every pricing signal.
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg leading-relaxed">
            We replaced six tools and three spreadsheets with one dashboard. Here's what that looks like.
          </p>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 auto-rows-[200px]">

          {/* ── Big hero tile — Vision AI ── */}
          <Reveal className="md:col-span-4 md:row-span-2" scale>
            <div className="group relative h-full rounded-3xl border bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-background p-8 overflow-hidden hover:shadow-xl transition-all">
              {/* Glow */}
              <div className="absolute -top-16 -right-16 h-64 w-64 bg-amber-400/30 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

              <div className="relative h-full flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/25">
                    <Eye className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-2xl lg:text-3xl font-semibold tracking-[-0.02em]">
                    Vision AI reads every product page
                  </h3>
                  <p className="text-[15px] text-muted-foreground leading-relaxed max-w-lg">
                    No brittle selectors. No scraper maintenance. Our AI screenshots the page and extracts price, availability, and promotions — like a human does, 10,000× faster.
                  </p>
                </div>

                {/* Decorative mini-mockup */}
                <div className="grid grid-cols-3 gap-2 opacity-90">
                  {[
                    { label: "Price",      val: "AED 299",  delta: "-40%" },
                    { label: "Stock",      val: "In stock", delta: null   },
                    { label: "Extracted",  val: "2.4 s",    delta: null   },
                  ].map((c) => (
                    <div key={c.label} className="rounded-xl border bg-background/60 backdrop-blur-sm p-3">
                      <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">{c.label}</p>
                      <p className="text-sm font-bold mt-1">{c.val}</p>
                      {c.delta && <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">{c.delta}</p>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>

          {/* ── Retailer count ── */}
          <Reveal className="md:col-span-2" scale delay={120}>
            <div className="group relative h-full rounded-3xl border bg-gradient-to-br from-blue-500/10 to-indigo-500/5 p-6 overflow-hidden hover:shadow-xl transition-all">
              <div className="h-10 w-10 rounded-xl bg-blue-500/15 flex items-center justify-center mb-3">
                <Globe2 className="h-5 w-5 text-blue-500" />
              </div>
              <p className="text-5xl font-semibold tracking-[-0.03em] bg-gradient-to-br from-blue-500 to-indigo-500 bg-clip-text text-transparent">
                <AnimatedCounter value={10} />+
              </p>
              <p className="text-sm font-semibold mt-2">UAE retailers, live</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Amazon AE, Noon, Carrefour, Talabat, Spinneys, LuLu & more
              </p>
            </div>
          </Reveal>

          {/* ── Real-time sync ── */}
          <Reveal className="md:col-span-2" scale delay={200}>
            <div className="group relative h-full rounded-3xl border bg-gradient-to-br from-emerald-500/10 to-green-500/5 p-6 overflow-hidden hover:shadow-xl transition-all">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/15 flex items-center justify-center mb-3">
                <Clock className="h-5 w-5 text-emerald-500" />
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-5xl font-semibold tracking-[-0.03em] bg-gradient-to-br from-emerald-500 to-green-500 bg-clip-text text-transparent">24/7</p>
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
              </div>
              <p className="text-sm font-semibold mt-2">Automated sync</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Hourly price checks, daily full refresh, zero manual work
              </p>
            </div>
          </Reveal>

          {/* ── Alerts ── */}
          <Reveal className="md:col-span-2" scale>
            <div className="group relative h-full rounded-3xl border bg-gradient-to-br from-rose-500/10 to-pink-500/5 p-6 overflow-hidden hover:shadow-xl transition-all">
              <div className="h-10 w-10 rounded-xl bg-rose-500/15 flex items-center justify-center mb-3">
                <Bell className="h-5 w-5 text-rose-500" />
              </div>
              <h3 className="text-lg font-semibold tracking-tight">Price alerts</h3>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                Get notified the moment a competitor cuts price. Email or in-app.
              </p>
              <div className="mt-3 flex items-center gap-2 text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                Noon just dropped Sony headphones -15%
              </div>
            </div>
          </Reveal>

          {/* ── Export ── */}
          <Reveal className="md:col-span-2" scale delay={100}>
            <div className="group relative h-full rounded-3xl border bg-gradient-to-br from-purple-500/10 to-fuchsia-500/5 p-6 overflow-hidden hover:shadow-xl transition-all">
              <div className="h-10 w-10 rounded-xl bg-purple-500/15 flex items-center justify-center mb-3">
                <Download className="h-5 w-5 text-purple-500" />
              </div>
              <h3 className="text-lg font-semibold tracking-tight">Export anywhere</h3>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                CSV, JSON, or PDF reports. One click, works with Excel and Google Sheets.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {["CSV", "JSON", "PDF"].map((f) => (
                  <span key={f} className="text-[10px] font-bold px-2 py-1 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400">
                    {f}
                  </span>
                ))}
              </div>
            </div>
          </Reveal>

          {/* ── API ── */}
          <Reveal className="md:col-span-2" scale delay={200}>
            <div className="group relative h-full rounded-3xl border bg-gradient-to-br from-amber-500/10 to-orange-500/5 p-6 overflow-hidden hover:shadow-xl transition-all">
              <div className="h-10 w-10 rounded-xl bg-amber-500/15 flex items-center justify-center mb-3">
                <Zap className="h-5 w-5 text-amber-500" />
              </div>
              <h3 className="text-lg font-semibold tracking-tight">Built for speed</h3>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                Parallel scrape + AI extract in under 3 seconds per retailer.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <div className="flex -space-x-1">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="h-2 w-2 rounded-full bg-amber-500 animate-[pulse_1.2s_ease-in-out_infinite]" style={{ animationDelay: `${i * 150}ms` }} />
                  ))}
                </div>
                <span className="text-[10px] font-semibold text-muted-foreground">Scanning live</span>
              </div>
            </div>
          </Reveal>

          {/* ── Security (wide) ── */}
          <Reveal className="md:col-span-6" scale>
            <div className="group relative h-full rounded-3xl border bg-gradient-to-r from-slate-500/8 via-background to-slate-500/8 p-6 overflow-hidden hover:shadow-xl transition-all flex items-center justify-between gap-6 flex-wrap">
              <div className="flex items-start gap-4 flex-1 min-w-[260px]">
                <div className="h-11 w-11 rounded-xl bg-slate-500/15 flex items-center justify-center shrink-0">
                  <ShieldCheck className="h-5 w-5 text-slate-500" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold tracking-tight">SOC-ready security, row-level isolation</h3>
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed max-w-xl">
                    Every account's catalog, price history, and queries are isolated at the database level. Export or delete everything in one click.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                {[
                  { label: "Firebase Auth",  tint: "bg-orange-500/10 text-orange-600 dark:text-orange-400" },
                  { label: "Neon Postgres",  tint: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
                  { label: "SSO Google",     tint: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
                  { label: "GDPR ready",     tint: "bg-purple-500/10 text-purple-600 dark:text-purple-400" },
                ].map((t) => (
                  <span key={t.label} className={`text-[11px] font-semibold px-3 py-1.5 rounded-full ${t.tint}`}>
                    {t.label}
                  </span>
                ))}
              </div>
            </div>
          </Reveal>

        </div>
      </div>
    </section>
  )
}
