import { useState, useEffect } from "react"
import { AuthProvider, useAuth } from "./context/AuthContext"
import { LoginPage } from "./components/LoginPage"
import { DashboardLayout } from "./components/DashboardLayout"
import { OnboardingContent } from "./components/OnboardingContent"
import { Skeleton } from "./components/ui/skeleton"

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
import { UsersManagementContent }  from "./components/UsersManagementContent"
import { PlansContent }            from "./components/PlansContent"

const API = import.meta.env.VITE_API_URL || "http://localhost:8080"

type AppState = "loading" | "onboarding" | "ready" | "denied"

function AppLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <Skeleton className="h-4 w-32" />
      </div>
    </div>
  )
}

function AccessDenied() {
  const { logout } = useAuth()
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-3 max-w-sm px-4">
        <p className="font-semibold text-lg">Access denied</p>
        <p className="text-muted-foreground text-sm">
          Your account is not authorised to use this application.
        </p>
        <button
          onClick={logout}
          className="text-sm underline text-muted-foreground hover:text-foreground"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}

function AppInner() {
  const { user, loading } = useAuth()
  const [currentPage, setCurrentPage] = useState("dashboard")
  const [appState, setAppState] = useState<AppState>("loading")

  useEffect(() => {
    if (loading) return
    if (!user) { setAppState("loading"); return }

    user.getIdToken().then((token: string) =>
      fetch(`${API}/api/allowed-users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.success) setAppState("ready")
          else if (data.error?.code === "NEW_USER") setAppState("onboarding")
          else setAppState("denied")
        })
        .catch(() => setAppState("denied"))
    )
  }, [user, loading])

  if (loading || (user && appState === "loading")) return <AppLoader />
  if (!user) return <LoginPage />
  if (appState === "onboarding") return <OnboardingContent onComplete={() => setAppState("ready")} />
  if (appState === "denied") return <AccessDenied />
  if (appState !== "ready") return <AppLoader />

  const renderContent = () => {
    switch (currentPage) {
      // Original pages
      case "dashboard":       return <DashboardContent />
      case "playground":      return <PlaygroundContent />
      case "content-library": return <ContentLibraryContent />
      case "ai-services":     return <AIServicesContent />
      case "post-scheduler":  return <PostSchedulerContent />
      case "meta":            return <MetaContent />
      case "tiktok":          return <TikTokContent />
      case "youtube":         return <YouTubeContent />
      case "twitter":         return <TwitterContent />
      case "shopify":         return <ShopifyContent />
      case "settings":        return <SettingsContent />

      // RSP / Scraping Engine pages
      case "discovering":     return <DiscoveringContent />
      case "price-board":     return <PriceBoardContent />
      case "tracked-urls":    return <TrackedUrlsContent />
      case "products":        return <ProductsContent />
      case "companies":       return <CompaniesContent />
      case "users":           return <UsersManagementContent />
      case "plans":           return <PlansContent />

      default:                return <DashboardContent />
    }
  }

  return (
    <DashboardLayout currentPage={currentPage} onNavigate={setCurrentPage}>
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
