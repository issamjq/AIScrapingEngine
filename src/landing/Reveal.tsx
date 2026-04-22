import type { ReactNode } from "react"
import { useInView } from "./useInView"

interface Props {
  children:   ReactNode
  delay?:     number       // ms
  duration?:  number       // ms
  y?:         number       // px — how far from below
  x?:         number       // px — how far from left/right
  scale?:     boolean      // add subtle scale-in
  className?: string
  as?:        "div" | "section" | "article" | "li"
}

export function Reveal({
  children,
  delay     = 0,
  duration  = 850,
  y         = 28,
  x         = 0,
  scale     = false,
  className = "",
  as        = "div",
}: Props) {
  const { ref, inView } = useInView()

  const style: React.CSSProperties = {
    transform: inView
      ? "translate3d(0,0,0) scale(1)"
      : `translate3d(${x}px, ${y}px, 0)${scale ? " scale(0.96)" : ""}`,
    opacity: inView ? 1 : 0,
    transition: `transform ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, opacity ${Math.max(500, duration - 200)}ms ease-out ${delay}ms`,
    willChange: "transform, opacity",
  }

  if (as === "section") return <section ref={ref} className={className} style={style}>{children}</section>
  if (as === "article") return <article ref={ref} className={className} style={style}>{children}</article>
  if (as === "li")      return <li      ref={ref as never} className={className} style={style}>{children}</li>
  return <div ref={ref} className={className} style={style}>{children}</div>
}
