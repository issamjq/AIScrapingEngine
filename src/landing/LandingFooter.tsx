const LINKS = {
  "Price Intelligence": ["Market Discovery", "Price Tracking", "Catalog Discovery", "B2C Search"],
  "Coming Soon":        ["TikTok Trending", "Creator Analytics", "Shop Intelligence"],
  "Company":            ["Pricing", "How it works", "Sign in"],
}

export function LandingFooter() {
  return (
    <footer className="border-t bg-muted/20">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-10">

          {/* Brand */}
          <div className="space-y-3 lg:col-span-1">
            <div className="flex items-center gap-2">
              <img src="/spark-logo.gif" alt="Spark" className="h-8 w-8 object-contain" />
              <span className="text-base font-bold">Spark AI</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              AI-powered price intelligence and market discovery for UAE retailers and global buyers.
            </p>
            <p className="text-[10px] text-muted-foreground">
              Powered by Spark AI
            </p>
          </div>

          {/* Link columns */}
          {Object.entries(LINKS).map(([col, links]) => (
            <div key={col}>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">{col}</p>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link}>
                    <span className="text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
                      {link}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">© 2026 Spark AI. All rights reserved.</p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="cursor-pointer hover:text-foreground transition-colors">Privacy Policy</span>
            <span className="cursor-pointer hover:text-foreground transition-colors">Terms of Service</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
