import { useState, useEffect } from "react"
import spinnerGif from "@/assets/spinner.gif"
import { AuthProvider, useAuth } from "./context/AuthContext"
import { LoginPage } from "./components/LoginPage"
import { DashboardLayout } from "./components/DashboardLayout"
import { OnboardingContent } from "./components/OnboardingContent"


// Original pages
import { DashboardContent }      from "./components/DashboardContent"
import { PlaygroundContent }     from "./components/PlaygroundContent"
import { ContentLibraryContent } from "./components/ContentLibraryContent"
import { AIServicesContent }     from "./components/AIServicesContent"
import { PostSchedulerContent }  from "./components/PostSchedulerContent"
import { MetaContent }           from "./components/MetaContent"
import { TikTokContent }         from "./components/TikTokContent"
import { YouTubeContent }        from "./components/YouTubeContent"
import { TwitterContent }        from "./components/TwitterContent"
import { ShopifyContent }        from "./components/ShopifyContent"
import { SettingsContent }       from "./components/SettingsContent"

// RSP / Scraping Engine pages
import { DiscoveringContent }      from "./components/DiscoveringContent"
import { PriceBoardContent }       from "./components/PriceBoardContent"
import { TrackedUrlsContent }      from "./components/TrackedUrlsContent"
import { ProductsContent }         from "./components/ProductsContent"
import { CompaniesContent }        from "./components/CompaniesContent"
import { PlansContent }            from "./components/PlansContent"

const API = import.meta.env.VITE_API_URL || "http://localhost:8080"

type AppState = "loading" | "onboarding" | "ready" | "denied" | "error"

function AppLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <img src={spinnerGif} alt="Loading…" className="h-28 w-28 object-contain" draggable={false} />
        <div className="flex flex-col items-center gap-1">
          <p className="text-sm font-medium text-foreground">Please wait</p>
          <p className="text-xs text-muted-foreground">Loading your workspace…</p>
        </div>
      </div>
    </div>
  )
}

function AccessDenied({ onChoosePlan }: { onChoosePlan: () => void }) {
  const { logout } = useAuth()
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm bg-card border rounded-2xl shadow-sm p-8 flex flex-col items-center gap-6 text-center">

        {/* Icon */}
        <div className="h-14 w-14 rounded-full bg-destructive/10 flex items-center justify-center">
          <svg className="h-7 w-7 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>

        {/* Text */}
        <div className="space-y-2">
          <h2 className="text-xl font-bold">No Subscription Found</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            We could not find a subscription attached to your account. Please choose a plan to get started or contact support to resolve this issue.
          </p>
        </div>

        {/* Actions */}
        <div className="w-full space-y-3">
          <button
            onClick={onChoosePlan}
            className="w-full h-11 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            View Plans &amp; Get Started
          </button>
          <button
            onClick={logout}
            className="w-full h-11 rounded-lg border text-sm font-medium hover:bg-muted/50 transition-colors"
          >
            Back to Login
          </button>
        </div>

        {/* Support */}
        <span className="text-xs text-muted-foreground">
          Need help?{" "}
          <span className="underline underline-offset-2 cursor-pointer hover:text-foreground">
            Contact Support
          </span>
        </span>

      </div>
    </div>
  )
}

function ConnectionError({ onRetry }: { onRetry: () => void }) {
  const { logout } = useAuth()
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-3 max-w-sm px-4">
        <p className="font-semibold text-lg">Connection error</p>
        <p className="text-muted-foreground text-sm">
          Could not reach the server. Check your connection and try again.
        </p>
        <div className="flex items-center justify-center gap-4 pt-1">
          <button
            onClick={onRetry}
            className="text-sm underline text-foreground hover:text-muted-foreground"
          >
            Retry
          </button>
          <button
            onClick={logout}
            className="text-sm underline text-muted-foreground hover:text-foreground"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}

const VALID_PAGES = new Set([
  "dashboard", "discovering", "price-board", "tracked-urls",
  "products", "companies", "plans", "settings",
])
const B2C_BLOCKED = new Set(["products", "companies"])

function getHashPage(): string {
  const hash = window.location.hash.slice(1).split(":")[0]
  return VALID_PAGES.has(hash) ? hash : "dashboard"
}

function getHashSubTab(): string {
  return window.location.hash.slice(1).split(":")[1] ?? ""
}

function AppInner() {
  const { user, loading } = useAuth()
  const [currentPage, setCurrentPage] = useState(getHashPage)
  const [appState, setAppState] = useState<AppState>("loading")
  const [retryCount, setRetryCount] = useState(0)
  const [userRole, setUserRole]                   = useState<string | null>(null)
  const [selectedHistoryEntry, setSelectedHistoryEntry] = useState<any | null>(null)
  const [discoveryResetKey, setDiscoveryResetKey]       = useState(0)

  // Sync state → URL hash (only update if the page part changed — preserve sub-tabs like #settings:billing)
  useEffect(() => {
    const hashPage = window.location.hash.slice(1).split(":")[0]
    if (hashPage !== currentPage) window.location.hash = currentPage
  }, [currentPage])

  // Sync URL hash → state (browser back/forward)
  useEffect(() => {
    function onHashChange() {
      const page = getHashPage()
      setCurrentPage(page)
    }
    window.addEventListener("hashchange", onHashChange)
    return () => window.removeEventListener("hashchange", onHashChange)
  }, [])

  useEffect(() => {
    if (loading) return
    if (!user) { setAppState("loading"); return }

    setAppState("loading")
    user.getIdToken().then((token: string) =>
      fetch(`${API}/api/allowed-users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.success) {
            setUserRole(data.data?.role ?? null)
            setAppState("ready")
          }
          else if (data.error?.code === "NEW_USER") setAppState("denied")
          else setAppState("denied")
        })
        .catch(() => setAppState("error"))
    )
  }, [user, loading, retryCount])

  const isB2C = userRole === "b2c"

  function navigate(page: string) {
    if (isB2C && B2C_BLOCKED.has(page)) return
    // Re-clicking Market Discovery nav while already there → reset to new search
    // (NOT triggered by selectHistory — that calls setCurrentPage directly)
    if (page === "discovering" && currentPage === "discovering") {
      setSelectedHistoryEntry(null)
      setDiscoveryResetKey(k => k + 1)
    }
    setCurrentPage(page)
  }

  function selectHistory(entry: any) {
    // Set the entry first, then navigate without going through navigate()
    // so the reset logic in navigate() doesn't clear it
    setSelectedHistoryEntry(entry)
    setCurrentPage("discovering")
  }

  // Redirect B2C users: blocked pages → discovering, dashboard → discovering
  useEffect(() => {
    if (isB2C && (B2C_BLOCKED.has(currentPage) || currentPage === "dashboard")) {
      setCurrentPage("discovering")
    }
  }, [isB2C, currentPage])

  if (loading || (user && appState === "loading")) return <AppLoader />
  if (!user) return <LoginPage />
  if (appState === "onboarding") return <OnboardingContent onComplete={() => setRetryCount((n) => n + 1)} />
  if (appState === "denied") return <AccessDenied onChoosePlan={() => setAppState("onboarding")} />
  if (appState === "error") return <ConnectionError onRetry={() => setRetryCount((n) => n + 1)} />
  if (appState !== "ready") return <AppLoader />

  const role = (userRole ?? "b2b") as string

  const renderContent = () => {
    switch (currentPage) {
      // Original pages
      case "dashboard":       return <DashboardContent role={role} />
      case "playground":      return <PlaygroundContent role={role} />
      case "content-library": return <ContentLibraryContent role={role} />
      case "ai-services":     return <AIServicesContent role={role} />
      case "post-scheduler":  return <PostSchedulerContent role={role} />
      case "meta":            return <MetaContent role={role} />
      case "tiktok":          return <TikTokContent role={role} />
      case "youtube":         return <YouTubeContent role={role} />
      case "twitter":         return <TwitterContent role={role} />
      case "shopify":         return <ShopifyContent role={role} />
      case "settings":        return <SettingsContent role={role} onNavigate={navigate} initialTab={getHashSubTab()} />

      // RSP / Scraping Engine pages
      case "discovering":     return <DiscoveringContent key={discoveryResetKey} role={role} onNavigate={navigate} selectedHistoryEntry={selectedHistoryEntry} onClearHistory={() => setSelectedHistoryEntry(null)} />
      case "price-board":     return <PriceBoardContent role={role} onNavigate={navigate} />
      case "tracked-urls":    return <TrackedUrlsContent role={role} />
      case "products":        return isB2C ? <DashboardContent role={role} /> : <ProductsContent role={role} />
      case "companies":       return isB2C ? <DashboardContent role={role} /> : <CompaniesContent role={role} />

      case "plans":           return <PlansContent role={role} />

      default:                return <DashboardContent role={role} />
    }
  }

  return (
    <DashboardLayout currentPage={currentPage} onNavigate={navigate} userRole={userRole ?? "b2b"} onSelectHistory={selectHistory}>
      {renderContent()}
    </DashboardLayout>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  )
}
