import { ReactNode, useState, useEffect } from "react"
import {
  BarChart3,
  Home,
  Compass,
  TrendingUp,
  Package,
  Building2,
  ChevronDown,
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

// ── Navigation sections ───────────────────────────────────────────
const rspSections = [
  {
    label: "AI",

    id: "rsp-ai",
    items: [
      { title: "Market Discovery", icon: Compass, id: "discovering" },
    ],
  },
  {
    label: "Monitoring",
    id: "rsp-monitoring",
    items: [
      { title: "Price Activity",   icon: TrendingUp, id: "price-board" },
    ],
  },
  {
    label: "Catalog",
    id: "rsp-catalog",
    items: [
      { title: "Products", icon: Package,   id: "products" },
      { title: "Stores",   icon: Building2, id: "companies" },
    ],
  },
]

const API = import.meta.env.VITE_API_URL || "http://localhost:8080"

interface DashboardLayoutProps {
  children:        ReactNode
  currentPage:     string
  onNavigate:      (page: string) => void
  userRole?:       string
  onSelectHistory?: (entry: any) => void
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

export function DashboardLayout({ children, currentPage, onNavigate, userRole, onSelectHistory }: DashboardLayoutProps) {
  const { user }  = useAuth()
  const isB2C     = userRole === "b2c"
  const [collapsed, setCollapsed]           = useState<Record<string, boolean>>({})
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
  }, [isB2C, user, currentPage])  // re-fetch when navigating back (catches new searches)

  const toggle = (id: string) =>
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }))

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <Sidebar className="border-r">

          {/* Logo */}
          <SidebarHeader>
            <div className="flex items-center gap-2 px-4 py-3">
              <img src="/spark-logo.gif" alt="Spark AI" className="h-8 w-8 object-contain shrink-0" />
              <span className="font-bold text-sm tracking-tight truncate">Spark AI</span>
            </div>
          </SidebarHeader>

          <SidebarContent className="overflow-y-auto overflow-x-hidden">

            {/* ── Dashboard home — hidden for B2C ── */}
            {!isB2C && (
              <>
                <SidebarGroup>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      <NavButton
                        item={{ title: "Dashboard", icon: Home, id: "dashboard" }}
                        currentPage={currentPage}
                        onNavigate={onNavigate}
                      />
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
                <Separator className="mx-4 my-1 w-auto" />
              </>
            )}

            {/* ── RSP sections (collapsible) ── */}
            {rspSections.filter(s => !(isB2C && s.id === "rsp-catalog")).map((section) => {
              const isOpen = !collapsed[section.id]
              return (
                <SidebarGroup key={section.id}>
                  <SidebarGroupLabel className="px-4 py-2">
                    <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                      {section.label}
                    </span>
                  </SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {section.items.map((item) => (
                        <NavButton key={item.id} item={item} currentPage={currentPage} onNavigate={onNavigate} />
                      ))}
                    </SidebarMenu>

                    {/* B2C: recent searches below Market Discovery */}
                    {isB2C && section.id === "rsp-ai" && sidebarHistory.length > 0 && (
                      <div className="mt-1 space-y-0.5 px-2">
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
                    )}
                  </SidebarGroupContent>
                </SidebarGroup>
              )
            })}

          </SidebarContent>

          {/* Footer: user menu + version */}
          <SidebarFooter className="pb-2">
            <Separator className="mx-4 mb-2 w-auto" />
            <div className="px-2">
              <UserMenuButton onNavigate={onNavigate} />
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
