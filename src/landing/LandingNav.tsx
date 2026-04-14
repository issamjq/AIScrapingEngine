import { useState, useRef, useEffect } from "react"
import { useTheme } from "@/context/ThemeContext"
import { Search, BarChart3, Package, Sparkles, Sun, Moon, Menu, X, ChevronDown, ArrowUpRight } from "lucide-react"

interface Props {
  onSignIn: (target?: string) => void
}

const MARKET_INTEL_ITEMS = [
  { icon: Search,    label: "Market Discovery",  desc: "Find best prices globally with AI",   target: "discovering" },
  { icon: BarChart3, label: "Price Tracking",    desc: "Monitor competitor prices over time",  target: "price-board" },
  { icon: Package,   label: "Catalog Discovery", desc: "Auto-match your catalog to stores",    target: "discovering" },
]

export function LandingNav({ onSignIn }: Props) {
  const { theme, setTheme } = useTheme()
  const [menuOpen,    setMenuOpen]    = useState(false)
  const [mobileOpen,  setMobileOpen]  = useState(false)
  const [scrolled,    setScrolled]    = useState(false)
  const menuRef    = useRef<HTMLDivElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener("scroll", onScroll)
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled ? "bg-background/90 backdrop-blur-md border-b shadow-sm" : "bg-transparent"
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">

        {/* Logo */}
        <a href="#" className="flex items-center gap-2 shrink-0">
          <img src="/spark-logo.gif" alt="Spark" className="h-8 w-8 object-contain" />
          <span className="text-lg font-bold tracking-tight">Spark AI</span>
        </a>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">

          {/* Products mega-menu */}
          <div
            ref={menuRef}
            className="relative"
            onMouseEnter={() => { if (closeTimer.current) clearTimeout(closeTimer.current); setMenuOpen(true) }}
            onMouseLeave={() => { closeTimer.current = setTimeout(() => setMenuOpen(false), 150) }}
          >
            <button className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              menuOpen ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
            }`}>
              Products
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
            </button>

            {/* Mega menu */}
            {menuOpen && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 pt-2 w-[620px]">
              <div className="bg-background border rounded-2xl shadow-xl p-5 grid grid-cols-2 gap-4">

                {/* ── Product 1: Market Intelligence ── */}
                <div className="rounded-xl border bg-muted/30 p-4">
                  {/* Product header */}
                  <div className="flex items-center gap-3 mb-3 pb-3 border-b">
                    <div className="h-9 w-9 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
                      <BarChart3 className="h-4.5 w-4.5 text-amber-500" style={{ height: 18, width: 18 }} />
                    </div>
                    <div>
                      <p className="text-sm font-bold leading-none">Market Intelligence</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Price discovery & competitor tracking</p>
                    </div>
                  </div>
                  {/* Sub-items */}
                  <div className="space-y-0.5">
                    {MARKET_INTEL_ITEMS.map(({ icon: Icon, label, desc, target }) => (
                      <button
                        key={label}
                        onClick={() => onSignIn(target)}
                        className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-background transition-colors text-left group"
                      >
                        <Icon className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                        <div>
                          <p className="text-xs font-medium leading-none">{label}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── Product 2: Creator Intelligence ── */}
                <button
                  onClick={() => onSignIn("creator-intel")}
                  className="rounded-xl border bg-gradient-to-br from-pink-500/10 via-purple-500/5 to-background p-4 text-left hover:shadow-md transition-all group relative overflow-hidden"
                >
                  <div className="absolute top-3 right-3">
                    <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-pink-500 transition-colors" />
                  </div>
                  <div className="h-9 w-9 rounded-xl bg-pink-500/15 flex items-center justify-center mb-3">
                    <Sparkles className="h-4.5 w-4.5 text-pink-500" style={{ height: 18, width: 18 }} />
                  </div>
                  <p className="text-sm font-bold leading-none mb-1">Creator Intelligence</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed mb-4">
                    TikTok shop analytics, trending products, and creator performance data — all in one platform.
                  </p>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-pink-500/10 text-pink-500 border border-pink-500/20">
                    <Sparkles className="h-3 w-3" />
                    Coming Q3 2026
                  </span>
                </button>

              </div>
              </div>
            )}
          </div>

          <a href="#pricing" className="px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors">
            Pricing
          </a>
          <a href="#how-it-works" className="px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors">
            How it works
          </a>
        </nav>

        {/* Right side */}
        <div className="hidden md:flex items-center gap-2">
          {/* Theme toggle */}
          <button
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="h-9 w-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <button
            onClick={onSignIn}
            className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          >
            Sign in
          </button>
          <button
            onClick={onSignIn}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-foreground text-background hover:bg-foreground/90 transition-colors"
          >
            Get Started Free
          </button>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden h-9 w-9 flex items-center justify-center rounded-lg hover:bg-muted/60 transition-colors"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-background border-b shadow-lg px-4 pb-6 space-y-4">
          <div className="pt-4 space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-2 mb-2">Market Intelligence</p>
            {MARKET_INTEL_ITEMS.map(({ icon: Icon, label, target }) => (
              <button key={label} onClick={() => { setMobileOpen(false); onSignIn(target) }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/60 text-sm font-medium transition-colors text-left">
                <Icon className="h-4 w-4 text-amber-500" />{label}
              </button>
            ))}
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-2 mt-4 mb-2">Creator Intelligence</p>
            <button onClick={() => { setMobileOpen(false); onSignIn("creator-intel") }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/60 text-sm font-medium transition-colors text-left">
              <Sparkles className="h-4 w-4 text-pink-500" />
              Creator Intelligence
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-pink-500/10 text-pink-500 ml-auto">Q3 2026</span>
            </button>
          </div>
          <div className="border-t pt-4 flex flex-col gap-2">
            <button onClick={() => setTheme(isDark ? "light" : "dark")}
              className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {isDark ? "Light mode" : "Dark mode"}
            </button>
            <button onClick={onSignIn}
              className="w-full py-3 rounded-xl text-sm font-medium border hover:bg-muted/60 transition-colors">
              Sign in
            </button>
            <button onClick={onSignIn}
              className="w-full py-3 rounded-xl text-sm font-semibold bg-foreground text-background hover:bg-foreground/90 transition-colors">
              Get Started Free
            </button>
          </div>
        </div>
      )}
    </header>
  )
}
