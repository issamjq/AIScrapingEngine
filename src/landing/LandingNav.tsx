import { useState, useRef, useEffect } from "react"
import { useTheme } from "@/context/ThemeContext"
import { Search, BarChart3, Package, Sparkles, Sun, Moon, Menu, X, ChevronDown, ArrowUpRight, ArrowRight, LogOut, Settings, Zap } from "lucide-react"

interface Props {
  onAction:      (target?: string) => void
  onSignOut?:    () => void
  isLoggedIn?:   boolean
  userName?:     string
  userPhotoURL?: string
}

const MARKET_INTEL_ITEMS = [
  { icon: Search,    label: "Market Discovery",  desc: "Find best prices globally with AI",   target: "discovering" },
  { icon: BarChart3, label: "Price Tracking",    desc: "Monitor competitor prices over time",  target: "price-board" },
  { icon: Package,   label: "Catalog Discovery", desc: "Auto-match your catalog to stores",    target: "discovering" },
]

export function LandingNav({ onAction, onSignOut, isLoggedIn, userName, userPhotoURL }: Props) {
  const { theme, setTheme } = useTheme()
  const [menuOpen,    setMenuOpen]    = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [mobileOpen,  setMobileOpen]  = useState(false)
  const [scrolled,    setScrolled]    = useState(false)
  const menuRef       = useRef<HTMLDivElement>(null)
  const profileRef    = useRef<HTMLDivElement>(null)
  const closeTimer    = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener("scroll", onScroll)
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  useEffect(() => {
    if (!profileOpen) return
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [profileOpen])

  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)
  const initials = userName ? userName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() : "?"

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled
        ? "bg-background/70 backdrop-blur-xl border-b border-black/5 dark:border-white/10 shadow-[0_2px_20px_-8px_rgba(0,0,0,0.1)]"
        : "bg-transparent"
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">

        {/* Logo */}
        <a href="#" className="flex items-center gap-2 shrink-0 group">
          <div className="relative">
            <div className="absolute inset-0 bg-amber-400/30 blur-lg rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
            <img src="/spark-logo.gif" alt="Spark" className="relative h-8 w-8 object-contain" />
          </div>
          <span className="text-lg font-semibold tracking-[-0.02em]">Spark <span className="bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">AI</span></span>
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
              <div className="absolute top-full left-1/2 -translate-x-1/2 pt-3 w-[680px]">
              <div className="origin-top animate-[megaIn_220ms_cubic-bezier(0.16,1,0.3,1)_both]">
              <div className="relative bg-background/95 backdrop-blur-xl border rounded-2xl shadow-[0_20px_60px_-10px_rgba(0,0,0,0.25)] dark:shadow-[0_20px_60px_-10px_rgba(0,0,0,0.7)] ring-1 ring-black/5 dark:ring-white/10 p-4 grid grid-cols-[1.2fr_1fr] gap-3 overflow-hidden">

                {/* Ambient glow */}
                <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 bg-pink-400/15 rounded-full blur-3xl" />
                <div className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 bg-amber-400/15 rounded-full blur-3xl" />

                {/* ── Product 1: Market Intelligence ── */}
                <div className="relative rounded-xl border bg-gradient-to-br from-amber-500/8 via-background to-background p-4">
                  <div className="flex items-center gap-3 mb-4 pb-4 border-b border-dashed">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500/25 to-orange-500/10 ring-1 ring-amber-500/30 flex items-center justify-center shrink-0 shadow-sm">
                      <BarChart3 className="h-5 w-5 text-amber-500" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold tracking-tight leading-none">Market Intelligence</p>
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">Live</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">Price discovery & competitor tracking</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    {MARKET_INTEL_ITEMS.map(({ icon: Icon, label, desc, target }) => (
                      <button
                        key={label}
                        onClick={() => { setMenuOpen(false); onAction(target) }}
                        className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-amber-500/5 transition-all text-left group/item"
                      >
                        <div className="h-7 w-7 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0 group-hover/item:bg-amber-500/20 group-hover/item:scale-105 transition-all">
                          <Icon className="h-3.5 w-3.5 text-amber-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold leading-none tracking-tight">{label}</p>
                          <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{desc}</p>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 -ml-2 opacity-0 -translate-x-1 group-hover/item:opacity-100 group-hover/item:translate-x-0 group-hover/item:text-amber-500 transition-all" />
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── Product 2: Creator Intelligence ── */}
                <button
                  onClick={() => { setMenuOpen(false); onAction("creator-intel") }}
                  className="relative rounded-xl border bg-gradient-to-br from-pink-500/15 via-purple-500/8 to-background p-4 text-left hover:shadow-lg transition-all group/creator overflow-hidden flex flex-col"
                >
                  {/* shimmer on hover */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover/creator:translate-x-full transition-transform duration-1000 pointer-events-none" />

                  <div className="absolute top-3 right-3">
                    <div className="h-6 w-6 rounded-full bg-background/70 backdrop-blur-sm flex items-center justify-center border group-hover/creator:bg-pink-500 group-hover/creator:border-pink-500 transition-all">
                      <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground group-hover/creator:text-white transition-colors" />
                    </div>
                  </div>

                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-pink-500/30 to-purple-500/15 ring-1 ring-pink-500/30 flex items-center justify-center mb-3 shadow-sm group-hover/creator:scale-105 transition-transform">
                    <Sparkles className="h-5 w-5 text-pink-500" />
                  </div>

                  <p className="text-sm font-semibold tracking-tight leading-none mb-1.5">Creator Intelligence</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed mb-auto pr-4">
                    TikTok shop analytics, trending products, and creator performance — all in one place.
                  </p>

                  <div className="mt-4 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-pink-500/15 text-pink-600 dark:text-pink-400 border border-pink-500/25">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75 animate-ping" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-pink-500" />
                      </span>
                      Q3 2026
                    </span>
                  </div>
                </button>

              </div>

              {/* Footer row */}
              <div className="mt-2 mx-1 px-4 py-2.5 rounded-xl bg-muted/30 border border-border/60 backdrop-blur-sm flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Zap className="h-3 w-3 text-amber-500" />
                  Every plan includes Vision AI
                </span>
                <button
                  onClick={() => { setMenuOpen(false); window.location.hash = "pricing" }}
                  className="font-semibold text-foreground hover:text-amber-500 transition-colors"
                >
                  See pricing →
                </button>
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

          {isLoggedIn ? (
            /* Signed-in state */
            <div className="flex items-center gap-2">
              {/* Profile button + dropdown */}
              <div ref={profileRef} className="relative">
                <button
                  onClick={() => setProfileOpen(o => !o)}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-muted/60 hover:bg-muted transition-colors"
                >
                  {userPhotoURL ? (
                    <img src={userPhotoURL} alt={userName} className="h-6 w-6 rounded-full object-cover" />
                  ) : (
                    <div className="h-6 w-6 rounded-full bg-amber-500/20 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-amber-600">{initials}</span>
                    </div>
                  )}
                  <span className="text-sm font-medium">{userName?.split(" ")[0]}</span>
                  <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${profileOpen ? "rotate-180" : ""}`} />
                </button>

                {profileOpen && (
                  <div className="absolute top-full right-0 mt-2 w-52 bg-background border rounded-xl shadow-xl z-50 overflow-hidden py-1">
                    {/* User info header */}
                    <div className="px-3 py-2.5 border-b">
                      <p className="text-xs font-semibold truncate">{userName}</p>
                    </div>
                    {/* Actions */}
                    <button
                      onClick={() => { setProfileOpen(false); onAction("discovering") }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted/60 transition-colors text-left"
                    >
                      <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                      Open App
                    </button>
                    <div className="border-t my-1" />
                    <button
                      onClick={() => { setProfileOpen(false); onSignOut?.() }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-red-50 dark:hover:bg-red-950/30 text-red-500 transition-colors text-left"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Sign out
                    </button>
                  </div>
                )}
              </div>

              <button
                onClick={() => onAction("discovering")}
                className="group relative px-4 py-2 rounded-lg text-sm font-semibold bg-foreground text-background hover:shadow-lg hover:-translate-y-0.5 transition-all overflow-hidden"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-amber-500 to-orange-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="relative">Open App</span>
              </button>
            </div>
          ) : (
            /* Signed-out state */
            <>
              <button
                onClick={() => onAction()}
                className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              >
                Sign in
              </button>
              <button
                onClick={() => onAction()}
                className="group relative px-4 py-2 rounded-lg text-sm font-semibold bg-foreground text-background hover:shadow-lg hover:-translate-y-0.5 transition-all overflow-hidden"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-amber-500 to-orange-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="relative">Get Started Free</span>
              </button>
            </>
          )}
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
      <style>{`
        @keyframes megaIn {
          from { opacity: 0; transform: translateY(-8px) scale(0.97) }
          to   { opacity: 1; transform: translateY(0) scale(1) }
        }
      `}</style>

      {mobileOpen && (
        <div className="md:hidden bg-background border-b shadow-lg px-4 pb-6 space-y-4">
          <div className="pt-4 space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-2 mb-2">Market Intelligence</p>
            {MARKET_INTEL_ITEMS.map(({ icon: Icon, label, target }) => (
              <button key={label} onClick={() => { setMobileOpen(false); onAction(target) }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/60 text-sm font-medium transition-colors text-left">
                <Icon className="h-4 w-4 text-amber-500" />{label}
              </button>
            ))}
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-2 mt-4 mb-2">Creator Intelligence</p>
            <button onClick={() => { setMobileOpen(false); onAction("creator-intel") }}
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
            {isLoggedIn ? (
              <button onClick={() => { setMobileOpen(false); onAction("discovering") }}
                className="w-full py-3 rounded-xl text-sm font-semibold bg-foreground text-background hover:bg-foreground/90 transition-colors">
                Open App
              </button>
            ) : (
              <>
                <button onClick={() => onAction()}
                  className="w-full py-3 rounded-xl text-sm font-medium border hover:bg-muted/60 transition-colors">
                  Sign in
                </button>
                <button onClick={() => onAction()}
                  className="w-full py-3 rounded-xl text-sm font-semibold bg-foreground text-background hover:bg-foreground/90 transition-colors">
                  Get Started Free
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
