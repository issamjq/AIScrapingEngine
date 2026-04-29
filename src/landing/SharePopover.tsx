import { useState } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Share2, Facebook, Linkedin, Link2, Check } from "lucide-react"

interface Props {
  url:    string
  title:  string
  /** When false (default), renders a small icon-only button matching the public card layout. */
  large?: boolean
}

/**
 * Small share popover used on blog cards + the single post page.
 * Buttons: Facebook, X, LinkedIn, Copy URL.
 */
export function SharePopover({ url, title, large }: Props) {
  const [copied, setCopied] = useState(false)

  const absoluteUrl = url.startsWith("http") ? url : `${window.location.origin}${url.startsWith("/") ? url : `/${url}`}`
  const enc = (s: string) => encodeURIComponent(s)

  const links = {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${enc(absoluteUrl)}`,
    x:        `https://twitter.com/intent/tweet?url=${enc(absoluteUrl)}&text=${enc(title)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(absoluteUrl)}`,
  }

  function openSocial(href: string, e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation()
    window.open(href, "_blank", "noopener,noreferrer,width=600,height=600")
  }

  async function copy(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation()
    try {
      await navigator.clipboard.writeText(absoluteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // Fallback for older browsers
      const ta = document.createElement("textarea")
      ta.value = absoluteUrl
      document.body.appendChild(ta)
      ta.select()
      try { document.execCommand("copy"); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch {}
      document.body.removeChild(ta)
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={
            large
              ? "inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full border border-slate-200 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:hover:border-slate-500 dark:hover:bg-slate-800 transition-colors"
              : "inline-flex items-center gap-1 text-[11px] text-slate-600 hover:text-amber-600 dark:text-slate-300 dark:hover:text-amber-400 transition-colors"
          }
          aria-label="Share post"
        >
          <Share2 className={large ? "h-4 w-4" : "h-3.5 w-3.5"} />
          <span>Share</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top" align="end" sideOffset={8}
        className="w-auto p-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1">
          <ShareBtn label="Facebook" onClick={(e) => openSocial(links.facebook, e)}>
            <Facebook className="h-4 w-4 text-[#1877F2]" />
          </ShareBtn>
          <ShareBtn label="X" onClick={(e) => openSocial(links.x, e)}>
            <XIcon />
          </ShareBtn>
          <ShareBtn label="LinkedIn" onClick={(e) => openSocial(links.linkedin, e)}>
            <Linkedin className="h-4 w-4 text-[#0A66C2]" />
          </ShareBtn>
          <span className="w-px h-6 bg-border mx-0.5" />
          <ShareBtn label={copied ? "Copied!" : "Copy link"} onClick={copy}>
            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Link2 className="h-4 w-4 text-slate-600" />}
          </ShareBtn>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function ShareBtn({
  label, onClick, children,
}: {
  label:    string
  onClick:  (e: React.MouseEvent) => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="p-2 rounded-md hover:bg-muted transition-colors"
    >
      {children}
    </button>
  )
}

// X (formerly Twitter) — lucide doesn't ship the new logo. Inline SVG.
function XIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2H21.5l-7.7 8.797L23 22h-7.094l-5.55-7.262L4.07 22H.815l8.236-9.41L1 2h7.27l5.018 6.633L18.244 2zm-1.243 18h1.81L7.075 4H5.13l11.87 16z" />
    </svg>
  )
}
