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
  Settings, Sparkles,
  LogOut, ChevronUp,
} from "lucide-react"

const API = import.meta.env.VITE_API_URL || "http://localhost:8080"

const PLAN_LABELS: Record<string, string> = {
  trial:    "Trial plan",
  free:     "Free plan",
  paid:     "Pro plan",
  pro:      "Pro plan",
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
  onNavigate:  (page: string) => void
  refreshKey?: number  // increments after each search/deduction to re-fetch wallet
}

export function UserMenuButton({ onNavigate, refreshKey }: Props) {
  const { user, logout } = useAuth()
  const [subscription, setSubscription] = useState<string>("free")
  const [role, setRole]                 = useState<string>("b2c")
  const [balance, setBalance]           = useState<number | null>(null)
  const [totalAdded, setTotalAdded]     = useState<number>(0)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    async function fetchProfile() {
      try {
        const token = await (user as any).getIdToken()
        const [meRes, walletRes] = await Promise.all([
          fetch(`${API}/api/allowed-users/me`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API}/api/wallet`,           { headers: { Authorization: `Bearer ${token}` } }),
        ])
        const [me, wallet] = await Promise.all([meRes.json(), walletRes.json()])
        if (!cancelled && me.success && me.data) {
          setSubscription(me.data.subscription || "free")
          setRole(me.data.role || "b2c")
        }
        if (!cancelled && wallet.success && wallet.data?.wallet) {
          setBalance(wallet.data.wallet.balance)
          setTotalAdded(wallet.data.wallet.total_added || 0)
        }
      } catch { /* silent */ }
    }
    fetchProfile()
    return () => { cancelled = true }
  }, [user, refreshKey])  // refreshKey increments after every search so balance stays current

  const displayName = user?.displayName || user?.email || "User"
  const email       = user?.email || ""
  const initials    = getInitials(user?.displayName || null)
  const isUnlimited = ["dev", "owner"].includes(role)

  const planLabel = isUnlimited
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
            <p className="text-[11px] text-muted-foreground truncate leading-tight">
              {planLabel}
              {!isUnlimited && balance !== null && (
                <span className="ml-1.5 text-primary font-semibold">· {balance} credits</span>
              )}
            </p>
          </div>
          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 opacity-60 group-hover:opacity-100 transition-opacity" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent side="top" align="start" className="w-64 mb-1">

        {/* Email header */}
        <DropdownMenuLabel className="font-normal text-xs text-muted-foreground px-3 py-2">
          {email}
        </DropdownMenuLabel>

        {/* Wallet balance */}
        {!isUnlimited && balance !== null && (() => {
          const pct     = totalAdded > 0 ? Math.round((balance / totalAdded) * 100) : 0
          const r       = 16
          const circ    = 2 * Math.PI * r
          const offset  = circ * (1 - pct / 100)
          return (
            <>
              <DropdownMenuSeparator />
              <div className="flex items-center gap-3 px-3 py-2.5">
                {/* Circular progress ring */}
                <div className="relative shrink-0" style={{ width: 40, height: 40 }}>
                  <svg width="40" height="40" style={{ display: "block", transform: "rotate(-90deg)" }}>
                    <circle cx="20" cy="20" r={r} fill="none" stroke="#e5e7eb" strokeWidth="2.5" />
                    <circle
                      cx="20" cy="20" r={r} fill="none"
                      stroke="#EAB308"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeDasharray={circ}
                      strokeDashoffset={offset}
                      style={{ transition: "stroke-dashoffset 0.5s ease" }}
                    />
                  </svg>
                  <span style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }} className="text-[9px] font-bold text-yellow-500 leading-none">{pct}%</span>
                </div>
                <div>
                  <p className="text-xs font-semibold">{balance} credits remaining</p>
                  <p className="text-[10px] text-muted-foreground">Top up coming soon</p>
                </div>
              </div>
            </>
          )
        })()}

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => onNavigate("settings")} className="gap-2.5 cursor-pointer">
          <Settings className="h-4 w-4 text-muted-foreground" />
          Settings
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => onNavigate("plans")} className="gap-2.5 cursor-pointer">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          Upgrade plan
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
