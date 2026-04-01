import { useState } from "react"
import { AuthProvider, useAuth } from "./context/AuthContext"
import { LoginPage } from "./components/LoginPage"
import { DashboardLayout } from "./components/DashboardLayout"

// Original pages
import { DashboardContent }     from "./components/DashboardContent"
import { PlaygroundContent }    from "./components/PlaygroundContent"
import { ContentLibraryContent } from "./components/ContentLibraryContent"
import { AIServicesContent }    from "./components/AIServicesContent"
import { PostSchedulerContent } from "./components/PostSchedulerContent"
import { MetaContent }          from "./components/MetaContent"
import { TikTokContent }        from "./components/TikTokContent"
import { YouTubeContent }       from "./components/YouTubeContent"
import { TwitterContent }       from "./components/TwitterContent"
import { ShopifyContent }       from "./components/ShopifyContent"
import { SettingsContent }      from "./components/SettingsContent"

// RSP / Scraping Engine pages
import { DiscoveringContent }       from "./components/DiscoveringContent"
import { PriceBoardContent }        from "./components/PriceBoardContent"
import { TrackedUrlsContent }       from "./components/TrackedUrlsContent"
import { ProductsContent }          from "./components/ProductsContent"
import { CompaniesContent }         from "./components/CompaniesContent"
import { UsersManagementContent }   from "./components/UsersManagementContent"
import { PlansContent }             from "./components/PlansContent"

import { Skeleton } from "./components/ui/skeleton"

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

function AppInner() {
  const { user, loading } = useAuth()
  const [currentPage, setCurrentPage] = useState("dashboard")

  if (loading) return <AppLoader />
  if (!user) return <LoginPage />

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
