import { useAuth } from "@/context/AuthContext"
import { LandingNav }       from "./LandingNav"
import { HeroSection }      from "./HeroSection"
import { StatsBar }         from "./StatsBar"
import { ShowcaseSection }  from "./ShowcaseSection"
import { B2BVisual, B2CVisual, PriceChartVisual } from "./ShowcaseVisuals"
import { HowItWorks }       from "./HowItWorks"
import { TikTokTeaser }     from "./TikTokTeaser"
import { LandingCTA }       from "./LandingCTA"
import { LandingFooter }    from "./LandingFooter"

export function LandingPage() {
  const { signInWithGoogle } = useAuth()

  async function handleSignIn(target?: string) {
    if (target) sessionStorage.setItem("spark_nav_target", target)
    try { await signInWithGoogle() }
    catch { sessionStorage.removeItem("spark_nav_target") }
  }

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <LandingNav onSignIn={handleSignIn} />

      <HeroSection onSignIn={handleSignIn} />

      <StatsBar />

      {/* B2B showcase */}
      <ShowcaseSection
        badge="For Businesses"
        badgeColor="bg-blue-500/10 text-blue-500"
        title="Track Every Competitor's Price — Automatically"
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
        badge="For Shoppers"
        badgeColor="bg-green-500/10 text-green-500"
        title="Find the Best Price on Anything, Anywhere"
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
        badge="Price History"
        badgeColor="bg-purple-500/10 text-purple-500"
        title="30-Day Price History at a Glance"
        subtitle="Never pay too much again. Spark AI logs every price it finds and shows you the trend — so you know exactly when to buy or when to reprice your own products."
        features={[
          "See 30-day low, high, and current price in one view",
          "Automatic daily sync keeps your data fresh",
          "Compare prices across retailers on the same chart",
          "Export data as CSV, JSON, or PDF reports",
        ]}
        visual={<PriceChartVisual />}
      />

      <HowItWorks />

      <TikTokTeaser />

      <LandingCTA onSignIn={handleSignIn} />

      <LandingFooter />
    </div>
  )
}
