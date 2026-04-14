import { useState, useRef, useEffect } from "react"
import { useTheme } from "@/context/ThemeContext"
import { Search, BarChart3, Package, TrendingUp, Users, ShoppingBag, Sun, Moon, Menu, X, ChevronDown } from "lucide-react"

interface Props {
  onSignIn: () => void
}

const PRICE_INTEL = [
  { icon: Search,    label: "Market Discovery",   desc: "Find best prices globally with AI",      soon: false },
  { icon: BarChart3, label: "Price Tracking",      desc: "Monitor competitors in real time",        soon: false },
  { icon: Package,   label: "Catalog Discovery",   desc: "Auto-match products to stores",           soon: false },
]

const TIKTOK_INTEL = [
  { icon: TrendingUp, label: "Trending Products",  desc: "Discover viral TikTok Shop products",    soon: true },
  { icon: Users,      label: "Creator Analytics",  desc: "Find the best affiliate creators",        soon: true },
  { icon: ShoppingBag,label: "Shop Intelligence",  desc: "Full TikTok Shop market data",            soon: true },
]

export function LandingNav({ onSignIn }: Props) {
  const { theme, setTheme } = useTheme()
  const [menuOpen,    setMenuOpen]    = useState(false)
  const [mobileOpen,  setMobileOpen]  = useState(false)
  const [scrolled,    setScrolled]    = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

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
            onMouseEnter={() => setMenuOpen(true)}
            onMouseLeave={() => setMenuOpen(false)}
          >
            <button className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              menuOpen ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
            }`}>
              Products
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
            </button>

            {/* Mega menu */}
            {menuOpen && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[580px] bg-background border rounded-2xl shadow-xl p-5 grid grid-cols-2 gap-6">
                {/* Price Intelligence */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
                    Price Intelligence
                  </p>
                  <div className="space-y-1">
                    {PRICE_INTEL.map(({ icon: Icon, label, desc }) => (
                      <button
                        key={label}
                        onClick={onSignIn}
                        className="w-full flex items-start gap-3 p-2.5 rounded-xl hover:bg-muted/60 transition-colors text-left group"
                      >
                        <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0 group-hover:bg-amber-500/20 transition-colors">
                          <Icon className="h-4 w-4 text-amber-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium leading-none mb-0.5">{label}</p>
                          <p className="text-xs text-muted-foreground">{desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* TikTok Intelligence */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
                    TikTok Intelligence
                  </p>
                  <div className="space-y-1">
                    {TIKTOK_INTEL.map(({ icon: Icon, label, desc }) => (
                      <div
                        key={label}
                        className="flex items-start gap-3 p-2.5 rounded-xl opacity-60 select-none"
                      >
                        <div className="h-8 w-8 rounded-lg bg-pink-500/10 flex items-center justify-center shrink-0">
                          <Icon className="h-4 w-4 text-pink-500" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium leading-none mb-0.5">{label}</p>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-pink-500/10 text-pink-500 leading-none">SOON</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
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
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-2 mb-2">Price Intelligence</p>
            {PRICE_INTEL.map(({ icon: Icon, label }) => (
              <button key={label} onClick={() => { setMobileOpen(false); onSignIn() }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/60 text-sm font-medium transition-colors text-left">
                <Icon className="h-4 w-4 text-amber-500" />{label}
              </button>
            ))}
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-2 mt-4 mb-2">TikTok Intelligence</p>
            {TIKTOK_INTEL.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium opacity-50 select-none">
                <Icon className="h-4 w-4 text-pink-500" />{label}
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-pink-500/10 text-pink-500">SOON</span>
              </div>
            ))}
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
