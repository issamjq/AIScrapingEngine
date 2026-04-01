import { Coins } from "lucide-react"
import { SidebarTrigger } from "./ui/sidebar"

export function TopNavigation() {
  return (
    <header className="flex h-14 sm:h-16 items-center justify-between border-b px-3 sm:px-6 bg-background sticky top-0 z-30">
      {/* Left: mobile sidebar trigger + title */}
      <div className="flex items-center gap-2 sm:gap-4 min-w-0">
        <SidebarTrigger className="shrink-0 md:hidden" />
        <h1 className="text-base sm:text-xl font-semibold truncate hidden sm:block">
          AI Scraping Engine
        </h1>
      </div>

      {/* Right: credits */}
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="hidden xs:flex items-center gap-1.5 px-2.5 py-1 bg-muted rounded-lg">
          <Coins className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs sm:text-sm font-medium whitespace-nowrap">2,500 credits</span>
        </div>
      </div>
    </header>
  )
}
