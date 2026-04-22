import { useInViewOnce, useCountUp, formatCount } from "./utils"

interface Props {
  value:      number       // target number
  decimals?:  number       // how many decimals to show
  prefix?:    string
  suffix?:    string
  duration?:  number
  className?: string
}

/**
 * Counts up from 0 to `value` when scrolled into view.
 * For fixed labels (e.g. "24/7", "<3s"), skip this and render text directly.
 */
export function AnimatedCounter({
  value, decimals = 0, prefix = "", suffix = "", duration = 1600, className = "",
}: Props) {
  const [ref, inView] = useInViewOnce<HTMLSpanElement>()
  const v = useCountUp(value, duration, inView)
  return (
    <span ref={ref} className={className}>
      {prefix}
      {formatCount(v, decimals)}
      {suffix}
    </span>
  )
}
