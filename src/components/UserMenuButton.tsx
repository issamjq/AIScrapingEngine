import { useEffect, useState } from "react"
import { useAuth } from "@/context/AuthContext"
import { Avatar, AvatarFallback } from "./ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"
import {
  Settings, Globe, HelpCircle, Sparkles,
  Info, LogOut, ChevronUp,
} from "lucide-react"

const API = import.meta.env.VITE_API_URL || "http://localhost:8080"

const PLAN_LABELS: Record<string, string> = {
  trial:    "Trial plan",
  free:     "Free plan",
  paid:     "Pro plan",
  business: "Business plan",
  dev:      "Developer",
  owner:    "Owner",
}

function getInitials(name: string | null): string {
  if (!name) return "?"
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "?"
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

interface Props {
  onNavigate: (page: string) => void
}

export function UserMenuButton({ onNavigate }: Props) {
  const { user, logout } = useAuth()
  const [subscription, setSubscription] = useState<string>("free")
  const [role, setRole]                 = useState<string>("b2c")

  useEffect(() => {
    if (!user) return
    let cancelled = false
    async function fetchProfile() {
      try {
        const token = await (user as any).getIdToken()
        const res   = await fetch(`${API}/api/allowed-users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const json  = await res.json()
        if (!cancelled && json.success && json.data) {
          setSubscription(json.data.subscription || "free")
          setRole(json.data.role || "b2c")
        }
      } catch { /* silent */ }
    }
    fetchProfile()
    return () => { cancelled = true }
  }, [user])

  const displayName = user?.displayName || user?.email || "User"
  const email       = user?.email || ""
  const initials    = getInitials(user?.displayName || null)

  // Plan label: dev/owner roles override subscription label
  const planLabel = ["dev", "owner"].includes(role)
    ? PLAN_LABELS[role]
    : PLAN_LABELS[subscription] ?? "Free plan"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted transition-colors text-left group focus:outline-none">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate leading-tight">{displayName}</p>
            <p className="text-[11px] text-muted-foreground truncate leading-tight">{planLabel}</p>
          </div>
          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 opacity-60 group-hover:opacity-100 transition-opacity" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent side="top" align="start" className="w-64 mb-1">

        {/* Email header */}
        <DropdownMenuLabel className="font-normal text-xs text-muted-foreground px-3 py-2">
          {email}
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => onNavigate("settings")} className="gap-2.5 cursor-pointer">
          <Settings className="h-4 w-4 text-muted-foreground" />
          Settings
        </DropdownMenuItem>

        <DropdownMenuItem disabled className="gap-2.5 cursor-pointer">
          <Globe className="h-4 w-4 text-muted-foreground" />
          Language
        </DropdownMenuItem>

        <DropdownMenuItem disabled className="gap-2.5 cursor-pointer">
          <HelpCircle className="h-4 w-4 text-muted-foreground" />
          Get help
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => onNavigate("plans")} className="gap-2.5 cursor-pointer">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          Upgrade plan
        </DropdownMenuItem>

        <DropdownMenuItem disabled className="gap-2.5 cursor-pointer">
          <Info className="h-4 w-4 text-muted-foreground" />
          Learn more
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={logout}
          className="gap-2.5 cursor-pointer text-destructive focus:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          Log out
        </DropdownMenuItem>

      </DropdownMenuContent>
    </DropdownMenu>
  )
}
