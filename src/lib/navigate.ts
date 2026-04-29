/**
 * SPA navigation helpers — pathname-based routing for the public landing.
 *
 * The app uses two routing systems side by side:
 * - Hash routing (`#discovering`, `#products`, …) for in-app pages behind auth.
 *   Those don't need to be crawlable.
 * - Pathname routing (`/blog`, `/blog/:slug`) for the public blog.
 *   Real URLs let Google index each post separately.
 *
 * Vercel rewrites every non-asset path to /index.html (see vercel.json), so
 * direct hits and refreshes work. SPA-internal navigation goes through
 * `navigate(path)` which calls history.pushState + dispatches a popstate
 * event so React listeners refresh.
 */

/** Navigate to a path without a full reload. Updates the URL bar + tells the app to re-route. */
export function navigate(path: string): void {
  if (typeof window === "undefined") return
  if (window.location.pathname === path) return
  window.history.pushState({}, "", path)
  window.dispatchEvent(new PopStateEvent("popstate"))
}

/**
 * onClick handler factory for `<a href="...">` links that should behave as SPA nav.
 * Falls back to the browser's default behavior for new-tab clicks (Cmd/Ctrl/Shift,
 * middle button) so users can still open posts in a new tab.
 */
export function onSpaLinkClick(path: string) {
  return (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented)             return
    if (e.button !== 0)                 return  // not a left click
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return  // open in new tab/window
    e.preventDefault()
    navigate(path)
  }
}
