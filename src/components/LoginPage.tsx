import { useState } from "react"
import { useAuth } from "@/context/AuthContext"
import { Search, TrendingDown, Bell, BarChart3, ShoppingCart } from "lucide-react"
import { Button } from "./ui/button"

declare const __APP_VERSION__: string

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

export function LoginPage() {
  const { signInWithGoogle, error, loading } = useAuth()
  const [signingIn, setSigningIn] = useState(false)

  const handleSignIn = async () => {
    setSigningIn(true)
    await signInWithGoogle()
    setSigningIn(false)
  }

  const features = [
    { icon: Search, label: "AI Market Discovery", desc: "Auto-find product listings across any retailer or marketplace" },
    { icon: TrendingDown, label: "Live Price Tracking", desc: "Monitor competitor prices in real-time, automatically" },
    { icon: Bell, label: "Price Drop Alerts", desc: "Get notified instantly when competitor prices change" },
    { icon: ShoppingCart, label: "Multi-Retailer Coverage", desc: "Track products across all major e-commerce platforms" },
  ]

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary flex-col justify-between p-12 text-primary-foreground">
        <div className="flex items-center gap-3">
          <img src="/spark-logo.gif" alt="Spark" className="h-10 w-10 object-contain" />
          <span className="text-xl font-bold">Spark</span>
        </div>

        <div className="space-y-8">
          <div>
            <h1 className="text-4xl font-bold leading-tight mb-4">
              Track Every Price.<br />Beat Every Competitor.
            </h1>
            <p className="text-primary-foreground/70 text-lg leading-relaxed">
              AI-powered price intelligence for online retailers. Discover product listings, monitor competitor prices, and stay ahead — automatically.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {features.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-md bg-primary-foreground/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="h-4 w-4 text-primary-foreground" />
                </div>
                <div>
                  <p className="font-medium text-sm">{label}</p>
                  <p className="text-primary-foreground/60 text-xs mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-primary-foreground/40 text-xs">
          v{__APP_VERSION__} · Spark
        </p>
      </div>

      {/* Right panel — sign in */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12">
        {/* Mobile logo */}
        <div className="flex lg:hidden items-center gap-2 mb-10">
          <img src="/spark-logo.gif" alt="Spark" className="h-9 w-9 object-contain" />
          <span className="text-lg font-bold">Spark</span>
        </div>

        <div className="w-full max-w-sm space-y-8">
          <div className="text-center">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Welcome</h2>
            <p className="text-muted-foreground mt-2 text-sm">
              Sign in to your price intelligence dashboard
            </p>
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/40 px-4 py-3 text-center">
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Gmail accounts only</span>
                {" "}— @gmail.com required
              </p>
            </div>

            <Button
              onClick={handleSignIn}
              disabled={loading || signingIn}
              variant="outline"
              className="w-full h-12 text-sm font-medium gap-3 border-2 hover:bg-muted/50 transition-all"
            >
              {signingIn ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Signing in…
                </>
              ) : (
                <>
                  <GoogleIcon />
                  Continue with Google
                </>
              )}
            </Button>

            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive text-center">
                {error}
              </div>
            )}
          </div>

          <p className="text-center text-xs text-muted-foreground leading-relaxed">
            By signing in you agree to our{" "}
            <span className="underline underline-offset-2 cursor-pointer hover:text-foreground">Terms</span>
            {" "}and{" "}
            <span className="underline underline-offset-2 cursor-pointer hover:text-foreground">Privacy Policy</span>
          </p>
        </div>

        <p className="lg:hidden mt-12 text-xs text-muted-foreground">v{__APP_VERSION__}</p>
      </div>
    </div>
  )
}
