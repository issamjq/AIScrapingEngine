import { ReactNode } from "react"
import {
  BarChart3,
  PlaySquare,
  FileText,
  Bot,
  Calendar,
  Send,
  Facebook,
  Music,
  Youtube,
  Twitter,
  ShoppingCart,
  Settings,
  Home,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "./ui/sidebar"
import { TopNavigation } from "./TopNavigation"
import { Separator } from "./ui/separator"

declare const __APP_VERSION__: string

const menuItems = [
  { title: "Dashboard",       icon: Home,         id: "dashboard" },
  { title: "Playground",      icon: PlaySquare,   id: "playground" },
  { title: "Content Library", icon: FileText,     id: "content-library" },
  { title: "AI Services",     icon: Bot,          id: "ai-services" },
  { title: "Post Scheduler",  icon: Calendar,     id: "post-scheduler" },
]

const integrationItems = [
  { title: "Omnisend",  icon: Send,         id: "omnisend" },
  { title: "Meta",      icon: Facebook,     id: "meta" },
  { title: "TikTok",    icon: Music,        id: "tiktok" },
  { title: "YouTube",   icon: Youtube,      id: "youtube" },
  { title: "Twitter/X", icon: Twitter,      id: "twitter" },
  { title: "Shopify",   icon: ShoppingCart, id: "shopify" },
]

interface DashboardLayoutProps {
  children: ReactNode
  currentPage: string
  onNavigate: (page: string) => void
}

export function DashboardLayout({ children, currentPage, onNavigate }: DashboardLayoutProps) {
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
              <span className="font-bold text-sm tracking-tight">AI Scraping Engine</span>
            </div>
          </SidebarHeader>

          <SidebarContent className="overflow-y-auto">
            {/* Main menu */}
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {menuItems.map((item) => (
                    <SidebarMenuItem key={item.id}>
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
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <Separator className="mx-4 my-1 w-auto" />

            {/* Integrations */}
            <SidebarGroup>
              <div className="px-4 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Integrations
                </p>
              </div>
              <SidebarGroupContent>
                <SidebarMenu>
                  {integrationItems.map((item) => (
                    <SidebarMenuItem key={item.id}>
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
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          {/* Footer: Settings + Version */}
          <SidebarFooter className="pb-3">
            <Separator className="mx-4 mb-2 w-auto" />
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={currentPage === "settings"}
                  className="rounded-md transition-colors"
                >
                  <button
                    onClick={() => onNavigate("settings")}
                    className="flex items-center gap-2.5 w-full px-3 py-2"
                  >
                    <Settings className="h-4 w-4 shrink-0" />
                    <span className="text-sm">Settings & Accounts</span>
                  </button>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>

            {/* Version badge */}
            <div className="px-4 pt-2">
              <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-mono text-muted-foreground select-none">
                v{__APP_VERSION__}
              </span>
            </div>
          </SidebarFooter>
        </Sidebar>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0">
          <TopNavigation />
          {/* Mobile sidebar trigger is inside TopNavigation */}
          <main className="flex-1 overflow-auto p-4 sm:p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  )
}
