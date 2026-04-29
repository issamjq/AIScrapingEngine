import { useEffect, useState } from "react"
import { useAuth } from "@/context/AuthContext"
import { LandingNav }           from "./LandingNav"
import { HeroSection }          from "./HeroSection"
import { StatsBar }             from "./StatsBar"
import { ShowcaseSection }      from "./ShowcaseSection"
import { B2BVisual, B2CVisual, PriceChartVisual } from "./ShowcaseVisuals"
import { BentoGrid }            from "./BentoGrid"
import { StickyScrollSection }  from "./StickyScrollSection"
import { HowItWorks }           from "./HowItWorks"
import { TestimonialsSection }  from "./TestimonialsSection"
import { TikTokTeaser }         from "./TikTokTeaser"
import { FAQSection }           from "./FAQSection"
import { LandingCTA }           from "./LandingCTA"
import { LandingFooter }        from "./LandingFooter"
import { ScrollProgressBar }    from "./ScrollProgressBar"
import { BroadcastBanner }      from "@/components/BroadcastBanner"
import { BlogSection }          from "./BlogSection"
import { BlogPostPage }         from "./BlogPostPage"

interface Props {
  onNavigateToApp?: (page: string) => void
}

export function LandingPage({ onNavigateToApp }: Props) {
  const { user, signInWithGoogle, logout } = useAuth()
  const isLoggedIn = !!user

  // ── Routing inside the landing page ──
  // Public blog uses real URLs so Google can index each post:
  // - /blog              → list view  (BlogSection)
  // - /blog/:slug        → post view  (BlogPostPage)
  // - everything else    → marketing home (in-page hash anchors handle scrolling)
  //
  // We track BOTH pathname (popstate) and hash (hashchange) — the former drives
  // blog routing, the latter drives section scrolling for #how-it-works etc.
  const [pathname, setPathname] = useState<string>(() => window.location.pathname)
  const [hash, setHash]         = useState<string>(() => window.location.hash.slice(1))

  useEffect(() => {
    const onChange = () => {
      setPathname(window.location.pathname)
      setHash(window.location.hash.slice(1))
    }
    window.addEventListener("popstate",   onChange)
    window.addEventListener("hashchange", onChange)
    return () => {
      window.removeEventListener("popstate",   onChange)
      window.removeEventListener("hashchange", onChange)
    }
  }, [])

  // Legacy redirect — anyone landing via the old hash URL (#blog or #blog/foo)
  // gets quietly upgraded to the real path so future shares + refreshes are clean.
  useEffect(() => {
    const h = window.location.hash.slice(1)
    if (h === "blog" || h.startsWith("blog/")) {
      const newPath = h === "blog" ? "/blog" : `/blog/${h.slice(5)}`
      window.history.replaceState({}, "", newPath)
      setPathname(newPath)
      setHash("")
    }
  }, [])

  const blogSlug   = pathname.startsWith("/blog/") ? pathname.slice(6) : null
  const onBlogList = pathname === "/blog" || pathname === "/blog/"

  // Scroll to in-page section after refresh — the browser's auto-scroll fires
  // before the React tree paints, so we re-trigger after the marketing home
  // has actually rendered. Skip blog routes since those are full-page swaps.
  useEffect(() => {
    if (blogSlug || onBlogList) return  // blog page handles its own scroll
    if (!hash) return
    // Wait one paint so the section element exists and has its final position.
    const id = hash
    const t = setTimeout(() => {
      const el = document.getElementById(id)
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 100)
    return () => clearTimeout(t)
  }, [hash, blogSlug, onBlogList])

  // Capture UTM + referrer on first visit so signup can attribute the source.
  // Idempotent — only writes if nothing stored yet (preserves original channel).
  useEffect(() => {
    try {
      if (sessionStorage.getItem("spark_utm")) return
      const p = new URLSearchParams(window.location.search)
      const utm = {
        source:   p.get("utm_source"),
        medium:   p.get("utm_medium"),
        campaign: p.get("utm_campaign"),
        referrer: document.referrer || null,
      }
      if (utm.source || utm.medium || utm.campaign || utm.referrer) {
        sessionStorage.setItem("spark_utm", JSON.stringify(utm))
      }
    } catch { /* sessionStorage blocked — fine */ }
  }, [])

  async function handleAction(target?: string) {
    const dest = target ?? "discovering"
    if (isLoggedIn) {
      onNavigateToApp?.(dest)
      return
    }
    if (target) sessionStorage.setItem("spark_nav_target", target)
    try { await signInWithGoogle() }
    catch { sessionStorage.removeItem("spark_nav_target") }
  }

  return (
    <div
      className="landing-root min-h-screen bg-background text-foreground"
      style={{
        fontFamily: "'Geist', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
        overflowX: "clip",
      }}
    >
      <ScrollProgressBar />

      {/* Site-wide announcement banner — visible to anonymous visitors too */}
      <BroadcastBanner />

      <LandingNav
        onAction={handleAction}
        onSignOut={logout}
        isLoggedIn={isLoggedIn}
        userName={user?.displayName ?? undefined}
        userPhotoURL={user?.photoURL ?? undefined}
      />

      {/* Pathname routing inside landing: blog list, single post, or marketing */}
      {blogSlug ? (
        <BlogPostPage slug={blogSlug} />
      ) : onBlogList ? (
        <BlogSection />
      ) : (
        <MarketingHome onAction={handleAction} isLoggedIn={isLoggedIn} />
      )}
    </div>
  )
}

// ─── Marketing home (extracted so the routing block above stays readable) ───

function MarketingHome({ onAction, isLoggedIn }: { onAction: (target?: string) => void; isLoggedIn: boolean }) {
  return (
    <>
      <HeroSection onAction={onAction} isLoggedIn={isLoggedIn} />

      <StatsBar />

      {/* B2B showcase */}
      <ShowcaseSection
        step="01 · For businesses"
        accent="blue"
        badge="For Businesses"
        badgeColor="bg-blue-500/10 text-blue-500 ring-1 ring-blue-500/20"
        title="Track every competitor's price — automatically."
        subtitle="Connect your product catalog and Spark AI monitors prices across Amazon AE, Noon, Carrefour, and 7+ more UAE retailers — every hour, automatically."
        features={[
          "Add products via CSV or manual entry — no technical knowledge needed",
          "Monitor 10+ UAE retailers simultaneously with per-store credit tracking",
          "AI auto-matches your catalog entries to the right product pages",
          "See price history charts and get alerted on changes",
        ]}
        visual={<B2BVisual />}
      />

      {/* B2C showcase */}
      <ShowcaseSection
        step="02 · For shoppers"
        accent="green"
        badge="For Shoppers"
        badgeColor="bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/20"
        title="Find the best price on anything, anywhere."
        subtitle="Type any product in plain language. Spark AI scans global retailers using Vision AI and returns the cheapest prices sorted by distance from your location."
        features={[
          "No product links needed — just type what you're looking for",
          "Geo-aware search: your country first, then globally",
          "3 search depths: Quick (1 credit), Standard (2), Deep (3)",
          "See real prices with images, availability, and discount badges",
        ]}
        visual={<B2CVisual />}
        reversed
      />

      {/* Price tracking showcase */}
      <ShowcaseSection
        step="03 · Price history"
        accent="purple"
        badge="Price History"
        badgeColor="bg-purple-500/10 text-purple-500 ring-1 ring-purple-500/20"
        title="30-day price history at a glance."
        subtitle="Never pay too much again. Spark AI logs every price it finds and shows you the trend — so you know exactly when to buy or when to reprice your own products."
        features={[
          "See 30-day low, high, and current price in one view",
          "Automatic daily sync keeps your data fresh",
          "Compare prices across retailers on the same chart",
          "Export data as CSV, JSON, or PDF reports",
        ]}
        visual={<PriceChartVisual />}
      />

      <BentoGrid />

      <StickyScrollSection />

      <HowItWorks />

      <TestimonialsSection />

      <TikTokTeaser />

      <FAQSection />

      <LandingCTA onAction={onAction} isLoggedIn={isLoggedIn} />

      <LandingFooter />
    </>
  )
}
