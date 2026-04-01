import { ReactNode, useState } from "react"
import {
  BarChart3,
  Home,
  Compass,
  TrendingUp,
  Link,
  Package,
  Building2,
  Users,
  Settings,
  ChevronDown,
  CreditCard,
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
import { Separator } from "./ui/separator"

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
      { title: "Tracked Listings", icon: Link,       id: "tracked-urls" },
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
  {
    label: "System",
    id: "rsp-system",
    items: [
      { title: "Plans",    icon: CreditCard, id: "plans"    },
      { title: "Users",    icon: Users,      id: "users"    },
      { title: "Settings", icon: Settings,   id: "settings" },
    ],
  },
]

interface DashboardLayoutProps {
  children: ReactNode
  currentPage: string
  onNavigate: (page: string) => void
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

export function DashboardLayout({ children, currentPage, onNavigate }: DashboardLayoutProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const toggle = (id: string) =>
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }))

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <Sidebar className="border-r">

          {/* Logo */}
          <SidebarHeader>
            <div className="flex items-center gap-2 px-4 py-3">
              <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center shrink-0">
                <BarChart3 className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-bold text-sm tracking-tight truncate">AI Scraping Engine</span>
            </div>
          </SidebarHeader>

          <SidebarContent className="overflow-y-auto overflow-x-hidden">

            {/* ── Dashboard home ── */}
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

            {/* ── RSP sections (collapsible) ── */}
            {rspSections.map((section) => {
              const isOpen = !collapsed[section.id]
              return (
                <SidebarGroup key={section.id}>
                  <SidebarGroupLabel asChild>
                    <button
                      onClick={() => toggle(section.id)}
                      className="w-full flex items-center justify-between px-4 py-2 cursor-pointer select-none"
                    >
                      <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                        {section.label}
                      </span>
                      <ChevronDown
                        className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${isOpen ? "" : "-rotate-90"}`}
                      />
                    </button>
                  </SidebarGroupLabel>
                  {isOpen && (
                    <SidebarGroupContent>
                      <SidebarMenu>
                        {section.items.map((item) => (
                          <NavButton key={item.id} item={item} currentPage={currentPage} onNavigate={onNavigate} />
                        ))}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  )}
                </SidebarGroup>
              )
            })}

          </SidebarContent>

          {/* Footer: version badge */}
          <SidebarFooter className="pb-3">
            <Separator className="mx-4 mb-2 w-auto" />
            <div className="px-4 pt-1">
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
