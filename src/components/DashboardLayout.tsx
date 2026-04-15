import { ReactNode, useState, useEffect } from "react"
import {
  Home,
  Compass,
  TrendingUp,
  Package,
  Building2,
  Sparkles,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "./ui/sidebar"
import { TopNavigation } from "./TopNavigation"
import { UserMenuButton } from "./UserMenuButton"
import { Separator } from "./ui/separator"
import { useAuth } from "@/context/AuthContext"

declare const __APP_VERSION__: string

const API = import.meta.env.VITE_API_URL || "http://localhost:8080"

interface DashboardLayoutProps {
  children:          ReactNode
  currentPage:       string
  onNavigate:        (page: string) => void
  userRole?:         string
  userSubscription?: string | null
  onSelectHistory?:  (entry: any) => void
  sidebarRefreshKey?: number
}

function NavButton({
  item,
  currentPage,
  onNavigate,
}: {
  item: { title: string; icon: React.ElementType; id: string }
  currentPage: string
  onNavigate: (id: string) => void
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={currentPage === item.id}
        className="rounded-md transition-colors"
      >
        <button
          onClick={() => onNavigate(item.id)}
          className="flex items-center gap-2.5 w-full px-3 py-2"
        >
          <item.icon className="h-4 w-4 shrink-0" />
          <span className="text-sm">{item.title}</span>
        </button>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

export function DashboardLayout({ children, currentPage, onNavigate, userRole, userSubscription, onSelectHistory, sidebarRefreshKey }: DashboardLayoutProps) {
  const { user }  = useAuth()
  const isB2C     = userRole === "b2c"
  // B2C free plan hides Price Activity — pro/trial/weekly/monthly can see it
  const B2C_PAID_PLANS = new Set(["pro", "trial", "weekly", "monthly", "enterprise", "paid"])
  const hidePriceActivity = isB2C && !B2C_PAID_PLANS.has(userSubscription ?? "")
  const [sidebarHistory, setSidebarHistory] = useState<any[]>([])

  // Fetch last 3 searches for B2C sidebar
  useEffect(() => {
    if (!isB2C || !user) return
    let active = true
    ;(user as any).getIdToken().then((token: string) =>
      fetch(`${API}/api/discovery/b2c-history`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(j => {
          if (active && j.success) {
            setSidebarHistory((j.data || []).map((e: any) => ({
              ...e,
              results: typeof e.results === "string" ? JSON.parse(e.results) : e.results,
            })))
          }
        })
    ).catch(() => {})
    return () => { active = false }
  }, [isB2C, user, currentPage, sidebarRefreshKey])  // sidebarRefreshKey increments after each new search

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <Sidebar className="border-r">

          {/* Logo */}
          <SidebarHeader>
            <div className="flex items-center gap-2 px-4 py-3">
              <span className="font-bold text-sm tracking-tight truncate">Spark AI</span>
            </div>
          </SidebarHeader>

          <SidebarContent className="overflow-y-auto overflow-x-hidden">

            {/* ── Market Intelligence: Market Discovery + Price Activity ── */}
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <NavButton item={{ title: "Market Discovery", icon: Compass,   id: "discovering" }} currentPage={currentPage} onNavigate={onNavigate} />
                  {!hidePriceActivity && (
                    <NavButton item={{ title: "Price Activity",   icon: TrendingUp, id: "price-board"  }} currentPage={currentPage} onNavigate={onNavigate} />
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* ── Creator Intelligence (gap above) ── */}
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <NavButton item={{ title: "Creator Intel",        icon: Sparkles, id: "creator-intel"        }} currentPage={currentPage} onNavigate={onNavigate} />
                  <NavButton item={{ title: "Creator Intel (Old)",  icon: Sparkles, id: "creator-intel-backup" }} currentPage={currentPage} onNavigate={onNavigate} />
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* ── Products + Stores — gap above (new SidebarGroup), B2B/dev only ── */}
            {!isB2C && (
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <NavButton item={{ title: "Products", icon: Package,   id: "products"   }} currentPage={currentPage} onNavigate={onNavigate} />
                    <NavButton item={{ title: "Stores",   icon: Building2, id: "companies"  }} currentPage={currentPage} onNavigate={onNavigate} />
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}

            {/* ── Dashboard — gap above, B2B/dev only ── */}
            {!isB2C && (
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <NavButton item={{ title: "Dashboard", icon: Home, id: "dashboard" }} currentPage={currentPage} onNavigate={onNavigate} />
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}

            {/* B2C: search history at the bottom — hidden for now */}
            {false && isB2C && sidebarHistory.length > 0 && (
              <SidebarGroup className="mt-auto">
                <SidebarGroupLabel className="px-4 py-2">
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Recent Searches
                  </span>
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <div className="space-y-0.5 px-2 overflow-y-auto max-h-[360px]">
                    {sidebarHistory.map((entry) => {
                      const depth = entry.batch === 1 ? "Quick" : entry.batch === 2 ? "Standard" : entry.batch === 3 ? "Deep" : null
                      return (
                        <button
                          key={entry.id}
                          onClick={() => onSelectHistory?.(entry)}
                          className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md text-left hover:bg-muted/60 transition-colors group"
                        >
                          <span className="text-xs text-muted-foreground truncate group-hover:text-foreground transition-colors">
                            {entry.query}
                          </span>
                          {depth && (
                            <span className="text-[10px] text-muted-foreground/50 shrink-0">{depth}</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </SidebarGroupContent>
              </SidebarGroup>
            )}

          </SidebarContent>

          {/* Footer: user menu + version */}
          <SidebarFooter className="pb-2">
            <Separator className="mb-2" />
            <div className="px-2">
              <UserMenuButton onNavigate={onNavigate} refreshKey={sidebarRefreshKey} />
            </div>
            <div className="px-4 pt-1 pb-1">
              <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-mono text-muted-foreground select-none">
                v{__APP_VERSION__}
              </span>
            </div>
          </SidebarFooter>

        </Sidebar>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0">
          <TopNavigation />
          <main className="flex-1 overflow-auto p-4 sm:p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  )
}
