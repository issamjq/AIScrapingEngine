import { Bell, Coins, LogOut, Settings, User } from "lucide-react"
import { Button } from "./ui/button"
import { Badge } from "./ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"
import { SidebarTrigger } from "./ui/sidebar"
import { useAuth } from "@/context/AuthContext"

export function TopNavigation() {
  const { user, logout } = useAuth()

  const displayName = user?.displayName ?? "User"
  const email = user?.email ?? ""
  const photoURL = user?.photoURL ?? ""
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <header className="flex h-14 sm:h-16 items-center justify-between border-b px-3 sm:px-6 bg-background sticky top-0 z-30">
      {/* Left: mobile sidebar trigger + title */}
      <div className="flex items-center gap-2 sm:gap-4 min-w-0">
        <SidebarTrigger className="shrink-0 md:hidden" />
        <h1 className="text-base sm:text-xl font-semibold truncate hidden sm:block">
          AI Scraping Engine
        </h1>
      </div>

      {/* Right: credits + notifications + user */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Credits — hidden on very small screens */}
        <div className="hidden xs:flex items-center gap-1.5 px-2.5 py-1 bg-muted rounded-lg">
          <Coins className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs sm:text-sm font-medium whitespace-nowrap">2,500 credits</span>
        </div>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative h-8 w-8 sm:h-9 sm:w-9">
          <Bell className="h-4 w-4" />
          <Badge className="absolute -top-1 -right-1 h-4 w-4 sm:h-5 sm:w-5 flex items-center justify-center p-0 text-[10px] sm:text-xs">
            3
          </Badge>
        </Button>

        {/* User dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 rounded-full p-0">
              <Avatar className="h-8 w-8">
                {photoURL && <AvatarImage src={photoURL} alt={displayName} />}
                <AvatarFallback className="text-xs font-semibold">{initials}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none truncate">{displayName}</p>
                <p className="text-xs leading-none text-muted-foreground truncate">{email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2">
              <User className="h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 text-destructive focus:text-destructive"
              onClick={logout}
            >
              <LogOut className="h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
